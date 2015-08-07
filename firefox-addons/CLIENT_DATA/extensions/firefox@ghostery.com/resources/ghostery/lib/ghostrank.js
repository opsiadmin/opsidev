/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var MOBILE_MODE = (require('sdk/system').platform.toLowerCase() == 'android'),
	_ = require('vendor/underscore-1.4.3'),
	conf = require('./conf').load,
	bugDb = require('./bugdb').load,
	tabInfo = require('./tabinfo'),
	utils = require('./utils'),
	SDK = {
		timers: require('sdk/timers'),
		request: require('sdk/request')
	};

// censusCache[Y-m-d][location.host + location.pathname][bug_id] = 1
// note: censusCache is not persisted
var censusCache = {},
	preCensusCache = {},
	// { tab_id: { bugUrl: [{ bug_id: '', latency: '', ...}, {...}], bugUrl: [{...}, {...}]  }, tab_id: {...} }
	recordStatsQueue = {};

function getToday() {
	var now = new Date();
	return now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
}

function cleanCaches() {
	var today = getToday();

	[censusCache, preCensusCache].forEach(function (cache, i) {
		for (var id in cache) {
			if (cache.hasOwnProperty(id)) {
				if (id != today) {
					utils.log("Cleaned up %s.",
						(i == 1 ? 'preCensusCache': 'censusCache'));
					delete cache[id];
				}
			}
		}
	});
}

function setCache(cache, date, bug_id, url) {
	if (!cache[date]) {
		cache[date] = {};
	}

	if (!cache[date][url]) {
		cache[date][url] = {};
	}

	cache[date][url][bug_id] = 1;
}

function onNavigate(url) {
	var today = getToday(),
		parsedURL = utils.processUrl(url),
		// TODO GHOST-1083 strip out the querystring like we do in lib/matcher.js instead?
		host_with_pathname = parsedURL.host + (parsedURL.port ? ':' + parsedURL.port : '') + parsedURL.path;

	if (!preCensusCache.hasOwnProperty(today) ||
		!preCensusCache[today].hasOwnProperty(host_with_pathname)) {
		return;
	}

	// move the bug IDs from preCensusCache to censusCache

	_.keys(preCensusCache[today][host_with_pathname]).forEach(function (bug_id) {
		setCache(censusCache, today, bug_id, host_with_pathname);
	});

	delete preCensusCache[today][host_with_pathname];
}

// records page domain, latency, # of adSpots, UA
function recordPageInfo(domain, page_latency, ad_spots) {
	if (!conf.ghostrank) {
		return;
	}

	var page_info_url = 'https://l.ghostery.com/api/page/' +
			'?d=' + encodeURIComponent(domain) +
			'&l=' + page_latency +
			'&s=' + ad_spots +
			'&ua=' + (MOBILE_MODE ? 'firefox-android' : 'firefox') +
			'&rnd=' + Math.ceil(9999999 * Math.random());

	utils.log('XHR to ' + page_info_url);

	SDK.request.Request({
		url: page_info_url,
		overrideMimeType: 'image/gif'
	}).get();
}

