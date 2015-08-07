(function () {
	var d = document,
		BUTTON_ID = 'ghostery-button',
		BADGE_CONTAINER_ID = 'ghostery-badge',
		touchStart,
		touchEnd,
		timeoutID,
		timeout = 1000/*,
		numbers = [
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/0.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/1.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/2.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/3.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/4.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/5.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/6.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/7.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/8.png',
					'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/9.png'
					]*/;

	function injectCSS() {
		var style = d.createElement('style'),
			imp = ' !important;';

		style.textContent = '#' + BUTTON_ID + '{' +
				'position: fixed' + imp +
				'z-index: 2147483647' + imp +
				'bottom: 0' + imp +
				'right: 0' + imp +
				'height: 5%' + imp +
				'width: auto' + imp +
				'border-radius: 5px' + imp +
				'padding: 2%' + imp +
				'background-color: rgba(255,255,255,0.5)' + imp +
			'}' +
			'#' + BADGE_CONTAINER_ID + '{' +
				'position: fixed' + imp +
				'z-index: 2147483647' + imp +
				'bottom: .5%' + imp +
				'right: .5%' + imp +
				'height: 2.5%' + imp +
				'width: auto' + imp +
				'border-radius: 2px' + imp +
				'padding: .3%' + imp +
				'background-color: #330033' + imp +
			'}' +
			'.ghostery-badge {' +
				'height: 98%' + imp +
				'width: auto' + imp +
				'float: right' + imp +
			'}' +
			'@media print, screen and (view-mode:minimized){#' + BUTTON_ID + '{ display: none' + imp + '} }' +
			'@media print, screen and (view-mode:minimized){#' + BADGE_CONTAINER_ID + '{ display: none' + imp + '} }';

		d.getElementsByTagName('head')[0].appendChild(style);
	}

	function addButton() {
		var button = d.createElement('img');

		button.id = BUTTON_ID;
		button.src = 'resource://firefox-at-ghostery-dot-com/ghostery/data/images/Icon-64.png';

		button.addEventListener('touchstart', function (e) {
			touchStart = new Date().getTime();
			timeoutID = window.setTimeout(function () {
				removeButton(true);
			}, timeout);
			e.preventDefault();
		}, false);
		
		button.addEventListener('touchend', function (e) {
			touchEnd = new Date().getTime();
			var diff = touchEnd - touchStart;

			if (diff < timeout) {
				window.clearTimeout(timeoutID);
				self.port.emit('showPanel');
			}
			e.preventDefault();
		}, false);

		if (d.getElementsByTagName('body')[0]) {
			d.body.appendChild(button);
		} else {
			d.getElementsByTagName('html')[0].appendChild(button);
		}
	}

	function removeButton(ask) {
		var button = d.getElementById(BUTTON_ID);
		if (!button) { return; }

		if (ask) {
			if (window.confirm('Remove Ghostery\'s button?\n(To permanently remove it, go to Ghostery\'s Options.)')) {
				button.parentNode.removeChild(button);
			}
		} else {
			button.parentNode.removeChild(button);
		}
	}

	function createBadge() {
		var badge = d.createElement('span');
		badge.id = BADGE_CONTAINER_ID;

		if (d.getElementsByTagName('body')[0]) {
			d.body.appendChild(badge);
		} else {
			d.getElementsByTagName('html')[0].appendChild(badge);
		}

		return badge;
	}

	function updateBadge(num_trackers) {
		var i = 0,
			badgeContainer = d.getElementById(BADGE_CONTAINER_ID);

		if (num_trackers !== '' && !badgeContainer) {
			badgeContainer = createBadge();
		}

		num_trackers = parseInt(num_trackers, 10);

		while (num_trackers > 0) {
			createDigitElement(i++, num_trackers % 10);
			num_trackers = parseInt(num_trackers / 10, 10);
		}
	}

	function createDigitElement(digit, number) {
		var badgeContainer = d.getElementById(BADGE_CONTAINER_ID),
			badge = d.getElementById('ghostery-badge-' + digit);

		// Create digit badge if it doesn't exist.
		if (!badge) {
			badge = d.createElement('img');
			badge.id = 'ghostery-badge-' + digit;
			badge.className = 'ghostery-badge';

			badgeContainer.appendChild(badge);
		}

		// Set digit number
		badge.src = 'resource://firefox-at-ghostery-dot-com/ghostery/data/images/numbers/' + number + '.png';
	}

	// Listeners
	self.port.on('showButton', function () {
		injectCSS();
		addButton();
	});

	self.port.on('updateIcon', function (msg) {
		var button = d.getElementById(BUTTON_ID);
		if (button) {
			button.src = msg.icon;
		}
	});

	self.port.on('updateBadge', function (msg) {
		updateBadge(msg.text);
	});
})();