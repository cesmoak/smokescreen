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
var CssView = require('player/css_view').CssView
var SwfLoader = require('swf/swf_loader').SwfLoader
var MovieClipDef = require('def/movie_clip_def').MovieClipDef
var MovieClip = require('player/movie_clip').MovieClip
var BitmapDef = require('def/bitmap_def').BitmapDef
var TextDef = require('def/text_def').TextDef
var TimelineBuilder = require('def/timeline_builder').TimelineBuilder
var ShapeDef = require('def/shape_def').ShapeDef

var Loader = function(container, renderer) {
    this.container = container
    this.header = null
    this.jpegTables = null
    this.dict = {}
    this.fonts = {
        byId: {},
        byName: {},
        byStyle: {}
    }
    this.protect = null
    this.cssView = new CssView()
    this.initActions = []
    this.actions = []
    this.delayId = 0
    this.useCanvas = true
    this.assets = {}
    this.renderer = renderer
    this.displayObjectId = 1
    // 
    this.actionQueue = []
//    this.finishedRead = new Eventer()
//    this.finishedLoad = new Eventer()
}

Loader.id = 1

ext.add(Loader.prototype, {

    addAction: function(callback) {
        this.actionQueue.push(callback)
    },

    $parseUrl : function(url) {
        var parts = url.split('/')
        var filename = parts[parts.length - 1]
        this.name = filename.split('.')[0]
    },

    loadSwf : function(url, onRead, onLoad) {
        this.$parseUrl(url)
        this.delayId++
        this.delay = 0
        this.onRead = onRead
        this.onLoad = onLoad
        var loader = new SwfLoader()
        loader.load(url, ext.bind(this.readSwf, this))
    },

    readSwf : function(reader) {
        reader.loader = this
        this.reader = reader
        this.header = this.reader.readSwfHeader()
        this.rootBuilder = new TimelineBuilder()
        this.rootBuilder.setDefinitionTag(this.header)
        this.target = this.rootBuilder
        this.reading = true
        if (this.onLoad) {
            this.onLoad()
        }
    },
    
    readIter : function() {
        if (this.delay > 0) {
            // wait...
            return
        }
        if (this.reading) {
            this.reading = this.reader.readTags(20000)
            if (!this.reading) {
                this.cssView.update()
                this.root = this.$rootDefinition.instantiate({}, this, null)
                this.renderer.setRoot(this.root)
                this.doInitActions()
                if (this.onRead) {
                    this.onRead()
                }
            }
        }
    },

    frameIter : function() {
        // if the next frame is not ready, pause
        if (this.root.frameReady(this.root.getPlayhead())) {
            this.root.enterFrame()
            this.doActions()
            this.renderer.draw()
        }
    },

    isSkipTag : function(header) {
        //var types = fljs.swf.TagTypes
        switch (header.TagType) {
        case 19://types.SoundStreamBlock:
            return true
        
        default:
            return false
        }
    },

    onTag : function(tag, target, frames) {
        //var t = fljs.swf.TagTypes
        switch (tag.header.TagType) {
        case 20://t.DefineBitsLossless:
        case 36://t.DefineBitsLossless2:
            this.defineImage(tag)
            break
        
        case 34://t.DefineButton2:
            this.defineButton(tag)
            break
        
        case 37://t.DefineEditText:
            this.defineEditText(tag)
            break
        
        case 11://t.DefineText:
        case 33://t.DefineText2:
            this.defineText(tag)
            break
        /*
        case t.DefineVideoStream:
            //this.defineVideo(tag)
            break
        */
        case 6://t.DefineBits:
        case 21://t.DefineBitsJpeg2:
        case 35://t.DefineBitsJpeg3:
            this.defineDelayedImage(tag)
            break

        case 10://t.DefineFont:
        case 48://t.DefineFont2:
        case 75://t.DefineFont3:
            this.defineFont(tag)
            break
        
        case 13://t.DefineFontInfo:
        case 62://t.DefineFontInfo2:
            this.defineFontInfo(tag)
            break
        
        case 2://t.DefineShape:
        case 22://t.DefineShape2:
        case 32://t.DefineShape3:
        case 83://t.DefineShape4:
            this.defineShape(tag)
            break
        /*
        case t.DefineSound:
            //this.defineSound(tag)
            break
*/
        case 39://t.DefineSprite:
            this.target = new TimelineBuilder()
            this.target.setDefinitionTag(tag)
            break

        case 4://t.PlaceObject:
        case 26://t.PlaceObject2:
        case 70://t.PlaceObject3:
        case 5://t.RemoveObject:
        case 28://t.RemoveObject2:
            this.target.addTimelineTag(tag)
            break

        // XXX: not a frame tag, right?
        case 59://t.DoInitAction:
            this.addInitAction(tag.Actions)
            break
        
        case 12://t.DoAction:
        case 9://t.SetBackgroundColor:
        case 15://t.StartSound:
        case 19://t.SoundStreamBlock:
        case 18://t.SoundStreamHead:
        case 45://t.SoundStreamHead2:
            this.target.addFrameTag(tag)
            break
        
        case 0://t.End:
            this.target.end()
            this.defineSprite(this.target.getTimeline())
            this.target = this.rootBuilder
            break
        
        case 56://t.ExportAssets:
            this.defineExportAssets(tag)
            break
        
        case 43://t.FrameLabel:
            this.target.setFrameLabel(tag.Name)
            break
        
        case 8://t.JpegTables:
            if (tag.JpegData) {
                this.jpegTables = tag
            }
            break
        
        case 24://t.Protect:
            this.protect = tag
            break

        case 1://t.ShowFrame:
            this.target.nextFrame()
            break
        
        default:
            break
        }
    },

    defineSprite : function(timeline) {
        var def = new MovieClipDef(timeline)
        if (def.isRoot()) {
            this.$rootDefinition = def
        }
        else {
            this.$define(def)
        }
    },

    defineImage : function(tag) {
        if (!tag.canvas) {
            this.defineDelayedExternalImage(tag)
            return
        }
        var def = new BitmapDef(tag)
        this.renderer.defineBitmap(def)
        this.$define(def)
    },

    defineButton : function(tag) {
        var builder = new TimelineBuilder()
        builder.buildButtonTimeline(tag)
        var timeline = builder.getTimeline()
        var def = new MovieClipDef(timeline)
        this.$define(def)
    },
/*
    defineEditText : function(tag) {
        var builder = new TextBuilder(this)
        builder.useCanvas = this.useCanvas
        var def = tag.def = builder.buildEdit(tag)
        def.tag = tag
        this.dict[tag.CharacterId] = def
    },
*/

    defineText : function(tag) {
        var def = new TextDef(tag, this.fonts)
        this.renderer.defineText(def)
        this.$define(def)
    },

/*
    defineVideo : function(tag) {
    
    },
*/
    defineDelayedExternalImage : function(tag) {
        var img = new Image()
        tag.delay = 1
        img.addEventListener('load', ext.bind(this.onLoadImageData, this, this.delayId, tag, img))
        img.addEventListener('error', ext.bind(this.onLoadImageData, this, this.delayId, tag, img))
        this.delay++
        img.src = 'data/' + this.name + '-' + tag.CharacterId + '.png'
    },

    defineDelayedImage : function(tag) {
        if (env.loadExtResources()) {
            // TODO
        }
        else {
            var jpeg = new Image()
            var alpha
            tag.delay = 1
            if (tag.alphaDataUri) {
                alpha = new Image()
                tag.delay++
                alpha.addEventListener('load', ext.bind(this.onLoadImageData, this, this.delayId, tag, jpeg, alpha))
                alpha.addEventListener('error', ext.bind(this.onLoadImageData, this, this.delayId, tag, jpeg, alpha))
                alpha.src = tag.alphaDataUri
            }
            jpeg.addEventListener('load', ext.bind(this.onLoadImageData, this, this.delayId, tag, jpeg, alpha))
            jpeg.addEventListener('error', ext.bind(this.onLoadImageData, this, this.delayId, tag, jpeg, alpha))
            this.delay++
            jpeg.src = tag.DataUri
        }
    },
    
    onLoadImageData : function(delayId, tag, jpeg, alpha) {
        // ignore if we're now loading a different swf
        if (this.delayId != delayId) {
            this.delay--
            return
        }
        if (--tag.delay) {
            return
        }
        //var t = fljs.swf.TagTypes
        switch (tag.header.TagType) {
        case 35://t.DefineBitsJpeg3:
            var canvas = document.createElement('canvas')
            canvas.width = tag.Width
            canvas.height = tag.Height
            var ctx = canvas.getContext('2d')
            if (alpha.complete) {
                /*
                for (var i = 0; i < tag.Height; i++) {
                    ctx.drawImage(alpha, i * tag.Width, 0, tag.Width, 1, 0, i, tag.Width, 1)
                }
                */
                ctx.drawImage(alpha, 0, 0)
            }
            ctx.globalCompositeOperation = 'source-in'
            if (jpeg.complete) {
                ctx.drawImage(jpeg, 0, 0)
            }
            tag.canvas = canvas
            break
        
        default:
            tag.image = jpeg
        }
        var def = new BitmapDef(tag)
        this.renderer.defineBitmap(def)
        this.$define(def)
        this.delay--
        return true
    },    

    defineFont : function(tag) {
        if (tag.header.TagType == 10/*fljs.swf.TagTypes.DefineFont*/) {
            tag.CodeTable = []
            for (var i in tag.GlyphShapeTable) {
                tag.CodeTable.push(i)
            }
            tag.FontName = 'font-no-info-' + tag.FontId
            tag.FontFlagsBold = false
            tag.FontFlagsItalic = false
        }
        var def = {
            tag: tag,
            style: [tag.Name, !!tag.FontFlagsBold, !!tag.FontFlagsItalic].toString()
        }
        var f = this.fonts
        f.byId[tag.FontId] = f.byName[tag.FontName] = f.byStyle[def.style] = def
        this.renderer.defineFont(def)
    },

    defineFontInfo : function(tag) {
        var font = this.fonts.byId[tag.FontId]
        if (!font) {
            return
        }
        tag.GlyphShapeTable = font.tag.GlyphShapeTable
        this.defineFont(tag)
    },

    defineShape : function(tag) {
        var def = new ShapeDef(tag)
        this.renderer.defineShape(def)
        this.$define(def)
    },

/*
    defineSound : function(tag) {
        this.container.sounds[this.SoundId] = this
    
    },
*/

    defineExportAssets : function(tag) {
        // TODO: handle case where exported tag is reexported under a different name
        for (var i = 0; i < tag.Tags.length; i++) {
            this.assets[tag.Names[i]] = tag.Tags[i]
        }
    },

    $define: function(def) {
        this.dict[def.getCharacterId()] = def
    },

    createDisplayObject: function(tag, parent) {
        var def = this.dict[tag.CharacterId]
        if (!def) {
            return null
        }
        var inst = def.instantiate(tag, this, parent)
        return inst
    },

    newDisplayObjectId: function() {
        return this.displayObjectId++
    },

    addInitAction: function(actions) {
        this.initActions.push(actions)
    },

    doInitActions: function() {
        for (var i = 0; i < this.initActions.length; i++) {
            var actions = this.initActions[i]
            this.container.as2.doInitAction(actions)
        }
    },

    doActionNow: function(target, tag) {
        this.container.as2.doAction(target, tag)
    },

    doAction: function(target, tag) {
        this.actions.push([target, tag])
    },
    
    doActions : function() {
        var action
        while (action = this.actionQueue.shift()) {
            action()
        }

        for (var i in this.actions) {
            var target = this.actions[i][0]
            var tag = this.actions[i][1]
            this.container.as2.doAction(target, tag)
        }
        this.actions = []
    }
})

exports.Loader = Loader

})

