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

var ColorTransform = function() {
    this.hasA = false
    this.hasB = false
}

ext.add(ColorTransform, {

    fromDef : function(def) {
        if (def) {
            var xform = new ColorTransform()
            xform.hasA = def.HasMultTerms
            if (def.HasMultTerms) {
                xform.ra = def.RedMultTerm
                xform.ga = def.GreenMultTerm
                xform.ba = def.BlueMultTerm
                xform.aa = def.AlphaMultTerm
            }
            xform.hasB = def.HasAddTerms
            if (def.HasAddTerms) {
                xform.rb = def.RedAddTerm
                xform.gb = def.GreenAddTerm
                xform.bb = def.BlueAddTerm
                xform.ab = def.AlphaAddTerm
            }
            return xform
        }
        else {
            return new ColorTransform()
        }
    }
})

ext.add(ColorTransform.prototype, {

    isExistingAll : function() {
        return this.hasA && (this.ra == this.ga == this.ba == this.aa == 1)
    },

    isExistingNone : function() {
        return this.hasA && (this.ra == this.ga == this.ba == this.aa == 0)
    },

    isExistingAlpha : function() {
        return this.hasA && (this.ra == this.ga == this.ba == 0) && (this.aa == 1)
    },

    isAdd : function() {
        return this.hasB && (this.rb || this.gb || this.ba || this.aa)
    },

    isIdentity : function() {
        return !(this.hasA || this.hasB) || (this.isExistingAll() && !this.isAdd())
    },

    isOpacity : function() {
        return this.hasA && (this.ra == this.ga == this.ba == 1) && !this.isAdd()
    },
    
    isSingleColor : function() {
        return this.isExistingAlpha() && this.isAdd()
    },

    isMult : function() {
        return this.hasA && !this.isAdd()
    },
    
    isComplex : function() {
        return this.hasA && this.hasB
    }
})

exports.ColorTransform = ColorTransform

})
