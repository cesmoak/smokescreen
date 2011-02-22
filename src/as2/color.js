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
var as2_Object = require('as2/object').Object
var ColorTransformFilter = require('canvas/color_transform_filter').ColorTransformFilter

var Color = function(obj) {
    as2_Object.call(this)
    this.__obj = obj
}

ext.inherits(Color, as2_Object)

ext.add(Color.prototype, {
    
    getRGB : function() {
        return this.__obj.__dispObj.rgb
    },
    
    getTransform : function() {
        return this.__obj.__dispObj.colorTransform
    },
    
    setRGB : function(rgb) {
        var disp = this.__obj.__dispObj
        disp.rgb = rgb
        disp.colorTransform = null
        var filter = new ColorTransformFilter()
        if (disp.canvas) {
            filter.filterRgb(disp.canvas, rgb)
        }
    },

    setTransform : function(xform) {
        var disp = this.__obj.__dispObj
        disp.colorTransform = xform
        disp.rgb = null
        var filter = new ColorTransformFilter()
        if (disp.canvas) {
            filter.filterTransform(disp.canvas, xform)
        }
    }

})

exports.Color = Color

})
