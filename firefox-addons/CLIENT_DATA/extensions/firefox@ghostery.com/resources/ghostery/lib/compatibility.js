/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var _ = require('./vendor/underscore-1.4.3'),
	utils = require('./utils'),
	UpdatableMixin = require('./updatable').load;

function CompatibilityDb() {
	this.type = 'compatibility';

	function buildDb(bugs, version) {
		var	map = {};
			
		bugs.forEach(function (s) {
			map[s.aid] = s.urls;
		});

		return {
			list: map,
			version: version
		};
	}

	this.processList = function (comp) {
		var db;

		utils.log('processing comp ...');

		try {
			db = buildDb(comp.compatibility, comp.compatibilityVersion);
		} catch (e) {}

		if (!db) {
			return false;
		}

		utils.log('processed');

		this.db = db;
		utils.prefs('compatibility', comp);

		return true;
	};

	this.hasIssue = function (aid, tab_url) {
		return this.db.list.hasOwnProperty(aid) && utils.fuzzyUrlMatcher(tab_url, this.db.list[aid]);
	};

	_.extend(this, UpdatableMixin);
}

exports.load = new CompatibilityDb();
