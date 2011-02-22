define(function(require, exports, module) {

var ext = require('lib/ext')
var as2 = require('as2/vm')
var VM = require('as2/vm').VM
var MovieClip = require('player/movie_clip').MovieClip

var As2Tester = function() {
    this.vm = new VM(this)
    var ldr = this.loader = {root:{}}
    var tgt = this.target = new MovieClip()
    tgt.loader = ldr
}
ext.add(As2Tester.prototype, {
    
    run : function(actions) {
        this.vm.doAction(this.target, actions)
    }
})


As2Creator = function() {
    
}
ext.add(As2Creator.prototype, {
    
    cmds : function(cmds) {
        var addr = 1
        var records = []
        for (var i in cmds) {
            var record = this.cmd(cmds[i], addr)
            records.push(record)
            addr += record.Length
        }
        return records
    },
    
    cmd : function(params, address) {
        var ActionCode = params.cmd
        var record = {
            code : '0x' + ActionCode.toString(16),
            address : address,
            ActionCode : ActionCode
        }
        record.Length = 2
        var c = as2.ActionCode
        switch (ActionCode) {
        case 0x81 : // ActionGotoFrame
            record.Action = 'ActionGotoFrame'
            record.Frame = params.Frame
            break
        case 0x83 : // ActionGetURL
            record.Action = 'ActionGetUrl'
            record.UrlString = params.UrlString
            record.TargetString = params.TargetString
            break
        case 0x04 :
            record.Action = 'ActionNextFrame'
            break
        case 0x05 : 
            record.Action = 'ActionPrevFrame'
            break
        case 0x06 :
            record.Action = 'ActionPlay'
            break
        case 0x07 :
            record.Action = 'ActionStop'
            break
        case 0x08 :
            record.Action = 'ActionToggleQuality'
            break
        case 0x09 :
            record.Action = 'ActionStopSounds'
            break
        case 0x8a :
            record.Action = 'ActionWaitForFrame'
            record.Frame = params.Frame
            record.SkipCount = params.SkipCount
            break
        case 0x8b :
            record.Action = 'ActionSetTarget'
            record.TargetName = params.TargetName
            break
        case 0x08 :
            record.Action = 'ActionToggleQuality'
            break
        case 0x8b :
            record.Action = 'ActionSetTarget'
            record.TargetName = params.TargetName
            break
        case 0x8c :
            record.Action = 'ActionGotoLabel'
            record.Label = params.Label
            break

        // SWF4

        case 0x96 :
            this.readActionPush(record, params)
            break

        // ...
        case 0x99 :
            record.Action = 'ActionJump'
            record.BranchOffset = params.BranchOffset * 2
            break
        case 0x9d :
            record.Action = 'ActionIf'
            record.BranchOffset = params.BranchOffset * 2
            break
        case 0x9a :
            record.Action = 'ActionGetUrl2'
            record.SendVarsMethod = params.SendVarsMethod
            record.Reserved = params.Reserved
            record.LoadTargetFlag = params.LoadTargetFlag
            record.LoadVariablesFlag = params.LoadVariablesFlag
            break
        case 0x9f :
            this.readActionGotoFrame2(record, params)
            break
        case 0x8d :
            record.Action = 'ActionWaitForFrame2'
            record.SkipCount = params.SkipCount
            break

        // SWF5

        case 0x88 :
            this.readActionConstantPool(record, params)
            break
        case 0x9b :
            this.readActionDefineFunction(record, params)
            break
        case 0x94 :
            this.readActionWith(record, params)
            break
        case 0x87 :
            record.Action = 'ActionStoreRegister'
            record.RegisterNumber = params.RegisterNumber
            break

        // SWF6

        case 0x8e :
            this.readActionDefineFunction2(record, params)
            break
        case 0x8f :
            this.readActionTry(record, params)
            break
        }
        return record
    },

    readActionPush : function(record, params) {
        //var Count = this.readUI16()
        var Count = record.Length
        //var startByteIndex = this.stream.byteIndex
        var values = []
        //var logger = goog.debug.Logger.getLogger('parse')
        for (var i in params.values) {
            var val = params.values[i]
            var Type = val.Type
            var value
            switch (Type) {
            case 0:
                value = val.Value
                break
            case 1:
                value = val.Value
                break
            case 4:
            case 5:
            case 8:
                value = val.Value
                break
            case 6:
                value = val.Value
                break
            case 7:
                value = val.Value
                break
            case 9:
                value = val.Value
                break
            }
            //logger.info(Type + ': ' + value)
            values.push({Type : Type, Value : value})
        }
        record.Action = 'ActionPush'
        record.Values = values
    },
    
    readActionGotoFrame2 : function(record, params) {
        var SceneBiasFlag = params.SceneBiasFlag
        var PlayFlag = params.PlayFlag
        var SceneBias
        if (SceneBiasFlag) {
            SceneBias = params.SceneBias
        }
        record.Action = 'ActionGotoFrame2'
        record.SceneBiasFlag = SceneBiasFlag
        record.PlayFlag = PlayFlag
        record.SceneBias = SceneBias
    },

    readActionConstantPool : function(record, params) {
        var ConstantPool = []
        for (var i in params.consts) {
            ConstantPool.push(params.consts[i])
        }
        record.Action = 'ActionConstantPool'
//        record.Count = Count
        record.ConstantPool = ConstantPool
    },

    readActionDefineFunction : function(record, params) {
        var FunctionName = params.FunctionName
//        var NumParams = params.NumParams
        var Params = []
        for (var i in params.params) {
            Params.push(params.params[i])
        }
//        var CodeSize = 
        var Code = this.cmds(params.code)
        record.Action = 'ActionDefineFunction'
        record.FunctionName = FunctionName
        record.NumParams = params.params.length
        record.Parameters = Params
//        record.CodeSize = CodeSize
        record.Code = Code
    },

    readActionWith : function(record, params) {
//        var Size = params.Size
        var Code = this.cmds(params.code)
        record.Action = 'ActionWith'
//        record.Size = Size
        record.Code = Code
    },

    readActionDefineFunction2 : function(record, params) {
        record.FunctionName = params.FunctionName
        record.NumParams = params.params.length
        record.RegisterCount = params.RegisterCount
        record.PreloadParentFlag = params.PreloadParentFlag
        record.PreloadRootFlag = params.PreloadRootFlag
        record.SupressSuperFlag = params.SupressSuperFlag
        record.PreloadSuperFlag = params.PreloadSuperFlag
        record.SupressArgumentsFlag = params.SupressArgumentsFlag
        record.PreloadArgumentsFlag = params.PreloadArgumentsFlag
        record.SupressThisFlag = params.SupressThisFlag
        record.PreloadThisFlag = params.PreloadThisFlag
        //this.readUB(7)
        record.PreloadGlobalFlag = params.PreloadGlobalFlag
        record.Parameters = []
        for (var i = 0; i < record.NumParams; i++) {
            record.Parameters.push(this.readRegisterParam(params.params[i]))
        }
//        record.CodeSize = 
        var Code = this.cmds(params.code)
        record.Action = 'ActionDefineFunction2'
        record.Code = Code
    },

    readRegisterParam : function(params) {
        return {
            Register : params.Register,
            ParamName : params.ParamName
        }
    },

    readActionTry : function(record, params) {
//        this.readUB(5)
        record.CatchInRegisterFlag = params.CatchInRegisterFlag
        record.FinallyBlockFlag = params.FinallyBlockFlag
        record.CatchBlockFlag = params.CatchBlockFlag
        record.TrySize = params.TrySize
        record.CatchSize = params.CatchSize
        record.FinallySize = params.FinallySize
        if (record.CatchInRegisterFlag) {
            record.CatchRegister = params.CatchRegister
        }
        else {
            record.CatchName = params.CatchName
        }
        //this.skipBytes(record.TrySize)
        //this.skipBytes(record.CatchSize)
        //this.skipBytes(record.FinallySize)
    }
})

exports.As2Tester = As2Tester

})
