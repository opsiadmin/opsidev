/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* global t, renderTemplate */

(function () {
	$(document).ready(function () {
		document.title = t('block_log_page_title');
		$('#block_log').text(t('block_log_title'));
		$('#clear span').text(t('block_log_clear'));
		$('#close span').text(t('block_log_close'));
		$('body').append(renderTemplate('_footer'));
	});

	$('#block-box').height($(window).innerHeight() - 300);

	$('#clear').click(function () {
		$('#block-box').val('');
	});

	$('#close').click(function () {
		self.port.emit('close');
	});

	self.port.on('blockingLogUpdate', function (msg) {
		$('#block-box').val($('#block-box').val() + msg.blockingLog + '\n');
	});

	$(window).unload(function () {
		self.port.emit('clearBlockingLog');
	});
})();
