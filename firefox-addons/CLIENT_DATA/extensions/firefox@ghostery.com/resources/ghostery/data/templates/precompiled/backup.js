var __templates=__templates||{};
__templates["backup"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+=''+
((__t=( _header({
	ratelink_url: 'https://addons.mozilla.org/en-US/firefox/addon/ghostery/',
	show_tabs: false,
	show_walkthrough_link: false,
	show_walkthrough_progress: false,
	show_walkthrough_skip: false,
	survey_link: true,
	MOBILE_MODE: MOBILE_MODE
}) ))==null?'':__t)+
'\n\n<div class="options-div" id="general-options">\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t('backup_export_header') ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\n\t\t<div class="options-content" style="';
 if (!MOBILE_MODE) print('overflow:auto;') 
__p+='">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('backup_export') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<br />\n\t\t\t<button id="backup-button" class="blue-button" disabled>\n\t\t\t\t<span>'+
((__t=( t('backup_export_button') ))==null?'':_.escape(__t))+
'</span>\n\t\t\t</button>\n\t\t</div>\n\t</div>\n\n\t<div class="options-row">\n\t\t<div class="options-header">\n\t\t\t'+
((__t=( t('backup_import_header') ))==null?'':_.escape(__t))+
'\n\t\t</div>\n\n\t\t<div class="options-content" style="';
 if (!MOBILE_MODE) print('overflow:auto;') 
__p+='">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('backup_import') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t('backup_import_warning') ))==null?'':_.escape(__t))+
'\n\t\t\t</p>\n\t\t\t<br />\n\n\t\t\t<input type="file" id="restore-file"></input>\n\t\t\t<br />\n\t\t\t<button id="restore-button" class="blue-button" disabled>\n\t\t\t\t<span>'+
((__t=( t('backup_import_button') ))==null?'':_.escape(__t))+
'</span>\n\t\t\t</button>\n\n\t\t\t<div id="restore-error" style="display: none">\n\t\t\t\t'+
((__t=( t('backup_import_error') ))==null?'':__t)+
'\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\n\n\t<div class="options-row">\n\t\t<div class="options-header"> </div>\n\n\t\t<div class="options-content">\n\t\t\t<a href="options.html">'+
((__t=( t('backup_options_link') ))==null?'':_.escape(__t))+
'</a>\n\t\t</div>\n\t</div>\n\n</div>\n\n<div id="saving-options-notice-overlay"></div>\n<div id="saving-options-notice">\n\t<div>'+
((__t=( t("options_saving_exit_message") ))==null?'':_.escape(__t))+
'</div>\n</div>';
}
return __p;
};