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
var Matrix = require('util/matrix').Matrix
var ColorTransform = require('util/color_transform').ColorTransform

var DisplayObject = function() {}

ext.add(DisplayObject.prototype, {

    place: function(tag) {
        if (tag.Depth != this.getDepth()) {
            // insert as a child if not root
            if (this.parent) {
                this.parent.insertChild(this, tag.Depth)
            }
        }
        // TODO: tag.ClassName
        if (tag.Matrix) {
            this.matrix = Matrix.fromDef(tag.Matrix)
        }
        else if (!this.matrix) {
            this.matrix = new Matrix()
        }
        if (tag.ColorTransform) {
            this.colorTransform = ColorTransform.fromDef(tag.ColorTransform)
        }
        else if (!this.colorTransform) {
            this.colorTransform = new ColorTransform()
        }
        // TODO: tag.Ratio
        if (tag.Name) {
            this.setName(tag.Name)
        }
        // TODO: tag.ClipDepth
        if (tag.ClipDepth != this.clipDepth) {
            this.clipDepth = tag.ClipDepth
        }
        this.renderer.updateAll()
        this.$isTimelineControlled = true
    },

    timelineUpdate: function(tag) {
        this.place(tag)
    },

    setName: function(name) {
        var oldName = this.name
        this.name = name
        if (this.parent) {
            this.parent.childChangedName(this, this.name, name)
        }
    },

    getName: function() {
        return this.name
    },

    getClipDepth: function() {
        return this.clipDepth || 0
    },

    setClipper: function(obj) {
        this.clipper = obj
    },

    getClipper: function() {
        return this.clipper
    },

    isInClippingTree: function() {
        if (this.clipDepth) {
            return true
        }
        else if (this.parent) {
            return this.parent.isInClippingTree()
        }
        else {
            return false
        }
    },

    getMatrix: function() {
        return this.matrix
    },

    getColorTransform: function() {
        return this.colorTransform
    },

    calcBbox : function() {
        // TODO: this should be updated for non-timeline-controlled objects
        return this.def.bbox || [0, 0, 0, 0]
    },

    placeBbox : function() {
        var b = this.calcBbox().slice(0)
        var m = this.getMatrix().m
        var xf = []
        xf[0] = b[0] * m[0] + b[1] * m[2] + m[4]
        xf[1] = b[0] * m[1] + b[1] * m[3] + m[5]
        xf[2] = ((b[0] + b[2]) * m[0] + (b[1] + b[3]) * m[2] + m[4]) - xf[0]
        xf[3] = ((b[0] + b[2]) * m[1] + (b[1] + b[3]) * m[3] + m[5]) - xf[1]
        return xf
    },

    getXf : function() {
        if (!this.xf) {
            var m = this.getMatrix().m
            var pxX = 0 * m[0] + 1 * m[2]
            var pxY = 0 * m[1] + 1 * m[3]
            this.xf = {
                x : m[4],
                y : m[5],
                xscale : Math.sqrt(m[0] * m[0] + m[1] * m[1]),
                yscale : Math.sqrt(m[2] * m[2] + m[3] * m[3]),
                rotation : Math.atan2(pxY, pxX) - Math.PI / 2
            }
        }
        return this.xf
    },

    getX : function() {
        return this.getXf().x
    },

    setX : function(x) {
        this.$isTimelineControlled = false
        var xf = this.getXf()
        if (xf.x != x) {
            this.xf.x = x
            this.updateTransform()
        }
    },

    getY : function() {
        return this.getXf().y
    },
    
    setY : function(y) {
        this.$isTimelineControlled = false
        var xf = this.getXf()
        if (xf.y != y) {
            this.xf.y = y
            this.updateTransform()
        }
    },

    getXScale : function() {
        return this.getXf().xscale * 100
    },

    setXScale : function(val) {
        val /= 100
        this.$isTimelineControlled = false
        var xf = this.getXf()
        if (xf.xscale != val) {
            this.xf.xscale = val
            this.updateTransform()
        }
    },
    
    getYScale : function() {
        return this.getXf().yscale * 100
    },

    setYScale : function(val) {
        val /= 100
        this.$isTimelineControlled = false
        var xf = this.getXf()
        if (xf.yscale != val) {
            this.xf.yscale = val
            this.updateTransform()
        }
    },
    
    getAlpha : function() {
        // TODO: read from color xform?
        if ('alpha' in this) {
            return this.alpha
        }
        else if (this.colorTransform.hasA) {
            return this.colorTransform.aa * 100
        }
        else {
            return 100
        }
    },

    setAlpha : function(val) {
        // TODO: should stop timeline?
        val = Math.min(100, Math.max(0, val))
        if (val != this.alpha) {
            this.alpha = val
            // TODO: update color xform?
            this.renderer.updateAlpha()
        }
    },
    
    getVisible : function() {
        if ('visible' in this) {
            return this.visible
        }
        else {
            return true
        }
    },
    
    setVisible : function(val) {
        // TODO: should stop timeline?
        val = !!val
        if (this.visible != val) {
            this.visible = val
            this.renderer.updateVisibility()
        }
    },
    
    getRotation : function() {
        return this.getXf().rotation * 180 / Math.PI
    },
    
    setRotation : function(val) {
        val *= Math.PI / 180
        this.$isTimelineControlled = false
        var xf = this.getXf()
        if (xf.rotation != val) {
            this.xf.rotation = val
            this.updateTransform()
        }
    },
    
    bbox : function() {
        return this.calcBbox().slice(0)
    },

    updateTransform : function() {
        // assume this.xf has been calculated
        var xf = this.xf
        var cos = Math.cos(xf.rotation)
        var sin = Math.sin(xf.rotation)
        var m = this.matrix.m
        m[0] = cos * xf.xscale
        m[1] = sin
        m[2] = -sin
        m[3] = cos * xf.yscale
        m[4] = xf.x
        m[5] = xf.y
        this.renderer.updateMatrix()
    },

    setDepth: function(depth) {
        this.depth = depth
        this.renderer.updateDepth()
    },

    getDepth: function() {
        return this.depth
    },
       
    setParent: function(parent) {
        this.parent = parent
        /*
        if (this.name) {
            this.parent.childChangedName(this, null, name)
        }
        */
    },

    getParent: function() {
        return this.parent ? this.parent : this
    },

    setLoader: function(loader) {
        this.loader = loader
        this.id = loader.newDisplayObjectId()
    },

    isTimelineControlled: function() {
        return this.$isTimelineControlled
    }
})

exports.DisplayObject = DisplayObject

})
