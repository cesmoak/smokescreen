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

var Eventer = function() {
    this.listeners = []
}

ext.add(Eventer.prototype, {
    
    add : function(callback) {
        if (this.listeners.indexOf(callback) == -1) {
            this.listeners.push(callback)
        }
    },

    remove : function(callback) {
        var index = this.listeners.indexOf(callback)
        if (index != -1) {
            this.listeners.splice(index, 1)
        }
    },

    dispatch : function(evt) {
        for (var i = 0; i < this.listeners.length; i++) {
            this.listeners[i](evt)
        }
    }
})

exports.Eventer = Eventer

})
