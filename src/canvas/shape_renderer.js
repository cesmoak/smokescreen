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
var ColorTransformFilter = require('canvas/color_transform_filter').ColorTransformFilter
var Element = require('dom/element').Element
var DisplayObjectRenderer = require('canvas/display_object_renderer').DisplayObjectRenderer

var updateFlags = DisplayObjectRenderer.updateFlags

var ShapeRenderer = function(context) {
    DisplayObjectRenderer.call(this)
    this.context = context
}

ext.inherits(ShapeRenderer, DisplayObjectRenderer)

ext.add(ShapeRenderer.prototype, {

    setShape: function(shape) {
        this.shape = shape
        this.parent = shape.parent.renderer
        this.def = this.context.dict[shape.def.getCharacterId()]
        this.canvas = null
    },
    
    draw: function() {
        var flags = this.updateFlags
        if (!this.canvas) {
            this.$buildCanvas()
            flags = updateFlags.UPDATE_ALL
        }
        if (flags & updateFlags.UPDATE_COLOR_TRANSFORM) {
            this.$fullRedraw()
            var xform = this.shape.getColorTransform()
            if (xform && !xform.isIdentity()) {
                var filter = new ColorTransformFilter()
                filter.filter(this.canvas, xform)
            }
        }
        var style = this.el.element.style
        if (flags & updateFlags.UPDATE_MATRIX) {
            style.webkitTransform = this.shape.getMatrix().toCss()
            if (this.clipper) {
                this.clipper.updateTransform()
            }
        }
        if (flags & updateFlags.UPDATE_ALPHA) {
            var alpha = this.shape.getAlpha() / 100
            if (alpha == 1) {
                delete style.opacity
            }
            else {
                style.opacity = alpha
            }
        }
        if (flags & updateFlags.UPDATE_DEPTH) {
            style.zIndex = this.shape.getDepth()
        }
        if (flags & updateFlags.UPDATE_VISIBILITY) {
            style.visibility = this.shape.getVisible() ? 'inherit' : 'hidden'
        }
        this.handleUpdateClipDepth(this.shape)
        this.updateFlags = updateFlags.UPDATE_NONE
    },

    $buildCanvas: function() {
        this.el = this.def.el.clone(true)
        this.canvas = new Element(this.el.element.firstChild)
        this.$fullRedraw()

        var style = this.el.element.style
        if (env.accelerate && !this.shape.isInClippingTree()) {
            style.webkitTransformStyle = 'preserve-3d'
        }
    },

    $fullRedraw: function() {
        this.canvas.element.getContext('2d').drawImage(this.def.canvas.element, 0, 0)
    }
})

exports.ShapeRenderer = ShapeRenderer

})
