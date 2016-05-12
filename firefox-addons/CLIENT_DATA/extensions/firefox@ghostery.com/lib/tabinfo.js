/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var tabInfo = {},
	utils = require('./utils'),
	lastLoadedTabInfo = {}; // used when tab_id is unknown

function clear(tab_id) {
	delete tabInfo[tab_id];
}

function create(tab_id, tab_url) {
	var parsed = utils.processUrl(tab_url);

	tabInfo[tab_id] = {
		url: tab_url,
		host: parsed.host,
		path: parsed.path,
		hash: parsed.anchor,
		// sids: [], // TODO
		DOMLoaded: false,
		pageLoaded: false,
		needsReload: {changes: {}},
		worker: false,
		timestamp: Date.now()
	};

	lastLoadedTabInfo = tabInfo[tab_id];
	lastLoadedTabInfo.id = tab_id;
}

function get(tab_id) {
	return (tab_id !== undefined) ? tabInfo[tab_id] : lastLoadedTabInfo;
}

function updateUrl(tab_id, tab_url) {
	if (!tabInfo[tab_id]) { return; }

	var parsed = utils.processUrl(tab_url);

	tabInfo[tab_id].url = tab_url;
	tabInfo[tab_id].host = parsed.host;
	tabInfo[tab_id].path = parsed.path;
	tabInfo[tab_id].hash = parsed.anchor;
}

exports.create = create;
exports.get = get;
exports.updateUrl = updateUrl;
exports.getAll = function () {
	return tabInfo;
};
exports.clear = clear;
