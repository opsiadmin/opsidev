/* global $ */
function mark(el) {
	if (el) {
		var buttons = el.getElementsByTagName('span');
		for (var i = 0; i < buttons.length; i++) {
			if (buttons[i].className == 'installed-button') {
				buttons[i].style.setProperty('display', 'block');
				continue;
			}

			buttons[i].style.setProperty('display', 'none');
		}
		el.className += " success";
		// don't want to inline install (like for Chrome)
		el.removeAttribute('onclick');
	}
}

function toggleBlocking(blocked, duration) {
	// TODO background-position-x doesn't work in FF
	if (!blocked) {
		$('#app-global-blocking').animate({ 'background-position-x': '-17px' }, {
			duration: duration,
			complete: function () {
				$(this).removeClass('blocked').addClass('unblocked');
				$(this).parent().removeClass('blocked').addClass('unblocked');
			}
		});
	} else {
		$('#app-global-blocking').animate({ 'background-position-x': '3px' }, {
			duration: duration,
			complete: function () {
				$(this).removeClass('unblocked').addClass('blocked');
				$(this).parent().removeClass('unblocked').addClass('blocked');
			}
		});
	}
}

var old_top_img = document.getElementById('img_dl_top'),
	old_bottom_img = document.getElementById('img_dl_bottom');

// old front page
if (old_top_img && old_bottom_img) {
	old_top_img.src = '/images/downloadGhostery1_installed.png';
	old_bottom_img.src = '/images/downloadGhostery2_blank.png';

	// don't want to inline install (like for Chrome)
	old_top_img.parentNode.removeAttribute('onclick');
	old_bottom_img.parentNode.removeAttribute('onclick');

} else {
	// new nav bar
	// note that ghostery_download_top is on both new and old sites (on the front page of the old site)
	var download_header = document.getElementById('ghostery_download_top');
	if (download_header) {
		mark(download_header.getElementsByTagName('button')[0]);
	}

	// new front page
	var new_front_page = document.getElementById('ghostery_download_button');
	if (new_front_page) {
		mark(new_front_page.getElementsByTagName('button')[0]);
	}

	// both new and old download pages
	mark(document.getElementById('firefox-dl-link'));
}

var $ghosteryBox = $("#ghosterybox");

if ($ghosteryBox.length === 1) {
	var $appGlobalBlocking = $("#app-global-blocking"),
		$blockingBox = $("#blockingbox"),
		app_id = $blockingBox.data('id'),
		tooltipTimeout,
		sendMessage = function (name, msg) {
			self.port.emit(name, msg);
		};

	sendMessage("appsPageLoaded", { id: app_id });

	self.port.on('appsPageData', function (msg) {
		var blocked = msg.blocked;

		$ghosteryBox.hide();
		$blockingBox.show();

		toggleBlocking(blocked, 0);

		$appGlobalBlocking.on("click", function () {
			blocked = !blocked;

			sendMessage("panelSelectedAppsUpdate", { app_id: app_id, app_selected: blocked });

			$('#global-blocking-control')
				.tooltip('destroy')
				.tooltip({
					trigger: 'manual',
					title: 'Tracker ' + (blocked ? 'blocked' : 'unblocked'),
					placement: 'bottom'
				})
				.tooltip('show');

			window.clearTimeout(tooltipTimeout);
			tooltipTimeout = window.setTimeout(function () {
				$('#global-blocking-control').tooltip('destroy');
			}, 1400);

			toggleBlocking(blocked, 'fast');
		});
	});
}
