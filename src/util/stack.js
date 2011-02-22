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

var Stack = function() {
    this._undef = undefined
    this._stack = []
}
ext.define(Stack.prototype, {
    
    get_length : function() {
        return this._stack.length
    },
    
    set_length : function(v) {
        this._stack.length = v
    }
})
ext.add(Stack.prototype, {

    push : function(/* ... */) {
        this._stack.push.apply(this._stack, arguments)
    },
    
    pop : function() {
        var top
        if (this._stack.length) {
            top = this._stack.pop()
        }
        else {
            top = this._undef
        }
        return top
    }
})

exports.Stack = Stack

})
