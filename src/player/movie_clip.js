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
var DisplayObject = require('player/display_object').DisplayObject
var Element = require('dom/element').Element
var Namespace = require('dom/namespace').Namespace
var as2_MovieClip = require('as2/movie_clip').MovieClip
var DisplayList = require('player/display_list').DisplayList

var MovieClip = function(def, loader, parent, renderer) {
    this.def = def
    this.loader = loader
    this.parent = parent
    this.renderer = renderer
    DisplayObject.call(this)
    this.timeline = def.timeline
    this.playhead = null
    this.onEnterFrameCallback = ext.bind(this.onEnterFrame, this)
    this.displayList = new DisplayList()
    this.$isTimelineControlled = !!this.timeline
    this.renderer.setMovieClip(this)
}

ext.inherits(MovieClip, DisplayObject)

ext.add(MovieClip.prototype, {

    getPlayhead: function() {
        return this.playhead
    },

    getFrameCount: function() {
        return this.timeline ? this.timeline.getFrameCount() : 1
    },

    // TODO: implement when we have async loading
    frameReady : function(frame) {
        return true
    },

    enterFrame: function() {
        // update playhead
        var lastPlayhead = this.playhead
        if (lastPlayhead === null) {
            // first frame
            this.playing = (this.getFrameCount() > 1)
            this.playhead = 0
        }
        else {
            // after first frame
            if (this.playing) {
                this.playhead += 1
                if (this.playhead >= this.getFrameCount()) {
                    this.playhead = 0
                }
            }
        }
        this.$processFrameChange(lastPlayhead, true)
    },

    $processFrameChange: function(lastPlayhead, enterFrame) {
        var toAdd = null
        if (this.playhead !== lastPlayhead) {
            if (this.timeline) {
                // update timeline entries
                var changes = this.timeline.getChangedSpans(lastPlayhead, this.playhead)
                var toRemove = changes.toRemove
                toAdd = changes.toAdd
                var toUpdate = changes.toUpdate

                // children are removed
                var removeLength = toRemove.length
                for (var i = 0; i < removeLength; i++) {
                    var entry = toRemove[i]
                    this.removeChildAtDepth(entry.getDepth())
                }

                // children are updated
                var updateLength = toUpdate.length
                for (var i = 0; i < updateLength; i++) {
                    var entry = toUpdate[i]
                    this.$updateChild(entry)
                }
            }
        }

        // update all existing children
        var displayObjects = this.displayList.getDisplayObjects()
        for (var depth in displayObjects) {
            if (displayObjects.hasOwnProperty(depth)) {
                if (displayObjects[depth].enterFrame) {
                    displayObjects[depth].enterFrame()
                }
            }
        }

        // queue up onEnterFrame if this is not the first time we're called
        if (enterFrame && lastPlayhead !== null) {
            this.loader.addAction(this.onEnterFrameCallback)
        }

        // queue up frame script if we've changed frames
        if (this.playhead !== lastPlayhead) {
            var callback = ext.bind(this.frameAction, this, [this.playhead])
            this.loader.addAction(callback)
        }

        // new children are inited
        if (toAdd) {
            var addLength = toAdd.length
            for (var i = 0; i < addLength; i++) {
                var entry = toAdd[i]
                var obj = this.loader.createDisplayObject(entry.getInstance().tag, this)
                // TODO: limit when we need to update here
                this.$updateChild(entry)
                //obj.spanid = entry.getInstance().id
            }
        }
    },

    $updateChild: function(entry) {
        var obj = this.displayList.getAtDepth(entry.getDepth())
        if (obj && obj.isTimelineControlled()) {
            obj.timelineUpdate(entry.tag)
        }
    },

    removeChildAtDepth: function(depth) {
        var obj = this.displayList.removeAtDepth(depth)
        if (obj) {
            this.renderer.removeChild(obj)
            this.childChangedName(obj, obj.getName(), null)
        }
    },

    insertChild: function(obj, depth) {
        var displayList = this.displayList
        // if we have an existing object at this depth, move it
        var existing = displayList.getAtDepth(depth)
        if (existing) {
            var newDepth = displayList.getNextHighestDepth()
            existing.setDepth(newDepth)
            displayList.removeAtDepth(depth)
            displayList.setAtDepth(existing, newDepth)
        }
        // add the new object
        obj.setDepth(depth)
        displayList.setAtDepth(obj, depth)
        this.renderer.addChild(obj)
        this.childChangedName(obj, null, obj.getName())
    },

    frameAction: function(frame) {
        if (!this.timeline) {
            return
        }
        var tags = this.timeline.getFrame(frame).tags
        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i]

            // TODO: cleanup following

            // button children's tags don't have headers
            if (!tag.header) {
                continue
            }
            //var t = fljs.swf.TagTypes
            switch (tag.header.TagType) {
            case 12://t.DoAction:
                this.loader.doAction(this, tag)
                break
            case 9://t.SetBackgroundColor:
                // TODO
                break
            case 15://t.StartSound:
            case 19://t.SoundStreamBlock:
            case 18://t.SoundStreamHead:
            case 45://t.SoundStreamHead2:
                break
            default:
                // [nop]
            }
        }
    },

    onEnterFrame: function() {
        // TODO: rename _as2Object
        if (this._as2Object && this._as2Object.onEnterFrame) {
            this._as2Object.onEnterFrame()
        }
    },

    play: function() {
        this.playing = true
    },

    stop: function() {
        this.playing = false
    },

    gotoAndPlay: function(frame) {
        this.playing = true
        this.$gotoFrame(frame)
    },

    gotoAndStop: function(frame) {
        this.playing = false
        this.$gotoFrame(frame)
    },

    $gotoFrame: function(frame) {
        // are we specifying a frame by label?
        if (typeof frame == 'string') {
            if (this.timeline) {
                frame = this.timeline.getFrameNumberForLabel(frame)
            }
        }
        // or by frame number?
        else {
            // we're 0-based, as2 is 1-based
            frame -= 1
        }
        if (frame === null || frame < 0) {
            frame = 0
        }
        if (frame >= this.getFrameCount()) {
            frame = this.getFrameCount() - 1
        }
        var lastPlayhead = this.playhead
        this.playhead = frame
        this.$processFrameChange(lastPlayhead, false)
    },
    
    as2Object : function() {
        if (!this._as2Object) {
            var mc = this._as2Object = new as2_MovieClip()
            mc.__dispObj = this
            var objs = this.displayList.getDisplayObjects()
            for (var depth in objs) {
                if (objs.hasOwnProperty(depth)) {
                    var obj = objs[depth]
                    var name = obj.getName()
                    if (name) {
                        mc[name] = obj.as2Object()
                    }
                }
            }
            if (this.getName()) {
                mc[this.getName()] = mc
            }
        }
        return this._as2Object
    },

    childChangedName: function(child, oldName, newName) {
        if (!oldName && !newName) {
            return
        }
        var mc = this._as2Object
        if (mc) {
            var target = child.as2Object()
            if (oldName && mc[oldName] === target) {
                delete mc[oldName]
            }
            if (newName) {
                mc[newName] = target
            }
        }
    },

    /**
     * DisplayObject override
     */
    calcBbox : function() {
        var bbox
        var objs = this.displayList.getDisplayObjects()
        for (var depth in objs) {
            if (objs.hasOwnProperty(depth)) {
                var obj = objs[depth]
                var objBbox = obj.placeBbox()
                if (!bbox) {
                    bbox = objBbox.slice(0)
                }
                else {
                    bbox = [
                        bbox[0] < objBbox[0] ? bbox[0] : objBbox[0],
                        bbox[1] < objBbox[1] ? bbox[1] : objBbox[1],
                        bbox[2] > objBbox[2] ? bbox[2] : objBbox[2],
                        bbox[3] > objBbox[3] ? bbox[3] : objBbox[3]
                    ]
                }
            }
        }
        if (!bbox) {
            bbox = [0, 0, 0, 0]
        }
        return bbox
    }
})

exports.MovieClip = MovieClip

})
