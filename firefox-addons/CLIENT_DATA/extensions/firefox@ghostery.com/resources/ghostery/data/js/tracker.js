/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

$('#a').click(
	function () {
		var tracker = {};

		tracker.type = $('#t').val();
		tracker.pattern = $('#p').val();
		tracker.name = $('#n').val();
		tracker.priority = $('#pr').val();
		tracker.id = $('#id').val();
		tracker.aid = $('#aid').val();
		tracker.cid = $('#cid').val();
		tracker.affiliation = '';
		tracker.db = ($('#dbUser').attr('checked') == 'checked' ? $('#dbUser').val() : $('#dbMain').val());

		self.port.emit('newTracker', {tracker: tracker});
	}
);
