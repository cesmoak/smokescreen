define(function(require, exports, module) {

var ext = require('lib/ext')

var TimelineView = function(container) {
    this.container = container
    this.xscale = 5
    this.yscale = 10
}
ext.add(TimelineView.prototype, {
    
    drawTimeline : function(def) {
        var xscale = this.xscale
        var yscale = this.yscale
        var canvas
        if (this.canvas) {
            canvas = this.canvas
        }
        else {
            canvas = document.createElement('canvas')
            canvas.style.border = '1px solid black'
            this.frames = def.frames.length
            this.depth = def.depths.length
            canvas.width = def.frames.length * xscale
            canvas.height = def.depths.length * yscale
            this.canvas = canvas
            this.container.appendChild(canvas)
        }
        var ctx = canvas.getContext('2d')
        ctx.strokeStyle = '#dddddd'
        ctx.lineWidth = 1
        for (var i = 0; i < def.frames.length; i++) {
            ctx.beginPath()
            ctx.moveTo(i * xscale, 0)
            ctx.lineTo(i * xscale, def.depths.length * yscale)
            ctx.stroke()
        }
        for (var i in def.depths) {
            var depth = def.depths[i]
            for (var j in depth) {
                var span = depth[j]
                var x = span.placeFrame
                var y = i
                var w
                if (span.removeFrame) {
                    w = span.removeFrame - span.placeFrame
                }
                else {
                    w = def.frames.length - span.placeFrame
                }
                var h = 1
                if (span.tag.ClipDepth) {
                    ctx.fillStyle = '#00007f'
                    ctx.globalAlpha = 0.25
                    var ch = span.tag.ClipDepth - y
                    ctx.fillRect(x * xscale + 0.5, y * yscale + 0.5, w * xscale, ch * yscale)
                    ctx.globalAlpha = 1
                    ctx.fillStyle = '#0000ff'
                }
                else {
                    ctx.fillStyle = '#ff0000'
                }
                ctx.fillRect(x * xscale + 0.5, y * yscale + 0.5, w * xscale, h * yscale)
                ctx.strokeStyle = '#7f7f7f'
                for (var k in span.changes) {
                    var cx = span.changes[k].frame
                    ctx.strokeRect(cx * xscale + 0.5, y * yscale + 0.5, 1, h * yscale)
                }
                ctx.strokeStyle = '#000000'
                ctx.strokeRect(x * xscale + 0.5, y * yscale + 0.5, w * xscale - 1, h * yscale)
            }
        }
    },
    
    highlightFrame : function(frame) {
        var ctx = this.canvas.getContext('2d')
        ctx.fillStyle = '#000000'
        ctx.globalAlpha = 0.25
        ctx.fillRect(frame * this.xscale + 0.5, 0 + 0.5, 1 * this.xscale, this.depth * this.yscale)
    }
})

exports.TimelineView = TimelineView

})
