/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var SDK = {
		locale: require('sdk/l10n/locale')
	},
	_ = require('underscore'),
	utils = require('./utils'),
	current_language,
	messages;

// note: these have to match languages in lib/vendor/moment/lang
// after lowercasing and replacing _ with -
var SUPPORTED_LANGUAGES = {
	'cs': "čeština",
	'da': "dansk",
	'de': "Deutsch",
	'el': "ελληνικά",
	'en': "English",
	'en_GB': "British English",
	'es': "español",
	'fi': "suomi",
	'fr': "Français",
	'hu': "magyar",
	'it': "Italiano",
	'ja': "日本語",
	'ko': "한국어",
	'nn_NO': "Norsk",
	'nl': "Nederlands",
	'pl': "Polski",
	'pt_BR': "português",
	'ru': "Русский",
	'sv': "Svenska",
	'tr': "Türkçe",
	'zh_CN': "简体中文",
	'zh_TW': "繁體中文"
};

function getMessages(lang) {
	var locales = [],
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
			messages = utils.syncGet('locales/' + locales.pop() + '/messages.json');
		} catch (e) {}
	}

	return JSON.parse(messages);
}

// our version of Chrome's chrome.i18n.getMessage()
// TODO find this in Chromium's source
// string arg1: message name
// *arg2: substitute values for placeholders
function t() {
	var translation = messages[arguments[0]],
		placeholders = translation && translation.placeholders || {},
		substitutions = _.flatten(Array.prototype.slice.call(arguments, 1)),
		substitutor = function (match) {
			var sub = substitutions[+match.slice(1) - 1];
			return (sub === undefined) ? '' : sub;
		};

	if (!translation) {
		// TODO see what Jose did in Ff (warn about missing keys, warn about mismatched placeholders)
		return arguments[0];
	}

	var msg = translation.message;

	for (var name in placeholders) {
		if (!placeholders.hasOwnProperty(name)) {
			continue;
		}
		// find all the $PLACEHOLDER$ strings and replace with placeholder
		// content strings, where $1, $2, etc. are first replaced with
		// substitution values passed to t()
		msg = msg.replace(
			// TODO name escaping?
			new RegExp('\\$' + name + '\\$', 'gi'),
			placeholders[name].content.replace(/\$\d/g, substitutor)
		);
	}

	return msg;
}

function getLanguage() {
	return SDK.locale.getPreferedLocales()[0];
}

exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
exports.init = function (lang) {
	if (current_language != lang) {
		current_language = lang;
		messages = getMessages(lang);
	}
};
exports.t = t;
exports.getLanguage = getLanguage;
