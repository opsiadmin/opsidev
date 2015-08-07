/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

 /* jshint unused: false */

var	MOBILE_MODE = (require('sdk/system').platform.toLowerCase() == 'android'),

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
		tabsLib: require('sdk/tabs/helpers'),
		tabsLib2: require('sdk/tabs/utils'),
		tabs: require('sdk/tabs'),
		file: require('sdk/io/file'),
		winUtils: require('sdk/window/utils'),
		request: require('sdk/request'),
		preferences: require('sdk/preferences/service'),
		unload: require('sdk/system/unload'),
		pb: (MOBILE_MODE ? null : require('sdk/private-browsing'))
	},

	// Vendor Modules
	_ = require('./vendor/underscore-1.4.3'),
	parseUri = require('./vendor/parseuri').parseUri,

	// Proprietary Modules
	utils = require('./utils'),
	conf = require('./conf').load,
	i18n = require('./i18n'),
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
	cleaner = require('cleaner'),
	dispatcher = require('./dispatcher'),

	Ghostery = {
		// Holds tab_ids for all active tabs across all open windows
		activeTabs: [],

		tabWorkers: {},

		c2pQueue: {},

		blockLogWorker: null,

		VERSION_CHECK_URL: 'https://cdn.ghostery.com/update/version',

		// UI
		menu: require('./menu'),

		button: require('./button'),

		panel: require('./panel').Panel({
			id: 'ghostery-panel',
			height: 421,
			width: 347,
			contentURL: SDK.self.data.url('panel.html'),
			panelStyle: SDK.self.data.url('css/firefoxPanel.css'),
			contentScriptFile: [
				SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
				SDK.self.data.url('lib/vendor/jquery-ui-1.10.4.min.js'),
				SDK.self.data.url('lib/vendor/underscore-1.4.3.js'),
				SDK.self.data.url('lib/vendor/backbone-0.9.2.js'),
				SDK.self.data.url('lib/vendor/bootstrap/bootstrap.js'),
				SDK.self.data.url('lib/utils.js'),
				SDK.self.data.url('lib/i18n.js'),
				SDK.self.data.url('templates/precompiled/panel.js'),
				SDK.self.data.url('templates/precompiled/_panel_app.js'),
				SDK.self.data.url('lib/panel.js'),
				SDK.self.data.url('js/panel.js')
			]
		})
	},

	prefs = utils.prefs,
	log = utils.log,
	upgrade_alert_shown = false,

	JUST_UPGRADED_FROM_PRE_SDK,
	JUST_UPGRADED_FROM_PRE_SS,
	JUST_UPGRADED,
	JUST_INSTALLED;

