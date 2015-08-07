/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* NOTE: ANY NEW EXPORTS ADDED HERE SHOULD HAVE A MOCK ADDED IN THE lib/BUTTON.js */

/* jshint ignore:start */


const prefs = require('ghostery/utils').prefs;

const Cc = require('chrome').Cc;
const Ci = require('chrome').Ci;
const SDK = {
	runtime: require('sdk/system/runtime'),
	winUtils: require('sdk/window/utils'),
	tabsLib: require('sdk/tabs/helpers'),
	unload: require('sdk/system/unload')
};

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var browserURL = "chrome://browser/content/browser.xul";
if (require('sdk/system/xul-app').name == 'SeaMonkey') {
	browserURL = "chrome://navigator/content/navigator.xul";
}

var options = {},
 button_id ='ghostery-button-container';

// array for listener nuking
var listeners = [],
// array for storing window ids already populated
 buttonedWindows = [];

function create(window, opts) {
	options = opts;
	let doc = window.document;
	let $ = function(id) doc.getElementById(id);

	// create() currently runs on every tab activation since window events are not working at this time.
	// Because of the above, we need to check if button is already present for this window
	// TODO: alternatively, we could add a prop to this level and just check that as a flag...
	var util = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
	var windowID = util.outerWindowID;

	if (buttonedWindows.indexOf(windowID) == -1) {
		// new window, proceed with adding stuph
		buttonedWindows.push(windowID);
	} else {
		// window has been handled before through a different tab, exit;
		return;
	}

	// create toolbar button
	let tbb = doc.createElementNS(NS_XUL, "toolbarbutton");
	let tbbContainer = doc.createElementNS(NS_XUL, "toolbaritem");
	let tbbStack = doc.createElementNS(NS_XUL, "stack");
	let tbbBadge = doc.createElementNS(NS_XUL, "label");

	tbbBadge.setAttribute('id', "ghostery-button-badge");
	var binding =
		'<bindings xmlns="http://www.mozilla.org/xbl">' +
			'<binding id="id">' +
				'<resources>' +
					'<stylesheet src="' + options.stylesheet + '"/>' +
				'</resources>' +
			'</binding>' +
		'</bindings>';

	tbbBadge.style.MozBinding = 'url("data:text/xml;charset=utf-8,' + doc.defaultView.encodeURIComponent(binding) + '")';

	tbbContainer.setAttribute("id", button_id);
	tbbContainer.setAttribute("label", options.label);
	tbbContainer.setAttribute('tooltiptext', options.tooltiptext);
	tbb.setAttribute("id", "ghostery-button");
	tbb.setAttribute("type", "button");
	tbb.setAttribute("image", options.image);
	tbb.setAttribute("label", options.label);
	tbb.setAttribute("class", "toolbarbutton-1");

	tbb.addEventListener("command", function() {
		options.onCommand({}); // TODO: provide something?
		options.panel.show(tbbContainer);
	}, true);

	tbbBadge.addEventListener("click", function() {
		options.onCommand({}); // TODO: provide something?
		options.panel.show(tbbContainer);
	}, true);

	positionBadge(tbbBadge);

	// append button and badge to stack
	tbbStack.appendChild(tbb);
	tbbStack.appendChild(tbbBadge);
	// append stack to the button container
	tbbContainer.appendChild(tbbStack);

	// add toolbarbutton to palette
	try {
		var inPalette = ($("navigator-toolbox") || $("mail-toolbox")).palette.getElementsByAttribute( 'id', button_id );

		if (inPalette.length == 0) {
			($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(tbbContainer);
		}
	} catch (e) { }

	// find a toolbar to insert the toolbarbutton into
	var toolbar = $('nav-bar');
	if (prefs('badgeLocation')) {
		var toolbar = $(prefs('badgeLocation'));
	}

	if (toolbar === 'hidden') {
		// toolbar is set to hidden which means user removed the icon
		return;
	}

	if (require('sdk/system/xul-app').name == 'SeaMonkey') {
		toolbar = $('nav-bar');
	}

	if (!toolbar) {
		var toolbar = toolbarbuttonExists(doc, button_id);
	}

	// found a toolbar to use?
	if (toolbar) {
		let b4;

		// find the toolbarbutton to insert before
		if (prefs('badgeLocationInsertBefore')) {
			b4 = $(prefs('badgeLocationInsertBefore'));
		}

		if (!b4) {
			let currentset = toolbar.getAttribute("currentset").split(",");
			let i = currentset.indexOf(button_id) + 1;

			// was the toolbarbutton id found in the curent set?
			if (i > 0) {
				let len = currentset.length;
				// find a toolbarbutton to the right which actually exists
				for (; i < len; i++) {
					b4 = $(currentset[i]);
					if (b4) break;
				}
			}
		}

		toolbar.insertItem && toolbar.insertItem(button_id, b4, null, false);
		toolbar.setAttribute("currentset", toolbar.currentSet);

		try {
			// adding keyset
			var keyset = doc.createElement('keyset'), keyelem = doc.createElement('key');
			keyset.id = 'ghostery-keyset';

			keyelem.setAttribute('id', 'ghostery-finder-key');
			keyelem.setAttribute('oncommand', "void(0);");
			keyelem.addEventListener("command", function() { tbb.click(); }, true);

			keyelem.setAttribute('key', 'g');
			keyelem.setAttribute('modifiers', 'alt control');

			keyset.appendChild(keyelem);
			$('main-window').appendChild(keyset);
		} catch (err) {
			// wrong main window.
		}

		doc.persist(toolbar.id, "currentset");
	}

	var saveNodeInfo = function(e) {
		toolbarID = tbbContainer.parentNode.getAttribute("id") || "";
		insertbefore = (tbbContainer.nextSibling || "")
			&& tbbContainer.nextSibling.getAttribute("id").replace(/^wrapper-/i, "");

		var doc = e.target.ownerDocument,
		 badge = doc.getElementById(button_id);

		if (!!badge) {
			// if badge is present, save the current toolbar
			prefs('badgeLocation', badge.parentElement.id);

			if (badge.nextSibling) {
				prefs('badgeLocationInsertBefore', badge.nextSibling.id);
			} else {
				prefs('badgeLocationInsertBefore', false);
			}
		} else {
			prefs('badgeLocationInsertBefore', false);
			prefs('badgeLocation', 'hidden');
		}
	};

	window.addEventListener("aftercustomization", saveNodeInfo, false);
	listeners.push(saveNodeInfo);

	window.addEventListener('close', function() {
		try {
			tbbContainer.parentNode.removeChild(tbbContainer);
			window.removeEventListener("aftercustomization", saveNodeInfo, false);
		} catch (e) {
			// tripped when window never had successful container injecttion
		}
	});
}

function toolbarbuttonExists(doc, id) {
	var toolbars = doc.getElementsByTagNameNS(NS_XUL, "toolbar");

	for (var i = toolbars.length - 1; ~i; i--) {
		if ((new RegExp("(?:^|,)" + id + "(?:,|$)")).test(toolbars[i].getAttribute("currentset")))
			return toolbars[i];
	}

	return false;
}

function positionBadge(buttonBadge) {
	var os = SDK.runtime.OS,
	 right,
	 bottom;

	switch (os) {
		case 'Darwin':
			right = '-5';
			bottom = '-5';
			break;
		case 'WINNT':
			right = '-1';
			bottom = '3';
			break;
		case 'Linux':
			right = '-3';
			bottom = '0';
			break;
		default:
			right = '-5';
			bottom = '-5';
	}

	buttonBadge.setAttribute('right', right);
	buttonBadge.setAttribute('bottom', bottom);
}

exports.moveTo = function(toolbarID) {
	// change the current position for open windows
	for (var window in SDK.winUtils.windows(null, { includePrivate: true })) {
		window = SDK.winUtils.windows(null, { includePrivate: true })[window];

		if (browserURL != window.location) return;

		let doc = window.document;
		let $ = function (id) doc.getElementById(id);

		// if it is already in the window, abort
		if ($(button_id)) return;

		var tb = $(toolbarID),
		 b4;

		// find the toolbarbutton to insert before
		if (prefs('badgeLocationInsertBefore')) {
			b4 = $(prefs('badgeLocationInsertBefore'));
		}

		if (tb) {
			tb.insertItem(button_id, b4, null, false);
			tb.setAttribute("currentset", tb.currentSet);
			doc.persist(tb.id, "currentset");

			// save where it was moved to
			prefs('badgeLocation', toolbarID);
		}
	}
}

exports.setIcon = function(tab_id, pathToImage) {
	for (var window in SDK.winUtils.windows(null, { includePrivate: true })) {
		window = SDK.winUtils.windows(null, { includePrivate: true })[window];

		if (browserURL != window.location) { continue; }
		if (tab_id != SDK.tabsLib.getTabForWindow(window.content).id) { continue; }

		var button = window.document.getElementById('ghostery-button');

		if (!button) { continue; }
		button.setAttribute('image', pathToImage);
	}
}

exports.setBadge = function (tab_id, value) {
	for (var window in SDK.winUtils.windows(null, { includePrivate: true })) {
		window = SDK.winUtils.windows(null, { includePrivate: true })[window];

		if (browserURL != window.location) { continue; }
		if (tab_id != SDK.tabsLib.getTabForWindow(window.content).id) { continue; }

		var badge = window.document.getElementById('ghostery-button-badge');
		if (!badge) { continue; }

		if (value || value == '0') {
			badge.style.visibility = 'visible';
			badge.style.display = '';
		} else {
			badge.style.visibility = 'hidden';
			badge.style.display = 'none';
		}

		badge.setAttribute('value', value);
	}
}

exports.create = create;

function remove() {
	for (var window in SDK.winUtils.windows(null, { includePrivate: true })) {
		window = SDK.winUtils.windows(null, { includePrivate: true })[window];

		let doc = window.document;
		let $ = function(id) doc.getElementById(id);
		try {
			var container = $(button_id);


			if (!container) { continue; }

			// removing button
			container.parentNode.removeChild(container);

			// removing palette entries
			var inPalette = ($("navigator-toolbox") || $("mail-toolbox")).palette.getElementsByAttribute( 'id', button_id );
			if (inPalette.length == 1) {
				($("navigator-toolbox") || $("mail-toolbox")).palette.removeChild(inPalette[0]);
			}

			// removing listeners
			for (var i = 0; i < listeners.length; i++) {
				window.removeEventListener("aftercustomization", listeners[i], false);
			}
		} catch (e) {
			console.log(e.toString());
			// tripped when window never had successful container injection
		}
	}

	listeners = [];
}

exports.remove = remove;

// Unloader.
SDK.unload.when(remove);
