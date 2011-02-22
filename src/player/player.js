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
var CssView = require('player/css_view').CssView
var Loader = require('player/loader').Loader
var VM = require('as2/vm').VM
var CanvasRenderer = require('canvas/canvas_renderer').CanvasRenderer

var Player = function() {
    this.view = new CssView(this)
    this.as2 = new VM(this)
    this.playing = false
    this.onLoadCallback = null
    this.onReadCallback = null
    this.onEnterFrameCallback = null
}

ext.add(Player.prototype, {
    
    setHints : function(hints) {
        if (!hints) {
            return
        }
        if ('masking' in hints) {
            if (!hints.masking) {
                env.accelerate = true
            }
        }
    },
    
    run : function(url, container, width, height, version, playerParams, flashVars) {
        this.container = container
        var renderer = new CanvasRenderer(container, width, height)
        var l = this.loader = new Loader(this, renderer)
        //l.readFinished.add(ext.bind(this.onRead))
        l.loadSwf(url, ext.bind(this.onRead, this), ext.bind(this.onLoad, this))
    },
    
    onLoad : function() {
        if (this.onLoadCallback) {
            this.onLoadCallback(this)
        }
        setTimeout(ext.bind(this.read, this), 10)
    },
    
    read : function() {
        if (this.loader.reading) {
            this.loader.readIter()
            setTimeout(ext.bind(this.read, this), 10)
        }
    },
    
    onRead : function() {
        if (this.onReadCallback) {
            this.onReadCallback(this)
        }
        this.playing = true
        this.playAt = ext.now()
        this.frameCount = 0
        this.onEnterFrame()
    },
    
    onEnterFrame : function(force) {
        if (this.onEnterFrameCallback) {
            this.onEnterFrameCallback()
        }
        if (this.playing || force) {
            this.loader.frameIter()
            this.frameCount += 1
            var actMs = 1000 * this.frameCount / this.loader.header.FrameRate
            var expMs = ext.now() - this.playAt
            var delay = Math.max(0, actMs - expMs)
            /*
            var delay = 1000 / this.loader.header.FrameRate
            */
            setTimeout(ext.bind(this.onEnterFrame, this), delay)
        }
    },

    pause: function() {
        this.playing = false
    },

    play: function() {
        if (!this.playing) {
            this.playing = true
            this.playAt = ext.now()
            this.frameCount = 0
            this.onEnterFrame()
        }
    }
})

exports.Player = Player

})
