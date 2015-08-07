/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* global t, renderTemplate, getTemplate, AppBrowser, Categories, getCategories, apprise, checkAddonCompatibility, i18n, Swipe */

var Ghostery = Ghostery || {};

function saveWalkthrough() {
	if (!Ghostery.MOBILE_MODE) {
		Ghostery.conf.show_alert = ($('#show-alert')[0].checked ? true : false);
	}
	Ghostery.conf.ghostrank = ($('#ghostrank')[0].checked ? true : false);
	Ghostery.conf.block_by_default = ($('#block-by-default')[0].checked ? true : false);
	Ghostery.conf.selected_app_ids = Ghostery.bugBrowser.getSelectedAppIds();
	Ghostery.conf.selected_lsos_app_ids = Ghostery.lsoBrowser.getSelectedAppIds();
	
	self.port.emit('walkthroughSave', Ghostery.conf);
}

function initNavigation() {
	var slides = $('#slider > .swipe-wrap').children(),
		current = 0,
		headerTitles = [
			t('walkthrough_intro_header'),
			'Ghostrank™',
			t('walkthrough_notification_header'),
			t('walkthrough_blocking_header'),
			t('walkthrough_finished1')
		],
		Slider;

	// NOTE we do not show the purple box notification walkthrough page on Android
	if (Ghostery.MOBILE_MODE) {
		headerTitles.splice(2, 1);
	}

	$('#header-title').text(headerTitles[current]);

	function onNavigate() {
		$('#walkthrough-progress').children()
			.removeClass('active')
			.eq(current).addClass('active');

		$('#arrow-prev').toggle(current > 0);
		$('#arrow-next, #skip-button').toggle(current < slides.length - 1);
		$('#header-title').text(headerTitles[current]);

		saveWalkthrough();

		if (current + 1 == slides.length) {
			self.port.emit('walkthroughFinished');
		}

		$(window).scrollTop(0);
	}

	// clickable arrows
	$('#arrow-prev').click(function (e) {
		Slider.prev();
		e.preventDefault();
	}).hide();

	$('#arrow-next').click(function (e) {
		Slider.next();
		e.preventDefault();
	});

	$('.circle').click(function (e) {
		Slider.slide(+e.target.id.substr(6, 1) - 1);
		e.preventDefault();
	});

	// left/right keyboard controls
	$(window).keyup(function (e) {
		// don't navigate when using the tracker browser's name filter input
		if (e.target == $('#app-list-filter-name')[0]) {
			return;
		}
		if (e.keyCode == 37) {
			Slider.prev();
		} else if (e.keyCode == 39) {
			Slider.next();
		}
	});

	Slider = new Swipe(document.getElementById('slider'), {
		continuous: false,
		callback: function () {
			current = Slider.getPos();
			onNavigate();
		}
	});
}

function initTabs() {
	$('.tabs li').click(function (e) {
		var $li = $(this);

		// mark this tab active
		$li.addClass('active');
		// and show its contents
		$(this.getAttribute('data-tab-contents-selector')).show();
		$('#buttons').toggle((this.getAttribute('data-tab-contents-selector') != '#about-options'));

		// deactivate all other tabs and hide their contents (found via the
		// anchor's data-tab-contents-selector attribute)
		$li.siblings('li').each(function () {
			var $this = $(this);
			$this.removeClass('active');
			$($this.attr('data-tab-contents-selector')).hide();
		});

		e.preventDefault();
	});
}

function loadWalkthrough() {

	document.title = t('walkthrough_page_title');

	$('#content').html(
		renderTemplate('walkthrough', {
			_header: function (config) {
				return renderTemplate('_header', config);
			},
			_app_browser: getTemplate('_app_browser'),
			_ghostrank: getTemplate('_ghostrank'),
			_select: getTemplate('_select'),
			_footer: getTemplate('_footer'),
			_block_by_default_helper: getTemplate('_default_block_all'),
			conf: Ghostery.conf,
			MOBILE_MODE: Ghostery.MOBILE_MODE
		})
	);

	Ghostery.bugBrowser = new AppBrowser({
		el: $('#trackers-app-browser'),
		categories: new Categories(getCategories(Ghostery.bugdb, Ghostery.conf.selected_app_ids, Ghostery.tagDb)),
		new_app_ids: Ghostery.new_app_ids
	});

	Ghostery.lsoBrowser = new AppBrowser({
		el: $('#lsos-app-browser'),
		categories: new Categories(getCategories(Ghostery.lsodb, Ghostery.conf.selected_lsos_app_ids, Ghostery.tagDb, true)),
		new_lsos_app_ids: Ghostery.new_lsos_app_ids
	});

	$('#version-text').text(Ghostery.VERSION);

	$('#skip-button').click(function (e) {
		e.preventDefault();

		apprise(t('walkthrough_skip_confirmation'), {
			confirm: true,
			textOk: t('button_ok'),
			textCancel: t('button_cancel')
		}, function (r) {
			if (r) {
				self.port.emit('walkthroughAborted');
			}
		});
	});

	$('#ghostrank-moreinfo-link').click(function (e) {
		e.preventDefault();
		$('#ghostrank-moreinfo').slideDown(null, function () {
			$('#ghostrank-moreinfo-link').parent().hide();
		});
	});

	$('#addon-toolbar-help').tipTip({
		content: '<img src="images/help/addon_bar.png" alt="">',
		maxWidth: '300px'
	});

	$('#navigation-toolbar-help').tipTip({
		content: '<img width="280" src="images/help/navigation_toolbar.png" alt="">',
		maxWidth: '300px'
	});

	$('#add-button').click(function () {
		self.port.emit('addButton');
	});


	initNavigation();
	initTabs();
	checkAddonCompatibility();
}

// end function definitions //////////////////////////////////////////////////

self.port.on('optionsData', function (msg) {
	Ghostery.bugdb = msg.bugdb;
	Ghostery.lsodb = msg.lsodb;
	Ghostery.tagDb = msg.tagDb;
	Ghostery.conf = msg.conf;
	Ghostery.VERSION = msg.VERSION;
	Ghostery.MOBILE_MODE = msg.MOBILE_MODE;
	Ghostery.incompatibleAddons = msg.incompatibleAddons;

	i18n.init(Ghostery.conf.language);

	loadWalkthrough();
});
