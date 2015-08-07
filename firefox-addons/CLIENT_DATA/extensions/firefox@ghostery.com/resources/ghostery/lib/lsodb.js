/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var _ = require('vendor/underscore-1.4.3'),
	conf = require('conf').load,
	utils = require('utils'),
	UpdatableMixin = require('updatable').load;

var log = utils.log;

function LsoDb() {
	this.type = 'lsos';

	function buildDb(lsos, version) {
		var i, num_lsos,
			lso,
			apps = {},
			cats = {},
			lsos_map = {},
			num_selected_patterns = 0,
			patterns_arr = [],
			priority,
			regexes = {
				high: {},
				regular: {},
				low: {}
			};

		for (i = 0, num_lsos = lsos.length; i < num_lsos; i++) {
			lso = lsos[i];

			lsos_map[lso.id] = {
				aid: lso.aid,
				name: lso.name
			};

			apps[lso.aid] = {
				name: lso.name,
				cat: lso.type
			};

			patterns_arr.push(lso.pattern);

			if (!cats.hasOwnProperty(lso.type)) {
				cats[lso.type] = {};
			}
			cats[lso.type][lso.aid] = true;

			priority = lso.priority;
			if (priority != 'high' && priority != 'low') {
				priority = 'regular';
			}
			regexes[priority][lso.id] = new RegExp(lso.pattern, 'i');

			if (conf.selected_app_ids.hasOwnProperty(lso.aid)) {
				num_selected_patterns++;
			}
		}

		return {
			JUST_UPDATED_WITH_NEW_TRACKERS: false,

			allSelected: (num_selected_patterns == patterns_arr.length),
			noneSelected: num_selected_patterns === 0,

			apps: apps,
			lsos: lsos_map,
			cats: cats,
			fullRegex: new RegExp(patterns_arr.join('|'), 'i'),
			regexes: regexes,
			version: version
		};
	}

	function updateNewAppIds(new_lsos, old_lsos) {
		log('updating newLsosAppIds ...');

		var new_app_ids = _.difference(
			_.pluck(new_lsos, 'aid'),
			_.pluck(old_lsos, 'aid')
		);

		utils.prefs('newLsosAppIds', new_app_ids);

		return new_app_ids;
	}

	this.processList = function (lsos) {
		var db;

		log('processing lsos ...');

		try {
			db = buildDb(lsos.lsos, lsos.lsosVersion);
		} catch (e) {}

		if (!db) {
			return false;
		}

		log('processed');

		var old_lsos = utils.prefs('lsos');

		// there is an older lsos object and the versions are different
		// TODO should be doing > instead of != once we convert all versions to timestamps
		if (old_lsos && lsos.lsosVersion != old_lsos.lsosVersion) {
			var new_app_ids = updateNewAppIds(lsos.lsos, old_lsos.lsos);

			if (conf.block_by_default) {
				log('applying block-by-default ...');

				_.each(new_app_ids, function (app_id) {
					conf.selected_lsos_app_ids[app_id] = 1;
				});
			}

			if (new_app_ids.length) {
				db.JUST_UPDATED_WITH_NEW_TRACKERS = true;
			}
		}

		this.db = db;
		utils.prefs('lsos', lsos);

		return true;
	};

	_.extend(this, UpdatableMixin);
}

exports.load = new LsoDb();
