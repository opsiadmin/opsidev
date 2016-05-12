(function () {
	var d = document,
		BUTTON_ID = 'ghostery-button',
		BADGE_CONTAINER_ID = 'ghostery-badge',
		touchStart,
		touchEnd,
		timeoutID,
		timeout = 1000/*,
		numbers = [
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/0.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/1.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/2.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/3.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/4.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/5.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/6.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/7.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/8.png',
					'resource://firefox-at-ghostery-dot-com/data/images/numbers/9.png'
					]*/;

	function injectCSS() {
		var style = d.createElement('style'),
			imp = ' !important;';

		style.textContent = '#' + BUTTON_ID + '{' +
				'z-index: 2147483646' + imp +
				'position: fixed' + imp +
				'top: auto' + imp +
				'left: auto' + imp +
				'bottom: 0' + imp +
				'right: 0' + imp +
				'height: 40pt' + imp +
				'width: auto' + imp +
				'border-radius: 5px' + imp +
				'padding: 10pt' + imp +
				'background-color: rgba(255,255,255,0.5)' + imp +
			'}' +
			'#' + BADGE_CONTAINER_ID + '{' +
				'position: fixed' + imp +
				'z-index: 2147483647' + imp +
				'top: auto' + imp +
				'left: auto' + imp +
				'bottom: 5pt' + imp +
				'right: 5pt' + imp +
				'height: 18pt' + imp +
				'width: auto' + imp +
				'border-radius: 2px' + imp +
				'padding: 0 2pt' + imp +
				'background-color: #330033' + imp +
				'text-align: center' + imp +
				'color: #fff' + imp +
				'font: normal normal 18pt Arial' + imp +
				'display: table' + imp +
				'vertical-align: middle' + imp +
			'}' +
			'.ghostery-badge {' +
				'height: 100%' + imp +
				'width: auto' + imp +
			'}' +
			'@media print, screen and (view-mode:minimized){#' + BUTTON_ID + '{ display: none' + imp + '} }' +
			'@media print, screen and (view-mode:minimized){#' + BADGE_CONTAINER_ID + '{ display: none' + imp + '} }';

		d.getElementsByTagName('head')[0].appendChild(style);
	}

	function touchStartFn (e) {
		touchStart = new Date().getTime();
		timeoutID = window.setTimeout(function () {
			removeButton(true);
		}, timeout);
		e.preventDefault();
	}
	function touchEndFn (e) {
		touchEnd = new Date().getTime();
		var diff = touchEnd - touchStart;

		if (diff < timeout) {
			window.clearTimeout(timeoutID);
			self.port.emit('showPanel');
		}
		e.preventDefault();
	}

	function addButton() {
		var button = d.createElement('img');

		button.id = BUTTON_ID;
		button.src = 'resource://firefox-at-ghostery-dot-com/data/images/ghosty-64px.png';

		button.addEventListener('touchstart', touchStartFn, false);
		button.addEventListener('touchend', touchEndFn, false);

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

		badge.addEventListener('touchstart', touchStartFn, false);
		badge.addEventListener('touchend', touchEndFn, false);

		if (d.getElementsByTagName('body')[0]) {
			d.body.appendChild(badge);
		} else {
			d.getElementsByTagName('html')[0].appendChild(badge);
		}

		return badge;
	}

	function updateBadge(num_trackers) {
		var badgeContainer = d.getElementById(BADGE_CONTAINER_ID);

		if (num_trackers !== '' && !badgeContainer) {
			badgeContainer = createBadge();
		}
		badgeContainer.textContent = num_trackers;
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
