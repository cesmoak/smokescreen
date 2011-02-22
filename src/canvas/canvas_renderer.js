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
var ShapeBuilder = require('canvas/shape_builder').ShapeBuilder
var FontBuilder = require('canvas/font_builder').FontBuilder
var TextDefBuilder = require('canvas/text_def_builder').TextDefBuilder
var ShapeRenderer = require('canvas/shape_renderer').ShapeRenderer
var MovieClipRenderer = require('canvas/movie_clip_renderer').MovieClipRenderer
var TextRenderer = require('canvas/text_renderer').TextRenderer
var Element = require('dom/element').Element

var CanvasRenderer = function(container, width, height) {
    this.container = new Element(container)
    if (width) {
        container.width = width + 'px'
    }
    if (height) {
        container.height = height + 'px'
    }
    this.dict = {}
    this.fonts = {
        byId: {},
        byName: {},
        byStyle: {}
    }
}

ext.add(CanvasRenderer.prototype, {

    setRoot: function(root) {
        this.root = root
        this.newRoot = true
    },

    defineShape: function(def) {
        var builder = new ShapeBuilder(this)
        builder.build(def)
        this.dict[def.getCharacterId()] = builder
    },

    defineFont: function(def) {
        var builder = new FontBuilder(this)
        var def = builder.build(def)
        var tag = def.tag
        var f = this.fonts
        f.byId[tag.FontId] = f.byName[tag.FontName] = f.byStyle[def.style] = def
    },

    defineText: function(def) {
        var builder = new TextDefBuilder(this.fonts)
        builder.build(def)
        this.dict[def.getCharacterId()] = builder
    },

    defineBitmap: function(def) {
        this.dict[def.getCharacterId()] = def
    },

    createShapeRenderer: function() {
        return new ShapeRenderer(this)
    },

    createMovieClipRenderer: function() {
        return new MovieClipRenderer(this)
    },

    createTextRenderer: function() {
        return new TextRenderer(this)
    },

    draw: function() {
        if (this.root) {
            this.root.renderer.draw()
        }
        if (this.newRoot) {
            // TODO: handle FrameSize min values != 0
            var rootEl = this.root.renderer.containerEl
            rootEl.element.style.overflow = 'hidden'
            this.container.append(rootEl)
            var style = this.container.element.style
            style.width = rootEl.width
            style.height = rootEl.height
            this.newRoot = false
        }
    },

    hasClippers: function() {
        return false
    }
})

exports.CanvasRenderer = CanvasRenderer

})
