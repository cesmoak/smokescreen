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
var env = require('lib/env')
var Matrix = require('util/matrix').Matrix
var Element = require('dom/element').Element

var TextDefBuilder = function(fonts) {
    this.fonts = fonts
}

ext.add(TextDefBuilder.prototype, {
    
    build: function(def) {
        var tag = this.tag = def.tag
        var spans = def.spans
        var bbox = this.calcBbox()

        var outer = new Element()
        outer.create('div')
        var style = outer.element.style
        style.position = 'absolute'
        style.left = style.top = 0
        
        var offset = new Element()
        offset.create('div')
        var style = offset.element.style
        style.position = 'absolute'
        style.left = style.top = 0
        style.webkitTransform = 'matrix(1,0,0,1,' + bbox[0] + ',' + bbox[1] + ')'
        style.webkitTransformOrigin = [-bbox[0] + 'px', bbox[1] + 'px'].join(' ')

        var textOffset = new Element()
        textOffset.create('div')
        var style = textOffset.element.style
        style.position = 'absolute'
        style.left = style.top = 0

        var text = this.buildTextEl(spans, this)
        textOffset.append(text)
        offset.append(textOffset)
        outer.append(offset)
        
        this.text = text
        this.el = outer
    },
    
    calcBbox : function() {
        var b = this.tag.Bounds
        return [
            b.Xmin,
            b.Ymin,
            b.Xmax - b.Xmin,
            b.Ymax - b.Ymin
        ]
    },

    buildTextEl : function(spans, inst) {
        inst.content = []
        inst.spans = []

        var bbox = this.calcBbox()
        var text = new Element()
        text.create('canvas')
        text.element.width = bbox[2]
        text.element.height = bbox[3]
        var ctx = text.element.getContext('2d')
        ctx.translate(-bbox[0], -bbox[1])
        if (this.tag.TextMatrix) {
            ctx.transform.apply(ctx, Matrix.fromDef(this.tag.TextMatrix).m)
        }
        if (env.renderTextAsGlyphs) {
            // TODO
        }
        else {
            for (var i = 0; i < spans.length; i++) {
                var span = spans[i]
                var format = span.format
                var font = this.fonts.byId[format.font.tag.FontId]
                var advances = span.advances
                ctx.save()
                ctx.translate(format.indent, format.leading)
                if (format.align != null) {
                    var margin = bbox[2] - this.spanWidth(span)
                    var ascent = font.tag.FontAscent / 20 * format.size / 1024
                    switch (format.align) {
                    case 0: // left
                        break
                    case 1: // right
                        ctx.translate(margin, ascent)
                        break
                    case 2: // center
                        ctx.translate(margin / 2, ascent)
                        break
                    case 3: // justify
                        // TODO
                        break
                    }
                }
                ctx.fillStyle = this.canvasColor(format.color, format.alpha)
                var x = 0
                for (var j = 0, l = span.text.length; j < l; j++) {
                    var code = span.text.charCodeAt(j)
                    ctx.save()
                    ctx.translate(x, 0)
                    ctx.scale(format.size * 20 / 1024, format.size * 20 / 1024)
                    ctx.beginPath()
                    this.drawPath(ctx, font.glyphs[code])
                    ctx.fill()
                    ctx.restore()
                    x += advances[j]
                }
                ctx.restore()
                inst.spans.push({def:span, element:null})
                inst.content.push(span.text)
            }
        }
        return text
    },
    
    spanWidth : function(span) {
        var tag = span.format.font.tag
        var text = span.text
        var width = 0
        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i)
            var index = tag.GlyphIndex[code]
            var rect = tag.FontBoundsTable[index]
            width += tag.FontAdvanceTable[index] / 20
        }
        return width * span.format.size / 1024
    },

    canvasColor : function(color, alpha) {
        return 'rgba(' + [color.Red, color.Green, color.Blue, alpha] + ')'
    },

    drawPath : function(ctx, subpaths) {
        var edge
        var part
        var path = []
        for (var i = 0; i < subpaths.length; i++) {
            var edge = subpaths[i]
            ctx.moveTo(edge[0].x1, edge[0].y1)
            for (var k = 0; k < edge.length; k++) {
                part = edge[k]
                if (typeof part.cx == 'undefined') {
                    ctx.lineTo(part.x2, part.y2)
                }
                else {
                    ctx.quadraticCurveTo(part.cx, part.cy, part.x2, part.y2)
                }
            }
        }
    }
})

exports.TextDefBuilder = TextDefBuilder

})

