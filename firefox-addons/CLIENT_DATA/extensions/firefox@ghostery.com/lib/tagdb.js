/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var _ = require('underscore'),
	utils = require('./utils'),
	UpdatableMixin = require('./updatable').load;

function TagDb() {
	this.type = 'tags';

	function buildDb(o, version) {
		var	map = {};
			
		o.forEach(function (s) {
			map[s.id] = s;
		});

		return {
			list: map,
			version: version
		};
	}

	this.processList = function (data) {
		var db;

		utils.log('processing tags ...');

		try {
			db = buildDb(data.tags, data.tagsVersion);
		} catch (e) {}

		if (!db) {
			return false;
		}

		utils.log('processed');

		this.db = db;
		utils.prefs('tags', data);

		return true;
	};

	_.extend(this, UpdatableMixin);
}

exports.load = new TagDb();
