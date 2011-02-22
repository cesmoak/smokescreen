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

var BigEndianStringReader = function(buffer) {
    this.buffer = buffer
    this._byte = 0
    this.byteIndex = 0
    this.bitIndex = 0
    this.byteIndexForBits = -1
    this.logger = ext.console('parse')
}

ext.add(BigEndianStringReader.prototype, {
    
    length : function() {
        return this.buffer.length
    },
    
    hasMore : function() {
        return this.byteIndex < this.buffer.length
    },
    
    skipBytes : function(count) {
        this.byteIndex += count
    },
    
    readBytes : function(count) {
        var bytes = []
        for (var i = 0; i < count; i++) {
            bytes.push(this.buffer.charCodeAt(this.byteIndex++) & 0xff)
        }
        return bytes
    },
    
    align : function() {
        this.bitIndex = 8
    },
    
    uByte : function() {
        return this.buffer.charCodeAt(this.byteIndex++) & 0xff
    },

    nextSByte : function() {
        var _byte = this.buffer.charCodeAt(this.byteIndex++) & 0xff
        if (_byte >= 0x80) {
            _byte -= 0x100
        }
        return _byte
    },
    
    uShort : function() {
        var _short = 
            ((this.buffer.charCodeAt(this.byteIndex++) & 0xff) << 8) +
            (this.buffer.charCodeAt(this.byteIndex++) & 0xff)
        if (_short < 0) {
            _short += 0x10000
        }
        return _short
    }
});

exports.BigEndianStringReader = BigEndianStringReader

})

