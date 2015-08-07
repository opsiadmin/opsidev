var __templates=__templates||{};
__templates["_default_block_all"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div id="block-default-message-container">\n\t<div class="ellipsis" id="block-default-message">\n\t\t'+
((__t=( t("block_by_default_helper_text") ))==null?'':_.escape(__t))+
'\n\t\t<span>\n\t\t\t<a href="#" id="block-default-close">'+
((__t=( t("block_by_default_helper_accept") ))==null?'':_.escape(__t))+
'</a>\n\t\t\t<a href="#" id="block-default-disable">'+
((__t=( t("block_by_default_helper_cancel") ))==null?'':_.escape(__t))+
'</a>\n\t\t</span>\n\t\t<!-- <span id=\'block-default-msg-close\'></span> -->\n\t</div>\n</div>\n';
}
return __p;
};