/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var SDK = {
	self: require('sdk/self'),
	system: require('sdk/system')
};

if (SDK.system.platform.toLowerCase() == 'android') {
	// Dummy
	module.exports = {
		Panel: function () {}
	};
} else if (parseInt(SDK.system.version, 10) >= 29) {
	module.exports = require('sdk/panel');
} else {
	module.exports = require('./ui/desktop/panel');
}
