/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

// TODO require.js modularize
// TODO unit tests
// TODO generalize into a helper/mixin (?) that equips objects with getters/setters

// Returns a conf object that acts as a write-through cache.
//
// All conf properties are backed by getters and setters,
// which lets us transparently persistent to localStorage on update.
//
// Conf properties that are not arrays or objects contain their default value
// in the defaults object, and are persisted in localStorage (without JSON
// stringifying/parsing) under the same name.
//
// Conf properties that are arrays or objects (used as hashes) require an
// object in the defaults object containing the following functions:
//
// 1. init(): Called once on property initialization. Responsible for reading
// from localStorage if there is something there.
//
// 2. save(value): Called every time the property gets updated. Responsible for
// saving the value to localStorage and calling whatever else needs to happen.

var
	SDK = {
		timers: require('sdk/timers'),
		ls: require('sdk/simple-storage').storage
	},
	utils = require('./utils'),
	dispatcher = require('./dispatcher'),
	prefs = utils.prefs,
	i18n = require('./i18n'),
	_ =	require('vendor/underscore-1.4.3');
	
// Underscore.js shim since the window object is not available on BG
// (used by setTimeout/clearTimeout)
_.debounce = function (func, wait, immediate) {
	var timeout;
	return function () {
		var context = this, args = arguments;
		var later = function () {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};
		if (immediate && !timeout) {
			func.apply(context, args);
		}
		SDK.timers.clearTimeout(timeout);
		timeout = SDK.timers.setTimeout(later, wait);
	};
};

function getDefaultLanguage() {
	var lang = i18n.getLanguage().replace('-', '_');

	if (i18n.SUPPORTED_LANGUAGES.hasOwnProperty(lang)) {
		return lang;
	}

	lang = lang.slice(0, 2);
	if (i18n.SUPPORTED_LANGUAGES.hasOwnProperty(lang)) {
		return lang;
	}

	return 'en';
}

// Firefox: force SS save.
var forceSave = _.debounce(function () {
	utils.forceSave();
}, 60 * 1000);

