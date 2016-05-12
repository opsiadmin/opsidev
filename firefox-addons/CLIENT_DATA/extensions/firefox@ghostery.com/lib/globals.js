/**
 * Global Constants
 *
 * Sets globals to span CommonJS modules
 *
 * Copyright 2016 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var packageJSON = require("../package.json");
var debug = packageJSON.debug || false;

module.exports = {
	DEBUG: debug,
	GHOSTERY_DOMAIN: (debug) ? 'ghosterystage' : 'ghostery',
	METRICS_SUB_DOMAIN: (debug) ? 'staging-d' : 'd',
	CMP_SUB_DOMAIN: (debug) ? 'staging-cmp-cdn' : 'cmp-cdn',
	CDN_SUB_DOMAIN: (debug) ? 'staging-cdn' : 'cdn'
};
