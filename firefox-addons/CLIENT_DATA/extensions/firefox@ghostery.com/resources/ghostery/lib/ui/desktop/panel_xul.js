/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
	t = require('ghostery/i18n').t,
	Ghostery = {
		conf: require('ghostery/conf').load
	},
	SDK = {
		self: require('sdk/self'),
		winUtils: require('sdk/window/utils'),
		windows: require('sdk/windows').browserWindows,
		tabs: require('sdk/tabs'),
		timers: require('sdk/timers')
	},
	window, // jshint ignore:line
	doc,
	popupSet,
	menuPopup;

exports.port = {
	on: function () {},
	emit: function (msg, data) {

		window = SDK.winUtils.getMostRecentBrowserWindow(); // jshint ignore:line
		doc = window.document;
		popupSet = doc.getElementById('mainPopupSet');

		menuPopup = doc.getElementById('ghostery-xul-panel');
		if (!menuPopup) {
			menuPopup = doc.createElementNS(NS_XUL, 'menupopup');
			menuPopup.setAttribute('id', 'ghostery-xul-panel');
		}
		menuPopup.innerHTML = '';

		var anchor = doc.getElementById('ghostery-button') || null,
			header = doc.createElementNS(NS_XUL, 'toolbarbutton');

		if (!data.validProtocol || !data.trackers) {
			header.setAttribute('label', t('panel_title_not_scanned'));
		} else if (data.trackers.length === 0) {
			header.setAttribute('label', t('panel_no_trackers_found'));
		} else {
			if (data.trackers.length == 1) {
				header.setAttribute('label', t('panel_title_singular'));
			} else {
				header.setAttribute('label', t('panel_title_plural', data.trackers.length || 0));
			}
		}

		header.setAttribute('image', SDK.self.data.url('images/icon19.png'));

		// this strips default styling
		header.style.setProperty('-moz-appearance', 'none');

		header.style.setProperty('background-color', '#330033');
		header.style.setProperty('color', '#eee');
		header.style.setProperty('font-size', '14px');
		header.style.setProperty('margin', '0 0 3px 0');

		menuPopup.appendChild(header);
		displayApps(data.trackers, data.page);
		addStaticButtons(data.page);

		popupSet.appendChild(menuPopup);

		// TODO
		//var originalXBL = "chrome://global/content/bindings/menu.xml#menu";
		//var binding =
		//	'<bindings xmlns="http://www.mozilla.org/xbl">' +
		//		'<binding id="id" extends="' + originalXBL + '">' +
		//			'<resources>' +
		//				'<stylesheet src="' + SDK.self.data.url('css/xulPanel.css') + '"/>' +
		//			'</resources>' +
		//		'</binding>' +
		//	'</bindings>';
		//menuPopup.style.MozBinding = 'url("data:text/xml;charset=utf-8,' + doc.defaultView.encodeURIComponent(binding) + '")';

		if (!menuPopup.openPopup) {
			SDK.timers.setTimeout(function () {
				menuPopup.openPopup(anchor, 'bottomright', 0, 25);
			}, 150);
		} else {
			menuPopup.openPopup(anchor, 'bottomright', 0, 25);
		}
	}
};

function displayApps(trackers, page) {
	if (!trackers) { return; }

	var tracker,
		sortable = [],
		i, j,
		blocked,
		tab_host = page.host;

	for (i in trackers) {
		sortable.push(trackers[i]);
	}

	if (sortable.length > 1) {
		sortable.sort(function (a, b) {
			var aName = a.name.toLowerCase();
			var bName = b.name.toLowerCase();
			return aName > bName ? 1 : aName < bName ? -1 : 0;
		});
	}

	trackers = sortable;

	/* jshint loopfunc: true */
	for (i = 0; i < trackers.length; i++) {
		tracker = trackers[i];
		
		var app = doc.createElementNS(NS_XUL, 'menu');
		app.setAttribute('label', tracker.name);

		blocked = Ghostery.conf.selected_app_ids.hasOwnProperty(tracker.id) &&
				(!Ghostery.conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
					Ghostery.conf.site_specific_unblocks[tab_host].indexOf(+tracker.id) == -1);

		// Set style
		if (blocked) {
			app.style.setProperty('color', '#aaa');
			app.style.setProperty('font-style', 'italic');
			app.addEventListener('mouseover', function () {
				this.style.setProperty('color', '#fff');
			}, false);
			app.addEventListener('mouseout', function () {
				this.style.setProperty('color', '#aaa');
			}, false);
		}

		var appSub = doc.createElementNS(NS_XUL, 'menupopup');

		appSub.style.setProperty('max-width', '300px');

		app.appendChild(appSub);

		appSub.appendChild(generateTrackerMoreInfo(tracker));

		appSub.appendChild(doc.createElementNS(NS_XUL, 'menuseparator'));

		for (j = 0; j < tracker.sources.length; j++) {
			appSub.appendChild(generateTrackerSource(tracker, tracker.sources[j]));
		}

		appSub.appendChild(doc.createElementNS(NS_XUL, 'menuseparator'));

		appSub.appendChild(generateTrackerBlockControl(tracker));

		appSub.appendChild(generateTrackerSiteSpecificUnblockControl(tracker, page.host));

		menuPopup.appendChild(app);
	}
	/* jshint loopfunc: false */

	menuPopup.appendChild(doc.createElementNS(NS_XUL, 'menuseparator'));
}