Ghostery.BlockingPolicy = {
	QueryInterface: SDK.XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIChannelEventSink]),
	classID: SDK.components.ID('{a4992d70-56f2-11de-8a39-0800200c9a66}'),
	classDescription: 'Ghostery Blocking Policy',
	contractID: '@ghostery.com/blocking-policy;1',
	xpcomCategories: ['content-policy', 'net-channel-event-sinks'],

	init: function () {
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
	shouldLoad: function (type, contentLocation, requestOrigin, context, mimeTypeGuess, extra) {
		var tab,
			block,
			bug_id = false,
			app_id,
			src = contentLocation.spec,
			tab_id,
			tab_url,
			tab_host,
			surrogates;

		// Skip "data:" and "javascript:" urls to avoid errors and improve performance
		if (src.substr(0, 5).toLowerCase() == 'data:' ||
			/* jshint scripturl: true */
			src.substr(0, 11).toLowerCase() == 'javascript:') {
			/* jshint scripturl: false */
			return Ci.nsIContentPolicy.ACCEPT;
		}

		// Always allow cross-domain policy files
		if ((type === Ci.nsIContentPolicy.TYPE_OBJECT || type === Ci.nsIContentPolicy.TYPE_OBJECT_SUBREQUEST) &&
				src.indexOf('crossdomain.xml') >= 0) {
			return Ci.nsIContentPolicy.ACCEPT;
		}

		tab = utils.getTabForContext(context);
		if (!tab) { return Ci.nsIContentPolicy.ACCEPT; }
		tab_id = tab.id;

		if (type === Ci.nsIContentPolicy.TYPE_DOCUMENT) {

			if (!tab) { tab_id = SDK.tabs.activeTab.id; }

			// Do not allow simple hash changes to reset the tab info, found bugs, and other stuff
			var parsed = parseUri(src),
				srcHash = parsed.anchor,
				srcHostPath = parsed.host + parsed.path,

				hashChanged = (tabInfo) && (tabInfo.get) && (tabInfo.get(tab_id)) &&
					((tabInfo.get(tab_id).host + tabInfo.get(tab_id).path) == srcHostPath) &&
					(srcHash != tabInfo.get(tab_id).hash) &&
					(srcHash !== '');

			if (hashChanged) {
				return Ci.nsIContentPolicy.ACCEPT;
			}

			log('Tab %s navigating to %s', tab_id, src);

			// NOTE main_frames such as "file://" error out when accessing host
			try {
				tab_host = contentLocation.host;
			} catch (e) {
				tab_host = '';
			}

			// check for page-level surrogates
			surrogates = surrogatedb.getForSite(tab_host);
			Ghostery.BlockingPolicy.surrogate(context, surrogates);

			tabInfo.create(tab_id, src);
			c2pDb.reset(tab_id);
			foundBugs.clear(tab_id);
			ghostrank.onNavigate(src);
			updateButton(tab_id);
			delete Ghostery.tabWorkers[tab_id];
			delete Ghostery.c2pQueue[tab_id];

			return Ci.nsIContentPolicy.ACCEPT;
		}

		if (!tabInfo.get(tab_id)) {
			log('tabInfo not found for tab %s', tab_id);
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
		block = !conf.paused_blocking &&

			conf.selected_app_ids.hasOwnProperty(app_id) &&

			// site-specific unblocking
			(!conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
				conf.site_specific_unblocks[tab_host].indexOf(+app_id) == -1) &&

			// TODO inline, or move to tabInfo
			!whitelisted(tab_url) &&

			// TODO inline?
			!c2pDb.allowedOnce(tab_id, app_id);

		// process the tracker asynchronously
		// v. important to block request processing as little as necessary
		SDK.timers.setTimeout(function () {
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
						src,
						{
							bug_id: bug_id,
							tab_url: tab.url,
							block: block,
							latency: -1
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

				Ghostery.BlockingPolicy.surrogate(context, surrogates);
			}

			utils.blockingLog('Blocked  $TYPE$: ' + src + ' origin: ' + tab_url, type, tab, Ghostery.blockLogWorker);
			return Ci.nsIContentPolicy.REJECT_REQUEST;
		}

		return Ci.nsIContentPolicy.ACCEPT;
	},

	shouldProcess: function (contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra) {
		return Ci.nsIContentPolicy.ACCEPT;
	},
	
	// nsIChannelEventSink interface implementation
	// TODO: maybe better to transfer this into utils
	getNavInterface: function (channel) {
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

	asyncOnChannelRedirect: function (oldChannel, newChannel, flags, callback) {
		Ghostery.BlockingPolicy.onChannelRedirect(oldChannel, newChannel, flags);
		callback.onRedirectVerifyCallback(Cr.NS_OK);
	},

	onChannelRedirect: function (oldChannel, newChannel, flags) {
		var from_url = oldChannel.originalURI.spec,
			to_url = newChannel.URI.spec,
			block,
			bug_id,
			app_id,
			nav,
			tab,
			tab_id,
			tab_host,
			tab_url;

		if (from_url == to_url) { return; }
		
		tab = utils.getTabFromChannel(newChannel);
		if (!tab) { return; }

		tab_id = tab.id;
		tab_url = tab.url;
		nav = this.getNavInterface(oldChannel);

		// if it is a main_frame redirect update tabInfo
		/* jshint bitwise: false */
		if ((oldChannel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI) !== 0 &&
		/* jshint bitwise: true */
				tab_url == from_url) {
			tabInfo.create(tab_id, to_url);
			foundBugs.clear(tab_id);
			ghostrank.onNavigate(from_url);
			updateButton(tab_id);
			delete Ghostery.tabWorkers[tab_id];
			delete Ghostery.c2pQueue[tab_id];
		}

		// exit if we are allowing through or prevent_redirection is off
		if (!conf.prevent_redirection) { return; }
		if (c2pDb.allowedThrough(tab_id)) { return; }

		bug_id = matcher.isBug(to_url, tab.url);
		if (!bug_id) {
			return;
		}

		tab_host = tabInfo.get(tab_id).host;
		app_id = bugDb.db.bugs[bug_id].aid;
		block = !conf.paused_blocking &&

			conf.selected_app_ids.hasOwnProperty(app_id) &&

			// site-specific unblocking
			(!conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
				conf.site_specific_unblocks[tab_host].indexOf(+app_id) == -1) &&

			// TODO inline, or move to tabInfo
			!whitelisted(tab_url) &&

			// TODO inline?
			!c2pDb.allowedOnce(tab_id, app_id);
		
		// process the tracker asynchronously
		// v. important to block request processing as little as necessary
		SDK.timers.setTimeout(function () {
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
						to_url,
						{
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

				SDK.timers.setTimeout(function () {
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
								parseUri(from_url).host,
								parseUri(to_url).host,
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

						doc.getElementById('action_always').addEventListener('click', function (e) {
							delete conf.selected_app_ids[app_id];
							delete conf.selected_lsos_app_ids[app_id];
							doc.location = to_url;
							e.preventDefault();
						});

						doc.getElementById('action_through_once').addEventListener('click', function (e) {
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
	createInstance: function (outer, iid) {
		if (outer) { throw Cr.NS_ERROR_NO_AGGREGATION; }
		return this.QueryInterface(iid);
	},

	// Cookie Blocking
	cookieManager: null,

	cookieBlockingInit: function () {
		SDK.events.on('cookie-changed', Ghostery.BlockingPolicy.cookieBlockingPolicy, true);

		Ghostery.BlockingPolicy.cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);
	},
	
	cookieBlockingPolicy: function (event) {
		var block,
			cookie,
			cookie_id,
			app_id,
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
			block = !conf.paused_blocking &&
				!whitelisted(tab_url) &&
				conf.selected_lsos_app_ids.hasOwnProperty(app_id) &&
				(!conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
				conf.site_specific_unblocks[tab_host].indexOf(+app_id) == -1) &&
				!c2pDb.allowedOnce(tab_id, app_id);

			if (block) {
				Ghostery.BlockingPolicy.cookieManager.remove(cookie.host, cookie.name, cookie.path, false);
				utils.blockingLog('Blocked cookie: ' + cookie.name + ' on ' + cookie.host + cookie.path + ' with value: ' + cookie.value, Ghostery.blockLogWorker);
			}
		}
	},

	removeCookieBlocking: function () {
		// colliding addon present, disable
		try {
			SDK.events.off('cookie-changed', Ghostery.BlockingPolicy.cookieBlockingPolicy);
		} catch (e) {}
	},

	surrogate: function (context, surrogates) {
		if (!surrogates || surrogates.length === 0) { return; }

		var doc = context && context.ownerDocument || context;

		// Does context exists?
		if (!doc || !doc.documentElement) { return; }

		surrogates.forEach(function (surrogate) {
			var id = "bug.surrogate." + surrogate.sid;

			// stop if its already present
			if (doc.getElementById(id)) { return; }

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
	if (conf.show_alert) {
		if (!JUST_UPGRADED || upgrade_alert_shown) {
			showAlert(tab_id);
		}
	}

	// show upgrade notifications
	utils.getActiveTab(function (tab) {
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
			'notification_upgrade'
		],
			worker = tabInfo.get(tab_id).worker;

		if (JUST_UPGRADED && !upgrade_alert_shown) {
			var name = 'showUpgradeAlert';

			// GhostRank is off and we've already dismissed or finished the walkthrough
			if (!conf.ghostrank && (prefs('walkthroughAborted') || prefs('walkthroughFinished'))) {
				name = 'showWalkthroughAlert';
			}

			worker.port.emit(name, {
				translations: _.object(_.map(alert_messages, function (key) { return [key, i18n.t(key)]; }))
			});
				// not all tabs will have content scripts loaded, so better wait for confirmation first
				// TODO no longer necessary?
			upgrade_alert_shown = true;

		} else if (bugDb.db.JUST_UPDATED_WITH_NEW_TRACKERS) {
			if (conf.notify_library_updates) {
				worker.port.emit('showUpdateAlert', {
					translations: _.object(_.map(alert_messages, function (key) { return [key, i18n.t(key)]; }))
				});
				bugDb.db.JUST_UPDATED_WITH_NEW_TRACKERS = false;
			} else {
				bugDb.db.JUST_UPDATED_WITH_NEW_TRACKERS = false;
			}
		}
	});

	// perform page-level GhostRank, but only if the page had some trackers on it
	// TODO document on wiki
	if (conf.ghostrank && foundBugs.getAppsCount(tab_id) > 0) {
		if (tab && !(SDK.pb && SDK.pb.isPrivate(tab)) && ghostrank.isValidUrl(parseUri(tab_url))) {
			var pageInfoWorker = tab.attach({
				contentScriptFile: SDK.self.data.url('includes/page_info.js')
			});

			pageInfoWorker.port.on('recordPageInfo', function (data) {
				ghostrank.recordPageInfo(data.domain, data.latency, data.spots);
			});
		}
	}
}

function setPanelPortListeners(worker) {
	worker.port.on('panelPauseToggle', function () {
		conf.paused_blocking = !conf.paused_blocking;
	});

	worker.port.on('panelSiteWhitelistToggle', function (message) {
		var whitelisted_url = whitelisted(message.tab_url),
			hostname = message.tab_host;

		if (whitelisted_url) {
			conf.site_whitelist.splice(conf.site_whitelist.indexOf(whitelisted_url), 1);
		} else if (hostname) {
			conf.site_whitelist.push(hostname);
		}
	});

	worker.port.on('needsReload', function (message) {
		if (tabInfo.get(message.tab_id)) {
			tabInfo.get(message.tab_id).needsReload = message.needsReload;
		}
	});

	worker.port.on('panelShowTutorialSeen', function () {
		prefs('panelTutorialShown', true);
	});

	worker.port.on('reloadTab', function (message) {
		if (message.tab_id) {
			utils.reloadTab(message.tab_id);
		} else if (SDK.tabs.activeTab) {
			SDK.tabs.activeTab.reload();
		}
	});

	worker.port.on('panelClose', function (message) {
		hidePanel(message.backToTab);
	});

	worker.port.on('panelSelectedAppsUpdate', function (message) {
		if (message.app_selected) {
			conf.selected_app_ids[message.app_id] = 1;
			conf.selected_lsos_app_ids[message.app_id] = 1;
		} else {
			delete conf.selected_app_ids[message.app_id];
			delete conf.selected_lsos_app_ids[message.app_id];
		}
	});

	worker.port.on('panelSiteSpecificUnblockUpdate', function (message) {
		var unblock = message.siteSpecificUnblocked,
			app_id = +message.app_id,
			host = message.tab_host;

		if (!unblock) {
			if (conf.site_specific_unblocks.hasOwnProperty(host) && conf.site_specific_unblocks[host].indexOf(app_id) >= 0) {
				conf.site_specific_unblocks[host].splice(conf.site_specific_unblocks[host].indexOf(app_id), 1);

				if (conf.site_specific_unblocks[host].length === 0) {
					delete conf.site_specific_unblocks[host];
				}
			}
		} else {
			if (!conf.site_specific_unblocks.hasOwnProperty(host)) {
				conf.site_specific_unblocks[host] = [];
			}

			if (conf.site_specific_unblocks[host].indexOf(app_id) == -1) {
				conf.site_specific_unblocks[host].push(app_id);
			}
		}
	});

	worker.port.on('panelOpenLinkInTab', function (message) {
		openTab(message.url, message.local);
	});

	worker.port.on('copyToClipboard', function (message) {
		Cc["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Ci.nsIClipboardHelper)
			.copyString(message.text || '');
	});
}

function loadGhosteryPageMod() {
	// Purple box, grey box, etc.
	SDK.pageMod.PageMod({
		include: '*',
		contentScriptWhen: 'start',
		attachTo: ['existing', 'top'], // TODO FF: make blocking policy start before this is run on install
		contentScriptFile: SDK.self.data.url('includes/ghostery.js'),
		onAttach: function (worker) {
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

			worker.port.on('showNewTrackers', function () {
				openTab('options.html#new_trackers', true);
			});

			worker.port.on('openWalkthrough', function () {
				openTab('walkthrough.html', true);
			});

			worker.port.on('showPurpleBoxOptions', function () {
				openTab('options.html#alert-bubble-options', true);
			});

			worker.port.on('openTab', function (message) {
				openTab(message.url);
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
		onAttach: function (worker) {
			var tab_id = worker.tab.id;

			if (conf.show_button) {
				worker.port.emit('showButton');
			}

			worker.port.on('showPanel', function () {
				showPanel_mobile(tab_id);
			});

			tabInfo.get(tab_id).worker = worker;
		}
	});

	// Findings panel
	SDK.pageMod.PageMod({
		include: 'resource://firefox-at-ghostery-dot-com/ghostery/data/panel_mobile.html*',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('lib/vendor/underscore-1.4.3.js'),
			SDK.self.data.url('lib/vendor/backbone-0.9.2.js'),
			SDK.self.data.url('lib/vendor/bootstrap/bootstrap.js'),
			SDK.self.data.url('lib/utils.js'),
			SDK.self.data.url('lib/i18n.js'),
			SDK.self.data.url('templates/precompiled/panel.js'),
			SDK.self.data.url('templates/precompiled/_panel_app.js'),
			SDK.self.data.url('lib/panel.js'),
			SDK.self.data.url('js/panel.js')
		],
		onAttach: function (worker) {
			var tab_id = parseInt(worker.tab.url.substr(worker.tab.url.indexOf('tabId=') + 6), 10),
				tab_url = tabInfo.get(tab_id).url,
				tab_host = tabInfo.get(tab_id).host;

			setPanelPortListeners(worker);

			worker.port.emit('panelData', {
				MOBILE_MODE: true,
				trackers: foundBugs.getApps(tab_id),
				tabId: tab_id,
				conf: conf.toJSON(),
				page: {
					url: tab_url,
					host: tab_host
				},
				whitelisted: whitelisted(tab_url),
				pauseBlocking: conf.paused_blocking,
				needsReload: (tabInfo.get(tab_id) ? tabInfo.get(tab_id).needsReload : {changes: {}}),
				showTutorial: !prefs('panelTutorialShown'),
				validProtocol: (tab_url.indexOf('http') === 0),
				notScanned: !foundBugs.getApps(tab_id),
				language: conf.language
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
		onAttach: function (worker) {
			var tab = worker.tab,
				tab_id,
				tab_url,
				tab_host;

			if (!tab) { return; }

			tab_id = worker.tab.id;
			tab_url = tab.url;
			tab_host = tabInfo.get(tab_id).host;

			if (!Ghostery.tabWorkers.hasOwnProperty(tab_id)) {
				Ghostery.tabWorkers[tab_id] = [];
			}
			Ghostery.tabWorkers[tab_id].push(worker);
			flushC2PData(tab_id);

			// only triggered when main frame has finished loading
			worker.port.on('pageLoaded', function (message) {
				tabInfo.get(tab_id).pageLoaded = true;
				ghostrank.dequeueRecordStats(tab_id);
			});

			worker.port.emit('scanDOM', {
				conf: conf.toJSON(),
				site: tab_host,
				MOBILE_MODE: MOBILE_MODE
			});

			worker.port.on('isBug', function (data) {
				var bug_id,
					app_id,
					block;

				bug_id = matcher.isBug(data.src, tab_url);
				if (!bug_id) {
					return;
				}

				app_id = bugDb.db.bugs[bug_id].aid;
				block = !conf.paused_blocking &&

					conf.selected_app_ids.hasOwnProperty(app_id) &&

					// site-specific unblocking
					(!conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
						conf.site_specific_unblocks[tab_host].indexOf(+app_id) == -1) &&

					// TODO inline, or move to tabInfo
					!whitelisted(tab_url) &&

					// TODO inline?
					!c2pDb.allowedOnce(tab_id, app_id);

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
						data.af,
						{
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
						if (app.id != app_id) { continue; }

						for (j = 0; j < app.sources.length; j++) {
							if (app.sources[j].src == data.src) {
								return;
							}
						}
					}
				}

				SDK.timers.setTimeout(function () {
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

			if (!conf.enable_click2play) { return; }

			worker.port.emit('c2pFrameHtml', {
				html: _.template(SDK.self.data.load('templates/click2play.html'), {
					ghosty_blocked: SDK.self.data.url('images/click2play/ghosty_blocked.png'),
					allow_once: SDK.self.data.url('images/click2play/allow_once.png'),
					allow_unblock: SDK.self.data.url('images/click2play/allow_unblock.png'),
					t: i18n.t
				})
			});

			worker.port.on('c2pToolTip', function (message) {
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

			worker.port.on('processC2P', function (message) {
				if (message.action == 'always') {
					message.bug.allow.forEach(function (aid) {
						if (conf.selected_app_ids.hasOwnProperty(aid)) {
							delete conf.selected_app_ids[aid];
							delete conf.selected_lsos_app_ids[aid];
						}
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
				worker.port.on('updateTabInfo', function (message) {
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

	// Walkthrough Page
	SDK.pageMod.PageMod({
		include: 'resource://firefox-at-ghostery-dot-com/ghostery/data/walkthrough.html*',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('lib/vendor/swipe.js'),
			SDK.self.data.url('lib/vendor/underscore-1.4.3.js'),
			SDK.self.data.url('lib/vendor/backbone-0.9.2.js'),
			SDK.self.data.url('lib/vendor/apprise/apprise-1.5.full.js'),
			SDK.self.data.url('lib/vendor/tipTip/jquery.tipTip.js'),
			SDK.self.data.url('lib/vendor/jquery.scrollintogreatness-2.0.0.js'),
			SDK.self.data.url('lib/utils.js'),
			SDK.self.data.url('lib/i18n.js'),
			SDK.self.data.url('templates/precompiled/_header.js'),
			SDK.self.data.url('templates/precompiled/walkthrough.js'),
			SDK.self.data.url('templates/precompiled/_footer.js'),
			SDK.self.data.url('templates/precompiled/_app_browser.js'),
			SDK.self.data.url('templates/precompiled/_ghostrank.js'),
			SDK.self.data.url('templates/precompiled/_select.js'),
			SDK.self.data.url('templates/precompiled/_app.js'),
			SDK.self.data.url('templates/precompiled/_app_info.js'),
			SDK.self.data.url('templates/precompiled/_category.js'),
			SDK.self.data.url('templates/precompiled/_default_block_all.js'),
			SDK.self.data.url('templates/precompiled/_tag.js'),
			SDK.self.data.url('lib/browser.js'),
			SDK.self.data.url('js/walkthrough.js')
		],

		onAttach: function (worker) {
			worker.port.emit('optionsData', {
				conf: conf.toJSON(),
				bugdb: bugDb.db,
				tagDb: tagDb.db,
				lsodb: lsoDb.db,
				VERSION: utils.VERSION,
				incompatibleAddons: prefs('incompatibleAddons'),
				MOBILE_MODE: MOBILE_MODE
			});

			worker.port.on('walkthroughSave', function (message) {
				var confJSON = conf.toJSON(),
					setting;

				for (setting in confJSON) {
					if (typeof message[setting] != 'undefined') {
						conf[setting] = message[setting];
					}
				}

				utils.forceSave();

				return;
			});

			worker.port.on('walkthroughFinished', function () {
				prefs('walkthroughFinished', true);
			});

			worker.port.on('walkthroughAborted', function () {
				prefs('walkthroughAborted', true);
				worker.tab.close();
			});

			worker.port.on('ajaxRequest', function (message) {
				SDK.request.Request({
					url: message.url,
					onComplete: function (response) {
						worker.port.emit('ajaxResponse', {
							success: (response.status == 200),
							json: response.json
						});
					}
				}).get();
			});

			worker.port.on('addButton', function (message) {
				Ghostery.button.moveTo('nav-bar');
			});
		}
	});

	// Options Page
	SDK.pageMod.PageMod({
		include: 'resource://firefox-at-ghostery-dot-com/ghostery/data/options.html*',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('lib/vendor/underscore-1.4.3.js'),
			SDK.self.data.url('lib/vendor/backbone-0.9.2.js'),
			SDK.self.data.url('lib/vendor/tipTip/jquery.tipTip.js'),
			SDK.self.data.url('lib/vendor/apprise/apprise-1.5.full.js'),
			SDK.self.data.url('lib/vendor/moment/moment.js'),
			SDK.self.data.url('lib/vendor/moment/lang/all.js'),
			SDK.self.data.url('lib/utils.js'),
			SDK.self.data.url('lib/i18n.js'),
			SDK.self.data.url('templates/precompiled/_header.js'),
			SDK.self.data.url('templates/precompiled/options.js'),
			SDK.self.data.url('templates/precompiled/_footer.js'),
			SDK.self.data.url('templates/precompiled/_app_browser.js'),
			SDK.self.data.url('templates/precompiled/_ghostrank.js'),
			SDK.self.data.url('templates/precompiled/_select.js'),
			SDK.self.data.url('templates/precompiled/_library_li.js'),
			SDK.self.data.url('templates/precompiled/_app.js'),
			SDK.self.data.url('templates/precompiled/_app_info.js'),
			SDK.self.data.url('templates/precompiled/_category.js'),
			SDK.self.data.url('templates/precompiled/_default_block_all.js'),
			SDK.self.data.url('templates/precompiled/_tag.js'),
			SDK.self.data.url('lib/vendor/jquery.scrollintogreatness-2.0.0.js'),
			SDK.self.data.url('lib/browser.js'),
			SDK.self.data.url('js/options.js')
		],

		onAttach: function (worker) {
			worker.port.emit('optionsData', {
				MOBILE_MODE: MOBILE_MODE,
				bugdb: bugDb.db,
				lsodb: lsoDb.db,
				tagDb: tagDb.db,
				bugs_last_updated: prefs('bugs_last_updated'),
				conf: conf.toJSON(),
				new_app_ids: prefs('newAppIds'),
				new_lsos_app_ids: prefs('newLsosAppIds'),
				incompatibleAddons: prefs('incompatibleAddons'),
				VERSION: utils.VERSION
			});

			worker.port.on('optionsSave', function (message) {
				var confJSON = conf.toJSON(),
					setting;

				for (setting in confJSON) {
					if (typeof message[setting] != 'undefined') {
						conf[setting] = message[setting];
					}
				}

				i18n.init(conf.language);
				utils.forceSave();

				if (message.re_add_ghosty) {
					Ghostery.button.moveTo('nav-bar');
				}
			});

			worker.port.on('optionsUpdateBugList', function () {
				var updateSuccessCount = 0,
					updateSuccess = [],
					updateRemote = [];

				function processUpdate(result) {
					updateSuccessCount++;
					updateSuccess.push(result.success);
					updateRemote.push(result.updated);

					if (updateSuccessCount != 2) { return; }

					// TODO improve: delayed so that conf has enough time to update to the newly selected apps. See _.debounced in conf.js
					SDK.timers.setTimeout(function () {
						worker.port.emit('optionsBugListUpdated', {
							bugdb: bugDb.db,
							lsodb: lsoDb.db,
							tagDb: tagDb.db,
							bugs_last_updated: prefs('bugs_last_updated'),
							conf: conf.toJSON(),
							new_app_ids: prefs('newAppIds'),
							new_lsos_app_ids: prefs('newLsosAppIds'),
							success: (updateSuccess.indexOf(false) == -1),
							is_new_update: (updateRemote.indexOf(true) >= 0)
						});
					}, 1000);
				}

				SDK.request.Request({
					url: Ghostery.VERSION_CHECK_URL,
					onComplete: function (r) {
						bugDb.update(r.json.bugsVersion, processUpdate);
						lsoDb.update(r.json.lsosVersion, processUpdate);
						c2pDb.update(r.json.click2playVersion);
						compDb.update(r.json.compatibilityVersion);
						tagDb.update(r.json.tagsVersion);
					}
				}).get();
			});
			
			worker.port.on('ajaxRequest', function (message) {
				SDK.request.Request({
					url: message.url,
					onComplete: function (response) {
						worker.port.emit('ajaxResponse', {
							success: (response.status == 200),
							json: response.json
						});
					}
				}).get();
			});

			worker.port.on('close', function () {
				utils.closeTab(worker.tab);
			});

			worker.port.on('restart', function () {
				var boot = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
				/* jshint bitwise: false */
				boot.quit(Ci.nsIAppStartup.eForceQuit | Ci.nsIAppStartup.eRestart);
				/* jshint bitwise: true */
			});
		}
	});

	// Backup Page
	SDK.pageMod.PageMod({
		include: 'resource://firefox-at-ghostery-dot-com/ghostery/data/backup.html*',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('lib/vendor/underscore-1.4.3.js'),
			SDK.self.data.url('lib/vendor/backbone-0.9.2.js'),
			SDK.self.data.url('lib/vendor/tipTip/jquery.tipTip.js'),
			SDK.self.data.url('lib/vendor/moment/moment.js'),
			SDK.self.data.url('lib/vendor/moment/lang/all.js'),
			SDK.self.data.url('lib/utils.js'),
			SDK.self.data.url('lib/i18n.js'),
			SDK.self.data.url('templates/precompiled/_header.js'),
			SDK.self.data.url('templates/precompiled/backup.js'),
			SDK.self.data.url('templates/precompiled/_footer.js'),
			SDK.self.data.url('lib/vendor/jquery.scrollintogreatness-2.0.0.js'),
			SDK.self.data.url('lib/browser.js'),
			SDK.self.data.url('js/backup.js')
		],

		onAttach: function (worker) {
			worker.port.on('backupReady', function (message) {
				worker.port.emit('backupData', {
					MOBILE_MODE: MOBILE_MODE,
					conf: conf.toJSON()
				});
			});

			worker.port.on('restoreBackup', function (message) {
				var confJSON = conf.toJSON(),
					setting;

				for (setting in confJSON) {
					if (typeof message.conf[setting] != 'undefined') {
						conf[setting] = message.conf[setting];
					}
				}

				for (var p in message.pref) {
					prefs(p, message.pref[p]);
				}

				i18n.init(conf.language);
				utils.forceSave();

				worker.tab.close();
			});

			worker.port.on('downloadBackup', function (message) {
				Cu.import("resource://gre/modules/FileUtils.jsm");
				Cu.import("resource://gre/modules/NetUtil.jsm");
				/* globals FileUtils, NetUtil */

				var d = new Date(),
					fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker),
					rv,
					file;

				fp.init(SDK.winUtils.getMostRecentBrowserWindow(), "Save backup to", Ci.nsIFilePicker.modeSave);
				fp.appendFilters(Ci.nsIFilePicker.filterAll | Ci.nsIFilePicker.filterText); // jshint ignore:line

				fp.displayDirectory = FileUtils.getDir("DfltDwnld", ["DIR"], false);
				fp.defaultString = "Ghostery-Backup-" + (d.getMonth() + 1) + "-" + d.getDate() + "-" + d.getFullYear() + ".ghost";

				rv = fp.show();
				if (rv == Ci.nsIFilePicker.returnOK || rv == Ci.nsIFilePicker.returnReplace) {
					file = fp.file;

					var settings = {
						conf: conf.toJSON(),
						prefs: {
							panelTutorialShown: prefs('panelTutorialShown'),
							walkthroughFinished: prefs('walkthroughFinished'),
							walkthroughAborted: prefs('walkthroughAborted')
						}
					};

					var hash = utils.hashCode(JSON.stringify(settings)),
						backup = JSON.stringify({hash: hash, settings: settings});

					var ostream = FileUtils.openSafeFileOutputStream(file);

					var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
					converter.charset = "UTF-8";

					var istream = converter.convertToInputStream(backup);
					NetUtil.asyncCopy(istream, ostream);
				}
			});
		}
	});

	// Add Tracker admin page
	SDK.pageMod.PageMod({
		include: 'resource://firefox-at-ghostery-dot-com/ghostery/data/tracker.html',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('js/tracker.js')
		],
		onAttach: function (worker) {
			worker.port.on('newTracker', function (data) {
				// record into storage
				var db = utils.prefs('user_bugs');
				if (!db) {
					db = [];
				}

				db.push({
					'type': (data.tracker.db == 'user' ? 'user_created' : data.tracker.type),
					'pattern': data.tracker.pattern,
					'name': data.tracker.name + (data.tracker.db == 'user' ? ' (U)' : ''),
					'classification': 4
				});

				utils.prefs('user_bugs', db);
				bugDb.init();
			});
		}
	});

	// ghostery_dot_com.js
	SDK.pageMod.PageMod({
		include: ['*.ghostery.com', '*.ghostery.com/download'],
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: SDK.self.data.url('includes/ghostery_dot_com.js')
	});

	SDK.pageMod.PageMod({
		include: 'resource://firefox-at-ghostery-dot-com/ghostery/data/block_log.html',
		contentScriptWhen: 'end',
		attachTo: ['existing', 'top'],
		contentScriptFile: [
			SDK.self.data.url('lib/vendor/jquery-1.7.2.js'),
			SDK.self.data.url('lib/vendor/underscore-1.4.3.js'),
			SDK.self.data.url('lib/utils.js'),
			SDK.self.data.url('lib/i18n.js'),
			SDK.self.data.url('templates/precompiled/_footer.js'),
			SDK.self.data.url('lib/blocking_log.js')
		],
		onAttach: function (worker) {
			Ghostery.blockLogWorker = worker;

			worker.port.on('clearBlockingLog', function () {
				Ghostery.blockLogWorker = null;
			});

			worker.port.on('close', function (tab) {
				utils.closeTab(worker.tab);
			});
		}
	});
}

function initObservers() {
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

		if (!tab || !tab_info) { return; }

		tab_id = tab.id;
		tab_url = tab_info.url;
		tab_host = tab_info.host;

		channel.visitResponseHeaders(function (header, value) {
			if (header.toLowerCase() == 'set-cookie') {
				value = value.split('; ');
				var lso_host,
					lso_id,
					app_id,
					block;

				for (var i = 0; i < value.length; i++) {
					if (/^domain=/.test(value[i])) {
						lso_host = value[i].substr(7, value[i].length - 1);
						break;
					}
				}

				if (!lso_host) { return; }

				lso_id = matcher.isLso(lso_host);
				if (!lso_id) { return; }

				app_id = lsoDb.db.lsos[lso_id].aid;
				block = !conf.paused_blocking &&

					conf.selected_lsos_app_ids.hasOwnProperty(app_id) &&

					// site-specific unblocking
					(!conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
						conf.site_specific_unblocks[tab_host].indexOf(+app_id) == -1) &&

					// TODO inline, or move to tabInfo
					!whitelisted(tab_url) &&

					// TODO inline?
					!c2pDb.allowedOnce(tab_id, app_id);

				if (block) {
					// TODO FF: find a way to implement this
//					utils.blockingLog('Blocked lso: ' + lso.name + ' on ' + lso.lso_host + lso.path + ' with value: ' + lso.value
//						+ ' loaded from ' + this.current , Ghostery.blockLogWorker);
					channel.setResponseHeader('Set-Cookie', '', false);
				}
			}
		});

		if (!conf.ghostrank || (SDK.pb && SDK.pb.isPrivate(tab))) { return; }

		channel.QueryInterface(Ci.nsIWritablePropertyBag);
		var requestStart;

		try { requestStart = channel.getProperty('request_start'); } catch (e) { return; }

		channel.QueryInterface(Ci.nsITraceableChannel);

		function TracingListener() {
			this.originalListener = null;
		}

		TracingListener.prototype =	{
			onDataAvailable: function (request, context, inputStream, offset, count) {
				try {
					this.originalListener.onDataAvailable(request, context, inputStream, offset, count);
				} catch (e) {
					// sometimes fails with this: "Component returned failure code: 0x804b0002 (NS_BINDING_ABORTED) [nsIStreamListener.onDataAvailable]"
				}
			},

			onStartRequest: function (request, context) {
				this.originalListener.onStartRequest(request, context);
			},

			onStopRequest: function (request, context, statusCode) { // The HTTP request is ending.
				if (tab) {
					ghostrank.queueRecordStats(
						tab.id,
						channel.getProperty('src'),
						{
							bug_id: channel.getProperty('bug_id'),
							tab_url: channel.getProperty('tab_url'),
							block: false, // no need to check if bug was blocked. If it reached this, it must have been unblocked
							latency: +(new Date().getTime() - requestStart),
							response_code: channel.responseStatus,
							user_error: (Cr.NS_BINDING_ABORTED === statusCode),
							from_cache: (event_type == 'http-on-examine-cached-response')
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
		var channel = event.subject.QueryInterface(Ci.nsIChannel),
			tab = utils.getTabFromChannel(channel),
			bug_id;

		if (!tab) { return; }
		if (!conf.ghostrank || (SDK.pb && SDK.pb.isPrivate(tab))) { return; }

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
	SDK.events.on('quit-application-requested', function (event) {
		if (conf.delete_fl_sl_cookies) {
			cleaner.cleanup();
		}
	}, true);

	httpRequestEvents.forEach(function (type) {
		SDK.events.on(type, httpRequestObserver, true);
	});
	httpResponseEvents.forEach(function (type) {
		SDK.events.on(type, httpResponseObserver, true);
	});
}

function initAddonManager() {
	try {
		// reset current list of addons
		prefs('incompatibleAddons', false);
		
		Cu.import('resource://gre/modules/AddonManager.jsm');

		var conflicting = ['optout@google.com', 'john@velvetcache.org', 'cookiefast@mozdev.org'],
			enabled = function (addon) {
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
		disabled = function (addon) {
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

		AddonManager.getAddonsByIDs(conflicting, function (addons) {
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
	JUST_INSTALLED =
		!prefs('previousVersion') &&
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

	i18n.init(conf.language);

	[bugDb, lsoDb, c2pDb, compDb, tagDb].forEach(function (db) {
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
	
	Ghostery.menu.add(function () {
		// openTab inNewWindow
		openTab('options.html', true, true);
	});

	if (SDK.self.loadReason == 'upgrade' || SDK.self.loadReason == 'downgrade') {
		// runs here to remove remnant button from previous version if one has been left
		Ghostery.button.remove();
	}

	// register in currently open windows on addon init
	for (var win in SDK.winUtils.windows(null, { includePrivate: true })) {
		Ghostery.button.create(SDK.winUtils.windows(null, { includePrivate: true })[win], {
			panel: Ghostery.panel,
			onCommand: showPanel,
			label: i18n.t('browser_button_label_firefox'),
			tooltiptext: i18n.t('browser_button_tooltip'),
			image: SDK.self.data.url('images/icon17.png'),
			stylesheet: SDK.self.data.url('css/button.css')
		});
	}

	// adding new event on tabs/activate to monitor new tabs and add button to their windows
	// GTK: apparently SDK.windows.browserWindows.on('open') works in only half the times.
	SDK.tabs.on('activate', function (tab) {
		for (var win in SDK.winUtils.windows(null, { includePrivate: true })) {
			// chromeWindow
			Ghostery.button.create(SDK.winUtils.windows(null, { includePrivate: true })[win], {
				panel: Ghostery.panel,
				onCommand: showPanel,
				id: 'ghostery-button-container',
				label: i18n.t('browser_button_label_firefox'),
				tooltiptext: i18n.t('browser_button_tooltip'),
				image: SDK.self.data.url('images/icon17.png'),
				stylesheet: SDK.self.data.url('css/button.css')
			});
		}
	});
	
	registerActiveTabs();
	initObservers();
	initAddonManager();

	SDK.tabs.on('activate', function (tab) {
		registerActiveTabs();
		updateButton(tab.id);
	});
	
	updateButton(!MOBILE_MODE ? SDK.tabs.activeTab.id : null);
	
	if (!MOBILE_MODE) {
		setPanelPortListeners(Ghostery.panel);
	}

	loadPageMods();

	if (!!(!conf.ghostrank &&
		!prefs('walkthroughAborted') &&
		!prefs('walkthroughFinished'))) {
		openTab('walkthrough.html', true);
	}

	// Unloader.
	SDK.unload.when(function (reason) {
		Ghostery.menu.remove();

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

	dispatcher.on('conf.save.selected_app_ids', function (v) {
		var num_selected = _.size(v),
			db = bugDb.db;
		db.noneSelected = (num_selected === 0);
		// can't simply compare num_selected and _.size(db.apps) since apps get removed sometimes
		db.allSelected = (!!num_selected && _.every(db.apps, function (app, app_id) {
			return v.hasOwnProperty(app_id);
		}));
	});

	dispatcher.on('conf.save.site_whitelist', function () {
		updateButton(!MOBILE_MODE ? SDK.tabs.activeTab.id : null);
	});

	dispatcher.on('conf.save.paused_blocking', function () {
		updateButton(!MOBILE_MODE ? SDK.tabs.activeTab.id : null);
	});
}

function registerActiveTabs() {
	if (MOBILE_MODE) { return; }
	Ghostery.activeTabs = [];

	var windows = SDK.winUtils.windows(null, { includePrivate: true }),
		window,
		i;

	for (i = 0; i < windows.length; i++) {
		window = windows[i];
		if ('chrome://browser/content/browser.xul' != window.location) { continue; }
		var activeTab = SDK.tabsLib.getTabForWindow(window.content).id;
		Ghostery.activeTabs.push(activeTab);
	}
}

function upgradeFromPreSS() {
	var strippedKey,
		keys = SDK.preferences.keys('extensions.ghostery.');

	keys.forEach(function (key, index) {
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

	mappings.forEach(function (mapping) {
		try {
			pref = SDK.preferences.get('extensions.ghostery.' + mapping[0]);
			// NOTE special case for autoUpdateBugs since we are changing its default value.
			if (mapping[0] == 'autoUpdateBugs') {
				if (pref == null) { conf[mapping[1]] = mapping[2]; }
			}

			if (pref === mapping[2]) { conf[mapping[1]] = pref; }
		} catch (e) {
			log('mapping preference error', mapping, SDK.storage[mapping[0]]);
		}
	});


	// bubble location
	pref = SDK.preferences.get('extensions.ghostery.bubbleLocation');

	if (pref === 'top-right') { conf.alert_bubble_pos = 'tr'; } else
	if (pref === 'top-left') { conf.alert_bubble_pos = 'tl'; } else
	if (pref === 'bottom-right') { conf.alert_bubble_pos = 'br'; } else
	if (pref === 'bottom-left') { conf.alert_bubble_pos = 'bl'; } else {
		conf.alert_bubble_pos = 'tr';
	}

	// bubble timeout
	pref = SDK.preferences.get('extensions.ghostery.bubbleTimeout');

	try {
		if (pref) {
			var cfg_timeout = parseInt(pref, 10);
			if ([60, 30, 25, 20, 15, 10, 5, 3].indexOf(cfg_timeout) >= 0) {
				conf.alert_bubble_timeout =  cfg_timeout;
			} else {
				conf.alert_bubble_timeout =  15;
			}
		} else {
			conf.alert_bubble_timeout =  15;
		}
	} catch (e) {
		conf.alert_bubble_timeout =  15;
	}

	// existing whitelist
	pref = SDK.preferences.get('extensions.ghostery.whitelist');

	if (pref) {
		pref = pref.split(",");
		conf.site_whitelist = pref;
	}

	// databases
	var profilePath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile).path;
	_.each([ ['selectedBugs', 'selected_app_ids'], ['selectedLsos', 'selected_lsos_app_ids'] ], function (type) {
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
	keys.forEach(function (key, index) {
		SDK.preferences.reset(key);
	});
}

function openPanelTab() {
	var tab, i;

	for each (tab in SDK.tabs) {
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

	SDK.timers.setTimeout(function () {
		var win = SDK.winUtils.getMostRecentBrowserWindow();
		win.fullScreen = false;
		win.fullScreen = true;
	}, 1);
}

function showPanel() {
	var tab_id = SDK.tabs.activeTab.id,
		tab_url = SDK.tabs.activeTab.url,
		tab_host = tabInfo.get(tab_id).host;

	Ghostery.panel.port.emit('panelData', {
		MOBILE_MODE: MOBILE_MODE,
		trackers: foundBugs.getApps(tab_id),
		tabId: tab_id,
		conf: conf.toJSON(),
		page: {
			url: tab_url,
			host: tab_host
		},
		whitelisted: whitelisted(tab_url),
		pauseBlocking: conf.paused_blocking,
		needsReload: (tabInfo.get(tab_id) ? tabInfo.get(tab_id).needsReload : 0),
		showTutorial: !prefs('panelTutorialShown'),
		validProtocol: (tab_url.indexOf('http') === 0),
		notScanned: !foundBugs.getApps(tab_id),
		language: conf.language
	});
}

function hidePanel(tab_id) {
	if (MOBILE_MODE) {
		var foundPanel = false,
			foundTab = (tab_id === undefined),
			tab, i;

		// for (i = 0; i < SDK.tabs.length; i++) {
		for each (tab in SDK.tabs) {
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

			if (foundPanel && foundTab) { return; }
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

	log('');
	log((block ? 'Blocked' : 'Found') + ' [%s] %s', type, src);
	log('^^^ Pattern ID %s on tab ID %s', bug_id, tab_id);

	if (conf.show_alert) {
		num_apps_old = foundBugs.getAppsCount(tab_id);
	}

	block = deets.block;
	foundBugs.update(tab_id, bug_id, src, block, type);

	updateButton(tab_id);

	if (block && conf.enable_click2play) {
		sendC2PData(tab_id, bugDb.db.bugs[bug_id].aid);
	}

	if (conf.show_alert) {
		if (!JUST_UPGRADED || upgrade_alert_shown) {
			if (tabInfo.get(tab_id) && tabInfo.get(tab_id).DOMLoaded) {
				if (foundBugs.getAppsCount(tab_id) > num_apps_old ||
					c2pDb.allowedOnce(tab_id, bugDb.db.bugs[bug_id].aid)) {
					showAlert(tab_id);
				}
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
		c2pApp = _.reject(c2pApp, function (c2pAppDef) {
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

	if (!tab_workers || !c2pDataArr) { return; }

	tab_workers.forEach(function (worker) {
		c2pDataArr.forEach(function (c2pData) {
			try {
				worker.port.emit('c2p', {
					c2pData: c2pData
				});
			} catch (e) {}
		});
	});

	delete Ghostery.tabWorkers[tab_id];
}

function showAlert(tab_id) {
	if (MOBILE_MODE) { return; }

	var apps;

	// the message has to be from the active tab of the active window
	if (utils.getTab(tab_id) != SDK.tabs.activeTab) {
		return;
	}

	apps = foundBugs.getApps(tab_id, true);
	if (apps && apps.length) {
		try {
			tabInfo.get(tab_id).worker.port.emit('show', {
				bugs: apps,
				alert_cfg: {
					pos_x: (conf.alert_bubble_pos.slice(1, 2) == 'r' ? 'right' : 'left'),
					pos_y: (conf.alert_bubble_pos.slice(0, 1) == 't' ? 'top' : 'bottom'),
					timeout: conf.alert_bubble_timeout
				},
				translations: {
					alert_bubble_tooltip: i18n.t('alert_bubble_tooltip'),
					alert_bubble_gear_tooltip: i18n.t('alert_bubble_gear_tooltip')
				}
			});
		} catch (e) {}
	}
}

function setIcon(active, tab_id) {
	var icon;

	if (MOBILE_MODE) {
		if (!tabInfo.get(tab_id).worker) { return; }
		icon = (active ? 'Icon-64.png' : 'Icon-64-off.png');
		tabInfo.get(tab_id).worker.port.emit('updateIcon', {
			icon: SDK.self.data.url('images/' + icon)
		});
	} else {
		icon = (active ? 'icon17.png' : 'icon17-off.png');
		Ghostery.button.setIcon(tab_id, SDK.self.data.url('images/' + icon));
	}
}

function setBadgeText(text, tab_id) {
	if (MOBILE_MODE) {
		if (!tabInfo.get(tab_id).worker) { return; }
		tabInfo.get(tab_id).worker.port.emit('updateBadge', {
			text: text
		});
	} else {
		Ghostery.button.setBadge(tab_id, (conf.show_badge ? text : null));
	}
}

function updateButton(tab_id) {
	if (!conf.show_button || (!MOBILE_MODE && Ghostery.activeTabs.indexOf(tab_id) < 0) || tab_id === null) { return; }

	// var tab = utils.getTab(tab_id);
	// if (!tab) { return; }
	
	var text = foundBugs.getAppsCount(tab_id),
		tab_url = tabInfo.get(tab_id).url;
	
	if (!foundBugs.getBugs(tab_id)) {
		// no cached bug discovery data:
		// * Ghostery was enabled after the tab started loading
		// * or, this is a tab Ghostery's onBeforeRequest doesn't run in (non-http/https page)
		text = '';
	}

	setBadgeText(text, tab_id);
	
	if (text || text === 0) {
		setIcon((!whitelisted(tab_url) && !conf.paused_blocking), tab_id);
	} else {
		setIcon(false, tab_id);
	}
}

// TODO GHOST-758 speed up
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

/**
 * Set unique IDs for existing tabs, set listener to add unique IDs to future tabs,
 * and set listener to execute page_info and click2play scannings on 'ready' (DOM loaded)
 * Precondition: tabs module must be loaded into var 'tabs'.
 */
function initTabIds() {
	// parse already existing tabs
	var i;
	for each (var tab in SDK.tabs) {
		tabInfo.create(tab.id, tab.url);
	}
	
	// add listener to append id to future tabs
	SDK.tabs.on('open', function (tab) {
		tabInfo.create(tab.id, tab.url);
	});
}

function detachWorker(tab_id) {
	['tabWorkers', 'c2pQueue'].forEach(function (name) {
		if (Ghostery[name].hasOwnProperty(tab_id)) {
			delete Ghostery[name][tab_id];
		}
	});
}

// TODO what are the shortcomings?
function clearTabData(tab_id) {
	log("♲ ♲ ♲ Clearing tab data for %d ♲ ♲ ♲", tab_id);

	detachWorker(tab_id);
	foundBugs.clear(tab_id);
	tabInfo.clear(tab_id);
}

function checkLibraryVersion() {
	// TODO this does not handle no response/404/bad JSON
	SDK.request.Request({
		url: Ghostery.VERSION_CHECK_URL,
		onComplete: function (r) {
			bugDb.update(r.json.bugsVersion);
			lsoDb.update(r.json.lsosVersion);
			c2pDb.update(r.json.click2playVersion);
			compDb.update(r.json.compatibilityVersion);
			tagDb.update(r.json.tagsVersion);
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

	for each (var tab in SDK.tabs) {
		tab_ids.push(tab.id);
	}

	[foundBugs, tabInfo].forEach(function (tabData) {
		_.keys(_.omit(tabData.getAll(), tab_ids)).forEach(function (tab_id) {
			clearTabData(tab_id);
		});
	});
}

function openTab(url, isExtPage, inNewWindow) {
	if (isExtPage) {
		url = SDK.self.data.url(url);
	}

	utils.getActiveTab(function (currentTab) {
		SDK.tabs.open({ url: url, onOpen: function (tab) {
			tab.index = currentTab.index;
		},
		inNewWindow: inNewWindow });

	});
}

SDK.timers.setInterval(autoUpdateBugDb, 1000 * 60 * 30); // every half hour
SDK.timers.setInterval(pruneTabData, 800000); // every eight minutes

init();
