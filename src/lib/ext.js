/**
 * Smokescreen Player - A Flash player written in JavaScript
 * http://smokescreen.us/
 * 
 * Copyright 2011, Chris Smoak
 * Released under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Some parts originally from Google Closure.
 */
define(function(require, exports, module) {

var agent = require('lib/agent').agent
var env = require('lib/env')

exports.define = function(obj, properties) {
    var names = {};
    for (var i in properties) {
        var name = i.substr(4)
        if (names[name]) {
            continue
        }
        names[name] = true;
        var _getter = properties['get_' + name]
        var _setter = properties['set_' + name]
        if (agent.browser == 'Explorer') {
            Object.defineProperty(obj, name, {get: _getter, set: _setter})
        } 
        else {
            if (_getter) {
                obj.__defineGetter__(name, _getter)
            }
            if (_setter) {
                obj.__defineSetter__(name, _setter)
            }
        }
    }
}

exports.add = function(obj, methods) {
    for (var name in methods) {
        obj[name] = methods[name]
    }
}

exports.inherits = function(childCtor, parentCtor) {
    function tempCtor() {}
    tempCtor.prototype = parentCtor.prototype
    childCtor.superClass_ = parentCtor.prototype
    childCtor.prototype = new tempCtor()
    childCtor.prototype.constructor = childCtor
}

exports.bind = function(fn, selfObj, var_args) {
    var context = selfObj || this

    if (arguments.length > 2) {
        var boundArgs = Array.prototype.slice.call(arguments, 2)
        return function() {
            // Prepend the bound arguments to the current arguments.
            var newArgs = Array.prototype.slice.call(arguments)
            Array.prototype.unshift.apply(newArgs, boundArgs)
            return fn.apply(context, newArgs)
        }

    }
    else {
        return function() {
            return fn.apply(context, arguments)
        }
    }
}

exports.now = function() {
    return +new Date()
}

var DummyConsole = function() {}
exports.add(DummyConsole.prototype, {
    info : function() {}
})
var _dummyConsole = new DummyConsole()

exports.console = function(name) {
    if (true || env.debug) {
        return console
    }
    else {
        return _dummyConsole
    }
}

})
