var __templates=__templates||{};
__templates["walkthrough"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+=''+
((__t=( _header({
	show_tabs: false,
	show_walkthrough_link: false,
	show_walkthrough_progress: true,
	show_walkthrough_skip: true,
	MOBILE_MODE: MOBILE_MODE
}) ))==null?'':__t)+
'\n\n<a href="#" id="arrow-prev" class="arrow" tabindex="1" role="navigation" aria-label="previous section" style="display:none"></a>\n<a href="#" id="arrow-next" class="arrow" tabindex="1" role="navigation" aria-label="next section"></a>\n\n<div id="slider" class="swipe">\n\t<div class="swipe-wrap">\n\n\t\t<div class="options-div">\n\t\t\t<p style="font-weight: bold;">\n\t\t\t\t'+
((__t=( t('welcome_to_ghostery', 'Firefox', '<span id="version-text"></span>') ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_intro1') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_intro2') ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t</div>\n\n\t\t<div class="options-div">\n\t\t\t'+
((__t=( _ghostrank() ))==null?'':__t)+
'\n\t\t\t<p>\n\t\t\t\t<label>\n\t\t\t\t\t<input type="checkbox" id="ghostrank"';
 if (conf.ghostrank) print(' checked') 
__p+='>\n\t\t\t\t\t'+
((__t=( t('walkthrough_ghostrank_checkbox') ))==null?'':_.escape(__t))+
'\n\t\t\t\t</label>\n\t\t\t</p>\n\t\t</div>\n\n\t\t';
 if (!MOBILE_MODE) { 
__p+='\n\t\t<div class="options-div">\n\t\t\t<p>\n\t\t\t\t<img src="images/help/alert_bubble.png" class="example">\n\t\t\t\t'+
((__t=( t('walkthrough_notification1') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_notification2') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\n\t\t\t<p>\n\t\t\t\t<label>\n\t\t\t\t\t<input type="checkbox" id="show-alert"';
 if (conf.show_alert) print(' checked') 
__p+='>\n\t\t\t\t\t'+
((__t=( t('walkthrough_notification_checkbox') ))==null?'':_.escape(__t))+
'\n\t\t\t\t</label>\n\t\t\t</p>\n\n\t\t\t<div style="clear:both"></div>\n\t\t</div>\n\t\t';
 } 
__p+='\n\n\t\t<div class="options-div">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_blocking1') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_blocking2') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_blocking3') ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<p style="margin-bottom: 20px;">\n\t\t\t\t'+
((__t=( t('walkthrough_blocking4') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\n\t\t\t<div id="tabs-apps-container">\n\t\t\t\t<ul class="tabs app-browser-tabs" id="tabs-apps" role="navigation">\n\t\t\t\t\t<li class="active" id="apps-tab" href="#apps" data-tab-contents-selector="#trackers-app-browser" aria-label="Tracker browser tab">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t("options_trackers_tab") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li id="apps-tab2" href="#apps" data-tab-contents-selector="#lsos-app-browser" aria-label="Cookie browser tab">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t("options_lsos_tab") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t</ul>\n\t\t\t</div>\n\t\t\t<div style="clear: both;"></div>\n\t\t\t\n\t\t\t<div id="app-browser">\n\t\t\t\t'+
((__t=( _app_browser({ _select: _select, type: 'trackers' }) ))==null?'':__t)+
'\n\t\t\t\t'+
((__t=( _app_browser({ _select: _select, type: 'lsos' }) ))==null?'':__t)+
'\n\t\t\t</div>\n\n\t\t\t<input type="checkbox" id="block-by-default" style="display:none"';
 if (conf.block_by_default) print(' checked') 
__p+='>\n\n\t\t</div>\n\n\t\t<div class="options-div">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_finished2') ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_finished3') ))==null?'':__t)+
'\n\t\t\t</p>\n\n\t\t\t';
 if (!MOBILE_MODE) { 
__p+='\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('walkthrough_finished4_firefox') ))==null?'':__t)+
'\t\t\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t<button id="add-button" class="blue-button" style="float:none;"><span>'+
((__t=( t('restore_toolbar_button_button_firefox') ))==null?'':_.escape(__t))+
'</span></button>\n\t\t\t</p>\n\t\t\t';
 } 
__p+='\n\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('thanks_for_using_ghostery') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t</div>\n\n\t</div>\n</div>\n\n<div class="options-div">\n\t'+
((__t=( _footer() ))==null?'':__t)+
'\n</div>\n\n'+
((__t=( _block_by_default_helper() ))==null?'':__t)+
'';
}
return __p;
};