var Ci = require('chrome').Ci,
	Cc = require('chrome').Cc,
	SDK = {
		storage: require('sdk/simple-storage').storage
	},
	utils = require('utils.js'),
	conf = require('conf');

var ghostery = {};

ghostery.conf = conf.load;

ghostery.cleaner = {
	cleanup: function () {
		var start = new Date();
		try { ghostery.lso.cleanupLso(); } catch (e) {}
		try { ghostery.silverlight.cleanupSilverlight(); } catch (e) {}
		utils.log('Completed in: ' + (new Date() - start) + 'ms\n\n\n');
	}
};

ghostery.cleaner.SystemHelper = {
	osName: null,

	nsiFile: function (f) {
		try {
			var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
			file.initWithPath(f);
			return file;
		} catch (err) {
			return null; // TODO file doesn't exist, generally
		}
	},
	
	unlink: function (f, recursive) {
		var file = this.nsiFile(f);
		if (file.exists()) {
			file.remove(recursive);
		}
	},
	
	fileEnumerator: function (f) {
		var file = this.nsiFile(f);
		if (file && file.exists() && file.isDirectory()) {
			return file.directoryEntries;
		}
		return null;
	},
	
	exists: function (f) {
		var file = this.nsiFile(f);
		if (file === null) {
			return false;
		}
		return file.exists();
	},
	
	getDir: function (dir) {
		var dirService = Cc['@mozilla.org/file/directory_service;1']
							.getService(Ci.nsIProperties);
		var dirFile = dirService.get(dir, Ci.nsIFile); // returns an nsIFile object
		return dirFile.path;
	},

	homeDir: function () {
		return this.getDir('Home');
	},

	appDataDir: function () {
		return this.getDir('AppData');
	},
	
	isMac: function () {
		return ((this.os() !== null && this.os().match(/Darwin/)));
	},
	
	isWindows: function () {
		return ((this.os() !== null && this.os().match(/WINNT/)));
	},
	
	isLinux: function () {
		return ((this.os() !== null && this.os().match(/Linux/)));
	},
	
	// Returns "WINNT" on Windows
	// "Linux" on GNU/Linux; and "Darwin" on Mac OS X.
	//
	// NOTE: May also include Version # on older versions of FF/SeaMonkey
	os: function () {
		if (this.osName !== null) {
			return this.osName;
		}
		try {
			this.osName = Cc['@mozilla.org/xre/app-info;1']
								.getService(Ci.nsIXULRuntime).OS;
		} catch (err) {
			// use alternate method for older versions of FF/SeaMonkey
			this.osName = Cc['@mozilla.org/network/protocol;1?name=http']
								.getService(Ci.nsIHttpProtocolHandler).oscpu;
			
		}
		return this.osName;
	}
}; // SystemHelper

ghostery.cleaner.PathHelper = function PathHelper() {
	this.list = [];
};

ghostery.cleaner.PathHelper.prototype = {
	add: function (p) {
		if (ghostery.cleaner.SystemHelper.exists(p)) {
			this.list.push(p);
		}
	},
	addAll: function (p, ex) {
		// ex: regex pattern of files/directories to exclude from the list
		
		var re = (ex === null ? null : new RegExp(ex));
		
		var en = ghostery.cleaner.SystemHelper.fileEnumerator(p);
		if (en === null) {
			return;
		}
		var f;
		while (en.hasMoreElements() && (f = en.getNext())) {
			f.QueryInterface(Ci.nsIFile);
			if (re === null || !re.test(f.path)) {
				this.add(f.path);
			}
			if (f.isDirectory()) {
				this.addAll(f.path, ex);
			}
			
		}
	}
}; // PathHelper

