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

var Change = function(span, frame, tag) {
    this.span = span
    this.frame = frame
    this.tag = tag
}

ext.add(Change.prototype, {
    
    getDepth: function() {
        return this.span.tag.Depth
    },

    getInstance: function() {
        return this.span
    }
})

var id = 1
var nextSpanId = function() { return id++ }

var Span = function(tag, placeFrame, removeFrame, prev) {
    this.id = nextSpanId()
    this.tag = tag
    this.placeFrame = placeFrame
    this.removeFrame = removeFrame
    this.prev = null
    this.changes = [new Change(this, placeFrame, tag)]
}

ext.add(Span.prototype, {
    
    addChange : function(tag, frame) {
        this.changes.push(new Change(this, frame, tag))
    },

    containsFrame : function(frame) {
        return (
            frame >= this.placeFrame && 
            (!this.removeFrame || this.removeFrame < frame)
        )
    },

    getChanges: function() {
        return this.changes
    }
})

var Frame = function(frame, spans, tags, label) {
    this.frame = frame
    this.spans = spans
    this.tags = tags
    this.label = label
}

var Timeline = function(tag) {
    this.tag = tag
    var frameCount = tag.FrameCount
    var frames = this.frames = new Array(frameCount)
    for (var i = 0; i < frameCount; i++) {
        frames[i] = new Frame(i)
    }
    this.labels = {}
    this.framesByLabel = {}
}

ext.add(Timeline.prototype, {

    setFrameLabel: function(frame, name) {
        this.frames[frame].label = name
        this.labels[frame] = name
        this.framesByLabel[name] = frame
    },

    getFrameNumberForLabel: function(label) {
        return this.framesByLabel[label]
    },

    addSpan: function(span) {
        var first = span.placeFrame
        var last = span.removeFrame || this.getFrameCount()
        var changes = span.getChanges()
        var changeIndex = 0
        var change = changes[changeIndex]
        var nextChange = changes[changeIndex + 1]
        for (var i = first; i < last; i++) {
            var spans = this.frames[i].spans
            if (!spans) {
                spans = this.frames[i].spans = []
            }
            if (nextChange && nextChange.frame == i) {
                changeIndex += 1
                change = changes[changeIndex]
                nextChange = changes[changeIndex + 1]
            }
            spans.push(change)
        }
    },

    getFrameCount: function() {
        return this.frames.length
    },

    getChangedSpans: function(lastFrame, currentFrame) {
        var lastSpans = (this.frames[lastFrame] || {}).spans || []
        var lastCount = lastSpans.length
        var currSpans = this.frames[currentFrame].spans || []
        var currCount = currSpans.length

        var toRemove = []
        var toAdd = []
        var toUpdate = []

        var lastIndex = 0
        var currIndex = 0
        while (lastIndex < lastCount || currIndex < currCount) {
            var last = lastSpans[lastIndex]
            var curr = currSpans[currIndex]
            if (!last) {
                toAdd.push(curr)
                currIndex += 1
            }
            else if (!curr) {
                toRemove.push(last)
                lastIndex += 1
            }
            else if (last.getDepth() == curr.getDepth()) {
                if (last === curr) {
                    // same span--no update
                }
                else if (last.getInstance() === curr.getInstance()) {
                    // diff span, same instance. need to update
                    toUpdate.push(curr)
                }
                else {
                    // diff instance, need to remove and add
                    toRemove.push(last)
                    toAdd.push(curr)
                }
                lastIndex += 1
                currIndex += 1
            }
            else if (last.getDepth() < curr.getDepth()) {
                toRemove.push(last)
                lastIndex += 1
            }
            else {
                toAdd.push(curr)
                currIndex += 1
            }
        }
        return {toRemove: toRemove, toAdd: toAdd, toUpdate: toUpdate}
    },

    getFrame: function(frame) {
        return this.frames[frame]
    }
})

var TimelineBuilder = function() {}

ext.add(TimelineBuilder.prototype, {

    setDefinitionTag: function(tag) {
        this.timeline = new Timeline(tag)
        this.frame = 0
        this.tags = [] // tags for the current frame
        this.build = {} // current span for any depth
        this.depths = {} // all spans for each depth
    },
    
    addTimelineTag: function(tag) {
        var frame = this.frame
        var depth = tag.Depth// - 16384 // depth of 0 in the timeline
        this.depths[depth] = this.depths[depth] || []
        var span = this.build[depth]
        var newSpan = false

        //var t = fljs.swf.TagTypes
        switch (tag.header.TagType) {
        case 4://t.PlaceObject:
            span = new Span(tag, this.frame)
            newSpan = true
            break

        case 26://t.PlaceObject2:
        case 70://t.PlaceObject3:
            if (!tag.PlaceFlagMove && tag.PlaceFlagHasCharacter) {
                span = new Span(tag, this.frame)
                newSpan = true
            }
            else if (tag.PlaceFlagMove && !tag.PlaceFlagHasCharacter) {
                span.addChange(tag, this.frame)
            }
            else if (tag.PlaceFlagMove && tag.PlaceFlagHasCharacter) {
                // finish the current span
                span.removeFrame = frame
                // start the new span (pointing to the current span)
                span = new Span(tag, this.frame, null, span)
                newSpan = true
            }
            break

        case 5://t.RemoveObject:
        case 28://t.RemoveObject2:
            // finish the current span
            span.removeFrame = frame
            break
        }
        if (newSpan) {
            this.build[depth] = span
            this.depths[depth].push(span)
        }
        this.addFrameTag(tag)
    },

    addFrameTag: function(tag) {
        this.tags.push(tag)
    },

    setFrameLabel: function(name) {
        this.timeline.setFrameLabel(this.frame, name)
    },

    nextFrame: function() {
        var frame = this.timeline.getFrame(this.frame)
        frame.tags = this.tags
        this.tags = []
        this.frame += 1
    },

    end: function() {
        var depths = []
        for (var d in this.depths) {
            depths.push(d)
        }
        depths.sort(function(a, b) { return a - b })
        for (var i = 0; i < depths.length; i++) {
            var spans = this.depths[depths[i]]
            for (var j = 0; j < spans.length; j++) {
                this.timeline.addSpan(spans[j])
            }
        }
    },

    getTimeline: function() {
        return this.timeline
    },

    buildEmptyTimeline: function() {
        this.timeline = new Timeline({FrameCount: 1})
    },
    
    buildButtonTimeline: function(tag) {
        tag.FrameCount = 3
        this.setDefinitionTag(tag)
        var states = [['_up', 'Down'], ['_over', 'Over'], ['_down', 'Down']]
        for (var i = 0; i < states.length; i++) {
            this.setFrameLabel(states[i][0])
            var test = 'ButtonState' + states[i][1]
            var recs = tag.Characters
            for (var j = 0; j < recs.length; j++) {
                var rec = recs[j]
                if (rec[test]) {
                    var frameTag = {
                        CharacterId: rec.CharacterId,
                        Depth: rec.PlaceDepth,
                        Matrix: rec.PlaceMatrix,
                        ColorTransform: rec.ColorTransform
                    }
                    var span = new Span(frameTag, this.frame, this.frame + 1)
                    var spans = this.depths[frameTag.Depth]
                    if (!spans) {
                        spans = this.depths[frameTag.Depth] = []
                    }
                    spans.push(span)
                    this.addFrameTag(frameTag)
                }
            }
            this.nextFrame()
        }
        this.end()
    }
})

exports.TimelineBuilder = TimelineBuilder

})
