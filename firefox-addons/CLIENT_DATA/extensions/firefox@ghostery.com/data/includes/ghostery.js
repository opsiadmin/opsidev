/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

// TODO slim down as much as possible
(function() {

	var ALERT_DISMISSED = false,
		ALERT_ID = id(),
		BOX_ID = 'UNIQUE_ID',
		ALERT_TIMER = 9999,
		TIMEOUTS = {
			box_position_timeout: 0,
			box_destroy_timeout: 9999,
			box_pulse_timeout: 9999,
			box_none_timeout: 9999
		},
		BOX_CONF = {},
		CSS_INJECTED = false,
		BOX_CREATED = false,
		BOX_TRANSLATIONS = {},
		NOTIFICATION_TRANSLATIONS = {},
		UPGRADE_ALERT_SHOWN = false,
		doc = document,
		CMP_DATA = {},
		sendMessage = function(name, msg) {
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

	// arguments: parentElement, *childElements
	function appendChild(parent) {
		for (var i = 1; i < arguments.length; i++) {
			parent.appendChild(arguments[i]);
		}
	}

	function injectCSS() {
		var style = createEl('style'),
			imp = ' !important;',
			reset = 'padding:0;margin:0;font:13px Arial,Helvetica;text-transform:none;font-size: 100%;vertical-align:baseline;line-height:normal;color:#fff;position:static;';

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
			'border:none' + imp +
			'background:#fff' + imp +
			'color:#fff' + imp +
			'display:block' + imp +
			'height:auto' + imp +
			'max-height:325px' + imp +
			'margin:0' + imp +
			'opacity:1' + imp +
			'padding:0' + imp +
			'position:fixed' + imp +
			'visibility:visible' + imp +
			'width:325px' + imp +
			'z-index:2147483647' + imp +
			// TODO should we switch to non-prefixed ones?
			'-moz-border-radius:6px' + imp +
			'border-radius:6px' + imp +
			'-moz-box-shadow:0px 0px 20px #000' + imp +
			'box-shadow:0px 0px 20px #000' + imp +
			'}' +
			'#' + ALERT_ID + ' br{display:inline-block' + imp + reset + '}' +
			'#' + ALERT_ID + ' div{' +
			reset +
			'letter-spacing:normal' + imp +
			'font:16px Roboto, sans-serif' + imp +
			'line-height:24px' + imp +
			'text-align:center' + imp +
			'text-shadow:none' + imp +
			'text-transform:none' + imp +
			'word-spacing:normal' + imp +
			'}' +
			'#' + ALERT_ID + ' a{' +
			reset +
			'border:none' + imp +
			'font-weight:500' + imp +
			'background:#fff' + imp +
			'color:#00aef0' + imp +
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

	function destroyPurpleBox() {
		var ghostery = doc.getElementById(BOX_ID + '-ghostery');
		if (ghostery) {
			ghostery.parentNode.removeChild(ghostery);
		}

		BOX_CREATED = false;
		clearTimeout(TIMEOUTS.box_position_timeout);
		clearTimeout(TIMEOUTS.box_destroy_timeout);
		clearTimeout(TIMEOUTS.box_pulse_timeout);
		clearTimeout(TIMEOUTS.box_none_timeout);
	}

	function createPurpleBox() {
		var ghostery = createEl('div'),
			shadow = createEl('div'),
			pulse = createEl('div'),
			background = createEl('div'),
			list = createEl('div'),
			main = createEl('div'),
			options = createEl('div'),
			trackersText = createEl('div'),
			trackersCount = createEl('div'),
			menu = createEl('div'),
			back = createEl('div'),
			hide = createEl('div'),
			settings = createEl('div'),
			dismiss = createEl('div'),
			position = createEl('div'),
			style = createEl('style');

		style.textContent = '@media print {#' + BOX_ID + '-ghostery {display:none !important}}';
		appendChild(doc.getElementsByTagName('head')[0], style);

		ghostery.id = BOX_ID + '-ghostery';
		ghostery.className = BOX_ID + '-none';
		shadow.id = BOX_ID + '-box-shadow';
		pulse.id = BOX_ID + '-box-pulse';
		background.id = BOX_ID + '-box-background';
		list.id = BOX_ID + '-box-list';
		main.id = BOX_ID + '-box-main';
		options.id = BOX_ID + '-box-options';
		options.className = BOX_ID + '-button';
		trackersText.id = BOX_ID + '-box-trackers-text';
		trackersText.className = BOX_ID + '-button';
		trackersText.textContent = BOX_TRANSLATIONS.looking;
		trackersCount.id = BOX_ID + '-box-trackers-count';
		trackersCount.className = BOX_ID + '-button';
		trackersCount.textContent = '0';
		menu.id = BOX_ID + '-box-menu';
		back.id = BOX_ID + '-box-back';
		back.className = BOX_ID + '-button';
		hide.id = BOX_ID + '-box-hide';
		hide.className = BOX_ID + '-button';
		hide.textContent = BOX_TRANSLATIONS.hide;
		settings.id = BOX_ID + '-box-settings';
		settings.className = BOX_ID + '-button';
		settings.textContent = BOX_TRANSLATIONS.settings;
		dismiss.id = BOX_ID + '-box-dismiss';
		dismiss.className = BOX_ID + '-button';
		dismiss.innerHTML = dismissText();
		position.id = BOX_ID + '-box-position';
		position.className = BOX_ID + '-button';
		position.innerHTML = positionText();

		trackersText.addEventListener('click', handleSizeChangeClick);
		trackersCount.addEventListener('click', handleSizeChangeClick);
		options.addEventListener('click', handleNavClick);
		back.addEventListener('click', handleNavClick);
		hide.addEventListener('click', handleHideClick);
		settings.addEventListener('click', handleSettingsClick);
		dismiss.addEventListener('click', handleDismissClick);
		position.addEventListener('click', handlePositionClick);

		appendChild(main, options, trackersText, trackersCount);
		appendChild(menu, back, hide, settings, dismiss, position);
		appendChild(ghostery, shadow, pulse, background, menu, list, main);

		TIMEOUTS.box_none_timeout = setTimeout(clearTrackersNone, 2000);

		if (doc.getElementsByTagName('body')[0]) {
			appendChild(doc.body, ghostery);
		} else {
			appendChild(doc.getElementsByTagName('html')[0], ghostery);
		}
		setBoxHeights();
	}

	function resetPositionTimer() {
		if (TIMEOUTS.box_position_timeout) {
			clearTimeout(TIMEOUTS.box_position_timeout);
			TIMEOUTS.box_position_timeout = setTimeout(function() {
				TIMEOUTS.box_position_timeout = 0;
				setBoxHeights();
			}, 2000);
		}
	}
	function resetDestroyTimer() {
		clearTimeout(TIMEOUTS.box_destroy_timeout);
		if (BOX_CONF.alert_bubble_timeout > 0) {
			TIMEOUTS.box_destroy_timeout = setTimeout(function() {
				destroyPurpleBox();
			}, 1000 * BOX_CONF.alert_bubble_timeout);
		}
	}

	function clearTrackersNone() {
		var ghostery = doc.getElementById(BOX_ID + '-ghostery'),
			trackersText = doc.getElementById(BOX_ID + '-box-trackers-text');

		ghostery.classList.remove(BOX_ID + '-none');
	}

	function handleSizeChangeClick() {
		BOX_CONF.alert_expanded = !BOX_CONF.alert_expanded;
		doSizeChange();
	}
	function doSizeChange() {
		var ghostery = doc.getElementById(BOX_ID + '-ghostery');
		resetDestroyTimer();
		sendMessage('updateAlertConf', BOX_CONF);

		if (ghostery.classList.contains(BOX_ID + '-list')) {
			ghostery.classList.remove(BOX_ID + '-list');
		} else {
			if (ghostery.classList.contains(BOX_ID + '-none')) {
				clearTrackersNone();
			}
			ghostery.classList.add(BOX_ID + '-list');
		}
		setBoxHeights();
	}

	function handleNavClick() {
		var ghostery = doc.getElementById(BOX_ID + '-ghostery');
		resetDestroyTimer();

		if (ghostery.classList.contains(BOX_ID + '-menu')) {
			ghostery.classList.remove(BOX_ID + '-menu');
		} else {
			ghostery.classList.add(BOX_ID + '-menu');
		}

		setBoxHeights();
		setBoxTexts();
	}

	function handleHideClick() {
		destroyPurpleBox();
		sendMessage('hideAlert');
	}

	function handleSettingsClick() {
		window.open('https://extension.ghostery.com/' + BOX_CONF.language + '/settings');
	}

	function handleDismissClick() {
		var delays = [0, 5, 15, 30],
			dismissEl = doc.getElementById(BOX_ID + '-box-dismiss');

		BOX_CONF.alert_bubble_timeout = delays[(delays.indexOf(BOX_CONF.alert_bubble_timeout) + 1) % delays.length];
		resetPositionTimer();
		resetDestroyTimer();
		dismissEl.innerHTML = dismissText();
		sendMessage('updateAlertConf', BOX_CONF);
	}

	function handlePositionClick() {
		var positions = ['br', 'tr', 'tl', 'bl'],
			positionEl = doc.getElementById(BOX_ID + '-box-position');

		BOX_CONF.alert_bubble_pos = positions[(positions.indexOf(BOX_CONF.alert_bubble_pos) + 1) % positions.length];
		if (TIMEOUTS.box_position_timeout === 0) {
			TIMEOUTS.box_position_timeout = 9999;
		}
		resetPositionTimer();
		resetDestroyTimer();
		positionEl.innerHTML = positionText();
		sendMessage('updateAlertConf', BOX_CONF);
	}

	function dismissText() {
		return BOX_TRANSLATIONS['box_dismiss_' + BOX_CONF.alert_bubble_timeout + 's'];
	}

	function positionText() {
		return BOX_TRANSLATIONS['box_display_' + BOX_CONF.alert_bubble_pos];
	}

	function setBoxHeights() {
		var height, digits,
			ghostery = doc.getElementById(BOX_ID + '-ghostery'),
			shadow = doc.getElementById(BOX_ID + '-box-shadow'),
			pulse = doc.getElementById(BOX_ID + '-box-pulse'),
			background = doc.getElementById(BOX_ID + '-box-background'),
			list = doc.getElementById(BOX_ID + '-box-list'),
			menu = doc.getElementById(BOX_ID + '-box-menu'),
			main = doc.getElementById(BOX_ID + '-box-main'),
			trackersText = doc.getElementById(BOX_ID + '-box-trackers-text'),
			trackersCount = doc.getElementById(BOX_ID + '-box-trackers-count');

		if (ghostery.classList.contains(BOX_ID + '-list')) {
			height = list.children.length * 20 + 26;
			height = Math.min(height, doc.documentElement.clientHeight - 105);
			height = Math.max(height, 230);

			shadow.style.setProperty('height', (height + 32) + 'px', 'important');
			pulse.style.setProperty('height', (height + 32) + 'px', 'important');
			background.style.setProperty('height', (height + 32) + 'px', 'important');
			list.style.setProperty('height', (height - 24) + 'px', 'important');
			menu.style.setProperty('height', (height + 32) + 'px', 'important');
			main.style.setProperty('bottom', (height + 25) + 'px', 'important');

			if (BOX_CONF.alert_bubble_pos.indexOf('l') >= 0) {
				ghostery.style.removeProperty('right');
				ghostery.style.setProperty('left', '25px', 'important');
				trackersCount.style.removeProperty('right');
				trackersCount.style.setProperty('left', '25px', 'important');
			} else {
				ghostery.style.removeProperty('left');
				ghostery.style.setProperty('right', '186px', 'important');
				trackersCount.style.removeProperty('left');
				trackersCount.style.setProperty('right', '128px', 'important');
			}

			if (BOX_CONF.alert_bubble_pos.indexOf('t') >= 0) {
				ghostery.style.removeProperty('bottom');
				ghostery.style.setProperty('top', '50px', 'important');
				trackersCount.style.removeProperty('bottom');
				trackersCount.style.setProperty('top', '52px', 'important');
			} else {
				ghostery.style.removeProperty('top');
				ghostery.style.setProperty('bottom', (height + 57) + 'px', 'important');
				trackersCount.style.removeProperty('top');
				trackersCount.style.setProperty('bottom', (height + 27) + 'px', 'important');
			}

			if (list.children.length * 16 + 26 > doc.documentElement.clientHeight - 105) {
				list.style.setProperty('overflow-y', 'auto', 'important');
			} else {
				list.style.setProperty('overflow-y', 'hidden', 'important');
			}
		} else {
			shadow.style.setProperty('height', '');
			pulse.style.setProperty('height', '');
			background.style.setProperty('height', '');
			list.style.setProperty('height', '');
			menu.style.setProperty('height', '');
			main.style.setProperty('bottom', '');

			if (BOX_CONF.alert_bubble_pos.indexOf('l') >= 0) {
				ghostery.style.removeProperty('right');
				ghostery.style.setProperty('left', '25px', 'important');
				trackersCount.style.removeProperty('right');
				trackersCount.style.setProperty('left', '41.5px', 'important');
			} else {
				ghostery.style.removeProperty('left');
				ghostery.style.setProperty('right', '93px', 'important');
				trackersCount.style.removeProperty('left');
				trackersCount.style.setProperty('right', '41.5px', 'important');
			}

			if (BOX_CONF.alert_bubble_pos.indexOf('t') >= 0) {
				ghostery.style.removeProperty('bottom');
				ghostery.style.setProperty('top', '50px', 'important');
				trackersCount.style.removeProperty('bottom');
				trackersCount.style.setProperty('top', '74px', 'important');
			} else {
				ghostery.style.removeProperty('top');
				ghostery.style.setProperty('bottom', '93px', 'important');
				trackersCount.style.removeProperty('top');
				trackersCount.style.setProperty('bottom', '49px', 'important');
			}
		}

		if (ghostery.classList.contains(BOX_ID + '-list')) {
			digits = parseInt(trackersCount.textContent);
			digits = digits || 1;
			digits = Math.floor(Math.log10(digits)) + 1;
			trackersText.style.setProperty('padding-left', (digits * 10 + 24) + 'px', 'important');
		} else {
			trackersText.style.setProperty('padding-left', '');
		}
	}

	function setBoxTexts() {
		var ghostery = doc.getElementById(BOX_ID + '-ghostery'),
			back = doc.getElementById(BOX_ID + '-box-back'),
			hide = doc.getElementById(BOX_ID + '-box-hide'),
			settings = doc.getElementById(BOX_ID + '-box-settings');

		if (ghostery.classList.contains(BOX_ID + '-list')) {
			back.textContent = BOX_TRANSLATIONS.options_expanded;
			hide.textContent = BOX_TRANSLATIONS.hide_expanded;
			settings.textContent = BOX_TRANSLATIONS.settings_expanded;
		} else {
			back.textContent = '';
			hide.textContent = BOX_TRANSLATIONS.hide;
			settings.textContent = BOX_TRANSLATIONS.settings;
		}
	}

	function handleNewTrackers(apps) {
		var tracker, digits, n,
			ghostery = doc.getElementById(BOX_ID + '-ghostery'),
			trackersCount = doc.getElementById(BOX_ID + '-box-trackers-count'),
			trackersText = doc.getElementById(BOX_ID + '-box-trackers-text'),
			list = doc.getElementById(BOX_ID + '-box-list');

		clearTimeout(TIMEOUTS.box_pulse_timeout);
		ghostery.classList.add(BOX_ID + '-pulse');
		TIMEOUTS.box_pulse_timeout = setTimeout(function() {
			ghostery.classList.remove(BOX_ID + '-pulse');
		}, 1600);

		if (apps.length > 0) {
			clearTrackersNone();
			trackersCount.textContent = apps.length;
			trackersText.textContent = trackersCount.textContent === '1' ? BOX_TRANSLATIONS.tracker : BOX_TRANSLATIONS.trackers;
		}

		list.textContent = '';
		for (n = 0; n < apps.length; n++) {
			tracker = createEl('div');
			if (apps[n].blocked) {
				tracker.className = BOX_ID + '-tracker ' + BOX_ID + '-disabled';
			} else {
				tracker.className = BOX_ID + '-tracker';
			}
			tracker.textContent = apps[n].name;
			appendChild(list, tracker);
		}

		if (!ghostery.classList.contains(BOX_ID + '-menu')) {
			setBoxHeights();
		}
	}

	function createNotificationHeader() {
		var header = createEl('div');
		header.style.backgroundColor = '#00aef0';
		header.style.borderTopLeftRadius = '6px';
		header.style.borderTopRightRadius = '6px';
		header.style.height = '46px';
		header.style.padding = '0 0 0 16px';

		var logo = createEl('div');

		logo.style.width = '82px';
		logo.style.height = '100%';
		logo.style.background = 'url("resource://firefox-at-ghostery-dot-com/data/images/panel/header/logo.png") no-repeat center';

		logo.style.backgroundSize = '100% auto';
		logo.style.cssFloat = 'left';

		appendChild(header, logo);

		var closeButton = createEl('div');

		//.button class
		closeButton.style.cursor = 'pointer';
		closeButton.style.setProperty(
			'-webkit-touch-callout',
			'none'
		);

		closeButton.style.setProperty(
			'-webkit-user-select',
			'none'
		);

		closeButton.style.setProperty(
			'-khtml-user-select',
			'none'
		);

		closeButton.style.setProperty(
			'-moz-user-select',
			'none'
		);

		closeButton.style.setProperty(
			'-ms-user-select',
			'none'
		);

		closeButton.style.setProperty(
			'user-select',
			'none'
		);

		//The rest
		closeButton.style.cssFloat = 'right';
		closeButton.style.background = "url('resource://firefox-at-ghostery-dot-com/data/images/popup/header/popup_x_icon_small.png') no-repeat center";
		closeButton.style.backgroundSize = '12px 12px';
		closeButton.style.width = '12px';
		closeButton.style.height = '12px';
		closeButton.style.margin = '8px 8px 8px 8px';

		//closeButton.style.border = '1px solid #ff0000';

		closeButton.addEventListener('click', function(e) {
			removeAlert();
			sendMessage("dismissCMPMessage");
			e.preventDefault();
		});

		appendChild(header, closeButton);

		var clearDiv = createEl('div');
		clearDiv.style.clear = 'both';

		appendChild(header, clearDiv);

		return header;
	}

	function createNotificationContent(message, linkUrl, linkText, linkClickFunc) {
		var content = createEl('div');
		content.style.borderRadius = '6px';
		content.style.setProperty(
			'background',
			'#fff',
			'important');

		var header = createNotificationHeader();

		appendChild(content, header);
		var messageDiv = createEl('div');

		//Upgrade message
		messageDiv.style.setProperty(
			'padding',
			'22px 35px 17px 35px',
			'important');

		var s = createEl('span');
		s.style.color = '#232323';
		s.style.border = 'none';
		s.style.fontWeight = '300';

		s.style.setProperty(
			'margine',
			'22px 35px 17px 35px',
			'important');

		appendChild(s, doc.createTextNode(message));

		appendChild(messageDiv, s);
		appendChild(content, messageDiv);

		//Upgrade link
		var linkDiv = createEl('div');
		linkDiv.style.setProperty(
			'padding',
			'18px 35px 22px 35px',
			'important');

		var link = createEl('a');
		link.style.color = '#00aef0';
		link.href = linkUrl || '#';
		if (linkUrl) {
			link.target = '_blank';
		}
		appendChild(link, doc.createTextNode(linkText));

		link.addEventListener('click', linkClickFunc);

		appendChild(linkDiv, link);
		appendChild(content, linkDiv);

		return content;
	}

	function createAlert(type) {
		var alert_div = createEl('div');

		alert_div.id = ALERT_ID;

		alert_div.style.setProperty(
			'right',
			'20px',
			'important');
		alert_div.style.setProperty(
			'top',
			'15px',
			'important');

		if (doc.getElementsByTagName('body')[0]) {
			appendChild(doc.body, alert_div);
		} else {
			appendChild(doc.getElementsByTagName('html')[0], alert_div);
		}
		return alert_div;
	}

	function showAlert(type, options) {
		var alert_div,
			alert_contents;

		if (type == 'showCMPMessage') {
			alert_contents = createNotificationContent(
				options.campaign.Message,
				options.campaign.Link,
				options.campaign.LinkText,
				function() {
					removeAlert();
					sendMessage("dismissCMPMessage");
				}
			);
		} else if (type == 'showUpgradeAlert') {
			alert_contents = createNotificationContent(
				NOTIFICATION_TRANSLATIONS.notification_upgrade,
				'https://www.ghostery.com/intelligence/consumer-blog/product-releases/',
				NOTIFICATION_TRANSLATIONS.notification_upgrade_link,
				function(e) {
					removeAlert();
				}
			);
		} else if (type == 'showUpdateAlert') {
			alert_contents = createNotificationContent(
				NOTIFICATION_TRANSLATIONS.notification_update,
				'https://extension.ghostery.com/' + BOX_CONF.language + '/settings#blocking-options',
				NOTIFICATION_TRANSLATIONS.notification_update_link,
				function(e) {
					removeAlert();
				}
			);
		}

		alert_div = doc.getElementById(ALERT_ID);

		if (!alert_div) {
			alert_div = createAlert(type);
		}
		alert_div.textContent = '';
		appendChild(alert_div, alert_contents);
	}

	self.port.on('showCMPMessage', function(msg) {
		CMP_DATA = msg.data;
		if (!CSS_INJECTED) {
			CSS_INJECTED = true;
			injectCSS();
		}
		if (!ALERT_DISMISSED) {
			showAlert('showCMPMessage', {
				campaign: CMP_DATA[0]
			});
			UPGRADE_ALERT_SHOWN = true;
			sendMessage('shownCMP');
		}
	});

	self.port.on('destroyBox', function() {
		destroyPurpleBox();
	});
	self.port.on('createBox', function(msg) {
		BOX_TRANSLATIONS = msg.translations;
		BOX_CONF.language = msg.conf.language;
		BOX_CONF.alert_bubble_timeout = msg.conf.alert_bubble_timeout;
		if (!BOX_CREATED) {
			BOX_CREATED = true;
			BOX_CONF.alert_bubble_pos = msg.conf.alert_bubble_pos;
			createPurpleBox();
			if (msg.conf.alert_expanded) {
				BOX_CONF.alert_expanded = true;
				doSizeChange();
			}
		}
		resetDestroyTimer();
	});
	self.port.on('updateTimeout', function(msg) {
		var dismissEl = doc.getElementById(BOX_ID + '-box-dismiss');
		BOX_CONF.alert_bubble_timeout = msg.alert_bubble_timeout;
		if (BOX_CREATED) {
			resetDestroyTimer();
			dismissEl.innerHTML = dismissText();
		}
	});
	self.port.on('updatePosition', function(msg) {
		var positionEl = doc.getElementById(BOX_ID + '-box-position');
		BOX_CONF.alert_bubble_pos = msg.alert_bubble_pos;
		if (BOX_CREATED) {
			clearTimeout(TIMEOUTS.box_position_timeout);
			resetDestroyTimer();
			setBoxHeights();
			positionEl.innerHTML = positionText();
		}
	});
	self.port.on('updateBox', function(msg) {
		if (BOX_CREATED) {
			handleNewTrackers(msg.apps);
			resetDestroyTimer();
		}
	});

	self.port.on('showUpgradeAlert', function(msg) {
		NOTIFICATION_TRANSLATIONS = msg.translations;
		if (!CSS_INJECTED) {
			CSS_INJECTED = true;
			injectCSS();
		}
		showAlert('showUpgradeAlert');
		UPGRADE_ALERT_SHOWN = true;
	});
	
	self.port.on('showUpdateAlert', function(msg) {
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