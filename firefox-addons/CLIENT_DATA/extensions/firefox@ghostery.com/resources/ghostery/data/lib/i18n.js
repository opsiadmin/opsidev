/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* global syncGet, _ */
/* jshint unused: false */

var i18n = (function () {
	var exports = {},
		current_language,
		messages;

	// note: these have to match languages in lib/vendor/moment/lang
	// after lowercasing and replacing _ with -
	var SUPPORTED_LANGUAGES = {
		'de': "Deutsch",
		'en': "English",
		'en_GB': "British English",
		'es': "Español",
		'fr': "Français",
		'it': "Italiano",
		'ja': "日本語",
		'ko': "한국어",
		'nl': "Nederlands",
		'pl': "Polski",
		'ru': "Русский",
		'zh_CN': "繁體中文",
		'zh_TW': "简体中文"
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
				messages = syncGet('locales/' + locales.pop() + '/messages.json');
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

		// TODO debugging/easter egg (morse?)
		/*
		return msg.replace(/./g, (function () {
			var in_tag = false,
				keep = ['<', '>', ' ', '\n', '\t'];
			return function (s) {
				if (s == '<') {
					in_tag = true;
				} else if (s == '>') {
					in_tag = false;
				}
				return (in_tag || keep.indexOf(s) >= 0 ? s : 'x');
			};
		}()));
		*/
		return msg;
	}

	// TODO
	// globally support t() in Underscore templates
	/*
	(function () {
		var _template = _.template;

		function template(text, data, settings) {
			if (data) {
				_.extend(data, {
					t: t
				});
				return _template(text, data, settings);
			}

			var template_function = _template(text, data, settings);
			return function (data) {
				data = _.extend({}, data, {
					t: t
				});
				return template_function(data);
			};
		}

		_.mixin({
			template: template
		});
	}());
	*/

	exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
	exports.init = function (lang) {
		if (current_language != lang) {
			current_language = lang;
			messages = getMessages(lang);
		}
	};
	exports.t = t;

	return exports;
})();

i18n.init('en');
var t = i18n.t;
