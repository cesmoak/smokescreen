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
var DisplayObjectRenderer = require('canvas/display_object_renderer').DisplayObjectRenderer

var updateFlags = DisplayObjectRenderer.updateFlags

var MovieClipRenderer = function(context) {
    DisplayObjectRenderer.call(this)
    this.context = context
    this.clippers = []
    this.toRemove = []
    this.toAdd = []
}

ext.inherits(MovieClipRenderer, DisplayObjectRenderer)

ext.add(MovieClipRenderer.prototype, {
    
    setMovieClip: function(mc) {
        this.mc = mc
        if (mc.getParent() == mc) {
            this.parent = mc.renderer.context
        }
        else {
            this.parent = mc.getParent().renderer
        }
        this.el = null
    },

    addChild: function(child) {
        this.toAdd.push(child)
    },

    removeChild: function(child) {
        this.toRemove.push(child)
    },

    draw: function() {
        var flags = this.updateFlags
        if (!this.el) {
            this.buildElement()
            flags = updateFlags.UPDATE_ALL
        }
        var hasChanges = (flags != updateFlags.UPDATE_NONE)
        // TODO: respect if (!tag.ClipDepth) {
        var style = this.el.element.style
        if (flags & updateFlags.UPDATE_MATRIX) {
            var matrix = this.mc.getMatrix()
            style.webkitTransform = matrix.toCss()
            if (this.clipper) {
                this.clipper.updateTransform()
            }
        }
        // we only respect alpha
        if (flags & updateFlags.UPDATE_ALPHA || flags & updateFlags.UPDATE_COLOR_TRANSFORM) {
            var alpha = this.mc.getAlpha() / 100
            if (alpha == 1) {
                delete style.opacity
            }
            else {
                style.opacity = alpha
            }
        }
        if (flags & updateFlags.UPDATE_DEPTH) {
            style.zIndex = this.mc.getDepth()// + 16384
            if (this.parent.hasClippers()) {
                this.parent.removeChild(this.mc)
                this.parent.addChild(this.mc)
            }
        }
        if (flags & updateFlags.UPDATE_VISIBILITY) {
            style.visibility = this.mc.getVisible() ? 'inherit' : 'hidden'
        }
        this.handleUpdateClipDepth(this.mc)
        var children = this.mc.displayList.getDisplayObjects()
        var childUpdates = false
        var depths = []
        for (var depth in children) {
            if (children.hasOwnProperty(depth)) {
                depths.push(depth)
            }
        }
        depths.sort(function(a, b) { return a - b })
        for (var i = 0; i < depths.length; i++) {
            var child = children[depths[i]]
            childUpdates |= child.renderer.draw()
        }
        hasChanges |= childUpdates
        hasChanges |= (this.toAdd.length > 0)
        for (var i = 0; i < this.toAdd.length; i++) {
            var child = this.toAdd[i]
            var containerEl = this.getContainerElForChild(child)
            containerEl.append(child.renderer.getOuterEl())
            if (child.getClipDepth() > 0) {
                this.clippers.push(child)
            }
        }
        hasChanges |= (this.toRemove.length > 0)
        for (var i = 0; i < this.toRemove.length; i++) {
            var child = this.toRemove[i]
            child.renderer.getOuterEl().removeSelf()
            if (child.getClipDepth() > 0) {
                child.renderer.clipper.remove()
                this.clippers.splice(this.clippers.indexOf(child), 1)
            }
        }
        // if we are a clipper and our children updated, we should redraw
        if ((hasChanges || childUpdates) && this.clipper) {
            this.clipper.redraw()
        }
        this.updateFlags = updateFlags.UPDATE_NONE
        this.toAdd = []
        this.toRemove = []
        return (hasChanges || childUpdates)
    },

    hasClippers: function() {
        return (this.clippers.length > 0)
    },

    getContainerElForChild: function(child) {
        var depth = child.getDepth()
        var clipper
        for (var i = 0; i < this.clippers.length; i++) {
            var c = this.clippers[i]
            if (c.getDepth() < depth && c.getClipDepth() >= depth) {
                if (clipper) {
                    if (c.getDepth() > clipper.getDepth()) {
                        clipper = c
                    }
                }
                else {
                    clipper = c
                }
            }
        }
        if (clipper) {
            child.setClipper(clipper)
            return clipper.renderer.clipper.containerEl
        }
        else {
            child.setClipper(null)
            return this.containerEl
        }
    },

    buildElement: function() {
        if (this.mc.def.isRoot()) {
            var el = this.el = this.containerEl = new Element()
            el.create('div')
            var size = this.mc.def.tag.FrameSize
            var bbox = [
                size.Xmin,
                size.Ymin,
                size.Xmax - size.Xmin,
                size.Ymax - size.Ymin
            ]
            var style = el.element.style
            style.position = 'absolute'
            style.width = bbox[2] + 'px'
            style.height = bbox[3] + 'px'
        }
        else {
            var abs = new Element()
            abs.create('div')
            abs.element.setAttribute('class', 'sprite-abs')
            this.el = abs
            this.containerEl = abs
        }
        var style = this.el.element.style
        if (env.accelerate && !this.mc.isInClippingTree()) {
            style.webkitTransformStyle = 'preserve-3d'
        }
    }
})

exports.MovieClipRenderer = MovieClipRenderer

})
