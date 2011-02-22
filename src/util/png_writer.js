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

var PngWriter = function() {
}

ext.add(PngWriter.prototype, {
    
    buildPng : function(buffer, start, count, width, height, type, plte, trns) {
        var d = ['\x89PNG\r\n\x1a\n']
        this.addChunk(d, 'IHDR', [this.uLong(width - 1), this.uLong(height), '\x08', String.fromCharCode(type), '\x00\x00\x00'].join(''))
        if (plte) {
            this.addChunk(d, 'PLTE', plte)
        }
        if (trns) {
            this.addChunk(d, 'tRNS', trns)
        }
        this.addChunk(d, 'IDAT', buffer.substr(start, count))
        this.addChunk(d, 'IEND', '')
        var url =  'data:image/png;base64,' + btoa(d.join(''))
        return url
    },
    
    addChunk : function (arr, type, data) {
        var body = type + data
        arr.push(this.uLong(data.length), body, this.uLong(this.ieeeCrc(body)))
    },
    
    uLong : function (n) {
        return String.fromCharCode(
            (n >> 24) & 0xff, 
            (n >> 16) & 0xff, 
            (n >> 8) & 0xff, 
            n & 0xff
        )
    },
    
    ieeeCrc : function(data) {
        var tab = PngWriter.IeeeCrcTable
        var crc = -1
        for (var i = 0, l = data.length; i < l; i++) {
            crc = tab[(crc ^ data.charCodeAt(i)) & 0xff] ^ (crc >>> 8)
        }
        return crc ^ -1
    }
})

ext.add(PngWriter, {

    WhitePalette : new Array(256 + 1).join('\x00\x00\x00'),

    IeeeCrcTable : function() {
        var poly = 0xedb88320
        var t = []
        var crc
        for (var i = 0; i < 256; i++) {
            crc = i
            for (var j = 0; j < 8; j++) {
                if (crc & 1) {
                    crc = (crc >>> 1) ^ poly
                }
                else {
                    crc >>>= 1
                }
            }
            t[i] = crc
        }
        return t
    }(),

    LinearTransparency : function() {
        var trns = []
        for (var i = 0; i < 256; i++) {
            trns.push(String.fromCharCode(i * i / 255))
        }
        return trns.join('')
    }()

})

exports.PngWriter = PngWriter

})
