/**
 * Smokescreen Player - A Flash player written in JavaScript
 * http://smokescreen.us/
 * 
 * Copyright 2011, Chris Smoak
 * Released under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
define(function(require, exports, module) {

var timeouts = []
var timeoutMessageName = 'smokescreen-timeout-message'
var timeoutHandler = function(event) {
    if (event.source == window && event.data == timeoutMessageName) {
        event.stopPropagation()
        if (timeouts.length > 0) {
            timeouts.shift()()
        }
    }
}

window.addEventListener('message', timeoutHandler, true)

exports.setTimeout = function(fn) {
    timeouts.push(fn)
    window.postMessage(timeoutMessageName, '*')
}

})
