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

var BitVector = function(bits) {
    this.count = (bits + 7) >>> 3
    this.bits = new Array(this.count)
    for (var i = 0; i < this.count; i++) {
        this.bits[i] = 0
    }
}
ext.add(BitVector.prototype, {

    set : function(bit) {
        this.bits[bit >> 3] |= 1 << (bit % 8)
    },
    
    get : function(bit) {
        return !!(this.bits[bit >> 3] & (1 << (bit % 8)))
    },
    
    clear : function() {
        for (var i = 0; i < this.count; i++) {
            this.bits[i] = 0
        }
    },
    
    setAll : function() {
        for (var i = 0; i < this.count; i++) {
            this.bits[i] = 0xff
        }
    },
    
    or : function(v) {
        for (var i = 0; i < this.count; i++) {
            this.bits[i] |= v.bits[i]
        }
    },
    
    and : function(v) {
        for (var i = 0; i < this.count; i++) {
            this.bits[i] &= v.bits[i]
        }
    },
    
    cmp : function(v) {
        for (var i = 0; i < this.count; i++) {
            if (this.bits[i] != v.bits[i]) {
                return false
            }
        }
        return true
    }
})

exports.BitVector = BitVector

})
