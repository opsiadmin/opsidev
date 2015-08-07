var __templates=__templates||{};
__templates["options"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+=''+
((__t=( _header({
	ratelink_url: 'https://addons.mozilla.org/en-US/firefox/addon/ghostery/',
	show_tabs: true,
	show_walkthrough_link: true,
	show_walkthrough_progress: false,
	show_walkthrough_skip: false,
	survey_link: true,
	MOBILE_MODE: MOBILE_MODE
}) ))==null?'':__t)+
'\n\n<div class="options-div" id="general-options">\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_sharing_header") ))==null?'':_.escape(__t))+
'</h2>\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t'+
((__t=( _ghostrank({
				tm: true
			}) ))==null?'':__t)+
'\n\t\t\t<br />\n\t\t\t<input type="checkbox" id="ghostrank"';
 if (conf.ghostrank) print(' checked') 
__p+='>\n\t\t\t<label for="ghostrank">'+
((__t=( t("options_ghostrank") ))==null?'':_.escape(__t))+
'</label>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_autoupdate_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t("walkthrough_autoupdate1") ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<br />\n\t\t\t<input type="checkbox" id="enable_autoupdate"';
 if (conf.enable_autoupdate) print(' checked') 
__p+='>\n\t\t\t<label id="update" for="enable_autoupdate">'+
((__t=( t("options_autoupdate") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t<br />\n\t\t\t<input type="checkbox" style="visibility:hidden">\n\t\t\t<span style="font-size:small; padding-left:3px">\n\t\t\t\t<span id="apps-last-updated">\n\t\t\t\t\t'+
((__t=( t('library_never_updated') ))==null?'':_.escape(__t))+
'\n\t\t\t\t</span>\n\t\t\t\t<span id="update-now-span">\n\t\t\t\t\t<a href="#" id="update-now-link" aria-label="Press to immediately update Ghostery tracker lists">'+
((__t=( t('library_update_now_link') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t</span>\n\t\t\t</span>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_blocking_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t("options_blocking1") ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<p style="margin-bottom:25px">\n\t\t\t\t<em>'+
((__t=( t("note") ))==null?'':_.escape(__t))+
'</em>\n\t\t\t\t'+
((__t=( t("options_blocking2") ))==null?'':__t)+
'\n\t\t\t</p>\n\n\t\t\t<div id="tabs-apps-container">\n\t\t\t\t<ul class="tabs app-browser-tabs" id="tabs-apps" role="navigation">\n\t\t\t\t\t<li class="active" id="apps-tab" href="#apps" data-tab-contents-selector="#trackers-app-browser" aria-label="Tracker browser tab">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t("options_trackers_tab") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li id="apps-tab2" href="#apps" data-tab-contents-selector="#lsos-app-browser" aria-label="Cookie browser tab">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t("options_lsos_tab") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li id="sites-tab" href="#sites" data-tab-contents-selector="#whitelist-div" aria-label="Blocking-exempt sites tab">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t("options_sites_tab") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t</ul>\n\t\t\t</div>\n\t\t\t<div style="clear: both;"></div>\n\n\t\t\t'+
((__t=( _app_browser({ _select: _select, type: 'trackers' }) ))==null?'':__t)+
'\n\t\t\t'+
((__t=( _app_browser({ _select: _select, type: 'lsos' }) ))==null?'':__t)+
'\n\t\t\t<div id="whitelist-div" class="app-browser" style="display:none;">\n\t\t\t\t<div class="whitelist-top-header">\n\t\t\t\t\t<p>'+
((__t=( t("site_whitelist_description") ))==null?'':_.escape(__t))+
'</p>\n\t\t\t\t</div>\n\t\t\t\t<div class="whitelist-header">\n\t\t\t\t\t'+
((__t=( t("site_whitelist_help") ))==null?'':_.escape(__t))+
'\n\t\t\t\t</div>\n\t\t\t\t<div class="whitelist-content">\n\t\t\t\t\t<div class="whitelist-content-left">\n\t\t\t\t\t\t<input type="text" id="whitelist-add-input" value="" autocomplete="off" placeholder="example.com">\n\t\t\t\t\t\t<div id="whitelist-error" style="display:none">\n\t\t\t\t\t\t\t<span id=\'whitelist-error-msg\'></span>\n\t\t\t\t\t\t\t<span id="whitelist-error-msg-close"></span>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="whitelist-content-right">\n\t\t\t\t\t\t<button id="whitelist-add-button" class="blue-button">\n\t\t\t\t\t\t\t<span>'+
((__t=( t("whitelist_add_button") ))==null?'':_.escape(__t))+
'</span>\n\t\t\t\t\t\t</button>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\n\t\t\t\t<div class="whitelist-header">\n\t\t\t\t\t'+
((__t=( t("whitelisted_sites_header") ))==null?'':_.escape(__t))+
'\n\t\t\t\t</div>\n\t\t\t\t<div class="whitelist-content">\n\t\t\t\t\t<div class="whitelist-content-left">\n\t\t\t\t\t\t<select multiple="multiple" id="whitelist"></select>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="whitelist-content-right">\n\t\t\t\t\t\t<button id="whitelist-remove-button" class="blue-button">\n\t\t\t\t\t\t\t<span>'+
((__t=( t("whitelist_remove_button") ))==null?'':_.escape(__t))+
'</span>\n\t\t\t\t\t\t</button>\n\t\t\t\t\t\t<br />\n\t\t\t\t\t\t<button id="whitelist-remove-all-button" class="blue-button" style="margin-top:10px">\n\t\t\t\t\t\t\t<span>'+
((__t=( t("whitelist_remove_all_button") ))==null?'':_.escape(__t))+
'</span>\n\t\t\t\t\t\t</button>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n</div>\n\n<div class="options-div" id="advanced-options" style="display:none">\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_display_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="show-alert"';
 if (conf.show_alert) print(' checked') 
__p+='>\n\t\t\t\t<label for="show-alert">\n\t\t\t\t\t'+
((__t=( t('options_alert_bubble_show', '<span id="alert-bubble-help" class="help">' + t('alert_bubble') + '</span>') ))==null?'':__t)+
'\n\t\t\t\t</label>\n\t\t\t</p>\n\t\t\t<div id="alert-bubble-options"';
 if (!conf.show_alert) print (' style="display:none"') 
__p+='>\n\t\t\t\t<p class="suboption">\n\t\t\t\t\t'+
((__t=( t('options_alert_bubble_position', _select({
						id: 'alert-bubble-pos',
						options: [
							{ name: t("corner1"), value: 'tr' },
							{ name: t("corner2"), value: 'tl' },
							{ name: t("corner3"), value: 'br' },
							{ name: t("corner4"), value: 'bl' }
						],
						selected: conf.alert_bubble_pos
					})) ))==null?'':__t)+
'\n\t\t\t\t</p>\n\t\t\t\t<p class="suboption">\n\t\t\t\t\t'+
((__t=( t('options_alert_bubble_timeout', _select({
						id: "alert-bubble-timeout",
						options: [60, 30, 25, 20, 15, 10, 5, 3],
						selected: +conf.alert_bubble_timeout
					})) ))==null?'':__t)+
'\n\t\t\t\t</p>\n\t\t\t</div>\n\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="expand_sources"';
 if (conf.expand_sources) print(' checked') 
__p+='>\n\t\t\t\t<label for="expand_sources">'+
((__t=( t('options_script_sources') ))==null?'':_.escape(__t))+
'</label>\n\t\t\t\t'+
((__t=( t('options_in_the_findings_panel') ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<p style="';
 if (!MOBILE_MODE) print('display:none') 
__p+='">\n\t\t\t\t<input type="checkbox" id="show_button"';
 if (conf.show_button) print(' checked') 
__p+='>\n\t\t\t\t<label for="show_button"><span id="show-button" class="help">'+
((__t=( t('options_show_button_firefox') ))==null?'':_.escape(__t))+
'</span></label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="show_badge"';
 if (conf.show_badge) print(' checked') 
__p+='>\n\t\t\t\t<label for="show_badge">'+
((__t=( t('options_badge') ))==null?'':__t)+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="xul_panel"';
 if (conf.xul_panel) print(' checked') 
__p+='>\n\t\t\t\t<label for="xul_panel"><span id="xul-panel" class="help">'+
((__t=( t('options_xul_panel_firefox') ))==null?'':_.escape(__t))+
'</span></label>\n\t\t\t</p>\n\n\t\t\t';
 if (!MOBILE_MODE) { 
__p+='\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="re_add_ghosty">\n\t\t\t\t<label for="re_add_ghosty"><span>'+
((__t=( t('options_restore_button_help_firefox') ))==null?'':_.escape(__t))+
'</span></label>\n\t\t\t</p>\n\t\t\t';
 } 
__p+='\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_blocking_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="ignore-first-party"';
 if (conf.ignore_first_party) print(' checked') 
__p+='>\n\t\t\t\t<label for="ignore-first-party">'+
((__t=( t("options_ignore_first_party") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t\t<span id="ignore-first-party-help">\n\t\t\t\t\t'+
((__t=( t("options_ignore_first_party_help") ))==null?'':_.escape(__t))+
'\n\t\t\t\t</span>\n\t\t\t</p>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_autoupdate_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="block-by-default"';
 if (conf.block_by_default) print(' checked') 
__p+='>\n\t\t\t\t<label for="block-by-default">'+
((__t=( t("options_block_by_default") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="notify-library-updates"';
 if (conf.notify_library_updates) print(' checked') 
__p+='>\n\t\t\t\t<label for="notify-library-updates">'+
((__t=( t("options_notify_of_library_updates") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_click2play_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="click2play"';
 if (conf.enable_click2play) print(' checked') 
__p+='>\n\t\t\t\t<label for="click2play">'+
((__t=( t("options_click2play1") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" style="visibility:hidden">\n\t\t\t\t<label><span id="click2play-help" class="help">'+
((__t=( t("options_click2play2")))==null?'':_.escape(__t))+
'</span></label>\n\t\t\t</p>\n\n\t\t\t<p id="show-c2p-buttons"';
 if (!conf.enable_click2play) print(' style="display:none"') 
__p+='>\n\t\t\t\t<input style="margin-left:40px" type="checkbox" id="click2play-buttons"';
 if (conf.enable_click2play_social) print(' checked') 
__p+='>\n\t\t\t\t<label for="click2play-buttons">'+
((__t=( t("options_click2play_buttons1") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t\t<span id="click2play-buttons-help" class="help">\n\t\t\t\t\t'+
((__t=( t("options_click2play_buttons2") ))==null?'':_.escape(__t))+
'\n\t\t\t\t</span>\n\t\t\t</p>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_language_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t';

			// ensure that "Show Ghostery in LANGUAGE" is grammatical in that language
			languages[conf.language] = t('options_language_language');

			// convert to _select's format
			languages = _(languages)
				.chain()
				.reduce(function (memo, value, key) {
					memo.push({
						name: value,
						value: key
					});
					return memo;
				}, [])
				.sortBy(function (l) { return l.value; })
				.value();
			
__p+='\n\t\t\t'+
((__t=( t('options_language', _select({
				id: 'language',
				options: languages,
				selected: conf.language
			})) ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t('options_backup_header') ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t<a href="backup.html">'+
((__t=( t('options_backup') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t</p>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("options_performance_header_firefox") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="block-images"';
 if (conf.block_images) print(' checked') 
__p+='>\n\t\t\t\t<label for="block-images">'+
((__t=( t("options_block_images_firefox") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="block-frames"';
 if (conf.block_frames) print(' checked') 
__p+='>\n\t\t\t\t<label for="block-frames">'+
((__t=( t("options_block_frames_firefox") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="block-objects"';
 if (conf.block_objects) print(' checked') 
__p+='>\n\t\t\t\t<label for="block-objects">'+
((__t=( t("options_block_objects_firefox") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="prevent-redirection"';
 if (conf.prevent_redirection) print(' checked') 
__p+='>\n\t\t\t\t<label for="prevent-redirection">'+
((__t=( t("options_prevent_redirection") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<input type="checkbox" id="delete-fl-sl-cookies"';
 if (conf.delete_fl_sl_cookies) print(' checked') 
__p+='>\n\t\t\t\t<label for="delete-fl-sl-cookies">'+
((__t=( t("options_delete_fl_sl_cookies_firefox") ))==null?'':_.escape(__t))+
'</label>\n\t\t\t</p>\n\t\t</div>\n\t</div>\n</div>\n\n<div class="options-div" id="about-options" style="display:none">\n\t\n\t<div class="options-row">\n\t\t<h1>'+
((__t=( t("help_version_text", "Firefox", ghostery_version) ))==null?'':_.escape(__t))+
'</h1>\n\t\t<p>\n\t\t\t'+
((__t=( t("short_description") ))==null?'':_.escape(__t))+
'\n\t\t</p>\n\t\t<p id="about-links">\n\t\t\t<a class="about-link" href="https://www.ghostery.com/'+
((__t=( conf.language ))==null?'':_.escape(__t))+
'/eula" target="_blank">'+
((__t=( t("license_link") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t<span class="vr"></span>\n\t\t\t<a class="about-link" href="https://www.ghostery.com/'+
((__t=( conf.language ))==null?'':_.escape(__t))+
'/privacy-addon" target="_blank">'+
((__t=( t("privacy_policy_link") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t<span class="vr"></span>\n\t\t\t<a class="about-link" href="https://www.ghostery.com" target="_blank">'+
((__t=( t("homepage_link") ))==null?'':_.escape(__t))+
'</a>\n\t\t</p>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("help_help_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t("help_text1") ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t("help_text2") ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t("help_credits_header") ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\t\t<div class="options-content">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t("credits_description") ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<ul id="code-libraries">\n\t\t\t\t';
 _(libraries)
					.chain()
					.sortBy(function (l) { return l.name.toLowerCase() })
					.each(function (library, i) {
						library.id = i 
__p+='\n\t\t\t\t\t\t'+
((__t=( _library_li(library, { variable: 'library' }) ))==null?'':__t)+
'\n\t\t\t\t\t';
 }) 
__p+='\n\t\t\t</ul>\n\t\t</div>\n\t</div>\n</div>\n\n<div>\n\t<div class="options-row" id="buttons-row">\n\t\t<div class="options-header">&nbsp;</div>\n\t\t<div class="options-content">\n\t\t\t<div id="buttons">\n\t\t\t\t<button class="save-button blue-button" disabled>\n\t\t\t\t\t<span>'+
((__t=( t("options_save_button") ))==null?'':_.escape(__t))+
'</span>\n\t\t\t\t</button>\n\t\t\t\t<button class="cancel-button blue-button" disabled>\n\t\t\t\t\t<span>'+
((__t=( t("options_cancel_button") ))==null?'':_.escape(__t))+
'</span>\n\t\t\t\t</button>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\t<div class="options-row" id="footer-row">\n\t\t<div class="options-header">&nbsp;</div>\n\t\t<div class="options-content">\n\t\t\t'+
((__t=( _footer() ))==null?'':__t)+
'\n\t\t</div>\n\t</div>\n</div>\n\n<div id="saving-options-notice-overlay"></div>\n<div id="saving-options-notice">\n\t<div>'+
((__t=( t("options_saving_exit_message") ))==null?'':_.escape(__t))+
'</div>\n</div>\n\n'+
((__t=( _block_by_default_helper() ))==null?'':__t)+
'';
}
return __p;
};