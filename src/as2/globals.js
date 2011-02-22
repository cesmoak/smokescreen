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
var as2_Object = require('as2/object').Object
var as2_MovieClip = require('as2/movie_clip').MovieClip
var as2_TextField = require('as2/text_field').TextField
//var as2_Color = require('as2/color').Color
var as2_Mouse = require('as2/mouse').Mouse

var Globals = function() {
}

ext.add(Globals.prototype, {
    'clearInterval' : clearInterval,
    'Object' : as2_Object,
    'Array' : Array,
    'Boolean' : Boolean,
    'String' : String,
    'Number' : Number,
    'Math' : Math,
    'MovieClip' : as2_MovieClip,
    'TextField' : as2_TextField,
//    'Color' : as2_Color,
    'Mouse' : as2_Mouse,
    'isNaN' : isNaN,
    'updateAfterEvent' : function() {} // TODO
})

ext.add(Globals.prototype, {

    ASSetPropFlags : function(obj, props, n, allowFalse) {
        // TODO: respect allowFalse
        if (props === null) {
            props = []
            for (var name in obj) {
                if (name.substr(0, 2) != '__') {
                    props.push(name)
                }
            }
        }
        else {
            if (typeof props == 'string') {
                props = props.split(',')
            }
        }
        if (!obj.__propFlags) {
            obj.__propFlags = {}
        }
        var flags = obj.__propFlags
        for (var i in props) {
            flags[props[i]] = n
        }
    },

    setTimeout : function() {
        if (typeof arguments[1] == 'string') {
            var obj = arguments[0]
            var method = arguments[1]
            var args = [ext.bind(obj[method], obj)]
            for (var i = 2; i < arguments.length; i++) {
                args.push(arguments[i])
            }
        }
        else {
            var args = arguments
        }
        return setTimeout.apply(null, args)
    },

    setInterval : function() {
        if (typeof arguments[1] == 'string') {
            var obj = arguments[0]
            var method = arguments[1]
            var args = [ext.bind(obj[method], obj)]
            for (var i = 2; i < arguments.length; i++) {
                args.push(arguments[i])
            }
        }
        else {
            var args = arguments
        }
        return setInterval.apply(null, args)
    }

})

exports.Globals = Globals

})
