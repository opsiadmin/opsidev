/*!
 * Ghostery for Firefox
 * http://www.ghostery.com/
 *
 * Copyright 2014 Ghostery, Inc. All rights reserved.
 * See https://www.ghostery.com/eula for license.
 */

/* global Backbone, getTemplate, _, i18n, t */
/* jshint unused: false */

var Panel = (function (options) {

	var Models = {
		Panel: Backbone.Model.extend({
			defaults: {
				language: 'en'
			}
		}),
		Tracker: Backbone.Model.extend({
			defaults: {
				language: 'en'
			}
		})
	},

	Collections = {
		Trackers: Backbone.Collection.extend({
			model: Models.Tracker,
			comparator: function (tracker) {
				return tracker.get('name').toLowerCase();
			}
		})
	},

	Views = {
		Panel: Backbone.View.extend({
			tagName: 'div',
			template: getTemplate('panel'),
			initialize: function () {
				this.model.on('change:trackers change:conf', this.renderTrackers, this);
				this.model.on('change:whitelisted change:trackers change:pauseBlocking', this.updatePauseBlocking, this);
				this.model.on('change:whitelisted change:validProtocol', this.updateWhitelistSite, this);
				this.model.on('change:whitelisted change:trackers change:page change:pauseBlocking change:validProtocol change:notScanned', this.updateGhosteryFindingsText, this);
				this.model.on('change:needsReload', this.updateNotification, this);
				this.model.on('change:showTutorial', this.updateTutorial, this);
				this.model.on('change:language', this.updateLanguage, this);

				this.model.set('tutorialArrowBlinkTimeout', 0);
				this.model.set('tutorialArrowBlinkInterval', 0);
				this.model.set('tooltipTimer', null);

				i18n.init(this.model.get('language'));
			},
			events: {
				'click #settings-button': 'toggleSettings',
				'click #pause-blocking-button': 'setPauseBlocking',
				'click #whitelisting-button': 'setWhitelistSite',
				'click .reload': 'reloadTab',

				'click .zero-clip': function (e) {
					var clip_link = $(e.target);

					self.port.emit('copyToClipboard', {
						text: clip_link.children().first().text()
					});

					clip_link
						.tooltip('destroy')
						.tooltip({
							trigger: 'click',
							title: t('copy_to_clipboard'),
							placement: 'top'
						})
						.tooltip('show');

					clip_link.unbind().bind('mouseout', function (e) {
						clip_link.tooltip('destroy');
					});

					window.setTimeout(function () {
						clip_link.tooltip('destroy');
					}, 1500);

					e.preventDefault();
				},

				'click #help-button, #tutorial-close': 'toggleTutorial',
				'click #tutorial-arrow-right': function (e) {
					this.tutorialNavigation('next');
					e.preventDefault();
				},
				'click #tutorial-arrow-left': function (e) {
					this.tutorialNavigation('prev');
					e.preventDefault();
				},
				'click .tutorial-control': function (e) {
					panel.tutorialNavigation(e.target);
					e.preventDefault();
				},

				'click #tutorial-support': 'handleLink',
				'click #tutorial-youtube': 'handleLink',
				'click #tutorial-email': 'handleLink',

				'click #options-button': function () {
					openTab('options.html', true, true);
					this.hidePanel();
				},
				'click #feedback-button': function () {
					openTab('http://www.ghostery.com/feedback', false, true);
					this.hidePanel();
				},
				'click #support-button': function () {
					openTab('options.html#about', true, true);
					this.hidePanel();
				},
				'click #share-button': function () {
					openTab('http://www.ghostery.com/share', false, true);
					this.hidePanel();
				},
				'click #close-panel': function () {
					this.hidePanel(true);
				}
			},

			// Render functions
			render: function () {
				this.el.innerHTML = this.template(this.model.toJSON());
				return this;
			},
			renderTrackers: function () {
				var Trackers,
					appsMap = [],
					trackers = this.model.get('trackers'),
					conf = this.model.get('conf'),
					/*page = this.model.get('page'),*/
					frag = document.createDocumentFragment(),
					validProtocol = this.model.get('validProtocol'),
					notScanned = this.model.get('notScanned');

				if (!trackers || trackers.length === 0) {
					// Set apps div text
					this.$('#apps-div').empty();
					this.$('#apps-div')
						.append($('<div class="no-trackers"><div class="vertical-center">' +
							t(notScanned ? 'panel_not_scanned_firefox' : 'panel_no_trackers_found') +
							'</div></div>'));
				} else {
					var page = this.model.get('page');

					this.$('#apps-div').empty().scrollTop(0);

					trackers.forEach(function (app) {
						appsMap.push({
							id: app.id,
							name: app.name,
							category: app.cat,
							tags: app.tags,
							sources: app.sources,
							hasCompatibilityIssue: app.hasCompatibilityIssue,
							blocked: app.blocked,
							siteSpecificUnblocked: (conf.site_specific_unblocks.hasOwnProperty(page.host) && conf.site_specific_unblocks[page.host].indexOf(+app.id) >= 0),
							globalBlocked: conf.selected_app_ids.hasOwnProperty(app.id),
							// TODO panel-wide stuff inside each model, yucky
							expand_sources: this.model.get('conf').expand_sources,
							whitelisted: this.model.get('whitelisted'),
							pauseBlocking: this.model.get('pauseBlocking'),
							page_host: page.host
						});
					}, this);

					Trackers = new Collections.Trackers(appsMap);
					Trackers.each(function (tracker) {
						frag.appendChild((new Views.Tracker({
							model: tracker
						})).render().el);
					});

					this.$('#apps-div').append(frag);
				}
			},

			// Set functions
			setPauseBlocking: function () {
				if (this.$('#pause-blocking-button').hasClass('disabled')) {
					return;
				}
				sendMessage('panelPauseToggle');
				this.model.set('pauseBlocking', !this.model.get('pauseBlocking'));
				this.setNeedsReload('pauseBlocking');
			},
			setWhitelistSite: function () {
				if (this.$('#whitelisting-button').hasClass('disabled')) {
					return;
				}
				sendMessage('panelSiteWhitelistToggle', {
					tab_url: this.model.get('page').url,
					tab_host: this.model.get('page').host
				});
				this.model.set('whitelisted', !this.model.get('whitelisted'));
				this.setNeedsReload('whitelisted');
			},
			initializeStartingStates: function () {
				var needsReload = $.extend(true, {}, this.model.get("needsReload"));

				// Initialize starting state for deciding whether you actually need to reload
				// If it's part of the needsReload object (stored in tabInfo) then it
				// will only be set the first time you open the panel after a page load
				if (!needsReload.startingStates) {
					needsReload.startingStates = [];
					if (this.model.get("pauseBlocking")) {
						needsReload.startingStates.push("pauseBlocking");
					}
					if (this.model.get("whitelisted")) {
						needsReload.startingStates.push("whitelisted");
					}
				}

				sendMessage('needsReload', {
					needsReload: needsReload,
					tab_id: this.model.get('tabId')
				});
				this.model.set('needsReload', needsReload);
			},
			setNeedsReload: function (updated) {
				// Backbone doesn't recognize adding/removing an item from
				// an object or array as 'changing' it, clone to create new ref
				var needsReload = $.extend(true, {}, this.model.get("needsReload"));

				// Add/remove what changed to needsReload object
				if (needsReload.changes[updated]) {
					delete needsReload.changes[updated];
				} else {
					needsReload.changes[updated] = true;
				}

				sendMessage('needsReload', {
					needsReload: needsReload,
					tab_id: this.model.get('tabId')
				});
				this.model.set('needsReload', needsReload);
			},

			// Update functions
			updateLanguage: function () {
				i18n.init(this.model.get('language'));
				this.render();
				this.renderTrackers();
				this.model.trigger('change:whitelisted change:trackers change:page change:pauseBlocking change:validProtocol change:notScanned change:conf change:needsReload change:showTutorial');
			},
			updatePauseBlocking: function () {
				var $button = this.$('#pause-blocking-button');

				if (!this.model.get('validProtocol')) {
					$button.addClass('disabled');
					return;
				}

				$button.removeClass('disabled');

				if (this.model.get('pauseBlocking')) {
					$button.children().text(t('panel_button_resume_blocking'));
					this.$('.app-global-blocking').addClass('paused');
				} else {
					$button.children().text(t('panel_button_pause_blocking'));
					this.$('.app-global-blocking').removeClass('paused');
				}
			},
			updateWhitelistSite: function () {
				var $button = this.$('#whitelisting-button');

				if (!this.model.get('validProtocol')) {
					$button.addClass('disabled');
					return;
				}

				$button.removeClass('disabled');

				if (this.model.get('whitelisted')) {
					$button.children().text(t('panel_button_undo_whitelist_site'));
					this.$('.app-global-blocking').addClass('whitelisted');
				} else {
					$button.children().text(t('panel_button_whitelist_site'));
					this.$('.app-global-blocking').removeClass('whitelisted');
				}
			},
			updateGhosteryFindingsText: function () {
				var $panel_title = this.$('#ghostery-findings-text'),
					num_apps = (this.model.get('trackers') ? this.model.get('trackers').length : 0),
					validProtocol = this.model.get('validProtocol'),
					paused = this.model.get('pauseBlocking'),
					whitelisted = this.model.get('whitelisted');

				// Set findings panel host
				this.$('#website-url').text(validProtocol ? this.model.get('page').host : '');

				// Set findings panel title
				if (!validProtocol) {
					$panel_title.html(t('panel_title_not_scanned'));
				} else if (paused) {
					// Pulled the span placeholders out of this string so we can reuse without
					$panel_title.html(t('panel_title_paused', "<span class='yellow'>", "</span>"));
				} else if (whitelisted) {
					$panel_title.html(t('panel_title_whitelisted', "<span class='light-green'>", "</span>"));
				} else {
					$panel_title.html(t('panel_title_' + (num_apps == 1 ? 'singular' : 'plural'), num_apps));
				}
			},
			getNeedsReload: function () {
				var needsReload = this.model.get("needsReload"),
					start = needsReload.startingStates;

				// Wasn't paused on load, any change needs reload
				if (!start || start.length === 0) {
					return _.size(needsReload.changes) > 0;

				// Was whitelisted on load, only need reload if whitelist turned off and paused not turned on
				} else if (start.length === 1 && start[0] === "whitelisted") {
					return needsReload.changes.whitelisted && !needsReload.changes.pauseBlocking;

				// Was paused on load, only need reload if paused turned off and whitelist not turned on
				} else if (start.length === 1 && start[0] === "pauseBlocking") {
					return needsReload.changes.pauseBlocking && !needsReload.changes.whitelisted;

				// Started whitelisted and paused, both must be turned off to need reload
				} else if (start.length === 2) {
					return needsReload.changes.pauseBlocking && needsReload.changes.whitelisted;
				}
			},
			updateNotification: function () {
				var paused = this.model.get('pauseBlocking'),
					whitelisted = this.model.get('whitelisted'),
					needsReload,
					that = this,
					newNotification;

				needsReload = this.getNeedsReload();

				if (paused && needsReload) {
					newNotification = "pr";
				} else if (paused) {
					newNotification = "p";
				} else if (whitelisted && needsReload) {
					newNotification = "wr";
				} else if (whitelisted) {
					newNotification = "w";
				} else if (needsReload) {
					newNotification = "r";
				} else {
					newNotification = "n";
				}

				// Don't refresh the notification if it hasn't changed
				// Update (and initially set) currentNotification
				if (!this.currentNotification || this.currentNotification !== newNotification) {
					this.hideNotification();

					// Delay showing to notification to allow hiding to finish and
					// ensure all backbone models have been updated
					setTimeout(function () { that.showNotification(newNotification); }, 100);

					this.currentNotification = newNotification;
				}
			},
			showNotification: function (newNotification) {
				// 6 possible states of the notification:
				// nothing, reload, pause, pause + reload, whitelist, whitelist + reload
				switch (newNotification) {
					case 'n':
						break;
					case 'r':
						this.$("#reload").addClass("showing", "fast");
						this.$("#apps-div").addClass("notification", "fast");
						break;
					case 'p':
						this.$("#paused").addClass("showing", "fast");
						this.$("#apps-div").addClass("notification", "fast");
						if (!this.model.get('MOBILE_MODE')) {
							this.arrowTimeout = setTimeout(function () { $("#paused-arrow").addClass("showing", "fast"); }, 350);
						}
						break;
					case 'pr':
						this.$("#paused").addClass("showing-double", "fast");
						this.$("#apps-div").addClass("notification-double", "fast");
						if (!this.model.get('MOBILE_MODE')) {
							this.arrowTimeout = setTimeout(function () { $("#paused-arrow").addClass("showing", "fast"); }, 350);
						}
						break;
					case 'w':
						this.$("#whitelisted").addClass("showing", "fast");
						this.$("#apps-div").addClass("notification", "fast");
						if (!this.model.get('MOBILE_MODE')) {
							this.arrowTimeout = setTimeout(function () { $("#whitelisted-arrow").addClass("showing", "fast"); }, 350);
						}
						break;
					case 'wr':
						this.$("#whitelisted").addClass("showing-double", "fast");
						this.$("#apps-div").addClass("notification-double", "fast");
						if (!this.model.get('MOBILE_MODE')) {
							this.arrowTimeout = setTimeout(function () { $("#whitelisted-arrow").addClass("showing", "fast"); }, 350);
						}
						break;
				}
			},
			hideNotification: function () {
				if (this.arrowTimeout) {
					clearTimeout(this.arrowTimeout);
				}
				this.$("#reload, #paused, #whitelisted").removeClass("showing showing-double", "fast");
				this.$("#apps-div").removeClass("notification notification-double", "fast");
				this.$("#paused-arrow, #whitelisted-arrow").removeClass("showing", "fast");
			},
			updateTutorial: function () {
				var tutorial = this.$('#tutorial-container'),
					help_button = this.$('#help-button'),
					showTutorial = this.model.get('showTutorial');

				if (showTutorial) {
					this.tutorialNavigation();
					tutorial.show();
					help_button.addClass('down');
					$(window).bind('keydown', _.bind(function (e) {
						if (e.keyCode == 39 || e.keyCode == 37) {
							this.tutorialNavigation(e.keyCode);
						}
					}, this));
				}
			},

			// Toggle functions
			toggleSettings: function () {
				this.$('#apps-div').animate({ top: (this.$('#settings').is(':visible') ? '55px' : '105px') }, {
					duration: 'fast'
				});
				this.$('#settings-button').toggleClass('selected', this.$('#settings').is(':hidden'));
				this.$('#settings').slideToggle({
					duration: 'fast',
					complete: _.bind(function () {
						this.$('#settings-button').toggleClass('selected', !this.$('#settings').is(':hidden'));
					}, this)
				});
			},
			toggleTutorial: function () {
				var tutorial = this.$('#tutorial-container'),
					help_button = this.$('#help-button');

				tutorial.toggle();

				if (tutorial.is(":visible")) {
					this.tutorialNavigation();
					help_button.addClass('down');
					$(window).bind('keydown', _.bind(function (e) {
						if (e.keyCode == 39 || e.keyCode == 37) {
							this.tutorialNavigation(e.keyCode);
						}
					}, this));
				} else {
					help_button.removeClass('down');
					$(window).unbind('keydown');
					sendMessage('panelShowTutorialSeen');
					this.model.set('showTutorial', false, { silent: true });
				}
			},

			// Helper functions

			// returns true when we just changed a particular attribute, and only that attribute
			justChangedOnly: function (attr) {
				return this.model.changed.hasOwnProperty(attr) && _.size(this.model.changed) == 1;
			},

			reloadTab: function (e) {
				sendMessage('reloadTab', {
					tab_id: +this.model.get('tabId')
				});
				this.hidePanel(true);
				e.preventDefault();
			},

			hidePanel: function (backToTab) {
				if (this.$('#settings').is(':visible')) {
					this.toggleSettings();
				}
				sendMessage('panelClose', {
					backToTab: backToTab && +this.model.get('tabId')
				});
			},

			handleLink: function (e) {
				openTab(e.target.href);
				this.hidePanel();
				e.preventDefault();
			},

			tooltip: function (element) {
				var $tooltip = this.$('#tooltip');

				// Reset timer
				this.model.set('tooltipTimer', null);

				function determineLocation(windowWidth, windowHeight, mouseX, mouseY) {
					var top,
						right,
						bottom,
						left;

					if (mouseX > windowWidth / 2) {
						left = 'auto';
						right = (windowWidth - mouseX) + 'px';
					} else {
						left = mouseX + 'px';
						right = 'auto';
					}

					if (mouseY > windowHeight / 2) {
						top = 'auto';
						bottom = (windowHeight - mouseY) + 'px';
					} else {
						top = mouseY + 'px';
						bottom = 'auto';
					}

					return {
						top: top,
						right: right,
						bottom: bottom,
						left: left
					};
				}

				$(element)
					.unbind('mouseenter mouseout')
					.bind({
						mouseenter: _.bind(function (e) {
							var tooltipTimer = this.model.get('tooltipTimer');

							if (tooltipTimer !== null) {
								window.clearTimeout(tooltipTimer);
								$tooltip.text(element.getAttribute('title'));
								$tooltip.css(determineLocation($(window).width(), $(window).height(), e.pageX, e.pageY));
								$tooltip.show();
							} else {
								this.model.set('tooltipTimer', window.setTimeout(function () {
									$tooltip.text(element.getAttribute('title'));
									$tooltip.css(determineLocation($(window).width(), $(window).height(), e.pageX, e.pageY));
									$tooltip.show();
								}, 1500));
							}
						}, this),
						mouseout: _.bind(function () {
							var tooltipTimer = this.model.get('tooltipTimer');

							if (tooltipTimer !== null) {
								window.clearTimeout(tooltipTimer);
							}

							this.model.set('tooltipTimer', window.setTimeout(_.bind(function () {
								this.model.set('tooltipTimer', null);
								$tooltip.fadeOut({
									duration: 'fast'
								});
							}, this), 10));
						}, this)
					});
			},

			// Tutorial helper functions
			tutorialNavigation: function (newPosition) {
				var i,
					currScreenIndex,
					nextScreenIndex,
					$screens = this.$('.tutorial-screen'),
					$controls = this.$('.tutorial-control'),
					$arrowLeft = this.$('#tutorial-arrow-left'),
					$arrowRight = this.$('#tutorial-arrow-right');
				
				// Find current screen index
				for (i = 0; i < $screens.length; i++) {
					if ($screens.eq(i).is(':visible')) {
						currScreenIndex = i;
						break;
					}
				}

				if (!newPosition) { // Reset tutorial to first screen
					for (i = 0; i < $screens.length; i++) {
						if (i === 0) {
							$screens.eq(i).css('display', 'table');
							continue;
						}

						$screens.eq(i).hide();
					}

					nextScreenIndex = 0;
					this.blinkTutorialArrow('right', true);
					this.model.set('tutorialArrowBlinkTimeout', window.setTimeout(_.bind(function () {
						this.blinkTutorialArrow('right');
					}, this), 3000));
				} else if (newPosition == 'next' || newPosition == 39) { // Left arrow or left-arrow key
					nextScreenIndex = i + 1;
					if (nextScreenIndex > $screens.length - 1) {
						return;
					}

					this.blinkTutorialArrow('right', true);
				} else if (newPosition == 'prev' || newPosition == 37) { // Right arrow or right-arrow key
					nextScreenIndex = i - 1;
					if (nextScreenIndex < 0) {
						return;
					}

					this.blinkTutorialArrow('right', true);
				} else { // Bottom nav controls
					nextScreenIndex = parseInt(newPosition.id.replace('tutorial-control-', ''), 10) - 1;
					this.blinkTutorialArrow('right', true);
				}

				// Slide screens
				$screens.eq(currScreenIndex).hide();
				$screens.eq(nextScreenIndex).css('display', 'table');

				// Update bottom controls
				$controls.eq(currScreenIndex).removeClass('on');
				$controls.eq(nextScreenIndex).addClass('on');

				// Update arrows
				if (nextScreenIndex === 0) {
					$arrowLeft.addClass('off');
					$arrowRight.removeClass('off');
				} else if (nextScreenIndex == $screens.length - 1) {
					sendMessage('panelShowTutorialSeen');
					$arrowRight.addClass('off');
					$arrowLeft.removeClass('off');
				} else {
					$arrowLeft.removeClass('off');
					$arrowRight.removeClass('off');
				}
			},
			blinkTutorialArrow: function (direction, stop) {
				var $arrow = this.$('#tutorial-arrow-' + direction),
					count = 0;

				if (stop) {
					$arrow.removeClass('blink');
					window.clearInterval(this.model.get('tutorialArrowBlinkInterval'));
					window.clearTimeout(this.model.get('tutorialArrowBlinkTimeout'));
					return;
				}

				this.model.set('tutorialArrowBlinkInterval', window.setInterval(_.bind(function () {
					if ($arrow.hasClass('blink')) {
						$arrow.removeClass('blink');
						if (count > 6) {
							window.clearInterval(this.model.get('tutorialArrowBlinkInterval'));
							return;
						}
					} else {
						$arrow.addClass('blink');
					}
					count++;
				}, this), 500));
			}
		}),

		Tracker: Backbone.View.extend({
			tagName: 'div',
			className: 'app-div',
			template: getTemplate('_panel_app'),
			initialize: function () {
				this.model.on('change:globalBlocked', this.updateGlobalBlock, this);
				this.model.on('change:siteSpecificUnblocked', this.updateSiteSelectiveUnblock, this);
			},
			events: {
				'click .app-info-container': 'toggleSources',
				'mousedown .app-global-blocking': 'setGlobalBlock',
				'click .app-site-blocking': 'setSiteSpecificUnblock',
				'click .app-moreinfo-link': 'handleLink',
				'click .app-src-link': 'handleLink'
			},

			// Render functions
			render: function () {
				this.el.innerHTML = this.template(this.model.toJSON());

				this.$('.tracker-alert').tooltip({
					placement: function (tooltip, ele) {
						var $container = $('#apps-div'),
							containerHeight = $container.height(),
							tooltipHeight = 48,
							tooltipOffsetTop = $(ele).offset().top;

						return tooltipOffsetTop > containerHeight - tooltipHeight ? 'top' : 'bottom';
					}
				});

				return this;
			},

			// Set functions
			setGlobalBlock: function () {
				var blocked = this.model.get('globalBlocked'),
					app_id = this.model.get('id');

				sendMessage('panelSelectedAppsUpdate', {
					app_id: app_id,
					app_selected: !blocked
				});

				this.model.set('globalBlocked', !blocked);
				panel.setNeedsReload(app_id);
			},

			setSiteSpecificUnblock: function () {
				var unblocked = this.model.get('siteSpecificUnblocked'),
					app_id = this.model.get('id');

				sendMessage('panelSiteSpecificUnblockUpdate', {
					app_id: app_id,
					siteSpecificUnblocked: !unblocked,
					tab_host: panel.model.get('page').host
				});

				this.model.set('siteSpecificUnblocked', !unblocked);
				panel.setNeedsReload("site_" + app_id);
			},

			// Update functions
			updateGlobalBlock: function () {
				var blocked = this.model.get('globalBlocked');

				this.$('.blocking-controls')
					.tooltip('destroy')
					.tooltip({
						trigger: 'manual',
						title: t('panel_tracker_global_block_message_' + (blocked ? 'blocked' : 'unblocked')),
						placement: 'left'
					})
					.tooltip('show');

				window.clearTimeout(this.model.get('tooltipTimer'));
				this.model.set('tooltipTimer', window.setTimeout(_.bind(function () {
					this.$('.blocking-controls').tooltip('destroy');
				}, this), 1400));

				if (!blocked) {
					this.$('.app-global-blocking').animate({ backgroundPosition: '1px' }, {
						duration: 'fast',
						complete: function () {
							$(this).removeClass('blocked').addClass('unblocked');
							$(this).parent().removeClass('blocked').addClass('unblocked');
						}
					});
				} else {
					this.$('.app-global-blocking').animate({ backgroundPosition: '21px' }, {
						duration: 'fast',
						complete: function () {
							$(this).removeClass('unblocked').addClass('blocked');
							$(this).parent().removeClass('unblocked').addClass('blocked');
						}
					});
				}
			},
			updateSiteSelectiveUnblock: function () {
				var siteSpecificUnblocked = this.model.get('siteSpecificUnblocked'),
					host = panel.model.get('page').host;

				if (siteSpecificUnblocked) {
					this.$('.blocking-controls')
						.tooltip('destroy')
						.tooltip({
							trigger: 'manual',
							html: true,
							title: t('panel_tracker_site_specific_unblock_message', host),
							placement: 'left'
						})
						.tooltip('show');

					window.clearTimeout(this.model.get('tooltipTimer'));
					this.model.set('tooltipTimer', window.setTimeout(_.bind(function () {
						this.$('.blocking-controls').tooltip('destroy');
					}, this), 1400));
				}

				if (siteSpecificUnblocked) {
					this.$('.app-site-blocking')
						.removeClass('off').addClass('on')
						.attr('title', t('panel_tracker_site_specific_unblock_tooltip_on', this.model.get('name'), host));
				} else {
					this.$('.app-site-blocking')
						.removeClass('on').addClass('off')
						.attr('title', t('panel_tracker_site_specific_unblock_tooltip_off', this.model.get('name'), host));
				}
			},

			// Toggle functions
			toggleSources: function () {
				this.$('.app-arrow').toggleClass('down', !this.$('.app-srcs-container').is(':visible'));

				this.$('.app-moreinfo').slideToggle({
					duration: 'fast'
				});

				this.$('.app-srcs-container').slideToggle({
					duration: 'fast',
					complete: _.bind(function () {
						this.$('.app-arrow').toggleClass('down', this.$('.app-srcs-container').is(':visible'));
					}, this)
				});
			},

			handleLink: function (e) {
				openTab(e.target.href);
				panel.hidePanel();
				e.preventDefault();
			}
		})
	};

	function openTab(url, local, new_window) {
		sendMessage('panelOpenLinkInTab', {
			url: url,
			local: local,
			new_window: new_window
		});
	}

	function sendMessage(name, message) {
		self.port.emit(name, message);
	}

	var panel = new Views.Panel({
		model: new Models.Panel({})
	});

	return panel;
})();
