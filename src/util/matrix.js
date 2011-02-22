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

var Matrix = function(m) {
    this.m = m ? m : [1, 0, 0, 1, 0, 0]
}

ext.add(Matrix, {

    fromDef : function(def) {
        if (def) {
            return new Matrix([
                def.ScaleX != null ? def.ScaleX : 1,
                def.RotateSkew0 != null ? def.RotateSkew0 : 0,
                def.RotateSkew1 != null ? def.RotateSkew1 : 0,
                def.ScaleY != null ? def.ScaleY : 1,
                def.TranslateX != null ? def.TranslateX : 0,
                def.TranslateY != null ? def.TranslateY : 0
            ])
        }
        else {
            return new Matrix()
        }
    }

})

ext.add(Matrix.prototype, {

    toCss : function() {
        var _m = this.m
        var m = new WebKitCSSMatrix()
        m.a = _m[0]
        m.b = _m[1]
        m.c = _m[2]
        m.d = _m[3]
        m.e = _m[4]
        m.f = _m[5]
        return m
    },

    toString : function() {
        return 'matrix(' + this.m + ')'
    }
})

exports.Matrix = Matrix

})
