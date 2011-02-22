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
var zip = require('lib/zip')
var LittleEndianStringReader = require('util/little_endian_string_reader').LittleEndianStringReader
var PngWriter = require('util/png_writer').PngWriter
var SwfReader = require('swf/swf_reader').SwfReader
var BigEndianStringReader = require('util/big_endian_string_reader').BigEndianStringReader

/*
fljs.swf.TagTypes = {
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
*/
var SwfReader = function(stream) {
    this.stream = stream
    this.twipsPerPixel = 20
    this.logger = ext.console('parse')
    this.loader = null
    this.bytesRead = 0
    this.target = null
    this.frames = [0]
};
ext.add(SwfReader.prototype, {

    hasMore : function() {
        return this.stream.hasMore()
    },

    skipBytes : function(count) {
        this.stream.skipBytes(count)
    },

    bytes : function(count) {
        return this.stream.bytes(count)
    },

    ui8 : function() {
        return this.stream.uByte()
    },

    ui16 : function() {
        var value = this.stream.uShort()
        return value
    },

    ui32 : function() {
        return this.stream.nextULong()
    },
    
    si8 : function() {
        return this.stream.sByte()
    },

    si16 : function() {
        return this.stream.sShort()
    },

    si32 : function() {
        return this.stream.nextSLong()
    },
        
    ub : function(bits) {
        return this.stream.nextUBits(bits)
    },

    sb : function(bits) {
        return this.stream.nextSBits(bits)
    },
    
    readFB : function(bits) {
        return this.stream.nextFBits(bits)
    },

    readFixed : function() { 
        return this.stream.nextFLong()
    },
    
    readFixed8 : function() {
        return this.stream.nextFShort()        
    },
    
    readFloat16 : function() {
        return this.stream.nextHalfFloat()
    },

    readFloat : function() {
        return this.stream.nextSingleFloat()
    },

    readFloats : function(count) {
        var floats = []
        for (var i = 0; i < count; i++) {
            floats.push(this.readFloat())
        }
        return floats
    },

    readDouble : function() {
        return this.stream.nextDoubleFloat()        
    },

    readEncodedU32 : function() {
        return this.stream.nextEncodedULong()
    },
    
    string : function() {
        return this.stream.nextString()
    },
    
    readSwfHeader : function() {
        var Signature = String.fromCharCode(
            this.ui8(),
            this.ui8(),
            this.ui8()
        )
        var Version = this.ui8()
        var FileLength = this.ui32()
        if (Signature == 'CWS') {
            var zipped = this.stream.buffer.substr(this.stream.byteIndex + 2)
            var inflated = zip.inflate(zipped)
            this.stream = new LittleEndianStringReader(inflated)
        }
        var FrameSize = this.readRect()
        var FrameRate = this.readFixed8() //this.ui16()
        var FrameCount = this.ui16()
        var header = this.header = {
            Signature : Signature,
            Version : Version,
            FileLength : FileLength,
            FrameSize : FrameSize,
            FrameRate : FrameRate,
            FrameCount : FrameCount
        }
        return header
    },
    
    readRecordHeader : function() {
        var d = {}
        var TagCodeAndLength = this.ui16()
        d.TagLength = TagCodeAndLength & 0x3f
        d.TagType = (TagCodeAndLength >> 6) & 0x3ff
        if (d.TagLength == 0x3f) {
            d.TagLength = this.si32()
        }
        d.tagPos = d.byteIndex = this.stream.byteIndex
        this.header = d
        return d
    },
    
    tagBytesLeft : function() {
        var header = this.header
        return header.TagLength - (this.stream.byteIndex - header.tagPos)
    },
    
    readCxform : function(alpha) {
        if (alpha) {
            this.stream.align()
        }
        var d = {}
        d.HasAddTerms = this.ub(1)
        d.HasMultTerms = this.ub(1)
        var n = d.Nbits = this.ub(4)
        d.AlphaMultTerm = 1
        d.AlphaAddTerm = 0
        if (d.HasMultTerms) {
            d.RedMultTerm = this.sb(n) / 256
            d.GreenMultTerm = this.sb(n) / 256
            d.BlueMultTerm = this.sb(n) / 256
            if (alpha) {
                d.AlphaMultTerm = this.sb(n) / 256
            }
        }
        else {
            d.RedMultTerm = 1
            d.GreenMultTerm = 1
            d.BlueMultTerm = 1
        }
        if (d.HasAddTerms) {
            d.RedAddTerm = this.sb(n)
            d.GreenAddTerm = this.sb(n)
            d.BlueAddTerm = this.sb(n)
            if (alpha) {
                d.AlphaAddTerm = this.sb(n)
            }
        }
        else {
            d.RedAddTerm = 0
            d.GreenAddTerm = 0
            d.BlueAddTerm = 0
        }
        return d
    },

    readClipActions : function() {
        this.ui16()
        var AllEventFlags = this.readClipEventFlags()
        var ClipActionRecords = this.readClipActionRecords()
        return {
            AllEventFlags : AllEventFlags,
            ClipActionRecords : ClipActionRecords
        }
    },
    
    readClipActionRecords : function() {
        var records = []
        var record
        while (record = this.readClipActionRecord()) {
            records.push(record)
        }
        return records
    },
    
    readClipActionRecord : function() {
        var EventFlags = this.readClipEventFlags()
        if (!EventFlags) {
            return null
        }
        var ActionRecordSize = this.ui32()
        var bytesToRead = ActionRecordSize
        var KeyCode
        if (EventFlags & (1 << 9)) { //fljs.swf.ClipEventFlags.ClipEventKeyPress
            KeyCode = this.ui8()
            bytesToRead -= 1
        }
        var Actions = this.readActionRecords(bytesToRead)
        return {
            EventFlags : EventFlags,
            ActionRecordSize : ActionRecordSize,
            KeyCode : KeyCode,
            Actions : Actions
        }
    },
    
    readActionRecords : function(bytes) {
        var startIndex = this.stream.byteIndex
        var actions = []
        while (this.stream.byteIndex != startIndex + bytes) {
            actions.push(this.readActionRecord())
        }
        // need for jumps at end of code block
        if (actions.length) {
            var lastAction = actions[actions.length - 1]
            if (lastAction.ActionCode != 0) {
                actions.push({
                    code: '0x0', 
                    address: lastAction.address + lastAction.Length,
                    ActionCode: 0,
                    Action: 'End'
                })
            }
        }
        return actions
    },
    
    readActionRecord : function() {
        var address = this.stream.byteIndex
        var ActionCode = this.ui8()
        var record = {
            code : '0x' + ActionCode.toString(16),
            address : address,
            ActionCode : ActionCode
        }
        if (ActionCode >= 0x80) {
            record.Length = this.ui16()
        }
        //var logger = goog.debug.Logger.getLogger('parse')
        //logger.info(record.ActionCode.toString(16) + ', ' + goog.debug.expose(record))
        switch (ActionCode) {
        
        // SWF3
            
        case 0x81 : // ActionGotoFrame
//            record.Action = 'ActionGotoFrame'
            record.Frame = this.ui16()
            break
        case 0x83 : // ActionGetURL
//            record.Action = 'ActionGetUrl'
            record.UrlString = this.string()
            record.TargetString = this.string()
            break
/*
        case 0x04 :
            record.Action = 'ActionNextFrame'
            break
        case 0x05 : 
//            record.Action = 'ActionPrevFrame'
            break
        case 0x06 :
//            record.Action = 'ActionPlay'
            break
        case 0x07 :
//            record.Action = 'ActionStop'
            break
        case 0x08 :
//            record.Action = 'ActionToggleQuality'
            break
        case 0x09 :
//            record.Action = 'ActionStopSounds'
            break
*/
        case 0x8a :
//            record.Action = 'ActionWaitForFrame'
            record.Frame = this.ui16()
            record.SkipCount = this.ui8()
            break
        case 0x8b :
//            record.Action = 'ActionSetTarget'
            record.TargetName = this.string()
            break
/*
        case 0x08 :
            record.Action = 'ActionToggleQuality'
            break
        */
        case 0x8b :
//            record.Action = 'ActionSetTarget'
            record.TargetName = this.string()
            break
        case 0x8c :
//            record.Action = 'ActionGotoLabel'
            record.Label = this.string()
            break
            
        // SWF4
            
        case 0x96 :
            this.readActionPush(record)
            break

        // ...
        case 0x99 :
//            record.Action = 'ActionJump'
            record.BranchOffset = this.si16()
            break
        case 0x9d :
//            record.Action = 'ActionIf'
            record.BranchOffset = this.si16()
            break
        case 0x9a :
//            record.Action = 'ActionGetUrl2'
            record.SendVarsMethod = this.ub(2)
            record.Reserved = this.ub(4)
            record.LoadTargetFlag = this.ub(1)
            record.LoadVariablesFlag = this.ub(1)
            break
        case 0x9f :
            this.readActionGotoFrame2(record)
            break
        case 0x8d :
//            record.Action = 'ActionWaitForFrame2'
            record.SkipCount = this.ui8()
            break
            
        // SWF5
            
        case 0x88 :
            this.readActionConstantPool(record)
            break
        case 0x9b :
            this.readActionDefineFunction(record)
            break
        case 0x94 :
            this.readActionWith(record)
            break
        case 0x87 :
//            record.Action = 'ActionStoreRegister'
            record.RegisterNumber = this.ui8()
            break

        // SWF6
        
        case 0x8e :
            this.readActionDefineFunction2(record)
            break
        case 0x8f :
            this.readActionTry(record)
            break
            
        default :
//            record.Action = 'Unknown'
            break
        }
        //logger.info(record.ActionCode.toString(16) + ', ' + goog.debug.expose(record))
        return record
    },

    readActionPush : function(record) {
        //var Count = this.ui16()
        var Count = record.Length
        var startByteIndex = this.stream.byteIndex
        var values = []
        //var logger = goog.debug.Logger.getLogger('parse')
        while (this.stream.byteIndex < startByteIndex + Count) {
            var Type = this.ui8()
            var value
            switch (Type) {
            case 0:
                value = this.string()
                break
            case 1:
                value = this.readFloat()
                break
            case 2:
                value = null
                break
            case 3:
                value = undefined
                break
            case 4:
            case 8:
                value = this.ui8()
                break
            case 5:
                value = !!this.ui8()
                break
            case 6:
                value = this.readDouble()
                break
            case 7:
                value = this.si32() // spec says UI32
                break
            case 9:
                value = this.si16() // spec says UI16
                break
            }
            //logger.info(Type + ': ' + value)
            values.push({Type : Type, Value : value})
        }
//        record.Action = 'ActionPush'
        record.Values = values
    },
    
    readActionGotoFrame2 : function(record) {
        this.ub(6)
        var SceneBiasFlag = this.ub(1)
        var PlayFlag = this.ub(1)
        var SceneBias
        if (SceneBiasFlag) {
            SceneBias = this.ui16()
        }
//        record.Action = 'ActionGotoFrame2'
        record.SceneBiasFlag = SceneBiasFlag
        record.PlayFlag = PlayFlag
        record.SceneBias = SceneBias
    },

    readActionConstantPool : function(record) {
        var Count = record.Length
        var startByteIndex = this.stream.byteIndex
        var ConstantPool = []
        //for (var i = 0; i < Count; i++) {
        var i = 0
        while (this.stream.byteIndex < startByteIndex + Count) {
            var str = this.string()
            if (i > 0) {
                ConstantPool.push(str)
            }
            i++
        }
//        record.Action = 'ActionConstantPool'
        record.Count = Count
        record.ConstantPool = ConstantPool
    },

    readActionDefineFunction : function(record) {
        var FunctionName = this.string()
        var NumParams = this.ui16()
        var Params = []
        for (var i = 0; i < NumParams; i++) {
            Params.push(this.string())
        }
        var CodeSize = this.ui16()
        var Code = this.readActionRecords(CodeSize)
//        record.Action = 'ActionDefineFunction'
        record.FunctionName = FunctionName
        record.NumParams = NumParams
        record.Parameters = Params
        record.CodeSize = CodeSize
        record.Code = Code
    },

    readActionWith : function(record) {
        var Size = this.ui16()
        var Code = this.readActionRecords(Size)
//        record.Action = 'ActionWith'
        record.Size = Size
        record.Code = Code
    },

    readActionDefineFunction2 : function(record) {
        record.FunctionName = this.string()
        record.NumParams = this.ui16()
        record.RegisterCount = this.ui8()
        record.PreloadParentFlag = this.ub(1)
        record.PreloadRootFlag = this.ub(1)
        record.SupressSuperFlag = this.ub(1)
        record.PreloadSuperFlag = this.ub(1)
        record.SupressArgumentsFlag = this.ub(1)
        record.PreloadArgumentsFlag = this.ub(1)
        record.SupressThisFlag = this.ub(1)
        record.PreloadThisFlag = this.ub(1)
        this.ub(7)
        record.PreloadGlobalFlag = this.ub(1)
        record.Parameters = []
        for (var i = 0; i < record.NumParams; i++) {
            record.Parameters.push(this.readRegisterParam())
        }
        record.CodeSize = this.ui16()
        var Code = this.readActionRecords(record.CodeSize)
//        record.Action = 'ActionDefineFunction2'
        record.Code = Code
    },

    readRegisterParam : function() {
        return {
            Register : this.ui8(),
            ParamName : this.string()
        }
    },

    readActionTry : function(record) {
        this.ub(5)
        record.CatchInRegisterFlag = this.ub(1)
        record.FinallyBlockFlag = this.ub(1)
        record.CatchBlockFlag = this.ub(1)
        record.TrySize = this.ui16()
        record.CatchSize = this.ui16()
        record.FinallySize = this.ui16()
        if (record.CatchInRegisterFlag) {
            record.CatchRegister = this.ui8()
        }
        else {
            record.CatchName = this.string()
        }
        this.skipBytes(record.TrySize)
        this.skipBytes(record.CatchSize)
        this.skipBytes(record.FinallySize)
    },
    
    readClipEventFlags : function() {
        var Flags
        if (this.header.Version <= 5) {
            Flags = this.ub(16) << 16
        }
        else {
            Flags = this.ub(32)
        }
        return Flags
    },
    
    readRgb : function() {
        return {
            Red : this.ui8(),
            Green : this.ui8(),
            Blue : this.ui8(),
            Alpha : 0xff
        }
    },
    
    readRgba : function() {
        return {
            Red : this.ui8(),
            Green : this.ui8(),
            Blue : this.ui8(),
            Alpha : this.ui8()
        }        
    },

    readArgb : function() {
        return {
            Alpha : this.ui8(),
            Red : this.ui8(),
            Green : this.ui8(),
            Blue : this.ui8()
        }        
    },
    
    readRect : function() {
        this.stream.align() // as per adb
        var Nbits = this.ub(5)
        var value = {
            Nbits : Nbits,
            Xmin : this.sb(Nbits) / this.twipsPerPixel,
            Xmax : this.sb(Nbits) / this.twipsPerPixel,
            Ymin : this.sb(Nbits) / this.twipsPerPixel,
            Ymax : this.sb(Nbits) / this.twipsPerPixel
        }
        return value
    },
    
    readShapeWithStyle : function() {
        this.stream.align() // as per adb
        var FillStyles = this.readFillStyleArray()
        var LineStyles = this.readLineStyleArray()
        this.stream.align()
        var NumFillBits = this.ub(4)
        var NumLineBits = this.ub(4)
        this.NumFillBits = NumFillBits
        this.NumLineBits = NumLineBits
        var ShapeRecords = this.readShapeRecords()
        return {
            FillStyles : FillStyles,
            LineStyles : LineStyles,
            NumFillBits : NumFillBits,
            NumLineBits : NumLineBits,
            ShapeRecords : ShapeRecords
        }
    },
    
    readShapeRecords : function() {
        var records = []
        var record = this.readShapeRecord()
        while (!record.isEndOfShape) {
            records.push(record)
            record = this.readShapeRecord()
        }
        this.stream.align()
        return records
    },
    
    readShapeRecord : function() {
        var TypeFlag = this.ub(1)
        if (TypeFlag == 0) {
            return this.readNonEdgeShapeRecord()
        }
        else {
            return this.readEdgeShapeRecord()
        }
    },
    
    readNonEdgeShapeRecord : function() {
        var StateNewStyles = this.ub(1)
        var StateLineStyle = this.ub(1)
        var StateFillStyle1 = this.ub(1)
        var StateFillStyle0 = this.ub(1)
        var StateMoveTo = this.ub(1)
        if (
            StateNewStyles == 0
            && StateLineStyle == 0
            && StateFillStyle1 == 0
            && StateFillStyle0 == 0
            && StateMoveTo == 0
        ) {
            return {
                isEndOfShape : true,
                type : 'END'
            }
        }
        else {
            var MoveBits
            var MoveDeltaX
            var MoveDeltaY
            if (StateMoveTo) {
                MoveBits = this.ub(5)
                MoveDeltaX = this.sb(MoveBits)
                MoveDeltaY = this.sb(MoveBits)
            }
            var FillStyle0
            if (StateFillStyle0) {
                FillStyle0 = this.ub(this.NumFillBits)
            }
            var FillStyle1
            if (StateFillStyle1) {
                FillStyle1 = this.ub(this.NumFillBits)
            }
            var LineStyle
            if (StateLineStyle) {
                LineStyle = this.ub(this.NumLineBits)
            }
            var FillStyles
            var LineStyles
            var NumFillBits
            var NumLineBits
            if (StateNewStyles) {
                FillStyles = this.readFillStyleArray()
                LineStyles = this.readLineStyleArray()
                this.stream.align()
                NumFillBits = this.ub(4)
                NumLineBits = this.ub(4)
                this.NumFillBits = NumFillBits
                this.NumLineBits = NumLineBits
            }
            return {
                isEndOfShape : false,
                type : 'NONEDGE',
                StateNewStyles : StateNewStyles,
                StateLineStyle : StateLineStyle,
                StateFillStyle1 : StateFillStyle1,
                StateFillStyle0 : StateFillStyle0,
                StateMoveTo : StateMoveTo,
                MoveBits : MoveBits,
                MoveDeltaX : MoveDeltaX / this.twipsPerPixel,
                MoveDeltaY : MoveDeltaY / this.twipsPerPixel,
                FillStyle0 : FillStyle0,
                FillStyle1 : FillStyle1,
                LineStyle : LineStyle,
                FillStyles : FillStyles,
                LineStyles : LineStyles,
                NumFillBits : NumFillBits,
                NumLineBits : NumLineBits
            }
        }
    },
    
    readEdgeShapeRecord : function() {
        var StraightFlag = this.ub(1)
        if (StraightFlag == 1) {
            return this.readStraightEdgeRecord()
        }
        else {
            return this.readCurvedEdgeRecord()
        }
    },
    
    readStraightEdgeRecord : function() {
        var NumBits = this.ub(4)
        var GeneralLineFlag = this.ub(1)
        var VertLineFlag
        if (GeneralLineFlag == 0) {
            VertLineFlag = this.ub(1) // spec says SB[1]
        }
        var DeltaX
        if (GeneralLineFlag == 1 || VertLineFlag == 0) {
            DeltaX = this.sb(NumBits + 2)
            if (VertLineFlag == 0) {
                DeltaY = 0
            }
        }
        var DeltaY
        if (GeneralLineFlag == 1 || VertLineFlag == 1) {
            DeltaY = this.sb(NumBits + 2)
            if (VertLineFlag == 1) {
                DeltaX = 0
            }
        }
        return {
            isStraightEdge : true,
            type : 'STRAIGHT',
            NumBits : NumBits,
            GeneralLineFlag : GeneralLineFlag,
            VertLineFlag : VertLineFlag,
            DeltaX : DeltaX / this.twipsPerPixel,
            DeltaY : DeltaY / this.twipsPerPixel
        }
    },
    
    readCurvedEdgeRecord : function() {
        var NumBits = this.ub(4)
        var ControlDeltaX = this.sb(NumBits + 2)
        var ControlDeltaY = this.sb(NumBits + 2)
        var AnchorDeltaX = this.sb(NumBits + 2)
        var AnchorDeltaY = this.sb(NumBits + 2)
        return {
            isCurvedEdge : true,
            type : 'CURVED',
            NumBits : NumBits,
            ControlDeltaX : ControlDeltaX / this.twipsPerPixel,
            ControlDeltaY : ControlDeltaY / this.twipsPerPixel,
            AnchorDeltaX : AnchorDeltaX / this.twipsPerPixel,
            AnchorDeltaY : AnchorDeltaY / this.twipsPerPixel
        }
    },
    
    readFillStyleArray : function() {
        var FillStyleCount = this.ui8();
        var FillStyleCountExtended;
//        var t = fljs.swf.TagTypes
        if (
            this.context == 22//t.DefineShape2 
            || this.context == 32//t.DefineShape3
            || this.context == 83//t.DefineShape4
        ) {
            if (FillStyleCount == 0xff) {
                FillStyleCountExtended = this.ui16();
                FillStyleCount = FillStyleCountExtended;
            }
        }
        var FillStyles = [];
        for (var i = 0; i < FillStyleCount; i++) {
            FillStyles[i] = this.readFillStyle()
        }
        return FillStyles;
    },
    
    readFillStyle : function() {
        var FillStyleType = this.ui8();
        var Color;
        if (FillStyleType == 0x00) {
            if (this.context == 32/*fljs.swf.TagTypes.DefineShape3*/ || this.context == 83/*fljs.swf.TagTypes.DefineShape4*/) {
                Color = this.readRgba();
            }
            else {
                Color = this.readRgb();
            }
        }
        var GradientMatrix;
        var Gradient;
        if (FillStyleType == 0x10 || FillStyleType == 0x12) {
            GradientMatrix = this.readMatrix();
            Gradient = this.readGradient();
        }
        if (FillStyleType == 0x13) {
            GradientMatrix = this.readMatrix(); // as per adb
            Gradient = this.readFocalGradient();
        }
        var BitmapId
        var BitmapMatrix
        if (FillStyleType == 0x40 || FillStyleType == 0x41 || FillStyleType == 0x42 || FillStyleType == 0x43) {
            BitmapId = this.ui16();
            BitmapMatrix = this.readMatrix();
        }
        this.stream.align() // as per adb
        return {
            FillStyleType : FillStyleType,
            Color : Color,
            GradientMatrix : GradientMatrix,
            Gradient : Gradient,
            BitmapId : BitmapId,
            BitmapMatrix : BitmapMatrix
        };
    },
    
    readLineStyleArray : function() {
        var LineStyleCount = this.ui8()
        var LineStyleCountExtended
        if (LineStyleCount == 0xff) {
            LineStyleCountExtended = this.ui16()
            LineStyleCount = LineStyleCountExtended
        }
        var LineStyles = [];
        if (this.context == 83/*fljs.swf.TagTypes.DefineShape4*/) {
            for (var i = 0; i < LineStyleCount; i++) {
                LineStyles[i] = this.readLineStyle2();
            }
        }
        else {
            for (var i = 0; i < LineStyleCount; i++) {
                LineStyles[i] = this.readLineStyle();
            }
        }
        return LineStyles;
    },
    
    readLineStyle : function() {
        var Width = this.ui16()
        var Color
        if (
            this.context == 2//fljs.swf.TagTypes.DefineShape 
            || this.context == 22//fljs.swf.TagTypes.DefineShape2
        ) {
            Color = this.readRgb()
        }
        else {
            Color = this.readRgba()
        }
        return {
            Width : Width / this.twipsPerPixel,
            Color : Color
        }
    },
    
    readLineStyle2 : function() {
        var Width = this.ui16()
        var StartCapStyle = this.ub(2)
        var JoinStyle = this.ub(2)
        var HasFillFlag = this.ub(1)
        var NoHScaleFlag = this.ub(1)
        var NoVScaleFlag = this.ub(1)
        var PixelHintingFlag = this.ub(1)
        this.ub(5)
        var NoClose = this.ub(1)
        var EndCapStyle = this.ub(2)
        var MiterLimitFactor
        if (JoinStyle == 2) {
            MiterLimitFactor = this.ui16()
        }
        var Color
        if (HasFillFlag == 0) {
            Color = this.readRgba()
        }
        var FillType
        if (HasFillFlag == 1) {
            FillType = this.readFillStyle()
        }
        return {
            Width : Width / this.twipsPerPixel,
            StartCapStyle : StartCapStyle,
            JoinStyle : JoinStyle,
            HasFillFlag : HasFillFlag,
            NoHScaleFlag : NoHScaleFlag,
            NoVScaleFlag : NoVScaleFlag,
            PixelHintingFlag : PixelHintingFlag,
            NoClose : NoClose,
            EndCapStyle : EndCapStyle,
            MiterLimitFactor : MiterLimitFactor,
            Color : Color,
            FillType : FillType
        }
    },
    
    readGradient : function() {
        this.stream.align() // as per adb
        var SpreadMode = this.ub(2)
        var InterpolationMode = this.ub(2)
        var NumGradients = this.ub(4)
        var GradientRecords = []
        for (var i = 0; i < NumGradients; i++) {
            GradientRecords.push(this.readGradRecord())
        }
        return {
            SpreadMode : SpreadMode,
            InterpolationMode : InterpolationMode,
            NumGradients : NumGradients,
            GradientRecords : GradientRecords
        }
    },
    
    readFocalGradient : function() {
        this.stream.align() // as per adb
        var SpreadMode = this.ub(2)
        var InterpolationMode = this.ub(2)
        var NumGradients = this.ub(4)
        var GradientRecords = []
        for (var i = 0; i < NumGradients; i++) {
            GradientRecords.push(this.readGradRecord())
        }
        var FocalPoint = this.readFixed8()
        return {
            SpreadMode : SpreadMode,
            InterpolationMode : InterpolationMode,
            NumGradients : NumGradients,
            GradientRecords : GradientRecords,
            FocalPoint : FocalPoint
        }
    },
    
    readGradRecord : function() {
        var Ratio = this.ui8()
        var Color
        if (
            this.context == 2//fljs.swf.TagTypes.DefineShape 
            || this.context == 22//fljs.swf.TagTypes.DefineShape2
        ) {
            Color = this.readRgb()
        }
        else {
            Color = this.readRgba()
        }
        return {
            Ratio : Ratio,
            Color : Color
        }
    },
    
    readMatrix : function() {
        var d = {}
        this.stream.align() // as per adb
        d.HasScale = this.ub(1)
        if (d.HasScale) {
            d.NScaleBits = this.ub(5)
            d.ScaleX = this.readFB(d.NScaleBits)
            d.ScaleY = this.readFB(d.NScaleBits)
        } 
        d.HasRotate = this.ub(1)
        if (d.HasRotate) {
            d.NRotateBits = this.ub(5)
            d.RotateSkew0 = this.readFB(d.NRotateBits)
            d.RotateSkew1 = this.readFB(d.NRotateBits)
        }
        d.NTranslateBits = this.ub(5)
        d.TranslateX = this.sb(d.NTranslateBits) / this.twipsPerPixel
        d.TranslateY = this.sb(d.NTranslateBits) / this.twipsPerPixel
        return d
    },

    readShape : function() {
        var NumFillBits = this.ub(4)
        var NumLineBits = this.ub(4)
        this.NumFillBits = NumFillBits
        this.NumLineBits = NumLineBits
        var ShapeRecords = this.readShapeRecords()
        return {
            NumFillBits : NumFillBits,
            NumLineBits : NumLineBits,
            ShapeRecords : ShapeRecords
        }
    },
    
    readTextRecords : function() {
        var records = []
        while (true) {
            this.stream.align()
            var TextRecordType = this.ub(1)
            if (TextRecordType) {
                records.push(this.readTextRecord())
            }
            else {
                this.stream.align()
                break
            }
        }
        return records
    },

    readTextRecord : function() {
        // no align
        var StyleFlagsReserved = this.ub(3)
        var StyleFlagsHasFont = this.ub(1)
        var StyleFlagsHasColor = this.ub(1)
        var StyleFlagsHasYOffset = this.ub(1)
        var StyleFlagsHasXOffset = this.ub(1)
        var FontId
        if (StyleFlagsHasFont) {
            FontId = this.ui16()
        }
        var TextColor
        if (StyleFlagsHasColor) {
            if (this.context == 33/*fljs.swf.TagTypes.DefineText2*/) {
                TextColor = this.readRgba()
            }
            else {
                TextColor = this.readRgb()
            }
        }
        var XOffset
        if (StyleFlagsHasXOffset) {
            XOffset = this.si16() / this.twipsPerPixel
        }
        var YOffset
        if (StyleFlagsHasYOffset) {
            YOffset = this.si16() / this.twipsPerPixel
        }
        var TextHeight
        if (StyleFlagsHasFont) {
            TextHeight = this.ui16() / this.twipsPerPixel
        }
        var GlyphCount = this.ui8()
        var GlyphEntries = []
        for (var i = 0; i < GlyphCount; i++) {
            GlyphEntries.push(this.readGlyphEntry())
        }
        return {
            StyleFlagsReserved : StyleFlagsReserved,
            StyleFlagsHasFont : StyleFlagsHasFont,
            StyleFlagsHasColor : StyleFlagsHasColor,
            StyleFlagsHasYOffset : StyleFlagsHasYOffset,
            StyleFlagsHasXOffset : StyleFlagsHasXOffset,
            FontId : FontId,
            TextColor : TextColor,
            XOffset : XOffset,
            YOffset : YOffset,
            TextHeight : TextHeight,
            GlyphCount : GlyphCount,
            GlyphEntries : GlyphEntries
        }
    },
    
    readGlyphEntry : function() {
        return {
            GlyphIndex : this.ub(this.GlyphBits),
            GlyphAdvance : this.sb(this.AdvanceBits) / this.twipsPerPixel
        }
    },
    
    readLangCode : function() {
        return this.ui8()
    },
    
    readKerningRecord : function() {
        var FontKerningCode1
        var FontKerningCode2
        if (this.FontFlagsWideCodes) {
            FontKerningCode1 = this.ui16()
            FontKerningCode2 = this.ui16()
        }
        else {
            FontKerningCode1 = this.ui8()
            FontKerningCode2 = this.ui8()
        }
        var FontKerningAdjustment = this.si16()
        return {
            FontKerningCode1 : FontKerningCode1,
            FontKerningCode2 : FontKerningCode2,
            FontKerningAdjustment : FontKerningAdjustment
        }
    },
        
    readMp3SoundData : function(byteCount) {
        var startByteIndex = this.stream.byteIndex
        var SeekSamples = this.si16()
        var byteIndex = this.stream.byteIndex
        var Mp3Frames = []
        while (this.stream.byteIndex < startByteIndex + byteCount) {
            Mp3Frames.push(this.readMp3Frame(Mp3Frames.length))
        }
        var byteCount = this.stream.byteIndex - byteIndex
        return {
            SeekSamples : SeekSamples,
            Mp3Frames : Mp3Frames,
            byteIndex : byteIndex,
            byteCount : byteCount,
            buffer : this.stream.buffer
        }
    },
    
    readMp3Frame : function() {
        var Syncword = this.ub(11)
        if (Syncword != 0x7ff) {
            throw new Error('readMp3Frame: Syncword is wrong in frame# ' + arguments[0] + ' @ ' + this.stream.byteIndex)
        }
        var MpegVersion = this.ub(2)
        var Layer = this.ub(2)
        var ProtectionBit = this.ub(1)
        var Bitrate = this.ub(4)
        var SamplingRate = this.ub(2)
        var PaddingBit = this.ub(1)
        this.ub(1)
        var ChannelMode = this.ub(2)
        var ModeExtension = this.ub(2)
        var Copyright = this.ub(1)
        var Original = this.ub(1)
        var Emphasis = this.ub(2)
        if (ProtectionBit == 0) {
            this.ui16()
        }
        var mpegVersions = {
            MPEG2_5 : 0,
            MPEG2 : 2,
            MPEG1 : 3
        }
        var mpegVersionNumbers = {
            0 : 2,
            2 : 2,
            3 : 1
        }
        var bitrates = {
            1 : [
                null,
                32,
                40,
                48,
                56,
                64,
                80,
                96,
                112,
                128,
                160,
                192,
                224,
                256,
                320
            ],
            2 : [
                null,
                8,
                16,
                24,
                32,
                40,
                48,
                56,
                64,
                80,
                96,
                112,
                128,
                144,
                160
            ]
        }
        var samplingRates = {
            0 : [11025, 12000, 8000],
            2 : [22050, 24000, 16000],
            3 : [44100, 48000, 32000]
        }
        var byteCount = Math.floor(
                (MpegVersion == mpegVersions.MPEG1 ? 144 : 72) * 
                bitrates[mpegVersionNumbers[MpegVersion]][Bitrate] * 1000 / 
                samplingRates[MpegVersion][SamplingRate]
            ) + PaddingBit - 4
        var SampleData = this.bytes(byteCount)
        return {
            Syncword : Syncword,
            MpegVersion : MpegVersion,
            Layer : Layer,
            ProtectionBit : ProtectionBit,
            Bitrate : Bitrate,
            SamplingRate : SamplingRate,
            PaddingBit : PaddingBit,
            ChannelMode : ChannelMode,
            ModeExtension : ModeExtension,
            Copyright : Copyright,
            Original : Original,
            Emphasis : Emphasis,
            byteCount : byteCount,
            SampleData : SampleData
        }
    },
        
    readSoundInfo : function() {
        this.ub(2)
        var SyncStop = this.ub(1)
        var SyncNoMultiple = this.ub(1)
        var HasEnvelope = this.ub(1)
        var HasLoops = this.ub(1)
        var HasOutPoint = this.ub(1)
        var HasInPoint = this.ub(1)
        var InPoint
        if (HasInPoint) {
            InPoint = this.ui32()
        }
        var OutPoint
        if (HasOutPoint) {
            OutPoint = this.ui32()
        }
        var LoopCount
        if (HasLoops) {
            LoopCount = this.ui16()
        }
        var EnvPoints
        var EnvelopeRecords
        if (HasEnvelope) {
            EnvPoints = this.ui8()
            EnvelopeRecords = []
            for (var i = 0; i < EnvPoints; i++) {
                EnvelopeRecords.push(this.readEnvelopeRecord())
            }
        }
        return {
            SyncStop : SyncStop,
            SyncNoMultiple : SyncNoMultiple,
            HasEnvelope : HasEnvelope,
            HasLoops : HasLoops,
            HasOutPoint : HasOutPoint,
            HasInPoint : HasInPoint,
            InPoint : InPoint,
            OutPoint : OutPoint,
            LoopCount : LoopCount,
            EnvPoints : EnvPoints,
            EnvelopeRecords : EnvelopeRecords
        }
    },
    
    readEnvelopeRecord : function() {
        return {
            Pos44 : this.ui32(),
            LeftLevel : this.ui16(),
            RightLevel : this.ui16()
        }
    },
    
    readButtonRecords : function() {
        var records = []
        var record
        while (record = this.readButtonRecord()) {
            records.push(record)
        }
        return records
    },
    
    readButtonRecord : function() {
        var record = {}
        this.stream.align()
        this.ub(2)
        record.ButtonHasBlendMode = this.ub(1)
        record.ButtonHasFilterList = this.ub(1)
        record.ButtonStateHitTest = this.ub(1)
        record.ButtonStateDown = this.ub(1)
        record.ButtonStateOver = this.ub(1)
        record.ButtonStateUp = this.ub(1)
        if (
            !record.ButtonHasBlendMode &&
            !record.ButtonHasFilterList &&
            !record.ButtonStateHitTest &&
            !record.ButtonStateDown &&
            !record.ButtonStateOver &&
            !record.ButtonStateUp
        ) {
            return null
        }
        record.CharacterId = this.ui16()
        record.PlaceDepth = this.ui16()
        record.PlaceMatrix = this.readMatrix()
        if (this.context == 34/*fljs.swf.TagTypes.DefineButton2*/) {
            record.ColorTransform = this.readCxform(true)
            if (record.ButtonHasFilterList) {
                record.FilterList = this.readFilterList()
            }
            if (record.ButtonHasBlendMode) {
                record.BlendMode = this.ui8()
            }
        }
        return record
    },
    
    readFilterList : function() {
        var list = []
        var count = this.ui8()
        for (var i = 0; i < count; i++) {
            list.push(this.readFilter())
        }
        return list
    },
    
    readFilter : function() {
        var filter = {}
        filter.FilterId = this.ui8()
        switch (filter.FilterId) {
        case 0:
            filter.DropShadowFilter = this.readDropShadowFilter()
            break
        
        case 1:
            filter.BlurFilter = this.readBlurFilter()
            break
            
        case 2:
            filter.GlowFilter = this.readGlowFilter()
            break
            
        case 3:
            filter.BevelFilter = this.readBevelFilter()
            break
            
        case 4:
            filter.GradientGlowFilter = this.readGradientGlowFilter()
            break
            
        case 5:
            filter.ConvolutionFilter = this.readConvolutionFilter()
            break
            
        case 6:
            filter.ColorMatrixFilter = this.readColorMatrixFilter()
            break
            
        case 7:
            filter.GradientBevelFitler = this.readGradientBevelFilter()
            break
        }
        return filter
    },
    
    readColorMatrixFilter : function() {
        return {
            Matrix : this.readFloats(20)
        }
    },
    
    readConvolutionFilter : function() {
        var d = {}
        d.MatrixX = this.ui8()
        d.MatrixY = this.ui8()
        d.Divisor = this.readFloat()
        d.Bias = this.readFloat()
        d.Matrix = this.readFloats(d.MatrixX * d.MatrixY)
        d.DefaultColor = this.readRgba()
        this.ub(6)
        d.Clamp = this.ub(1)
        d.PreserveAlpha = this.ub(1)
        return d
    },
    
    readBlurFilter : function() {
        var d = {
            BlurX : this.readFixed(),
            BlurY : this.readFixed(),
            Passes : this.ub(5)
        }
        this.ub(3)
        return d
    },
    
    readDropShadowFilter : function() {
        return {
            DropShadowColor : this.readRgba(),
            BlurX : this.readFixed(),
            BlurY : this.readFixed(),
            Angle : this.readFixed(),
            Distance : this.readFixed(),
            Strength : this.readFixed8(),
            InnerShadow : this.ub(1),
            Knockout : this.ub(1),
            CompositeSource : this.ub(1),
            Passes : this.ub(5)
        }
    },
    
    readGlowFilter : function() {
        return {
            GlowColor : this.readRgba(),
            BlurX : this.readFixed(),
            BlurY : this.readFixed(),
            Strength : this.readFixed8(),
            InnerGlow : this.ub(1),
            Knockout : this.ub(1),
            CompositeSource : this.ub(1),
            Passes : this.ub(5)
        }
    },
    
    readBevelFilter : function() {
        return {
            ShadowColor : this.readRgba(),
            HighlightColor : this.readRgba(),
            BlurX : this.readFixed(),
            BlurY : this.readFixed(),
            Angle : this.readFixed(),
            Distance : this.readFixed(),
            Strength : this.readFixed8(),
            InnerShadow : this.ub(1),
            Knockout : this.ub(1),
            CompositeSource : this.ub(1),
            OnTop : this.ub(1),
            Passes : this.ub(4)
        }
    },
    
    readGradientGlowFilter : function() {
        var filter = {}
        filter.NumColors = this.ui8()
        filter.GradientColors = []
        for (var i = 0; i < filter.NumColors; i++) {
            filter.GradientColors.push(this.readRgba())
        }
        filter.GradientRatios = []
        for (var i = 0; i < filter.NumColors; i++) {
            filter.GradientRatios.push(this.ui8())
        }
        filter.BlurX = this.readFixed()
        filter.BlurY = this.readFixed()
        filter.Angle = this.readFixed()
        filter.Distance = this.readFixed()
        filter.Strength = this.readFixed8()
        filter.InnerShadow = this.ub(1)
        filter.Knockout = this.ub(1)
        filter.CompositeSource = this.ub(1)
        filter.OnTop = this.ub(1)
        filter.Passes = this.ub(4)
        return filter
    },

    readGradientBevelFilter : function() {
        var filter = {}
        filter.NumColors = this.ui8()
        filter.GradientColors = []
        for (var i = 0; i < filter.NumColors; i++) {
            filter.GradientColors.push(this.readRgba())
        }
        filter.GradientRatios = []
        for (var i = 0; i < filter.NumColors; i++) {
            filter.GradientRatios.push(this.ui8())
        }
        filter.BlurX = this.readFixed()
        filter.BlurY = this.readFixed()
        filter.Angle = this.readFixed()
        filter.Distance = this.readFixed()
        filter.Strength = this.readFixed8()
        filter.InnerShadow = this.ub(1)
        filter.Knockout = this.ub(1)
        filter.CompositeSource = this.ub(1)
        filter.OnTop = this.ub(1)
        filter.Passes = this.ub(4)
        return filter
    },
    
    readButtonCondActions : function(bytes) {
        var actions = []
//        rar.rar = rar
        var startByteIndex = this.stream.byteIndex
        var recordBytes
        while (recordBytes = this.ui16()) {
            actions.push(this.readButtonCondAction(recordBytes - 2))
        }
        actions.push(this.readButtonCondAction(bytes - (this.stream.byteIndex - startByteIndex)))
        return actions
    },
    
    readButtonCondAction : function(bytes) {
        var action = {}
        action.CondActionSize = bytes + 2
        action.CondIdleToOverDown = this.ub(1)
        action.CondOutDownToIdle = this.ub(1)
        action.CondOutDownToOverDown = this.ub(1)
        action.CondOverDownToOutDown = this.ub(1)
        action.CondOverDownToOverUp = this.ub(1)
        action.CondOverUpToOverDown = this.ub(1)
        action.CondOverUpToIdle = this.ub(1)
        action.CondIdleToOverUp = this.ub(1)
        action.CondKeyPress = this.ub(7)
        action.CondOverDownToIdle = this.ub(1)
        action.Actions = this.readActionRecords(bytes - 2)
        return action
    },
    
    readPix15 : function() {
        this.stream.align()
        this.ub(1)
        return {
            Red : Math.floor(this.ub(5) * 8.226),
            Green : Math.floor(this.ub(5) * 8.226),
            Blue : Math.floor(this.ub(5) * 8.226)
        }
    },
    
    readZoneRecord : function() {
        var d = {}
        d.NumZoneData = this.ui8()
        d.ZoneData = []
        for (var i = 0; i < d.NumZoneData; i++) {
            d.ZoneData.push(this.readZoneData())
        }
        this.ub(6)
        d.ZoneMaskY = this.ub(1)
        d.ZoneMaskX = this.ub(1)
        return d
    },
    
    readZoneData : function() {
        return {
            AlignmentCoordinate: this.readFloat16(),
            Range: this.readFloat16()
        }
    },
    
    beginContext : function(tag) {
        this.context = tag
    },
    
    endContext : function() {
        this.context = null
        this.NumFillBits = null
        this.NumLineBits = null
    },
    
    readRecord : function(skip) {
        var header = this.header
        var d = {}
        d.header = header
        if (skip) {
            this.stream.skipBytes(header.TagLength)
            return d
        }
//        var t = fljs.swf.TagTypes
        var keepExtra = false // TODO: which need to be kept?
        switch (header.TagType) {
        case 6://t.DefineBits:
        case 21://t.DefineBitsJpeg2:
            d.CharacterId = this.ui16()
            var byteCount = header.TagLength - 2
            var useTables = header.TagType == 6//t.DefineBits
            this.readJpeg(d, byteCount, useTables)
            break
            
        case 35://t.DefineBitsJpeg3:
            var startByteIndex = this.stream.byteIndex
            d.CharacterId = this.ui16()
            var loader = this.loader
            if (env.loadExtResources()) {
                this.skipBytes(header.TagLength - 2)
                var imageUrl = 'img/' + loader.name + '-' + d.CharacterId + '.png'
                ext.console('image').info(imageUrl)
                var image = new Image()
                var onLoad = ext.bind(this.onLoadJpegImage, this, d, header, image)
                image.addEventListener('load', onLoad, false)
                loader.delayFrame++
                image.src = imageUrl
            }
            else {
                d.AlphaDataOffset = this.ui32()
                var byteCount = d.AlphaDataOffset
                this.readJpeg(d, byteCount, false)
                byteCount = header.TagLength - (this.stream.byteIndex - startByteIndex)
                var byteIndex = this.stream.byteIndex
                var writer = new PngWriter()
                d.alphaDataUri = writer.buildPng(
                    this.stream.buffer,
                    byteIndex, byteCount, 
                    d.Width, d.Height, 
                    3, // indexed
                    PngWriter.WhitePalette,
                    PngWriter.LinearTransparency
                )
            }
            break
            
        case 20://t.DefineBitsLossless:
        case 36://t.DefineBitsLossless2:
            var startByteIndex = this.stream.byteIndex
            d.CharacterId = this.ui16()
            d.BitmapFormat = this.ui8()
            d.Width = d.BitmapWidth = this.ui16()
            d.Height = d.BitmapHeight = this.ui16()
            if (d.BitmapFormat == 3) {
                d.BitmapColorTableSize = this.ui8()
            }
            var byteCount = header.TagLength - (this.stream.byteIndex - startByteIndex)
            if (env.loadExtLargeImg && byteCount > 50000) {
                this.delay = true
            }
            else {
                var zipped = this.stream.buffer.substr(this.stream.byteIndex + 2, byteCount - 2)
                var inflated = zip.inflate(zipped)
                var bitmapData = new SwfReader(new LittleEndianStringReader(inflated))
                var canvas = document.createElement('canvas')
                canvas.width = d.BitmapWidth
                canvas.height = d.BitmapHeight
                var ctx = canvas.getContext('2d')
                var img = ctx.createImageData(d.BitmapWidth, d.BitmapHeight)
                var data = img.data
                // indexed
                if (d.BitmapFormat == 3) {
                    d.ColorTableRgb = []
                    for (var i = 0; i < d.BitmapColorTableSize + 1; i++) {
                        if (header.TagType == 20/*t.DefineBitsLossless*/) {
                            d.ColorTableRgb[i] = bitmapData.readRgb()
                            d.ColorTableRgb[i].Alpha = 0xff
                        }
                        else {
                            d.ColorTableRgb[i] = bitmapData.readRgba()
                        }
                    }
                    var dataWidth = Math.floor((d.BitmapWidth + 3) / 4) * 4
                    var i = 0
                    var x = 0
                    while (i < d.BitmapWidth * d.BitmapHeight * 4) {
                        var idx = bitmapData.ui8()
                        var clr
                        if (idx in d.ColorTableRgb) {
                            clr = d.ColorTableRgb[idx]
                        }
                        else {
                            clr = {Red:0, Green:0, Blue:0, Alpha:0}
                        }
                        data[i++] = clr.Red
                        data[i++] = clr.Green
                        data[i++] = clr.Blue
                        data[i++] = clr.Alpha
                        x++
                        if (x == d.BitmapWidth) {
                            bitmapData.skipBytes(dataWidth - d.BitmapWidth)
                            x = 0
                        }
                    }
                }
                // truecolor
                else if (d.BitmapFormat == 4) {
                    var dataWidth = Math.floor((d.BitmapWidth * 2 + 3) / 4) * 4
                    var i = 0
                    var x = 0
                    while (i < d.BitmapWidth * d.BitmapHeight * 4) {
                        var clr = bitmapData.readPix15()
                        data[i++] = clr.Red
                        data[i++] = clr.Green
                        data[i++] = clr.Blue
                        data[i++] = 0xff
                        x++
                        if (x == d.BitmapWidth) {
                            bitmapData.skipBytes(dataWidth - d.BitmapWidth)
                            x = 0
                        }
                    }
                }
                // truecolor with alpha
                else if (d.BitmapFormat == 5) {
                    var i = 0
                    while (i < d.BitmapWidth * d.BitmapHeight * 4) {
                        var clr = bitmapData.readArgb()
                        if (header.TagType == 20/*t.DefineBitsLossless*/) {
                            clr.Alpha = 0xff
                        }
                        data[i++] = clr.Red
                        data[i++] = clr.Green
                        data[i++] = clr.Blue
                        data[i++] = clr.Alpha
                    }
                }
                ctx.putImageData(img, 0, 0)
                d.canvas = canvas
                d.DataUri = canvas.toDataURL()
            }
            break
            
        case 34://t.DefineButton2:
            var byteIndex = this.stream.byteIndex
            this.context = 34//t.DefineButton2
            d.ButtonId = this.ui16()
            this.ub(7)
            d.TrackAsMenu = this.ub(1)
            d.ActionOffset = this.ui16()
            d.Characters = this.readButtonRecords()
            if (d.ActionOffset) {
                d.Actions = this.readButtonCondActions(header.TagLength - (this.stream.byteIndex - byteIndex))
            }
            else {
                d.Actions = []
            }
            this.context = null
            break
            
        case 37://t.DefineEditText:
            d.CharacterId = this.ui16()
            d.Bounds = this.readRect()
            this.stream.align()
            d.HasText = this.ub(1)
            d.WordWrap = this.ub(1)
            d.Multiline = this.ub(1)
            d.Password = this.ub(1)
            d.ReadOnly = this.ub(1)
            d.HasTextColor = this.ub(1)
            d.HasMaxLength = this.ub(1)
            d.HasFont = this.ub(1)
            d.HasFontClass = this.ub(1)
            d.AutoSize = this.ub(1)
            d.HasLayout = this.ub(1)
            d.NoSelect = this.ub(1)
            d.Border = this.ub(1)
            d.WasStatic = this.ub(1)
            d.HTML = this.ub(1)
            d.UseOutlines = this.ub(1)
            if (d.HasFont) {
                d.FontId = this.ui16()
            }
            if (d.HasFontClass) {
                d.FontClass = this.string()
            }
            if (d.HasFont) {
                d.FontHeight = this.ui16() / this.twipsPerPixel
            }
            if (d.HasTextColor) {
                d.TextColor = this.readRgba()
            }
            if (d.HasMaxLength) {
                d.MaxLength = this.ui16()
            }
            if (d.HasLayout) {
                d.Align = this.ui8()
                d.LeftMargin = this.ui16()
                d.RightMargin = this.ui16()
                d.Indent = this.ui16()
                d.Leading = this.ui16()
            }
            d.VariableName = this.string()
            if (d.HasText) {
                d.InitialText = this.string()
            }
            break
            
        case 10://t.DefineFont:
            d.FontId = this.ui16()
            d.OffsetTable = [this.ui16()]
            var glyphCount = d.OffsetTable[0] / 2
            d.NumGlyphs = glyphCount
            for (var i = 1; i < glyphCount; i++) {
                d.OffsetTable.push(this.ui16())
            }
            d.GlyphShapeTable = []
            for (var j = 0; j < glyphCount; j++) {
                d.GlyphShapeTable.push(this.readShape())
            }
            break
            
        case 48://t.DefineFont2:
        case 75://t.DefineFont3:
            var i
            d.FontId = this.ui16()
            d.FontFlagsHasLayout = this.ub(1)
            d.FontFlagsShiftJIS = this.ub(1)
            d.FontFlagsSmallText = this.ub(1)
            d.FontFlagsANSI = this.ub(1)
            d.FontFlagsWideOffsets = this.ub(1)
            d.FontFlagsWideCodes = this.ub(1)
            this.FontFlagsWideCodes = d.FontFlagsWideCodes
            d.FontFlagsItalic = this.ub(1)
            d.FontFlagsBold = this.ub(1)
            d.LanguageCode = this.readLangCode()
            d.FontNameLen = this.ui8()
            var chars = []
            for (i = 0; i < d.FontNameLen; i++) {
                chars.push(String.fromCharCode(this.ui8()))
            }
            d.FontName = chars.join('')
            d.NumGlyphs = this.ui16()
            d.OffsetTable = []
            if (d.FontFlagsWideOffsets) {
                for (i = 0; i < d.NumGlyphs; i++) {
                    d.OffsetTable.push(this.ui32())
                }
                d.CodeTableOffset = this.ui32()
            }
            else {
                for (i = 0; i < d.NumGlyphs; i++) {
                    d.OffsetTable.push(this.ui16())
                }
                d.CodeTableOffset = this.ui16()
            }
            d.GlyphShapeTable = []
            for (i = 0; i < d.NumGlyphs; i++) {
                d.GlyphShapeTable.push(this.readShape())
            }
            d.CodeTable = []
            d.GlyphIndex = {}
            if (d.FontFlagsWideCodes) {
                for (i = 0; i < d.NumGlyphs; i++) {
                    var code = this.ui16()
                    d.CodeTable.push(code)
                    d.GlyphIndex[code] = i
                }
            }
            else {
                for (i = 0; i < d.NumGlyphs; i++) {
                    var code = this.ui8()
                    d.CodeTable.push(code)
                    d.GlyphIndex[code] = i
                }
            }
            if (d.FontFlagsHasLayout) {
                d.FontAscent = this.si16()
                d.FontDescent = this.si16()
                d.FontLeading = this.si16()
                d.FontAdvanceTable = []
                for (i = 0; i < d.NumGlyphs; i++) {
                    d.FontAdvanceTable.push(this.si16())
                }
                d.FontBoundsTable = []
                for (i = 0; i < d.NumGlyphs; i++) {
                    d.FontBoundsTable.push(this.readRect())
                    this.stream.align()
                }
                d.KerningCount = this.ui16()
                d.FontKerningTable = []
                for (i = 0; i < d.KerningCount; i++) {
                    d.FontKerningTable.push(this.readKerningRecord())
                }
            }
            break

        case 13://t.DefineFontInfo:
        case 62://t.DefineFontInfo2:
            var startByteIndex = this.stream.byteIndex
            d.FontId = this.ui16()
            d.FontNameLen = this.ui8()
            var chars = []
            for (i = 0; i < d.FontNameLen; i++) {
                chars.push(String.fromCharCode(this.ui8()))
            }
            d.FontName = chars.join('')
            this.ub(2)
            d.FontFlagsSmallText = this.ub(1)
            d.FontFlagsShiftJis = this.ub(1)
            d.FontFlagsAnsi = this.ub(1)
            d.FontFlagsItalic = this.ub(1)
            d.FontFlagsBold = this.ub(1)
            d.FontFlagsWideCodes = this.ub(1)
            if (header.TagType == 62/*t.DefineFontInfo2*/) {
                d.LanguageCode = this.readLangCode()
            }
            var byteCount = header.TagLength - (this.stream.byteIndex - startByteIndex)
            d.CodeTable = []
            if (d.FontFlagsWideCodes) {
                var numGlyphs = byteCount / 2
                for (i = 0; i < numGlyphs; i++) {
                    d.CodeTable.push(this.ui16())
                }
            }
            else {
                var numGlyphs = byteCount
                for (i = 0; i < numGlyphs; i++) {
                    d.CodeTable.push(this.ui8())
                }
            }
            break
            
        case 2://t.DefineShape:
        case 22://t.DefineShape2:
        case 32://t.DefineShape3:
        case 83://t.DefineShape4:
            this.beginContext(header.TagType)
            this.endByteIndex = this.stream.byteIndex + header.TagLength
            d.defId = d.ShapeId = this.ui16()
            d.ShapeBounds = this.readRect()
            if (header.TagType == 83/*t.DefineShape4*/) {
                this.EdgeBounds = this.readRect();
                this.ub(6)
                this.UsesNonScalingStrokes = this.ub(1)
                this.UsesScalingStrokes = this.ub(1)
            }
            else {
                this.stream.align()
            }
            d.Shapes = this.readShapeWithStyle()
            this.endContext()
            break

        case 15://t.DefineSound:
            d.SoundId = this.ui16()
            d.SoundFormat = this.ub(4)
            d.SoundRate = this.ub(2)
            d.SoundSize = this.ub(1)
            d.SoundType = this.ub(1)
            d.SoundSampleCount = this.ui32()
            var byteCount = header.TagLength - 2 - 1 - 4
            d.SoundData = this.readMp3SoundData(byteCount)
            d.Mp3SoundData = d.SoundData
            break

        case 39://t.DefineSprite:
            keepExtra = true
            var startByteIndex = this.stream.byteIndex
            d.CharacterId = d.defId = d.SpriteId = this.ui16()
            d.FrameCount = this.ui16()
            d.frameData_ = [{tags: []}]
            d.labels_ = {}
            d.framesLoaded_ = 0
            d.totalFrames_ = d.FrameCount
            break
            
        case 11://t.DefineText:
        case 33://t.DefineText2:
            d.CharacterId = this.ui16()
            d.TextBounds = this.readRect()
            this.stream.align()
            d.TextMatrix = this.readMatrix()
            d.GlyphBits = this.ui8()
            d.AdvanceBits = this.ui8()
            this.GlyphBits = d.GlyphBits
            this.AdvanceBits = d.AdvanceBits
            this.context = header.TagType
            d.TextRecords = this.readTextRecords()
            this.context = null
            if (d.TextRecords && d.TextRecords.length) {
                d.FontId = d.TextRecords[0].FontId
            }
            d.Bounds = d.TextBounds
            break
        
/*        case t.DefineVideoStream:
            d.defId = d.CharacterId = this.ui16()
            d.NumFrames = this.ui16()
            d.Width = this.ui16()
            d.Height = this.ui16()
            this.ub(4)
            d.VideoFlagsDeblocking = this.ub(3)
            d.VideoFlagsSmoothing = this.ub(1)
            d.CodecId = this.ui8()
            break
  */      
        case 12://t.DoAction:
            d.Actions = this.readActionRecords(header.TagLength)
            break
            
        case 59://t.DoInitAction:
            d.SpriteId = this.ui16()
            var byteCount = header.TagLength - 2 - 1
            d.Actions = this.readActionRecords(byteCount)
            d.ActionEndFlag = this.ui8()
            break
            
        case 0://t.End:
            break
            
        case 56://t.ExportAssets:
            d.Count = this.ui16()
            d.Tags = []
            d.Names = []
            for (var i = 0; i < d.Count; i++) {
                d.Tags[i] = this.ui16()
                d.Names[i] = this.string()
            }
            break
            
        case 43://t.FrameLabel:
            d.Name = this.string()
            break
            
        case 8://t.JpegTables:
            if (header.TagLength > 0) {
                var data = this.bytes(header.TagLength).join('')
                var reader = new BigEndianStringReader(data)
                var header, count
                var soi = reader.uShort()
                var offset = 0
                if (soi == 0xffd9) {
                    offset = 4
                    reader.uShort()
                    reader.uShort()
                }
                d.JpegData = data.substr(offset, data.length - offset - 2)
            }
            break
            
        case 4://t.PlaceObject:
            var startByteIndex = this.stream.byteIndex
            d.CharacterId = this.ui16()
            d.Depth = this.ui16()
            d.Matrix = this.readMatrix()
            this.stream.align()
            if (this.stream.byteIndex != startByteIndex + header.TagLength) {
                d.ColorTransform = this.readCxform()
            }
            this.stream.align()
            break
            
        case 26://t.PlaceObject2:
        case 70://t.PlaceObject3:
            d.startByteIndex = this.stream.byteIndex
            d.PlaceFlagHasClipActions = this.ub(1)
            d.PlaceFlagHasClipDepth = this.ub(1)
            d.PlaceFlagHasName = this.ub(1)
            d.PlaceFlagHasRatio = this.ub(1)
            d.PlaceFlagHasColorTransform = this.ub(1)
            d.PlaceFlagHasMatrix = this.ub(1)
            d.PlaceFlagHasCharacter = this.ub(1)
            d.PlaceFlagMove = this.ub(1)
            if (header.TagType == 70/*t.PlaceObject3*/) {
                this.ub(3)
                d.PlaceFlagHasImage = this.ub(1)
                d.PlaceFlagHasClassName = this.ub(1)
                d.PlaceFlagHasCacheAsBitmap = this.ub(1)
                d.PlaceFlagHasBlendMode = this.ub(1)
                d.PlaceFlagHasFilterList = this.ub(1)
                d.Depth = this.ui16()
                if (d.PlaceFlagHasClassName || (d.PlaceFlagHasImage && d.PlaceFlagHasCharacter)) {
                    d.ClassName = this.string()
                }
            }
            else {
                d.Depth = this.ui16()
            }
            if (d.PlaceFlagHasCharacter) {
                d.CharacterId = this.ui16()
            }
            if (d.PlaceFlagHasMatrix) {
                d.Matrix = this.readMatrix()
            }
            if (d.PlaceFlagHasColorTransform) {
                d.ColorTransform = this.readCxform(true)
            }
            if (d.PlaceFlagHasRatio) {
                d.Ratio = this.ui16()
            }
            if (d.PlaceFlagHasName) {
                d.Name = this.string()
            }
            if (d.PlaceFlagHasClipDepth) {
                d.ClipDepth = this.ui16()
            }
            if (header.TagType == 70/*t.PlaceObject3*/) {
                if (d.PlaceFlagHasFilterList) {
                    d.SurfaceFilterList = this.readFilterList()
                }
                if (d.PlaceFlagHasBlendMode) {
                    d.BlendMode = this.ui8()
                }
            }
            if (d.PlaceFlagHasClipActions) {
                d.ClipActions = this.readClipActions()
            }
            break
            
        case 24://t.Protect:
            this.skipBytes(header.TagLength)
            break
            
        case 5://t.RemoveObject:
            d.CharacterId = this.ui16()
            d.Depth = this.ui16()
            break

        case 28://t.RemoveObject2:
            d.Depth = this.ui16()
            break
            
        case 9://t.SetBackgroundColor:
            d.BackgroundColor = this.readRgb()
            break
            
        case 1://t.ShowFrame:
            break
            
        case 19://t.SoundStreamBlock:
            d.SampleCount = this.ui16()
            var byteCount = header.TagLength - 2
            d.Mp3SoundData = this.readMp3SoundData(byteCount)
            break
            
        case 18://t.SoundStreamHead:
        case 45://t.SoundStreamHead2:
            this.ub(4)
            d.PlaybackSoundRate = this.ub(2)
            d.PlaybackSoundSize = this.ub(1)
            d.PlaybackSoundType = this.ub(1)
            d.StreamSoundCompression = this.ub(4)
            d.StreamSoundRate = this.ub(2)
            d.StreamSoundSize = this.ub(1)
            d.StreamSoundType = this.ub(1)
            d.StreamSoundSampleCount = this.ui16()
            if (d.StreamSoundCompression == 2) {
                d.LatencySeek = this.si16()
            }
            break
            
        case 15://t.StartSound:
            d.SoundId = this.ui16()
            d.SoundInfo = this.readSoundInfo()
            break
        
        case 73://t.DefineFontAlignZones:
            var startByteIndex = this.stream.byteIndex
            d.FontId = this.ui16()
            d.CsmTableHint = this.ub(2)
            this.ub(6) // reserved
            d.ZoneTable = []
            while (this.stream.byteIndex != startByteIndex + header.TagLength) {
                d.ZoneTable.push(this.readZoneRecord())
            }
            break
        
        default:
            this.stream.skipBytes(header.TagLength)
            break
        }
        var bytesLeft = this.tagBytesLeft()
        if (!keepExtra && bytesLeft > 0) {
            this.stream.skipBytes(bytesLeft)
        }
        else if (!keepExtra && bytesLeft != 0) {
            //debugger
        }
        return d
    },
    
    readJpeg : function(tag, byteCount, useTables) {
        var data = String(this.bytes(byteCount).join(''))
        var reader = new BigEndianStringReader(data)
        var header, count
        var loader = this.loader
        var soi = reader.uShort()
        var offset
        if (soi == 0xffd9) {
            if (useTables && loader.jpegTables) {
                offset = 6
            }
            else {
                offset = 4
            }
            reader.uShort()
            reader.uShort()
        }
        else {
            if (useTables && loader.jpegTables) {
                offset = 2
            }
            else {
                offset = 0
            }
        }
        var middleSoi = 0
        while (reader.byteIndex < byteCount) {
            header = reader.uShort()
            count = reader.uShort()
            if (header == 0xffc0) {
                reader.uByte()
                tag.Height = reader.uShort()
                tag.Width = reader.uShort()
                break
            }
            if (header == 0xffd9) {
                middleSoi = reader.byteIndex - 6
            }
            else {
                reader.skipBytes(count - 2)
            }
        }
        // deal with messed up jpegs
        if (middleSoi) {
            data = data.substr(0, middleSoi) + data.substr(middleSoi + 6)
        }
        if (offset) {
            data = data.substr(offset)
        }
        var tables
        if (useTables && loader.jpegTables) {
            tables = loader.jpegTables.JpegData
        }
        else {
            tables = ''
        }
        tag.DataUri = 'data:image/jpeg;base64,' + btoa(tables + data)
    },
    
    readTags : function(limit) {
        //var t = fljs.swf.TagTypes
        var loader = this.loader
        var canSkip = 'isSkipTag' in loader
        loop:
        while (this.hasMore() && this.someBytesLeft(limit) > 0) {
            var header = this.readRecordHeader()
            var skip = canSkip && loader.isSkipTag(header)
            this.delay = false
            var tag = this.readRecord(skip)
            loader.onTag(tag, this.target, this.frames)
            switch (header.TagType) {
            case 39://t.DefineSprite:
                this.target = tag
                this.frames.unshift(0)
                break

            case 1://t.ShowFrame:
                this.frames[0] += 1
                break
        
            case 0://t.End:
                this.target = null
                this.frames.shift()
                break

            case 6://t.DefineBits:
            case 21://t.DefineBitsJpeg2:
            case 35://t.DefineBitsJpeg3:
                break loop
                break
            }
            if (this.delay) {
                break loop
            }
        }
        this.bytesRead = this.stream.byteIndex
        return this.hasMore()
    },
    
    someBytesLeft : function(limit) {
        if (limit) {
            return limit - (this.stream.byteIndex - this.bytesRead)
        }
        else {
            return 1
        }
    }
})

exports.SwfReader = SwfReader

})
