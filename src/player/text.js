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
var as2_TextField = require('as2/text_field').TextField

var Text = function(def, loader, parent, renderer) {
    this.def = def
    this.loader = loader
    this.parent = parent
    this.renderer = renderer
    DisplayObject.call(this)
    this.renderer.setText(this)
    this.spans = this.def.spans.slice(0)
}

ext.inherits(Text, DisplayObject)

ext.add(Text.prototype, {

    rawText : function() {
        var text = []
        for (var i = 0; i < this.spans.length; i++) {
            text.push(this.spans[i].text)
        }
        return text.join("\n")
    },
    
    as2Object : function() {
        if (!this._as2Object) {
            var o = this._as2Object = new as2_TextField()
            o.__dispObj = this
        }
        return this._as2Object
    }
})

exports.Text = Text

})
