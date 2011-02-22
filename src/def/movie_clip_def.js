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
var MovieClip = require('player/movie_clip').MovieClip

var MovieClipDef = function(timeline) {
    this.timeline = timeline
    this.tag = timeline.tag
}

ext.add(MovieClipDef.prototype, {

    getCharacterId: function() {
        return this.tag.CharacterId || this.tag.ButtonId
    },

    isRoot: function() {
        return !this.getCharacterId()
    },

    instantiate: function(place, loader, parent) {
        var renderer = loader.renderer.createMovieClipRenderer()
        var mc = new MovieClip(this, loader, parent, renderer)
        mc.place(place)
        return mc
    }
})

exports.MovieClipDef = MovieClipDef

})
