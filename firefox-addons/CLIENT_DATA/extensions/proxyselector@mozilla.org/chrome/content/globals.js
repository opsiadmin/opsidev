var	  prxG_RdfDataSource		= "rdf:local-store";
const prxG_RdfRoot			= "http://mozilla.org/package/mproxy/rdf/all";
const prxG_RdfNodeUriRoot		= "http://mozilla.org/package/mproxy/rdf";
const prxG_RdfNodeId			= prxG_RdfNodeUriRoot+ "#id";
const prxG_RdfNodeName		= prxG_RdfNodeUriRoot+ "#name";
const prxG_RdfNodeProxy		= prxG_RdfNodeUriRoot+ "#proxy";

var	prxG_StrBundle = null;

var prxG_options = new Array();
	prxG_options['networkProxyType']				= "network.proxy.type";
	prxG_options['networkProxyHTTP']				= "network.proxy.http";
	prxG_options['networkProxyHTTP_Port']			= "network.proxy.http_port";
	prxG_options['networkProxyHTTPShare']			= "network.proxy.share_proxy_settings";
	prxG_options['networkProxySSL']					= "network.proxy.ssl";
	prxG_options['networkProxySSL_Port']			= "network.proxy.ssl_port";
	prxG_options['networkProxyFTP']					= "network.proxy.ftp";
	prxG_options['networkProxyFTP_Port']			= "network.proxy.ftp_port";
	prxG_options['networkProxySOCKS']				= "network.proxy.socks";
	prxG_options['networkProxySOCKS_Port']			= "network.proxy.socks_port";
	prxG_options['networkProxySOCKSVersion']		= "network.proxy.socks_version";
	prxG_options['networkProxyNone']				= "network.proxy.no_proxies_on";
	prxG_options['networkProxyAutoconfigURL']		= "network.proxy.autoconfig_url";
	
var prxG_options_defaults = new Array();
	prxG_options_defaults['networkProxyType']			= 1;
	prxG_options_defaults['networkProxyHTTP']			= "";
	prxG_options_defaults['networkProxyHTTP_Port']		= 0;
	prxG_options_defaults['networkProxyHTTPShare']		= false;
	prxG_options_defaults['networkProxySSL']			 	= "";
	prxG_options_defaults['networkProxySSL_Port']		= 0;
	prxG_options_defaults['networkProxyFTP']				= "";
	prxG_options_defaults['networkProxyFTP_Port']		= 0;
	prxG_options_defaults['networkProxySOCKS']			= "127.0.0.1";
	prxG_options_defaults['networkProxySOCKS_Port']		= 9050;
	prxG_options_defaults['networkProxySOCKSVersion']	= 5;
	prxG_options_defaults['networkProxyNone']			= "localhost, 127.0.0.1";
	prxG_options_defaults['networkProxyAutoconfigURL']	= "";



var prxGlob =
{
/*
* Global Functions
*/
	//Get String Bundle
	getString: function(sKey){
		try{
		
			if(prxG_StrBundle == null){
				var oBundle			= Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
				prxG_StrBundle	= oBundle.createBundle('chrome://mproxy/locale/locale.properties');
			}
			
			return prxG_StrBundle.GetStringFromName(sKey);
				
		}catch(err){}
		
		return "";
	}
	,
	
	//Is string empty
	isEmpty: function(str){
		var oRegExp = new RegExp("([^\\s])", "g");
		
		if(str == "")
			return true;
		
		return !oRegExp.test(str);
	}
	,
	// Does this sValue exist in oList
	existsInList: function(oList, sValue){
		
		for(var i = 0; i < oList.getRowCount(); i++){
			if(oList.getItemAtIndex(i).value == sValue){
				return true;
			}
		}
		
		return false;
	}
	,
	// Trims space from both sides of str
	trim: function(str){
		str	= str.replace(new RegExp("^[\\s\\n\\r]*", "g"), "");
		str	= str.replace(new RegExp("[\\s\\n\\r]*$", "g"), "");
		
		return str;
	}
	,
	
	//	Splits a domain or IP from it's port number
	//	returns array[1]
	//	array[0] = (String) Domain or IP
	//	array[1] = (String) Port Number	
	splitDomain: function(sDomain){
		var aOut	 = new Array();
		var iPort	= -1;
		
		if( (iPort = sDomain.indexOf(":")) > -1){
			aOut[0] = sDomain.substring(0, iPort);
			aOut[1] = sDomain.substring(iPort + 1);
		}
		else{
			aOut[0] = sDomain;
			aOut[1] = "80";
		}
		
		return aOut;
	}
	,
	// Returns if str is valid domain or IP address
	isValidDomain: function(str){
		
		var oValidDomain = new RegExp("^[a-zA-Z0-9][a-zA-Z0-9-\\.:]{0,63}[a-zA-Z0-9]?$", "i");
		
		return oValidDomain.test(str);
	}
	,
/*
* Debug Functions
*/
	//Get Properties for an object
	debug_getProps: function(obj){
		var props = "";
		var i = -1;
		for(prop in obj){
			i++;
			props += prop + " | ";
			
			if(i > 3){
				i = -1;
				props += "\n";
			}
		}
		alert(props);
	}
	,
/*
* Proxy Manager Close
*/
	
	managerClose: function (){
			try{
				var oPrefs	= Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
					oPrefs.setIntPref("extensions.proxyselector.proxy.rdf.lastupdate", (new Date()).getTime());
			} catch(e){ alert(e); }
	}
}