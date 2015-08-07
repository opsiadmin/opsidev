var __templates=__templates||{};
__templates["_app_browser"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div id="'+
((__t=( type ))==null?'':__t)+
'-app-browser" class="app-browser" ';
 if (type != 'trackers') print('style="display:none;"') 
__p+='>\n\n\t<div class="app-browser-header">\n\t\t<div class="app-browser-header-left">\n\t\t\t<span id="block-status-'+
((__t=( type ))==null?'':__t)+
'"></span>\n\t\t\t<br>\n\t\t\t<br>\n\t\t\t<span style="font-size: .75em;">\n\t\t\t\t'+
((__t=( t((type == 'trackers') ? "options_blocking3" : "options_lso_blocking3") ))==null?'':__t)+
'\n\t\t\t</span>\n\t\t</div>\n\t\t<div class="app-browser-header-divider"></div>\n\t\t<div class="app-browser-header-right">\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t((type == 'trackers') ? 'tracker_browser_type_filter' : 'lso_browser_type_filter', _select({
					id: type + '-app-list-filter-type',
					options: [
						{ name: t("all"), value: 'all' },
						{ name: t("blocked"), value: 'blocked' },
						{ name: t("unblocked"), value: 'unblocked' },
						{ name: t("new_since_last_update"), value: 'new' }
					]
				})) ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<p>\n\t\t\t\t'+
((__t=( t((type == 'trackers') ? 
					"tracker_browser_name_filter" : "lso_browser_name_filter", 
					'<input type="text" class="app-list-filter-name" id="' + type + '-app-list-filter-name" placeholder="' + t((type == 'trackers') ? 
						"tracker_browser_name_filter_placeholder" : "lso_browser_name_filter_placeholder") + '">' +
						'<span id="app-list-reset-search"></span>') ))==null?'':__t)+
'\n\t\t\t</p>\n\t\t\t<!-- <p>\n\t\t\t\t<a href="#" id="app-list-reset-search">'+
((__t=( t("tracker_browser_filters_reset") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t</p> -->\n\t\t</div>\n\t\t<div style="clear:both"></div>\n\t</div>\n\n\t';
 if (type == 'trackers') { 
__p+='\n\t\t<div id="'+
((__t=('tag-list-' + type ))==null?'':_.escape(__t))+
'" class="small">\n\t\t\t<a id="more-tags" href="#">'+
((__t=( t('tags_more') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t<a id="less-tags" href="#">'+
((__t=( t('tags_less') ))==null?'':_.escape(__t))+
'</a>\n\t\t</div>\n\t';
 } 
__p+='\n\n\t<div id="filter-desc">\n\t\t<div>\n\t\t\t<a href="#" id="filter-clear">'+
((__t=( t('tracker_browser_filters_reset') ))==null?'':_.escape(__t))+
'</a>\n\t\t\t<span id="filter-desc-text"></span>\n\t\t</div>\n\t</div>\n\n\t<div class="app-toggles-divs">\n\t\t<a href="#" id="select-all">'+
((__t=( t("toggle_select_all") ))==null?'':_.escape(__t))+
'</a>\n\t\t<span class="vr"></span>\n\t\t<a href="#" id="select-none">'+
((__t=( t("toggle_select_none") ))==null?'':_.escape(__t))+
'</a>\n\t\t<span class="vr"></span>\n\t\t<a href="#" id="expand-all">'+
((__t=( t("toggle_expand_all") ))==null?'':_.escape(__t))+
'</a>\n\t\t<span class="vr"></span>\n\t\t<a href="#" id="collapse-all">'+
((__t=( t("toggle_collapse_all") ))==null?'':_.escape(__t))+
'</a>\n\t</div>\n\n\t<div id="'+
((__t=( type ))==null?'':__t)+
'">\n\t</div>\n\n\t<div id="no-results-'+
((__t=( type ))==null?'':__t)+
'">\n\t\t'+
((__t=( t('no_results') ))==null?'':_.escape(__t))+
'\n\t</div>\n\n</div>\n';
}
return __p;
};