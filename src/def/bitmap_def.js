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

var BitmapDef = function(tag) {
    this.tag = tag
    this.img = tag.canvas || tag.image
}

ext.add(BitmapDef.prototype, {
    
    getCharacterId: function() {
        return this.tag.CharacterId
    }
})

exports.BitmapDef = BitmapDef

})
