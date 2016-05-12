/**
 * User Accounts
 *
 * Provides functionality for login, create account and settings sync.
 *
 * Copyright 2015 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var globals = require('./globals'),
	utils = require('./utils'),
	conf = require('./conf').load,
	prefs = utils.prefs,
	SDK = {
		request: require('sdk/request'),
		timers: require('sdk/timers')
	},

	Cc = require('chrome').Cc,
	Ci = require('chrome').Ci,
	Cu = require('chrome').Cu,

	log = utils.log,
	GHOSTERY_DOMAIN = globals.GHOSTERY_DOMAIN;

Cu.import('resource://gre/modules/Services.jsm');

module.exports = {

	//URL CONSTANTS
	API_ROOT_URL: 'https://consumerapi.' + GHOSTERY_DOMAIN + '.com',
	VERIFICATION_URL: 'https://signon.' + GHOSTERY_DOMAIN + '.com/register/verify/', //can't set culture because site needs to append guid
	REDIRECT_URL: 'https://extension.' + GHOSTERY_DOMAIN + '.com/' + conf.language + '/settings/',
	SIGNON_URL: 'https://signon.' + GHOSTERY_DOMAIN + '.com/', //culture query param not needed, only for cookie
	AUTH_COOKIE: "AUTH",
	REFRESH_OFFSET: 60, //seconds. Refresh call will be made REFRESH_OFFSET seconds in advance of Account expiration.
	LOGOUT_TIMEOUT: 604800, //one week in sec

	/**
	 * Returns expiration timeout
	 * @param {object} decodedUserTokenObj - decoded user token as an JSON object
	 */
	getExpirationTimeout: function(decodedUserTokenObj) {
		return (decodedUserTokenObj.exp >= decodedUserTokenObj.nbf) ?
			decodedUserTokenObj.exp - decodedUserTokenObj.nbf : 0;
	},

	/**
	 * Set the login state of the current user
	 * @param {object} message - Contains userToken and decodedUserToken
	 * @param {object} worker  - Reference to panel worker (aka Ghostery.panel)
	 * @param {boolean} fromCookie - indicates that this function is called by setLoginInfoFromAuthCookie
	 * setLoginInfo is called in multiple cases:
	 * - user creates account or loggs in - called in responce to saveLoginInfo message
	 * - user starts browser - in response to getLoginInfo
	 * - user opens panel, and is logged in but not verified - in response to the direct getLoginInfo->refreshLoginInfo calls
	 * - on timer - in response to the scheduled refreshLoginInfo call
	 * - user navigated to a ghostery page with AUTH cookie on it, called by setLoginInfoFromAuthCookie onAttach to page.
	 */
	setLoginInfo: function(message, worker, fromCookie) {
		if (message.userToken && message.decodedUserTokenObj) {
			var userToken = message.userToken;
			var decodedUserTokenObj = message.decodedUserTokenObj;
			log("Setting login info in PREFS", decodedUserTokenObj);
			var isValidated = decodedUserTokenObj.ClaimEmailAddressValidated;
			isValidated = (typeof isValidated == "string" && isValidated.toLowerCase() == "true") ? true : false;
			prefs('is_validated', isValidated);
			var email = decodedUserTokenObj.ClaimEmailAddress;
			prefs('user_token', userToken);
			prefs('decoded_user_token', JSON.stringify(decodedUserTokenObj));
			prefs('logged_in', true);
			prefs('email', email);
			if(!prefs("last_refresh_time")) {
				prefs("last_refresh_time", Math.floor((new Date()).getTime() / 1000.0));
			}

			utils.forceSave();

			var lastRefreshTime = prefs("last_refresh_time");

			if (!fromCookie) {
				this.setAuthCookie(this.SIGNON_URL, userToken, decodedUserTokenObj);
			}

			if (this.scheduleNextRefresh(worker, decodedUserTokenObj, lastRefreshTime)) {
				return;
			}

			worker.port.emit('setLoginInfo', this.getLoginInfoFromPrefs(decodedUserTokenObj));

			this.pullUserSettings();
			return;
		}

		this.logOut(worker);
	},
	/**
	 * Clears login info in preferenses and notifies extension.
	*/
	logOut: function(worker) {
		prefs('logged_in', false);
		prefs('email', '');
		prefs('user_token', '');
		prefs('decoded_user_token', '');
		prefs('last_refresh_time', 0);
		prefs('is_validated', false);

		//forces save of prefs
		utils.forceSave();

		this.deleteAuthCookie();

		if (prefs.refreshTimeout) {
			SDK.timers.clearTimeout(prefs.refreshTimeout);
			delete prefs.refreshTimeout;
		}

		worker.port.emit('setLoginInfo', {
			loggedIn: false,
			email: "",
			userToken: "",
			decodedUserTokenObj: null,
			isValidated: false
		});
	},

	/**
	 * A convenience function. Returns object with full login info.
	 */
	getLoginInfoFromPrefs: function(decodedUserTokenObj) {
		return {
			loggedIn: prefs("logged_in") || false,
			email: prefs("email") || "",
			userToken: prefs("user_token") || "",
			decodedUserTokenObj: decodedUserTokenObj,
			isValidated: prefs('is_validated') || false,
		};
	},

	/**
	 * Schedules the next Refresh account request.
	 * @param  {object} worker - Reference to panel worker (aka Ghostery.panel)
	 * @param {number} nextRefresh - refresh timeout in seconds
	 * Function generally return false, so that the caller will continue.
	 * It returns true when refreshLoginInfo calls immediately and takes over.
	 * The caller should just return in this case.
	 */
	scheduleNextRefresh: function(worker, decodedUserTokenObj, lastRefreshTime) {
		if (prefs.refreshTimeout) {
			SDK.timers.clearTimeout(prefs.refreshTimeout);
			delete prefs.refreshTimeout;
		}

		var _that = this;

		var expirationFromObj = this.getExpirationTimeout(decodedUserTokenObj);
		log("scheduleNextRefresh:expirationFromObj", expirationFromObj, lastRefreshTime);
		var timeNow = Math.floor((new Date()).getTime() / 1000.0); //in sec
		var expiration = expirationFromObj - timeNow + lastRefreshTime;
		log("scheduleNextRefresh:expiration", expiration);
		if(expiration + this.LOGOUT_TIMEOUT > this.REFRESH_OFFSET) {
			if (expiration > this.REFRESH_OFFSET) {
				prefs.refreshTimeout = SDK.timers.setTimeout(function() {
					if (prefs.refreshTimeout) {
						SDK.timers.clearTimeout(prefs.refreshTimeout);
						delete prefs.refreshTimeout;
					}
					_that.getLoginInfo(worker, true);
				}, (expiration - this.REFRESH_OFFSET) * 1000);
			} else {
				if (this.refreshLoginInfo(worker)) {
					return true;
				}
			}
		} else {
			this.logOut(worker);
			return true;
		}

		return false;
	},

	/**
	 * Sends Refresh account request and schedules the next Refresh call
	 * @param  {object} worker - Reference to panel worker (aka Ghostery.panel)
	 */
	refreshLoginInfo: function(worker) {
		if (!prefs("logged_in")) {
			return false;
		}

		var decodedUserTokenObj = null;
		var _that = this;
		var decodedUserToken = prefs("decoded_user_token");
		var decodedUserTokenObj = decodedUserToken ? JSON.parse(decodedUserToken) : null;

		if (!decodedUserTokenObj || !decodedUserTokenObj.RefreshToken) {
			log("decodedUserTokenObj or decodedUserTokenObj.RefreshToken is null.");
			return false;
		}

		var params = {
			"RefreshToken": decodedUserTokenObj.RefreshToken,
			"ClientId": "1",
			"ClientSecret": "1"
		};

		function onRefreshResponse(worker, decodedUserTokenObj, lastRefreshTime) {
			if(_that.scheduleNextRefresh(worker, decodedUserTokenObj, lastRefreshTime)) {
				return;
			}

			worker.port.emit('setLoginInfo', _that.getLoginInfoFromPrefs(decodedUserTokenObj));
			_that.pullUserSettings();
		}

		SDK.request.Request({
			url: this.API_ROOT_URL + '/api/Login/Refresh',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			content: JSON.stringify(params),
			onComplete: function(response) {
				var decodedUserTokenObj = {};
				prefs('last_refresh_time', Math.floor((new Date()).getTime() / 1000.0));
				if (response.status >= 200 && response.status < 400) {
					log('Refresh call succeeded', response.status);

					var userToken = response.json.Token;
					if (userToken) {
						decodedUserTokenObj = utils.decodeJwt(userToken).payload;
						log("Setting login info in PREFS on Refresh:", JSON.stringify(decodedUserTokenObj));

						var isValidated = decodedUserTokenObj.ClaimEmailAddressValidated;

						isValidated = (typeof isValidated == "string" && isValidated.toLowerCase() == "true") ? true : false;
						prefs('is_validated', isValidated);
						prefs('email', decodedUserTokenObj.ClaimEmailAddress); // could it ever change?
						prefs('user_token', userToken);
						prefs('decoded_user_token', JSON.stringify(decodedUserTokenObj));
						utils.forceSave();

						_that.setAuthCookie(_that.SIGNON_URL, userToken, decodedUserTokenObj);

					} else {
						log('Refresh call return null userToken', response.json);
						decodedUserTokenObj = JSON.parse(prefs("decoded_user_token"));
					}
				} else {
					log('Refresh call failed', response.text);
					decodedUserTokenObj = JSON.parse(prefs("decoded_user_token"));
				}

				onRefreshResponse(worker, decodedUserTokenObj, prefs('last_refresh_time'));
			}
		}).post();

		// Return true if we managed make a post.
		return true;
	},

	/**
	 * Returns current login state
	 * @param  {object} worker - Reference to panel worker (aka Ghostery.panel)
	 * @param {boolean} forceRefresh - if true forces scheduling of the next account refresh call.
	 */
	getLoginInfo: function(worker, forceRefresh) {
		var loggedIn = prefs("logged_in") || false;
		if (!loggedIn) {
			this.logOut(worker);
			return;
		}

		var _that = this;

		var decodedUserTokenObj = JSON.parse(prefs("decoded_user_token"));

		var isValidated = prefs('is_validated') || false;

		//if not validated or if called on timeout delegate the rest to refreshLoginInfo
		if (!isValidated || forceRefresh) {
			if (this.refreshLoginInfo(worker)) {
				return;
			}
		}

		//Schedule next getLoginInfo call if it was not done yet
		if(!prefs("last_refresh_time")) {
			prefs("last_refresh_time", Math.floor((new Date()).getTime() / 1000.0));
		}

		utils.forceSave();

		var lastRefreshTime = prefs("last_refresh_time");

		if (!prefs.refreshTimeout) {
			if (this.scheduleNextRefresh(worker, decodedUserTokenObj, lastRefreshTime)) {
				return;
			}
		}

		//We are here if we logged in and validated
		worker.port.emit('setLoginInfo', this.getLoginInfoFromPrefs(decodedUserTokenObj));
		this.pullUserSettings();
	},

	/**
	 * Create User Conf object for API settings sync
	 * @return {object} - conf settings
	 */
	buildUserSettings: function() {
		return {
			paused_blocking: conf.paused_blocking,
			ignore_first_party: conf.ignore_first_party,
			block_by_default: conf.block_by_default,
			notify_library_updates: conf.notify_library_updates,
			enable_autoupdate: conf.enable_autoupdate,
			enable_click2play: conf.enable_click2play,
			enable_click2play_social: conf.enable_click2play_social,
			language: conf.language,
			ghostrank: conf.ghostrank,
			show_alert: conf.show_alert,
			alert_bubble_timeout: conf.alert_bubble_timeout,
			alert_bubble_pos: conf.alert_bubble_pos,
			alert_expanded: conf.alert_expanded,
			show_cmp: conf.show_cmp,
			site_whitelist: conf.site_whitelist || [],
			site_blacklist: conf.site_blacklist || [],
			selected_cat_ids: conf.selected_cat_ids || {},
			selected_app_ids: conf.selected_app_ids || {},
			unselected_app_ids: conf.unselected_app_ids || {},
			site_specific_cat_blocks: conf.site_specific_cat_blocks || {},
			site_specific_cat_unblocks: conf.site_specific_cat_unblocks || {},
			site_specific_blocks: conf.site_specific_blocks || {},
			site_specific_unblocks: conf.site_specific_unblocks || {}
		}
	},

	/**
	 * GET user settings from ConsumerAPI
	 * @param  {Function} callback - Nested callback used with 'getSyncData'
	 */
	pullUserSettings: function(callback) {
		var settings = {},
			loggedIn = prefs('logged_in'),
			userToken = prefs('user_token'),
			decodedUserToken = prefs('decoded_user_token'),
			decodedUserTokenObj = (decodedUserToken) ? JSON.parse(decodedUserToken) : {},
			userId = decodedUserTokenObj['UserId'];

		if (loggedIn && userToken && userId) {
			SDK.request.Request({
				url: this.API_ROOT_URL + '/api/Sync/' + userId,
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + userToken
				},
				onComplete: function(response) {
					if (response.status >= 200 && response.status < 400 && response.json) {
						log('get api/Sync successful', response.status, response.text);
						settings = response.json['SettingsJson'];
						settings = (settings) ? JSON.parse(settings) : {};

						if (settings.ignore_first_party !== undefined) {
							conf.ignore_first_party = settings.ignore_first_party;
						}
						if (settings.block_by_default !== undefined) {
							conf.block_by_default = settings.block_by_default;
						}
						if (settings.notify_library_updates !== undefined) {
							conf.notify_library_updates = settings.notify_library_updates;
						}
						if (settings.enable_autoupdate !== undefined) {
							conf.enable_autoupdate = settings.enable_autoupdate;
						}
						if (settings.enable_click2play !== undefined) {
							conf.enable_click2play = settings.enable_click2play;
						}
						if (settings.enable_click2play_social !== undefined) {
							conf.enable_click2play_social = settings.enable_click2play_social;
						}
						if (settings.language !== undefined) {
							conf.language = settings.language;
						}
						if (settings.ghostrank !== undefined) {
							conf.ghostrank = settings.ghostrank;
						}
						if (settings.show_alert !== undefined) {
							conf.show_alert = settings.show_alert;
						}
						if (settings.alert_bubble_timeout !== undefined) {
							conf.alert_bubble_timeout = settings.alert_bubble_timeout;
						}
						if (settings.alert_bubble_pos !== undefined) {
							conf.alert_bubble_pos = settings.alert_bubble_pos;
						}
						if (settings.alert_expanded !== undefined) {
							conf.alert_expanded = settings.alert_expanded;
						}
						if (settings.show_cmp !== undefined) {
							conf.show_cmp = settings.show_cmp;
						}
						if (settings.site_whitelist) {
							conf.site_whitelist = settings.site_whitelist;
						}
						if (settings.site_blacklist) {
							conf.site_blacklist = settings.site_blacklist;
						}
						if (settings.selected_cat_ids) {
							conf.selected_cat_ids = settings.selected_cat_ids;
						}
						if (settings.selected_app_ids) {
							conf.selected_app_ids = settings.selected_app_ids;
						}
						if (settings.unselected_app_ids) {
							conf.unselected_app_ids = settings.unselected_app_ids;
						}
						if (settings.site_specific_cat_blocks) {
							conf.site_specific_cat_blocks = settings.site_specific_cat_blocks;
						}
						if (settings.site_specific_cat_unblocks) {
							conf.site_specific_cat_unblocks = settings.site_specific_cat_unblocks;
						}
						if (settings.site_specific_blocks) {
							conf.site_specific_blocks = settings.site_specific_blocks;
						}
						if (settings.site_specific_unblocks) {
							conf.site_specific_unblocks = settings.site_specific_unblocks;
						}

						if (callback) {
							callback(true);
						}
					} else {
						log('get api/Sync failed', response.text);
						if (callback) {
							callback(false);
						}
					}
				}
			}).get();
		}
	},

	/**
	 * Post user settings to Consumer API
	 * @param  {object} settings - Returned from getSettings()
	 */
	pushUserSettings: function(settings) {
		var loggedIn = prefs('logged_in'),
			userToken = prefs('user_token'),
			decodedUserToken = prefs('decoded_user_token'),
			decodedUserTokenObj = (decodedUserToken) ? JSON.parse(decodedUserToken) : {},
			userId = decodedUserTokenObj['UserId'];

		if (loggedIn && userToken && userId) {
			SDK.request.Request({
				url: this.API_ROOT_URL + '/api/Sync/' + userId,
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + userToken
				},
				content: '{"SettingsJson":' + '\'' + JSON.stringify(settings.conf) + '\'}',
				onComplete: function(response) {
					if (response.status >= 200 && response.status < 400) {
						log('post api/Sync successful', response.status);
					} else {
						log('post api/Sync failed', response.text);
					}
				}
			}).post();
		}
	},

	/**
	 * Trigger email validation email for a given user
	 * @param {string} UserId - global GUID returned from prefs
	 * @param {string} RedirectUrlToAddCodeSuffixOn - Redirect Link
	 * @param {string} FooterUrl - Needed got email service
	 */
	sendVerificationEmail: function(worker) {
		var userToken = prefs('user_token'),
			email = prefs('email'),
			decodedUserToken = prefs('decoded_user_token'),
			decodedUserTokenObj = (decodedUserToken) ? JSON.parse(decodedUserToken) : {},
			userId = decodedUserTokenObj['UserId'];

		var params = {
			UserId: userId,
			RedirectUrlToAddCodeSuffixOn: this.VERIFICATION_URL,
			FooterUrl: this.VERIFICATION_URL,
			VerificationContinueUrl: this.REDIRECT_URL
		};

		if (userId) {
			SDK.request.Request({
				url: this.API_ROOT_URL + '/api/Validation/Send',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				content: JSON.stringify(params),
				onComplete: function(response) {
					if (response.status >= 200 && response.status < 400) {
						log('post api/Validation/Send successful', response.status);
						worker.port.emit('showVerificationEmailConfirmation', {
							success: true,
							email: email
						});
					} else {
						log('post api/Validation/Send failed', response.text);
						worker.port.emit('showVerificationEmailConfirmation', {
							success: false,
							email: email
						});
					}
				}
			}).post();
		}
	},


	/**
	 * Sets AUTH cookie
	 * @param  {string} url - cookie url
	 * @param  {string} userToken - encrypted user token string
	 * @param  {object} decodedUserToken -decoded user token as an JSON object
	 */
	setAuthCookie: function(url, userToken, decodedUserToken) {
		var expiration = this.getExpirationTimeout(decodedUserToken);
		var epochExpirationTime = Math.floor((new Date()).getTime() / 1000.0) + expiration;
		log("COOKIE EXPIRATION DATE", new Date(epochExpirationTime * 1000));
		Services.cookies.add('.' + GHOSTERY_DOMAIN + '.com', '/', this.AUTH_COOKIE, userToken, false, false, false, epochExpirationTime);
	},

	/**
	 * Sets login info extracted from AUTH cookie
	 * @param {url} url - domain url for AUTH cookie
	 * @param {object} worker - callback thread to notify extension
	 */
	setLoginInfoFromAuthCookie: function(url, worker) {
		var decodedUserTokenObj,
			userToken,
			decodedUserToken,
			loggedIn = prefs("logged_in") || false,
			isValidated = prefs("is_validated") || false;

		if (loggedIn && isValidated) {
			userToken = prefs('user_token') || "",
			decodedUserToken = prefs('decoded_user_token') || "";
			decodedUserTokenObj = JSON.parse(decodedUserToken) || null;

			this.setAuthCookie(url, userToken, decodedUserTokenObj);
		} else {
			//use IO Service to parse the URL into URI
			let ioSvc = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
			var cookieUri = ioSvc.newURI(url, null, null);
			log("cookieUri:", cookieUri);
			let cookies = Services.cookies.getCookiesFromHost(cookieUri.host);

			while (cookies.hasMoreElements()) {
				var cookie = cookies.getNext().QueryInterface(Ci.nsICookie2);
				if (cookie && cookie.name == this.AUTH_COOKIE && cookie.value) {
					userToken = cookie.value;
					if(userToken) {
						decodedUserTokenObj = utils.decodeJwt(userToken).payload;
						//var epochExpiration = cookie.expiry;
						var message = {
							userToken: userToken,
							decodedUserTokenObj: decodedUserTokenObj,
							//epochExpiration: epochExpiration,
						};
						log("setLoginInfoFromAuthCookie: AUTH cookie found", message);
						this.setLoginInfo(message, worker, true);
						break;
					}
				}
			}
		}
	},

	/**
	 * Deletes AUTH cookie, searching all ghostery account-related sites
	 */
	deleteAuthCookie: function() {
		var cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager),
			domains = [
				'https://extension.ghostery.com*',
				'https://extension.ghosterystage.com*',
				'https://signon.ghostery.com*',
				'https://signon.ghosterystage.com*',
				'https://account.ghostery.com*',
				'https://account.ghosterystage.com*',
				'http://extension.ghostery.dev*'
			],
			that = this;
		domains.forEach(function(domain) {
			var iter = cookieManager.enumerator;
			while (iter.hasMoreElements()) {
				var cookie = iter.getNext();
				if (cookie instanceof Ci.nsICookie && domain.indexOf(cookie.host.toLowerCase()) != -1 && cookie.name.toUpperCase() == that.AUTH_COOKIE) {
					log("COOKIE HOST: " + cookie.host + " COOKIE NAME: " + cookie.name + " DELETED");
					cookieManager.remove(cookie.host, cookie.name, cookie.path, cookie.blocked);
				}
			}
		});
	}
};
