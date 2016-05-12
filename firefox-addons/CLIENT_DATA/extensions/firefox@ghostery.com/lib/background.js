/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* jshint unused: false */

var MOBILE_MODE = (require('sdk/system').platform.toLowerCase() == 'android'),

	// Addon SDK Modules
	Cc = require('chrome').Cc,
	Ci = require('chrome').Ci,
	Cu = require('chrome').Cu,
	Cm = require('chrome').Cm,
	Cr = require('chrome').Cr,
	SDK = {
		components: require('chrome').components,
		XPCOMUtils: Cu.import('resource://gre/modules/XPCOMUtils.jsm').XPCOMUtils,
		events: require('sdk/system/events'),
		self: require('sdk/self'),
		timers: require('sdk/timers'),
		pageMod: require('sdk/page-mod'),
		tabsLib: require('./custom-sdk/tabs/helpers'),
		tabs: require('sdk/tabs'),
		file: require('sdk/io/file'),
		winUtils: require('sdk/window/utils'),
		tabUtils: require('sdk/tabs/utils'),
		request: require('sdk/request'),
		preferences: require('sdk/preferences/service'),
		unload: require('sdk/system/unload'),
		pb: (MOBILE_MODE ? null : require('sdk/private-browsing')),
		encode: require("sdk/base64").encode,
		windows: require("sdk/windows")
	},

	// Vendor Modules
	_ = require('underscore'),

	// Proprietary Modules
	globals = require('./globals'),
	utils = require('./utils'),
	conf = require('./conf').load,
	i18n = require('./i18n'),
	accounts = require('./accounts'),
	trackermap = require('./trackermap'),
	bugDb = require('./bugdb').load,
	lsoDb = require('./lsodb').load,
	c2pDb = require('./click2play').load,
	compDb = require('./compatibility').load,
	tagDb = require('./tagdb').load,
	surrogatedb = require('./surrogatedb'),
	foundBugs = require('./foundbugs'),
	tabInfo = require('./tabinfo'),
	ghostrank = require('./ghostrank'),
	matcher = require('./matcher'),
	cleaner = require('./cleaner'),
	dispatcher = require('./dispatcher'),
	metrics = require('./metrics'),
	cmp = require('./cmp'),
	system = require("sdk/system"),

	PLUS36_MODE = (+require('sdk/system').version.substring(0, 2) >= 36) && !MOBILE_MODE,

	createPanel = function () {
		return require('./panel').Panel({
			id: 'ghostery-panel',
			height: 369,
			width: 400,
			contentURL: SDK.self.data.url('panel.html'),
			panelStyle: SDK.self.data.url('css/firefoxPanel.css'),
			contentScriptFile: SDK.self.data.url('dist/panel.js')
		});
	},

	Ghostery = {
		// Holds tab_ids for all active tabs across all open windows
		activeTabs: [],

		tabWorkers: {},

		c2pQueue: {},

		needsSurrogate: {},

		blockLogWorker: null,

		VERSION_CHECK_URL: 'https://' + globals.CDN_SUB_DOMAIN + '.ghostery.com/update/version',

		button: (PLUS36_MODE ? null : require('./button')),

		panel: createPanel(),

		mainFrames: {},

		iconOn: {
			'16': SDK.self.data.url('images/ghosty-16px.png'),
			'18': SDK.self.data.url('images/ghosty-18px.png'),
			'32': SDK.self.data.url('images/ghosty-32px.png'),
			'36': SDK.self.data.url('images/ghosty-36px.png'),
			'64': SDK.self.data.url('images/ghosty-64px.png')
		},
		iconOff: {
			'16': SDK.self.data.url('images/ghosty-16px_grey.png'),
			'18': SDK.self.data.url('images/ghosty-18px_grey.png'),
			'32': SDK.self.data.url('images/ghosty-32px_grey.png'),
			'36': SDK.self.data.url('images/ghosty-36px_grey.png'),
			'64': SDK.self.data.url('images/ghosty-64px_grey.png')
		},
		CMP_DATA: []
	},

	prefs = utils.prefs,
	log = utils.log,
	upgrade_alert_shown = false,

	JUST_UPGRADED_FROM_PRE_SDK,
	JUST_UPGRADED_FROM_PRE_SS,
	JUST_UPGRADED,
	JUST_INSTALLED,

	//Global Constants
	GHOSTERY_DOMAIN = globals.GHOSTERY_DOMAIN,
	METRICS_SUB_DOMAIN = globals.METRICS_SUB_DOMAIN;

SDK.windows.browserWindows.on('deactivate', function () {
	if (Ghostery.panel) {
		Ghostery.panel.destroy();
		delete Ghostery.panel;
		Ghostery.panel = createPanel();

		if (!MOBILE_MODE) {
			setPanelPortListeners(Ghostery.panel);
		}
	}
});

if (PLUS36_MODE) {
	SDK.actionButton = require("sdk/ui/button/action").ActionButton;
	Ghostery.button = SDK.actionButton({
		badgeColor: "#330033",
		id: "ghostery-button",
		label: "Ghostery",
		icon: Ghostery.iconOn,
		onClick: showPanel
	});
}

Ghostery.BlockingPolicy = {
		QueryInterface: SDK.XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIChannelEventSink]),
		classID: SDK.components.ID('{a4992d70-56f2-11de-8a39-0800200c9a66}'),
		classDescription: 'Ghostery Blocking Policy',
		contractID: '@ghostery.com/blocking-policy;1',
		xpcomCategories: ['content-policy', 'net-channel-event-sinks'],

		init: function() {
				var registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar),
					catMan = Cc['@mozilla.org/categorymanager;1'].getService(Ci.nsICategoryManager),
					i;

				registrar.registerFactory(this.classID, this.classDescription, this.contractID, this);

				for (i = 0; i < this.xpcomCategories.length; i++) {
			catMan.addCategoryEntry(this.xpcomCategories[i], this.contractID, this.contractID, false, true);
		}

		Ghostery.BlockingPolicy.cookieBlockingInit();
	},

	// nsIContentPolicy interface implementation
	shouldLoad: function(type, contentLocation, requestOrigin, context, mimeTypeGuess, extra) {
		var tab,
			block,
			bug_id = false,
			app_id,
			cat_id,
			src = contentLocation.spec,
			tab_id,
			tab_url,
			tab_host,
			surrogates;

		// Only listen for http or https requests
		if (contentLocation.scheme.indexOf('http') !== 0) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		// Always allow cross-domain policy files
		if ((type === Ci.nsIContentPolicy.TYPE_OBJECT || type === Ci.nsIContentPolicy.TYPE_OBJECT_SUBREQUEST) &&
			src.indexOf('crossdomain.xml') >= 0) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		tab = utils.getTabForContext(context);
		if (!tab) {
			return Ci.nsIContentPolicy.ACCEPT;
		}
		tab_id = tab.id;

		if (type === Ci.nsIContentPolicy.TYPE_DOCUMENT &&
				// BOO-2876 fixes bug where this URL is incorrectly interpreted
				// as a main frame on both shouldLoad and httpRequestObserver
				// TODO file bugzilla bug / find better way of fixing this
				!/http:\/\/trc\.taboola\.com\/.*\/log\/3\/available/.test(src)) {

			if (!tab) {
				tab_id = SDK.tabs.activeTab.id;
			}

			log(`Tab ${tab_id} navigating to ${src}`);

			// NOTE main_frames such as "file://" error out when accessing host
			try {
				tab_host = contentLocation.host;
			} catch (e) {
				tab_host = '';
			}

			// TODO do we still need this?
			// check for page-level surrogates
			surrogates = surrogatedb.getForSite(tab_host);
			Ghostery.BlockingPolicy.surrogate(context, surrogates);

			if (typeof Ghostery.mainFrames[tab_id] == 'undefined') {
				Ghostery.mainFrames[tab_id] = [];
			}
			Ghostery.mainFrames[tab_id].push(src);

			return Ci.nsIContentPolicy.ACCEPT;
		}

		if (!tabInfo.get(tab_id)) {
			log(`tabInfo not found for tab ${tab_id}`);
			return Ci.nsIContentPolicy.ACCEPT;
		}

		tab_url = tab.url;
		tab_host = tabInfo.get(tab_id).host;

		// Check 'Performance Options'
		if (!conf.block_images && type === Ci.nsIContentPolicy.TYPE_IMAGE) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		if (!conf.block_frames && type === Ci.nsIContentPolicy.TYPE_SUBDOCUMENT) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		if (!conf.block_objects && type === Ci.nsIContentPolicy.TYPE_OBJECT) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		// ignore image resources coming from the top-level domain of the page being scanned
		if (type === Ci.nsIContentPolicy.TYPE_IMAGE) {
			var schemeIndex = src.indexOf('://');
			if (schemeIndex >= 0) {
				if (src.slice(schemeIndex + 3).indexOf(tab_host) === 0) {
					return Ci.nsIContentPolicy.ACCEPT;
				}
			} else if (src.indexOf(tab_host) === 0) {
				return Ci.nsIContentPolicy.ACCEPT;
			}
		}

		bug_id = matcher.isBug(src, tabInfo.get(tab_id).url);
		if (!bug_id) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		app_id = bugDb.db.bugs[bug_id].aid;
		cat_id = bugDb.db.apps[app_id].cat;
		block = shouldBlock(app_id, cat_id, tab_id, tab_host, tab_url);

		// process the tracker asynchronously
		// v. important to block request processing as little as necessary
		SDK.timers.setTimeout(function() {
			processBug({
				bug_id: bug_id,
				type: type,
				src: src,
				block: block,
				tab_id: tab_id,
				tab_url: tab_url
			});

			if (conf.ghostrank && !(SDK.pb && SDK.pb.isPrivate(tab))) {
				if (block) {
					// if bug is blocked, it never loads, so latency and above/below fold are redundant: set to -1.
					ghostrank.recordStats(
						src, {
							bug_id: bug_id,
							tab_url: tab.url,
							block: block,
							latency: -1,
							tracker_timestamp: -1,
							page_timestamp: tabInfo.get(tab_id).timestamp
						});
				}
			}
		}, 1);

		if (block) {
			// check for tracker-level surrogates
			if (type == Ci.nsIContentPolicy.TYPE_SCRIPT) {
				surrogates = surrogatedb.getForTracker(
					src,
					app_id,
					bug_id,
					tab_host
				);

				if (surrogates.length > 0) {
					// TODO is this check necessary?
					// reject simultaneous duplicate requests
					if (!Ghostery.needsSurrogate[src]) {
						log("FOUND SURROGATE, ALLOWING", src);
						Ghostery.needsSurrogate[src] = {
							surrogates: surrogates,
						};
						return Ci.nsIContentPolicy.ACCEPT;
					}
				}
			} else if (type == Ci.nsIContentPolicy.TYPE_IMAGE) {
				// TODO is this check necessary?
				// reject simultaneous duplicate requests
				if (!Ghostery.needsSurrogate[src]) {
					Ghostery.needsSurrogate[src] = {
						type: "image",
						surrogates: [{
							code: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
						}]
					};
					return Ci.nsIContentPolicy.ACCEPT;
				}
			}

			utils.blockingLog('Blocked  $TYPE$: ' + src + ' origin: ' + tab_url, type, tab, Ghostery.blockLogWorker);
			return Ci.nsIContentPolicy.REJECT_REQUEST;
		}

		return Ci.nsIContentPolicy.ACCEPT;
	},

	shouldProcess: function(contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra) {
		return Ci.nsIContentPolicy.ACCEPT;
	},

	// nsIChannelEventSink interface implementation
	// TODO: maybe better to transfer this into utils
	getNavInterface: function(channel) {
		var callbacks = [],
			i;

		if (channel.notificationCallbacks) {
			callbacks.push(channel.notificationCallbacks);
		}

		if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
			callbacks.push(channel.loadGroup.notificationCallbacks);
		}

		for (i = 0; i < callbacks.length; i++) {
			try {
				var win = callbacks[i].getInterface(Ci.nsILoadContext).associatedWindow,
					nav = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
				return [win, nav];
			} catch (e) {}
		}
	},

	asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback) {
		Ghostery.BlockingPolicy.onChannelRedirect(oldChannel, newChannel, flags);
		callback.onRedirectVerifyCallback(Cr.NS_OK);
	},

	onChannelRedirect: function(oldChannel, newChannel, flags) {
		var from_url = oldChannel.originalURI.spec,
			to_url = newChannel.URI.spec,
			block,
			bug_id,
			app_id,
			cat_id,
			nav,
			tab,
			tab_id,
			tab_host,
			tab_url;

		if (from_url == to_url) {
			return;
		}

		tab = utils.getTabFromChannel(newChannel);
		if (!tab) {
			return;
		}

		tab_id = tab.id;
		tab_url = tab.url;
		nav = this.getNavInterface(oldChannel);

		// if it is a main_frame redirect update tabInfo
		/* jshint bitwise: false */
		if (oldChannel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI &&
			oldChannel.loadFlags & Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI &&
			/* jshint bitwise: true */
			(tab_url == from_url ||
				(typeof Ghostery.mainFrames[tab_id] != 'undefined' &&
					Ghostery.mainFrames[tab_id].indexOf(from_url) >= 0))) {
			tabInfo.updateUrl(tab_id, to_url);
			updateButton(tab_id);
		}

		// exit if we are allowing through or prevent_redirection is off
		if (!conf.prevent_redirection) {
			return;
		}
		if (c2pDb.allowedThrough(tab_id)) {
			return;
		}

		bug_id = matcher.isBug(to_url, tab.url);
		if (!bug_id) {
			return;
		}

		tab_host = tabInfo.get(tab_id).host;
		app_id = bugDb.db.bugs[bug_id].aid;
		cat_id = bugDb.db.apps[app_id].cat;
		block = shouldBlock(app_id, cat_id, tab_id, tab_host, tab_url);

		// process the tracker asynchronously
		// v. important to block request processing as little as necessary
		SDK.timers.setTimeout(function() {
			processBug({
				bug_id: bug_id,
				type: -1, // TODO FF
				src: to_url,
				block: block,
				tab_id: tab_id
			});

			// TODO crbug.com/141716 and 93646
			// TODO Handle Omnibox prefetching, which produces requests
			// TODO with tab IDs that do not correspond to a valid tab object.
			if (conf.ghostrank && !(SDK.pb && SDK.pb.isPrivate(tab))) {
				if (block) {
					// if bug is blocked, it never loads so latency and above/below fold are redundant: set to -1.
					ghostrank.recordStats(
						to_url, {
							bug_id: bug_id,
							tab_url: tab.url,
							block: block,
							latency: -1
						});
				}
			}
		}, 1);

		if (block) {
			/* jshint bitwise: false */
			if (nav && (oldChannel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI) !== 0) {
				/* jshint bitwise: true */
				nav[1].loadURI(SDK.self.data.url('blocked_redirect.html'), null, null, null, null);

				SDK.timers.setTimeout(function() {
					try {
						var doc = nav[1].document,
							app_name = bugDb.db.apps[app_id].name,
							redirect_url;

						redirect_url = /\=(https?%3A%2F%2F[^&]+)/i.exec(from_url);
						if (redirect_url && redirect_url[1]) {
							redirect_url = decodeURIComponent(redirect_url[1]);
						}

						doc.title = i18n.t('blocked_redirect_page_title');

						doc.getElementById('redirect-prevent').innerHTML =
							i18n.t(
								'blocked_redirect_prevent',
								utils.processUrl(from_url).host,
								utils.processUrl(to_url).host,
								app_name,
								'http://www.ghostery.com/apps/' + encodeURIComponent(app_name.replace(/\s+/g, '_').toLowerCase()));

						doc.getElementById('action_always').firstChild.title = i18n.t('blocked_redirect_action_always_title'); // firstChild should be the action_always image
						doc.getElementById('action_through_once').firstChild.title = i18n.t('blocked_redirect_action_through_once_title'); // firstChild should be the action_always image

						if (redirect_url) {
							doc.getElementById('redirect-url').innerHTML = i18n.t('blocked_redirect_url_content',
								redirect_url,
								app_name);
							doc.getElementById('redirect-url').style.display = 'block';
						}

						doc.getElementById('action_always').addEventListener('click', function(e) {
							delete conf.selected_app_ids[app_id];
							delete conf.selected_lsos_app_ids[app_id];
							doc.location = to_url;
							e.preventDefault();
						});

						doc.getElementById('action_through_once').addEventListener('click', function(e) {
							c2pDb.allowThrough(tab_id);
							doc.location = to_url;
							e.preventDefault();
						});
					} catch (e) {}
				}, 500);
			}

			utils.blockingLog("Redirect prevented: " + from_url + " to " + to_url + " on " + tabInfo.get(tab_id).host, null, tab, Ghostery.blockLogWorker);

			//throw 'Ghostery Redirect Component: redirect denied based on blocking policy!';
			throw Cr.NS_BASE_STREAM_WOULD_BLOCK;
		}

		/* A case exists when it looks to be impossible to associate a redirect with a top domain: when a redirect occurs in a frame or in a chain.*/
		return;
	},

	// nsIFactory interface implementation
	createInstance: function(outer, iid) {
		if (outer) {
			throw Cr.NS_ERROR_NO_AGGREGATION;
		}
		return this.QueryInterface(iid);
	},

	// Cookie Blocking
	cookieManager: null,

	cookieBlockingInit: function() {
		SDK.events.on('cookie-changed', Ghostery.BlockingPolicy.cookieBlockingPolicy, true);

		Ghostery.BlockingPolicy.cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);
	},

	cookieBlockingPolicy: function(event) {
		var block,
			cookie,
			cookie_id,
			app_id,
			cat_id,
			tab = tabInfo.get(),
			tab_id = tab.id,
			tab_url = tab.url,
			tab_host = tab.host;

		if ((event.data == 'added') || (event.data == 'changed')) {

			cookie = event.subject.QueryInterface(Ci.nsICookie);
			cookie_id = matcher.isLso(cookie.host);

			if (!cookie_id) {
				return;
			}

			app_id = lsoDb.db.lsos[cookie_id].aid;
			cat_id = bugDb.db.apps[app_id].cat;
			block = shouldBlock(app_id, cat_id, tab_id, tab_host, tab_url);

			if (block) {
				Ghostery.BlockingPolicy.cookieManager.remove(cookie.host, cookie.name, cookie.path, false);
				utils.blockingLog('Blocked cookie: ' + cookie.name + ' on ' + cookie.host + cookie.path + ' with value: ' + cookie.value, Ghostery.blockLogWorker);
			}
		}
	},

	removeCookieBlocking: function() {
		// colliding addon present, disable
		try {
			SDK.events.off('cookie-changed', Ghostery.BlockingPolicy.cookieBlockingPolicy);
		} catch (e) {}
	},

	surrogate: function(context, surrogates) {
		if (!surrogates || surrogates.length === 0) {
			return;
		}

		var doc = context && context.ownerDocument || context;

		// Does context exists?
		if (!doc || !doc.documentElement) {
			return;
		}

		surrogates.forEach(function(surrogate) {
			var id = "bug.surrogate." + surrogate.sid;

			// stop if its already present
			if (doc.getElementById(id)) {
				return;
			}

			var script = doc.createElement("script");
			script.id = id;
			script.appendChild(doc.createTextNode(surrogate.code));
			doc.documentElement.insertBefore(script, doc.documentElement.firstChild);
		});
	}
};

