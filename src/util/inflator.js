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
var PngWriter = require('util/png_writer').PngWriter

var Inflator = function() {
}

ext.add(Inflator.prototype, {
    
    inflate : function(buffer, size) {
        var writer = new PngWriter()
        var png = writer.buildPng(buffer, 0, buffer.length, size, 1, 0)
    }
})

exports.Inflator = Inflator

})
