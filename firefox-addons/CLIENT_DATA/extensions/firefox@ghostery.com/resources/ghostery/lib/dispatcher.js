/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var SDK = {
		target: require('sdk/event/target'),
		event: require('sdk/event/core')
	},
	utils = require('./utils');

var dispatcher = {},
	target = SDK.target.EventTarget(),
	emit = SDK.event.emit;

dispatcher.on = function (message, listener) {
	utils.log("dispatcher.on called with %o", arguments);
	target.on(message, listener);
};

dispatcher.trigger = function (message, listener) {
	utils.log("dispatcher.trigger called with %o", arguments);
	emit(target, message, listener);
};

exports.on = dispatcher.on;
exports.trigger = dispatcher.trigger;
