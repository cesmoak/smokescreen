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

var LittleEndianStringReader = function(buffer) {
    this.buffer = String(buffer)
    this._byte = 0
    this.byteIndex = 0
    this.bitIndex = 0
    this.byteIndexForBits = -1
    this.logger = ext.console('parse')
}

ext.add(LittleEndianStringReader.prototype, {
    
    length : function() {
        return this.buffer.length
    },
    
    hasMore : function() {
        return this.byteIndex < this.buffer.length
    },
    
    seek : function(byteIndex) {
        this._byte = 0
        this.byteIndex = byteIndex
        this.bitIndex = 0
        this.byteIndexForBits = -1
    },
    
    skipBytes : function(count) {
        this.byteIndex += count
    },
    
    bytes : function(count) {
        var bytes = []
        for (var i = 0; i < count; i++) {
            bytes.push(String.fromCharCode(this.buffer.charCodeAt(this.byteIndex++) & 0xff))
        }
        return bytes
    },

    align : function() {
        this.bitIndex = 8
    },

    uByteAt : function(pos) {
        return this.buffer.charCodeAt(pos) & 0xff
    },
    
    uByte : function() {
        return this.buffer.charCodeAt(this.byteIndex++) & 0xff
    },

    sByte : function() {
        var _byte = this.buffer.charCodeAt(this.byteIndex++) & 0xff
        if (_byte >= 0x80) {
            _byte -= 0x100
        }
        return _byte
    },
    
    uShort : function() {
        var _short = 
            (this.buffer.charCodeAt(this.byteIndex++) & 0xff) +
            ((this.buffer.charCodeAt(this.byteIndex++) & 0xff) << 8)
        if (_short < 0) {
            _short += 0x10000
        }
        return _short
    },

    sShort : function() {
        var _short = this.uShort()
        if (_short > 0x7fff) {
            _short -= 0x10000
        }
        return _short
    },
    
    nextULong : function() {
        var byte1 = (this.buffer.charCodeAt(this.byteIndex++) & 0xff)
        var byte2 = (this.buffer.charCodeAt(this.byteIndex++) & 0xff)
        var byte3 = (this.buffer.charCodeAt(this.byteIndex++) & 0xff)
        var byte4 = (this.buffer.charCodeAt(this.byteIndex++) & 0xff)
        var _long = byte1 + (byte2 << 8) + (byte3 << 16) + (byte4 << 24)
        if (_long < 0) {
            _long += 0x100000000
        }
        return _long
    },

    nextSLong : function() {
        var _long = this.nextULong()
        if (_long > 0x7FFFFFFF) {
            _long -= 0x100000000
        }
        return _long
    },

    nextEncodedULong : function() {
        var result = this.buffer.charCodeAt(this.byteIndex++) & 0xff
        if (!(result & 0x00000080)) {
            return result
        }
        result = (result & 0x0000007f) | (this.buffer.charCodeAt(this.byteIndex++) & 0xff) << 7
        if (!(result & 0x00004000)) {
            return result
        }
        result = (result & 0x00003fff) | (this.buffer.charCodeAt(this.byteIndex++) & 0xff) << 14
        if (!(result & 0x00200000)) {
            return result
        }
        result = (result & 0x001fffff) | (this.buffer.charCodeAt(this.byteIndex++) & 0xff) << 21
        if (!(result & 0x10000000)) {
            return result
        }
        result = (result & 0x0fffffff) | (this.buffer.charCodeAt(this.byteIndex++) & 0xff) << 28
        return result
    },
    
    nextString : function() {
        var chars = []
        var _char
        while (_char = this.uByte()) {
            chars.push(String.fromCharCode(_char))
        }
        return chars.join('')
    },

    _nextByteForBits : function() {
        this._byte = this.uByte()
        this.bitIndex = 0
        this.byteIndexForBits = this.byteIndex        
    },
    
    nextUBits : function(bits) {
        if (this.byteIndex != this.byteIndexForBits) {
            this._nextByteForBits()
        }
        var val = 0
        for (var i = 0; i < bits; i++) {
            if (this.bitIndex == 8) {
                this._nextByteForBits()
            }
            val = (val << 1) + ((this._byte >> (7 - this.bitIndex)) & 1)
            this.bitIndex += 1
        }
        return val
    },
    
    nextSBits : function(bits, logger) {
        var val = this.nextUBits(bits, logger)
        if (val >> (bits - 1)) {
            val -= Math.pow(2, bits)
        }
        return val
    },
    
    nextFShort : function() {
        return this.sShort() * Math.pow(2, -8)
    },
    
    nextFLong : function() {
        return this.nextSLong() * Math.pow(2, -16)
    },
    
    nextFBits : function(bits) {
        return this.nextSBits(bits) * Math.pow(2, -16)
    },
    
    nextHalfFloat : function() {
        return this._nextFloatingPoint(10, 5)
    },
    
    nextSingleFloat : function() {
        return this._nextFloatingPoint(23, 8)
    },
    
    nextDoubleFloat : function() {
        return this._nextFloatingPoint(52, 11)
    },
    
    _nextFloatingPoint: function(precisionBits, exponentBits) {
        this.align()
		var length = precisionBits + exponentBits + 1
		var size = length >> 3
		var bias = Math.pow(2, exponentBits - 1) - 1
		var signal = this._readBits(precisionBits + exponentBits, 1, size)
		var exponent = this._readBits(precisionBits, exponentBits, size)
		var significand = 0
		var divisor = 2
		var curByte = size + (-precisionBits >> 3) - 1
		do {
			var byteValue = this._readByte(++curByte, size)
			var startBit = precisionBits % 8 || 8
			var mask = 1 << startBit
			while (mask >>= 1) {
				if (byteValue & mask) {
					significand += 1 / divisor
				}
				divisor *= 2
			}
		} while (precisionBits -= startBit)
		this.byteIndex += size
		return exponent == (bias << 1) + 1 ? 
		    significand ? NaN : signal ? -Infinity : +Infinity
			: (1 + signal * -2) * (exponent || significand ? 
			    !exponent ? 
			        Math.pow(2, -bias + 1) * significand
			        : Math.pow(2, exponent - bias) * (1 + significand) 
			    : 0
		)
	},
    
    _readBits: function (start, length, size) {
		var offsetLeft = (start + length) % 8
		var offsetRight = start % 8
		var curByte = size - (start >> 3) - 1
		var lastByte = size + (-(start + length) >> 3)
		var diff = curByte - lastByte
		var sum = (this._readByte(curByte, size) >> offsetRight) & ((1 << (diff ? 8 - offsetRight : length)) - 1)
		if (diff && offsetLeft) {
			sum += (this._readByte(lastByte++, size) & ((1 << offsetLeft) - 1)) << (diff-- << 3) - offsetRight
		}
		while (diff) {
			sum += this._shl(this._readByte(lastByte++, size), (diff-- << 3) - offsetRight)
		}
		return sum
	},
    	
	_readByte: function (i, size) {
        if (size == 8) {
            if (i < 4) {
                i = i + 4
            }
            else {
                i = i - 4
            }
        }
		return this.buffer.charCodeAt(this.byteIndex + size - i - 1) & 0xff
	},
        	
	_shl: function (a, b) {
		for (++b; --b; a = ((a %= 0x7fffffff + 1) & 0x40000000) == 0x40000000 ? a * 2 : (a - 0x40000000) * 2 + 0x7fffffff + 1)
		return a
	}
})

exports.LittleEndianStringReader = LittleEndianStringReader

})
