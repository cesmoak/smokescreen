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
var as2_Object = require('as2/object').Object
var agent = require('lib/agent').agent
var Loader = require('player/loader').Loader
var MovieClipDef = require('def/movie_clip_def').MovieClipDef

var MovieClip = function() {
    as2_Object.call(this)
}

ext.inherits(MovieClip, as2_Object)

ext.define(MovieClip.prototype, {

    get__root: function() {
        return this.__dispObj.loader.root.as2Object()
    },

    get__parent: function() {
        return this.__dispObj.parent ? this.__dispObj.parent.as2Object() : this
    },

    get__framesloaded : function() {
        // TODO: fix this when loading async
        return this._totalframes
    },

    get__currentframe : function() {
        return this.__dispObj.getPlayhead()
    },

    get__totalframes : function() {
        if (this.__dispObj.timeline) {
            return this.__dispObj.timeline.tag.FrameCount
        }
        else {
            return this.__dispObj.loader.header.FrameCount
        }
    },
    
    get__xscale : function() {
        return this.__dispObj.getXScale()
    },

    set__xscale : function(val) {
        this.__dispObj.setXScale(val)
    },

    get__yscale : function() {
        return this.__dispObj.getYScale()
    },

    set__yscale : function(val) {
        this.__dispObj.setYScale(val)
    },

    get__visible : function() {
        return this.__dispObj.getVisible()
    },
    
    set__visible : function(val) {
        this.__dispObj.setVisible(val)
    },
    
    get__x : function() {
        return this.__dispObj.getX()
    },

    set__x : function(val) {
        this.__dispObj.setX(val)
    },

    get__y : function() {
        return this.__dispObj.getY()
    },

    set__y : function(val) {
        this.__dispObj.setY(val)
    },
    
    get__alpha : function() {
        return this.__dispObj.getAlpha()
    },

    set__alpha : function(val) {
        this.__dispObj.setAlpha(val)
    },

    get__rotation : function() {
        return this.__dispObj.getRotation()
    },

    set__rotation : function(val) {
        this.__dispObj.setRotation(val)
    }
    
    /*
    set_onEnterFrame : function(val) {
        this._onEnterFrame = val
    },

    set_onRelease : function(val) {
        this._onRelease = val
    },
    
    get_xmouse : function() {
        return this.dispObj.get_mouseX()
    },
    
    get_ymouse : function() {
        return this.dispObj.get_mouseY()
    }
    */
})

