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

/**
 * Contains display objects currently on the stage under a MovieClip
 */
var DisplayList = function() {
    this.entriesByDepth = {}
    this.highest = 10000
}

ext.add(DisplayList.prototype, {

    setAtDepth: function(obj, depth) {
        this.entriesByDepth[depth] = obj
        this.highest = Math.max(this.highest, depth)
    },

    removeAtDepth: function(depth) {
        var obj = this.entriesByDepth[depth]
        delete this.entriesByDepth[depth]
        return obj
    },

    getNextHighestDepth: function() {
        return this.highest + 1
    },

    getAtDepth: function(depth) {
        return this.entriesByDepth[depth]
    },

    getDisplayObjects: function() {
        return this.entriesByDepth
    }
})

exports.DisplayList = DisplayList

})