function generateTrackerBlockControl(tracker) {
	var appBlock = doc.createElementNS(NS_XUL, 'menuitem'),
		blocked = Ghostery.conf.selected_app_ids.hasOwnProperty(tracker.id);

	appBlock.setAttribute('type', 'checkbox');
	appBlock.setAttribute('checked', blocked);
	appBlock.setAttribute('label', t('xul_panel_block_firefox', tracker.name));
	appBlock.addEventListener('command', function () {
		updateBlockingOption({
			type: 'selected_app_ids',
			value: blocked ? false : 1,
			anchorId: tracker.id
		});
	}, false);

	return appBlock;
}

function generateTrackerSiteSpecificUnblockControl(tracker, tab_host) {
	var appSiteSpecificUnblock = doc.createElementNS(NS_XUL, 'menuitem'),
		blocked =
			(!Ghostery.conf.site_specific_unblocks.hasOwnProperty(tab_host) ||
				Ghostery.conf.site_specific_unblocks[tab_host].indexOf(+tracker.id) == -1);

	appSiteSpecificUnblock.setAttribute('type', 'checkbox');
	appSiteSpecificUnblock.setAttribute('checked', !blocked);
	appSiteSpecificUnblock.setAttribute('label', t('xul_panel_site_specific_unblock_firefox'));
	appSiteSpecificUnblock.addEventListener('command', function () {
		updateBlockingOption({
			type: 'site_specific_unblocks',
			value: blocked,
			host: tab_host,
			app_id: tracker.id
		});
	}, false);

	return appSiteSpecificUnblock;
}

function generateTrackerMoreInfo(tracker) {
	var appMoreInfo = doc.createElementNS(NS_XUL, 'menuitem');
	
	// Set attributes
	appMoreInfo.setAttribute('label', t('panel_tracker_what_is_more_info', tracker.name));
	appMoreInfo.addEventListener('command', function () {
		SDK.tabs.open({
			url: 'https://www.ghostery.com/apps/' +
				encodeURIComponent(tracker.name.replace(/\s+/g, '_').toLowerCase())
		});
	}, false);

	// Set styling rules
	appMoreInfo.addEventListener('mouseover', function () {
		this.style.setProperty('color', '#fff');
	}, false);
	appMoreInfo.addEventListener('mouseout', function () {
		this.style.setProperty('color', '#0000ff');
	}, false);
	appMoreInfo.style.setProperty('color', '#0000ff');
	appMoreInfo.style.setProperty('text-decoration', 'underline');
	appMoreInfo.style.setProperty('cursor', 'pointer');

	return appMoreInfo;
}

function generateTrackerSource(tracker, source) {
	var appSrc = doc.createElementNS(NS_XUL, 'menu'),
		appSrcSub = doc.createElementNS(NS_XUL, 'menupopup'),
		appSrcView = doc.createElementNS(NS_XUL, 'menuitem');

	// Set source attributes
	appSrc.setAttribute('label', source.src);
	appSrc.setAttribute('tooltiptext', source.src);
	
	// Set 'view source' link attributes
	appSrcView.setAttribute('label', t('xul_panel_view_source_firefox'));
	appSrcView.addEventListener('command', function () {
		SDK.tabs.open({
			url: 'https://www.ghostery.com/gcache/?n=' +
				window.encodeURIComponent(window.btoa(tracker.name)) +
				'&s=' +
				window.encodeURIComponent(window.btoa(source.src))
		});

		hide();
	}, false);

	appSrc.appendChild(appSrcSub);

	appSrcSub.appendChild(appSrcView);

	return appSrc;
}

