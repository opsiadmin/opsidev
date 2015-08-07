/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* global __templates, _, Ghostery, apprise, t */
/* jshint unused: false */

function log() {
	if (!window.ls.debug) {
		return;
	}
	// convert arguments object to array
	var args = [].slice.call(arguments, 0);
	if (args[0]) {
		args[0] = (new Date()).toTimeString() + '\t\t' + args[0];
	}
	console.log.apply(console, args);
}

// TODO replace with _.memoize
var syncGet = (function () {
	var memo = {};

	return function (url, memoize) {
		var xhr,
			result;

		if (memoize && memo.hasOwnProperty(url)) {
			return memo[url];
		}

		xhr = new XMLHttpRequest();
		xhr.open('GET', url, false);
		xhr.send(null);
		result = xhr.responseText;

		if (memoize) {
			memo[url] = result;
		}

		return result;
	};
}());

// returns the template as a reusable function
function getTemplate(name) {
	return __templates[name];
}

// returns the template's contents in a string
function renderTemplate(name, config) {
	config = config || {};
	return getTemplate(name)(config);
}

// Modified code from: http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
// Used for checking the hash of the backup file, easy validation check
function hashCode(str) {
	var hash = 0,
		character,
		i;

	if (str.length === 0) {
		return hash;
	}

	for (i = 0; i < str.length; i++) {
		character = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + character; // jshint ignore:line
		hash = hash & hash; // jshint ignore:line
	}

	return hash;
}

function createLink(href, text, class_name, title) {
	var link = document.createElement('a');
	link.href = href;
	link.target = '_blank';
	if (class_name) {
		link.className = class_name;
	}
	if (title) {
		link.title = title;
	}
	link.appendChild(document.createTextNode(text));
	return link;
}

function createCheckbox(id, checked, class_name) {
	var check = document.createElement('input');
	check.type = 'checkbox';
	if (checked !== undefined) {
		check.checked = !!checked;
	}
	if (class_name) {
		check.className = class_name;
	}
	check.id = id;
	return check;
}

function getMessages() {
	var lang = window.navigator.language,
		locales = [],
		messages = '';

	// order matters
	// 'en' messages.json is the guaranteed fallback
	if (lang.slice(0, 2) != 'en') {
		locales.push('en');
	}
	if (lang.length > 2) {
		locales.push(lang.slice(0, 2));
	}
	locales.push(lang);

	while (!messages && locales.length) {
		try {
			messages = syncGet('locales/' + locales.pop() + '/messages.json');
		} catch (e) {}
	}

	return JSON.parse(messages);
}

function checkAddonCompatibility() {
	var addons = '';
	if (!Ghostery.incompatibleAddons) { return; }
	
	Ghostery.incompatibleAddons.forEach(function (addon) {
		addons += ', ' + addon;
	});

	addons = addons.substring(2);
	apprise(t('addon_compatibility_warning_firefox', addons), {
		textOk: t('button_ok')
	});
}

// use Mustache.js-style template tags
//_.templateSettings = {
//	evaluate:		/{{(.+?)}}/g,
//	interpolate:	/{{=(.+?)}}/g,
//	escape:			/{{-(.+?)}}/g
//};
