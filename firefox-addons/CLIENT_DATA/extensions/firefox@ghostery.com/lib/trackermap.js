/**
 * Trackermap
 *
 * Provides functionality for Map These Trackers
 * and Global Settings API
 *
 * Copyright 2016 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var globals = require('./globals'),
	utils = require('./utils'),
	prefs = utils.prefs,
	SDK = {
		request: require('sdk/request'),
		timers: require('sdk/timers')
	},
	{defer} = require('sdk/core/promise'),
	Cu = require('chrome').Cu,

	log = utils.log,
	GHOSTERY_DOMAIN = globals.GHOSTERY_DOMAIN;

Cu.import('resource://gre/modules/Services.jsm');

module.exports = {

	UPDATE_FREQUENCY: 86400000, //one day in ms

	/**
	 ***** @DEPRECATED *****
	 * Return token from TMAAS
	 * @param  {object} worker - Reference to panel worker (aka Ghostery.panel)
	 */
	getTrackermapToken: function(worker) {
		var loggedIn = prefs('logged_in'),
			userToken = prefs('user_token'),
			isValidated = prefs('is_validated');

		var params = {
			EmailAddress: "consumerext@tmaas.ghostery.com",
			Password: "ConEoine_1"
		};

		if (loggedIn && userToken && isValidated) {
			SDK.request.Request({
				url: 'http://trackermapapi.' + GHOSTERY_DOMAIN + '.com/api/tmaaslogin',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				content: JSON.stringify(params),
				onComplete: function(response) {
					if (response.status >= 200 && response.status < 400) {
						log('post api/tmaaslogin successful', response.status);
						worker.port.emit('getTrackermapToken', response.json.Message);
					} else {
						log('post api/tmaaslogin failed', response.text);
					}
				}
			}).post();
		}
	},

	/**
	 * Sets Trackermap cookie
	 * @param  {object} worker - callback thread to open marketing page
	 * @param  {string} page - page to be scanned
	 * @param  {string} extensionVersion - current version of Ghostery extension
	 * @param  {string} browserVersion - Firefox browser version
	 */
	setTrackerMapCookie: function(worker, page, extensionVersion, browserVersion) {
		var url = encodeURI(page.url);
		var expiration = 86400; // expires in 24 hours
		var epochExpirationTime = Math.floor((new Date()).getTime() / 1000.0) + expiration;
		log("COOKIE EXPIRATION DATE", new Date(epochExpirationTime * 1000));
		Services.cookies.add('.' + GHOSTERY_DOMAIN + '.com', '/', "TMUrlToScan", url, false, false, false, epochExpirationTime);
		worker.port.emit('openTrackerMap', {
			extensionVersion: extensionVersion,
			browserVersion: browserVersion
		});
	},

	/**
	 * Helper method for pulling and storing global settings each day
	 * @param  {obj} worker - Reference to panel worker (aka Ghostery.panel)
	 * @param  {string} version - Ghostery version number as X.X.X.X
	 */
	updateGlobalSettings: function(worker, version) {
		var currentTime = Date.now(),
			lastUpdateTime = utils.prefs('global_settings_updated');
		//only update if we haven't updated yet, or if the update frequency has passed
		if (lastUpdateTime !== null && currentTime - lastUpdateTime < this.UPDATE_FREQUENCY) {
			return false;
		}
		//fetch global settings and wait for defered promise
		this.pullGlobalSettings(version).then(function success(response){
			//emit to front-end
			worker.port.emit('updateGlobalSettings', response);
			//update the timestamp and save the settings
			utils.prefs('global_settings', response);
			utils.prefs('global_settings_updated', Date.now());
			utils.forceSave();
		}, function failure(error) {
			log("UpdateGlobalSettings", error);
		});
	},

	/**
	 * Retrieves global settings based on Extension version number
	 * @type GET
	 * @Content-Type  application/json
	 * @param  {string} version - Ghostery version number as X.X.X.X
	 * @param  {string} setting - (optional) Setting ID
	 * @return {promise} - Deferred promise
	 */
	pullGlobalSettings: function(version, setting) {
		if (version) {
			var query = "https://consumerapi." + GHOSTERY_DOMAIN + ".com" + "/api/Settings/" + version + "/";
			if (setting) {
				query += setting + "/";
			}
			var deferred = defer();
			SDK.request.Request({
				url: query,
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				onComplete: function(response) {
					if(response.status == 200 && response.status < 400) {
						if(response.text == 'null') {
							deferred.reject(response.text);
						} else {
							log("SUCCESS: " + response.text);
							deferred.resolve(response.json);
						}
					} else {
						deferred.reject(response.text);
					}
				}
			}).get();
		} else {
			deferred.reject("PullGlobalSettings ERROR: Version number is required.");
		}
		return deferred.promise;
	}
};
