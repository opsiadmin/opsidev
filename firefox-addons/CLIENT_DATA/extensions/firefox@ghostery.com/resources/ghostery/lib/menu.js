/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

if (require('sdk/system').platform.toLowerCase() == 'android') {
	module.exports = require('./ui/mobile/menu');
} else {
	module.exports = require('./ui/desktop/menu');
}
