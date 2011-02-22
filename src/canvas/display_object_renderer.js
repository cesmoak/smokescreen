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
var env = require('lib/env')
var Element = require('dom/element').Element
var ClipLayer = require('canvas/clip_layer').ClipLayer

var flags = {
    UPDATE_ALPHA: 1 << 0,
    UPDATE_MATRIX: 1 << 1,
    UPDATE_DEPTH: 1 << 2,
    UPDATE_VISIBILITY: 1 << 3,
    UPDATE_COLOR_TRANSFORM: 1 << 4,
    UPDATE_CLIP_DEPTH: 1 << 5,
    UPDATE_NONE: 0
}
flags.UPDATE_ALL = 
    flags.UPDATE_ALPHA | 
    flags.UPDATE_MATRIX | 
    flags.UPDATE_DEPTH | 
    flags.UPDATE_VISIBILITY | 
    flags.UPDATE_COLOR_TRANSFORM | 
    flags.UPDATE_CLIP_DEPTH

var DisplayObjectRenderer = function() {
    this.updateFlags = flags.UPDATE_NONE
}

ext.add(DisplayObjectRenderer, {
    updateFlags: flags
})

ext.add(DisplayObjectRenderer.prototype, {

    updateMatrix: function() {
        this.updateFlags |= flags.UPDATE_MATRIX
    },

    updateAlpha: function() {
        this.updateFlags |= flags.UPDATE_ALPHA
    },

    updateColorTransform: function() {
        this.updateFlags |= flags.UPDATE_COLOR_TRANSFORM
    },

    updateDepth: function() {
        this.updateFlags |= flags.UPDATE_DEPTH
    },

    updateVisibility: function() {
        this.updateFlags |= flags.UPDATE_VISIBILITY
    },

    updateClipDepth: function() {
        this.updateFlags |= flags.UPDATE_CLIP_DEPTH
    },

    updateAll: function() {
        this.updateFlags = flags.UPDATE_ALL
    },

    handleUpdateClipDepth: function(obj) {
        if (this.updateFlags & flags.UPDATE_CLIP_DEPTH) {
            var clipDepth = obj.getClipDepth()
            if (clipDepth > 0) {
                if (!this.clipper) {
                    this.clipper = new ClipLayer(obj)
                    this.clipper.insert()
                }
                else {
                    // TODO
                }
            }
            else {
                if (this.clipper) {
                    this.clipper.remove()
                    delete this.clipper
                }
            }
        }
    },

    getOuterEl: function() {
        return (this.clipper ? this.clipper.el : this.el)
    }
})

exports.DisplayObjectRenderer = DisplayObjectRenderer

})
