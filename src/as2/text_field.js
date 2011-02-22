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

var TextField = function() {
    as2_Object.call(this)
}

ext.inherits(TextField, as2_Object)

TextField.props = {
    text : 'text'
}

ext.define(TextField.prototype, {
    
    get_text : function() {
        return this.__dispObj.rawText()
    },

    set_text : function(text) {
        // TODO
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

exports.TextField = TextField

})
