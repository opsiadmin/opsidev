/*!
 * Ghostery for Chrome
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var MOBILE_MODE = (require('sdk/system').platform.toLowerCase() == 'android'),
	globals = require('./globals'),
	utils = require('./utils'),
	conf = require('./conf').load,
	Cc = require('chrome').Cc,
	Ci = require('chrome').Ci,
	SDK = {
		request: require('sdk/request'),
		timers: require('sdk/timers')
	},
	xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime),
	OS = '',
	FREQUENCIES = { // in milliseconds
		daily: 86400000,
		weekly: 604800000
	},
	METRICS_SUB_DOMAIN = globals.METRICS_SUB_DOMAIN;

{
	switch (xulRuntime.OS.toLowerCase()) {
		case 'darwin':
			OS = 'mac';
			break;
		case 'winnt':
			OS = 'win';
			break;
		case 'linux':
			OS = 'linux';
			break;
		case 'android':
			OS = 'android';
			break;
		default:
			OS = 'other';
	}
}

function sendReq(type, frequency) {
	if (typeof frequency == 'undefined') {
		frequency = 'all';
	}
	if (timeToExpired(type, frequency) > 0) {
		return;
	}

	var metrics_url = 'https://' + METRICS_SUB_DOMAIN + '.ghostery.com/' +
		type + '/' +
		frequency +
		'?gr=' + (conf.ghostrank ? '1' : '0') +
		'&v=' + encodeURIComponent(utils.VERSION) +
		'&os=' + encodeURIComponent(OS) +
		'&ua=' + (MOBILE_MODE ? 'fa' : 'ff');
	utils.log('XHR to ' + metrics_url);

	SDK.request.Request({
		url: metrics_url,
		overrideMimeType: 'image/gif'
	}).get();

	// set this even on upgrades to set flag when upgrading from < 5.4
	if (type == 'upgrade') {
		utils.prefs('metrics.install.all', Date.now());
	}
	// set random number b/w 1-100 for installs
	if (type == 'install') {
		var randomNumber = (Math.floor(Math.random() * 100) + 1);
		utils.prefs('installRandomNum', randomNumber);
	}
	utils.prefs(['metrics', type, frequency].join('.'), Date.now());
	utils.forceSave();
}

function timeToExpired(type, frequency) {
	if (frequency == 'all') { return 0; }

	var metric_name = ['metrics', type, frequency].join('.'),
		last = utils.prefs(metric_name),
		now = Date.now(),
		frequency_ago = now - FREQUENCIES[frequency];

	return (last == null) ? 0 : last - frequency_ago;
}

function recordInstall() {
	if (utils.prefs('metrics.install.all')) { return; }

	sendReq('install');
}

function recordUpgrade() {
	sendReq('upgrade');
}

function recordActive() {
	var daily = timeToExpired('active', 'daily'),
		weekly = timeToExpired('active', 'weekly');

	if (daily > 0) {
		SDK.timers.setTimeout(function () {
			sendReq('active', 'daily');
			SDK.timers.setInterval(function () {
				sendReq('active', 'daily');
			}, FREQUENCIES['daily']);
		}, daily);
	} else {
		sendReq('active', 'daily');
		SDK.timers.setInterval(function () {
			sendReq('active', 'daily');
		}, FREQUENCIES['daily']);
	}

	if (weekly > 0) {
		SDK.timers.setTimeout(function () {
			sendReq('active', 'weekly');
			SDK.timers.setInterval(function () {
				sendReq('active', 'weekly');
			}, FREQUENCIES['weekly']);
		}, weekly);
	} else {
		sendReq('active', 'weekly');
		SDK.timers.setInterval(function () {
			sendReq('active', 'weekly');
		}, FREQUENCIES['weekly']);
	}
}

function recordEngaged() {
	sendReq('engaged', 'daily');
	sendReq('engaged', 'weekly');
}

function recordLiveScan() {
	sendReq('live_scan', 'all');
	sendReq('live_scan', 'daily');
	sendReq('live_scan', 'weekly');
}

function recordPause() {
	sendReq('pause', 'all');
	sendReq('pause', 'daily');
	sendReq('pause', 'weekly');
}

function recordTrustSite() {
	sendReq('trust_site', 'all');
	sendReq('trust_site', 'daily');
	sendReq('trust_site', 'weekly');
}

function recordRestrictSite() {
	sendReq('restrict_site', 'all');
	sendReq('restrict_site', 'daily');
	sendReq('restrict_site', 'weekly');
}

function recordSyncSettings() {
	sendReq('sync_settings', 'all');
	sendReq('sync_settings', 'daily');
	sendReq('sync_settings', 'weekly');
}

function recordAdvancedSettings() {
	sendReq('advanced_settings', 'all');
	sendReq('advanced_settings', 'daily');
	sendReq('advanced_settings', 'weekly');
}

function recordSignIn() {
	sendReq('sign_in', 'all');
	sendReq('sign_in', 'daily');
	sendReq('sign_in', 'weekly');
}

exports.recordInstall = recordInstall;
exports.recordUpgrade = recordUpgrade;
exports.recordActive = recordActive;
exports.recordEngaged = recordEngaged;
exports.recordLiveScan = recordLiveScan;
exports.recordPause = recordPause;
exports.recordTrustSite = recordTrustSite;
exports.recordRestrictSite = recordRestrictSite;
exports.recordSyncSettings = recordSyncSettings;
exports.recordAdvancedSettings = recordAdvancedSettings;
exports.recordSignIn = recordSignIn;