ghostery.lso = {
	cleanupLso: function () {
		var paths = this.getLsoPaths(),
			filtered = this.filterBlockedPaths(paths),
			i, len;
		for (i = 0, len = filtered.length; i < len; i++) {
			utils.log('[flash] deleting: ' + filtered[i]);
			ghostery.cleaner.SystemHelper.unlink(filtered[i], true);
		}
	},
	
	filterBlockedPaths: function (paths) {
		var i, len;
		var matches = [];
		for (i = 0, len = paths.length; i < len; i++) {
			var p = paths[i];
			// extract the basename (host)
			var b = p.replace(/^.*[\/\\]/g, '');
			if (b.charAt(0) == '#') {
				b = b.substr(1);
			}
			var lsoId = isLso(b);
			console.log(b + '\t' + lsoId);
			if (!lsoId) {
				continue;
			}
			var block = SDK.storage.selected_lsos_app_ids.hasOwnProperty(SDK.storage.lsodb.lsos[lsoId].aid);
			if (block) {
				matches.push(p);
			}
		}
		return matches;
	},


	getLsoPaths: function () {
		if (ghostery.cleaner.SystemHelper.isMac()) {
			return this.getMacLsoPaths();
		
		} else if (ghostery.cleaner.SystemHelper.isLinux()) {
			return this.getLinuxLsoPaths();
			
		} else if (ghostery.cleaner.SystemHelper.isWindows()) {
			return this.getWindowsLsoPaths();
			
		}
		var paths = new ghostery.cleaner.PathHelper();
		return paths.list;
	},
	
	getMacLsoPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		var localPrefs = ghostery.cleaner.SystemHelper.getDir('LocPrfs');

		// enumerate paths in here and add each to list, except special ##
		var sys = localPrefs + '/Macromedia/Flash Player/macromedia.com/support/flashplayer/sys/';
		paths.addAll(sys, '##');
		paths.addAll(sys + '##/');

		// enumerate all the dirs under SharedObjects
		this.enumerateSubDir(paths, localPrefs + '/Macromedia/Flash Player/#SharedObjects/');
		
		var userPrefs = ghostery.cleaner.SystemHelper.getDir('UsrPrfs');

		// enumerate paths in here and add each to list, except special ##
		sys = userPrefs + '/Macromedia/Flash Player/macromedia.com/support/flashplayer/sys/';
		paths.addAll(sys, '##');
		paths.addAll(sys + '##/');

		// enumerate all the dirs under SharedObjects
		this.enumerateSubDir(paths, userPrefs + '/Macromedia/Flash Player/#SharedObjects/');

		return paths.list;
	},

	getLinuxLsoPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		var home = ghostery.cleaner.SystemHelper.homeDir();

		// enumerate all the dirs under SharedObjects
		this.enumerateSubDir(paths, home + '/.macromedia/Flash_Player/#SharedObjects/');

		return paths.list;
	},
	
	getWindowsLsoPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		var data = ghostery.cleaner.SystemHelper.appDataDir();

		// Windows XP, 7, 8
		this.enumerateSubDir(paths, data + '\\Macromedia\\Flash Player\\#SharedObjects\\');
		paths.addAll(data + '\\Macromedia\\Flash Player\\macromedia.com\\support\\flashplayer\\sys\\');

		return paths.list;
	},

	enumerateSubDir: function (paths, dir) {
		var en = ghostery.cleaner.SystemHelper.fileEnumerator(dir);
		if (en === null) {
			return paths;
		}

		var f;
		while (en.hasMoreElements() && (f = en.getNext())) {
			f.QueryInterface(Ci.nsIFile);
			if (f.isDirectory()) {
				paths.addAll(f.path);
			}
		}
	}
};
 
