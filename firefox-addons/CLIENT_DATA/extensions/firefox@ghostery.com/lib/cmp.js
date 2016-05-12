/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2016 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var globals = require('./globals'),
	utils = require('./utils'),
	conf = require('./conf').load,
	SDK = {
		request: require('sdk/request'),
		system: require('sdk/system'),
		timers: require('sdk/timers')
	},
	{defer} = require('sdk/core/promise'),
	Cc = require('chrome').Cc,
	Ci = require('chrome').Ci,
	log = utils.log,
	CMP_SUB_DOMAIN = globals.CMP_SUB_DOMAIN;

function getOS() {
	var OS = '';
	switch (SDK.system.platform.toLowerCase()) {
		case 'darwin':
			OS = 'mac';
			break;
		case 'winnt':
			OS = 'win';
			break;
		case 'linux':
			OS = 'linux';
			break;
		case 'openbsd':
			OS = 'openbsd';
			break;
		default:
			OS = 'other';
	}
	return OS;
}

function fetchMktgData(callback) {
	if (!conf.show_cmp) { return; }
	var URL = 'https://' + CMP_SUB_DOMAIN + '.ghostery.com/check' +
		'?os=' + encodeURIComponent(getOS()) +
		'&gr=' + encodeURIComponent((conf.ghostrank ? 'opt-in' : 'opt-out')) +
		'&ua=firefox' +
		'&v=' + encodeURIComponent(utils.prefs('cmp_version') || 0);

	try {
		var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);

		xhr.open('GET', URL, true);
		xhr.responseType = 'json';
		xhr.onreadystatechange = function () {
			var data;

			if (xhr.readyState == 4 && xhr.status != 204) { // check for success and no content
				data = xhr.response;

				if (data && (!utils.prefs('cmp_version') || data.Version > utils.prefs('cmp_version'))) { // success
					utils.prefs('cmp_version', data.Version);
					// set default dismiss
					data.Campaigns.forEach(function (c) {
						if (c.Dismiss === 0) {
							c.Dismiss = 10;
						}
					});
					utils.prefs('cmp_data', data.Campaigns);
					if (callback) {
						callback();
					}
				} else { // error
					utils.prefs('cmp_data', []);
				}
			}
		};
		xhr.send();
	} catch (e) {
		log(e);
	}
}

/**
 * Utility Method for Updating a CTA Status
 *
 * Recursively calls the CTA method on a specified interval and
 * stores the returned value in prefs. We use setTimeout instead
 * of setInterval to prevent the creation of multiple timers.
 *
 * @param  {string} cta - The call-to-action endpoint name
 * @param  {int} 	interval - Interval time in ms
 * @return {void}
 */
function updateCTAStatus(cta, interval){
	if (!interval) {
		interval == 1800000; //default is 30min
	}

	if (cta) {
		fetchCTAStatus(cta).then(function success(response){
			utils.prefs('cta_' + cta, response.CTAs[cta]);
		}, function failure(error) {
			log("updateCTAStatus", error);
		});
	} else {
		log("UpdateCTAStatus", "CTA is required");
	}

	//Create update interval. Pass recursive function args as setTimeout params
	SDK.timers.setTimeout(updateCTAStatus, interval, cta, interval);
}

/**
 * Fetch a Call-to-Action status via the CMP
 *
 * This controls the hiding/showing of CTAs
 * within the extension UI
 *
 * @param  {string} cta - The call-to-action endpoint name
 * @return {promise}
 */
function fetchCTAStatus(cta) {
	if (cta) {
		var query = 'https://' + CMP_SUB_DOMAIN + '.ghostery.com/cta/' + cta;
		var deferred = defer();
		SDK.request.Request({
			url: query,
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			onComplete: function(response) {
				if(response.status == 200 && response.status < 400) {
					log("SUCCESS:", response.json);
					deferred.resolve(response.json);
				} else {
					deferred.reject(response.text);
				}
			}
		}).get();
	} else {
		deferred.reject("FetchCTAStatus ERROR: CTA name is required.");
	}
	return deferred.promise;
}

exports.fetchMktgData = fetchMktgData;
exports.updateCTAStatus = updateCTAStatus;
exports.fetchCTAStatus = fetchCTAStatus;
exports.getOS = getOS;
