/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

var MOBILE_MODE = (require('sdk/system').platform.toLowerCase() == 'android'),
	globals = require('./globals'),
	Cc = require('chrome').Cc,
	Ci = require('chrome').Ci,
	SDK = {
		base64: require("sdk/base64"),
		file: require('sdk/io/file'),
		self: require('sdk/self'),
		storage: require('sdk/simple-storage').storage,
		timers: require('sdk/timers'),
		tabsLib: require('./custom-sdk/tabs/helpers'),
		tabs: require('sdk/tabs')
	};

// Android expection modules
if (MOBILE_MODE) {
	SDK.pb = null;
} else {
	SDK.pb = require('sdk/private-browsing');
}

exports.VERSION = SDK.self.version;

exports.log = function () {
	if (!globals.DEBUG) {
		return;
	}
	// convert arguments object to array
	var args = [].slice.call(arguments, 0);
	if (args[0]) {
		args[0] = (new Date()).toTimeString() + '\t\t' + args[0];
	}
	console.log.apply(console, args);
};

// convert old alert bubble settings
if (SDK.storage.alert_bubble_cfg) {
	var val = SDK.storage.alert_bubble_cfg;
	SDK.storage.alert_bubble_pos = val.slice(0, 2);
	SDK.storage.alert_bubble_timeout = +val.slice(2);
	delete SDK.storage.alert_bubble_cfg;
}

exports.prefs = function (key, value) {
	if (typeof value != 'undefined') {
		SDK.storage[key] = value;
	} else {
		return SDK.storage[key];
	}
};

// TODO replace with _.memoize
exports.syncGet = (function () {
	var memo = {};

	return function (url, memoize) {
		var result;

		if (memoize && memo.hasOwnProperty(url)) {
			return memo[url];
		}

		result = SDK.self.data.load(url);
		if (memoize) {
			memo[url] = result;
		}

		return result;
	};
}());

exports.fuzzyUrlMatcher = function (url, urls) {
	// TODO belongs in tabInfo
	var parsed = exports.processUrl(url),
		tab_host = parsed.host,
		tab_path = parsed.path;

	if (tab_host.indexOf('www.') === 0) {
		tab_host = tab_host.slice(4);
	}

	for (var i = 0; i < urls.length; i++) {
		parsed = exports.processUrl(urls[i]);
		var host = parsed.host,
			path = parsed.path;

		if (host != tab_host) {
			continue;
		}

		if (!path) {
			exports.log(`[fuzzyUrlMatcher] host (${host}) match`);
			return true;
		}

		if (path.slice(-1) == '*') {
			if (tab_path.indexOf(path.slice(0, -1)) === 0) {
				exports.log(`[fuzzyUrlMatcher] host (${host}) and path (${path}) fuzzy match`);
				return true;
			}

		} else {
			if (path == tab_path) {
				exports.log(`[fuzzyUrlMatcher] host (${host}) and path (${path}) match`);
				return true;
			}
		}
	}
};

exports.blockingLog = function blockingLog(msg, type, context, blockLogWorker) {
	if (!blockLogWorker || (SDK.pb && SDK.pb.isPrivate(context))) { return; }

	SDK.timers.setTimeout(function () {
		switch (type) {
		case 2:
			type = 'script';
			break;
		case 3:
			type = 'image';
			break;
		case 5:
			type = 'object';
			break;
		case 7:
			type = 'frame';
			break;
		case 12:
			type = 'sub-object';
			break;
		default:
			type = 'unknown-type';
			break;
		}

		msg = msg.replace('$TYPE$', type);
		try {
			blockLogWorker.port.emit('blockingLogUpdate', {
				blockingLog: msg
			});
		} catch (e) {}
	}, 1);
};

exports.getTabForContext = function (context) {
	// If it is the main frame
	if (context._contentWindow instanceof Ci.nsIDOMWindow) {
		return SDK.tabsLib.getTabForWindow(context._contentWindow.top);
	}

	if (!(context instanceof Ci.nsIDOMWindow)) {
		// If this is an element, get the corresponding document
		if (context instanceof Ci.nsIDOMNode && context.ownerDocument) {
			context = context.ownerDocument;
		}
		// Now we should have a document, get its window
		if (context instanceof Ci.nsIDOMDocument) {
			context = context.defaultView;
		} else {
			context = null;
		}
	}

	// If we have a window now - get the tab
	if (context) {
		return SDK.tabsLib.getTabForWindow(context.top);
	} else {
		return null;
	}
};

exports.getTabFromChannel = function (aChannel) {
	try {
		var notificationCallbacks = aChannel.notificationCallbacks ? aChannel.notificationCallbacks : aChannel.loadGroup.notificationCallbacks;
		if (!notificationCallbacks) {
			return null;
		}

		return SDK.tabsLib.getTabForWindow(notificationCallbacks.getInterface(Ci.nsIDOMWindow));
	} catch (e) {
		return null;
	}
};

exports.reloadTab = function (tab_id) {
	var tab = getTab(tab_id, function (tab) {
		tab.reload();
		return true;
	});

	if (!tab && SDK.tabs.activeTab) {
		SDK.tabs.activeTab.reload();
	}
};

