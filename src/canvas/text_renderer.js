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
var DisplayObjectRenderer = require('canvas/display_object_renderer').DisplayObjectRenderer

var updateFlags = DisplayObjectRenderer.updateFlags

var TextRenderer = function(context) {
    DisplayObjectRenderer.call(this)
    this.context = context
}

ext.inherits(TextRenderer, DisplayObjectRenderer)

ext.add(TextRenderer.prototype, {
    
    setText: function(text) {
        this.text = text
        this.def = this.context.dict[text.def.getCharacterId()]
        this.el = null
    },

    draw: function() {
        if (!this.el) {
            this.buildEl()
        }
        var flags = this.updateFlags
        var style = this.el.element.style
        if (flags | updateFlags.UPDATE_MATRIX) {
            style.webkitTransform = this.text.getMatrix().toCss()
            if (this.clipper) {
                this.clipper.updateTransform()
            }
        }
        if (flags | updateFlags.UPDATE_COLOR_TRANSFORM) {
            var xform = this.text.getColorTransform()
            if (xform.isIdentity()) {
                xform = this.text.parent.getColorTransform()
            }
            if (!xform.isIdentity()) {
                if (xform.isOpacity()) {
                    if (xform.aa == 1) {
                        delete style.opacity
                    }
                    else {
                        style.opacity = xform.aa
                    }
                }
                else if (xform.isSingleColor()) {
                    var filter = new ColorTransformFilter()
                    filter.filterSingleColor(this.canvas, xform)
                }
                else {
                    var filter = new ColorTransformFilter()
                    filter.filterTransform(this.canvas, xform)
                }
            }
        }
        if (flags | updateFlags.UPDATE_DEPTH) {
            style.zIndex = this.text.getDepth()// + 16384
        }
        if (flags & updateFlags.UPDATE_VISIBILITY) {
            style.visibility = this.text.getVisible() ? 'inherit' : 'hidden'
        }
        if (flags & updateFlags.UPDATE_ALPHA) {
            var alpha = this.text.getAlpha() / 100
            if (alpha == 1) {
                delete style.opacity
            }
            else {
                style.opacity = alpha
            }
        }
        this.handleUpdateClipDepth(this.text)
        this.updateFlags = updateFlags.UPDATE_NONE
    },

    buildEl: function() {
        this.el = this.def.el.clone(true)
        this.canvas = new Element(this.el.element.firstChild.firstChild.firstChild)
        this.canvas.element.getContext('2d').drawImage(this.def.text.element, 0, 0)
        this.updateFlags = updateFlags.UPDATE_ALL
        var style = this.el.element.style
        if (env.accelerate && !this.text.isInClippingTree()) {
            style.webkitTransformStyle = 'preserve-3d'
        }
    }
})

exports.TextRenderer = TextRenderer

})
