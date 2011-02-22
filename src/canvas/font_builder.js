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
var Element = require('dom/element').Element

var FontBuilder = function(context) {
    this.context = context
}

ext.add(FontBuilder.prototype, {

    build : function(def) {
        var tag = def.tag
        return {
            tag: tag,
            style: [tag.Name, !!tag.FontFlagsBold, !!tag.FontFlagsItalic].toString(),
            glyphs: this.buildGlyphPaths(tag)
        }
    },
    
    buildGlyphPaths : function(tag) {
        var paths = []
        var defs = tag.GlyphShapeTable
        for (var i = 0, l = defs.length; i < l; i++) {
            var path = this.buildGlyph(tag, defs[i])
            var code = tag.CodeTable[i]
            paths[code] = path
        }
        return paths
    },
    
    buildGlyph : function(tag, def) {
        var x1 = 0, 
            y1 = 0,
            cx = 0,
            cy = 0,
            x2 = 0,
            y2 = 0
        var edge
        var records = def.ShapeRecords
        var paths = []
        var subpath = []
        var unitMult = 1
        if (tag.header.TagType == 75/*fljs.swf.TagTypes.DefineFont3*/) {
            unitMult = 20
        }
        // loop through edge records:
        var count = records.length
        for (var i = 0; i < count; i++) {
            var record = records[i]
            switch (record.type) {
            case 'STRAIGHT':
                x2 = x1 + record.DeltaX
                y2 = y1 + record.DeltaY
                subpath.push({
                    x1 : x1 / unitMult,
                    y1 : y1 / unitMult,
                    x2 : x2 / unitMult,
                    y2 : y2 / unitMult
                })
                x1 = x2
                y1 = y2
                break
            case 'CURVED':
                cx = x1 + record.ControlDeltaX
                cy = y1 + record.ControlDeltaY
                x2 = cx + record.AnchorDeltaX
                y2 = cy + record.AnchorDeltaY
                subpath.push({
                    x1 : x1 / unitMult,
                    y1 : y1 / unitMult,
                    cx : cx / unitMult,
                    cy : cy / unitMult,
                    x2 : x2 / unitMult, 
                    y2 : y2 / unitMult
                })
                x1 = x2
                y1 = y2
                break
            case 'NONEDGE':
                if (record.StateMoveTo) {
                    if (subpath.length) {
                        paths.push(subpath)
                    }
                    x1 = record.MoveDeltaX
                    y1 = record.MoveDeltaY
                    subpath = []
                }
                break
            }
        }
        if (subpath.length) {
            paths.push(subpath)
        }
        return paths
    }
})

exports.FontBuilder = FontBuilder

})
