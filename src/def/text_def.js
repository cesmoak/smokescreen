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
var Text = require('player/text').Text

var TextDef = function(tag, fonts) {
    this.tag = tag
    this.fonts = fonts

    var b = tag.Bounds
    this.bbox =[
        b.Xmin,
        b.Ymin,
        b.Xmax - b.Xmin,
        b.Ymax - b.Ymin
    ]

    this.process()
}

ext.add(TextDef.prototype, {
    
    getCharacterId: function() {
        return this.tag.CharacterId
    },

    process: function() {
        var tag = this.tag
        var records = tag.TextRecords
        if (!(records && records.length)) {
            return
        }
        var font
        var spans = []
        var format
        var color, alpha
        var leading
        var indent = 0
        var size
        for (var i in records) {
            var record = records[i]
            if (record.FontId) {
                font = this.fonts.byId[record.FontId]
            }
            if (record.TextColor) {
                color = record.TextColor
                alpha = record.TextColor.Alpha / 0xff
            }
            if (record.YOffset != null) {
                leading = record.YOffset
                indent = 0
            }
            if (record.XOffset != null) {
                indent = record.XOffset
            }
            if (record.TextHeight != null) {
                size = record.TextHeight
            }
            format = {
                font: font,
                color: color,
                alpha: alpha,
                leading: leading,
                indent: indent,
                size: size
            }
            var chars = []
            var advances = []
            var glyphs = record.GlyphEntries
            if (glyphs) {
                for (var j in glyphs) {
                    var glyph = glyphs[j]
                    if (font) {
                        var charCode = font.tag.CodeTable[glyph.GlyphIndex]
                        chars.push(String.fromCharCode(charCode))
                    }
                    else {
                        chars.push(String.fromCharCode(glyph.GlyphIndex))
                    }
                    advances.push(glyph.GlyphAdvance)
                    indent += glyph.GlyphAdvance
                }
            }
            spans.push({
                text: chars.join(''),
                advances: advances,
                format: format
            })
        }
        this.spans = spans
    },

    instantiate : function(place, loader, parent) {
        var renderer = loader.renderer.createTextRenderer()
        var text = new Text(this, loader, parent, renderer)
        text.place(place)
        return text
    }
})

exports.TextDef = TextDef

})
