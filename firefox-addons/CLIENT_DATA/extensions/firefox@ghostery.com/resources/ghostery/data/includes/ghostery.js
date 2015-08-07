/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

// TODO slim down as much as possible
(function () {

	var ALERT_DISMISSED = false,
		ALERT_ID = id(),
		// Needs to evaluate to true initially, setting to random number
		ALERT_TIMER = 9999,
		CSS_INJECTED = false,
		// all_frames is false in the page-mod
		//IS_FRAME = (win.top != win),
		ALERT_TRANSLATIONS = {},
		NOTIFICATION_TRANSLATIONS = {},
		UPGRADE_ALERT_SHOWN = false,
		doc = document,
		sendMessage = function (name, msg) {
			self.port.emit(name, msg);
		};

	function id() {
		var s = '';
		while (s.length < 32) {
			s += Math.random().toString(36).replace(/[^A-Za-z]/g, '');
		}
		return s;
	}

	function createEl(type) {
		return doc.createElement(type);
	}

	function br() {
		return createEl('br');
	}

	// break tags with our styling have no height in FF only, use hr
	function hr() {
		return createEl('hr');
	}

	// arguments: parentElement, *childElements
	function appendChild(parent) {
		for (var i = 1; i < arguments.length; i++) {
			parent.appendChild(arguments[i]);
		}
	}

	function injectCSS() {
		var style = createEl('style'),
			imp = ' !important;',
			reset = 'padding:0;margin:0;font:13px Arial,Helvetica;text-transform:none;font-size: 100%;vertical-align:baseline;line-height:normal;color:#fff;';

		style.textContent =
			'@-webkit-keyframes pop' + ALERT_ID + ' {' +
				'50% {' +
					'-webkit-transform:scale(1.2);' +
				'}' +
				'100% {' +
					'-webkit-transform:scale(1);' +
				'}' +
			'}' +
			'@keyframes pop' + ALERT_ID + ' {' +
				'50% {' +
					'-webkit-transform:scale(1.2);' +
					'transform:scale(1.2);' +
				'}' +
				'100% {' +
					'-webkit-transform:scale(1);' +
					'transform:scale(1);' +
				'}' +
			'}' +

			'#' + ALERT_ID + '{' +
				reset +
				'border:solid 2px #fff' + imp +
				'color:#fff' + imp +
				'display:block' + imp +
				'height:auto' + imp +
				'margin:0' + imp +
				'opacity:0.9' + imp +
				'padding:7px 10px' + imp +
				'position:fixed' + imp +
				'visibility:visible' + imp +
				'width:auto' + imp +
				'z-index:2147483647' + imp +
				// TODO should we switch to non-prefixed ones?
				'-moz-border-radius:5px' + imp +
				'border-radius:5px' + imp +
				'-moz-box-shadow:0px 0px 20px #000' + imp +
				'box-shadow:0px 0px 20px #000' + imp +
			'}' +

			'.' + ALERT_ID + '-blocked{' +
				reset +
				'color:#AAA' + imp +
				'display:inline' + imp +
				'text-decoration:line-through' + imp +
			'}' +

			'#' + ALERT_ID + ' br{display:block' + imp + reset + '}' +

			'#' + ALERT_ID + ' span{background:transparent' + imp + reset + '}' +

			'#' + ALERT_ID + ' div{' +
				reset +
				'border:0' + imp +
				'margin:0' + imp +
				'padding:0' + imp +
				'width:auto' + imp +
				'letter-spacing:normal' + imp +
				'font:13px Arial,Helvetica' + imp +
				'text-align:left' + imp +
				'text-shadow:none' + imp +
				'text-transform:none' + imp +
				'word-spacing:normal' + imp +
			'}' +

			'#' + ALERT_ID + ' a{' +
				reset +
				'font-weight:normal' + imp +
				'background:none' + imp +
				'text-decoration:underline' + imp +
				'color:#fff' + imp +
			'}' +

			'a#' + ALERT_ID + '-gear{' +
				reset +
				'text-decoration:none' + imp +
				'position:absolute' + imp +
				'display:none' + imp +
				'font-size:20px' + imp +
				'width:20px' + imp +
				'height:20px' + imp +
				'line-height:20px' + imp +
				'text-align:center' + imp +
				'background-color:rgba(255,255,255,.8)' + imp +
				'background-image:url(resource://firefox-at-ghostery-dot-com/ghostery/data/images/gear.svg)' + imp +
				'background-size:16px 16px' + imp +
				'background-position:center center' + imp +
				'background-repeat:no-repeat' + imp +
				'text-decoration:none' + imp +
			'}' +

			'a#' + ALERT_ID + '-gear:hover{' +
				'-webkit-animation-name:pop' + ALERT_ID + imp +
				'animation-name:pop' + ALERT_ID + imp +
				'-webkit-animation-duration:0.3s' + imp +
				'animation-duration:0.3s' + imp +
			'}' +

			'#' + ALERT_ID + ':hover #' + ALERT_ID + '-gear{' +
				'text-decoration:none' + imp +
				'display:inline-block' + imp +
			'}' +

			'#' + ALERT_ID + ' hr{' +
				'visibility:hidden' + imp + reset +
				'height:1em;' +
			'}' +

			'@media print{#' + ALERT_ID + '{display:none' + imp + '}}';

		appendChild(doc.getElementsByTagName('head')[0], style);
	}

	function removeAlert(permanent) {
		var el = doc.getElementById(ALERT_ID);
		if (el) {
			el.parentNode.removeChild(el);
		}
		clearTimeout(ALERT_TIMER);

		if (permanent) {
			ALERT_DISMISSED = true;
		}
	}

	function createAlertLink(href, text) {
		var link = createEl('a');
		link.style.color = '#fff';
		link.style.textDecoration = 'underline';
		link.style.border = 'none';
		link.href = href || '#';
		if (href) {
			link.target = '_blank';
		}
		appendChild(link, doc.createTextNode(text));
		return link;
	}

	function span(text, class_name) {
		var s = createEl('span');
		if (class_name) {
			s.className = class_name;
		}
		appendChild(s, doc.createTextNode(text));
		return s;
	}

	function createAlert(type, alert_cfg) {
		var alert_div = createEl('div');

		alert_div.id = ALERT_ID;

		alert_div.style.setProperty(
			(alert_cfg && alert_cfg.pos_x == 'left' ? 'left' : 'right'),
			'20px',
			'important');
		alert_div.style.setProperty(
			(alert_cfg && alert_cfg.pos_y == 'bottom' ? 'bottom' : 'top'),
			'15px',
			'important');
		alert_div.style.setProperty(
			'background',
			(type == 'showBugs' ? '#330033' : '#777'),
			'important');

		if (doc.getElementsByTagName('body')[0]) {
			appendChild(doc.body, alert_div);
		} else {
			appendChild(doc.getElementsByTagName('html')[0], alert_div);
		}

		if (type == 'showBugs') {
			alert_div.style.cursor = 'pointer';
			alert_div.addEventListener('click', function (e) {
				removeAlert(true);
				e.preventDefault();
			});
			alert_div.addEventListener('mouseenter', function (e) {
				clearTimeout(ALERT_TIMER);
				// timer should not be set until mouseleave
				ALERT_TIMER = false;
				e.preventDefault();
			});
			alert_div.addEventListener('mouseleave', function (e) {
				ALERT_TIMER = setTimeout(removeAlert, alert_cfg.timeout * 1000);
				e.preventDefault();
			});
		}

		return alert_div;
	}

	function showAlert(type, bugs, alert_cfg) {
		// only tear down the frame for upgrade notifications/walkthrough reminders
		if (type != 'showBugs') {
			removeAlert();
		}

		var alert_div,
			alert_contents = createEl('div'),
			link;

		alert_contents.style.setProperty(
			'background',
			(type == 'showBugs' ? '#330033' : '#777'),
			'important');

		if (type == 'showBugs') {
			appendChild(alert_contents, createGear(alert_cfg));

			for (var i = 0; i < bugs.length; i++) {
				appendChild(alert_contents, span(
					bugs[i].name,
					(bugs[i].blocked ? ALERT_ID + '-blocked' : '')
				), br());
			}

		} else {
			if (type != 'showUpdateAlert') {
				var blog_link = createAlertLink(
					'https://purplebox.ghostery.com/releases/releases-ffx',
					NOTIFICATION_TRANSLATIONS.notification_upgrade
				);

				blog_link.addEventListener("click", function (e) {
					e.preventDefault();
					sendMessage("openTab", { url: e.target.href });
				});
				appendChild(alert_contents, blog_link);
			}

			if (type == 'showWalkthroughAlert' || type == 'showUpdateAlert') {
				if (type == 'showUpdateAlert') {
					appendChild(alert_contents, span(NOTIFICATION_TRANSLATIONS.notification_update));
					link = createAlertLink('', NOTIFICATION_TRANSLATIONS.notification_update_link);

				} else {
					appendChild(alert_contents,
						hr(),
						span(NOTIFICATION_TRANSLATIONS.notification_reminder1),
						br(),
						span(NOTIFICATION_TRANSLATIONS.notification_reminder2)
					);
					link = createAlertLink('', NOTIFICATION_TRANSLATIONS.notification_reminder_link);
				}

				link.addEventListener('click', function (e) {
					sendMessage(type == 'showUpdateAlert' ? 'showNewTrackers' : 'openWalkthrough');
					e.preventDefault();
				});
				appendChild(alert_contents, hr(), link);
			}

			link = createAlertLink(false, NOTIFICATION_TRANSLATIONS.dismiss);
			link.addEventListener('click', function (e) {
				removeAlert();
				e.preventDefault();
			});
			appendChild(alert_contents, hr(), link);
		}

		alert_div = doc.getElementById(ALERT_ID);

		if (!alert_div) {
			alert_div = createAlert(type, alert_cfg);
		}

		if (type == 'showBugs') {
			alert_div.title = ALERT_TRANSLATIONS.alert_bubble_tooltip;
		}

		alert_div.textContent = '';
		appendChild(alert_div, alert_contents);

		// restart the close alert bubble timer
		clearTimeout(ALERT_TIMER);
		if (alert_cfg && alert_cfg.timeout && ALERT_TIMER) {
			ALERT_TIMER = setTimeout(removeAlert, alert_cfg.timeout * 1000);
		}
	}

	function createGear(alert_cfg) {
		var gear = createEl('a');
		
		gear.appendChild(document.createTextNode('\u0020'));

		gear.href = '#';
		gear.id = ALERT_ID + '-gear';
		gear.title = ALERT_TRANSLATIONS.alert_bubble_gear_tooltip;

		gear.style.setProperty(
			(alert_cfg && alert_cfg.pos_x == 'left' ? 'left' : 'right'),
			'0',
			'important');
		gear.style.setProperty(
			(alert_cfg && alert_cfg.pos_y == 'bottom' ? 'bottom' : 'top'),
			'0',
			'important');
		gear.style.setProperty(
			'border-' +
				(alert_cfg && alert_cfg.pos_y == 'bottom' ? 'top' : 'bottom') +
				'-' +
				(alert_cfg && alert_cfg.pos_x == 'left' ? 'right' : 'left') +
				'-radius',
			'3px',
			'important');
		gear.style.setProperty(
			'border-' +
				(alert_cfg && alert_cfg.pos_y == 'bottom' ? 'bottom' : 'top') +
				'-' +
				(alert_cfg && alert_cfg.pos_x == 'left' ? 'left' : 'right') +
				'-radius',
			'3px',
			'important');

		gear.addEventListener('click', function (e) {
			sendMessage('showPurpleBoxOptions');
			e.preventDefault();
		});

		return gear;
	}

	self.port.on('show', function (msg) {
		ALERT_TRANSLATIONS = msg.translations;
		if (!CSS_INJECTED) {
			CSS_INJECTED = true;
			injectCSS();
		}
		if (!UPGRADE_ALERT_SHOWN && !ALERT_DISMISSED) {
			showAlert('showBugs', msg.bugs, msg.alert_cfg);
		}
	});
	self.port.on('showUpgradeAlert', function (msg) {
		NOTIFICATION_TRANSLATIONS = msg.translations;
		if (!CSS_INJECTED) {
			CSS_INJECTED = true;
			injectCSS();
		}
		showAlert('showUpgradeAlert');
		UPGRADE_ALERT_SHOWN = true;
	});
	self.port.on('showWalkthroughAlert', function (msg) {
		NOTIFICATION_TRANSLATIONS = msg.translations;
		if (!CSS_INJECTED) {
			CSS_INJECTED = true;
			injectCSS();
		}
		showAlert('showWalkthroughAlert');
		UPGRADE_ALERT_SHOWN = true;
	});
	self.port.on('showUpdateAlert', function (msg) {
		NOTIFICATION_TRANSLATIONS = msg.translations;
		if (!CSS_INJECTED) {
			CSS_INJECTED = true;
			injectCSS();
		}
		showAlert('showUpdateAlert');
		UPGRADE_ALERT_SHOWN = true;
	});

	sendMessage('pageInjected');

}());
