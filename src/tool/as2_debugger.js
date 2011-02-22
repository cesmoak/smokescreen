define(function(require, exports, module) {

var ext = require('lib/ext')
var Element = require('dom/element').Element
var ActionInspector = require('tool/action_inspector').ActionInspector

var As2Debugger = function(container) {
    var cont = this.container = new Element(container)
    var el = this.playerState = new Element()
    el.create('div')
    cont.append(el)
    var el = this.ctxStackContainer = this.layout('vertical')
    var style = el.element.style
    style.fontFamily = 'Menlo, Consolas, monospace'
    style.fontSize = '12px'
    cont.append(el)
    this.ctxStack = []
    this.inspector = new ActionInspector()
    this.breakOnTopLevelContext = false
    this.breakOnOp = false
}
ext.add(As2Debugger.prototype, {

    attach : function(vm) {
        this.vm = vm
        this.vm.delegate = this
    },

    showPlayerState : function() {
        this.playerState.element.innerHTML = '_level0._currentframe : ' + this.vm.player.loader.root.as2Object()._currentframe
    },

    layout : function(orient, els) {
        var el = new Element()
        el.create('div')
        var style = el.element.style
        style.display = '-webkit-box'
        style.webkitBoxOrient = orient
        if (els) {
            for (var i = 0; i < els.length; i++) {
                el.append(els[i])
            }
        }
        return el
    },

    scope : function(scope) {
        var el = this.layout('vertical')
        for (var name in scope) {
            var field = new Element()
            field.create('div')
            field.appendText(name + ': ' + scope[name])
            el.append(field)
        }
        return el
    },

    lineDigits : function(count) {
        if (count == 0) {
            return 1
        }
        else {
            return 1 + Math.floor(Math.log(count) / Math.log(10))
        }
    },

    formatLineNumber : function(num, maxDigits) {
        var len
        if (num === 0) {
            len = 1
        }
        else {
            len = 1 + Math.floor(Math.log(num) / Math.log(10))
        }
        return (new Array(maxDigits - len + 1).join('&nbsp;')) + num + '&nbsp;&nbsp;'
    },

    pushContext : function(ctx, ops) {
        var els = []
        var el = new Element()
        el.create('div')
        var style = el.element.style
        style.maxWidth = '500px'
        style.overflowX = 'scroll'
        style.borderRight = '1px solid black'
        this.inspector.inspectLive(ctx, ops)
        var lines = this.inspector.out.slice(0)
        var opIndex = this.inspector.opIndex.slice(0)
        var lineEls = []
        var count = lines.length
        var digits = this.lineDigits(count)
        for (var i = 0; i < count; i++) {
            var lineEl = document.createElement('div')
            lineEl.style.overflowX = 'visible'
            lineEl.innerHTML = this.formatLineNumber(i, digits) + lines[i]
            lineEls.push(lineEl)
            el.element.appendChild(lineEl)
        }
        els.push(el)
        var el = this.scope(ctx.scope)
        els.push(el)
        var el = this.layout('horizontal', els)
        var style = el.element.style
        style.borderBottom = '2px solid black'
        this.ctxStackContainer.insertFirst(el)
        this.ctxStack.push({
            ctx: ctx,
            ops: ops,
            lines: lines,
            opIndex: opIndex,
            lineEls: lineEls,
            el: el,
            index: null
        })
    },

    setOp : function(op, i) {
        var ctx = this.ctxStack[this.ctxStack.length - 1]
        var index = ctx.opIndex[i]
        if (ctx.index === index) {
            return
        }
        else if (ctx.index != null) {
            ctx.lineEls[ctx.index].style.backgroundColor = null
        }
        ctx.lineEls[index].style.backgroundColor = 'yellow'
        ctx.index = index
        if (this.breakOnOp) {
            //debugger
        }
    },

    popContext : function() {
        var ctx = this.ctxStack.pop()
        ctx.el.removeSelf()
    },

    doInitAction : function(ctx, ops) {
        this.showPlayerState()
        if (this.breakOnTopLevelContext) {
            this.breakOnOp = true
            if (this.vm.player.controlsCallback) {
                this.vm.player.controlsCallback()
            }
            //debugger
        }
    },
    
    doAction : function(ctx, ops) {
        this.showPlayerState()
        if (this.breakOnTopLevelContext) {
            this.breakOnOp = true
            if (this.vm.player.controlsCallback) {
                this.vm.player.controlsCallback()
            }
            //debugger
        }
    },
    
    eval : function(ops, ctx) {
        this.pushContext(ctx, ops)
    }
})

exports.As2Debugger = As2Debugger

})
