/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

if (require('sdk/system').platform.toLowerCase() == 'android') {
	// Dummy
	module.exports = {
		moveTo: function () {},
		setIcon: function () {},
		setBadge: function () {},
		create: function () {},
		remove: function () {}
	};
} else {
	module.exports = require('./ui/desktop/button');
}