exports.closeTab = function (tab) {
	// if its the only tab, open a blank tab
	if (SDK.tabs.length == 1) {
		SDK.tabs.open('');
	}

	tab.close();
};

function getTab(tab_id, callback) {
	var tab;

	for each (tab in SDK.tabs) {
		try {
			if ((tab.id) && (tab.id == tab_id)) {
				return (callback) ? callback(tab) : tab;
			}
		} catch (e) {
			// Re: https://getsatisfaction.com/ghostery/topics/5_1_0_does_not_fix_console_log_spamming
		}
	}

	return false;
}
exports.getTab = getTab;

exports.getActiveTab = function(callback) {
	if (SDK.tabs.activeTab) {
		callback(SDK.tabs.activeTab);
	}
};

function getBackupLocation() {
	var dirService = Cc['@mozilla.org/file/directory_service;1']
							.getService(Ci.nsIProperties),
		dir = dirService.get('ProfD', Ci.nsIFile);

	dir.append('jetpack');
	dir.append(SDK.self.id);
	dir.append('simple-storage');
	dir.append('store.json.bk');

	return dir;
}

exports.loadStorageBackup = function () {
	try {
		var backupLocation = getBackupLocation(),
			backupJson,
			setting;

		if (SDK.file.exists(backupLocation.path)) {
			var stream = SDK.file.open(backupLocation.path, "r");

			if (!stream.closed) {
				backupJson = JSON.parse(stream.read());

				for (setting in backupJson) {
					SDK.storage[setting] = backupJson[setting];
				}

				stream.close();
			}
		} else {
			// Create backup if it doesn't exist, otherwise people updating
			// won't have a backup until they trigger forceSave
			exports.forceSave();
		}
	} catch (e) {
		exports.log('[loadStorageBackup] exception ' + e);
	}
};

exports.forceSave = function () {
	try {
		var backupLocation = getBackupLocation(),
			stream = SDK.file.open(backupLocation.path, "w");

		try {
			stream.write(JSON.stringify(SDK.storage));
		} catch (err) {}

		stream.close();
	} catch (e) {
		exports.log('[forceSave] exception ' + e);
	}
};

// TODO review applicability to lib/conf
exports.defineLazyProperty = function (o, name, fun) {
	var value,
		isSet = false;

	Object.defineProperty(o, name, {
		get: function () {
			if (!isSet) {
				value = fun();
				isSet = true;
			}

			return value;
		},

		set: function (v) {
			value = v;
			isSet = true;
		}
	});
};

exports.processUrl = function (src) {
	var q,
		r,
		anchor,
		src_host,
		src_path,
		src_cleaned,
		src_protocol = '';

	// strip out the hash
	q = src.indexOf('#');
	if (q >= 0) {
		anchor = src.slice(q + 1);
		src = src.slice(0, q);
	}

	// strip out the querystring, including the ?, to reduce false positives
	q = src.indexOf('?');
	if (q >= 0) {
		src = src.slice(0, q);
	}

	// original src without querystring and hash
	src_cleaned = src;

	// strip out the scheme
	q = src.indexOf('http://');
	if (q === 0) {
		src_protocol = src.substr(0, 4);
		src = src.slice(7);
	} else {
		q = src.indexOf('https://');
		if (q === 0) {
			src_protocol = src.substr(0, 5);
			src = src.slice(8);
		} else {
			// protocol-relative URLs
			q = src.indexOf('//');
			if (q === 0) {
				src = src.slice(2);
			}
		}
	}

	src = src.toLowerCase();

	q = src.indexOf('/');

	// check for @ in host, http://google.com:xxx@evil.com will show as google.com otherwise
	r = src.indexOf("@");

	if (r >= 0 && (q === -1 || r < q)) {
		src = src.slice(r + 1);
		// grab '/' loc again since the src changed
		q = src.indexOf('/');
	}

	// host should be everything from the start until the first "/"
	src_host = (q >= 0 ? src.substr(0, q) : src);
	// path should be everything after the first "/"
	src_path = (q >= 0 ? src.substr(q + 1) : '');

	// remove port from src_host
	q = src_host.indexOf(':');
	if (q >= 0) {
		src_host = src_host.substr(0, q);
	}

	return {
		protocol: src_protocol,
		host: src_host,
		path: src_path,
		host_with_path: src,
		anchor: anchor,
		// NOTE: special case required by ghostrank where we keep
		// original casing and strip out querystring and hash
		host_with_path_cleaned: src_cleaned
	};
};

exports.decodeJwt = function(token) {
	var segments = token.split('.');

	if (segments.length !== 3) {
		return null;
	}

	// All segment should be base64
	var headerSeg = segments[0];
	var payloadSeg = segments[1];
	var signatureSeg = segments[2];

	// base64 decode and parse JSON
	var header = JSON.parse(SDK.base64.decode(headerSeg, "utf-8"));
	var payload = JSON.parse(SDK.base64.decode(payloadSeg, "utf-8"));

	return {
		header: header,
		payload: payload,
		signature: signatureSeg
	};
};
