/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* globals i18n, hashCode, renderTemplate, getTemplate, moment */

var Ghostery = Ghostery || {};

var t = i18n.t,
 settings;

function checkBackup() {
	var backup;

	var fileToLoad = document.getElementById("restore-file").files[0];

	var fileReader = new FileReader();
	fileReader.onload = function (fileLoadedEvent) {
		try {
			backup = JSON.parse(fileLoadedEvent.target.result);

			if (backup.hash !== hashCode(JSON.stringify(backup.settings))) {
				throw "Invalid hash";
			}

			settings = backup.settings;

			$("#restore-error").hide();
			$("#restore-button").show().prop("disabled", false);

		} catch (err) {
			$("#restore-error").show();
			$("#restore-button").hide().prop("disabled", true);
			return;
		}
	};
	fileReader.readAsText(fileToLoad, "UTF-8");
}

function restoreBackup() {
	if (!settings) {
		return;
	}

	$('#saving-options-notice-overlay').fadeIn({
		duration: 'fast',
		complete: function () {
			$('#saving-options-notice').css('visibility', 'visible');
		}
	});

	settings.conf.alert_bubble_timeout = +settings.conf.alert_bubble_timeout;
	window.setTimeout(function () {
		self.port.emit('restoreBackup', {prefs: settings.prefs, conf: settings.conf});
	}, 1500);
}

self.port.on('backupData', function (msg) {
	Ghostery.conf = msg.conf;
	Ghostery.MOBILE_MODE = msg.MOBILE_MODE;

	i18n.init(msg.conf.language);
	moment.lang(msg.conf.language.toLowerCase().replace('_', '-'));

	document.title = t('backup_page_title');

	$('#content').html(
		renderTemplate('backup', {
			_header: function (conf) {
				return renderTemplate('_header', conf);
			},
			_footer: getTemplate('_footer'),
			conf: Ghostery.conf,
			MOBILE_MODE: Ghostery.MOBILE_MODE
		})
	);

	$('#header-title').text(t('backup_page_title'));

	$("#backup-button").click(
		function () {
			self.port.emit('downloadBackup', {});
		})
	.prop("disabled", false);

	$("#restore-button").click(restoreBackup).prop("disabled", true);
	$("#restore-file").change(checkBackup);
});

self.port.emit('backupReady', {});
