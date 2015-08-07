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

function BugDb() {
	this.type = 'bugs';

	function updateNewAppIds(new_apps, old_apps) {
		log('updating newAppIds ...');

		var new_app_ids = _.difference(
			_.keys(new_apps),
			_.keys(old_apps)
		).map(Number);

		utils.prefs('newAppIds', new_app_ids);

		return new_app_ids;
	}

	function applyBlockByDefault(new_app_ids) {
		if (conf.block_by_default) {
			log('applying block-by-default ...');
			_.each(new_app_ids, function (app_id) {
				conf.selected_app_ids[app_id] = 1;
			});
		}
	}

	this.processList = function (bugs) {
		log('processing bugs ...');

		// deep cloning bugs all at once is too slow
		var patterns = bugs.patterns,
			regexes = patterns.regex,
			db = {
				apps: bugs.apps,
				bugs: bugs.bugs,
				firstPartyExceptions: bugs.firstPartyExceptions,
				patterns: {
					host: patterns.host,
					host_path: patterns.host_path,
					path: patterns.path,
					// regexes are initialized below
					regex: {}
				},
				version: bugs.version,
				JUST_UPDATED_WITH_NEW_TRACKERS: false
			};

		log('initializing regexes ...');
		for (var id in regexes) {
			db.patterns.regex[id] = new RegExp(regexes[id], 'i');
		}

		log('adding user-created bugs ...');
		var userBugs = processUserCreatedBugs(),
			userBug;
		for (var i = 0; i < userBugs.length; i++) {
			userBug = userBugs[i];
			db.apps[userBug.aid] = {
				name: userBug.name,
				cat: userBug.type
			};
			db.bugs[userBug.id] = {
				aid: userBug.aid
			};
			db.patterns.regex[userBug.id] = new RegExp(userBug.pattern, 'i');
		}

		log('setting noneSelected/allSelected ...');
		var num_selected = _.size(conf.selected_app_ids);
		db.noneSelected = (num_selected === 0);
		// since allSelected is slow to eval, make it lazy
		utils.defineLazyProperty(db, 'allSelected', function () {
			var num_selected = _.size(conf.selected_app_ids);
			return (!!num_selected && _.every(db.apps, function (app, app_id) {
				return conf.selected_app_ids.hasOwnProperty(app_id);
			}));
		});

		log('processed');

		var old_bugs = utils.prefs('bugs'),
			new_app_ids;

		// if there is an older bugs object in storage,
		// update newAppIds and apply block-by-default
		if (old_bugs) {
			if (old_bugs.hasOwnProperty('version') && bugs.version > old_bugs.version) {
				new_app_ids = updateNewAppIds(bugs.apps, old_bugs.apps);

				if (new_app_ids.length) {
					applyBlockByDefault(new_app_ids);
					db.JUST_UPDATED_WITH_NEW_TRACKERS = true;
				}

			// pre-trie/legacy db
			} else if (old_bugs.hasOwnProperty('bugsVersion') && bugs.version != old_bugs.bugsVersion) {
				var old_apps = _.reduce(old_bugs.bugs, function (memo, bug) {
					memo[bug.aid] = true;
					return memo;
				}, {});

				new_app_ids = updateNewAppIds(bugs.apps, old_apps);

				if (new_app_ids.length) {
					applyBlockByDefault(new_app_ids);

					// don't claim new trackers when db got downgraded by version
					if (bugs.version > old_bugs.bugsVersion) {
						db.JUST_UPDATED_WITH_NEW_TRACKERS = true;
					}
				}
			}
		}

		this.db = db;

		// no need to save to storage unless what we have is newer,
		// or we never saved to storage before
		if (!old_bugs || !old_bugs.hasOwnProperty('version') || bugs.version > old_bugs.version) {
			utils.prefs('bugs', bugs);
		}

		return true;
	};

	function processUserCreatedBugs() {
		var inputtedBugs = [],
			userBugs = [];

		try {
			inputtedBugs = utils.prefs('user_bugs');
		} catch (e) {}

		for (var i = 0; i < inputtedBugs.length; i++) {
			var bug = inputtedBugs[i];
			if (!bug.pattern) {
				continue;
			}

			bug.userCreated = (bug.type == 'user_created');

			if (!bug.hasOwnProperty('name')) {
				bug.name = 'User Created Bug ' + (i + 1);
			}

			if (!bug.hasOwnProperty('aid')) {
				bug.aid = 10000 + i;
			}

			if (!bug.hasOwnProperty('cid')) {
				bug.cid = 10000 + i;
			}

			if (!bug.hasOwnProperty('id')) {
				bug.id = 10000 + i;
			}

			userBugs.push(bug);
		}

		return userBugs;
	}

	_.extend(this, UpdatableMixin);
}

exports.load = new BugDb();
