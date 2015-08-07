var __templates=__templates||{};
__templates["click2play"]=function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<html>\n<head>\n    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n    <style>\n        body {\n            margin: 0px;\n            padding: 0px;\n            display: table;\n            height: 100%;\n            width: 100%;\n            text-align: center;\n            margin: 0;\n            padding: 0;\n        }\n        p {\n            margin: 2px;\n            font-family: Helvetica, Arial, sans-serif;\n            font-size: 12px;\n        }\n        #content {\n            display: table-cell;\n            vertical-align: middle;\n            text-align: center;\n        }\n    </style>\n</head>\n\n<body>\n\n<div style="text-align:center" id="content">\n    <p id="text" style="display:none"></p>\n    <img id="ghosty_block" src="'+
((__t=( ghosty_blocked ))==null?'':__t)+
'">\n    <a id="action_once" href="#" onclick="return false"><img src="'+
((__t=( allow_once ))==null?'':__t)+
'" title="'+
((__t=( t('click2play_allow_once_tooltip') ))==null?'':_.escape(__t))+
'"></a>\n    <a id="action_always" href="#" onclick="return false"><img src="'+
((__t=( allow_unblock ))==null?'':__t)+
'" title="'+
((__t=( t('click2play_allow_always_tooltip') ))==null?'':_.escape(__t))+
'"></a>\n</div>\n</body>\n</html>\n';
}
return __p;
};