function addStaticButtons(page) {
	var buttons = {
			pauseBlocking: doc.createElementNS(NS_XUL, 'menuitem'),
			whitelistSite: doc.createElementNS(NS_XUL, 'menuitem'),
			options: doc.createElementNS(NS_XUL, 'menuitem'),
			share: doc.createElementNS(NS_XUL, 'menuitem'),
			update: doc.createElementNS(NS_XUL, 'menuitem'),
			feedback: doc.createElementNS(NS_XUL, 'menuitem'),
			about: doc.createElementNS(NS_XUL, 'menuitem')
		},
	i = 1;

	buttons.pauseBlocking.setAttribute('label', t('panel_button_pause_blocking'));
	buttons.pauseBlocking.setAttribute('type', 'checkbox');
	buttons.pauseBlocking.setAttribute('checked', Ghostery.conf.paused_blocking);
	buttons.pauseBlocking.addEventListener('command', function () {
		updateBlockingOption({
			type: 'paused_blocking',
			value: !Ghostery.conf.paused_blocking
		});
	}, false);

	buttons.whitelistSite.setAttribute('label', t('panel_button_whitelist_site'));
	buttons.whitelistSite.setAttribute('type', 'checkbox');
	buttons.whitelistSite.setAttribute('checked', whitelisted(page.url));
	buttons.whitelistSite.addEventListener('command', function () {
		updateBlockingOption({
			type: 'site_whitelist',
			value: !whitelisted(page.url),
			anchorId: page.host
		});
	}, false);

	buttons.options.setAttribute('label', t('panel_settings_options'));
	buttons.options.addEventListener('command', function () {
		SDK.tabs.open({
			url: SDK.self.data.url('options.html')
		});
	}, false);

	buttons.share.setAttribute('label', t('panel_settings_share'));
	buttons.share.addEventListener('command', function () {
		SDK.tabs.open({
			url: 'http://www.ghostery.com/share'
		});
	}, false);

	buttons.update.setAttribute('label', t('firefox_tools_menu_database_update'));
	buttons.update.addEventListener('command', function () {
		SDK.tabs.open({
			url: SDK.self.data.url('options.html#update-now')
		});
	}, false);

	buttons.feedback.setAttribute('label', t('panel_settings_feedback'));
	buttons.feedback.addEventListener('command', function () {
		SDK.tabs.open({
			url: 'http://www.ghostery.com/feedback'
		});
	}, false);

	buttons.about.setAttribute('label', t('panel_settings_support'));
	buttons.about.addEventListener('command', function () {
		SDK.tabs.open({
			url: SDK.self.data.url('options.html#about')
		});
	}, false);

	for (var button in buttons) {
		menuPopup.appendChild(buttons[button]);

		if (i == 4 || i == 5) {
			menuPopup.appendChild(doc.createElementNS(NS_XUL, 'menuseparator'));
		}

		i++;
	}
}

function updateBlockingOption(options) {
	if (!options.type) { return; }
	
	if (options.type == 'site_whitelist') {
		if (options.value) {
			Ghostery.conf.site_whitelist.push(options.anchorId);
		} else {
			Ghostery.conf.site_whitelist.splice(Ghostery.conf.site_whitelist.indexOf(options.anchorId), 1);
		}

		// updateButton(SDK.tabs.activeTab ? SDK.tabs.activeTab.id : null);
	} else if (options.type == 'paused_blocking') {
		Ghostery.conf.paused_blocking = options.value;
		// updateButton(SDK.tabs.activeTab ? SDK.tabs.activeTab.id : null);
	} else if (options.type == 'selected_app_ids') {
		if (options.value) {
			Ghostery.conf.selected_app_ids[options.anchorId] = 1;
		} else if (options.value === false) {
			delete Ghostery.conf.selected_app_ids[options.anchorId];
		}

	} else if (options.type == 'site_specific_unblocks') {
		var app_id = options.app_id,
			host = options.host;

		if (!options.value) {
			if (Ghostery.conf.site_specific_unblocks.hasOwnProperty(host) && Ghostery.conf.site_specific_unblocks[host].indexOf(app_id) >= 0) {
				Ghostery.conf.site_specific_unblocks[host].splice(Ghostery.conf.site_specific_unblocks[host].indexOf(app_id), 1);

				if (Ghostery.conf.site_specific_unblocks[host].length === 0) {
					delete Ghostery.conf.site_specific_unblocks[host];
				}
			}
		} else {
			if (!Ghostery.conf.site_specific_unblocks.hasOwnProperty(host)) {
				Ghostery.conf.site_specific_unblocks[host] = [];
			}

			if (Ghostery.conf.site_specific_unblocks[host].indexOf(app_id) == -1) {
				Ghostery.conf.site_specific_unblocks[host].push(app_id);
			}
		}

	} else if (options.type == 'show_tutorial') {
		Ghostery.conf.show_tutorial = false;
	}
}

function whitelisted(url) {
	var i, numSites = Ghostery.conf.site_whitelist.length;

	for (i = 0; i < numSites; i++) {
		// TODO match from the beginning of the string to avoid false matches (somewhere in the querystring for instance)
		if (url.indexOf(Ghostery.conf.site_whitelist[i]) >= 0) {
			return true;
		}
	}

	return false;
}

exports.Panel = function () {
	return exports;
};

// Shimmed functions
function show() {}
exports.show = show;

function hide()  {}
exports.hide = hide;

function resize()  {}
exports.resize = resize;