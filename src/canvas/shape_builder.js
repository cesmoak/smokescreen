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
var FillStyleTypes = require('swf/fill_style_types').FillStyleTypes
var Element = require('dom/element').Element

var ShapeBuilder = function(context) {
    this.context = context
    this.paths = []
    this.canvas = new Element()
    this.canvas.create('canvas')
    this.ctx = this.canvas.element.getContext('2d')
}

ext.add(ShapeBuilder.prototype, {
    
    build : function(def) {
        var tag = def.tag
        var lists = this.parseSwfPaths(tag)
        var paths = []
        for (var i = 0; i < lists.length; i++) {
            paths.push([this.buildPaths(lists[i][0]), this.buildPaths(lists[i][1])])
        }
        var bounds = tag.ShapeBounds
        var bbox = [bounds.Xmin, bounds.Ymin, bounds.Xmax - bounds.Xmin, bounds.Ymax - bounds.Ymin]
        this.setBbox(bbox)
        for (var j = 0; j < paths.length; j++) {
            var fillPaths = paths[j][0]
            for (var i = 0; i < fillPaths.length; i++) {
                var path = fillPaths[i]
                this.buildPath(path.path, path.style, null)
            }
            var linePaths = paths[j][1]
            for (var i = 0; i < linePaths.length; i++) {
                var path = linePaths[i]
                this.buildPath(path.path, null, path.style)
            }
        }

        var el = this.el = new Element()
        el.create('div')
        var style = el.element.style
        style.position = 'absolute'
        style.left = '0px'
        style.top = '0px'

        var el = this.canvas
        var style = el.element.style
        style.position = 'absolute'
        style.webkitTransform = 'matrix(1,0,0,1,' + [this.bbox[0], this.bbox[1]] + ')'
        style.webkitTransformOrigin = [-this.bbox[0] + 'px', -this.bbox[1] + 'px'].join(' ')//'0% 0%'
        
        this.el.append(this.canvas)
    },
    
    setBbox : function(bbox) {
        this.bbox = bbox
        this.canvas.element.width = bbox[2]
        this.canvas.element.height = bbox[3]
        this.ctx.translate(-bbox[0], -bbox[1])
    },

    parseSwfPaths : function(tag) {
        var minX,
            minY, 
            maxX, 
            maxY,
            firstPoint = true
        var x1 = 0, 
            y1 = 0,
            cx = 0,
            cy = 0,
            x2 = 0,
            y2 = 0
        var records = tag.Shapes.ShapeRecords
        var fillEdgeLists = this.stateNewStyles(tag.Shapes.FillStyles)
        var lineEdgeLists = this.stateNewStyles(tag.Shapes.LineStyles)
        var lists = []
        var fillStyle0 = 0
        var fillStyle1 = 0
        var lineStyle = 0
        var edgeKey = 1
        var edge = {
            x1 : 0,
            y1 : 0
        }
        var parts = []
        var self = this
        var __appendCurrentEdge = function() {
            edge.parts = parts
            edge.flipped = false
            edge.x2 = parts[parts.length - 1].x2
            edge.y2 = parts[parts.length - 1].y2
            edge.key1 = self.pointKey(edge.x1, edge.y1)
            edge.key2 = self.pointKey(edge.x2, edge.y2)
            edge.key = edgeKey += 1
            if (fillStyle0) {
                fillEdgeLists[fillStyle0].edges.push(edge)
            }
            if (fillStyle1) {
                fillEdgeLists[fillStyle1].edges.push({
                    parts : parts,
                    flipped : true,
                    x1 : edge.x2,
                    y1 : edge.y2,
                    x2 : edge.x1,
                    y2 : edge.y1,
                    key1 : edge.key2,
                    key2 : edge.key1,
                    key : edgeKey += 1
                })
            }
            // add edges to line edge table
            if (lineStyle) {
                lineEdgeLists[lineStyle].edges.push(edge)
            }
            edge = {
                x1 : edge.x2,
                y1 : edge.y2
            }
            parts = []
        }
        var __fillEdgeLists = function() {
            lists.push([fillEdgeLists, lineEdgeLists])
        }
        // loop through edge records:
        for (var i = 0; i < records.length; i++) {
            var record = records[i]
            switch (record.type) {
            case 'STRAIGHT':
                x2 = x1 + record.DeltaX
                y2 = y1 + record.DeltaY
                minX = x2 < minX ? x2 : minX
                minY = y2 < minY ? y2 : minY
                maxX = x2 > maxX ? x2 : maxX
                maxY = y2 > maxY ? y2 : maxY
                parts.push({
                    x1 : x1,
                    y1 : y1,
                    x2 : x2,
                    y2 : y2
                })
                x1 = x2
                y1 = y2
                break
            case 'CURVED':
                cx = x1 + record.ControlDeltaX
                cy = y1 + record.ControlDeltaY
                x2 = cx + record.AnchorDeltaX
                y2 = cy + record.AnchorDeltaY
                minX = x2 < minX ? x2 : minX
                minY = y2 < minY ? y2 : minY
                maxX = x2 > maxX ? x2 : maxX
                maxY = y2 > maxY ? y2 : maxY
                minX = cx < minX ? cx : minX
                minY = cy < minY ? cy : minY
                maxX = cx > maxX ? cx : maxX
                maxY = cy > maxY ? cy : maxY
                parts.push({
                    x1 : x1,
                    y1 : y1,
                    cx : cx,
                    cy : cy,
                    x2 : x2, 
                    y2 : y2
                })
                x1 = x2
                y1 = y2
                break
            case 'NONEDGE':
                // add edges to fill edge table
                if (parts.length) {
                    __appendCurrentEdge()
                }
                // update fill/line styles
                if (record.StateNewStyles) {
                    __fillEdgeLists()
                    fillEdgeLists = this.stateNewStyles(record.FillStyles)
                    lineEdgeLists = this.stateNewStyles(record.LineStyles)
                }
                if (record.StateLineStyle) {
                    lineStyle = record.LineStyle
                }
                if (record.StateFillStyle0) {
                    fillStyle0 = record.FillStyle0
                }
                if (record.StateFillStyle1) {
                    fillStyle1 = record.FillStyle1
                }
                if (record.StateMoveTo) {
                    x1 = record.MoveDeltaX
                    y1 = record.MoveDeltaY
                    if (firstPoint) {
                        firstPoint = false
                        minX = x1
                        minY = y1
                        maxX = x1
                        maxY = y1
                    }
                    edge.x1 = x1
                    edge.y1 = y1
                }
                break
            }
        }
        if (parts.length) {
            __appendCurrentEdge()
        }
        __fillEdgeLists()
        return lists
    },

    stateNewStyles : function(styles) {
        var edgeLists = [{edges: [], style: null}]
        for (var i = 0; i < styles.length; i++) {
            edgeLists.push({
                edges: [],
                style: styles[i]
            })
        }
        return edgeLists
    },

    buildPaths : function(edgeLists) {
        var paths = []
        var edge
        var pointKey
        var edgeList
        var i, j, k, l
        var edgeIndex
        var edgesPicked
        var path
        var subpath
        var startingPointKey
        var edges
        // for each edge table:
        for (i = 0; i < edgeLists.length; i++) {
            edgeList = edgeLists[i].edges
            if (edgeList.length == 0) {
                continue
            }
            // index edges by starting point; prep edges for picking
            edgeIndex = {}
            edgeIndexCount = {}
            path = []
            edgesPicked = 0
            for (j = 0; j < edgeList.length; j++) {
                edge = edgeList[j]
                // if it is closed, add it as a subpath
                if (edge.key1 == edge.key2) {
                    edge.picked = true
                    edgesPicked += 1
                    path.push([edge])
                }
                // otherwise, add it to the edge index
                else {
                    edge.picked = false
                    if (!edgeIndex[edge.key1]) {
                        edgeIndex[edge.key1] = []
                    }
                    edgeIndex[edge.key1].push(edge)
                }
            }
            // loop while edges left:
            for (k = 0; k < edgeList.length; k++) {
                if (edgesPicked == edgeList.length) {
                    break
                }
                // pick a starting edge
                edge = edgeList[k]
                if (edge.picked) {
                    continue
                }
                subpath = [edge]
                edge.picked = true
                edgesPicked += 1
                edges = edgeIndex[edge.key1]
                for (var l = 0; l < edges.length; l++) {
                    if (edges[l] == edge) {
                        edges.splice(l, 1)
                        break
                    }
                }
                startingPointKey = edge.key1
                pointKey = edge.key2
                // loop while end point of current edge is not starting edge begin point:
                while (pointKey != startingPointKey) {
                    // find a connecting edge
                    edges = edgeIndex[pointKey]
                    if (typeof edges == 'undefined') {
                        break
                    }
                    if (edges.length == 0) {
                        break
                    }
                    edge = edges.shift()
                    subpath.push(edge)
                    edge.picked = true
                    edgesPicked += 1
                    pointKey = edge.key2
                }
                // add a subpath
                path.push(subpath)
            }
            if (path.length) {
                paths.push({path:path, style:edgeLists[i].style})
            }
        }
        return paths
    },
    
    pointKey : function(x, y) {
        return [x, y].join(',')
    },
    
    drawPath : function(ctx, subpaths) {
        var edge
        var part
        var path = []
        for (var i = 0; i < subpaths.length; i++) {
            var subpath = subpaths[i]
            ctx.moveTo(subpath[0].x1, subpath[0].y1)
            for (var j = 0; j < subpath.length; j++) {
                edge = subpath[j]
                if (edge.flipped) {
                    for (var k = edge.parts.length - 1; k >= 0; k--) {
                        part = edge.parts[k]
                        if (typeof part.cx == 'undefined') {
                            ctx.lineTo(part.x1, part.y1)
                        }
                        else {
                            ctx.quadraticCurveTo(part.cx, part.cy, part.x1, part.y1)
                        }
                    }
                }
                else {
                    for (var k = 0; k < edge.parts.length; k++) {
                        part = edge.parts[k]
                        if (typeof part.cx == 'undefined') {
                            ctx.lineTo(part.x2, part.y2)
                        }
                        else {
                            ctx.quadraticCurveTo(part.cx, part.cy, part.x2, part.y2)
                        }
                    }
                }
            }
        }
    },

    buildPath : function(subpaths, fillStyle, lineStyle) {
        var ctx = this.ctx
        ctx.beginPath()
        this.drawPath(ctx, subpaths)
        if (fillStyle) {
            var t = FillStyleTypes
            switch (fillStyle.FillStyleType) {
            case t.LinearGradientFill:
            case t.RadialGradientFill:
            case t.FocalRadialGradientFill:
                this.fillGradient(ctx, fillStyle)
                break
            case t.RepeatingBitmapFill:
            case t.ClippedBitmapFill:
            case t.NonSmoothedRepeatingBitmapFill:
            case t.NonSmoothedClippedBitmapFill:
                this.fillBitmap(ctx, fillStyle)
                break
            // solid
            default:
                this.fillSolid(ctx, fillStyle)
                break
            }
        }
        if (lineStyle) {
            var thickness
            var color
            var style = lineStyle
            if (style.HasFillFlag) {
                if (style.FillType.Color) {
                    thickness = Math.max(style.Width, 1)
                    color = this.canvasColor(style.FillType.Color)
                }
                else {
                    thickness = 1
                    color = 'rgba(0, 0, 0, 1)'
                }
            }
            else {
                thickness = Math.max(style.Width, 1)
                color = this.canvasColor(style.Color)
            }
            ctx.lineWidth = thickness
            ctx.strokeStyle = color
            ctx.stroke()
        }
    },

    xform: function(ctx, def) {
        if (!def) {
            return
        }
        var m = []
        m.push(def.ScaleX != null ? def.ScaleX : 1)
        m.push(def.RotateSkew0 != null ? def.RotateSkew0 : 0)
        m.push(def.RotateSkew1 != null ? def.RotateSkew1 : 0)
        m.push(def.ScaleY != null ? def.ScaleY : 1)
        m.push(def.TranslateX != null ? def.TranslateX : 0)
        m.push(def.TranslateY != null ? def.TranslateY : 0)
        ctx.transform.apply(ctx, m)
    },

    canvasColor : function(c) {
        return 'rgba(' + [c.Red, c.Green, c.Blue, c.Alpha / 0xff] + ')'
    },
    
    fillSolid : function(ctx, style) {
        ctx.fillStyle = this.canvasColor(style.Color)
        ctx.fill()
    },

    fillGradient : function(ctx, style) {
        var fill
        if (style.FillStyleType == FillStyleTypes.LinearGradientFill) {
            fill = ctx.createLinearGradient(-16384 / 20, 0, 16384 / 20, 0)
        }
        else {
            fill = ctx.createRadialGradient(0, 0, 0, 0, 0, 16384 / 20)
        }
        {
            var records = style.Gradient.GradientRecords
            for (var i = 0; i < records.length; i++) {
                var record = records[i]
                fill.addColorStop(record.Ratio / 255, this.canvasColor(record.Color))
            }
        }
        ctx.save()
        this.xform(ctx, style.GradientMatrix)
        ctx.fillStyle = fill
        ctx.fill()
        ctx.restore()
    },
    
    fillBitmap : function(ctx, style) {
        var bitmap = this.context.dict[style.BitmapId]
        // no fill if the bitmap doesn't exist
        if (!bitmap) {
            return
        }
        var type
        var t = FillStyleTypes
        switch (style.FillStyleType) {
            case t.RepeatingBitmapFill:
            case t.NonSmoothedRepeatingBitmapFill:
                type = 'repeat'
                break
            case t.ClippedBitmapFill:
            case t.NonSmoothedClippedBitmapFill:
                type = 'no-repeat'
                break
        }
        var pat = ctx.createPattern(bitmap.img, type)
        ctx.save()
        var m = style.BitmapMatrix
        if (m) {
            var matrix = {
                ScaleX: m.ScaleX != null ? m.ScaleX / 20 : 1, 
                RotateSkew0: m.RotateSkew0 != null ? m.RotateSkew0 / 20 : 0,
                RotateSkew1: m.RotateSkew1 != null ? m.RotateSkew1 / 20 : 0,
                ScaleY: m.ScaleY != null ? m.ScaleY / 20 : 1,
                TranslateX: 0,
                TranslareY: 0
            }
            ctx.translate(m.TranslateX != null ? m.TranslateX : 0, m.TranslateY != null ? m.TranslateY : 0)
            this.xform(ctx, matrix)
        }
        ctx.fillStyle = pat
        ctx.fill()
        ctx.restore()
    }

})

exports.ShapeBuilder = ShapeBuilder

})
