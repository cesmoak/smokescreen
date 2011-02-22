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

var Context = function(vm, target, scope) {
    this.vm = vm
    this.target = target
    this.stack = []
    this.regs = []
    if (!scope) {
        this.scope = {}
    }
    else {
        this.scope = scope
    }
}

Context.scope = function() {}

ext.add(Context.prototype, {

    child : function() {
        Context.scope.prototype = this.scope
        var scope = new Context.scope()
        var ctx = new Context(this.vm, this.target, scope)
        ctx.parent = this
        return ctx
    },
 
    enter : function() {
        this.consts = []
        var _this
        if (this.parent) {
            _this = this.parent.scope
        }
        else {
            _this = this.target
        }
        this.scope['this'] = _this
        this.scope['_global'] = this.vm._global
    },
 
    activate : function(consts, op, _this, args) {
        var scope = this.scope
        var target = this.target
        this.consts = consts
        if (_this == window) {
            if (this.parent) {
                _this = this.parent.scope
            }
            else {
                _this = target
            }
        }
        scope['this'] = _this
        var params = op.Parameters
        var i = 0
        for (l = args.length; i < l; i++) {
            scope[params[i]] = args[i]
        }
        for (l = params.length; i < l; i++) {
            scope[params[i]] = undefined
        }
        scope['arguments'] = args
        scope['super'] = undefined // TODO
        scope['_root'] = target._root
        scope['_parent'] = target._parent
        scope['_global'] = this.vm._global
    },
    
    activate2 : function(consts, op, _this, args, func) {
        this.consts = consts
        // this
        if (_this == window) {
            _this = this.target
        }
        if (!op.SupressThisFlag) {
            this.scope['this'] = _this
        }
        for (var i = 0; i < op.NumParams; i++) {
            var param = op.Parameters[i]
            var reg = param.Register
            var arg
            if (i in args) {
                arg = args[i]
            }
            else {
                arg = undefined
            }
            if (reg) {
                this.regs[reg] = arg
            }
            else {
                this.scope[param.ParamName] = arg
            }
        }
        var reg = 1
        // this
        if (op.PreloadThisFlag) {
            this.regs[reg++] = _this
        }
        // arguments
        if (op.PreloadArgumentsFlag) {
            this.regs[reg++] = args
        }
        // super
        // XXX: supported?
        if (op.PreloadSuperFlag) {
            this.regs[reg++] = func.superClass_.constructor
        }
        // _root
        if (op.PreloadRootFlag) {
            this.regs[reg++] = this.target._root
        }
        // _parent
        if (op.PreloadParentFlag) {
            this.regs[reg++] = this.target._parent
        }
        // global
        if (op.PreloadGlobalFlag) {
            this.regs[reg++] = this.vm._global
        }
    },
    
    set : function(name, val) {
        if (name in this.scope) {
            var ctx = this
            while (ctx) {
                if (ctx.scope.hasOwnProperty(name)) {
                    ctx.scope[name] = val
                    return
                }
                ctx = ctx.parent
            }
            // [err]
        }
        this.target[name] = val
    },
    
    get : function(name) {
        if (name in this.scope) {
            return this.scope[name]
        }
        if (name in this.target) {
            return this.target[name]
        }
        if (name in this.vm._global) {
            return this.vm._global[name]
        }
        return undefined
    },
    
    resolvePath : function(path) {
        var separator
        if (path.indexOf('.') == -1) {
            separator = '/'
        }
        else {
            separator = '.'
        }
        var parts = path.split(separator)
        var obj = this.target
        if (parts[0] == '' && parts.length > 1) {
            obj = this.target._root
        }
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i]
            if (!part) {
                continue
            }
            else if (part == '.') {
                continue
            }
            else if (part == '..') {
                obj = obj.parent
            }
            else {
                obj = obj.__dispObj.names[part].as2Object()
            }
        }
        return obj
    },
  
    setTarget : function(name) {
        var obj
        if (name) {
            obj = this.resolvePath(name)
            if (!this.origTarget) {
                this.origTarget = this.target
            }
        }
        else {
            obj = this.origTarget
        }
        this.target = obj
    }

})

exports.Context = Context

})
