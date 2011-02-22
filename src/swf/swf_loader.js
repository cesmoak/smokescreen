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
var agent = require('lib/agent').agent
var base64 = require('lib/base64').base64
var LittleEndianStringReader = require('util/little_endian_string_reader').LittleEndianStringReader
var SwfReader = require('swf/swf_reader').SwfReader

var SwfLoader = function() {}

ext.add(SwfLoader.prototype, {

    load : function(url, callback) {
        this.complete = false
        try {
            this.xmlHttp = new XMLHttpRequest()
            if (this.xmlHttp.overrideMimeType) {
                this.xmlHttp.overrideMimeType('text/plain; charset=x-user-defined')
            }
            this.xmlHttp.open('GET', url, true)
            this.xmlHttp.onreadystatechange = ext.bind(this.onLoad, this, callback)
            this.xmlHttp.send(null)
        }
        catch (e) {
            return false
        }
        return true
    },

    onLoad : function(callback, evt) {
        if (this.xmlHttp.readyState != 4 || this.complete) {
            return
        }
        this.complete = true
        var data
        data = this.xmlHttp.responseText
        var stream = new LittleEndianStringReader(data)
        var swf = new SwfReader(stream)
        callback(swf)
    }
})

exports.SwfLoader = SwfLoader

})
