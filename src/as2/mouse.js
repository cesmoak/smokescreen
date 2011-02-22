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

/**
 * This is just a stub class for now.
 */
var Mouse = function() {
    as2_Object.call(this)
}

ext.inherits(Mouse, as2_Object)

ext.add(Mouse, {

    addListener : function(listener) {},
    
    hide : function() {},
    
    removeListener : function(listener) {},
    
    show : function() {}

})

exports.Mouse = Mouse

})
