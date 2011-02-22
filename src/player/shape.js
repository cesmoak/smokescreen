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
var DisplayObject = require('player/display_object').DisplayObject

var Shape = function(def, loader, parent, renderer) {
    this.def = def
    this.loader = loader
    this.parent = parent
    this.renderer = renderer
    DisplayObject.call(this)
    this.renderer.setShape(this)
}

ext.inherits(Shape, DisplayObject)

ext.add(Shape.prototype, {

})

exports.Shape = Shape

})
