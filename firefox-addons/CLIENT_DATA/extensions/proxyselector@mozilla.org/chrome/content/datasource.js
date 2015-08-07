var prxSelDs = {

//DataSource
/* Ds: "",
Rdf: "",
RdfC: "",
RDFUtil: "",
*/

//Initializes the RDF Datasource components
initDataSource: function(){
	
	var gSProxyDs			= null;
	var gSProxyRdf			= null;
	var gSProxyRdfC			= null;
	var gSProxyRDFUtil		= null;
	
	try{
		
		// Datasource URI
		if(prxG_RdfDataSource == "rdf:local-store"){
			var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
			var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
			file = file.get("PrefD", Components.interfaces.nsIFile);
			file.appendRelativePath("proxyselector.rdf");
			
			io = io.newFileURI(file);
			prxG_RdfDataSource = io.spec;
		}
	
		if(prxSelDs.Rdf == null)
			prxSelDs.Rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
		if(prxSelDs.Ds == null)
			prxSelDs.Ds	= prxSelDs.Rdf.GetDataSourceBlocking(prxG_RdfDataSource);
		if(prxSelDs.RDFUtil == null)
			prxSelDs.RDFUtil = Components.classes["@mozilla.org/rdf/container-utils;1"].getService(Components.interfaces.nsIRDFContainerUtils);
		if(prxSelDs.RdfC == null){
			prxSelDs.RdfC = Components.classes["@mozilla.org/rdf/container;1"].createInstance(Components.interfaces.nsIRDFContainer);
			
			//Get or Add Sequence
			try{
				prxSelDs.RdfC.Init(prxSelDs.Ds, prxSelDs.Rdf.GetResource(prxG_RdfRoot)); //Get
			}catch(err){
				prxSelDs.RdfC = prxSelDs.RDFUtil.MakeSeq(prxSelDs.Ds, prxSelDs.Rdf.GetResource(prxG_RdfRoot)); //Create
			}
		}
				
	}catch(err){ throw "(prxSelDs.initDataSource)\n" + err; }
}
,
//Save RDF
save: function(){
	prxSelDs.initDataSource();
	try{
		prxSelDs.Ds.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
	}catch(err){ throw "(prxSelDs.save)\n" + err; }
}
,
//Add RDF Observer
addObserver: function(oObserver){
	prxSelDs.initDataSource();
	
	try{
		prxSelDs.Ds.AddObserver(oObserver);
	}catch(err){throw "(prxSelDs.addObserver)\n" + err}
}
,
//Returns resource for the given uri
getElement: function(sUri){
	prxSelDs.initDataSource();
	
	try{
		return prxSelDs.Rdf.GetResource(sUri);
	}catch(err){ throw "(prxSelDs.getElement)\n" + err; }
}
,
//Duplicate of prxSelDs.getElement
getResource: function(sAbout){
	return prxSelDs.getElement(sAbout)
}
,
//Returns array of all mproxy Element URIs
//	array[index] = uri
getAllElements: function(){
	prxSelDs.initDataSource();
	
	var aOut		= new Array();
	var aElements	= prxSelDs.RdfC.GetElements();
	while(aElements.hasMoreElements()){
		var oRes = aElements.getNext();
			oRes = oRes.QueryInterface(Components.interfaces.nsIRDFResource);
		
		aOut[aOut.length] = oRes.Value;
	}
	
	return aOut;
}
,
//Returns an associative array of properties (attributes) contained in sUri element
//	array[propName] = oRes
getPropertiesFor: function(sUri){
	prxSelDs.initDataSource();
	
	var aOut = new Array();
	
	//Get an array of elements for sAbout
	try{
		var oRes	= prxSelDs.getElement(sUri);
		var oTrgts	= prxSelDs.Ds.ArcLabelsOut(oRes);
		while(oTrgts.hasMoreElements()){
			var oTrgt = oTrgts.getNext();
			
			if (oTrgt instanceof Components.interfaces.nsIRDFResource){
				var sTrgName = oTrgt.Value.substring(prxG_RdfNodeUriRoot.length + 1); //return node name without URI
				aOut[sTrgName] = oTrgt;
			}
		}
	}catch(err){throw "(prxSelDs.getPropertiesFor)\n" + err}
	
	return aOut;
}
,
//Similar to 'prxSelDs.getPropertiesFor' however returns uri=>literal_object_value
//	array[uri] = oLiteral
getPropertyValuesFor: function(sUri){
	prxSelDs.initDataSource();
	
	var aOut = new Array();
	
	//Get an array of elements for sAbout
	try{
		var oRes	= prxSelDs.getElement(sUri);
		var oTrgts	= prxSelDs.Ds.ArcLabelsOut(oRes, true);
		while(oTrgts.hasMoreElements()){
			var oTrgt = oTrgts.getNext();
			
			if (oTrgt instanceof Components.interfaces.nsIRDFResource){
				aOut[oTrgt.Value] = prxSelDs.getValueFor(oRes, oTrgt);
			}
		}
	}catch(err){throw "(prxSelDs.getPropertyValuesFor)\n" + err}
	
	return aOut;
}
,
//Returns element that has this property/value
getElementForValue: function(sPropertyUri, sValue){
	prxSelDs.initDataSource();
	
	try{
		var oValue		 = prxSelDs.Rdf.GetLiteral(sValue);
		var oProp		 = prxSelDs.Rdf.GetResource(sPropertyUri);
		var oSubject	= prxSelDs.Ds.GetSource(oProp, oValue, true);
		
		return oSubject;
		
	}catch(err){throw "(prxSelDs.getElementForValue)\n" + err}
	
	return null;
}
,
// Returns all elements that has this property/value
getElementsForValue: function(sPropertyUri, sValue){
	prxSelDs.initDataSource();
	
	var aOut = new Array();
	
	try{
		var oValue		 = prxSelDs.Rdf.GetLiteral(sValue);
		var oProp		 = prxSelDs.Rdf.GetResource(sPropertyUri);
		var aSubject	= prxSelDs.Ds.GetSources(oProp, oValue, true);
		var oSubject	= null
		
		while(aSubject.hasMoreElements()){
			oSubject = aSubject.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
			aOut[aOut.length] = oSubject;
		}
		
	}catch(err){throw "(prxSelDs.getElementsForValue)\n" + err}
	
	return aOut;
}
,
//Change element's URI
changeElementUri: function(oRes, sNewUri){
	prxSelDs.initDataSource();
		
	try{
		
		//Get All Properties for element
		var aProps = prxSelDs.getPropertyValuesFor(oRes.Value);
		
		//Remove Element
		prxSelDs.removeElement(oRes.Value);
		
		//Create element again with new URI
		var newElem = prxSelDs.Rdf.GetResource(sNewUri);
		prxSelDs.RdfC.AppendElement(newElem);
		for(sProp in aProps){
			prxSelDs.Ds.Assert(newElem, prxSelDs.Rdf.GetResource(sProp), prxSelDs.Rdf.GetLiteral(aProps[sProp]), true);
		}
		
	}catch(err){throw "(prxSelDs.changeElementUri)\n" + err}
}
,
//Add element with given sUri, returns added resource
addElement: function(sUri){
	prxSelDs.initDataSource();
	
	var oRes;	
	
	try{
		
		return oRes = prxSelDs.RdfC.AppendElement(prxSelDs.Rdf.GetResource(sUri));
		
	}catch(err){throw "(prxSelDs.addElement)\n" + err}
}
,
//Remove Element for sUri
removeElement: function(sUri){
	prxSelDs.initDataSource();
	
	try{
		var oRes = prxSelDs.Rdf.GetResource(sUri);
	
		//Remove All Archs
		// Loop for duplicates
		var aArchs		= null;
		var hasArchs	= true;
		while(hasArchs){
			aArchs		 = prxSelDs.Ds.ArcLabelsOut(oRes);
			hasArchs	 = aArchs.hasMoreElements();
			while(aArchs.hasMoreElements()){
				var oArch = aArchs.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
				
				//Remove
				prxSelDs.Ds.Unassert(oRes, oArch, prxSelDs.Ds.GetTarget(oRes, oArch, true));
			}
		}
		
		//Remove Element
		prxSelDs.RdfC.RemoveElement(oRes, true);
	}catch(err){throw "(prxSelDs.removeElement)\n" + err}
}
,
//Remove property (sUri) from oRes
removeProperty: function(sUri, oRes, sValue){
	prxSelDs.initDataSource();
	
	try{
		var oPred	 = prxSelDs.Rdf.GetResource(sUri);
		var aValues	= prxSelDs.getValuesFor(oRes, oPred);
			 
	if(typeof(sValue) == 'undefined'){
		// Make sure to delete all properites of this sUri
		for(var i = 0; i < aValues.length; i++){ 
			prxSelDs.Ds.Unassert(oRes, oPred, prxSelDs.Rdf.GetLiteral(aValues[i]) );
		}
	}
	else{
		// Only delete the property with this value
		sValue = prxSelDs.Rdf.GetLiteral(sValue);
		if(prxSelDs.Ds.HasAssertion(oRes, oPred, sValue, true)){
			prxSelDs.Ds.Unassert(oRes, oPred,  sValue);
		}
	}
		
	}catch(err){throw "(prxSelDs.removeProperty)\n" + err}
}
,
//Does URI Exist
doesProxyElementExist: function(sProxyUri){
	prxSelDs.initDataSource();
	
	try{
		var aElems = prxSelDs.getAllElements();
		for(var e = 0; e < aElems.length; e++){
			if(aElems[e] == sProxyUri)
			return true;
		}		
	}catch(err){throw "(mproxy_ds_doesElementExist)\n" + err}
	return false;
}
,
//Get Index of URI
indexOf: function(sProxyUri){
	prxSelDs.initDataSource();
	
	try{
		return prxSelDs.RdfC.IndexOf(prxSelDs.getResource(sProxyUri));
	}catch(err){throw "(prxSelDs.indexOf)\n" + err}
}
,
//Rename oProp's URI to sNewUri
renamePropertyUri: function(oRes, oProp, sNewUri){
	prxSelDs.initDataSource();
	
	try{
		var sValue = prxSelDs.Ds.GetTarget(oRes, oProp, true).QueryInterface(Components.interfaces.nsIRDFLiteral);
		
		prxSelDs.Ds.Unassert(oRes, oProp, prxSelDs.Ds.GetTarget(oRes, oProp, true));
		prxSelDs.Ds.Assert(oRes, prxSelDs.Rdf.GetResource(sNewUri), sValue, true);
		
	}catch(err){throw "(prxSelDs.renamePropertyUri)\n" + err}
}
,
//Add Property oProp to oRes
addProperty: function(oRes, oProp, sValue, overwriteExisting){
	prxSelDs.initDataSource();
		
	try{
		//Don't overwrite it this property exists
		if(!overwriteExisting && prxSelDs.Ds.hasArcOut(oRes, oProp))
			return;
			
		//Add
		prxSelDs.Ds.Assert(oRes, oProp, prxSelDs.Rdf.GetLiteral(sValue), true);
	}catch(err){throw "(prxSelDs.addProperty)\n" + err}
}
,
//Change Property value for sPropUri in oRes
changePropertyValue: function(oRes, sPropUri, sValue){
	prxSelDs.initDataSource();
		
	try{
		var oProp = prxSelDs.Rdf.GetResource(sPropUri);
		
		//Get old value
		var sOld = prxSelDs.getValueFor(oRes, oProp);
		
		//Change
		prxSelDs.Ds.Change(oRes, oProp, prxSelDs.Rdf.GetLiteral(sOld), prxSelDs.Rdf.GetLiteral(sValue));
		
	}catch(err){throw "(prxSelDs.changePropertyValue)\n" + err}
}
,
//Get Property Value for Property oProp
getValueFor: function(oRes, oProp){
	prxSelDs.initDataSource();
	
	try{
		var oTrgt = prxSelDs.Ds.GetTarget(oRes, oProp, true);
		
		if(oTrgt instanceof Components.interfaces.nsIRDFLiteral){
			return oTrgt.Value;
		}
		
	}catch(err){throw "(prxSelDs.getValueFor)\n" + err}
	
	return null;
}
,
//Get All Property Values for Property oProp
//	This is similiar to prxSelDs.getValueFor
//	except it returns ALL values for oProp in an array
//		array[index] = sValue
getValuesFor: function(oRes, oProp){
	prxSelDs.initDataSource();

	var aOut = new Array();
	
	try{
		var aTrgts	 = prxSelDs.Ds.GetTargets(oRes, oProp, true)
		var oTrgt	= null;
		
		while(aTrgts.hasMoreElements()){
			oTrgt = aTrgts.getNext()
			
			if(oTrgt instanceof Components.interfaces.nsIRDFLiteral){
				aOut[aOut.length] = oTrgt.Value;
			}
		}
	}catch(err){throw "(prxSelDs.getValueFor)\n" + err}
	
	return aOut;
}
,
//Does Property/Value exist in oRes
doesPropValueExist: function(oRes, sPropUri, sValue){
	prxSelDs.initDataSource();
		
	try{
		var oProp	= prxSelDs.Rdf.GetResource(sPropUri);
		var aValues	= prxSelDs.getValuesFor(oRes, oProp);
		
		//Find in array
		for(var i = 0; i < aValues.length; i++){
			if(aValues[i] == sValue)
				return true;
		}
		
	}catch(err){throw "(prxSelDs.doesPropValueExist)\n" + err}
	
	return false;
}
,
/*
* GET PROPERTIES
*/
	
	//Get RDF Container
getRDFContainer: function(){
		prxSelDs.initDataSource();
		return prxSelDs.Rdf;
	}
	
}