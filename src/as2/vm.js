/**
 * Smokescreen Player - A Flash player written in JavaScript
 * http://smokescreen.us/
 * 
 * Copyright 2011, Chris Smoak
 * Released under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
define(function(require, exports, module) {

var ext = require('lib/ext')
var env = require('lib/env')
var Globals = require('as2/globals').Globals
var Context = require('as2/context').Context

var Type = {
    'String': 0,
    'Number': 1,
    'Null': 2,
    'Undefined': 3,
    'Boolean': 5
}

var Property = [
    '_x', '_y', 
    '_xscale', '_yscale', 
    '_currentframe', '_totalframes', 
    '_alpha', 
    '_visible', 
    '_width', '_height', 
    '_rotation', 
    '_target',
    '_framesloaded',
    '_name',
    '_droptarget',
    '_url',
    '_highquality',
    '_focusrect',
    '_soundbuftime',
    '_quality',
    '_xmouse', '_ymouse'
]

var ActionCode = {
    End: 0x00,
    NextFrame: 0x04,
    PreviousFrame: 0x05,
    Play: 0x06,
    Stop: 0x07,
    Subtract: 0x0b,
    Multiply: 0x0c,
    Divide: 0x0d,
    Not: 0x12,
    Pop: 0x17,
    ToInteger: 0x18,
    GetVariable: 0x1c,
    SetVariable: 0x1d,
    GetProperty: 0x22,
    SetProperty: 0x23,
    Trace: 0x26,
    StartDrag: 0x27,
    EndDrag: 0x28,
    CastOp: 0x2b,
    ImplementsOp: 0x2c,
    RandomNumber: 0x30,
    GetTime: 0x34,
    Delete: 0x3a,
    DefineLocal: 0x3c,
    CallFunction: 0x3d,
    Return: 0x3e,
    NewObject: 0x40,
    DefineLocal2: 0x41,
    InitArray: 0x42,
    InitObject: 0x43,
    TypeOf: 0x44,
    Add2: 0x47,
    Less2: 0x48,
    Equals2: 0x49,
    ToNumber: 0x4a,
    ToString: 0x4b,
    PushDuplicate: 0x4c,
    GetMember: 0x4e,
    SetMember: 0x4f,
    Increment: 0x50,
    Decrement: 0x51,
    CallMethod: 0x52,
    NewMethod: 0x53,
    InstanceOf: 0x54,
    Enumerate2: 0x55,
    BitAnd: 0x60,
    BitOr: 0x61,
    BitLShift: 0x63,
    BitRShift: 0x64,
    StrictEquals: 0x66,
    Greater: 0x67,
    Extends: 0x69,
    GotoFrame: 0x81,
    GetUrl: 0x83,
    StoreRegister: 0x87,
    ConstantPool: 0x88,
    WaitForFrame: 0x8a,
    SetTarget: 0x8b,
    GotoLabel: 0x8c,
    DefineFunction2: 0x8e,
    With: 0x94,
    Push: 0x96,
    Jump: 0x99,
    GetUrl2: 0x9a,
    DefineFunction: 0x9b,
    If: 0x9d,
    GotoFrame2: 0x9f,
    
    // op-code level
    _Nop: 0x200,
    _LogicalAnd: 0x100,
    _LogicalOr: 0x101,
    _ForIn: 0x102,
    _SetVariableExpr: 0x103,
    _SetMemberExpr: 0x104,
    _Ternary: 0x10d,
    
    // stmt level
    _While: 0x105,
    _DoWhile: 0x106,
    _For: 0x107,
    _Break: 0x108,
    _Continue: 0x109,
    _PushUndefined: 0x10a,
    _IfThen: 0x10b,
    _Switch: 0x10c,
    _Case: 0x112,
    _Default: 0x113,
    _IfBreak: 0x110,
    _IfContinue: 0x111,

    // markers
    _Expr: 0x10e,
    _Stmt: 0x10f
}

var VM = function(player) {
    this.player = player
    this.levels = []
    this._global = new Globals()
    this.traceLogger = ext.console('trace')
    this.delegate = null
}

ext.add(VM.prototype, {

    exportSprite : function(obj) {
        var MovieClip = this._global.MovieClip
        var c = obj._as2Class = function() {
            MovieClip.call(this)
        }
        ext.inherits(c, MovieClip)
    },

    doInitAction : function(ops) {
        var ctx = new Context(this, this.player.loader.root.as2Object())
        ctx.enter()
        if (this.delegate) {
            this.delegate.doInitAction(ctx, ops)
        }
        this.eval(ops, ctx)
    },
    
    doAction : function(target, tag) {
        var o = target.as2Object()
        var ctx = new Context(this, o)
        ctx.topLevel = true
        ctx.enter()
        if (this.delegate) {
            this.delegate.doAction(ctx, tag.Actions)
        }
        this.eval(tag.Actions, ctx)
    },

    defineFunction : function(ctx, op) {
        var vm = this
        var fn = function() {
            var newCtx = ctx.child()
            newCtx.activate(ctx.consts, op, this, arguments)
            return vm.eval(op.Code, newCtx)
        }
        ext.inherits(fn, this._global.Object)
        fn.__fn = true
        return fn
    },

    defineFunction2 : function(ctx, op) {
        var vm = this
        var fn = function() {
            /*
            if (arguments.callee.__name in fljs.fnWatch) {
                debugger
            }
            */
            var newCtx = ctx.child()
            newCtx.activate2(ctx.consts, op, this, arguments, arguments.callee)
            return vm.eval(op.Code, newCtx)
        }
        ext.inherits(fn, this._global.Object)
        fn.__fn = true
        return fn
    },
    
    construct : function(ctor, args) {
        if (!ctor.__ctor) {
            var fn = ctor.__ctor = function(args) {
                ctor.apply(this, args)
            }
            ext.inherits(fn, ctor)
        }
        return new ctor.__ctor(args)
    },

    eval : function(ops, ctx) {
        if (this.delegate) {
            this.delegate.eval(ops, ctx)
        }
        var stack = ctx.stack
        var c = ActionCode
        var t = Type
        for (var i = 0; i < ops.length; i++) {
            var op = ops[i]
            op = ops[i]
            if (this.delegate) {
                if (ctx != this.delegate.ctxStack[this.delegate.ctxStack.length - 1].ctx) {
                    //debugger
                }
                this.delegate.setOp(op, i)
            }
            switch (op.ActionCode) {
            case c.ConstantPool:
                ctx.consts = []
                for (var j in op.ConstantPool) {
                    ctx.consts.push(op.ConstantPool[j])
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
                        val = valIn.Value
                        break

                    case t.Number: // number
                    case 6:
                    case 7:
                        val = valIn.Value
                        break

                    case 4: // register lookup
                        val = ctx.regs[valIn.Value]
                        break

                    case 8: // constants lookup
                    case 9:
                        val = ctx.consts[valIn.Value]
                        break

                    default:
                        val = '[ERR: unknown value]'
                    }
                    stack.push(val)
                }
                break
            case c.GetVariable:
                var name = stack.pop()
                var val = ctx.get(name)
                stack.push(val)
                break
            case c.CallMethod:
                var method = stack.pop()
                var object = stack.pop()
                var nArgs = stack.pop()
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                var returned
                if (method) {
                    if (object) {
                        if (object[method]) {
                            returned = object[method].apply(object, args)
                        }
                        else {
                            returned = undefined
                        }
                    }
                    else {
                        if (env.debug) {
                            this.traceLogger.error('trying to call method [' + method + '] of an undefined object')
                            //debugger
                        }
                        returned = undefined
                    }
                }
                else {
                    object.__ctx = ctx
                    returned = object.apply(ctx.get('this'), args)
                }
                stack.push(returned)
                break
            case c.SetVariable:
                var value = stack.pop()
                var path = stack.pop()
                var name
                var obj
                if (path.indexOf(':') == -1) {
                    ctx.set(path, value)
                }
                else {
                    var parts = path.split(':')
                    obj = ctx.resolvePath(parts[0])
                    name = parts[1]
                    // XXX: just for debugging
                    if (typeof value == 'function') {
                        value.__name = name
                    }
                    obj[name] = value
                }
                break
            case c.Divide:
                var a = stack.pop()
                var b = stack.pop()
                var result = b / a
                // TODO: handle SWF4 test
                stack.push(result)
                break
            case c.Multiply:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(Number(a) * Number(b))
                break
            case c.Equals2:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(a == b)
                break
            case c.Not:
                var a = stack.pop()
                if (ops.swfVersion == 4) {
                    a = Number(a)
                    if (a == 0) {
                        stack.push(1)
                    }
                    else {
                        stack.push(0)
                    }
                }
                else {
                    stack.push(!a)
                }
                break
            case c.If:
                // TODO: handle SWF4 test
                var cnd = stack.pop()
                if (cnd) {
                    var j = i + 1
                    while (ops[j] && ops[j].address != ops[i + 1].address + op.BranchOffset) {
                        if (op.BranchOffset > 0) {
                            j += 1
                        }
                        else {
                            j -= 1
                        }
                    }
                    i = j - 1 // b/c we increment at end of loop
                }
                break
            case c.Pop:
                stack.pop()
                break
            case c.WaitForFrame:
                if (ctx.target._framesloaded < op.Frame + 1) {
                    i += 1 + op.SkipCount
                }
                break
            case c.GotoFrame:
                ctx.target.gotoAndStop(op.Frame + 1)
                break
            case c.GetUrl:
                ctx.target.getUrl(op.UrlString, op.TargetString)
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
                            ctx.target.getUrl(url, target)
                        }
                    }
                }
                break
            case c.Play:
                ctx.target.play()
                break
            case c.Stop:
                ctx.target.stop()
                break
            case c.DefineFunction:
                var fn = this.defineFunction(ctx, op)
                if (op.FunctionName) {
                    fn.__name = op.FunctionName
                    ctx.set(op.FunctionName, fn)
                }
                else {
                    stack.push(fn)
                }
                break
            case c.SetTarget:
                ctx.setTarget(op.TargetName)
                break
            case c.PreviousFrame:
                ctx.target.prevFrame()
                break
            case c.NextFrame:
                ctx.target.nextFrame()
                break
            case c.Jump:
                var sign = op.BranchOffset > 0 ? 1 : -1
                var j = i + 1
                var target = ops[i + 1].address + op.BranchOffset
                while (ops[j] && ops[j].address != target) {
                    // This was added to fix an exepcted bug. Is it still needed?
                    if (sign == -1 && ops[j - 1] && target > ops[j - 1].address) {
                        i = j
                        break
                    }
                    j += sign
                }
                if (ops[j] && ops[j].address == target) {
                    i = j - 1
                }
                else {
                    i = j
                }
                break
            case c.NewObject:
                var name = stack.pop()
                var nArgs = stack.pop()
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                var ctor
                switch (name) {
                case 'Boolean':
                case 'Number':
                case 'String':
                case 'Array':
                    ctor = window[name]
                    break
                default:
                    ctor = ctx.get(name)
                    break
                }
                var obj = this.construct(ctor, args)
                stack.push(obj)
                break
            case c.GetMember:
                var name = stack.pop()
                var obj = stack.pop()
                var val
                if (obj) {
                    val = obj[name]
                }
                else {
                    val = undefined
                    if (env.debug) {
                        this.traceLogger.error('trying to get member [' + name + '] of an undefined object')
                        //debugger
                    }
                }
                stack.push(val)
                break
            case c.SetMember:
                var value = stack.pop()
                var name = stack.pop()
                var obj = stack.pop()
                if (obj) {
                    // XXX: just for debugging
                    if (typeof value == 'function') {
                        value.__name = name
                    }
                    obj[name] = value
                }
                else if (env.debug) {
                    this.traceLogger.error('trying to set member [' + name + '] on an undefined object')
                    //debugger
                }
                break
            case c.InitObject:
                var nElems = stack.pop()
                var obj = new this._global.Object()
                for (var j = 0; j < nElems; j++) {
                    var val = stack.pop()
                    var name = stack.pop()
                    obj[name] = val
                }
                stack.push(obj)
                break
            case c.Trace:
                var val = stack.pop()
                this.traceLogger.info(val)
                break
            case c.Increment:
                var val = stack.pop()
                stack.push(val + 1)
                break
            case c.With:
                var obj = stack.pop()
                // TODO
                //this.callWith(ctx, op, obj)
                break
            case c.End:
                break
            case c.DefineFunction2:
                var fn = this.defineFunction2(ctx, op)
                if (op.FunctionName) {
                    fn.__name = op.FunctionName
                    ctx.set(op.FunctionName, fn)
                }
                else {
                    stack.push(fn)
                }
                break
            case c.StoreRegister:
                ctx.regs[op.RegisterNumber] = stack[stack.length - 1]
                break
            case c.GotoLabel:
                ctx.target.gotoAndStop(op.Label)
                break
            case c.StartDrag:
                var target = stack.pop()
                var lockCenter = !!stack.pop()
                var constrain = !!stack.pop()
                if (constrain) {
                    var y2 = stack.pop()
                    var x2 = stack.pop()
                    var y1 = stack.pop()
                    var x1 = stack.pop()
                }
                break
            case c.EndDrag:
                break
            case c.Add2:
                var arg1 = stack.pop()
                var arg2 = stack.pop()
                stack.push(arg2 + arg1)
                break
            case c.Subtract:
                var a = Number(stack.pop())
                var b = Number(stack.pop())
                stack.push(b - a)
                break
            case c.DefineLocal:
                var val = stack.pop()
                var name = stack.pop()
                // XXX: just for debugging
                if (typeof val == 'function') {
                    val.__name = name
                }
                if (ctx.topLevel) {
                    ctx.target[name] = val
                }
                else {
                    ctx.scope[name] = val
                }
                break
            case c.PushDuplicate:
                var value = stack[stack.length - 1]
                stack.push(value)
                break
            case c.GetTime:
                stack.push(ext.now() - this.player.playAt)
                break
            case c.Greater:
                var arg1 = stack.pop()
                var arg2 = stack.pop()
                stack.push(arg2 > arg1)
                break
            case c.CallFunction:
                var name = stack.pop()
                var nArgs = stack.pop()
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                var func = ctx.get(name)
                var returned
                if (func) {
                    //func.__ctx = ctx
                    returned = func.apply(null, args)
                }
                else {
                    returned = undefined
                }
                stack.push(returned)
                break
            case c.DefineLocal2:
                var name = stack.pop()
                if (!ctx.scope.hasOwnProperty(name)) {
                    ctx.scope[name] = undefined
                }
                break
            case c.TypeOf:
                var val = stack.pop()
                var type
                if (val === null) {
                    type = 'null'
                }
                else if (val instanceof this._global.MovieClip) {
                    type = 'movieclip'
                }
                else {
                    type = typeof val
                }
                stack.push(type)
                break
            case c.ToInteger:
                var val = Number(stack.pop())
                if (val >= 0) {
                    val = Math.floor(val)
                }
                else {
                    val = Math.ceil(val)
                }
                stack.push(val)
                break
            case c.Return:
                if (this.delegate) {
                    this.delegate.popContext()
                }
                return stack.pop()
                break
            case c.GotoFrame2:
                var obj
                var val = stack.pop()
                var frame
                if (typeof val == 'string') {
                    var parts = val.split(':')
                    if (parts.length == 1) {
                        obj = ctx.target
                        frame = parts[0]
                    }
                    else {
                        obj = ctx.resolvePath(parts[0])
                        frame = parts[1]
                    }
                    if (parseInt(frame)) {
                        frame = parseInt(frame)
                    }
                    else {
                        frame = frame
                    }
                }
                else {
                    obj = ctx.target
                    frame = val
                }
                if (op.SceneBias) {
                    frame += op.SceneBias
                }
                if (op.PlayFlag) {
                    ctx.target.gotoAndPlay(frame)
                }
                else {
                    ctx.target.gotoAndStop(frame)
                }
                break
            case c.Less2:
                var arg1 = stack.pop()
                var arg2 = stack.pop()
                stack.push(arg2 < arg1)
                break
            case c.Decrement:
                var val = stack.pop()
                stack.push(val - 1)
                break
            case c.Delete:
                var name = stack.pop()
                var obj = stack.pop()
                delete obj[name]
                break
            case c.NewMethod:
                var name = stack.pop()
                var obj = stack.pop()
                var nArgs = stack.pop()
                var args = []
                for (var j = 0; j < nArgs; j++) {
                    args.push(stack.pop())
                }
                var ctor
                if (name === null || typeof name == 'undefined' || (typeof name == 'string' && name.length == 0)) {
                    ctor = obj
                }
                else {
                    ctor = obj[name]
                }
                returned = this.construct(ctor, args)
                stack.push(returned)
                break
            case c.ImplementsOp:
                var ctor = stack.pop()
                var nInt = stack.pop()
                for (var j = 0; j < nInt; j++) {
                    stack.pop()
                }
                // TODO: respect the interface list
                break
            case c.ToNumber:
                var obj = stack.pop()
                //stack.push(obj.valueOf())
                stack.push(Number(obj))
                break
            case c.Enumerate2:
                var obj = stack.pop()
                // add end of list
                stack.push(null)
                var slots = obj.__propFlags
                if (!slots) {
                    slots = {}
                }
                for (var j in obj) {
                    if (((j in slots) && (slots[j] & 1)) || j in this._global.Object.__propFlags || j.substr(0, 2) == '__') {
                        continue
                    }
                    stack.push(j)
                }
                break
            case c.RandomNumber:
                var max = stack.pop()
                var rand = Math.floor(Math.random() * max)
                stack.push(rand)
                break
            case c.GetProperty:
                var index = stack.pop()
                var target = stack.pop()
                var val = target[Property[index]]
                stack.push(val)
                break
            case c.SetProperty:
                var val = stack.pop()
                var index = stack.pop()
                var target = stack.pop()
                target[Property[index]] = val
                break
            case c.StrictEquals:
                var a = stack.pop()
                var b = stack.pop()
                stack.push(a === b)
                break
            case c.InitArray:
                var nArgs = stack.pop()
                var arr = new Array(nArgs)
                for (var j = 0; j < nArgs; j++) {
                    arr[j] = stack.pop()
                }
                stack.push(arr)
                break
            case c.ToString:
                var obj = stack.pop()
                var str
                if (obj) {
                    str = obj.toString()
                }
                else if (obj === null) {
                    str = 'null'
                }
                else {
                    str = 'undefined'
                }
                stack.push(str)
                break
            case c.Extends:
                var _super = stack.pop()
                var _sub = stack.pop()
                ext.inherits(_sub, _super)
                break
            case c.InstanceOf:
                var ctor = stack.pop()
                var obj = stack.pop()
                stack.push(obj instanceof ctor)
                break
            case c.BitAnd:
                stack.push(stack.pop() & stack.pop())
                break
            case c.BitRShift:
                var count = stack.pop()
                var val = stack.pop()
                stack.push(val >> count)
                break
            case c.CastOp:
                var obj = stack.pop()
                var ctor = stack.pop()
                if (typeof ctor == 'string') {
                    ctor = this._global[ctor]
                }
                if (obj instanceof ctor) {
                    stack.push(obj)
                }
                else {
                    stack.push(null)
                }
                break
            case c.BitLShift:
                var count = stack.pop()
                var val = stack.pop()
                stack.push(val << count)
                break
            case c.BitOr:
                stack.push(stack.pop() | stack.pop())
                break
            default:
                rar.rar = rar
            }
        }
        // End, If, or Jump
        if (this.delegate) {
            this.delegate.popContext()
        }
    }

})

exports.VM = VM
exports.Type = Type
exports.Property = Property
exports.ActionCode = ActionCode

})
