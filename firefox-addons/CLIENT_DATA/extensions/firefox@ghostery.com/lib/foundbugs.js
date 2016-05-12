/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var bugDb = require('./bugdb').load,
	tagDb = require('./tagdb').load,
	compatibility = require('./compatibility').load,
	tabInfo = require('./tabinfo');

// tab_id: { bug_id: { blocked: boolean, sources: array of { src: string, blocked: boolean } } }
var foundBugs = {};

function mapTags(tag_array) {
	if (!tag_array) {
		return;
	}

	var output_array = [];

	for (var i = 0; i < tag_array.length; i++) {
		if (typeof tag_array[i] === "number") {
			output_array[i] = tagDb.db.list[tag_array[i]].name;
		}
	}
	return output_array;
}


function clear(tab_id) {
	delete foundBugs[tab_id];
}

function update(tab_id, bug_id, src, blocked, type) {

	if (!foundBugs.hasOwnProperty(tab_id)) {
		foundBugs[tab_id] = {};
	}

	if (!bug_id) {
		return;
	}

	if (!foundBugs[tab_id].hasOwnProperty(bug_id)) {
		foundBugs[tab_id][bug_id] = {
			sources: []
		};
	}
	foundBugs[tab_id][bug_id].sources.push({
		src: src,
		blocked: blocked,
		type: type.toLowerCase()
	});

	// once unblocked, unblocked henceforth
	if (foundBugs[tab_id][bug_id].blocked !== false) {
		foundBugs[tab_id][bug_id].blocked = blocked;
	}
}

function get(tab_id) {
	return foundBugs.hasOwnProperty(tab_id) && foundBugs[tab_id];
}

// convert a hash of bugs into an array of apps
function getApps(tab_id, sorted) {
	var apps_arr = [],
		apps_obj = {},
		bugs = get(tab_id),
		db = bugDb.db,
		id,
		aid;

	if (!bugs) {
		return bugs;
	}

	// squish all the bugs into apps first
	for (id in bugs) {
		if (!bugs.hasOwnProperty(id)) {
			continue;
		}
		aid = db.bugs[id].aid;
		if (apps_obj.hasOwnProperty(aid)) {
			// combine bug sources
			apps_obj[aid].sources = apps_obj[aid].sources.concat(bugs[id].sources);

			// once unblocked, unblocked henceforth
			if (apps_obj[aid].blocked !== false) {
				apps_obj[aid].blocked = bugs[id].blocked;
			}
		} else {
			apps_obj[aid] = {
				id: aid,
				name: db.apps[aid].name,
				cat: db.apps[aid].cat,
				// TODO does map need to be here? everything else is hash lookups
				tags: mapTags(db.apps[aid].tags),
				blocked: bugs[id].blocked,
				sources: bugs[id].sources,
				hasCompatibilityIssue: compatibility.hasIssue(aid, tabInfo.get(tab_id).url)
			};
		}

	}

	// convert apps hash to array
	for (id in apps_obj) {
		if (apps_obj.hasOwnProperty(id)) {
			apps_arr.push(apps_obj[id]);
		}
	}

	if (sorted) {
		apps_arr.sort(function (a, b) {
			a = a.name.toLowerCase();
			b = b.name.toLowerCase();
			return (a > b ? 1 : (a < b ? -1 : 0));
		});
	}

	return apps_arr;
}

// convert a hash of bugs into an array of apps
function getCategories(tab_id, sorted) {
	var cats_arr = [],
		cats_obj = {},
		bugs = get(tab_id),
		db = bugDb.db,
		id,
		aid,
		cid;

	if (!bugs) {
		return bugs;
	}

	// squish all the bugs into categories first
	for (id in bugs) {
		if (!bugs.hasOwnProperty(id)) {
			continue;
		}
		aid = db.bugs[id].aid;
		cid = db.apps[aid].cat;

		if (cats_obj.hasOwnProperty(cid)) {
			if (cats_obj[cid].appIds.indexOf(aid) >= 0) { continue; }

			cats_obj[cid].appIds.push(aid);
			cats_obj[cid].trackers.push({
				id: aid,
				name: db.apps[aid].name,
				blocked: bugs[id].blocked
			});
			if (bugs[id].blocked) {
				cats_obj[cid].blocked++;
			} else {
				cats_obj[cid].allowed++;
			}
			cats_obj[cid].total++;
		} else {
			cats_obj[cid] = {
				id: cid,
				name: cid,
				appIds: [aid],
				trackers: [{
					id: aid,
					name: db.apps[aid].name,
					blocked: bugs[id].blocked
				}],
				blocked: (bugs[id].blocked ? 1 : 0),
				allowed: (bugs[id].blocked ? 0 : 1),
				total: 1
			};
		}
	}

	// convert categories hash to array
	for (cid in cats_obj) {
		if (cats_obj.hasOwnProperty(cid)) {
			cats_arr.push(cats_obj[cid]);
		}
	}

	if (sorted) {
		cats_arr.sort(function (a, b) {
			a = a.name.toLowerCase();
			b = b.name.toLowerCase();
			return (a > b ? 1 : (a < b ? -1 : 0));
		});
	}

	return cats_arr;
}

function getAppsCount(tab_id) {
	var apps = getApps(tab_id);
	if (apps) {
		return apps.length;
	}
	return 0;
}

function getAppsCountByBlocked(tab_id) {
	var apps = getApps(tab_id),
		blocked = 0,
		allowed = 0;

	if (apps) {
		apps.forEach(function (app) {
			if (app.blocked) {
				blocked++;
			} else {
				allowed++;
			}
		});
	}

	return {
		blocked: blocked,
		allowed: allowed
	};
}

exports.clear = clear;
exports.update = update;
exports.getBugs = get;
exports.getApps = getApps;
exports.getCategories = getCategories;
exports.getAppsCount = getAppsCount;
exports.getAppsCountByBlocked = getAppsCountByBlocked;
exports.getAll = function () {
	return foundBugs;
};
