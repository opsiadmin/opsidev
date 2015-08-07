var __templates=__templates||{};
__templates["_header"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div id="header">\n\n\t';
 if (show_walkthrough_progress) { 
__p+='\n\t\t<div id="walkthrough-progress">\n\t\t\t<span id="circle1" class="circle active"></span>\n\t\t\t<span id="circle2" class="circle"></span>\n\t\t\t<span id="circle3" class="circle"></span>\n\t\t\t<span id="circle4" class="circle"></span>\n\t\t\t<span id="circle5" class="circle" ';
 if (MOBILE_MODE) print('style="display:none;') 
__p+='></span>\n\t\t\t<div style="clear:both"></div>\n\t\t</div>\n\t';
 } 
__p+='\n\n\t\t<div id="header-top">\n\t\t\t<img id="ghostery-about" src="images/ghostery_about.png" alt="'+
((__t=( t('ghostery_logo') ))==null?'':_.escape(__t))+
'">\n\t\t\t<div id="header-top-text">\n\t\t\t\t\n\t\t\t\t';
 if (show_walkthrough_link && MOBILE_MODE) { 
__p+='\n\t\t\t\t<style>\n\t\t\t\t\t#header-top {\n\t\t\t\t\t\theight:auto !important;\n\t\t\t\t\t}\n\n\t\t\t\t\t#header-top-text {\n\t\t\t\t\t\tposition: static !important;\n\t\t\t\t\t\tpadding-top: 0px !important;\n\t\t\t\t\t}\n\n\t\t\t\t\t#header-rate-survey {\n\t\t\t\t\t\tpadding: 5px;\n\t\t\t\t\t}\n\t\t\t\t</style>\n\t\t\t\t<div style="padding: 15px 20px; background-color: #078ED6; border-radius: 10px; font-size: .9em; margin-top: 10px; color: #fff; top: 20px; right: 50px;">\n\t\t\t\t\t'+
((__t=( t('walkthrough_link') ))==null?'':__t)+
'\n\t\t\t\t</div>\n\t\t\t\t';
 } 
__p+='\n\n\t\t\t\t';
 if (typeof ratelink_url != 'undefined') { 
__p+='\n\t\t\t\t\t<div id="header-rate-survey">\n\t\t\t\t\t\t'+
((__t=( t('rate_ghostery_link1') ))==null?'':_.escape(__t))+
'\n\t\t\t\t\t\t<a href="'+
((__t=( ratelink_url ))==null?'':_.escape(__t))+
'">\n\t\t\t\t\t\t\t'+
((__t=( t('rate_ghostery_link2') ))==null?'':_.escape(__t))+
'\n\t\t\t\t\t\t</a>\n\t\t\t\t\t\t'+
((__t=( t('survey_link_also', 'https://www.ghostery.com/survey') ))==null?'':__t)+
'\n\t\t\t\t\t</div>\n\t\t\t\t';
 } else if (typeof survey_link != 'undefined') { 
__p+='\n\t\t\t\t\t<div id="header-rate-survey">\n\t\t\t\t\t\t'+
((__t=( t('survey_link', 'https://www.ghostery.com/survey') ))==null?'':__t)+
'\n\t\t\t\t\t</div>\n\t\t\t\t';
 } 
__p+='\n\n\t\t\t\t';
 if (show_walkthrough_skip) { 
__p+='\n\t\t\t\t<button id="skip-button" class="blue-button"><span>\n\t\t\t\t\t'+
((__t=( t("walkthrough_skip_button") ))==null?'':_.escape(__t))+
'\n\t\t\t\t</span></button>\n\t\t\t\t';
 } 
__p+='\n\n\t\t\t</div>\n\n\t\t\t<div style="clear: both;"></div>\n\t\t</div>\n\t\t<div id="header-bottom">\n\t\t\t<h1 id="header-title">'+
((__t=( t('options_header') ))==null?'':_.escape(__t))+
'</h1>\n\t\t\t';
 if (show_walkthrough_link && !MOBILE_MODE) { 
__p+='\n\t\t\t\t<div style="max-width: 320px; position: absolute; padding: 15px 20px; background-color: #078ED6; border-radius: 10px; font-size: .9em; margin-top: 10px; color: #fff; top: 20px; right: 50px; text-align: center;">\n\t\t\t\t\t'+
((__t=( t('walkthrough_link') ))==null?'':__t)+
'\n\t\t\t\t\t<!-- For a walkthrough of Ghostery\'s key options,<br />\n\t\t\t\t\ttry the <a href="walkthrough.html" id="walkthrough-link">Ghostery Configuration Wizard</a> -->\n\t\t\t\t</div>\n\t\t\t';
 } 
__p+='\n\t\t\t<div style="clear: both;"></div>\n\t\t\t';
 if (typeof show_tabs != 'undefined' && show_tabs) { 
__p+='\n\t\t\t\t<ul class="tabs" role="navigation">\n\t\t\t\t\t<li class="active" id="general-tab" href="#general" data-tab-contents-selector="#general-options" aria-label="general options section">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t('options_general_tab') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li id="advanced-tab" href="#advanced" data-tab-contents-selector="#advanced-options" aria-label="advanced options section">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t('options_advanced_tab') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li id="about-tab" href="#about" data-tab-contents-selector="#about-options" aria-label="about ghostery section">\n\t\t\t\t\t\t<a href="#">'+
((__t=( t('options_about_tab') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t\t\t</li>\n\t\t\t\t</ul>\n\t\t\t';
 } 
__p+='\n\t\t</div>\n\t\n</div>';
}
return __p;
};