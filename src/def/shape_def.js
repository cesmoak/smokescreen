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
var Shape = require('player/shape').Shape

var ShapeDef = function(tag) {
    this.tag = tag
    var bounds = tag.ShapeBounds
    this.bbox = [bounds.Xmin, bounds.Ymin, bounds.Xmax - bounds.Xmin, bounds.Ymax - bounds.Ymin]
}

ext.add(ShapeDef.prototype, {
    
    getCharacterId: function() {
        return this.tag.ShapeId
    },

    instantiate: function(place, loader, parent) {
        var renderer = loader.renderer.createShapeRenderer()
        var shape = new Shape(this, loader, parent, renderer)
        shape.place(place)
        return shape
    }
})

exports.ShapeDef = ShapeDef

})
