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
var Element = require('dom/element').Element

var clippingElementId = 1
var nextClippingElementId = function() {
    return clippingElementId++
}

var ClipLayer = function(obj) {
    this.obj = obj
}

ext.add(ClipLayer.prototype, {
    
    insert: function() {
        // TODO: find existing siblings to clip
        this.buildElements()
        this.redraw()
    },

    remove: function() {
        var newClipper = this.obj.getClipper()
        var frag = document.createDocumentFragment()
        var objs = this.obj.parent.displayList.getDisplayObjects()
        for (var depth in objs) {
            if (objs.hasOwnProperty(depth)) {
                var obj = objs[depth]
                if (obj.getClipper() == this.obj) {
                    frag.appendChild(obj.renderer.getOuterEl().element)
                    obj.setClipper(newClipper)
                }
            }
        }
        var container = newClipper || this.obj.parent
        container.renderer.containerEl.element.appendChild(frag)
    },

    redraw: function() {
        this.updateTransform()

        this.el.element.style.zIndex = this.obj.getDepth()

        // find the bbox of the clipping tree
        var bbox = this.obj.calcBbox().slice(0)

        // apply the clipping mask
        var style = this.clipping.element.style
        var id = 'smokescreen-canvas-' + nextClippingElementId()
        style.webkitMaskImage = '-webkit-canvas(' + id + ')'
        var ctx = document.getCSSCanvasContext('2d', id, bbox[2], bbox[3])
        this.flatten(ctx, this.obj)
        
        var style = this.outer.element.style
//        style.left = bbox[0] + 'px'
//        style.top = bbox[1] + 'px'
        style.webkitTransform = 'matrix(1,0,0,1,' + bbox[0] + ',' + bbox[1] + ')'
        
        var style = this.clipping.element.style
        style.width = bbox[2] + 'px'
        style.height = bbox[3] + 'px'

        var style = this.inner.element.style
//        style.left = -bbox[0] + 'px'
//        style.top = -bbox[1] + 'px'
        style.webkitTransform = 'matrix(1,0,0,1,' + -bbox[0] + ',' + -bbox[1] + ')'
    },
    
    buildElements: function() {
        // buld the clipping layer and it's ref'd elems
        var inv = new Element()
        inv.create('div')
        var style = inv.element.style
        style.position = 'relative'
//        style.left = -bbox[0] + 'px'
//        style.top = -bbox[1] + 'px'
        this.containerEl = inv
        var place = new Element()
        place.create('div')
        this.el = place
        var style = place.element.style
        style.position = 'absolute'
//        style.left = bbox[0] + 'px'
//        style.top = bbox[1] + 'px'

        var outer = new Element()
        outer.create('div')
        var style = outer.element.style
        style.position = 'absolute'
        this.outer = outer
        
        var clipping = new Element()
        clipping.create('div')
        var style = clipping.element.style
        style.position = 'relative'
        this.clipping = clipping

        var inner = new Element()
        inner.create('div')
        var style = inner.element.style
        style.position = 'absolute'
        this.inner = inner

        place.append(outer)
        outer.append(clipping)
        clipping.append(inner)
        inner.append(inv)
    },

    updateTransform: function() {
        // find the clipping xform and it's inverse
        var xform = this.obj.getMatrix().toCss()
        var invXform = xform.inverse()
        this.el.element.style.webkitTransform = xform
        this.containerEl.element.style.webkitTransform = invXform
    },
    
    flatten : function(ctx, obj) {
        //var t = fljs.swf.TagTypes
        ctx.save()
        switch (obj.def.tag.header.TagType) {
        case 2://t.DefineShape:
        case 11://t.DefineText:
            ctx.drawImage(obj.renderer.canvas.element, 0, 0)
            break
        case 39://t.DefineSprite:
            // TODO: do we need to do this in order?
            var objs = obj.displayList.getDisplayObjects()
            for (var depth in objs) {
                if (objs.hasOwnProperty(depth)) {
                    var obj = objs[depth]
                    this.flatten(ctx, obj)
                }
            }
            break
        default:
            break
        }
        ctx.restore()
    }
})

exports.ClipLayer = ClipLayer

})
