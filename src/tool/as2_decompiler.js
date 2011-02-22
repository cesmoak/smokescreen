define(function(require, exports, module) {

var ext = require('lib/ext')
var as2_vm = require('as2/vm')
var BitVector = require('util/bit_vector').BitVector
var Stack = require('util/stack').Stack

var VM = as2_vm.VM
var Type = as2_vm.Type
var Property = as2_vm.Property
var ActionCode = as2_vm.ActionCode

var As2Decompiler = function() {
    this._null = {tag:'val', val:null}
    this._undef = {tag:'val', val:undefined}
    this._ctx = {tag:'var', name:'__ctx'}
    this._target = {tag:'ctx-get', name:{tag:'var', name:'_root'}}
    this._this = {tag:'var', name:'this'}
    this._arguments = {tag:'var', name:'arguments'}
    this._root = {tag:'var', name:'_root'}
    this._parent = {tag:'var', name:'_parent'}
    this._global = {tag:'var', name:'_global'}
    this.tmpNum = 1
    
    this.consts = []
    this.scopes = []
}
As2Decompiler.reserved = [
    'null',
    'undefined',
    'true',
    'false',
    'break',
    'case',
    'catch',
    'continue',
    'default',
    'delete',
    'do',
    'else',
    'finally',
    'for',
    'function',
    'if',
    'in',
    'instanceof',
    'new',
    'return',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'abstract',
    'boolean',
    'byte',
    'char',
    'class',
    'const',
    'debugger',
    'double',
    'enum',
    'export',
    'extends',
    'final',
    'float',
    'goto',
    'implements',
    'import',
    'int',
    'interface',
    'long',
    'native',
    'package',
    'private',
    'protected',
    'public',
    'short',
    'static',
    'super',
    'synchronized',
    'throws',
    'transient',
    'volatile'
]
As2Decompiler.patterns = [
    {
        seq: ['PushDuplicate', 'Not', 'If', 'Pop'],
        handler: 'LogicalAnd'
    },
    {
        seq: ['PushDuplicate', 'If', 'Pop'],
        handler: 'LogicalOr'
    },
    {
        seq: ['Enumerate2', 'StoreRegister', 'Push', 'Equals2', 'If', 'Push', 'StoreRegister', 'Pop'],
        handler: 'ForIn'
    },
    {
        seq: ['StoreRegister', 'SetVariable', 'Push'],
        handler: 'SetVariableExpr'
    },
    {
        seq: ['StoreRegister', 'SetMember', 'Push'],
        handler: 'SetMemberExpr'
    }
]
ext.add(As2Decompiler.prototype, {
    
    stmts : function(arr) {
        return {tag:'stmts', stmts:arr}
    },
    
    _goto : function(i) {
        return {tag:'goto', op:i}
    },

    defineVar : function(name, value) {
        return {tag:'define-var', name:name, value:value}
    },

    forIn : function(_var, e, block) {
        return {tag:'for-in', _var:_var, e:e, block:block}
    },

    funcScope : function(op) {
        var c = ActionCode
        var regs = []
        var params = []
        if (op.ActionCode == c.DefineFunction) {
            for (var i = 0; i < op.NumParams; i++) {
                params.push(op.Parameters[i])
            }
        }
        else {
            for (var i = 0; i < op.NumParams; i++) {
                var param = op.Parameters[i]
                var reg = param.Register
                if (reg) {
                    regs[reg] = this._var(param.ParamName)
                }
                params[i] = param.ParamName
            }
            var reg = 1
            // this
            if (op.PreloadThisFlag) {
                regs[reg++] = this._this
            }
            // arguments
            if (op.PreloadArgumentsFlag) {
                regs[reg++] = this._arguments
            }
            // super
            // XXX: supported?
            if (op.PreloadSuperFlag) {
                regs[reg++] = this._var('super')
            }
            // _root
            if (op.PreloadRootFlag) {
                regs[reg++] = this._root
            }
            // _parent
            if (op.PreloadParentFlag) {
                regs[reg++] = this._parent
            }
            // global
            if (op.PreloadGlobalFlag) {
                regs[reg++] = this._global
            }
        }
        return [regs, params]
    },

    scope : function(ops, def) {
        var fn
        if (def) {
            fn = this.funcScope(def)
        }
        else {
            fn = [[], []]
        }
        var scope = {ops:ops, stack:[], blocks:[], regs:fn[0], params:fn[1], def:def}
        this.scopes.push(scope)
        this.resolveJumps(scope)
        this.resolveWiths(scope)
        this.buildBlocks(scope)
        this.calcDominators(scope)
        this.findStandardPatterns(scope)
        this.findLoops(scope)
        this.findLoopControls(scope)
        this.findSwitches(scope)
        return scope
    },

    findSwitches : function(scope) {
        scope.switches = []
        var c = ActionCode
        var ops = scope.ops
        var state = 0
        var s, _case
        for (var i = 0; i < ops.length;) {
            var op = ops[i]
            switch (state) {
            case 0:
                s = {cases: []}
                state = 'pre'
                break
            case 'pre':
                // switch starts with storeregister(reg(0))
                if (op.ActionCode == c.StoreRegister && op.RegisterNumber == 0) {
                    s.start = i
                    _case = {start: i}
                    state = 2
                }
                i++
                break
            case 1:
                // cases (after the first) start with push(reg(0),...)
                if (op.ActionCode == c.Push && op.Values[0].Type == 4 && op.Values[0].Value == 0) {
                    _case = {start: i}
                    state = 2
                }
                // we've reached the default case or the end; finish up the switch
                else if (op.ActionCode == c.Jump) {
                    s._default = i
                    s.last = Math.max(s.cases[s.cases.length - 1].label, op.label[1])
                    scope.switches.push(s)
                    state = 0
                }
                // anything else is invalid; restart search
                else {
                    state = 0
                    i--
                }
                i++
                break
            case 2:
                // invalid in case expr; restart search
                if (op.ActionCode == c.If || op.ActionCode == c.Jump) {
                    state = 0
                }
                // cases end with strictequals, if
                else if (
                    op.ActionCode == c.StrictEquals &&
                    ops[i + 1].ActionCode == c.If &&
                    ops[i + 1].BranchOffset > 0
                ) {
                    _case.label = ops[i + 1].label[1]
                    // cases jump incrementally (except possibly default)
                    // we're not jumping past furthest point; restart search
                    if (s.cases.length && _case.label < s.cases[s.cases.length - 1].label) {
                        state = 0
                    }
                    // we're jumping eq or past the last case; record this case, then step to the next case
                    else {
                        _case.cmp = i
                        var cases = ops[_case.label]._cases
                        if (!cases) {
                            cases = ops[_case.label]._cases = []
                        }
                        ops[_case.label]._switch = s
                        cases.push(_case)
                        s.cases.push(_case)
                        state = 1
                        i++
                    }
                }
                // part of the case expr
                else {
                    // nop
                }
                i++
                break
            }
        }
        for (var i = 0; i < scope.switches.length; i++) {
            var s = scope.switches[i]
            var op = scope.ops[s.start]
            op.ActionCode = c._Switch
            op._switch = s
            var header = this.blockForIndex(scope, s.start)
            // remove unnecessary register push, set case statements
            for (var j = 0; j < s.cases.length; j++) {
                var _case = s.cases[j]
                var op = scope.ops[_case.start]
                if (op.ActionCode == c.Push) {
                    op.Values.shift()
                }
                // get rid of pops that will create multiple statements when we need a seq of exprs
                for (var k = _case.start + 1; k < _case.cmp; k++) {
                    op = scope.ops[k]
                    if (op.ActionCode == c.Pop) {
                        op.ActionCode = c._Nop
                    }
                }
                op = scope.ops[_case.cmp]
                op.ActionCode = c._Nop
                op = scope.ops[_case.cmp + 1]
                op.ActionCode = c._Case
                op._case = _case
            }
            if (s.cases.length) {
                // set break statements
                s.post = s.last
                for (var j = s.cases[0].label; j < s.post; j++) {
                    var op = scope.ops[j]
                    if (op.ActionCode == c.Jump && op.label[1] >= s.post) {
                        op.ActionCode = c._Break
                        s.post = op.label[1]
                    }
                }
            }
            op = scope.ops[s._default]
            // we have no breaks to point to the end (so we have a default), or we have a default
            if (s.post == s.last || op.label[1] != s.post) {
                op.ActionCode = c._Default
                scope.ops[op.label[1]]._default = true
            }
            else {
                op.ActionCode = c._Nop
            }
        }
    },

    blockForIndex : function(scope, i) {
        for (var j = 0; j < scope.blockList.length; j++) {
            var block = scope.blockList[j]
            if (block.i <= i && block.i + block.length > i) {
                return block
            }
        }
        return null
    },

    

/*
    nextDominator : function(scope, b) {
        for (var i = b.id + 1; i < scope.blockList.length; i++) {
            if (b.dominators.get(i)) {
                return scope.blockList[i]
            }
        }
        return null
    },
*/

    findLoopControls : function(scope) {
        var c = ActionCode
        var loops = scope.loops
        for (var i = 0; i < loops.length; i++) {
            var loop = loops[i]
            for (var j = loop.header; j < loop.tail; j++) {
                var block = scope.blockList[j]
                var k = block.i + block.length - 1
                var op = scope.ops[k]
                if (op.ActionCode == c.Jump) {
                    var to = op.label[1]
                    if (to == scope.blockList[loop.header].i) {
                        op.ActionCode = c._Continue
                    }
                    else if (loop.post in scope.blockList && to == scope.blockList[loop.post].i) {
                        op.ActionCode = c._Break
                    }
                }
                /*
                else if (op.ActionCode == c.If) {
                    var to = op.label[1]
                    if (to == scope.blockList[loop.header].i) {
                        op.ActionCode = c._IfContinue
                    }
                    else if (to == scope.blockList[loop.post].i) {
                        op.ActionCode = c._IfBreak
                    }
                }
                */
            }
        }
    },

    getBlock : function(scope, i) {
        if (!(i in scope.blocks)) {
            scope.blocks[i] = {i:i, preds:[], succs:[]}
        }
        return scope.blocks[i]
    },

    nextLabel : function(scope, i) {
        var labels = scope.labels
        var ops = scope.ops
        for (var j = i + 1; j < ops.length; j++) {
            if (j in labels) {
                return j
            }
        }
        return ops.length - 1
    },

    nextBranch : function(scope, i) {
        var c = ActionCode
        var labels = scope.labels
        var ops = scope.ops
        for (var j = i; j < ops.length; j++) {
            var op = ops[j]
            switch (op.ActionCode) {
            case c.Jump:
            case c.If:
            case c.Return:
                return j
            }
        }
        return ops.length - 1
    },

    buildBlocks : function(scope) {
        var c = ActionCode
        var ops = scope.ops
        var labels = scope.labels
        scope.entryBlock = this.getBlock(scope, 0)
        scope.exitBlock = this.getBlock(scope, -1)
        if (ops.length == 0) {
            scope.entryBlock.length = 0
            return
        }
        var i
        var work = [0]
        var visited = {}
        while (work.length) {
            i = work.pop()
            if (i in visited) {
                continue
            }
            visited[i] = true
            if (i >= ops.length) {
                continue
            }
            if (i in scope.blocks && scope.blocks[i].length) {
                continue
            }
            var block = this.getBlock(scope, i)
            var label = this.nextLabel(scope, i)
            var branch = this.nextBranch(scope, i)
            var min = Math.min(label, branch)
            if (label == i) {
                block.length = 1
                continue
            }
            if (label <= branch) {
                block.length = label - block.i
                var _next = this.getBlock(scope, label)
                _next.preds.push(block)
                block.succs.push(_next)
                work.push(label)
            }
            else {
                block.length = branch + 1 - i
                var op = ops[branch]
                if (op.ActionCode == c.Return || op.ActionCode == c.End) {
                    scope.exitBlock.preds.push(block)
                    block.succs.push(scope.exitBlock)
                    continue
                }
                var target = op.label[1]
                var _next = this.getBlock(scope, target)
                _next.preds.push(block)
                block.succs.push(_next)
                work.push(target)
                if (op.ActionCode == c.If) {
                    var target = branch + 1
                    var _next = this.getBlock(scope, target)
                    _next.preds.push(block)
                    block.succs.push(_next)
                    work.push(target)
                }
            }
        }
    },

    calcDominators : function(scope) {
        // build a dense array of blocks
        var blocks = scope.blockList = []
        for (var i = 0; i < scope.blocks.length; i++) {
            var block = scope.blocks[i]
            if (!block) {
                continue
            }
            blocks.push(block)
        }
        // for each block, create a bit vector; one bit per block
        var count = blocks.length
        for (var i = 0; i < count; i++) {
            var block = blocks[i]
            block.id = i
            block.dominators = new BitVector(count)
            block.dominators.setAll()
        }
        // the start block only pre-dominates itself
        var block = blocks[0]
        block.dominators.clear()
        block.dominators.set(block.id)
        var changed
        var d = new BitVector(count)
        // loop over pre-dominator computation while there are changes
        do {
            changed = false
            for (var i = 0; i < count; i++) {
                var block = blocks[i]
                // no changes necessary for start block
                if (block == scope.entryBlock) {
                    continue
                }
                // check preds for changes, apply them to the current block
                var preds = block.preds
                for (var j = 0; j < preds.length; j++) {
                    var pred = preds[j]
                    // dup the block's current pre-dominator set
                    d.clear()
                    d.or(block.dominators)
                    // only keep bits set on the pred set here
                    block.dominators.and(pred.dominators)
                    // block always pre-dominates itself
                    block.dominators.set(block.id)
                    // note if changes
                    if (!block.dominators.cmp(d)) {
                        changed = true
                    }
                }
            }
        } while (changed)
    },

    findLoops : function(scope) {
        var c = ActionCode
        var loops = scope.loops = []
        var blocks = scope.blockList
        for (var i = 1; i < blocks.length; i++) {
            var block = blocks[i]
            var succs = block.succs
            for (var j = 0; j < succs.length; j++) {
                var id = succs[j].id
                if (block.dominators.get(id)) {
                    if (id != null) {
                        var loop = this.createLoop(scope, id, i)
                        loops.push(loop)
                        var hdr = scope.blockList[loop.header]
                        var op = scope.ops[hdr.i + hdr.length - 1]
                        if (op.ActionCode == c.If && op.BranchOffset > 0) {
                            op.ActionCode = c._While
                        }
                        else {
                            // look for condition on tail
                            var tl = scope.blockList[loop.tail]
                            var op = scope.ops[tl.i + tl.length - 1]
                            if (op.ActionCode == c.If && op.BranchOffset < 0) {
                                op.ActionCode = c._DoWhile
                            }
                            else {
//                                debugger
                            }
                        }
                    }
                }
            }
        }
        // sort loops by length (small to large)
        loops.sort(function(a, b) {
            return a.blocks.length - b.blocks.length
        })
    },

    createLoop : function(scope, header, tail) {
        var blockSet = {header:1}
        var loop = {header:header, tail:tail, blocks:[header]}
        var work = []
        if (header == tail) {
            return loop
        }
        blockSet[tail] = 1
        loop.blocks.push(tail)
        work.push(tail)
        while (work.length) {
            var id = work.pop()
            var block = scope.blockList[id]
            for (var i = 0; i < block.preds.length; i++) {
                var pred = block.preds[i].id
                if (!(pred in blockSet) && pred > header) {
                    blockSet[pred] = 1
                    loop.blocks.push(pred)
                    work.push(pred)
                }
            }
        }
        loop.post = Math.max.apply(Math, loop.blocks) + 1
        return loop
    },

    findStandardPatterns : function(scope) {
        var c = ActionCode
        var patterns = As2Decompiler.patterns
        var ops = scope.ops
        for (var i = 0; i < ops.length; i++) {
            for (var j = 0; j < patterns.length; j++) {
                var pattern = patterns[j]
                var seq = pattern.seq
                var found = true
                for (var k = 0; k < seq.length; k++) {
                    if (i + k >= ops.length) {
                        found = false
                        break
                    }
                    if (ops[i + k].ActionCode != c[seq[k]]) {
                        found = false
                        break
                    }
                }
                if (found) {
                    this['check' + pattern.handler](scope, i)
                }
            }
        }
        // look for ternary after other refactorings
        for (var i = 0; i < ops.length; i++) {
            this.checkTernary(scope, i)
        }
    },

    checkTernary : function(scope, i) {
        var c = ActionCode
        var op = scope.ops[i]
        if (op.ActionCode == c.If) {
            var change = this.blockStackChange(scope, op.label[0], op.label[1])
            var elseOp = scope.ops[op.label[1] - 1]
            if (change == 1 && elseOp.ActionCode == c.Jump) {
                op.ActionCode = c._Ternary
                op.change = change
                op._else = elseOp
                elseOp.ActionCode = c._Nop
            }
        }
    },
    
    blockStackChange : function(scope, start, end) {
        var c = ActionCode
        var t = Type
        var change = 0
        var stack = []
        for (var i = start; i < end; i++) {
            var op = scope.ops[i]
            switch (op.ActionCode) {
            case c.ConstantPool:
            case c.GetVariable:
            case c.Not:
                // nop
                break
            case c.Push:
                for (var j in op.Values) {
                    var valIn = op.Values[j]
                    var val
                    switch (valIn.Type) {
                    case t.String: // string
                    case t.Null: // null
                    case t.Undefined: // undefined
                    case t.Boolean: // boolean
                    case t.Number: // number
                    case 6:
                    case 7:
                        val = valIn.Value
                        break

                    case 4: // register lookup
                        val = null
                        break

                    case 8: // constants lookup
                    case 9:
                        val = null
                        break
                    }
                    stack.push(val)
                }
                break
            case c.CallMethod:
                stack.pop()
                stack.pop()
                var nArgs = stack.pop()
                for (var j = 0; j < nArgs; j++) {
                    stack.pop()
                }
                stack.push(null)
                break
            case c.SetVariable:
                stack.pop()
                stack.pop()
                break
            case c.Divide:
            case c.Multiply:
            case c.Equals2:
            case c.Add2:
            case c.Subtract:
            case c.Greater:
            case c.Less2:
            case c.BitAnd:
            case c.BitRShift:
            case c.CastOp:
            case c.BitLShift:
            case c.BitOr:
            case c.InstanceOf:
            case c.StrictEquals:
            case c._SetVariableExpr:
            case c._SetMemberExpr:
                stack.pop()
                stack.pop()
                stack.push(null)
                break
            case c.If:
                stack.pop()
                if (op.BranchOffset > 0) {
                    var then = this.blockStackChange(scope, op.label[0], op.label[1])
                    var _else
                    var elseOp = scope.ops[op.label[1] - 1]
                    if (elseOp.ActionCode == c.Jump) {
                        if (elseOp.BranchOffset > 0) {
                            //_else = this.blockStackChange(scope, elseOp.label[0], elseOp.label[1])
                            i = elseOp.label[1] - 1
                        }
                        else {
                            i = op.label[1] - 1
                        }
                    }
                    if (then > 0) {
                        for (var j = 0; j < then; j++) {
                            stack.push(null)
                        }
                    }
                    else if (then < 0) {
                        for (var j = 0; j < -then; j++) {
                            stack.pop()
                        }
                    }
                }
                break
            case c.Pop:
                stack.pop()
                break
            case c.GotoFrame:
            case c.GetUrl:
            case c.SetTarget:
                break
            case c.GetUrl2:
                // TODO: full impl
                if (op.LoadTargetFlag) {
                    // XXX: not supported yet
                }
                else {
                    if (op.LoadVariablesFlag) {
                        // XXX: not supported yet
                    }
                    else {
                        if (op.SendVarsMethod) {
                            // XXX: not supported yet
                        }
                        else {
                            stack.pop()
                            stack.pop()
                        }
                    }
                }
                break
            case c.RandomNumber:
            case c.Play:
            case c.Stop:
            case c.DefineFunction:
            case c.PreviousFrame:
            case c.NextFrame:
            case c.Jump:
                break
            case c.NewObject:
                stack.pop()
                var nArgs = stack.pop()
                for (var j = 0; j < nArgs; j++) {
                    stack.pop()
                }
                stack.push(null)
                break
            case c.GetMember:
                stack.pop()
                stack.pop()
                stack.push(null)
                break
            case c.SetMember:
                stack.pop()
                stack.pop()
                stack.pop()
                break
            case c.InitObject:
                var nElems = stack.pop()
                for (var j = 0; j < nElems; j++) {
                    stack.pop()
                    stack.pop()
                }
                stack.push(null)
                break
            case c.Trace:
                stack.pop()
                break
            case c.Increment:
                break
            case c.DefineFunction2:
                break
            case c.StoreRegister:
                break
            case c.GotoLabel:
                break
            case c.DefineLocal:
                stack.pop()
                stack.pop()
                break
            case c.PushDuplicate:
                //debugger
                stack.push(null)
                break
            case c.GetTime:
                stack.push(null)
                break
            case c.CallFunction:
                stack.pop()
                var nArgs = stack.pop()
                for (var j = 0; j < nArgs; j++) {
                    stack.pop()
                }
                stack.push(null)
                break
            case c.DefineLocal2:
                stack.pop()
                break
            case c.TypeOf:
                break
            case c.Return:
            case c.GotoFrame2:
                stack.pop()
                break
            case c.Decrement:
                break
            case c.Delete:
                stack.pop()
                stack.pop()
                break
            case c.NewMethod:
                stack.pop()
                stack.pop()
                var nArgs = stack.pop()
                for (var j = 0; j < nArgs; j++) {
                    stack.pop()
                }
                stack.push(null)
                break
            case c.ToNumber:
            case c.ToInteger:
            case c.ToString:
                break
            case c.Enumerate2:
                //debugger
                break
            case c.InitArray:
                var nArgs = stack.pop()
                for (var j = 0; j < nArgs; j++) {
                    stack.pop()
                }
                stack.push(null)
                break
            case c._LogicalAnd:
            case c._LogicalOr:
                i = op.label[1] - 1
                break
            case c._ForIn:
                stack.pop()
                i = op.label[1] - 1
                break
            case c._Nop:
                // nop
                break
            case c.GetProperty:
                stack.pop()
                stack.pop()
                stack.push(null)
                break
            case c.SetProperty:
                stack.pop()
                stack.pop()
                stack.pop()
                stack.push(null)
                break
            case c._IfContinue:
            case c._IfBreak:
                stack.pop()
                break
            case c._While:
            case c._DoWhile:
                stack.pop()
                break
            case c.Extends:
                stack.pop()
                stack.pop()
                break
            case c.StartDrag:
                stack.pop()
                stack.pop()
                var constrain = !!stack.pop().value
                if (constrain) {
                    stack.pop()
                    stack.pop()
                    stack.pop()
                    stack.pop()
                }
                break
            case c.EndDrag:
                break
            }
        }
        return stack.length
    },

    checkLogicalAnd : function(scope, i) {
        var c = ActionCode
        var ops = scope.ops
        if (ops[i + 2].BranchOffset < 0) {
            return
        }
        // TODO: check blocks
        // ok, now replace
        ops[i].ActionCode = c._Nop
        ops[i + 1].ActionCode = c._Nop
        ops[i + 2].ActionCode = c._LogicalAnd
        ops[i + 3].ActionCode = c._Nop
        ops[ops[i + 2].label[1] - 1].ActionCode = c._Nop
    },

    checkLogicalOr : function(scope, i) {
        var c = ActionCode
        var ops = scope.ops
        if (ops[i + 1].BranchOffset < 0) {
            return
        }
        // TODO: check blocks
        // ok, now replace
        ops[i].ActionCode = c._Nop
        ops[i + 1].ActionCode = c._LogicalOr
        ops[i + 2].ActionCode = c._Nop
        ops[ops[i + 1].label[1] - 1].ActionCode = c._Nop
    },

    checkForIn : function(scope, i) {
        var ops = scope.ops
        if (!(
            ops[i + 1].RegisterNumber == 0 &&
            ops[i + 2].Values.length == 1 && 
            ops[i + 2].Values[0].Type == 2 &&
            ops[i + 4].BranchOffset >= 0 &&
            ops[i + 5].Values.length == 1 && 
            ops[i + 5].Values[0].Type == 4 &&
            ops[i + 5].Values[0].Value == 0
        )) {
            return
        }
        // TODO: check blocks
        // ok, now replace
        var reg = ops[i + 6].RegisterNumber
        for (var j = 0; j <= 7; j++) {
            ops[i + j].ActionCode = ActionCode._Nop
        }
        ops[i + 4].ActionCode = ActionCode._ForIn
        ops[i + 4].RegisterNumber = reg
    },

    checkSetVariableExpr : function(scope, i) {
        var ops = scope.ops
        if (!(
            ops[i].RegisterNumber == 0 &&
            ops[i + 2].Values[0].Type == 4 &&
            ops[i + 2].Values[0].Value == 0
        )) {
            return
        }
        // TODO: check blocks
        // ok, now replace
        ops[i].ActionCode = ActionCode._Nop
        ops[i + 1].ActionCode = ActionCode._SetVariableExpr
        if (ops[i + 2].Values.length == 1) {
            ops[i + 2].ActionCode = ActionCode._Nop
        }
        else {
            ops[i + 2].Values.shift()
        }
    },

    checkSetMemberExpr : function(scope, i) {
        var ops = scope.ops
        if (!(
            ops[i].RegisterNumber == 0 &&
            ops[i + 2].Values[0].Type == 4 &&
            ops[i + 2].Values[0].Value == 0
        )) {
            return
        }
        // TODO: check blocks
        // ok, now replace
        ops[i].ActionCode = ActionCode._Nop
        ops[i + 1].ActionCode = ActionCode._SetMemberExpr
        if (ops[i + 2].Values.length == 1) {
            ops[i + 2].ActionCode = ActionCode._Nop
        }
        else {
            ops[i + 2].Values.shift()
        }
    },

    resolveJumps : function(scope) {
        var c = ActionCode
        var ops = scope.ops
        var labels = scope.labels = {}
        for (var i = 0; i < ops.length; i++) {
            var op = ops[i]
            if (op.ActionCode == c.Jump || op.ActionCode == c.If) {
                var from = i + 1
                var to = this.resolveJump(ops, i)
                if (!(to in labels)) {
                    labels[to] = []
                }
                var label = [from, to]
                labels[to].push(label)
                op.label = label
            }
        }
    },

    resolveWiths : function(scope) {
        var c = ActionCode
        var ops = scope.ops
        for (var i = 0; i < ops.length; i++) {
            var op = ops[i]
            if (op.ActionCode == c.With) {
                var from = i + 1
                var to = this.resolveJump(ops, i)
                op._with = [from, to]
            }
        }
    },

    resolveJump : function(ops, i) {
        var op = ops[i]
        var offset = op.BranchOffset
        if (offset < 0) {
            i++
            // ??
            if (i > ops.length - 1) {
                //debugger
                //break
                return // TODO: is this correct? we had the break, but that's wrong
            }
            offset += op.Length
            while (offset < 0) {
                i--
                if (i < 0) {
                    break
                }
                var op = ops[i]
                var bytes = op.ActionCode >= 0x80 ? 3 + op.Length : 1
                offset += bytes
            }
        }
        else if (offset == 0) {
            i++
        }
        else {
            do {
                i++
                if (i >= ops.length) {
                    break
                }
                var op = ops[i]
                var bytes = op.ActionCode >= 0x80 ? 3 + op.Length : 1
                offset -= bytes
            } while (offset > 0)
            i++
        }
        if (i > ops.length - 1) {
            i = ops.length - 1
        }
        return i
    },

    _extends : function(superclass, subclass) {
        return {tag:'extends', superclass:superclass, subclass:subclass}
    },

    _return : function(expr) {
        return {tag:'return', e:expr}
    },

    newMethod : function(obj, name, args) {
        var ctor
        if (name.tag == 'val' && (name.value == null || typeof name.value == 'string' && name.value.length == 0)) {
            ctor = obj
        }
        else {
            ctor = this.getMember(obj, name)
        }
        return this._new(ctor, args)
    },

    _delete : function(obj, name) {
        return {tag:'delete', name:name, obj:obj}
    },

    newArray : function(arr) {
        return {tag:'new-array', arr:arr}
    },

    _while : function(cond, block) {
        return {tag:'while', cond:cond, block:block}
    },

    _doWhile : function(cond, block) {
        return {tag:'do-while', cond:cond, block:block}
    },

    _new : function(ctor, args) {
        return {tag:'new', ctor:ctor, args:args}
    },

    targetCall : function(name, args) {
        return this.methodCall(this._target, this.val(name), args)
    },

    setMember : function(obj, name, value) {
        return {tag:'set-member', obj:obj, name:name, value:value}
    },

    getMember : function(obj, name) {
        return {tag:'get-member', obj:obj, name:name}
    },

    // XXX: assuming obj names are all strings
    initObj : function(obj) {
        return {tag:'init-obj', obj:obj}
    },

    defFn2 : function(name, body, scope, numReg) {
        return {tag:'def-fn-2', name:name, body:body, params:scope.params, scope:scope, numReg:numReg}
    },
    
    fn2 : function(body, scope, numReg) {
        return {tag:'fn-2', body:body, params:scope.params, scope:scope, numReg:numReg}
    },

    defFn : function(name, body, scope) {
        return {tag:'def-fn', name:name, body:body, params:scope.params, scope:scope, numReg:0}
    },
    
    fn : function(body, scope) {
        return {tag:'fn', body:body, params:scope.params, scope:scope, numReg:0}
    },
    
    unOp : function(name, e) {
        return {tag:'un-op', op:name, e:e}
    },

    binOp : function(name, e1, e2) {
        return {tag:'bin-op', op:name, e:[e1, e2]}
    },

    dotCall : function(object, method, args) {
        return {tag:'dot-call', object:object, method:method, args:args}
    },

    opCall : function(name, args) {
        return this.dotCall(this._ctx, this.val(name), args)
    },

    ctxSet : function(name, value, withCtx) {
        return {tag:'ctx-set', name:name, value:value, withCtx:withCtx}
    },

    ctxGet : function(name, withCtx) {
        return {tag:'ctx-get', name:name, withCtx:withCtx}
    },

    _var : function(name) {
        return {tag:'var', name:name}
    },

    functionCall : function(name, args) {
        return {tag:'function-call', name:name, args:args}
    },

    methodCall : function(object, method, args) {
        return {tag:'method-call', object:object, method:method, args:args}
    },

    tmp : function() {
        return {tag:'tmp', n:this.tmpNum++}
    },

    assign : function(e1, e2) {
        return {tag:'assign', e1:e1, e2:e2}
    },

    _break : function() {
        return {tag:'break'}
    },

    _continue : function() {
        return {tag:'continue'}
    },

    varAssign : function(name, value, withCtx) {
        return {tag:'var-assign', name:name, value:value, withCtx:withCtx}
    },

    seq : function(/* ... */) {
        var expr = []
        for (var i = 0; i < arguments.length; i++) {
            expr.push(arguments[i])
        }
        return {tag:'seq', expr:expr}
    },

    ternary : function(test, ift, iff) {
        return {tag:'ternary', cond:test, thenBlock:ift, elseBlock:iff}
    },

    val : function(v) {
        return {tag:'val', value:v}
    },

    and : function(e1, e2) {
        return {tag:'and', e1:e1, e2:e2}
    },

    neq : function(e1, e2) {
        return {tag:'neq', e1:e1, e2:e2}
    },

    eq : function(e1, e2) {
        return {tag:'eq', e1:e1, e2:e2}
    },

    lookup : function(obj, prop) {
        return {tag:'lookup', obj:obj, prop:prop}
    },

    lookupCall : function(obj, prop, args) {
        return {tag:'lookup-call', obj:obj, prop:prop, args:args}
    },

    _typeof : function(e) {
        return {tag:'typeof', e:e}
    },

    _if : function(cond, then, _else) {
        return {tag:'if', cond:cond, then:then, _else:_else}
    },
    
    _switch : function(cond, block) {
        return {tag:'switch', cond:cond, block:block}
    },

    _case : function(expr) {
        return {tag:'case', expr:expr}
    },
    
    _default : function() {
        return {tag:'default'}
    },
    
    reg : function(scope, i) {
        if (scope && scope.regs[i]) {
            return scope.regs[i]
        }
        else {
            return this._var('__reg' + i)
        }
    },

    evalInitActions : function(scope) {
        return this.evalScope(this.scope(ops))
    },

    evalActions : function(ops) {
        var scope = this.scope(ops)
        var stmts = scope.stmts = this.evalScope(scope)
        this.traverse(stmts)
        return stmts
    },

    evalScope : function(scope, withCtx) {
        this._scope = scope
        return this.eval(scope.ops, null, null, withCtx)
    },

    evalBlock : function(ops, start, end, withCtx, _switch) {
        return this.eval(ops, start, end, withCtx, _switch)
    },

    eval : function(ops, start, end, withCtx, _switch) {
        var c = ActionCode
        var t = Type
        var consts = this.consts
        var stack = new Stack()
        stack._undef = this._undef
        var stmts = []
        var scope = this._scope
        var lastStmt = 0
        var i
        var addStmts = function() {
            for (var z = 0; z < stack.length; z++) {
                stmts.push(stack._stack[z])
            }
            stack.length = 0
            lastStmt = i
        }
        if (start == null) {
            start = 0
        }
        if (end == null) {
            end = ops.length
        }
        for (i = start; i < end; i++) {
            var op = ops[i]
            // deal with statement labels
            if (op._switch == _switch && (op._cases || op._default)) {
                if (op._cases) {
                    for (var j = 0; j < op._cases.length; j++) {
                        stack.push(this._case(op._cases[j].expr))
                    }
                }
                if (op._default) {
                    stack.push(this._default())
                }
                addStmts()
            }
            switch (op.ActionCode) {
            case c.ConstantPool:
                this.consts = consts = []
                for (var j in op.ConstantPool) {
                    consts.push(op.ConstantPool[j])
                }
                break
            case c.Push:
                for (var j in op.Values) {
                    var valIn = op.Values[j]
                    var val
                    switch (valIn.Type) {
                    case t.String: // string
                    case t.Null: // null
                    case t.Undefined: // undefined
                    case t.Boolean: // boolean
                    case t.Number: // number
                    case 6:
                    case 7:
                        val = this.val(valIn.Value)
                        break

                    case 4: // register lookup
                        val = this.reg(scope, valIn.Value)
                        break

                    case 8: // constants lookup
                    case 9:
                        val = this.val(consts[valIn.Value])
                        break
                    }
                    stack.push(val)
                }
                break
            case c.GetVariable:
                stack.push(this.ctxGet(stack.pop(), withCtx))
                break
            case c.CallMethod:
                var method = stack.pop()
                var object = stack.pop()
                // TODO: support varargs. for now, nArgs.tag == 'val'
                var nArgs = stack.pop().value
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                stack.push(this.methodCall(object, method, args))
                break
            case c.SetVariable:
                var value = stack.pop()
                var path = stack.pop()
                var op
                 // it's a static string
                if (path.tag == 'val' && path.value.indexOf(':') == -1) {
                    op = this.ctxSet(path, value, withCtx)
                }
                else {
                    //debugger
                    op = null
                }
                stack.push(op)
                addStmts()
                break
            case c.Divide:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('/', b, a))
                break
            case c.Multiply:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('*', b, a))
                break
            case c.Equals2:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('==', b, a))
                break
            case c.Not:
                var a = stack.pop()
                stack.push(this.unOp('!', a))
                break
            case c.If:
                var cond = this.unOp('!', stack.pop())
                var from = op.label[0]
                var to = op.label[1]
                if (to < from) {
                    stack.push(this._goto(to))
                }
                else {
                    var thenBlock = this.evalBlock(ops, from, to, withCtx)
                    var elseStart
                    var elseEnd
                    var elseBlock
                    // if/else
                    var elseOp = ops[to - 1]
                    if (elseOp && elseOp.ActionCode == c.Jump && elseOp.BranchOffset > 0) {
                        var elseBlock = this.evalBlock(ops, elseOp.label[0], elseOp.label[1], withCtx)
                        stack.push(
                            this._if(cond, thenBlock, elseBlock)
                        )
                        i = elseOp.label[1] - 1
                    }
                    // if
                    else {
                        stack.push(
                            this._if(cond, thenBlock)
                        )
                        i = to - 1
                    }
                }
                addStmts()
                break
            case c.Pop:
                stack.push(stack.pop())
                addStmts()
                break
    /*
            case c.WaitForFrame:
                if (ctx.target._framesloaded < op.Frame + 1) {
                    i += 1 + op.SkipCount
                }
                break
    */
            case c.GotoFrame:
                stack.push(this.targetCall('gotoAndStop', [this.val(op.Frame + 1)]))
                addStmts()
                break
            case c.GetUrl:
                var target = this.val(op.TargetString)
                var url = this.val(op.UrlString)
                stack.push(this.methodCall(this._target, this.val('getUrl'), [url, target]))
                // XXX: is this always a statement?
                addStmts()
                break
            case c.GetUrl2:
                // TODO: full impl
                if (op.LoadTargetFlag) {
                    // XXX: not supported yet
                }
                else {
                    if (op.LoadVariablesFlag) {
                        // XXX: not supported yet
                    }
                    else {
                        if (op.SendVarsMethod) {
                            // XXX: not supported yet
                        }
                        else {
                            var target = stack.pop()
                            var url = stack.pop()
                            stack.push(this.methodCall(this._target, this.val('getUrl'), [url, target]))
                            // XXX: is this always a statment?
                            addStmts()
                        }
                    }
                }
                break
            case c.Play:
                stack.push(this.targetCall('play'))
                addStmts()
                break
            case c.Stop:
                stack.push(this.targetCall('stop'))
                addStmts()
                break
            case c.DefineFunction:
                var scp = this.scope(op.Code, op)
                var body = this.evalScope(scp)
                if (op.FunctionName) {
                    var expr = this.defFn(op.FunctionName, body, scp)
                    // if top-level, set the function as a property of _root
                    if (!scope.def && !withCtx) {
                        expr = this.setMember(this._root, this.val(op.FunctionName), expr)
                    }
                    stack.push(expr)
                }
                else {
                    stack.push(this.fn(body, scp))
                }
                break
            case c.SetTarget:
                stack.push(this.varAssign(this._root, this.opCall('ResolvePath', [this._root, this.val(op.TargetName)])))
                addStmts()
                ctx.setTarget(op.TargetName)
                break
            case c.PreviousFrame:
                stack.push(this.targetCall('prevFrame'))
                addStmts()
                break
            case c.NextFrame:
                stack.push(this.targetCall('nextFrame'))
                addStmts()
                break
            case c.Jump:
                if (op.BranchOffset > 0) {
                    i = op.label[1] - 1
                }
                break
            case c.NewObject:
                var name = stack.pop()
                var nArgs = stack.pop().value
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                var ctor = this.ctxGet(name, withCtx)
                stack.push(this._new(ctor, args))
                break
            case c.GetMember:
                var name = stack.pop()
                var obj = stack.pop()
                stack.push(
                    this.getMember(obj, name)
                )
                break
            case c.SetMember:
                var value = stack.pop()
                var name = stack.pop()
                var obj = stack.pop()
                stack.push(this.setMember(obj, name, value))
                addStmts()
                break
            case c.InitObject:
                var nElems = stack.pop().value
                var obj = []
                for (var j = 0; j < nElems; j++) {
                    var val = stack.pop()
                    var name = stack.pop().value // assuming tag:'val'
                    obj.unshift([name, val])
                }
                stack.push(this.initObj(obj))
                break
            case c.Trace:
                var val = stack.pop()
                stack.push(this.opCall('Trace', [val]))
                addStmts()
                break
            case c.Increment:
                var val = stack.pop()
                stack.push(this.binOp('+', val, this.val(1)))
                break
            case c.With:
                var obj = stack.pop()
                var tmp = this.tmp()
                stack.push(this.varAssign(tmp, obj))
                var scp = this.scope(op.Code, op)
                var body = this.evalScope(scp, tmp)
                stack.push(body)
                addStmts()
                break
            case c.End:
                // nop
                break
            case c.DefineFunction2:
                var scp = this.scope(op.Code, op)
                var body = this.evalScope(scp)
                if (op.FunctionName) {
                    var name = op.FunctionName
                    var expr = this.defFn2(name, body, scp, op.RegisterCount)
                    if (!scope.def && !withCtx) {
                        expr = this.setMember(this._root, this.val(name), expr)
                    }
                    stack.push(expr)
                }
                else {
                    stack.push(this.fn2(body, scp, op.RegisterCount))
                }
                break
            case c.StoreRegister:
                stack.push(this.varAssign(this.reg(scope, op.RegisterNumber), stack.pop()))
                break
            case c.GotoLabel:
                stack.push(this.targetCall('gotoAndStop', [this.val(op.Label)]))
                addStmts()
                break
            case c.StartDrag:
                var target = stack.pop()
                var lockCenter = stack.pop()
                var constrain = !!stack.pop().value
                var args = [target, lockCenter]
                if (constrain) {
                    var y2 = stack.pop()
                    var x2 = stack.pop()
                    var y1 = stack.pop()
                    var x1 = stack.pop()
                    args.push(y2, x2, y1, x1)
                }
                stack.push(this.opCall('StartDrag', args))
                addStmts()
                break
            case c.EndDrag:
                stack.push(this.opCall('StopDrag'))
                addStmts()
                break
            case c.Add2:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('+', b, a))
                break
            case c.Subtract:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('-', b, a))
                break
            case c.DefineLocal:
                var val = stack.pop()
                var name = stack.pop()
                var stmt
                if (scope.def || withCtx) {
                    stmt = this.defineVar(name, val)
                }
                // at top-level, we set the property of _root
                else {
                    stmt = this.setMember(this._root, name, val)
                }
                stack.push(stmt)
                addStmts()
                break
            case c.PushDuplicate:
                //debugger
                /*
                var val = stack.pop()
                var tmp = this.tmp()
                stack.push(this.varAssign(tmp, val), tmp)
                */
                break
            case c.GetTime:
                stack.push(this.opCall('GetTime'))
                break
            case c.Greater:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('>', b, a))
                break
            case c.CallFunction:
                var name = stack.pop()
                var nArgs = stack.pop().value
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                stack.push(this.functionCall(name, args, withCtx))
                break
            case c.DefineLocal2:
                if (scope.def || withCtx) {
                    stack.push(this.defineVar(stack.pop()))
                }
                // at top-level, do nothing (XXX: is this correct behavior?)
                addStmts()
                break
            case c.TypeOf:
                var val = stack.pop()
                stack.push(this.opCall('_TypeOf', [val]))
                break
            case c.ToInteger:
                var val = stack.pop()
                stack.push(this.opCall('ToInteger', [val]))
                break
            case c.Return:
                // TODO: what to do at top-level?
                stack.push(this._return(stack.pop()))
                addStmts()
                break
            case c.GotoFrame2:
                var val = stack.pop()
                stack.push(this.opCall('GotoFrame2', [this._root, val]))
                addStmts()
                break
            case c.Less2:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('<', b, a))
                break
            case c.Decrement:
                var val = stack.pop()
                stack.push(this.binOp('-', val, this.val(1)))
                break
            case c.Delete:
                var name = stack.pop()
                var obj = stack.pop()
                stack.push(this._delete(obj, name))
                addStmts()
                break
            case c.NewMethod:
                var name = stack.pop()
                var obj = stack.pop()
                var nArgs = stack.pop().value
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                stack.push(this.newMethod(obj, name, args))
                break
        /*
            case c.ImplementsOp:
                var ctor = stack.pop()
                var nInt = stack.pop()
                for (var j = 0; j < nInt; j++) {
                    stack.pop()
                }
                // TODO: respect the interface list
                break
        */
            case c.ToNumber:
                var obj = stack.pop()
                // no withCtx since we're looking for top-level Number() here
                stack.push(this.functionCall(this.val('Number'), [obj]))
                break
            case c.Enumerate2:
                var obj = stack.pop()
                stack.push(this.opCall('Enumerate2', [obj]))
                break
            case c.RandomNumber:
                var max = stack.pop()
                stack.push(this.opCall('RandomNumber', [max]))
                break
            case c.GetProperty:
                var index = stack.pop().value
                // TODO: handle target == ''
                var target = stack.pop()
                var name = this.val(Property[index])
                stack.push(this.getMember(target, name))
                break
            case c.SetProperty:
                var val = stack.pop()
                var index = stack.pop().value
                var target = stack.pop()
                var name = this.val(Property[index])
                stack.push(this.setMember(target, name, val))
                break
            case c.StrictEquals:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('===', b, a))
                break
            case c.InitArray:
                var nArgs = stack.pop().value
                var arr = new Array(nArgs)
                for (var j = 0; j < nArgs; j++) {
                    arr[j] = stack.pop()
                }
                stack.push(this.newArray(arr))
                break
            case c.ToString:
                var obj = stack.pop()
                // no withCtx since we're looking for top-level String here
                stack.push(this.functionCall(this.val('String'), [obj]))
                break
            case c.Extends:
                var superclass = stack.pop()
                var subclass = stack.pop()
                stack.push(this._extends(superclass, subclass))
                addStmts()
                break
            case c.InstanceOf:
                var ctor = stack.pop()
                var obj = stack.pop()
                stack.push(this.opCall('_InstanceOf', [obj, ctor]))
                break
            case c.BitAnd:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('&', b, a))
                break
            case c.BitRShift:
                var count = stack.pop()
                var val = stack.pop()
                stack.push(this.binOp('>>', val, count))
                break
            case c.CastOp:
                var obj = stack.pop()
                var ctor = stack.pop()
                stack.push(this.opCall('_CastOp', [ctor, obj]))
                break
            case c.BitLShift:
                var count = stack.pop()
                var val = stack.pop()
                stack.push(this.binOp('<<', val, count))
                break
            case c.BitOr:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(this.binOp('|', b, a))
                break
            case c._LogicalAnd:
                var a = stack.pop()
                var b = this.evalBlock(ops, op.label[0], op.label[1], withCtx).stmts.pop()
                var e = this.binOp('&&', a, b)
                stack.push(e)
                i = op.label[1] - 1
                break
            case c._LogicalOr:
                var a = stack.pop()
                var b = this.evalBlock(ops, op.label[0], op.label[1], withCtx).stmts.pop()
                var e = this.binOp('||', a, b)
                stack.push(e)
                i = op.label[1] - 1
                break
            case c._ForIn:
                var reg = this.reg(scope, op.RegisterNumber)
                var e = stack.pop()
                var block = this.evalBlock(ops, op.label[0], op.label[1], withCtx)
                stack.push(this.forIn(reg, e, block))
                addStmts()
                i = op.label[1] - 1
                break
            case c._SetVariableExpr:
                var val = stack.pop()
                var _var = stack.pop()
                stack.push(this.varAssign(_var, val, withCtx))
                break
            case c._SetMemberExpr:
                var value = stack.pop()
                var name = stack.pop()
                var obj = stack.pop()
                stack.push(this.setMember(obj, name, value))
                break
            case c._Ternary:
                var cond = this.unOp('!', stack.pop())
                var to = op.label[1]
                var thenBlock = this.evalBlock(ops, op.label[0], to, withCtx).stmts[0]
                var elseOp = op._else
                var elseBlock = this.evalBlock(ops, elseOp.label[0], elseOp.label[1], withCtx).stmts[0]
                stack.push(this.ternary(cond, thenBlock, elseBlock))
                i = elseOp.label[1] - 1
                break
            case c._Nop:
                // nop
                break
            case c._Break:
                stack.push(this._break())
                addStmts()
                break
            case c._Continue:
                stack.push(this._continue())
                addStmts()
                break
            case c._IfBreak:
                var cond = this.unOp('!', stack.pop())
                stack.push(this._if(cond, this.stmts(this._break())))
                addStmts()
                break
            case c._IfContinue:
                var cond = this.unOp('!', stack.pop())
                stack.push(this._if(cond, this.stmts(this._continue())))
                addStmts()
                break
            case c._While:
                var cond = this.unOp('!', stack.pop())
                var from = op.label[0]
                var to = op.label[1]
                var block = this.evalBlock(ops, from, to, withCtx)
                stack.push(this._while(cond, block))
                addStmts()
                i = op.label[1] - 1
                break
            case c._DoWhile:
                var cond = stack.pop()
                var from = op.label[1]
                var to = Math.min(lastStmt, op.label[0] - 1)
                var block
                if (from < to) {
                    block = this.evalBlock(ops, from, to, withCtx)
                }
                stack.push(this._doWhile(cond, block))
                addStmts()
                break
            case c._Switch:
                var val = stack.pop()
                var block = this.evalBlock(ops, i + 1, op._switch.post, withCtx, op._switch)
                stack.push(this._switch(val, block))
                addStmts()
                i = op._switch.post - 1
                break
            case c._Case:
                var expr
                if (stack.length > 1) {
                    expr = this.seq.apply(this, stack._stack.slice(0))
                    stack.length = 0
                }
                else {
                    expr = stack.pop()
                }
                op._case.expr = expr
                break
            case c._Default:
                break
            }
        }
        var op = ops[i]
        // deal with final statement labels
        if (op && op._switch == _switch && (op._cases || op._default)) {
            if (op._cases) {
                for (var j = 0; j < op._cases.length; j++) {
                    stack.push(this._case(op._cases[j].expr))
                }
            }
            if (op._default) {
                stack.push(this._default())
            }
            addStmts()
        }
        addStmts()
        return this.stmts(stmts)
    },
    
    // note all locals that are defined in all scopes, and which scopes inherit from others
    findLocals : function(fn, e) {
        if (!fn.locals) {
            fn.locals = {}
        }
        if (!e) {
            return
        }
        switch (e.tag) {
        case 'stmts':
            for (var i = 0; i < e.stmts.length; i++) {
                this.findLocals(fn, e.stmts[i])
            }
            break
        case 'fn':
        case 'fn-2':
        case 'def-fn':
        case 'def-fn-2':
            if (e.name) {
                fn.locals[e.name] = e
            }
            e.parentScope = fn
            this.findLocals(e, e.body)
            break
        case 'while':
            if (e.block) {
                this.findLocals(fn, e.block)
            }
            break
        case 'do-while':
            if (e.block) {
                this.findLocals(fn, e.block)
            }
            break
        case 'if':
            if (e.then) {
                this.findLocals(fn, e.then)
            }
            if (e._else) {
                this.findLocals(fn, e._else)
            }
            break
        case 'switch':
            if (e.block) {
                this.findLocals(fn, e.block)
            }
            break
        case 'delete':
            fn.delLocals[e.name] = e
            break
        case 'for-in':
            fn.locals[e._var] = e
            this.findLocals(fn, e.block)
            break
        case 'define-var':
            fn.locals[e.name] = e
            break
        case 'bin-op':
        case 'un-op':
        case 'new-array':
        case 'return':
        case 'var-assign':
        case 'ternary':
        case 'goto':
        case 'tmp':
        case 'new':
        case 'function-call':
        case 'get-member':
        case 'set-member':
        case 'init-obj':
        case 'dot-call':
        case 'ctx-set':
        case 'ctx-get':
        case 'var':
        case 'val':
        case 'method-call':
            // nop
            break
        }
    },

    // - find local vars/fns
    // - determine expr complexity
    // 
    traverse : function(e) {
        this.findLocals(e, e)
    },

    xform : function(stmts) {
        
    },
    
    emit : function(stmts) {
        return this.render(this.flatten(this.emitTopLevel(stmts)))
    },
    
    render : function(_in) {
        var lines = []
        var line = []
        for (var i = 0; i < _in.length; i++) {
            switch (_in[i]) {
            case '{':
                indent += 2
                line.push(' {')
                lines.push(line)
                line = []
                break
            case '}':
                lines.push(line)
                line = ['}']
                break
            case ',':
                line.push(', ')
                break
            case ';':
                line.push(';')
                lines.push(line)
                line = []
                break
            case '\n':
//                lines.push(line)
//                line = []
                break
            case '==':
            case '!=':
            case '===':
            case '&&':
            case '||':
            case '&':
            case '|':
            case '+':
            case '/':
            case '-':
            case '*':
            case '>':
            case '<':
            case '^':
            case '>>':
            case '<<':
            case '>>>':
            case '=':
            case '?':
            case ':':
            case 'in':
            case 'else':
                line.push(' ', _in[i], ' ')
                break
            case 'var':
            case 'if':
            case 'function':
            case 'delete':
            case 'for':
            case 'new':
            case 'goto':
            case 'return':
            case 'do':
            case 'while':
            case 'case':
            case 'default':
            case 'switch':
                line.push(_in[i], ' ')
                break
            default:
                line.push(_in[i])
            }
        }
        lines.push(line)
        var indent = 0
        var _out = []
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].join('')
            if (line.length == 0) {
                continue
            }
            if (line.substr(0, 1) == '}') {
                indent -= 2
            }
            _out.push(new Array(indent + 1).join(' '))
            _out.push(line)
            _out.push('\n')
            if (line.substr(line.length - 1, 1) == '{') {
                indent += 2
            }
        }
        return _out.join('')
    },
    
    flatten : function(a) {
        var b = []
        for (var i = 0; i < a.length; i++) {
            if (a[i] instanceof Array) {
                b.push.apply(b, this.flatten(a[i]))
            }
            else {
                b.push(a[i])
            }
        }
        return b
    },

    emitTopLevel : function(stmts) {
        var wrapperStart = [
            'function', '(', '_global', ',', '__ctx', ')', '{'
        ]
        var wrapperEnd = ['}']
//        var ctx = '__ctx'
//        var global = '_global'
        var root = '_root'
        var leftAlt = 'z'
        var rightAlt = 'y'
        var regs = [
//            ctx, '=', '{', '}', ',', 
//            global, '=', '{', '}', ',', 
            root, '=', 'this', ',', 
            leftAlt, '=', 'function', '(', ')', '{', '}', ',', 
            rightAlt, '=', 'function', '(', ')', '{', '}', ','
        ]
        for (var i = 0; i < 4; i++) {
            regs.push(this.emitExpr(this.reg(null, i)), ',')
        }
        regs.pop()
        return [
            wrapperStart,
            'var', regs, ';', '\n',
            this.emitStmts(stmts, null),
            wrapperEnd
        ]
    },

    emitStmts : function(stmts, ctx) {
        var s = []
        if (!stmts) {
            return s
        }
        for (var i = 0; i < stmts.stmts.length; i++) {
            s.push(this.emitExpr(stmts.stmts[i], ctx, true), ';', '\n')
        }
        return s
    },

    emitExpr : function(e, ctx, isStmt) {
        if (!e) {
            return []
        }
        switch (e.tag) {
        case 'def-fn':
            return this.emitFn(e, ctx)
        case 'def-fn-2':
            return this.emitFn(e, ctx)
        case 'method-call':
            return [this.emitLookup(e.object, e.method, ctx, true), this.emitArgs(e.args, ctx)]
        case 'var':
            return [e.name]
        case 'val':
            return [this.emitVal(e.value, ctx)]
        case 'ctx-get':
            return [this.emitCtxName(e.name, ctx, e.withCtx)]
        case 'ctx-set':
            return [this.emitCtxName(e.name, ctx, e.withCtx), '=', this.emitExpr(e.value, ctx)]
        case 'dot-call':
            return this.emitDotCall(e, ctx)
        case 'fn-2':
            return this.emitFn(e, ctx)
        case 'fn':
            return this.emitFn(e, ctx)
        case 'init-obj':
            return this.emitInitObj(e, ctx)
        case 'set-member':
            return [this.emitLookup(e.obj, e.name, ctx), '=', this.emitExpr(e.value, ctx)]
        case 'get-member':
            return this.emitLookup(e.obj, e.name, ctx)
        case 'function-call':
            return [this.emitCtxName(e.name, ctx, e.withCtx), this.emitArgs(e.args, ctx)]
        case 'new':
            return ['new', this.emitExpr(e.ctor, ctx), this.emitArgs(e.args, ctx)]
        case 'tmp':
            return ['__tmp' + e.n]
        case 'if':
            return this.emitIf(e, isStmt, ctx)
        case 'while':
            return this.emitWhile(e, ctx)
        case 'do-while':
            return this.emitDoWhile(e, ctx)
        case 'bin-op':
            return [this.emitNestedExpr(e.e[0], ctx), e.op, this.emitNestedExpr(e.e[1], ctx)]
        case 'un-op':
            return [e.op, this.emitNestedExpr(e.e, ctx)]
        case 'new-array':
            return ['[', this.emitSeq(e.arr, ctx), ']']
        case 'delete':
            return ['delete', this.emitLookup(e.obj, e.name, ctx)]
        case 'return':
            return ['return', this.emitExpr(e.e, ctx)]
        case 'for-in':
            return ['for', '(', 'var', this.emitName(e._var, ctx), 'in', this.emitExpr(e.e, ctx), ')', this.emitBlock(e.block, ctx)]
        case 'var-assign':
            return [this.emitCtxName(e.name, ctx), '=', this.emitExpr(e.value, ctx)]
        case 'define-var':
            return this.emitDefineVar(e, ctx)
        case 'ternary':
            return ['(', this.emitExpr(e.cond, ctx), '?', this.emitExpr(e.thenBlock, ctx), ':', this.emitExpr(e.elseBlock, ctx), ')']
        case 'break':
            return ['break']
        case 'continue':
            return ['continue']
        case 'extends':
            // TODO: how do we include ext here?
            return ['ext.inherits', '(', this.emitExpr(e.subclass, ctx), ',', this.emitExpr(e.superclass, ctx), ')']
        case 'switch':
            return ['switch', '(', this.emitExpr(e.cond), ')', this.emitBlock(e.block)]
        case 'case':
            return ['case', this.emitExpr(e.expr, ctx), ':', '\n']
        case 'default':
            return ['default', ':', '\n']
        case 'seq':
            return ['(', this.emitSeq(e.expr, ctx), ')']
        // TODO: remove
        case 'goto':
            return ['goto', e.i]
        default:
            return ['###unk###']
        }
    },
    
    emitBlock : function(stmts, ctx) {
        return ['{', this.emitStmts(stmts, ctx), '}']
    },
    
    emitArgs : function(args, ctx) {
        return ['(', this.emitSeq(args, ctx), ')']
    },
    
    emitSeq : function(seq, ctx) {
        var s = []
        if (!seq) {
            return s
        }
        for (var i = 0; i < seq.length; i++) {
            s.push(this.emitExpr(seq[i], ctx))
            if (i + 1 < seq.length) {
                s.push(',')
            }
        }
        return s
    },
    
    emitVal : function(v, ctx) {
        switch (typeof v) {
        case 'number':
            return v
        case 'string':
            return this.quote(v)
        case 'boolean':
            return v ? 'true' : 'false'
        case 'undefined':
            return 'undefined'
        case 'object':
            return 'null'
        default:
            return '?'
        }
    },
    
    // TODO: handle strings with quotes
    quote : function(v) {
        return ['"', v, '"'].join('')
    },
    
    reserved : function(v) {
        for (var i = 0; i < As2Decompiler.reserved.length; i++) {
            if (v == As2Decompiler.reserved[i]) {
                return true
            }
        }
        return false
    },
    
    emitProp : function(v) {
        if (typeof v == 'number') {
            return v
        }
        var m = v.match(/^[\$_a-z][\$\w]*$/i)
        if (m && m[0] == v && !this.reserved(v)) {
            return v
        }
        return this.quote(v)
    },
    
    emitInitObj : function(e, ctx) {
        var s = []
        var n = 0
        for (var i = 0; i < e.obj.length; i++) {
            if (n > 0) {
                s.push(',')
            }
            var elem = e.obj[i]
            s.push(this.emitProp(elem[0]), ':', this.emitExpr(elem[1], ctx))
            n++
        }
        return ['{', s, '}']
    },
    
    emitDotCall : function(e, ctx) {
        return [this.emitExpr(e.object, ctx), '.', e.method.value, this.emitArgs(e.args, ctx)]
    },

    needsIndexLookup : function(e) {
        if (e.tag != 'val') {
            return true
        }
        if (typeof e.value == 'number') {
            return true
        }
        var m = e.value.match(/^[\$_a-z][\$\w]*$/i)
        if (m && m[0] == e.value) {
            return false
        }
        return true
    },

    valNeedsIndexLookup : function(v) {
        if (typeof v == 'number') {
            return true
        }
        var m = v.match(/^[\$_a-z][\$\w]*$/i)
        if (m && m[0] == v) {
            return false
        }
        return true
    },
    
    needsProtection : function(obj) {
        if (obj.tag == 'tmp') {
            return true
        }
        if (obj.tag == 'ctx-get' || obj.tag == 'var') {
            var name
            if (obj.tag == 'ctx-get') {
                if (obj.name.value) {
                    name = obj.name.value
                }
                else {
                    name = obj.name.name
                }
            }
            else {
                name = obj.name
            }
            if (
                name == 'this' ||
                name == '_root' ||
                name == '_parent' ||
                name == '_global' ||
                name == 'super' ||
                name == 'arguments'
            ) {
                return false
            }
        }
        return true
    },

    valNeedsProtection : function(v) {
        return !(
            v == 'this' ||
            v == '_root' ||
            v == '_parent' ||
            v == '_global' ||
            v == 'super' ||
            v == 'arguments'
        )
    },
    
    emitLookup : function(obj, prop, ctx, _call) {
        var parens = !(obj.tag == 'ctx-get' || obj.tag == 'get-member' || obj.tag == 'var' || obj.tag == 'tmp')
        var s = [this.emitExpr(obj, ctx)]
        if (parens) {
            s.unshift('(')
            s.push(')')
        }
        if (false && this.needsProtection(obj)) {
            s.unshift('(')
            s.push('||z)')
        }
        if (prop && !(prop.tag == 'val' && (prop.value === null || typeof prop.value == 'undefined'))) {
            var brackets = this.needsIndexLookup(prop, ctx)
            if (brackets) {
                s.push('[', this.emitExpr(prop, ctx), ']')
            }
            else {
                s.push('.', this.emitName(prop, ctx))
            }
            // TODO: add optional call protection (exclude known MovieClip methods)
            if (false && _call) {
                s.unshift('(')
                s.push('||z)')
            }
        }
        return s
    },

    isParam : function(ctx, v) {
        if (!ctx) {
            return false
        }
        for (var i = 0; i < ctx.params.length; i++) {
            if (ctx.params[i] == v) {
                return true
            }
        }
        return false
    },

    isLocal : function(ctx, v) {
        if (!ctx || !ctx.locals) {
            return false
        }
        for (var i = 0; i < ctx.locals.length; i++) {
            if (ctx.locals[i] == v) {
                return true
            }
        }
        return false
    },
    
    isReg : function(ctx, v) {
        return !!v.match(/^__reg\d+$/)
    },
    
    // TODO
    inGlobal : function(ctx, v) {
        switch (v) {
        case 'clearInterval':
        case 'setInterval':
        case 'setTimeout':
        case 'Object':
        case 'Number':
        case 'Boolean':
        case 'String':
        case 'ASSetPropFlags':
            return true
        }
        return false
    },

    emitCtxName : function(e, ctx, withCtx) {
        if (withCtx) {
            var withName = this.emitCtxName(withCtx, ctx)
            return ['(', this.emitName(e), 'in', withName, '?', this.emitLookup(withCtx, e, ctx), ':', this.emitCtxName(e, ctx), ')']
        }
        var v
        if (e.tag && e.tag == 'val') {
            v = e.value
        }
        else if (e.name) {
            v = e.name
        }
        else {
            //debugger
            v = '###unk###'
        }
        if (v === null || v === undefined || v == '') {
            v = '_root'
        }
        if (this.isParam(ctx, v) || this.isLocal(ctx, v) || this.isReg(ctx, v)) {
            return v
        }
        if (!this.valNeedsProtection(v)) {
            return v
        }
        var root
        if (this.inGlobal(ctx, v)) {
            root = '_global'
        }
        else {
            root = '_root'
        }
        if (this.valNeedsIndexLookup(v)) {
            return [root, '[', this.quote(v), ']']
        }
        else {
            return [root, '.', v]
        }
    },
    
    emitName : function(e) {
        if (e.tag && e.tag == 'val') {
            return e.value
        }
        else if (e.name) {
            return e.name
        }
        else {
            //debugger
        }
    },
    
    emitIf : function(e, isStmt, ctx) {
        var s
        if (isStmt) {
            s = ['if', '(', this.emitExpr(e.cond, ctx), ')', this.emitBlock(e.then, ctx)]
            if (e._else) {
                s.push('else', this.emitBlock(e._else, ctx))
            }
        }
        else {
            s = ['(', this.emitExpr(e.cond, ctx), '?', this.emitExpr(e.then, ctx), ':']
            if (e._else) {
                s.push(this.emitExpr(e._else, ctx))
            }
            else {
                s.push('0')
            }
            s.push(')')
        }
        return s
    },
    
    emitWhile : function(e, ctx) {
        return ['while', '(', this.emitExpr(e.cond, ctx), ')', this.emitBlock(e.block, ctx)]
    },

    emitDoWhile : function(e, ctx) {
        return ['do', this.emitBlock(e.block, ctx), 'while', '(', this.emitExpr(e.cond, ctx), ')']
    },
    
    emitNestedExpr : function(e, ctx) {
        if (e.tag == 'val' || e.tag == 'var' || e.tag == 'ctx-get' || e.tag == 'get-member') {
            return this.emitExpr(e, ctx)
        }
        else {
            return ['(', this.emitExpr(e, ctx), ')']
        }
    },
    
    emitDefineVar : function(e, ctx) {
        var s = ['var', this.emitName(e.name, ctx)]
        if (e.value) {
            s.push('=', this.emitExpr(e.value, ctx))
        }
        return s
    },
    
    emitFn : function(e, ctx) {
        var s = ['function']
        if (e.name) {
            s.push(e.name)
        }
        s.push('(')
        if (e.params) {
            for (var i = 0; i < e.params.length; i++) {
                s.push(e.params[i])
                if (i < e.params.length - 1) {
                    s.push(',')
                }
            }
        }
        s.push(')', '{')
        var regs = []
        for (var i = 1; i < e.numReg; i++) {
            if (!(i in e.scope.regs)) {
                regs.push(this.emitExpr(this.reg(e.scope, i)), ',')
            }
        }
        if (regs.length) {
            regs.pop()
            s.push('var', regs, ';')
        }
        s.push(this.emitStmts(e.body, e))
        s.push('}')
        return s
    }
})

exports.As2Decomplier = As2Decompiler

})
