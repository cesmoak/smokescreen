/**
 * Smokescreen Player - A Flash player written in JavaScript
 * http://smokescreen.us/
 * 
 * Copyright 2011, Chris Smoak
 * Released under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
define(function(require, exports, module) {

var agent = require('lib/agent').agent

// These should be set once

exports.debug = false
exports.renderTextAsGlyphs = false
exports.smoothAnimations = false
exports.fnWatch = {}
exports.accelerate = !(agent.OS == 'iPad' || (agent.OS == 'iPhone' && agent.osVersion < 4))
exports.loadExtLargeImg = (agent.OS == 'iPad' || agent.OS == 'iPhone')
exports.loadExtResources = function() {
    return false
    /*
    switch (agent.browser) {
    case 'Safari':
    case 'Firefox':
    case 'Opera':
        return true
    
    default:
        return false
    }
    */
}

})
