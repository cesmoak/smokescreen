define(function(require, exports, module) {

var ext = require('lib/ext')
var as2 = require('as2/vm')
var Element = require('dom/element').Element
var SwfLoader = require('swf/swf_loader').SwfLoader
var SwfReader = require('swf/swf_reader').SwfReader
var MovieClipDef = require('def/movie_clip_def').MovieClipDef
var ShapeBuilder = require('canvas/shape_builder').ShapeBuilder
var FontBuilder = require('canvas/font_builder').FontBuilder
var TextDefBuilder = require('canvas/text_def_builder').TextDefBuilder
var CssView = require('player/css_view').CssView
var BitmapDef = require('def/bitmap_def').BitmapDef
var As2Decompiler = require('tool/as2_decompiler').As2Decompiler

var TagTypes = {
    End: 0,
    ShowFrame: 1,
    DefineShape: 2,
    PlaceObject: 4,
    RemoveObject: 5,
    DefineBits: 6,
    JpegTables: 8,
    SetBackgroundColor: 9,
    DefineFont: 10,
    DefineText: 11,
    DoAction: 12,
    DefineFontInfo: 13,
    DefineSound: 14,
    StartSound: 15,
    SoundStreamHead: 18,
    SoundStreamBlock: 19,
    DefineBitsLossless: 20,
    DefineBitsJpeg2: 21,
    DefineShape2: 22,
    Protect: 24,
    PlaceObject2: 26,
    RemoveObject2: 28,
    DefineShape3: 32,
    DefineText2: 33,
    DefineButton2: 34,
    DefineBitsJpeg3: 35,
    DefineBitsLossless2: 36,
    DefineEditText: 37,
    DefineSprite: 39,
    FrameLabel: 43,
    SoundStreamHead2: 45,
    DefineFont2: 48,
    ExportAssets: 56,
    DoInitAction: 59,
    DefineFontInfo2: 62,
    PlaceObject3: 70,
    DefineFontAlignZones: 73,
    DefineFont3: 75,
    DoAbc: 82,
    DefineShape4: 83
}

var TagNames = {
    0 : 'End',
    1 : 'ShowFrame',
    2 : 'DefineShape',
    4 : 'PlaceObject',
    5 : 'RemoveObject',
    6 : 'DefineBits',
    8 : 'JpegTables',
    9 : 'SetBackgroundColor',
    10 : 'DefineFont',
    11 : 'DefineText',
    12 : 'DoAction',
    13 : 'DefineFontInfo',
    14 : 'DefineSound',
    15 : 'StartSound',
    18 : 'SoundStreamHead',
    19 : 'SoundStreamBlock',
    20 : 'DefineBitsLossless',
    21 : 'DefineBitsJPEG2',
    22 : 'DefineShape2',
    24 : 'Protect',
    26 : 'PlaceObject2',
    28 : 'RemoveObject2',
    32 : 'DefineShape3',
    33 : 'DefineText2',
    34 : 'DefineButton2',
    35 : 'DefineBitsJpeg3',
    36 : 'DefineBitsLossless2',
    37 : 'DefineEditText',
    39 : 'DefineSprite',
    43 : 'FrameLabel',
    45 : 'SoundStreamHead2',
    48 : 'DefineFont2',
    56 : 'ExportAssets',
    59 : 'DoInitAction',
    62 : 'DefineFontInfo2',
    70 : 'PlaceObject3',
    73 : 'DefineFontAlignZones',
    75 : 'DefineFont3',
    82 : 'DoAbc',
    83 : 'DefineShape4'
}

var ClipEventFlags = [
    'ClipEventKeyUp',
    'ClipEventKeyDown',
    'ClipEventMouseUp',
    'ClipEventMouseDown',
    'ClipEventMouseMove',
    'ClipEventUnload',
    'ClipEventEnterFrame',
    'ClipEventLoad',
    'ClipEventDragOver',
    'ClipEventRollOut',
    'ClipEventRollOver',
    'ClipEventReleaseOutside',
    'ClipEventRelease',
    'ClipEventPress',
    'ClipEventInitialize',
    'ClipEventData',
    null,
    null,
    null,
    null,
    null,
    'ClipEventConstruct',
    'ClipEventKeyPress',
    'ClipEventDragOut'
]

var SwfInspector = function(container) {
    this.container = new Element(container)
    this.context = this.container
    this.target = this.rootDef = new MovieClipDef()
    this.dict = {}
    this.charas = {}
    this.fonts = {
        byId: {},
        byName: {},
        byStyle: {}
    }
    this.svgView = new SvgView()
    this.cssView = new CssView()
    this.useCanvas = true
    this.delayId = 0
    this.delay = 0
    this.decompiler = new As2Decompiler()
}
ext.add(SwfInspector.prototype, {
    
    load : function(url) {
        //debugger
        var loader = new SwfLoader()
        loader.load(url, ext.bind(this.read, this))
    },
    
    read : function(reader) {
        this.reader = reader
        reader.loader = this
        this.onSwfHeader(reader.readSwfHeader())
        this.reading = true
        this.readIter()
        // wait...
    },
    
    readIter : function() {
        if (this.reading && this.delay == 0) {
            this.reading = this.reader.readTags(20000)
        }
        if (this.reading) {
            setTimeout(ext.bind(this.readIter, this), 10)
        }
        else {
            this.cssView.update()
            this.drawTimeline(this.rootDef)
        }
    },
    
    drawTimeline : function(def) {
        /*
        var xscale = 5
        var yscale = 10
        var canvas = document.createElement('canvas')
        canvas.style.border = '1px solid black'
        canvas.width = def.frames.length * xscale
        canvas.height = def.depths.length * yscale
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
        this.container.element.appendChild(canvas)
        */
    },
    
    field : function(name, value, parent) {
        var el = new Element()
        el.create('span')
        el.set('class', 'field')
        el.appendText([name, ': ', value].join(''))
        el.update()
        parent.append(el)
    },
    
    fields : function(fields, className, context) {
        var el = new Element()
        el.create('div')
        var classes = ['fields']
        if (className) {
            classes.push(className)
        }
        el.set('class', classes.join(' '))
        for (var i in fields) {
            this.field(fields[i][0], fields[i][1], el)
        }
        el.update()
        if (!context) {
            context = this.context
        }
        context.append(el)
    },
    
    rect : function(rect) {
        return '(' + [rect.Xmin, rect.Ymin, rect.Xmax, rect.Ymax] + ')'
    },
    
    actions : function(actions, triggers) {
        var inspector = new ActionInspector()
        var html = inspector.inspect(actions)
        el = new Element()
        el.create('div')
        el.element.innerHTML = ''
        if (triggers) {
            el.element.innerHTML += '<h3>Triggers: ' + triggers + '</h3>'
        }
        el.element.innerHTML += html
        this.decompile(actions, el)
        return el
    },
    
    decompile : function(actions, el) {
        var self = this
        setTimeout(function() {
            el.element.innerHTML += 
                '<hr/>' + 
                '<pre>' + 
                    self.decompiler.emit(self.decompiler.evalActions(actions)) + 
                '</pre>'
        }, 10)
    },
    
    onSwfHeader : function(header) {
        this.fields([
            ['Sig', header.Signature],
            ['Ver', header.Version],
            ['Len', header.FileLength],
            ['Size', this.rect(header.FrameSize)],
            ['Rate', header.FrameRate],
            ['Frames', header.FrameCount]
        ])
    },
    
    tagHeader : function(header) {
        var name = TagNames[header.TagType]
        if (name) {
            return name
        }
        else {
            return header.TagType
        }
        //return [fljs.tool.TagNames[header.data.TagType], header.data.TagType].join(' ')
    },
    
    onTag : function(tag, target, frames) {
        var content
        var types = TagTypes
        switch (tag.header.TagType) {
        case types.DefineBitsLossless:
        case types.DefineBitsLossless2:
            tag.defId = tag.CharacterId
            var def = new BitmapDef()
            def.build(tag)
            this.dict[def.tag.CharacterId] = def
            content = new Element(def.img)
            break

        case types.DefineBits:
        case types.DefineBitsJpeg2:
        case types.DefineBitsJpeg3:
            content = new Element()
            content.create('div')
            this.defineDelayedImage(tag, content)
            break

        case types.DefineShape:
        case types.DefineShape2:
        case types.DefineShape3:
        case types.DefineShape4:
            var builder = new ShapeBuilder(this)
            var def = builder.build(tag)
            var shape = def.inst({Matrix:{}})
            shape.setX(0)
            shape.setY(0)
            content = shape.el
            break
            
        case types.DefineFontInfo:
        case types.DefineFontInfo2:
            var font = this.fonts.byId[tag.FontId]
            if (!font) {
                return
            }
            tag.GlyphShapeTable = font.tag.GlyphShapeTable
            this.defineFont(tag)
            break
            
        case types.DefineFont:
        case types.DefineFont2:
        case types.DefineFont3:
            if (tag.header.TagType == TagTypes.DefineFont) {
                tag.CodeTable = []
                for (var i in tag.GlyphShapeTable) {
                    tag.CodeTable.push(i)
                }
                tag.FontName = 'font-no-info-' + tag.FontId
                tag.FontFlagsBold = false
                tag.FontFlagsItalic = false
            }
            var builder = new FontBuilder(this)
            builder.useCanvas = this.useCanvas
            var def = tag.def = builder.buildDef(tag)
            var f = this.fonts
            f.byId[tag.FontId] = f.byName[tag.FontName] = f.byStyle[def.style] = def
            content = new Element()
            content.create('div')
            content.appendText(tag.FontName)
            var container = new Element()
            container.create('div')
            container.element.style.display = '-webkit-box'
            content.append(container)
            var builder = new TextDefBuilder(this.fonts)
            builder.useCanvas = this.useCanvas
            var letterScale = 48
            var fontScale = (tag.header.TagTypes == TagTypes.DefineFont3) ? 1/20 : 1
            for (var i = 0; i < tag.CodeTable.length; i++) {
                var lTag = {
                    Bounds: {Xmin: -letterScale, Xmax: letterScale, Ymin: -letterScale, Ymax: letterScale},
                    HasText: true,
                    FontId: tag.FontId,
                    TextColor: {Red: 0x00, Green: 0x00, Blue: 0xff, Alpha: 0xff},
                    Leading: 0,
                    Indent: 0,
                    FontHeight: letterScale,
                    InitialText: String.fromCharCode(tag.CodeTable[i])
                }
                var def = builder.buildEdit(lTag)
                var inst = def.inst(lTag)
                var ctx = inst.canvas.element.getContext('2d')
                ctx.globalCompositeOperation = 'destination-over'
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.fillStyle = 'rgba(196,196,196,1)'
                ctx.fillRect(0, 0, letterScale * 2, letterScale * 2)
                if (tag.FontFlagsHasLayout) {
                    var rect = tag.FontBoundsTable[i]
                    if (rect.Nbits > 1) {
                        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
                        ctx.lineThickness = '1'
                        ctx.save()
                        ctx.translate(letterScale, letterScale)
                        ctx.strokeRect(rect.Xmin, rect.Ymin, (rect.Xmax - rect.Xmin), (rect.Ymax - rect.Ymin))
                        ctx.restore()
                    }
                    else {
                        ctx.globalCompositeOperation = 'source-over'
                        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
                        ctx.lineWidth = 1
                        ctx.save()
                        ctx.translate(letterScale + 0.5, letterScale + 0.5)
                        ctx.strokeRect(
                            0, 
                            0, 
                            tag.FontAdvanceTable[i] / 1024 * letterScale * fontScale / 20, 
                            -tag.FontAscent / 1024 * letterScale * fontScale / 20
                        )
                        ctx.restore()
                    }
                }
                container.appendText(i + '[' + String.fromCharCode(tag.CodeTable[i]) + ']')
                var cont = new Element()
                cont.create('div')
                var style = cont.element.style
                style.position = 'relative'
                style.left = letterScale + 'px'
                style.top = letterScale + 'px'
                style.width = (letterScale * 2) + 'px'
                style.height = (letterScale * 2) + 'px'
                cont.append(inst.el)
                container.append(cont)
            }
            break
            
        case types.DefineText:
        case types.DefineText2:
            var builder = new TextDefBuilder(this.fonts)
            builder.useCanvas = this.useCanvas
            var def = tag.def = builder.build(tag)
            def.tag = tag
            this.dict[tag.CharacterId] = def
            var text = def.inst({Matrix:{}})
            text.setX(0)
            text.setY(0)
            content = text.el
            break
            
        case types.DefineEditText:
            var builder = new TextDefBuilder(this.fonts)
            builder.useCanvas = this.useCanvas
            var def = tag.def = builder.buildEdit(tag)
            def.tag = tag
            this.dict[tag.CharacterId] = def
            var text = def.inst({Matrix:{}})
            text.setX(0)
            text.setY(0)
            content = text.el
            break
            
        case types.DefineSprite:
            this.target = new MovieClipDef()
            break

        case types.PlaceObject:
        case types.PlaceObject2:
        case types.PlaceObject3:
        case types.RemoveObject:
        case types.RemoveObject2:
            this.target.addTimelineTag(tag)
            break

        case types.DoAction:
        case types.DoInitAction:
        case types.SetBackgroundColor:
        case types.StartSound:
        case types.SoundStreamBlock:
        case types.SoundStreamHead:
        case types.SoundStreamHead2:
            this.target.addFrameTag(tag)
            break

        case types.End:
            // not root
            //if (this.target.tag) {
                this.defineSprite(this.target)
            //}
            this.target = this.rootDef
            break

        case types.FrameLabel:
            this.target.setFrameLabel(tag.Name)
            break

        case types.ShowFrame:
            this.target.nextFrame()
            break

        default:
            break
        }
        var className
        var el
        var fields = [
            ['Tag', this.tagHeader(tag.header)]
        ]
        if (tag.defId) {
            fields.push(['DefId', tag.defId])
        }
        switch (TagNames[tag.header.TagType]) {
        case 'FrameLabel':
            fields.push(['Name', tag.Name])
            break
            
        case 'DefineButton2':
            if (tag.Actions) {
                el = new Element()
                el.create('div')
                var records = tag.Actions
                for (var i in records) {
                    var record = records[i]
                    var triggers = []
                    for (var j in record) {
                        if (j.substr(0, 4) == 'Cond' && j != 'CondActionSize' && record[j]) {
                            triggers.push(j)
                        }
                    }
                    el.append(this.actions(record.Actions, triggers))
                }
            }
            break
            
        case 'ExportAssets':
            el = new Element()
            el.create('div')
            var assets = []
            for (var i in tag.Tags) {
                var charaId = tag.Tags[i]
                var name = tag.Names[i]
                assets.push([charaId, name])
                this.fields(assets, null, el)
            }
            break

        case 'SetBackgroundColor':
            var color = tag.BackgroundColor
            fields.push(['Color', '(' + [color.Red, color.Green, color.Blue] + ')'])
            break

        case 'PlaceObject2':
        case 'PlaceObject3':
            fields.push(['Depth', tag.Depth])
            if (tag.Name) {
                fields.push(['Name', tag.Name])
            }
            if (tag.PlaceFlagHasImage) {
                fields.push(['HasImage', true])
            }
            if (tag.ClipActions) {
                //debugger
                el = new Element()
                el.create('div')
                var records = tag.ClipActions.ClipActionRecords
                for (var i in records) {
                    var record = records[i]
                    var triggers = []
                    for (var j in ClipEventFlags) {
                        if (record.EventFlags & ClipEventFlags[j]) {
                            triggers.push(j)
                        }
                    }
                    /*
                    for (var j = 31; j >= 0; j--) {
                        if (record.EventFlags & (1 << j)) {
                            triggers.push(fljs.tool.ClipEventFlags[31 - j])
                        }
                    }
                    */
                    if (record.KeyCode) {
                        triggers.push('key:' + record.KeyCode)
                    }
                    el.append(this.actions(record.Actions, triggers))
                }
            }
            break

        case 'DoAction':
        case 'DoInitAction':
            el = this.actions(tag.Actions)
            break
            
        case 'ShowFrame':
            fields.push(['#', frames[0]])
            className = 'show-frame'
            break
        }
        if (tag.CharacterId) {
            fields.push(['CharaId', tag.CharacterId])
        }
        fields.push(['Size', tag.header.TagLength])
        this.fields(fields, className)
        if (el) {
            this.context.append(el)
        }
        if (content) {
            var cont = new Element()
            cont.create('div')
            var style = cont.element.style
            style.position = 'relative'
            style.width = '500px'
            style.height = '500px'
            style.backgroundColor = '#7f7f7f'
            this.context.append(cont)
            cont.append(content)
        }
        if (TagNames[tag.header.TagType] == 'DefineSprite') {
            var ctx = new Element()
            ctx.create('div')
            ctx.set('class', 'sprite')
            ctx.update()
            this.context.append(ctx)
            this.context = ctx
        }
        if (TagNames[tag.header.TagType] == 'End') {
            if (target) {
                this.context = this.container
            }
        }
    },
    
    defineSprite : function(def) {
        def.build(this.cssView)
        this.charas[def.charaId] = def
    },

    defineDelayedImage : function(tag, content) {
        if (env.loadExtResources()) {
            // TODO
        }
        else {
            var jpeg = document.createElement('img')//new Image()
            var alpha
            tag.delay = 1
            if (tag.alphaDataUri) {
                alpha = document.createElement('img')//new Image()
                tag.delay++
                alpha.addEventListener('load', ext.bind(this.onLoadImageData, this, this.delayId, tag, jpeg, alpha, content))
                alpha.src = tag.alphaDataUri
            }
            jpeg.addEventListener('load', ext.bind(this.onLoadImageData, this, this.delayId, tag, jpeg, alpha, content))
            this.delay++
            jpeg.src = tag.DataUri
        }
    },
    
    onLoadImageData : function(delayId, tag, jpeg, alpha, content) {
        // ignore if we're now loading a different swf
        if (this.delayId != delayId) {
            return
        }
        if (--tag.delay) {
            return
        }
        var t = TagTypes
        switch (tag.header.TagType) {
        case t.DefineBitsJpeg3:
            var canvas = document.createElement('canvas')
            canvas.width = tag.Width
            canvas.height = tag.Height
            var ctx = canvas.getContext('2d')
            /*
            for (var i = 0; i < tag.Height; i++) {
//                ctx.drawImage(alpha, i * tag.Width, 0, tag.Width, 1, 0, i, tag.Width, 1)
            }
            */
            ctx.drawImage(alpha, 0, 0)
            ctx.globalCompositeOperation = 'source-in'
            ctx.drawImage(jpeg, 0, 0)
            tag.canvas = canvas
            break
        
        default:
            tag.image = jpeg
        }
        var def = new BitmapDef()
        def.build(tag)
        this.dict[tag.CharacterId] = def
        this.delay--
        content.element.appendChild(def.img)
        return true
    },    
    
    defineFont : function(tag) {
        if (tag.header.TagType == TagTypes.DefineFont) {
            tag.CodeTable = []
            for (var i in tag.GlyphShapeTable) {
                tag.CodeTable.push(i)
            }
            tag.FontName = 'font-no-info-' + tag.FontId
            tag.FontFlagsBold = false
            tag.FontFlagsItalic = false
        }
        var builder = new FontBuilder(this)
        builder.useCanvas = this.useCanvas
        var def = tag.def = builder.buildDef(tag)
        var f = this.fonts
        f.byId[tag.FontId] = f.byName[tag.FontName] = f.byStyle[def.style] = def
    }
})


var ActionInspector = function() {
    this.eachIndent = '&nbsp;&nbsp;'
}
ext.add(ActionInspector.prototype, {

    inspectLive : function(ctx, ops) {
        this.showFunctionDefinitions = false
        this.consts = ctx.consts
        this.clearIndents()
        this.out = []
        this.opIndex = []
        this.depths = []
        this.actions(ops)
    },

    inspect : function(actions) {
        this.showFunctionDefinitions = true
        this.consts = []
        this.clearIndents()
        this.out = []
        this.opIndex = []
        this.depths = []
        this.actions(actions)
        return this.output()
    },
    
    actions : function(actions, ctxDepth) {
        if (!ctxDepth) {
            ctxDepth = 0
        }
        if (ctxDepth > 0) {
            if (this.showFunctionDefinitions) {
                this.indentFor(actions.length, false)
            }
            else {
                return
            }
        }
        this.depths.push([])
        var codes = as2.ActionCode
        for (var i in actions) {
            var action = actions[i]
            if (ctxDepth == 0) {
                this.opIndex.push(this.out.length)
            }
            this.depths[this.depths.length - 1].push(this.out.length)
            switch (action.ActionCode) {
            case codes.ConstantPool:
                this.consts = []
                for (var j in action.ConstantPool) {
                    this.consts.push(action.ConstantPool[j])
                }
                this.emit('ConstantPool (' + this.consts + ')')
                break

            case codes.Push:
                var vals = []
                for (var j = 0; j < action.Values.length; j++) {
                    vals.push(this.value(action.Values[j]))
                }
                this.emit('Push (' + vals + ')')
                break

            case codes.GetVariable:
                this.emit('GetVariable [name]')
                break

            case codes.CallMethod:
                this.emit('CallMethod [method, object, nArgs, ...]')
                break

            case codes.SetVariable:
                this.emit('SetVariable [value, path]')
                break

            case codes.Divide:
                this.emit('Divide [a, b]')
                break

            case codes.Multiply:
                this.emit('Multiply [a, b]')
                break

            case codes.Equals2:
                this.emit('Equals2 [a, b]')
                break

            case codes.Not:
                this.emit('Not [a]')
                break

            case codes.If:
                var j = +i + 1
                var addr = actions[j].address
                while (actions[j] && actions[j].address != addr + action.BranchOffset) {
                    if (action.BranchOffset > 0) {
                        j += 1
                    }
                    else {
                        j -= 1
                    }
                }
                this.emit('If Not (ops:' + (j - i) + ', bytes:' + action.BranchOffset + ') [cond]')
                this.indentFor(j - i, true)
                break

            case codes.Pop:
                this.emit('Pop []')
                break

            case codes.WaitForFrame:
                this.emit('WaitForFrame (frame:' + action.Frame + ', skipCount:' + action.SkipCount + ')')
                this.indentFor(action.SkipCount, true)
                break

            case codes.GotoFrame:
                this.emit('GotoFrame (frame:' + action.Frame + ')')
                break

            case codes.GetUrl:
                this.emit('GetUrl (url:' + action.UrlString + ', target:' + action.TargetString + ')')
                break

            case codes.GetUrl2:
                var didOut = false
                if (action.LoadTargetFlag) {
                }
                else {
                    if (action.LoadVariablesFlag) {
                    }
                    else {
                        if (action.SendVarsMethod) {
                        }
                        else {
                            this.emit('GetUrl2 (loadTarget:' + action.LoadTargetFlag + ', loadVars:' + action.LoadVariablesFlag + ', sendVars:' + action.SendVarsMethod + ') [target, url]')
                            didOut = true
                        }
                    }
                }
                if (!didOut) {
                    this.emit('GetUrl2 (loadTarget:' + action.LoadTargetFlag + ', loadVars:' + action.LoadVariablesFlag + ', sendVars:' + action.SendVarsMethod + ')')
                }
                break

            case codes.Play:
                this.emit('Play')
                break

            case codes.Stop:
                this.emit('Stop')
                break

            case codes.DefineFunction:
                this.emit('DefineFunction (name:' + action.FunctionName + ')')
                this.actions(action.Code, ctxDepth + 1)
                break

            case codes.SetTarget:
                this.emit('SetTarget (name:' + action.TargetName + ')')
                break

            case codes.PreviousFrame:
                this.emit('PreviousFrame')
                break

            case codes.NextFrame:
                this.emit('NextFrame')
                break

            case codes.Jump:
                var sign = action.BranchOffset > 0 ? 1 : -1
                var j = +i + 1
                var addr = actions[j].address
                while (actions[j] && actions[j].address != addr + action.BranchOffset) {
                    j += sign
                }
                this.emit('Jump (offset:' + action.BranchOffset + ', ops:' + (j - i) + ')')
//                this.indentFor(j - i)
                break

            case codes.NewObject:
                this.emit('NewObject [name, nArgs, ...]')
                break

            case codes.GetMember:
                this.emit('GetMember [name, obj]')
                break

            case codes.SetMember:
                this.emit('SetMember [value, name, obj]')
                break

            case codes.InitObject:
                this.emit('InitObject [nElems, (val, name)...]')
                break

            case codes.Trace:
                this.emit('Trace [val]')
                break

            case codes.Increment:
                this.emit('Increment [val]')
                break

            case codes.With:
                this.emit('With [obj]')
                this.actions(action.Code, ctxDepth + 1)
                break

            case codes.End:
                this.emit('End')
                break

            case codes.DefineFunction2:
                this.emit('DefineFunction2 (name:' + action.FunctionName + ')')
                this.actions(action.Code, ctxDepth + 1)
                break

            case codes.StoreRegister:
                this.emit('StoreRegister (num:' + action.RegisterNumber + ') [val(peek)]')
                break

            case codes.GotoLabel:
                this.emit('GotoLabel (label:' + action.Label + ')')
                break

            case codes.StartDrag:
                this.emit('StartDrag [target, lockCenter, constrain, (if constrain)y2, x2, y1, x1]')
                break

            case codes.EndDrag:
                this.emit('EndDrag')
                break

            case codes.Add2:
                this.emit('Add2 [arg1, arg2]')
                break
                
            case codes.Subtract:
                this.emit('Subtract [a, b]')
                break

            case codes.DefineLocal:
                this.emit('DefineLocal [val, name]')
                break

            case codes.PushDuplicate:
                this.emit('PushDuplicate [val]')
                break

            case codes.GetTime:
                this.emit('GetTime')
                break

            case codes.Greater:
                this.emit('Greater [arg1, arg2]')
                break

            case codes.CallFunction:
                this.emit('CallFunction [name, nArgs, ...]')
                break

            case codes.DefineLocal2:
                this.emit('DefineLocal2 [name]')
                break

            case codes.TypeOf:
                this.emit('TypeOf [val]')
                break

            case codes.ToInteger:
                this.emit('ToInteger [val]')
                break

            case codes.Return:
                this.emit('Return [val]')
                break
                
            case codes.GotoFrame2:
                this.emit('GotoFrame2 [frame]')
                break
            
            case codes.Less2:
                this.emit('Less2 [arg1, arg2]')
                break

            case codes.Decrement:
                this.emit('Decrement [val] => [val--]')
                break

            case codes.Delete:
                this.emit('Delete [name, obj] -> {delete obj[name]}')
                break

            case codes.GetProperty:
                this.emit('GetProperty [index, target] -> [target[PROPERTY[index]]]')
                break

            case codes.SetProperty:
                this.emit('SetProperty [val, index, target] -> {target[PROPERTY[index]] = val}')
                break

            case codes.StrictEquals:
                this.emit('StrictEquals [arg1, arg2] -> [arg1 === arg2]')
                break
            
            case codes.ToNumber:
                this.emit('ToNumber [obj] -> [obj.valueOf()]')
                break

            case codes.ToString:
                this.emit('ToString [obj] -> [obj.toString()]')
                break
                
            case codes.InitArray:
                this.emit('InitArray [nArgs, arg1, ...] -> [[arg1, ...]]')
                break
                
            case codes.NewMethod:
                this.emit('NewMethod [name, obj, nArgs, arg1, ...] -> [newObj]')
                break
                
            case codes.Enumerate2:
                this.emit('Enumerate2 [obj] -> [slotName1, ..., null]')
                break
                
            case codes.Extends:
                this.emit('Extends [superclass, subclass] -> {setup inheritance}')
                break
                
            case codes.InstanceOf:
                this.emit('InstanceOf [ctor, obj] -> [obj instanceof ctor]')
                break

            case codes.BitAnd:
                this.emit('BitAnd [a, b] -> [a & b]')
                break
                
            case codes.BitRShift:
                this.emit('BirRShift [count, val] -> [val >> count]')
                break
            
            case codes.CastOp:
                this.emit('CastOp [obj, ctor] -> [ctor(obj)]')
                break
                
            case codes.BitLShift:
                this.emit('BitLShift [count, val] -> [val << count]')
                break
                
            case codes.BitOr:
                this.emit('BitOr [a, b] -> [a | b]')
                break

            default:
                this.emit('Unk 0x' + action.ActionCode.toString(16))
            }
            this.nextStmt()
        }
        this.depths.pop()
    },
    
    value : function(val) {
        switch (val.Type) {
        case 0: // string
            return 'String(' + val.Value + ')'
        case 1: // number
            return 'Float(' + val.Value + ')'
        case 2: // null
            return 'null'
        case 3: // undefined
            return 'undefined'
        case 4: // register lookup
            return 'Register#' + val.Value + ''
        case 5: // boolean
            return 'Boolean(' + val.Value + ')'
        case 6:
            return 'Double(' + val.Value + ')'
        case 7:
            return 'Int(' + val.Value + ')'
        case 8: // constants lookup
            return 'Const(' + this.consts[val.Value] + ')'
        case 9:
            return 'Const(' + this.consts[val.Value] + ')'

        default:
            return '[ERR: unknown value]'
        }
    },

    clearIndents : function() {
        this.indents = [[]]
        this.indent = ''
    },

    indentFor : function(stmts, include) {
        this.emit('{')
        if (stmts > 0) {
            if (include && this.indents.length) {
                this.indents[0].unshift(stmts)
            }
            else {
                this.indents.unshift([stmts])
            }
            this.indent += this.eachIndent
        }
        else {
            this.emit('}')
        }
    },
    
    nextStmt : function() {
        var included = this.indents[0]
        for (var i in included) {
            included[i] -= 1
        }
        if (included && included[0] == 0) {
            while (included && included[0] == 0) {
                included.shift()
                if (included.length == 0) {
                    this.indents.shift()
                    included = this.indents[0]
                }
                this.indent = this.indent.substr(this.eachIndent.length)
                this.emit('}')
            }
        }
        else {
//            this.emit('}')
        }
    },
    
    emit : function(text) {
        var curr = this.depths[this.depths.length - 1].length - 1
        var prefix
        if (curr != this.lastOpIndex) {
            prefix = curr + ' '
        }
        else {
            prefix = ''
        }
        this.lastOpIndex = curr
        this.out.push(prefix + this.indent + text)
    },
    
    output : function() {
        return '<tt>'+this.out.join('<br/>')+'</tt>'
    }
})

exports.TagType = TagTypes
exports.TagNames = TagNames
exports.ClipEventFlags = ClipEventFlags
exports.SwfInspector = SwfInspector

})