function onDOMContentLoaded(tab) {
	var tab_id = tab.id,
		tab_url = tab.url,
		tab_host;

	// show alert bubble only after DOM has loaded
	if (tabInfo.get(tab_id)) {
		tabInfo.get(tab_id).DOMLoaded = true;
	}

	if (conf.show_alert && !conf.paused_blocking) {
		createBox(tab_id);
	}

	// show upgrade notifications
	utils.getActiveTab(function(tab) {
		if (tab.id != tab_id || (SDK.pb && SDK.pb.isPrivate(tab))) {
			return;
		}

		var alert_messages = [
				'dismiss',
				'notification_reminder1',
				'notification_reminder2',
				'notification_reminder_link',
				'notification_update',
				'notification_update_link',
				'notification_upgrade',
				'notification_upgrade_link'
			],
			worker = tabInfo.get(tab_id).worker;

		if (Ghostery.CMP_DATA.length !== 0) {
			worker.port.emit('showCMPMessage', {
				data: Ghostery.CMP_DATA
			});
			// decrease dismiss count
			worker.port.on('shownCMP', function() {
				Ghostery.CMP_DATA[0].Dismiss--;
				if (Ghostery.CMP_DATA[0].Dismiss <= 0) {
					Ghostery.CMP_DATA.splice(0, 1);
				}
			});

		} else if (JUST_UPGRADED && !upgrade_alert_shown) {
			var name = 'showUpgradeAlert';

			worker.port.emit(name, {
				translations: _.object(_.map(alert_messages, function(key) {
					return [key, i18n.t(key)];
				}))
			});
			// not all tabs will have content scripts loaded, so better wait for confirmation first
			// TODO no longer necessary?
			upgrade_alert_shown = true;

		} else if (bugDb.db.JUST_UPDATED_WITH_NEW_TRACKERS) {
			if (conf.notify_library_updates) {
				worker.port.emit('showUpdateAlert', {
					translations: _.object(_.map(alert_messages, function(key) {
						return [key, i18n.t(key)];
					}))
				});
				bugDb.db.JUST_UPDATED_WITH_NEW_TRACKERS = false;
			} else {
				bugDb.db.JUST_UPDATED_WITH_NEW_TRACKERS = false;
			}
		}
	});

	// perform page-level GhostRank, but only if the page had some trackers on it
	// TODO document on wiki
	if (conf.ghostrank) {
		if (tab && !(SDK.pb && SDK.pb.isPrivate(tab)) && ghostrank.isValidUrl(utils.processUrl(tab_url))) {
			var pageInfoWorker = tab.attach({
				contentScriptFile: SDK.self.data.url('includes/page_info.js')
			});

			pageInfoWorker.port.on('recordPageInfo', function(data) {
				ghostrank.recordPageInfo(data.domain, data.latency, tabInfo.get(tab_id).timestamp, data.spots);
			});
		}
	}
}

