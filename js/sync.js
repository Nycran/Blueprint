/**********************************************************
OBJECT: SYNC
***********************************************************/

/***
* @project: Blueprint
* @author: Andrew Chapman
* @copyright: SIMB Pty Ltd 2010 - 2011
*/

function Sync()
{
	var self = this;
	this.data = "";
	this.tableIndex = 0;
    this.syncIndex = 0;
    this.syncingRows = 0;
	this.recordIndex = 0;
    this.syncingTables = {};
    this.syncingIndexs = {};
    this.syncingCounter = 0;
    this.syncingTotalRequest = 0;
	this.refreshSync = false;
    this.startTime = '';
	this.noRefreshWarning = false;
	this.silentMode = false;
	this.callbackMethod = null;
    this.photosUploaded = false;
    this.sendDataAndPhotoOnly = false;
    this.lastSyncDatetime = '';
	/***
	* Setup the sync/account screen
	*/   
	this.setupSync = function(doRefresh)
	{
		// Default to standard sync
		self.refreshSync = doRefresh; 
		self.silentMode = false; 
		self.callbackMethod = null;  
		
		if(doRefresh)
		{
			self.forceRefresh();
		}
		else
		{
			$("#frmSync #refresh_sync").attr("checked", false);   	
		}

		// Hide all panels
		objApp.clearMain();
     
    
        // Set the main heading
        objApp.setHeading("Data Sync");
        objApp.setSubHeading("Send & Receive Inspection Data");
        objApp.setSubExtraHeading('', false);
        objApp.setNavActive("#navSync");
        
        // Show the sync screen.
        $("#sync").removeClass("hidden"); 
          
        // Bind sync events
        self.bindEvents();

        objApp.setBodyClass('sync');
	}
	
	/***
	* Binds click/touch events to controls
	*/
	this.bindEvents = function()
	{
		// Unbind submit button
		$("#frmSync .submit").unbind();
		
		// User starts sync
		$("#frmSync .submit").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			objApp.objSync.startSync();
		});

        $("#frmSync button#smartSync").unbind(objApp.touchEvent);
        $("#frmSync button#smartSync").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            objApp.objSync.smartSync();
        });
    }
	
	this.forceRefresh = function()
	{
		$("#frmSync #refresh_sync").attr("checked", "checked");
		objApp.objSync.noRefreshWarning = true;
		objApp.objSync.refreshSync = true;
	}
	
	this.startSyncSilent = function(callbackMethod)
	{
		self.silentMode = true;
		self.callbackMethod = callbackMethod;
        self.sendDataAndPhotoOnly = true;
        objDBUtils.callbackMethod = objApp.objSync.sendAndSyncData;
        setTimeout('objDBUtils.getDirtyData(1, 0);', 200);
	}
	
	this.startSync = function()
	{
		if(!self.silentMode)
		{
			// Make sure the username and pass have been entered.
			if(!$("#frmSync").validate().form())
			{
				alert("Please enter a valid email address and your password.  Your password should be at least 5 characters long.");
				return;
			}	
			
			if(($("#frmSync #refresh_sync").is(":checked")) && (!objApp.objSync.noRefreshWarning))
			{
				if(!confirm("Warning, you have selected the 'reset my data' option.  This will delete all your local data and then download everything from the Blueprint server.  Any data that you've entered since your last sync will be lost.  Are you sure?'"))
					return;
					
				objApp.objSync.refreshSync = true;  
			}
			
			this.tableIndex = 0;
			this.recordIndex = 0;
		}
        
		var parameters = {};
		parameters['email'] = localStorage.getItem("email");
		parameters['password'] = localStorage.getItem("password");

		if((parameters['email'] == null) || (parameters['password'] == null) || (parameters['email'] == "") || (parameters['password'] == ""))
		{
			objApp.objLogin.logout();
			return;
		}

        if(objApp.objSync.refreshSync)
        {
            // The user is doing a refresh sync
            // Clear any data in the database object
            objDBUtils.data = "";

            // Tell the database to delete all data.
            if (objApp.objSync.refreshSync)
                setTimeout('objDBUtils.emptyAllTables(1, objApp.objSync.getSmartData);', 200);
            else
                setTimeout('objDBUtils.emptyAllTables(1, objApp.objSync.sendAndSyncData);', 200);
        }
        else
        {
            var isPhonegap = objApp.phonegapBuild;
            // Now proceed with sync.
            // Ask the database object to get all dirty data and to call the sendData method
            // in this object when done.
            if (objApp.objSync.refreshSync)
                objDBUtils.callbackMethod = objApp.objSync.getSmartData;
            else
                objDBUtils.callbackMethod = objApp.objSync.sendAndSyncData;
            // Do not send photos when not running under phonegap.
            setTimeout('objDBUtils.getDirtyData(1, 0);', 200);
        }
	}

	this.smartSync = function()
	{
        objApp.objSync.startTime = '-2 weeks';
		if(!self.silentMode)
		{
			// Make sure the username and pass have been entered.
			if(!$("#frmSync").validate().form())
			{
				alert("Please enter a valid email address and your password.  Your password should be at least 5 characters long.");
				return;
			}

			if(($("#frmSync #refresh_sync").is(":checked")) && (!objApp.objSync.noRefreshWarning))
			{
				if(!confirm("Warning, you have selected the 'reset my data' option.  This will delete all your local data and then download everything since 2 weeks ago from the Blueprint server.  Any data that you've entered since your last sync will be lost.  Are you sure?'"))
					return;

				objApp.objSync.refreshSync = true;
			}

			this.tableIndex = 0;
			this.recordIndex = 0;
		}

		var parameters = {};
		parameters['email'] = localStorage.getItem("email");
		parameters['password'] = localStorage.getItem("password");

		if((parameters['email'] == null) || (parameters['password'] == null) || (parameters['email'] == "") || (parameters['password'] == ""))
		{
			objApp.objLogin.logout();
			return;
		}

        // The login is OK.
        if(objApp.objSync.refreshSync)
        {
            // The user is doing a refresh sync
            // Clear any data in the database object
            objDBUtils.data = "";
            // Tell the database to delete all data.
            setTimeout('objDBUtils.emptyAllTables(1, objApp.objSync.getSmartData);', 200);
        }
        else
        {
            var isPhonegap = objApp.phonegapBuild;
            objDBUtils.callbackMethod = objApp.objSync.getSmartData;
            // Do not send photos when not running under phonegap.
            setTimeout('objDBUtils.getDirtyData(1, 0);', 200);
        }
	}

    /***
     * getSmartData Get data from the Blueprint server,
     * awaits processing, and then receives any new
     * data and stores it locally.
     */
    this.getSmartData = function()
    {
        if(objApp.objSync.refreshSync)
        {
            if(!self.silentMode) $("#accountMessage #general").text("Asking server for your data...");
        }
        else
        {
            if(!self.silentMode) $("#accountMessage #general").text("Sending data to server...");
        }
        // Setup the request data.
        var parameters = {};
        parameters['email'] = localStorage.getItem("email");
        parameters['password'] = localStorage.getItem("password");
        parameters['version'] = objApp.version;
        parameters['patch'] = objApp.patch;
        if (objApp.IS_STATE_FILTERED == 1 && objApp.FILTERED_STATE_CODE){
            parameters['filtered_state_code'] = objApp.FILTERED_STATE_CODE;
            parameters['filtered_state_id'] = objApp.FILTERED_STATE_ID;
        }
        parameters['data'] = objDBUtils.data;
        parameters['anticache'] = Math.floor(Math.random() * 999999);
        parameters['start_time'] = objApp.objSync.startTime;
        parameters["z"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
        objApp.objSync.startTime = '';
        objApp.objSync.lastSyncDatetime = new Date();
        for(var i = 1; i < objDBUtils.tables.length; i++){
            // $("#accountMessage #general").append('<div id="msg'+objDBUtils.tables[i][0] +'"></div>');
            self.getDataTable(objDBUtils.tables[i][0], parameters);
        }
    }

    this.updateLastSyncDate = function(){
        var parameters = {};
        parameters['email'] = localStorage.getItem("email");
        parameters['password'] = localStorage.getItem("password");
        parameters['version'] = objApp.version;
        parameters['datetime'] = parseInt(objApp.objSync.lastSyncDatetime.getTime()/1000);
        objApp.objSync.lastSyncDatetime = '';
        $.post(objApp.apiURL + 'account/update_last_sync_date/', parameters , function(data){});
    }

    this.getDataTable = function(tableName, parameters, try_count)
    {
        if(typeof try_count == 'undefined')
            try_count = 0;
        var refreshSync = "false";
        if(objApp.objSync.refreshSync)
            refreshSync = "true";

        self.syncingTables[tableName] = [];
        self.syncingIndexs[tableName] = 0;

        self.syncingCounter++;
        self.syncingTotalRequest++;

        if (tableName == 'builders_supervisors')
            objDBUtils.emptyTable('builders_supervisors');

        if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
        if(!self.silentMode) blockElement("body");
        $.post(objApp.apiURL + 'account/get_data_table/' + tableName +'/' + refreshSync, parameters , function(data)
        {
            // Remove / clear the data store temporarily in the DB object
            objDBUtils.data = "";
            raw_data = data;
            try {
                data = jQuery.parseJSON(data);

                // Make sure the server processed the data OK.
                if(data.status == "OK")
                {
                    var tableName = data.table_name;
                    if (typeof data.numberOfPages != 'undefined'){
                        self.syncingCounter--;
                        /* Table is large, let send multiple requests */
                        var itemPerPage = 5000;
                        for(var p = 1; p <= data.numberOfPages; p++){
                            self.syncingTables[tableName] = {};
                            self.syncingIndexs[tableName] = {};
                            self.syncingCounter++;
                            self.syncingTotalRequest++;
                            if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
                            $.post(objApp.apiURL + 'account/get_data_table/' + tableName +'/' + refreshSync + '/' + p, parameters , function(r_data)
                            {
                                var raw_data2 = r_data;
                                r_data = jQuery.parseJSON(r_data);
                                if(r_data.status == "OK") {
                                    var tblName = r_data.table_name;
                                    var page = r_data.page;

                                    // Store the data locally.
                                    self.syncingTables[tblName][page] = r_data[tblName];
                                    self.syncingIndexs[tblName][page] = 0;

                                    // Data was processed OK.
                                    // Did the server send us any data to store locally?
                                    if (self.syncingTables[tblName][page].length > 0) {
                                        // Get the current row
                                        var row = self.syncingTables[tblName][page][self.syncingIndexs[tblName][page]];

                                        // Start a transaction
                                        objDBUtils.db.transaction(function (transaction) {
                                            // handleRecord processes a record and handles deciding whether to
                                            // process more records in the current table or whether to move on to the next table.
                                            var handleRecord = function (transaction, tblName, row) {
                                                // Build the sql insert/update statement
                                                var sql = self.buildSaveData(tblName, row);

                                                function goNext(transaction){
                                                    // Increment the recordIndex
                                                    self.syncingIndexs[tblName][page]++;
                                                    if (self.syncingIndexs[tblName][page] >= self.syncingTables[tblName][page].length) {
                                                        self.syncingCounter--;
                                                        if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
                                                        if (self.syncingCounter == 0) {
                                                            self.updateLastSyncDate();
                                                            if (!self.silentMode){
                                                                self.tableIdx = 0;
                                                                self.uploadPhotos("inspection");
                                                            }
                                                        }
                                                    }
                                                    else {
                                                        // There is more data to handle for this table
                                                        // Get the next row.
                                                        row = self.syncingTables[tblName][page][self.syncingIndexs[tblName][page]];
                                                        handleRecord(transaction, tblName, row);
                                                    }
                                                }
                                                transaction.executeSql(sql, self.saveData, function (transaction, result) {
                                                    goNext(transaction);
                                                }, DBErrorHandler);

                                                function DBErrorHandler(transaction, error)
                                                {
                                                    var text_context = (typeof context != 'undefined' && context != "") ? "(" + context + ") " : "";
                                                    self.doServerLog("Error "+text_context+": " + error.message + " in " + sql + " (params : "+self.saveData.join(", ")+")");
                                                    goNext(transaction);
                                                }
                                            };

                                            // Handle the first record for this table.
                                            handleRecord(transaction, tblName, row);
                                        });
                                    }
                                    else
                                    {
                                        self.syncingCounter--;
                                        if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
                                        if (self.syncingCounter == 0) {
                                            self.updateLastSyncDate();
                                            if (!self.silentMode){
                                                self.tableIdx = 0;
                                                self.uploadPhotos("inspection");
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    if(!self.silentMode)
                                    {
                                        unblockElement("body");
                                        alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                                        $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team." );
                                        self.doServerLog("[E3]: " + raw_data2);
                                    }
                                    else if(self.callbackMethod != null)
                                    {
                                        self.callbackMethod(false);
                                    }
                                }
                            }, "").fail(function() {
                                self.syncingCounter--;
                                if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
                                if (self.syncingCounter == 0) {
                                    self.updateLastSyncDate();
                                    if (!self.silentMode){
                                        self.tableIdx = 0;
                                        self.uploadPhotos("inspection");
                                    }
                                }
                                self.doServerLog("[E8]: " + objApp.apiURL + 'account/get_data_table/' + tableName +'/' + refreshSync + '/' + p + ' - parameters: ' + parameters.join(','));
                            });
                        }

                    }else{
                        if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);

                        // Store the data locally.
                        self.syncingTables[tableName] = data[tableName];

                        // Data was processed OK.
                        // Did the server send us any data to store locally?
                        if(self.syncingTables[tableName].length > 0)
                        {
                            // Get the current row
                            var row = self.syncingTables[tableName][self.syncingIndexs[tableName]];

                            // Start a transaction
                            objDBUtils.db.transaction(function(transaction)
                            {
                                // handleRecord processes a record and handles deciding whether to
                                // process more records in the current table or whether to move on to the next table.
                                var handleRecord = function(transaction, tableName, row)
                                {
                                    // Build the sql insert/update statement
                                    var sql = self.buildSaveData(tableName, row);

                                    function goNext(transaction){
                                        // Increment the recordIndex
                                        self.syncingIndexs[tableName]++;
                                        if(self.syncingIndexs[tableName] >= self.syncingTables[tableName].length)
                                        {
                                            if(!self.silentMode) $("#accountMessage #msg" + tableName).text("Table " + tableName + ": " + self.syncingIndexs[tableName] + " records has been loaded.");
                                            self.syncingCounter--;
                                            if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
                                            if (self.syncingCounter == 0) {
                                                self.updateLastSyncDate();
                                                if (!self.silentMode){
                                                    self.tableIdx = 0;
                                                    self.uploadPhotos("inspection");
                                                }
                                            }
                                        }
                                        else
                                        {
                                            // There is more data to handle for this table
                                            // Get the next row.
                                            row = self.syncingTables[tableName][self.syncingIndexs[tableName]];
                                            handleRecord(transaction, tableName, row);
                                        }
                                    }

                                    transaction.executeSql(sql, self.saveData, function (transaction, result)
                                    {
                                        goNext(transaction);
                                    }, DBErrorHandler);

                                    function DBErrorHandler(transaction, error)
                                    {
                                        var text_context = (typeof context != 'undefined' && context != "") ? "(" + context + ") " : "";
                                        self.doServerLog("Error "+text_context+": " + error.message + " in " + sql + " (params : "+self.saveData.join(", ")+")");
                                        goNext(transaction);
                                    }
                                };

                                // Handle the first record for this table.
                                handleRecord(transaction, tableName, row);
                            });
                        }
                        else
                        {
                            self.syncingCounter--;
                            if(!self.silentMode) $("#accountMessage #general").text("Processing: " + (self.syncingTotalRequest - self.syncingCounter) + '/' + self.syncingTotalRequest);
                            if (self.syncingCounter == 0) {
                                self.updateLastSyncDate();
                                if (!self.silentMode){
                                    self.tableIdx = 0;
                                    self.uploadPhotos("inspection");
                                }
                            }
                        }
                    }
                }
                else if(data.message == "INVALID")
                {
                    if(!self.silentMode)
                    {
                        unblockElement("body");
                        $("#accountMessage #general").text("Sorry, either your email or password is incorrect.");
                    }
                    else if(self.callbackMethod != null)
                    {
                        self.callbackMethod(false);
                    }
                }
                else
                {
                    if(!self.silentMode)
                    {
                        unblockElement("body");
                        alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                        $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team.");
                        self.doServerLog("[E4]: " + raw_data);
                    }
                    else if(self.callbackMethod != null)
                    {
                        self.callbackMethod(false);
                    }
                }
            } catch (e) {
                // error
                console.log(e);
                if(!self.silentMode)
                {
                    unblockElement("body");
                    alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                    $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team.");
                    self.doServerLog("[E5]: " + raw_data);
                }
                else if(self.callbackMethod != null)
                {
                    self.callbackMethod(false);
                }
            }
        }, "").fail(function() {
            self.doServerLog("[E6]: " + objApp.apiURL + 'account/get_data_table/' + tableName +'/' + refreshSync + ' - parameters: ' + parameters.join('') + ' - try_count: ' + try_count);
            /* Give it a try */
            if(try_count == 0){
                self.getDataTable(tableName, parameters, 1);
            }else{
                if(!self.silentMode)
                {
                    unblockElement("body");
                    alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                    $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team.");
                }
                else if(self.callbackMethod != null)
                {
                    self.callbackMethod(false);
                }
            }
        });
    }

	/***
	* sendAndSyncData Sends data to the Blueprint server,
	* awaits processing, and then receives any new
	* data and stores it locally.
	*/
    this.sendAndSyncData = function()
    {
        self.sendData();
		self.saveGraphs();
    }

    this.validData = function(data)
    {
        return data.replace(/â€™/g,"'").replace(/â€˜/g,"'");
    }

	this.sendData = function()
	{
		// Setup the request data.
		var parameters = {};
		parameters['email'] = localStorage.getItem("email");
		parameters['password'] = localStorage.getItem("password");		
		parameters['version'] = objApp.version;
        parameters['data'] = $.base64('encode', self.validData(objDBUtils.data));
        parameters['anticache'] = Math.floor(Math.random() * 999999);
        parameters['start_time'] = objApp.objSync.startTime;
        parameters["z"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
        objApp.objSync.startTime = '';
		var refreshSync = "false";
        self.doServerLog(self.validData(objDBUtils.data));
		if(objApp.objSync.refreshSync)
		{
			// Set the refresh sync flag
			refreshSync = "true";

			if(!self.silentMode)  $("#accountMessage #general").text("Asking server for your data...");
		}
		else
		{
			if(!self.silentMode)  $("#accountMessage #general").text("Sending data to server...");
		}
        if(!self.silentMode) blockElement("body");
		$.post(objApp.apiURL + 'account/process_data_tables/' + refreshSync, parameters , function(data)
		{
			// Remove / clear the data store temporarily in the DB object
			objDBUtils.data = "";
            var raw_data = data;
            try {
                data = jQuery.parseJSON(data);

                // Make sure the server processed the data OK.
                if(data.status == "OK")
                {
                    if(!self.silentMode) $("#accountMessage #general").text("Data sent OK, checking for data to process...");
                    if (self.sendDataAndPhotoOnly){
                        self.sendDataAndPhotoOnly = false;
                        self.tableIdx = 0;
                        self.uploadPhotos("inspection");
                    }else{
                        self.getSmartData();
                    }

                }
                else if(data.message == "INVALID")
                {
                    if(!self.silentMode)
                    {
                        unblockElement("body");
                        $("#accountMessage #general").text("Sorry, either your email or password is incorrect.");
                    }
                    else if(self.callbackMethod != null)
                    {
                        self.callbackMethod(false);
                    }
                }
                else
                {
                    if(!self.silentMode)
                    {
                        unblockElement("body");
                        alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                        $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team.");
                        self.doServerLog("[E1]: " + raw_data);
                    }
                    else if(self.callbackMethod != null)
                    {
                        self.callbackMethod(false);
                    }
                }


            } catch (e) {
                console.log(e);
                // error
                if(!self.silentMode)
                {
                    unblockElement("body");
                    alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                    $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team.");
                    self.doServerLog("[E2]: " + raw_data);
                }
                else if(self.callbackMethod != null)
                {
                    self.callbackMethod(false);
                }
            }
		}, "").fail(function() {
            if(!self.silentMode)
            {
                unblockElement("body");
                alert("Warning: An error occured during the data sync operation. Please report this error to the Blueprint team.");
                $("#accountMessage #general").text("Sorry, something went wrong during the processing phase. Please report this error to the Blueprint team.");
                self.doServerLog("[E7]");
            }
            else if(self.callbackMethod != null)
            {
                self.callbackMethod(false);
            }
        });
	}

	this.saveGraphs = function()
    {
        if (typeof inspections_ids != 'undefined' && inspections_ids.length > 0){
            var parameters = {};
            parameters['email'] = localStorage.getItem("email");
            parameters['password'] = localStorage.getItem("password");
            parameters['version'] = objApp.version;
            parameters['number_of_items'] = inspections_ids.length;
            for(var i = 0; i < inspections_ids.length; i++){
                parameters['id' + i] = inspections_ids[i];
                parameters['image' + i] = inspection_charts[i];
            }
            parameters["z"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
            $.post(objApp.apiURL + 'inspections/save_graphs', parameters , function(data)
            {
                try {
                    data = jQuery.parseJSON(data);
                    if(data.status == "OK"){
                        if (data.ids.length){
                            for(var i in data.ids)
                                removeChartFromQueue(data.ids[i]);
                        }
                    }
                } catch (e) {
                    console.log(e);
                }
            }, "");
        }
    }
	
	/***
	* buildSaveData creates the SQL update/insert string for the current table
	* and also stores the necessary insert/update data in an internal array.
	*/
	this.buildSaveData = function(tableName, row)
	{
		var sql = "";  
		self.saveData = new Array();
		var fieldIdx = 0;
				

		// FOR ALL OTHER TABLES, USE INSERT OR REPLACE syntax to keep things simple
		sql = "INSERT OR REPLACE INTO " + tableName + " ";
		var header = "(";
		var footer = "VALUES (";
			
		// Loop through the field names
		for (var field in row) 
		{
			if(fieldIdx > 0)
			{
				header += ", ";	
				footer += ", ";	
			}
			
			header += field;
			footer += "?";
			
			// Save the value into the saveData array.	
			self.saveData.push(row[field]);
			
			fieldIdx++;
		}
        self.saveData.push('0'); /* dirty = 0 */
		sql += header + ", dirty) " + footer + ", ?);";

		return sql;
	};	
	
	
	this.removeDirtyFlags = function()
	{
		self.tableIdx++; 
	
		if(self.tableIdx < objDBUtils.tables.length)
		{
			var tableName = objDBUtils.tables[self.tableIdx][0];   
			if(!self.silentMode)  $("#accountMessage #general").text("Cleaning up table '" + tableName + "', one moment...");

			// Set all dirty records as not dirty
			var sql = "UPDATE " + tableName + " SET dirty = 0 WHERE dirty = 1";
			if(tableName == "inspections")
			{
				// For the inspections table, only set dirty to 0 when the inspection has been finalised.
				//sql += " AND finalised = 1";
			}
			
			objDBUtils.execute(sql, null, objApp.objSync.removeDirtyFlags);

			// Remove deleted records from local storage.  However, dont delete deleted contactfavourite records
            // as the deleted flag in this table simply means that the contact is not infact a favourite of this user.
            if(tableName != "contactsfavourites" && tableName != "builders_supervisors") {
			    var sql = "DELETE FROM " + tableName + " WHERE deleted = 1;";
			    objDBUtils.execute(sql, null, null);			
            }
		}   
		else
		{
			if(objApp.phonegapBuild)
			{
				self.storePhotosOnFS()
			}
			else
			{
                self.syncFinished();
			}
		}
	}
	
	/***
	* Stores any thumbnails returned from the server (will be in base64 encoding in the inspectionitemphotos table)
	* onto the local file system, and then clears the space in the database, thus freeing up considerable room.
	*/
	this.storePhotosOnFS = function()
	{
		var fail = function(error)
		{
			alert("storePhotosOnFS::Caught error: " + error.code);
		}
        
		// Request access to the file system
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
		{
			// Get a recordset of any photos that have not yet been moved to the filesystem
			var sql = "SELECT iip.*, i.report_type, si.id as sig_id " +
				"FROM inspectionitemphotos iip " +
                "INNER JOIN inspections i ON i.id = iip.inspection_id " +
                "LEFT JOIN significant_items si ON si.photo_id = iip.id AND si.deleted != 1 " +
				"WHERE length(iip.photodata_tmb) > 500";
			objDBUtils.loadRecordsSQL(sql, [], function(param, items)
			{
				if(!items)
				{
					// Nothing to do.
					self.syncFinished();
					return;	
				}
				
				var maxLoop = items.rows.length;
				var r = 0;
				var total_cleared = 0;
				
				var doNext = function()
				{
					var row = items.rows.item(r);
					/* Do not convert raw data to image for significant photos of pre-plaster and pre-paint report */
                    if(row.sig_id && (row.report_type == 'Builder: Pre-plaster and lock up inspections' || row.report_type == 'Builder: Pre-paint/fixing inspections')) {
                        r++;
                        if(r < maxLoop)
                            doNext();
                        else
                            self.syncFinished();
                    }else{
                        var tmb_data = row.photodata_tmb;
                        var file_name = row.id + "_thumb.jpg";

                        // Get permission to write the file
                        fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
                        {
                            // Create the file write object
                            fileEntry.createWriter(function(writer)
                            {
                                writer.onwriteend = function(evt)
                                {
                                    // Get the file URI
                                    if (is_on_simulator)
                                        var uri = fileEntry.fullPath;
                                    else
                                        var uri = fileEntry.toURI();

                                    // Update the database with the URI
                                    sql = "UPDATE inspectionitemphotos " +
                                        "SET photodata_tmb = ? " +
                                        "WHERE id = ?";

                                    objDBUtils.execute(sql, [uri, row.id], function()
                                    {
                                        r++;

                                        if(r < maxLoop)
                                        {
                                            doNext();
                                        }
                                        else
                                        {
                                            self.syncFinished();
                                        }
                                    });
                                };
                                // Write the thumbnail data to the file.
                                if (is_on_simulator) {
                                    writer.write(new Blob([tmb_data]));
                                } else {
                                    writer.write(tmb_data);
                                }
                            }, fail);

                        }, fail);
                    }
				}
				
				if(r < maxLoop)
				{
					if(!self.silentMode)
					{     
						 $("#accountMessage #general").text("Moving thumbnails to local file system");	
					}
					doNext();
				}
			}, "");				

		}, fail);  
	}
	
	this.syncFinished = function()
	{	              
		if(!self.silentMode)
		{
			unblockElement("body");
			 $("#accountMessage #general").text("All done - Sync completed successfully!");	
		}
		
		// Not sure why this is required, but the
		// sync object gets messed up after a sync finishes.
		objApp.objSync = new Sync();
		
		if(self.silentMode)		
		{
			if(self.callbackMethod != null)	
			{
				// Invoke the callback method and let it know the sync completed successfully.
				self.callbackMethod(true);
			}
		}
	}
	
	this.getLoginParams = function()
	{
		var parameters = {};
		
		parameters['email'] = localStorage.getItem("email");
		parameters['password'] = localStorage.getItem("password");
		
		if((parameters['email'] == null) || (parameters['email'] == ""))
		{
			return false;
		}
		
		if((parameters['password'] == null) || (parameters['password'] == ""))
		{
			return false;
		}		
		
		return parameters;		
	}
	
	this.uploadPhotos = function(photo_type)
	{                 
        self.tableIndex = 0; 

        var table = "inspectionitemphotos";
        if(photo_type == "reinspection") {
            table = "reinspectionitemphotos";
        }
        
        // Get a recordset of photos with their dirty flags set
		var sql = "SELECT id " +
			"FROM " + table + " " +
			"WHERE dirty = 1";

		objDBUtils.loadRecordsSQL(sql, [], function(param, items)
		{
			if(!items)
			{
                // If we're done with uploading inspection photos,
                // now upload reinspection photos
                if(photo_type == "inspection") {
                    self.uploadPhotos("reinspection");
                } else {
                    // If we're done with reinspection photos, finish up.
                    self.removeDirtyFlags();
                }
                
				return;
			}
			
			var maxLoop = items.rows.length;
			var r = 0;
			
			var doNext = function()
			{
                var row = items.rows.item(r);

                // Define a method to actually upload the photo data once it has been retrieved
                // either from the FS or from the database.
                var uploadPhoto = function(photodata_tmb, photodata, item)
                {
                    var params = {};

                    // Add login details
                    params['email'] = localStorage.getItem("email");
                    params['password'] = localStorage.getItem("password");
                    params['version'] = objApp.version;

                    // Add item details
                    params["id"] = item.id;
                    params["seq_no"] = item.seq_no;
                    params["deleted"] = item.deleted;
                    params["photodata"] = photodata;
                    params["photodata_tmb"] = photodata_tmb;
                    params["notes"] = item.notes;
                    params["photo_type"] = photo_type;

                    // The normal inspection table has the cover photo and report photos fields.
                    if(photo_type == "inspection") {
                        params["inspection_id"] = item.inspection_id;
                        params["is_cover_photo"] = item.is_cover_photo;
                        params["is_report_photo"] = item.is_report_photo;
                    } else {
                        params["reinspection_id"] = item.reinspection_id;
                    }

                    if(!self.silentMode)  $("#accountMessage #general").text("Uploading photo " + (r + 1));

                    // Invoke the upload
                    $.post(objApp.apiURL + "inspections/upload_photo", params, function(data)
                    {
                        if(data.status != "OK")
                        {
                            alert("An error occured whilst trying to upload the photo: " + data.message);
                            return;
                        }

                        // The photo uploaded OK

                        // Set the dirty flag back to 0
                        var sql = "UPDATE " + table + " " +
                            "SET dirty = 0 " +
                            "WHERE id = ?";

                        objDBUtils.execute(sql, [row.id], function()
                        {
                            // Increment the row counter
                            r++;

                            // If there are more photos to upload upload them, otherwise start the normal sync.
                            if(r < maxLoop)
                            {
                                doNext();
                            }
                            else
                            {
                                // If we're done with uploading inspection photos,
                                // now upload reinspection photos
                                if(photo_type == "inspection") {
                                    self.uploadPhotos("reinspection");
                                } else {
                                    // If we're done with reinspection photos, finish up.
                                    self.removeDirtyFlags();
                                }
                            }
                        });
                    }, "json");
                };

                objDBUtils.loadRecord(table, row.id, function(item_id, item)
                {
                    var photodata = "";
                    var photodata_tmb = "";

                    if(item.photodata)
                    {
                        if(item.photodata_tmb.indexOf('_thumb') == -1){
                            photodata = item.photodata;
                            photodata_tmb = item.photodata_tmb;
                            uploadPhoto(photodata_tmb, photodata, item);
                        }else{
                            // If phonegap is being used, the image data is on the file system.
                            // Get the thumbnail
                            var file_name = item.id + "_thumb.jpg";

                            objUtils.readFile(file_name, function(success, data)
                            {
                                if(!success)
                                {
                                    alert("Couldn't read file: " + file_name);
                                    return;
                                }

                                photodata_tmb = data;

                                // Now get the big image
                                file_name = item.id + ".jpg";

                                objUtils.readFile(file_name, function(success, data)
                                {
                                    if(!success)
                                    {
                                        alert("Couldn't read file: " + file_name);
                                        return;
                                    }
                                    photodata = data;
                                    uploadPhoto(photodata_tmb, photodata, item);
                                });
                            });
                        }
                    }
                    else
                    {
                        alert("Your photo " + (r + 1) + " is not valid, please re-upload it again");
                        // Set the dirty flag back to 0
                        var sql = "UPDATE " + table + " " +
                            "SET dirty = 0 " +
                            "WHERE id = ?";

                        objDBUtils.execute(sql, [row.id], function()
                        {
                            // Increment the row counter
                            r++;

                            // If there are more photos to upload upload them, otherwise start the normal sync.
                            if(r < maxLoop)
                            {
                                doNext();
                            }
                            else
                            {
                                // If we're done with uploading inspection photos,
                                // now upload reinspection photos
                                if(photo_type == "inspection") {
                                    self.uploadPhotos("reinspection");
                                } else {
                                    // If we're done with reinspection photos, finish up.
                                    self.removeDirtyFlags();
                                }
                            }
                        });
                    }
                }, row.id);
			};
			
			if(r < maxLoop)				
			{
				doNext();
			}
			else
			{
                // If we're done with uploading inspection photos,
                // now upload reinspection photos
                if(photo_type == "inspection") {
                    self.uploadPhotos("reinspection");
                } else {
                    // If we're done with reinspection photos, finish up.
                    self.removeDirtyFlags();
                }
			}			
			
		}, "");
	}

    this.DB_error_handler = function(transaction, error)
    {
        console.log(transaction);
        /*
        alert("Sorry, the following database error occured\n\n" +
            "Code: " + error.code + "\n" +
            "Message: " + error.message);
        */
    }

    this.doServerLog = function(log_msg){
	    console.log(log_msg);
        var parameters = {};
        parameters['email'] = localStorage.getItem("email");
        parameters['password'] = localStorage.getItem("password");
        parameters['version'] = objApp.version;
        parameters['log_msg'] = log_msg;
        parameters["z"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
        $.post(objApp.apiURL + 'account/do_server_log', parameters , function(data){}, "");
    }
}
