/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var	Cc = require('chrome').Cc,
	Ci = require('chrome').Ci,
	_ =	require('vendor/underscore-1.4.3'),
	utils = require('utils');

this.db = {};

var UpdatableMixin = {

	_localFetcher: function () {
		var memory = utils.prefs(this.type),
			version_property = (this.type == 'bugs' ? 'version' : (this.type + 'Version'));

		// nothing in storage, or it's so old it doesn't have a version
		if (!memory || !memory.hasOwnProperty(version_property)) {
			// return what's on disk
			utils.log('fetching ' + this.type + ' from disk');
			return JSON.parse(utils.syncGet('databases/' + this.type + '.json'));
		}

		// on upgrades, see if bugs.json shipped w/ the extension is more recent
		if (this.just_upgraded) {
			var disk = JSON.parse(utils.syncGet('databases/' + this.type + '.json'));

			// when upgrading from a version with hash instead of timestamp, return disk
			if (typeof memory[this.type + 'Version'] !== 'number') {
				utils.log('fetching ' + this.type + ' from disk');
				return disk;
			}

			if (disk[version_property] > memory[version_property]) {
				utils.log('fetching ' + this.type + ' from disk');
				return disk;
			}
		}

		utils.log('fetching ' + this.type + ' from memory');
		return memory;
	},

	_downloadList: function (callback) {
		var UPDATE_URL = 'https://cdn.ghostery.com/update/' +
			(this.type == 'bugs' ? 'v2/bugs' : this.type);

		// TODO this does not handle no response/404/bad JSON
		try {
			var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);

			xhr.open('GET', UPDATE_URL, true);
			xhr.responseType = 'json';
			xhr.setRequestHeader("Cache-Control", "no-cache");
			xhr.onreadystatechange = function () {
				var list;

				if (xhr.readyState == 4 && xhr.status == 200) {
					list = xhr.response;

					if (list) { // success
						callback(true, list);
					} else { // error
						callback(false);
					}
				}
			};
			xhr.send();
		} catch (e) {
			callback(false);
		}
	},

	// asynchronous
	_remoteFetcher: function (callback) {
		utils.log('fetching ' + this.type + ' from remote');
		this._downloadList(callback);
	},

	// both fetchers return a bugs object to be processed
	// TODO strategy pattern?
	_loadList: function (options) {
		options = options || {};

		// synchronous
		// TODO make async for consistency w/ remote fetching
		if (!options.remote) {
			return this.processList(
				this._localFetcher()
			);
		}

		if (this.db.version && options.version && options.version == this.db.version) {
			// already up-to-date
			if (options.callback) {
				options.callback({
					'success': true,
					'updated': false
				});
			}

			return;
		}

		// asynchronous
		this._remoteFetcher(_.bind(function (result, list) {
			if (result && list) {
				result = this.processList(list);
			}

			if (result) {
				// note: only when fetching from ghostery.com
				utils.prefs(this.type + '_last_updated', (new Date()).getTime());
			}

			if (options.callback) {
				// TODO if we stop updating bugs_last_updated in the nothing changed case,
				options.callback({
					'success': result,
					'updated': (result ? true : false)
				});
			}
		}, this));
	},

	update: function (version, callback) {
		var opts = {
			remote: true,
			version: version,
			callback: callback
		};

		if (_.isFunction(version)) {
			opts.callback = version;
			delete opts.version;
		}

		this._loadList(opts);
	},

	init: function (just_upgraded) {
		this.just_upgraded = just_upgraded;
		return this._loadList();
	}
};

exports.load = UpdatableMixin;