ghostery.silverlight = {
	linux: false,

	cleanupSilverlight: function () {
		var paths = this.getSilverlightPaths(),
			filtered = this.filterBlockedPaths(paths),
			i, len;

		for (i = 0, len = filtered.length; i < len; i++) {
			utils.log('[silverlight] deleting: ' + filtered[i]);
			ghostery.cleaner.SystemHelper.unlink(filtered[i], true);
		}
	},

	filterBlockedPaths: function (paths) {
		var idfile = '/' + this.idFilename();
		if (ghostery.cleaner.SystemHelper.isWindows()) { idfile = '\\' + this.idFilename(); }

		var i, len;
		var matches = [];
		for (i = 0, len = paths.length; i < len; i++) {
			var p = paths[i];
			var id = this.readId(p + idfile);
			var lsoId = isLso(id);
			if (!lsoId) { continue; }
			var block = SDK.storage.selected_lsos_app_ids.hasOwnProperty(SDK.storage.lsodb.lsos[lsoId].aid);
			if (block) {
				matches.push(p);
			}
		}

		return matches;
	},

	readId: function (file) {
		var istream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
		istream.init(ghostery.cleaner.SystemHelper.nsiFile(file), 0x01, 444, 0);
		istream.QueryInterface(Ci.nsILineInputStream);

		var line = {},
			matches;

		istream.close();

		if (this.linux) {
			matches = line.value.match(/^URI = (.*)$/);
			return matches[1];
		} else {
			return line.value;
		}
	},
	
	idFilename: function () {
		return (ghostery.cleaner.SystemHelper.isLinux() ? 'config' : 'id.dat');
	},

	getSilverlightPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		if (ghostery.cleaner.SystemHelper.isMac()) {
			return this.getMacSilverlightPaths();
		} else if (ghostery.cleaner.SystemHelper.isLinux()) {
			this.linux = true;
			return this.getLinuxSilverlightPaths();
		} else if (ghostery.cleaner.SystemHelper.isWindows()) {
			return this.getWindowsSilverlightPaths();
		}

		return paths.list;
	},

	// tested with Silverlight Version 3.0 (3.0.40818.0) on Mac OS X 10.6.2
	getMacSilverlightPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		var home = ghostery.cleaner.SystemHelper.homeDir();

		var is = home + '/Library/Application Support/Microsoft/Silverlight/is/';
		this.findSilverlightPaths(this.idFilename(), paths, is);

		return paths.list;
	},

	getLinuxSilverlightPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		var home = ghostery.cleaner.SystemHelper.homeDir();

		var is = home + '/.local/share/moonlight/is/';
		this.findSilverlightPaths(this.idFilename(), paths, is);

		return paths.list;
	},

	getWindowsSilverlightPaths: function () {
		var paths = new ghostery.cleaner.PathHelper();
		var home = ghostery.cleaner.SystemHelper.appDataDir();

		// Windows XP, 7, 8
		var is = home + '\\..\\LocalLowData\\Microsoft\\Silverlight\\is\\';
		this.findSilverlightPaths(this.idFilename(), paths, is);

		return paths.list;
	},

	/**
	 * Recursively searches path 'p', adding all directories containing the
	 * file idfile the paths list.
	 *
	 * Windows/Mac: idfile = id.dat
	 * Linux (Moonlight): idfile = config
	 */
	findSilverlightPaths: function (idfile, paths, p) {
		var en = ghostery.cleaner.SystemHelper.fileEnumerator(p);
		if (en === null) {
			return;
		}

		var f;
		while (en.hasMoreElements() && (f = en.getNext())) {
			f.QueryInterface(Ci.nsIFile);
			if (f.isFile()) {
				var b = f.path.replace(/^.*[\/\\]/g, '');
				if (b.toLowerCase() == idfile) {
					paths.add(p);
					return;
				}
			} else if (f.isDirectory()) {
				this.findSilverlightPaths(idfile, paths, f.path);
			}
		}
	}
};

function isLso(src) {
	var i,
		id,
		priorities = ['high', 'regular', 'low'],
		regexes;

	if (!SDK.storage.lsodb.fullRegex.test(src)) {
		return false;
	}

	for (i = 0; i < priorities.length; i++) {
		regexes = SDK.storage.lsodb.regexes[priorities[i]];

		for (id in regexes) {
			// TODO remove all the hasOwnProperty checks since they are prob. slowing us down a little and we don't actually need them here
			if (regexes.hasOwnProperty(id)) {
				// TODO testing the entire src string is inaccurate; test domain part only?
				if (regexes[id].test(src)) {
					return id;
				}
			}
		}
	}

	return false;
}

exports.cleanup = ghostery.cleaner.cleanup;