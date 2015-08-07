		/*
		* 2008
		* Copyright Steve McFred and Jeremy Gillick (author of SwitchProxy)
		*/

		/*
		*
		* 	ERROR CODES
		*	100 - 149: prxSel.setProxy()
		*	150 - 199: prxSel.removeProxy()
		*	200 - 249: prxSel.clearCookies()
		*	250 - 299: prxSel.editProxyDialog()
		*	300	- 349: mproxy_manualUpgradCheck()
		*
		*/
		
var prxSel = {

		List: "",
		ListPopup: "",
		ContextList: "",
		MenuList: "",
		ManageList: "",
		ElementList: "",
		ElementButton: "",
		LastItem: "",
		ProxyCount: 0,
		InManager: false,
		Loaded: false,
		CommandEnd: true,
		prompts: Components.classes["@mozilla.org/embedcomp/prompt-service;1"] .getService(Components.interfaces.nsIPromptService),
		
		Element_LastNode: "",
		
		Prefs: "",
		
		NoneLabel: prxGlob.getString("common.proxy.none"),
		SystemLabel: prxGlob.getString("common.proxy.system"),
		AutoLabel: prxGlob.getString("common.proxy.auto"),
		
		/*********************************************************************************/
		/* INIT */
		initProxy: function(event){
			
			window.removeEventListener("load", prxSel.initProxy, true);

			if(!prxSel.Loaded){
			
				prxSel.List				= document.getElementById('proxy-list');
				prxSel.ListPopup		= document.getElementById('proxy-list-popup');
				prxSel.ManageList		= document.getElementById('manage-proxy-list');
				prxSel.ContextList		= document.getElementById('context-proxy-list');
				prxSel.MenuList			= document.getElementById('mproxy-menu-list');
				prxSel.ElementList		= document.getElementById('mproxy-element-list');
				prxSel.ElementButton	= document.getElementById('mproxy-element-button');
				prxSel.Element_LastNode	= document.getElementById('mproxy-element-dlist-separator');
				
				prxSel.Prefs			= Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
				
				
				
				/* Add button to toolbar on first run  */        
				if (prxSel.Prefs.getBoolPref("extensions.proxyselector.first.run"))
				{
					if (prxSel.Prefs.getIntPref("extensions.proxyselector.proxy.rdf.lastupdate")==0)
					{
						prxSel.Prefs.setIntPref("network.proxy.type", 5);
						prxSel.Prefs.setCharPref("extensions.proxyselector.proxy.current", "System");
						prxSel.Prefs.setIntPref("extensions.proxyselector.proxy.rdf.lastupdate", (new Date()).getTime());
						
						prxSel.installButton("nav-bar", "mproxy-element-button");
						
						prxSel.ElementList		= document.getElementById('mproxy-element-list');
						prxSel.ElementButton	= document.getElementById('mproxy-element-button');
						prxSel.Element_LastNode	= document.getElementById('mproxy-element-dlist-separator');
						
						prxSel.populateList();
					}
					
					prxSel.Prefs.setBoolPref("extensions.proxyselector.first.run",false)
				}
				
				
				
				
				//Is in Proxy Manager
				if(prxSel.ManageList != null){
					prxSel.InManager = true;
					prxSel.List = prxSel.ManageList;
				}
				
				prxSel.showMenus(true);
				
				//Cleanup RDF File
				prxSel.cleanupRdf();
				
				//Populate Proxy List
				prxSel.populateList();
				
				//Set Last Proxy Selected
				if(prxSel.List != null)
					prxSel.LastItem = prxSel.List.selectedItem;
				
				//Add Preferences Listener
				var oProxyObserver = {
					observe : function(subject, topic, data){prxSel.populateList();}
				};
				
				var oMenuObserver = {
					observe : function(subject, topic, data){prxSel.showMenus(false);}
				};
				
				var oButtonObserver = {
					observe : function(subject, topic, data){prxSel.populateList();}
				};
			
				var oPrefBranch	= Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranchInternal);
				
				oPrefBranch.addObserver("extensions.proxyselector.proxy.rdf.lastupdate", oProxyObserver, false);
				oPrefBranch.addObserver("extensions.proxyselector.display.context", oMenuObserver, false);
				oPrefBranch.addObserver("extensions.proxyselector.display.tools", oMenuObserver, false);
				oPrefBranch.addObserver("extensions.proxyselector.display.button.icontext", oButtonObserver, false);
				
				if (document.getElementById("navigator-toolbox") != null)
				document.getElementById("navigator-toolbox").addEventListener("drop",prxSel.onButtonDrop,false);
				
				if (document.getElementById("addon-bar") != null)
				document.getElementById("addon-bar").addEventListener("drop",prxSel.onButtonDrop,false);
				
				
				prxSel.Loaded = true;
			}
		}
		,
		
		
		installButton: function(toolbarId, id, afterId) 
		{
				if (!document.getElementById(id)) {
					var toolbar = document.getElementById(toolbarId);
			 
					// If no afterId is given, then append the item to the toolbar
					var before = null;
					if (afterId) {
						let elem = document.getElementById(afterId);
						if (elem && elem.parentNode == toolbar)
							before = elem.nextElementSibling;
					}
			 
					toolbar.insertItem(id, before);
					toolbar.setAttribute("currentset", toolbar.currentSet);
					document.persist(toolbar.id, "currentset");
			 
					if (toolbarId == "addon-bar")
						toolbar.collapsed = false;
				}
		}
		,
		
		onButtonDrop: function(event)  
		{
			
			if (event.dataTransfer.mozSourceNode.id == "wrapper-mproxy-element-button")
			{
			
			//prxSel.prompts.alert(null, null, "buh!");
				
				prxSel.ElementList		= document.getElementById('mproxy-element-list');
				prxSel.ElementButton	= document.getElementById('mproxy-element-button');
				prxSel.Element_LastNode	= document.getElementById('mproxy-element-dlist-separator');
				
				/* Populate Proxy List */
				prxSel.populateList();
				
				/* Set Last Proxy Selected */
				// if(prxSel.List != null)
					// prxSel.LastItem = prxSel.List.selectedItem;
			
			}
		},
		
		
		
		
		/*********************************************************************************/
		
		/* Detect Button Type */
		buttonType: function(llab){
				
				//
				var oPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				var ElementButton	= document.getElementById('mproxy-element-button');
				if (ElementButton != null)  /* button on toolbar */
				{
					
					var itvalue = (oPrefs.getCharPref("extensions.proxyselector.display.button.icontext"));
					
					
					switch(itvalue) {
						  
						  case 'icon':
								ElementButton.setAttribute("label", "");
								ElementButton.setAttribute("tooltiptext", prxGlob.getString("common.label.proxy")+" "+ llab);
								ElementButton.removeAttribute("style", "list-style-image: none;");
								
						  break; 

						  case 'text':
								ElementButton.setAttribute("label", llab);
								ElementButton.setAttribute("tooltiptext", prxGlob.getString("common.label.select"));
								ElementButton.setAttribute("style", "list-style-image: none;");
								
								break; 
								

						  case 'both':
								ElementButton.setAttribute("label", llab);
								ElementButton.setAttribute("tooltiptext", prxGlob.getString("common.label.select"));
								ElementButton.removeAttribute("style", "list-style-image: none;");
								
								break; 

						  default:
							prxSel.prompts.alert(null, null,"error: "+ itvalue);
							//istruzioni
						}
				}
				
			
		}
		,
		/*********************************************************************************/

		//Displays the context menu based on what 
		// the user selects in the options
		showMenus: function(onStartup){
			try{	
				//Show/Hide menus
				var oPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
							
				//Context
				//var isHidden = (oPrefs.prefHasUserValue("extensions.proxyselector.display.context") && !oPrefs.getBoolPref("extensions.proxyselector.display.context"))
				var isHidden = (!oPrefs.getBoolPref("extensions.proxyselector.display.context"))
				document.getElementById("mproxy-context-menu").setAttribute("collapsed", isHidden);
				document.getElementById("mproxy-context-separator").setAttribute("hidden", isHidden);
				
				//Tools Menu
				//var isHidden = (oPrefs.prefHasUserValue("extensions.proxyselector.display.tools") && !oPrefs.getBoolPref("extensions.proxyselector.display.tools"))
				var isHidden = (!oPrefs.getBoolPref("extensions.proxyselector.display.tools"))
				document.getElementById("mproxy-tools-menu").setAttribute("hidden", isHidden);
				
				
				
				
			}catch(err){}
		}
		,
		/*********************************************************************************/
		//Clears current Proxy List
		clearList: function(){
			
			prxSel.ProxyCount = 0;

			//Manage Proxy Box
			if(prxSel.InManager && prxSel.List != null){
				var aNodes = prxSel.List.childNodes;
				for(var i = aNodes.length-1; i >= 0; i--){
					prxSel.List.removeChild(aNodes[i]);
				}
			}

			//Context List
			if(prxSel.ContextList != null){
				var aNodes = prxSel.ContextList.childNodes;
				for(var i = aNodes.length-1; i >= 0; i--){
					if(aNodes[i].getAttribute("class") == "proxy-menu-item" || aNodes[i].getAttribute("class") == "proxy-menu-default")
					prxSel.ContextList.removeChild(aNodes[i]);
				}
			}
			
			//Toolbar Element List
			if(prxSel.ElementList != null){
				var aNodes = prxSel.ElementList.childNodes;
				for(var i = aNodes.length-1; i >= 0; i--){
					if(aNodes[i].getAttribute("class") == "proxy-menu-item" || aNodes[i].getAttribute("class") == "proxy-menu-default")
					prxSel.ElementList.removeChild(aNodes[i]);
						
				}
			}

			// Tools Menu List
			if(prxSel.MenuList != null){
				var aNodes = prxSel.MenuList.childNodes;
				for(var i = aNodes.length-1; i >= 0; i--){
						if(aNodes[i].getAttribute("class") == "proxy-menu-item" || aNodes[i].getAttribute("class") == "proxy-menu-default")
						prxSel.MenuList.removeChild(aNodes[i]);
				}
			}
		}
		,
		/*********************************************************************************/
		//Add Item to lists
		appendToList: function(sLabel, sValue, isSelected, iType){

			var oItem = null;
			
			prxSel.ProxyCount++;
			
			try{

				//Manage Proxy Box
				if(prxSel.InManager && prxSel.List != null && sLabel != prxSel.NoneLabel && sLabel != prxSel.SystemLabel && sLabel != prxSel.AutoLabel){
					oItem = prxSel.List.appendItem(sLabel, sValue);
					oItem.setAttribute("proxyType", iType);
				}

				//Context List
				if(prxSel.ContextList != null){
					var oDSeparator = document.getElementById("mproxy-context-separator");
					prxSel.Element_LastNode	= document.getElementById('mproxy-context-separator');
					
					oItem = document.createElement("menuitem");
					oItem.setAttribute("label", sLabel);
					oItem.setAttribute("value", sValue);
					oItem.setAttribute("type", "checkbox");
					oItem.setAttribute("autocheck", "false");
					oItem.setAttribute("proxyType", iType);
					//Replace oncommand
					oItem.addEventListener("command",function () {prxSel.queueSetProxy(this)}, false);
					
					if (sValue != ""){
					oItem.setAttribute("id", iType);
					oItem.setAttribute("class", "proxy-menu-item");
					prxSel.ContextList.appendChild(oItem);
					prxSel.Element_LastNode = iType;
					}
					else{
					oItem.setAttribute("id", sValue);
					oItem.setAttribute("class", "proxy-menu-default");

					prxSel.ContextList.insertBefore(oItem, oDSeparator);
					}


				} 

				
				//Toolbar Element List
				if(prxSel.ElementList != null){
					//Get separator, which is after proxy list
					
					var oDSeparator = document.getElementById("mproxy-element-dlist-separator");
					var oDOptSeparator = document.getElementById("mproxy-element-options-separator");
					
					prxSel.Element_LastNode	= document.getElementById('mproxy-element-dlist-separator');
					
					oItem = document.createElement("menuitem");
					
					oItem.setAttribute("label", sLabel);
					oItem.setAttribute("value", sValue);
					oItem.setAttribute("type", "checkbox");
					oItem.setAttribute("autocheck", "false");
					oItem.setAttribute("proxyType", iType);	

					//Replace oncommand
					oItem.addEventListener("command",function () {prxSel.queueSetProxy(this)}, false);
					
					if (sValue != ""){
					oItem.setAttribute("id", iType);
					oItem.setAttribute("class", "proxy-menu-item");
					prxSel.ElementList.insertBefore(oItem, oDOptSeparator);
					prxSel.Element_LastNode = iType;
					}
					else{
					oItem.setAttribute("id", sValue);
					oItem.setAttribute("class", "proxy-menu-default");

					prxSel.ElementList.insertBefore(oItem, oDSeparator);
					}
				}

				// Tools Menu List
				if(prxSel.MenuList != null){
					//Get separator, which is after proxy list
					var oSeparator = document.getElementById("mproxy-menu-list-separator");
					var oDSeparator = document.getElementById("mproxy-menu-dlist-separator");
					oItem = document.createElement("menuitem");
					oItem.setAttribute("id", sValue);
					oItem.setAttribute("label", sLabel);
					oItem.setAttribute("value", sValue);
					oItem.setAttribute("type", "checkbox");
					oItem.setAttribute("autocheck", "false");
					oItem.setAttribute("proxyType", iType);	
					oItem.setAttribute("class", "proxy-menu-item");
					//Replace oncommand
					oItem.addEventListener("command",function () {prxSel.queueSetProxy(this)}, false);
					if (sValue != ""){
					oItem.setAttribute("class", "proxy-menu-item");
					prxSel.MenuList.insertBefore(oItem, oSeparator);}
					else {
					oItem.setAttribute("class", "proxy-menu-default");
					prxSel.MenuList.insertBefore(oItem, oDSeparator);}
				}
			
				//Select
				if(isSelected)
					prxSel.selectItem(sLabel);
				
			}catch(err){}
		}

		,
		/************************MMMMM**************************************/
		//Sets List item with label sLabel, to be selected/checked
		selectItem: function(sLabel){

			try{
						
				//Context
				if(prxSel.ContextList != null){
					var oItem = prxSel.ContextList.getElementsByAttribute("label", sLabel);
					if(oItem != null){
					
						//Uncheck Other
						var aChecked = prxSel.ContextList.getElementsByAttribute("checked", "true");
						for(var c = 0; c < aChecked.length; c++){
							aChecked[c].setAttribute("checked", false);
						}
					
						//Select
						oItem = oItem[0];
						prxSel.ContextList.selectedItem = oItem;
						oItem.setAttribute("checked", true);
					}
				}
				
				//Toolbar Element List
				if(prxSel.ElementList != null){
					var oItem = prxSel.ElementList.getElementsByAttribute("label", sLabel);
					if(oItem != null && oItem.length > 0){
						
						//Uncheck Other
						var aChecked = prxSel.ElementList.getElementsByAttribute("checked", "true");
						for(var c = 0; c < aChecked.length; c++){
							aChecked[c].setAttribute("checked", false);
						}
						
						//Check Selected
						oItem = oItem[0];
						prxSel.ElementList.selectedItem = oItem;
						oItem.setAttribute("selected", true);
						oItem.setAttribute("checked", true);
						
						//Change Button Label
						prxSel.ElementButton = document.getElementById('mproxy-element-button');	
						if(prxSel.ElementButton != null){
						
							prxSel.buttonType(sLabel);
						}

					}
				}

				
				// Tools Menu List
				if(prxSel.MenuList != null){
					var oItem = prxSel.MenuList.getElementsByAttribute("label", sLabel);
					if(oItem != null && oItem.length > 0){
					
						//Uncheck Other
						var aChecked = prxSel.MenuList.getElementsByAttribute("checked", "true");
						for(var c = 0; c < aChecked.length; c++){
							aChecked[c].setAttribute("checked", false);
						}
						
						//Check Selected
						oItem = oItem[0];
						prxSel.MenuList.selectedItem = oItem;
						oItem.setAttribute("selected", true);
						oItem.setAttribute("checked", true);
					}
				}
				
			}catch(err){
				mproxy_debug(err);
			}
		}

		,
		/*********************************************************************************/
		//Return menuitem for the given sUri
		getMenuItem: function(sUri){
			var oItem = null;
			
			//Context
			oItem = (prxSel.List != null) ? prxSel.ContextList.getElementsByAttribute("value", sUri) : null;
			if(oItem != null && oItem[0] != null)
				return oItem[0];
			
			//Toolbar Element
			oItem = (prxSel.List != null) ? prxSel.ElementList.getElementsByAttribute("value", sUri) : null;
			if(oItem != null && oItem[0] != null)
				return oItem[0];
					
			
			//Default
			return null;
		}

		,
		/*********************************************************************************/
		//Queue Set Proxy
		queueSetProxy: function(oMenuItem){
			
			prxSel.setTimer(function(){prxSel.setProxy(true, true, null,  oMenuItem.label , oMenuItem.getAttribute("value") , oMenuItem.getAttribute("proxyType") );}, 10); //AZZZ
		}

		,
		/*********************************************************************************/
		//Set Proxy
		setProxy: function (bClean, fromContextMenu, oMenuItem, sLabel, sUri, sType){

			//Start Command
			prxSel.CommandEnd = false;
			
			
			//If in Proxy Manager, do nothing
			if(prxSel.InManager){
				prxSel.CommandEnd = true;
				return;
			}
			
			var hasError	= false;
			
			//Set fromContextMenu
			if(fromContextMenu == null)
				fromContextMenu = false;
			
			//Get Proxy URI & Label
			var sProxyUri	= "";
			var sProxyLabel	= "";
			var sProxyType	= 5;
			if(sUri != null && sLabel != null){
				sProxyUri = sUri;
				sProxyLabel = sLabel;
				
				if(sType) sProxyType = sType;
			}
			else if(oMenuItem != null){
				sProxyUri	= oMenuItem.getAttribute("value");
				sProxyLabel	= oMenuItem.getAttribute("label");
				sProxyType	= oMenuItem.getAttribute("proxyType");
			}
			else{
				if(fromContextMenu == true){
					sProxyUri	= prxSel.ContextList.selectedItem.value;
					sProxyLabel	= prxSel.ContextList.selectedItem.label;
					sProxyType	= prxSel.ContextList.selectedItem.getAttribute("proxyType");
				}
				else if(prxSel.List != null){
					sProxyUri	= prxSel.List.selectedItem.value;
					sProxyLabel	= prxSel.List.selectedItem.label;
					sProxyType	= prxSel.List.selectedItem.getAttribute("proxyType");
				}
			}

			if(sProxyUri != ""){
				
				try{
					//Always clear proxy settings first - this may mess up with selection...
					//prxSel.Prefs.setIntPref("network.proxy.type", 0);

					//Change Browser Preferences
					var aProps	= prxSelDs.getPropertyValuesFor(sProxyUri);
					
					for(var key in prxG_options){
						
						//Get pref type and update preference
						var sPrefVal = "";
						if(typeof(prxG_options_defaults[key]) == "number"){
							prxSel.Prefs.setIntPref(prxG_options[key], parseInt(aProps[prxG_RdfNodeUriRoot +"#"+ key]));
						}
						else if(typeof(prxG_options_defaults[key]) == "boolean"){
								if (aProps[prxG_RdfNodeUriRoot +"#"+ key]=="true")
								{prxSel.Prefs.setBoolPref(prxG_options[key], true);}
									else
								{prxSel.Prefs.setBoolPref(prxG_options[key], false);}
						}
						else{ //String
							prxSel.Prefs.setCharPref(prxG_options[key], aProps[prxG_RdfNodeUriRoot +"#"+ key]);
						}
					}
					
					//Get Proxy Label
					sProxyLabel = aProps[prxG_RdfNodeName];
					
					//Update Preference
					prxSel.Prefs.setCharPref("extensions.proxyselector.proxy.current", sProxyUri);	
				}
				catch(err){
					prxSel.prompts.alert(null, null, "100: "+ prxGlob.getString("error.unknown")+ "\n("+ err +")");
					hasError = true;
					
				}
			}
			else if(sProxyType == "5") {
				//System-proxy pref
				try{
					prxSel.Prefs.setIntPref("network.proxy.type", 5);
					
					//Update Preference
					prxSel.Prefs.setCharPref("extensions.proxyselector.proxy.current", "System");
					
				}catch(e){
					prxSel.prompts.alert(null, null,"101: "+ prxGlob.getString("error.unknown"));
					hasError = true;
				}
			}
			else if(sProxyType == "4"){
				//Auto-detect pref
				try{
					prxSel.Prefs.setIntPref("network.proxy.type", 4);
					
					//Update Preference
					prxSel.Prefs.setCharPref("extensions.proxyselector.proxy.current", "Auto");
					
				}catch(e){
					prxSel.prompts.alert(null, null,"101: "+ prxGlob.getString("error.unknown"));
					hasError = true;
				}
				}
			else if(sProxyType == "0"){
				//Turn off proxy pref
				try{
					prxSel.Prefs.setIntPref("network.proxy.type", 0);
					
					//Update Preference
					prxSel.Prefs.setCharPref("extensions.proxyselector.proxy.current", "None");
					
				}catch(e){
					prxSel.prompts.alert(null, null,"101: "+ prxGlob.getString("error.unknown"));
					hasError = true;
				}
			}
			
			// Finalize
			if(hasError){
				//Update Status
				prxSel.setStatus(prxGlob.getString("error.proxy.load") +" " + sProxyLabel, "#F00");
			}
			else{
			
				//Select this proxy in all lists
				prxSel.selectItem(sProxyLabel);
				
				//Set Last Proxy
				prxSel.LastItem = prxSel.getMenuItem(sProxyUri);
				
				//Options
				try{
					if(bClean){
						// Clear Cookies
						if(typeof(gBrowser) != 'undefined'  && prxSel.Prefs.getBoolPref("extensions.proxyselector.clear.cookies")){
							prxSel.clearCookies();
						}
						
						// Reload Page
						if(typeof(gBrowser) != 'undefined' && prxSel.Prefs.getBoolPref("extensions.proxyselector.reload.tab")){
							try{
								var oTab = gBrowser.mCurrentBrowser;
									oTab.webNavigation.reload(nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
							} catch(err) {	}
						}
						
						// Set Update Pref
						prxSel.Prefs.setIntPref("extensions.proxyselector.proxy.rdf.lastupdate", (new Date()).getTime());
					}
					
				}catch(err){prxSel.prompts.alert(null, null,"102: "+ prxGlob.getString("error.unknown") + "\n("+err+")");}
			}

			//End Command
			prxSel.CommandEnd = true;
			
		}

		,
		/*********************************************************************************/
		//Test if the RDF Element, oRef, is the current proxy being used
		isSelected: function(oRef){
			
			try{
				var oPrefs		 = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
				var aProps		= prxSelDs.getPropertyValuesFor(oRef.Value);
				var sCurrUri	= "";
				var iType		= parseInt(aProps[prxG_RdfNodeUriRoot + "#networkProxyType"]);
				
				if(oPrefs.prefHasUserValue("extensions.proxyselector.proxy.current") && (sCurrUri = oPrefs.getCharPref("extensions.proxyselector.proxy.current")) == oRef.Value){
							
					//Verify this is really what's being used in the browser
					if(iType == oPrefs.getIntPref("network.proxy.type")){
						if(iType == 1){
							for(var key in prxG_options){
								
								//Skip These Keys
								if(key == "networkProxyType" || key == "networkProxyAutoconfigURL" || key == "networkProxyHTTPShare" )
									continue;
								
								//Skip if RDF has Default Values
								if( (key == "networkProxySOCKSVersion" && (aProps[prxG_RdfNodeUriRoot +"#"+ key] == "5" || aProps[prxG_RdfNodeUriRoot +"#"+ key] == ""))
									|| (key == "networkProxyNone" && aProps[prxG_RdfNodeUriRoot +"#"+ key] == "localhost, 127.0.0.1")){
									continue;								
								}
								
								//If Pref and RDF doesn't have a value for this
								if(!oPrefs.prefHasUserValue(prxG_options[key]) 
									&& (aProps[prxG_RdfNodeUriRoot +"#"+ key] == "" || aProps[prxG_RdfNodeUriRoot +"#"+ key] == "0")){
									continue;
								}
								
								// If pref doesn't have this and the RDF record does
								//	return false
								if(!oPrefs.prefHasUserValue(prxG_options[key]) 
									&& (aProps[prxG_RdfNodeUriRoot +"#"+ key] != "" && aProps[prxG_RdfNodeUriRoot +"#"+ key] != "0")){
									return false;
								}
								
								//Get pref and convert to string
								var sPrefVal = "";
								if(oPrefs.getPrefType(prxG_options[key]) == Components.interfaces.nsIPrefBranch.PREF_INT)
									sPrefVal = oPrefs.getIntPref(prxG_options[key]) + "";
								if(oPrefs.getPrefType(prxG_options[key]) == Components.interfaces.nsIPrefBranch.PREF_BOOL)
									sPrefVal = oPrefs.getBoolPref(prxG_options[key]) + "";
								if(oPrefs.getPrefType(prxG_options[key]) == Components.interfaces.nsIPrefBranch.PREF_STRING)
									sPrefVal = oPrefs.getCharPref(prxG_options[key]);
														
								//Return false if isn't equal
								if(sPrefVal != aProps[prxG_RdfNodeUriRoot +"#"+ key]){
									return false;
								}
							}
							return true;
						}
						
						//If type is 2 and the PAC url is the same
						else if(iType == 2 && oPrefs.prefHasUserValue("extensions.proxyselector.proxy.current") 
									&& oPrefs.getCharPref("network.proxy.autoconfig_url") == aProps[prxG_RdfNodeUriRoot + "#networkProxyAutoconfigURL"]){
								return true;
						}	
						//Direct connection, no proxy
						else if(iType == 0){
							return true;
						}
						//Auto-detect proxy
						else if(iType == 4){
							return true;
						}
						//System proxy
						else if(iType == 5){
							return true;
						}
					}
				}
				
			}catch(err){}
			
			return false;
		}

		,
		/*********************************************************************************/
		removeProxy: function(){
			
			var oItem	= prxSel.List.selectedItem;
		/* ZZ	
			//Can't delete 'None'
			if((prxSel.List.selectedItem != null) && 
				(prxSel.List.selectedItem.label == prxSel.NoneLabel) ){
				prxSel.prompts.alert(null, null,"150: "+ prxGlob.getString("error.remove.forbidden"));
				return;
			}
		*/	
		
			var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService)
				
			var result = prompts.confirm(null, null, prxGlob.getString("confirm.remove"));
		
			if(!result)
				return;
			
			try{
				//RDF
					//Remove
					prxSelDs.removeElement(oItem.value);
					
					//Cleanup
					prxSel.cleanupRdf();
				
				//Update List
					prxSel.populateList();
					prxSelDs.save();
					prxSel.setTimer(function(){prxSel.setProxy();}, 300); //AZZZ
			}
			catch(err){
				prxSel.prompts.alert(null, null,"151: "+ prxGlob.getString("error.remove") + "\n("+ err +")");
			}
		}

		,
		/*********************************************************************************/
		clearCookies: function(){
			try{
				var oCookies	= Components.classes["@mozilla.org/cookiemanager;1"].createInstance(Components.interfaces.nsICookieManager);
					oCookies.removeAll();
			}catch(err){
				prxSel.prompts.alert(null, null,"200: "+ prxGlob.getString("error.cookie"));
			}
			return true;
		}

		,
		/*********************************************************************************/
		add_proxy: function(sName, sPort, issocks, toset){
			try{ 

				var oTestProxy = prxSelDs.getElementForValue(prxG_RdfNodeName, sName);
				if(oTestProxy != null){
				  return false;
				}
				
				var sProxyUri   = prxSel.getUniqueProxyUri();
				var oProxy    = prxSelDs.getResource(sProxyUri);
				prxSelDs.addElement(sProxyUri);
				
				if (issocks) { //socks
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyType"), "1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyHTTP"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyHTTP_Port"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyHTTPShare"), false, true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySSL"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySSL_Port"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyFTP"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyFTP_Port"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySOCKS"), "127.0.0.1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySOCKS_Port"), sPort, true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySOCKSVersion"), "5", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyNone"), "localhost, 127.0.0.1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyAutoconfigURL"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#name"), sName, true);
				}
				else { //regular http for all
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyType"), "1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyHTTP"), "127.0.0.1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyHTTP_Port"), sPort, true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyHTTPShare"), true, true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySSL"), "127.0.0.1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySSL_Port"), sPort, true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyFTP"), "127.0.0.1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyFTP_Port"), sPort, true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySOCKS"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySOCKS_Port"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxySOCKSVersion"), "5", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyNone"), "localhost, 127.0.0.1", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#networkProxyAutoconfigURL"), "", true);
				  prxSelDs.addProperty(oProxy, prxSelDs.getResource(prxG_RdfNodeUriRoot+"#name"), sName, true);
				}
				if (toset) {
				  prxSel.setProxy(true, null, null, sName, sProxyUri, 1);
				  prxSel.selectItem(sName);
				}
				return true;
			}catch(e){
			  prxSel.prompts.alert(null, null, prxGlob.getString("error.unknown") +"\n("+ e +")");
			  return false;
			}
		}

		,
		/*********************************************************************************/
		populateList: function (sSelectedLabel){
			
			
			var sProxyUri	= "";
			var sCurrUri	= "";
			var aProxies	= new Array();
			var oPrefs		 = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			
			//Don't populate if a local command has not finished or if list is open
			if(!prxSel.CommandEnd){
				prxSel.CommandEnd = true; //reset
				return;
			}
			else{ //Start Command
				prxSel.CommandEnd = false;
			}
			
			//Load Elements
			try{
				//Remove List Items & Add 'None', 'System', 'Auto-detect'
				prxSel.clearList();
				
				if (oPrefs.prefHasUserValue("extensions.proxyselector.proxy.current") && (sCurrUri = oPrefs.getCharPref("extensions.proxyselector.proxy.current")) == "None"){
						prxSel.appendToList(prxSel.NoneLabel, "", true, 0);
						prxSel.selectItem(prxSel.NoneLabel);
						}
				else{
						prxSel.appendToList(prxSel.NoneLabel, "", false, 0);
				}
				
				if (oPrefs.prefHasUserValue("extensions.proxyselector.proxy.current") && (sCurrUri = oPrefs.getCharPref("extensions.proxyselector.proxy.current")) == "Auto"){
						prxSel.appendToList(prxSel.AutoLabel, "", true, 4);
						prxSel.selectItem(prxSel.AutoLabel);
						}
				else{
						prxSel.appendToList(prxSel.AutoLabel, "", false, 4);
				}
				
				if (oPrefs.prefHasUserValue("extensions.proxyselector.proxy.current") && (sCurrUri = oPrefs.getCharPref("extensions.proxyselector.proxy.current")) == "System"){
						prxSel.appendToList(prxSel.SystemLabel, "", true, 5);
						prxSel.selectItem(prxSel.SystemLabel);
						}
				else{
						prxSel.appendToList(prxSel.SystemLabel, "", false, 5);
				}
				
				//Get and Sort Elements
				var aProxies	= prxSelDs.getAllElements();
					aProxies.sort(prxSel.sortProxies);
				
				//Add to list
				for(var i = 0; i < aProxies.length; i++){
				
					if(typeof(aProxies[i]) == 'undefined')
						continue; 
					
					try{
					
						var oRes		= prxSelDs.getResource(aProxies[i]);
						var sProxyName	= prxSelDs.getValueFor(oRes, prxSelDs.getResource(prxG_RdfNodeName));
						var sProxyType	= prxSelDs.getValueFor(oRes, prxSelDs.getResource(prxG_RdfNodeUriRoot + "#networkProxyType"));
						
						if(sProxyName != null){
							var oItem = prxSel.appendToList(sProxyName, aProxies[i], false, sProxyType);

							//Select Item
							if((sSelectedLabel != null && sSelectedLabel == sProxyName) || (sSelectedLabel == null && prxSel.isSelected(oRes))){
								prxSel.selectItem(sProxyName);
							}
						}
						
					} catch(err) {}
				}
				
				//Finish
				prxSel.CommandEnd = true;
				prxSel.setTimer(function(){mproxy_selectProxy();}, 300); //AZZZ
				
			}catch(err){}
		}

		,
		/*********************************************************************************/
		/*	
		* Sort Proxy List
		*	+ oResA and oResB are RDF URIs
		*/
		
		sortProxies: function (oResA, oResB){
			try {
				//Get Proxy Names
				var sValA = prxSelDs.getValueFor(prxSelDs.getResource(oResA), prxSelDs.getResource(prxG_RdfNodeName));
				var sValB = prxSelDs.getValueFor(prxSelDs.getResource(oResB), prxSelDs.getResource(prxG_RdfNodeName));
				
				if (sValA < sValB)
					return -1;
				if (sValA == sValB)
					return 0;
				if (sValA > sValB)
					return 1;
			}
			catch(e){}
			return 0;
		}

		,
		/*********************************************************************************/
		/* Cleanup unused mproxy data in RDF
		*	 + Remove resources that have not been applied or used
		*/
		cleanupRdf: function(){
				
			try{

				var aElements	= prxSelDs.getAllElements();
				for(var e = 0; e < aElements.length; e++){
					var oRes	= prxSelDs.getResource(aElements[e]);
					var aProps	= prxSelDs.getPropertyValuesFor(aElements[e]);
					
					//If does not have a name property, 
					//	then it is not listed -- so it's junk
					if(aProps[prxG_RdfNodeName] == null){
						prxSelDs.removeElement(aElements[e]);
					}
				}
			}catch(err){}
		}

		,
		/*********************************************************************************/
		//Generates random number for proxy URI
		getUniqueProxyUri: function(){
			var sUri = prxG_RdfRoot + "/mproxy_" + Math.round((Math.random() * 200000));
			
			if(prxSelDs.doesProxyElementExist(sUri))
				return prxSel.getUniqueProxyUri();
			
			return sUri;
		}

		,
		/*********************************************************************************/
		setStatus: function(sMsg, sColor){
			if(!sColor)
				sColor = "#000";
			
			var oStatus = document.getElementById('status-text');
			
			if(oStatus != null){
				document.getElementById('status-text').style.color = sColor;
				document.getElementById('status-text').value = sMsg;
			}
		}

		,
		/*********************************************************************************/
		//Execute a command when system is ready
		//	iCurrCount is for internal use, do not
		//	pass this argument
		doCommand: function(sCommand, iLimitCount){
			
			if(iLimitCount == null)
				iLimitCount = 0;
			
			//Wait for current command to end
			if(!prxSel.CommandEnd && iLimitCount < 10){
				iLimitCount++
				prxSel.setTimer(function(){prxSel.doCommand(sCommand, iCurrCount);}, 100); //AZZZ
			}
			else{
				prxSel.CommandEnd = true;
			
			}
		}

		,
		/*********************************************************************************/
		/*
		* Launch Dialogs
		*/
			//Edit Proxy Dialog
		editProxyDialog: function (isNew)
		{
				
				var sAction = null;
				
				//Nothing Selected
				var oEditItem = null
				if(!isNew && (oEditItem = prxSel.List.selectedItem) == null)
				{
					prxSel.prompts.alert(null, null,"250: "+ prxGlob.getString("error.edit.select"));
					return;
				}
				
				//Edit
				if(!isNew)
				{
					window.openDialog("chrome://mproxy/content/editproxy.xul","editproxy","centerscreen, chrome", "edit", oEditItem.value);
				}
				
				//Add
				else
				{
					 window.openDialog("chrome://mproxy/content/editproxy.xul","addproxy","centerscreen, chrome", "add", prxSel.InManager);
				}
			}
			
		,
		/*********************************************************************************/
			//Manage Proxy Dialog
		openProxyManager: function()
		{
				
				window.openDialog("chrome://mproxy/content/options.xul","proxyselector-prefs","centerscreen, modal, chrome, toolbar","proxyselector-manager");
			}
		/*
		* Preferences
		*/
		,
		/*********************************************************************************/

		openmproxyPrefs: function()
			{
				window.openDialog("chrome://mproxy/content/options.xul","proxyselector-prefs","centerscreen, modal, chrome, toolbar", "proxyselector-general");
			}
			
			
		/*
		* avoid settimeout()
		*/
		,
		/*********************************************************************************/
		setTimer: function(callback, delay) {

				var event = {
					notify: function (timer) {
						try {
							callback.call();
						} catch (e) {}
					}
				};

				// Now it is time to create the timer...
				var timer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);

				if (delay === undefined) {
					delay = 0;
				}

				// ... and to initialize it, we want to call event.notify() ...
				// ... one time after exactly ten second.
				timer.initWithCallback(
					event,
					delay,
					Components.interfaces.nsITimer.TYPE_ONE_SHOT);

			}
}


/************************************************************************/
/* Start prxSel */
	
	try{window.addEventListener("load", prxSel.initProxy, true);}catch(e){}
	try{window.addEventListener("focus", prxSel.initProxy, true);}catch(e){}
	
/************************************************************************/