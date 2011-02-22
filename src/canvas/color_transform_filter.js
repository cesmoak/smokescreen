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

var ColorTransformFilter = function() {
}

ext.add(ColorTransformFilter.prototype, {
    
    filter : function(canvas, xform) {
        var ctx = canvas.element.getContext('2d')
        var w = canvas.element.width
        var h = canvas.element.height
        var img = ctx.getImageData(0, 0, w, h)
        var data = img.data
        var i = 0

        var rm = xform.hasA ? xform.ra : 1
        var gm = xform.hasA ? xform.ga : 1
        var bm = xform.hasA ? xform.ba : 1
        var am = xform.hasA ? xform.aa : 1
        var ra = xform.hasB ? xform.rb : 0
        var ga = xform.hasB ? xform.gb : 0
        var ba = xform.hasB ? xform.bb : 0
        var aa = xform.hasB ? xform.ab : 0

        while (i < w * h * 4) {
            data[i] = Math.max(Math.min(data[i] * rm + ra, 255), 0)
            data[i + 1] = Math.max(Math.min(data[i + 1] * gm + ga, 255), 0)
            data[i + 2] = Math.max(Math.min(data[i + 2] * bm + ba, 255), 0)
            // TODO: correct alpha calc
            i += 4
        }
        ctx.putImageData(img, 0, 0)
    },

    filterTransform : function(canvas, xform) {
        var ctx = canvas.element.getContext('2d')
        var w = canvas.element.width
        var h = canvas.element.height
        var img = ctx.getImageData(0, 0, w, h)
        var data = img.data
        var i = 0
        while (i < w * h * 4) {
            data[i] = Math.max(Math.min(data[i] * xform.ra + xform.rb, 255), 0)
            data[i + 1] = Math.max(Math.min(data[i + 1] * xform.ga + xform.gb, 255), 0)
            data[i + 2] = Math.max(Math.min(data[i + 2] * xform.ba + xform.bb, 255), 0)
            data[i + 3] = Math.max(Math.min(data[i + 3] * xform.aa + xform.ab, 255), 0)
            i += 4
        }
        ctx.putImageData(img, 0, 0)
    },

    filterRgb : function(canvas, rgb) {
        var r = (rgb >> 16) & 0xff
        var g = (rgb >> 8) & 0xff
        var b = rgb & 0xff
        var ctx = canvas.element.getContext('2d')
        var w = canvas.element.width
        var h = canvas.element.height
        var img = ctx.getImageData(0, 0, w, h)
        var data = img.data
        var i = 0
        while (i < w * h * 4) {
            if (data[i + 3]) {
                data[i] = r
                data[i + 1] = g
                data[i + 2] = b
            }
            i += 4
        }
        ctx.putImageData(img, 0, 0)
    },
    
    filterSingleColor : function(canvas, xform) {
        var ctx = canvas.element.getContext('2d')
        var w = canvas.element.width
        var h = canvas.element.height
        ctx.fillStyle = 'rgba(' + [xform.rb, xform.gb, xform.bb, 1] + ')'
        ctx.globalCompositeOperation = 'source-in'
        ctx.fillRect(0, 0, w, h)
    }
    
})

exports.ColorTransformFilter = ColorTransformFilter

})
