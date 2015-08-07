var prxSel_Edit =
{
	gIsEdit: false,
	mproxy: "",
	mproxyNameField: "",
	prompts: Components.classes["@mozilla.org/embedcomp/prompt-service;1"] .getService(Components.interfaces.nsIPromptService),
	
	initVals: function ()
		{
		
		prxSel_Edit.mproxyNameField = document.getElementById("proxy-name")
		//Edit
		if(window.arguments.length > 1 && window.arguments[0] == "edit" && !prxGlob.isEmpty(window.arguments[1]))
		{
			
			//Proxy URI
			var mproxyURI = window.arguments[1];
			
			prxSel_Edit.gIsEdit= true;
			try 
				{
				prxSel_Edit.mproxy = prxSelDs.getResource(mproxyURI);
				
				//Load Fields
				var mproxyConfig = prxSelDs.getPropertyValuesFor(mproxyURI);
					for(var key in prxG_options)
					{
						var oField= document.getElementById(key);
						var sValue= mproxyConfig[prxG_RdfNodeUriRoot + "#" + key];
					
					oField.value = sValue;
					}
				
				//Label
				prxSel_Edit.mproxyNameField.value = mproxyConfig[prxG_RdfNodeName];
				
				//Set Socks Radio
				var oSocks = document.getElementById("networkProxySOCKSVersion");
				if(oSocks.value == "4")
					oSocks.selectedItem = document.getElementById("networkProxySOCKSVersion4");
				else
					oSocks.selectedItem = document.getElementById("networkProxySOCKSVersion5");
				
				//Share one proxy
				var oShare = document.getElementById("networkProxyHTTPShare");
				if (oShare.value == "true")
					//oShare.checked = true;
					document.getElementById("networkProxyHTTPShare").checked = oShare.value;
				
				else
					oShare.checked = false;
				
			//Sharing box
			//if (document.getElementById("networkProxyHTTPShare").value == "true");
			
			}catch(err){ prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.unknown")); self.close(); }
		}
		
		//Enable Fields
		prxSel_Edit.enableShareSettingOnStart();
		prxSel_Edit.enableOptions();
		
	}
	,
	
	saveProxy: function() 
	{
	
	try{
		
		/*
		* Validation
		*/
		//Empty
		if(prxSel_Edit.mproxyNameField.value == ""){
			prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.add.empty"));
			
			prxSel_Edit.mproxyNameField.focus();
			prxSel_Edit.mproxyNameField.setSelectionRange(0, prxSel_Edit.mproxyNameField.textLength);
			
			return false;
		}
		//Special Chars
		else if(!prxSel_EditCommon.allowedChars(prxSel_Edit.mproxyNameField.value)){
			prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.add.invalid"));
			return false;
		}
		//Can't be named 'None' or 'Auto' or 'System'
		else if(prxSel_EditCommon.simplify(prxSel_Edit.mproxyNameField.value) == prxSel_EditCommon.simplify(prxGlob.getString("common.proxy.none"))){
			prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.add.duplicate"));
			return false;
		}
		else if(prxSel_EditCommon.simplify(prxSel_Edit.mproxyNameField.value) == prxSel_EditCommon.simplify(prxGlob.getString("common.proxy.auto"))){
			prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.add.duplicate"));
			return false;
		}
		else if(prxSel_EditCommon.simplify(prxSel_Edit.mproxyNameField.value) == prxSel_EditCommon.simplify(prxGlob.getString("common.proxy.system"))){
			prxSel_Edit.prompts.alert(null, null, proxy_prxGlob.getString("error.add.duplicate"));
			return false;
		}
		
		//Is This a Duplicate Label?
		var oTestProxy = prxSelDs.getElementForValue(prxG_RdfNodeName, prxSel_Edit.mproxyNameField.value);
		if(oTestProxy != null && (!prxSel_Edit.gIsEdit|| oTestProxy.Value != prxSel_Edit.mproxy.Value)){
			prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.add.duplicate"));
			return false;
		}
		
		//save share setting
		document.getElementById("networkProxyHTTPShare").value = document.getElementById("networkProxyHTTPShare").checked;
		
		/*
		* Edit
		*/
		if(prxSel_Edit.gIsEdit){
			//Update RDF Properties
			for(var key in prxG_options){
			prxSelDs.changePropertyValue(prxSel_Edit.mproxy, (prxG_RdfNodeUriRoot + "#" + key), document.getElementById(key).value);
			}
			
			//Update Name
			prxSelDs.changePropertyValue(prxSel_Edit.mproxy, prxG_RdfNodeName, prxSel_Edit.mproxyNameField.value);
		}
		/*
		* Add
		*/
		else{
			var sProxyUri = opener.prxSel.getUniqueProxyUri();
			var oProxy= prxSelDs.getResource(sProxyUri);
			
			//Add Element
			prxSelDs.addElement(sProxyUri);
			
			//Add Properties
			for(var key in prxG_options){
			var oProp = prxSelDs.getResource(prxG_RdfNodeUriRoot + "#" + key);
			prxSelDs.addProperty(oProxy, oProp, document.getElementById(key).value, true);
			}
			
			//Add Name
			prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeName), prxSel_Edit.mproxyNameField.value, true);
		}
		/*
		* Finish
		*/
		opener.prxSel.populateList();
		prxSelDs.save();

		if(prxSel_Edit.gIsEdit){
			
			//Is this proxy is in use, refresh proxy
			var oPrefs= Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			if(oPrefs.prefHasUserValue("extensions.proxyselector.proxy.current") 
			&& oPrefs.getCharPref("extensions.proxyselector.proxy.current") == prxSel_Edit.mproxy.Value){
			
			opener.prxSel.doCommand("prxSel.setProxy()");
			}
			//If not in use, select proxy
			else{
			opener.prxSel.doCommand("prxSel.selectItem('"+ prxSel_Edit.mproxyNameField.value +"')");
			}
			
			//prxSel_Edit.prompts.alert(null, null, "Proxy Info Changed");
		}
		else{
			opener.prxSel.doCommand("prxSel.selectItem('"+ prxSel_Edit.mproxyNameField.value +"')"); 
			//prxSel_Edit.prompts.alert(null, null, "Proxy Added");
		}
		
	}catch(e){
		prxSel_Edit.prompts.alert(null, null, prxGlob.getString("error.unknown") +"\n("+ e +")");
	}
	return true;
	}
	,
	
	//	Enable or disable Manual
	//	+ config options
	enableOptions: function() 
	{
		
		var disable = !(document.getElementById("networkProxyType").value == "1"); //if 1 then manual is selected
		
		//Set Radios
		var oType = document.getElementById("networkProxyType");

		// No Proxy - 0
		if (document.getElementById("networkProxyType").value == "0")
		{
			
			//Manual Options Disabled
			document.getElementById("networkProxyHTTP").disabled = true;
			document.getElementById("networkProxyHTTP_Port").disabled = true;
			document.getElementById("networkProxyHTTPShare").disabled = true;
			document.getElementById("networkProxySSL").disabled = true;
			document.getElementById("networkProxySSL_Port").disabled = true;
			document.getElementById("networkProxyFTP").disabled = true;
			document.getElementById("networkProxyFTP_Port").disabled = true;
			document.getElementById("networkProxySOCKS").disabled = true;
			document.getElementById("networkProxySOCKS_Port").disabled = true;
			document.getElementById("networkProxySOCKSVersion4").disabled = true;
			document.getElementById("networkProxySOCKSVersion5").disabled = true;
			document.getElementById("networkProxyNone").disabled = true;
			//AutoconfigURL Disabled
			document.getElementById("networkProxyAutoconfigURL").disabled = true;
			
		}
		// Auto-detect - 4
		if (document.getElementById("networkProxyType").value == "4")
		{
			
			//Manual Options Disabled
			document.getElementById("networkProxyHTTP").disabled = true;
			document.getElementById("networkProxyHTTP_Port").disabled = true;
			document.getElementById("networkProxyHTTPShare").disabled = true;
			document.getElementById("networkProxySSL").disabled = true;
			document.getElementById("networkProxySSL_Port").disabled = true;
			document.getElementById("networkProxyFTP").disabled = true;
			document.getElementById("networkProxyFTP_Port").disabled = true;
			document.getElementById("networkProxySOCKS").disabled = true;
			document.getElementById("networkProxySOCKS_Port").disabled = true;
			document.getElementById("networkProxySOCKSVersion4").disabled = true;
			document.getElementById("networkProxySOCKSVersion5").disabled = true;
			document.getElementById("networkProxyNone").disabled = true;
			//AutoconfigURL Disabled
			document.getElementById("networkProxyAutoconfigURL").disabled = true;
			
		}
		// System Proxy - 5
		if (document.getElementById("networkProxyType").value == "5")
		{
			
			//Manual Options Disabled
			document.getElementById("networkProxyHTTP").disabled = true;
			document.getElementById("networkProxyHTTP_Port").disabled = true;
			document.getElementById("networkProxyHTTPShare").disabled = true;
			document.getElementById("networkProxySSL").disabled = true;
			document.getElementById("networkProxySSL_Port").disabled = true;
			document.getElementById("networkProxyFTP").disabled = true;
			document.getElementById("networkProxyFTP_Port").disabled = true;
			document.getElementById("networkProxySOCKS").disabled = true;
			document.getElementById("networkProxySOCKS_Port").disabled = true;
			document.getElementById("networkProxySOCKSVersion4").disabled = true;
			document.getElementById("networkProxySOCKSVersion5").disabled = true;
			document.getElementById("networkProxyNone").disabled = true;
			//AutoconfigURL Disabled
			document.getElementById("networkProxyAutoconfigURL").disabled = true;
			
		}
		
		//AutoconfigURL - 2
		if (document.getElementById("networkProxyType").value == "2")
		{
			
			//Manual Options
			document.getElementById("networkProxyHTTP").disabled = true;
			document.getElementById("networkProxyHTTP_Port").disabled = true;
			document.getElementById("networkProxyHTTPShare").disabled = true;
			document.getElementById("networkProxySSL").disabled = true;
			document.getElementById("networkProxySSL_Port").disabled = true;
			document.getElementById("networkProxyFTP").disabled = true;
			document.getElementById("networkProxyFTP_Port").disabled = true;
			document.getElementById("networkProxySOCKS").disabled = true;
			document.getElementById("networkProxySOCKS_Port").disabled = true;
			document.getElementById("networkProxySOCKSVersion4").disabled = true;
			document.getElementById("networkProxySOCKSVersion5").disabled = true;
			document.getElementById("networkProxyNone").disabled = true;
			//AutoconfigURL Enabled
			document.getElementById("networkProxyAutoconfigURL").disabled = false;
			
		}
		
		//Manual - 1
		if (document.getElementById("networkProxyType").value == "1")
		{
			//When manual setting is checked
			prxSel_Edit.enableShareSetting();
			document.getElementById("networkProxyHTTP").disabled = false;
			document.getElementById("networkProxyHTTP_Port").disabled = false;
			document.getElementById("networkProxyHTTPShare").disabled = false;
			document.getElementById("networkProxyNone").disabled = false;
			document.getElementById("networkProxyAutoconfigURL").disabled = true;
		}
	}
	,
	//Set setting on start-up
	enableShareSettingOnStart: function()
	{
		var disabletextbox = (document.getElementById("networkProxyHTTPShare").checked == true);
		document.getElementById("networkProxySSL").disabled = disabletextbox;
		document.getElementById("networkProxySSL_Port").disabled = disabletextbox;
		document.getElementById("networkProxyFTP").disabled = disabletextbox;
		document.getElementById("networkProxyFTP_Port").disabled = disabletextbox;
		document.getElementById("networkProxySOCKS").disabled = disabletextbox;
		document.getElementById("networkProxySOCKS_Port").disabled = disabletextbox;
		document.getElementById("networkProxySOCKSVersion4").disabled = disabletextbox;
		document.getElementById("networkProxySOCKSVersion5").disabled = disabletextbox;
	}
	,
	//Disable below when check sharing setting
	enableShareSetting: function()
	{
		var disabletextbox = (document.getElementById("networkProxyHTTPShare").checked == true);

		document.getElementById("networkProxySSL").disabled = disabletextbox;
		document.getElementById("networkProxySSL_Port").disabled = disabletextbox;
		document.getElementById("networkProxyFTP").disabled = disabletextbox;
		document.getElementById("networkProxyFTP_Port").disabled = disabletextbox;
		document.getElementById("networkProxySOCKS").disabled = disabletextbox;
		document.getElementById("networkProxySOCKS_Port").disabled = disabletextbox;
		document.getElementById("networkProxySOCKSVersion4").disabled = disabletextbox;
		document.getElementById("networkProxySOCKSVersion5").disabled = disabletextbox;
		
	}
	,
	enableShareSettingSelect: function()
	{
		var disabletextbox = (document.getElementById("networkProxyHTTPShare").checked == true);

		document.getElementById("networkProxySSL").disabled = disabletextbox;
		document.getElementById("networkProxySSL_Port").disabled = disabletextbox;
		document.getElementById("networkProxyFTP").disabled = disabletextbox;
		document.getElementById("networkProxyFTP_Port").disabled = disabletextbox;
		document.getElementById("networkProxySOCKS").disabled = disabletextbox;
		document.getElementById("networkProxySOCKS_Port").disabled = disabletextbox;
		document.getElementById("networkProxySOCKSVersion4").disabled = disabletextbox;
		document.getElementById("networkProxySOCKSVersion5").disabled = disabletextbox;
		
		prxSel_Edit.copySetting();
	}
	,
	//Copy http proxy
	copySetting: function ()
	{
		if (document.getElementById("networkProxyHTTPShare").checked == true)
		{
			document.getElementById("networkProxySSL").value = document.getElementById("networkProxyHTTP").value;
			document.getElementById("networkProxySSL_Port").value = document.getElementById("networkProxyHTTP_Port").value;
			document.getElementById("networkProxyFTP").value = document.getElementById("networkProxyHTTP").value;
			document.getElementById("networkProxyFTP_Port").value = document.getElementById("networkProxyHTTP_Port").value;
			document.getElementById("networkProxySOCKS").value = document.getElementById("networkProxyHTTP").value;
			document.getElementById("networkProxySOCKS_Port").value = document.getElementById("networkProxyHTTP_Port").value;
		}
		else
		{
			document.getElementById("networkProxySSL").value = "";
			document.getElementById("networkProxySSL_Port").value = "";
			document.getElementById("networkProxyFTP").value = "";
			document.getElementById("networkProxyFTP_Port").value = "";
			document.getElementById("networkProxySOCKS").value = "";
			document.getElementById("networkProxySOCKS_Port").value = "";
		}
	}
}


var prxSel_EditCommon =
{

//	Has Special Chars
//	+ returns true if it only
//	+ contains allowed chars
	allowedChars: function(str)
	{
		//var regex = new RegExp("[\\s\\.a-zA-Z0-9_]", "g"); //This does not allow utf-8 text!
		var regex = new RegExp("[{}\\\[\\\]<>,;:/~`'\"*?^$#&\\t\\n\\r\\\\]", "g");
		return !regex.test(str);
	}
	,
//	Used to test strings
//	+ converts space to underscore
//	+ and converts to lowercase
	simplify: function(str)
	{
		str = str.replace(new RegExp("\\s{2,}", "g"), " ");
		str = str.replace(new RegExp("\\s", "g"), "_");
		str = str.toLowerCase();
		return str;
	}

}