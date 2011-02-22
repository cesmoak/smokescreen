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
var Namespace = require('dom/namespace').Namespace

var Element = function(el) {
    this.element = el
    this.changes = []
}

ext.add(Element.prototype, {

    create : function(ns, type) {
        if (arguments.length == 1) {
            type = ns
            this.element = document.createElement(type)
        }
        else {
            this.element = document.createElementNS(ns, type)
        }
        this.changes = []
    },

    set : function(ns, name, val) {
        if (arguments.length == 2) {
            val = name
            name = ns
            this.changes.push([name, val])
        }
        else {
            this.changes.push([ns, name, val])
        }
        this.update()
    },

    sets : function(changes) {
        this.changes.push.apply(this.changes, changes)
        this.update()
    },

    update : function() {
        var el = this.element
        var changes = this.changes
        for (var i = 0; i < changes.length; i++) {
            var change = changes[i]
            if (change.length == 2) {
                el.setAttribute(change[0], change[1])
            }
            else {
                el.setAttributeNS(change[0], change[1], change[2])
            }
        }
        this.changes = []
    },
    
    insertFirst : function(el) {
        var first = this.element.firstChild
        if (first) {
            this.element.insertBefore(el.element, first)
        }
        else {
            this.append(el)
        }
    },
    
    append : function(el) {
        this.element.appendChild(el.element)
    },
    
    appendText : function(text) {
        this.element.appendChild(document.createTextNode(text))
    },
    
    clone : function(deep) {
        var el = new Element()
        el.element = this.element.cloneNode(deep)
        el.changes = []
        return el
    },
    
    remove : function(el) {
        this.element.removeChild(el.element)
    },
    
    removeSelf : function() {
        if (this.element.parentElement) {
            this.element.parentElement.removeChild(this.element)
        }
    },
    
    getElement : function() {
        return this.element
    }
})

exports.Element = Element

})
