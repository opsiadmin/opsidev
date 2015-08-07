var __templates=__templates||{};
__templates["_category"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="category-arrow ';
 if (!collapsed) print('down'); 
__p+='">&nbsp;</div>\n<div class="category-checkbox">\n\t<input type="checkbox" class="cat-checkbox"';
 if (all_selected) print(' checked') 
__p+=' ';
 if (disabled) print('disabled="disabled"') 
__p+='>\n</div>\n<div class="category-name" title="'+
((__t=( t('category_' + id + '_desc') ))==null?'':_.escape(__t))+
'">\n\t<span class="help">'+
((__t=( name ))==null?'':_.escape(__t))+
'</span>\n</div>\n<div class="category-stats">\n\t'+
((__t=( t('number_of_' + type, num_visible.toString()) ))==null?'':_.escape(__t))+
'\n\t'+
((__t=( t_blocking_summary(num_selected, num_visible, type, true) ))==null?'':__t)+
'\n</div>\n';
}
return __p;
};