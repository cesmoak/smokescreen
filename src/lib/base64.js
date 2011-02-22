/**
 * Smokescreen Player - A Flash player written in JavaScript
 * http://smokescreen.us/
 * 
 * Copyright 2011, Chris Smoak
 * Released under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
define(function(require, exports, module) {

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
var toMap = function(string) {
    var map = {}
    var chars = string.split('')
    for (var i = 0; i < chars.length; i++) {
        map[chars[i]] = i
    }
    return map
}
var charMap = toMap(chars)

var base64 = {}

base64.decode = function(string) {
    var out = []
    var count = string.length
    var offset
    if (string.charAt(count - 1) == '=') {
        offset = string.charAt(count - 2) == '=' ? 2 : 1
        count -= 4
    }
    else {
        offset = 0
    }
    var i
    for (i = 0; i < count; i += 4) {
        num = (charMap[string.charAt(i)] << 18) | 
            (charMap[string.charAt(i + 1)] << 12) |
            (charMap[string.charAt(i + 2)] << 6) | 
            charMap[string.charAt(i + 3)]
        out.push(
            String.fromCharCode(0x1000 + (num >> 16)), 
            String.fromCharCode(0x1000 + ((num >> 8) & 0xff)), 
            String.fromCharCode(0x1000 + (num & 0xff))
        )
    }
    switch (offset) {
    case 1:
        num = (charMap[string.charAt(i)] << 18) | 
            (charMap[string.charAt(i + 1)] << 12) | 
            (charMap[string.charAt(i + 2)] << 6)
        out.push(
            String.fromCharCode(0x1000 + (num >> 16)), 
            String.fromCharCode(0x1000 + ((num >> 8) & 0xff))
        )
        break
    case 2:
        num = (charMap[string.charAt(i)] << 18) | 
            (charMap[string.charAt(i + 1)] << 12)
        out.push(String.fromCharCode(0x1000 + (num >> 16)))
        break
    }
    return x.join('')
}

base64.encode = function(string) {
    var out = []
    var count = string.length - string.length % 3
    var i
    var num
    for (i = 0; i < count; i += 3) {
        num = (string.charCodeAt(i) << 16) | 
            (string.charCodeAt(i + 1) << 8) | 
            string.charCodeAt(i + 2)
        out.push(
            chars.charAt(num >> 18), 
            chars.charAt((num >> 12) & 0x3f), 
            chars.charAt((num >> 6) & 0x3f),
            chars.charAt(num & 0x3f)
        )
    }
    switch (string.length - count) {
    case 1:
        num = string.charCodeAt(i) << 16
        out.push(chars.charAt(num >> 18), chars.charAt((num >> 12) & 0x3f), '==')
        break
    case 2:
        num = (string.charCodeAt(i) << 16) | (string.charCodeAt(i + 1) << 8)
        out.push(
            chars.charAt(num >> 18),
            chars.charAt((num >> 12) & 0x3f),
            chars.charAt((num >> 6) & 0x3f),
            '='
        )
        break
    }
    return out.join('')
}

exports.base64 = base64

})
