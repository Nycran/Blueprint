/**********************************************************
DATABASE UTILS OBJECT
***********************************************************/

/***
* @author: Andrew Chapman
* @copyright: SIMB Pty Ltd 2010 - 2012
*/

function DBUtils()
{
	var self = this;	// Create a reference to the object itself 
	
	this.db_short_name = "BluePrint";   	// The database short name
	this.db_version = "1.0";             	// The database version
	this.db_display_name = "BluePrint"; 	// The name of the database that's shown to the user in settings
	this.db_max_size = 5 * 1024 * 1024;  		// Maximum database size in Kb
	this.db_OK = false;                  	// Set to true if a localstorage DB object is successfully created
	this.DB_DEBUG = false;                	// Set to true to enable database debug messages	
	
	// Define variables used to control queries.
	this.primaryKey = "";
	this.showColumn = "";
	this.orderBy = "";
	this.lastID = "";
	this.callbackMethod = null;
	
	this.data = "";
	
	// Define the Blueprint database tables and versions
	this.tables = new Array();
	this.tables.push(new Array('app_tables', 1.0));
    this.tables.push(new Array('address_book', 1.0));
	this.tables.push(new Array('builders', 1.0));
    this.tables.push(new Array('builders_supervisors', 1.0));
	this.tables.push(new Array('resources', 1.0));
	this.tables.push(new Array('inspections', 1.2));
	this.tables.push(new Array('reinspections', 1.2));
	this.tables.push(new Array('inspectionitems', 1.0));
	this.tables.push(new Array('reinspectionitems', 1.0));
	this.tables.push(new Array('inspectionitemphotos', 1.0));
	this.tables.push(new Array('reinspectionitemphotos', 1.0));
    this.tables.push(new Array('users', 1.0));
    this.tables.push(new Array('contacts', 1.0));
    this.tables.push(new Array('contactsfavourites', 1.0));
    this.tables.push(new Array('significant_items', 1.0));
	
	// Open the database

	if (typeof window.sqlitePlugin != 'undefined'){
		alert('Using sqlitePlugin');
		this.db = window.sqlitePlugin.openDatabase(this.db_short_name + '.db', this.db_version, this.db_display_name, 1);
	}
	else{
        alert("Apple discontinued the support for WebSQL in Progressive Web Apps.");
        window.location("https://developer.apple.com/documentation/safari_release_notes/safari_13_release_notes");
        return;
    }
	
	// Determine if we have successfully opened the database or not.
	if(!this.db)
	{
	   alert("Sorry, an error occured whilst trying to open a local database.  This application will not work on your device.");
	   window.location("http://www.google.com");
	   return;
	}
	else
	{
	   db_OK = true;
	}
	   
	this.getDirtyData = function(table_number, send_photos)
	{
		var table_name = this.tables[table_number][0]; 
		var table_version = this.tables[table_number][1];
        
        // NEVER send user data back - it is read only
		if(((!send_photos) && (table_name == "inspectionitemphotos")) || (table_name == "users"))
		{
			// Skip this table
			var next_table = table_number + 1;
			
			if(next_table < self.tables.length)
			{
				self.getDirtyData(table_number + 1);
                return;
			}
			else
			{
                self.callbackMethod();				
                return;
			}
		}
		
		var tableSep = "#EOT#";
		//var fieldSep = String.fromCharCode(30);
		var fieldSep = "^|";
		var rowSep = "#EOR#";
		var nullField = "#";
		
		if(table_number == 1) this.data = "";

		var sql = "SELECT * " +
			"FROM " + table_name + " " + 
			"WHERE dirty = 1";
			
		if(table_name == "inspections")
		{
			//sql += " AND finalised = 1";
		}

		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, [], function (transaction, result) 
			{            
				// Does this table have dirty data
				if(result.rows.length > 0)
				{
					// yes it does. 
					var columns = new Array();
					var headerLine = "";
					var currentLine = "";
					var rowData = "";
					
					// Loop through the results
					var maxLoop = result.rows.length; 
					
					for(x = 0; x < maxLoop; x++)
					{
						// Get the current row
						var row = result.rows.item(x); 
						
						var fieldNo = 0; 	// Holds the current field index.
						
						// Loop through all the fields in the row.
						for (var field in row) 
						{
							// If this is the first row, build the header line containing the field names.
							if(x == 0)
							{
								if(headerLine != "")
									headerLine += fieldSep;
								
								headerLine += field;
							}
							
							// Append the field seperator
							if(fieldNo > 0)
								rowData += fieldSep;
							
							// Append the field value - write the character "|" to represent a null value;
							var val = row[field];
							
							if(val == null)
								rowData += nullField;
							else
								rowData += val;
								
							fieldNo++;	
						}
						
						// Append the row separator
						rowData += rowSep;
					}
					
					self.data += table_name + rowSep + headerLine + rowSep + rowData + tableSep;						
				} 
				
				// Define the next table number
				var next_table = table_number + 1;

				if(next_table < self.tables.length)
					self.getDirtyData(table_number + 1);
				else
					self.callbackMethod();		

				// self.checkNextTable(table_number);                          
			                 
			}, self.DB_error_handler);          
		});		
	}
	
	/***
	* @desc loadRecords loads a recordset from a nominated database table
	* and then invokes the callback method (properly).  The filters param must be an array.
	*/
	this.loadRecords = function (table_name, filters, callbackmethod_name, param)
	{ 
		if(table_name == "")
		{
			return false;
		}   
		
		var limit = 0; 

		var sql = "SELECT * " +
				"FROM " + table_name + " " +
				"WHERE deleted = 0 ";
				
		if(filters.length > 0)
		{
			var i = 0;
			while(i < filters.length)
			{
				var filter = filters[i];
				
				if(filter.length == 1)
				{
					// This is a straight SQL filter
					sql += "AND ";
					sql += filter[0] + " ";
				}
				else
				{
					if(filter.length == 2)
					{
						if(filter[0].toLowerCase() == "limit")
						{
							limit = filter[1];
						}
					}
				}				
				
				i++;
			}
		}

		// Apply recordset ordering if it's been defined
		if(this.orderBy != "")
		{
			sql += " ORDER BY " + this.orderBy;
		}
		
		if(limit > 0)
		{
			sql += " LIMIT " + limit;
		}	

		// Run the query
		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, null, function (transaction, result) 
			{            
				// This record could not be found
				if(result.rows.length == 0)
				{
					callbackmethod_name(param, false);              
				} 
				else
				{
					callbackmethod_name(param, result);                           
				}                   
			}, self.DB_error_handler);          
		});            
	}	  

	/***
	* @desc loadRecordsSQL loads a recordset using a passed sql query
	* Once the sql has been executed, the records are passed back to the callback method
	*/
	this.loadRecordsSQL = function (sql, values, callbackmethod_name, param)
	{ 
		// Run the query
		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, values, function (transaction, result) 
			{            
				// This record could not be found
				if(result.rows.length == 0)
				{
					callbackmethod_name(param, false);              
				} 
				else
				{
					callbackmethod_name(param, result);
				}                   
			}, self.DB_error_handler);          
		});            
	}		
	
	/***
	* @desc loadRecord loads a specific record from a nominated database table
	* and then invokes the callback method (properly).
	*/
	this.loadRecord = function(table_name, record_id, callbackmethod_name, param)
	{ 
		if((record_id == "") || (record_id == null))
		{
			return false;
		}

		if(table_name == "")
		{
			alert("DBUtils::loadRecord - No table name passed");
			return false;
		}   

		var sql = "SELECT * " +
				"FROM " + table_name + " " +
				"WHERE id = ?";

		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, [record_id], function (transaction, result) 
			{            
				// This record could not be found
				if(result.rows.length == 0)
				{
                    callbackmethod_name(param, false);
				}
				else
				{
					var row = result.rows.item(0);
					callbackmethod_name(param, row);                           
				}                   
			}, self.DB_error_handler);          
		});            
	}	
	
	/***
	* @desc loadRecordSQL executes the specified query and returns the resulting row
	* this time with support for proper enclosures.
	*/
	this.loadRecordSQL = function(sql, values_array, callbackmethod)
	{ 
		if((sql == "") || (sql == null))
		{
			alert("DBUtils::loadRecordSQL - No sql query passed");
			return false;
		}

		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, values_array, function (transaction, result) 
			{            
				// This record could not be found
				if(result.rows.length == 0)
				{
					callbackmethod(false);
				}
				else
				{
					var row = result.rows.item(0);
					callbackmethod(row);                           
				}                   
			}, self.DB_error_handler);          
		});            
	}

    /***
     * @desc loadRecordSQL executes the specified query and returns the resulting row
     * this time with support for proper enclosures.
     */
    this.loadRecordSQL2 = function(sql, values_array, callbackmethod, param)
    {
        if((sql == "") || (sql == null))
        {
            alert("DBUtils::loadRecordSQL - No sql query passed");
            return false;
        }

        this.db.transaction(function(transaction)
        {
            transaction.executeSql(sql, values_array, function (transaction, result)
            {
                // This record could not be found
                if(result.rows.length == 0)
                {
                    callbackmethod(false, param);
                }
                else
                {
                    var row = result.rows.item(0);
                    callbackmethod(row, param);
                }
            }, self.DB_error_handler);
        });
    }
	
	/***
	* @desc deleteRecord deletes a specific record from a nominated database table
	* and then invokes the callback method.
	*/
	this.deleteRecord = function(table_name, record_id, callbackmethod_name)
	{ 
		if((record_id == "") || (record_id == null))
		{
			alert("DBUtils::deleteRecord - No record id passed");
			return false;
		}

		if(table_name == "")
		{
			alert("DBUtils::deleteRecord - No table name passed");
			return false;
		}   
		

		var sql = "UPDATE " + table_name + " " +
				"SET deleted = 1, dirty = 1 " +
				"WHERE id = ?";

		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, [record_id], function (transaction, result) 
			{            
				// TODO - add code to record which records have been deleted for synronisation purposes.
				callbackmethod_name();
			}, self.DB_error_handler);          
		});            
	}
	
	this.execute = function(sql, valueArray, callbackMethod)
	{
		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, valueArray, function (transaction, result) 
			{            
				// Execute the callback method if there is one.
				if(callbackMethod != null)
				{
					callbackMethod();	
				}
								                              
			}, self.DB_error_handler);          
		});		
	}
    
    this.executeWithCBParam = function(sql, valueArray, callbackMethod, callbackParam)
    {
        this.db.transaction(function(transaction) 
        { 
            transaction.executeSql(sql, valueArray, function (transaction, result) 
            {            
                // Execute the callback method if there is one.
                if(callbackMethod != null)
                {
                    callbackMethod(callbackParam);    
                }
                                                              
            }, self.DB_error_handler);          
        });        
    }    		
	
	/***
	* @desc loadSelect loads a recordset from a nominated database table
	* and then fills the nominated HTML select/droplist with the options.
	*/
	this.loadSelect = function(table_name, filters, selector, callback_method, html_tag)
	{ 
		if((table_name == "") || (selector == ""))
		{
			alert("TDDB_load_records::No table name or selector passed");
			return false;
		}  
		
		this.loadRecords(table_name, filters, function(param, result)
		{
			if(result)
			{
				var rs = [];
				// Loop through the results and populate the select list
				var maxLoop = result.rows.length; 
				
				for(x = 0; x < maxLoop; x++)
				{
					var row = result.rows.item(x);
					if (rs.indexOf(row[self.showColumn]) != -1)
						continue;
                    if(html_tag == null)
                    {
						$(param).
						  append($("<li></li>").
						  attr("title", row[self.primaryKey]).
						  text(row[self.showColumn]));
                    }
					else if(html_tag == 'td')
					{
						$(param).
							append($("<tr></tr>").
							append($("<td></td>").
							text(row[self.showColumn])));
					}
                    else
                    {
						$(param).
						  append($("<" + html_tag + "></" + html_tag + ">").
						  attr("value", row[self.primaryKey]).
						  text(row[self.showColumn]));
                    }
					rs.push(row[self.showColumn]);
				}
			}
			callback_method();
		}, selector); 
	}  	
		
	
	this.makeInsertKey = function(prefix)
	{
		var dte = new Date();
		var key = prefix + dte.getTime();
		
		this.lastID = key;
		
		return key;
	}
	
	/***
	* Autosave automatically INSERTS or UPDATES a table based on the specified tableName, primaryKey
	* and form paseed to it.  All the input fields on the form will be iterated through to automagically
	* build the update/insert queries.
	*/
	this.autoSave = function(tableName, primaryKey, formSelector, callback_function)
	{
		var sql = "";
		var fields = new Array();
		var values = new Array();
		
		// Loop through all text fields, passwords, selects and save the form values
		var selectStr = "#main #" + formSelector + " input[type='text']," 
			+ "#main #" + formSelector + " input[type='password'],"  
			+ "#main #" + formSelector + " input[type='number'],"
			+ "#main #" + formSelector + " input[type='email'],"
			+ "#main #" + formSelector + " select, "  
			+ "#main #" + formSelector + " textarea, "
			+ "#main #" + formSelector + " input[type='hidden']";

		$(selectStr).each(function()
		{            
			// Make sure this field shouldn't be ignored
			if(!$(this).hasClass("ignore"))
			{
			    var field_name = $(this).attr("id");	
				var field_val = $(this).val();               
        
                fields.push(field_name); 
                values.push(field_val); 
			} 
		}); 
        


		
		// Checkboxes
		$("#main #" + formSelector + " input[type='checkbox']").each(function()
		{
			if(!$(this).hasClass("ignore"))
			{			
				var field_name = $(this).attr("id");	
				var field_val = 0;
				
				if($(this).is(":checked"))
					field_val = 1;
					
				fields.push(field_name); 
				values.push(field_val);	
			}		
		}); 
		
		// PopSelectors
		$("#main #" + formSelector + " ul.selector").each(function()
		{
			if(!$(this).hasClass("ignore"))
			{			
				var field_name = $(this).attr("id");	
				var field_val = "";
				
				if($(this).find("li:eq(0)").attr("title") != "")
					field_val = $(this).find("li:eq(0)").attr("title");
					
				fields.push(field_name); 
				values.push(field_val);		
			}	
		});		
		 
		
		// INSERT
		if(primaryKey == "")
		{
			var header = "INSERT INTO " + tableName + "(";
			var footer = "";
			
			// Hacks
			if(tableName == "preferences")
			{
				// If we're INSERTING into the preferences table then we
				// need to save the sync prefix as the primary key.
				fields.push("sync_prefix"); 
				values.push(objApp.sync_prefix); 			
			}
			else
			{
				primaryKey = this.makeInsertKey(objApp.sync_prefix);
				fields.push("id");	
				values.push(primaryKey);
			} 			
			
			var field_no = 0;
			
			for(var f in fields)
			{
				if(field_no++ > 0)
				{
					header += ", ";	
					footer += ", ";	
				}
				
				header += fields[f];
				footer += "?";
			}
			
			sql = header + ") VALUES(" + footer + ");";
		}
		else
		{
			// We're doing an update instead.  
			// Build the update SQL.
			sql = "UPDATE " + tableName + " SET ";
			
			var field_no = 0;
			
			for(var f in fields)
			{
				if(field_no++ > 0)
					sql += ", ";	
				
				sql += fields[f] + " = ?";
			}
			
			// Flag any updated record as dirty
			sql += ", dirty = 1";
			
			// If we're updating the preferences table
			// then sync_prefix is the primary key.
			// Otherwise update by id
			if(tableName == "preferences")
			{
				sql += " WHERE sync_prefix = ?";
				values.push(objApp.sync_prefix);
			}
			else
			{
				sql += " WHERE id = ?";
				values.push(primaryKey);			
			}
		}
        
		// Execute the query
	    this.db.transaction(function(transaction) 
	    {
            //console.log(sql);
            //console.log(values);
	        transaction.executeSql(sql, values, function (transaction, result)
	        {
				// The query executed successfully.  Call the callback function
				callback_function(primaryKey);

	        }, 	self.DB_error_handler);
	    });		
	}
    
	/***
	* @desc DB_error_handler is used to trap all sorts of database errors and report the error to the user.
	*/
	this.DB_error_handler = function(transaction, error)
	{
	   alert("Sorry, the following database error occured\n\n" +
	      "Code: " + error.code + "\n" +
	      "Message: " + error.message);
	}
	
	/*********************** EMPTY TABLE METHODS ************************/
	/************************************** **********************/
	this.emptyAllTables = function(table_number, callback_method)
	{
		var table_name = this.tables[table_number][0];

		sql = "DELETE FROM " + table_name;

		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function(transaction, result)
			{
				self.emptyNextTable(table_number, callback_method); 
				  
			}, self.DB_error_handler);
		});  
	}	
	
	this.emptyNextTable = function(table_number, callback_method)
	{
		var next_table = table_number + 1;

		if(next_table < self.tables.length)
			self.emptyAllTables(table_number + 1, callback_method);  
		else
		{
			if(callback_method != null)
				callback_method();
		}
	}

	this.emptyTable  = function(table_name, callback_method)
    {
        sql = "DELETE FROM " + table_name;
        this.db.transaction(function(transaction)
        {
            transaction.executeSql(sql, null, function(transaction, result)
            {
                if(callback_method != null)
                    callback_method();

            }, self.DB_error_handler);
        });
    }
	
	/*********************** DROP METHODS ************************/
	/************************************** **********************/
	this.dropAllTables = function(table_number)
	{
	   var table_name = this.tables[table_number][0];
	   
	   sql = "DROP TABLE " + table_name;
	   
	   this.db.transaction(
	      function(transaction) {
	         transaction.executeSql(sql, null, function(transaction, result) {
	            self.dropNextTable(table_number);   
	         }, function(transaction, error) {
	            self.dropNextTable(table_number);
	         });
	      }
	   );  
	}	
	
	this.dropNextTable = function(table_number)
	{
	   var next_table = table_number + 1;
	   
	   if(next_table < this.tables.length)
	      self.dropAllTables(table_number + 1);  
	}
    
    
    /*********************** DELETE METHODS ************************/
    /************************************** **********************/
    this.deleteAllTables = function(table_number, callback_method)
    {
       var table_name = this.tables[table_number][0];
       
       sql = "DELETE FROM " + table_name;
       
       this.db.transaction(
          function(transaction) {
             transaction.executeSql(sql, null, function(transaction, result) {
                self.deleteNextTable(table_number, callback_method);   
             }, function(transaction, error) {
                alert("ERROR ON DELETING FROM TABLE " + table_name);
                return;
             });
          }
       );  
    }    
    
    this.deleteNextTable = function(table_number, callback_method)
    {
        var next_table = table_number + 1;

        if(next_table < this.tables.length)
        {
            self.deleteAllTables(table_number + 1, callback_method);  
        }
        else
        {
            if(callback_method != null)
            {
                callback_method();    
            }
        }
    }    
	
	/***
	* @desc TDDB_check_tables looks to see if the specified table exists in the database.
	* The table is defined as a table_number which maps to an index in the tables array.
	* If the table doesn't exist, we invoke the method "TDDB_create_" + table_name;
	* If the tables does exist, we check the next table as defined by the next index until there are 
	* no more tables to check.
	*/
	this.checkTables = function(table_number)
	{ 
		var table_name = this.tables[table_number][0]; 
		var table_version = this.tables[table_number][1]; 

		var sql = "SELECT * " +
			"FROM app_tables " +
			"WHERE table_name = ?";

		this.db.transaction(function(transaction) 
		{ 
			transaction.executeSql(sql, [table_name], function (transaction, result) 
			{            
				// This table does not exist and needs to be created.
				if(result.rows.length == 0)
				{
					var method_name = "create" + table_name.substr(0, 1).toUpperCase() + table_name.substr(1);
					var invoke = "self." + method_name + "(table_number)";
					eval(invoke);
					//this[method_name + "(table_number)"];            
				} 
				else
				{
					// Is the version correct?
					if(result.rows.item(0).version != table_version)
					{
						// The version number is not correct.
						// Invoke the database upgrader to apply
						// the appropriate upgrades
						objUpgrader = new dbUpgrader();
                        
                        var old_version = result.rows.item(0).version * 1;
                        var new_version = table_version * 1;
                        
						objUpgrader[table_name](old_version, new_version);
					}
					
					self.checkNextTable(table_number);                          
				}                   
			}, self.DB_error_handler);          
		});            
	}
	
	/***
	* Determines whether there are more tables to check and if so, invokes the check_tables method again.
	* If not, objApp.init is called.
	*/
	this.checkNextTable = function(table_number)
	{
		// Define the next table number
		var next_table = table_number + 1;

		if(next_table < this.tables.length)
		{
			this.checkTables(table_number + 1);
		}
		else
		{
			setTimeout('objApp.init();', 500);   
		}
	}
	
	this.getFieldValue = function(id, table_name, field_name, callbackMethod)
	{
		var sql = "SELECT " + field_name + " " +
				"FROM " + table_name + " " +
				"WHERE id = ?";
				
		self.loadRecordSQL2(sql, [id], function(result)
		{
			if(!result)
			{
             	callbackMethod(false);
			}
			else
			{
				callbackMethod(result[field_name]);	
			}
		});
	}
	
	/***
	* setKeyFromLastInsertID
	* Grabs the id of the last record that was inserted and stores
	* that key in the global keys storage.
	*/
	this.setKeyFromLastInsertID = function(keyName)
	{
 		objApp.keys[keyName] = this.lastID; 
	}
	
	this.escapeStr = function(s)
	{
		var result = s.replace(/'/g, "\'\'");
		
		return result;
	}	
    
    /**
    * SQLite requires any apostraphies to be doubled (this is the equivalent of MySQL/PHP addSlashes)
    */
    this.doubleApos = function(s) {
        if(s == "") {
            return "";
        }
        
        s = s.replace(/'/g, "''");
        
        return s;
    } 
    
    this.countTableRows = function(table_name, where, values, callback_method) {
        var sql = "SELECT COUNT(*) as num_items " +
            "FROM " + table_name + " ";
            
        if(!objApp.empty(where)) {
            sql += " WHERE " + where;
        }

        this.loadRecordSQL(sql, values, function(row) {
            callback_method(row);    
        });
    }    
	
	/*********************** CREATE METHODS ************************/
	/************************************** ************************/
	this.createTablesTable = function()
	{
		var sql = "CREATE TABLE IF NOT EXISTS app_tables (" +
			"table_name TEXT NOT NULL PRIMARY KEY, " +
			"version INTEGER NOT NULL);";
			
		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result) {self.checkTables(1)}, self.DB_error_handler);
		});
	}

    /**********************************************
     * ADDRESS_BOOK
     */
    this.createAddress_book = function(table_number)
    {
        if(this.DB_DEBUG)
            alert("CREATE ADDRESS BOOK");

        var table_name = this.tables[table_number][0];
        var table_version = this.tables[table_number][1];


        var sql = "CREATE TABLE IF NOT EXISTS address_book (" +
            "'id' VARCHAR PRIMARY KEY NOT NULL, " +
            "'email' VARCHAR NOT NULL, " +
            "'created_by' INTEGER NULL DEFAULT NULL, " +
            "'deleted' INTEGER NOT NULL DEFAULT 0 , " +
            "'dirty' INTEGER NOT NULL DEFAULT 1)";

        this.db.transaction(function(transaction)
        {
            transaction.executeSql(sql, null, function (transaction, result)
            {
                // Create indexes

                // Deleted index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
                self.execute(sql, null, null);

                // Dirty index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
                self.execute(sql, null, null);

                // Createdby index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_createdby ON " + table_name + " (created_by, deleted);";
                self.execute(sql, null, null);

                // INSERT THE REGISTRY ENTRY
                sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
                transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
                {
                    if(this.DB_DEBUG)
                        alert("INSERTED REGISTRY");

                    self.checkNextTable(table_number);

                }, self.DB_error_handler);
            }, self.DB_error_handler);
        });
    }

	/**********************************************
	* BUILDERS
	*/
	this.createBuilders = function(table_number)
	{
		if(this.DB_DEBUG)
			alert("CREATE BUILDERS");

		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1]; 
   
		var sql = "CREATE TABLE IF NOT EXISTS builders  (" +
				"'id' VARCHAR PRIMARY KEY NOT NULL, " +
				"'name' VARCHAR, " +
				"'contact' VARCHAR, " +
				"'phone' VARCHAR, " +                    
				"'email' VARCHAR, " +             
				"'address' VARCHAR, " +
				"'city' VARCHAR, " +
				"'state' VARCHAR, " +
				"'postcode' VARCHAR, " +							
				"'created_by' INTEGER NOT NULL, " +
				"'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
				"'priority' INTEGER NOT NULL DEFAULT 0, " +
				"'dirty' INTEGER NOT NULL DEFAULT 1)"; 
	            
		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
				// Create indexes
				
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);
				
				// Status index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_priority ON " + table_name + " (priority, deleted);";
				self.execute(sql, null, null);	
				
				// Createdby index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_createdby ON " + table_name + " (created_by, deleted);";
				self.execute(sql, null, null);											
				
				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)  
						alert("INSERTED REGISTRY");

					self.checkNextTable(table_number);                
					
				}, self.DB_error_handler);
			}, self.DB_error_handler);
		});    
	}

    /**********************************************
     * Builders Supervisors
     */
    this.createBuilders_supervisors = function(table_number)
    {
        if(this.DB_DEBUG)
            alert("CREATE BUILDERS SUPERVISORS");

        var table_name = this.tables[table_number][0];
        var table_version = this.tables[table_number][1];

        var sql = "CREATE TABLE IF NOT EXISTS builders_supervisors  (" +
            "'id' VARCHAR PRIMARY KEY NOT NULL, " +
            "'builder_id' VARCHAR NOT NULL, " +
            "'supervisor_id' VARCHAR NOT NULL, " +
            "'is_primary' INTEGER NOT NULL DEFAULT 0 , " +
            "'dirty' INTEGER NOT NULL DEFAULT 1)";

        this.db.transaction(function(transaction)
        {
            transaction.executeSql(sql, null, function (transaction, result)
            {
                // Create indexes

                // builder_id index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_builder_id ON " + table_name + " (builder_id);";
                self.execute(sql, null, null);

                // Dirty index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
                self.execute(sql, null, null);

                // supervisor_id index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_supervisor_id ON " + table_name + " (supervisor_id);";
                self.execute(sql, null, null);

                // INSERT THE REGISTRY ENTRY
                sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
                transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
                {
                    if(this.DB_DEBUG)
                        alert("INSERTED REGISTRY");

                    self.checkNextTable(table_number);

                }, self.DB_error_handler);
            }, self.DB_error_handler);
        });
    }
	
	/**********************************************
	* SITES
	*/	
	this.createSites = function(table_number)
	{
	   if(this.DB_DEBUG)
	      alert("CREATE SITES");
	   
	   var table_name = this.tables[table_number][0];
	   var table_version = this.tables[table_number][1];    
	   
	   var sql = "CREATE TABLE IF NOT EXISTS sites  (" +
	            "'id' VARCHAR PRIMARY KEY NOT NULL, " +
	            "'client_id' VARCHAR NOT NULL, " +
	            "'contact' VARCHAR, " +
	            "'phone' VARCHAR, " +
	            "'fax' VARCHAR, " +                              
	            "'email' VARCHAR, " +             
	            "'mobile' VARCHAR, " +
	            "'map' VARCHAR, " +
	            "'address1' VARCHAR, " +
	            "'address2' VARCHAR, " +
	            "'city' VARCHAR, " +
	            "'state' VARCHAR, " +
	            "'postcode' VARCHAR, " +
	            "'country' VARCHAR, " +
				"'external_contact' VARCHAR, " +
				"'external_email' VARCHAR, " +		            
	            "'notes' VARCHAR, " +
                "'contact_id1' VARCHAR, " +
                "'contact_id2' VARCHAR, " +
				"'lastinspectiondate' VARCHAR, " +
				"'num_inspections' INTEGER NOT NULL DEFAULT 0, " +	            
	            "'created_by' INTEGER NOT NULL, " +
	            "'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
	            "'dirty' INTEGER NOT NULL DEFAULT 1)";
	            
	    this.db.transaction(function(transaction) 
	   	{
	        transaction.executeSql(sql, null, function (transaction, result)
	        {	
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);		
				
				// Createdby index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_createdby ON " + table_name + " (created_by, deleted);";
				self.execute(sql, null, null);					            	
	           
	           // INSERT THE REGISTRY ENTRY
	           sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
	           transaction.executeSql(sql, [table_name, table_version], function (transaction, result){
	              
	              if(this.DB_DEBUG)  
	                 alert("INSERTED REGISTRY");
	              
	              self.checkNextTable(table_number);                
	              
	           }, self.DB_error_handler);

	        }, self.DB_error_handler);
	        }
	    );    
	}
	
	/**********************************************
	* RESOURCES
	*/	
	this.createResources = function(table_number)
	{
	   if(this.DB_DEBUG)
	      alert("CREATE RESOURCES");
	   
	   var table_name = this.tables[table_number][0];
	   var table_version = this.tables[table_number][1];    
	   
	   var sql = "CREATE TABLE IF NOT EXISTS resources  (" +
	            "'id' VARCHAR PRIMARY KEY NOT NULL, " +
	            "'resource_type' INTEGER NOT NULL, " +
	            "'parent_id' VARCHAR, " +
	            "'name' VARCHAR, " +
	            "'custom1str' VARCHAR, " +
	            "'custom2str' VARCHAR, " +                              
	            "'custom3str' VARCHAR, " +             
	            "'custom4str' VARCHAR, " +
	            "'custom1num' INTEGER, " +
	            "'custom2num' INTEGER, " +  
	            "'created_by' INTEGER NOT NULL, " +    
	            "'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
	            "'dirty' INTEGER NOT NULL DEFAULT 1)";
	            
	    this.db.transaction(
	        function(transaction) {
	            transaction.executeSql(sql, null, function (transaction, result){
	            	
					// Deleted index
					sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
					self.execute(sql, null, null);
					
					// Dirty index 
					sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
					self.execute(sql, null, null);	
					
					// Resource type index
					sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_resource_type ON " + table_name + " (resource_type, deleted);";
					self.execute(sql, null, null);
					
					// Resource type index
					sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_resources_parent ON " + table_name + " (resource_type, parent_id, deleted);";
					self.execute(sql, null, null);
					
					// Createdby index 
					sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_createdby ON " + table_name + " (created_by, deleted);";
					self.execute(sql, null, null);																	            	
	               
	               // INSERT THE REGISTRY ENTRY
	               sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
	               transaction.executeSql(sql, [table_name, table_version], function (transaction, result){
	                  
	                  if(this.DB_DEBUG)  
	                     alert("INSERTED REGISTRY");
	                  
	                  self.checkNextTable(table_number);                
	                  
	               }, self.DB_error_handler);

	            }, self.DB_error_handler);
	        }
	    );    
	}
	
	/**********************************************
	* INSPECTIONS
	*/	
	this.createInspections = function(table_number)
	{
		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1];    
		
		if(this.DB_DEBUG)
			alert("CREATE " + table_name);
		
		var sql = "CREATE TABLE IF NOT EXISTS inspections  (" +
				"'id' VARCHAR PRIMARY KEY NOT NULL, " +
				"'report_type' VARCHAR NOT NULL, " +
				"'builder_id' VARCHAR NOT NULL, " +
                "'supervisor_id' VARCHAR NULL, " +
				"'weather' VARCHAR, " +	
				"'lot_no' VARCHAR, " +	
				"'address' VARCHAR, " +	
				"'suburb' VARCHAR, " +	
				"'postcode' VARCHAR, " +	
				"'state' VARCHAR, " +	
				"'brickwork' INTEGER, " +	
				"'paint_quality' INTEGER, " +	
				"'plaster_quality' INTEGER, " +	
				"'interior_quality' INTEGER, " +	
				"'exterior_quality' INTEGER, " +	
				"'inspection_date' DATE NOT NULL, " + 			
				"'inspection_start' BIGINT(20) NOT NULL DEFAULT 0, " +
				"'status' INTEGER NOT NULL DEFAULT 0 , " + 
				"'num_defects' INTEGER NOT NULL DEFAULT 0, " +
				"'finalised' INTEGER NOT NULL DEFAULT 0, " +
				"'failed' INTEGER NOT NULL DEFAULT 1, " +
				"'client_info' VARCHAR, " +
				"'notes' TEXT, " +
				"'initials' VARCHAR NOT NULL, " +
                "'min_roof_tiles' SMALLINT(6) DEFAULT 0, " +
                "'min_ridge_tiles' SMALLINT(6) DEFAULT 0, " +
                "'touch_up_paint' SMALLINT(6) DEFAULT 0, " +
                "'min_flooring_tiles' SMALLINT(6) DEFAULT 0, " +
                "'practical_completed' SMALLINT(6) DEFAULT 0, " +
                "'grout_samples' SMALLINT(6) DEFAULT 0, " +
                "'barrel_code' TEXT DEFAULT NULL, " +
                "'signature_1' TEXT DEFAULT NULL, " +
                "'signature_2' TEXT DEFAULT NULL, " +
				"'certificated' SMALLINT(6) DEFAULT 0, " +
                "'created_by' INTEGER NOT NULL, " +
				"'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
				"'dirty' INTEGER NOT NULL DEFAULT 1)";

		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);
				
				// Builder index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_builder ON " + table_name + " (builder_id, deleted);";
				self.execute(sql, null, null);	
				
				
				// Createdby index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_createdby ON " + table_name + " (created_by, deleted);";
				self.execute(sql, null, null);	
				
				// Finalised index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_finalised ON " + table_name + " (finalised, deleted);";
				self.execute(sql, null, null);																											
				
				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)  
						alert("INSERTED REGISTRY");
			  
		  			objDBUtils.checkNextTable(table_number);                
			  
		  		}, objDBUtils.DB_error_handler);

			}, objDBUtils.DB_error_handler);
		});    
	}
    
	/**********************************************
	* INSPECTIONS
	*/	
	this.createReinspections = function(table_number)
	{
		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1];    
		
		if(this.DB_DEBUG)
			alert("CREATE " + table_name);
            
        var sql = "CREATE TABLE IF NOT EXISTS reinspections  (" +
                "'id' VARCHAR PRIMARY KEY NOT NULL, " +    
                "'inspection_id' VARCHAR NOT NULL, " +
                "'reinspection_date' DATE NOT NULL, " +
                "'failed' INTEGER NOT NULL DEFAULT 0, " +
                "'most_recent' INTEGER NOT NULL DEFAULT 0, " +
                "'weather' VARCHAR NULL ," +
                "'notes' TEXT  NULL, " +
                "'min_roof_tiles' SMALLINT(6) DEFAULT 0, " +
                "'min_ridge_tiles' SMALLINT(6) DEFAULT 0, " +
                "'touch_up_paint' SMALLINT(6) DEFAULT 0, " +
                "'min_flooring_tiles' SMALLINT(6) DEFAULT 0, " +
                "'practical_completed' SMALLINT(6) DEFAULT 0, " +
                "'grout_samples' SMALLINT(6) DEFAULT 0, " +
                "'barrel_code' TEXT DEFAULT NULL, " +
                "'certificated' SMALLINT(6) DEFAULT 0, " +
                "'created_by' INTEGER NOT NULL DEFAULT 48, " + 
                "'deleted' INTEGER NOT NULL DEFAULT 0, " + 
                "'dirty' INTEGER NOT NULL DEFAULT 1)";

		this.db.transaction(function(transaction)
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);

				// Dirty index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);

                // Inspection id index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_inspectionid ON " + table_name + " (inspection_id, deleted);";
                self.execute(sql, null, null);

                // Most Recent index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_mostrecent ON " + table_name + " (inspection_id, deleted, most_recent);";
                self.execute(sql, null, null);

				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)
						alert("INSERTED REGISTRY");

		  			objDBUtils.checkNextTable(table_number);

		  		}, objDBUtils.DB_error_handler);

			}, objDBUtils.DB_error_handler);
		});
    }
    
	/**********************************************
	* INSPECTION ITEMS
	*/	
	this.createInspectionitems = function(table_number)
	{
		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1];    
		
		if(this.DB_DEBUG)
			alert("CREATE " + table_name);
		
		var sql = "CREATE TABLE IF NOT EXISTS inspectionitems  (" +
				"'id' VARCHAR PRIMARY KEY NOT NULL, " +
				"'inspection_id' VARCHAR NOT NULL, " +
				"'seq_no' INTEGER NOT NULL, " +
				"'location' VARCHAR NOT NULL, " +
				"'action' VARCHAR NOT NULL, " +
				"'observation' VARCHAR NOT NULL, " +
                "'rectified' VARCHAR NOT NULL DEFAULT 'Not Rectified', " +
				"'hash' VARCHAR NOT NULL, " +
				"'notes' VARCHAR, " +	
                "'itemtype' INTEGER NOT NULL DEFAULT 0, " +
                "'numrepeats' INTEGER NOT NULL DEFAULT 0, " +
				"'created_by' INTEGER NOT NULL, " +
				"'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
				"'dirty' INTEGER NOT NULL DEFAULT 1)";

		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);
				
				// Client index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_inspection ON " + table_name + " (inspection_id, deleted);";
				self.execute(sql, null, null);
				
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_hash ON " + table_name + " (hash, deleted);";
				self.execute(sql, null, null);																									
				
				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)  
						alert("INSERTED REGISTRY");
			  
		  			objDBUtils.checkNextTable(table_number);                
			  
		  		}, objDBUtils.DB_error_handler);

			}, objDBUtils.DB_error_handler);
		});    
	}
    
	/**********************************************
	* REINSPECTION ITEMS
	*/	
	this.createReinspectionitems = function(table_number)
	{
		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1];    
		
		if(this.DB_DEBUG)
			alert("CREATE " + table_name);
		
		var sql = "CREATE TABLE IF NOT EXISTS reinspectionitems  (" +
				"'id' VARCHAR PRIMARY KEY NOT NULL, " +
				"'reinspection_id' VARCHAR NOT NULL, " +
				"'inspectionitem_id' VARCHAR NOT NULL, " +
                "'rectified' VARCHAR NOT NULL DEFAULT 'Not Rectified', " +
                "'company_id' INTEGER NULL DEFAULT 0, " +
                "'created_by' INTEGER NOT NULL DEFAULT 0, " +
                "'deleted' INTEGER NOT NULL DEFAULT 0, " + 
                "'dirty' INTEGER NOT NULL DEFAULT 1) ";

		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
                // Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);
				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)  
						alert("INSERTED REGISTRY");
			  
		  			objDBUtils.checkNextTable(table_number);                
			  
		  		}, objDBUtils.DB_error_handler);

			}, objDBUtils.DB_error_handler);
		});    
	}
	
	/**********************************************
	* INSPECTION ITEM PHOTOS
	*/	
	this.createInspectionitemphotos = function(table_number)
	{
		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1];    
		
		if(this.DB_DEBUG)
			alert("CREATE " + table_name);
		
		var sql = "CREATE TABLE IF NOT EXISTS inspectionitemphotos  (" +
				"'id' VARCHAR PRIMARY KEY NOT NULL, " +
                "'company_id' VARCHAR KEY NULL DEFAULT 0 , " +
				"'inspection_id' VARCHAR NOT NULL, " +
				"'seq_no' INTEGER NOT NULL, " +
				"'photodata_tmb' VARCHAR, " +
				"'photodata' VARCHAR, " +	
				"'notes' VARCHAR, " +	
                "'is_cover_photo' INTEGER NOT NULL DEFAULT 0 , " + 
                "'is_report_photo' INTEGER NOT NULL DEFAULT 0 , " +
                "'created_by' INTEGER NOT NULL, " +
				//"'modified' TIMESTAMP NOT NULL, " +				
                "'modified' TIMESTAMP, " +                
				"'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
				"'dirty' INTEGER NOT NULL DEFAULT 0)";

		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);
				
				// Client index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_inspection ON " + table_name + " (inspection_id, deleted);";
				self.execute(sql, null, null);																					
				
				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)  
						alert("INSERTED REGISTRY");
			  
		  			objDBUtils.checkNextTable(table_number);                
			  
		  		}, objDBUtils.DB_error_handler);

			}, objDBUtils.DB_error_handler);
		});    
	}
    
	
	/**********************************************
	* REINSPECTION ITEM PHOTOS
	*/	
	this.createReinspectionitemphotos = function(table_number)
	{
		var table_name = this.tables[table_number][0];
		var table_version = this.tables[table_number][1];    
		
		if(this.DB_DEBUG)
			alert("CREATE " + table_name);
		
		var sql = "CREATE TABLE IF NOT EXISTS reinspectionitemphotos  (" +
				"'id' VARCHAR PRIMARY KEY NOT NULL, " +
			    "'company_id' VARCHAR KEY NULL DEFAULT 0 , " +
				"'reinspection_id' VARCHAR NOT NULL, " +
				"'seq_no' INTEGER NOT NULL, " +
				"'photodata_tmb' VARCHAR, " +
				"'photodata' VARCHAR, " +	
				"'notes' VARCHAR, " +	
				"'created_by' INTEGER NOT NULL, " +				
                "'modified' TIMESTAMP, " +                
				"'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
				"'dirty' INTEGER NOT NULL DEFAULT 0)";

		this.db.transaction(function(transaction) 
		{
			transaction.executeSql(sql, null, function (transaction, result)
			{
				// Deleted index
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
				self.execute(sql, null, null);
				
				// Dirty index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
				self.execute(sql, null, null);
				
				// Client index 
				sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_reinspection ON " + table_name + " (reinspection_id, deleted);";
				self.execute(sql, null, null);																					
				
				// INSERT THE REGISTRY ENTRY
				sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
				transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
				{
					if(this.DB_DEBUG)  
						alert("INSERTED REGISTRY");
			  
		  			objDBUtils.checkNextTable(table_number);                
			  
		  		}, objDBUtils.DB_error_handler);

			}, objDBUtils.DB_error_handler);
		});    
	}
	
	
    /**********************************************
    * USERS
    */    
    this.createUsers = function(table_number)
    {
        var table_name = this.tables[table_number][0];
        var table_version = this.tables[table_number][1];    
        
        if(this.DB_DEBUG)
            alert("CREATE " + table_name);
            
        var sql = "CREATE TABLE IF NOT EXISTS users (" +
            "'id' INTEGER PRIMARY KEY NOT NULL, " +
            "'email' VARCHAR NOT NULL, " +
            "'first_name' VARCHAR NOT NULL, " +
            "'last_name' VARCHAR NOT NULL, " +
            "'initials' VARCHAR, " +
            "'phone' VARCHAR, " +
            "'fax' VARCHAR, " +
            "'mobile' VARCHAR, " +
            "'address1' VARCHAR, " +
            "'address2' VARCHAR, " +
            "'city' VARCHAR, " +
            "'state_id' INTEGER, " +
            "'postcode' VARCHAR, " +
            "'country_id' INTEGER, " +
            "'notes' TEXT, " +
            "'restricted' INTEGER NOT NULL DEFAULT 0, " +
            "'user_type' VARCHAR NOT NULL DEFAULT 'general', " +
            "'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
            "'dirty' INTEGER NOT NULL DEFAULT 1)";

        this.db.transaction(function(transaction) 
        {
            transaction.executeSql(sql, null, function (transaction, result)
            {
                // Deleted index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
                self.execute(sql, null, null);
                
                // Dirty index 
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
                self.execute(sql, null, null);
                
                // Client index 
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_email ON " + table_name + " (email, deleted);";
                self.execute(sql, null, null);                                                                                    
                
                // INSERT THE REGISTRY ENTRY
                sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
                transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
                {
                    if(this.DB_DEBUG)  
                        alert("INSERTED REGISTRY");
              
                      objDBUtils.checkNextTable(table_number);                
              
                  }, objDBUtils.DB_error_handler);

            }, objDBUtils.DB_error_handler);
        });    
    }
    
    /**********************************************
    * CONTACTS
    */
    this.createContacts = function(table_number)
    {
        if(this.DB_DEBUG)
            alert("CREATE CONTACTS");

        var table_name = this.tables[table_number][0];
        var table_version = this.tables[table_number][1]; 
   
        var sql = "CREATE TABLE IF NOT EXISTS contacts  (" +
                "'id' VARCHAR PRIMARY KEY NOT NULL, " +
                "'company_name' VARCHAR, " +
                "'first_name' VARCHAR, " +
                "'last_name' VARCHAR, " +
                "'phone' VARCHAR, " +
                "'fax' VARCHAR, " +                              
                "'email' VARCHAR, " +             
                "'mobile' VARCHAR, " +
                "'address1' VARCHAR, " +
                "'address2' VARCHAR, " +
                "'city' VARCHAR, " +
                "'state' VARCHAR, " +
                "'postcode' VARCHAR, " +
                "'country' VARCHAR, " +
                "'notes' VARCHAR, " +                                  
                "'created_by' INTEGER NOT NULL, " +
                "'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
                "'dirty' INTEGER NOT NULL DEFAULT 1)";          
                
        this.db.transaction(function(transaction) 
        {
            transaction.executeSql(sql, null, function (transaction, result)
            {
                // Create indexes
                
                // Deleted index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
                self.execute(sql, null, null);
                
                // Dirty index 
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
                self.execute(sql, null, null);                                         
                
                // INSERT THE REGISTRY ENTRY
                sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
                transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
                {
                    if(this.DB_DEBUG)  
                        alert("INSERTED REGISTRY");

                    self.checkNextTable(table_number);                
                    
                }, self.DB_error_handler);
            }, self.DB_error_handler);
        });    
    }  
    
    /**********************************************
    * INSPECTION ITEM PHOTOS
    */    
    this.createContactsfavourites = function(table_number)
    {
        var table_name = this.tables[table_number][0];
        var table_version = this.tables[table_number][1];    
        
        if(this.DB_DEBUG)
            alert("CREATE " + table_name);
        
        var sql = "CREATE TABLE IF NOT EXISTS contactsfavourites  (" +
                "'id' VARCHAR PRIMARY KEY NOT NULL, " +
                "'contact_id' VARCHAR NOT NULL, " +
                "'user_id' INTEGER NOT NULL, " +  
                "'created_by' INTEGER NOT NULL, " +                             
                "'modified' TIMESTAMP, " +                
                "'deleted' INTEGER NOT NULL DEFAULT 0 , " + 
                "'dirty' INTEGER NOT NULL DEFAULT 1)";

        this.db.transaction(function(transaction) 
        {
            transaction.executeSql(sql, null, function (transaction, result)
            {
                // Deleted index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
                self.execute(sql, null, null);
                
                // Dirty index 
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
                self.execute(sql, null, null);
                
                // Client index 
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_contactuser ON " + table_name + " (contact_id, user_id);";
                self.execute(sql, null, null);                                                                                    
                
                // INSERT THE REGISTRY ENTRY
                sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
                transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
                {
                    if(this.DB_DEBUG)  
                        alert("INSERTED REGISTRY");
              
                      objDBUtils.checkNextTable(table_number);                
              
                  }, objDBUtils.DB_error_handler);

            }, objDBUtils.DB_error_handler);
        });    
    }      
    
    this.getCountries = function()
    {
        var countries = JSON.parse('[{"CountryID":"1","Country":"Afghanistan","CurrencyCode":"AFA"},{"CountryID":"2","Country":"Albania","CurrencyCode":"ALL"},{"CountryID":"3","Country":"Algeria","CurrencyCode":"DZD"},{"CountryID":"4","Country":"American Samoa","CurrencyCode":"USD"},{"CountryID":"5","Country":"Andorra","CurrencyCode":"EUR"},{"CountryID":"6","Country":"Angola","CurrencyCode":"AOA"},{"CountryID":"7","Country":"Anguilla","CurrencyCode":"XCD"},{"CountryID":"8","Country":"Antarctica","CurrencyCode":""},{"CountryID":"9","Country":"Antigua and Barbuda","CurrencyCode":"XCD"},{"CountryID":"10","Country":"Argentina","CurrencyCode":"ARS"},{"CountryID":"11","Country":"Armenia","CurrencyCode":"AMD"},{"CountryID":"12","Country":"Aruba","CurrencyCode":"AWG"},{"CountryID":"13","Country":"Ashmore and Cartier","CurrencyCode":""},{"CountryID":"14","Country":"Australia","CurrencyCode":"AUD"},{"CountryID":"15","Country":"Austria","CurrencyCode":"EUR"},{"CountryID":"16","Country":"Azerbaijan","CurrencyCode":"AZM"},{"CountryID":"17","Country":"The Bahamas","CurrencyCode":"BSD"},{"CountryID":"18","Country":"Bahrain","CurrencyCode":"BHD"},{"CountryID":"19","Country":"Baker Island","CurrencyCode":""},{"CountryID":"20","Country":"Bangladesh","CurrencyCode":"BDT"},{"CountryID":"21","Country":"Barbados","CurrencyCode":"BBD"},{"CountryID":"22","Country":"Bassas da India","CurrencyCode":""},{"CountryID":"23","Country":"Belarus","CurrencyCode":"BYR"},{"CountryID":"24","Country":"Belgium","CurrencyCode":"EUR"},{"CountryID":"25","Country":"Belize","CurrencyCode":"BZD"},{"CountryID":"26","Country":"Benin","CurrencyCode":"XOF"},{"CountryID":"27","Country":"Bermuda","CurrencyCode":"BMD"},{"CountryID":"28","Country":"Bhutan","CurrencyCode":"BTN"},{"CountryID":"29","Country":"Bolivia","CurrencyCode":"BOB"},{"CountryID":"30","Country":"Bosnia and Herzegovina","CurrencyCode":"BAM"},{"CountryID":"31","Country":"Botswana","CurrencyCode":"BWP"},{"CountryID":"32","Country":"Bouvet Island","CurrencyCode":"NOK"},{"CountryID":"33","Country":"Brazil","CurrencyCode":"BRL"},{"CountryID":"34","Country":"British Indian Ocean Territory","CurrencyCode":"USD"},{"CountryID":"35","Country":"British Virgin Islands","CurrencyCode":"USD"},{"CountryID":"36","Country":"Brunei Darussalam","CurrencyCode":"BND"},{"CountryID":"37","Country":"Bulgaria","CurrencyCode":"BGN"},{"CountryID":"38","Country":"Burkina Faso","CurrencyCode":"XOF"},{"CountryID":"39","Country":"Burma","CurrencyCode":"MMK"},{"CountryID":"40","Country":"Burundi","CurrencyCode":"BIF"},{"CountryID":"41","Country":"Cambodia","CurrencyCode":"KHR"},{"CountryID":"42","Country":"Cameroon","CurrencyCode":"XAF"},{"CountryID":"43","Country":"Canada","CurrencyCode":"CAD"},{"CountryID":"44","Country":"Cape Verde","CurrencyCode":"CVE"},{"CountryID":"45","Country":"Cayman Islands","CurrencyCode":"KYD"},{"CountryID":"46","Country":"Central African Republic","CurrencyCode":"XAF"},{"CountryID":"47","Country":"Chad","CurrencyCode":"XAF"},{"CountryID":"48","Country":"Chile","CurrencyCode":"CLP"},{"CountryID":"49","Country":"China","CurrencyCode":"CNY"},{"CountryID":"50","Country":"Christmas Island","CurrencyCode":"AUD"},{"CountryID":"51","Country":"Clipperton Island","CurrencyCode":""},{"CountryID":"52","Country":"Cocos (Keeling) Islands","CurrencyCode":"AUD"},{"CountryID":"53","Country":"Colombia","CurrencyCode":"COP"},{"CountryID":"54","Country":"Comoros","CurrencyCode":"KMF"},{"CountryID":"55","Country":"Congo (Democratic)","CurrencyCode":"CDF"},{"CountryID":"56","Country":"Congo","CurrencyCode":"XAF"},{"CountryID":"57","Country":"Cook Islands","CurrencyCode":"NZD"},{"CountryID":"58","Country":"Coral Sea Islands","CurrencyCode":""},{"CountryID":"59","Country":"Costa Rica","CurrencyCode":"CRC"},{"CountryID":"60","Country":"Cote d\'Ivoire","CurrencyCode":"XOF"},{"CountryID":"61","Country":"Croatia","CurrencyCode":"HRK"},{"CountryID":"62","Country":"Cuba","CurrencyCode":"CUP"},{"CountryID":"63","Country":"Cyprus","CurrencyCode":"CYP"},{"CountryID":"64","Country":"Czech Republic","CurrencyCode":"CZK"},{"CountryID":"65","Country":"Denmark","CurrencyCode":"DKK"},{"CountryID":"66","Country":"Djibouti","CurrencyCode":"DJF"},{"CountryID":"67","Country":"Dominica","CurrencyCode":"XCD"},{"CountryID":"68","Country":"Dominican Republic","CurrencyCode":"DOP"},{"CountryID":"69","Country":"East Timor","CurrencyCode":"TPE"},{"CountryID":"70","Country":"Ecuador","CurrencyCode":"USD"},{"CountryID":"71","Country":"Egypt","CurrencyCode":"EGP"},{"CountryID":"72","Country":"El Salvador","CurrencyCode":"SVC"},{"CountryID":"73","Country":"Equatorial Guinea","CurrencyCode":"XAF"},{"CountryID":"74","Country":"Eritrea","CurrencyCode":"ERN"},{"CountryID":"75","Country":"Estonia","CurrencyCode":"EEK"},{"CountryID":"76","Country":"Ethiopia","CurrencyCode":"ETB"},{"CountryID":"77","Country":"Europa Island","CurrencyCode":""},{"CountryID":"78","Country":"Falkland Islands (Islas Malvinas)","CurrencyCode":"FKP"},{"CountryID":"79","Country":"Faroe Islands","CurrencyCode":"DKK"},{"CountryID":"80","Country":"Fiji","CurrencyCode":"FJD"},{"CountryID":"81","Country":"Finland","CurrencyCode":"EUR"},{"CountryID":"82","Country":"France","CurrencyCode":"EUR"},{"CountryID":"83","Country":"France, Metropolitan","CurrencyCode":"EUR"},{"CountryID":"84","Country":"French Guiana","CurrencyCode":"EUR"},{"CountryID":"85","Country":"French Polynesia","CurrencyCode":"XPF"},{"CountryID":"87","Country":"Gabon","CurrencyCode":"XAF"},{"CountryID":"88","Country":"The Gambia","CurrencyCode":"GMD"},{"CountryID":"89","Country":"Gaza Strip","CurrencyCode":"ILS"},{"CountryID":"90","Country":"Georgia","CurrencyCode":"GEL"},{"CountryID":"91","Country":"Germany","CurrencyCode":"EUR"},{"CountryID":"92","Country":"Ghana","CurrencyCode":"GHC"},{"CountryID":"93","Country":"Gibraltar","CurrencyCode":"GIP"},{"CountryID":"94","Country":"Glorioso Islands","CurrencyCode":""},{"CountryID":"95","Country":"Greece","CurrencyCode":"EUR"},{"CountryID":"96","Country":"Greenland","CurrencyCode":"DKK"},{"CountryID":"97","Country":"Grenada","CurrencyCode":"XCD"},{"CountryID":"98","Country":"Guadeloupe","CurrencyCode":"EUR"},{"CountryID":"99","Country":"Guam","CurrencyCode":"USD"},{"CountryID":"100","Country":"Guatemala","CurrencyCode":"GTQ"},{"CountryID":"101","Country":"Guernsey","CurrencyCode":"GBP"},{"CountryID":"102","Country":"Guinea","CurrencyCode":"GNF"},{"CountryID":"103","Country":"Guinea-Bissau","CurrencyCode":"XOF"},{"CountryID":"104","Country":"Guyana","CurrencyCode":"GYD"},{"CountryID":"105","Country":"Haiti","CurrencyCode":"HTG"},{"CountryID":"106","Country":"Heard and McDonald Islands","CurrencyCode":"AUD"},{"CountryID":"107","Country":"Holy See (Vatican City)","CurrencyCode":"EUR"},{"CountryID":"108","Country":"Honduras","CurrencyCode":"HNL"},{"CountryID":"109","Country":"Hong Kong (SAR)","CurrencyCode":"HKD"},{"CountryID":"110","Country":"Howland Island","CurrencyCode":""},{"CountryID":"111","Country":"Hungary","CurrencyCode":"HUF"},{"CountryID":"112","Country":"Iceland","CurrencyCode":"ISK"},{"CountryID":"113","Country":"India","CurrencyCode":"INR"},{"CountryID":"114","Country":"Indonesia","CurrencyCode":"IDR"},{"CountryID":"115","Country":"Iran","CurrencyCode":"IRR"},{"CountryID":"116","Country":"Iraq","CurrencyCode":"IQD"},{"CountryID":"117","Country":"Ireland","CurrencyCode":"EUR"},{"CountryID":"118","Country":"Israel","CurrencyCode":"ILS"},{"CountryID":"119","Country":"Italy","CurrencyCode":"EUR"},{"CountryID":"120","Country":"Jamaica","CurrencyCode":"JMD"},{"CountryID":"121","Country":"Jan Mayen","CurrencyCode":"NOK"},{"CountryID":"122","Country":"Japan","CurrencyCode":"JPY"},{"CountryID":"123","Country":"Jarvis Island","CurrencyCode":""},{"CountryID":"124","Country":"Jersey","CurrencyCode":"GBP"},{"CountryID":"125","Country":"Johnston Atoll","CurrencyCode":""},{"CountryID":"126","Country":"Jordan","CurrencyCode":"JOD"},{"CountryID":"127","Country":"Juan de Nova Island","CurrencyCode":""},{"CountryID":"128","Country":"Kazakhstan","CurrencyCode":"KZT"},{"CountryID":"129","Country":"Kenya","CurrencyCode":"KES"},{"CountryID":"130","Country":"Kingman Reef","CurrencyCode":""},{"CountryID":"131","Country":"Kiribati","CurrencyCode":"AUD"},{"CountryID":"132","Country":"Korea, North","CurrencyCode":"KPW"},{"CountryID":"133","Country":"Korea, South","CurrencyCode":"KRW"},{"CountryID":"134","Country":"Kuwait","CurrencyCode":"KWD"},{"CountryID":"135","Country":"Kyrgyzstan","CurrencyCode":"KGS"},{"CountryID":"136","Country":"Laos","CurrencyCode":"LAK"},{"CountryID":"137","Country":"Latvia","CurrencyCode":"LVL"},{"CountryID":"138","Country":"Lebanon","CurrencyCode":"LBP"},{"CountryID":"139","Country":"Lesotho","CurrencyCode":"LSL"},{"CountryID":"140","Country":"Liberia","CurrencyCode":"LRD"},{"CountryID":"141","Country":"Libya","CurrencyCode":"LYD"},{"CountryID":"142","Country":"Liechtenstein","CurrencyCode":"CHF"},{"CountryID":"143","Country":"Lithuania","CurrencyCode":"LTL"},{"CountryID":"144","Country":"Luxembourg","CurrencyCode":"EUR"},{"CountryID":"145","Country":"Macao","CurrencyCode":"MOP"},{"CountryID":"146","Country":"Macedonia","CurrencyCode":"MKD"},{"CountryID":"147","Country":"Madagascar","CurrencyCode":"MGF"},{"CountryID":"148","Country":"Malawi","CurrencyCode":"MWK"},{"CountryID":"149","Country":"Malaysia","CurrencyCode":"MYR"},{"CountryID":"150","Country":"Maldives","CurrencyCode":"MVR"},{"CountryID":"151","Country":"Mali","CurrencyCode":"XOF"},{"CountryID":"152","Country":"Malta","CurrencyCode":"MTL"},{"CountryID":"153","Country":"Man, Isle of","CurrencyCode":"GBP"},{"CountryID":"154","Country":"Marshall Islands","CurrencyCode":"USD"},{"CountryID":"155","Country":"Martinique","CurrencyCode":"EUR"},{"CountryID":"156","Country":"Mauritania","CurrencyCode":"MRO"},{"CountryID":"157","Country":"Mauritius","CurrencyCode":"MUR"},{"CountryID":"158","Country":"Mayotte","CurrencyCode":"EUR"},{"CountryID":"159","Country":"Mexico","CurrencyCode":"MXN"},{"CountryID":"160","Country":"Micronesia","CurrencyCode":"USD"},{"CountryID":"161","Country":"Midway Islands","CurrencyCode":"USD"},{"CountryID":"162","Country":"Miscellaneous (French)","CurrencyCode":""},{"CountryID":"163","Country":"Moldova","CurrencyCode":"MDL"},{"CountryID":"164","Country":"Monaco","CurrencyCode":"EUR"},{"CountryID":"165","Country":"Mongolia","CurrencyCode":"MNT"},{"CountryID":"166","Country":"Montenegro","CurrencyCode":""},{"CountryID":"167","Country":"Montserrat","CurrencyCode":"XCD"},{"CountryID":"168","Country":"Morocco","CurrencyCode":"MAD"},{"CountryID":"169","Country":"Mozambique","CurrencyCode":"MZM"},{"CountryID":"170","Country":"Myanmar","CurrencyCode":"MMK"},{"CountryID":"171","Country":"Namibia","CurrencyCode":"NAD"},{"CountryID":"172","Country":"Nauru","CurrencyCode":"AUD"},{"CountryID":"173","Country":"Navassa Island","CurrencyCode":""},{"CountryID":"174","Country":"Nepal","CurrencyCode":"NPR"},{"CountryID":"175","Country":"Netherlands","CurrencyCode":"EUR"},{"CountryID":"176","Country":"Netherlands Antilles","CurrencyCode":"ANG"},{"CountryID":"177","Country":"New Caledonia","CurrencyCode":"XPF"},{"CountryID":"178","Country":"New Zealand","CurrencyCode":"NZD"},{"CountryID":"179","Country":"Nicaragua","CurrencyCode":"NIO"},{"CountryID":"180","Country":"Niger","CurrencyCode":"XOF"},{"CountryID":"181","Country":"Nigeria","CurrencyCode":"NGN"},{"CountryID":"182","Country":"Niue","CurrencyCode":"NZD"},{"CountryID":"183","Country":"Norfolk Island","CurrencyCode":"AUD"},{"CountryID":"184","Country":"Northern Mariana Islands","CurrencyCode":"USD"},{"CountryID":"185","Country":"Norway","CurrencyCode":"NOK"},{"CountryID":"186","Country":"Oman","CurrencyCode":"OMR"},{"CountryID":"187","Country":"Pakistan","CurrencyCode":"PKR"},{"CountryID":"188","Country":"Palau","CurrencyCode":"USD"},{"CountryID":"189","Country":"Palmyra Atoll","CurrencyCode":""},{"CountryID":"190","Country":"Panama","CurrencyCode":"PAB"},{"CountryID":"191","Country":"Papua New Guinea","CurrencyCode":"PGK"},{"CountryID":"192","Country":"Paracel Islands","CurrencyCode":""},{"CountryID":"193","Country":"Paraguay","CurrencyCode":"PYG"},{"CountryID":"194","Country":"Peru","CurrencyCode":"PEN"},{"CountryID":"195","Country":"Philippines","CurrencyCode":"PHP"},{"CountryID":"196","Country":"Pitcairn Islands","CurrencyCode":"NZD"},{"CountryID":"197","Country":"Poland","CurrencyCode":"PLN"},{"CountryID":"198","Country":"Portugal","CurrencyCode":"EUR"},{"CountryID":"199","Country":"Puerto Rico","CurrencyCode":"USD"},{"CountryID":"200","Country":"Qatar","CurrencyCode":"QAR"},{"CountryID":"201","Country":"R\u00e9union","CurrencyCode":"EUR"},{"CountryID":"202","Country":"Romania","CurrencyCode":"ROL"},{"CountryID":"203","Country":"Russia","CurrencyCode":"RUB"},{"CountryID":"204","Country":"Rwanda","CurrencyCode":"RWF"},{"CountryID":"205","Country":"Saint Helena","CurrencyCode":"SHP"},{"CountryID":"206","Country":"Saint Kitts and Nevis","CurrencyCode":"XCD"},{"CountryID":"207","Country":"Saint Lucia","CurrencyCode":"XCD"},{"CountryID":"208","Country":"Saint Pierre and Miquelon","CurrencyCode":"EUR"},{"CountryID":"209","Country":"Saint Vincent\/Grenadines","CurrencyCode":"XCD"},{"CountryID":"210","Country":"Samoa","CurrencyCode":"WST"},{"CountryID":"211","Country":"San Marino","CurrencyCode":"EUR"},{"CountryID":"212","Country":"S\u00e3o Tom\u00e9 and Pr\u00edncipe","CurrencyCode":"STD"},{"CountryID":"213","Country":"Saudi Arabia","CurrencyCode":"SAR"},{"CountryID":"214","Country":"Senegal","CurrencyCode":"XOF"},{"CountryID":"215","Country":"Serbia","CurrencyCode":""},{"CountryID":"216","Country":"Serbia and Montenegro","CurrencyCode":""},{"CountryID":"217","Country":"Seychelles","CurrencyCode":"SCR"},{"CountryID":"218","Country":"Sierra Leone","CurrencyCode":"SLL"},{"CountryID":"219","Country":"Singapore","CurrencyCode":"SGD"},{"CountryID":"220","Country":"Slovakia","CurrencyCode":"SKK"},{"CountryID":"221","Country":"Slovenia","CurrencyCode":"SIT"},{"CountryID":"222","Country":"Solomon Islands","CurrencyCode":"SBD"},{"CountryID":"223","Country":"Somalia","CurrencyCode":"SOS"},{"CountryID":"224","Country":"South Africa","CurrencyCode":"ZAR"},{"CountryID":"226","Country":"Spain","CurrencyCode":"EUR"},{"CountryID":"227","Country":"Spratly Islands","CurrencyCode":""},{"CountryID":"228","Country":"Sri Lanka","CurrencyCode":"LKR"},{"CountryID":"229","Country":"Sudan","CurrencyCode":"SDD"},{"CountryID":"230","Country":"Suriname","CurrencyCode":"SRG"},{"CountryID":"231","Country":"Svalbard","CurrencyCode":"NOK"},{"CountryID":"232","Country":"Swaziland","CurrencyCode":"SZL"},{"CountryID":"233","Country":"Sweden","CurrencyCode":"SEK"},{"CountryID":"234","Country":"Switzerland","CurrencyCode":"CHF"},{"CountryID":"235","Country":"Syria","CurrencyCode":"SYP"},{"CountryID":"236","Country":"Taiwan","CurrencyCode":"TWD"},{"CountryID":"237","Country":"Tajikistan","CurrencyCode":"TJS"},{"CountryID":"238","Country":"Tanzania","CurrencyCode":"TZS"},{"CountryID":"239","Country":"Thailand","CurrencyCode":"THB"},{"CountryID":"240","Country":"Togo","CurrencyCode":"XOF"},{"CountryID":"241","Country":"Tokelau","CurrencyCode":"NZD"},{"CountryID":"242","Country":"Tonga","CurrencyCode":"TOP"},{"CountryID":"243","Country":"Trinidad and Tobago","CurrencyCode":"TTD"},{"CountryID":"244","Country":"Tromelin Island","CurrencyCode":""},{"CountryID":"245","Country":"Tunisia","CurrencyCode":"TND"},{"CountryID":"246","Country":"Turkey","CurrencyCode":"TRL"},{"CountryID":"247","Country":"Turkmenistan","CurrencyCode":"TMM"},{"CountryID":"248","Country":"Turks and Caicos Islands","CurrencyCode":"USD"},{"CountryID":"249","Country":"Tuvalu","CurrencyCode":"AUD"},{"CountryID":"250","Country":"Uganda","CurrencyCode":"UGX"},{"CountryID":"251","Country":"Ukraine","CurrencyCode":"UAH"},{"CountryID":"252","Country":"United Arab Emirates","CurrencyCode":"AED"},{"CountryID":"253","Country":"United Kingdom","CurrencyCode":"GBP"},{"CountryID":"254","Country":"United States","CurrencyCode":"USD"},{"CountryID":"255","Country":"US Minor Outlying Islands","CurrencyCode":"USD"},{"CountryID":"256","Country":"Uruguay","CurrencyCode":"UYU"},{"CountryID":"257","Country":"Uzbekistan","CurrencyCode":"UZS"},{"CountryID":"258","Country":"Vanuatu","CurrencyCode":"VUV"},{"CountryID":"259","Country":"Venezuela","CurrencyCode":"VEB"},{"CountryID":"260","Country":"Vietnam","CurrencyCode":"VND"},{"CountryID":"261","Country":"Virgin Islands","CurrencyCode":"USD"},{"CountryID":"262","Country":"Virgin Islands (UK)","CurrencyCode":"USD"},{"CountryID":"263","Country":"Virgin Islands (US)","CurrencyCode":"USD"},{"CountryID":"264","Country":"Wake Island","CurrencyCode":"USD"},{"CountryID":"265","Country":"Wallis and Futuna","CurrencyCode":"XPF"},{"CountryID":"266","Country":"West Bank","CurrencyCode":"ILS"},{"CountryID":"267","Country":"Western Sahara","CurrencyCode":"MAD"},{"CountryID":"268","Country":"Western Samoa","CurrencyCode":"WST"},{"CountryID":"269","Country":"World","CurrencyCode":""},{"CountryID":"270","Country":"Yemen","CurrencyCode":"YER"},{"CountryID":"271","Country":"Yugoslavia","CurrencyCode":"YUM"},{"CountryID":"272","Country":"Zaire","CurrencyCode":""},{"CountryID":"273","Country":"Zambia","CurrencyCode":"ZMK"},{"CountryID":"274","Country":"Zimbabwe","CurrencyCode":"ZWD"},{"CountryID":"275","Country":"Palestinian Territory, Occupied","CurrencyCode":""}]');
        return countries;
    }	
    
    this.getStates = function(country_id)
    {
        var states = JSON.parse('{"C1":[{"StateID":"823","State":"Badakhshan"},{"StateID":"824","State":"Badghis"},{"StateID":"825","State":"Baghlan"},{"StateID":"827","State":"Bamian"},{"StateID":"828","State":"Farah"},{"StateID":"829","State":"Faryab"},{"StateID":"830","State":"Ghazni"},{"StateID":"831","State":"Ghowr"},{"StateID":"832","State":"Helmand"},{"StateID":"833","State":"Herat"},{"StateID":"835","State":"Kabol"},{"StateID":"836","State":"Kapisa"},{"StateID":"837","State":"Konar"},{"StateID":"838","State":"Laghman"},{"StateID":"839","State":"Lowgar"},{"StateID":"840","State":"Nangarhar"},{"StateID":"841","State":"Nimruz"},{"StateID":"842","State":"Oruzgan"},{"StateID":"843","State":"Paktia"},{"StateID":"844","State":"Parvan"},{"StateID":"845","State":"Kandahar"},{"StateID":"846","State":"Kondoz"},{"StateID":"848","State":"Takhar"},{"StateID":"849","State":"Vardak"},{"StateID":"850","State":"Zabol"},{"StateID":"851","State":"Paktika"},{"StateID":"852","State":"Balkh"},{"StateID":"853","State":"Jowzjan"},{"StateID":"854","State":"Samangan"},{"StateID":"855","State":"Sare Pol"},{"StateID":"5296","State":"Khost"},{"StateID":"5297","State":"Nuristan"}],"C2":[{"StateID":"539","State":"Albania"},{"StateID":"975","State":"Berat"},{"StateID":"976","State":"Diber"},{"StateID":"977","State":"Durres"},{"StateID":"978","State":"Elbasan"},{"StateID":"979","State":"Fier"},{"StateID":"980","State":"Gjirokaster"},{"StateID":"981","State":"Gramsh"},{"StateID":"982","State":"Kolonje"},{"StateID":"983","State":"Korce"},{"StateID":"984","State":"Kruje"},{"StateID":"985","State":"Kukes"},{"StateID":"986","State":"Lezhe"},{"StateID":"987","State":"Librazhd"},{"StateID":"988","State":"Lushnje"},{"StateID":"989","State":"Mat"},{"StateID":"990","State":"Mirdite"},{"StateID":"991","State":"Permet"},{"StateID":"992","State":"Pogradec"},{"StateID":"993","State":"Puke"},{"StateID":"994","State":"Sarande"},{"StateID":"995","State":"Shkoder"},{"StateID":"996","State":"Skrapar"},{"StateID":"997","State":"Tepelene"},{"StateID":"998","State":"Tropoje"},{"StateID":"999","State":"Vlore"},{"StateID":"1000","State":"Tiran"},{"StateID":"1001","State":"Bulqize"},{"StateID":"1002","State":"Delvine"},{"StateID":"1003","State":"Devoll"},{"StateID":"1004","State":"Has"},{"StateID":"1005","State":"Kavaje"},{"StateID":"1006","State":"Kucove"},{"StateID":"1007","State":"Kurbin"},{"StateID":"1008","State":"Malesi e Madhe"},{"StateID":"1009","State":"Mallakaster"},{"StateID":"1010","State":"Peqin"},{"StateID":"1011","State":"Tirane"}],"C3":[{"StateID":"540","State":"Algeria"},{"StateID":"856","State":"Alger"},{"StateID":"857","State":"Batna"},{"StateID":"858","State":"Constantine"},{"StateID":"859","State":"Medea"},{"StateID":"860","State":"Mostaganem"},{"StateID":"861","State":"Oran"},{"StateID":"862","State":"Saida"},{"StateID":"863","State":"Setif"},{"StateID":"864","State":"Tiaret"},{"StateID":"865","State":"Tizi Ouzou"},{"StateID":"866","State":"Tlemcen"},{"StateID":"867","State":"Bejaia"},{"StateID":"868","State":"Biskra"},{"StateID":"869","State":"Blida"},{"StateID":"870","State":"Bouira"},{"StateID":"871","State":"Djelfa"},{"StateID":"872","State":"Guelma"},{"StateID":"873","State":"Jijel"},{"StateID":"874","State":"Laghouat"},{"StateID":"875","State":"Mascara"},{"StateID":"876","State":"M\'Sila"},{"StateID":"877","State":"Oum el Bouaghi"},{"StateID":"878","State":"Sidi Bel Abbes"},{"StateID":"879","State":"Skikda"},{"StateID":"880","State":"Tebessa"},{"StateID":"881","State":"Adrar"},{"StateID":"882","State":"Ain Defla"},{"StateID":"883","State":"Ain Temouchent"},{"StateID":"884","State":"Annaba"},{"StateID":"885","State":"Bechar"},{"StateID":"886","State":"Bordj Bou Arreridj"},{"StateID":"887","State":"Boumerdes"},{"StateID":"888","State":"Chlef"},{"StateID":"889","State":"El Bayadh"},{"StateID":"890","State":"El Oued"},{"StateID":"891","State":"El Tarf"},{"StateID":"892","State":"Ghardaia"},{"StateID":"893","State":"Illizi"},{"StateID":"894","State":"Khenchela"},{"StateID":"895","State":"Mila"},{"StateID":"896","State":"Naama"},{"StateID":"897","State":"Ouargla"},{"StateID":"898","State":"Relizane"},{"StateID":"899","State":"Souk Ahras"},{"StateID":"900","State":"Tamanghasset"},{"StateID":"901","State":"Tindouf"},{"StateID":"902","State":"Tipaza"},{"StateID":"903","State":"Tissemsilt"}],"C4":[{"StateID":"541","State":"American Samoa"},{"StateID":"5309","State":"Eastern Tutuila"},{"StateID":"5310","State":"Unorganized"},{"StateID":"5311","State":"Western Tutuila"},{"StateID":"5312","State":"Manu\'a"}],"C5":[{"StateID":"542","State":"Andorra"},{"StateID":"1023","State":"Andorra la Vella"},{"StateID":"1024","State":"Canillo"},{"StateID":"1025","State":"Encamp"},{"StateID":"1026","State":"La Massana"},{"StateID":"1027","State":"Ordino"},{"StateID":"1028","State":"Sant Julia de Loria"},{"StateID":"5052","State":"Escaldes-Engordany"}],"C6":[{"StateID":"543","State":"Angola"},{"StateID":"1029","State":"Benguela"},{"StateID":"1030","State":"Bie"},{"StateID":"1031","State":"Cabinda"},{"StateID":"1032","State":"Cuando Cubango"},{"StateID":"1033","State":"Cuanza Norte"},{"StateID":"1034","State":"Cuanza Sul"},{"StateID":"1035","State":"Cunene"},{"StateID":"1036","State":"Huambo"},{"StateID":"1037","State":"Huila"},{"StateID":"1038","State":"Luanda"},{"StateID":"1039","State":"Malanje"},{"StateID":"1040","State":"Namibe"},{"StateID":"1041","State":"Moxico"},{"StateID":"1046","State":"Uige"},{"StateID":"1047","State":"Zaire"},{"StateID":"1048","State":"Lunda Norte"},{"StateID":"1049","State":"Lunda Sul"},{"StateID":"1050","State":"Bengo"}],"C7":[{"StateID":"544","State":"Anguilla"}],"C8":[{"StateID":"545","State":"Antarctica"},{"StateID":"4761","State":"Enderby Land"},{"StateID":"4763","State":"Ross Island"}],"C9":[{"StateID":"546","State":"Antigua and Barbuda"},{"StateID":"816","State":"Barbuda"},{"StateID":"817","State":"Saint George"},{"StateID":"818","State":"Saint John"},{"StateID":"819","State":"Saint Mary"},{"StateID":"820","State":"Saint Paul"},{"StateID":"821","State":"Saint Peter"},{"StateID":"822","State":"Saint Philip"}],"C10":[{"StateID":"547","State":"Argentina"},{"StateID":"1051","State":"Buenos Aires"},{"StateID":"1052","State":"Catamarca"},{"StateID":"1053","State":"Chaco"},{"StateID":"1054","State":"Chubut"},{"StateID":"1055","State":"Cordoba"},{"StateID":"1056","State":"Corrientes"},{"StateID":"1057","State":"Distrito Federal"},{"StateID":"1058","State":"Entre Rios"},{"StateID":"1059","State":"Formosa"},{"StateID":"1060","State":"Jujuy"},{"StateID":"1061","State":"La Pampa"},{"StateID":"1062","State":"La Rioja"},{"StateID":"1063","State":"Mendoza"},{"StateID":"1064","State":"Misiones"},{"StateID":"1065","State":"Neuquen"},{"StateID":"1066","State":"Rio Negro"},{"StateID":"1067","State":"Salta"},{"StateID":"1068","State":"San Juan"},{"StateID":"1069","State":"San Luis"},{"StateID":"1070","State":"Santa Cruz"},{"StateID":"1071","State":"Santa Fe"},{"StateID":"1072","State":"Santiago del Estero"},{"StateID":"1073","State":"Antartida e Islas del Atlan Tierra del Fuego"},{"StateID":"1074","State":"Tucuman"}],"C11":[{"StateID":"548","State":"Armenia"},{"StateID":"1012","State":"Aragatsotn"},{"StateID":"1013","State":"Ararat"},{"StateID":"1014","State":"Armavir"},{"StateID":"1015","State":"Geghark\'unik\'"},{"StateID":"1016","State":"Kotayk\'"},{"StateID":"1017","State":"Lorri"},{"StateID":"1018","State":"Shirak"},{"StateID":"1019","State":"Syunik\'"},{"StateID":"1020","State":"Tavush"},{"StateID":"1021","State":"Vayots\' Dzor"},{"StateID":"1022","State":"Yerevan"}],"C12":[{"StateID":"549","State":"Aruba"}],"C13":[{"StateID":"550","State":"Ashmore and Cartier"}],"C14":[{"StateID":"1","State":"Victoria"},{"StateID":"2","State":"Tasmania"},{"StateID":"3","State":"Queensland"},{"StateID":"4","State":"New South Wales"},{"StateID":"5","State":"South Australia"},{"StateID":"6","State":"Western Australia"},{"StateID":"7","State":"Northern Territory"},{"StateID":"174","State":"Australian Capital Territory"}],"C15":[{"StateID":"552","State":"Austria"},{"StateID":"1075","State":"Burgenland"},{"StateID":"1076","State":"Karnten"},{"StateID":"1077","State":"Niederosterreich"},{"StateID":"1078","State":"Oberosterreich"},{"StateID":"1079","State":"Salzburg"},{"StateID":"1080","State":"Steiermark"},{"StateID":"1081","State":"Tirol"},{"StateID":"1082","State":"Vorarlberg"},{"StateID":"1083","State":"Wien"}],"C16":[{"StateID":"553","State":"Azerbaijan"},{"StateID":"904","State":"Abseron"},{"StateID":"905","State":"Agcabadi"},{"StateID":"906","State":"Agdam"},{"StateID":"907","State":"Agdas"},{"StateID":"908","State":"Agstafa"},{"StateID":"909","State":"Agsu"},{"StateID":"910","State":"Ali Bayramli"},{"StateID":"911","State":"Astara"},{"StateID":"912","State":"Baki"},{"StateID":"913","State":"Balakan"},{"StateID":"914","State":"Barda"},{"StateID":"915","State":"Beylaqan"},{"StateID":"916","State":"Bilasuvar"},{"StateID":"917","State":"Cabrayil"},{"StateID":"918","State":"Calilabad"},{"StateID":"919","State":"Daskasan"},{"StateID":"920","State":"Davaci"},{"StateID":"921","State":"Fuzuli"},{"StateID":"922","State":"Gadabay"},{"StateID":"923","State":"Ganca"},{"StateID":"924","State":"Goranboy"},{"StateID":"925","State":"Goycay"},{"StateID":"926","State":"Haciqabul"},{"StateID":"927","State":"Imisli"},{"StateID":"928","State":"Ismayilli"},{"StateID":"929","State":"Kalbacar"},{"StateID":"930","State":"Kurdamir"},{"StateID":"931","State":"Lacin"},{"StateID":"932","State":"Lankaran"},{"StateID":"934","State":"Lerik"},{"StateID":"935","State":"Masalli"},{"StateID":"936","State":"Mingacevir"},{"StateID":"937","State":"Naftalan"},{"StateID":"938","State":"Naxcivan"},{"StateID":"939","State":"Neftcala"},{"StateID":"940","State":"Oguz"},{"StateID":"941","State":"Qabala"},{"StateID":"942","State":"Qax"},{"StateID":"943","State":"Qazax"},{"StateID":"944","State":"Qobustan"},{"StateID":"945","State":"Quba"},{"StateID":"946","State":"Qubadli"},{"StateID":"947","State":"Qusar"},{"StateID":"948","State":"Saatli"},{"StateID":"949","State":"Sabirabad"},{"StateID":"950","State":"Saki"},{"StateID":"952","State":"Salyan"},{"StateID":"953","State":"Samaxi"},{"StateID":"954","State":"Samkir"},{"StateID":"955","State":"Samux"},{"StateID":"956","State":"Siyazan"},{"StateID":"957","State":"Sumqayit"},{"StateID":"958","State":"Susa"},{"StateID":"960","State":"Tartar"},{"StateID":"961","State":"Tovuz"},{"StateID":"962","State":"Ucar"},{"StateID":"963","State":"Xacmaz"},{"StateID":"964","State":"Xankandi"},{"StateID":"965","State":"Xanlar"},{"StateID":"966","State":"Xizi"},{"StateID":"967","State":"Xocali"},{"StateID":"968","State":"Xocavand"},{"StateID":"969","State":"Yardimli"},{"StateID":"970","State":"Yevlax"},{"StateID":"972","State":"Zangilan"},{"StateID":"973","State":"Zaqatala"},{"StateID":"974","State":"Zardab"},{"StateID":"5298","State":"Sarur"},{"StateID":"5299","State":"Sahbuz"},{"StateID":"5300","State":"Sadarak"},{"StateID":"5301","State":"Ordubud"},{"StateID":"5302","State":"Babak"}],"C17":[{"StateID":"554","State":"The Bahamas"},{"StateID":"1138","State":"Bimini"},{"StateID":"1139","State":"Cat Island"},{"StateID":"1140","State":"Exuma"},{"StateID":"1143","State":"Inagua"},{"StateID":"1144","State":"Long Island"},{"StateID":"1145","State":"Mayaguana"},{"StateID":"1146","State":"Ragged Island"},{"StateID":"1147","State":"Harbour Island"},{"StateID":"1148","State":"New Providence"},{"StateID":"1149","State":"Acklins and Crooked Islands"},{"StateID":"1150","State":"Freeport"},{"StateID":"1151","State":"Fresh Creek"},{"StateID":"1152","State":"Governor\'s Harbour"},{"StateID":"1153","State":"Green Turtle Cay"},{"StateID":"1154","State":"High Rock"},{"StateID":"1155","State":"Kemps Bay"},{"StateID":"1156","State":"Marsh Harbour"},{"StateID":"1157","State":"Nichollstown and Berry Islands"},{"StateID":"1158","State":"Rock Sound"},{"StateID":"1159","State":"Sandy Point"},{"StateID":"1160","State":"San Salvador and Rum Cay"}],"C18":[{"StateID":"555","State":"Bahrain"},{"StateID":"1084","State":"Al Hadd"},{"StateID":"1085","State":"Al Manamah"},{"StateID":"1086","State":"Al Muharraq"},{"StateID":"1087","State":"Jidd Hafs"},{"StateID":"1088","State":"Sitrah"},{"StateID":"1090","State":"Al Mintaqah al Gharbiyah"},{"StateID":"1091","State":"Mintaqat Juzur Hawar"},{"StateID":"1092","State":"Al Mintaqah ash Shamaliyah"},{"StateID":"1093","State":"Al Mintaqah al Wusta"},{"StateID":"1094","State":"Madinat Isa"},{"StateID":"1096","State":"Madinat Hamad"},{"StateID":"5114","State":"Ar Rifa\' wa al Mintaqah al Janubiyah"}],"C19":[{"StateID":"556","State":"Baker Island"}],"C20":[{"StateID":"557","State":"Bangladesh"},{"StateID":"1161","State":"Chittagong"},{"StateID":"1162","State":"Dhaka"},{"StateID":"1163","State":"Khulna"},{"StateID":"1164","State":"Rajshahi"},{"StateID":"5303","State":"Barisal"},{"StateID":"5304","State":"Sylhet"}],"C21":[{"StateID":"558","State":"Barbados"},{"StateID":"1097","State":"Christ Church"},{"StateID":"1098","State":"Saint Andrew"},{"StateID":"1099","State":"Saint George"},{"StateID":"1100","State":"Saint James"},{"StateID":"1101","State":"Saint John"},{"StateID":"1102","State":"Saint Joseph"},{"StateID":"1103","State":"Saint Lucy"},{"StateID":"1104","State":"Saint Michael"},{"StateID":"1105","State":"Saint Peter"},{"StateID":"1106","State":"Saint Philip"},{"StateID":"1107","State":"Saint Thomas"}],"C22":[{"StateID":"559","State":"Bassas da India"}],"C23":[{"StateID":"560","State":"Belarus"},{"StateID":"1203","State":"Brestskaya Voblasts\'"},{"StateID":"1204","State":"Homyel\'skaya Voblasts\'"},{"StateID":"1205","State":"Hrodzyenskaya Voblasts\'"},{"StateID":"1206","State":"Minsk"},{"StateID":"1207","State":"Minskaya Voblasts\'"},{"StateID":"1208","State":"Mahilyowskaya Voblasts\'"},{"StateID":"1209","State":"Vitsyebskaya Voblasts\'"}],"C24":[{"StateID":"561","State":"Belgium"},{"StateID":"1129","State":"Antwerpen"},{"StateID":"1131","State":"Hainaut"},{"StateID":"1132","State":"Liege"},{"StateID":"1133","State":"Limburg"},{"StateID":"1134","State":"Luxembourg"},{"StateID":"1135","State":"Namur"},{"StateID":"1136","State":"Oost-Vlaanderen"},{"StateID":"1137","State":"West-Vlaanderen"},{"StateID":"5051","State":"Brussels"},{"StateID":"5305","State":"Brabant Wallon"},{"StateID":"5306","State":"Vlaams-Brabant"}],"C25":[{"StateID":"1165","State":"Belize"},{"StateID":"1166","State":"Cayo"},{"StateID":"1167","State":"Corozal"},{"StateID":"1168","State":"Orange Walk"},{"StateID":"1169","State":"Stann Creek"},{"StateID":"1170","State":"Toledo"}],"C26":[{"StateID":"563","State":"Benin"},{"StateID":"1197","State":"Atakora"},{"StateID":"1198","State":"Atlantique"},{"StateID":"1199","State":"Borgou"},{"StateID":"1200","State":"Mono"},{"StateID":"1201","State":"Oueme"},{"StateID":"1202","State":"Zou"},{"StateID":"5316","State":"Plateau"},{"StateID":"5317","State":"Littoral"},{"StateID":"5318","State":"Donga"},{"StateID":"5319","State":"Couffo"},{"StateID":"5320","State":"Collines"},{"StateID":"5321","State":"Alibori"}],"C27":[{"StateID":"564","State":"Bermuda"},{"StateID":"1118","State":"Devonshire"},{"StateID":"1119","State":"Hamilton Municipality"},{"StateID":"1121","State":"Paget"},{"StateID":"1122","State":"Pembroke"},{"StateID":"1123","State":"Saint George"},{"StateID":"1124","State":"Saint George\'s"},{"StateID":"1125","State":"Sandys"},{"StateID":"1126","State":"Smiths"},{"StateID":"1127","State":"Southampton"},{"StateID":"1128","State":"Warwick"},{"StateID":"5308","State":"Hamilton"}],"C28":[{"StateID":"565","State":"Bhutan"},{"StateID":"1221","State":"Bumthang"},{"StateID":"1222","State":"Chhukha"},{"StateID":"1223","State":"Chirang"},{"StateID":"1224","State":"Daga"},{"StateID":"1225","State":"Geylegphug"},{"StateID":"1226","State":"Ha"},{"StateID":"1227","State":"Lhuntshi"},{"StateID":"1228","State":"Mongar"},{"StateID":"1229","State":"Paro"},{"StateID":"1230","State":"Pemagatsel"},{"StateID":"1231","State":"Punakha"},{"StateID":"1232","State":"Samchi"},{"StateID":"1233","State":"Samdrup"},{"StateID":"1234","State":"Shemgang"},{"StateID":"1235","State":"Tashigang"},{"StateID":"1236","State":"Thimphu"},{"StateID":"1237","State":"Tongsa"},{"StateID":"1238","State":"Wangdi Phodrang"},{"StateID":"5314","State":"Tashi Yangtse"},{"StateID":"5315","State":"Gasa"}],"C29":[{"StateID":"566","State":"Bolivia"},{"StateID":"1171","State":"Chuquisaca"},{"StateID":"1172","State":"Cochabamba"},{"StateID":"1173","State":"El Beni"},{"StateID":"1174","State":"La Paz"},{"StateID":"1175","State":"Oruro"},{"StateID":"1176","State":"Pando"},{"StateID":"1177","State":"Potosi"},{"StateID":"1178","State":"Santa Cruz"},{"StateID":"1179","State":"Tarija"}],"C30":[{"StateID":"567","State":"Bosnia and Herzegovina"},{"StateID":"5115","State":"Republika Srpska"},{"StateID":"5116","State":"Federation of Bosnia and Herzegovina"},{"StateID":"5313","State":"Brcko District"}],"C31":[{"StateID":"568","State":"Botswana"},{"StateID":"1108","State":"Central"},{"StateID":"1109","State":"Chobe"},{"StateID":"1110","State":"Ghanzi"},{"StateID":"1111","State":"Kgalagadi"},{"StateID":"1112","State":"Kgatleng"},{"StateID":"1113","State":"Kweneng"},{"StateID":"1114","State":"Ngamiland"},{"StateID":"1115","State":"NorthEast"},{"StateID":"1116","State":"SouthEast"},{"StateID":"1117","State":"Southern"}],"C32":[{"StateID":"569","State":"Bouvet Island"}],"C33":[{"StateID":"8","State":"Acre"},{"StateID":"10","State":"Amap\u00e1"},{"StateID":"11","State":"Bahia"},{"StateID":"12","State":"Goi\u00e1s"},{"StateID":"13","State":"Piau\u00ed"},{"StateID":"14","State":"Cear\u00e1"},{"StateID":"15","State":"Paran\u00e1"},{"StateID":"16","State":"Alagoas"},{"StateID":"17","State":"Para\u00edba"},{"StateID":"18","State":"Roraima"},{"StateID":"19","State":"Sergipe"},{"StateID":"20","State":"Amazonas"},{"StateID":"21","State":"Maranh\u00e3o"},{"StateID":"22","State":"Rond\u00f4nia"},{"StateID":"24","State":"S\u00e3o Paulo"},{"StateID":"25","State":"Tocantins"},{"StateID":"26","State":"Mato Grosso"},{"StateID":"27","State":"Minas Gerais"},{"StateID":"28","State":"Esp\u00edrito Santo"},{"StateID":"29","State":"Rio de Janeiro"},{"StateID":"30","State":"Santa Catarina"},{"StateID":"32","State":"Rio Grande do Sul"},{"StateID":"33","State":"Mato Grosso do Sul"},{"StateID":"34","State":"Rio Grande do Norte"},{"StateID":"570","State":"Brazil"},{"StateID":"1217","State":"Distrito Federal"},{"StateID":"1219","State":"Paro"},{"StateID":"1220","State":"Pernambuco"}],"C34":[{"StateID":"571","State":"British Indian Ocean Territory"}],"C35":[{"StateID":"572","State":"British Virgin Islands"}],"C36":[{"StateID":"573","State":"Brunei Darussalam"},{"StateID":"1248","State":"Belait"},{"StateID":"1249","State":"Brunei and Muara"},{"StateID":"1250","State":"Temburong"},{"StateID":"1251","State":"Tutong"}],"C37":[{"StateID":"574","State":"Bulgaria"},{"StateID":"1239","State":"Burgas"},{"StateID":"1240","State":"Sofiya-Grad"},{"StateID":"1241","State":"Khaskovo"},{"StateID":"1242","State":"Lovech"},{"StateID":"1243","State":"Montana"},{"StateID":"1244","State":"Plovdiv"},{"StateID":"1245","State":"Razgrad"},{"StateID":"1246","State":"Sofiya"},{"StateID":"1247","State":"Varna"},{"StateID":"5085","State":"Blagoevgrad"},{"StateID":"5086","State":"Dobrich"},{"StateID":"5087","State":"Gabrovo"},{"StateID":"5088","State":"Kurdzhali"},{"StateID":"5089","State":"Kyustendil"},{"StateID":"5090","State":"Pazardzhik"},{"StateID":"5091","State":"Pernik"},{"StateID":"5092","State":"Pleven"},{"StateID":"5093","State":"Ruse"},{"StateID":"5094","State":"Shumen"},{"StateID":"5095","State":"Silistra"},{"StateID":"5096","State":"Sliven"},{"StateID":"5097","State":"Smolyan"},{"StateID":"5098","State":"Stara Zagora"},{"StateID":"5099","State":"Turgovishte"},{"StateID":"5100","State":"Veliko Turnovo"},{"StateID":"5101","State":"Vidin"},{"StateID":"5102","State":"Vratsa"},{"StateID":"5103","State":"Yambol"}],"C38":[{"StateID":"575","State":"Burkina Faso"},{"StateID":"4458","State":"Bam"},{"StateID":"4459","State":"Bazega"},{"StateID":"4460","State":"Bougouriba"},{"StateID":"4461","State":"Boulgou"},{"StateID":"4462","State":"Boulkiemde"},{"StateID":"4463","State":"Ganzourgou"},{"StateID":"4464","State":"Gnagna"},{"StateID":"4465","State":"Gourma"},{"StateID":"4466","State":"Houe"},{"StateID":"4467","State":"Kadiogo"},{"StateID":"4468","State":"Kenedougou"},{"StateID":"4469","State":"Komoe"},{"StateID":"4470","State":"Kossi"},{"StateID":"4471","State":"Kouritenga"},{"StateID":"4472","State":"Mouhoun"},{"StateID":"4473","State":"Namentenga"},{"StateID":"4474","State":"Naouri"},{"StateID":"4475","State":"Oubritenga"},{"StateID":"4476","State":"Oudalan"},{"StateID":"4477","State":"Passore"},{"StateID":"4478","State":"Poni"},{"StateID":"4479","State":"Sanguie"},{"StateID":"4480","State":"Sanmatenga"},{"StateID":"4481","State":"Seno"},{"StateID":"4482","State":"Sissili"},{"StateID":"4483","State":"Soum"},{"StateID":"4484","State":"Sourou"},{"StateID":"4485","State":"Tapoa"},{"StateID":"4486","State":"Yatenga"},{"StateID":"4487","State":"Zoundweogo"},{"StateID":"5346","State":"Bal\u00e9"},{"StateID":"5347","State":"Banwa"},{"StateID":"5348","State":"Ioba"},{"StateID":"5349","State":"Komondjari"},{"StateID":"5350","State":"Kompienga"},{"StateID":"5351","State":"Koulp\u00e9logo"},{"StateID":"5352","State":"Kourw\u00e9ogo"},{"StateID":"5353","State":"L\u00e9raba"},{"StateID":"5354","State":"Loroum"},{"StateID":"5355","State":"Nayala"},{"StateID":"5356","State":"Noumbiel"},{"StateID":"5357","State":"Tui"},{"StateID":"5358","State":"Yagha"},{"StateID":"5359","State":"Ziro"},{"StateID":"5360","State":"Zondoma"}],"C39":[{"StateID":"576","State":"Burma"},{"StateID":"1180","State":"Rakhine State"},{"StateID":"1181","State":"Chin State"},{"StateID":"1182","State":"Ayeyarwady"},{"StateID":"1183","State":"Kachin State"},{"StateID":"1184","State":"Kayin State"},{"StateID":"1185","State":"Kayah State"},{"StateID":"1187","State":"Mandalay"},{"StateID":"1189","State":"Sagaing"},{"StateID":"1190","State":"Shan State"},{"StateID":"1191","State":"Tanintharyi"},{"StateID":"1192","State":"Mon State"},{"StateID":"1194","State":"Magway"},{"StateID":"1195","State":"Bago"},{"StateID":"1196","State":"Yangon"}],"C40":[{"StateID":"577","State":"Burundi"},{"StateID":"1252","State":"Bujumbura"},{"StateID":"1253","State":"Muramvya"},{"StateID":"1254","State":"Bubanza"},{"StateID":"1255","State":"Bururi"},{"StateID":"1256","State":"Cankuzo"},{"StateID":"1257","State":"Cibitoke"},{"StateID":"1258","State":"Gitega"},{"StateID":"1259","State":"Karuzi"},{"StateID":"1260","State":"Kayanza"},{"StateID":"1261","State":"Kirundo"},{"StateID":"1262","State":"Makamba"},{"StateID":"1263","State":"Muyinga"},{"StateID":"1264","State":"Ngozi"},{"StateID":"1265","State":"Rutana"},{"StateID":"1266","State":"Ruyigi"},{"StateID":"5269","State":"Mwaro"}],"C41":[{"StateID":"578","State":"Cambodia"},{"StateID":"1267","State":"Batdambang"},{"StateID":"1268","State":"Kampong Cham"},{"StateID":"1269","State":"Kampong Chhnang"},{"StateID":"1270","State":"Kampong Spoe"},{"StateID":"1271","State":"Kampong Thum"},{"StateID":"1272","State":"Kampot"},{"StateID":"1273","State":"Kandal"},{"StateID":"1274","State":"Kaoh Kong"},{"StateID":"1275","State":"Krachen"},{"StateID":"1276","State":"Mondol Kiri"},{"StateID":"1277","State":"Phnum Penh"},{"StateID":"1278","State":"Pouthisat"},{"StateID":"1279","State":"Preah Vihear"},{"StateID":"1280","State":"Prey Veng"},{"StateID":"1283","State":"Stoeng Treng"},{"StateID":"1284","State":"Svay Rieng"},{"StateID":"1285","State":"Takev"},{"StateID":"1286","State":"Rotanah Kiri"},{"StateID":"1287","State":"Siem Reab"},{"StateID":"1288","State":"Banteay Mean Cheay"},{"StateID":"1289","State":"Keb"},{"StateID":"1290","State":"Otdar Mean Cheay"},{"StateID":"1291","State":"Preah Seihanu"},{"StateID":"5058","State":"Pailin"}],"C42":[{"StateID":"579","State":"Cameroon"},{"StateID":"1385","State":"Est"},{"StateID":"1386","State":"Littoral"},{"StateID":"1387","State":"NordOuest"},{"StateID":"1388","State":"Ouest"},{"StateID":"1389","State":"SudOuest"},{"StateID":"1390","State":"Adamaoua"},{"StateID":"1391","State":"Centre"},{"StateID":"1392","State":"ExtremeNord"},{"StateID":"1393","State":"Nord"},{"StateID":"1394","State":"Sud"}],"C43":[{"StateID":"35","State":"Quebec"},{"StateID":"36","State":"Alberta"},{"StateID":"37","State":"Ontario"},{"StateID":"38","State":"Manitoba"},{"StateID":"39","State":"Nova Scotia"},{"StateID":"40","State":"Saskatchewan"},{"StateID":"41","State":"Newfoundland and Labrador"},{"StateID":"42","State":"New Brunswick"},{"StateID":"43","State":"British Columbia"},{"StateID":"45","State":"Prince Edward Island"},{"StateID":"46","State":"Northwest Territories"},{"StateID":"580","State":"Canada"},{"StateID":"815","State":"Yukon Territory"},{"StateID":"4996","State":"Nunavut"}],"C44":[{"StateID":"581","State":"Cape Verde"},{"StateID":"1471","State":"Boa Vista"},{"StateID":"1472","State":"Brava"},{"StateID":"1473","State":"Calheta de S\u00e3o Miguel"},{"StateID":"1474","State":"Maio"},{"StateID":"1475","State":"Paul"},{"StateID":"1476","State":"Praia"},{"StateID":"1477","State":"Ribeira Grande"},{"StateID":"1478","State":"Sal"},{"StateID":"1479","State":"Santa Catarina"},{"StateID":"1480","State":"Sao Nicolau"},{"StateID":"1481","State":"Sao Vicente"},{"StateID":"1482","State":"Tarrafal"},{"StateID":"5341","State":"Mosteiros"},{"StateID":"5342","State":"Porto Novo"},{"StateID":"5343","State":"Santa Cruz"},{"StateID":"5344","State":"S\u00e3o Domingos"},{"StateID":"5345","State":"S\u00e3o Filipe"}],"C45":[{"StateID":"582","State":"Cayman Islands"},{"StateID":"1377","State":"Creek"},{"StateID":"1378","State":"Eastern"},{"StateID":"1379","State":"Midland"},{"StateID":"1380","State":"South Town"},{"StateID":"1381","State":"Spot Bay"},{"StateID":"1382","State":"Stake Bay"},{"StateID":"1383","State":"West End"},{"StateID":"1384","State":"Western"}],"C46":[{"StateID":"583","State":"Central African Republic"},{"StateID":"1439","State":"Bamingui-Bangoran"},{"StateID":"1440","State":"Basse-Kotto"},{"StateID":"1441","State":"Haute-Kotto"},{"StateID":"1442","State":"Haute-Sangha"},{"StateID":"1443","State":"Haut-Mbomou"},{"StateID":"1444","State":"Kemo-Gribingui"},{"StateID":"1445","State":"Lobaye"},{"StateID":"1446","State":"Mbomou"},{"StateID":"1447","State":"Nana-Mambere"},{"StateID":"1448","State":"Ouaka"},{"StateID":"1449","State":"Ouham"},{"StateID":"1450","State":"Ouham-Pende"},{"StateID":"1451","State":"Vakaga"},{"StateID":"1452","State":"Gribingui"},{"StateID":"1453","State":"Sangha"},{"StateID":"1454","State":"Ombella-Mpoko"},{"StateID":"1455","State":"Bangui"}],"C47":[{"StateID":"584","State":"Chad"},{"StateID":"1292","State":"Batha"},{"StateID":"1293","State":"Biltine"},{"StateID":"1294","State":"Borkou-Ennedi-Tibesti"},{"StateID":"1295","State":"ChariBaguirmi"},{"StateID":"1296","State":"Guera"},{"StateID":"1297","State":"Kanem"},{"StateID":"1298","State":"Lac"},{"StateID":"1299","State":"Logone Occidental"},{"StateID":"1300","State":"Logone Oriental"},{"StateID":"1301","State":"Mayo-Kebbi"},{"StateID":"1302","State":"Moyen-Chari"},{"StateID":"1303","State":"Ouaddai"},{"StateID":"1304","State":"Salamat"},{"StateID":"1305","State":"Tandjile"}],"C48":[{"StateID":"585","State":"Chile"},{"StateID":"1364","State":"Valparaiso"},{"StateID":"1365","State":"Aisen del General Carlos Ibanez del Campo"},{"StateID":"1366","State":"Antofagasta"},{"StateID":"1367","State":"Araucania"},{"StateID":"1368","State":"Atacama"},{"StateID":"1369","State":"Bio-Bio"},{"StateID":"1370","State":"Coquimbo"},{"StateID":"1371","State":"Libertador General Bernardo O\'Higgins"},{"StateID":"1372","State":"Los Lagos"},{"StateID":"1373","State":"Magallanes y de la Antartica Chilena"},{"StateID":"1374","State":"Maule"},{"StateID":"1375","State":"Region Metropolitana"},{"StateID":"1376","State":"Tarapaca"}],"C49":[{"StateID":"586","State":"China"},{"StateID":"1333","State":"Anhui"},{"StateID":"1334","State":"Zhejiang"},{"StateID":"1335","State":"Jiangxi"},{"StateID":"1336","State":"Jiangsu"},{"StateID":"1337","State":"Jilin"},{"StateID":"1338","State":"Qinghai"},{"StateID":"1339","State":"Fujian"},{"StateID":"1340","State":"Heilongjiang"},{"StateID":"1341","State":"Henan"},{"StateID":"1342","State":"Hebei"},{"StateID":"1343","State":"Hunan"},{"StateID":"1344","State":"Hubei"},{"StateID":"1345","State":"Xinjiang"},{"StateID":"1346","State":"Xizang"},{"StateID":"1347","State":"Gansu"},{"StateID":"1348","State":"Guangxi"},{"StateID":"1349","State":"Guizhou"},{"StateID":"1350","State":"Liaoning"},{"StateID":"1351","State":"Nei Mongol"},{"StateID":"1352","State":"Ningxia"},{"StateID":"1353","State":"Beijing"},{"StateID":"1354","State":"Shanghai"},{"StateID":"1355","State":"Shanxi"},{"StateID":"1356","State":"Shandong"},{"StateID":"1357","State":"Shaanxi"},{"StateID":"1358","State":"Sichuan"},{"StateID":"1359","State":"Tianjin"},{"StateID":"1360","State":"Yunnan"},{"StateID":"1361","State":"Guangdong"},{"StateID":"1362","State":"Hainan"},{"StateID":"1363","State":"Chongqing"}],"C50":[{"StateID":"587","State":"Christmas Island"}],"C51":[{"StateID":"588","State":"Clipperton Island"}],"C52":[{"StateID":"589","State":"Cocos (Keeling) Islands"}],"C53":[{"StateID":"590","State":"Colombia"},{"StateID":"1398","State":"Amazonas"},{"StateID":"1399","State":"Antioquia"},{"StateID":"1400","State":"Arauca"},{"StateID":"1401","State":"Atlantico"},{"StateID":"1402","State":"Caqueta"},{"StateID":"1403","State":"Cauca"},{"StateID":"1404","State":"Cesar"},{"StateID":"1405","State":"Choco"},{"StateID":"1406","State":"Cordoba"},{"StateID":"1408","State":"Guaviare"},{"StateID":"1409","State":"Guainia"},{"StateID":"1410","State":"Huila"},{"StateID":"1411","State":"La Guajira"},{"StateID":"1412","State":"Meta"},{"StateID":"1413","State":"Narino"},{"StateID":"1414","State":"Norte de Santander"},{"StateID":"1415","State":"Putumayo"},{"StateID":"1416","State":"Quindio"},{"StateID":"1417","State":"Risaralda"},{"StateID":"1418","State":"San Andres y Providencia"},{"StateID":"1419","State":"Santander"},{"StateID":"1420","State":"Sucre"},{"StateID":"1421","State":"Tolima"},{"StateID":"1422","State":"Valle del Cauca"},{"StateID":"1423","State":"Vaupes"},{"StateID":"1424","State":"Vichada"},{"StateID":"1425","State":"Casanare"},{"StateID":"1426","State":"Cundinamarca"},{"StateID":"1427","State":"Distrito Capital"},{"StateID":"1428","State":"Bolivar"},{"StateID":"1429","State":"Boyaca"},{"StateID":"1430","State":"Caldas"},{"StateID":"1431","State":"Magdalena"}],"C54":[{"StateID":"591","State":"Comoros"},{"StateID":"1395","State":"Anjouan"},{"StateID":"1396","State":"Grande Comore"},{"StateID":"1397","State":"Moheli"}],"C55":[{"StateID":"592","State":"Democratic Republic of the Congo"},{"StateID":"1324","State":"Bandundu"},{"StateID":"1325","State":"Equateur"},{"StateID":"1326","State":"Kasai-Occidental"},{"StateID":"1327","State":"Kasai-Oriental"},{"StateID":"1328","State":"Katanga"},{"StateID":"1329","State":"Kinshasa"},{"StateID":"1331","State":"Bas-Congo"},{"StateID":"1332","State":"Orientale"},{"StateID":"5064","State":"Maniema"},{"StateID":"5065","State":"Nord-Kivu"},{"StateID":"5066","State":"Sud-Kivu"}],"C56":[{"StateID":"593","State":"Republic of the Congo"},{"StateID":"1314","State":"Bouenza"},{"StateID":"1315","State":"Cuvette"},{"StateID":"1316","State":"Kouilou"},{"StateID":"1317","State":"Lekoumou"},{"StateID":"1318","State":"Likouala"},{"StateID":"1319","State":"Niari"},{"StateID":"1320","State":"Plateaux"},{"StateID":"1321","State":"Sangha"},{"StateID":"1322","State":"Pool"},{"StateID":"1323","State":"Brazzaville"}],"C57":[{"StateID":"594","State":"Cook Islands"}],"C58":[{"StateID":"595","State":"Coral Sea Islands"}],"C59":[{"StateID":"596","State":"Costa Rica"},{"StateID":"1432","State":"Alajuela"},{"StateID":"1433","State":"Cartago"},{"StateID":"1434","State":"Guanacaste"},{"StateID":"1435","State":"Heredia"},{"StateID":"1436","State":"Limon"},{"StateID":"1437","State":"Puntarenas"},{"StateID":"1438","State":"San Jose"}],"C60":[{"StateID":"597","State":"Cote d\'Ivoire"},{"StateID":"2259","State":"Dabakala"},{"StateID":"2260","State":"Aboisso"},{"StateID":"2261","State":"Adzope"},{"StateID":"2262","State":"Agboville"},{"StateID":"2263","State":"Biankouma"},{"StateID":"2264","State":"Bouna"},{"StateID":"2265","State":"Boundiali"},{"StateID":"2266","State":"Danane"},{"StateID":"2267","State":"Divo"},{"StateID":"2268","State":"Ferkessedougou"},{"StateID":"2269","State":"Gagnoa"},{"StateID":"2270","State":"Katiola"},{"StateID":"2271","State":"Korhogo"},{"StateID":"2272","State":"Odienne"},{"StateID":"2273","State":"Seguela"},{"StateID":"2274","State":"Touba"},{"StateID":"2275","State":"Bongouanou"},{"StateID":"2276","State":"Issia"},{"StateID":"2277","State":"Lakota"},{"StateID":"2278","State":"Mankono"},{"StateID":"2279","State":"Oume"},{"StateID":"2280","State":"Soubre"},{"StateID":"2281","State":"Tingrela"},{"StateID":"2282","State":"Zuenoula"},{"StateID":"2283","State":"Abidjan"},{"StateID":"2284","State":"Bangolo"},{"StateID":"2285","State":"Beoumi"},{"StateID":"2286","State":"Bondoukou"},{"StateID":"2287","State":"Bouafle"},{"StateID":"2288","State":"Bouake"},{"StateID":"2289","State":"Daloa"},{"StateID":"2290","State":"Daoukro"},{"StateID":"2291","State":"Dimbokro"},{"StateID":"2292","State":"Duekoue"},{"StateID":"2293","State":"Grand-Lahou"},{"StateID":"2294","State":"Guiglo"},{"StateID":"2295","State":"Man"},{"StateID":"2296","State":"Mbahiakro"},{"StateID":"2297","State":"Sakassou"},{"StateID":"2298","State":"San Pedro"},{"StateID":"2299","State":"Sassandra"},{"StateID":"2300","State":"Sinfra"},{"StateID":"2301","State":"Tabou"},{"StateID":"2302","State":"Tanda"},{"StateID":"2303","State":"Tiassale"},{"StateID":"2304","State":"Toumodi"},{"StateID":"2305","State":"Vavoua"},{"StateID":"2306","State":"Yamoussoukro"},{"StateID":"2307","State":"Agnilbilekrou"},{"StateID":"5272","State":"Adiake"},{"StateID":"5273","State":"Alepe"},{"StateID":"5274","State":"Bocanda"},{"StateID":"5275","State":"Dabou"},{"StateID":"5276","State":"Grand-Bassam"},{"StateID":"5277","State":"Jacqueville"},{"StateID":"5278","State":"Toulepleu"}],"C61":[{"StateID":"598","State":"Croatia"},{"StateID":"5025","State":"Bjelovarsko-Bilogorska"},{"StateID":"5026","State":"Brodsko-Posavka"},{"StateID":"5027","State":"Dubrovacko-Neretvanska"},{"StateID":"5028","State":"Istarska"},{"StateID":"5029","State":"Karlovacka"},{"StateID":"5030","State":"Koprivnicko-Krizevacka"},{"StateID":"5031","State":"Krapinsko-Zagorska"},{"StateID":"5032","State":"Licko-Senjska"},{"StateID":"5033","State":"Medimurska"},{"StateID":"5034","State":"Osjecko-Baranjska"},{"StateID":"5035","State":"Pozesko-Slavonska"},{"StateID":"5036","State":"Primorsko-Goranska"},{"StateID":"5037","State":"Sibensko-Kninska"},{"StateID":"5038","State":"Sisacko-Moslavacka"},{"StateID":"5039","State":"Splitsko-Dalmatinska"},{"StateID":"5040","State":"Varazdinska"},{"StateID":"5041","State":"Viroviticko-Podravska"},{"StateID":"5042","State":"Vukovarsko-Srijemska"},{"StateID":"5043","State":"Zadarska"},{"StateID":"5044","State":"Zagrebacka"},{"StateID":"5045","State":"Grad Zagreb"}],"C62":[{"StateID":"599","State":"Cuba"},{"StateID":"1456","State":"Pinar del Rio"},{"StateID":"1457","State":"Ciudad de La Habana"},{"StateID":"1458","State":"Matanzas"},{"StateID":"1459","State":"Isla de la Juventud"},{"StateID":"1460","State":"Camaguey"},{"StateID":"1461","State":"Ciego de Avila"},{"StateID":"1462","State":"Cienfuegos"},{"StateID":"1463","State":"Granma"},{"StateID":"1464","State":"Guantanamo"},{"StateID":"1465","State":"La Habana"},{"StateID":"1466","State":"Holguin"},{"StateID":"1467","State":"Las Tunas"},{"StateID":"1468","State":"Sancti Spiritus"},{"StateID":"1469","State":"Santiago de Cuba"},{"StateID":"1470","State":"Villa Clara"}],"C63":[{"StateID":"600","State":"Cyprus"},{"StateID":"1483","State":"Famagusta"},{"StateID":"1484","State":"Kyrenia"},{"StateID":"1485","State":"Larnaca"},{"StateID":"1486","State":"Nicosia"},{"StateID":"1487","State":"Limassol"},{"StateID":"1488","State":"Paphos"}],"C64":[{"StateID":"601","State":"Czech Republic"},{"StateID":"1746","State":"Hlavni Mesto Praha"},{"StateID":"5122","State":"Jihomoravsky Kraj"},{"StateID":"5123","State":"Jihocesky Kraj"},{"StateID":"5124","State":"Vysocina"},{"StateID":"5125","State":"Karlovarsky Kraj"},{"StateID":"5126","State":"Kralovehradecky Kraj"},{"StateID":"5127","State":"Liberecky Kraj"},{"StateID":"5128","State":"Olomoucky Kraj"},{"StateID":"5129","State":"Moravskoslezsky Kraj"},{"StateID":"5130","State":"Pardubicky Kraj"},{"StateID":"5131","State":"Plzensky Kraj"},{"StateID":"5132","State":"Stredocesky Kraj"},{"StateID":"5133","State":"Ustecky Kraj"},{"StateID":"5134","State":"Zlinsky Kraj"}],"C65":[{"StateID":"602","State":"Denmark"},{"StateID":"1489","State":"Arhus"},{"StateID":"1490","State":"Bornholm"},{"StateID":"1491","State":"Frederiksborg"},{"StateID":"1492","State":"Fyn"},{"StateID":"1493","State":"Kobenhavn"},{"StateID":"1494","State":"Nordjylland"},{"StateID":"1495","State":"Ribe"},{"StateID":"1496","State":"Ringkobing"},{"StateID":"1497","State":"Roskilde"},{"StateID":"1498","State":"Sonderjylland"},{"StateID":"1499","State":"Storstrom"},{"StateID":"1500","State":"Vejle"},{"StateID":"1501","State":"Vestsjalland"},{"StateID":"1502","State":"Viborg"},{"StateID":"1503","State":"Fredericksberg"}],"C66":[{"StateID":"1504","State":"\'Ali Sabih"},{"StateID":"1505","State":"Dikhil"},{"StateID":"1506","State":"Djibouti"},{"StateID":"1507","State":"Obock"},{"StateID":"1508","State":"Tadjoura"}],"C67":[{"StateID":"604","State":"Dominica"},{"StateID":"1509","State":"Saint Andrew"},{"StateID":"1510","State":"Saint David"},{"StateID":"1511","State":"Saint George"},{"StateID":"1512","State":"Saint John"},{"StateID":"1513","State":"Saint Joseph"},{"StateID":"1514","State":"Saint Luke"},{"StateID":"1515","State":"Saint Mark"},{"StateID":"1516","State":"Saint Patrick"},{"StateID":"1517","State":"Saint Paul"},{"StateID":"1518","State":"Saint Peter"}],"C68":[{"StateID":"605","State":"Dominican Republic"},{"StateID":"1519","State":"Azua"},{"StateID":"1520","State":"Baoruco"},{"StateID":"1521","State":"Barahona"},{"StateID":"1522","State":"Dajabon"},{"StateID":"1523","State":"Distrito Nacional"},{"StateID":"1524","State":"Duarte"},{"StateID":"1525","State":"Espaillat"},{"StateID":"1526","State":"Independencia"},{"StateID":"1527","State":"La Altagracia"},{"StateID":"1528","State":"Elias Pina"},{"StateID":"1529","State":"La Romana"},{"StateID":"1530","State":"Maria Trinidad Sanchez"},{"StateID":"1531","State":"Monte Cristi"},{"StateID":"1532","State":"Pedernales"},{"StateID":"1533","State":"Peravia"},{"StateID":"1534","State":"Puerto Plata"},{"StateID":"1535","State":"Salcedo"},{"StateID":"1536","State":"Samana"},{"StateID":"1537","State":"Sanchez Ramirez"},{"StateID":"1538","State":"San Juan"},{"StateID":"1539","State":"San Pedro de Macoris"},{"StateID":"1540","State":"Santiago"},{"StateID":"1541","State":"Santiago Rodriguez"},{"StateID":"1542","State":"Valverde"},{"StateID":"1543","State":"El Seibo"},{"StateID":"1544","State":"Hato Mayor"},{"StateID":"1545","State":"La Vega"},{"StateID":"1546","State":"Monsenor Nouel"},{"StateID":"1547","State":"Monte Plata"},{"StateID":"1548","State":"San Cristobal"}],"C69":[{"StateID":"606","State":"East Timor"}],"C70":[{"StateID":"607","State":"Ecuador"},{"StateID":"1549","State":"Galapagos"},{"StateID":"1550","State":"Azuay"},{"StateID":"1551","State":"Bolivar"},{"StateID":"1552","State":"Canar"},{"StateID":"1553","State":"Carchi"},{"StateID":"1554","State":"Chimborazo"},{"StateID":"1555","State":"Cotopaxi"},{"StateID":"1556","State":"El Oro"},{"StateID":"1557","State":"Esmeraldas"},{"StateID":"1558","State":"Guayas"},{"StateID":"1559","State":"Imbabura"},{"StateID":"1560","State":"Loja"},{"StateID":"1561","State":"Los Rios"},{"StateID":"1562","State":"Manabi"},{"StateID":"1563","State":"Morona-Santiago"},{"StateID":"1564","State":"Pastaza"},{"StateID":"1565","State":"Pichincha"},{"StateID":"1566","State":"Tungurahua"},{"StateID":"1567","State":"Zamora-Chinchipe"},{"StateID":"1568","State":"Napo"},{"StateID":"1569","State":"Sucumbios"},{"StateID":"5059","State":"Orellana"}],"C71":[{"StateID":"608","State":"Egypt"},{"StateID":"1570","State":"Ad Daqahliyah"},{"StateID":"1571","State":"Al Bahr al Ahmar"},{"StateID":"1572","State":"Al Buhayrah"},{"StateID":"1573","State":"Al Fayyum"},{"StateID":"1574","State":"Al Gharbiyah"},{"StateID":"1575","State":"Al Iskandariyah"},{"StateID":"1576","State":"Al Isma\'iliyah"},{"StateID":"1577","State":"Al Jizah"},{"StateID":"1578","State":"Al Minufiyah"},{"StateID":"1579","State":"Al Minya"},{"StateID":"1580","State":"Al Qahirah"},{"StateID":"1581","State":"Al Qaly\u00afbiyah"},{"StateID":"1582","State":"Al Wadi al Jadid"},{"StateID":"1583","State":"Ash Sharqiyah"},{"StateID":"1584","State":"As Suways"},{"StateID":"1585","State":"Aswan"},{"StateID":"1586","State":"Asyut"},{"StateID":"1587","State":"Bani Suwayf"},{"StateID":"1588","State":"Bur Sa\'id"},{"StateID":"1589","State":"Dumyat"},{"StateID":"1590","State":"Kafr ash Shaykh"},{"StateID":"1591","State":"Matruh"},{"StateID":"1592","State":"Qina"},{"StateID":"1593","State":"Suhaj"},{"StateID":"1594","State":"Janub Sina\'"},{"StateID":"1595","State":"Shamal Sina\'"}],"C72":[{"StateID":"609","State":"El Salvador"},{"StateID":"1644","State":"Ahuachapan"},{"StateID":"1645","State":"Cabanas"},{"StateID":"1646","State":"Chalatenango"},{"StateID":"1647","State":"Cuscatlan"},{"StateID":"1648","State":"La Libertad"},{"StateID":"1649","State":"La Paz"},{"StateID":"1650","State":"La Union"},{"StateID":"1651","State":"Morazan"},{"StateID":"1652","State":"San Miguel"},{"StateID":"1653","State":"San Salvador"},{"StateID":"1654","State":"Santa Ana"},{"StateID":"1655","State":"San Vicente"},{"StateID":"1656","State":"Sonsonate"},{"StateID":"1657","State":"Usulutan"}],"C73":[{"StateID":"610","State":"Equatorial Guinea"},{"StateID":"1622","State":"Annobon"},{"StateID":"1623","State":"Bioko Norte"},{"StateID":"1624","State":"Bioko Sur"},{"StateID":"1625","State":"Centro Sur"},{"StateID":"1626","State":"Kie-Ntem"},{"StateID":"1627","State":"Litoral"},{"StateID":"1628","State":"Wele-Nzas"}],"C74":[{"StateID":"611","State":"Eritrea"},{"StateID":"5335","State":"Anseba"},{"StateID":"5336","State":"Semenawi Keyih Bahri"},{"StateID":"5337","State":"Maekel"},{"StateID":"5338","State":"Gash Barka"},{"StateID":"5339","State":"Debubawi Keyih Bahri"},{"StateID":"5340","State":"Debub"}],"C75":[{"StateID":"612","State":"Estonia"},{"StateID":"1629","State":"Harjumaa"},{"StateID":"1630","State":"Hiiumaa"},{"StateID":"1631","State":"Ida-Virumaa"},{"StateID":"1632","State":"Jarvamaa"},{"StateID":"1633","State":"Jogevamaa"},{"StateID":"1634","State":"Laanemaa"},{"StateID":"1635","State":"Laane-Virumaa"},{"StateID":"1636","State":"Parnumaa"},{"StateID":"1637","State":"Polvamaa"},{"StateID":"1638","State":"Raplamaa"},{"StateID":"1639","State":"Saaremaa"},{"StateID":"1640","State":"Tartumaa"},{"StateID":"1641","State":"Valgamaa"},{"StateID":"1642","State":"Viljandimaa"},{"StateID":"1643","State":"Vorumaa"}],"C76":[{"StateID":"613","State":"Ethiopia"},{"StateID":"1687","State":"Harari People"},{"StateID":"1688","State":"Gambela Peoples"},{"StateID":"1690","State":"Benshangul-Gumaz"},{"StateID":"1691","State":"Tigray"},{"StateID":"1692","State":"Amhara"},{"StateID":"1693","State":"Afar"},{"StateID":"1694","State":"Oromia"},{"StateID":"1695","State":"Somali"},{"StateID":"1696","State":"Addis Ababa"},{"StateID":"1697","State":"Southern Nations"}],"C77":[{"StateID":"614","State":"Europa Island"}],"C78":[{"StateID":"615","State":"Falkland Islands (Islas Malvinas)"}],"C79":[{"StateID":"616","State":"Faroe Islands"}],"C80":[{"StateID":"617","State":"Fiji"},{"StateID":"1784","State":"Central"},{"StateID":"1785","State":"Eastern"},{"StateID":"1786","State":"Northern"},{"StateID":"1787","State":"Rotuma"},{"StateID":"1788","State":"Western"}],"C81":[{"StateID":"618","State":"Finland"},{"StateID":"1772","State":"Ahvenanmaa"},{"StateID":"1777","State":"Lappi"},{"StateID":"1779","State":"Oulu Laani"},{"StateID":"4879","State":"Etela-Suomen Laani"},{"StateID":"5022","State":"Ita-Suomen Laani"},{"StateID":"5023","State":"Lansi-Suomen Laani"}],"C82":[{"StateID":"619","State":"France"},{"StateID":"1793","State":"Aquitaine"},{"StateID":"1794","State":"Auvergne"},{"StateID":"1795","State":"Basse-Normandie"},{"StateID":"1796","State":"Bourgogne"},{"StateID":"1797","State":"Bretagne"},{"StateID":"1798","State":"Centre"},{"StateID":"1799","State":"Champagne-Ardenne"},{"StateID":"1800","State":"Corse"},{"StateID":"1801","State":"Franche-Comte"},{"StateID":"1802","State":"Haute-Normandie"},{"StateID":"1803","State":"Ile-De-France"},{"StateID":"1804","State":"Languedoc-Roussillon"},{"StateID":"1805","State":"Limousin"},{"StateID":"1806","State":"Lorraine"},{"StateID":"1807","State":"Midi-Pyrenees"},{"StateID":"1808","State":"Nord-Pas-de-Calais"},{"StateID":"1809","State":"Pays de la Loire"},{"StateID":"1810","State":"Picardie"},{"StateID":"1811","State":"Poitou-Charentes"},{"StateID":"1812","State":"Provence-Alpes-Cote d\'Azur"},{"StateID":"1813","State":"Rhone-Alpes"},{"StateID":"1814","State":"Alsace"}],"C83":[{"StateID":"620","State":"Metropolitan France"}],"C84":[{"StateID":"621","State":"French Guiana"},{"StateID":"5382","State":"Saint-Laurent-du-Maroni"},{"StateID":"5383","State":"Cayenne"}],"C85":[{"StateID":"622","State":"French Polynesia"}],"C87":[{"StateID":"624","State":"Gabon"},{"StateID":"1821","State":"Estuaire"},{"StateID":"1822","State":"Haut-Ogooue"},{"StateID":"1823","State":"Moyen-Ogooue"},{"StateID":"1824","State":"Ngounie"},{"StateID":"1825","State":"Nyanga"},{"StateID":"1826","State":"Ogooue-Ivindo"},{"StateID":"1827","State":"Ogooue-Lolo"},{"StateID":"1828","State":"Ogooue-Maritime"},{"StateID":"1829","State":"Woleu-Ntem"}],"C88":[{"StateID":"625","State":"The Gambia"},{"StateID":"1815","State":"Banjul"},{"StateID":"1816","State":"Lower River"},{"StateID":"1817","State":"MacCarthy Island"},{"StateID":"1818","State":"Upper River"},{"StateID":"1819","State":"Western"},{"StateID":"1820","State":"North Bank"}],"C89":[{"StateID":"626","State":"Gaza Strip"}],"C90":[{"StateID":"627","State":"Georgia"},{"StateID":"1831","State":"Abkhazia"},{"StateID":"1833","State":"Ajaria"},{"StateID":"1879","State":"T\'bilisi"},{"StateID":"5322","State":"Guria"},{"StateID":"5323","State":"Imereti"},{"StateID":"5324","State":"Kakheti"},{"StateID":"5325","State":"Kvemo Kartli"},{"StateID":"5327","State":"Mtskheta-Mtianeti"},{"StateID":"5328","State":"Racha-Lochkhumi-Kvemo Svaneti"},{"StateID":"5329","State":"Samegrelo-Zemo Svateni"},{"StateID":"5330","State":"Samtskhe-Javakheti"},{"StateID":"5331","State":"Shida Kartli"}],"C91":[{"StateID":"628","State":"Germany"},{"StateID":"1912","State":"Baden-Wurttemberg"},{"StateID":"1913","State":"Bayern"},{"StateID":"1914","State":"Bremen"},{"StateID":"1915","State":"Hamburg"},{"StateID":"1916","State":"Hessen"},{"StateID":"1917","State":"Niedersachsen"},{"StateID":"1918","State":"Nordrhein-Westfalen"},{"StateID":"1919","State":"Rheinland-Pfalz"},{"StateID":"1920","State":"Saarland"},{"StateID":"1921","State":"Schleswig-Holstein"},{"StateID":"1922","State":"Brandenburg"},{"StateID":"1923","State":"Mecklenburg-Vorpommern"},{"StateID":"1924","State":"Sachsen"},{"StateID":"1925","State":"Sachsen-Anhalt"},{"StateID":"1926","State":"Thuringen"},{"StateID":"1927","State":"Berlin"}],"C92":[{"StateID":"629","State":"Ghana"},{"StateID":"1893","State":"Greater Accra"},{"StateID":"1894","State":"Ashanti"},{"StateID":"1895","State":"Brong-Ahafo"},{"StateID":"1896","State":"Central"},{"StateID":"1897","State":"Eastern"},{"StateID":"1898","State":"Northern"},{"StateID":"1899","State":"Volta"},{"StateID":"1900","State":"Western"},{"StateID":"1901","State":"Upper East"},{"StateID":"1902","State":"Upper West"}],"C93":[{"StateID":"630","State":"Gibraltar"}],"C94":[{"StateID":"631","State":"Glorioso Islands"}],"C95":[{"StateID":"632","State":"Greece"},{"StateID":"1928","State":"Evros"},{"StateID":"1929","State":"Rodhopi"},{"StateID":"1930","State":"Xanthi"},{"StateID":"1931","State":"Drama"},{"StateID":"1932","State":"Serrai"},{"StateID":"1933","State":"Kilkis"},{"StateID":"1934","State":"Pella"},{"StateID":"1935","State":"Florina"},{"StateID":"1936","State":"Kastoria"},{"StateID":"1937","State":"Grevena"},{"StateID":"1938","State":"Kozani"},{"StateID":"1939","State":"Imathia"},{"StateID":"1940","State":"Thessaloniki"},{"StateID":"1941","State":"Kavala"},{"StateID":"1942","State":"Khalkidhiki"},{"StateID":"1943","State":"Pieria"},{"StateID":"1944","State":"Ioannina"},{"StateID":"1945","State":"Thesprotia"},{"StateID":"1946","State":"Preveza"},{"StateID":"1947","State":"Arta"},{"StateID":"1948","State":"Larisa"},{"StateID":"1949","State":"Trikala"},{"StateID":"1950","State":"Kardhitsa"},{"StateID":"1951","State":"Magnisia"},{"StateID":"1952","State":"Kerkira"},{"StateID":"1953","State":"Levkas"},{"StateID":"1954","State":"Kefallinia"},{"StateID":"1955","State":"Zakinthos"},{"StateID":"1956","State":"Fthiotis"},{"StateID":"1957","State":"Evritania"},{"StateID":"1958","State":"Aitolia kai Akarnania"},{"StateID":"1959","State":"Fokis"},{"StateID":"1960","State":"Voiotia"},{"StateID":"1961","State":"Evvoia"},{"StateID":"1962","State":"Attiki"},{"StateID":"1963","State":"Argolis"},{"StateID":"1964","State":"Korinthia"},{"StateID":"1965","State":"Akhaia"},{"StateID":"1966","State":"Ilia"},{"StateID":"1967","State":"Messinia"},{"StateID":"1968","State":"Arkadhia"},{"StateID":"1969","State":"Lakonia"},{"StateID":"1970","State":"Khania"},{"StateID":"1971","State":"Rethimni"},{"StateID":"1972","State":"Iraklion (Crete)"},{"StateID":"1973","State":"Lasithi"},{"StateID":"1974","State":"Dhodhekanisos"},{"StateID":"1975","State":"Samos"},{"StateID":"1976","State":"Kikladhes"},{"StateID":"1977","State":"Khios"},{"StateID":"1978","State":"Lesvos"}],"C96":[{"StateID":"633","State":"Greenland"},{"StateID":"1909","State":"Nordgronland"},{"StateID":"1910","State":"Ostgronland"},{"StateID":"1911","State":"Vestgronland"}],"C97":[{"StateID":"634","State":"Grenada"},{"StateID":"1903","State":"Saint Andrew"},{"StateID":"1904","State":"Saint David"},{"StateID":"1905","State":"Saint George"},{"StateID":"1906","State":"Saint John"},{"StateID":"1907","State":"Saint Mark"},{"StateID":"1908","State":"Saint Patrick"},{"StateID":"5361","State":"Carriacou"}],"C98":[{"StateID":"635","State":"Guadeloupe"}],"C99":[{"StateID":"636","State":"Guam"}],"C100":[{"StateID":"1979","State":"Alta Verapaz"},{"StateID":"1980","State":"Baja Verapaz"},{"StateID":"1981","State":"Chimaltenango"},{"StateID":"1982","State":"Chiquimula"},{"StateID":"1983","State":"El Progreso"},{"StateID":"1984","State":"Escuintla"},{"StateID":"1985","State":"Guatemala"},{"StateID":"1986","State":"Huehuetenango"},{"StateID":"1987","State":"Izabal"},{"StateID":"1988","State":"Jalapa"},{"StateID":"1989","State":"Jutiapa"},{"StateID":"1990","State":"Peten"},{"StateID":"1991","State":"Quetzaltenango"},{"StateID":"1992","State":"Quiche"},{"StateID":"1993","State":"Retalhuleu"},{"StateID":"1994","State":"Sacatepequez"},{"StateID":"1995","State":"San Marcos"},{"StateID":"1996","State":"Santa Rosa"},{"StateID":"1997","State":"Solola"},{"StateID":"1998","State":"Suchitepequez"},{"StateID":"1999","State":"Totonicapan"},{"StateID":"2000","State":"Zacapa"}],"C101":[{"StateID":"638","State":"Guernsey"}],"C102":[{"StateID":"639","State":"Guinea"},{"StateID":"2001","State":"Beyla"},{"StateID":"2002","State":"Boffa"},{"StateID":"2003","State":"Boke"},{"StateID":"2004","State":"Conakry"},{"StateID":"2005","State":"Dabola"},{"StateID":"2006","State":"Dalaba"},{"StateID":"2007","State":"Dinguiraye"},{"StateID":"2008","State":"Dubreka"},{"StateID":"2009","State":"Faranah"},{"StateID":"2010","State":"Forecariah"},{"StateID":"2011","State":"Fria"},{"StateID":"2012","State":"Gaoual"},{"StateID":"2013","State":"Gueckedou"},{"StateID":"2014","State":"Kankan"},{"StateID":"2015","State":"Kerouane"},{"StateID":"2016","State":"Kindia"},{"StateID":"2017","State":"Kissidougou"},{"StateID":"2018","State":"Koundara"},{"StateID":"2019","State":"Kouroussa"},{"StateID":"2020","State":"Labe"},{"StateID":"2021","State":"Macenta"},{"StateID":"2022","State":"Mali"},{"StateID":"2023","State":"Mamou"},{"StateID":"2024","State":"Nzerekore"},{"StateID":"2025","State":"Pita"},{"StateID":"2026","State":"Siguiri"},{"StateID":"2027","State":"Telimele"},{"StateID":"2028","State":"Tougue"},{"StateID":"2029","State":"Yomou"},{"StateID":"5279","State":"Mandiana"},{"StateID":"5280","State":"Lola"},{"StateID":"5281","State":"Lelouma"},{"StateID":"5282","State":"Koubia"},{"StateID":"5283","State":"Coyah"}],"C103":[{"StateID":"640","State":"Guinea-Bissau"},{"StateID":"3340","State":"Bafata"},{"StateID":"3341","State":"Quinara"},{"StateID":"3342","State":"Oio"},{"StateID":"3343","State":"Bolama"},{"StateID":"3344","State":"Cacheu"},{"StateID":"3345","State":"Tombali"},{"StateID":"3346","State":"Gabu"},{"StateID":"3347","State":"Bissau"},{"StateID":"3348","State":"Biombo"}],"C104":[{"StateID":"641","State":"Guyana"},{"StateID":"2030","State":"Barima-Waini"},{"StateID":"2031","State":"Cuyuni-Mazaruni"},{"StateID":"2032","State":"Demerara-Mahaica"},{"StateID":"2033","State":"East Berbice-Corentyne"},{"StateID":"2034","State":"Essequibo Islands-West Demerara"},{"StateID":"2035","State":"Mahaica-Berbice"},{"StateID":"2036","State":"Pomeroon-Supenaam"},{"StateID":"2037","State":"Potaro-Siparuni"},{"StateID":"2038","State":"Upper Demerara-Berbice"},{"StateID":"2039","State":"Upper Takutu-Upper Essequibo"}],"C105":[{"StateID":"642","State":"Haiti"},{"StateID":"2040","State":"Nord-Ouest"},{"StateID":"2041","State":"Artibonite"},{"StateID":"2042","State":"Centre"},{"StateID":"2043","State":"Grand\'Anse"},{"StateID":"2044","State":"Nord"},{"StateID":"2045","State":"Nord-Est"},{"StateID":"2046","State":"Ouest"},{"StateID":"2047","State":"Sud"},{"StateID":"2048","State":"Sud-Est"}],"C106":[{"StateID":"643","State":"Heard Island and McDonald Islands"}],"C107":[{"StateID":"644","State":"Holy See (Vatican City)"}],"C108":[{"StateID":"645","State":"Honduras"},{"StateID":"2049","State":"Atlantida"},{"StateID":"2050","State":"Choluteca"},{"StateID":"2051","State":"Colon"},{"StateID":"2052","State":"Comayagua"},{"StateID":"2053","State":"Copan"},{"StateID":"2054","State":"Cortes"},{"StateID":"2055","State":"El Paraiso"},{"StateID":"2056","State":"Francisco Morazan"},{"StateID":"2057","State":"Gracias a Dios"},{"StateID":"2058","State":"Intibuca"},{"StateID":"2059","State":"Islas de la Bahia"},{"StateID":"2060","State":"La Paz"},{"StateID":"2061","State":"Lempira"},{"StateID":"2062","State":"Ocotepeque"},{"StateID":"2063","State":"Olancho"},{"StateID":"2064","State":"Santa Barbara"},{"StateID":"2065","State":"Valle"},{"StateID":"2066","State":"Yoro"}],"C109":[{"StateID":"646","State":"Hong Kong (SAR)"}],"C110":[{"StateID":"647","State":"Howland Island"}],"C111":[{"StateID":"648","State":"Hungary"},{"StateID":"2067","State":"Bacs-Kiskun"},{"StateID":"2068","State":"Baranya"},{"StateID":"2069","State":"Bekes"},{"StateID":"2070","State":"Borsod-Abauj-Zemplen"},{"StateID":"2071","State":"Budapest"},{"StateID":"2072","State":"Csongrad"},{"StateID":"2073","State":"Debrecen"},{"StateID":"2074","State":"Fejer"},{"StateID":"2075","State":"Gyor-Moson-Sopron"},{"StateID":"2076","State":"Hajdu-Bihar"},{"StateID":"2077","State":"Heves"},{"StateID":"2078","State":"Komarom-Esztergom"},{"StateID":"2079","State":"Miskolc"},{"StateID":"2080","State":"Nograd"},{"StateID":"2081","State":"Pees"},{"StateID":"2082","State":"Pest"},{"StateID":"2083","State":"Somogy"},{"StateID":"2084","State":"Szabolcs-Szatmar-Bereg"},{"StateID":"2085","State":"Szeged"},{"StateID":"2086","State":"Jasz-Nagykun-Szolnok"},{"StateID":"2087","State":"Tolna"},{"StateID":"2088","State":"Vas"},{"StateID":"2089","State":"Veszprem"},{"StateID":"2090","State":"Zala"},{"StateID":"2091","State":"Gyor"},{"StateID":"2092","State":"Bekescsaba"},{"StateID":"2093","State":"Dunaujvaros"},{"StateID":"2094","State":"Eger"},{"StateID":"2095","State":"Hodmezovasarhely"},{"StateID":"2096","State":"Kaposvar"},{"StateID":"2097","State":"Kecskemet"},{"StateID":"2098","State":"Nagykanizsa"},{"StateID":"2099","State":"Nyiregyhaza"},{"StateID":"2100","State":"Sopron"},{"StateID":"2101","State":"Szekesfehervar"},{"StateID":"2102","State":"Szolnok"},{"StateID":"2103","State":"Szombathely"},{"StateID":"2104","State":"Tatabanya"},{"StateID":"2105","State":"Zalaegerszeg"}],"C112":[{"StateID":"649","State":"Iceland"},{"StateID":"2106","State":"Akranes"},{"StateID":"2107","State":"Akureyri"},{"StateID":"2108","State":"Arnessysla"},{"StateID":"2109","State":"Austur-Bardastrandarsysla"},{"StateID":"2110","State":"Austur-Hunavatnssysla"},{"StateID":"2111","State":"Austur-Skaftafellssysla"},{"StateID":"2112","State":"Borgarfjardarsysla"},{"StateID":"2113","State":"Dalasysla"},{"StateID":"2114","State":"Eyjafjardarsysla"},{"StateID":"2115","State":"Gullbringusysla"},{"StateID":"2116","State":"Hafnarfjordur"},{"StateID":"2117","State":"Husavik"},{"StateID":"2118","State":"Isafjordur"},{"StateID":"2119","State":"Keflavik"},{"StateID":"2120","State":"Kjosarsysla"},{"StateID":"2121","State":"Kopavogur"},{"StateID":"2122","State":"Myrasysla"},{"StateID":"2123","State":"Neskaupstadur"},{"StateID":"2124","State":"Nordur-Isafjardarsysla"},{"StateID":"2125","State":"Nordur-Mulasysla"},{"StateID":"2126","State":"Nordur-Tingeyjarsysla"},{"StateID":"2127","State":"Olafsfjordur"},{"StateID":"2128","State":"Rang\u00b7rvallasysla"},{"StateID":"2129","State":"Reykjavik"},{"StateID":"2130","State":"Saudarkrokur"},{"StateID":"2131","State":"Seydisfjordur"},{"StateID":"2132","State":"Siglufjordur"},{"StateID":"2133","State":"Skagafjardarsysla"},{"StateID":"2134","State":"Snafellsnes-og Hnappadalssysla"},{"StateID":"2135","State":"Strandasysla"},{"StateID":"2136","State":"Sudur-Mulasysla"},{"StateID":"2137","State":"Sudur-Tingeyjarsysla"},{"StateID":"2138","State":"Vestmannaeyjar"},{"StateID":"2139","State":"Vestur-Bardastrandarsysla"},{"StateID":"2140","State":"Vestur-Hunavatnssysla"},{"StateID":"2141","State":"Vestur-Isafjardarsysla"},{"StateID":"2142","State":"Vestur-Skaftafellssysla"}],"C113":[{"StateID":"650","State":"India"},{"StateID":"2168","State":"Andaman and Nicobar Islands"},{"StateID":"2169","State":"Andhra Pradesh"},{"StateID":"2170","State":"Assam"},{"StateID":"2171","State":"Bihar"},{"StateID":"2172","State":"Chandigarh"},{"StateID":"2173","State":"Dadra and Nagar Haveli"},{"StateID":"2174","State":"Delhi"},{"StateID":"2175","State":"Gujarat"},{"StateID":"2176","State":"Haryana"},{"StateID":"2177","State":"Himachal Pradesh"},{"StateID":"2178","State":"Jammu and Kashmir"},{"StateID":"2179","State":"Kerala"},{"StateID":"2180","State":"Lakshadweep"},{"StateID":"2181","State":"Madhya Pradesh"},{"StateID":"2182","State":"Maharashtra"},{"StateID":"2183","State":"Manipur"},{"StateID":"2184","State":"Meghalaya"},{"StateID":"2185","State":"Karnataka"},{"StateID":"2186","State":"Nagaland"},{"StateID":"2187","State":"Orissa"},{"StateID":"2188","State":"Pondicherry"},{"StateID":"2189","State":"Punjab"},{"StateID":"2190","State":"Rajasthan"},{"StateID":"2191","State":"Tamil Nadu"},{"StateID":"2192","State":"Tripura"},{"StateID":"2193","State":"Uttar Pradesh"},{"StateID":"2194","State":"West Bengal"},{"StateID":"2195","State":"Sikkim"},{"StateID":"2196","State":"Arunachal Pradesh"},{"StateID":"2197","State":"Mizoram"},{"StateID":"2198","State":"Daman and Diu"},{"StateID":"2199","State":"Goa"},{"StateID":"5259","State":"Uttaranchal"},{"StateID":"5267","State":"Chhattisgarh"},{"StateID":"5268","State":"Jharkhand"}],"C114":[{"StateID":"49","State":"Bali"},{"StateID":"189","State":"Papua"},{"StateID":"651","State":"Indonesia"},{"StateID":"2143","State":"Aceh (Atjeh)"},{"StateID":"2144","State":"Bengkulu"},{"StateID":"2145","State":"Jakarta Raya (Djakarta Raya)"},{"StateID":"2146","State":"Jambi (Djambi)"},{"StateID":"2147","State":"Jawa Barat (Djawa Barat)"},{"StateID":"2148","State":"Jawa Tengah (Djawa Tengah)"},{"StateID":"2149","State":"Jawa Timur (Djawa Timur)"},{"StateID":"2150","State":"Yogyakarta (Jogjakarta)"},{"StateID":"2151","State":"Kalimantan Barat"},{"StateID":"2152","State":"Kalimantan Selatan"},{"StateID":"2153","State":"Kalimantan Tengah"},{"StateID":"2154","State":"Kalimantan Timur"},{"StateID":"2155","State":"Lampung"},{"StateID":"2156","State":"Maluku"},{"StateID":"2157","State":"Nusa Tenggara Barat"},{"StateID":"2158","State":"Nusa Tenggara Timur"},{"StateID":"2159","State":"Riau"},{"StateID":"2160","State":"Sulawesi Selatan"},{"StateID":"2161","State":"Sulawesi Tengah"},{"StateID":"2162","State":"Sulawesi Tenggara"},{"StateID":"2163","State":"Sulawesi Utara"},{"StateID":"2164","State":"Sumatera Barat"},{"StateID":"2165","State":"Sumatera Selatan"},{"StateID":"2166","State":"Sumatera Utara"},{"StateID":"5060","State":"Maluku Utara"},{"StateID":"5284","State":"Gorontalo"},{"StateID":"5285","State":"Kepulauan Bangka Belitung"},{"StateID":"5286","State":"Banten"}],"C115":[{"StateID":"652","State":"Iran"},{"StateID":"2200","State":"Azarbayjan-e Gharbi"},{"StateID":"2202","State":"Chahar Ma\u00b1all va Bakhtiari"},{"StateID":"2203","State":"Sistan va Baluchestan"},{"StateID":"2204","State":"Kohgiluyeh va Buyer Ahmad"},{"StateID":"2206","State":"Fars"},{"StateID":"2207","State":"Gilan"},{"StateID":"2208","State":"Hamadan"},{"StateID":"2209","State":"Ilam"},{"StateID":"2210","State":"Hormozgan"},{"StateID":"2212","State":"Kermanshah"},{"StateID":"2213","State":"Khuzestan"},{"StateID":"2214","State":"Kordestan"},{"StateID":"2215","State":"Mazandaran"},{"StateID":"2219","State":"Bushehr"},{"StateID":"2220","State":"Lorestan"},{"StateID":"2221","State":"Markazi"},{"StateID":"2222","State":"Semnan"},{"StateID":"2223","State":"Tehran"},{"StateID":"2224","State":"Zanjan"},{"StateID":"2225","State":"Esfahan"},{"StateID":"2226","State":"Kerman"},{"StateID":"2227","State":"Khorasan"},{"StateID":"2228","State":"Yazd"},{"StateID":"2229","State":"Ardabil"},{"StateID":"2230","State":"Azarbayjan-e Sharqi"},{"StateID":"5104","State":"Golestan"},{"StateID":"5105","State":"Qazvin"},{"StateID":"5106","State":"Qom"}],"C116":[{"StateID":"653","State":"Iraq"},{"StateID":"2308","State":"Al Anbar"},{"StateID":"2309","State":"Al Basrah"},{"StateID":"2310","State":"Al Muthann\u00b7"},{"StateID":"2311","State":"Al Qadisiyah"},{"StateID":"2312","State":"As Sulaymaniyah"},{"StateID":"2313","State":"Babil"},{"StateID":"2314","State":"Baghdad"},{"StateID":"2315","State":"Dahuk"},{"StateID":"2316","State":"Dhi Qar"},{"StateID":"2317","State":"Diyala"},{"StateID":"2318","State":"Arbil"},{"StateID":"2319","State":"Karbala\'"},{"StateID":"2320","State":"At Ta\'mim"},{"StateID":"2321","State":"Maysan"},{"StateID":"2322","State":"Ninawa"},{"StateID":"2323","State":"Wasit"},{"StateID":"2324","State":"An Najaf"},{"StateID":"2325","State":"S\u00f1alah ad Din"}],"C117":[{"StateID":"654","State":"Ireland"},{"StateID":"1596","State":"Carlow"},{"StateID":"1597","State":"Cavan"},{"StateID":"1598","State":"Clare"},{"StateID":"1599","State":"Cork"},{"StateID":"1600","State":"Donegal"},{"StateID":"1601","State":"Dublin"},{"StateID":"1602","State":"Galway"},{"StateID":"1603","State":"Kerry"},{"StateID":"1604","State":"Kildare"},{"StateID":"1605","State":"Kilkenny"},{"StateID":"1606","State":"Leitrim"},{"StateID":"1607","State":"Laois"},{"StateID":"1608","State":"Limerick"},{"StateID":"1609","State":"Longford"},{"StateID":"1610","State":"Louth"},{"StateID":"1611","State":"Mayo"},{"StateID":"1612","State":"Meath"},{"StateID":"1613","State":"Monaghan"},{"StateID":"1614","State":"Offaly"},{"StateID":"1615","State":"Roscommon"},{"StateID":"1616","State":"Sligo"},{"StateID":"1617","State":"Tipperary"},{"StateID":"1618","State":"Waterford"},{"StateID":"1619","State":"Westmeath"},{"StateID":"1620","State":"Wexford"},{"StateID":"1621","State":"Wicklow"}],"C118":[{"StateID":"655","State":"Israel"},{"StateID":"2232","State":"HaDarom (Southern)"},{"StateID":"2233","State":"HaMerkaz (Central)"},{"StateID":"2234","State":"Ha\u00fbafon (Northern)"},{"StateID":"2235","State":"H\u00edefa (Haifa)"},{"StateID":"2236","State":"Tel Aviv"},{"StateID":"2237","State":"Yerushalayim (Jerusalem)"}],"C119":[{"StateID":"656","State":"Italy"},{"StateID":"2238","State":"Abruzzi"},{"StateID":"2239","State":"Basilicata"},{"StateID":"2240","State":"Calabria"},{"StateID":"2241","State":"Campania"},{"StateID":"2242","State":"Emilia-Romagna"},{"StateID":"2243","State":"Friuli-Venezia Giulia"},{"StateID":"2244","State":"Lazio"},{"StateID":"2245","State":"Liguria"},{"StateID":"2246","State":"Lombardia"},{"StateID":"2247","State":"Marche"},{"StateID":"2248","State":"Molise"},{"StateID":"2249","State":"Piemonte"},{"StateID":"2250","State":"Puglia"},{"StateID":"2251","State":"Sardegna"},{"StateID":"2252","State":"Sicilia"},{"StateID":"2253","State":"Toscana"},{"StateID":"2254","State":"Trentino-Alto Adige"},{"StateID":"2255","State":"Umbria"},{"StateID":"2256","State":"Valle d\'Aosta"},{"StateID":"2257","State":"Veneto"}],"C120":[{"StateID":"657","State":"Jamaica"},{"StateID":"2373","State":"Clarendon"},{"StateID":"2374","State":"Hanover"},{"StateID":"2375","State":"Manchester"},{"StateID":"2376","State":"Portland"},{"StateID":"2377","State":"Saint Andrew"},{"StateID":"2378","State":"Saint Ann"},{"StateID":"2379","State":"Saint Catherine"},{"StateID":"2380","State":"Saint Elizabeth"},{"StateID":"2381","State":"Saint James"},{"StateID":"2382","State":"Saint Mary"},{"StateID":"2383","State":"Saint Thomas"},{"StateID":"2384","State":"Trelawny"},{"StateID":"2385","State":"Westmoreland"},{"StateID":"2386","State":"Kingston"}],"C121":[{"StateID":"658","State":"Jan Mayen"}],"C122":[{"StateID":"659","State":"Japan"},{"StateID":"2326","State":"Aichi"},{"StateID":"2327","State":"Akita"},{"StateID":"2328","State":"Aomori"},{"StateID":"2329","State":"Chiba"},{"StateID":"2330","State":"Ehime"},{"StateID":"2331","State":"Fukui"},{"StateID":"2332","State":"Fukuoka"},{"StateID":"2333","State":"Fukushima"},{"StateID":"2334","State":"Gifu"},{"StateID":"2335","State":"Gumma"},{"StateID":"2336","State":"Hiroshima"},{"StateID":"2337","State":"Hokkaido"},{"StateID":"2338","State":"Hyogo"},{"StateID":"2339","State":"Ibaraki"},{"StateID":"2340","State":"Ishikawa"},{"StateID":"2341","State":"Iwate"},{"StateID":"2342","State":"Kagawa"},{"StateID":"2343","State":"Kagoshima"},{"StateID":"2344","State":"Kanagawa"},{"StateID":"2345","State":"Kochi"},{"StateID":"2346","State":"Kumamoto"},{"StateID":"2347","State":"Kyoto"},{"StateID":"2348","State":"Mie"},{"StateID":"2349","State":"Miyagi"},{"StateID":"2350","State":"Miyazaki"},{"StateID":"2351","State":"Nagano"},{"StateID":"2352","State":"Nagasaki"},{"StateID":"2353","State":"Nara"},{"StateID":"2354","State":"Niigata"},{"StateID":"2355","State":"Oita"},{"StateID":"2356","State":"Okayama"},{"StateID":"2357","State":"Osaka"},{"StateID":"2358","State":"Saga"},{"StateID":"2359","State":"Saitama"},{"StateID":"2360","State":"Shiga"},{"StateID":"2361","State":"Shimane"},{"StateID":"2362","State":"Shizuoka"},{"StateID":"2363","State":"Tochigi"},{"StateID":"2364","State":"Tokushima"},{"StateID":"2365","State":"Tokyo"},{"StateID":"2366","State":"Tottori"},{"StateID":"2367","State":"Toyama"},{"StateID":"2368","State":"Wakayama"},{"StateID":"2369","State":"Yamagata"},{"StateID":"2370","State":"Yamaguchi"},{"StateID":"2371","State":"Yamanashi"},{"StateID":"2372","State":"Okinawa"}],"C123":[{"StateID":"660","State":"Jarvis Island"}],"C124":[{"StateID":"661","State":"Jersey"}],"C125":[{"StateID":"662","State":"Johnston Atoll"}],"C126":[{"StateID":"663","State":"Jordan"},{"StateID":"2387","State":"Al Balqa\'"},{"StateID":"2388","State":"Ma\'an"},{"StateID":"2389","State":"Al Karak"},{"StateID":"2390","State":"Al Mafraq"},{"StateID":"2391","State":"\'Amman"},{"StateID":"2392","State":"At Tafilah"},{"StateID":"2393","State":"Az Zaraq"},{"StateID":"2394","State":"Irbid"},{"StateID":"5067","State":"Ajlun"},{"StateID":"5068","State":"Al Aqabah"},{"StateID":"5069","State":"Jarash"},{"StateID":"5070","State":"Madaba"}],"C127":[{"StateID":"664","State":"Juan de Nova Island"}],"C128":[{"StateID":"665","State":"Kazakhstan"},{"StateID":"2445","State":"Almaty"},{"StateID":"2446","State":"Aqmola"},{"StateID":"2447","State":"Aqtobe"},{"StateID":"2448","State":"Astana"},{"StateID":"2449","State":"Atyrau"},{"StateID":"2450","State":"Batys Qazaqstan"},{"StateID":"2451","State":"Bayqongyr"},{"StateID":"2452","State":"Mangghystau"},{"StateID":"2453","State":"Ongtustik Qazaqstan"},{"StateID":"2454","State":"Pavlodar"},{"StateID":"2455","State":"Qaraghandy"},{"StateID":"2456","State":"Qostanay"},{"StateID":"2457","State":"Qyzylorda"},{"StateID":"2458","State":"Shyghys Qazaqstan"},{"StateID":"2459","State":"Soltustik Qazaqstan"},{"StateID":"2460","State":"Zhambyl"}],"C129":[{"StateID":"666","State":"Kenya"},{"StateID":"2395","State":"Central"},{"StateID":"2396","State":"Coast"},{"StateID":"2397","State":"Eastern"},{"StateID":"2398","State":"Nairobi Area"},{"StateID":"2399","State":"NorthEastern"},{"StateID":"2400","State":"Nyanza"},{"StateID":"2401","State":"Rift Valley"},{"StateID":"2402","State":"Western"}],"C130":[{"StateID":"667","State":"Kingman Reef"}],"C131":[{"StateID":"668","State":"Kiribati"},{"StateID":"2421","State":"Gilbert Islands"},{"StateID":"2422","State":"Line Islands"},{"StateID":"2423","State":"Phoenix Islands"}],"C132":[{"StateID":"669","State":"North Korea"},{"StateID":"2410","State":"Chagang-do"},{"StateID":"2411","State":"Hamgyong-namdo"},{"StateID":"2412","State":"Hwanghae-namdo"},{"StateID":"2413","State":"Hwanghae-bukto"},{"StateID":"2414","State":"Kaesong-si"},{"StateID":"2415","State":"Kangwon-do"},{"StateID":"2416","State":"P\'yongan-namdo"},{"StateID":"2417","State":"P\'yongyang-si"},{"StateID":"2418","State":"Yanggang-do"},{"StateID":"2419","State":"Namp\'o-si"},{"StateID":"2420","State":"Hamgyong-bukto"},{"StateID":"5119","State":"P\'yongan-bukto"},{"StateID":"5334","State":"Najin Sonbong-si"}],"C133":[{"StateID":"670","State":"South Korea"},{"StateID":"2424","State":"Cheju-do"},{"StateID":"2425","State":"Cholla-bukto"},{"StateID":"2426","State":"Ch\'ungch\'ong-bukto"},{"StateID":"2427","State":"Kangwon-do"},{"StateID":"2428","State":"Kyongsang-namdo"},{"StateID":"2429","State":"Pusan-gwangyoksi"},{"StateID":"2430","State":"Soul-t\'ukpyolsi"},{"StateID":"2431","State":"Inch\'on-gwangyoksi"},{"StateID":"2432","State":"Kyonggi-do"},{"StateID":"2433","State":"Kyongsang-bukto"},{"StateID":"2434","State":"Taegu-gwangyoksi"},{"StateID":"2435","State":"Cholla-namdo"},{"StateID":"2436","State":"Ch\'ungch\'ong-namdo"},{"StateID":"2437","State":"Kwangju-gwangyoksi"},{"StateID":"2438","State":"Taejon-gwangyoksi"},{"StateID":"5287","State":"Ulsan-gwangyoksi"}],"C134":[{"StateID":"671","State":"Kuwait"},{"StateID":"2439","State":"Al Kuwayt"},{"StateID":"2441","State":"Hawalli"},{"StateID":"2442","State":"Al Ahmadi"},{"StateID":"2443","State":"Al Jahra\'"},{"StateID":"2444","State":"Al Farwaniyah"}],"C135":[{"StateID":"672","State":"Kyrgyzstan"},{"StateID":"2403","State":"Bishkek"},{"StateID":"2404","State":"Chuy"},{"StateID":"2405","State":"Jalal-Abad"},{"StateID":"2406","State":"Naryn"},{"StateID":"2407","State":"Osh"},{"StateID":"2408","State":"Talas"},{"StateID":"2409","State":"Ysyk-Kol"},{"StateID":"5118","State":"Batken"}],"C136":[{"StateID":"673","State":"Laos"},{"StateID":"2464","State":"Attapu"},{"StateID":"2465","State":"Champasak"},{"StateID":"2466","State":"Houaphan"},{"StateID":"2467","State":"Oudomxai"},{"StateID":"2468","State":"Xiagnabouli"},{"StateID":"2469","State":"Xiangkhoang"},{"StateID":"2470","State":"Khammouan"},{"StateID":"2471","State":"Louangnamtha"},{"StateID":"2472","State":"Louangphabang"},{"StateID":"2473","State":"Phongsali"},{"StateID":"2474","State":"Salavan"},{"StateID":"2475","State":"Savannakhet"},{"StateID":"2476","State":"Bokeo"},{"StateID":"2477","State":"Bolikhamxai"},{"StateID":"2478","State":"Viangchan"},{"StateID":"2479","State":"Xaisomboun"},{"StateID":"2480","State":"Xekong"}],"C137":[{"StateID":"674","State":"Latvia"},{"StateID":"2486","State":"Aizjrayjkes Rajons"},{"StateID":"2487","State":"Aluksnes Rajons"},{"StateID":"2488","State":"Balvu Rajons"},{"StateID":"2489","State":"Bauskas Rajons"},{"StateID":"2490","State":"Cesu Rajons"},{"StateID":"2491","State":"Daugavpils"},{"StateID":"2492","State":"Daugavpils Rajons"},{"StateID":"2493","State":"Dobeles Rajons"},{"StateID":"2494","State":"Gulbenes Rajons"},{"StateID":"2495","State":"Jekabpils Rajons"},{"StateID":"2496","State":"Jelgava"},{"StateID":"2497","State":"Jelgavas Rajons"},{"StateID":"2498","State":"Jurmala"},{"StateID":"2499","State":"Kraslavas Rajons"},{"StateID":"2500","State":"Kuldigas Rajons"},{"StateID":"2501","State":"Liepaja"},{"StateID":"2502","State":"Liepajas Rajons"},{"StateID":"2503","State":"Limbazu Rajons"},{"StateID":"2504","State":"Ludzas Rajons"},{"StateID":"2505","State":"Madonas Rajons"},{"StateID":"2506","State":"Ogres Rajons"},{"StateID":"2507","State":"Preiju Rajons"},{"StateID":"2508","State":"Rezekne"},{"StateID":"2509","State":"Rezeknes Rajons"},{"StateID":"2510","State":"Riga"},{"StateID":"2511","State":"Rigas Rajons"},{"StateID":"2512","State":"Saldus Rajons"},{"StateID":"2513","State":"Talsu Rajons"},{"StateID":"2514","State":"Tukuma Rajons"},{"StateID":"2515","State":"Valkas Rajons"},{"StateID":"2516","State":"Valmieras Rajons"},{"StateID":"2517","State":"Ventspils"},{"StateID":"2518","State":"Ventspils Rajons"}],"C138":[{"StateID":"675","State":"Lebanon"},{"StateID":"2481","State":"Beqaa"},{"StateID":"2482","State":"Liban-Sud"},{"StateID":"2483","State":"Liban-Nord"},{"StateID":"2484","State":"Beyrouth"},{"StateID":"2485","State":"Mont-Liban"},{"StateID":"5295","State":"Nabatiye"}],"C139":[{"StateID":"676","State":"Lesotho"},{"StateID":"2613","State":"Berea"},{"StateID":"2614","State":"Butha-Buthe"},{"StateID":"2615","State":"Leribe"},{"StateID":"2616","State":"Mafeteng"},{"StateID":"2617","State":"Maseru"},{"StateID":"2618","State":"Mohale\'s Hoek"},{"StateID":"2619","State":"Mokhotlong"},{"StateID":"2620","State":"Qacha\'s Hoek"},{"StateID":"2621","State":"Quthing"},{"StateID":"2622","State":"Thaba-Tseka"}],"C140":[{"StateID":"677","State":"Liberia"},{"StateID":"2574","State":"Bong"},{"StateID":"2575","State":"Grand Gedeh"},{"StateID":"2576","State":"Lofa"},{"StateID":"2578","State":"Nimba"},{"StateID":"2579","State":"Sinoe"},{"StateID":"2580","State":"Grand Bassa"},{"StateID":"2581","State":"Grand Cape Mount"},{"StateID":"2582","State":"Maryland"},{"StateID":"2583","State":"Montserrado"},{"StateID":"2584","State":"Bomi"},{"StateID":"2585","State":"Grand Kru"},{"StateID":"2586","State":"Margibi"},{"StateID":"2587","State":"River Cess"},{"StateID":"5362","State":"River Gee"},{"StateID":"5363","State":"Gbarpolu"}],"C141":[{"StateID":"678","State":"Libya"},{"StateID":"2627","State":"Al \'Aziziyah"},{"StateID":"2629","State":"Al Jufrah"},{"StateID":"2631","State":"Al Kufrah"},{"StateID":"2636","State":"Ash Shati\'"},{"StateID":"2646","State":"Murzuq"},{"StateID":"2650","State":"Sabha"},{"StateID":"2655","State":"Tarhunah"},{"StateID":"2656","State":"T\u00f6ubruq"},{"StateID":"2658","State":"Zlitan"},{"StateID":"2660","State":"Ajdabiya"},{"StateID":"2661","State":"Al Fatih"},{"StateID":"2662","State":"Al Jabal al Akhdar"},{"StateID":"2663","State":"Al Khums"},{"StateID":"2664","State":"An Nuqat al Khams"},{"StateID":"2665","State":"Awbari"},{"StateID":"2666","State":"Az Zawiyah"},{"StateID":"2667","State":"Banghazi"},{"StateID":"2668","State":"Darnah"},{"StateID":"2669","State":"Ghadamis"},{"StateID":"2670","State":"Gharyan"},{"StateID":"2671","State":"Misratah"},{"StateID":"2672","State":"Sawfajjin"},{"StateID":"2673","State":"Surt"},{"StateID":"2674","State":"Tarabulus"},{"StateID":"2675","State":"Yafran"}],"C142":[{"StateID":"679","State":"Liechtenstein"},{"StateID":"2596","State":"Balzers"},{"StateID":"2597","State":"Eschen"},{"StateID":"2598","State":"Gamprin"},{"StateID":"2599","State":"Mauren"},{"StateID":"2600","State":"Planken"},{"StateID":"2601","State":"Ruggell"},{"StateID":"2602","State":"Schaan"},{"StateID":"2603","State":"Schellenberg"},{"StateID":"2604","State":"Triesen"},{"StateID":"2605","State":"Triesenberg"},{"StateID":"2606","State":"Vaduz"}],"C143":[{"StateID":"680","State":"Lithuania"},{"StateID":"2521","State":"Alytaus Apskritis"},{"StateID":"2531","State":"Kauno Apskritis"},{"StateID":"2535","State":"Klaipedos Apskritis"},{"StateID":"2540","State":"Marijampoles Apskritis"},{"StateID":"2548","State":"Panevezio Apskritis"},{"StateID":"2557","State":"Siauliu Apskritis"},{"StateID":"2564","State":"Taurages Apskritis"},{"StateID":"2565","State":"Telsiu Apskritis"},{"StateID":"2568","State":"Utenos Apskritis"},{"StateID":"2572","State":"Vilniaus Apskritis"}],"C144":[{"StateID":"2623","State":"Diekirch"},{"StateID":"2624","State":"Grevenmacher"},{"StateID":"2625","State":"Luxembourg"}],"C145":[{"StateID":"682","State":"Macao"},{"StateID":"2682","State":"Ilhas"},{"StateID":"2683","State":"Macau"}],"C146":[{"StateID":"683","State":"The Former Yugoslav Republic of Macedonia"},{"StateID":"5135","State":"Aracinovo"},{"StateID":"5136","State":"Bac"},{"StateID":"5137","State":"Belcista"},{"StateID":"5138","State":"Berovo"},{"StateID":"5139","State":"Bistrica"},{"StateID":"5140","State":"Bitola"},{"StateID":"5141","State":"Blatec"},{"StateID":"5142","State":"Bogdanci"},{"StateID":"5143","State":"Bogomila"},{"StateID":"5144","State":"Bogovinje"},{"StateID":"5145","State":"Bosilovo"},{"StateID":"5146","State":"Brvenica"},{"StateID":"5147","State":"Cair"},{"StateID":"5148","State":"Capari"},{"StateID":"5149","State":"Caska"},{"StateID":"5150","State":"Cegrane"},{"StateID":"5151","State":"Centar"},{"StateID":"5152","State":"Centar Zupa"},{"StateID":"5153","State":"Cesinovo"},{"StateID":"5154","State":"Cucer-Sandevo"},{"StateID":"5155","State":"Debar"},{"StateID":"5156","State":"Delcevo"},{"StateID":"5157","State":"Delogozdi"},{"StateID":"5158","State":"Demir Hisar"},{"StateID":"5159","State":"Demir Kapija"},{"StateID":"5160","State":"Dobrusevo"},{"StateID":"5161","State":"Dolna Banjica"},{"StateID":"5162","State":"Dolneni"},{"StateID":"5163","State":"Dorce Petrov"},{"StateID":"5164","State":"Drugovo"},{"StateID":"5165","State":"Dzepciste"},{"StateID":"5166","State":"Gazi Baba"},{"StateID":"5167","State":"Gevgelija"},{"StateID":"5168","State":"Gostivar"},{"StateID":"5169","State":"Gradsko"},{"StateID":"5170","State":"Ilinden"},{"StateID":"5171","State":"Izvor"},{"StateID":"5172","State":"Jegunovce"},{"StateID":"5173","State":"Kamenjane"},{"StateID":"5174","State":"Karbinci"},{"StateID":"5175","State":"Karpos"},{"StateID":"5176","State":"Kavadarci"},{"StateID":"5177","State":"Kicevo"},{"StateID":"5178","State":"Kisela Voda"},{"StateID":"5179","State":"Klecevce"},{"StateID":"5180","State":"Kocani"},{"StateID":"5181","State":"Konce"},{"StateID":"5182","State":"Kondovo"},{"StateID":"5183","State":"Konopiste"},{"StateID":"5184","State":"Kosel"},{"StateID":"5185","State":"Kartovo"},{"StateID":"5186","State":"Kriva Palanka"},{"StateID":"5187","State":"Krivogastani"},{"StateID":"5188","State":"Krusevo"},{"StateID":"5189","State":"Kuklis"},{"StateID":"5190","State":"Kukurecani"},{"StateID":"5191","State":"Kumanovo"},{"StateID":"5192","State":"Labunista"},{"StateID":"5193","State":"Lipkovo"},{"StateID":"5194","State":"Lozovo"},{"StateID":"5195","State":"Lukovo"},{"StateID":"5196","State":"Makedonska Kamenica"},{"StateID":"5197","State":"Makedonski Brod"},{"StateID":"5198","State":"Mavrovi Anovi"},{"StateID":"5199","State":"Meseista"},{"StateID":"5200","State":"Miravci"},{"StateID":"5201","State":"Mogila"},{"StateID":"5202","State":"Murtino"},{"StateID":"5203","State":"Negotino"},{"StateID":"5204","State":"Negotino-Polosko"},{"StateID":"5205","State":"Novaci"},{"StateID":"5206","State":"Novo Selo"},{"StateID":"5207","State":"Oblesevo"},{"StateID":"5208","State":"Ohrid"},{"StateID":"5209","State":"Orasac"},{"StateID":"5210","State":"Orizari"},{"StateID":"5211","State":"Oslomej"},{"StateID":"5212","State":"Pehcevo"},{"StateID":"5213","State":"Petrovec"},{"StateID":"5214","State":"Plasnica"},{"StateID":"5215","State":"Podares"},{"StateID":"5216","State":"Prilep"},{"StateID":"5217","State":"Probistip"},{"StateID":"5218","State":"Radovis"},{"StateID":"5219","State":"Rankovce"},{"StateID":"5220","State":"Resen"},{"StateID":"5221","State":"Rosoman"},{"StateID":"5222","State":"Rostusa"},{"StateID":"5223","State":"Samokov"},{"StateID":"5224","State":"Saraj"},{"StateID":"5225","State":"Sipkovica"},{"StateID":"5226","State":"Sopiste"},{"StateID":"5227","State":"Sopotnica"},{"StateID":"5228","State":"Srbinovo"},{"StateID":"5229","State":"Staravina"},{"StateID":"5230","State":"Star Dojran"},{"StateID":"5231","State":"Star Nagoricane"},{"StateID":"5232","State":"Stip"},{"StateID":"5233","State":"Struga"},{"StateID":"5234","State":"Strumica"},{"StateID":"5235","State":"Studenicani"},{"StateID":"5236","State":"Suto Orizari"},{"StateID":"5237","State":"Sveti Nikole"},{"StateID":"5238","State":"Tearce"},{"StateID":"5239","State":"Tetovo"},{"StateID":"5240","State":"Topolcani"},{"StateID":"5241","State":"Valandovo"},{"StateID":"5242","State":"Vasilevo"},{"StateID":"5243","State":"Veles"},{"StateID":"5244","State":"Velesta"},{"StateID":"5245","State":"Vevcani"},{"StateID":"5246","State":"Vinica"},{"StateID":"5247","State":"Vitoliste"},{"StateID":"5248","State":"Vranestica"},{"StateID":"5249","State":"Vrapciste"},{"StateID":"5250","State":"Vratnica"},{"StateID":"5251","State":"Vrutok"},{"StateID":"5252","State":"Zajas"},{"StateID":"5253","State":"Zelenikovo"},{"StateID":"5254","State":"Zelino"},{"StateID":"5255","State":"Zitose"},{"StateID":"5256","State":"Zletovo"},{"StateID":"5257","State":"Zrnovci"}],"C147":[{"StateID":"684","State":"Madagascar"},{"StateID":"2676","State":"Antsiranana"},{"StateID":"2677","State":"Fianarantsoa"},{"StateID":"2678","State":"Mahajanga"},{"StateID":"2679","State":"Toamasina"},{"StateID":"2680","State":"Antananarivo"},{"StateID":"2681","State":"Toliara"}],"C148":[{"StateID":"685","State":"Malawi"},{"StateID":"2746","State":"Chikwawa"},{"StateID":"2747","State":"Chiradzulu"},{"StateID":"2748","State":"Chitipa"},{"StateID":"2749","State":"Thyolo"},{"StateID":"2750","State":"Dedza"},{"StateID":"2751","State":"Dowa"},{"StateID":"2752","State":"Karonga"},{"StateID":"2753","State":"Kasungu"},{"StateID":"2754","State":"Machinga (Kasupe)"},{"StateID":"2755","State":"Lilongwe"},{"StateID":"2756","State":"Mangochi (Fort Johnston)"},{"StateID":"2757","State":"Mchinji"},{"StateID":"2758","State":"Mulanje (Mlange)"},{"StateID":"2759","State":"Mzimba"},{"StateID":"2760","State":"Ntcheu"},{"StateID":"2761","State":"Nkhata Bay"},{"StateID":"2762","State":"Nkhotakota"},{"StateID":"2763","State":"Nsanje"},{"StateID":"2764","State":"Ntchisi (Nchisi)"},{"StateID":"2765","State":"Rumphi (Rumpil)"},{"StateID":"2766","State":"Salima"},{"StateID":"2767","State":"Zomba"},{"StateID":"2768","State":"Blantyre"},{"StateID":"2769","State":"Mwanza"},{"StateID":"5378","State":"Phalombe"},{"StateID":"5379","State":"Likoma"},{"StateID":"5380","State":"Balaka"}],"C149":[{"StateID":"686","State":"Malaysia"},{"StateID":"2897","State":"Johor"},{"StateID":"2898","State":"Kedah"},{"StateID":"2899","State":"Kelantan"},{"StateID":"2900","State":"Melaka"},{"StateID":"2901","State":"Negeri Sembilan"},{"StateID":"2902","State":"Pahang"},{"StateID":"2903","State":"Perak"},{"StateID":"2904","State":"Perlis"},{"StateID":"2905","State":"Pulau Pinang"},{"StateID":"2906","State":"Sarawak"},{"StateID":"2907","State":"Selangor"},{"StateID":"2908","State":"Terengganu"},{"StateID":"2909","State":"Wilayah Persekutuan"},{"StateID":"2910","State":"Labuan"},{"StateID":"2911","State":"Sabah"},{"StateID":"5381","State":"Putrajaya"}],"C150":[{"StateID":"687","State":"Maldives"},{"StateID":"2854","State":"Seenu"},{"StateID":"2858","State":"Laamu"},{"StateID":"2860","State":"Thaa"},{"StateID":"2862","State":"Raa"},{"StateID":"2865","State":"Baa"},{"StateID":"2867","State":"Shaviyani"},{"StateID":"2868","State":"Noonu"},{"StateID":"2869","State":"Kaafu"},{"StateID":"2873","State":"Alifu"},{"StateID":"2874","State":"Dhaalu"},{"StateID":"2875","State":"Faafa"},{"StateID":"2876","State":"Gaafu Alifu"},{"StateID":"2877","State":"Gaafu Dhaalu"},{"StateID":"2878","State":"Haa Alifu"},{"StateID":"2879","State":"Haa Dhaalu"},{"StateID":"2880","State":"Lhaviyani"},{"StateID":"2881","State":"Maale"},{"StateID":"2882","State":"Meenu"},{"StateID":"2883","State":"Gnaviyani"},{"StateID":"2884","State":"Vaavu"}],"C151":[{"StateID":"688","State":"Mali"},{"StateID":"2770","State":"Bamako"},{"StateID":"2771","State":"Gao"},{"StateID":"2772","State":"Kayes"},{"StateID":"2773","State":"Mopti"},{"StateID":"2774","State":"Segou"},{"StateID":"2775","State":"Sikasso"},{"StateID":"2776","State":"Koulikoro"},{"StateID":"2777","State":"Tombouctou"},{"StateID":"5367","State":"Kidal"}],"C152":[{"StateID":"689","State":"Malta"}],"C153":[{"StateID":"690","State":"Isle of Man"}],"C154":[{"StateID":"691","State":"Marshall Islands"}],"C155":[{"StateID":"692","State":"Martinique"},{"StateID":"5373","State":"Trinit\u00e9"},{"StateID":"5374","State":"Saint-Pierre"},{"StateID":"5375","State":"Marin"},{"StateID":"5376","State":"Fort-de-France"}],"C156":[{"StateID":"693","State":"Mauritania"},{"StateID":"2834","State":"Hodh Ech Chargui"},{"StateID":"2835","State":"Hodh El Gharbi"},{"StateID":"2836","State":"Assaba"},{"StateID":"2837","State":"Gorgol"},{"StateID":"2838","State":"Brakna"},{"StateID":"2839","State":"Trarza"},{"StateID":"2840","State":"Adrar"},{"StateID":"2841","State":"Dakhlet Nouadhibou"},{"StateID":"2842","State":"Tagant"},{"StateID":"2843","State":"Guidimaka"},{"StateID":"2844","State":"Tiris Zemmour"},{"StateID":"2845","State":"Inchiri"},{"StateID":"4975","State":"Nouakchott"}],"C157":[{"StateID":"694","State":"Mauritius"},{"StateID":"2822","State":"Black River"},{"StateID":"2823","State":"Flacq"},{"StateID":"2824","State":"Grand Port"},{"StateID":"2825","State":"Moka"},{"StateID":"2826","State":"Pamplemousses"},{"StateID":"2827","State":"Plaines Wilhems"},{"StateID":"2828","State":"Port Louis"},{"StateID":"2829","State":"Rivi\u00cbre du Rempart"},{"StateID":"2830","State":"Savanne"},{"StateID":"2831","State":"Agalega Islands"},{"StateID":"2832","State":"Cargados Carajos"},{"StateID":"2833","State":"Rodrigues"}],"C158":[{"StateID":"695","State":"Mayotte"}],"C159":[{"StateID":"56","State":"Sonora"},{"StateID":"59","State":"Jalisco"},{"StateID":"60","State":"Hidalgo"},{"StateID":"61","State":"Morelos"},{"StateID":"62","State":"Chiapas"},{"StateID":"63","State":"Tabasco"},{"StateID":"66","State":"Guerrero"},{"StateID":"69","State":"Nuevo Leon"},{"StateID":"70","State":"Tamaulipas"},{"StateID":"71","State":"Guanajuato"},{"StateID":"72","State":"Quintana Roo"},{"StateID":"73","State":"Baja California"},{"StateID":"74","State":"Baja California Sur"},{"StateID":"196","State":"Chihuahua"},{"StateID":"197","State":"Colima"},{"StateID":"198","State":"Durango"},{"StateID":"201","State":"Oaxaca"},{"StateID":"203","State":"San Luis Potosi"},{"StateID":"204","State":"Tlaxcala"},{"StateID":"206","State":"Zacatecas"},{"StateID":"2885","State":"Aguascalientes"},{"StateID":"2886","State":"Campeche"},{"StateID":"2887","State":"Coahuila de Zaragoza"},{"StateID":"2888","State":"Distrito Federal"},{"StateID":"2889","State":"Mexico"},{"StateID":"2890","State":"Michoacan de Ocampo"},{"StateID":"2891","State":"Nayarit"},{"StateID":"2892","State":"Puebla"},{"StateID":"2893","State":"Queretaro de Arteaga"},{"StateID":"2894","State":"Sinaloa"},{"StateID":"2895","State":"Veracruz-Llave"},{"StateID":"2896","State":"Yucatan"}],"C160":[{"StateID":"697","State":"Federated States of Micronesia"},{"StateID":"1789","State":"Kosrae"},{"StateID":"1790","State":"Pohnpei"},{"StateID":"1791","State":"Chuuk"},{"StateID":"1792","State":"Yap"}],"C161":[{"StateID":"698","State":"Midway Islands"}],"C162":[{"StateID":"699","State":"Miscellaneous (French)"}],"C163":[{"StateID":"700","State":"Moldova"},{"StateID":"2685","State":"Balti"},{"StateID":"2689","State":"Cahul"},{"StateID":"2696","State":"Chisinau"},{"StateID":"2702","State":"Stinga Nistrului"},{"StateID":"2703","State":"Edinet"},{"StateID":"2706","State":"Gagauzia"},{"StateID":"2714","State":"Orhei"},{"StateID":"2721","State":"Soroca"},{"StateID":"2727","State":"Ungheni"},{"StateID":"5083","State":"Lapusna"},{"StateID":"5084","State":"Tighina"},{"StateID":"5377","State":"Taraclia"}],"C164":[{"StateID":"701","State":"Monaco"}],"C165":[{"StateID":"75","State":"Tov"},{"StateID":"76","State":"Uvs"},{"StateID":"80","State":"Dornod"},{"StateID":"81","State":"Hovsgol"},{"StateID":"82","State":"Selenge"},{"StateID":"86","State":"Suhbaatar"},{"StateID":"193","State":"Bulgan"},{"StateID":"194","State":"Hovd"},{"StateID":"702","State":"Mongolia"},{"StateID":"2729","State":"Arhangay"},{"StateID":"2730","State":"Bayanhongor"},{"StateID":"2731","State":"Bayan-Olgiy"},{"StateID":"2734","State":"Dornogovi"},{"StateID":"2735","State":"Dundgovi"},{"StateID":"2736","State":"Dzavhan"},{"StateID":"2737","State":"Govi-Altay"},{"StateID":"2738","State":"Hentiy"},{"StateID":"2739","State":"Omnogovi"},{"StateID":"2740","State":"Ovorhangay"},{"StateID":"2741","State":"Ulaanbaatar"},{"StateID":"2742","State":"Orhon"},{"StateID":"5332","State":"Govi-Sumber"},{"StateID":"5333","State":"Darhan Uul"}],"C166":[{"StateID":"703","State":"Montenegro"}],"C167":[{"StateID":"704","State":"Montserrat"},{"StateID":"2743","State":"Saint Anthony"},{"StateID":"2744","State":"Saint Georges"},{"StateID":"2745","State":"Saint Peter"}],"C168":[{"StateID":"705","State":"Morocco"},{"StateID":"2781","State":"Agadir"},{"StateID":"2782","State":"Al Hoce\u00d4ma"},{"StateID":"2783","State":"Azilal"},{"StateID":"2784","State":"Ben Slimane"},{"StateID":"2785","State":"Beni Mellal"},{"StateID":"2786","State":"Boulemane"},{"StateID":"2787","State":"Casablanca"},{"StateID":"2788","State":"Chaouen"},{"StateID":"2789","State":"El Jadida"},{"StateID":"2790","State":"El Kelaa des Sraghna"},{"StateID":"2791","State":"Er Rachidia"},{"StateID":"2792","State":"Essaouira"},{"StateID":"2793","State":"Fes"},{"StateID":"2794","State":"Figuig"},{"StateID":"2795","State":"Kenitra"},{"StateID":"2796","State":"Khemisset"},{"StateID":"2797","State":"Khenifra"},{"StateID":"2798","State":"Khouribga"},{"StateID":"2799","State":"Marrakech"},{"StateID":"2800","State":"Meknes"},{"StateID":"2801","State":"Nador"},{"StateID":"2802","State":"Ouarzazate"},{"StateID":"2803","State":"Oujda"},{"StateID":"2804","State":"Rabat-Sale"},{"StateID":"2805","State":"Safi"},{"StateID":"2806","State":"Settat"},{"StateID":"2807","State":"Tanger"},{"StateID":"2808","State":"Tata"},{"StateID":"2809","State":"Taza"},{"StateID":"2810","State":"Tiznit"},{"StateID":"2811","State":"Guelmim"},{"StateID":"2812","State":"Ifrane"},{"StateID":"2813","State":"Laayoune"},{"StateID":"2814","State":"Tan-Tan"},{"StateID":"2815","State":"Taounate"},{"StateID":"2816","State":"Sidi Kacem"},{"StateID":"2817","State":"Taroudannt"},{"StateID":"2818","State":"Tetouan"},{"StateID":"2819","State":"Larache"},{"StateID":"2820","State":"Assa-Zag"},{"StateID":"2821","State":"Es Smara"}],"C169":[{"StateID":"706","State":"Mozambique"},{"StateID":"2912","State":"Cabo Delgado"},{"StateID":"2913","State":"Gaza"},{"StateID":"2914","State":"Inhambane"},{"StateID":"2915","State":"Maputo"},{"StateID":"2916","State":"Sofala"},{"StateID":"2917","State":"Nampula"},{"StateID":"2918","State":"Niassa"},{"StateID":"2919","State":"Tete"},{"StateID":"2920","State":"Zambezia"},{"StateID":"2921","State":"Manica"}],"C170":[{"StateID":"707","State":"Myanmar"}],"C171":[{"StateID":"708","State":"Namibia"},{"StateID":"4635","State":"Khomas"},{"StateID":"4636","State":"Caprivi"},{"StateID":"4637","State":"Erongo"},{"StateID":"4638","State":"Hardap"},{"StateID":"4639","State":"Karas"},{"StateID":"4640","State":"Kunene"},{"StateID":"4641","State":"Ohangwena"},{"StateID":"4642","State":"Okavango"},{"StateID":"4643","State":"Omaheke"},{"StateID":"4644","State":"Omusati"},{"StateID":"4645","State":"Oshana"},{"StateID":"4646","State":"Oshikoto"},{"StateID":"4647","State":"Otjozondjupa"}],"C172":[{"StateID":"709","State":"Nauru"},{"StateID":"3023","State":"Aiwo"},{"StateID":"3024","State":"Anabar"},{"StateID":"3025","State":"Anetan"},{"StateID":"3026","State":"Anibare"},{"StateID":"3027","State":"Baiti"},{"StateID":"3028","State":"Boe"},{"StateID":"3029","State":"Buada"},{"StateID":"3030","State":"Denigomodu"},{"StateID":"3031","State":"Ewa"},{"StateID":"3032","State":"Ijuw"},{"StateID":"3033","State":"Meneng"},{"StateID":"3034","State":"Nibok"},{"StateID":"3035","State":"Uaboe"},{"StateID":"3036","State":"Yaren"}],"C173":[{"StateID":"710","State":"Navassa Island"}],"C174":[{"StateID":"711","State":"Nepal"},{"StateID":"3009","State":"Bagmati"},{"StateID":"3010","State":"Bheri"},{"StateID":"3011","State":"Dhawalagiri"},{"StateID":"3012","State":"Gandaki"},{"StateID":"3013","State":"Janakpur"},{"StateID":"3014","State":"Karnali"},{"StateID":"3015","State":"Kosi"},{"StateID":"3016","State":"Lumbini"},{"StateID":"3017","State":"Mahakali"},{"StateID":"3018","State":"Mechi"},{"StateID":"3019","State":"Narayani"},{"StateID":"3020","State":"Rapti"},{"StateID":"3021","State":"Sagarmatha"},{"StateID":"3022","State":"Seti"}],"C175":[{"StateID":"712","State":"The Netherlands"},{"StateID":"2975","State":"Drenthe"},{"StateID":"2976","State":"Friesland"},{"StateID":"2977","State":"Gelderland"},{"StateID":"2978","State":"Groningen"},{"StateID":"2979","State":"Limburg"},{"StateID":"2980","State":"Noord-Brabant"},{"StateID":"2981","State":"Noord-Holland"},{"StateID":"2982","State":"Overijssel"},{"StateID":"2983","State":"Utrecht"},{"StateID":"2984","State":"Zeeland"},{"StateID":"2985","State":"Zuid-Holland"},{"StateID":"2989","State":"Flevoland"}],"C176":[{"StateID":"713","State":"Netherlands Antilles"},{"StateID":"5047","State":"Curacao"},{"StateID":"5048","State":"Bonaire"},{"StateID":"5049","State":"St Maarten"}],"C177":[{"StateID":"714","State":"New Caledonia"}],"C178":[{"StateID":"715","State":"New Zealand"},{"StateID":"3089","State":"Hawke\'s Bay"},{"StateID":"3106","State":"Marlborough"},{"StateID":"3126","State":"Southland"},{"StateID":"3129","State":"Taranaki"},{"StateID":"3137","State":"Waikato"},{"StateID":"4706","State":"Auckland"},{"StateID":"4721","State":"Wellington"},{"StateID":"4723","State":"Canterbury"},{"StateID":"4729","State":"Bay of Plenty"},{"StateID":"4741","State":"Northland"},{"StateID":"4744","State":"Otago"},{"StateID":"4814","State":"Chatham Islands"},{"StateID":"5007","State":"Gisborne"},{"StateID":"5010","State":"Nelson"},{"StateID":"5018","State":"Tasman"},{"StateID":"5019","State":"Wanganui-Manawatu"},{"StateID":"5020","State":"West Coast"}],"C179":[{"StateID":"716","State":"Nicaragua"},{"StateID":"3047","State":"Boaco"},{"StateID":"3048","State":"Carazo"},{"StateID":"3049","State":"Chinandega"},{"StateID":"3050","State":"Chontales"},{"StateID":"3051","State":"Esteli"},{"StateID":"3052","State":"Granada"},{"StateID":"3053","State":"Jinotega"},{"StateID":"3054","State":"Leon"},{"StateID":"3055","State":"Madriz"},{"StateID":"3056","State":"Managua"},{"StateID":"3057","State":"Masaya"},{"StateID":"3058","State":"Matagalpa"},{"StateID":"3059","State":"Nueva Segovia"},{"StateID":"3060","State":"Rio San Juan"},{"StateID":"3061","State":"Rivas"},{"StateID":"3063","State":"Atlantico Norte"},{"StateID":"3064","State":"Atlantico Sur"}],"C180":[{"StateID":"717","State":"Niger"},{"StateID":"2922","State":"Agadez"},{"StateID":"2923","State":"Diffa"},{"StateID":"2924","State":"Dosso"},{"StateID":"2925","State":"Maradi"},{"StateID":"2926","State":"Niamey"},{"StateID":"2927","State":"Tahoua"},{"StateID":"2928","State":"Zinder"},{"StateID":"2929","State":"Tillaberi"}],"C181":[{"StateID":"718","State":"Nigeria"},{"StateID":"2941","State":"Lagos"},{"StateID":"2942","State":"Bauchi"},{"StateID":"2943","State":"Rivers"},{"StateID":"2944","State":"Abuja Capital Territory"},{"StateID":"2946","State":"Ogun"},{"StateID":"2947","State":"Ondo"},{"StateID":"2949","State":"Plateau"},{"StateID":"2951","State":"Akwa Ibom"},{"StateID":"2952","State":"Cross River"},{"StateID":"2953","State":"Kaduna"},{"StateID":"2955","State":"Anambra"},{"StateID":"2956","State":"Benue"},{"StateID":"2957","State":"Borno"},{"StateID":"2959","State":"Kano"},{"StateID":"2960","State":"Kwara"},{"StateID":"2961","State":"Niger"},{"StateID":"2962","State":"Oyo"},{"StateID":"2963","State":"Sokoto"},{"StateID":"2964","State":"Abia"},{"StateID":"2965","State":"Adamawa"},{"StateID":"2966","State":"Delta"},{"StateID":"2967","State":"Edo"},{"StateID":"2968","State":"Enugu"},{"StateID":"2969","State":"Jigawa"},{"StateID":"2970","State":"Kebbi"},{"StateID":"2971","State":"Kogi"},{"StateID":"2972","State":"Osun"},{"StateID":"2973","State":"Taraba"},{"StateID":"2974","State":"Yobe"},{"StateID":"5074","State":"Bayelsa"},{"StateID":"5075","State":"Ebonyi"},{"StateID":"5079","State":"Ekiti"},{"StateID":"5080","State":"Gombe"},{"StateID":"5081","State":"Nassarawa"},{"StateID":"5082","State":"Zamfara"},{"StateID":"5398","State":"Imo"},{"StateID":"5399","State":"Katsina"}],"C182":[{"StateID":"719","State":"Niue"}],"C183":[{"StateID":"720","State":"Norfolk Island"}],"C184":[{"StateID":"721","State":"Northern Mariana Islands"},{"StateID":"5368","State":"Rota"},{"StateID":"5369","State":"Saipan"},{"StateID":"5370","State":"Tinian"}],"C185":[{"StateID":"722","State":"Norway"},{"StateID":"2990","State":"Akershus"},{"StateID":"2991","State":"Aust-Agder"},{"StateID":"2992","State":"Buskerud"},{"StateID":"2993","State":"Finnmark"},{"StateID":"2994","State":"Hedmark"},{"StateID":"2995","State":"Hordaland"},{"StateID":"2996","State":"More og Romsdal"},{"StateID":"2997","State":"Nordland"},{"StateID":"2998","State":"Nord-Trondelag"},{"StateID":"2999","State":"Oppland"},{"StateID":"3000","State":"Oslo"},{"StateID":"3001","State":"\u00ffstfold"},{"StateID":"3002","State":"Rogaland"},{"StateID":"3003","State":"Sogn og Fjordane"},{"StateID":"3004","State":"Sor-Trondelag"},{"StateID":"3005","State":"Telemark"},{"StateID":"3006","State":"Troms"},{"StateID":"3007","State":"Vest-Agder"},{"StateID":"3008","State":"Vestfold"}],"C186":[{"StateID":"723","State":"Oman"},{"StateID":"2846","State":"Ad Dakhiliyah"},{"StateID":"2847","State":"Al Batinah"},{"StateID":"2848","State":"Al Wusta"},{"StateID":"2849","State":"Ash Sharqiyah"},{"StateID":"2850","State":"Az Zahirah"},{"StateID":"2851","State":"Masqat"},{"StateID":"2852","State":"Musandam"},{"StateID":"2853","State":"Zufar"}],"C187":[{"StateID":"724","State":"Pakistan"},{"StateID":"3216","State":"Federally Administered Tribal Areas"},{"StateID":"3217","State":"Balochistan"},{"StateID":"3218","State":"North-West Frontier"},{"StateID":"3219","State":"Punjab"},{"StateID":"3220","State":"Sindh"},{"StateID":"3221","State":"Azad Kashmir"},{"StateID":"3222","State":"Northern Areas"},{"StateID":"3223","State":"Islamabad"}],"C188":[{"StateID":"725","State":"Palau"}],"C189":[{"StateID":"726","State":"Palmyra Atoll"}],"C190":[{"StateID":"3290","State":"Bocas del Toro"},{"StateID":"3291","State":"Chiriqui"},{"StateID":"3292","State":"Cocle"},{"StateID":"3293","State":"Colon"},{"StateID":"3294","State":"Darien"},{"StateID":"3295","State":"Herrera"},{"StateID":"3296","State":"Los Santos"},{"StateID":"3297","State":"Panama"},{"StateID":"3298","State":"San Blas"},{"StateID":"3299","State":"Veraguas"}],"C191":[{"StateID":"728","State":"Papua New Guinea"},{"StateID":"3320","State":"Central"},{"StateID":"3321","State":"Gulf"},{"StateID":"3322","State":"Milne Bay"},{"StateID":"3323","State":"Northern"},{"StateID":"3324","State":"Southern Highlands"},{"StateID":"3325","State":"Western"},{"StateID":"3326","State":"Bougainville"},{"StateID":"3327","State":"Chimbu"},{"StateID":"3328","State":"Eastern Highlands"},{"StateID":"3329","State":"East New Britain"},{"StateID":"3330","State":"East Sepik"},{"StateID":"3331","State":"Madang"},{"StateID":"3332","State":"Manus"},{"StateID":"3333","State":"Morobe"},{"StateID":"3334","State":"New Ireland"},{"StateID":"3335","State":"Western Highlands"},{"StateID":"3336","State":"West New Britain"},{"StateID":"3337","State":"Sandaun"},{"StateID":"3338","State":"Enga"},{"StateID":"3339","State":"National Capital"}],"C192":[{"StateID":"729","State":"Paracel Islands"}],"C193":[{"StateID":"730","State":"Paraguay"},{"StateID":"3170","State":"Alto Parana"},{"StateID":"3171","State":"Amambay"},{"StateID":"3172","State":"Caaguazu"},{"StateID":"3173","State":"Caazapa"},{"StateID":"3174","State":"Central"},{"StateID":"3175","State":"Concepcion"},{"StateID":"3176","State":"Cordillera"},{"StateID":"3177","State":"Guaira"},{"StateID":"3178","State":"Itapua"},{"StateID":"3179","State":"Misiones"},{"StateID":"3180","State":"Neembucu"},{"StateID":"3181","State":"Paraguari"},{"StateID":"3182","State":"Presidente Hayes"},{"StateID":"3183","State":"San Pedro"},{"StateID":"3184","State":"Canindeyu"},{"StateID":"3185","State":"Asuncion"},{"StateID":"3186","State":"Alto Paraguay"},{"StateID":"3187","State":"Boqueron"}],"C194":[{"StateID":"731","State":"Peru"},{"StateID":"3188","State":"Amazonas"},{"StateID":"3189","State":"Ancash"},{"StateID":"3190","State":"Apurimac"},{"StateID":"3191","State":"Arequipa"},{"StateID":"3192","State":"Ayacucho"},{"StateID":"3193","State":"Cajamarca"},{"StateID":"3194","State":"Callao"},{"StateID":"3195","State":"Cusco"},{"StateID":"3196","State":"Huancavelica"},{"StateID":"3197","State":"Huanuco"},{"StateID":"3198","State":"Ica"},{"StateID":"3199","State":"Junin"},{"StateID":"3200","State":"La Libertad"},{"StateID":"3201","State":"Lambayeque"},{"StateID":"3202","State":"Lima"},{"StateID":"3203","State":"Loreto"},{"StateID":"3204","State":"Madre de Dios"},{"StateID":"3205","State":"Moquegua"},{"StateID":"3206","State":"Pasco"},{"StateID":"3207","State":"Piura"},{"StateID":"3208","State":"Puno"},{"StateID":"3209","State":"San Martin"},{"StateID":"3210","State":"Tacna"},{"StateID":"3211","State":"Tumbes"},{"StateID":"3212","State":"Ucayali"}],"C195":[{"StateID":"732","State":"Philippines"},{"StateID":"3399","State":"Abra"},{"StateID":"3400","State":"Agusan del Norte"},{"StateID":"3401","State":"Agusan del Sur"},{"StateID":"3402","State":"Aklan"},{"StateID":"3403","State":"Albay"},{"StateID":"3404","State":"Antique"},{"StateID":"3405","State":"Bataan"},{"StateID":"3406","State":"Batanes"},{"StateID":"3407","State":"Batangas"},{"StateID":"3408","State":"Benguet"},{"StateID":"3409","State":"Bohol"},{"StateID":"3410","State":"Bukidnon"},{"StateID":"3411","State":"Bulacan"},{"StateID":"3412","State":"Cagayan"},{"StateID":"3413","State":"Camarines Norte"},{"StateID":"3414","State":"Camarines Sur"},{"StateID":"3415","State":"Camiguin"},{"StateID":"3416","State":"Capiz"},{"StateID":"3417","State":"Catanduanes"},{"StateID":"3418","State":"Cavite"},{"StateID":"3419","State":"Cebu"},{"StateID":"3420","State":"Basilan"},{"StateID":"3421","State":"Eastern Samar"},{"StateID":"3422","State":"Davao del Norte"},{"StateID":"3423","State":"Davao del Sur"},{"StateID":"3424","State":"Davao Oriental"},{"StateID":"3425","State":"Ifugao"},{"StateID":"3426","State":"Ilocos Norte"},{"StateID":"3427","State":"Ilocos Sur"},{"StateID":"3428","State":"Iloilo"},{"StateID":"3429","State":"Isabela"},{"StateID":"3430","State":"Kalinga-Apayao"},{"StateID":"3431","State":"Laguna"},{"StateID":"3432","State":"Lanao del Norte"},{"StateID":"3433","State":"Lanao del Sur"},{"StateID":"3434","State":"La Union"},{"StateID":"3435","State":"Leyte"},{"StateID":"3436","State":"Marinduque"},{"StateID":"3437","State":"Masbate"},{"StateID":"3438","State":"Mindoro Occidental"},{"StateID":"3439","State":"Mindoro Oriental"},{"StateID":"3440","State":"Misamis Occidental"},{"StateID":"3441","State":"Misamis Oriental"},{"StateID":"3442","State":"Mountain"},{"StateID":"3443","State":"RP45"},{"StateID":"3444","State":"Negros Oriental"},{"StateID":"3445","State":"Nueva Ecija"},{"StateID":"3446","State":"Nueva Vizcaya"},{"StateID":"3447","State":"Palawan"},{"StateID":"3448","State":"Pampanga"},{"StateID":"3449","State":"Pangasinan"},{"StateID":"3450","State":"Rizal"},{"StateID":"3451","State":"Romblon"},{"StateID":"3452","State":"Samar"},{"StateID":"3453","State":"Maguindanao"},{"StateID":"3454","State":"North Cotabato"},{"StateID":"3455","State":"Sorsogon"},{"StateID":"3456","State":"Southern Leyte"},{"StateID":"3457","State":"Sulu"},{"StateID":"3458","State":"Surigao del Norte"},{"StateID":"3459","State":"Surigao del Sur"},{"StateID":"3460","State":"Tarlac"},{"StateID":"3461","State":"Zambales"},{"StateID":"3462","State":"Zamboanga del Norte"},{"StateID":"3463","State":"Zamboanga del Sur"},{"StateID":"3464","State":"Northern Samar"},{"StateID":"3465","State":"Quirino"},{"StateID":"3466","State":"Siquijor"},{"StateID":"3467","State":"South Cotabato"},{"StateID":"3468","State":"Sultan Kudarat"},{"StateID":"3469","State":"Tawi-Tawi"},{"StateID":"3470","State":"Angeles"},{"StateID":"3471","State":"Bacolod"},{"StateID":"3472","State":"Bago"},{"StateID":"3473","State":"Baguio"},{"StateID":"3474","State":"Bais"},{"StateID":"3475","State":"Basilan City"},{"StateID":"3476","State":"Batangas City"},{"StateID":"3477","State":"Butuan"},{"StateID":"3478","State":"Cabanatuan"},{"StateID":"3479","State":"Cadiz"},{"StateID":"3480","State":"Cagayan de Oro"},{"StateID":"3481","State":"Calbayog"},{"StateID":"3482","State":"Caloocan"},{"StateID":"3483","State":"Canlaon"},{"StateID":"3484","State":"Cavite City"},{"StateID":"3485","State":"Cebu City"},{"StateID":"3486","State":"Cotabato"},{"StateID":"3487","State":"Dagupan"},{"StateID":"3488","State":"Danao"},{"StateID":"3489","State":"Dapitane"},{"StateID":"3490","State":"Davao City"},{"StateID":"3491","State":"Dipolog"},{"StateID":"3492","State":"Dumaguete"},{"StateID":"3493","State":"General Santos"},{"StateID":"3494","State":"Gingoog"},{"StateID":"3495","State":"Iligan"},{"StateID":"3496","State":"Iloilo City"},{"StateID":"3497","State":"Iriga"},{"StateID":"3498","State":"La Carlota"},{"StateID":"3499","State":"Laoag"},{"StateID":"3500","State":"LapuLapu"},{"StateID":"3501","State":"Legaspi"},{"StateID":"3502","State":"Lipa"},{"StateID":"3503","State":"Lucena"},{"StateID":"3504","State":"Mandaue"},{"StateID":"3505","State":"Manila"},{"StateID":"3506","State":"Marawi"},{"StateID":"3507","State":"Naga"},{"StateID":"3508","State":"Olongapo"},{"StateID":"3509","State":"Ormoc"},{"StateID":"3510","State":"Oroquieta"},{"StateID":"3511","State":"Ozamis"},{"StateID":"3512","State":"Pagadiane"},{"StateID":"3513","State":"Palayan"},{"StateID":"3514","State":"Pasay"},{"StateID":"3515","State":"Puerto Princesa"},{"StateID":"3516","State":"Quezon City"},{"StateID":"3517","State":"Roxas"},{"StateID":"3518","State":"Negros Occidental San Carlos"},{"StateID":"3519","State":"Pangasinan San Carlos"},{"StateID":"3520","State":"San Jose"},{"StateID":"3521","State":"San Pablo"},{"StateID":"3522","State":"Silay"},{"StateID":"3523","State":"Surigao"},{"StateID":"3524","State":"Tacloban"},{"StateID":"3525","State":"Tagaytay"},{"StateID":"3526","State":"Tagbilaran"},{"StateID":"3527","State":"Tangub"},{"StateID":"3528","State":"Toledo"},{"StateID":"3529","State":"Trece Martires"},{"StateID":"3530","State":"Zamboanga"},{"StateID":"3531","State":"Aurora"},{"StateID":"3532","State":"Quezon"},{"StateID":"3533","State":"Negros Occidental"}],"C196":[{"StateID":"733","State":"Pitcairn Islands"}],"C197":[{"StateID":"734","State":"Poland"},{"StateID":"3274","State":"Dolnoslaskie"},{"StateID":"3275","State":"Kujawsko-Pomorskie"},{"StateID":"3276","State":"Lodzkie"},{"StateID":"3277","State":"Lubelskie"},{"StateID":"3278","State":"Lubuskie"},{"StateID":"3279","State":"Malopolskie"},{"StateID":"3280","State":"Mazowieckie"},{"StateID":"3281","State":"Opolskie"},{"StateID":"3282","State":"Podkarpackie"},{"StateID":"3283","State":"Podlaskie"},{"StateID":"3284","State":"Pomorskie"},{"StateID":"3285","State":"Slaskie"},{"StateID":"3286","State":"Swietokrzyskie"},{"StateID":"3287","State":"Warminsko-Mazurskie"},{"StateID":"3288","State":"Wielkopolskie"},{"StateID":"3289","State":"Zachodniopomorskie"}],"C198":[{"StateID":"735","State":"Portugal"},{"StateID":"3300","State":"Aveiro"},{"StateID":"3301","State":"Beja"},{"StateID":"3302","State":"Braga"},{"StateID":"3303","State":"Braganca"},{"StateID":"3304","State":"Castelo Branco"},{"StateID":"3305","State":"Coimbra"},{"StateID":"3306","State":"Evora"},{"StateID":"3307","State":"Faro"},{"StateID":"3308","State":"Madeira"},{"StateID":"3309","State":"Guarda"},{"StateID":"3310","State":"Leiria"},{"StateID":"3311","State":"Lisboa"},{"StateID":"3312","State":"Portalegre"},{"StateID":"3313","State":"Porto"},{"StateID":"3314","State":"Santarem"},{"StateID":"3315","State":"Setubal"},{"StateID":"3316","State":"Viana do Castelo"},{"StateID":"3317","State":"Vila Real"},{"StateID":"3318","State":"Viseu"},{"StateID":"3319","State":"Azores"}],"C199":[{"StateID":"736","State":"Puerto Rico"}],"C200":[{"StateID":"737","State":"Qatar"},{"StateID":"3349","State":"Ad Dawhah"},{"StateID":"3350","State":"Al Ghuwayriyah"},{"StateID":"3351","State":"Al Jumayliyah"},{"StateID":"3352","State":"Al Khawr"},{"StateID":"3353","State":"Al Wakrah"},{"StateID":"3354","State":"Ar Rayyan"},{"StateID":"3355","State":"Jarayan al Batinah"},{"StateID":"3356","State":"Madinat ash Shamal"},{"StateID":"3357","State":"Umm Salal"}],"C201":[{"StateID":"738","State":"R\u00e9union"}],"C202":[{"StateID":"739","State":"Romania"},{"StateID":"3358","State":"Alba"},{"StateID":"3359","State":"Arad"},{"StateID":"3360","State":"Arges"},{"StateID":"3361","State":"Bacau"},{"StateID":"3362","State":"Bihor"},{"StateID":"3363","State":"Bistrita-Nasaud"},{"StateID":"3364","State":"Botosani"},{"StateID":"3365","State":"Braila"},{"StateID":"3366","State":"Brasov"},{"StateID":"3367","State":"Bucuresti"},{"StateID":"3368","State":"Buzau"},{"StateID":"3369","State":"Caras-Severin"},{"StateID":"3370","State":"Cluj"},{"StateID":"3371","State":"Constanta"},{"StateID":"3372","State":"Covasna"},{"StateID":"3373","State":"Dambovita"},{"StateID":"3374","State":"Dolj"},{"StateID":"3375","State":"Galati"},{"StateID":"3376","State":"Gorj"},{"StateID":"3377","State":"Harghita"},{"StateID":"3378","State":"Hunedoara"},{"StateID":"3379","State":"Ialomita"},{"StateID":"3380","State":"Iasi"},{"StateID":"3381","State":"Maramures"},{"StateID":"3382","State":"Mehedinti"},{"StateID":"3383","State":"Mures"},{"StateID":"3384","State":"Neamt"},{"StateID":"3385","State":"Olt"},{"StateID":"3386","State":"Prahova"},{"StateID":"3387","State":"Salaj"},{"StateID":"3388","State":"Satu Mare"},{"StateID":"3389","State":"Sibiu"},{"StateID":"3390","State":"Suceava"},{"StateID":"3391","State":"Teleorman"},{"StateID":"3392","State":"Timis"},{"StateID":"3393","State":"Tulcea"},{"StateID":"3394","State":"Vaslui"},{"StateID":"3395","State":"Valcea"},{"StateID":"3396","State":"Vrancea"},{"StateID":"3397","State":"Calarasi"},{"StateID":"3398","State":"Giurgiu"}],"C203":[{"StateID":"91","State":"Komi"},{"StateID":"105","State":"Dagestan"},{"StateID":"106","State":"Mariy-El"},{"StateID":"110","State":"Tatarstan"},{"StateID":"740","State":"Russia"},{"StateID":"3534","State":"Adygeya"},{"StateID":"3535","State":"Aginskiy Buryatskiy Avtonomnyy Okrug"},{"StateID":"3536","State":"Altay"},{"StateID":"3537","State":"Altayskiy Kray"},{"StateID":"3538","State":"Amurskaya Oblast\'"},{"StateID":"3539","State":"Arkhangel\'skaya Oblast\'"},{"StateID":"3540","State":"Astrakhanskaya Oblast\'"},{"StateID":"3541","State":"Bashkortostan"},{"StateID":"3542","State":"Belgorodskaya Oblast\'"},{"StateID":"3543","State":"Bryanskaya Oblast\'"},{"StateID":"3544","State":"Buryatiya"},{"StateID":"3545","State":"Chechnya"},{"StateID":"3546","State":"Chelyabinskaya Oblast\'"},{"StateID":"3547","State":"Chitinskaya Oblast\'"},{"StateID":"3548","State":"Chukotskiy Avtonomnyy Okrug"},{"StateID":"3549","State":"Chuvashiya"},{"StateID":"3550","State":"Evenkiyskiy Avtonomnyy Okrug"},{"StateID":"3551","State":"Ingushetiya"},{"StateID":"3552","State":"Irkutskaya Oblast\'"},{"StateID":"3553","State":"Ivanovskaya Oblast\'"},{"StateID":"3554","State":"Kabardino-Balkariya"},{"StateID":"3555","State":"Kaliningradskaya Oblast\'"},{"StateID":"3556","State":"Kalmykiya"},{"StateID":"3557","State":"Kaluzhskaya Oblast\'"},{"StateID":"3558","State":"Kamchatskaya Oblast\'"},{"StateID":"3559","State":"Karachayevo-Cherkesiya"},{"StateID":"3560","State":"Kareliya"},{"StateID":"3561","State":"Kemerovskaya Oblast\'"},{"StateID":"3562","State":"Khabarovskiy Kray"},{"StateID":"3563","State":"Khakasiya"},{"StateID":"3564","State":"Khanty-Mansiyskiy Avtonomnyy Okrug"},{"StateID":"3565","State":"Kirovskaya Oblast\'"},{"StateID":"3566","State":"Komi-Permyatskiy Avtonomnyy Okrug"},{"StateID":"3567","State":"Koryakskiy Avtonomnyy Okrug"},{"StateID":"3568","State":"Kostromskaya Oblast\'"},{"StateID":"3569","State":"Krasnodarskiy Kray"},{"StateID":"3570","State":"Krasnoyarskiy Kray"},{"StateID":"3571","State":"Kurganskaya Oblast\'"},{"StateID":"3572","State":"Kurskaya Oblast\'"},{"StateID":"3573","State":"Leningradskaya Oblast\'"},{"StateID":"3574","State":"Lipetskaya Oblast\'"},{"StateID":"3575","State":"Magadanskaya Oblast\'"},{"StateID":"3576","State":"Mordoviya"},{"StateID":"3577","State":"Moskovskaya Oblast\'"},{"StateID":"3578","State":"Moskva"},{"StateID":"3579","State":"Murmanskaya Oblast\'"},{"StateID":"3580","State":"Nenetskiy Avtonomnyy Okrug"},{"StateID":"3581","State":"Nizhegorodskaya Oblast\'"},{"StateID":"3582","State":"Novgorodskaya Oblast\'"},{"StateID":"3583","State":"Novosibirskaya Oblast\'"},{"StateID":"3584","State":"Omskaya Oblast\'"},{"StateID":"3585","State":"Orenburgskaya Oblast\'"},{"StateID":"3586","State":"Orlovskaya Oblast\'"},{"StateID":"3587","State":"Penzenskaya Oblast\'"},{"StateID":"3588","State":"Permskaya Oblast\'"},{"StateID":"3589","State":"Primorskiy Kray"},{"StateID":"3590","State":"Pskovskaya Oblast\'"},{"StateID":"3591","State":"Rostovskaya Oblast\'"},{"StateID":"3592","State":"Ryazanskaya Oblast\'"},{"StateID":"3593","State":"Sakha (Yakutiya)"},{"StateID":"3594","State":"Sakhalinskaya Oblast\'"},{"StateID":"3595","State":"Samarskaya Oblast\'"},{"StateID":"3596","State":"Sankt-Peterburg"},{"StateID":"3597","State":"Saratovskaya Oblast\'"},{"StateID":"3598","State":"Severnaya Osetiya-Alaniya"},{"StateID":"3599","State":"Smolenskaya Oblast\'"},{"StateID":"3600","State":"Stavropol\'skiy Kray"},{"StateID":"3601","State":"Sverdlovskaya Oblast\'"},{"StateID":"3602","State":"Tambovskaya Oblast\'"},{"StateID":"3603","State":"Taymyrskiy Dolgano-Nenetskiy Avtonomnyy Okrug"},{"StateID":"3604","State":"Tomskaya Oblast\'"},{"StateID":"3605","State":"Tul\'skaya Oblast\'"},{"StateID":"3606","State":"Tverskaya Oblast\'"},{"StateID":"3607","State":"Tyumenskaya Oblast\'"},{"StateID":"3608","State":"Udmurtiya"},{"StateID":"3609","State":"Ul\'yanovskaya Oblast\'"},{"StateID":"3610","State":"Ust\'-Ordynskiy Buryatskiy Avtonomnyy Okrug"},{"StateID":"3611","State":"Vladimirskaya Oblast\'"},{"StateID":"3612","State":"Volgogradskaya Oblast\'"},{"StateID":"3613","State":"Vologodskaya oblast\'"},{"StateID":"3614","State":"Voronezhskaya Oblast\'"},{"StateID":"3615","State":"Yamalo-Nenetskiy Avtonomnyy Okrug"},{"StateID":"3616","State":"Yaroslavskaya Oblast\'"},{"StateID":"3617","State":"Yevreyskaya Avtonomnyy Oblast\'"},{"StateID":"5120","State":"Tyva"}],"C204":[{"StateID":"741","State":"Rwanda"},{"StateID":"3619","State":"Butare"},{"StateID":"3620","State":"Byumba"},{"StateID":"3621","State":"Cyangugu"},{"StateID":"3622","State":"Gikongoro"},{"StateID":"3623","State":"Gisenyi"},{"StateID":"3624","State":"Gitarama"},{"StateID":"3625","State":"Kibungo"},{"StateID":"3626","State":"Kibuye"},{"StateID":"3627","State":"Kigali-Rural"},{"StateID":"3628","State":"Ruhengeri"},{"StateID":"5371","State":"Kigali-Ville"},{"StateID":"5372","State":"Umutara"}],"C205":[{"StateID":"3700","State":"Ascension"},{"StateID":"3701","State":"Saint Helena"},{"StateID":"3702","State":"Tristan da Cunha"}],"C206":[{"StateID":"743","State":"Saint Kitts and Nevis"},{"StateID":"3643","State":"Christ Church Nicholatown"},{"StateID":"3644","State":"Saint Anne Sandy Point"},{"StateID":"3645","State":"Saint George Basseterre"},{"StateID":"3646","State":"Saint George Gingerland"},{"StateID":"3647","State":"Saint James Windward"},{"StateID":"3648","State":"Saint John Capesterre"},{"StateID":"3649","State":"Saint John Figtree"},{"StateID":"3650","State":"Saint Mary Cayon"},{"StateID":"3651","State":"Saint Paul Capesterre"},{"StateID":"3652","State":"Saint Paul Charlestown"},{"StateID":"3653","State":"Saint Peter Basseterre"},{"StateID":"3654","State":"Saint Thomas Lowland"},{"StateID":"3655","State":"Saint Thomas Middle Island"},{"StateID":"3656","State":"Trinity Palmetto Point"}],"C207":[{"StateID":"744","State":"Saint Lucia"},{"StateID":"3942","State":"Anse-la-Raye"},{"StateID":"3943","State":"Dauphin"},{"StateID":"3944","State":"Castries"},{"StateID":"3945","State":"Choiseul"},{"StateID":"3946","State":"Dennery"},{"StateID":"3947","State":"Gros-Islet"},{"StateID":"3948","State":"Laborie"},{"StateID":"3949","State":"Micoud"},{"StateID":"3950","State":"Soufriere"},{"StateID":"3951","State":"Vieux-Fort"},{"StateID":"3952","State":"Praslin"}],"C208":[{"StateID":"745","State":"Saint Pierre and Miquelon"}],"C209":[{"StateID":"746","State":"Saint Vincent and the Grenadines"},{"StateID":"4520","State":"Charlotte"},{"StateID":"4521","State":"Saint Andrew"},{"StateID":"4522","State":"Saint David"},{"StateID":"4523","State":"Saint George"},{"StateID":"4524","State":"Saint Patrick"},{"StateID":"4525","State":"Grenadines"}],"C210":[{"StateID":"747","State":"Samoa"},{"StateID":"4648","State":"A\'ana"},{"StateID":"4649","State":"Aiga-i-le-Tai"},{"StateID":"4650","State":"Atua"},{"StateID":"4651","State":"Fa\'asaleleaga"},{"StateID":"4652","State":"Gaga\'emauga"},{"StateID":"4653","State":"Va\'a-o-Fonoti"},{"StateID":"4654","State":"Gagaifomauga"},{"StateID":"4655","State":"Palauli"},{"StateID":"4656","State":"Satupa\'itea"},{"StateID":"4657","State":"Tuamasaga"},{"StateID":"4658","State":"Vaisigano"}],"C211":[{"StateID":"3854","State":"Acquaviva"},{"StateID":"3855","State":"Chiesanuova"},{"StateID":"3856","State":"Domagnano"},{"StateID":"3857","State":"Faetano"},{"StateID":"3858","State":"Fiorentino"},{"StateID":"3859","State":"Borgo Maaggiore"},{"StateID":"3860","State":"San Marino"},{"StateID":"3861","State":"Monte Giardino"},{"StateID":"3862","State":"Serravalle"}],"C212":[{"StateID":"4167","State":"Principe"},{"StateID":"4168","State":"Sao Tome"}],"C213":[{"StateID":"750","State":"Saudi Arabia"},{"StateID":"3629","State":"Al Bahah"},{"StateID":"3630","State":"Al Madinah"},{"StateID":"3631","State":"Ash Sharqiyah"},{"StateID":"3632","State":"Al Qasim"},{"StateID":"3633","State":"Ar Riyad"},{"StateID":"3634","State":"\'Asir"},{"StateID":"3635","State":"Ha\'il"},{"StateID":"3636","State":"Makkah"},{"StateID":"3637","State":"Al Hudud ash Shamaliyah"},{"StateID":"3638","State":"Najran"},{"StateID":"3639","State":"Jizan"},{"StateID":"3640","State":"Tabuk"},{"StateID":"3641","State":"Al Jawf"}],"C214":[{"StateID":"751","State":"Senegal"},{"StateID":"3690","State":"Dakar"},{"StateID":"3691","State":"Diourbel"},{"StateID":"3692","State":"Saint-Louis"},{"StateID":"3693","State":"Tambacounda"},{"StateID":"3694","State":"Thies"},{"StateID":"3695","State":"Louga"},{"StateID":"3696","State":"Fatick"},{"StateID":"3697","State":"Kaolack"},{"StateID":"3698","State":"Kolda"},{"StateID":"3699","State":"Ziguinchor"}],"C215":[{"StateID":"752","State":"Serbia"}],"C216":[{"StateID":"753","State":"Serbia and Montenegro"}],"C217":[{"StateID":"754","State":"Seychelles"},{"StateID":"3657","State":"Anse aux Pins"},{"StateID":"3658","State":"Anse Boileau"},{"StateID":"3659","State":"Anse Etoile"},{"StateID":"3660","State":"Anse Louis"},{"StateID":"3661","State":"Anse Royale"},{"StateID":"3662","State":"Baie Lazare"},{"StateID":"3663","State":"Baie Sainte Anne"},{"StateID":"3664","State":"Beau Vallon"},{"StateID":"3665","State":"Bel Air"},{"StateID":"3666","State":"Bel Ombre"},{"StateID":"3667","State":"Cascade"},{"StateID":"3668","State":"Glacis"},{"StateID":"3669","State":"Grand\' Anse"},{"StateID":"3670","State":"La Digue"},{"StateID":"3671","State":"La Riviere Anglaise"},{"StateID":"3672","State":"Mont Buxton"},{"StateID":"3673","State":"Mont Fleuri"},{"StateID":"3674","State":"Plaisance"},{"StateID":"3675","State":"Pointe La Rue"},{"StateID":"3676","State":"Port Glaud"},{"StateID":"3677","State":"Saint Louis"},{"StateID":"3678","State":"Takamaka"}],"C218":[{"StateID":"755","State":"Sierra Leone"},{"StateID":"3850","State":"Eastern"},{"StateID":"3851","State":"Northern"},{"StateID":"3852","State":"Southern"},{"StateID":"3853","State":"Western Area"}],"C219":[{"StateID":"756","State":"Singapore"}],"C220":[{"StateID":"757","State":"Slovakia"},{"StateID":"2588","State":"Banskobystricky"},{"StateID":"2589","State":"Bratislavsky"},{"StateID":"2590","State":"Kosicky"},{"StateID":"2591","State":"Nitrinsky"},{"StateID":"2592","State":"Presovsky"},{"StateID":"2593","State":"Treciansky"},{"StateID":"2594","State":"Trnavsky"},{"StateID":"2595","State":"Zilinsky"}],"C221":[{"StateID":"758","State":"Slovenia"},{"StateID":"3703","State":"Ajdovscina"},{"StateID":"3704","State":"Beltinci"},{"StateID":"3705","State":"Bled"},{"StateID":"3706","State":"Bohinj"},{"StateID":"3707","State":"Borovnica"},{"StateID":"3708","State":"Bovec"},{"StateID":"3709","State":"Brda"},{"StateID":"3710","State":"Brezice"},{"StateID":"3711","State":"Brezovica"},{"StateID":"3712","State":"Cankova-Tisina"},{"StateID":"3713","State":"Celje"},{"StateID":"3714","State":"Cerklje Na Gorenjskem"},{"StateID":"3715","State":"Cerknica"},{"StateID":"3716","State":"Cerkno"},{"StateID":"3717","State":"Crensovci"},{"StateID":"3718","State":"Crna na Koroskem"},{"StateID":"3719","State":"Crnomelj"},{"StateID":"3720","State":"Destrnik-Trnovska Vas"},{"StateID":"3721","State":"Divaca"},{"StateID":"3722","State":"Dobrepolje"},{"StateID":"3723","State":"Dobrova-Horjul-Polhov Gradec"},{"StateID":"3724","State":"Dol pri Ljubljani"},{"StateID":"3725","State":"Domzale"},{"StateID":"3726","State":"Dornava"},{"StateID":"3727","State":"Dravograd"},{"StateID":"3728","State":"Duplek"},{"StateID":"3729","State":"Gorenja Vas-Poljane"},{"StateID":"3730","State":"Gorisnica"},{"StateID":"3731","State":"Gornja Radgona"},{"StateID":"3732","State":"Gornji Grad"},{"StateID":"3733","State":"Gornji Petrovci"},{"StateID":"3734","State":"Grosuplje"},{"StateID":"3735","State":"HodosSalovci"},{"StateID":"3736","State":"Hrastnik"},{"StateID":"3737","State":"Hrpelje-Kozina"},{"StateID":"3738","State":"Idrija"},{"StateID":"3739","State":"Ig"},{"StateID":"3740","State":"Ilirska Bistrica"},{"StateID":"3741","State":"Ivancna Gorica"},{"StateID":"3742","State":"Izola"},{"StateID":"3743","State":"Jesenice"},{"StateID":"3744","State":"Jursinci"},{"StateID":"3745","State":"Kamnik"},{"StateID":"3746","State":"Kanal"},{"StateID":"3747","State":"Kidricevo"},{"StateID":"3748","State":"Kobarid"},{"StateID":"3749","State":"Kobilje"},{"StateID":"3750","State":"Kocevje"},{"StateID":"3751","State":"Komen"},{"StateID":"3752","State":"Koper"},{"StateID":"3753","State":"Kozje"},{"StateID":"3754","State":"Kranj"},{"StateID":"3755","State":"Kranjska Gora"},{"StateID":"3756","State":"Krsko"},{"StateID":"3757","State":"Kungota"},{"StateID":"3758","State":"Kuzma"},{"StateID":"3759","State":"Lasko"},{"StateID":"3760","State":"Lenart"},{"StateID":"3761","State":"Lendava"},{"StateID":"3762","State":"Litija"},{"StateID":"3763","State":"Ljubljana"},{"StateID":"3764","State":"Ljubno"},{"StateID":"3765","State":"Ljutomer"},{"StateID":"3766","State":"Logatec"},{"StateID":"3767","State":"Loska Dolina"},{"StateID":"3768","State":"Loski Potok"},{"StateID":"3769","State":"Luce"},{"StateID":"3770","State":"Lukovica"},{"StateID":"3771","State":"Majsperk"},{"StateID":"3772","State":"Maribor"},{"StateID":"3773","State":"Medvode"},{"StateID":"3774","State":"Menges"},{"StateID":"3775","State":"Metlika"},{"StateID":"3776","State":"Mezica"},{"StateID":"3777","State":"Miren-Kostanjevica"},{"StateID":"3778","State":"Mislinja"},{"StateID":"3779","State":"Moravce"},{"StateID":"3780","State":"Moravske Toplice"},{"StateID":"3781","State":"Mozirje"},{"StateID":"3782","State":"Murska Sobota"},{"StateID":"3783","State":"Muta"},{"StateID":"3784","State":"Naklo"},{"StateID":"3785","State":"Nazarje"},{"StateID":"3786","State":"Nova Gorica"},{"StateID":"3787","State":"Novo Mesto"},{"StateID":"3788","State":"Odranci"},{"StateID":"3789","State":"Ormoz"},{"StateID":"3790","State":"Osilnica"},{"StateID":"3791","State":"Pesnica"},{"StateID":"3792","State":"Piran"},{"StateID":"3793","State":"Pivka"},{"StateID":"3794","State":"Podcetrtek"},{"StateID":"3795","State":"Podvelka-Ribnica"},{"StateID":"3796","State":"Postojna"},{"StateID":"3797","State":"Preddvor"},{"StateID":"3798","State":"Ptuj"},{"StateID":"3799","State":"Puconci"},{"StateID":"3800","State":"Race-Fram"},{"StateID":"3801","State":"Radece"},{"StateID":"3802","State":"Radenci"},{"StateID":"3803","State":"Radlje ob Dravi"},{"StateID":"3804","State":"Radovljica"},{"StateID":"3805","State":"Ravne-Prevalje"},{"StateID":"3806","State":"Ribnica"},{"StateID":"3807","State":"Rogasevci"},{"StateID":"3808","State":"Rogaska Slatina"},{"StateID":"3809","State":"Rogatec"},{"StateID":"3810","State":"Ruse"},{"StateID":"3811","State":"Semic"},{"StateID":"3812","State":"Sencur"},{"StateID":"3813","State":"Sentilj"},{"StateID":"3814","State":"Sentjernej"},{"StateID":"3815","State":"Sentjur pri Celju"},{"StateID":"3816","State":"Sevnica"},{"StateID":"3817","State":"Sezana"},{"StateID":"3818","State":"Skocjan"},{"StateID":"3819","State":"Skofja Loka"},{"StateID":"3820","State":"Skofljica"},{"StateID":"3821","State":"Slovenj Gradec"},{"StateID":"3822","State":"Slovenska Bistrica"},{"StateID":"3823","State":"Slovenske Konjice"},{"StateID":"3824","State":"Smarje pri Jelsah"},{"StateID":"3825","State":"Smartno ob Paki"},{"StateID":"3826","State":"Sostanj"},{"StateID":"3827","State":"Starse"},{"StateID":"3828","State":"Store"},{"StateID":"3829","State":"Sveti Jurij"},{"StateID":"3830","State":"Tolmin"},{"StateID":"3831","State":"Trbovlje"},{"StateID":"3832","State":"Trebnje"},{"StateID":"3833","State":"Trzic"},{"StateID":"3834","State":"Turnisce"},{"StateID":"3835","State":"Velenje"},{"StateID":"3836","State":"Velike Lasce"},{"StateID":"3837","State":"Videm"},{"StateID":"3838","State":"Vipava"},{"StateID":"3839","State":"Vitanje"},{"StateID":"3840","State":"Vodice"},{"StateID":"3841","State":"Vojnik"},{"StateID":"3842","State":"Vrhnika"},{"StateID":"3843","State":"Vuzenica"},{"StateID":"3844","State":"Zagorje ob Savi"},{"StateID":"3845","State":"Zalec"},{"StateID":"3846","State":"Zavrc"},{"StateID":"3847","State":"Zelezniki"},{"StateID":"3848","State":"Ziri"},{"StateID":"3849","State":"Zrece"}],"C222":[{"StateID":"759","State":"Solomon Islands"},{"StateID":"1210","State":"Malaita"},{"StateID":"1211","State":"Western"},{"StateID":"1212","State":"Central"},{"StateID":"1213","State":"Guadalcanal"},{"StateID":"1214","State":"Isabel"},{"StateID":"1215","State":"Makira"},{"StateID":"1216","State":"Temotu"}],"C223":[{"StateID":"760","State":"Somalia"},{"StateID":"3863","State":"Bakool"},{"StateID":"3864","State":"Banaadir"},{"StateID":"3865","State":"Bari"},{"StateID":"3866","State":"Bay"},{"StateID":"3867","State":"Galguduud"},{"StateID":"3868","State":"Gedo"},{"StateID":"3869","State":"Hiiraan"},{"StateID":"3870","State":"Jubbada Dhexe"},{"StateID":"3871","State":"Jubbada Hoose"},{"StateID":"3872","State":"Mudug"},{"StateID":"3873","State":"Nugaal"},{"StateID":"3874","State":"Sanaag"},{"StateID":"3875","State":"Shabeellaha Dhexe"},{"StateID":"3876","State":"Shabeellaha Hoose"},{"StateID":"3877","State":"Togdheer"},{"StateID":"3878","State":"Woqooyi Galbeed"}],"C224":[{"StateID":"761","State":"South Africa"},{"StateID":"3680","State":"KwaZulu-Natal"},{"StateID":"3681","State":"Free State"},{"StateID":"3683","State":"Eastern Cape"},{"StateID":"3684","State":"Gauteng"},{"StateID":"3685","State":"Mpumalanga"},{"StateID":"3686","State":"Northern Cape"},{"StateID":"3687","State":"Northern Province"},{"StateID":"3688","State":"North-West"},{"StateID":"3689","State":"Western Cape"}],"C226":[{"StateID":"763","State":"Spain"},{"StateID":"3886","State":"Islas Baleares"},{"StateID":"3906","State":"La Rioja"},{"StateID":"3908","State":"Madrid"},{"StateID":"3910","State":"Murcia"},{"StateID":"3911","State":"Navarra"},{"StateID":"3913","State":"Asturias"},{"StateID":"3918","State":"Cantabria"},{"StateID":"3930","State":"Andalucia"},{"StateID":"3931","State":"Aragon"},{"StateID":"3932","State":"Canarias"},{"StateID":"3933","State":"Castilla-La Mancha"},{"StateID":"3934","State":"Castilla y Leon"},{"StateID":"3935","State":"Catalu\u00f1a"},{"StateID":"3936","State":"Extremadura"},{"StateID":"3937","State":"Galicia"},{"StateID":"3938","State":"Pais Vasco"},{"StateID":"3939","State":"Valenciana"}],"C227":[{"StateID":"764","State":"Spratly Islands"}],"C228":[{"StateID":"765","State":"Sri Lanka"},{"StateID":"1306","State":"Central"},{"StateID":"1307","State":"North Central"},{"StateID":"1308","State":"North Eastern"},{"StateID":"1309","State":"North Western"},{"StateID":"1310","State":"Sabaragamuwa"},{"StateID":"1311","State":"Southern"},{"StateID":"1312","State":"Uva"},{"StateID":"1313","State":"Western"}],"C229":[{"StateID":"766","State":"Sudan"},{"StateID":"3953","State":"A\'ali an Nil"},{"StateID":"3956","State":"Al Khartum"},{"StateID":"3957","State":"Ash Shamaliyah"},{"StateID":"3962","State":"Al Babr al Ahmar"},{"StateID":"3963","State":"Al Buhayrat"},{"StateID":"3964","State":"Al Jazirah"},{"StateID":"3965","State":"Al Qadarif"},{"StateID":"3966","State":"Al Wahdah"},{"StateID":"3967","State":"An Nil al Abyad"},{"StateID":"3968","State":"An Nil al Azraq"},{"StateID":"3969","State":"Bahr al Jabal"},{"StateID":"3970","State":"Gharb al Istiwa\'iyah"},{"StateID":"3971","State":"Gharb Bahr al Ghazal"},{"StateID":"3972","State":"Gharb Darfur"},{"StateID":"3973","State":"Gharb Kurdufan"},{"StateID":"3974","State":"Janub Darfur"},{"StateID":"3975","State":"Janub Kurdufan"},{"StateID":"3976","State":"Junqali"},{"StateID":"3977","State":"Kassala"},{"StateID":"3978","State":"Nahr an Nil"},{"StateID":"3979","State":"Shamal Bahr al Ghazal"},{"StateID":"3980","State":"Shamal Darfur"},{"StateID":"3981","State":"Shamal Kurdufan"},{"StateID":"3982","State":"Sharq al Istiwa\'iyah"},{"StateID":"3983","State":"Sinnar"},{"StateID":"3984","State":"Warab"}],"C230":[{"StateID":"767","State":"Suriname"},{"StateID":"3037","State":"Brokopondo"},{"StateID":"3038","State":"Commewijne"},{"StateID":"3039","State":"Coronie"},{"StateID":"3040","State":"Marowijne"},{"StateID":"3041","State":"Nickerie"},{"StateID":"3042","State":"Para"},{"StateID":"3043","State":"Paramaribo"},{"StateID":"3044","State":"Saramacca"},{"StateID":"3045","State":"Sipaliwini"},{"StateID":"3046","State":"Wanica"}],"C231":[{"StateID":"768","State":"Svalbard"}],"C232":[{"StateID":"769","State":"Swaziland"},{"StateID":"4659","State":"Hhohho"},{"StateID":"4660","State":"Lubombo"},{"StateID":"4661","State":"Manzini"},{"StateID":"4662","State":"Shiselweni"}],"C233":[{"StateID":"770","State":"Sweden"},{"StateID":"3986","State":"Blekinge Lan"},{"StateID":"3987","State":"Gavleborgs Lan"},{"StateID":"3989","State":"Gotlands Lan"},{"StateID":"3990","State":"Hallands Lan"},{"StateID":"3991","State":"Jamtlands Lan"},{"StateID":"3992","State":"Jonkopings Lan"},{"StateID":"3993","State":"Kalmar Lan"},{"StateID":"3994","State":"Dalarnas Lan"},{"StateID":"3996","State":"Kronobergs Lan"},{"StateID":"3998","State":"Norrbottens Lan"},{"StateID":"3999","State":"Orebro Lan"},{"StateID":"4000","State":"Ostergotlands Lan"},{"StateID":"4002","State":"Sodermanlands Lan"},{"StateID":"4003","State":"Uppsala Lan"},{"StateID":"4004","State":"Varmlands Lan"},{"StateID":"4005","State":"Vasterbottens Lan"},{"StateID":"4006","State":"Vasternorrlands Lan"},{"StateID":"4007","State":"Vastmanlands Lan"},{"StateID":"4008","State":"Stockholms Lan"},{"StateID":"4009","State":"Skane Lan"},{"StateID":"4010","State":"Vastra Gotaland"}],"C234":[{"StateID":"771","State":"Switzerland"},{"StateID":"4025","State":"Aargau"},{"StateID":"4026","State":"Ausser-Rhoden"},{"StateID":"4027","State":"Basel-Landschaft"},{"StateID":"4028","State":"Basel-Stadt"},{"StateID":"4029","State":"Bern"},{"StateID":"4030","State":"Fribourg"},{"StateID":"4031","State":"Geneve"},{"StateID":"4032","State":"Glarus"},{"StateID":"4033","State":"Graubunden"},{"StateID":"4034","State":"Inner-Rhoden"},{"StateID":"4035","State":"Luzern"},{"StateID":"4036","State":"Neuchatel"},{"StateID":"4037","State":"Nidwalden"},{"StateID":"4038","State":"Obwalden"},{"StateID":"4039","State":"Sankt Gallen"},{"StateID":"4040","State":"Schaffhausen"},{"StateID":"4041","State":"Schwyz"},{"StateID":"4042","State":"Solothurn"},{"StateID":"4043","State":"Thurgau"},{"StateID":"4044","State":"Ticino"},{"StateID":"4045","State":"Uri"},{"StateID":"4046","State":"Valais"},{"StateID":"4047","State":"Vaud"},{"StateID":"4048","State":"Zug"},{"StateID":"4049","State":"Zurich"},{"StateID":"4050","State":"Jura"}],"C235":[{"StateID":"772","State":"Syria"},{"StateID":"4011","State":"Al Hasakah"},{"StateID":"4012","State":"Al Ladhiqiyah"},{"StateID":"4013","State":"Al Qunaytirah"},{"StateID":"4014","State":"Ar Raqqah"},{"StateID":"4015","State":"As Suwayda\'"},{"StateID":"4016","State":"Dar\'a"},{"StateID":"4017","State":"Dayr az Zawr"},{"StateID":"4018","State":"Rif Dimashq"},{"StateID":"4019","State":"Halab"},{"StateID":"4020","State":"Hamah"},{"StateID":"4021","State":"Hims"},{"StateID":"4022","State":"Idlib"},{"StateID":"4023","State":"Dimashq"},{"StateID":"4024","State":"Tartus"}],"C236":[{"StateID":"773","State":"Taiwan"},{"StateID":"4272","State":"Fu-chien"},{"StateID":"4273","State":"Kao-hsiung"},{"StateID":"4274","State":"T\'ai-pei"},{"StateID":"4275","State":"T\'ai-wan"}],"C237":[{"StateID":"774","State":"Tajikistan"},{"StateID":"4140","State":"Kuhistoni Badakhshon"},{"StateID":"4141","State":"Khatlon"},{"StateID":"4142","State":"Leninobod"}],"C238":[{"StateID":"775","State":"Tanzania"},{"StateID":"4276","State":"Arusha"},{"StateID":"4277","State":"Dar es Salaam"},{"StateID":"4278","State":"Dodoma"},{"StateID":"4279","State":"Iringa"},{"StateID":"4280","State":"Kigoma"},{"StateID":"4281","State":"Kilimanjaro"},{"StateID":"4282","State":"Lindi"},{"StateID":"4283","State":"Mara"},{"StateID":"4284","State":"Mbeya"},{"StateID":"4285","State":"Morogoro"},{"StateID":"4286","State":"Mtwara"},{"StateID":"4287","State":"Mwanza"},{"StateID":"4288","State":"Pemba North"},{"StateID":"4289","State":"Ruvuma"},{"StateID":"4290","State":"Shinyanga"},{"StateID":"4291","State":"Singida"},{"StateID":"4292","State":"Tabora"},{"StateID":"4293","State":"Tanga"},{"StateID":"4294","State":"Kagera"},{"StateID":"4295","State":"Pemba South"},{"StateID":"4296","State":"Zanzibar Central\/\/South"},{"StateID":"4297","State":"Zanzibar North"},{"StateID":"4298","State":"Rukwa"},{"StateID":"4299","State":"Zanzibar Urban\/\/West"},{"StateID":"5364","State":"Pwani"}],"C239":[{"StateID":"776","State":"Thailand"},{"StateID":"4063","State":"Mae Hong Son"},{"StateID":"4064","State":"Chiang Mai"},{"StateID":"4065","State":"Chiang Rai"},{"StateID":"4066","State":"Nan"},{"StateID":"4067","State":"Lamphun"},{"StateID":"4068","State":"Lampang"},{"StateID":"4069","State":"Phrae"},{"StateID":"4070","State":"Tak"},{"StateID":"4071","State":"Sukhothai"},{"StateID":"4072","State":"Uttaradit"},{"StateID":"4073","State":"Kamphaeng Phet"},{"StateID":"4074","State":"Phitsanulok"},{"StateID":"4075","State":"Phichit"},{"StateID":"4076","State":"Phetchabun"},{"StateID":"4077","State":"Uthai Thani"},{"StateID":"4078","State":"Nakhon Sawan"},{"StateID":"4079","State":"Nong Khai"},{"StateID":"4080","State":"Loei"},{"StateID":"4081","State":"Udon Thani"},{"StateID":"4082","State":"Sakon Nakhon"},{"StateID":"4083","State":"Nakhon Phanom"},{"StateID":"4084","State":"Khon Kaen"},{"StateID":"4085","State":"Kalasin"},{"StateID":"4086","State":"Maha Sarakham"},{"StateID":"4087","State":"Roi Et"},{"StateID":"4088","State":"Chaiyaphum"},{"StateID":"4089","State":"Nakhon Ratchasima"},{"StateID":"4090","State":"Buriram"},{"StateID":"4091","State":"Surin"},{"StateID":"4092","State":"Sisaket"},{"StateID":"4093","State":"Narathiwat"},{"StateID":"4094","State":"Chai Nat"},{"StateID":"4095","State":"Sing Buri"},{"StateID":"4096","State":"Lop Buri"},{"StateID":"4097","State":"Ang Thong"},{"StateID":"4098","State":"Phra Nakhon Si Ayutthaya"},{"StateID":"4099","State":"Sara Buri"},{"StateID":"4100","State":"Nonthaburi"},{"StateID":"4101","State":"Pathum Thani"},{"StateID":"4102","State":"Krung Thep Mahanakhon"},{"StateID":"4103","State":"Phayao"},{"StateID":"4104","State":"Samut Prakan"},{"StateID":"4105","State":"Nakhon Nayok"},{"StateID":"4106","State":"Chachoengsao"},{"StateID":"4107","State":"Prachin Buri"},{"StateID":"4108","State":"Chon Buri"},{"StateID":"4109","State":"Rayong"},{"StateID":"4110","State":"Chanthaburi"},{"StateID":"4111","State":"Trat"},{"StateID":"4112","State":"Kanchanaburi"},{"StateID":"4113","State":"Suphan Buri"},{"StateID":"4114","State":"Ratchaburi"},{"StateID":"4115","State":"Nakhon Pathom"},{"StateID":"4116","State":"Samut Songkhram"},{"StateID":"4117","State":"Samut Sakhon"},{"StateID":"4118","State":"Phetchaburi"},{"StateID":"4119","State":"Prachuap Khiri Khan"},{"StateID":"4120","State":"Chumphon"},{"StateID":"4121","State":"Ranong"},{"StateID":"4122","State":"Surat Thani"},{"StateID":"4123","State":"Phangnga"},{"StateID":"4124","State":"Phuket"},{"StateID":"4125","State":"Krabi"},{"StateID":"4126","State":"Nakon Si Thammarat"},{"StateID":"4127","State":"Trang"},{"StateID":"4128","State":"Phatthalung"},{"StateID":"4129","State":"Satun"},{"StateID":"4130","State":"Songkhla"},{"StateID":"4131","State":"Pattani"},{"StateID":"4132","State":"Yala"},{"StateID":"4134","State":"Yasothon"},{"StateID":"4135","State":"Ubon Ratchanthani"},{"StateID":"4136","State":"Amnat Charoen"},{"StateID":"4137","State":"Mukdahan"},{"StateID":"4138","State":"Nong Bua Lamphu"},{"StateID":"4139","State":"Sa Kaeo"}],"C240":[{"StateID":"777","State":"Togo"},{"StateID":"5393","State":"Centre"},{"StateID":"5394","State":"Kara"},{"StateID":"5395","State":"Maritime"},{"StateID":"5396","State":"Plateaux"},{"StateID":"5397","State":"Savanes"}],"C241":[{"StateID":"778","State":"Tokelau"}],"C242":[{"StateID":"779","State":"Tonga"},{"StateID":"4143","State":"Ha\'apai"},{"StateID":"4144","State":"Tongatapu"},{"StateID":"4145","State":"Vava\'u"}],"C243":[{"StateID":"780","State":"Trinidad and Tobago"},{"StateID":"4051","State":"Arima"},{"StateID":"4052","State":"Caroni"},{"StateID":"4053","State":"Mayaro"},{"StateID":"4054","State":"Nariva"},{"StateID":"4055","State":"Port-of-Spain"},{"StateID":"4056","State":"Saint Andrew"},{"StateID":"4057","State":"Saint David"},{"StateID":"4058","State":"Saint George"},{"StateID":"4059","State":"Saint Patrick"},{"StateID":"4060","State":"San Fernando"},{"StateID":"4061","State":"Tobago"},{"StateID":"4062","State":"Victoria"}],"C244":[{"StateID":"781","State":"Tromelin Island"}],"C245":[{"StateID":"782","State":"Tunisia"},{"StateID":"4169","State":"Al Qasrayn"},{"StateID":"4170","State":"Al Qayrawan"},{"StateID":"4171","State":"Jundubah"},{"StateID":"4172","State":"Al Kaf"},{"StateID":"4173","State":"Al Mahdiyah"},{"StateID":"4174","State":"Al Munastir"},{"StateID":"4175","State":"Bajah"},{"StateID":"4176","State":"Banzart"},{"StateID":"4177","State":"Nabul"},{"StateID":"4178","State":"Silyanah"},{"StateID":"4179","State":"Susah"},{"StateID":"4180","State":"Aryanah"},{"StateID":"4181","State":"Bin \'Arus"},{"StateID":"4182","State":"Madanin"},{"StateID":"4183","State":"Qabis"},{"StateID":"4184","State":"Qafsah"},{"StateID":"4185","State":"Qibili"},{"StateID":"4186","State":"Safaqi"},{"StateID":"4187","State":"Sidi Bu Zayd"},{"StateID":"4188","State":"Tatawin"},{"StateID":"4189","State":"Tawzar"},{"StateID":"4190","State":"Tunis"},{"StateID":"4191","State":"Zaghwan"},{"StateID":"5366","State":"Manouba"}],"C246":[{"StateID":"783","State":"Turkey"},{"StateID":"4192","State":"Adana"},{"StateID":"4193","State":"Adiyaman"},{"StateID":"4194","State":"Afyon"},{"StateID":"4195","State":"Agri"},{"StateID":"4196","State":"Amasya"},{"StateID":"4198","State":"Antalya"},{"StateID":"4199","State":"Artvin"},{"StateID":"4200","State":"Aydin"},{"StateID":"4201","State":"Balikesir"},{"StateID":"4202","State":"Bilecik"},{"StateID":"4203","State":"Bingol"},{"StateID":"4204","State":"Bitlis"},{"StateID":"4205","State":"Bolu"},{"StateID":"4206","State":"Burdur"},{"StateID":"4207","State":"Bursa"},{"StateID":"4208","State":"Canakkale"},{"StateID":"4209","State":"Cankiri"},{"StateID":"4210","State":"Corum"},{"StateID":"4211","State":"Denizli"},{"StateID":"4212","State":"Diyarbakir"},{"StateID":"4213","State":"Edirne"},{"StateID":"4214","State":"Elazig"},{"StateID":"4215","State":"Erzincan"},{"StateID":"4216","State":"Erzurum"},{"StateID":"4217","State":"Eskisehir"},{"StateID":"4218","State":"Gaziantep"},{"StateID":"4219","State":"Giresun"},{"StateID":"4222","State":"Hatay"},{"StateID":"4223","State":"Icel"},{"StateID":"4224","State":"Isparta"},{"StateID":"4225","State":"Istanbul"},{"StateID":"4226","State":"Izmir"},{"StateID":"4227","State":"Kars"},{"StateID":"4228","State":"Kastamonu"},{"StateID":"4229","State":"Kayseri"},{"StateID":"4230","State":"Kirklareli"},{"StateID":"4231","State":"Kirsehir"},{"StateID":"4232","State":"Kocaeli"},{"StateID":"4234","State":"Kutahya"},{"StateID":"4235","State":"Malatya"},{"StateID":"4236","State":"Manisa"},{"StateID":"4237","State":"Kahramanmaras"},{"StateID":"4239","State":"Mugla"},{"StateID":"4240","State":"Mus"},{"StateID":"4241","State":"Nevsehir"},{"StateID":"4243","State":"Ordu"},{"StateID":"4244","State":"Rize"},{"StateID":"4245","State":"Sakarya"},{"StateID":"4246","State":"Samsun"},{"StateID":"4248","State":"Sinop"},{"StateID":"4249","State":"Sivas"},{"StateID":"4250","State":"Tekirdag"},{"StateID":"4251","State":"Tokat"},{"StateID":"4252","State":"Trabzon"},{"StateID":"4253","State":"Tunceli"},{"StateID":"4254","State":"Sanliurfa"},{"StateID":"4255","State":"Usak"},{"StateID":"4256","State":"Van"},{"StateID":"4257","State":"Yozgat"},{"StateID":"4258","State":"Zonguldak"},{"StateID":"4259","State":"Ankara"},{"StateID":"4260","State":"Gumushane"},{"StateID":"4261","State":"Hakkari"},{"StateID":"4262","State":"Konya"},{"StateID":"4263","State":"Mardin"},{"StateID":"4264","State":"Nigde"},{"StateID":"4265","State":"Siirt"},{"StateID":"4266","State":"Aksaray"},{"StateID":"4267","State":"Batman"},{"StateID":"4268","State":"Bayburt"},{"StateID":"4269","State":"Karaman"},{"StateID":"4270","State":"Kirikkale"},{"StateID":"4271","State":"Sirnak"},{"StateID":"5107","State":"Ardahan"},{"StateID":"5108","State":"Bartin"},{"StateID":"5109","State":"Igdir"},{"StateID":"5110","State":"Karabuk"},{"StateID":"5111","State":"Kilis"},{"StateID":"5112","State":"Osmaniye"},{"StateID":"5113","State":"Yalova"},{"StateID":"5365","State":"D\u00fczce"}],"C247":[{"StateID":"784","State":"Turkmenistan"},{"StateID":"5053","State":"Ahal"},{"StateID":"5054","State":"Balkan"},{"StateID":"5055","State":"Dashhowuz"},{"StateID":"5056","State":"Lebap"},{"StateID":"5057","State":"Mary"}],"C248":[{"StateID":"785","State":"Turks and Caicos Islands"}],"C249":[{"StateID":"786","State":"Tuvalu"}],"C250":[{"StateID":"787","State":"Uganda"},{"StateID":"4300","State":"Apac"},{"StateID":"4301","State":"Arua"},{"StateID":"4302","State":"Bundibogyo"},{"StateID":"4303","State":"Bushenyi"},{"StateID":"4304","State":"Gulu"},{"StateID":"4305","State":"Hoima"},{"StateID":"4306","State":"Iganga"},{"StateID":"4307","State":"Jinja"},{"StateID":"4308","State":"Kabale"},{"StateID":"4309","State":"Kabarole"},{"StateID":"4310","State":"Kalangala"},{"StateID":"4311","State":"Kampala"},{"StateID":"4312","State":"Kamuli"},{"StateID":"4313","State":"Kapchorwa"},{"StateID":"4314","State":"Kasese"},{"StateID":"4315","State":"Kibale"},{"StateID":"4316","State":"Kiboga"},{"StateID":"4317","State":"Kisoro"},{"StateID":"4318","State":"Kitgum"},{"StateID":"4319","State":"Kotido"},{"StateID":"4320","State":"Kumi"},{"StateID":"4321","State":"Lira"},{"StateID":"4322","State":"Luwero"},{"StateID":"4323","State":"Masaka"},{"StateID":"4324","State":"Masindi"},{"StateID":"4325","State":"Mbale"},{"StateID":"4326","State":"Mbarara"},{"StateID":"4327","State":"Moroto"},{"StateID":"4328","State":"Moyo"},{"StateID":"4329","State":"Mpigi"},{"StateID":"4330","State":"Mubende"},{"StateID":"4331","State":"Mukono"},{"StateID":"4332","State":"Nebbi"},{"StateID":"4333","State":"Ntungamo"},{"StateID":"4334","State":"Pallisa"},{"StateID":"4335","State":"Rakai"},{"StateID":"4336","State":"Rukungiri"},{"StateID":"4337","State":"Soroti"},{"StateID":"4338","State":"Tororo"},{"StateID":"5289","State":"Sembabule"},{"StateID":"5290","State":"Nakasongola"},{"StateID":"5291","State":"Katakwi"},{"StateID":"5292","State":"Busia"},{"StateID":"5293","State":"Bugiri"},{"StateID":"5294","State":"Adjumani"}],"C251":[{"StateID":"788","State":"Ukraine"},{"StateID":"4431","State":"Cherkas\'ka Oblast\'"},{"StateID":"4432","State":"Chernihivs\'ka Oblast\'"},{"StateID":"4433","State":"Chernivets\'ka Oblast\'"},{"StateID":"4434","State":"Dnipropetrovs\'ka Oblast\'"},{"StateID":"4435","State":"Donets\'ka Oblast\'"},{"StateID":"4436","State":"Ivano-Frankivs\'ka Oblast\'"},{"StateID":"4437","State":"Kharkivs\'ka Oblast\'"},{"StateID":"4438","State":"Khersons\'ka Oblast\'"},{"StateID":"4439","State":"Khmel\'nyts\'ka Oblast\'"},{"StateID":"4440","State":"Kirovohrads\'ka Oblast\'"},{"StateID":"4441","State":"Avtonomna Respublika Krym"},{"StateID":"4442","State":"Misto Kyyiv"},{"StateID":"4443","State":"Kyyivs\'ka Oblast\'"},{"StateID":"4444","State":"Luhans\'ka Oblast\'"},{"StateID":"4445","State":"L\'vivs\'ka Oblast\'"},{"StateID":"4446","State":"Mykolayivs\'ka Oblast\'"},{"StateID":"4447","State":"Odes\'ka Oblast"},{"StateID":"4448","State":"Poltavs\'ka Oblast\'"},{"StateID":"4449","State":"Rivnens\'ka Oblast\'"},{"StateID":"4450","State":"Misto Sevastopol"},{"StateID":"4451","State":"Sums\'ka Oblast\'"},{"StateID":"4452","State":"Ternopil\'s\'ka Oblast\'"},{"StateID":"4453","State":"Vinnyts\'ka Oblast\'"},{"StateID":"4454","State":"Volyns\'ka Oblast\'"},{"StateID":"4455","State":"Zakarpats\'ka Oblast\'"},{"StateID":"4456","State":"Zaporiz\'ka Oblast\'"},{"StateID":"4457","State":"Zhytomyrs\'ka Oblast\'"}],"C252":[{"StateID":"789","State":"United Arab Emirates"},{"StateID":"4997","State":"United Arab Emigrates (general)"},{"StateID":"4998","State":"Abu Zaby"},{"StateID":"4999","State":"\'Ajman"},{"StateID":"5002","State":"Dubayy"},{"StateID":"5003","State":"Al Fujayrah"},{"StateID":"5004","State":"Ra\'s al Khaymah"},{"StateID":"5005","State":"Ash Shariqah"},{"StateID":"5006","State":"Umm al Qaywayn"}],"C253":[{"StateID":"790","State":"United Kingdom"},{"StateID":"5389","State":"Wales"},{"StateID":"5390","State":"Scotland"},{"StateID":"5391","State":"Northern Ireland"},{"StateID":"5392","State":"England"}],"C254":[{"StateID":"122","State":"Alabama"},{"StateID":"123","State":"Alaska"},{"StateID":"124","State":"Arizona"},{"StateID":"125","State":"Arkansas"},{"StateID":"126","State":"California"},{"StateID":"127","State":"Colorado"},{"StateID":"128","State":"Connecticut"},{"StateID":"129","State":"Delaware"},{"StateID":"130","State":"District of Columbia"},{"StateID":"131","State":"Florida"},{"StateID":"132","State":"Georgia"},{"StateID":"133","State":"Hawaii"},{"StateID":"134","State":"Idaho"},{"StateID":"135","State":"Illinois"},{"StateID":"136","State":"Indiana"},{"StateID":"137","State":"Iowa"},{"StateID":"138","State":"Kansas"},{"StateID":"139","State":"Kentucky"},{"StateID":"140","State":"Louisiana"},{"StateID":"141","State":"Maine"},{"StateID":"142","State":"Maryland"},{"StateID":"143","State":"Massachusetts"},{"StateID":"144","State":"Michigan"},{"StateID":"145","State":"Minnesota"},{"StateID":"146","State":"Mississippi"},{"StateID":"147","State":"Missouri"},{"StateID":"148","State":"Montana"},{"StateID":"149","State":"Nebraska"},{"StateID":"150","State":"Nevada"},{"StateID":"151","State":"New Hampshire"},{"StateID":"152","State":"New Jersey"},{"StateID":"153","State":"New Mexico"},{"StateID":"154","State":"New York"},{"StateID":"155","State":"North Carolina"},{"StateID":"156","State":"North Dakota"},{"StateID":"157","State":"Ohio"},{"StateID":"158","State":"Oklahoma"},{"StateID":"159","State":"Oregon"},{"StateID":"160","State":"Pennsylvania"},{"StateID":"161","State":"Rhode Island"},{"StateID":"162","State":"South Carolina"},{"StateID":"163","State":"South Dakota"},{"StateID":"164","State":"Tennessee"},{"StateID":"165","State":"Texas"},{"StateID":"166","State":"Utah"},{"StateID":"167","State":"Virginia"},{"StateID":"168","State":"Washington"},{"StateID":"169","State":"West Virginia"},{"StateID":"170","State":"Wisconsin"},{"StateID":"171","State":"Wyoming"},{"StateID":"172","State":"Vermont"},{"StateID":"791","State":"United States"}],"C255":[{"StateID":"792","State":"United States Minor Outlying Islands"}],"C256":[{"StateID":"793","State":"Uruguay"},{"StateID":"4488","State":"Artigas"},{"StateID":"4489","State":"Canelones"},{"StateID":"4490","State":"Cerro Largo"},{"StateID":"4491","State":"Colonia"},{"StateID":"4492","State":"Durazno"},{"StateID":"4493","State":"Flores"},{"StateID":"4494","State":"Florida"},{"StateID":"4495","State":"Lavalleja"},{"StateID":"4496","State":"Maldonado"},{"StateID":"4497","State":"Montevideo"},{"StateID":"4498","State":"Paysandu"},{"StateID":"4499","State":"Rio Negro"},{"StateID":"4500","State":"Rivera"},{"StateID":"4501","State":"Rocha"},{"StateID":"4502","State":"Salto"},{"StateID":"4503","State":"San Jose"},{"StateID":"4504","State":"Soriano"},{"StateID":"4505","State":"Tacuarembo"},{"StateID":"4506","State":"Treinta y Tres"}],"C257":[{"StateID":"794","State":"Uzbekistan"},{"StateID":"4507","State":"Andijon"},{"StateID":"4508","State":"Bukhoro"},{"StateID":"4509","State":"Farghona"},{"StateID":"4510","State":"Jizzakh"},{"StateID":"4511","State":"Khorazm"},{"StateID":"4512","State":"Namangan"},{"StateID":"4513","State":"Nawoiy"},{"StateID":"4514","State":"Qashqadaryo"},{"StateID":"4515","State":"Qoraqalpoghiston"},{"StateID":"4516","State":"Samarqand"},{"StateID":"4517","State":"Sirdaryo"},{"StateID":"4518","State":"Surkhondaryo"},{"StateID":"4519","State":"Toshkent"}],"C258":[{"StateID":"795","State":"Vanuatu"},{"StateID":"2931","State":"Aoba\/\/Maewo"},{"StateID":"2932","State":"Torba"},{"StateID":"2938","State":"Sanma"},{"StateID":"2940","State":"Tafea"},{"StateID":"5071","State":"Malampa"},{"StateID":"5072","State":"Penama"},{"StateID":"5073","State":"Shefa"}],"C259":[{"StateID":"796","State":"Venezuela"},{"StateID":"4526","State":"Amazonas"},{"StateID":"4527","State":"Anzoategui"},{"StateID":"4528","State":"Apure"},{"StateID":"4529","State":"Aragua"},{"StateID":"4530","State":"Barinas"},{"StateID":"4531","State":"Bolivar"},{"StateID":"4532","State":"Carabobo"},{"StateID":"4533","State":"Cojedes"},{"StateID":"4534","State":"Delta Amacuro"},{"StateID":"4535","State":"Distrito Federal"},{"StateID":"4536","State":"Falcon"},{"StateID":"4537","State":"Guarico"},{"StateID":"4538","State":"Lara"},{"StateID":"4539","State":"Merida"},{"StateID":"4540","State":"Miranda"},{"StateID":"4541","State":"Monagas"},{"StateID":"4542","State":"Nueva Esparta"},{"StateID":"4543","State":"Portuguesa"},{"StateID":"4544","State":"Sucre"},{"StateID":"4545","State":"Tachira"},{"StateID":"4546","State":"Trujillo"},{"StateID":"4547","State":"Yaracuy"},{"StateID":"4548","State":"Zulia"},{"StateID":"4549","State":"Dependencias Federales"},{"StateID":"5061","State":"Vargas"}],"C260":[{"StateID":"797","State":"Vietnam"},{"StateID":"4551","State":"An Giang"},{"StateID":"4553","State":"Ben Tre"},{"StateID":"4555","State":"Cao Bang"},{"StateID":"4557","State":"Dak Lak"},{"StateID":"4558","State":"Dong Thap"},{"StateID":"4562","State":"Hai Phong"},{"StateID":"4564","State":"Ha Noi"},{"StateID":"4568","State":"Ho Chi Minh"},{"StateID":"4569","State":"Kien Giang"},{"StateID":"4570","State":"Lai Chau"},{"StateID":"4571","State":"Lam Dong"},{"StateID":"4572","State":"Long An"},{"StateID":"4578","State":"Quang Ninh"},{"StateID":"4580","State":"Son La"},{"StateID":"4581","State":"Tay Ninh"},{"StateID":"4582","State":"Thanh Hoa"},{"StateID":"4583","State":"Thai Binh"},{"StateID":"4585","State":"Tien Giang"},{"StateID":"4587","State":"Lang Son"},{"StateID":"4590","State":"Dong Nai"},{"StateID":"4591","State":"Ba Ria-Vung Tau"},{"StateID":"4592","State":"Binh Dinh"},{"StateID":"4593","State":"Binh Thuan"},{"StateID":"4594","State":"Can Tho"},{"StateID":"4595","State":"Gia Lai"},{"StateID":"4596","State":"Ha Giang"},{"StateID":"4597","State":"Ha Tay"},{"StateID":"4598","State":"Ha Tinh"},{"StateID":"4599","State":"Hoa Binh"},{"StateID":"4600","State":"Khanh Hoa"},{"StateID":"4601","State":"Kon Tum"},{"StateID":"4602","State":"Lao Cai"},{"StateID":"4604","State":"Nghe An"},{"StateID":"4605","State":"Ninh Binh"},{"StateID":"4606","State":"Ninh Thuan"},{"StateID":"4607","State":"Phu Yen"},{"StateID":"4608","State":"Quang Binh"},{"StateID":"4609","State":"Quang Ngai"},{"StateID":"4610","State":"Quang Tri"},{"StateID":"4611","State":"Soc Trang"},{"StateID":"4612","State":"Thura Thien-Hue"},{"StateID":"4613","State":"Tra Vinh"},{"StateID":"4614","State":"Tuyen Quang"},{"StateID":"4615","State":"Vinh Long"},{"StateID":"4616","State":"Yen Bai"},{"StateID":"4617","State":"Bac Giang"},{"StateID":"4618","State":"Bac Kan"},{"StateID":"4619","State":"Bac Lieu"},{"StateID":"4620","State":"Bac Ninh"},{"StateID":"4621","State":"Bin Duong"},{"StateID":"4622","State":"Bin Phuoc"},{"StateID":"4623","State":"Ca Mau"},{"StateID":"4624","State":"Da Nang"},{"StateID":"4625","State":"Hai Duong"},{"StateID":"4626","State":"Ha Nam"},{"StateID":"4627","State":"Hung Yen"},{"StateID":"4628","State":"Nam Dinh"},{"StateID":"4629","State":"Phu Tho"},{"StateID":"4630","State":"Quang Nam"},{"StateID":"4631","State":"Thai Nguyen"},{"StateID":"4632","State":"Vinh Phuc"}],"C261":[{"StateID":"798","State":"Virgin Islands"},{"StateID":"5384","State":"Saint Thomas"},{"StateID":"5385","State":"Saint John"},{"StateID":"5386","State":"Saint Croix"}],"C262":[{"StateID":"799","State":"Virgin Islands (UK)"}],"C263":[{"StateID":"800","State":"Virgin Islands (US)"}],"C264":[{"StateID":"801","State":"Wake Island"}],"C265":[{"StateID":"802","State":"Wallis and Futuna"}],"C266":[{"StateID":"803","State":"West Bank"}],"C267":[{"StateID":"804","State":"Western Sahara"}],"C268":[{"StateID":"805","State":"Western Samoa"}],"C269":[{"StateID":"268","State":"World"}],"C270":[{"StateID":"806","State":"Yemen"},{"StateID":"4663","State":"Abyan"},{"StateID":"4664","State":"\'Adan"},{"StateID":"4665","State":"Al Mahrah"},{"StateID":"4666","State":"Hadramawt"},{"StateID":"4667","State":"Shabwah"},{"StateID":"4668","State":"Lahij"},{"StateID":"4669","State":"Al Bayda\'"},{"StateID":"4670","State":"Al Hudaydah"},{"StateID":"4671","State":"Al Jawf"},{"StateID":"4672","State":"Al Mahwit"},{"StateID":"4673","State":"Dhamar"},{"StateID":"4674","State":"Hajjah"},{"StateID":"4675","State":"Ibb"},{"StateID":"4676","State":"Ma\'rib"},{"StateID":"4677","State":"Sa\'dah"},{"StateID":"4678","State":"San\'a\'"},{"StateID":"4679","State":"Ta\'izz"}],"C271":[{"StateID":"3941","State":"Vojvodina"},{"StateID":"5024","State":"Yugoslavia"},{"StateID":"5062","State":"Crna Gora (Montenegro)"},{"StateID":"5063","State":"Srbija (Serbia)"},{"StateID":"5258","State":"Kosovo"}],"C272":[{"StateID":"808","State":"Zaire"}],"C273":[{"StateID":"809","State":"Zambia"},{"StateID":"4680","State":"North-Western"},{"StateID":"4681","State":"Copperbelt"},{"StateID":"4682","State":"Western"},{"StateID":"4683","State":"Southern"},{"StateID":"4684","State":"Central"},{"StateID":"4685","State":"Eastern"},{"StateID":"4686","State":"Northern"},{"StateID":"4687","State":"Luapula"},{"StateID":"4688","State":"Lusaka"}],"C274":[{"StateID":"810","State":"Zimbabwe"},{"StateID":"4689","State":"Manicaland"},{"StateID":"4690","State":"Midlands"},{"StateID":"4691","State":"Mashonaland Central"},{"StateID":"4692","State":"Mashonaland East"},{"StateID":"4693","State":"Mashonaland West"},{"StateID":"4694","State":"Matabeleland North"},{"StateID":"4695","State":"Matabeleland South"},{"StateID":"4696","State":"Masvingo"},{"StateID":"5270","State":"Bulawayo"},{"StateID":"5271","State":"Harare"}],"C275":[{"StateID":"5387","State":"West Bank"},{"StateID":"5388","State":"Gaza"}]}');    
        return states["C" + country_id];
    }
    
    this.getTemplateItems = function()
    {
        var items = JSON.parse('{"1":{"id":"1","resource_type":"1","parent_id":"","name":"7"},"2":{"id":"2","resource_type":"1","parent_id":"","name":"6"},"3":{"id":"3","resource_type":"1","parent_id":"","name":"5"},"4":{"id":"4","resource_type":"1","parent_id":"","name":"4"},"5":{"id":"5","resource_type":"1","parent_id":"","name":"3"},"6":{"id":"6","resource_type":"1","parent_id":"","name":"8"},"7":{"id":"7","resource_type":"1","parent_id":"","name":"9"},"8":{"id":"8","resource_type":"1","parent_id":"","name":"Ground floor"},"9":{"id":"9","resource_type":"1","parent_id":"","name":"All levels"},"10":{"id":"10","resource_type":"1","parent_id":"","name":"Car Park"},"11":{"id":"11","resource_type":"1","parent_id":"","name":"14"},"12":{"id":"12","resource_type":"1","parent_id":"","name":"2"},"13":{"id":"13","resource_type":"1","parent_id":"","name":"10"},"14":{"id":"14","resource_type":"1","parent_id":"","name":"11"},"15":{"id":"15","resource_type":"1","parent_id":"","name":"1"},"16":{"id":"16","resource_type":"1","parent_id":"","name":"Lower ground"},"17":{"id":"17","resource_type":"1","parent_id":"","name":"12"},"18":{"id":"18","resource_type":"1","parent_id":"","name":"Mezzanine"},"19":{"id":"19","resource_type":"1","parent_id":"","name":"External grounds"},"20":{"id":"20","resource_type":"2","parent_id":"","name":"Boardroom"},"21":{"id":"21","resource_type":"2","parent_id":"","name":"Dispatch"},"22":{"id":"22","resource_type":"2","parent_id":"","name":"Kitchen"},"23":{"id":"23","resource_type":"2","parent_id":"","name":"Foyer"},"24":{"id":"24","resource_type":"2","parent_id":"","name":"Security desk"},"25":{"id":"25","resource_type":"2","parent_id":"","name":"Female washroom"},"26":{"id":"26","resource_type":"2","parent_id":"","name":"Male washroom"},"27":{"id":"27","resource_type":"2","parent_id":"","name":"Shower"},"28":{"id":"28","resource_type":"2","parent_id":"","name":"Bin store room"},"29":{"id":"29","resource_type":"2","parent_id":"","name":"Lift lobby"},"30":{"id":"30","resource_type":"2","parent_id":"","name":"Lift"},"31":{"id":"31","resource_type":"2","parent_id":"","name":"Plant room"},"32":{"id":"32","resource_type":"2","parent_id":"","name":"External grounds"},"33":{"id":"33","resource_type":"2","parent_id":"","name":"Risers"},"34":{"id":"34","resource_type":"2","parent_id":"","name":"Cleaner\'s room"},"35":{"id":"35","resource_type":"2","parent_id":"","name":"Building manager\'s office"},"36":{"id":"36","resource_type":"2","parent_id":"","name":"Corridor"},"37":{"id":"37","resource_type":"2","parent_id":"","name":"Emergency stairs"},"38":{"id":"38","resource_type":"2","parent_id":"","name":"Knight frank office"},"39":{"id":"39","resource_type":"2","parent_id":"","name":"White walls"},"40":{"id":"40","resource_type":"2","parent_id":"","name":"Glass enclosure"},"41":{"id":"41","resource_type":"2","parent_id":"","name":"Emergency doors"},"42":{"id":"42","resource_type":"2","parent_id":"","name":"Cardboard wall"},"43":{"id":"43","resource_type":"2","parent_id":"","name":"Refuse room"},"44":{"id":"44","resource_type":"2","parent_id":"","name":"Kitchenette"},"45":{"id":"45","resource_type":"2","parent_id":"","name":"Tenants door"},"46":{"id":"46","resource_type":"2","parent_id":"","name":"Washrooms"},"47":{"id":"47","resource_type":"2","parent_id":"","name":"Disabled washroom"},"48":{"id":"48","resource_type":"2","parent_id":"","name":"Meeting room"},"49":{"id":"49","resource_type":"2","parent_id":"","name":"Printer room\/area"},"50":{"id":"50","resource_type":"2","parent_id":"","name":"Entrance corridor"},"51":{"id":"51","resource_type":"2","parent_id":"","name":"Stair"},"52":{"id":"52","resource_type":"2","parent_id":"","name":"General office"},"53":{"id":"53","resource_type":"2","parent_id":"","name":"Factory office"},"54":{"id":"54","resource_type":"2","parent_id":"","name":"Client meeting room"},"55":{"id":"55","resource_type":"2","parent_id":"","name":"Ecobins"},"56":{"id":"56","resource_type":"2","parent_id":"","name":"Library"},"57":{"id":"57","resource_type":"2","parent_id":"","name":"Ladies Washroom"},"58":{"id":"58","resource_type":"2","parent_id":"","name":"Fire escape"},"59":{"id":"59","resource_type":"2","parent_id":"","name":"Offices"},"60":{"id":"60","resource_type":"2","parent_id":"","name":"Filing room"},"61":{"id":"61","resource_type":"2","parent_id":"","name":"Garden Beds"},"62":{"id":"62","resource_type":"2","parent_id":"","name":"Reception"},"63":{"id":"63","resource_type":"2","parent_id":"","name":"Sitting room"},"64":{"id":"64","resource_type":"2","parent_id":"","name":"Front office space"},"65":{"id":"65","resource_type":"2","parent_id":"","name":"Individual offices"},"66":{"id":"66","resource_type":"2","parent_id":"","name":"Entry Roller Door"},"67":{"id":"67","resource_type":"2","parent_id":"","name":"Radford Room 1"},"68":{"id":"68","resource_type":"2","parent_id":"","name":"Glass partitions"},"69":{"id":"69","resource_type":"2","parent_id":"","name":"Main House"},"70":{"id":"70","resource_type":"2","parent_id":"","name":"Main Function Room"},"71":{"id":"71","resource_type":"2","parent_id":"","name":"Small Bedroom"},"72":{"id":"72","resource_type":"2","parent_id":"","name":"Sick bay"},"73":{"id":"73","resource_type":"2","parent_id":"","name":"Training room"},"74":{"id":"74","resource_type":"2","parent_id":"","name":"Entrance door"},"75":{"id":"75","resource_type":"2","parent_id":"","name":"Revolving door"},"76":{"id":"76","resource_type":"2","parent_id":"","name":"Balcony"},"77":{"id":"77","resource_type":"2","parent_id":"","name":"Tenancy"},"78":{"id":"78","resource_type":"2","parent_id":"","name":"Lunch room"},"79":{"id":"79","resource_type":"2","parent_id":"","name":"Labs "},"80":{"id":"80","resource_type":"2","parent_id":"","name":"Clean Room"},"81":{"id":"81","resource_type":"2","parent_id":"","name":"Ceilings"},"82":{"id":"82","resource_type":"2","parent_id":"","name":"Courtyard"},"83":{"id":"83","resource_type":"2","parent_id":"","name":"Car park"},"84":{"id":"84","resource_type":"2","parent_id":"","name":"Warehouse"},"85":{"id":"85","resource_type":"2","parent_id":"","name":"Stationary room"},"86":{"id":"86","resource_type":"2","parent_id":"","name":"Gym"},"87":{"id":"87","resource_type":"2","parent_id":"","name":"Cafeteria"},"88":{"id":"88","resource_type":"2","parent_id":"","name":"Ramp"},"89":{"id":"89","resource_type":"2","parent_id":"","name":"Laundry"},"90":{"id":"90","resource_type":"2","parent_id":"","name":"Toilet"},"91":{"id":"91","resource_type":"2","parent_id":"","name":"Atrium"},"92":{"id":"92","resource_type":"2","parent_id":"","name":"Roller Door"},"93":{"id":"93","resource_type":"2","parent_id":"","name":"Book Store"},"94":{"id":"94","resource_type":"2","parent_id":"","name":"Coffee training stations"},"95":{"id":"95","resource_type":"2","parent_id":"","name":"Gallery"},"96":{"id":"96","resource_type":"2","parent_id":"","name":"Building 9"},"97":{"id":"97","resource_type":"2","parent_id":"","name":"Lift foyer"},"98":{"id":"98","resource_type":"2","parent_id":"","name":"Hallway"},"99":{"id":"99","resource_type":"2","parent_id":"","name":"Utility area"},"100":{"id":"100","resource_type":"2","parent_id":"","name":"Hot desk"},"101":{"id":"101","resource_type":"2","parent_id":"","name":"Showers"},"102":{"id":"102","resource_type":"2","parent_id":"","name":"Filing shelves"},"103":{"id":"103","resource_type":"2","parent_id":"","name":"Operations office"},"104":{"id":"104","resource_type":"2","parent_id":"","name":"Production room"},"105":{"id":"105","resource_type":"2","parent_id":"","name":"Production room office"},"106":{"id":"106","resource_type":"2","parent_id":"","name":"Warehouse office"},"107":{"id":"107","resource_type":"2","parent_id":"","name":"Back entrance"},"108":{"id":"108","resource_type":"2","parent_id":"","name":"Glass door"},"109":{"id":"109","resource_type":"2","parent_id":"","name":"Windows"},"110":{"id":"110","resource_type":"2","parent_id":"","name":"Interview room"},"111":{"id":"111","resource_type":"2","parent_id":"","name":"Reception offices"},"112":{"id":"112","resource_type":"2","parent_id":"","name":"Shredding machine"},"113":{"id":"113","resource_type":"2","parent_id":"","name":"Inbound mail area"},"114":{"id":"114","resource_type":"2","parent_id":"","name":"Work area"},"115":{"id":"115","resource_type":"2","parent_id":"","name":"Stair foyer"},"116":{"id":"116","resource_type":"2","parent_id":"","name":"Common area lobby"},"117":{"id":"117","resource_type":"2","parent_id":"","name":"Staff bedroom"},"118":{"id":"118","resource_type":"2","parent_id":"","name":"Lounge room"},"119":{"id":"119","resource_type":"2","parent_id":"","name":"Mens washroom"},"120":{"id":"120","resource_type":"2","parent_id":"","name":"Hallway"},"121":{"id":"121","resource_type":"2","parent_id":"","name":"Glass partitions"},"122":{"id":"122","resource_type":"2","parent_id":"","name":"Entrance foyer"},"123":{"id":"123","resource_type":"2","parent_id":"","name":"Hair dresding room"},"124":{"id":"124","resource_type":"2","parent_id":"","name":"Waste Area"},"125":{"id":"125","resource_type":"2","parent_id":"","name":"Art gallery"},"126":{"id":"126","resource_type":"2","parent_id":"","name":"Meeting rooms corridor"},"127":{"id":"127","resource_type":"2","parent_id":"","name":"Executive offices"},"128":{"id":"128","resource_type":"2","parent_id":"","name":"Warehouse shower"},"129":{"id":"129","resource_type":"2","parent_id":"","name":"Main stairs"},"130":{"id":"130","resource_type":"2","parent_id":"","name":"All areas"},"131":{"id":"131","resource_type":"2","parent_id":"","name":"Back kitchenette"},"132":{"id":"132","resource_type":"2","parent_id":"","name":"Manager\'s washroom"},"133":{"id":"133","resource_type":"2","parent_id":"","name":"Executive kitchen"},"134":{"id":"134","resource_type":"2","parent_id":"","name":"Manager\'s office"},"135":{"id":"135","resource_type":"2","parent_id":"","name":"Mezzanine"},"136":{"id":"136","resource_type":"2","parent_id":"","name":"Thread storage"},"137":{"id":"137","resource_type":"2","parent_id":"","name":"Admin office area"},"138":{"id":"138","resource_type":"2","parent_id":"","name":"Workshop"},"139":{"id":"139","resource_type":"2","parent_id":"","name":"Store room"},"140":{"id":"140","resource_type":"2","parent_id":"","name":"Rubbish bins"},"141":{"id":"141","resource_type":"2","parent_id":"","name":"Server room"},"142":{"id":"142","resource_type":"2","parent_id":"","name":"Break Out"},"143":{"id":"143","resource_type":"2","parent_id":"","name":"Entry door glass"},"144":{"id":"144","resource_type":"2","parent_id":"","name":"Back stairs"},"145":{"id":"145","resource_type":"2","parent_id":"","name":"Waste bins area"},"146":{"id":"146","resource_type":"2","parent_id":"","name":"Corner bin enclosure"},"147":{"id":"147","resource_type":"2","parent_id":"","name":"Mail room"},"148":{"id":"148","resource_type":"2","parent_id":"","name":"Loading bay"},"149":{"id":"149","resource_type":"2","parent_id":"","name":"Green stairs"},"150":{"id":"150","resource_type":"2","parent_id":"","name":"Corporate publications office"},"151":{"id":"151","resource_type":"2","parent_id":"","name":"New business development"},"152":{"id":"152","resource_type":"2","parent_id":"","name":"Finance office"},"153":{"id":"153","resource_type":"2","parent_id":"","name":"Outbound call centre"},"154":{"id":"154","resource_type":"2","parent_id":"","name":"Clients\' rooms"},"155":{"id":"155","resource_type":"2","parent_id":"","name":"Director\'s office area"},"156":{"id":"156","resource_type":"2","parent_id":"","name":"HR Area"},"157":{"id":"157","resource_type":"2","parent_id":"","name":"Stairs sitting area"},"158":{"id":"158","resource_type":"2","parent_id":"","name":"24 hour kitchen"},"159":{"id":"159","resource_type":"2","parent_id":"","name":"Homeroom"},"160":{"id":"160","resource_type":"2","parent_id":"","name":"CEO\'s office"},"161":{"id":"161","resource_type":"2","parent_id":"","name":"Founders boardroom"},"162":{"id":"162","resource_type":"2","parent_id":"","name":"Cleaner\'s cupboard"},"163":{"id":"163","resource_type":"2","parent_id":"","name":"Middle stairs"},"164":{"id":"164","resource_type":"2","parent_id":"","name":"Audit & Risk Assurance"},"165":{"id":"165","resource_type":"2","parent_id":"","name":"Membership office"},"166":{"id":"166","resource_type":"2","parent_id":"","name":"Conference room"},"167":{"id":"167","resource_type":"2","parent_id":"","name":"Unisex toilet"},"168":{"id":"168","resource_type":"2","parent_id":"","name":"Front stairs"},"169":{"id":"169","resource_type":"2","parent_id":"","name":"Side entrance"},"170":{"id":"170","resource_type":"2","parent_id":"","name":"Door to book store"},"171":{"id":"171","resource_type":"2","parent_id":"","name":"Arts Room"},"172":{"id":"172","resource_type":"2","parent_id":"","name":"Stair to basement"},"173":{"id":"173","resource_type":"2","parent_id":"","name":"Roof"},"174":{"id":"174","resource_type":"2","parent_id":"","name":"Sorting area"},"175":{"id":"175","resource_type":"2","parent_id":"","name":"Computer benches"},"176":{"id":"176","resource_type":"2","parent_id":"","name":"Document scanning area"},"177":{"id":"177","resource_type":"2","parent_id":"","name":"Manager\'s kitchen"},"178":{"id":"178","resource_type":"2","parent_id":"","name":"Lecture room"},"179":{"id":"179","resource_type":"2","parent_id":"","name":"Front corridor"},"180":{"id":"180","resource_type":"2","parent_id":"","name":"Building perimeter"},"181":{"id":"181","resource_type":"2","parent_id":"","name":"Display room"},"182":{"id":"182","resource_type":"2","parent_id":"","name":"Reception sitting area"},"183":{"id":"183","resource_type":"2","parent_id":"","name":"Meeting area"},"184":{"id":"184","resource_type":"2","parent_id":"","name":"Boardroom Lobby"},"185":{"id":"185","resource_type":"2","parent_id":"","name":"Wooden stair"},"186":{"id":"186","resource_type":"2","parent_id":"","name":"Entrance lounge room"},"187":{"id":"187","resource_type":"2","parent_id":"","name":"24 hour area"},"188":{"id":"188","resource_type":"2","parent_id":"","name":"Parking spot"},"189":{"id":"189","resource_type":"2","parent_id":"","name":"Back room"},"190":{"id":"190","resource_type":"2","parent_id":"","name":"Managers area"},"191":{"id":"191","resource_type":"2","parent_id":"","name":"Information systems office"},"192":{"id":"192","resource_type":"2","parent_id":"","name":"Behind kitchen"},"193":{"id":"193","resource_type":"2","parent_id":"","name":"Male showers"},"194":{"id":"194","resource_type":"2","parent_id":"","name":"Warehouse stair"},"195":{"id":"195","resource_type":"2","parent_id":"","name":"Warehouse washrooms"},"196":{"id":"196","resource_type":"2","parent_id":"","name":"Stairs to car park"},"197":{"id":"197","resource_type":"2","parent_id":"","name":"Wooden floor"},"198":{"id":"198","resource_type":"2","parent_id":"","name":"Washrooms corridor"},"199":{"id":"199","resource_type":"2","parent_id":"","name":"Back corridor"},"200":{"id":"200","resource_type":"2","parent_id":"","name":"Washroom corridor"},"201":{"id":"201","resource_type":"2","parent_id":"","name":"Burlington meeting room"},"202":{"id":"202","resource_type":"2","parent_id":"","name":"Warehouse kitchen"},"203":{"id":"203","resource_type":"2","parent_id":"","name":"Trough room"},"204":{"id":"204","resource_type":"2","parent_id":"","name":"Main stairs"},"205":{"id":"205","resource_type":"2","parent_id":"","name":"Coffee shop"},"206":{"id":"206","resource_type":"3","parent_id":"20","name":"Main Table"},"207":{"id":"207","resource_type":"3","parent_id":"20","name":"Chair"},"208":{"id":"208","resource_type":"3","parent_id":"21","name":"Door"},"209":{"id":"209","resource_type":"3","parent_id":"20","name":"Blackboard"},"210":{"id":"210","resource_type":"3","parent_id":"20","name":"Ruler"},"211":{"id":"211","resource_type":"3","parent_id":"22","name":"Stove"},"212":{"id":"212","resource_type":"3","parent_id":"23","name":"Hard floors"},"213":{"id":"213","resource_type":"3","parent_id":"23","name":"Glazing panels"},"214":{"id":"214","resource_type":"3","parent_id":"23","name":"Glass doors"},"215":{"id":"215","resource_type":"3","parent_id":"23","name":"Back corridor"},"216":{"id":"216","resource_type":"3","parent_id":"35","name":"Floor"},"217":{"id":"217","resource_type":"3","parent_id":"35","name":"Waste"},"218":{"id":"218","resource_type":"3","parent_id":"35","name":"Shelves"},"219":{"id":"219","resource_type":"3","parent_id":"30","name":"Lift tracks"},"220":{"id":"220","resource_type":"3","parent_id":"30","name":"Doors"},"221":{"id":"221","resource_type":"3","parent_id":"30","name":"Control panel"},"222":{"id":"222","resource_type":"3","parent_id":"30","name":"Mirrors"},"223":{"id":"223","resource_type":"3","parent_id":"30","name":"Vents"},"224":{"id":"224","resource_type":"3","parent_id":"36","name":"White walls"},"225":{"id":"225","resource_type":"3","parent_id":"25","name":"Toilet bowls"},"226":{"id":"226","resource_type":"3","parent_id":"26","name":"Mirror"},"227":{"id":"227","resource_type":"3","parent_id":"34","name":"Machine test & tag"},"228":{"id":"228","resource_type":"3","parent_id":"38","name":"Fridge"},"229":{"id":"229","resource_type":"3","parent_id":"40","name":"Inside edge"},"230":{"id":"230","resource_type":"3","parent_id":"41","name":"Door frames"},"231":{"id":"231","resource_type":"3","parent_id":"25","name":"Basin"},"232":{"id":"232","resource_type":"3","parent_id":"25","name":"Partitions"},"233":{"id":"233","resource_type":"3","parent_id":"25","name":"Door vents"},"234":{"id":"234","resource_type":"3","parent_id":"36","name":"Cardboard wall"},"235":{"id":"235","resource_type":"3","parent_id":"43","name":"Floor"},"236":{"id":"236","resource_type":"3","parent_id":"43","name":"Walls"},"237":{"id":"237","resource_type":"3","parent_id":"34","name":"Tidiness"},"238":{"id":"238","resource_type":"3","parent_id":"34","name":"Machines"},"239":{"id":"239","resource_type":"3","parent_id":"34","name":"Walls"},"240":{"id":"240","resource_type":"3","parent_id":"44","name":"Benchtop"},"241":{"id":"241","resource_type":"3","parent_id":"44","name":"Wall tiles"},"242":{"id":"242","resource_type":"3","parent_id":"45","name":"Floor stain"},"243":{"id":"243","resource_type":"3","parent_id":"25","name":"Soap dispenser"},"244":{"id":"244","resource_type":"3","parent_id":"23","name":"Carpet strips"},"245":{"id":"245","resource_type":"3","parent_id":"23","name":"Flyer holder"},"246":{"id":"246","resource_type":"3","parent_id":"27","name":"Basin"},"247":{"id":"247","resource_type":"3","parent_id":"27","name":"Door vent"},"248":{"id":"248","resource_type":"3","parent_id":"46","name":"Drain & overflow"},"250":{"id":"250","resource_type":"3","parent_id":"34","name":"Exterior"},"251":{"id":"251","resource_type":"3","parent_id":"47","name":"Hand rails"},"252":{"id":"252","resource_type":"3","parent_id":"47","name":"Metal fittings"},"253":{"id":"253","resource_type":"3","parent_id":"47","name":"Floor"},"254":{"id":"254","resource_type":"3","parent_id":"32","name":"Stair to Innovation"},"255":{"id":"255","resource_type":"3","parent_id":"32","name":"Front corridor"},"256":{"id":"256","resource_type":"3","parent_id":"23","name":"Window ledgers"},"257":{"id":"257","resource_type":"3","parent_id":"23","name":"Turnstiles"},"258":{"id":"258","resource_type":"3","parent_id":"26","name":"Floor drain"},"259":{"id":"259","resource_type":"3","parent_id":"34","name":"Sink"},"260":{"id":"260","resource_type":"3","parent_id":"34","name":"Exhaust grate"},"261":{"id":"261","resource_type":"3","parent_id":"46","name":"Basin"},"262":{"id":"262","resource_type":"3","parent_id":"48","name":"Window sill"},"263":{"id":"263","resource_type":"3","parent_id":"44","name":"Tables"},"264":{"id":"264","resource_type":"3","parent_id":"49","name":"Carpet"},"265":{"id":"265","resource_type":"3","parent_id":"26","name":"Partitons"},"267":{"id":"267","resource_type":"3","parent_id":"50","name":"Table"},"268":{"id":"268","resource_type":"3","parent_id":"44","name":"Shelves"},"269":{"id":"269","resource_type":"3","parent_id":"46","name":"Toilet bowl"},"270":{"id":"270","resource_type":"3","parent_id":"20","name":"Cabinets"},"271":{"id":"271","resource_type":"3","parent_id":"51","name":"Skirting boards"},"272":{"id":"272","resource_type":"3","parent_id":"44","name":"Sink"},"274":{"id":"274","resource_type":"3","parent_id":"52","name":"Carpet"},"275":{"id":"275","resource_type":"3","parent_id":"22","name":"Fridge"},"276":{"id":"276","resource_type":"3","parent_id":"51","name":"Wooden step"},"278":{"id":"278","resource_type":"3","parent_id":"48","name":"Carpet"},"279":{"id":"279","resource_type":"3","parent_id":"22","name":"Sills"},"280":{"id":"280","resource_type":"3","parent_id":"22","name":"Microwave"},"282":{"id":"282","resource_type":"3","parent_id":"50","name":"Sliding Entry Doors"},"283":{"id":"283","resource_type":"3","parent_id":"53","name":"Window Sills"},"284":{"id":"284","resource_type":"3","parent_id":"54","name":"Table"},"285":{"id":"285","resource_type":"3","parent_id":"34","name":"Vacuum cleaner"},"286":{"id":"286","resource_type":"3","parent_id":"26","name":"Air freshener"},"287":{"id":"287","resource_type":"3","parent_id":"49","name":"Bench top"},"288":{"id":"288","resource_type":"3","parent_id":"52","name":"Wall"},"289":{"id":"289","resource_type":"3","parent_id":"52","name":"Filing shelves"},"290":{"id":"290","resource_type":"3","parent_id":"48","name":"Partition ledgers"},"291":{"id":"291","resource_type":"3","parent_id":"48","name":"Table"},"292":{"id":"292","resource_type":"3","parent_id":"48","name":"Bench"},"293":{"id":"293","resource_type":"3","parent_id":"56","name":"Shelves"},"294":{"id":"294","resource_type":"3","parent_id":"26","name":"Hand dryer"},"295":{"id":"295","resource_type":"3","parent_id":"26","name":"Door handle"},"296":{"id":"296","resource_type":"3","parent_id":"47","name":"Under seat lid"},"297":{"id":"297","resource_type":"3","parent_id":"57","name":"Basin"},"298":{"id":"298","resource_type":"3","parent_id":"26","name":"Basins"},"299":{"id":"299","resource_type":"3","parent_id":"46","name":"Shower"},"300":{"id":"300","resource_type":"3","parent_id":"46","name":"Door handles"},"301":{"id":"301","resource_type":"3","parent_id":"46","name":"Male"},"302":{"id":"302","resource_type":"3","parent_id":"26","name":"Soap"},"303":{"id":"303","resource_type":"3","parent_id":"22","name":"Waste bins"},"304":{"id":"304","resource_type":"3","parent_id":"58","name":"Door"},"305":{"id":"305","resource_type":"3","parent_id":"59","name":"Walls"},"306":{"id":"306","resource_type":"3","parent_id":"59","name":"Desks"},"307":{"id":"307","resource_type":"3","parent_id":"48","name":"Door"},"308":{"id":"308","resource_type":"3","parent_id":"52","name":"Partitions"},"309":{"id":"309","resource_type":"3","parent_id":"60","name":"Floor"},"310":{"id":"310","resource_type":"3","parent_id":"52","name":"Glass partition ledgers"},"311":{"id":"311","resource_type":"3","parent_id":"22","name":"Skirting boards"},"312":{"id":"312","resource_type":"3","parent_id":"34","name":"Door lock"},"313":{"id":"313","resource_type":"3","parent_id":"34","name":"Floor"},"314":{"id":"314","resource_type":"3","parent_id":"52","name":"Waste station bins"},"315":{"id":"315","resource_type":"3","parent_id":"61","name":"Debris"},"316":{"id":"316","resource_type":"3","parent_id":"57","name":"Bins"},"317":{"id":"317","resource_type":"3","parent_id":"32","name":"Bannisters"},"318":{"id":"318","resource_type":"3","parent_id":"62","name":"Desk"},"319":{"id":"319","resource_type":"3","parent_id":"63","name":"Carpet"},"320":{"id":"320","resource_type":"3","parent_id":"20","name":"Carpet"},"321":{"id":"321","resource_type":"3","parent_id":"22","name":"Log book"},"322":{"id":"322","resource_type":"3","parent_id":"64","name":"Office space"},"323":{"id":"323","resource_type":"3","parent_id":"65","name":"Round table"},"324":{"id":"324","resource_type":"3","parent_id":"49","name":"Wall"},"325":{"id":"325","resource_type":"3","parent_id":"66","name":"Debris"},"326":{"id":"326","resource_type":"3","parent_id":"26","name":"Vanity"},"327":{"id":"327","resource_type":"3","parent_id":"26","name":"Floor"},"328":{"id":"328","resource_type":"3","parent_id":"67","name":"Entry doors"},"329":{"id":"329","resource_type":"3","parent_id":"46","name":"Doors"},"330":{"id":"330","resource_type":"3","parent_id":"62","name":"Floor"},"331":{"id":"331","resource_type":"3","parent_id":"22","name":"Floor"},"332":{"id":"332","resource_type":"3","parent_id":"68","name":"Ledgers"},"333":{"id":"333","resource_type":"3","parent_id":"34","name":"Products"},"334":{"id":"334","resource_type":"3","parent_id":"27","name":"Floor"},"335":{"id":"335","resource_type":"3","parent_id":"46","name":"Metal door vents"},"336":{"id":"336","resource_type":"3","parent_id":"51","name":"Steps"},"337":{"id":"337","resource_type":"3","parent_id":"25","name":"Floor"},"338":{"id":"338","resource_type":"3","parent_id":"25","name":"Mirror"},"339":{"id":"339","resource_type":"3","parent_id":"52","name":"Desks"},"340":{"id":"340","resource_type":"3","parent_id":"46","name":"Backroom"},"341":{"id":"341","resource_type":"3","parent_id":"69","name":"Dining Room "},"342":{"id":"342","resource_type":"3","parent_id":"70","name":"Wooden floor"},"343":{"id":"343","resource_type":"3","parent_id":"69","name":"Function Room"},"344":{"id":"344","resource_type":"3","parent_id":"69","name":"Small Bedroom"},"345":{"id":"345","resource_type":"3","parent_id":"59","name":"Basin in washroom"},"346":{"id":"346","resource_type":"3","parent_id":"71","name":"Carpet"},"347":{"id":"347","resource_type":"3","parent_id":"26","name":"Ledgers"},"348":{"id":"348","resource_type":"3","parent_id":"22","name":"Store room"},"349":{"id":"349","resource_type":"3","parent_id":"22","name":"Stock"},"350":{"id":"350","resource_type":"3","parent_id":"32","name":"Entrance stairs"},"351":{"id":"351","resource_type":"3","parent_id":"62","name":"Wall"},"352":{"id":"352","resource_type":"3","parent_id":"20","name":"Bench top"},"353":{"id":"353","resource_type":"3","parent_id":"47","name":"Sanitary bin"},"354":{"id":"354","resource_type":"3","parent_id":"72","name":"Floor"},"355":{"id":"355","resource_type":"3","parent_id":"26","name":"Urinal wall"},"356":{"id":"356","resource_type":"3","parent_id":"51","name":"Metal ledgers"},"357":{"id":"357","resource_type":"3","parent_id":"25","name":"Sanitary bin"},"358":{"id":"358","resource_type":"3","parent_id":"25","name":"Wall"},"359":{"id":"359","resource_type":"3","parent_id":"73","name":"Table"},"360":{"id":"360","resource_type":"3","parent_id":"46","name":"Towel"},"361":{"id":"361","resource_type":"3","parent_id":"52","name":"Horizontal surfaces"},"362":{"id":"362","resource_type":"3","parent_id":"49","name":"Machinery"},"363":{"id":"363","resource_type":"3","parent_id":"22","name":"Sink drain"},"364":{"id":"364","resource_type":"3","parent_id":"47","name":"Toilet"},"365":{"id":"365","resource_type":"3","parent_id":"26","name":"Urinals"},"366":{"id":"366","resource_type":"3","parent_id":"52","name":"Window sills"},"367":{"id":"367","resource_type":"3","parent_id":"25","name":"Taps"},"368":{"id":"368","resource_type":"3","parent_id":"44","name":"Floor"},"369":{"id":"369","resource_type":"3","parent_id":"44","name":"Walls"},"371":{"id":"371","resource_type":"3","parent_id":"62","name":"Venetian Blinds"},"372":{"id":"372","resource_type":"3","parent_id":"52","name":"Table"},"373":{"id":"373","resource_type":"3","parent_id":"51","name":"Doors"},"374":{"id":"374","resource_type":"3","parent_id":"49","name":"Secure document bins"},"375":{"id":"375","resource_type":"3","parent_id":"74","name":"Metal frames"},"376":{"id":"376","resource_type":"3","parent_id":"75","name":"Controls"},"377":{"id":"377","resource_type":"3","parent_id":"75","name":"Carpet"},"378":{"id":"378","resource_type":"3","parent_id":"75","name":"Metal frame"},"379":{"id":"379","resource_type":"3","parent_id":"44","name":"Splash back"},"382":{"id":"382","resource_type":"3","parent_id":"62","name":"Door"},"383":{"id":"383","resource_type":"3","parent_id":"27","name":"Glass "},"384":{"id":"384","resource_type":"3","parent_id":"76","name":"Windows"},"385":{"id":"385","resource_type":"3","parent_id":"76","name":"Corridor"},"386":{"id":"386","resource_type":"3","parent_id":"51","name":"Banister"},"387":{"id":"387","resource_type":"3","parent_id":"77","name":"External foyer"},"388":{"id":"388","resource_type":"3","parent_id":"48","name":"Glass partitions"},"389":{"id":"389","resource_type":"3","parent_id":"78","name":"Table"},"390":{"id":"390","resource_type":"3","parent_id":"48","name":"Chair"},"391":{"id":"391","resource_type":"3","parent_id":"65","name":"Coffee table"},"392":{"id":"392","resource_type":"3","parent_id":"65","name":"Window ledgers"},"393":{"id":"393","resource_type":"3","parent_id":"44","name":"Cupboard faces"},"394":{"id":"394","resource_type":"3","parent_id":"36","name":"Floors"},"395":{"id":"395","resource_type":"3","parent_id":"79","name":"Floors"},"396":{"id":"396","resource_type":"3","parent_id":"46","name":"Floors"},"397":{"id":"397","resource_type":"3","parent_id":"46","name":"Hand Dryer"},"398":{"id":"398","resource_type":"3","parent_id":"80","name":"Change Area"},"399":{"id":"399","resource_type":"3","parent_id":"80","name":"Inwards Area"},"400":{"id":"400","resource_type":"3","parent_id":"80","name":"Desks"},"401":{"id":"401","resource_type":"3","parent_id":"80","name":"Glass"},"404":{"id":"404","resource_type":"3","parent_id":"52","name":"Light switches"},"405":{"id":"405","resource_type":"3","parent_id":"22","name":"Walls"},"406":{"id":"406","resource_type":"3","parent_id":"36","name":"Ceilings"},"407":{"id":"407","resource_type":"3","parent_id":"74","name":"Entrance area"},"408":{"id":"408","resource_type":"3","parent_id":"82","name":"Floors"},"409":{"id":"409","resource_type":"3","parent_id":"83","name":"Floor"},"410":{"id":"410","resource_type":"3","parent_id":"29","name":"Partition glass"},"411":{"id":"411","resource_type":"3","parent_id":"52","name":"Windows"},"412":{"id":"412","resource_type":"3","parent_id":"52","name":"Glass partitions"},"413":{"id":"413","resource_type":"3","parent_id":"52","name":"Door"},"414":{"id":"414","resource_type":"3","parent_id":"62","name":"Partition glass"},"415":{"id":"415","resource_type":"3","parent_id":"50","name":"Carpet"},"416":{"id":"416","resource_type":"3","parent_id":"23","name":"Under stairs"},"417":{"id":"417","resource_type":"3","parent_id":"32","name":"Ashtray"},"418":{"id":"418","resource_type":"3","parent_id":"84","name":"Shower"},"419":{"id":"419","resource_type":"3","parent_id":"84","name":"Washrooms"},"420":{"id":"420","resource_type":"3","parent_id":"84","name":"Kitchen"},"421":{"id":"421","resource_type":"3","parent_id":"30","name":"Walls"},"424":{"id":"424","resource_type":"3","parent_id":"62","name":"Bookshelves"},"425":{"id":"425","resource_type":"3","parent_id":"85","name":"Recycling bin"},"426":{"id":"426","resource_type":"3","parent_id":"86","name":"Carpet"},"427":{"id":"427","resource_type":"3","parent_id":"86","name":"Showers"},"428":{"id":"428","resource_type":"3","parent_id":"86","name":"Male washroom"},"429":{"id":"429","resource_type":"3","parent_id":"86","name":"Female washroom"},"430":{"id":"430","resource_type":"3","parent_id":"87","name":"Floors"},"431":{"id":"431","resource_type":"3","parent_id":"36","name":"Windows"},"432":{"id":"432","resource_type":"3","parent_id":"51","name":"Wall"},"433":{"id":"433","resource_type":"3","parent_id":"28","name":"Bins"},"434":{"id":"434","resource_type":"3","parent_id":"36","name":"Power points"},"435":{"id":"435","resource_type":"3","parent_id":"36","name":"Tiled floor"},"436":{"id":"436","resource_type":"3","parent_id":"58","name":"Stairs"},"437":{"id":"437","resource_type":"3","parent_id":"58","name":"Landing"},"438":{"id":"438","resource_type":"3","parent_id":"82","name":"Windows"},"439":{"id":"439","resource_type":"3","parent_id":"89","name":"Skirting boards"},"440":{"id":"440","resource_type":"3","parent_id":"89","name":"Toilet"},"441":{"id":"441","resource_type":"3","parent_id":"90","name":"Sanitary bin"},"442":{"id":"442","resource_type":"3","parent_id":"90","name":"Skirting boards"},"443":{"id":"443","resource_type":"3","parent_id":"90","name":"Bottom of bowls"},"444":{"id":"444","resource_type":"3","parent_id":"89","name":"Floor"},"445":{"id":"445","resource_type":"3","parent_id":"74","name":"Door"},"446":{"id":"446","resource_type":"3","parent_id":"63","name":"Window ledgers"},"447":{"id":"447","resource_type":"3","parent_id":"90","name":"Walls"},"448":{"id":"448","resource_type":"3","parent_id":"50","name":"Entrance"},"449":{"id":"449","resource_type":"3","parent_id":"90","name":"Window sill"},"450":{"id":"450","resource_type":"3","parent_id":"90","name":"Floor"},"451":{"id":"451","resource_type":"3","parent_id":"90","name":"Power points"},"452":{"id":"452","resource_type":"3","parent_id":"90","name":"Toilet bowl"},"453":{"id":"453","resource_type":"3","parent_id":"48","name":"Hard waste"},"454":{"id":"454","resource_type":"3","parent_id":"22","name":"Trolleys"},"455":{"id":"455","resource_type":"3","parent_id":"56","name":"Carpet"},"456":{"id":"456","resource_type":"3","parent_id":"56","name":"Chairs"},"457":{"id":"457","resource_type":"3","parent_id":"91","name":"Tiles"},"458":{"id":"458","resource_type":"3","parent_id":"92","name":"Floor"},"459":{"id":"459","resource_type":"3","parent_id":"93","name":"Shelves"},"460":{"id":"460","resource_type":"3","parent_id":"57","name":"Partitions"},"461":{"id":"461","resource_type":"3","parent_id":"57","name":"Walls"},"462":{"id":"462","resource_type":"3","parent_id":"36","name":"Carpet"},"463":{"id":"463","resource_type":"3","parent_id":"88","name":"Stains"},"464":{"id":"464","resource_type":"3","parent_id":"88","name":"Carpet"},"465":{"id":"465","resource_type":"3","parent_id":"88","name":"Ballestradt"},"466":{"id":"466","resource_type":"3","parent_id":"82","name":"Tiles lifting"},"467":{"id":"467","resource_type":"3","parent_id":"36","name":"Exit light"},"468":{"id":"468","resource_type":"3","parent_id":"62","name":"Table"},"469":{"id":"469","resource_type":"3","parent_id":"22","name":"Appliances"},"470":{"id":"470","resource_type":"3","parent_id":"94","name":"Milk pitcher rinsers"},"471":{"id":"471","resource_type":"3","parent_id":"26","name":"Entry door"},"472":{"id":"472","resource_type":"3","parent_id":"52","name":"Coffee machine "},"473":{"id":"473","resource_type":"3","parent_id":"22","name":"Coffee machine"},"475":{"id":"475","resource_type":"3","parent_id":"49","name":"Bin"},"476":{"id":"476","resource_type":"3","parent_id":"95","name":"Stair"},"477":{"id":"477","resource_type":"3","parent_id":"73","name":"Glass partition"},"478":{"id":"478","resource_type":"3","parent_id":"44","name":"Glass partition"},"479":{"id":"479","resource_type":"3","parent_id":"46","name":"Partitions"},"480":{"id":"480","resource_type":"3","parent_id":"96","name":"Walls"},"481":{"id":"481","resource_type":"3","parent_id":"97","name":"Banister"},"482":{"id":"482","resource_type":"3","parent_id":"39","name":"Bin area"},"483":{"id":"483","resource_type":"3","parent_id":"98","name":"Skirtings"},"484":{"id":"484","resource_type":"3","parent_id":"73","name":"Carpet"},"485":{"id":"485","resource_type":"3","parent_id":"34","name":"Chemicals"},"486":{"id":"486","resource_type":"3","parent_id":"99","name":"Bookshelves"},"487":{"id":"487","resource_type":"3","parent_id":"99","name":"Table"},"488":{"id":"488","resource_type":"3","parent_id":"99","name":"Power points"},"489":{"id":"489","resource_type":"3","parent_id":"52","name":"Skirting boards"},"490":{"id":"490","resource_type":"3","parent_id":"100","name":"Tiled floor"},"491":{"id":"491","resource_type":"3","parent_id":"101","name":"Bin"},"492":{"id":"492","resource_type":"3","parent_id":"101","name":"Taps"},"493":{"id":"493","resource_type":"3","parent_id":"101","name":"Tiled floor"},"494":{"id":"494","resource_type":"3","parent_id":"101","name":"Cleaners store area"},"495":{"id":"495","resource_type":"3","parent_id":"100","name":"Window ledgers"},"496":{"id":"496","resource_type":"3","parent_id":"22","name":"Carpet"},"497":{"id":"497","resource_type":"3","parent_id":"52","name":"Floor"},"498":{"id":"498","resource_type":"3","parent_id":"52","name":"Shelves"},"499":{"id":"499","resource_type":"3","parent_id":"26","name":"Basin taps"},"500":{"id":"500","resource_type":"3","parent_id":"57","name":"Cubicle doors"},"501":{"id":"501","resource_type":"3","parent_id":"51","name":"Shelves below"},"502":{"id":"502","resource_type":"3","parent_id":"47","name":"Door"},"503":{"id":"503","resource_type":"3","parent_id":"36","name":"Coke machine"},"504":{"id":"504","resource_type":"3","parent_id":"26","name":"Bowl"},"505":{"id":"505","resource_type":"3","parent_id":"87","name":"Sills"},"506":{"id":"506","resource_type":"3","parent_id":"74","name":"Wooden floor"},"507":{"id":"507","resource_type":"3","parent_id":"103","name":"Benches"},"508":{"id":"508","resource_type":"3","parent_id":"103","name":"Desks"},"509":{"id":"509","resource_type":"3","parent_id":"103","name":"Walls"},"510":{"id":"510","resource_type":"3","parent_id":"22","name":"Furniture"},"511":{"id":"511","resource_type":"3","parent_id":"22","name":"Sink"},"512":{"id":"512","resource_type":"3","parent_id":"51","name":"Sides"},"513":{"id":"513","resource_type":"3","parent_id":"25","name":"Ceiling vents"},"514":{"id":"514","resource_type":"3","parent_id":"74","name":"Floor"},"515":{"id":"515","resource_type":"3","parent_id":"62","name":"Benches"},"516":{"id":"516","resource_type":"3","parent_id":"62","name":"Clients chairs"},"517":{"id":"517","resource_type":"3","parent_id":"104","name":"Floor"},"518":{"id":"518","resource_type":"3","parent_id":"105","name":"Floor"},"519":{"id":"519","resource_type":"3","parent_id":"106","name":"Glass ledgers"},"520":{"id":"520","resource_type":"3","parent_id":"25","name":"Shower"},"521":{"id":"521","resource_type":"3","parent_id":"34","name":"Cloths"},"522":{"id":"522","resource_type":"3","parent_id":"47","name":"Toilet bowl"},"523":{"id":"523","resource_type":"3","parent_id":"26","name":"Shower"},"524":{"id":"524","resource_type":"3","parent_id":"62","name":"Deliveries"},"525":{"id":"525","resource_type":"3","parent_id":"48","name":"Bin"},"526":{"id":"526","resource_type":"3","parent_id":"62","name":"Log book"},"527":{"id":"527","resource_type":"3","parent_id":"20","name":"Door"},"528":{"id":"528","resource_type":"3","parent_id":"107","name":"Glass doors"},"529":{"id":"529","resource_type":"3","parent_id":"22","name":"Cupboard faces"},"530":{"id":"530","resource_type":"3","parent_id":"26","name":"Walls"},"531":{"id":"531","resource_type":"3","parent_id":"47","name":"Walls"},"532":{"id":"532","resource_type":"3","parent_id":"36","name":"Walls"},"533":{"id":"533","resource_type":"3","parent_id":"62","name":"Counter"},"534":{"id":"534","resource_type":"3","parent_id":"62","name":"Sills"},"535":{"id":"535","resource_type":"3","parent_id":"108","name":"Wall"},"536":{"id":"536","resource_type":"3","parent_id":"109","name":"Window ledge"},"537":{"id":"537","resource_type":"3","parent_id":"74","name":"Cobwebs"},"538":{"id":"538","resource_type":"3","parent_id":"65","name":"Carpet"},"539":{"id":"539","resource_type":"3","parent_id":"65","name":"White benchtops"},"540":{"id":"540","resource_type":"3","parent_id":"65","name":"Desks"},"541":{"id":"541","resource_type":"3","parent_id":"27","name":"Shower"},"542":{"id":"542","resource_type":"3","parent_id":"83","name":"Bin"},"543":{"id":"543","resource_type":"3","parent_id":"110","name":"Round table"},"544":{"id":"544","resource_type":"3","parent_id":"111","name":"Door"},"545":{"id":"545","resource_type":"3","parent_id":"111","name":"Skirting boards"},"546":{"id":"546","resource_type":"3","parent_id":"22","name":"Partition ledgers"},"547":{"id":"547","resource_type":"3","parent_id":"52","name":"Book shelves"},"548":{"id":"548","resource_type":"3","parent_id":"112","name":"Bin liner"},"549":{"id":"549","resource_type":"3","parent_id":"113","name":"Bin"},"550":{"id":"550","resource_type":"3","parent_id":"114","name":"Floor"},"551":{"id":"551","resource_type":"3","parent_id":"22","name":"Table"},"552":{"id":"552","resource_type":"3","parent_id":"26","name":"Toilet bowl"},"553":{"id":"553","resource_type":"3","parent_id":"26","name":"Ceiling vent"},"554":{"id":"554","resource_type":"3","parent_id":"74","name":"Carpet"},"555":{"id":"555","resource_type":"3","parent_id":"22","name":"Benchtop"},"556":{"id":"556","resource_type":"3","parent_id":"22","name":"Bin cupboard"},"557":{"id":"557","resource_type":"3","parent_id":"52","name":"Glass door"},"558":{"id":"558","resource_type":"3","parent_id":"34","name":"Wet floor signs"},"559":{"id":"559","resource_type":"3","parent_id":"49","name":"Rubbish"},"560":{"id":"560","resource_type":"3","parent_id":"115","name":"Glass partition ledgers"},"561":{"id":"561","resource_type":"3","parent_id":"26","name":"Hand towel dispenser"},"562":{"id":"562","resource_type":"3","parent_id":"26","name":"Stainless steel plates"},"563":{"id":"563","resource_type":"3","parent_id":"26","name":"Soap dispenser"},"564":{"id":"564","resource_type":"3","parent_id":"49","name":"Table"},"565":{"id":"565","resource_type":"3","parent_id":"52","name":"Power points"},"566":{"id":"566","resource_type":"3","parent_id":"22","name":"Hand towel dispenser"},"567":{"id":"567","resource_type":"3","parent_id":"44","name":"Fridge"},"568":{"id":"568","resource_type":"3","parent_id":"52","name":"Hard rubbish"},"569":{"id":"569","resource_type":"3","parent_id":"52","name":"Bench tops"},"570":{"id":"570","resource_type":"3","parent_id":"65","name":"Wall"},"571":{"id":"571","resource_type":"3","parent_id":"116","name":"Walls"},"572":{"id":"572","resource_type":"3","parent_id":"101","name":"Glass doors"},"573":{"id":"573","resource_type":"3","parent_id":"32","name":"All areas"},"574":{"id":"574","resource_type":"3","parent_id":"117","name":"All areas"},"575":{"id":"575","resource_type":"3","parent_id":"118","name":"All areas"},"576":{"id":"576","resource_type":"3","parent_id":"46","name":"Bathtub"},"578":{"id":"578","resource_type":"3","parent_id":"119","name":"Floor"},"579":{"id":"579","resource_type":"3","parent_id":"120","name":"Walls"},"581":{"id":"581","resource_type":"3","parent_id":"52","name":"Pylon"},"582":{"id":"582","resource_type":"3","parent_id":"119","name":"Mirror"},"583":{"id":"583","resource_type":"3","parent_id":"57","name":"Bowls"},"584":{"id":"584","resource_type":"3","parent_id":"57","name":"Mirrors"},"585":{"id":"585","resource_type":"3","parent_id":"36","name":"Partition sills"},"586":{"id":"586","resource_type":"3","parent_id":"44","name":"Microwave"},"587":{"id":"587","resource_type":"3","parent_id":"25","name":"Toilet seat"},"588":{"id":"588","resource_type":"3","parent_id":"122","name":"Floor"},"589":{"id":"589","resource_type":"3","parent_id":"123","name":"Door"},"590":{"id":"590","resource_type":"3","parent_id":"55","name":"Lids"},"591":{"id":"591","resource_type":"3","parent_id":"48","name":"Skirting boards"},"592":{"id":"592","resource_type":"3","parent_id":"57","name":"Doors"},"593":{"id":"593","resource_type":"3","parent_id":"124","name":"Mixed Recycling "},"594":{"id":"594","resource_type":"3","parent_id":"101","name":"Surfaces"},"595":{"id":"595","resource_type":"3","parent_id":"125","name":"Ceiling"},"596":{"id":"596","resource_type":"3","parent_id":"126","name":"Window sills"},"597":{"id":"597","resource_type":"3","parent_id":"73","name":"Bins"},"598":{"id":"598","resource_type":"3","parent_id":"25","name":"Toilet brush"},"599":{"id":"599","resource_type":"3","parent_id":"44","name":"Cupboard doors"},"600":{"id":"600","resource_type":"3","parent_id":"52","name":"White cabinets tops"},"601":{"id":"601","resource_type":"3","parent_id":"96","name":"Door"},"602":{"id":"602","resource_type":"3","parent_id":"26","name":"Metal hand rails"},"603":{"id":"603","resource_type":"3","parent_id":"127","name":"Glass partitions"},"604":{"id":"604","resource_type":"3","parent_id":"25","name":"Consumables cupboard"},"605":{"id":"605","resource_type":"3","parent_id":"25","name":"Internal wall"},"606":{"id":"606","resource_type":"3","parent_id":"101","name":"Walls"},"607":{"id":"607","resource_type":"3","parent_id":"93","name":"Walls"},"608":{"id":"608","resource_type":"3","parent_id":"26","name":"Basin bench top"},"609":{"id":"609","resource_type":"3","parent_id":"106","name":"Bins"},"610":{"id":"610","resource_type":"3","parent_id":"128","name":"Metal frame"},"611":{"id":"611","resource_type":"3","parent_id":"84","name":"Power points"},"612":{"id":"612","resource_type":"3","parent_id":"84","name":"Water fountain"},"613":{"id":"613","resource_type":"3","parent_id":"48","name":"General cleanliness"},"614":{"id":"614","resource_type":"3","parent_id":"52","name":"Wooden floors"},"615":{"id":"615","resource_type":"3","parent_id":"129","name":"Spare desk"},"616":{"id":"616","resource_type":"3","parent_id":"129","name":"Filing units"},"617":{"id":"617","resource_type":"3","parent_id":"36","name":"Glass floor"},"618":{"id":"618","resource_type":"3","parent_id":"86","name":"Door"},"619":{"id":"619","resource_type":"3","parent_id":"101","name":"Soap dispenser"},"620":{"id":"620","resource_type":"3","parent_id":"86","name":"Mirrors"},"621":{"id":"621","resource_type":"3","parent_id":"32","name":"Marble slabs"},"622":{"id":"622","resource_type":"3","parent_id":"130","name":"Doors"},"623":{"id":"623","resource_type":"3","parent_id":"131","name":"Glass partition"},"624":{"id":"624","resource_type":"3","parent_id":"52","name":"Partition walls"},"625":{"id":"625","resource_type":"3","parent_id":"122","name":"Metal frames"},"626":{"id":"626","resource_type":"3","parent_id":"122","name":"Door"},"627":{"id":"627","resource_type":"3","parent_id":"62","name":"Stock delivery"},"628":{"id":"628","resource_type":"3","parent_id":"34","name":"Stock"},"629":{"id":"629","resource_type":"3","parent_id":"34","name":"Rubbish"},"630":{"id":"630","resource_type":"3","parent_id":"78","name":"Carpet"},"631":{"id":"631","resource_type":"3","parent_id":"26","name":"Basin drain"},"632":{"id":"632","resource_type":"3","parent_id":"132","name":"Basin taps"},"633":{"id":"633","resource_type":"3","parent_id":"132","name":"Toilet bowl"},"634":{"id":"634","resource_type":"3","parent_id":"133","name":"Door"},"635":{"id":"635","resource_type":"3","parent_id":"83","name":"Garden beds"},"636":{"id":"636","resource_type":"3","parent_id":"83","name":"Rubbish bin"},"637":{"id":"637","resource_type":"3","parent_id":"48","name":"Walls"},"638":{"id":"638","resource_type":"3","parent_id":"65","name":"Skirting boards"},"639":{"id":"639","resource_type":"3","parent_id":"22","name":"Window sills"},"640":{"id":"640","resource_type":"3","parent_id":"134","name":"Skirting boards"},"641":{"id":"641","resource_type":"3","parent_id":"135","name":"White cupboards"},"642":{"id":"642","resource_type":"3","parent_id":"136","name":"Shelves"},"643":{"id":"643","resource_type":"3","parent_id":"137","name":"Shelves"},"644":{"id":"644","resource_type":"3","parent_id":"138","name":"Floor"},"645":{"id":"645","resource_type":"3","parent_id":"25","name":"Skirting boards"},"646":{"id":"646","resource_type":"3","parent_id":"88","name":"Floor"},"647":{"id":"647","resource_type":"3","parent_id":"44","name":"Not cleaned"},"648":{"id":"648","resource_type":"3","parent_id":"97","name":"Walls"},"649":{"id":"649","resource_type":"3","parent_id":"48","name":"Floor"},"652":{"id":"652","resource_type":"3","parent_id":"44","name":"Waste bins"},"653":{"id":"653","resource_type":"3","parent_id":"25","name":"Waste bin"},"654":{"id":"654","resource_type":"3","parent_id":"129","name":"Glass panels"},"655":{"id":"655","resource_type":"3","parent_id":"62","name":"Grey walls"},"656":{"id":"656","resource_type":"3","parent_id":"36","name":"Grey walls"},"657":{"id":"657","resource_type":"3","parent_id":"83","name":"Control panel wall"},"658":{"id":"658","resource_type":"3","parent_id":"25","name":"Hand towels"},"659":{"id":"659","resource_type":"3","parent_id":"73","name":"Bench top"},"660":{"id":"660","resource_type":"3","parent_id":"52","name":"Black cabinets"},"661":{"id":"661","resource_type":"3","parent_id":"74","name":"Side glass"},"662":{"id":"662","resource_type":"3","parent_id":"48","name":"White bench top"},"663":{"id":"663","resource_type":"3","parent_id":"26","name":"Toilet roll"},"664":{"id":"664","resource_type":"3","parent_id":"83","name":"Skirting board"},"665":{"id":"665","resource_type":"3","parent_id":"48","name":"Divisional panel"},"666":{"id":"666","resource_type":"3","parent_id":"129","name":"Steps"},"667":{"id":"667","resource_type":"3","parent_id":"74","name":"Glass doors"},"668":{"id":"668","resource_type":"3","parent_id":"74","name":"Metal handle"},"669":{"id":"669","resource_type":"3","parent_id":"122","name":"Black couch"},"670":{"id":"670","resource_type":"3","parent_id":"122","name":"Wall"},"671":{"id":"671","resource_type":"3","parent_id":"124","name":"Carpet"},"672":{"id":"672","resource_type":"3","parent_id":"36","name":"Door"},"673":{"id":"673","resource_type":"3","parent_id":"25","name":"Entrance door"},"674":{"id":"674","resource_type":"3","parent_id":"34","name":"Blue tarp"},"675":{"id":"675","resource_type":"3","parent_id":"22","name":"Marble tables"},"676":{"id":"676","resource_type":"3","parent_id":"65","name":"Glass partitions"},"677":{"id":"677","resource_type":"3","parent_id":"139","name":"Carpet"},"678":{"id":"678","resource_type":"3","parent_id":"27","name":"Ceiling vent"},"679":{"id":"679","resource_type":"3","parent_id":"122","name":"Wooden feature"},"680":{"id":"680","resource_type":"3","parent_id":"101","name":"Mirror"},"681":{"id":"681","resource_type":"3","parent_id":"122","name":"Entrance door"},"682":{"id":"682","resource_type":"3","parent_id":"74","name":"Wall"},"683":{"id":"683","resource_type":"3","parent_id":"25","name":"Toilet cubicle"},"684":{"id":"684","resource_type":"3","parent_id":"52","name":"Cabinets tops"},"685":{"id":"685","resource_type":"3","parent_id":"46","name":"Walls"},"686":{"id":"686","resource_type":"3","parent_id":"124","name":"Bins"},"687":{"id":"687","resource_type":"3","parent_id":"140","name":"Organic waste bin"},"688":{"id":"688","resource_type":"3","parent_id":"122","name":"Carpet"},"689":{"id":"689","resource_type":"3","parent_id":"122","name":"Stair"},"690":{"id":"690","resource_type":"3","parent_id":"34","name":"Door"},"691":{"id":"691","resource_type":"3","parent_id":"62","name":"Window ledgers"},"692":{"id":"692","resource_type":"3","parent_id":"62","name":"Ceiling"},"693":{"id":"693","resource_type":"3","parent_id":"25","name":"Cubicle doors"},"694":{"id":"694","resource_type":"3","parent_id":"26","name":"Light switches"},"695":{"id":"695","resource_type":"3","parent_id":"22","name":"Delivery"},"696":{"id":"696","resource_type":"3","parent_id":"110","name":"Window ledgers"},"697":{"id":"697","resource_type":"3","parent_id":"110","name":"Blinds"},"698":{"id":"698","resource_type":"3","parent_id":"26","name":"Cubicle doors"},"699":{"id":"699","resource_type":"3","parent_id":"98","name":"Walls"},"700":{"id":"700","resource_type":"3","parent_id":"32","name":"Rear of building"},"701":{"id":"701","resource_type":"3","parent_id":"32","name":"Front garden beds"},"702":{"id":"702","resource_type":"3","parent_id":"119","name":"Tiled walls"},"703":{"id":"703","resource_type":"3","parent_id":"27","name":"Frame"},"704":{"id":"704","resource_type":"3","parent_id":"28","name":"Mixed recycling bin"},"705":{"id":"705","resource_type":"3","parent_id":"133","name":"Floor"},"706":{"id":"706","resource_type":"3","parent_id":"52","name":"Entry door"},"707":{"id":"707","resource_type":"3","parent_id":"57","name":"Floors"},"708":{"id":"708","resource_type":"3","parent_id":"57","name":"Power points"},"709":{"id":"709","resource_type":"3","parent_id":"57","name":"Cistern"},"710":{"id":"710","resource_type":"3","parent_id":"57","name":"Seat"},"711":{"id":"711","resource_type":"3","parent_id":"49","name":"Floor"},"712":{"id":"712","resource_type":"3","parent_id":"52","name":"Wooden bookshelves"},"713":{"id":"713","resource_type":"3","parent_id":"118","name":"Tables"},"714":{"id":"714","resource_type":"3","parent_id":"62","name":"Wooden feature wall"},"715":{"id":"715","resource_type":"3","parent_id":"62","name":"Power points"},"716":{"id":"716","resource_type":"3","parent_id":"141","name":"Door"},"717":{"id":"717","resource_type":"3","parent_id":"62","name":"Bench top"},"718":{"id":"718","resource_type":"3","parent_id":"20","name":"Waste bins"},"719":{"id":"719","resource_type":"3","parent_id":"22","name":"Partition glass"},"720":{"id":"720","resource_type":"3","parent_id":"50","name":"Floor"},"721":{"id":"721","resource_type":"3","parent_id":"49","name":"Window sills"},"722":{"id":"722","resource_type":"3","parent_id":"22","name":"Wooden floor"},"723":{"id":"723","resource_type":"3","parent_id":"142","name":"Skirt"},"724":{"id":"724","resource_type":"3","parent_id":"142","name":"Window Sills"},"725":{"id":"725","resource_type":"3","parent_id":"143","name":"Glass panels"},"726":{"id":"726","resource_type":"3","parent_id":"62","name":"Marble table"},"727":{"id":"727","resource_type":"3","parent_id":"25","name":"Light switches"},"728":{"id":"728","resource_type":"3","parent_id":"144","name":"Banisters"},"729":{"id":"729","resource_type":"3","parent_id":"129","name":"Banisters"},"730":{"id":"730","resource_type":"3","parent_id":"145","name":"Commingle waste bin"},"731":{"id":"731","resource_type":"3","parent_id":"145","name":"Paper & cardboard bin"},"732":{"id":"732","resource_type":"3","parent_id":"145","name":"General waste bin"},"733":{"id":"733","resource_type":"3","parent_id":"145","name":"Waste bin enclosure"},"734":{"id":"734","resource_type":"3","parent_id":"146","name":"General waste bin"},"735":{"id":"735","resource_type":"3","parent_id":"146","name":"Commingle waste bin"},"736":{"id":"736","resource_type":"3","parent_id":"146","name":"Paper & cardboard bin"},"737":{"id":"737","resource_type":"3","parent_id":"32","name":"Waste bins"},"738":{"id":"738","resource_type":"3","parent_id":"122","name":"Glass partitions"},"739":{"id":"739","resource_type":"3","parent_id":"29","name":"Lift tracks"},"740":{"id":"740","resource_type":"3","parent_id":"32","name":"Signage board"},"741":{"id":"741","resource_type":"3","parent_id":"32","name":"Car park entrance"},"742":{"id":"742","resource_type":"3","parent_id":"32","name":"Fire stair"},"743":{"id":"743","resource_type":"3","parent_id":"52","name":"Desk partitions"},"744":{"id":"744","resource_type":"3","parent_id":"22","name":"Hot Plate"},"745":{"id":"745","resource_type":"3","parent_id":"52","name":"Mail Room"},"746":{"id":"746","resource_type":"3","parent_id":"52","name":"Gen"},"747":{"id":"747","resource_type":"3","parent_id":"99","name":"Bench Top"},"748":{"id":"748","resource_type":"3","parent_id":"52","name":"Walls"},"749":{"id":"749","resource_type":"3","parent_id":"52","name":"Grey Cabinets"},"750":{"id":"750","resource_type":"3","parent_id":"119","name":"Taps"},"751":{"id":"751","resource_type":"3","parent_id":"119","name":"Bowls"},"752":{"id":"752","resource_type":"3","parent_id":"144","name":"Cabinet"},"753":{"id":"753","resource_type":"3","parent_id":"32","name":"Entrance door"},"754":{"id":"754","resource_type":"3","parent_id":"122","name":"Window sills"},"755":{"id":"755","resource_type":"3","parent_id":"122","name":"Side table"},"756":{"id":"756","resource_type":"3","parent_id":"147","name":"Waste bin area"},"757":{"id":"757","resource_type":"3","parent_id":"147","name":"Floor"},"758":{"id":"758","resource_type":"3","parent_id":"148","name":"Door"},"759":{"id":"759","resource_type":"3","parent_id":"52","name":"Waste bins"},"760":{"id":"760","resource_type":"3","parent_id":"26","name":"Door vents"},"761":{"id":"761","resource_type":"3","parent_id":"22","name":"Cupboard doors"},"762":{"id":"762","resource_type":"3","parent_id":"25","name":"Hand towel dispenser"},"763":{"id":"763","resource_type":"3","parent_id":"44","name":"Drain"},"764":{"id":"764","resource_type":"3","parent_id":"27","name":"Door frame"},"765":{"id":"765","resource_type":"3","parent_id":"58","name":"Floor"},"766":{"id":"766","resource_type":"3","parent_id":"32","name":"Organic bin"},"767":{"id":"767","resource_type":"3","parent_id":"52","name":"Door grills"},"768":{"id":"768","resource_type":"3","parent_id":"119","name":"Soap dispenser"},"769":{"id":"769","resource_type":"3","parent_id":"97","name":"Lift control"},"770":{"id":"770","resource_type":"3","parent_id":"123","name":"Shelf"},"771":{"id":"771","resource_type":"3","parent_id":"119","name":"Air freshener"},"772":{"id":"772","resource_type":"3","parent_id":"36","name":"Consumables"},"773":{"id":"773","resource_type":"3","parent_id":"57","name":"Overhead rail"},"774":{"id":"774","resource_type":"3","parent_id":"23","name":"Carpet"},"775":{"id":"775","resource_type":"3","parent_id":"37","name":"Floors"},"776":{"id":"776","resource_type":"3","parent_id":"26","name":"Overhead rail"},"777":{"id":"777","resource_type":"3","parent_id":"119","name":"Overhead rail"},"778":{"id":"778","resource_type":"3","parent_id":"149","name":"Steps"},"779":{"id":"779","resource_type":"3","parent_id":"83","name":"Waste bin room"},"780":{"id":"780","resource_type":"3","parent_id":"83","name":"Ceiling lights"},"781":{"id":"781","resource_type":"3","parent_id":"62","name":"Carpet"},"782":{"id":"782","resource_type":"3","parent_id":"62","name":"Lift control panel"},"783":{"id":"783","resource_type":"3","parent_id":"34","name":"Mop heads"},"784":{"id":"784","resource_type":"3","parent_id":"25","name":"Toilet roll dispenser"},"785":{"id":"785","resource_type":"3","parent_id":"25","name":"Disabled hand rails"},"786":{"id":"786","resource_type":"3","parent_id":"54","name":"Partition ledgers"},"787":{"id":"787","resource_type":"3","parent_id":"145","name":"Wall"},"788":{"id":"788","resource_type":"3","parent_id":"26","name":"Skirting"},"789":{"id":"789","resource_type":"3","parent_id":"26","name":"Old dispensers"},"790":{"id":"790","resource_type":"3","parent_id":"150","name":"Desk partitions"},"791":{"id":"791","resource_type":"3","parent_id":"151","name":"Partition ledgers"},"792":{"id":"792","resource_type":"3","parent_id":"151","name":"Printers"},"793":{"id":"793","resource_type":"3","parent_id":"152","name":"Glass partitions"},"794":{"id":"794","resource_type":"3","parent_id":"26","name":"Door hinges"},"795":{"id":"795","resource_type":"3","parent_id":"153","name":"Window ledgers"},"796":{"id":"796","resource_type":"3","parent_id":"52","name":"Thermastat"},"797":{"id":"797","resource_type":"3","parent_id":"52","name":"Coffee table"},"798":{"id":"798","resource_type":"3","parent_id":"62","name":"Door vent"},"799":{"id":"799","resource_type":"3","parent_id":"154","name":"Door"},"800":{"id":"800","resource_type":"3","parent_id":"155","name":"Partition ledgers"},"801":{"id":"801","resource_type":"3","parent_id":"83","name":"Rubbish bags"},"802":{"id":"802","resource_type":"3","parent_id":"156","name":"Skirting Boards"},"803":{"id":"803","resource_type":"3","parent_id":"48","name":"Glass door"},"804":{"id":"804","resource_type":"3","parent_id":"133","name":"Walls"},"805":{"id":"805","resource_type":"3","parent_id":"133","name":"Microwave"},"806":{"id":"806","resource_type":"3","parent_id":"133","name":"Window sills"},"807":{"id":"807","resource_type":"3","parent_id":"49","name":"Equipment"},"808":{"id":"808","resource_type":"3","parent_id":"85","name":"Benchtop"},"809":{"id":"809","resource_type":"3","parent_id":"157","name":"Coffee table"},"810":{"id":"810","resource_type":"3","parent_id":"119","name":"Shower"},"811":{"id":"811","resource_type":"3","parent_id":"52","name":"Fire Equipment"},"812":{"id":"812","resource_type":"3","parent_id":"22","name":"Paper Dispenser"},"813":{"id":"813","resource_type":"3","parent_id":"119","name":"Partition Rail"},"814":{"id":"814","resource_type":"3","parent_id":"119","name":"Doors"},"815":{"id":"815","resource_type":"3","parent_id":"158","name":"Waste bin"},"816":{"id":"816","resource_type":"3","parent_id":"158","name":"Microwave"},"817":{"id":"817","resource_type":"3","parent_id":"159","name":"Printer area"},"818":{"id":"818","resource_type":"3","parent_id":"65","name":"Printer\/fax"},"819":{"id":"819","resource_type":"3","parent_id":"65","name":"Partition ledgers"},"820":{"id":"820","resource_type":"3","parent_id":"160","name":"Window ledgers"},"821":{"id":"821","resource_type":"3","parent_id":"161","name":"Window sills"},"822":{"id":"822","resource_type":"3","parent_id":"27","name":"Bin"},"823":{"id":"823","resource_type":"3","parent_id":"153","name":"Door"},"824":{"id":"824","resource_type":"3","parent_id":"62","name":"Black rug"},"825":{"id":"825","resource_type":"3","parent_id":"133","name":"Cupboard faces"},"826":{"id":"826","resource_type":"3","parent_id":"36","name":"Side door"},"827":{"id":"827","resource_type":"3","parent_id":"62","name":"Glass partitions"},"828":{"id":"828","resource_type":"3","parent_id":"25","name":"Wall plate"},"829":{"id":"829","resource_type":"3","parent_id":"27","name":"Metal frame"},"830":{"id":"830","resource_type":"3","parent_id":"52","name":"Ecobin posters"},"831":{"id":"831","resource_type":"3","parent_id":"34","name":"Tools"},"832":{"id":"832","resource_type":"3","parent_id":"78","name":"Microwave"},"833":{"id":"833","resource_type":"3","parent_id":"84","name":"Wall"},"834":{"id":"834","resource_type":"3","parent_id":"162","name":"Vacuum cleaner"},"835":{"id":"835","resource_type":"3","parent_id":"162","name":"Clean room bucket"},"836":{"id":"836","resource_type":"3","parent_id":"34","name":"Mop bucket"},"837":{"id":"837","resource_type":"3","parent_id":"34","name":"Rubbish trolley"},"838":{"id":"838","resource_type":"3","parent_id":"34","name":"Spray bottle"},"839":{"id":"839","resource_type":"3","parent_id":"49","name":"Boxes"},"840":{"id":"840","resource_type":"3","parent_id":"22","name":"Dishwasher"},"841":{"id":"841","resource_type":"3","parent_id":"47","name":"Floor drain"},"842":{"id":"842","resource_type":"3","parent_id":"25","name":"Toilet rolls"},"843":{"id":"843","resource_type":"3","parent_id":"160","name":"Floor"},"844":{"id":"844","resource_type":"3","parent_id":"160","name":"Door"},"845":{"id":"845","resource_type":"3","parent_id":"163","name":"White wall"},"846":{"id":"846","resource_type":"3","parent_id":"32","name":"Cigarette bins"},"847":{"id":"847","resource_type":"3","parent_id":"145","name":"Cardboard"},"848":{"id":"848","resource_type":"3","parent_id":"52","name":"Machines"},"849":{"id":"849","resource_type":"3","parent_id":"108","name":"Glass"},"850":{"id":"850","resource_type":"3","parent_id":"48","name":"Bench top"},"851":{"id":"851","resource_type":"3","parent_id":"49","name":"Machines"},"852":{"id":"852","resource_type":"3","parent_id":"22","name":"Stair"},"853":{"id":"853","resource_type":"3","parent_id":"164","name":"Glass partitions"},"854":{"id":"854","resource_type":"3","parent_id":"165","name":"Desk partitions"},"855":{"id":"855","resource_type":"3","parent_id":"166","name":"Tables"},"856":{"id":"856","resource_type":"3","parent_id":"153","name":"Table"},"857":{"id":"857","resource_type":"3","parent_id":"52","name":"Sliding door"},"858":{"id":"858","resource_type":"3","parent_id":"83","name":"Rubbish"},"859":{"id":"859","resource_type":"3","parent_id":"32","name":"Recycling bin"},"860":{"id":"860","resource_type":"3","parent_id":"47","name":"Hand towel dispenser"},"861":{"id":"861","resource_type":"3","parent_id":"54","name":"Walls"},"862":{"id":"862","resource_type":"3","parent_id":"167","name":"Floor"},"863":{"id":"863","resource_type":"3","parent_id":"167","name":"Entrance door"},"864":{"id":"864","resource_type":"3","parent_id":"144","name":"Steps"},"865":{"id":"865","resource_type":"3","parent_id":"52","name":"Top of desks partitions"},"866":{"id":"866","resource_type":"3","parent_id":"168","name":"Bannisters"},"867":{"id":"867","resource_type":"3","parent_id":"169","name":"Surfaces"},"868":{"id":"868","resource_type":"3","parent_id":"122","name":"Glass entry doors"},"869":{"id":"869","resource_type":"3","parent_id":"122","name":"Main door"},"870":{"id":"870","resource_type":"3","parent_id":"170","name":"Wall"},"871":{"id":"871","resource_type":"3","parent_id":"56","name":"Tables"},"872":{"id":"872","resource_type":"3","parent_id":"47","name":"Mirror"},"873":{"id":"873","resource_type":"3","parent_id":"137","name":"Bin faces"},"874":{"id":"874","resource_type":"3","parent_id":"22","name":"Drawers "},"875":{"id":"875","resource_type":"3","parent_id":"171","name":"Table"},"876":{"id":"876","resource_type":"3","parent_id":"123","name":"Basin taps"},"877":{"id":"877","resource_type":"3","parent_id":"32","name":"Exhibit panels"},"878":{"id":"878","resource_type":"3","parent_id":"32","name":"Underskirt"},"879":{"id":"879","resource_type":"3","parent_id":"32","name":"Cobblestone floor"},"880":{"id":"880","resource_type":"3","parent_id":"172","name":"Bin"},"881":{"id":"881","resource_type":"3","parent_id":"107","name":"Bin area"},"882":{"id":"882","resource_type":"3","parent_id":"107","name":"Floor drain"},"883":{"id":"883","resource_type":"3","parent_id":"173","name":"Floor"},"884":{"id":"884","resource_type":"3","parent_id":"173","name":"Plant room"},"885":{"id":"885","resource_type":"3","parent_id":"25","name":"Bowls"},"886":{"id":"886","resource_type":"3","parent_id":"168","name":"Carpet"},"887":{"id":"887","resource_type":"3","parent_id":"174","name":"Floor"},"888":{"id":"888","resource_type":"3","parent_id":"174","name":"Window sills"},"889":{"id":"889","resource_type":"3","parent_id":"175","name":"Floor"},"890":{"id":"890","resource_type":"3","parent_id":"176","name":"Floor"},"891":{"id":"891","resource_type":"3","parent_id":"47","name":"Shower"},"892":{"id":"892","resource_type":"3","parent_id":"134","name":"Desks"},"893":{"id":"893","resource_type":"3","parent_id":"134","name":"Glass partitions"},"894":{"id":"894","resource_type":"3","parent_id":"177","name":"Waste"},"895":{"id":"895","resource_type":"3","parent_id":"177","name":"Drawers"},"896":{"id":"896","resource_type":"3","parent_id":"34","name":"Shower floor"},"897":{"id":"897","resource_type":"3","parent_id":"34","name":"Cleaning schedule"},"898":{"id":"898","resource_type":"3","parent_id":"52","name":"Bin liners"},"899":{"id":"899","resource_type":"3","parent_id":"25","name":"Hand drier"},"900":{"id":"900","resource_type":"3","parent_id":"51","name":"Carpet"},"901":{"id":"901","resource_type":"3","parent_id":"110","name":"Power points"},"902":{"id":"902","resource_type":"3","parent_id":"110","name":"Door"},"903":{"id":"903","resource_type":"3","parent_id":"36","name":"Window sills"},"904":{"id":"904","resource_type":"3","parent_id":"111","name":"Printer"},"905":{"id":"905","resource_type":"3","parent_id":"178","name":"Table"},"906":{"id":"906","resource_type":"3","parent_id":"26","name":"Equipment"},"907":{"id":"907","resource_type":"3","parent_id":"145","name":"Lids"},"908":{"id":"908","resource_type":"3","parent_id":"74","name":"Door frame"},"909":{"id":"909","resource_type":"3","parent_id":"122","name":"Decorative feature"},"910":{"id":"910","resource_type":"3","parent_id":"122","name":"Stair banisters"},"911":{"id":"911","resource_type":"3","parent_id":"32","name":"Car park"},"912":{"id":"912","resource_type":"3","parent_id":"179","name":"Floor"},"913":{"id":"913","resource_type":"3","parent_id":"180","name":"Weed"},"914":{"id":"914","resource_type":"3","parent_id":"180","name":"Bin store room"},"915":{"id":"915","resource_type":"3","parent_id":"122","name":"Signage board"},"916":{"id":"916","resource_type":"3","parent_id":"129","name":"Carpet"},"917":{"id":"917","resource_type":"3","parent_id":"36","name":"Metal ledgers"},"918":{"id":"918","resource_type":"3","parent_id":"36","name":"Glass door"},"919":{"id":"919","resource_type":"3","parent_id":"48","name":"Cleaning cloth"},"920":{"id":"920","resource_type":"3","parent_id":"22","name":"Metal bench top"},"921":{"id":"921","resource_type":"3","parent_id":"52","name":"Printer"},"922":{"id":"922","resource_type":"3","parent_id":"83","name":"Consumables"},"923":{"id":"923","resource_type":"3","parent_id":"36","name":"Hand rail"},"924":{"id":"924","resource_type":"3","parent_id":"83","name":"Door"},"925":{"id":"925","resource_type":"3","parent_id":"52","name":"Log book"},"926":{"id":"926","resource_type":"3","parent_id":"181","name":"Shelves"},"927":{"id":"927","resource_type":"3","parent_id":"137","name":"Floor"},"928":{"id":"928","resource_type":"3","parent_id":"135","name":"Floor"},"929":{"id":"929","resource_type":"3","parent_id":"22","name":"Splashback"},"930":{"id":"930","resource_type":"3","parent_id":"22","name":"Control box"},"931":{"id":"931","resource_type":"3","parent_id":"46","name":"Metal ledge"},"932":{"id":"932","resource_type":"3","parent_id":"65","name":"Light switch"},"933":{"id":"933","resource_type":"3","parent_id":"122","name":"Top of wall"},"934":{"id":"934","resource_type":"3","parent_id":"27","name":"Soap dispenser"},"935":{"id":"935","resource_type":"3","parent_id":"36","name":"Stair banister"},"936":{"id":"936","resource_type":"3","parent_id":"52","name":"Ceiling vents"},"937":{"id":"937","resource_type":"3","parent_id":"62","name":"Printer"},"938":{"id":"938","resource_type":"3","parent_id":"23","name":"Floor"},"939":{"id":"939","resource_type":"3","parent_id":"182","name":"Table"},"940":{"id":"940","resource_type":"3","parent_id":"85","name":"Carpet"},"941":{"id":"941","resource_type":"3","parent_id":"147","name":"Bench top"},"942":{"id":"942","resource_type":"3","parent_id":"20","name":"Black cupboards"},"943":{"id":"943","resource_type":"3","parent_id":"22","name":"Stainless steel bench"},"944":{"id":"944","resource_type":"3","parent_id":"48","name":"Round table"},"945":{"id":"945","resource_type":"3","parent_id":"34","name":"Cleaner\'s stuff"},"946":{"id":"946","resource_type":"3","parent_id":"27","name":"Mirror"},"947":{"id":"947","resource_type":"3","parent_id":"129","name":"Skirting boards"},"948":{"id":"948","resource_type":"3","parent_id":"20","name":"Glass door"},"949":{"id":"949","resource_type":"3","parent_id":"29","name":"Floor"},"950":{"id":"950","resource_type":"3","parent_id":"52","name":"Wooden feature wall"},"951":{"id":"951","resource_type":"3","parent_id":"183","name":"Floor"},"952":{"id":"952","resource_type":"3","parent_id":"36","name":"Wall vents"},"953":{"id":"953","resource_type":"3","parent_id":"52","name":"Under machines"},"954":{"id":"954","resource_type":"3","parent_id":"47","name":"Cleaning equipment"},"955":{"id":"955","resource_type":"3","parent_id":"47","name":"Soap"},"956":{"id":"956","resource_type":"3","parent_id":"134","name":"Glass partition ledgers"},"957":{"id":"957","resource_type":"3","parent_id":"20","name":"Window sills"},"958":{"id":"958","resource_type":"3","parent_id":"93","name":"Window sills"},"959":{"id":"959","resource_type":"3","parent_id":"67","name":"White bench"},"960":{"id":"960","resource_type":"3","parent_id":"184","name":"Carpet"},"961":{"id":"961","resource_type":"3","parent_id":"119","name":"Door vents"},"962":{"id":"962","resource_type":"3","parent_id":"32","name":"Walls"},"963":{"id":"963","resource_type":"3","parent_id":"37","name":"Door frame"},"964":{"id":"964","resource_type":"3","parent_id":"20","name":"Fire place"},"965":{"id":"965","resource_type":"3","parent_id":"65","name":"Horizontal surfaces"},"966":{"id":"966","resource_type":"3","parent_id":"152","name":"Floor"},"967":{"id":"967","resource_type":"3","parent_id":"122","name":"Log book"},"968":{"id":"968","resource_type":"3","parent_id":"122","name":"Wooden floor"},"969":{"id":"969","resource_type":"3","parent_id":"20","name":"Power points"},"970":{"id":"970","resource_type":"3","parent_id":"20","name":"Round table"},"971":{"id":"971","resource_type":"3","parent_id":"185","name":"Side skirt"},"972":{"id":"972","resource_type":"3","parent_id":"57","name":"Paper towel dispenser"},"973":{"id":"973","resource_type":"3","parent_id":"119","name":"Paper towel dispenser"},"974":{"id":"974","resource_type":"3","parent_id":"22","name":"Shelf"},"975":{"id":"975","resource_type":"3","parent_id":"49","name":"Whiite cupboards"},"976":{"id":"976","resource_type":"3","parent_id":"83","name":"White door"},"977":{"id":"977","resource_type":"3","parent_id":"62","name":"Fire extinguisher"},"978":{"id":"978","resource_type":"3","parent_id":"51","name":"Floor"},"979":{"id":"979","resource_type":"3","parent_id":"144","name":"All areas"},"980":{"id":"980","resource_type":"3","parent_id":"52","name":"Meeting table"},"981":{"id":"981","resource_type":"3","parent_id":"129","name":"Ledgers"},"982":{"id":"982","resource_type":"3","parent_id":"186","name":"Round table"},"983":{"id":"983","resource_type":"3","parent_id":"25","name":"Cubicle walls"},"984":{"id":"984","resource_type":"3","parent_id":"62","name":"Black couch"},"985":{"id":"985","resource_type":"3","parent_id":"25","name":"Shelf"},"986":{"id":"986","resource_type":"3","parent_id":"91","name":"Walls"},"987":{"id":"987","resource_type":"3","parent_id":"93","name":"Debris"},"988":{"id":"988","resource_type":"3","parent_id":"162","name":"Cloths"},"989":{"id":"989","resource_type":"3","parent_id":"162","name":"Terminal"},"990":{"id":"990","resource_type":"3","parent_id":"44","name":"New glassware "},"991":{"id":"991","resource_type":"3","parent_id":"23","name":"Glass table"},"992":{"id":"992","resource_type":"3","parent_id":"187","name":"Window sills"},"993":{"id":"993","resource_type":"3","parent_id":"130","name":"Glass partitions"},"994":{"id":"994","resource_type":"3","parent_id":"47","name":"Basin drain"},"995":{"id":"995","resource_type":"3","parent_id":"26","name":"Basin rim"},"996":{"id":"996","resource_type":"3","parent_id":"26","name":"Cubicle floor"},"997":{"id":"997","resource_type":"3","parent_id":"122","name":"Bird droppings"},"998":{"id":"998","resource_type":"3","parent_id":"188","name":"Floor"},"999":{"id":"999","resource_type":"3","parent_id":"74","name":"Buzzer"},"1000":{"id":"1000","resource_type":"3","parent_id":"189","name":"Floor"},"1001":{"id":"1001","resource_type":"3","parent_id":"166","name":"Waste bin"},"1002":{"id":"1002","resource_type":"3","parent_id":"166","name":"Carpet"},"1003":{"id":"1003","resource_type":"3","parent_id":"62","name":"Glass door"},"1004":{"id":"1004","resource_type":"3","parent_id":"44","name":"Carpet"},"1005":{"id":"1005","resource_type":"3","parent_id":"190","name":"Marble table"},"1006":{"id":"1006","resource_type":"3","parent_id":"191","name":"Desks"},"1007":{"id":"1007","resource_type":"3","parent_id":"122","name":"Round table"},"1008":{"id":"1008","resource_type":"3","parent_id":"50","name":"Walls"},"1009":{"id":"1009","resource_type":"3","parent_id":"192","name":"Desk"},"1010":{"id":"1010","resource_type":"3","parent_id":"22","name":"New cutlery drawers"},"1011":{"id":"1011","resource_type":"3","parent_id":"87","name":"Carpet"},"1012":{"id":"1012","resource_type":"3","parent_id":"87","name":"Glass table"},"1013":{"id":"1013","resource_type":"3","parent_id":"193","name":"Floor"},"1014":{"id":"1014","resource_type":"3","parent_id":"106","name":"Carpet"},"1015":{"id":"1015","resource_type":"3","parent_id":"194","name":"Under stair"},"1016":{"id":"1016","resource_type":"3","parent_id":"195","name":"Door vents"},"1017":{"id":"1017","resource_type":"3","parent_id":"49","name":"Printer"},"1018":{"id":"1018","resource_type":"3","parent_id":"52","name":"Empty desks"},"1019":{"id":"1019","resource_type":"3","parent_id":"196","name":"Wall"},"1020":{"id":"1020","resource_type":"3","parent_id":"198","name":"Wooden floor"},"1021":{"id":"1021","resource_type":"3","parent_id":"122","name":"Black carpet"},"1022":{"id":"1022","resource_type":"3","parent_id":"73","name":"Window sills"},"1023":{"id":"1023","resource_type":"3","parent_id":"199","name":"Black rubber mat"},"1024":{"id":"1024","resource_type":"3","parent_id":"52","name":"Round table"},"1025":{"id":"1025","resource_type":"3","parent_id":"84","name":"Waste bin"},"1026":{"id":"1026","resource_type":"3","parent_id":"25","name":"Shower room floor"},"1027":{"id":"1027","resource_type":"3","parent_id":"132","name":"Hand towel dispenser"},"1028":{"id":"1028","resource_type":"3","parent_id":"177","name":"Floor"},"1029":{"id":"1029","resource_type":"3","parent_id":"29","name":"Lift doors"},"1030":{"id":"1030","resource_type":"3","parent_id":"32","name":"Entrance corridor"},"1031":{"id":"1031","resource_type":"3","parent_id":"200","name":"Floor"},"1032":{"id":"1032","resource_type":"3","parent_id":"46","name":"Overhead Rails"},"1033":{"id":"1033","resource_type":"3","parent_id":"151","name":"Bench tops"},"1034":{"id":"1034","resource_type":"3","parent_id":"150","name":"Bench tops"},"1035":{"id":"1035","resource_type":"3","parent_id":"201","name":"Window ledgers"},"1036":{"id":"1036","resource_type":"3","parent_id":"201","name":"Bench top"},"1037":{"id":"1037","resource_type":"3","parent_id":"25","name":"Air freshener unit"},"1038":{"id":"1038","resource_type":"3","parent_id":"50","name":"Window ledgers"},"1039":{"id":"1039","resource_type":"3","parent_id":"52","name":"Grey bookshelves"},"1040":{"id":"1040","resource_type":"3","parent_id":"202","name":"Floor"},"1041":{"id":"1041","resource_type":"3","parent_id":"202","name":"Staircase"},"1042":{"id":"1042","resource_type":"3","parent_id":"195","name":"Bins"},"1043":{"id":"1043","resource_type":"3","parent_id":"129","name":"Wall"},"1044":{"id":"1044","resource_type":"3","parent_id":"26","name":"Toilet roll dispenser"},"1045":{"id":"1045","resource_type":"3","parent_id":"97","name":"Garden beds"},"1046":{"id":"1046","resource_type":"3","parent_id":"74","name":"Glass door ledgers"},"1047":{"id":"1047","resource_type":"3","parent_id":"74","name":"Glass panels"},"1048":{"id":"1048","resource_type":"3","parent_id":"50","name":"Garden beds"},"1049":{"id":"1049","resource_type":"3","parent_id":"50","name":"Floor"},"1050":{"id":"1050","resource_type":"3","parent_id":"203","name":"Door frame"},"1051":{"id":"1051","resource_type":"3","parent_id":"203","name":"Floor"},"1052":{"id":"1052","resource_type":"3","parent_id":"62","name":"Window ledges"},"1053":{"id":"1053","resource_type":"3","parent_id":"20","name":"Window ledgers"},"1054":{"id":"1054","resource_type":"3","parent_id":"101","name":"Corridor"},"1055":{"id":"1055","resource_type":"3","parent_id":"101","name":"Ceiling vent"},"1056":{"id":"1056","resource_type":"3","parent_id":"101","name":"Floor"},"1057":{"id":"1057","resource_type":"3","parent_id":"204","name":"Hand rail"},"1058":{"id":"1058","resource_type":"3","parent_id":"85","name":"Printer"},"1059":{"id":"1059","resource_type":"3","parent_id":"85","name":"Bench top"},"1060":{"id":"1060","resource_type":"3","parent_id":"85","name":"Machines"},"1061":{"id":"1061","resource_type":"3","parent_id":"50","name":"Window ledge"},"1062":{"id":"1062","resource_type":"3","parent_id":"50","name":"Hand rail"},"1064":{"id":"1064","resource_type":"3","parent_id":"84","name":"Corridor"},"1067":{"id":"1067","resource_type":"3","parent_id":"48","name":"Glasses"},"1068":{"id":"1068","resource_type":"3","parent_id":"27","name":"Ceiling vent"},"1069":{"id":"1069","resource_type":"3","parent_id":"47","name":"Ceiling vent"},"1071":{"id":"1071","resource_type":"3","parent_id":"50","name":"Skirting board"},"1072":{"id":"1072","resource_type":"3","parent_id":"133","name":"Window ledgers"},"1073":{"id":"1073","resource_type":"3","parent_id":"27","name":"Walls"},"1074":{"id":"1074","resource_type":"3","parent_id":"22","name":"Red tables"},"1075":{"id":"1075","resource_type":"3","parent_id":"91","name":"Chairs"},"1076":{"id":"1076","resource_type":"3","parent_id":"82","name":"Walls"},"1077":{"id":"1077","resource_type":"3","parent_id":"107","name":"Staircase"},"1078":{"id":"1078","resource_type":"3","parent_id":"158","name":"Fridge"},"1079":{"id":"1079","resource_type":"3","parent_id":"205","name":"Tables"},"1080":{"id":"1080","resource_type":"3","parent_id":"87","name":"Long tables"},"1081":{"id":"1081","resource_type":"3","parent_id":"166","name":"Monitor"},"1082":{"id":"1082","resource_type":"3","parent_id":"158","name":"Floor"},"1083":{"id":"1083","resource_type":"3","parent_id":"125","name":"Walls"},"1084":{"id":"1084","resource_type":"3","parent_id":"189","name":"Carpet"},"1085":{"id":"1085","resource_type":"3","parent_id":"34","name":"Trough"},"1086":{"id":"1086","resource_type":"3","parent_id":"34","name":"Toilet bowl"},"1087":{"id":"1087","resource_type":"3","parent_id":"34","name":"Sanitary bin"},"1088":{"id":"1088","resource_type":"3","parent_id":"34","name":"Pipes"},"1089":{"id":"1089","resource_type":"3","parent_id":"122","name":"Letterbox"},"1090":{"id":"1090","resource_type":"3","parent_id":"97","name":"Floor"},"1091":{"id":"1091","resource_type":"3","parent_id":"129","name":"Side skirting"},"1092":{"id":"1092","resource_type":"3","parent_id":"30","name":"Floor"},"1093":{"id":"1093","resource_type":"3","parent_id":"78","name":"Sink"},"1094":{"id":"1094","resource_type":"4","parent_id":"","name":"Interior"},"1095":{"id":"1095","resource_type":"4","parent_id":"","name":"Exterior"},"1096":{"id":"1096","resource_type":"4","parent_id":"","name":"Inferior"},"1097":{"id":"1097","resource_type":"4","parent_id":"","name":"Grease inside"},"1098":{"id":"1098","resource_type":"4","parent_id":"","name":"Finger marks"},"1099":{"id":"1099","resource_type":"4","parent_id":"","name":"White powdery marks"},"1100":{"id":"1100","resource_type":"4","parent_id":"","name":"Debris"},"1101":{"id":"1101","resource_type":"4","parent_id":"","name":"Cistern"},"1102":{"id":"1102","resource_type":"4","parent_id":"","name":"Overdue"},"1103":{"id":"1103","resource_type":"4","parent_id":"","name":"Dirty"},"1104":{"id":"1104","resource_type":"4","parent_id":"","name":"Dust"},"1105":{"id":"1105","resource_type":"4","parent_id":"","name":"Drains and overflow"},"1106":{"id":"1106","resource_type":"4","parent_id":"","name":"Boxes"},"1107":{"id":"1107","resource_type":"4","parent_id":"","name":"Electrical cord"},"1108":{"id":"1108","resource_type":"4","parent_id":"","name":"Mop marks"},"1109":{"id":"1109","resource_type":"4","parent_id":"","name":"Insects"},"1110":{"id":"1110","resource_type":"4","parent_id":"","name":"Sand bags"},"1111":{"id":"1111","resource_type":"4","parent_id":"","name":"Pressure clean"},"1112":{"id":"1112","resource_type":"4","parent_id":"","name":"Blowing"},"1113":{"id":"1113","resource_type":"4","parent_id":"","name":"Pour water"},"1114":{"id":"1114","resource_type":"4","parent_id":"","name":"Bottom exterior"},"1115":{"id":"1115","resource_type":"4","parent_id":"","name":"Missing tray"},"1116":{"id":"1116","resource_type":"4","parent_id":"","name":"Missing bin"},"1117":{"id":"1117","resource_type":"4","parent_id":"","name":"Top key hole"},"1118":{"id":"1118","resource_type":"4","parent_id":"","name":"Spider Webs"},"1119":{"id":"1119","resource_type":"4","parent_id":"","name":"Not neatly arranged"},"1120":{"id":"1120","resource_type":"4","parent_id":"","name":"Can left on bench"},"1121":{"id":"1121","resource_type":"4","parent_id":"","name":"Corner & edges"},"1122":{"id":"1122","resource_type":"4","parent_id":"","name":"Taps"},"1123":{"id":"1123","resource_type":"4","parent_id":"","name":"Floor"},"1124":{"id":"1124","resource_type":"4","parent_id":"","name":"Replenish"},"1125":{"id":"1125","resource_type":"4","parent_id":"","name":"Chained"},"1126":{"id":"1126","resource_type":"4","parent_id":"","name":"Key"},"1127":{"id":"1127","resource_type":"4","parent_id":"","name":"Incorrect waste stream"},"1128":{"id":"1128","resource_type":"4","parent_id":"","name":"Eco bins"},"1129":{"id":"1129","resource_type":"4","parent_id":"","name":"Cobwebs"},"1130":{"id":"1130","resource_type":"4","parent_id":"","name":"Not answering"},"1131":{"id":"1131","resource_type":"4","parent_id":"","name":"Vacated"},"1132":{"id":"1132","resource_type":"4","parent_id":"","name":"Coffee rings"},"1133":{"id":"1133","resource_type":"4","parent_id":"","name":"InterIor top"},"1134":{"id":"1134","resource_type":"4","parent_id":"","name":"Sticky substance"},"1135":{"id":"1135","resource_type":"4","parent_id":"","name":"Stain"},"1136":{"id":"1136","resource_type":"4","parent_id":"","name":"Tops"},"1137":{"id":"1137","resource_type":"4","parent_id":"","name":"Not our regular product"},"1138":{"id":"1138","resource_type":"4","parent_id":"","name":"Metal vents"},"1139":{"id":"1139","resource_type":"4","parent_id":"","name":"Stock"},"1140":{"id":"1140","resource_type":"4","parent_id":"","name":"Chemical"},"1141":{"id":"1141","resource_type":"4","parent_id":"","name":"Lids"},"1142":{"id":"1142","resource_type":"4","parent_id":"","name":"Sills"},"1143":{"id":"1143","resource_type":"4","parent_id":"","name":"Liners"},"1144":{"id":"1144","resource_type":"4","parent_id":"","name":"Grooves"},"1145":{"id":"1145","resource_type":"4","parent_id":"","name":"Drip marks"},"1146":{"id":"1146","resource_type":"4","parent_id":"","name":"Fresh"},"1147":{"id":"1147","resource_type":"4","parent_id":"","name":"Full"},"1148":{"id":"1148","resource_type":"4","parent_id":"","name":"Damaged"},"1149":{"id":"1149","resource_type":"4","parent_id":"","name":"Unabke to park"},"1150":{"id":"1150","resource_type":"4","parent_id":"","name":"Crumbs"},"1151":{"id":"1151","resource_type":"4","parent_id":"","name":"Vacuum"},"1152":{"id":"1152","resource_type":"4","parent_id":"","name":"Spot clean"},"1153":{"id":"1153","resource_type":"4","parent_id":"","name":"Full clean"},"1154":{"id":"1154","resource_type":"4","parent_id":"","name":"Missed"},"1155":{"id":"1155","resource_type":"4","parent_id":"","name":"Urine"},"1156":{"id":"1156","resource_type":"4","parent_id":"","name":"Remove"},"1157":{"id":"1157","resource_type":"4","parent_id":"","name":"Use"},"1158":{"id":"1158","resource_type":"4","parent_id":"","name":"Carpet"},"1159":{"id":"1159","resource_type":"4","parent_id":"","name":"Lifting"},"1160":{"id":"1160","resource_type":"4","parent_id":"","name":"Faulty"},"1161":{"id":"1161","resource_type":"4","parent_id":"","name":"Grill"},"1162":{"id":"1162","resource_type":"4","parent_id":"","name":"Cleaning sequence"},"1163":{"id":"1163","resource_type":"4","parent_id":"","name":"Top of machine"},"1164":{"id":"1164","resource_type":"4","parent_id":"","name":"Missing bin liner"},"1165":{"id":"1165","resource_type":"4","parent_id":"","name":"Bits & pieces"},"1166":{"id":"1166","resource_type":"4","parent_id":"","name":"Watch out"},"1167":{"id":"1167","resource_type":"4","parent_id":"","name":"Unlocked"},"1168":{"id":"1168","resource_type":"4","parent_id":"","name":"Disarray"},"1169":{"id":"1169","resource_type":"4","parent_id":"","name":"Out of place"},"1170":{"id":"1170","resource_type":"4","parent_id":"","name":"Mop not left to dry"},"1171":{"id":"1171","resource_type":"4","parent_id":"","name":"Power point"},"1172":{"id":"1172","resource_type":"4","parent_id":"","name":"Spray bottle"},"1173":{"id":"1173","resource_type":"4","parent_id":"","name":"Stainless steel"},"1174":{"id":"1174","resource_type":"4","parent_id":"","name":"Spot marks"},"1175":{"id":"1175","resource_type":"4","parent_id":"","name":"Scuff marks"},"1176":{"id":"1176","resource_type":"4","parent_id":"","name":"Could be better"},"1177":{"id":"1177","resource_type":"4","parent_id":"","name":"Left at reception"},"1178":{"id":"1178","resource_type":"4","parent_id":"","name":"Soiled bin liner"},"1179":{"id":"1179","resource_type":"4","parent_id":"","name":"No answer from cleaner"},"1180":{"id":"1180","resource_type":"4","parent_id":"","name":"Dirty metal frame"},"1181":{"id":"1181","resource_type":"4","parent_id":"","name":"Sticky"},"1182":{"id":"1182","resource_type":"4","parent_id":"","name":"Incorrect liner"},"1183":{"id":"1183","resource_type":"4","parent_id":"","name":"Not empty"},"1184":{"id":"1184","resource_type":"4","parent_id":"","name":"Wrong bin placement"},"1185":{"id":"1185","resource_type":"4","parent_id":"","name":"Tidy"},"1186":{"id":"1186","resource_type":"4","parent_id":"","name":"Not collected"},"1187":{"id":"1187","resource_type":"4","parent_id":"","name":"Excess"},"1188":{"id":"1188","resource_type":"4","parent_id":"","name":"Tablets"},"1189":{"id":"1189","resource_type":"4","parent_id":"","name":"Refill"},"1190":{"id":"1190","resource_type":"4","parent_id":"","name":"Empty"},"1191":{"id":"1191","resource_type":"4","parent_id":"","name":"Trolley allocation"},"1192":{"id":"1192","resource_type":"4","parent_id":"","name":"Removal"},"1193":{"id":"1193","resource_type":"4","parent_id":"","name":"Not to be cleaned"},"1194":{"id":"1194","resource_type":"4","parent_id":"","name":"Scrub"},"1195":{"id":"1195","resource_type":"4","parent_id":"","name":"Polish"},"1196":{"id":"1196","resource_type":"4","parent_id":"","name":"Crumbs"},"1197":{"id":"1197","resource_type":"4","parent_id":"","name":"Streaks"},"1198":{"id":"1198","resource_type":"4","parent_id":"","name":"Swipe markd"},"1199":{"id":"1199","resource_type":"4","parent_id":"","name":"Wipe marks"},"1200":{"id":"1200","resource_type":"4","parent_id":"","name":"Grime"},"1201":{"id":"1201","resource_type":"4","parent_id":"","name":"Plastic Liners"},"1202":{"id":"1202","resource_type":"4","parent_id":"","name":"Bird droppings"},"1203":{"id":"1203","resource_type":"4","parent_id":"","name":"Coffee drops"},"1204":{"id":"1204","resource_type":"4","parent_id":"","name":"Move"},"1205":{"id":"1205","resource_type":"4","parent_id":"","name":"Marked"},"1206":{"id":"1206","resource_type":"4","parent_id":"","name":"Smelly"},"1207":{"id":"1207","resource_type":"4","parent_id":"","name":"Glass marks"},"1208":{"id":"1208","resource_type":"4","parent_id":"","name":"Not being emptied"},"1209":{"id":"1209","resource_type":"4","parent_id":"","name":"Going off"},"1210":{"id":"1210","resource_type":"4","parent_id":"","name":"Graffiti"},"1211":{"id":"1211","resource_type":"4","parent_id":"","name":"Blood marks"},"1212":{"id":"1212","resource_type":"4","parent_id":"","name":"Marks"},"1213":{"id":"1213","resource_type":"4","parent_id":"","name":"Too much chemical"},"1214":{"id":"1214","resource_type":"4","parent_id":"","name":"Leaves"},"1215":{"id":"1215","resource_type":"4","parent_id":"","name":"Water stain"},"1216":{"id":"1216","resource_type":"4","parent_id":"","name":"Vacuum cleaner marks"},"1217":{"id":"1217","resource_type":"4","parent_id":"","name":"Spillage"},"1218":{"id":"1218","resource_type":"4","parent_id":"","name":"Dirt"},"1219":{"id":"1219","resource_type":"4","parent_id":"","name":"All"},"1220":{"id":"1220","resource_type":"4","parent_id":"","name":"Missing"},"1221":{"id":"1221","resource_type":"4","parent_id":"","name":"Items out of place"},"1222":{"id":"1222","resource_type":"4","parent_id":"","name":"Stained"},"1223":{"id":"1223","resource_type":"4","parent_id":"","name":"Missplaced"},"1224":{"id":"1224","resource_type":"4","parent_id":"","name":"Waste removal needed"},"1225":{"id":"1225","resource_type":"4","parent_id":"","name":"Cigarette butts"},"1226":{"id":"1226","resource_type":"4","parent_id":"","name":"Vacuum scratch"},"1227":{"id":"1227","resource_type":"4","parent_id":"","name":"Messy"},"1228":{"id":"1228","resource_type":"4","parent_id":"","name":"Bin liners"},"1229":{"id":"1229","resource_type":"4","parent_id":"","name":"Overload"},"1230":{"id":"1230","resource_type":"4","parent_id":"","name":"Waste dumped in floor"},"1231":{"id":"1231","resource_type":"4","parent_id":"","name":"Not removed"},"1232":{"id":"1232","resource_type":"4","parent_id":"","name":"Wrong alignment"},"1233":{"id":"1233","resource_type":"4","parent_id":"","name":"Incorrect alignment"},"1234":{"id":"1234","resource_type":"4","parent_id":"","name":"Mail Boxes"},"1235":{"id":"1235","resource_type":"4","parent_id":"","name":"Smudged"},"1236":{"id":"1236","resource_type":"4","parent_id":"","name":"Install"},"1237":{"id":"1237","resource_type":"4","parent_id":"","name":"Installed"},"1238":{"id":"1238","resource_type":"4","parent_id":"","name":"Dirty spots"},"1239":{"id":"1239","resource_type":"4","parent_id":"","name":"Coffee stains"},"1240":{"id":"1240","resource_type":"4","parent_id":"","name":"Not in sequence"},"1241":{"id":"1241","resource_type":"4","parent_id":"","name":"Not working"},"1242":{"id":"1242","resource_type":"4","parent_id":"","name":"Loose"},"1243":{"id":"1243","resource_type":"4","parent_id":"","name":"Open lids"},"1244":{"id":"1244","resource_type":"4","parent_id":"","name":"Not vacuumed"},"1245":{"id":"1245","resource_type":"4","parent_id":"","name":"Not placed inside bins"},"1246":{"id":"1246","resource_type":"4","parent_id":"","name":"Cloth marks"},"1247":{"id":"1247","resource_type":"4","parent_id":"","name":"Not being removed"},"1248":{"id":"1248","resource_type":"4","parent_id":"","name":"Broken hanger"},"1249":{"id":"1249","resource_type":"4","parent_id":"","name":"Without bin liner"},"1250":{"id":"1250","resource_type":"4","parent_id":"","name":"Fluff"},"1251":{"id":"1251","resource_type":"4","parent_id":"","name":"Fallen"},"1252":{"id":"1252","resource_type":"4","parent_id":"","name":"Labelled"},"1253":{"id":"1253","resource_type":"4","parent_id":"","name":"Left at cleaner\'s room"},"1254":{"id":"1254","resource_type":"4","parent_id":"","name":"Wrong position"},"1255":{"id":"1255","resource_type":"4","parent_id":"","name":"Plug correctly"},"1256":{"id":"1256","resource_type":"4","parent_id":"","name":"New mechanism"},"1257":{"id":"1257","resource_type":"4","parent_id":"","name":"Mop inside bucket"},"1258":{"id":"1258","resource_type":"4","parent_id":"","name":"Exist"},"1259":{"id":"1259","resource_type":"4","parent_id":"","name":"Dirty trap"},"1260":{"id":"1260","resource_type":"4","parent_id":"","name":"Unpolished"},"1261":{"id":"1261","resource_type":"4","parent_id":"","name":"Remove stickers"},"1262":{"id":"1262","resource_type":"4","parent_id":"","name":"Keep clean"},"1263":{"id":"1263","resource_type":"4","parent_id":"","name":"Program clean"},"1264":{"id":"1264","resource_type":"4","parent_id":"","name":"Bunding"},"1265":{"id":"1265","resource_type":"4","parent_id":"","name":"Close"},"1266":{"id":"1266","resource_type":"4","parent_id":"","name":"Not missing"},"1267":{"id":"1267","resource_type":"4","parent_id":"","name":"Replace oring"},"1268":{"id":"1268","resource_type":"4","parent_id":"","name":"New oring"},"1269":{"id":"1269","resource_type":"4","parent_id":"","name":"Replace if soiled"},"1270":{"id":"1270","resource_type":"4","parent_id":"","name":"Tripping"},"1271":{"id":"1271","resource_type":"4","parent_id":"","name":"Not filled"},"1272":{"id":"1272","resource_type":"4","parent_id":"","name":"Equipment"},"1273":{"id":"1273","resource_type":"4","parent_id":"","name":"Left on top of chair"},"1274":{"id":"1274","resource_type":"4","parent_id":"","name":"Dusty"},"1275":{"id":"1275","resource_type":"4","parent_id":"","name":"No paper bag"},"1276":{"id":"1276","resource_type":"4","parent_id":"","name":"Food"},"1277":{"id":"1277","resource_type":"4","parent_id":"","name":"Chewing gum"},"1278":{"id":"1278","resource_type":"4","parent_id":"","name":"Change cartridge"},"1279":{"id":"1279","resource_type":"4","parent_id":"","name":"Vacuum edges"},"1280":{"id":"1280","resource_type":"4","parent_id":"","name":"Milk marks"},"1281":{"id":"1281","resource_type":"4","parent_id":"","name":"Untidy"},"1282":{"id":"1282","resource_type":"4","parent_id":"","name":"Client managing"},"1283":{"id":"1283","resource_type":"4","parent_id":"","name":"Black bin liner"},"1284":{"id":"1284","resource_type":"4","parent_id":"","name":"Left behind"},"1285":{"id":"1285","resource_type":"4","parent_id":"","name":"Rotting"},"1286":{"id":"1286","resource_type":"4","parent_id":"","name":"Not brushed"},"1287":{"id":"1287","resource_type":"4","parent_id":"","name":"Scaling"},"1288":{"id":"1288","resource_type":"4","parent_id":"","name":"Mould"},"1289":{"id":"1289","resource_type":"4","parent_id":"","name":"Out of date items"},"1290":{"id":"1290","resource_type":"4","parent_id":"","name":"Not checked"},"1291":{"id":"1291","resource_type":"4","parent_id":"","name":"Place in L4"},"1292":{"id":"1292","resource_type":"4","parent_id":"","name":"Projector"},"1293":{"id":"1293","resource_type":"4","parent_id":"","name":"Rubbish"},"1294":{"id":"1294","resource_type":"4","parent_id":"","name":"Touching"},"1295":{"id":"1295","resource_type":"4","parent_id":"","name":"Almost finished"},"1296":{"id":"1296","resource_type":"4","parent_id":"","name":"Fill"},"1297":{"id":"1297","resource_type":"4","parent_id":"","name":"Foot prints"},"1298":{"id":"1298","resource_type":"4","parent_id":"","name":"Spill marks"},"1299":{"id":"1299","resource_type":"4","parent_id":"","name":"Dirty seat hinges"},"1300":{"id":"1300","resource_type":"4","parent_id":"","name":"Contamination"},"1301":{"id":"1301","resource_type":"4","parent_id":"","name":"Out of order"},"1302":{"id":"1302","resource_type":"4","parent_id":"","name":"Smear marks"},"1303":{"id":"1303","resource_type":"4","parent_id":"","name":"Dead insects"},"1304":{"id":"1304","resource_type":"4","parent_id":"","name":"Leaves"},"1305":{"id":"1305","resource_type":"4","parent_id":"","name":"Stained"},"1306":{"id":"1306","resource_type":"4","parent_id":"","name":"Smelly"},"1307":{"id":"1307","resource_type":"4","parent_id":"","name":"Left behind"},"1308":{"id":"1308","resource_type":"4","parent_id":"","name":"Taps not closed"},"1309":{"id":"1309","resource_type":"4","parent_id":"","name":"Left on floor"},"1310":{"id":"1310","resource_type":"4","parent_id":"","name":"Relocate"}}');
        return items;
    }

    /**********************************************
     * USERS
     */
    this.createSignificant_items = function(table_number)
    {
        var table_name = this.tables[table_number][0];
        var table_version = this.tables[table_number][1];

        if(this.DB_DEBUG)
            alert("CREATE " + table_name);

        var sql = "CREATE TABLE IF NOT EXISTS significant_items (" +
            "'id' VARCHAR NOT NULL, " +
            "'type' VARCHAR NOT NULL, " +
            "'foreign_id' VARCHAR NOT NULL, " +
            "'photo_id' VARCHAR NOT NULL, " +
            "'created_by' INTEGER NOT NULL, " +
            "'modified' TIMESTAMP, " +
            "'deleted' INTEGER NOT NULL DEFAULT 0 , " +
            "'dirty' INTEGER NOT NULL DEFAULT 1)";

        this.db.transaction(function(transaction)
        {
            transaction.executeSql(sql, null, function (transaction, result)
            {
                // Deleted index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_deleted ON " + table_name + " (deleted);";
                self.execute(sql, null, null);

                // Dirty index
                sql = "CREATE INDEX IF NOT EXISTS " + table_name + "_dirty ON " + table_name + " (dirty);";
                self.execute(sql, null, null);

                // INSERT THE REGISTRY ENTRY
                sql = "INSERT INTO app_tables (table_name, version) VALUES(?, ?);";
                transaction.executeSql(sql, [table_name, table_version], function (transaction, result)
                {
                    if(this.DB_DEBUG)
                        alert("INSERTED REGISTRY");

                    objDBUtils.checkNextTable(table_number);

                }, objDBUtils.DB_error_handler);

            }, objDBUtils.DB_error_handler);
        });
    }
}