ext.add(MovieClip.prototype, {
    
    nextFrame : function() {
        this.__dispObj.gotoAndStop(this._currentframe + 1)
    },
    
    prevFrame : function() {
        this.__dispObj.gotoAndStop(this._currentframe - 1)
    },
    
    gotoAndStop : function(frame) {
        this.__dispObj.gotoAndStop(frame)
    },

    gotoAndPlay : function(frame) {
        this.__dispObj.gotoAndPlay(frame)
    },

    play : function() {
        this.__dispObj.play()
    },
    
    stop : function() {
        this.__dispObj.stop()
    },
    
    getUrl : function(url, target) {
        if (target == '') {
            window.location = url
        }
        var fscmdLen = 'FSCommand:'.length
        if (url.substr(0, fscmdLen) == 'FSCommand:') {
            switch (url.substr(fscmdLen)) {
            case 'quit':
                // psuedo-quit
                // TODO
                this.__dispObj.loader.player.pause()
                break
            case 'fullscreen':
                // TODO
                break
            case 'allowscale':
                // TODO
                break
            case 'showmenu':
                // TODO
                break
            case 'exec':
                // TODO
                break
            case 'trapallkeys':
                // TODO
                break
            }
            // TODO: external js interaction
            return
        }
        else {
            var t = target
            if (agent.OS == 'iPhone' || agent.OS == 'iPad') {
                if (t == '_blank') {
                    t = '_self'
                }
            }
            window.open(url, t)
            return ''
        }
    },

    /*
    localToGlobal : function(pt) {
        var p = new flash.geom.Point(pt.Value.get('x'), pt.Value.get('y'))
        p = this.dispObj.localToGlobal(p)
        var obj = new fljs.as2.Object()
        obj.set('x', p.x)
        obj.set('y', p.y)
        return {Type:11, Value:obj}
    },
    
    hitTest : function(x, y, target) {
        // target
        if (arguments.length == 1) {
            var target = arguments[0]
            var obj
            // dispobj path
            if (target.Type == 0) {
                // TODO
            }
            // obj
            else {
                obj = target.Value
            }
            var hit = this.dispObj.hitTestObject(obj.Value.dispObj)
            return {Type:5, Value:hit}
        }
        // x, y, target
        else {
            // TODO
        }
    },
    */
    getBytesLoaded : function() {
        return this.getBytesTotal()
    },
    
    getBytesTotal : function() {
        if (this.__dispObj.timeline) {
            return this.__dispObj.timeline.tag.header.TagLength
        }
        else {
            return this.__dispObj.loader.header.FileLength
        }
    },
    /*,
    
    get__framesloaded : function() {
        return {Type:1, Value:this.dispObj.framesLoaded_}
    },
    
    get__xscale : function() {
        return {Type:1, Value:this.dispObj.scaleX}
    },

    set__xscale : function(val) {
        this.dispObj.scaleX = val.Value
    },

    get__yscale : function() {
        return {Type:1, Value:this.dispObj.scaleY}
    },

    set__yscale : function(val) {
        this.dispObj.scaleY = val.Value
    },
    
    get__visible : function() {
        return {Type:5, Value:this.dispObj.getVisible()}
    },
    
    set__visible : function(val) {
        this.dispObj.setVisible(val.Value)
    },
    
    get__x : function() {
        return {Type:1, Value:this.dispObj.x}
    },

    set__x : function(val) {
        this.dispObj.x = val.Value
    },

    get__y : function() {
        return {Type:1, Value:this.dispObj.y}
    },

    set__y : function(val) {
        this.dispObj.y = val.Value
    },
    
    set_onEnterFrame : function(val) {
        this._onEnterFrame = val
    },

    set_onRollOver : function(val) {
        this.set_onMouseEvent(flash.events.MouseEvent.MOUSE_OVER, val)
    },

    set_onRollOut : function(val) {
        this.set_onMouseEvent(flash.events.MouseEvent.MOUSE_OUT, val)
    },

    set_onPress : function(val) {
        this.set_onMouseEvent(flash.events.MouseEvent.MOUSE_DOWN, val)
    },

    set_onRelease : function(val) {
        this.set_onMouseEvent(flash.events.MouseEvent.MOUSE_UP, val)
    },

    set_onMouseEvent : function(type, val) {
        var hasHandler = (
            this['_on' + type] && !(this['_on' + type].Type == 2 || this['_on' + type].Type == 3)
        )
        var hasNewHandler = (
            !(val.Type == 2 || val.Type == 3)
        )
        if (hasHandler && !hasNewHandler) {
            this.dispObj.removeEventListener(type, this['_on' + type + 'Handler'])
        }
        if (!hasHandler && hasNewHandler) {
            if (!this['_on' + type + 'Handler']) {
                this['_on' + type + 'Handler'] = fljs.bind(this.onMouseEventHandler, this, type)
            }
            this.dispObj.addEventListener(type, this['_on' + type + 'Handler'])
        }
        this['_on' + type] = val
    },
    
    get_xmouse : function() {
        return this.dispObj.get_mouseX()
    },
    
    get_ymouse : function() {
        return this.dispObj.get_mouseY()
    },
    
    onMouseEventHandler : function(type, e) {
        // TODO: only on capture, only if highest in chain to handle this event
        // if (!e.isCapture) { return }
        // e.preventDefault()
        // TODO
        var player = fljs.Player.getInstance()
        player.interpreter.callback(this, this['_on' + type])
    },
    
    get__width : function() {
        return {Type:1, Value:this.dispObj.getWidth()}
    },
    
    set__width : function(val) {
        this.dispObj.setWidth(val.Value)
    }
    */
    
     
    getNextHighestDepth : function() {
        return this.__dispObj.displayList.getNextHighestDepth()
    },
    
    attachMovie : function(obj, name, depth) {
        // TODO
        return null
    },
    
    setMask : function(mask) {
        // TODO

        // clear existing mask
        if (mask === null) {
            
        }
        // name
        else if (typeof mask == 'string') {
            
        }
        // instance
        else {
            
        }
    },

    
    getInstanceAtDepth : function(depth) {
        var obj = this.__dispObj.displayList.getAtDepth(depth)
        // TODO: do we need to test for obj.as2Object?
        if (obj) {
            return obj.as2Object()
        }
        else {
            // TODO: null?
            return undefined
        }
    },

    createEmptyMovieClip : function(name, depth) {
        // TODO
        var disp = this.__dispObj
        return null
    },
    
    lineTo : function(x, y) {
        // TODO
    },
    
    removeMovieClip : function() {
        this.__dispObj.parent.removeChildAtDepth(this.__dispObj.getDepth())
    },
    
    toString : function() {
        return 'mc-' + this.__dispObj.id
    }

})

exports.MovieClip = MovieClip

})