function recordStats(bug_url, deets) {
	var today = getToday(),
		db = bugDb.db,
		census_url,

		// required parameters
		tab_url = deets.tab_url,
		bug_id = deets.bug_id,
		block = deets.block,
		app_id = db.bugs[bug_id].aid,
		latency = deets.latency,

		// optional parameters
		af = (typeof deets.af !== 'undefined' ? deets.af : -1),
		response_code = (typeof deets.response_code !== 'undefined' ? deets.response_code : -1),
		user_error = (typeof deets.user_error !== 'undefined' ? deets.user_error : -1),
		from_cache = (typeof deets.from_cache !== 'undefined' ? deets.from_cache : -1),

		parsedURL = utils.processUrl(tab_url),
		host_with_pathname = parsedURL.host_with_path_cleaned;

	if (!isValidUrl(parsedURL)) {
		return;
	}

	// record only if current [host_with_pathname]:[web bug] has not already been submitted for today
	if (censusCache.hasOwnProperty(today) &&
		censusCache[today].hasOwnProperty(host_with_pathname) &&
		censusCache[today][host_with_pathname].hasOwnProperty(bug_id)) {
		return;
	}

	census_url = 'https://l.ghostery.com/api/census' +
		'?bid=' + encodeURIComponent(app_id) + // company app ID
		'&apid=' + encodeURIComponent(bug_id) + // app pattern ID
		'&d=' + encodeURIComponent(host_with_pathname) +
		'&src=' + encodeURIComponent(bug_url) +
		// bl: should this bug have gotten blocked after taking all settings into account?
		'&bl=' + (block ? 'true' : 'false') +
		// blm: blocking mode: 1 means "block all", 0 means "block selected", -1 means "off"
		'&blm=' + (db.noneSelected ? '-1' : (db.allSelected ? '1' : '0')) +
		// bs: is the bug selected for blocking (regardless of whether we are blocking)?
		'&bs=' + (conf.selected_app_ids.hasOwnProperty(app_id) ? 'true' : 'false') +
		// nl: network latency
		'&nl=' + latency +
		// bv: bug library version
		'&bv=' + encodeURIComponent(db.version) +
		// af: above or below fold: -1 means N/A, 0 means below fold, 1 means above fold
		'&af=' + af +
		// rc: status code of the response
		'&rc=' + response_code +
		// ue: was the request aborted due to a user action?
		'&ue=' + (user_error !== -1 ? (user_error ? '1' : '0') : user_error) +
		// fc: was the request loaded from cache?
		'&fc=' + (from_cache !== -1 ? (from_cache ? '1' : '0') : from_cache) +
		// cv: caching scheme version
		'&cv=2' +
		'&ua=' + (MOBILE_MODE ? 'firefox-android' : 'firefox') +
		'&v=' + encodeURIComponent(utils.VERSION);

	utils.log('XHR to ' + census_url);

	SDK.request.Request({
		url: census_url,
		overrideMimeType: 'image/gif'
	}).get();

	setCache(preCensusCache, today, bug_id, host_with_pathname);
}

function isValidUrl(parsedURL) {
	if (parsedURL.protocol.indexOf('http') === 0 && parsedURL.host.indexOf('.') !== -1 && /[A-Za-z]/.test(parsedURL.host)) {
		return true;
	} else {
		utils.log('GR data not sent, invalid URL');
		return false;
	}
}

function queueRecordStats(tab_id, bugUrl, deets) {
	// If the page has finished loading, there is no need to queue
	if (tabInfo.get(tab_id).pageLoaded) {
		recordStats(bugUrl, deets);
		return;
	}

	if (!recordStatsQueue.hasOwnProperty(tab_id)) {
		recordStatsQueue[tab_id] = {};
	}
	
	if (!recordStatsQueue[tab_id].hasOwnProperty(bugUrl)) {
		recordStatsQueue[tab_id][bugUrl] = [];
	}
	
	recordStatsQueue[tab_id][bugUrl].push(deets);
}

function appendAFStat(tab_id, bugUrl, af, deets) {
	if (!recordStatsQueue.hasOwnProperty(tab_id)) {
		return;
	}
	
	if (!recordStatsQueue[tab_id].hasOwnProperty(bugUrl)) {
		// This part is reached when a bug was found by the DOM scanner and not by content policy, so it was never queued.
		// TODO FF these bugs do not have latency
		if (deets) {
			queueRecordStats(tab_id, bugUrl, deets);
		}

		return;
	} else {
		recordStatsQueue[tab_id][bugUrl][0].af = af;
	}
}

function dequeueRecordStats(tab_id) {
	if (!recordStatsQueue.hasOwnProperty(tab_id)) {
		return;
	}

	var deets,
		bugUrl,
		i;

	/* jshint loopfunc: true */
	for (bugUrl in recordStatsQueue[tab_id]) {
		if (!recordStatsQueue[tab_id].hasOwnProperty(bugUrl)) {
			continue;
		}

		for (i = 0; i < recordStatsQueue[tab_id][bugUrl].length; i++) {
			deets = recordStatsQueue[tab_id][bugUrl][i];
			(function (bugUrl, deets) {
				SDK.timers.setTimeout(function () {
					recordStats(bugUrl, deets);
				}, 1);
			})(bugUrl, deets);
		}
	}
	/* jshint loopfunc: false */

	delete recordStatsQueue[tab_id];
}

// every thirty minutes
SDK.timers.setInterval(cleanCaches, 1800000);

exports.onNavigate = onNavigate;
exports.recordPageInfo = recordPageInfo;
exports.recordStats = recordStats;
exports.isValidUrl = isValidUrl;
exports.queueRecordStats = queueRecordStats;
exports.dequeueRecordStats = dequeueRecordStats;
exports.appendAFStat = appendAFStat;
