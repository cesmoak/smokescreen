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

var CssView = function() {
    var head = document.getElementsByTagName('head')[0]
    var s = this.styles = document.createElement('style')
    s.setAttribute('rel', 'stylesheet')
    s.setAttribute('type', 'text/css')
    head.appendChild(s)
    s.appendChild(document.createTextNode('.sprite-abs { position: absolute; left: 0; top: 0; }'))
    this.changes = []
}

ext.add(CssView.prototype, {
    
    addCssRule : function(def) {
        this.changes.push(def)
    },
    
    update : function() {
        this.styles.appendChild(document.createTextNode(this.changes.join(' ')))
        this.changes = []
    }
    
})

exports.CssView = CssView

})