var conf = (function loadConf() {
	var ret = {},
		_values = {},
		defaults = {
			selected_app_ids: {
				init: function () {
					var ids = {};
					// legacy variable name: it actually stores app IDs
					if (prefs('selected_app_ids') !== undefined) {
						ids = prefs('selected_app_ids');
					} else {
						prefs('selected_app_ids', {});
					}

					return ids;
				},

				save: function (v) {
					prefs('selected_app_ids', v);
					dispatcher.trigger('conf.save.selected_app_ids', _.clone(v));
				}
			},
			
			selected_lsos_app_ids: {
				init: function () {
					var ids = {};
					// legacy variable name: it actually stores app IDs
					if (prefs('selected_lsos_app_ids') !== undefined) {
						ids = prefs('selected_lsos_app_ids');
					} else {
						prefs('selected_lsos_app_ids', {});
					}

					return ids;
				},

				save: function (v) {
					prefs('selected_lsos_app_ids', v);

					if (SDK.ls.lsodb) {
						var num_selected = _.size(v);
						SDK.ls.bugdb.noneSelected = (num_selected === 0);
						SDK.ls.bugdb.allSelected = (num_selected && num_selected == _.size(SDK.ls.lsodb.apps));
					}
				}
			},

			site_whitelist: {
				init: function () {
					var whitelist = [];
					if (prefs('site_whitelist') !== undefined) {
						try {
							whitelist = prefs('site_whitelist');
						} catch (e) {}
					} else {
						prefs('site_whitelist', whitelist);
					}
					
					return whitelist;
				},

				save: function (v) {
					prefs('site_whitelist', v);
					dispatcher.trigger('conf.save.site_whitelist');
				}
			},

			language: {
				init: function () {

					var lang = prefs('language');
					if (lang) {
						return lang;
					}
					return getDefaultLanguage();
				},
				save: function (v) {
					var saved_lang = prefs('language');
					// if we haven't saved language before, save only if the language changed
					// this way we can still pick up system language changes
					if (saved_lang || v != getDefaultLanguage()) {
						prefs('language', v);
					}
				}
			},
			
			site_specific_unblocks: {
				init: function () {
					var selections = {};
					if (prefs('site_specific_unblocks') !== undefined) {
						try {
							selections = prefs('site_specific_unblocks');
						} catch (e) {}
					} else {
						prefs('site_specific_unblocks', selections);
					}
					
					return selections;
				},

				save: function (v) {
					prefs('site_specific_unblocks', v);
				}
			},
			
			user_bugs: {
				init: function () {
					var userBugs = [];
					if (prefs('user_bugs') !== undefined) {
						try {
							userBugs = prefs('user_bugs');
						} catch (e) {}
					} else {
						prefs('user_bugs', userBugs);
					}
					
					return userBugs;
				},

				save: function (v) {
					prefs('user_bugs', v);
				}
			},

			// note: not persisted
			paused_blocking: {
				init: function () {
					prefs('paused_blocking', false);
					return false;
				},

				save: function (v) {
					prefs('paused_blocking', v);
					dispatcher.trigger('conf.save.paused_blocking');
				}
			},

			// TODO right now object/array change monitoring is tied to customizing loading and saving, but it shouldn't be?
			alert_bubble_pos: 'br',
			alert_bubble_timeout: 15,

			ignore_first_party: (prefs('ignore_first_party') !== undefined ? prefs('ignore_first_party') : true),
			enable_autoupdate: (prefs('enable_autoupdate') !== undefined ? prefs('enable_autoupdate') : true),
			ghostrank: (prefs('ghostrank') !== undefined ? prefs('ghostrank') : false),
			show_alert: (prefs('show_alert') !== undefined ? prefs('show_alert') : true),
			auto_dismiss_bubble: (prefs('auto_dismiss_bubble') !== undefined ? prefs('auto_dismiss_bubble') : true),
			expand_sources: (prefs('expand_sources') !== undefined ? prefs('expand_sources') : false),
			block_by_default: (prefs('block_by_default') !== undefined ? prefs('block_by_default') : false),
			notify_library_updates: (prefs('notify_library_updates') !== undefined ? prefs('notify_library_updates') : false),
			enable_click2play: (prefs('enable_click2play') !== undefined ? prefs('enable_click2play') : true),
			enable_click2play_social: (prefs('enable_click2play_social') !== undefined ? prefs('enable_click2play_social') : true),
			block_images: (prefs('block_images') !== undefined ? prefs('block_images') : true),
			block_frames: (prefs('block_frames') !== undefined ? prefs('block_frames') : true),
			block_objects: (prefs('block_objects') !== undefined ? prefs('block_objects') : true),
			dom_scanner: (prefs('dom_scanner') !== undefined ? prefs('dom_scanner') : true),
			prevent_redirection: (prefs('prevent_redirection') !== undefined ? prefs('prevent_redirection') : true),
			delete_fl_sl_cookies: (prefs('delete_fl_sl_cookies') !== undefined ? prefs('delete_fl_sl_cookies') : false),
			db_last_updated: (prefs('db_last_updated') !== undefined ? prefs('db_last_updated') : ''),
			show_button: (prefs('show_button') !== undefined ? prefs('show_button') : true),
			show_badge: (prefs('show_badge') !== undefined ? prefs('show_badge') : true),
			show_tutorial: (prefs('show_tutorial') !== undefined ? prefs('show_tutorial') : true),
			xul_panel: (prefs('xul_panel') !== undefined ? prefs('xul_panel') : false)
		};

	_.each(defaults, function (sval, sname) {
		if (_.isObject(sval)) { // complex preference
			// initial value
			var val = sval.init();
			// TODO do we need to clone here (and clone twice)?
			_values[sname] = {
				current: _.clone(val),
				old: JSON.parse(JSON.stringify(val))
			};

			// waits 200 ms to check if we need to trigger the setter
			// throttled to run only once at the end of frequent updates/fetches
			var check_for_changes = _.debounce(function () {
				var v = _values[sname];

				//log('checking old vs. new for %s ...', sname);

				if (!_.isEqual(v.current, v.old)) {
					//log('change detected for %s', sname);

					// trigger the setter
					ret[sname] = v.current;
				}
			}, 200);

			// getter and setter
			Object.defineProperty(ret, sname, {
				get: function () {
					//log('getter for %s', sname);

					// Can't have a catchall setter on all properties, but we
					// need to detect changes in the array/object made through
					// subscript access (o[i] = true), array methods,
					// and deletes (for objects).

					// TODO replace w/ proxies when they land in V8?
					check_for_changes();

					return _values[sname].current;
				},
				set: function (v) {
					//log('setter for %s', sname);

					// TODO do we need to clone here?
					_values[sname].current = v;
					// NOTE this is used to simulate a deep-clone.
					// Will not work with functions, RegExp, etc.
					_values[sname].old = JSON.parse(JSON.stringify(v));
					sval.save(v);

					// Firefox: force SS save.
					forceSave();
				}
			});

		} else { // simple preference
			// initial value
			// NOTE: can't store falsy values with this
			_values[sname] = prefs('' + sname) || sval;
			prefs('' + sname, _values[sname]);

			// getter and setter
			Object.defineProperty(ret, sname, {
				get: function () {
					return prefs('' + sname);
				},
				set: function (v) {
					// NOTE: no JSON.stringify
					prefs('' + sname, v);
					_values[sname] = v;
				}
			});
		}
	});

	// support stringifying (so that at least conf values can be used via
	// message passing in Safari (no direct access to the bg page))
	ret.toJSON = function () {
		return _.reduce(_values, function (memo, val, key) {
			// complex preferences contain their value in val.current
			memo[key] = _.isObject(val) ? val.current : val;
			return memo;
		}, {});
	};

	return ret;
})();

exports.load = conf;
