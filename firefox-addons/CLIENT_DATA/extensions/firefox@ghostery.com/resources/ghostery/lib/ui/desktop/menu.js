/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
	t = require('ghostery/i18n').t,
	browserURL = "chrome://browser/content/browser.xul",
	menuAnchor = 'menu_ToolsPopup',
	SDK = {
		self: require('sdk/self'),
		winUtils: require('sdk/deprecated/window-utils'),
		windows: require('sdk/windows').browserWindows,
		tabs: require('sdk/tabs')
	};

if (require('sdk/system/xul-app').name == 'SeaMonkey') {
	browserURL = "chrome://navigator/content/navigator.xul";
	menuAnchor = 'taskPopup';
}


function remove() {
	for (var window in SDK.winUtils.windowIterator()) {
		if (browserURL != window.location) { continue; }
		if (!window.document.getElementById('ghostery-tools-menu')) { continue; } // skip if it does not exist
		var menu = window.document.getElementById('ghostery-tools-menu');
		menu.parentNode.removeChild(menu);
	}
}

function add() {
	for (var window in SDK.winUtils.windowIterator()) {
		if (browserURL != window.location) { continue; }
		if (window.document.getElementById('ghostery-tools-menu')) { continue; } // skip if it has already been added

		var doc = window.document,
			toolsMenuPopup = doc.getElementById(menuAnchor),
			menu = doc.createElementNS(NS_XUL, 'menu'),
			menuPopup = doc.createElementNS(NS_XUL, 'menupopup'),
			menuItemsIds = ['menu-options', 'setup-wizard', 'database-update', 'block-log', 'help', 'share', 'blog'],
			i;

		if (!toolsMenuPopup) { continue; }

		// set menu attributes
		menu.setAttribute('id', 'ghostery-tools-menu');
		menu.setAttribute('image', SDK.self.data.url('images/icon19.png'));
		menu.setAttribute('label', t('firefox_tools_menu_label'));
		menu.setAttribute('class', 'menuitem-iconic menu-iconic');

		// set menupopup attributes
		menuPopup.setAttribute('id', 'ghostery-tools-menu-options');

		/* jshint loopfunc: true */
		for (i = 0; i < menuItemsIds.length; i++) {
			var menuItem = doc.createElementNS(NS_XUL, 'menuitem'),
				id = menuItemsIds[i],
				separator;

			// common attributes
			menuItem.setAttribute('class', 'menuitem-iconic menu-iconic');
			menuItem.setAttribute('id', 'ghostery-' + id);

			separator = false; // add a separator after menuitem?

			switch (id) {
			case 'menu-options':
				menuItem.setAttribute('label', t('firefox_tools_menu_options'));
				menuItem.setAttribute('accesskey', 'M');
				menuItem.setAttribute('image', SDK.self.data.url('images/menu/customize-16x16.gif'));
				menuItem.addEventListener('command', function () {
					SDK.tabs.open(SDK.self.data.url('options.html'));
				});
				break;
			case 'setup-wizard':
				menuItem.setAttribute('label', t('firefox_tools_menu_walkthorugh'));
				menuItem.setAttribute('accesskey', 'W');
				menuItem.addEventListener('command', function () {
					SDK.tabs.open(SDK.self.data.url('walkthrough.html'));
				});
				break;
			case 'database-update':
				menuItem.setAttribute('label', t('firefox_tools_menu_database_update'));
				menuItem.setAttribute('accesskey', 'U');
				menuItem.addEventListener('command', function () {
					SDK.tabs.open(SDK.self.data.url('options.html#update-now'));
				});
				break;
			case 'block-log':
				menuItem.setAttribute('label', t('firefox_tools_menu_block_log'));
				menuItem.setAttribute('accesskey', 'L');
				menuItem.addEventListener('command', function () {
					SDK.tabs.open(SDK.self.data.url('block_log.html'));
				});
				break;
			case 'help':
				menuItem.setAttribute('label', t('firefox_tools_menu_help'));
				menuItem.setAttribute('accesskey', 'H');
				menuItem.setAttribute('image', SDK.self.data.url('images/menu/help-16x16.png'));
				menuItem.addEventListener('command', function () {
					SDK.tabs.open(SDK.self.data.url('options.html#about'));
				});
				separator = true;
				break;
			case 'share':
				menuItem.setAttribute('label', t('firefox_tools_menu_share'));
				menuItem.setAttribute('accesskey', 'S');
				menuItem.setAttribute('image', SDK.self.data.url('images/menu/share-16x16.png'));
				menuItem.addEventListener('command', function () {
					SDK.tabs.open('http://www.ghostery.com/share');
				});
				separator = true;
				break;
			case 'blog':
				menuItem.setAttribute('label', t('firefox_tools_menu_blog'));
				menuItem.setAttribute('accesskey', 'B');
				menuItem.addEventListener('command', function () {
					SDK.tabs.open('http://news.ghostery.com/');
				});
				break;
			}

			menuPopup.insertBefore(menuItem, null);
			if (separator) {
				menuPopup.insertBefore(doc.createElementNS(NS_XUL, 'menuseparator'), null);
			}
		}
		/* jshint loopfunc: false */

		menu.insertBefore(menuPopup, null);

		var children = toolsMenuPopup.children,
			insert = false,
			beforeChild = null;

		for (i = 0; i < children.length; i++) {
			var child = children[i];
			if (insert) {
				beforeChild = child;
				break;
			}

			if (child.getAttribute('id') == 'devToolsSeparator') {
				insert = true;
			}

		}

		toolsMenuPopup.insertBefore(menu, beforeChild);
	}
}

exports.add = add;
exports.remove = remove;

// Attaches menu to new (future) windows
SDK.windows.on('open', function () {
	add();
});