function setPanelPortListeners(worker) {
	worker.port.on('showHelpView', function() {
		worker.port.emit('showHelpView', {
			version: utils.VERSION
		});
	});

	function emitShowBlockingView(opts) {
		var tab_id = opts.tab_id || SDK.tabs.activeTab.id,
			tab_url = (tabInfo.get(opts.tab_id) && tabInfo.get(opts.tab_id).url) || SDK.tabs.activeTab.url,
			tab_host = (tabInfo.get(opts.tab_id) && tabInfo.get(opts.tab_id).host) || tabInfo.get(tab_id).host;

		Ghostery.panel.port.emit('showBlockingView', {
			MOBILE_MODE: MOBILE_MODE,
			trackers: foundBugs.getApps(tab_id),
			categories: foundBugs.getCategories(tab_id),
			page: {
				url: tab_url,
				host: tab_host
			},
			sitePolicy: getSitePolicy(tab_url),
			tabId: tab_id,
			paused_blocking: conf.paused_blocking,
			needsReload: (tabInfo.get(tab_id) ? tabInfo.get(tab_id).needsReload : 0),
			validProtocol: (tab_url.indexOf('http') === 0),
			conf: conf.toJSON(),
			language: conf.language,
			showReloaded: opts.success,
			activeCategoryId: opts.category_id,
			syncSuccess: opts.syncSuccess
		});
	};

	worker.port.on('showBlockingView', function(message) {
		emitShowBlockingView({
			category_id: message && message.category_id,
			tab_id: message && message.tab_id
		});
	});

	worker.port.on('updateHistory', function(message) {
		prefs("history", message.history);
	});

	worker.port.on('showDashboardView', function(message) {
		var tab_id = message.tab_id || SDK.tabs.activeTab.id,
			tab_url = (tabInfo.get(message.tab_id) && tabInfo.get(message.tab_id).url) || SDK.tabs.activeTab.url,
			tab_host = (tabInfo.get(message.tab_id) && tabInfo.get(message.tab_id).host) || tabInfo.get(tab_id).host;

		worker.port.emit('showDashboardView', {
			MOBILE_MODE: MOBILE_MODE,
			trackers: foundBugs.getApps(tab_id),
			trackersByBlocked: foundBugs.getAppsCountByBlocked(tab_id),
			categories: foundBugs.getCategories(tab_id),
			tabId: tab_id,
			conf: conf.toJSON(),
			page: {
				url: tab_url,
				host: tab_host
			},
			sitePolicy: getSitePolicy(tab_url),
			paused_blocking: conf.paused_blocking,
			needsReload: (tabInfo.get(tab_id) ? tabInfo.get(tab_id).needsReload : 0),
			validProtocol: (tab_url.indexOf('http') === 0),
			notScanned: !foundBugs.getApps(tab_id),
			language: conf.language
		});
	});

	worker.port.on('panelPauseToggle', function() {
		conf.paused_blocking = !conf.paused_blocking;
		worker.port.emit('toggleDisabledBlocking', {
			paused_blocking: conf.paused_blocking
		});

		//sync settings here
		accounts.pushUserSettings({
			'conf': accounts.buildUserSettings()
		});

		//toggle the purplebox
		if (!conf.paused_blocking && conf.show_alert) {
			createBox(SDK.tabs.activeTab.id);
		} else {
			destroyBox(SDK.tabs.activeTab.id);
		}

		metrics.recordPause();
	});

	worker.port.on('showSigninView', function() {
		worker.port.emit('showSigninView');
	});

	worker.port.on('showSignoutView', function() {
		worker.port.emit('showSignoutView');
	});

	worker.port.on('signedInState', function() {
		worker.port.emit('returnSignedInState', {
			firstName: JSON.parse(prefs('decoded_user_token')).ClaimFirstName,
			email: prefs("email")
		});
	});

	worker.port.on('needsReload', function(message) {
		if (tabInfo.get(message.tab_id)) {
			tabInfo.get(message.tab_id).needsReload = message.needsReload;
		}
	});

	worker.port.on('panelShowTutorialSeen', function() {
		prefs('panelTutorialShown', true);
	});

	worker.port.on('closeTab', function() {
		SDK.tabs.activeTab.close(function() {
			var win = SDK.winUtils.getMostRecentBrowserWindow();
			win.fullScreen = true;
			win.fullScreen = false;
		});
	});
	worker.port.on('reloadTab', function(message) {
		if (message.tab_id) {
			utils.reloadTab(message.tab_id);
		} else if (SDK.tabs.activeTab) {
			SDK.tabs.activeTab.reload();
		}
	});

	worker.port.on('panelClose', function(message) {
		hidePanel(message.backToTab);
	});

	//whitelist/blacklist
	worker.port.on('panelSitePolicyToggle', function(message) {
		var whitelisted_url = whitelisted(message.tab_url),
			blacklisted_url = blacklisted(message.tab_url),
			// remove www subdomain
			hostname = message.tab_host.replace(/^www\./, '');

		if (message.action == 'whitelist') {
			if (whitelisted_url) {
				conf.site_whitelist.splice(conf.site_whitelist.indexOf(whitelisted_url), 1);
			} else if (hostname) {
				if (blacklisted_url) {
					conf.site_blacklist.splice(conf.site_whitelist.indexOf(blacklisted_url), 1);
				}
				conf.site_whitelist.push(hostname);
			}

			metrics.recordTrustSite();
		} else {
			if (blacklisted_url) {
				conf.site_blacklist.splice(conf.site_whitelist.indexOf(blacklisted_url), 1);
			} else if (hostname) {
				if (whitelisted_url) {
					conf.site_whitelist.splice(conf.site_whitelist.indexOf(whitelisted_url), 1);
				}
				conf.site_blacklist.push(hostname);
			}

			metrics.recordRestrictSite();
		}
		//sync settings here
		accounts.pushUserSettings({
			'conf': accounts.buildUserSettings()
		});
	});

	//category policy
	worker.port.on('category_policy', function(msg) {
		//category global
		function cat_gPolicy (msg) {
			if (msg.cat_selected) {
				conf.selected_cat_ids[msg.cat_id] = 1;
			} else {
				delete conf.selected_cat_ids[msg.cat_id];
			}
		};

		//category site-specific
		function cat_ssPolicy (msg) {
			var cat_id = msg.cat_id,
				host = msg.tab_host;

			if ('ssBlocked' in msg) {
				if (msg.ssBlocked) {
					if (!conf.site_specific_cat_blocks.hasOwnProperty(host)) {
						conf.site_specific_cat_blocks[host] = [];
					}

					if (conf.site_specific_cat_blocks[host].indexOf(cat_id) == -1) {
						conf.site_specific_cat_blocks[host].push(cat_id);
					}
				} else {
					if (conf.site_specific_cat_blocks.hasOwnProperty(host) && conf.site_specific_cat_blocks[host].indexOf(cat_id) >= 0) {
						conf.site_specific_cat_blocks[host].splice(conf.site_specific_cat_blocks[host].indexOf(cat_id), 1);

						if (conf.site_specific_cat_blocks[host].length === 0) {
							delete conf.site_specific_cat_blocks[host];
						}
					}
				}
			}

			if ('ssAllowed' in msg) {
				if (msg.ssAllowed) {
					if (!conf.site_specific_cat_unblocks.hasOwnProperty(host)) {
						conf.site_specific_cat_unblocks[host] = [];
					}

					if (conf.site_specific_cat_unblocks[host].indexOf(cat_id) == -1) {
						conf.site_specific_cat_unblocks[host].push(cat_id);
					}
				} else {
					if (conf.site_specific_cat_unblocks.hasOwnProperty(host) && conf.site_specific_cat_unblocks[host].indexOf(cat_id) >= 0) {
						conf.site_specific_cat_unblocks[host].splice(conf.site_specific_cat_unblocks[host].indexOf(cat_id), 1);

						if (conf.site_specific_cat_unblocks[host].length === 0) {
							delete conf.site_specific_cat_unblocks[host];
						}
					}
				}
			}
		};

		cat_gPolicy(msg);
		cat_ssPolicy(msg);

		//sync settings here
		accounts.pushUserSettings({
			'conf': accounts.buildUserSettings()
		});
	});

	//tracker global and site specific blocking policies
	worker.port.on('tracker_policy', function(msg) {
		//tracker global
		function gPolicy (msg) {
			if ('gBlocked' in msg) {
				if (msg.gBlocked) {
					conf.selected_app_ids[msg.app_id] = 1;
				} else {
					delete conf.selected_app_ids[msg.app_id];
				}
			}

			if ('gAllowed' in msg) {
				if (msg.gAllowed) {
					conf.unselected_app_ids[msg.app_id] = 1;
				} else {
					delete conf.unselected_app_ids[msg.app_id];
				}
			}
		}

		//tracker site specific
		function ssPolicy (msg) {
			var app_id = +msg.app_id,
				host = msg.tab_host;

			if ('ssBlocked' in msg) {
				if (msg.ssBlocked) {
					if (!conf.site_specific_blocks.hasOwnProperty(host)) {
						conf.site_specific_blocks[host] = [];
					}

					if (conf.site_specific_blocks[host].indexOf(app_id) == -1) {
						conf.site_specific_blocks[host].push(app_id);
					}
				} else {
					if (conf.site_specific_blocks.hasOwnProperty(host) && conf.site_specific_blocks[host].indexOf(app_id) >= 0) {
						conf.site_specific_blocks[host].splice(conf.site_specific_blocks[host].indexOf(app_id), 1);

						if (conf.site_specific_blocks[host].length === 0) {
							delete conf.site_specific_blocks[host];
						}
					}
				}
			}

			if ('ssAllowed' in msg) {
				if (msg.ssAllowed) {
					if (!conf.site_specific_unblocks.hasOwnProperty(host)) {
						conf.site_specific_unblocks[host] = [];
					}

					if (conf.site_specific_unblocks[host].indexOf(app_id) == -1) {
						conf.site_specific_unblocks[host].push(app_id);
					}
				} else {
					if (conf.site_specific_unblocks.hasOwnProperty(host) && conf.site_specific_unblocks[host].indexOf(app_id) >= 0) {
						conf.site_specific_unblocks[host].splice(conf.site_specific_unblocks[host].indexOf(app_id), 1);

						if (conf.site_specific_unblocks[host].length === 0) {
							delete conf.site_specific_unblocks[host];
						}
					}
				}
			}
		}

		gPolicy(msg);
		ssPolicy(msg);

		//sync settings here
		accounts.pushUserSettings({
			'conf': accounts.buildUserSettings()
		});
	});

	worker.port.on('panelOpenLinkInTab', function(message) {
		openTab(message.url, message.local, false, message.same_tab);
	});

	worker.port.on('copyToClipboard', function(message) {
		Cc["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Ci.nsIClipboardHelper)
			.copyString(message.text || '');
	});

	worker.port.on('ajaxRequest', function(message) {
		SDK.request.Request({
			url: message.url,
			onComplete: function(response) {
				worker.port.emit('ajaxResponse', {
					id: message.id,
					success: (response.status == 200),
					json: response.json
				});
			}
		}).get();
	});

	//Account related
	worker.port.on('saveLoginInfo', function(message) {
		accounts.setLoginInfo(message, Ghostery.panel);
		//if creating an account, post existing settings
		if (message.method === 'createAccount') {
			accounts.pushUserSettings({
				'conf': accounts.buildUserSettings()
			});
		}
	});

	worker.port.on('getLoginInfo', function() {
		accounts.getLoginInfo(Ghostery.panel);
	});

	worker.port.on('getSyncData', function() {
		accounts.pullUserSettings(function(success) {
			emitShowBlockingView({
				syncSuccess: success
			});
		});
	});

	worker.port.on('sendVerificationEmail', function() {
		accounts.sendVerificationEmail(Ghostery.panel);
	});

	worker.port.on('setTrackerMapCookie', function(page) {
		trackermap.setTrackerMapCookie(Ghostery.panel, page, utils.VERSION, system.version);
	});

	worker.port.on('reportBrokenSite', function(message) {

		var tab_id = message.tab_id || SDK.tabs.activeTab.id,
			tab_url = (tabInfo.get(message.tab_id) && tabInfo.get(message.tab_id).url) || SDK.tabs.activeTab.url;

		worker.port.emit('reportBrokenSiteResponse', {
			url: tab_url,
			extensionVersion: utils.VERSION,
			browserVersion: system.version,
			categories: foundBugs.getCategories(tab_id),
			os: cmp.getOS(),
			dbVersion: bugDb.db.version
		});
	});

	worker.port.on('deleteAuthCookie', function() {
		accounts.deleteAuthCookie();
	});

	worker.port.on('trackermapLaunched', function () {
		metrics.recordLiveScan();
	});

	worker.port.on('launchSettingsPage', function () {
		metrics.recordAdvancedSettings();
	});

	worker.port.on('syncSettingsBlockingPanel', function () {
		metrics.recordSyncSettings();
	});

	worker.port.on('clickedSignInDashboardView', function () {
		metrics.recordSignIn();
	})
}

function loadGhosteryPageMod() {
	// Purple box, grey box, etc.
	SDK.pageMod.PageMod({
		include: '*',
		contentScriptWhen: 'start',
		attachTo: ['existing', 'top'], // TODO FF: make blocking policy start before this is run on install
		contentScriptFile: SDK.self.data.url('includes/ghostery.js'),
		contentStyleFile: SDK.self.data.url('./dist/css/purple_box.css'),
		onAttach: function(worker) {
			if (!worker.tab) {
				return;
			}

			var tab_id = worker.tab.id;

			// TODO FF
			// NOTE we use this hack to correctly update the tabInfo object when opening a page
			// from a link in the new tab (about:blank) page.
			// NOTE we check for tab.url and tabInfo.url consistency to hack around multiple
			// redirects that incorrectly update the tabInfo object
			if (tabInfo.get(tab_id).url == 'about:blank' || tabInfo.get(tab_id).url != worker.tab.url) {
				tabInfo.create(tab_id, worker.tab.url);
			}

			// dequeue ghostrank in case the last page did not finish loading
			ghostrank.dequeueRecordStats(tab_id);
			// note that we are injected by initializing foundBugs for this tab
			foundBugs.update(tab_id);
			updateButton(tab_id);

			tabInfo.get(tab_id).worker = worker;

			worker.port.on('openTab', function(message) {
				openTab(message.url);
			});

			worker.port.on('dismissCMPMessage', function() {
				Ghostery.CMP_DATA.splice(0, 1);
			});

			worker.port.on('hideAlert', function() {
				conf.show_alert = false;

				//push new settings to API
				accounts.pushUserSettings({
					'conf': accounts.buildUserSettings()
				});
			});

			worker.port.on('updateAlertConf', function(message) {
				conf.alert_expanded = message.alert_expanded;
				conf.alert_bubble_pos = message.alert_bubble_pos;
				conf.alert_bubble_timeout = message.alert_bubble_timeout;

				//push new settings to API
				accounts.pushUserSettings({
					'conf': accounts.buildUserSettings()
				});
			});
		}
	});
}

function loadGhosteryPageMod_mobile() {
	// Ghostery button
	SDK.pageMod.PageMod({
		include: '*',
		contentScriptWhen: 'start',
		attachTo: ['existing', 'top'], // TODO FF: make blocking policy start before this is run on install
		contentScriptFile: SDK.self.data.url('includes/ghostery_mobile.js'),
		onAttach: function(worker) {
			var tab_id = worker.tab.id;

			if (conf.show_button) {
				worker.port.emit('showButton');
			}

			worker.port.on('showPanel', function() {
				showPanel_mobile(tab_id);
			});

			tabInfo.get(tab_id).worker = worker;
		}
	});

	// Findings panel
	SDK.pageMod.PageMod({
		include: SDK.self.data.url('panel_mobile.html') + "*",
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: SDK.self.data.url('dist/panel.js'),
		onAttach: function(worker) {
			Ghostery.panel = worker;
			var tab_id = parseInt(worker.tab.url.substr(worker.tab.url.indexOf('tabId=') + 6), 10),
				tab_url = tabInfo.get(tab_id).url,
				tab_host = tabInfo.get(tab_id).host;

			setPanelPortListeners(worker);

			worker.port.emit('showDashboardView', {
				MOBILE_MODE: MOBILE_MODE,
				trackers: foundBugs.getApps(tab_id),
				trackersByBlocked: foundBugs.getAppsCountByBlocked(tab_id),
				categories: foundBugs.getCategories(tab_id),
				tabId: tab_id,
				conf: conf.toJSON(),
				page: {
					url: tab_url,
					host: tab_host
				},
				sitePolicy: getSitePolicy(tab_url),
				paused_blocking: conf.paused_blocking,
				needsReload: (tabInfo.get(tab_id) ? tabInfo.get(tab_id).needsReload : 0),
				showTutorial: !prefs('panelTutorialShown'),
				validProtocol: (tab_url.indexOf('http') === 0),
				notScanned: !foundBugs.getApps(tab_id),
				language: conf.language,
				menuClosed: true,
				show_map_these_trackers: prefs('cta_mapthesetrackers') || false
			});
		}
	});
}

function loadDOMScannerPageMod() {
	SDK.pageMod.PageMod({
		include: '*',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top', 'frame'],
		contentScriptFile: SDK.self.data.url('includes/ghostery_dom_scanner.js'),
		onAttach: function(worker) {
			var tab = worker.tab,
				tab_id,
				tab_url,
				tab_host;

			if (!tab) {
				return;
			}

			tab_id = worker.tab.id;
			tab_url = tab.url;
			tab_host = tabInfo.get(tab_id).host;

			if (!Ghostery.tabWorkers.hasOwnProperty(tab_id)) {
				Ghostery.tabWorkers[tab_id] = [];
			}
			Ghostery.tabWorkers[tab_id].push(worker);
			flushC2PData(tab_id);

			// only triggered when main frame has finished loading
			worker.port.on('pageLoaded', function(message) {
				tabInfo.get(tab_id).pageLoaded = true;
				ghostrank.dequeueRecordStats(tab_id);
			});

			worker.port.emit('scanDOM', {
				conf: conf.toJSON(),
				site: tab_host,
				MOBILE_MODE: MOBILE_MODE
			});

			worker.port.on('isBug', function(data) {
				var bug_id,
					app_id,
					cat_id,
					block;

				bug_id = matcher.isBug(data.src, tab_url);
				if (!bug_id) {
					return;
				}

				app_id = bugDb.db.bugs[bug_id].aid;
				cat_id = bugDb.db.apps[app_id].cat;
				block = shouldBlock(app_id, cat_id, tab_id, tab_host, tab_url);

				// TODO FF should we also check for click2play_enabled/_social ?
				if (block && !c2pDb.db.apps[app_id]) {
					worker.port.emit('removeBug', {
						index: data.index
					});
				}

				if (conf.ghostrank && !(SDK.pb && SDK.pb.isPrivate(tab))) {
					ghostrank.appendAFStat(
						tab_id,
						data.src,
						data.af, {
							tab_url: tab_url,
							bug_id: bug_id,
							block: block,
							latency: -1,
							af: data.af
						});
				}

				// TODO: we may want to make this less resource intensive
				var foundApps = foundBugs.getApps(tab_id),
					app, i, j;
				if (foundApps) {
					for (i = 0; i < foundApps.length; i++) {
						app = foundApps[i];
						if (app.id != app_id) {
							continue;
						}

						for (j = 0; j < app.sources.length; j++) {
							if (app.sources[j].src == data.src) {
								return;
							}
						}
					}
				}

				SDK.timers.setTimeout(function() {
					processBug({
						bug_id: bug_id,
						type: -1, // TODO FF: is it necessary to get contentType?
						src: data.src,
						block: block,
						tab_id: tab_id,
						tab_url: tab_url
					});
				}, 1);
			});

			if (!conf.enable_click2play) {
				return;
			}

			worker.port.emit('c2pFrameHtml', {
				html: _.template(SDK.self.data.load('templates/click2play.html'))({
					ghosty_blocked: SDK.self.data.url('images/click2play/ghosty_blocked.png'),
					allow_once: SDK.self.data.url('images/click2play/allow_once.png'),
					allow_unblock: SDK.self.data.url('images/click2play/allow_unblock.png'),
					t: i18n.t
				})
			});

			worker.port.on('c2pToolTip', function(message) {
				var tooltip = {},
					app_name = bugDb.db.apps[message.bug.aid].name;

				if (message.bug.button) {
					tooltip.action_once = i18n.t('click2play_allow_once_button_tooltip', app_name);
				} else {
					tooltip.ghosty_block = i18n.t('click2play_blocked', app_name);

					if (message.bug.type) {
						tooltip.text = i18n.t('click2play_' + message.bug.type + '_form', app_name);
					}
				}

				worker.port.emit('c2pToolTip', {
					tooltip: tooltip,
					bug: message.bug,
					c2pFrameId: message.c2pFrameId
				});
			});

			worker.port.on('processC2P', function(message) {
				if (message.action == 'always') {
					message.bug.allow.forEach(function(aid) {
						conf.unselected_app_ids[aid] = 1;
					});
					utils.reloadTab(tab_id);
				} else if (message.action == 'once') {
					c2pDb.allowOnce(message, tab_id);
					utils.reloadTab(tab_id);
				} else if (message.action == 'through') {
					c2pDb.allowThrough(tab_id);
				}
			});

			// NOTE this is a necessary hack to correctly update the tab_url of a newly open tab on Android
			if (MOBILE_MODE) {
				worker.port.on('updateTabInfo', function(message) {
					if (!tabInfo.get(tab_id)) {
						tabInfo.create(tab_id, message.tab_url);
					} else {
						tabInfo.updateUrl(tab_id, message.tab_url);
					}
				});
			}
		}
	});
}

function loadPageMods() {
	if (MOBILE_MODE) {
		loadGhosteryPageMod_mobile();
	} else {
		loadGhosteryPageMod();
	}

	loadDOMScannerPageMod();

	// Beta download page
	SDK.pageMod.PageMod({
		include: 'http://beta.ghostery.com/*',
		contentScriptWhen: 'ready',
		attachTo: ['existing', 'top'],
		contentScript: 'var body = document.getElementsByTagName("body")[0]; \
						body.className = "success";'
	});

	//All extension.ghostery pages
	SDK.pageMod.PageMod({
		include: [
			'https://extension.ghostery.com*',
			'https://extension.ghosterystage.com*',
			'https://signon.ghostery.com*',
			'https://signon.ghosterystage.com*',
			'https://account.ghostery.com*',
			'https://account.ghosterystage.com*',
			'http://extension.ghostery.dev*'
		],
		contentScriptWhen: 'ready',
		attachTo: ['existing', 'top'],
		contentScript: '\
			var logoutLink = document.getElementsByClassName("logout-link")[0];\
			if (typeof logoutLink !== "undefined") {\
				logoutLink.addEventListener("click", function(e){\
					self.port.emit("loggedOut", true);\
				});\
			}\
		',
		onAttach: function(worker) {
			accounts.setLoginInfoFromAuthCookie(worker.tab.url, Ghostery.panel);
			//logout extension when the logout button is clicked
			worker.port.on('loggedOut', function(message) {
				accounts.logOut(Ghostery.panel);
			});
		}
	});

	// Pages without language in the URL
	SDK.pageMod.PageMod({
		include: [
			/https:\/\/extension\.ghostery\.com\/(intro|setup|settings|upgrade|rate-us).*/,
			/https:\/\/extension\.ghosterystage\.com\/(intro|setup|settings|upgrade|rate-us).*/,
			/http:\/\/extension\.ghostery\.dev\/(intro|setup|settings|upgrade|rate-us).*/
		],
		onAttach: function(worker) {
			// Redirect to page with language in the URL
			worker.tab.url = worker.tab.url.replace(/\.(com|dev)/, '.$1/' + conf.language);
		}
	});

	// Intro page
	SDK.pageMod.PageMod({
		include: [
			/https:\/\/extension\.ghostery\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/intro.*/,
			/https:\/\/extension\.ghosterystage\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/intro.*/,
			/http:\/\/extension\.ghostery\.dev\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/intro.*/
		],
		attachTo: ['existing', 'top'],
		onAttach: function(worker) {
			var loggedIn = prefs('logged_in');
			if (loggedIn)
				worker.tab.url = 'https://extension.' + GHOSTERY_DOMAIN + '.com/' + conf.language + '/settings';

			worker.tab.on('close', function () {
				// Record install on intro page tab close
				metrics.recordInstall();
			});
		}
	});

	// User Setup Page. (/setup)
	SDK.pageMod.PageMod({
		include: [ // Slightly different RegEx to prevent this from firing when you go to setup/sharedata or setup/complete.
			/https:\/\/extension\.ghostery\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup($|\/$|#.*)/,
			/https:\/\/extension\.ghosterystage\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup($|\/$|#.*)/,
			/http:\/\/extension\.ghostery\.dev\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup($|\/$|#.*)/
		],
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScript: 'unsafeWindow.dispatchEvent(new Event("extensionFound"));',
		contentScriptFile: [
			SDK.self.data.url('dist/setup.js')
		],
		onAttach: function(worker) {
			function getTranslations() {
				return {
					whitelist_error_duplicate_url: i18n.t('whitelist_error_duplicate_url'),
					whitelist_error_blacklist_url: i18n.t('whitelist_error_blacklist_url'),
					blacklist_error_duplicate_url: i18n.t('blacklist_error_duplicate_url'),
					blacklist_error_whitelist_url: i18n.t('blacklist_error_whitelist_url'),
					white_black_list_error_invalid_url: i18n.t('white_black_list_error_invalid_url'),
					setup_page_category_all_blocked: i18n.t('setup_page_category_all_blocked'),
					setup_page_num_blocked: i18n.t('setup_page_num_blocked'),
					trackers: i18n.t('trackers')
				};
			};

			//fetch user settings from API
			accounts.pullUserSettings();

			worker.port.emit('set_conf', {
				translations: getTranslations(),
				conf: {
					bugDb: bugDb.db,
					selected_cat_ids: conf.selected_cat_ids || {},
					selected_app_ids: conf.selected_app_ids || {},
					site_whitelist: conf.site_whitelist || [],
					site_blacklist: conf.site_blacklist || [],
				}
			});

			worker.port.on('update_conf', function(message) {
				conf.selected_cat_ids = message.conf.selected_cat_ids;
				conf.site_whitelist = message.conf.site_whitelist;
				conf.site_blacklist = message.conf.site_blacklist;
				//push new settings to API
				accounts.pushUserSettings({
					'conf': accounts.buildUserSettings()
				});
			});

			worker.tab.on('close', function () {
				// Record install on setup page tab close
				metrics.recordInstall();
			});
		}
	});

	// Share Data Page (/setup/sharedata)
	SDK.pageMod.PageMod({
		include: [
			/https:\/\/extension\.ghostery\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup\/sharedata.*/,
			/https:\/\/extension\.ghosterystage\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup\/sharedata.*/,
			/http:\/\/extension\.ghostery\.dev\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup\/sharedata.*/
		],
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('dist/sharedata.js')
		],
		onAttach: function(worker) {
			//fetch user settings from API
			accounts.pullUserSettings();

			worker.port.emit('set_conf', {
				conf: {
					gostrank: conf.gostrank
				}
			});

			worker.port.on('update_conf', function(message) {
				conf.ghostrank = message.conf.ghostrank;
				//push new settings to API
				accounts.pushUserSettings({
					'conf': accounts.buildUserSettings()
				});

				// Record install on ghostrank setting save
				metrics.recordInstall();
			});

			worker.tab.on('close', function () {
				// Record install on setup/sharedata page tab close
				metrics.recordInstall();
			});
		}
	});

	// Setup Complete Page (/setup/complete)
	SDK.pageMod.PageMod({
		include: [
			/https:\/\/extension\.ghostery\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup\/complete.*/,
			/https:\/\/extension\.ghosterystage\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup\/complete.*/,
			/http:\/\/extension\.ghostery\.dev\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/setup\/complete.*/
		],
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScript: '\
			self.port.on("loggedIn", function(message){\
				if (message) {\
					var hideEls = document.getElementsByClassName("hide-for-logged-in");\
					for (var i=0; i < hideEls.length; i++) {\
						hideEls[i].style.display = "none";\
					}\
				}\
			});\
		',
		onAttach: function(worker) {
			var loggedIn = prefs('logged_in');
			//emit log in status
			worker.port.emit('loggedIn', loggedIn);
		}
	});

	// Settings Page (settings)
	SDK.pageMod.PageMod({
		include: [
			/https:\/\/extension\.ghostery\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/settings.*/,
			/https:\/\/extension\.ghosterystage\.com\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/settings.*/,
			/http:\/\/extension\.ghostery\.dev\/[A-Za-z]{2}(?:(-|_)[A-Za-z]{2})?\/settings.*/
		],
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScript: 'unsafeWindow.dispatchEvent(new Event("extensionFound"));',
		contentScriptFile: [
			SDK.self.data.url('dist/settings.js')
		],
		onAttach: function(worker) {
			var oldConf;

			function getTranslations() {
				return {
					category_ad: i18n.t('category_ad'),
					category_analytics: i18n.t('category_analytics'),
					category_privacy: i18n.t('category_privacy'),
					category_tracker: i18n.t('category_tracker'),
					category_widget: i18n.t('category_widget'),
					category_ad_desc: i18n.t('category_ad_desc'),
					category_analytics_desc: i18n.t('category_analytics_desc'),
					category_privacy_desc: i18n.t('category_privacy_desc'),
					category_tracker_desc: i18n.t('category_tracker_desc'),
					category_widget_desc: i18n.t('category_widget_desc'),

					library_updated_on: i18n.t('library_updated_on'),
					library_never_updated: i18n.t('library_never_updated'),
					library_update_now_link: i18n.t('library_update_now_link'),
					library_update_successful: i18n.t('library_update_successful'),
					library_update_failed: i18n.t('library_update_failed'),
					library_update_already_updated: i18n.t('library_update_already_updated'),
					library_update_in_progress: i18n.t('library_update_in_progress'),
					whitelist_error_duplicate_url: i18n.t('whitelist_error_duplicate_url'),
					whitelist_error_blacklist_url: i18n.t('whitelist_error_blacklist_url'),
					blacklist_error_duplicate_url: i18n.t('blacklist_error_duplicate_url'),
					blacklist_error_whitelist_url: i18n.t('blacklist_error_whitelist_url'),
					white_black_list_error_invalid_url: i18n.t('white_black_list_error_invalid_url'),
					category_uncategorized: i18n.t('category_uncategorized'),
					category_advertising: i18n.t('category_advertising'),
					category_comments: i18n.t('category_comments'),
					category_customer_interaction: i18n.t('category_customer_interaction'),
					category_essential: i18n.t('category_essential'),
					category_pornvertising: i18n.t('category_pornvertising'),
					category_site_analytics: i18n.t('category_site_analytics'),
					category_social_media: i18n.t('category_social_media'),
					category_audio_video_player: i18n.t('category_audio_video_player'),
					category_uncategorized_desc: i18n.t('category_uncategorized_desc'),
					category_advertising_desc: i18n.t('category_advertising_desc'),
					category_comments_desc: i18n.t('category_comments_desc'),
					category_customer_interaction_desc: i18n.t('category_customer_interaction_desc'),
					category_essential_desc: i18n.t('category_essential_desc'),
					category_pornvertising_desc: i18n.t('category_pornvertising_desc'),
					category_site_analytics_desc: i18n.t('category_site_analytics_desc'),
					category_social_media_desc: i18n.t('category_social_media_desc'),
					category_audio_video_player_desc: i18n.t('category_audio_video_player_desc'),
					on: i18n.t('on'),
					off: i18n.t('off'),
					tag_description_getting: i18n.t('tag_description_getting'),
					tag_description_none_found: i18n.t('tag_description_none_found'),
					tag_description_read_more: i18n.t('tag_description_read_more')
				};
			};

			function getSettings() {
				return {
					translations: getTranslations(),
					conf: accounts.buildUserSettings(),
					prefs: {
						newAppIds: prefs('newAppIds'),
						bugs_last_updated: prefs('bugs_last_updated')
					},
					VERSION: "Firefox version " + utils.VERSION,
					bugs: bugDb.db
				};
			};

			function setSettings(message) {
				conf.paused_blocking = message.conf.paused_blocking;
				conf.ignore_first_party = message.conf.ignore_first_party;
				conf.block_by_default = message.conf.block_by_default;
				conf.notify_library_updates = message.conf.notify_library_updates;
				conf.enable_autoupdate = message.conf.enable_autoupdate;
				conf.enable_click2play = message.conf.enable_click2play;
				conf.enable_click2play_social = message.conf.enable_click2play_social;

				conf.language = message.conf.language;
				conf.ghostrank = message.conf.ghostrank;
				conf.show_alert = message.conf.show_alert;
				conf.alert_bubble_timeout = message.conf.alert_bubble_timeout;
				conf.alert_bubble_pos = message.conf.alert_bubble_pos;
				conf.show_cmp = message.conf.show_cmp;
				conf.site_whitelist = message.conf.site_whitelist;
				conf.site_blacklist = message.conf.site_blacklist;

				prefs('bugs_last_updated', message.prefs.bugs_last_updated);

				Ghostery.panel.port.emit('toggleDisabledBlocking', {
					paused_blocking: conf.paused_blocking
				});

				showReloadCta();
				showSavedAlert();

				var settings = getSettings();
				accounts.pushUserSettings(settings);
			};

			function showReloadCta() {
				var newConf = getSettings().conf;

				//Purposfully overwrite entire needsReload object because
				//a click on the settings page will override all panel changes anyway.
				tabInfo.get(SDK.tabs.activeTab.id).needsReload = {
					changes: !(oldConf === JSON.stringify(newConf)) ? {settingsPage: true} : {}
				};
			};
			function showSavedAlert() {
				worker.port.emit('show_saved_alert');
			};

			//fetch user settings from API
			accounts.pullUserSettings();

			oldConf = JSON.stringify(getSettings().conf);
			worker.port.emit('set_settings', getSettings());
			worker.port.on('update_settings', setSettings);
			worker.port.on('update_language', function(message) {
				conf.language = message.language;
				var settings = getSettings();
				accounts.pushUserSettings(settings);
				i18n.init(conf.language);
				worker.port.emit('set_language', {
					translations: getTranslations()
				});
			});
			worker.port.on('update_timeout', function(message) {
				conf.alert_bubble_timeout = parseInt(message.alert_bubble_timeout);
				tabInfo.get(SDK.tabs.activeTab.id).worker.port.emit('updateTimeout', {
					alert_bubble_timeout: conf.alert_bubble_timeout
				});
				showSavedAlert();
			});
			worker.port.on('update_position', function(message) {
				conf.alert_bubble_pos = message.alert_bubble_pos;
				tabInfo.get(SDK.tabs.activeTab.id).worker.port.emit('updatePosition', {
					alert_bubble_pos: conf.alert_bubble_pos
				});
				showSavedAlert();
			});
			worker.port.on('update_database', function() {
				var updateSuccessCount = 0,
					updateSuccess = [],
					updateRemote = [];

				function processUpdate(result) {
					var settings = getSettings();

					updateSuccessCount++;
					updateSuccess.push(result.success);
					updateRemote.push(result.updated);

					if (updateSuccessCount != 2) {
						return;
					}

					settings.success = (updateSuccess.indexOf(false) == -1);
					settings.isNewUpdate = (updateRemote.indexOf(true) >= 0);
					SDK.timers.setTimeout(function() {
						worker.port.emit('database_updated', settings);
					}, 1000);
				}
				checkLibraryVersion(processUpdate);
			});

			worker.port.on('set_categories_on', function() {
				conf.selected_cat_ids = {};
				var settings = getSettings();
				accounts.pushUserSettings(settings);
				showReloadCta();
				showSavedAlert();
			});
			worker.port.on('set_categories_off', function() {
				var n, categories = [
					'advertising',
					'comments',
					'customer_interaction',
					'essential',
					'pornvertising',
					'site_analytics',
					'social_media',
					'audio_video_player'
				];
				for (n = 0; n < categories.length; n++) {
					conf.selected_cat_ids[categories[n]] = 1;
				}
				var settings = getSettings();
				accounts.pushUserSettings(settings);
				showReloadCta();
				showSavedAlert();
			});
			worker.port.on('set_category_state', function(message) {
				if (message.blocked) {
					conf.selected_cat_ids[message.id] = 1;
				} else {
					delete conf.selected_cat_ids[message.id];
				}
				var settings = getSettings();
				accounts.pushUserSettings(settings);
				showReloadCta();
				showSavedAlert();
			});
			worker.port.on('set_tracker_state', function(message) {
				if (message.catBlocked) {
					if (message.allowed) {
						conf.unselected_app_ids[message.id] = 1;
					} else {
						delete conf.unselected_app_ids[message.id];
					}
				} else {
					if (message.blocked) {
						conf.selected_app_ids[message.id] = 1;
					} else {
						delete conf.selected_app_ids[message.id];
					}
				}
				var settings = getSettings();
				accounts.pushUserSettings(settings);
				showReloadCta();
				showSavedAlert();
			});
			worker.port.on('set_trackers_on', function() {
				conf.selected_app_ids = {};
				conf.unselected_app_ids = {};
				var settings = getSettings();
				accounts.pushUserSettings(settings);
				showReloadCta();
				showSavedAlert();
			});
			worker.port.on('show_alert_bubble', function() {
				createBox(SDK.tabs.activeTab.id);
			});
			worker.port.on('destroy_alert_bubble', function() {
				destroyBox(SDK.tabs.activeTab.id);
			});

			worker.port.on('ajax_request', function(message) {
				SDK.request.Request({
					url: message.url,
					onComplete: function(response) {
						var description = response.text.slice(
							response.text.indexOf('<p>', response.text.indexOf('company-desc')) + 9,
							response.text.indexOf('</p>', response.text.indexOf('company-desc')) - 6);

						worker.port.emit('ajax_response', {
							id: message.id,
							name: message.name,
							catId: message.catId,
							success: (response.status == 200), //ToDo: check for success
							description: description
						});
					}
				}).get();
			});
		}
	});

	//Ghostery.com and Apps Pages
	SDK.pageMod.PageMod({
		include: ['https://www.ghostery.com/try-us/download-browser-extension*', 'https://apps.ghostery.com*'],
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentStyle: "#app-global-blocking { background: url('" + SDK.self.data.url('images/build/tracker.png') + "') no-repeat; background-position: -20px -20px; } #global-blocking-control { background: url('" + SDK.self.data.url('images/build/tracker.png') + "') no-repeat; }",
		contentStyleFile: [
			SDK.self.data.url('css/bootstrap_tooltip.css'),
			SDK.self.data.url('css/ghostery_dot_com.css')
		],
		contentScriptFile: [
			SDK.self.data.url('includes/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('includes/vendor/bootstrap_tooltip.js'),
			SDK.self.data.url('includes/ghostery_dot_com.js')
		],
		onAttach: function(worker) {
			worker.port.on('appsPageLoaded', function(msg) {
				worker.port.emit('appsPageData', {
					blocked: conf.selected_app_ids[msg.id] == 1
				});
			});
			worker.port.on('panelSelectedAppsUpdate', function(message) {
				if (message.app_selected) {
					conf.selected_app_ids[message.app_id] = 1;
					conf.selected_lsos_app_ids[message.app_id] = 1;
				} else {
					delete conf.selected_app_ids[message.app_id];
					delete conf.selected_lsos_app_ids[message.app_id];
				}
			});
		}
	});
}

function initObservers() {
	Cu.import('resource://gre/modules/Services.jsm');
	/* globals Services */

	var httpRequestEvents = [
			'http-on-modify-request'
		],
		httpResponseEvents = [
			'http-on-examine-response',
			'http-on-examine-cached-response',
			'http-on-examine-merged-response'
		];

	function httpResponseObserver(event) {
		var channel = event.subject.QueryInterface(Ci.nsIHttpChannel),
			tab = utils.getTabFromChannel(channel),
			tab_id,
			tab_url,
			tab_host,
			tab_info = tab && tabInfo.get(tab.id),
			event_type = event.type;

		if (!tab || !tab_info) {
			return;
		}

		tab_id = tab.id;
		tab_url = tab_info.url;
		tab_host = tab_info.host;

		channel.visitResponseHeaders(function(header, value) {
			if (header.toLowerCase() == 'set-cookie') {
				value = value.split('; ');
				var lso_host,
					lso_id,
					app_id,
					cat_id,
					block;

				for (var i = 0; i < value.length; i++) {
					if (/^domain=/.test(value[i])) {
						lso_host = value[i].substr(7, value[i].length - 1);
						break;
					}
				}

				if (!lso_host) {
					return;
				}

				lso_id = matcher.isLso(lso_host);
				if (!lso_id) {
					return;
				}

				app_id = lsoDb.db.lsos[lso_id].aid;
				cat_id = bugDb.db.apps[app_id].cat;
				block = shouldBlock(app_id, cat_id, tab_id, tab_host, tab_url);

				if (block) {
					// TODO FF: find a way to implement this
					//                  utils.blockingLog('Blocked lso: ' + lso.name + ' on ' + lso.lso_host + lso.path + ' with value: ' + lso.value
					//                      + ' loaded from ' + this.current , Ghostery.blockLogWorker);
					channel.setResponseHeader('Set-Cookie', '', false);
				}
			}
		});

		if (!conf.ghostrank || (SDK.pb && SDK.pb.isPrivate(tab))) {
			return;
		}

		channel.QueryInterface(Ci.nsIWritablePropertyBag);
		var requestStart;

		try {
			requestStart = channel.getProperty('request_start');
		} catch (e) {
			return;
		}

		channel.QueryInterface(Ci.nsITraceableChannel);

		function TracingListener() {
			this.originalListener = null;
		}

		TracingListener.prototype = {
			onDataAvailable: function(request, context, inputStream, offset, count) {
				try {
					this.originalListener.onDataAvailable(request, context, inputStream, offset, count);
				} catch (e) {
					// sometimes fails with this: "Component returned failure code: 0x804b0002 (NS_BINDING_ABORTED) [nsIStreamListener.onDataAvailable]"
				}
			},

			onStartRequest: function(request, context) {
				this.originalListener.onStartRequest(request, context);
			},

			onStopRequest: function(request, context, statusCode) { // The HTTP request is ending.
				if (tab) {
					ghostrank.queueRecordStats(
						tab.id,
						channel.getProperty('src'), {
							bug_id: channel.getProperty('bug_id'),
							tab_url: channel.getProperty('tab_url'),
							block: false, // no need to check if bug was blocked. If it reached this, it must have been unblocked
							latency: +(new Date().getTime() - requestStart),
							response_code: channel.responseStatus,
							user_error: (Cr.NS_BINDING_ABORTED === statusCode),
							from_cache: (event_type == 'http-on-examine-cached-response'),
							tracker_timestamp: requestStart,
							page_timestamp: tabInfo.get(tab.id).timestamp
						});
				}

				this.originalListener.onStopRequest(request, context, statusCode);
			}
		};

		var newListener = new TracingListener();
		newListener.originalListener = channel.setNewListener(newListener);
	}

	function httpRequestObserver(event) {
		// NOTE no need to check for blocked bugs, if blocked they won't make it here.
		// TODO revise this code
		var channel = event.subject.QueryInterface(Ci.nsIHttpChannel),
			tab = utils.getTabFromChannel(channel),
			tab_id,
			surrogates,
			src = channel.URI.spec,
			needsSurrogate = Ghostery.needsSurrogate[src],
			dataUrl,
			code = "",
			bug_id;

		if (needsSurrogate) {
			log("SURROGATING", src);


			surrogates = needsSurrogate.surrogates;
			surrogates.forEach(function(surrogate) {
				code += surrogate.code;
			});

			dataUrl = needsSurrogate.type == "image" ? "data:image/png;base64," + code : "data:application/javascript;base64," + SDK.encode(code);

			delete Ghostery.needsSurrogate[src];

			channel.redirectTo(Services.io.newURI(dataUrl, null, null));
		}

		if (!tab) {
			return;
		}
		tab_id = tab.id;

		/* jshint bitwise: false */
		if (channel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI &&
			channel.loadFlags & Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI &&
			/* jshint bitwise: true */
			typeof Ghostery.mainFrames[tab_id] != 'undefined' &&
			Ghostery.mainFrames[tab_id].indexOf(src) >= 0) {
			tabInfo.create(tab_id, src);
			c2pDb.reset(tab_id);
			foundBugs.clear(tab_id);
			ghostrank.onNavigate(src);
			updateButton(tab_id);
			delete Ghostery.tabWorkers[tab_id];
			delete Ghostery.c2pQueue[tab_id];
			return;
		}

		if (!conf.ghostrank || (SDK.pb && SDK.pb.isPrivate(tab))) {
			return;
		}

		bug_id = matcher.isBug(channel.URI.spec, tab.url);
		if (!bug_id) {
			return;
		}

		channel.QueryInterface(Ci.nsIWritablePropertyBag);
		channel.setProperty('tab_url', tab.url);
		channel.setProperty('src', channel.URI.spec);
		channel.setProperty('bug_id', bug_id);
		channel.setProperty('request_start', new Date().getTime());
	}

	// flash / silverlight cleanup toggle
	SDK.events.on('quit-application-requested', function(event) {
		if (conf.delete_fl_sl_cookies) {
			cleaner.cleanup();
		}
	}, true);

	httpRequestEvents.forEach(function(type) {
		SDK.events.on(type, httpRequestObserver, true);
	});
	httpResponseEvents.forEach(function(type) {
		SDK.events.on(type, httpResponseObserver, true);
	});
}

function initAddonManager() {
	try {
		// reset current list of addons
		prefs('incompatibleAddons', false);

		Cu.import('resource://gre/modules/AddonManager.jsm');

		var conflicting = ['optout@google.com', 'john@velvetcache.org', 'cookiefast@mozdev.org'],
			enabled = function(addon) {
				if ((addon) && (conflicting.indexOf(addon.id) != -1)) {
					var incompatibleAddons = prefs('incompatibleAddons');
					if (!incompatibleAddons) {
						incompatibleAddons = [];
					}

					incompatibleAddons.push(addon.name);
					prefs('incompatibleAddons', incompatibleAddons);

					Ghostery.BlockingPolicy.removeCookieBlocking();
				}
			},
			disabled = function(addon) {
				if ((addon) && (conflicting.indexOf(addon.id) != -1)) {
					var incompatibleAddons = prefs('incompatibleAddons'),
						nIncompatibleAddons = [];

					if (!incompatibleAddons) {
						nIncompatibleAddons = [];
					} else {
						for (var entry in incompatibleAddons) {
							if (incompatibleAddons[entry] == addon.id) {
								continue;
							}

							nIncompatibleAddons.push(incompatibleAddons[entry]);
						}
					}

					prefs('incompatibleAddons', nIncompatibleAddons);

					if (nIncompatibleAddons.length === 0) {
						SDK.events.on('cookie-changed', Ghostery.BlockingPolicy.cookieBlockingPolicy, true);
					}
				}
			};

		AddonManager.addAddonListener({
			onEnabled: enabled,
			onEnabling: enabled,
			onInstalling: enabled,
			onInstalled: enabled,
			onDisabled: disabled,
			onUninstalled: disabled
		});

		AddonManager.getAddonsByIDs(conflicting, function(addons) {
			for (var i in addons) {
				var addon = addons[i];

				if ((addon) && (addon.isActive)) {
					var incompatibleAddons = prefs('incompatibleAddons');
					if (!incompatibleAddons) {
						incompatibleAddons = [];
					}
					incompatibleAddons.push(addon.name);
					prefs('incompatibleAddons', incompatibleAddons);

					Ghostery.BlockingPolicy.removeCookieBlocking();
				}
			}
		});
	} catch (err) {}
}

function init() {
	// are we upgrading from 5.0.0 (which used uses prefs instead of simple storage)?
	JUST_UPGRADED_FROM_PRE_SS = (SDK.preferences.get('extensions.ghostery.previousVersion') == '"5.0.0"');

	// are we running for the first time/upgrading?
	JUST_INSTALLED = !prefs('previousVersion') &&
		!SDK.preferences.has('extensions.ghostery.version');

	JUST_UPGRADED =
		(prefs('previousVersion') != utils.VERSION ||
			(JUST_UPGRADED_FROM_PRE_SS &&
				SDK.preferences.get('extensions.ghostery.previousVersion') != utils.VERSION)) &&
		!JUST_INSTALLED;

	// are we upgrading from 2.8 or 2.9 (pre addon sdk)?
	JUST_UPGRADED_FROM_PRE_SDK =
		JUST_UPGRADED &&
		(SDK.preferences.has('extensions.ghostery.version') &&
			(SDK.preferences.get('extensions.ghostery.version').indexOf('2.8') >= 0 ||
				SDK.preferences.get('extensions.ghostery.version').indexOf('2.9') >= 0));

	prefs('previousVersion', utils.VERSION);

	if (JUST_UPGRADED) {
		metrics.recordUpgrade();
		//open the upgrade page
		//SDK.tabs.open({
		//	url: 'https://extension.' + GHOSTERY_DOMAIN + '.com/' + conf.language + '/upgrade'
		//});
	} else if (JUST_INSTALLED) {
		SDK.timers.setTimeout(function() {
			// Record install after 5 minutes
			metrics.recordInstall();
		}, 300000);

		//open the intro page
		SDK.tabs.open({
			url: 'https://extension.' + GHOSTERY_DOMAIN + '.com/' + conf.language + '/intro'
		});

		// open survey tab in the background
		// SDK.tabs.open({
		// 	url: "https://www.ghostery.com/survey/install",
		// 	inBackground: true
		// });

	} else {
		// Record install on non-install browser start
		metrics.recordInstall();
	}

	metrics.recordActive();

	cmp.fetchMktgData(function() {
		Ghostery.CMP_DATA = prefs("cmp_data");
	});

	//set initial value for map-these-trackers cta
	cmp.updateCTAStatus("mapthesetrackers", 1800000);

	i18n.init(conf.language);

	[bugDb, lsoDb, c2pDb, compDb, tagDb].forEach(function(db) {
		db.init(JUST_UPGRADED);
	});

	// TODO abstract localStorage behind prefs() (need to do something about how we currently sometimes stringify/parse and sometimes do not)
	// do we still want to after lib/conf.js?

	if (JUST_UPGRADED_FROM_PRE_SDK) {
		upgradeFromPreSDK();
	}

	if (JUST_UPGRADED_FROM_PRE_SS) {
		upgradeFromPreSS();
	}

	initTabIds();

	// register in currently open windows on addon init
	if (!PLUS36_MODE) {
		for (var win in SDK.winUtils.windows(null, {
				includePrivate: true
			})) {
			Ghostery.button.create(SDK.winUtils.windows(null, {
				includePrivate: true
			})[win], {
				panel: Ghostery.panel,
				onCommand: showPanel,
				label: i18n.t('browser_button_label_firefox'),
				tooltiptext: i18n.t('browser_button_tooltip'),
				image: SDK.self.data.url('images/icon.svg'),
				stylesheet: SDK.self.data.url('css/button.css')
			});
		}
	}

	// adding new event on tabs/activate to monitor new tabs and add button to their windows
	// GTK: apparently SDK.windows.browserWindows.on('open') works in only half the times.
	if (!PLUS36_MODE) {
		SDK.tabs.on('activate', function(tab) {
			for (var win in SDK.winUtils.windows(null, {
					includePrivate: true
				})) {
				// chromeWindow
				Ghostery.button.create(SDK.winUtils.windows(null, {
					includePrivate: true
				})[win], {
					panel: Ghostery.panel,
					onCommand: showPanel,
					id: 'ghostery-button-container',
					label: i18n.t('browser_button_label_firefox'),
					tooltiptext: i18n.t('browser_button_tooltip'),
					image: SDK.self.data.url('images/icon.svg'),
					stylesheet: SDK.self.data.url('css/button.css')
				});
			}
		});
	}

	registerActiveTabs();
	initObservers();
	initAddonManager();

	SDK.tabs.on('activate', function(tab) {
		registerActiveTabs();
		updateButton(tab.id);
	});

	SDK.tabs.on('open', function(tab) {});

	updateButton(!MOBILE_MODE ? SDK.tabs.activeTab.id : null);

	if (!MOBILE_MODE) {
		setPanelPortListeners(Ghostery.panel);
	}

	loadPageMods();

	// Unloader.
	SDK.unload.when(function(reason) {
		// Checks if factory already exists
		try {
			var registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar),
				catMan = Cc['@mozilla.org/categorymanager;1'].getService(Ci.nsICategoryManager),
				oService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService),
				xpcomCategories = ['content-policy', 'net-channel-event-sinks'];

			for (let category of xpcomCategories) {
				let entry = Cc["@mozilla.org/supports-cstring;1"].createInstance(Ci.nsISupportsCString);
				entry.data = Ghostery.BlockingPolicy.contractID;
				oService.notifyObservers(entry, "xpcom-category-entry-removed", category);
			}

			registrar.unregisterFactory(Ghostery.BlockingPolicy.classID, Ghostery.BlockingPolicy);
		} catch (e) {
			log('[init() SDK.unload.when] ', e);
			Cu.reportError(e);
		}
	});

	Ghostery.BlockingPolicy.init();

	SDK.tabs.on('ready', onDOMContentLoaded);

	dispatcher.on('conf.save.selected_app_ids', function(v) {
		var num_selected = _.size(v),
			db = bugDb.db;
		db.noneSelected = (num_selected === 0);
		// can't simply compare num_selected and _.size(db.apps) since apps get removed sometimes
		db.allSelected = (!!num_selected && _.every(db.apps, function(app, app_id) {
			return v.hasOwnProperty(app_id);
		}));
	});

	dispatcher.on('conf.save.site_whitelist', function() {
		updateButton(!MOBILE_MODE ? SDK.tabs.activeTab.id : null);
	});

	dispatcher.on('conf.save.paused_blocking', function() {
		updateButton(!MOBILE_MODE ? SDK.tabs.activeTab.id : null);
	});
}

function registerActiveTabs() {
	if (MOBILE_MODE || PLUS36_MODE) {
		return;
	}
	Ghostery.activeTabs = [];

	var windows = SDK.winUtils.windows(null, {
			includePrivate: true
		}),
		browserURL = "chrome://browser/content/browser.xul",
		window,
		i;

	if (require('sdk/system/xul-app').name == 'SeaMonkey') {
		browserURL = "chrome://navigator/content/navigator.xul";
	}

	for (i = 0; i < windows.length; i++) {
		window = windows[i];
		if (browserURL != window.location) {
			continue;
		}
		var activeTab = SDK.tabsLib.getTabForWindow(window.content).id;
		Ghostery.activeTabs.push(activeTab);
	}
}

function upgradeFromPreSS() {
	var strippedKey,
		keys = SDK.preferences.keys('extensions.ghostery.');

	keys.forEach(function(key, index) {
		strippedKey = key.replace('extensions.ghostery.', '');

		// special case
		if (strippedKey == 'alert_bubble_cfg') {
			var v = JSON.parse(SDK.preferences.get(key));
			conf.alert_bubble_pos = v.slice(0, 2);
			conf.alert_bubble_timeout = +v.slice(2);

			return;
		}

		if (conf.hasOwnProperty(strippedKey)) {
			try {
				conf[strippedKey] = JSON.parse(SDK.preferences.get(key));
			} catch (e) {}
		}

		SDK.preferences.reset(key);
	});
}

function upgradeFromPreSDK() {
	// preferences
	var pref, i, mapping,
		mappings = [
			['showBubble', 'show_alert', false],
			['showSources', 'expand_sources', true],
			['autoDismissBubble', 'auto_dismiss_bubble', false],
			['shareData', 'ghostrank', true],
			['enableCleanup', 'delete_fl_sl_cookies', true],
			['autoUpdateBugs', 'enable_autoupdate', true],
			['updateBlockBehaviour', 'block_by_default', true],
			['updateNotification', 'notify_library_updates', true],
			['blockImage', 'block_images', false],
			['blockFrame', 'block_frames', false],
			['blockObject', 'block_objects', false],
			['preventRedirect', 'prevent_redirection', false],
			['showClick2Play', 'enable_click2play', false],
			['showClick2PlayButton', 'enable_click2play_social', false],
			['toolbarButton', 'show_button', true]
		];

	mappings.forEach(function(mapping) {
		try {
			pref = SDK.preferences.get('extensions.ghostery.' + mapping[0]);
			// NOTE special case for autoUpdateBugs since we are changing its default value.
			if (mapping[0] == 'autoUpdateBugs') {
				if (pref == null) {
					conf[mapping[1]] = mapping[2];
				}
			}

			if (pref === mapping[2]) {
				conf[mapping[1]] = pref;
			}
		} catch (e) {
			log('mapping preference error', mapping, SDK.storage[mapping[0]]);
		}
	});


	// bubble location
	pref = SDK.preferences.get('extensions.ghostery.bubbleLocation');

	if (pref === 'top-right') {
		conf.alert_bubble_pos = 'tr';
	} else
	if (pref === 'top-left') {
		conf.alert_bubble_pos = 'tl';
	} else
	if (pref === 'bottom-right') {
		conf.alert_bubble_pos = 'br';
	} else
	if (pref === 'bottom-left') {
		conf.alert_bubble_pos = 'bl';
	} else {
		conf.alert_bubble_pos = 'tr';
	}

	// bubble timeout
	pref = SDK.preferences.get('extensions.ghostery.bubbleTimeout');

	try {
		if (pref) {
			var cfg_timeout = parseInt(pref, 10);
			if ([60, 30, 25, 20, 15, 10, 5, 3].indexOf(cfg_timeout) >= 0) {
				conf.alert_bubble_timeout = cfg_timeout;
			} else {
				conf.alert_bubble_timeout = 15;
			}
		} else {
			conf.alert_bubble_timeout = 15;
		}
	} catch (e) {
		conf.alert_bubble_timeout = 15;
	}

	// existing whitelist
	pref = SDK.preferences.get('extensions.ghostery.whitelist');

	if (pref) {
		pref = pref.split(",");
		conf.site_whitelist = pref;
	}

	// databases
	var profilePath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile).path;
	_.each([
		['selectedBugs', 'selected_app_ids'],
		['selectedLsos', 'selected_lsos_app_ids']
	], function(type) {
		try {
			var path = SDK.file.join(profilePath, 'ghostery', type[0]),
				contents = SDK.file.read(path),
				selections = {};

			contents = contents.split(',');
			for (i = 0; i < contents.length; i++) {
				selections[contents[i]] = 1;
			}
			conf[type[1]] = selections;
		} catch (err) {
			// only happens if the file is missing.
		}
	});

	// reset old preferences
	var keys = SDK.preferences.keys('extensions.ghostery.');
	keys.forEach(function(key, index) {
		SDK.preferences.reset(key);
	});
}

function openPanelTab() {
	var tab, i;

	for each(tab in SDK.tabs) {
		if (tab.url.indexOf(SDK.self.data.url('panel_mobile.html')) === 0) {
			return tab;
		}
	}

	return false;
}

function showPanel_mobile(tab_id) {
	var panelTab = openPanelTab(),
		tab_url,
		tab_host;

	if (!panelTab) {
		// TODO is this actually returning something?
		panelTab = SDK.tabs.open(SDK.self.data.url('panel_mobile.html') + '?tabId=' + tab_id);
	} else {
		panelTab.url = SDK.self.data.url('panel_mobile.html') + '?tabId=' + tab_id;
		panelTab.activate();
	}

	SDK.timers.setTimeout(function() {
		var win = SDK.winUtils.getMostRecentBrowserWindow();
		win.fullScreen = false;
		win.fullScreen = true;
	}, 1);
}

function showPanel() {
	var view;
	var tab = SDK.tabs.activeTab;
	var tab_id = 0,
	tab_url = "";
	tab_host = "";
	if(tab) {
		tab_id = SDK.tabs.activeTab.id;
		tab_url = SDK.tabs.activeTab.url;
		if(!tabInfo.get(tab_id)) {
			tabInfo.create(tab_id, tab_url);
		}
		tab_host = tabInfo.get(tab_id).host;
	}

	worker = Ghostery.panel;
	worker.port.emit('hideBannerMessages', {});

	//pull user settings whenever panel opens
	accounts.pullUserSettings();
	if (prefs('history') && prefs('history').length) {
		var length = prefs('history').length;
		switch(prefs("history")[length-1]) {
			case 'block':
				view = 'showBlockingView';
				worker.port.emit('storeInitialPanel', {panel: "block"})
				break;
			default:
				view = 'showDashboardView';
				worker.port.emit('storeInitialPanel', {panel: "dash"})
				break;
		}
	} else {
		view = 'showDashboardView';
	}
	Ghostery.panel.port.emit(view, {
		MOBILE_MODE: MOBILE_MODE,
		trackers: foundBugs.getApps(tab_id),
		trackersByBlocked: foundBugs.getAppsCountByBlocked(tab_id),
		categories: foundBugs.getCategories(tab_id),
		tabId: tab_id,
		conf: conf.toJSON(),
		page: {
			url: tab_url,
			host: tab_host
		},
		sitePolicy: getSitePolicy(tab_url),
		paused_blocking: conf.paused_blocking,
		needsReload: (tabInfo.get(tab_id) ? tabInfo.get(tab_id).needsReload : 0),
		showTutorial: !prefs('panelTutorialShown'),
		validProtocol: (tab_url.indexOf('http') === 0),
		notScanned: !foundBugs.getApps(tab_id),
		language: conf.language,
		menuClosed: true,
		show_map_these_trackers: prefs('cta_mapthesetrackers') || false
	});

	if (PLUS36_MODE) {
		Ghostery.panel.show({
			position: Ghostery.button
		});
	}

	var loggedIn = prefs("logged_in") || false;
	var isValidated = prefs('is_validated') || false;
	if(loggedIn && !isValidated) {
		accounts.getLoginInfo(Ghostery.panel);
	}

	metrics.recordEngaged();

	trackermap.updateGlobalSettings(worker, 'Global'); //TODO replace 'global' with version number
}

function hidePanel(tab_id) {
	if (MOBILE_MODE) {
		var foundPanel = false,
			foundTab = (tab_id === undefined),
			tab, i;

		// for (i = 0; i < SDK.tabs.length; i++) {
		for each(tab in SDK.tabs) {
			// tab = SDK.tabs[i];

			if (tab.url.indexOf(SDK.self.data.url('panel_mobile.html')) === 0) {
				var win = SDK.winUtils.getMostRecentBrowserWindow();
				win.fullScreen = false;
				tab.close();
				foundPanel = true;
			}

			if (!foundTab && tab.id == tab_id) {
				tab.activate();
				foundTab = true;
			}

			if (foundPanel && foundTab) {
				return;
			}
		}
	} else {
		Ghostery.panel.hide();
	}
}

function elementTypeToString(contentType) {
	var typeStr = '';

	switch (contentType) {
		case 2:
			typeStr = 'script';
			break;
		case 3:
			typeStr = 'image';
			break;
		case 4:
			typeStr = 'stylesheet';
			break;
		case 5:
			typeStr = 'object';
			break;
		case 6:
			typeStr = 'document';
			break;
		case 7:
			typeStr = 'sub-document';
			break;
		case 14:
			typeStr = 'font';
			break;
		case 15:
			typeStr = 'media';
			break;
		default:
			typeStr = 'object';
	}

	return typeStr;
}

function processBug(deets) {
	var bug_id = deets.bug_id,
		type = elementTypeToString(deets.type),
		src = deets.src,
		block = deets.block,
		tab_id = deets.tab_id,
		tab_url = deets.tab_url,
		num_apps_old;

	// GHOST-1088: tab_url is only sent from content policy shouldLoad & dom scanner
	// TODO: what would this break?
	//       what about pages that immediately append a hash?
	if ((tab_url) && (deets.tab_url !== tabInfo.get(tab_id).url)) {
		return;
	}

	log((block ? 'Blocked' : 'Found') + ` [${type}] ${src}`);
	log(`^^^ Pattern ID ${bug_id} on tab ID ${tab_id}`);

	if (conf.show_alert && !conf.paused_blocking) {
		num_apps_old = foundBugs.getAppsCount(tab_id);
	}

	block = deets.block;
	foundBugs.update(tab_id, bug_id, src, block, type);

	updateButton(tab_id);

	if (block && conf.enable_click2play) {
		sendC2PData(tab_id, bugDb.db.bugs[bug_id].aid);
	}

	if (conf.show_alert && !conf.paused_blocking) {
		if (tabInfo.get(tab_id) && tabInfo.get(tab_id).DOMLoaded) {
			if (foundBugs.getAppsCount(tab_id) > num_apps_old ||
				c2pDb.allowedOnce(tab_id, bugDb.db.bugs[bug_id].aid)) {
				updateBox(tab_id);
			}
		}
	}
}

function sendC2PData(tab_id, app_id) {
	var c2pApp = c2pDb.db.apps[app_id];

	if (!c2pApp) {
		return;
	}

	// click-to-play for social buttons might be disabled
	if (!conf.enable_click2play_social) {
		c2pApp = _.reject(c2pApp, function(c2pAppDef) {
			return !!c2pAppDef.button;
		});
	}

	if (!c2pApp.length) {
		return;
	}

	var c2pData = {};
	c2pData[app_id] = c2pApp;

	if (!Ghostery.c2pQueue.hasOwnProperty(tab_id)) {
		Ghostery.c2pQueue[tab_id] = [];
	}
	Ghostery.c2pQueue[tab_id].push(c2pData);
}

function flushC2PData(tab_id) {
	var tab_workers = Ghostery.tabWorkers[tab_id],
		c2pDataArr = Ghostery.c2pQueue[tab_id];

	if (!tab_workers || !c2pDataArr) {
		return;
	}

	tab_workers.forEach(function(worker) {
		c2pDataArr.forEach(function(c2pData) {
			try {
				worker.port.emit('c2p', {
					c2pData: c2pData
				});
			} catch (e) {}
		});
	});

	delete Ghostery.tabWorkers[tab_id];
}

function createBox(tab_id) {
	if (MOBILE_MODE) {
		return;
	}

	try {
		tabInfo.get(tab_id).worker.port.emit('createBox', {
			conf: {
				alert_expanded: conf.alert_expanded,
				alert_bubble_pos: conf.alert_bubble_pos,
				alert_bubble_timeout: conf.alert_bubble_timeout,
				language: conf.language
			},
			translations: {
				looking: i18n.t('box_looking'),
				trackers: i18n.t('box_trackers'),
				tracker: i18n.t('box_tracker'),
				hide: i18n.t('box_hide'),
				settings: i18n.t('box_settings'),
				options_expanded: i18n.t('box_options_expanded'),
				hide_expanded: i18n.t('box_hide_expanded'),
				settings_expanded: i18n.t('box_settings_expanded'),
				box_dismiss_0s: i18n.t('box_dismiss_0s'),
				box_dismiss_5s: i18n.t('box_dismiss_5s'),
				box_dismiss_15s: i18n.t('box_dismiss_15s'),
				box_dismiss_30s: i18n.t('box_dismiss_30s'),
				box_display_br: i18n.t('box_display_br'),
				box_display_tr: i18n.t('box_display_tr'),
				box_display_tl: i18n.t('box_display_tl'),
				box_display_bl: i18n.t('box_display_bl')
			}
		});

		// Run updateBox in case apps loaded before creating the box
		updateBox(tab_id);
	} catch (e) {}
}

function destroyBox(tab_id) {
	tabInfo.get(tab_id).worker.port.emit('destroyBox');
}

function updateBox(tab_id) {
	var apps = foundBugs.getApps(tab_id, true);

	if (!apps || apps.length === 0) {
		return;
	}

	tabInfo.get(tab_id).worker.port.emit('updateBox', {
		apps: apps
	});
}

function setIcon(active, tab_id) {
	var icon;

	if (MOBILE_MODE) {
		if (!tabInfo.get(tab_id).worker) {
			return;
		}
		icon = (active ? 'icon.svg' : 'icon-off.svg');
		tabInfo.get(tab_id).worker.port.emit('updateIcon', {
			icon: SDK.self.data.url('images/' + icon)
		});
	} else {
		icon = (active ? 'icon.svg' : 'icon-off.svg');
		Ghostery.button.setIcon(tab_id, SDK.self.data.url('images/' + icon));
	}
}

function setBadgeText(text, tab_id) {
	if (MOBILE_MODE) {
		if (!tabInfo.get(tab_id).worker) {
			return;
		}
		tabInfo.get(tab_id).worker.port.emit('updateBadge', {
			text: text
		});
	} else {
		Ghostery.button.setBadge(tab_id, (conf.show_badge ? text : null));
	}
}

function setIconState(active, text, tab_id) {
	var tab = utils.getTab(tab_id);
	if (!tab) {
		return;
	}
	Ghostery.button.state(tab, {
		badge: (conf.show_badge ? text : null),
		icon: Ghostery[(active ? 'iconOn' : 'iconOff')]
	});
}

function updateButton(tab_id) {
	if (!conf.show_button || (!MOBILE_MODE && !PLUS36_MODE && Ghostery.activeTabs.indexOf(tab_id) < 0) || tab_id === null) {
		return;
	}

	var text = foundBugs.getAppsCount(tab_id),
	tab_url = "";
	var tab = tabInfo.get(tab_id);
	if(tab) {
		tab_url = tab.url;
	}

	if (!foundBugs.getBugs(tab_id) || !tab_url) {
		// no cached bug discovery data:
		// * Ghostery was enabled after the tab started loading
		// * or, this is a tab Ghostery's onBeforeRequest doesn't run in (non-http/https page)
		text = '';
	}

	if (PLUS36_MODE) {
		if (text || text === 0) {
			setIconState((!whitelisted(tab_url) && !conf.paused_blocking), text, tab_id);
		} else {
			setIconState(false, text, tab_id);
		}
	} else {
		setBadgeText(text, tab_id);

		if (text || text === 0) {
			setIcon((!whitelisted(tab_url) && !conf.paused_blocking), tab_id);
		} else {
			setIcon(false, tab_id);
		}
	}
}

// TODO GHOST-758 speed up
// TODO move black and white lists into one
function whitelisted(url) {
	var sites = conf.site_whitelist,
		num_sites = sites.length;

	for (var i = 0; i < num_sites; i++) {
		// TODO match from the beginning of the string to avoid false matches (somewhere in the querystring for instance)
		if (url.indexOf(sites[i]) >= 0) {
			return sites[i];
		}
	}

	return false;
}

// TODO GHOST-758 speed up
// TODO move black and white lists into one
function blacklisted(url) {
	var sites = conf.site_blacklist,
		num_sites = sites.length;

	for (var i = 0; i < num_sites; i++) {
		// TODO match from the beginning of the string to avoid false matches (somewhere in the querystring for instance)
		if (url.indexOf(sites[i]) >= 0) {
			return sites[i];
		}
	}

	return false;
}

function getSitePolicy(url) {
	if (blacklisted(url)) {
		return 1;
	}
	if (whitelisted(url)) {
		return 2;
	}
	return false;
}

function shouldBlock(app_id, cat_id, tab_id, tab_host, tab_url) {
	if (conf.paused_blocking) {
		return false;
	}

	if (conf.selected_cat_ids.hasOwnProperty(cat_id)) {
		if (conf.unselected_app_ids.hasOwnProperty(app_id)) {
			if (conf.site_specific_cat_blocks.hasOwnProperty(tab_host) && conf.site_specific_cat_blocks[tab_host].indexOf(cat_id) >= 0) {
				if (conf.site_specific_unblocks.hasOwnProperty(tab_host) && conf.site_specific_unblocks[tab_host].indexOf(+app_id) >= 0) {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				} else {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				}
			} else {
				if (conf.site_specific_blocks.hasOwnProperty(tab_host) && conf.site_specific_blocks[tab_host].indexOf(+app_id) >= 0) {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				} else {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				}
			}
		} else {
			if (conf.site_specific_cat_unblocks.hasOwnProperty(tab_host) && conf.site_specific_cat_unblocks[tab_host].indexOf(cat_id) >= 0) {
				if (conf.site_specific_blocks.hasOwnProperty(tab_host) && conf.site_specific_blocks[tab_host].indexOf(+app_id) >= 0) {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				} else {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				}
			} else {
				if (conf.site_specific_unblocks.hasOwnProperty(tab_host) && conf.site_specific_unblocks[tab_host].indexOf(+app_id) >= 0) {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				} else {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				}
			}
		}
	} else {
		if (conf.selected_app_ids.hasOwnProperty(app_id)) {
			if (conf.site_specific_cat_unblocks.hasOwnProperty(tab_host) && conf.site_specific_cat_unblocks[tab_host].indexOf(cat_id) >= 0) {
				if (conf.site_specific_blocks.hasOwnProperty(tab_host) && conf.site_specific_blocks[tab_host].indexOf(+app_id) >= 0) {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				} else {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				}
			} else {
				if (conf.site_specific_unblocks.hasOwnProperty(tab_host) && conf.site_specific_unblocks[tab_host].indexOf(+app_id) >= 0) {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				} else {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				}
			}
		} else {
			if (conf.site_specific_cat_blocks.hasOwnProperty(tab_host) && conf.site_specific_cat_blocks[tab_host].indexOf(cat_id) >= 0) {
				if (conf.site_specific_unblocks.hasOwnProperty(tab_host) && conf.site_specific_unblocks[tab_host].indexOf(+app_id) >= 0) {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				} else {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				}
			} else {
				if (conf.site_specific_blocks.hasOwnProperty(tab_host) && conf.site_specific_blocks[tab_host].indexOf(+app_id) >= 0) {
					if (whitelisted(tab_url)) {
						return false;
					} else {
						return !c2pDb.allowedOnce(tab_id, app_id);
					}
				} else {
					if (blacklisted(tab_url)) {
						return !c2pDb.allowedOnce(tab_id, app_id);
					} else {
						return false;
					}
				}
			}
		}
	}
}

/**
 * Set unique IDs for existing tabs, set listener to add unique IDs to future tabs,
 * and set listener to execute page_info and click2play scannings on 'ready' (DOM loaded)
 * Precondition: tabs module must be loaded into var 'tabs'.
 */
function initTabIds() {
	// parse already existing tabs
	var i;
	for each(var tab in SDK.tabs) {
		tabInfo.create(tab.id, tab.url);
	}

	// add listener to append id to future tabs
	SDK.tabs.on('open', function(tab) {
		tabInfo.create(tab.id, tab.url);
	});
}

function detachWorker(tab_id) {
	['tabWorkers', 'c2pQueue'].forEach(function(name) {
		if (Ghostery[name].hasOwnProperty(tab_id)) {
			delete Ghostery[name][tab_id];
		}
	});
}

// TODO what are the shortcomings?
function clearTabData(tab_id) {
	log(`♲ ♲ ♲ Clearing tab data for ${tab_id} ♲ ♲ ♲`);

	detachWorker(tab_id);
	foundBugs.clear(tab_id);
	tabInfo.clear(tab_id);
}

function checkLibraryVersion(callback) {
	SDK.request.Request({
		url: Ghostery.VERSION_CHECK_URL,
		onComplete: function(r) {
			if (r.status >= 200 && r.status < 400) {
				bugDb.update(r.json.bugsVersion, callback);
				lsoDb.update(r.json.lsosVersion, callback);
				c2pDb.update(r.json.click2playVersion);
				compDb.update(r.json.compatibilityVersion);
				tagDb.update(r.json.tagsVersion);
			} else {
				log("ERROR - Could not check library version: ", r.text);
				if (callback) {
					callback({
						success: false,
						updated: false
					});
				}
			}
		}
	}).get();
}

function autoUpdateBugDb() {
	// check and fetch (if needed) a new tracker library every 12 hours
	if (conf.enable_autoupdate) {
		if (!prefs('bugs_last_updated') ||
			(new Date()) > (new Date(+prefs('bugs_last_updated') + (1000 * 60 * 60 * 12)))) {
			checkLibraryVersion();
		}
	}
}

function pruneTabData() {
	var tab_ids = [],
		i;

	for each(var tab in SDK.tabs) {
		tab_ids.push(tab.id);
	}

	[foundBugs, tabInfo].forEach(function(tabData) {
		_.keys(_.omit(tabData.getAll(), tab_ids)).forEach(function(tab_id) {
			clearTabData(tab_id);
		});
	});
}

function openTab(url, isExtPage, inNewWindow, sameTab) {
	if (isExtPage) {
		url = SDK.self.data.url(url);
	}

	if (sameTab) {
		SDK.tabs.activeTab.url = url;
		return;
	}

	utils.getActiveTab(function(currentTab) {
		SDK.tabs.open({
			url: url,
			onOpen: function(tab) {
				tab.index = currentTab.index;
			},
			inNewWindow: inNewWindow
		});
	});
}

SDK.timers.setInterval(function() {
	// TODO db should be updated every 5 mins
	autoUpdateBugDb();
	cmp.fetchMktgData(function() {
		Ghostery.CMP_DATA = prefs("cmp_data");
	});
}, 1000 * 60 * 30); // every half hour
SDK.timers.setInterval(pruneTabData, 800000); // every eight minutes

init();

if (!MOBILE_MODE) {
	exports.onUnload = function(reason) {
		if (reason != "disable") {
			return;
		}
		var OS = '',
			xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);

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

		SDK.tabs.open('https://' + METRICS_SUB_DOMAIN + '.ghostery.com/uninstall' +
			'?gr=' + (conf.ghostrank ? '1' : '0') +
			'&v=' + encodeURIComponent(utils.VERSION) +
			'&os=' + encodeURIComponent(OS) +
			'&ua=' + (MOBILE_MODE ? 'fa' : 'ff'));
	};
}
