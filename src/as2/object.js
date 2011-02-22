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

var Object = function() {
}

Object.__propFlags = {'addProperty': 7, 'registerClass': 7}

ext.add(Object.prototype, {
    
    addProperty : function(prop, getFunc, setFunc) {
        if (getFunc) {
            this.__defineGetter__(prop, getFunc)
        }
        if (setFunc) {
            this.__defineSetter__(prop, setFunc)
        }
    },
    
    registerClass : function(name, theClass) {
        // TODO
    }

})

exports.Object = Object

})
