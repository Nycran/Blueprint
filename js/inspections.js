/**********************************************************
OBJECT: INSPECTIONS
***********************************************************/

/***
* @project: Blueprint Inspections iPad App
* @author: Andrew Chapman
*/
var selected_report_type = '';
var TRANS_600x400 = 'iVBORw0KGgoAAAANSUhEUgAAAlgAAAGQAQMAAABI+4zbAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADRJREFUeNrtwQENAAAAwiD7p7bHBwwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgKQDdsAAAWZeCiIAAAAASUVORK5CYII=';
var TRANS_150x100 = 'iVBORw0KGgoAAAANSUhEUgAAAJYAAABkAQMAAABelVuzAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAABZJREFUOMtjGAWjYBSMglEwCkbBkAcAB9AAAQtyzRgAAAAASUVORK5CYII=';

var Inspections = function()                              
{
	// Inspection level pop selectors
	this.objPopBuilders = null;
	this.objPopState = null;
    this.doingSearch = false;
	
	// Defect level pop selectors.
	this.objPopLocation = null;
	this.objPopAction = null;
    this.observation = '';
	this.sortBy = "i.inspection_start";
	this.sortDir = "DESC";
	this.initials = "";
	this.restricted = false;
	this.finalised = 0;
	this.objToggleFailed = null;
	this.lastKeyPress = null;
	this.doingSave = false; 
    this.scroller = null;
    this.last_scroller_x = -1;
    this.last_scroller_y = -1;
    
    this.currentStep = 0;
    this.isEditing = 0;
    this.isAddingSignificantItem = 0;
    this.stepBackFromSignList = 3;
    this.itemSortBy = 'seq_no';
    this.itemSortDir = 'DESC';
    this.defectsArray = [];
    this.defectsObjects = {};
    this.defectsReArray = [];
    this.defectsReObjects = {};
    this.numberOfIssues = 0;
    this.numberOfAcknowledgements = 0;
    this.historyPhotosHtml = '';
    this.glDatePicker = null;
    this.is_change_order = false;
	this.builder_id = "";
	this.inAudit = false;
    this.reinspectionItemRow;
    this.reinspectionNotes;
	this.numImgCurr = 0;
    this.reinspectionKey = null;
    this.inspection = false;
    this.keySortArray = false;
    this.MAX_REPORT_PHOTOS = 12;
    this.isProcessing = false;

	this.current_table = "inspectionitemphotos";
	this.current_key = "inspection_id";
	
	this.current_key = "inspection_id";
    
	this.default_notes =	"All exposed concrete will need cleaning & colour sealing prior to handover.\n"+
							"All appliances will need installing prior to handover.\n"+
							"All landscaping will need finishing prior to handover.\n"+
							"Please ensure all light globes are installed.\n"+
							"All window& door tracks will need cleaning & greasing.\n" +
                            "Ensure all fire rating items are complete, if required.\n" +
                            "Ensure council assets are cleaned prior to handover.";
    
	var self = this;
    var user_email = localStorage.getItem("email");
    var locations = {};
    var email_options = {};
    
	$(".inspectionDetails #btnCapturePhoto").append('<div class="numImgCurr">' + self.numImgCurr + '</div>');
    
	this.setupInspections = function()
	{
        // Clear the main screen area
		objApp.clearMain();
        this.doingSearch = false;
        this.lastKeyPress == null;
        
        // Ensure all keys are cleared
        objApp.clearKeys();
        self.inspection = false;
        self.user_type = localStorage.getItem("user_type");
        
        objDBUtils.orderBy = "name";
        $("#inspectionList .bottomBtns").find("a").removeClass("active");
        var selected_il_builder_id = $("#inspectionList #il_builder_id").val();
        if(!self.doingSave)
        {
            $("#inspectionList #il_builder_id").empty();
            $("#inspectionList #il_builder_id").append('<option value="">Choose</option>');

            var filters = [];
            if (objApp.IS_STATE_FILTERED == 1 && objApp.FILTERED_STATE_CODE)
                filters.push(new Array("state = '"+objApp.FILTERED_STATE_CODE+"'"));

            objDBUtils.loadSelect("builders", filters, "#inspectionList #il_builder_id", function(){
                self.doingSave = false;
                $("#inspectionList #il_builder_id").val(selected_il_builder_id);
                $("#inspectionList #il_builder_id").trigger('change');
            }, "option");
        }

        self.doingSave = true;
		objDBUtils.orderBy = "ABS(name) ASC";
		objApp.callbackMethod = null;	// Reset app callback.
		
		// Set the main heading
        objApp.setHeading("Blueprint Inspections");
		objApp.setSubHeading("Inspection Listing");
        objApp.setSubExtraHeading('', false);
		objApp.setNavActive("#navInspections");
		
		// Show the inspectionListing screen
		$("#inspectionList").removeClass("hidden");

	    // Initialise filters
		objFilters.filterScreen = "inspections";
		
		// Setup the status filter to show the correct options for the client screen
		//removePopOptions("#frmFilters #filterStatus", 1, "", "View All");
		//objFilters.objPopStatus.addOption("0", "Active Clients");
		//objFilters.objPopStatus.addOption("1", "Not Active Clients");
		
		objFilters.clearFilters();  
		objFilters.restoreDefaults();
		
		// Show only the filters we want
	    objFilters.hideAllFilters();
	    objFilters.showHideFilter("#filterName", true);
	    objFilters.showHideFilter("#filterClient", true);
	    objFilters.showHideFilter("#filterSite", true);
        objFilters.showHideFilter("#filterUser", true);
	    objFilters.showHideFilter("#filterFinalised", true);
	    objFilters.showHideFilter("#filterRecordLimit", true);

		
		// Set the filters search method
		objFilters.searchMethod = objApp.objInspection.doInspectionSearch;
		
	    objFilters.show();

		// Do the client search
		self.doInspectionSearch(selected_il_builder_id);

        this.unbindEvents();

        $("#addInspection").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            objApp.cleanup();
            objApp.objInspection.setReturnInspectionID("");
            objApp.objInspection.addNewInspection();
            objApp.context = "inspection";
            objApp.setBodyClass('inspection');
        });

        if ($("#inspectionList #il_builder_id").hasClass('select2-hidden-accessible'))
            $("#inspectionList #il_builder_id").select2('destroy');
        $("#inspectionList #il_builder_id").select2();

        objApp.setBodyClass('inspections');
    }
    
	/***
	* doInspectionSearch searches the inspections database
	* taking into consideration any user entered search terms.  
	*/
	this.doInspectionSearch = function(selected_il_builder_id)
	{  
        objApp.showHideSpinner(true, "#inspectionList");
        this.doingSearch = true;
            
		// Remove the triangle from the table header cells
		$("#tblInspectionListingHeader th .triangle").remove();
        
        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }

        // Remove previously bound events
        $("#inspectionScrollWrapper").unbind();
        $("#tblInspectionListingHeader th").unbind();
        //$("#tblInspectionListing a.reinspect").unbind();            
        $("#tblInspectionListing a.view").unbind();            
        $("#tblInspectionListing a.delete").unbind();

		// Inject the triangle
		$("#tblInspectionListingHeader th[class='" + self.sortBy + "']").append('<span class="triangle ' + self.sortDir + '"></span>');	

        // Remove any existing items in the list.
        $("#inspectionScrollWrapper").html("");      
        
		var sql = "SELECT i.*, b.name, (SELECT COUNT(id) FROM reinspections WHERE inspection_id = i.id AND deleted = 0) AS num_reinspections " +
			"FROM inspections i " +
            "INNER JOIN builders b ON b.id = i.builder_id " +
			"WHERE i.deleted = 0 ";

		var values = new Array();
        
        var searchText = $("#inspectionSearch").val();
        if (typeof selected_il_builder_id == 'undefined')
            selected_il_builder_id = $("#inspectionList #il_builder_id").val();

        var filter_builder_id = selected_il_builder_id;
        var filter_finalised = $("#inspectionList #is_finalised").val();
        var filter_limit = $("#inspectionList #filter_limit").val();
        if((filter_limit != "") && (filter_limit != "all"))
            filter_limit = 50;
          
        if(searchText != "")
        {
            /*
            sql += "AND (" +
                            "(i.report_type LIKE '%" + searchText + "%') " +
                            "OR (i.address LIKE '" + searchText + "%') " +
                            "OR (i.suburb LIKE '%" + searchText + "%') " +
                            "OR (i.lot_no = '" + searchText + "') " +
                            "OR (i.postcode LIKE '%" + searchText + "%') " +
                            "OR (i.inspection_date LIKE '%" + searchText + "%') " +
                            "OR (b.name LIKE '%" + searchText + "%') " +
                            ") ";
            */
            sql += " AND i.lot_no = '" + searchText + "' ";
        }        
		
	    // Apply advanced search filters  
	    if((filter_builder_id != undefined) && (filter_builder_id != ""))
	    {
	    	sql += "AND i.builder_id = ? ";
            values.push(filter_builder_id);
	    }

	    if(filter_finalised != "")
	    {
	    	sql += "AND i.finalised = ? ";
	    	values.push(filter_finalised);
	    }

        if (objApp.IS_STATE_FILTERED == 1 && objApp.FILTERED_STATE_CODE){
            sql += "  AND i.state = '" + objApp.FILTERED_STATE_CODE + "' ";
        }
		
	    sql += "ORDER BY " + self.sortBy + " " + self.sortDir + " ";	// Show the most recent inspections first.
        
	    if((filter_limit != "") && (filter_limit != "all"))
	    {            
	    	sql += "LIMIT ?";
	    	values.push(filter_limit);
	    }
	    objApp.showHideSpinner(true, "#inspectionList");
        
        objDBUtils.primaryKey = "id";
		objDBUtils.showColumn = "name";

	    objDBUtils.loadRecordsSQL(sql, values, function(param, items)
	    {
			objApp.showHideSpinner(false, "#inspectionList");

            if(!items)
            {
				self.doingSearch = false;
                return;	 
            }
		    
			var html = '<table id="tblInspectionListing" class="listing">';
			
			var maxLoop = items.rows.length;
			var r = 0;
			
			for(r = 0; r < maxLoop; r++) {
				
				var num_defects = 0;
			    var row = items.rows.item(r);
			    var inspDate = objApp.isoDateStrToDate(row.inspection_date);
			    html += '<tr rel="' + row.id + '">';
			    html += '<td class="view">'

			    if(row.finalised) {
                    html += '<span class="icon';
					html += ' finalised';
                    html += '"></span>';
			    }

			    html += objApp.formatUserDate(inspDate) + '</td>';  
			    html += '<td>' + row.lot_no + ' ' + row.address + ' ' + row.suburb + '</td>';
			    html += '<td>' + row.name + '</td>';
                var report_type = row.report_type.replace('inspections', 'inspection');
                if (report_type == 'Builder: PCI/Final inspection')
                    report_type = 'QA Inspection';
			    html += '<td>' + report_type + '</td>';
                html += '<td>' + row.num_reinspections + '</td>';
			   
                html += '<td><div class="action">';
                
                // Always have the view action
                if(row.num_reinspections > 0) {
                    html += '<a href="#" data-reveal-id="historyReinspection" class="action view showhistory" data-id="' + row.id + '">History</a>';
                }

                if (self.user_type == 'admin'){
                    html += '<a href="#" class="action delete" data-id="' + row.id + '">Delete</a>';
                }
                
                html += '</div></td>';
			    html += '</tr>';
			}
			
			html += '</table>';
			
			$("#inspectionScrollWrapper").html(html);
            
            self.setTableWidths();


            setTimeout(function()
            {
                if(objUtils.isMobileDevice())
                {
                    self.scroller = new IScroll('#inspectionScrollWrapper', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbar'});
                }
            }, 500);


			// Bind click event to list items
            $("#tblInspectionListing a.delete").bind(objApp.touchEvent, function(e) {

                self.is_change_order = true;
				e.preventDefault();
				var inspection_item_id = $(this).attr("data-id");
				
				var parent = $(this).parents('tr');

				
                var item_name = $(parent).find("td:eq(2)").text();

                if(confirm("Are you sure you wish to delete this inspection for " + item_name))
                {
                    var sql = "UPDATE inspections " +
                              "SET deleted = 1, dirty = 1 " +
                              "WHERE id = ?";
                    objDBUtils.execute(sql, [inspection_item_id], null);
                    self.doInspectionSearch();
                }
            });

            // Bind click/touch event to buttons in the listing.
            $("#tblInspectionListing tr td.view").bind(objApp.touchEvent, function(e)
            {
                e.preventDefault();

                var inspection_id = $(this).parent().attr('rel');
                var num_reinspections = $(this).attr("data-reinspections");

                // The view button may require the user to select from the inspection history window.
                if($(this).hasClass("showhistory")) {
                    self.loadHistoryReinspectionItems(inspection_id);
                    return;
                }

                // Show the loading indicator
                blockElement('body');

                // Load the inspection in question
                objDBUtils.loadRecord("inspections", inspection_id, function(inspection_id, row)
                {
                    unblockElement('body');

                    if(!row) {
                        alert("Sorry, the inspection could not be loaded.  Please report this error.");
                        return;
                    }
                    objApp.objInspection.editInspection(row);

                }, inspection_id);
            });

            // Handle the event when the user clicks on the VIEW button.
            $("#tblInspectionListing a.view").bind(objApp.touchEvent, function(e)  {
                e.preventDefault();
                var inspection_id = $(this).attr('data-id');
                var num_reinspections = $(this).attr("data-reinspections");

                // The view button may require the user to select from the inspection history window.
                if($(this).hasClass("showhistory")) {
                    self.loadHistoryReinspectionItems(inspection_id);
                    return;
                }

                // Show the loading indicator
                blockElement('body');
                
                // Load the inspection in question
                objDBUtils.loadRecord("inspections", inspection_id, function(inspection_id, row)
                {
                    unblockElement('body');
                    
                    if(!row) {
                        alert("Sorry, the inspection could not be loaded.  Please report this error.");
                        return;
                    }
                    objApp.objInspection.editInspection(row);	
                    
                }, inspection_id);
			});
			
			$("#tblInspectionListingHeader th").bind(objApp.touchEvent, function(e) {
				e.preventDefault();
                
                if (!$(this).is('[class]')) {
                    return;    
                }

				var newSortBy = $(this).attr("class");
                if(newSortBy == "") {
                    return;
                }
				
				if(self.sortBy == newSortBy)
				{
					if(self.sortDir == "ASC")
					{
						self.sortDir = "DESC";
					}
					else
					{
						self.sortDir = "ASC";
					}
				}
				else
				{
					self.sortDir = "ASC";	
				}
				
				self.sortBy = newSortBy;
				
				self.doInspectionSearch();
			});
            
            self.doingSearch = false;
            		
	    }, "");
	}

    /**
    * Creates a new reinspection after confirming with the user.
    */
    this.startReinspection = function(inspection_id)
    {
        if(!confirm("You are about to start a reinspection.  Are you sure you wish to continue?")) {
            return;
        }
        $('a.capture-signature-btn').hide();
        blockElement('body');
        self.updateInspectionPassFail(1);
        // Load the original inspection
        objDBUtils.loadRecord("inspections", inspection_id, function(inspection_id, row)
        {
            if(!row) {
                alert("Sorry, the inspection could not be loaded.  Please report this error.");
                unblockElement('body');
                return;
            }

            self.reinspectionNotes = row.notes;
            objApp.keys.inspection_id = inspection_id;
            objApp.keys.report_type = row.report_type;
            self.inspection = row;

            var inspection_property = "Lot " + row.lot_no + ", " + row.address + ", " + row.suburb;


            // Clear all "most recent" flags in the reinspections table
            var sql = "UPDATE reinspections " +
                "SET most_recent = 0, dirty = 1 " +
                "WHERE inspection_id = ? AND deleted = 0";

            objDBUtils.execute(sql, [inspection_id], function() {
                // Create a new reinspections record, setting the most recent flag
                var currentdate = new Date();
                var curdate = currentdate.getFullYear() + "-"
                                + (currentdate.getMonth()+1)  + "-"
                                + currentdate.getDate();

                var reinspection_id = objDBUtils.makeInsertKey(objApp.sync_prefix);
                var values = [reinspection_id, inspection_id, curdate, 1, 1,self.reinspectionNotes,
                row.min_roof_tiles, row.min_ridge_tiles, row.touch_up_paint, row.min_flooring_tiles, row.grout_samples,
                    row.practical_completed, row.barrel_code, row.certificated];
                
                sql = "INSERT INTO reinspections(id, inspection_id, reinspection_date, failed, most_recent,notes, " +
                    "min_roof_tiles, min_ridge_tiles, touch_up_paint, min_flooring_tiles, grout_samples, practical_completed, barrel_code, certificated ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

                objDBUtils.execute(sql, values, function(){
                    
                    objApp.keys.reinspection_id = reinspection_id;

                    // Now that the reinspections record has been created, now create the reinspection items,
                    // using the base inspection items as the foundation.
                    if(self.isReportsWithQuestions())
                        sql = "SELECT * FROM inspectionitems WHERE inspection_id = ? AND notes = 'No' AND deleted = 0";
                    else
                        sql = "SELECT * FROM inspectionitems WHERE inspection_id = ? AND deleted = 0";
                    objDBUtils.loadRecordsSQL(sql, [inspection_id], function(param, items) {
                        if(!items)
                        {
                            alert("Sorry, an error occurred whilst trying to create the reinspection items.  Please report this error");
                            unblockElement('body');
                            return;
                        }

                        var maxLoop = items.rows.length;
                        var r = 0;

                        for(r = 0; r < maxLoop; r++) {

                            var row = items.rows.item(r);

                            sql = "INSERT INTO reinspectionitems(id,reinspection_id, inspectionitem_id, rectified) " +
                                  "VALUES(?,?,?,?)";
                                  
                            var reinspection_item_id = objDBUtils.makeInsertKey(objApp.sync_prefix) + r;

                            var values = [reinspection_item_id, reinspection_id, row.id, row.rectified];

                            var last_item = (r == (maxLoop - 1));

                            objDBUtils.executeWithCBParam(sql, values, function(finished) {

                                // See if the last reinspection item has been copied in.
                                if(finished) {
                                    unblockElement('body');
                                    // Open the reinspection page for this reinspection
                                    self.loadReinspectionItems(reinspection_id);
                                }
                            }, last_item);
                        }
                    },"");
                });
            });
        }, inspection_id);
    }

    /***
    * Sets the listing table column widths (headers and cells)
    * as required.
    */
    this.setTableWidths = function()
    {
        // Setup table column widths
        var orientation = objApp.getOrientation();
        var screenWidth = screen.width;
        
        if(orientation == "landscape") {
            screenWidth = screen.width > screen.height?screen.width:screen.height;
        }
        
        var tableWidth = screenWidth - 50;
        
        $(".scrollWrapper").css("width", tableWidth + 20 + "px");    
        
        var tableHeader = $("#tblInspectionListingHeader");
        var tableBody = $("#tblInspectionListing");
        $(tableHeader).css("table-layout", "fixed");
        $(tableBody).css("table-layout", "fixed");
        $(tableHeader).css("width", tableWidth + "px");
        $(tableBody).css("width", tableWidth + "px");
        
        tableWidth = tableWidth - 45;
        
        var average_width = Math.floor(tableWidth / 6);
        average_width = average_width - 22;  // Take into account 10px padding left and right, 10 + 10 = 20, plus 1px border left and right
        
        var width_col1 = average_width - 50;
        var width_col2 = average_width + 60;
        
        $(tableHeader).find("th:eq(0)").css("width", width_col1);    // Delete icon column
        $(tableHeader).find("th:eq(1)").css("width", width_col2 + "px");
        $(tableHeader).find("th:eq(2)").css("width", average_width + "px");
        $(tableHeader).find("th:eq(3)").css("width", average_width + "px"); 
        $(tableHeader).find("th:eq(4)").css("width", (average_width - 60) + "px");
        $(tableHeader).find("th:eq(5)").css("width", (average_width + 40) + "px");
        
        $(tableBody).find("tr td:eq(0)").css("width", width_col1);
        $(tableBody).find("tr td:eq(1)").css("width", width_col2 + "px");
        $(tableBody).find("tr td:eq(2)").css("width", average_width + "px");
        $(tableBody).find("tr td:eq(3)").css("width", average_width + "px");                  
        $(tableBody).find("tr td:eq(4)").css("width", (average_width - 60) + "px");
        $(tableBody).find("tr td:eq(5)").css("width", (average_width + 40) + "px");
    }    
    
    /* new version section */
    this.getStep = function()
    {
        return self.currentStep;
    }
    
    this.setStep = function(step)
    {
        self.currentStep = step;
    }
    
    this.backFromAddClient = function()
    {
        if(!$("#clientDetails").hasClass("hidden"))
		{
			$("#clientDetails").addClass("hidden");
		}
        // Set the main heading
        objApp.setSubHeading("Create a New Inspection");
        objApp.setSubExtraHeading("Step 1 of 3", true);
        
        $("#inspection").removeClass("hidden");
        if(objApp.keys.client_id != "")
		{
            // Setup client and site popselectors
            self.setupPopselectors();
		}    
    }
    
    this.backFromAddSite = function()
    {
        if(!$("#siteDetails").hasClass("hidden"))
		{
			$("#siteDetails").addClass("hidden");
		}
        // Set the main heading
        heading = '';
        objApp.setSubHeading("Create a New Inspection");
        objApp.setSubExtraHeading("Step 1 of 3", true);
        
        $("#inspection").removeClass("hidden");  
    }
    
    this.isTouchDevice = function(){
        try{
            document.createEvent("TouchEvent");
            return true;
        }catch(e){
            return false;
        }
    }
    
    this.touchScroll = function(el){
        if(self.isTouchDevice()){ //if touch events exist...
            //var el=parentNote.getElementById(id);
            var scrollStartPos=0;
    
            el.addEventListener("touchstart", function(event) {
                scrollStartPos=this.scrollTop+event.touches[0].pageY;
            },false);
    
            el.addEventListener("touchmove", function(event) {
                this.scrollTop=scrollStartPos-event.touches[0].pageY;
            },false);
        }
    }

    this.checkIfNeedPhotos = function()
    {
        $('a.capture-signature-btn').hide();
        if ($("#inspection #report_type2").val() == 'Client inspection' && self.finalised != 1){
            $('a[id="btnReportPhotos"]').removeClass("hidden");
        }else{
            if ($("#inspection #report_type2").val() == 'Peet inspection' && ($('#btnStep1Next').is(':visible') || self.getStep() > 1 )){
                $('a.capture-signature-btn').show();
            }
            $('a[id="btnReportPhotos"]').addClass("hidden");
        }
    }
    
    this.showStep1 = function()
    {
        self.setStep(1);
        objApp.clearMain();
        console.log(objApp.keys.inspection_id);
        // If we do not have an active inspection
        if(objApp.keys.inspection_id == "") {
            // hide the coversheet notes button.
            $("div.btnEditNotes").hide();
            $("a.btnEditClientNotes").hide();
            $("a.btnEditPrivateNotes").hide();
        }
        
        $("#inspection").removeClass("hidden");
        
		// Set the main heading
        if (self.isEditing)
        {
            objApp.setSubHeading("Edit Inspection");
            objApp.setSubExtraHeading("", false);
        }
        else
        {
            objApp.setSubHeading("Create a New Inspection");
            
            $("div.btnEditNotes").show();
            
            //if(($("#inspection #report_type").val() == "Builder: PCI/Final inspections") || (objApp.keys.report_type == "Builder: PCI/Final inspections")) {
            if(( objApp.keys.report_type == "Quality Inspection") || (objApp.keys.report_type == "Builder: PCI/Final inspections")) {
                
                objApp.setSubExtraHeading("Step 1 of 5", true);
            } /*else if (($("#inspection #report_type").val() == "Fix / Plaster Inspection") || (objApp.keys.report_type == "Fix / Plaster Inspection")) {
                objApp.setSubExtraHeading("Step 1 of 4", true);
            }*/ else {
                objApp.setSubExtraHeading("Step 1 of 3", true);
                //$("div.btnEditNotes").hide();
            }
        }
    }
    
    this.showStep2 = function(inspectionItem, addNewQuestionIssue)
    {
        self.setStep(2);
        if(typeof addNewQuestionIssue == 'undefined')
            addNewQuestionIssue = 0;
		// Set the main heading
        self.checkIfNeedPhotos();
        objApp.setSubHeading("Add Issues");
        $("div.btnEditNotes").show();

        if(( objApp.keys.report_type == "Quality Inspection") || (objApp.keys.report_type == "Builder: PCI/Final inspections")) {
            objApp.setSubExtraHeading("Step 2 of 5", true);
        }else {
            if(self.isReportsWithQuestions()){
                if(inspectionItem.question)
                    objApp.setSubHeading("Add Issue: " + inspectionItem.question);
                $('#btnStep2Back').unbind();
                $("#btnStep2Back").bind(objApp.touchEvent, function(e)
                {
                    e.preventDefault();
                    self.showStep3();
                    return false;
                });
                $('#btnStep2Next').text('Save');
                $('#btnAddDefect').addClass('hidden');
                $('#btnStep2NewIssue, .for-questions-issues').removeClass('hidden');
                $('.is_significant_option, #inspectionStep2 #btnCapturePhoto, #inspectionStep2 #btnEditNotes').addClass('hidden');
                objApp.setSubExtraHeading("", false);
            }else{
                $('#btnStep2Back').unbind();
                $("#btnStep2Back").bind(objApp.touchEvent, function(e)
                {
                    e.preventDefault();
                    self.showStep1();
                    return false;
                });
                $('#btnStep2Next').text('Next');
                $('#btnAddDefect').removeClass('hidden');
                $('#btnStep2NewIssue, .for-questions-issues').addClass('hidden');
                $('.is_significant_option, #inspectionStep2 #btnCapturePhoto, #inspectionStep2 #btnEditNotes').removeClass('hidden');
                objApp.setSubExtraHeading("Step 2 of 3", true);
            }

        }
        $('#btnStep2Back').show();
        $('#inspectionStep2 #btnCapturePhoto').show();
        $('#btnStep2Next').parent().show();

        $('#inspectionStep2 #frmDefectDetails tr#action_wrapper').show();
        
        // Show the inspection screen.
        objApp.clearMain();
        
        // Clear the observations window
        $("#frmDefectDetails #observation_suggestion").html("");
        $("#observationFS").hide();
        
		$("#inspectionStep2").removeClass("hidden");
        $("#inspectionStep2 textarea#observation").val('');
        $("#inspectionStep2 ul#popAction li:first-child").text('Choose');
        $("#historyModal").hide();

        if (inspectionItem) {
            self.initDefectForm(inspectionItem, true, addNewQuestionIssue);
            objApp.keys.question = inspectionItem.question;
        }
        else
        {
            objApp.keys.inspection_item_id = '';
			objApp.keys.location = '';
			objApp.keys.observation = '';
			objApp.keys.action = '';
            objApp.keys.question = '';
            self.initDefectForm(null);
        }
            	
    }
    
    this.showStep3 = function()
    {
        self.isProcessing = false;
        self.isAddingSignificantItem = 0;
        self.setStep(3);
        objApp.clearMain();
        
        // Hide the reinspect button until we check the finalised state of the inspection.
        $("div.btnReinspect").hide();
        $("a.btnReinspect").unbind();

        $("#inspectionStep3").removeClass("hidden");

        if(self.isReportsWithQuestions()){
            $("#inspectionStep3 a.passed").bind(objApp.touchEvent, function(){
                self.updateInspectionPassFail(0);
            });

            $("#inspectionStep3 a.failed").bind(objApp.touchEvent, function(){
                self.updateInspectionPassFail(1);
            });
            $('.btnPassed-container, .btnFailed-container').removeClass('hidden');
            if (self.inspection.failed == 1)
                $(".inspectionDetails .failed").addClass('active');
            else
                $(".inspectionDetails .passed").addClass('active');

        }else{
            $('.btnPassed-container, .btnFailed-container').addClass('hidden');
        }
        
        // Load the inspection object
        objDBUtils.loadRecord("inspections", objApp.keys.inspection_id, function(inspection_id, inspection) {
            if(!inspection) {
                return;    
            }
            
            self.inspection = inspection;

            var inspection_property = "Lot " + inspection.lot_no + ", " + inspection.address + ", " + inspection.suburb;
            
            objApp.setSubHeading("Review Inspection @ " + inspection_property);  
            
            // If this a 5 step inspection, hide the finalisation buttons on step 3
            //if((inspection.report_type == "Builder: PCI/Final inspections") || (inspection.report_type == "Fix / Plaster Inspection")) {
            if(inspection.report_type == "Quality Inspection" || inspection.report_type == "Builder: PCI/Final inspections") {
                $("#btnFinishedWrapper").hide();
                $("#btnSendReport").addClass('hidden');
            } else {
                $("#btnFinishedWrapper").show();
                $("#btnSendReport").removeClass('hidden');
            }
            
            if((inspection.report_type == "Quality Inspection" || inspection.report_type == "Builder: PCI/Final inspections") && objApp.keys.reinspection_id == "") {
                objApp.setSubExtraHeading("Step 3 of 5", true);
                $('#inspectionStep3 > .bottomBtns > a#btnStep3Email').hide();
                $('#inspectionStep3 > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Next');
            }  else if( (inspection.report_type == "Quality Inspection" || inspection.report_type == "Builder: PCI/Final inspections") && objApp.keys.reinspection_id != "") {
                objApp.setSubExtraHeading("Step 3 of 4", true);
                $('#inspectionStep3 > .bottomBtns > a#btnStep3Email').hide();
                $('#inspectionStep3 > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');
                $('#reinspection > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                $('#reinspection > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');
                
            } /*else if(inspection.report_type == "Fix / Plaster Inspection" && objApp.keys.reinspection_id == "") {
                objApp.setSubExtraHeading("Step 3 of 4", true);
                $('#inspectionStep3 > .bottomBtns > a#btnStep3Email').hide();
                $('#inspectionStep3 > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Next');
            } else if(inspection.report_type == "Fix / Plaster Inspection" && objApp.keys.reinspection_id != "") {
                objApp.setSubExtraHeading("Step 3 of 4", true);
                $('#inspectionStep3 > .bottomBtns > a#btnStep3Email').hide();
                $('#inspectionStep3 > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');
                $('#reinspection > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                $('#reinspection > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');                
            } */ else {
                //objApp.setSubExtraHeading("Step 3 of 3", true);
                objApp.setSubExtraHeading("", false);
                $('#inspectionStep3 > .bottomBtns > a#btnStep3Email').show();
                $('#inspectionStep3 > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Exit');
            }

            $("div.btnEditNotes").show();

            self.handleFinalised();

            // Load the defect items for this inspection
            self.loadInspectionItems();

            self.setNoteButtonContentIndicators();

            $("#btnStep3DeleteInspection").unbind();
            $("#btnStep3DeleteInspection").bind(objApp.touchEvent, function(e) {
                if(confirm("Are you sure you wish to delete this inspection?")) {
                    var sql = "UPDATE inspections " +
                              "SET deleted = 1, dirty = 1 " +
                              "WHERE id = ?";

                    objDBUtils.execute(sql, [objApp.getKey("inspection_id")], null);

                    self.setupInspections();
                }
            });
            
            $("a.btnReinspect").bind(objApp.touchEvent, function(e) {
                self.startReinspection(objApp.getKey("inspection_id"));
            });

            if (inspection.report_type == 'Client: PCI/Final inspections'){
                $('.client-pci').show();
            }else{
                $('.client-pci').hide();
            }

            if (inspection.finalised == 1){
                $('#practical_completed_selector').prop('disabled', true);
            }else{
                $('#practical_completed_selector').prop('disabled', false);
            }
        }, inspection_id);


    }

    this.showStep4 = function()
    {
        self.setStep(4);
        

        // Set the main heading
        var inspection_property = "Lot " + self.inspection.lot_no + ", " + self.inspection.address + ", " + self.inspection.suburb;
        objApp.setSubHeading("Materials to be left on site");
        
        //if((self.inspection.report_type == "Builder: PCI/Final inspections" && objApp.keys.reinspection_id != "") || self.inspection.report_type == "Fix / Plaster Inspection") {
        console.log(self.inspection.report_type);
        if( (self.inspection.report_type == "Quality Inspection" || self.inspection.report_type == "Builder: PCI/Final inspections") && objApp.keys.reinspection_id != "") {
            objApp.setSubExtraHeading("Step 4 of 4", true);
            $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');
        } else {
            objApp.setSubExtraHeading("Step 4 of 5", true);
            $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Next');
        }

        objApp.clearMain();

        if(objApp.keys.reinspection_id != "") {

            objDBUtils.loadRecord("reinspections", objApp.keys.reinspection_id, function(param, reinspection) {
                if(!reinspection) {
                    alert("Couldn't load the reinspection record!");
                    return;
                }

                self.handleYesNoButtons(reinspection);
                $("#barrel_code").val(reinspection.barrel_code);
            }, "");

        }
        else if(self.inspection) {
            self.handleYesNoButtons(self.inspection);
            $("#barrel_code").val(self.inspection.barrel_code);

        } 
        
        /*
        if(self.inspection.report_type == "Fix / Plaster Inspection") {
            $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Exit');
        } else {
            $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Next &rsaquo;&rsaquo;');
        }
        */

        $("#inspectionStep4").removeClass("hidden");

        self.setTableWidths2('tblRateListingHeader', 'tblRateListing', 2, 500);
        
    }

    this.showStep5 = function()
    {
        self.setStep(5);

        // Set the main heading
        var inspection_property = "Lot " + self.inspection.lot_no + ", " + self.inspection.address + ", " + self.inspection.suburb;
        objApp.setSubHeading("Rate Inspection @ " + inspection_property);
        objApp.setSubExtraHeading("Step 5 of 5", true);

        objApp.clearMain();

        if(self.inspection) {
            if(!objApp.empty(self.inspection.brickwork)) {
                $("#brickwork").val(self.inspection.brickwork);
            }

            if(!objApp.empty(self.inspection.paint_quality)) {
                $("#paint_quality").val(self.inspection.paint_quality);
            }

            if(!objApp.empty(self.inspection.plaster_quality)) {
                $("#plaster_quality").val(self.inspection.plaster_quality);
            }

            if(!objApp.empty(self.inspection.interior_quality)) {
                $("#interior_quality").val(self.inspection.interior_quality);
            }

            if(!objApp.empty(self.inspection.exterior_quality)) {
                $("#exterior_quality").val(self.inspection.exterior_quality);
            }

            var brickwork = parseInt($('#inspectionStep5 #brickwork').val());
            var paintQuality = parseInt($('#inspectionStep5 #paint_quality').val());
            var plasterQuality = parseInt($('#inspectionStep5 #plaster_quality').val());
            var interiorQuality = parseInt($('#inspectionStep5 #interior_quality').val());
            var exteriorQuality = parseInt($('#inspectionStep5 #exterior_quality').val());
            var total = brickwork + paintQuality + plasterQuality + interiorQuality + exteriorQuality;
            $('#inspectionStep5 #total').text(total + '/25');
        }

        $("#inspectionStep5").removeClass("hidden");

        self.setTableWidths2('tblRateListingHeader', 'tblRateListing', 2, 500);
    }

    // Sets the default notes if no notes have been entered.
    this.setDefaultNotes = function()
    {
        // If the current note value is empty and if this is not a Builder: PCI/Final inspections,
        // set the default notes.
        if($("#inspection #notes").val() == "") {
            report_type = $("#inspection #report_type").val();
            if( (report_type == "Quality Inspection") || (report_type == "Builder: PCI/Final inspections") || (report_type == "Fix / Plaster Inspection")) {
                $("#inspection #notes").val(self.default_notes);
            }else if(report_type == "Builder: Pre-plaster and lock up inspections"){
                var notes = "1. Quality of brickwork to be checked and any defects to be noted.\n\n"+
                    "2. Confirm if any damage to wall bracing has occurred\n\n"+
                    "3. Have downpipes been checked (pops in right position as per plans)\n\n" +
                    "4. Site Manager to confirm that frame has been approved by authorties before plaster commences.\n";
                $("#inspection #notes").val(notes);
            }else if(report_type == "Builder: Pre-paint/fixing inspections"){
                var notes = "1. Have downpipes been Installed and connected to SWD\n\n"+
                    "2. Has the Gas line been Installed\n\n"+
                    "3. Has the Garage door been Installed\n\n" +
                    "4. Is there any reinforcement bars visible around the house.\n";
                $("#inspection #notes").val(notes);
            }

        }
    }

    this.showReinspection = function()
    {
        var text = "";
        // Load the inspection object
        objDBUtils.loadRecord("inspections", objApp.keys.inspection_id, function(inspection_id, inspection) {
            if(!inspection) {
                return;
            }
            else
            {
                text += "LOT" + inspection.lot_no + ". " +  inspection.address + ". " + inspection.suburb;
                objApp.setExtraHeading(text, true);
                if (inspection.failed == 1)
                {
                    $(".inspectionDetails .failed").addClass('active');
                }
                else
                {
                    $(".inspectionDetails .passed").addClass('active');
                }
            }



        }, inspection_id);


        this.handleFinalised();

        // Load the defect items for this inspection
		//self.loadReinspectionItems("");

    }
    this.doInspectionItemsSearch = function()
    {
        objApp.showHideSpinner(true, "#inspectionList");

		// Remove the triangle from the table header cells
		$("#tblDefectListingHeader th .triangle").remove();

		// Inject the triangle
		$("#tblDefectListingHeader th[class='" + self.sortBy + "']").append('<span class="triangle ' + self.sortDir + '"></span>');


		var sql = "SELECT i.*, c.name as client_name, s.address1 || ' ' || s.address2 as site_name " +
			"FROM inspections i " +
			"INNER JOIN clients c ON i.client_id = c.id " +
			"INNER JOIN sites s ON i.site_id = s.id " +
			"WHERE i.deleted = 0 ";

		var values = new Array();

	    sql += "ORDER BY " + self.itemSortBy + " " + self.itemSortDir + " ";	// Show the most recent inspections first.

	    if((objFilters.recordLimit != "") && (objFilters.recordLimit != "all"))
	    {
	    	sql += "LIMIT ?";
	    	values.push(objFilters.recordLimit);
	    }

	    blockElement('body');

	    objDBUtils.loadRecordsSQL(sql, values, function(param, items)
	    {
		    // Remove any element block
		    unblockElement('body');

			if(!items)
            {
                objApp.showHideSpinner(false, "#inspectionList");
				return;
            }

			var html = '<table id="tblInspectionListing" class="listing">';

			var maxLoop = items.rows.length;
			var r = 0;
			for(r = 0; r < maxLoop; r++)
			{
				var num_defects = 0;
			    var row = items.rows.item(r);
			    var inspDate = objApp.isoDateStrToDate(row.inspection_date);

			    html += '<tr rel="' + row.id + '">';
			    html += '<td><span class="icon';

			    if(row.finalised)
			    {
					html += ' finalised';
			    }

			    html += '"></span>';

			    html += objApp.formatUserDate(inspDate) + '</td>';
			    html += '<td>' + row.lot_no + ' ' + row.address + ' ' + row.suburb + ' ' + row.postcode + '</td>';
			    html += '<td><div class="i-passed">';
                if (row.failed == 0)
                    html += 'Failed<a href="#" class="failed"></a></div>';
                else
                    html += 'Passed<a href="#" class="passed"></a></div>';
                html += '</div></td>';
                html += '<td><div id="action">';
                if (row.failed == 0)
                    html += '<a href="#" id="action" class="failed">Reinspect</a>';
                else
                    html += '<a href="#" id="action" class="passed">View</a>';
                html += '</div></td>';
			    html += '</tr>';
			}

			html += '</table>';

/* 			Bind click event to list items
			$("#tblInspectionListing tr").bind("click", function(e)
			{
				e.preventDefault();

			    // Remove any active states of the list items
			    $(this).parent().parent().parent().find("td").removeClass("active");

			    // Set the active state
			    $(this).parent().parent().addClass("active");

			    // Get the id of the selected client
			    var inspection_id = $(this).attr("rel");

			    // Show the loading indicator
			    blockElement('body');

			    // Load the inspection in question
			    objDBUtils.loadRecord("inspections", inspection_id, function(inspection_id, row)
			    {
			    	unblockElement('body');

					if(row)
					{
						objApp.objInspection.editInspection(row);
					}

			    }, inspection_id);

			    return false;
			}); */

			$("#tblDefectListingHeader th").unbind();

			$("#tblDefectListingHeader th").bind(objApp.touchEvent, function(e)
			{
				e.preventDefault();

				var newSortBy = $(this).attr("class");

				if(self.sortBy == newSortBy)
				{
					if(self.sortDir == "ASC")
					{
						self.sortDir = "DESC";
					}
					else
					{
						self.sortDir = "ASC";
					}
				}
				else
				{
					self.sortDir = "ASC";
				}

				self.sortBy = newSortBy;

				self.doInspectionItemsSearch();
			});

	    }, "");
    }

    /* end of new version section */

	/***
	* addNewInspection
	* Sets up the main screen area ready for adding a new inspection
	*/
	this.addNewInspection = function()
	{
		// Clear the main screen area
        objApp.clearKeys();
		objApp.clearMain();
        objApp.cleanup();
		self.inAudit = false;
		self.lastKeyPress = null;
        self.finalised = 0;
        $('#finalised').val(0);
        self.handleFinalised();
        self.setStep(1);
        self.numImgCurr = 0;
        self.inspection = false;
        self.isAddingSignificantItem = 0;

        // Clear reinspection keys
        self.reinspectionKey = "";
        objApp.keys.reinspection_id = "";

        $(".inspectionDetails #btnCapturePhoto .numImgCurr").text(self.numImgCurr);
        $('#frmInspectionDetails #lot_no').val('');
        $('#frmInspectionDetails #address').val('');
        $('#frmInspectionDetails #suburb').val('');
        $('#frmInspectionDetails #postcode').val('');
        $('#frmInspectionDetails #weather').val('');
        $('#frmInspectionDetails #client_info').val('');
        $('#practical_completed_selector').val(0);
        $('#practical_completed_selector').trigger('change');
        $('#practical_completed_selector').prop('disabled', false);

		// Set the main heading
        objApp.setHeading("Blueprint Inspections");
        objApp.setSubHeading("Create a New Inspection");
        objApp.setSubExtraHeading("Step 1 of 3", true);

		// Set the new inspection button to be active
		objApp.setNavActive("#navNewInspection");

        $("#report_type2").trigger('change');
        if(!$("#inspection #btnDeleteInspection").hasClass("hidden"))
		{
			$("#inspection #btnDeleteInspection").addClass("hidden");
		}
        $("#inspection .report_type_options").val('');

        $("#inspection #inspection_no").val('');
		// Set the inspection date and start time to the current date and time

		// Visit Date
		var objDate = new Date();
		$("#inspection #inspection_date").val(objApp.formatUserDate(objDate));

		// Visit start
		$("#inspection #start").val(objTimePicker.getTimeStr(objDate));
        $("#inspection #startTimer").html(objTimePicker.getTimeStr(objDate));

		// Visit Finish
		$("#inspection #finish").val(objTimePicker.getTimeStr(objDate));

		var first_name = localStorage.getItem("first_name");
		var last_name = localStorage.getItem("last_name");
		var user_id = localStorage.getItem("user_id");
		var email = localStorage.getItem("email");
		if((first_name == null) || (first_name == "") || (last_name == null) || (last_name == "") ||
			(email == null) || (email == "") || (user_id == null) || (user_id == "") )
		{
			alert("Sorry, there seems to be some critical data about you missing from your session.  Please login again.");
			objApp.objLogin.logout();
		}

		var inspector = first_name + " " + last_name;
		$("#inspection #inspectionInspector").val(inspector);
		$("#inspection #inspectionInspector").attr("readonly", "readonly");
		$("#inspection #initials").val('');

		$("#inspection #duration").val("0");
		$("#inspection #created_by").val(user_id);

        self.setNoteButtonContentIndicators();

		// Reset the toggle controls
		$("#toggles").html("");    // Clear the previous renderings out

		if(!$("#toggles").hasClass("hidden"))
		{
			// Reset the failed and finalised states
			$("#failed").val("1");  // All inspections start as failed
			$("#finalised").val("0"); // And not finalised.

			// Hide the toggles
			$("#toggles").addClass("hidden");
		}

        $("#inspectionStep4 #emailTo").val("");
        $("#inspection #notes").val("");

        self.setDefaultNotes();

		// Show the inspection screen.
		$("#inspection").removeClass("hidden");

        // Hide the camera button until the inspection is created.
        $(".inspectionDetails #btnCapturePhoto").hide();

        // Hide the next button until the inspection is created.
        $(".inspectionDetails #btnStep1Next").hide();

        // By default an inspection should be set as failed.
        if(self.isReportsWithQuestions()){
            $("#inspectionStep3 a.failed").addClass('active');
            $("#inspectionStep3 a.passed").removeClass('active');
        }

        // Make sure the coversheet notes button is hidden.
        $("div.btnEditNotes").hide();
        $("a.btnEditClientNotes").hide();
        $("a.btnEditPrivateNotes").hide();
        $("#inspection #includeclientnotesonreport").val("0");

		this.unbindEvents();
		// Setup client and site popselectors
		this.setupPopselectors();
        objApp.setBodyClass('inspection');
        self.applyPermission();
	}

    /**
    * Handle the event when the user wants to edit an existing inspection.
    */
	this.editInspection = function(inspection)
	{
        // Set keys
        objApp.keys.inspection_id = inspection.id;
        objApp.keys.report_type = inspection.report_type;
        objApp.keys.builder_id = inspection.builder_id;
        objApp.keys.state = inspection.state;
        objApp.keys.supervisor_id = inspection.supervisor_id;

		self.inAudit = false;
		self.lastKeyPress = null;
        self.isEditing = 1;
        self.isAddingSignificantItem = 0;
        self.inspection = inspection;

        // Clear reinspection related keys
        self.reinspectionKey = "";
        objApp.keys.reinspection_id = "";

        self.setStep(1);

		// Store the inspection_id into local storage, so if the user accidently leaves the app we can return here quickly
		self.setReturnInspectionID(inspection.id);

		// Check to see if the user is restricted
		self.restricted = localStorage.getItem("restricted");
        self.user_type = localStorage.getItem("user_type");

		self.checkCanDelete();

		// Set the app context so we can warn the user about unfinalised inspections.
		objApp.context = "inspection";
        objApp.setBodyClass('inspection');

		if(objApp.keys.inspection_id == "")
			return;

		// Hide the filters panel
		objFilters.hide();

		// Clear the main screen area
		objApp.clearMain();

		// Set the main heading
		objApp.setSubHeading("Edit Inspection");

		objApp.setNavActive("#navNewInspection");

		// Set the inspection date and start time to the current date and time

		// Show the toggle objects
		$("#toggles").removeClass("hidden");

        $("#inspection #inspection_no").val(inspection.id);

		// Inspection Date
		var objDate = objApp.isoDateStrToDate(inspection.inspection_date);
		$("#inspection #inspection_date").val(objApp.formatUserDate(objDate));

		// Inspection start
		$("#inspection #start").val(inspection.start);
        $("#inspection #startTimer").html(inspection.start);

		// Inspection Finish
		$("#inspection #finish").val(inspection.finish);

		$("#inspection #finalised").val(inspection.finalised);
		$("#inspection #failed").val(inspection.failed);
		$("#inspection #initials").val(inspection.initials);
        
        $("#inspection #report_type").val(inspection.report_type);
        $("#inspection .report_type_options").hide();
        if (inspection.report_type.indexOf('Builder:') > -1) 
        {
            $("#inspection #report_type2").val("Builder inspection");
            $("#inspection #builder_report_type").show();
            $("#inspection #builder_report_type").val(inspection.report_type);
        }
        else if (inspection.report_type.indexOf('Client:') > -1) 
        {
            $("#inspection #report_type2").val("Client inspection");
            $("#inspection #client_report_type").show();
            $("#inspection #client_report_type").val(inspection.report_type);
        }
        else if (inspection.report_type.indexOf('Peet') > -1)
        {
            $("#inspection #report_type2").val("Peet inspection");
            $("#inspection #peet_report_type").show();
            $("#inspection #peet_report_type").val(inspection.report_type);
        }
        else
        {
            $("#inspection #report_type2").val("Handovers.com");
            $("#inspection #handover_report_type").show();
            $("#inspection #handover_report_type").val(inspection.report_type);
        }
        self.checkIfNeedPhotos();
        
        $("#inspection #weather").val(inspection.weather);
        $("#inspection #lot_no").val(inspection.lot_no);
        $("#inspection #address").val(inspection.address);
        $("#inspection #suburb").val(inspection.suburb);
        $("#inspection #postcode").val(inspection.postcode);
		$("#inspection #notes").val(inspection.notes);
        $("#inspection #client_info").val(inspection.client_info);

        if (inspection.failed)
        {
            $(".inspectionDetails .failed").addClass('active');
            $(".inspectionDetails .passed").removeClass('active');
        }
        else
        {
            $(".inspectionDetails .failed").removeClass('active');
            $(".inspectionDetails .passed").addClass('active');
        }

        $("#inspection #certificated").val(inspection.certificated);
        if (inspection.certificated == 1){
            $('#btnCertificated').removeClass('hidden');
            $('#btnUncertificated').addClass('hidden');
        }else{
            $('#btnCertificated').addClass('hidden');
            $('#btnUncertificated').removeClass('hidden');
        }

        this.finalised = false;

        if(inspection.finalised == 1) {
            this.finalised = true;
        }

        this.handleFinalised();

		var first_name = localStorage.getItem("first_name");
		var last_name = localStorage.getItem("last_name");
		var user_id = localStorage.getItem("user_id");
		var email = localStorage.getItem("email");
		if((first_name == null) || (first_name == "") || (last_name == null) || (last_name == "") ||
			(email == null) || (email == "") || (user_id == null) || (user_id == ""))
		{
			alert("Sorry, there seems to be some critical data about you missing from your session.  Please login again.");
			objApp.objLogin.logout();
		}

		// TODO - we need to load the users table down so we can show the correct inspector name.
		var inspector = first_name + " " + last_name;
		$("#inspection #inspectionInspector").val(inspector);
		$("#inspection #inspectionInspector").attr("readonly", "readonly");

		$("#inspection #duration").val(inspection.duration);
		$("#inspection #created_by").val(inspection.created_by);

        $("#inspectionStep4 #emailTo").val("");

        self.handleYesNoButtons(inspection);
        $("#barrel_code").val(inspection.barrel_code);

		// Show the inspection screen.
		$("#inspection").removeClass("hidden");

		// Bind events to UI objects
        console.log("BIND 4");
		this.unbindEvents();

		// Setup client and site popselectors
		this.setupPopselectors();

		// Load the defect items for this inspection
		self.loadInspectionItems();
        self.updateInspectionPhotoCount(inspection.id);
        self.applyPermission();

		// Show the Add Defect button.
		$("#btnAddDefect").removeClass("hidden");
                  
        self.setStep(3);
        self.showStep3();
	}

    /**
    * Updates the inspection photo count
    */
    this.updateInspectionPhotoCount = function(inspection_id)
    {
        var sql = "SELECT COUNT(*) as num_photos " +
            "FROM inspectionitemphotos " +
            "WHERE inspection_id = ? " +
            "AND deleted = 0 AND id NOT IN(SELECT photo_id FROM significant_items WHERE type = 'inspectionitem')";

        objDBUtils.loadRecordSQL(sql, [inspection_id], function(row) {
            if(!row) {
                alert("Coulnt' load inspection photo count");
            }

            $(".inspectionDetails #btnCapturePhoto div.numImgCurr").html(row.num_photos);

            self.numImgCurr = row.num_photos;
        });
    }

    this.setNoteButtonContentIndicators = function()
    {
        // If each note field has a value, add an asterix to the related button
        // caption to indicate a value.
        var noteFields = {};
        //noteFields["notes"] = "btnEditNotes";
        noteFields["privatenotes"] = "btnEditPrivateNotes";
        noteFields["clientnotes"] = "btnEditClientNotes";

        for(var key in noteFields) {
            var buttons = $(".inspectionDetails ." + noteFields[key]);
            var e = $("#inspection #" + key);
            var fieldVal = $(e).val();

            $(buttons).each(function() {
                var label = $(this).text();

                var firstChar = label.substring(0, 1);

                if(fieldVal != "") {
                    if(firstChar != "*") {
                        label = "*" + label;
                    }
                } else {
                    if(firstChar == "*") {
                        label = label.substring(1, label.length);
                    }
                }

                $(this).text(label);
            });
        }
    }

	/***
	* Initialises and loads the popselectors
	*/
	this.setupPopselectors = function()
	{
        // Load builders
		objDBUtils.primaryKey = "id";
		objDBUtils.showColumn = "name";
		objDBUtils.orderBy = "name ASC";

        self.objPopBuilders = $("#frmInspectionDetails #builder_id");

        self.objPopBuilders.bind('change', objApp.objInspection.handleBuilderChanged);
        self.objPopBuilders.empty();
        self.objPopBuilders.append('<option value="">Builder</option>');

        var filters = [];
        if (objApp.IS_STATE_FILTERED == 1 && objApp.FILTERED_STATE_CODE)
            filters.push(new Array("state = '"+objApp.FILTERED_STATE_CODE+"'"));

        objDBUtils.loadSelect("builders", filters, "#inspection #builder_id", function()
		{
			// Builders have finished loading.  Preselect the client if we have a client_id.
			if(objApp.keys.builder_id != "")
			{
                self.objPopBuilders.val(objApp.keys.builder_id);
                self.objPopBuilders.trigger('change');
			}

            if (self.objPopBuilders.hasClass('select2-hidden-accessible'))
                self.objPopBuilders.select2('destroy');
            self.objPopBuilders.select2({dropdownParent: $("#inspection")});
		}, 'option');

        if(objApp.keys.builder_id != ""){
            self.loadSupervisors(objApp.keys.builder_id);
            $('.supervisor_container').show();
        }else{
            $('.supervisor_container').hide();
        }


        $('#frmInspectionDetails #state').bind('change', objApp.objInspection.handleStateChanged);
        $('#frmInspectionDetails #state').val(objApp.keys.state);
        $('#frmInspectionDetails #state').trigger('change');

        $("#frmInspectionDetails #supervisor_id").bind('change');
        $("#frmInspectionDetails #supervisor_id").bind('change', function(){self.checkSaveInspection(false)});
	}

    this.loadAddressBookList = function(callback)
    {
        var sql = "SELECT * FROM address_book WHERE deleted = 0 GROUP BY email ORDER BY email ASC";

        var values = new Array();
        
        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }        

        objDBUtils.loadRecordsSQL(sql, values, function(param, emails)
        {
            if(emails) {
                // Build the HTML for the email listing
                var html = '';

                var maxLoop = emails.rows.length;
                var r = 0;
                var addressOptions = [];
                
                
                // Loop through all of the emails in the recordset.
                for(r = 0; r < maxLoop; r++)
                {
                    // Get the current row
                    var row = emails.rows.item(r);
                    var email = row.email.trim();                   
                    
                    if(objApp.validateEmail(email)) {
                        //html += '<li><input type="checkbox" id="' + row.id + '" value="' + row.id + '">';
                        //html += '<label for="' + row.id + '">' + row.email + '</label></li>';        
                        email_options[row.id] = email;                 
                    }
                }

                // Insert the HTML into the scrolling wrapper.
               // $("#emailList").html(html);

                
                setTimeout(function()
                {
                    if(objUtils.isMobileDevice())
                    {
                        self.scroller = new IScroll('#emailListWrapper', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbar', useTransform: true, zoom: false, onBeforeScrollStart: function (e) {
                            var target = e.target;
                            while (target.nodeType != 1) target = target.parentNode;
                            if (target.tagName != 'SELECT' && target.tagName != 'INPUT' && target.tagName != 'TEXTAREA')
                                e.preventDefault();
                            }}
                        );                        
                        
                    }
                    
                    if(callback != undefined) {
                        callback();
                    }
                }, 500);
            }

        }, "");
    }

    this.loadSupervisors = function(builder_id)
    {
        var sql = "SELECT DISTINCT users.id, users.first_name, users.last_name " +
            "FROM users INNER JOIN builders_supervisors ON builders_supervisors.supervisor_id = users.id " +
            "WHERE builders_supervisors.builder_id = ? AND users.deleted = 0";
        objDBUtils.loadRecordsSQL(sql, [builder_id], function(param, items)
        {
            $('#frmInspectionDetails #supervisor_id').html('<option value="">Choose</option>');
            if(items)
            {
                var maxLength = items.rows.length;
                for (var r = 0; r < maxLength; r++)
                {
                    var item = items.rows.item(r);
                    $('#frmInspectionDetails #supervisor_id').
                    append($("<option></option>").
                    attr("value", item.id).
                    text(item.first_name + ' ' + item.last_name));
                }
                if(objApp.keys.supervisor_id != "")
                    $('#frmInspectionDetails #supervisor_id').val(objApp.keys.supervisor_id);
                if ($('#frmInspectionDetails #supervisor_id').hasClass('select2-hidden-accessible'))
                    $('#frmInspectionDetails #supervisor_id').select2('destroy');
                $('#frmInspectionDetails #supervisor_id').select2({dropdownParent: $("#inspection")});
            }
        }, "");
    }

	/***
	* handleBuilderChanged is called when the user changes the selected
	* builder.
	*/
	this.handleBuilderChanged = function()
	{
	    var builder_id = $('#frmInspectionDetails #builder_id').val();
        if (builder_id){
            self.loadSupervisors(builder_id);
            $('.supervisor_container').show();
        }else{
            $('.supervisor_container').hide();
        }
		// Save the inspection if possible
		self.checkSaveInspection();
	}

    /***
	* handleBuilderChanged is called when the user changes the selected
	* builder.
	*/
	this.handleStateChanged = function()
	{
		// Save the inspection if possible
		self.checkSaveInspection(0);
	}

    this.createDatepicker = function(){
        var objDate = objApp.userDateStrToDate($("#inspection #inspection_date").val());
        if (self.glDatePicker){
            $.extend(self.glDatePicker.options,
            {
                selectedDate: objDate,
                firstDate: (new Date(objDate)._first())
            });
            self.glDatePicker.render();
            // self.glDatePicker.show();
        }else{
            self.glDatePicker = $('#inspection #inspection_date').glDatePicker({
                cssName: 'flatwhite',
                selectedDate: objDate,

                onClick: (function(el, cell, date, data) {
                    el.val(objApp.formatUserDate(date));
                    objApp.objInspection.checkSaveInspection();
        		}),
                onBeforeClick: (function(el, cell) {
                    if ($("#finalised").val() == 1)
                    {
                        alert("Sorry, you may not change this value.");
                        return false;
                    }
                    return true;
        		})
            }).glDatePicker(true);
        }
    }

    this.unbindEvents = function()
    {
        console.log("IN UNBIND EVENTS");
        // Unbind any previously bound events.
		$("#btnAddDefect").unbind();
		$("#inspection #inspection_date").unbind();
		$("#frmDefectDetails #observation").unbind();
		//$("#inspection #start").unbind();
		//$("#inspection #finish").unbind();
		$("#btnDeleteInspection").unbind();
		$("#frmDefectDetails #notes").unbind();
		$("#print").unbind();
        $(".inspectionDetails .preview").unbind();
        $(".inspectionDetails .finished").unbind();
        $(".inspectionDetails .passed, .inspectionDetails .failed").unbind();
        $(".inspectionDetails #keywords").unbind();
        $(".inspectionDetails #tblDefectListingHeader th").unbind();
        $(".inspectionDetails .gotoStep3").unbind();
        $(".inspectionDetails .gotoStep2").unbind();
        $(".inspectionDetails .gotoStep1").unbind();
        $(".inspectionDetails #btnStep3Next").unbind();
        $(".inspectionDetails #btnStep2Next").unbind();
        $(".inspectionDetails #btnStep1Next").unbind();
        $(".inspectionDetails .addSite").unbind();
        $(".inspectionDetails .addClient").unbind();
        $(".inspectionDetails .itemtype").unbind();
        $(".inspectionDetails .btnEditNotes").unbind();
        $(".inspectionDetails .btnEditClientNotes").unbind();
        $(".inspectionDetails .btnEditPrivateNotes").unbind();
        $(".inspectionDetails #addPhoto-wrapper #addPhoto-btn").unbind();
        $(".inspectionDetails #addPhoto-wrapper #addPhotoFromGallery").unbind();
        $(".inspectionDetails #btnCapturePhoto").unbind();
        $("#tblInspectionListing a.action").unbind();
        $("#historyReinspection td a.action").unbind();
        $("#inspection #report_type").unbind();
        $('#reportComments').unbind();
        $(".inspectionDetails #btnStep4Next").unbind();
        $("#reinspection a.passed").unbind();
        $("#reinspection a.failed").unbind();
        $('#reinspection select#rectified').unbind();
        $("#btnReportPhotos").unbind();
        $(".btnSignificantItems").unbind();
        $("#frmEmailTo").unbind();
        $("a.sendEmailButton").unbind();
        $("a.btnViewChart").unbind();
        $("#report_type").unbind();
        $(".report_type_options").unbind();
        $('#frmDefectDetails #observation').unbind();
        $("#inspectionList #btnAddInspection").unbind();
        $("#btnSendReport,#btnSendReport2,#btnSendReport3").unbind();
        $("select[name='builder_id']").unbind();
        
        setTimeout(function() {
            self.bindEvents();
        }, 500)
    }

	/***
	* bindEvents captures the touch events for the date and time objects
	* and handles them accordingly.
	*/
	this.bindEvents = function()
	{
        // show photoImage to photoList
        if (objApp.keys.inspection_id == "")
        {
            $('#btnCapturePhoto').removeAttr('data-reveal-id');
        }
        else
        {
            $('#btnCapturePhoto').attr('data-reveal-id', 'photoWrapper');
        }

        /* Send Email Form Events */
        $("a.sendEmailButton").bind(objApp.touchEvent, function(e) {
            e.preventDefault();

            self.loadAddressBookList();

            self.resolveEmailReportRecipients();
        });
        
        $("#doInspectionSearch").bind(objApp.touchEvent, function() {
            self.doInspectionSearch();
        });

        $("#inspectionList #il_builder_id").change(function(){
            self.doInspectionSearch();
            return true;
        });

        $("#inspectionList #is_finalised").change(function(){
            self.doInspectionSearch();
        });

        $("#inspectionList #filter_limit").change(function(){
            self.doInspectionSearch();
        });
        
        $("#inspectionList #btnAddInspection").bind(objApp.touchEvent, function()
        {
             objApp.cleanup();
             self.setReturnInspectionID("");
             self.addNewInspection(); 
             objApp.context = "inspection";
            objApp.setBodyClass('inspection');
             return false;
        });                  

        $("#frmEmailTo").submit(function(e) {
            e.preventDefault();

            // Ensure recipients for the report are defined
            var recipients = $("#emailTo").val();
            if(objApp.empty(recipients)) {
                self.resolveEmailReportRecipients();

                alert("Please enter a recipient email address");
                return;
            }

            // Also ensure we have a valid inspection ID
            var inspection_id = objApp.getKey("inspection_id");
            if(objApp.empty(inspection_id)) {
                alert("Invalid inspection ID");
                return;
            }

            var reinspection_id = objApp.getKey("reinspection_id");

            blockElement('body');

            // Load the inspection record
            objDBUtils.loadRecord("inspections", inspection_id, function(param, inspection) {
                if(!inspection) {
                    alert("Error: Couldn't load inspection!");
                    return;
                }
                
                var recipientsArr = recipients.split(",");
                for ( var i=0; i < recipientsArr.length; i++) {
                    var rec = recipientsArr[i].toLowerCase().trim(" ");

                    var values = [rec];
                    // Make sure this email doesn't already exist
                    var sql = "SELECT * " +
                        "FROM address_book " +
                        "WHERE email = ? " +
                        "AND deleted = 0";


                    objDBUtils.loadRecordSQL2(sql, values, function(resource, email)
                    {
                        if(!resource)
                        {
                            var primaryKey = objDBUtils.makeInsertKey(objApp.sync_prefix);

                            var sql = "INSERT INTO " +
                                "address_book(id, email) " +
                                "VALUES(?,?)";
                            var values = [primaryKey, email];

                            objDBUtils.execute(sql, values, function(){});
                        }
                    }, rec);
                }
                
                self.loadAddressBookList();
                

                // Do a silent sync operation
                objApp.objSync.startSyncSilent(function(success) {
                    
                    if(!success) {
                        unblockElement('body');
                        alert("Sorry, a problem occurred whilst syncing your data to the server");
                        return;
                    }

                    // Invoke the API method to send the report
                    var address = self.buildInspectionAddress(inspection);
                    var user_email = localStorage.getItem("email");
                    var params = {};
                    params["email"] = user_email;
                    params['password'] = localStorage.getItem("password");
                    params['version'] = objApp.version;
                    params["subject"] = inspection.report_type + " at " + address;
                    params["recipients"] = recipients;
                    params["from"] = user_email;
                    params["inspectionid"] = inspection_id;
                    params["reinspectionid"] = reinspection_id;
                    params["attach_inspection_images"] = $('#frmEmailTo #attach_inspection_images').is(":checked")?1:0;
                    params["message"] = "Please find attached the " + inspection.report_type + " inspection report for " + address;
                    params["chart_image"] = $('#chart_image').val();
                    params["dummy"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
                    $.post(objApp.apiURL + "reports/send_inspection_report", params, function(response) {
                        
                        unblockElement('body');
                        
                        var data = JSON.parse(response);

                        if(data.status != "OK") {
                            alert(data.message);
                            return;
                        }
						removeChartFromQueue(inspection_id);

                        alert("The inspection was sent successfully");

                        // Hide the reveal window.
                        revealWindow.hideModal();

                    }, "").fail(function() {
                        alert( "error" );
                    })
                });


            }, "");
        });


        $("#frmEmailAdressBooks").submit(function(e) {
            e.preventDefault();

            // Ensure we have a valid email
            var newEmail = $("#newEmail").val();
            if(objApp.empty(newEmail)) {

                alert("Please enter a valid email address");
                return;
            }

            // Also ensure we have a valid inspection ID
            var inspection_id = objApp.getKey("inspection_id");
            if(objApp.empty(inspection_id)) {
                alert("Invalid inspection ID");
                return;
            }

            var reinspection_id = objApp.getKey("reinspection_id");

            blockElement('body');

            // Load the inspection record
            objDBUtils.loadRecord("inspections", inspection_id, function(param, inspection) {
                if(!inspection) {
                    alert("Error: Couldn't load inspection!");
                    return;
                }

                var values = [newEmail];

                // Make sure this email doesn't already exist
                var sql = "SELECT * " +
                    "FROM address_book " +
                    "WHERE email = ? " +
                    "AND deleted = 0";

                objDBUtils.loadRecordSQL2(sql, values, function(resource, email)
                {
                    if(!resource)
                    {
                        var primaryKey = objDBUtils.makeInsertKey(objApp.sync_prefix);

                        var sql = "INSERT INTO " +
                            "address_book(id, email) " +
                            "VALUES(?,?)";
                        var values = [primaryKey, email];

                        objDBUtils.execute(sql, values, function(){
                            unblockElement('body');
                            self.loadAddressBookList(function(){
                                $('#' + primaryKey).prop('checked', true);
                                self.resolveEmailReportRecipients();
                            });
                        });
                    }
                }, newEmail);


            }, "");
        });
        
        $("#inspection #report_type2").change(function() 
        {
            $("#inspection .report_type_options").hide();
            $('.unfinalised-builder-report-only').addClass("hidden");
            if($(this).val() == "Builder inspection")
            {
                $("#inspection #report_type2").val("Builder inspection");
                $("#inspection #builder_report_type").show();
                $("#inspection #builder_report_type").val('');
                $("#inspection #builder_report_type").trigger('change');
                $('.unfinalised-builder-report-only').removeClass("hidden");
            }
            else if($(this).val() == "Client inspection")
            {
                $("#inspection #report_type2").val("Client inspection");
                $("#inspection #client_report_type").show();
                $("#inspection #client_report_type").val('');
                $("#inspection #client_report_type").trigger('change');
            }
            else if($(this).val() == "Peet inspection")
            {
                $("#inspection #report_type2").val("Peet inspection");
                $("#inspection #peet_report_type").show();
                $("#inspection #peet_report_type").val('');
                $("#inspection #peet_report_type").trigger('change');
            }
            else
            {
                $("#inspection #report_type2").val("Handovers.com");
                $("#inspection #handover_report_type").show();
                $("#inspection #handover_report_type").val('');
                $("#inspection #handover_report_type").trigger('change');
            }
            self.checkIfNeedPhotos();
        });

        $("#handover_report_type, #peet_report_type").change(function() {
            self.setDefaultNotes();
        });

        $(".report_type_options").change(function() {
            selected_report_type = $(this).val();
            $("#inspection #report_type").val(selected_report_type);
            if (selected_report_type == 'Client: PCI/Final inspections'){
                $('.client-pci').show();
            }else{
                $('.client-pci').hide();
            }
            /* Change the default notes */
            if(selected_report_type == "Builder: Pre-plaster and lock up inspections"){
                var notes = "1. Quality of brickwork to be checked and any defects to be noted.\n\n"+
                    "2. Confirm if any damage to wall bracing has occurred\n\n"+
                    "3. Have downpipes been checked (pops in right position as per plans)\n\n" +
                    "4. Site Manager to confirm that frame has been approved by authorties before plaster commences.\n";
                $("#inspection #notes").val(notes);
            }else if(selected_report_type == "Builder: Pre-paint/fixing inspections"){
                var notes = "1. Have downpipes been Installed and connected to SWD\n\n"+
                    "2. Has the Gas line been Installed\n\n"+
                    "3. Has the Garage door been Installed\n\n" +
                    "4. Is there any reinforcement bars visible around the house.\n";
                $("#inspection #notes").val(notes);
            }
        });
        
        $(".inspectionDetails #btnCapturePhoto").bind(objApp.touchEvent, function(e)
		{
            e.preventDefault();
            if (objApp.keys.inspection_id == "")
            {
                alert("Please create new inspection");
                return;
            }
            self.loadPhotos();
        });

        // Handle the event when the user wants to take a photo.
        $(".inspectionDetails #addPhoto-wrapper #addPhoto-btn, #addPhotoFromGallery").bind(objApp.touchEvent, function(e)
		{
            e.preventDefault();
           // The user may NOT add photos to a finalised inspection.
            if(self.finalised == 1) {
                alert("Sorry, this inspection has been finalised.  If you wish to add more photos, please un-finalise the inspection first");
                return;
            }
			self.current_table = "inspectionitemphotos";
			self.current_key = "inspection_id";

            if(!objApp.empty(objApp.getKey("reinspection_id"))) {
                self.current_table = "reinspectionitemphotos";
                self.current_key = "reinspection_id";
            }

			// Get the current maximum photo sequence number for this inspection item
			var sql = "SELECT MAX(seq_no) as seq_no " +
				"FROM " + self.current_table + " " +
				"WHERE " + self.current_key + " = ? " +
				"AND deleted = 0";
			objDBUtils.loadRecordSQL(sql, [objApp.getKey(self.current_key)], function(row)
			{
				var seq_no = 1;  // Default sequence number to 1.
				if(row)
				{
					seq_no = row.seq_no;

					if((seq_no == null) || (seq_no == 0))
					{
						seq_no = 0;
					}
					seq_no += 1;
				}
				var editPhoto2 = function(photoData)
				{
					// Setup a new image object, using the photo data as the image source
					objImage = new Image();

                    objImage.src = 'data:image/jpeg;base64,' + photoData;

					//notes = "";

					// When the image has loaded, setup the image marker object
					objImage.onload = function()
					{
 						// Resize the image so it's 600px wide
						objResizer = new imageResizer(objImage);
						var imageData = objResizer.resize(600);


 						// Create a thumbnail version of the image
						objImage = new Image();
						objImage.src = 'data:image/jpeg;base64,' + imageData;

						objImage.onload = function()
						{
							objResizer = new imageResizer(objImage);
							var thumbData = objResizer.resize(90);

							// Save both the thumbnail and the full version to the local file system.
							var fail = function(error)
							{
								alert("storePhotosOnFS::Caught error: " + error.code);
							}

                            // Make sure the current inspection id is valid - there seems to be a bug sometimes when the id is corrupted

							var check_table = "inspections";
							if(self.current_table == "reinspectionitemphotos") {
								check_table = "reinspections";
                            }

							objDBUtils.loadRecord(check_table, objApp.getKey(self.current_key), function(param, row)
                            {
                                if(!row)
                                {
                                    alert("The current inspection id is NOT valid");
                                    return;
                                }

                                user_id = localStorage.getItem("user_id");
                                var new_id = objDBUtils.makeInsertKey(objApp.sync_prefix);
                                var notes = "";

                                if(objApp.phonegapBuild)
                                {
                                    // Phonegap build - save the images to the file system
                                    // Request access to the file system
                                    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
                                    {
                                        var file_name = new_id + "_thumb.jpg";
                                        // Get permission to write the file
                                        fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
                                        {
                                            // Create the file write object
                                            fileEntry.createWriter(function(writer)
                                            {
                                                writer.onwriteend = function(evt)
                                                {
                                                    // Get the file URI for the thumbnail image
                                                    var uri_thumb = fileEntry.toURI();
                                                    // Now write the full image to the file system
                                                    var file_name = new_id + ".jpg";
                                                    fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
                                                    {
                                                        // Create the file write object
                                                        fileEntry.createWriter(function(writer)
                                                        {
                                                            writer.onwriteend = function(evt)
                                                            {
                                                                // Get the file URI for the thumbnail image
                                                                var uri = fileEntry.toURI();
                                                                // Save the image data and notes back to the database
                                                                var sql = "INSERT INTO " + self.current_table + "(id, " + self.current_key + ", seq_no, photodata_tmb, photodata, notes, created_by, dirty) " +
                                                                    "VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
                                                                var values = [new_id, objApp.getKey(self.current_key), seq_no, uri_thumb, uri, notes, user_id, "1"];
                                                                objDBUtils.execute(sql, values, function()
                                                                {
                                                                    // The photo was saved.
                                                                    // Reload the photos
                                                                    self.loadPhotos();
                                                                });
                                                            };
                                                            writer.write(imageData);
                                                        }, fail);
                                                    }, fail);
                                                };
                                                // Write the thumbnail data to the file.
                                                writer.write(thumbData);
                                            }, fail);
                                        }, fail);
                                    }, fail);
                                }
 							}, function(t){}, "", self.finalised);
						}
					}
				}
                if(e.target.id=='addPhoto-btn'){
                    if(objApp.phonegapBuild)
                    {
                        navigator.camera.getPicture(function(imageData)
                        {
                            editPhoto2(imageData);

                        }, function(message)
                        {
                            alert("Image load failed because: " + message);
                        },
                        {
                            quality: 50,
                            destinationType: Camera.DestinationType.DATA_URL
                        });
                    }
                }
                if(e.target.id=='addPhotoFromGallery'){

                    if(objApp.phonegapBuild)
                    {
                        // Invoke the camera API to allow the user to take a photo
                        navigator.camera.getPicture(function(imageData)
                        {
                            // The image data will be a ele URI
                            // Show the photo in the image editor.
                            editPhoto2(imageData);

                        }, function(message)
                        {
                            alert("Image load failed because: " + message);
                        },
                        {
                            quality: 50,
                            destinationType: Camera.DestinationType.DATA_URL,
                            sourceType : Camera.PictureSourceType.PHOTOLIBRARY,
                            correctOrientation: true
                        });
                    }
                }

			});
		});

        $(".inspectionDetails .capture-signature-btn").unbind(objApp.touchEvent);
        $(".inspectionDetails .capture-signature-btn").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            if (objApp.keys.inspection_id == "")
            {
                alert("Please create new inspection");
                return;
            }
            self.initSignature1();
            self.initSignature2();
            self.loadSignaturePhotos();
        });

        $("#btnDone.close-reveal-modal").unbind(objApp.touchEvent);
        $("#btnDone.close-reveal-modal").bind(objApp.touchEvent, function(e) {
            revealWindow.hideModal();
        });

        $("#btnDoneSignature.close-reveal-modal").unbind(objApp.touchEvent);
        $("#btnDoneSignature.close-reveal-modal").bind(objApp.touchEvent, function(e) {
            revealWindow.hideModal();
        });

		// Figure out if this inspection is currently finalised or not.
		self.finalised = $("#frmInspectionDetails #finalised").val();

		// make sure we scroll back down after the user has finished typing.
		$("#frmDefectDetails #notes").bind("blur", function()
		{
			objApp.scrollTop();
		});

        self.createDatepicker();

        $(".inspectionDetails #btnStep1Next").bind(objApp.touchEvent, function(e) {
			e.preventDefault();

            if ($('#frmInspectionDetails #report_type').val() == "") {
                alert("Please select a report type");
                return;
            }

            if(self.objPopBuilders.val() == "") {
                alert("Please select a builder");
                return;
            }

            if ($('#frmInspectionDetails #weather').val() == "") {
                alert("Please enter weather conditions");
                return;
            }

            if ($('#frmInspectionDetails #lot_no').val() == "") {
                alert("Please input a lot_no");
                return;
            }

            if ($('#frmInspectionDetails #address').val() == "") {
                alert("Please input a address");
                return;
            }

            if ($('#frmInspectionDetails #suburb').val() == "") {
                alert("Please input a suburb");
                return;
            }

            if ($('#frmInspectionDetails #postcode').val() == "") {
                alert("Please input a postcode");
                return;
            }

            if($('#frmInspectionDetails #state').val() == "") {
                alert("Please select a state");
                return;
            }

            self.checkSaveInspection(0, function(){
                if(self.isReportsWithQuestions($('#inspection #report_type').val())){
                    self.addQuestionItems($('#inspection #report_type').val());
                }else{
                    self.showStep2();
                }
            });
			return false;
		});

        /**
        * Handle the event when the user hits the NExt button on the stage 2 event tracking
        */
        $(".inspectionDetails #btnStep2Next").bind(objApp.touchEvent, function(e) {
            // If the user has attempted to add a new defect, ensure they have entered an observation
            // and then save the defect.  If no location is selected, just go straight to the next item.
            var currentLocation = self.objPopLocation.getValue();
            if(currentLocation == "") {
                // No location selected, go straight to step 3.
                self.showStep3();
                return;    
            }
            
            if($('#observation').val().trim()==''){
               alert('Please insert the observation');
               return;
            }

            if(self.isAddingSignificantItem == 1){
                alert('Please select an image for significant issue');
                return;
            }

			e.preventDefault();
            if(self.isProcessing)
                return;

            self.isProcessing = true;
            /* This step is ONLY for normal issues, NOT the significant issue */
            self.saveDefect(function() {
                // Update the finish time of the audit
                var objDate = new Date();
                var objTimePicker = new Timepicker();
                $("#inspection #finish").val(objTimePicker.getTimeStr(objDate));

                blockElement('body');

                self.checkSaveInspection();
                // self.loadInspectionItems();
                self.loadPhotos();

                // Get the number of defects associated with this inspection
                var sql = "SELECT COUNT(*) as num_defects " +
                    "FROM inspectionitems " +
                    "WHERE inspection_id = ? AND deleted = 0";

                objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(row)
                {
                    if(row)
                    {
                        // Now update the parent inspection record with the defect count.
                        var num_defects = row.num_defects;

                        sql = "UPDATE inspections " +
                            "SET num_defects = ? " +
                            "WHERE id = ?";

                        objDBUtils.execute(sql, [num_defects, objApp.keys.inspection_id], function()
                        {
                            unblockElement('body');
                            self.doingSave = false;
                            self.showStep3();
                        });
                    }
                });
            });
			return false;
		});

        $(".inspectionDetails #btnStep3Next").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();

            //if((objApp.keys.report_type == 'Builder: PCI/Final inspections') || (objApp.keys.report_type == 'Fix / Plaster Inspection')) {
            if(objApp.keys.report_type == 'Quality Inspection' || objApp.keys.report_type == 'Builder: PCI/Final inspections') {
                self.showStep4();
            }
            else {
                objApp.cleanup();

                self.setReturnInspectionID("");

                self.setupInspections();
                objApp.context = "inspections";
                objApp.setBodyClass('inspections');
            }

			return false;
		});

        $(".inspectionDetails #btnStep4Back").bind(objApp.touchEvent, function(e)
        {
            if(objApp.keys.reinspection_id != "") {
                var sql = 'UPDATE reinspections SET min_roof_tiles = ?,min_ridge_tiles =?,touch_up_paint =?,' +
                    'min_flooring_tiles=?, grout_samples=?, practical_completed=?, barrel_code=?,  dirty = 1 WHERE id = ?';
                var min_roof_tiles = $("#min_roof_tiles").val();
                var min_ridge_tiles = $("#min_ridge_tiles").val();
                var touch_up_paint = $("#touch_up_paint").val();
                var min_flooring_tiles = $("#min_flooring_tiles").val();
                var grout_samples = $("#grout_samples").val();
                var practical_completed = $("#practical_completed").val();
                var barrel_code = $("#barrel_code").val();

                objDBUtils.execute(sql, [min_roof_tiles,min_ridge_tiles,touch_up_paint,min_flooring_tiles,
                    grout_samples,practical_completed,barrel_code,objApp.keys.reinspection_id], null);
            }
            else {
                self.checkSaveInspection();
            }
        });

        $(".inspectionDetails #btnStep4Next").unbind(objApp.touchEvent);
        $(".inspectionDetails #btnStep4Next").bind(objApp.touchEvent, function(e)
        {
            if(objApp.keys.reinspection_id != "") {
                var sql = 'UPDATE reinspections SET min_roof_tiles = ?,min_ridge_tiles =?,touch_up_paint =?,' +
                    'min_flooring_tiles=?, grout_samples=?, practical_completed=?, barrel_code=?,  dirty = 1 WHERE id = ?';
                var min_roof_tiles = $("#min_roof_tiles").val();
                var min_ridge_tiles = $("#min_ridge_tiles").val();
                var touch_up_paint = $("#touch_up_paint").val();
                var min_flooring_tiles = $("#min_flooring_tiles").val();
                var grout_samples = $("#grout_samples").val();
                var practical_completed = $("#practical_completed").val();
                var barrel_code = $("#barrel_code").val();
                objDBUtils.execute(sql, [min_roof_tiles,min_ridge_tiles,touch_up_paint,min_flooring_tiles,
                    grout_samples,practical_completed,barrel_code,objApp.keys.reinspection_id], null);
            }
            else {
                self.checkSaveInspection();
            }

            e.preventDefault();

            if( (objApp.keys.report_type == 'Quality Inspection' || objApp.keys.report_type == 'Builder: PCI/Final inspections') && objApp.keys.reinspection_id == "") {
                self.showStep5();
            }
            else {
                objApp.cleanup();

                self.setReturnInspectionID("");

                self.setupInspections();
                objApp.context = "inspections";
                objApp.setBodyClass('inspections');
            }

            return false;
        });

        // Handle the event when the user clicks on the next button from Step 4
        $(".inspectionDetails #btnStep5Next").bind(objApp.touchEvent, function(e) {
			e.preventDefault();

            objApp.cleanup();
            self.setReturnInspectionID("");

            self.setupInspections();
            objApp.context = "inspections";
            objApp.setBodyClass('inspections');
			return false;
		});

        $(".inspectionDetails .gotoStep1").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
            self.showStep1();
			return false;
		});

        $(".inspectionDetails .gotoStep2").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
            self.showStep2();
			return false;
		});

        $(".inspectionDetails .gotoStep3").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
            if ($(this).attr('id') == 'btnStep4Back' && objApp.keys.reinspection_id)
                self.loadReinspectionItems(objApp.keys.reinspection_id);
            else
                self.showStep3();
			return false;
		});

        $(".inspectionDetails .gotoStep4").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            self.showStep4();
            return false;
        });

        self.bindYesNoButtonsEvents();

        $(".inspectionDetails #tblDefectListingHeader th").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			if(self.isReportsWithQuestions())
			    return false;

			var newSortBy = $(this).attr("class");

			if(self.itemSortBy == newSortBy)
			{
				if(self.itemSortDir == "ASC")
				{
					self.itemSortDir = "DESC";
				}
				else
				{
					self.itemSortDir = "ASC";
				}
			}
			else
			{
				self.itemSortDir = "ASC";
			}

			self.itemSortBy = newSortBy;

			self.loadInspectionItems();
		});

        $(".inspectionDetails #keywords").bind("keyup", function(){
            self.loadInspectionItems();
        });

        $(".inspectionDetails #keywords").bind("blur", function(){
            objApp.scrollTop();
        });

        $(".inspectionDetails .passed, .inspectionDetails .failed").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();

            if (self.finalised == 1) {
                return false;
            }

            if ($(this).hasClass('active')) {
                return false;
            }
            else
            {
                $(this).addClass('active');

                if ($(this).hasClass('passed'))
                {
                    $(".inspectionDetails .failed").removeClass('active');
                    $("#failed").val("0");
                }
                else
                {
                    $(".inspectionDetails .passed").removeClass('active');
                    $("#failed").val("1");
                }
            }
            return false;
        });

        $(".inspectionDetails .finished").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();

            if ($(this).hasClass('active')) {
                // The inspection is NOT finalised.
                $("#finalised").val(0);
                self.finalised = 0;
                self.handleFinalised();
            }
            else
            {
                $("#finalised").val(1);
                self.finalised = 1;
                self.handleFinalised();
            }

			// Update the finish time of the audit
			var objDate = new Date();
			var objTimePicker = new Timepicker();
			$("#inspection #finish").val(objTimePicker.getTimeStr(objDate));

			objApp.objInspection.checkSaveInspection();

            if (self.finalised == 1){
                $('#practical_completed_selector').prop('disabled', true);
            }else{
                $('#practical_completed_selector').prop('disabled', false);
            }

			setTimeout(function()
			{
				objApp.objInspection.loadInspectionItems();
			}, 500);
            return false;

        });

        $(".inspectionDetails #btnCertificated").unbind(objApp.touchEvent);
        $(".inspectionDetails #btnCertificated").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            self.handleCertificated();
            return false;
        });

        $(".inspectionDetails #btnUncertificated").unbind(objApp.touchEvent);
        $(".inspectionDetails #btnUncertificated").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            self.handleCertificated();
            return false;
        });

        $(".inspectionDetails #btnCertificatedRe").unbind(objApp.touchEvent);
        $(".inspectionDetails #btnCertificatedRe").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            self.handleCertificatedRe();
            return false;
        });

        $(".inspectionDetails #btnUncertificatedRe").unbind(objApp.touchEvent);
        $(".inspectionDetails #btnUncertificatedRe").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            self.handleCertificatedRe();
            return false;
        });

        $(".inspectionDetails .preview").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();

			// Show the loader graphic
			blockElement('body');

			objApp.objSync.startSyncSilent(function(success)
			{
				if(success)
				{
					// The silent sync has completed successfully.
					// We can now launch the report.
					unblockElement('body');

                    // Create a token
                    var params = {};
                    params["email"] = localStorage.getItem("email");
                    params["password"] = localStorage.getItem("password");
                    params['version'] = objApp.version;
                    var url = objApp.apiURL + "account/create_token/" + Math.floor(Math.random() * 99999);
                    blockElement('body');
                    
                    $.post(url, params, function(data)
                    {
                        unblockElement('body');

                        try {
                            data = jQuery.parseJSON(data);

                            if(data.status != "OK")
                            {
                                alert("Unable to create access token");
                                return;
                            }

                            var token = data.message;
                            var report_type = objApp.keys.report_type.trim();

                            if(report_type == "Fix / Plaster Inspection") {
                                report_type = "Fix";
                            } else {
                                report_type = report_type.replace(/ /g, "_").trim();
                                report_type = report_type.replace(/ /g, "%20").trim();
                                report_type = report_type.replace("/", "-dash-")
                            }

                            var downloadURL = objApp.apiURL + "reports/print_report/" + report_type + '/' + encodeURIComponent(objApp.keys.inspection_id) + '/' + encodeURIComponent(objApp.keys.reinspection_id) + "?token=" + token;
                            if(objApp.phonegapBuild) {
                                downloadURL = "https://docs.google.com/viewer?url=" + encodeURIComponent(downloadURL) + '&embedded=true';
                                var ref = window.open(downloadURL, '_blank', 'location=yes');
                            }

                        } catch (e) {
                            // error
                            alert("Sorry, something went wrong whilst trying to preview the report.");
                            return;
                        }
                    }, "");
				}
				else
				{
					unblockElement('body');
					alert("Sorry, something went wrong whilst syncing your data back to the Blueprint server.  Please try again later.");
				}
			});
		});

        $(".historySection #viewHistory").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            self.showHistoryModal();
        });

        $('#reportComments').bind('blur', function(){
            objApp.scrollTop();
            $("#inspection #notes").val($(this).val());
            objApp.objInspection.checkSaveInspection();
        });

        $('.btnEditNotes').bind(objApp.touchEvent, function(e){
            e.preventDefault();

            if (objApp.keys.inspection_id == "") {
                alert("Please create new inspection");
                return;
            }

            // If the current note value is empty and if this is not a Builder: PCI/Final inspections,
            // set the default notes.
            self.setDefaultNotes();

            if (objApp.keys.reinspection_id == "") {
                var modalTitle = "Coversheet Notes"
                if(self.isReportsWithQuestions())
                    var modalTitle = "Notes";
                var objNoteModal = new noteModal(modalTitle, $("#inspection #notes").val(), function(notes) {
                    // The user has updated the notes value.
                    // Update the toggle (and therefore the form) with the new value.
                    $("#inspection #notes").val(notes);
                    self.setNoteButtonContentIndicators();

                    if (objApp.keys.reinspection_id != "") {
                        var sql = 'UPDATE reinspections SET notes = ?, dirty = 1 WHERE id = ?';
                        objDBUtils.execute(sql, [notes, objApp.keys.reinspection_id], null);
                    }
                    else if(objApp.keys.inspection_id != "")
                    {
                        var sql = 'UPDATE inspections SET notes = ?, dirty = 1 WHERE id = ?';
                        objDBUtils.execute(sql, [notes, objApp.keys.inspection_id], null);
                    }
                });
            }
            if(typeof objNoteModal != 'undefined')
			    objNoteModal.show();

			if(self.finalised == 1)
			{
				objNoteModal.setReadOnly();
			}
        });

        $('.btnEditClientNotes').bind(objApp.touchEvent, function(e){
            e.preventDefault();
            var objNoteModal = new noteModal("Client Comments", $("#inspection #clientnotes").val(), function(notes)
            {
                // The user has updated the notes value.
                // Update the toggle (and therefore the form) with the new value.
                $("#inspection #clientnotes").val(notes);
                self.setNoteButtonContentIndicators();
                objApp.objInspection.checkSaveInspection();
            });

            objNoteModal.setShowRecipients(true);
            objNoteModal.setIncludeOnReportSelector("#includeclientnotesonreport");

            objNoteModal.show();

            if(self.finalised == 1)
            {
                objNoteModal.setReadOnly();
            }
        });


        $('#frmInspectionDetails #lot_no').change(function(){
            self.updateExtraSubHeader();
            self.checkSaveInspection(0);
           });

        $('#frmInspectionDetails #address').change(function(){
            self.updateExtraSubHeader();
            self.checkSaveInspection(0);
           });
        $('#frmInspectionDetails #suburb').change(function(){
            self.updateExtraSubHeader();
            self.checkSaveInspection(0);
           });
        // $('#frmInspectionDetails #postcode').change(function(){
            // self.updateExtraSubHeader();
            // self.checkSaveInspection();
           // });
        $('#frmInspectionDetails #weather').change(function(){
            self.checkSaveInspection(0);
        });

        $('.btnEditPrivateNotes').bind(objApp.touchEvent, function(e){
            e.preventDefault();

            var objNoteModal = new noteModal("Private Notes", $("#inspection #privatenotes").val(), function(notes)
            {
                // The user has updated the notes value.
                // Update the toggle (and therefore the form) with the new value.
                $("#inspection #privatenotes").val(notes);
                self.setNoteButtonContentIndicators();
                objApp.objInspection.checkSaveInspection();
            });

            objNoteModal.show();

            if(self.finalised == 1)
            {
                objNoteModal.setReadOnly();
            }
        });

        $('#emailTo').bind('blur', function(){
            objApp.scrollTop();
        });


        $("#frmDefectDetails #is_significant").unbind();
        $('#frmDefectDetails #is_significant').bind('change', function(e)
        {
            if($(this).is(':checked')){
                self.isAddingSignificantItem = 1;
                $('.for-significant-items').removeClass('hidden');
            }else{
                self.isAddingSignificantItem = 0;
                $('.for-significant-items').addClass('hidden');
            }
        });

		/***
		* Capture the event when the user clicks on the Add Issue button
		*/
        $("#btnAddDefect, #btnStep2NewIssue").unbind();
		$("#btnAddDefect, #btnStep2NewIssue").bind(objApp.touchEvent, function(e)
		{
            var location =	self.objPopLocation.getText();
            var action = self.objPopAction.getText();

            if(location == '' || location.toUpperCase() == "CHOOSE"){
                alert('Please select location');
                return;
            }

            if($('#observation').val().trim()==''){
                alert('Please insert the observation');
                return;
            }

            if(action == '' || action.toUpperCase() == "CHOOSE"){
                alert('Please select action');
                return;
            }

            if(self.isAddingSignificantItem == 1){
                alert('Please select an image for significant issue');
                return;
            }
			e.preventDefault();

			self.saveDefect(function(){
                $("#inspectionStep2 textarea#observation").val('');
                $("#inspectionStep2 ul#popAction li:first-child").text('Choose');
                // Clear all defect related keys
                objApp.keys.inspection_item_id = "";
                objApp.keys.observation = '';
                objApp.keys.action = '';
                // When adding a new defect, hide the delete defect button
                $("#btnDeleteDefect").css("visibility", "hidden");

                if(objApp.keys.question == ''){
                    // Increment the sequence number
                    var seq_no = $("#frmDefectDetails #seq_no").val();
                    if(seq_no == "") {
                        seq_no = 1;
                    } else {
                        seq_no = seq_no * 1;
                        seq_no++;

                        $("#frmDefectDetails #seq_no").val(seq_no);
                    }
                }else{
                    // Increment the sub-sequence number
                    var seq_no2 = $("#frmDefectDetails #seq_no2").val();
                    if(seq_no2 == "") {
                        seq_no2 = 1;
                    } else {
                        seq_no2 = seq_no2 * 1;
                        seq_no2++;

                        $("#frmDefectDetails #seq_no2").val(seq_no2);
                    }
                }

                // Remove event binding
                $("#frmDefectDetails #observation_suggestion tr td").unbind();
                
                // Clear the
                $("#frmDefectDetails #observation_suggestion").empty();

                // Initialise defect form.
                //self.initDefectForm(null, false);
            });

			return false;
		});

		/***
		* Capture the event when the user clicks on the delete inspection button
		*/
		$("#main #btnDeleteInspection").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();

			if(objApp.keys.inspection_id == "") return;

			if(!confirm("Delete this inspection and all related photos and issues?"))
			{
				return true;
			}

			blockElement('body');

			// Delete related inspectionitemphotos
			var sql = "UPDATE inspectionitemphotos " +
				"SET deleted = 1, dirty = 1 " +
				"WHERE inspection_id = ?";

			objDBUtils.execute(sql, [objApp.keys.inspection_id], null);

			// Delete related inspectionitems
			var sql = "UPDATE inspectionitems " +
				"SET deleted = 1, dirty = 1 " +
				"WHERE inspection_id = ?";

			objDBUtils.execute(sql, [objApp.keys.inspection_id], null);

			// Delete this inspection
			var sql = "UPDATE inspections " +
				"SET deleted = 1, dirty = 1 " +
				"WHERE id = ?";

			objDBUtils.execute(sql, [objApp.keys.inspection_id], null);

			setTimeout(function()
			{
				// Now move back to the inspection listing screen.
				self.setupInspections();

				unblockElement('body');
			}, 500);
		});

        $("a.itemtype").bind(objApp.touchEvent, function(e) {
            if($(this).hasClass("acknowledgement")) {
                $(this).removeClass("acknowledgement");
                $("#itemtype").val("0");
            } else {
                $(this).addClass("acknowledgement");
                $("#itemtype").val("1");
            }

            self.saveDefect();
        });

		// Handle the event when the user clicks on the PRINT button
		// to print the inspection report.
		$("#print").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();

			self.showPrintModal();
		});

        var SaveRateTotalInspections = function()
        {
            var brickwork = parseInt($('#inspectionStep5 #brickwork').val());
            var paintQuality = parseInt($('#inspectionStep5 #paint_quality').val());
            var plasterQuality = parseInt($('#inspectionStep5 #plaster_quality').val());
            var interiorQuality = parseInt($('#inspectionStep5 #interior_quality').val());
            var exteriorQuality = parseInt($('#inspectionStep5 #exterior_quality').val());
            var total = brickwork + paintQuality + plasterQuality + interiorQuality + exteriorQuality;
            $('#inspectionStep5 #total').text(total + '/25');
        }

        $("#rateScrollWrapper #brickwork").change(function(){
            SaveRateTotalInspections();
            self.checkSaveRateInspection();
        });

        $("#rateScrollWrapper #paint_quality").change(function(){
            SaveRateTotalInspections();

            self.checkSaveRateInspection();
        });

        $("#rateScrollWrapper #plaster_quality").change(function(){
            SaveRateTotalInspections();

            self.checkSaveRateInspection();
        });

        $("#rateScrollWrapper #interior_quality").change(function(){
            SaveRateTotalInspections();

            self.checkSaveRateInspection();
        });

        $("#rateScrollWrapper #exterior_quality").change(function(){
            SaveRateTotalInspections();

            self.checkSaveRateInspection();
        });

		// Setup toggle controls
  		var objToggleNotes = new toggleControl("toggleNotes", "#frmInspectionDetails #notes", "text", "Notes", function()
  		{
			var objNoteModal = new noteModal("Inspection Notes", objToggleNotes.getValue(), function(notes)
			{
				// The user has updated the notes value.
				// Update the toggle (and therefore the form) with the new value.
				objToggleNotes.setValue(notes);
				objApp.objInspection.checkSaveInspection();
			});

			objNoteModal.show();

			if(self.finalised == 1)
			{
				objNoteModal.setReadOnly();
			}
  		});

  		self.objToggleFailed = new toggleControl("toggleFailed", "#frmInspectionDetails #failed", "binary", "Failed", function()
  		{
            objApp.objInspection.checkSaveInspection();
  		});

        $("#btnReportPhotos").bind(objApp.touchEvent, function(e) {
            e.preventDefault();
            self.showReportPhotos();
        });

        $(".btnSignificantItems").bind(objApp.touchEvent, function(e) {
            e.preventDefault();
            if($(this).attr('id') == 'btnSignificantItemsRe')
                self.showSignificantItems(0);
            else if($(this).attr('id') == 'btnSignificantItems')
                self.showSignificantItems(2);
            else
                self.showSignificantItems(3);
        });

        $("#btnSendReport, #btnSendReport2, #btnSendReport3").unbind(objApp.touchEvent);
        $("#btnSendReport, #btnSendReport2, #btnSendReport3").bind(objApp.touchEvent, function(e) {
            if(objApp.keys.reinspection_id != "") {
                var sql = 'UPDATE reinspections SET min_roof_tiles = ?,min_ridge_tiles =?,touch_up_paint =?,' +
                    'min_flooring_tiles=?, grout_samples=?, practical_completed=?, barrel_code=?,  dirty = 1 WHERE id = ?';
                var min_roof_tiles = $("#min_roof_tiles").val();
                var min_ridge_tiles = $("#min_ridge_tiles").val();
                var touch_up_paint = $("#touch_up_paint").val();
                var min_flooring_tiles = $("#min_flooring_tiles").val();
                var grout_samples = $("#grout_samples").val();
                var practical_completed = $("#practical_completed").val();
                var barrel_code = $("#barrel_code").val();
                objDBUtils.execute(sql, [min_roof_tiles,min_ridge_tiles,touch_up_paint,min_flooring_tiles,
                    grout_samples,practical_completed,barrel_code,objApp.keys.reinspection_id], null);
            }
            else {
                self.checkSaveInspection();
            }

            e.preventDefault();
            // Also ensure we have a valid inspection ID
            var inspection_id = objApp.getKey("inspection_id");
            if(objApp.empty(inspection_id)) {
                alert("Invalid inspection ID");
                return;
            }
            setTimeout(function()
            {
                //var reinspection_id = objApp.getKey("reinspection_id");
                blockElement('body');
                objApp.objSync.startSyncSilent(function(success) {
                    if(!success) {
                        unblockElement('body');
                        alert("Sorry, a problem occurred whilst syncing your data to the server");
                        return;
                    }
                    var params = {'version': objApp.version};
                    params["chart_image"] = $('#chart_image').val();
                    params["dummy"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
                    $.post(objApp.apiURL + "inspections/send_inspection_to_dropbox/" + inspection_id, params, function(response) {
                        unblockElement('body');
                        var data = JSON.parse(response);
                        if(data.status != "OK") {
                            alert(data.message);
                            return;
                        }
                        alert("The report was sent successfully to dropbox");
                    }, "").fail(function() {
                        unblockElement('body');
                        alert( "Unknown error" );
                    })
                });
            },500);
        });

        $("#btnSendReinspectReport").unbind(objApp.touchEvent);
        $("#btnSendReinspectReport").bind(objApp.touchEvent, function(e) {
            e.preventDefault();
            // Also ensure we have a valid inspection ID
            var reinspection_id = objApp.getKey("reinspection_id");
            if(objApp.empty(reinspection_id)) {
                alert("Invalid reinspection ID");
                return;
            }
            //var reinspection_id = objApp.getKey("reinspection_id");
            blockElement('body');
            objApp.objSync.startSyncSilent(function(success) {
                if(!success) {
                    unblockElement('body');
                    alert("Sorry, a problem occurred whilst syncing your data to the server");
                    return;
                }
                var params = {'version': objApp.version};
                $.post(objApp.apiURL + "inspections/send_reinspection_to_dropbox/" + reinspection_id, params, function(response) {
                    unblockElement('body');
                    var data = JSON.parse(response);
                    if(data.status != "OK") {
                        alert(data.message);
                        return;
                    }
                    alert("The report was sent successfully to dropbox");
                }, "").fail(function() {
                    unblockElement('body');
                    alert( "Unknown error" );
                })
            });
        });

        $('#practical_completed_selector').change(function(){
            $('#practical_completed').val($(this).val());
            self.checkSaveInspection(0);
        });

        $(".capture-significant-image, .select-significant-image").unbind(objApp.touchEvent);
        $(".capture-significant-image, .select-significant-image").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            if(self.finalised == 1) {
                alert("Sorry, this inspection has been finalised.  If you wish to add more issues, please un-finalise the inspection first");
                return;
            }
            var location =	self.objPopLocation.getText();
            var action = self.objPopAction.getText();
            var observation =  $("#frmDefectDetails #observation").val();

            if((location == "") || (location.toUpperCase() == "CHOOSE") || observation == "")
            {
                alert('Please enter other fields before selecting the image.');
                return;
            }
            var $this = $(this);
            self.current_table = "inspectionitemphotos";
            self.current_key = "inspection_id";

            if(!objApp.empty(objApp.getKey("reinspection_id"))) {
                self.current_table = "reinspectionitemphotos";
                self.current_key = "reinspection_id";
            }

            // Get the current maximum photo sequence number for this inspection item
            var sql = "SELECT MAX(seq_no) as seq_no " +
                "FROM " + self.current_table + " " +
                "WHERE " + self.current_key + " = ? " +
                "AND deleted = 0";
            objDBUtils.loadRecordSQL(sql, [objApp.getKey(self.current_key)], function(row)
            {
                var seq_no = 1;  // Default sequence number to 1.
                if(row)
                {
                    seq_no = row.seq_no;

                    if((seq_no == null) || (seq_no == 0))
                    {
                        seq_no = 0;
                    }
                    seq_no += 1;
                }
                var editPhoto3 = function(photoData, defect_id)
                {
                    if(typeof defect_id == 'undefined' || defect_id == '' || defect_id == 0)
                        return false;

                    // Setup a new image object, using the photo data as the image source
                    objImage = new Image();

                    objImage.src = 'data:image/jpeg;base64,' + photoData;

                    //notes = "";

                    // When the image has loaded, setup the image marker object
                    objImage.onload = function()
                    {
                        // Resize the image so it's 600px wide
                        objResizer = new imageResizer(objImage);
                        var imageData = objResizer.resize(600);


                        // Create a thumbnail version of the image
                        objImage = new Image();
                        objImage.src = 'data:image/jpeg;base64,' + imageData;

                        objImage.onload = function()
                        {
                            objResizer = new imageResizer(objImage);
                            var thumbData = objResizer.resize(90);

                            // Save both the thumbnail and the full version to the local file system.
                            var fail = function(error)
                            {
                                alert("storePhotosOnFS::Caught error: " + error.code);
                            }

                            // Make sure the current inspection id is valid - there seems to be a bug sometimes when the id is corrupted

                            var check_table = "inspections";
                            if(self.current_table == "reinspectionitemphotos") {
                                check_table = "reinspections";
                            }

                            objDBUtils.loadRecord(check_table, objApp.getKey(self.current_key), function(param, row)
                            {
                                if(!row)
                                {
                                    alert("The current inspection id is NOT valid");
                                    return;
                                }

                                user_id = localStorage.getItem("user_id");
                                var new_id = objDBUtils.makeInsertKey(objApp.sync_prefix);
                                var notes = "";

                                if(objApp.phonegapBuild)
                                {
                                    // Phonegap build - save the images to the file system
                                    // Request access to the file system
                                    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
                                    {
                                        var file_name = new_id + "_thumb.jpg";
                                        // Get permission to write the file
                                        fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
                                        {
                                            // Create the file write object
                                            fileEntry.createWriter(function(writer)
                                            {
                                                writer.onwriteend = function(evt)
                                                {
                                                    // Get the file URI for the thumbnail image
                                                    var uri_thumb = fileEntry.toURI();
                                                    // Now write the full image to the file system
                                                    var file_name = new_id + ".jpg";
                                                    fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
                                                    {
                                                        // Create the file write object
                                                        fileEntry.createWriter(function(writer)
                                                        {
                                                            writer.onwriteend = function(evt)
                                                            {
                                                                // Get the file URI for the thumbnail image
                                                                var uri = fileEntry.toURI();
                                                                // Save the image data and notes back to the database
                                                                var sql = "INSERT INTO " + self.current_table + "(id, " + self.current_key + ", seq_no, photodata_tmb, photodata, notes, created_by, dirty) " +
                                                                    "VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
                                                                var values = [new_id, objApp.getKey(self.current_key), seq_no, uri_thumb, uri, notes, user_id, "1"];
                                                                objDBUtils.executeWithCBParam(sql, values, function(param)
                                                                    {
                                                                        // After the photo was saved, saving record for significant items
                                                                        var insert_sql = "INSERT INTO significant_items(id, `type`, foreign_id, photo_id, created_by, dirty) " +
                                                                            "VALUES(?, ?, ?, ?, ?, ?)";
                                                                        var insert_values = [objDBUtils.makeInsertKey(objApp.sync_prefix), self.current_table.replace('photos', ''), param.defect_id, param.photo_id, localStorage.getItem("user_id"), "1"];
                                                                        objDBUtils.execute(insert_sql, insert_values, function(){
                                                                            var filters = [];
                                                                            filters.push(new Array("inspection_id = '" + objApp.keys.inspection_id + "'"));
                                                                            objDBUtils.loadRecords("inspectionitems", filters, function(param, items)
                                                                            {
                                                                                if(!items)
                                                                                {
                                                                                    // Handle no items
                                                                                }
                                                                                else
                                                                                {
                                                                                    self.defectsArray = [];
                                                                                    self.defectsObjects = {};
                                                                                    var maxLoop = items.rows.length;
                                                                                    for(var idx = 0; idx < maxLoop; idx++)
                                                                                    {
                                                                                        var r = items.rows.item(idx);
                                                                                        self.defectsArray.push(r);
                                                                                        self.defectsObjects[r.id] = r;
                                                                                    }
                                                                                    //self.showSignificantItems(self.stepBackFromSignList);
                                                                                    alert('New significant issue has been added successfully.');
                                                                                    $("#inspectionStep2 textarea#observation").val('');
                                                                                    $("#inspectionStep2 ul#popAction li:first-child").text('Choose');
                                                                                    // Clear all defect related keys
                                                                                    objApp.keys.inspection_item_id = "";
                                                                                    objApp.keys.observation = '';
                                                                                    objApp.keys.action = '';
                                                                                    // When adding a new defect, hide the delete defect button
                                                                                    $("#btnDeleteDefect").css("visibility", "hidden");

                                                                                    // Increment the sequence number
                                                                                    var seq_no = $("#frmDefectDetails #seq_no").val();
                                                                                    if(seq_no == "") {
                                                                                        seq_no = 1;
                                                                                    } else {
                                                                                        seq_no = seq_no * 1;
                                                                                        seq_no++;

                                                                                        $("#frmDefectDetails #seq_no").val(seq_no);
                                                                                    }

                                                                                    $("#frmDefectDetails #observation_suggestion tr td").unbind();
                                                                                    $("#frmDefectDetails #observation_suggestion").empty();
                                                                                }
                                                                            });
                                                                        });
                                                                    },
                                                                    {
                                                                        photo_id: new_id,
                                                                        defect_id: defect_id
                                                                    });
                                                            };
                                                            writer.write(imageData);
                                                        }, fail);
                                                    }, fail);
                                                };
                                                // Write the thumbnail data to the file.
                                                writer.write(thumbData);
                                            }, fail);
                                        }, fail);
                                    }, fail);
                                }
                            }, function(t){}, "", self.finalised);
                        }
                    }
                }

                if($this.hasClass('capture-significant-image')){
                    if(objApp.phonegapBuild)
                    {
                        navigator.camera.getPicture(function(imageData)
                            {
                                self.saveDefect(function(defect_id){
                                    if(typeof defect_id == 'undefined')
                                        return false;

                                    editPhoto3(imageData, defect_id);
                                });
                            }, function(message)
                            {
                                alert("Image load failed because: " + message);
                            },
                            {
                                quality: 50,
                                destinationType: Camera.DestinationType.DATA_URL
                            });
                    }
                }else if($this.hasClass('select-significant-image')){

                    if(objApp.phonegapBuild)
                    {
                        // Invoke the camera API to allow the user to take a photo
                        navigator.camera.getPicture(function(imageData)
                            {
                                self.saveDefect(function(defect_id){
                                    if(typeof defect_id == 'undefined')
                                        return false;

                                    editPhoto3(imageData, defect_id);
                                });

                            }, function(message)
                            {
                                alert("Image load failed because: " + message);
                            },
                            {
                                quality: 50,
                                destinationType: Camera.DestinationType.DATA_URL,
                                sourceType : Camera.PictureSourceType.PHOTOLIBRARY,
                                correctOrientation: true
                            });
                    }
                }

            });
        });

        $(".capture-significant-image-re, .select-significant-image-re").unbind(objApp.touchEvent);
        $(".capture-significant-image-re, .select-significant-image-re").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            if(objApp.empty(objApp.getKey("reinspection_id"))) {
                return;
            }
            var $this = $(this);

            // Get the current maximum photo sequence number for this reinspection item
            var sql = "SELECT MAX(seq_no) as seq_no " +
                "FROM reinspectionitemphotos " +
                "WHERE reinspection_id = ? " +
                "AND deleted = 0";
            objDBUtils.loadRecordSQL(sql, [objApp.getKey('reinspection_id')], function(row)
            {
                var seq_no = 1;  // Default sequence number to 1.
                if(row)
                {
                    seq_no = row.seq_no;

                    if((seq_no == null) || (seq_no == 0))
                    {
                        seq_no = 0;
                    }
                    seq_no += 1;
                }
                var editPhoto4 = function(photoData, defect_id)
                {
                    if(typeof defect_id == 'undefined' || defect_id == '' || defect_id == 0)
                        return false;

                    // Setup a new image object, using the photo data as the image source
                    objImage = new Image();

                    objImage.src = 'data:image/jpeg;base64,' + photoData;

                    //notes = "";

                    // When the image has loaded, setup the image marker object
                    objImage.onload = function()
                    {
                        // Resize the image so it's 600px wide
                        objResizer = new imageResizer(objImage);
                        var imageData = objResizer.resize(600);


                        // Create a thumbnail version of the image
                        objImage = new Image();
                        objImage.src = 'data:image/jpeg;base64,' + imageData;

                        objImage.onload = function()
                        {
                            objResizer = new imageResizer(objImage);
                            var thumbData = objResizer.resize(90);

                            // Save both the thumbnail and the full version to the local file system.
                            var fail = function(error)
                            {
                                alert("storePhotosOnFS::Caught error: " + error.code);
                            }

                            // Make sure the current inspection id is valid - there seems to be a bug sometimes when the id is corrupted
                            objDBUtils.loadRecord('reinspections', objApp.getKey('reinspection_id'), function(param, row)
                            {
                                if(!row)
                                {
                                    alert("The current reinspection id is NOT valid");
                                    return;
                                }
                                if(!self.isReportsWithQuestions())
                                    self.deleteSignificantItems(defect_id, objApp.getKey('reinspection_id'));
                                user_id = localStorage.getItem("user_id");
                                var new_id = objDBUtils.makeInsertKey(objApp.sync_prefix);
                                var notes = "";

                                // Save the image data and notes back to the database
                                var sql = "INSERT INTO reinspectionitemphotos(id, reinspection_id, seq_no, photodata_tmb, photodata, notes, created_by, dirty) " +
                                    "VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
                                var values = [new_id, objApp.getKey('reinspection_id'), seq_no, thumbData, imageData, notes, user_id, "1"];

                                objDBUtils.executeWithCBParam(sql, values, function(param)
                                {
                                    // After the photo was saved, saving record for significant items
                                    var insert_sql = "INSERT INTO significant_items(id, `type`, foreign_id, photo_id, created_by, dirty) " +
                                        "VALUES(?, ?, ?, ?, ?, ?)";
                                    var insert_values = [objDBUtils.makeInsertKey(objApp.sync_prefix), 'reinspectionitem', param.defect_id, param.photo_id, localStorage.getItem("user_id"), "1"];
                                    objDBUtils.execute(insert_sql, insert_values, function(){
                                        if(!objApp.empty(objApp.getKey("reinspection_id"))) {
                                            if(self.isReportsWithQuestions())
                                                self.loadReinspectionItems(objApp.getKey('reinspection_id'));
                                            else{
                                                // Load the reinspection items
                                                var sql = "SELECT ri.id, ii.seq_no, ii.location, ii.action, ii.observation, ri.rectified, r.failed " +
                                                    "FROM inspectionitems ii " +
                                                    "INNER JOIN reinspectionitems ri ON ri.inspectionitem_id = ii.id " +
                                                    "INNER JOIN reinspections r ON r.id = ri.reinspection_id " +
                                                    "WHERE ii.deleted = 0 " +
                                                    "AND r.id = ? " +
                                                    "ORDER BY ii.seq_no ASC";
                                                objDBUtils.loadRecordsSQL(sql, [objApp.keys.reinspection_id], function (param, items) {
                                                    if (!items) {
                                                        // Handle no items
                                                    }
                                                    else {
                                                        self.defectsReArray = [];
                                                        self.defectsReObjects = {};
                                                        var maxLoop = items.rows.length;
                                                        for (var idx = 0; idx < maxLoop; idx++) {
                                                            var r = items.rows.item(idx);
                                                            self.defectsReArray.push(r);
                                                            self.defectsReObjects[r.id] = r;
                                                        }
                                                    }
                                                }, "");
                                                alert('New significant image has been added successfully.');
                                            }
                                        }
                                    });
                                },
                                {
                                    photo_id: new_id,
                                    defect_id: defect_id
                                });
                            }, function(t){}, "", self.finalised);
                        }
                    }
                }

                var reinspectionItemID = $(self.reinspectionItemRow).attr("data-id").trim();

                if($this.hasClass('capture-significant-image-re')){
                    if(objApp.phonegapBuild)
                    {
                        navigator.camera.getPicture(function(imageData)
                            {
                                editPhoto4(imageData, reinspectionItemID);
                            }, function(message)
                            {
                                alert("Image load failed because: " + message);
                            },
                            {
                                quality: 50,
                                destinationType: Camera.DestinationType.DATA_URL
                            });
                    }
                }else if($this.hasClass('select-significant-image-re')){

                    if(objApp.phonegapBuild)
                    {
                        // Invoke the camera API to allow the user to take a photo
                        navigator.camera.getPicture(function(imageData)
                            {
                                editPhoto4(imageData, reinspectionItemID);
                            }, function(message)
                            {
                                alert("Image load failed because: " + message);
                            },
                            {
                                quality: 50,
                                destinationType: Camera.DestinationType.DATA_URL,
                                sourceType : Camera.PictureSourceType.PHOTOLIBRARY,
                                correctOrientation: true
                            });
                    }
                }

            });
        });

        $(".capture-question-image, .select-question-image").unbind(objApp.touchEvent);
        $(".capture-question-image, .select-question-image").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            if(self.finalised == 1) {
                alert("Sorry, this inspection has been finalised.  If you wish to add more issues, please un-finalise the inspection first");
                return;
            }

            var $this = $(this);

            if($this.hasClass('on-issue-form')){
                var location =	self.objPopLocation.getText();
                var action = self.objPopAction.getText();
                var observation =  $("#frmDefectDetails #observation").val();

                if((location == "") || (location.toUpperCase() == "CHOOSE") || (action == "") || (action.toUpperCase() == "CHOOSE")  || observation == "")
                {
                    alert('Please enter other fields before selecting the image.');
                    return;
                }
            }

            var question_id = $this.attr('data-id');
            self.current_table = "inspectionitemphotos";
            self.current_key = "inspection_id";

            if(!objApp.empty(objApp.getKey("reinspection_id"))) {
                self.current_table = "reinspectionitemphotos";
                self.current_key = "reinspection_id";
            }

            // Get the current maximum photo sequence number for this inspection item
            var sql = "SELECT MAX(seq_no) as seq_no " +
                "FROM " + self.current_table + " " +
                "WHERE " + self.current_key + " = ? " +
                "AND deleted = 0";
            objDBUtils.loadRecordSQL(sql, [objApp.getKey(self.current_key)], function(row)
            {
                var seq_no = 1;  // Default sequence number to 1.
                if(row)
                {
                    seq_no = row.seq_no;

                    if((seq_no == null) || (seq_no == 0))
                    {
                        seq_no = 0;
                    }
                    seq_no += 1;
                }
                var editPhoto5 = function(photoData, defect_id, $this)
                {
                    if(typeof defect_id == 'undefined' || defect_id == '' || defect_id == 0)
                        return false;

                    // Setup a new image object, using the photo data as the image source
                    objImage = new Image();

                    objImage.src = 'data:image/jpeg;base64,' + photoData;

                    //notes = "";

                    // When the image has loaded, setup the image marker object
                    objImage.onload = function()
                    {
                        // Resize the image so it's 600px wide
                        objResizer = new imageResizer(objImage);
                        var imageData = objResizer.resize(600);


                        // Create a thumbnail version of the image
                        objImage = new Image();
                        objImage.src = 'data:image/jpeg;base64,' + imageData;

                        objImage.onload = function()
                        {
                            objResizer = new imageResizer(objImage);
                            var thumbData = objResizer.resize(90);

                            // Save both the thumbnail and the full version to the local file system.
                            var fail = function(error)
                            {
                                alert("storePhotosOnFS::Caught error: " + error.code);
                            }

                            // Make sure the current inspection id is valid - there seems to be a bug sometimes when the id is corrupted

                            var check_table = "inspections";
                            if(self.current_table == "reinspectionitemphotos") {
                                check_table = "reinspections";
                            }

                            objDBUtils.loadRecord(check_table, objApp.getKey(self.current_key), function(param, row)
                            {
                                if(!row)
                                {
                                    alert("The current inspection id is NOT valid");
                                    return;
                                }
                                user_id = localStorage.getItem("user_id");
                                var new_id = objDBUtils.makeInsertKey(objApp.sync_prefix);
                                var notes = "";

                                // Save the image data and notes back to the database
                                var sql = "INSERT INTO " + self.current_table + "(id, " + self.current_key + ", seq_no, photodata_tmb, photodata, notes, created_by, dirty) " +
                                    "VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
                                var values = [new_id, objApp.getKey(self.current_key), seq_no, thumbData, imageData, notes, user_id, "1"];
                                objDBUtils.executeWithCBParam(sql, values, function(param)
                                    {
                                        // After the photo was saved, saving record for significant items
                                        var insert_sql = "INSERT INTO significant_items(id, `type`, foreign_id, photo_id, created_by, dirty) " +
                                            "VALUES(?, ?, ?, ?, ?, ?)";
                                        var insert_values = [objDBUtils.makeInsertKey(objApp.sync_prefix), self.current_table.replace('photos', ''), param.defect_id, param.photo_id, localStorage.getItem("user_id"), "1"];
                                        objDBUtils.execute(insert_sql, insert_values, function(){
                                            if($this.hasClass('on-issue-form')){
                                                alert('New issue has been added successfully.');
                                                $("#inspectionStep2 textarea#observation").val('');
                                                $("#inspectionStep2 ul#popAction li:first-child").text('Choose');
                                                // Clear all defect related keys
                                                objApp.keys.inspection_item_id = "";
                                                objApp.keys.observation = '';
                                                objApp.keys.action = '';

                                                // Increment the sequence number
                                                var seq_no2 = $("#frmDefectDetails #seq_no2").val();
                                                if(seq_no2 == "") {
                                                    seq_no2 = 1;
                                                } else {
                                                    seq_no2 = seq_no2 * 1;
                                                    seq_no2++;

                                                    $("#frmDefectDetails #seq_no2").val(seq_no2);
                                                }

                                                $("#frmDefectDetails #observation_suggestion tr td").unbind();
                                                $("#frmDefectDetails #observation_suggestion").empty();
                                            }else{
                                                self.loadQuestionItems();
                                            }
                                        });
                                    },
                                    {
                                        photo_id: new_id,
                                        defect_id: defect_id
                                    });
                            }, function(t){}, "", self.finalised);
                        }
                    }
                }

                if($this.hasClass('capture-question-image')){
                    if(objApp.phonegapBuild)
                    {
                        navigator.camera.getPicture(function(imageData)
                            {
                                if($this.hasClass('on-issue-form')){
                                    self.saveDefect(function(defect_id){
                                        if(typeof defect_id == 'undefined')
                                            return false;

                                        editPhoto5(imageData, defect_id, $this);
                                    });
                                }else{
                                    editPhoto5(imageData, question_id, $this);
                                }
                            }, function(message)
                            {
                                alert("Image load failed because: " + message);
                            },
                            {
                                quality: 50,
                                destinationType: Camera.DestinationType.DATA_URL
                            });
                    }
                }else if($this.hasClass('select-question-image')){

                    if(objApp.phonegapBuild)
                    {
                        // Invoke the camera API to allow the user to take a photo
                        navigator.camera.getPicture(function(imageData)
                            {
                                if($this.hasClass('on-issue-form')){
                                    self.saveDefect(function(defect_id){
                                        if(typeof defect_id == 'undefined')
                                            return false;

                                        editPhoto5(imageData, defect_id, $this);
                                    });
                                }else {
                                    editPhoto5(imageData, question_id, $this)
                                }
                            }, function(message)
                            {
                                alert("Image load failed because: " + message);
                            },
                            {
                                quality: 50,
                                destinationType: Camera.DestinationType.DATA_URL,
                                sourceType : Camera.PictureSourceType.PHOTOLIBRARY,
                                correctOrientation: true
                            });
                    }
                }

            });
        });
	}

    this.showReportPhotos = function()
    {
        objApp.clearMain();
        objApp.setSubHeading("Set Report Photos");
        $("#reportPhotos").removeClass("hidden");

        // Unbind events
        $("#btnReportPhotosBack").unbind();
        $("#tblReportPhotoListing input").unbind();

        // Load the inspection photos (if any)
        if(objApp.empty(objApp.getKey("inspection_id"))) {
            alert("showReportPhotos - Invalid inspection");
            return;
        }

        objDBUtils.orderBy = "seq_no ASC";

        var filters = [];
        filters.push(new Array("inspection_id = '" + objApp.getKey("inspection_id") + "'"));
        filters.push(new Array("deleted", 0));
        filters.push(new Array("id NOT IN(SELECT photo_id FROM significant_items WHERE type = 'inspectionitem')"));

        objDBUtils.loadRecords('inspectionitemphotos', filters, function(param, items)
        {
            if(!items)
            {
                $("#reportPhotoList").html("<p>Sorry, this inspection currently has no photos.</p>");
                return;
            }

            // Loop through the items, building the output list as we go.
            var maxLoop = items.rows.length;
            var r = 0;
            var num_items = 0;

            var html = '<table id="tblReportPhotoListing" class="listing">';

            /**
            * Shows the generated photo table listing HTML and also sets the table widths
            *
            * @param {String} html  The HTML to be used for the table listing
            */
            var showPhotoHTML = function(html) {
                // Finish the table HTML
                html += '</table>';
                
                // Kill iScroll if it already exists
                if(this.scroller) {
                    this.scroller.destroy();
                    this.scroller = null;
                }                

                // Inject the HTML
                $("#reportPhotoList").html(html);

                // Set the listing table widths
                var orientation = objApp.getOrientation();
                var screenWidth = screen.width;

                if(orientation == "landscape") {
                    screenWidth = screen.width > screen.height?screen.width:screen.height;
                }

                var tableWidth = screenWidth - 50;

                $("#reportPhotoList").css("width", tableWidth + 20 + "px");

                var tableHeader = $("#tblReportPhotos");
                var tableBody = $("#tblReportPhotoListing");
                $(tableHeader).css("table-layout", "fixed");
                $(tableBody).css("table-layout", "fixed");
                $(tableHeader).css("width", tableWidth + "px");
                $(tableBody).css("width", tableWidth + "px");

                tableWidth = tableWidth - 45;

                var average_width = Math.floor(tableWidth / 3);
                average_width = average_width - 22;  // Take into account 10px padding left and right, 10 + 10 = 20, plus 1px border left and right

                $(tableHeader).find("th:eq(0)").css("width", average_width + "px");
                $(tableHeader).find("th:eq(1)").css("width", average_width + "px");
                $(tableHeader).find("th:eq(2)").css("width", average_width + "px");

                $(tableBody).find("tr td:eq(0)").css("width", average_width + "px");
                $(tableBody).find("tr td:eq(1)").css("width", average_width + "px");
                $(tableBody).find("tr td:eq(2)").css("width", average_width + "px");

                if(objUtils.isMobileDevice()) {
                    self.scroller = new IScroll5('#reportPhotoList', { hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbar', tap: true});
                }
                

                // Handle the event when the user changes the cover photo selection
                $('#tblReportPhotoListing input[name="is_cover_photo"]').change(function() {
                    // Get the ID of the selected photo
                    var photo_id = $(this).val();

                    blockElement('body');

                    // Remove any existing is_cover_photo flags for this inspection
                    var sql = "UPDATE inspectionitemphotos " +
                        "SET is_cover_photo = 0, dirty = 1 " +
                        "WHERE inspection_id = ? " +
                        "AND deleted = 0";

                    objDBUtils.execute(sql, [objApp.getKey("inspection_id")], function() {
                        // Now set the new cover photo

                        sql = "UPDATE inspectionitemphotos " +
                            "SET is_cover_photo = 1, dirty = 1 " +
                            "WHERE id = ?";

                        objDBUtils.execute(sql, [photo_id], function() {
                            // All done


                            unblockElement('body');
                        });
                    });
                });

                // Handle the event when the user clicks on a photo to add it to the report
                $('#tblReportPhotoListing input[name="is_report_photo"]').change(function() {
                    // Get the ID of the selected photo
                    var photo_id = $(this).val();

                    if($(this).is(":checked")) {
                        // The user is wanting to add a photo to the report
                        // First make sure there's not too many photos selected already
                        var num_report_photos = $('#tblReportPhotoListing input[name="is_report_photo"]:checked').length;
                        if(num_report_photos > self.MAX_REPORT_PHOTOS) {
                            alert("Sorry, you may only select " + self.MAX_REPORT_PHOTOS + " photos to show on the report.  Please uncheck some other photos first.");
                            $(this).removeAttr("checked");
                            return;
                        }

                        // Add the photo selection
                        sql = "UPDATE inspectionitemphotos " +
                            "SET is_report_photo = 1, dirty = 1 " +
                            "WHERE id = ?";

                        blockElement('body');

                        objDBUtils.execute(sql, [photo_id], function() {
                            // All done
                            unblockElement('body');
                        });


                    } else {
                        // Remove the photo selection
                        sql = "UPDATE inspectionitemphotos " +
                            "SET is_report_photo = 0, dirty = 1 " +
                            "WHERE id = ?";

                        blockElement('body');

                        objDBUtils.execute(sql, [photo_id], function() {
                            // All done
                            unblockElement('body');
                        });  
                    }
                });
            }

            if(objApp.phonegapBuild)
            {
                var fail = function(error)
                {
                    alert("loadPhotos::Caught error: " + error.code);
                }

                // Request access to the file system
                window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
                {
                    // We have access to the file system.

                    // Define the function to load the next image for phonegap builds.
                    // The thumbnail image data is coming straight from the local file system
                    var doNext = function()
                    {
                        var row = items.rows.item(r);

                        if(row.photodata != "")
                        {
                            // Define the file name that the thumbnail should have
                            var file_name = row.id + "_thumb.jpg";
                            //var file_name = row.id;

                            // Get permission to access the file entry
                            fileSystem.root.getFile(file_name, {create: true}, function(fileEntry)
                            {
                                // Get access to the file object
                                fileEntry.file(function(file)
                                {
                                    // Create a file reader and read the file data.
                                    var reader = new FileReader();

                                    // When we've finished loading the file,
                                    // build the HTML string and move to the next item
                                    reader.onloadend = function(evt)
                                    {
                                        html += '<tr>';
                                        html += '<td><img width="150" height="100" src="data:image/jpeg;base64,' + (evt.target && evt.target.result?evt.target.result:row.photodata_tmb) + '" /></td>';
                                        html += '<td><input type="radio" name="is_cover_photo" value="' + row.id + '" ';

                                        if(row.is_cover_photo == 1) {
                                            html += 'checked="checked"' ;
                                        }

                                        html += ' /></td>';
                                        html += '<td><input type="checkbox" name="is_report_photo" value="' + row.id + '" ';

                                        if(row.is_report_photo == 1) {
                                            html += 'checked="checked"' ;
                                        }

                                        html += ' /></td>';
                                        html += '</tr>';

                                        num_items++;

                                        r++;

                                        if(r < maxLoop)
                                        {
                                            doNext();
                                        }
                                        else
                                        {
                                            showPhotoHTML(html);
                                        }
                                    };

                                    reader.readAsText(file);
                                }, fail);


                            }, fail);
                        }
                        else
                        {
                            r++;

                            if(r < maxLoop)
                            {
                                doNext();
                            }
                            else
                            {
                                showPhotoHTML(html);
                            }
                        }
                    }

                    if(r < maxLoop)
                    {
                        doNext();
                    }
                    else
                    {
                        showPhotoHTML(html);
                    }

                }, fail);
            }

            if(r < maxLoop)
            {
                if (typeof doNext == 'function')
                    doNext();
            }
            else
            {
                showPhotoHTML(html);
            }

        }, "");


        $("#btnReportPhotosBack").bind(objApp.touchEvent, function(e) {
            e.preventDefault();

            self.showStep3();
        });

    }

    this.showSignificantItems = function(currentStep)
    {
        self.stepBackFromSignList = currentStep;
        objApp.clearMain();
        objApp.setSubHeading("Significant Failed Items");
        $("#significantItems").removeClass("hidden");

        // Unbind events
        $("#btnSignificantItemsBack").unbind();
        $("#btnSignificantItemsBack").bind(objApp.touchEvent, function(e) {
            e.preventDefault();
            if(self.stepBackFromSignList == 0){
                self.loadReinspectionItems(objApp.keys.reinspection_id);
            }else if(self.stepBackFromSignList == 2)
                self.showStep2();
            else
                self.showStep3();
        });

        // Load the inspection photos (if any)
        if(objApp.empty(objApp.keys.inspection_id)) {
            alert("showSignificantItems - Invalid inspection");
            return;
        }

        objDBUtils.orderBy = "seq_no ASC";

        if(!objApp.empty(objApp.getKey("reinspection_id"))) {
            var current_table = "reinspectionitemphotos";
            var current_key = "reinspection_id";
            if(self.defectsReArray.length == 0){
                $("#significantItemsList").html("<p>Sorry, this reinspection currently has no significant items.</p>");
                return;
            }
            $("#significantItemsList").addClass('on-reinspection-page');
            var sql = "SELECT rip.*, si.foreign_id as defect_id " +
                "FROM reinspectionitemphotos rip " +
                "INNER JOIN significant_items si ON si.photo_id = rip.id AND si.deleted = 0 " +
                "INNER JOIN reinspectionitems rii ON rii.id = si.foreign_id " +
                "INNER JOIN inspectionitems ii ON ii.id = rii.inspectionitem_id " +
                "WHERE rip.deleted = ? " +
                "AND rip.reinspection_id = ? " +
                "ORDER BY ii.seq_no ASC";
        } else {
            var current_table = "inspectionitemphotos";
            var current_key = "inspection_id";
            if(self.defectsArray.length == 0){
                $("#significantItemsList").html("<p>Sorry, this inspection currently has no significant items.</p>");
                return;
            }
            $("#significantItemsList").removeClass('on-reinspection-page');
            var sql = "SELECT ip.*, si.foreign_id as defect_id " +
                "FROM inspectionitemphotos ip " +
                "INNER JOIN significant_items si ON si.photo_id = ip.id AND si.deleted = 0 " +
                "INNER JOIN inspectionitems ii ON ii.id = si.foreign_id " +
                "WHERE ip.deleted = ? " +
                "AND ip.inspection_id = ? " +
                "ORDER BY ii.seq_no ASC";
        }

        objDBUtils.loadRecordsSQL(sql, [0, objApp.getKey(current_key)], function (param, items) {
            if(!items){
                if(!objApp.empty(objApp.getKey("reinspection_id")))
                    $("#significantItemsList").html("<p>Sorry, this reinspection currently has no significant items.</p>");
                else
                    $("#significantItemsList").html("<p>Sorry, this inspection currently has no significant items.</p>");
                return;
            }

            // Loop through the items, building the output list as we go.
            var maxLoop = items?items.rows.length:0;
            var r = 0;
            var num_items = 0;

            var html = '<table id="tblSignificantItemsListing" class="listing">';

            /**
             * Shows the generated photo table listing HTML and also sets the table widths
             *
             * @param {String} html  The HTML to be used for the table listing
             */
            var showSignificantItemsHTML = function(html) {
                // Finish the table HTML
                html += '</table>';

                // Kill iScroll if it already exists
                if(this.scroller) {
                    this.scroller.destroy();
                    this.scroller = null;
                }

                // Inject the HTML
                $("#significantItemsList").html(html);

                // Set the listing table widths
                var orientation = objApp.getOrientation();
                var screenWidth = screen.width;

                if(orientation == "landscape") {
                    screenWidth = screen.width > screen.height?screen.width:screen.height;
                }

                var tableWidth = screenWidth - 50;

                var tableHeader = $("#tblSignificantItems");
                var tableBody = $("#tblSignificantItemsListing");
                $(tableHeader).css("table-layout", "fixed");
                $(tableBody).css("table-layout", "fixed");
                $(tableHeader).css("width", tableWidth + "px");
                $(tableBody).css("width", tableWidth + "px");

                var firstColWidth = 100;
                tableWidth = tableWidth - 45 - firstColWidth;

                var average_width = Math.floor(tableWidth / 3);
                average_width = average_width - 22;  // Take into account 10px padding left and right, 10 + 10 = 20, plus 1px border left and right

                $(tableHeader).find("th:eq(0)").css("width", firstColWidth + "px");
                $(tableHeader).find("th:eq(1)").css("width", average_width + "px");
                $(tableHeader).find("th:eq(2)").css("width", average_width + "px");
                $(tableHeader).find("th:eq(3)").css("width", average_width + "px");

                $(tableBody).find("tr td:eq(0)").css("width", firstColWidth + "px");
                $(tableBody).find("tr td:eq(1)").css("width", average_width + "px");
                $(tableBody).find("tr td:eq(2)").css("width", average_width + "px");
                $(tableBody).find("tr td:eq(3)").css("width", average_width + "px");

                if(objUtils.isMobileDevice()) {
                    self.scroller = new IScroll5('#significantItemsList', { hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbar', tap: true});
                }

                $(".delete-significant-item").unbind(objApp.touchEvent);
                $(".delete-significant-item").bind(objApp.touchEvent, function(e)
                {
                    e.preventDefault();
                    if(confirm("Are you sure that you want to delete this failed item?"))
                    {
                        var photo_id = $(this).attr('rel');
                        if (photo_id == "")
                            return;

                        if(!objApp.empty(objApp.getKey("reinspection_id"))) {
                            self.current_table = "reinspectionitemphotos";
                            self.current_key = "reinspection_id";
                        } else {
                            self.current_table = "inspectionitemphotos";
                            self.current_key = "inspection_id";
                        }

                        // Flag all related photo records as deleted.
                        var sql = "UPDATE " + self.current_table + " " +
                            "SET deleted = 1, dirty = 1 " +
                            "WHERE id = ?";

                        objDBUtils.execute(sql, [photo_id], function()
                        {
                            objDBUtils.loadRecordSQL("SELECT si.* FROM significant_items si WHERE si.photo_id = ?", [photo_id], function(row)
                            {
                                if(!row)
                                    return;

                                /* BUGS can be there when we delete the significant items of reinspection item */
                                if(row.foreign_id){
                                    // Now delete the inspection item record itself
                                    objDBUtils.deleteRecord(self.current_table.replace('photo',''), row.foreign_id, function()
                                    {
                                        // Final step is to update the inspection record with the correct stats.
                                        // Get the number of defects associated with this inspection
                                        var sql = "SELECT COUNT(*) as num_defects " +
                                            "FROM inspectionitems " +
                                            "WHERE inspection_id = ? AND deleted = 0";

                                        objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(row)
                                        {
                                            if(row)
                                            {
                                                // Now update the parent inspection record with the defect count.
                                                var num_defects = row.num_defects;

                                                sql = "UPDATE inspections " +
                                                    "SET num_defects = ?, dirty = 1 " +
                                                    "WHERE id = ?";

                                                objDBUtils.execute(sql, [num_defects, objApp.keys.inspection_id], function(){});
                                            }
                                        });
                                    });
                                }
                                objDBUtils.deleteRecord('significant_items', [row.id], function(){});
                            });
                            self.showSignificantItems(self.stepBackFromSignList);
                        });
                    }
                });
            }

            if(objApp.phonegapBuild )
            {
                var fail = function(error)
                {
                    alert("loadPhotos::Caught error: " + error.code);
                };
                // Request access to the file system
                window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
                {
                    // We have access to the file system.

                    // Define the function to load the next image for phonegap builds.
                    // The thumbnail image data is coming straight from the local file system

                    var showed_item_ids = [];

                    var doNextSig = function()
                    {
                        var row = items.rows.item(r);

                        if(row.photodata_tmb != "" && showed_item_ids.indexOf(row.id) == -1)
                        {
                            showed_item_ids.push(row.id);
                            if(row.photodata_tmb.indexOf('_thumb') == -1){
                                var sourceArray = self.defectsObjects;
                                if(!objApp.empty(objApp.getKey("reinspection_id")))
                                    sourceArray = self.defectsReObjects;
                                html += '<tr>';
                                html += '<td><a href="#" rel="'+row.id+'" class="delete-significant-item">Delele</a>#' + sourceArray[row.defect_id].seq_no + '</td>';
                                html += '<td>' + sourceArray[row.defect_id].location +'</td>';
                                html += '<td>' + sourceArray[row.defect_id].observation +'</td>';
                                html += '<td><img width="150" height="100" src="data:image/jpeg;base64,' + row.photodata_tmb + '" /></td>';
                                html += '</tr>';
                                num_items++;
                                r++;
                                if(r < maxLoop)
                                    doNextSig();
                                else
                                    showSignificantItemsHTML(html);
                            }else{
                                // Define the file name that the thumbnail should have
                                var file_name = row.id + "_thumb.jpg";
                                //var file_name = row.id;

                                // Get permission to access the file entry
                                fileSystem.root.getFile(file_name, {create: true}, function(fileEntry)
                                {
                                    // Get access to the file object
                                    fileEntry.file(function(file)
                                    {
                                        // Create a file reader and read the file data.
                                        var reader = new FileReader();

                                        // When we've finished loading the file,
                                        // build the HTML string and move to the next item
                                        reader.onloadend = function(evt)
                                        {
                                            var sourceArray = self.defectsObjects;
                                            if(!objApp.empty(objApp.getKey("reinspection_id")))
                                                sourceArray = self.defectsReObjects;
                                            html += '<tr>';
                                            html += '<td><a href="#" rel="'+row.id+'" class="delete-significant-item">Delele</a>#' + sourceArray[row.defect_id].seq_no + '</td>';
                                            html += '<td>' + sourceArray[row.defect_id].location +'</td>';
                                            html += '<td>' + sourceArray[row.defect_id].observation +'</td>';
                                            html += '<td><img width="150" height="100" src="data:image/jpeg;base64,' + (evt.target && evt.target.result?evt.target.result:row.photodata_tmb) + '" /></td>';
                                            html += '</tr>';
                                            num_items++;
                                            r++;
                                            if(r < maxLoop)
                                                doNextSig();
                                            else
                                                showSignificantItemsHTML(html);
                                        };
                                        reader.readAsText(file);
                                    }, fail);
                                }, fail);
                            }
                        }
                        else
                        {
                            r++;
                            if(r < maxLoop)
                                doNextSig();
                            else
                                showSignificantItemsHTML(html);
                        }
                    }
                    if(r < maxLoop)
                        doNextSig();
                    else
                        showSignificantItemsHTML(html);
                }, fail);
            }

            if(r < maxLoop)
            {
                if (typeof doNextSig == 'function')
                    doNextSig();
            }
            else
                showSignificantItemsHTML(html);
        }, "");
    }


    this.updateExtraSubHeader = function()
	{
	    /* Do not use it anymore */
	    return;
        var text = '';
        var lot = $('#frmInspectionDetails #lot_no').val();
        var address = $('#frmInspectionDetails #address').val();
        var suburb = $('#frmInspectionDetails #suburb').val();
        // var postcode = $('#frmInspectionDetails #postcode').val();
        // var state = self.objPopState.getText();
        text = 'LOT ' + lot + ', ' +address + ', ' + suburb;
        // alert(text);
		objApp.setExtraHeading(text, true);
	}

	this.deleteLocation = function(ID)
	{
		objDBUtils.deleteRecord("resources", ID, function()
		{
			self.objPopLocation.removeOption(ID);
		});
	}

    this.deleteAction = function(ID)
    {
        objDBUtils.deleteRecord("resources", ID, function()
        {
            self.objPopAction.removeOption(ID);
        });
    }

    this.deleteIssue = function(ID)
    {
        objDBUtils.deleteRecord("resources", ID, function()
        {
            self.objPopIssue.removeOption(ID);
        });
    }

    this.deleteDetail = function(ID)
    {
        objDBUtils.deleteRecord("resources", ID, function()
        {
            self.objPopDetail.removeOption(ID);
        });
    }
    this.setObservationFilters = function(){
        objDBUtils.orderBy = "";
        self.observation = $('#frmDefectDetails textarea#observation').val().trim();
        $("#frmDefectDetails #observation_suggestion").empty();

        if(self.observation == '') {
            return false;
            $("#observationFS").hide();
        }

        $("#observationFS").show();

        self.filters = [];
        //filters.push(new Array("limit", 4));
        self.filters.push(new Array("resource_type = 3"));
        self.filters.push(new Array("name LIKE '%" + objDBUtils.doubleApos(self.observation) + "%'"));
        self.filters.push(new Array("limit", 20));
    }

	/***
	* initDefectForm
	* This method shows the defect form in the right sidebar and then
	* resets the popSelectors and loads their values as appropriate.
	* If an existing defect is being shown, the defect values are preselected.
	*/
	this.initDefectForm = function(inspectionItem, resetLocation, addNewQuestionIssue)
	{
	    if (typeof(resetLocation)=='undefined') resetLocation = true;
        if (typeof(addNewQuestionIssue)=='undefined') addNewQuestionIssue = false;

		self.lastKeyPress = null;
		self.doingSave = false;
        self.isAddingSignificantItem = 0;

		// Unbind key events
		$("#btnCapturePhoto").unbind();

		var user_id = localStorage.getItem("user_id");

           // Setup defect pop selectors
        if(self.objPopLocation == null)
        {
            // The pop selectors have not been initialised yet.
            self.objPopLocation = new popselector("#frmDefectDetails #popLocation", "Please select a location");
            self.objPopLocation.callbackMethod = objApp.objInspection.handleLocationChanged;
            self.objPopLocation.addNewMethod = self.addNewLocation;
            self.objPopLocation.deleteCallback = self.deleteLocation;
        }

        if(self.objPopAction == null)
        {
            // The pop selectors have not been initialised yet.
            self.objPopAction = new popselector("#frmDefectDetails #popAction", "Please select an action");
            self.objPopAction.callbackMethod = objApp.objInspection.handleActionChanged;
            self.objPopAction.addNewMethod = self.addNewAction;
            self.objPopAction.deleteCallback = self.deleteAction;
        }

		// If an inspection item has been passed through, set the item details from it, otherwise initialise to blank.
		var currentLocation = self.objPopLocation.getValue();

		if(inspectionItem == null || addNewQuestionIssue)
		{
			$("#frmDefectDetails #observation").val("");
            self.objPopLocation.clear("", "Choose");
			$("#frmDefectDetails #created_by").val(user_id);
            $("#frmDefectDetails #itemtype").val("0");
            $("#frmDefectDetails #numrepeats").val("0");

            if(addNewQuestionIssue && inspectionItem){
                $("#frmDefectDetails #seq_no").val(inspectionItem.seq_no);
                $('#frmDefectDetails input[name="notes"]').val(inspectionItem.notes);

                // Get the next inspectionitems sub-sequence number for this audit
                var sql = "SELECT MAX(seq_no2) as seq_no2 " +
                    "FROM inspectionitems " +
                    "WHERE inspection_id = ? and question = ? AND deleted = 0";

                objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id, inspectionItem.question], function(row)
                {
                    var seq_no2 = 1;
                    if((row) && (row.seq_no2 != null))
                    {
                        seq_no2 = row.seq_no2 + 1;
                    }
                    // Set the sequence number into the form.
                    $("#frmDefectDetails #seq_no2").val(seq_no2);
                });
            }else{
                // Get the next inspectionitems sequence number for this audit
                var sql = "SELECT MAX(seq_no) as seq_no " +
                    "FROM inspectionitems " +
                    "WHERE inspection_id = ? AND deleted = 0";

                objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(row)
                {
                    var seq_no = 1;

                    if((row) && (row.seq_no != null))
                    {
                        seq_no = row.seq_no + 1;
                    }

                    // Set the sequence number into the form.
                    $("#frmDefectDetails #seq_no").val(seq_no);
                });
            }
		}
		else
		{
			// Set observation text
            $("#frmDefectDetails #observation").val(inspectionItem.observation);

            // Preselect location pop selector
            objApp.keys.action = inspectionItem.action;
            objApp.keys.location = inspectionItem.location;

            //self.touchScroll(document.querySelector("#frmDefectDetails #notes"));
			$("#frmDefectDetails #created_by").val(inspectionItem.created_by);
			$("#frmDefectDetails #seq_no").val(inspectionItem.seq_no);
            $("#frmDefectDetails #seq_no2").val(inspectionItem.seq_no2?inspectionItem.seq_no2:1);
            $('#frmDefectDetails input[name="notes"]').val(inspectionItem.notes);

			$("#photoWrapper").removeClass("hidden");

            $("#frmDefectDetails #itemtype").val(inspectionItem.itemtype);
            $("#frmDefectDetails #numrepeats").val(inspectionItem.numrepeats);
		}

        if($("#frmDefectDetails #itemtype").val() == "1") {
            $("a.itemtype").addClass("acknowledgement");
        } else {
            $("a.itemtype").removeClass("acknowledgement");
        }

		$("#frmDefectDetails #observation_suggestion").empty();
        $("#observationFS").hide();


		// Clear any existing pop filter options.
		self.objPopLocation.removePopOptions(0, "", "Choose");
		self.objPopAction.removePopOptions(0, "", "Choose");

		// Load available levels into the pop selector
		objDBUtils.primaryKey = "id";
		objDBUtils.showColumn = "name";
		objDBUtils.orderBy = "name ASC";

		var filters = [];
		filters.push(new Array("resource_type = 1"));

		objDBUtils.loadSelect("resources", filters, "#frmDefectDetails #popLocation", function()
		{
		    if (!resetLocation)
		    {
                self.objPopLocation.preselect(currentLocation);
		    }
		    else
		    {
    			if(objApp.keys.location != "")
    			{
    				self.objPopLocation.preselectByText(objApp.keys.location);
    			}
    			else
    			{
    				self.objPopLocation.clear("", "Choose");
    			}
		    }
		});


        var filters = [];
		filters.push(new Array("resource_type = 2"));

		objDBUtils.loadSelect("resources", filters, "#frmDefectDetails #popAction", function()
		{
			if(objApp.keys.action != "")
			{
				self.objPopAction.preselectByText(objApp.keys.action);
			}
			else
			{
				self.objPopAction.clear("", "Choose");
			}
		});

        objDBUtils.orderBy = "";

		// If the ipad has scrolled to show the notes field,
		// make sure we scroll back down after the user has finished typing.
        
        // Unbind the search observation key event.
        $("#frmDefectDetails #observation").unbind();
        $('#frmDefectDetails #observation').bind('keyup', function(e)
        {
            setTimeout(function() {
                if(e.which=='32'){ // if user pressed "space" button
                    self.setObservationFilters();
                    self.searchObservations();
                }
            }, 350);
        });

		self.setReadOnly();
	}
    
    // Unbind the search observation touch event.
    $("#searchObservation").unbind();
    $("#searchObservation").bind(objApp.touchEvent, function(e) {
       self.setObservationFilters();
       self.searchObservations();
    });
    
	this.searchObservations = function(){
	    if (typeof self.filters == 'undefined')
	        return;
        // Remove any previously bound events.
        $("#frmDefectDetails #observation_suggestion tr td").unbind();
        
        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }        
        
        objDBUtils.loadSelect("resources", self.filters, "#frmDefectDetails #observation_suggestion", function()
        {
            // Bind the click event after search
            $("#frmDefectDetails #observation_suggestion tr td").bind(objApp.touchEvent, function() {
                var selectedTxt = $(this).text();
                $('#frmDefectDetails #observation').val(selectedTxt);
                console.log("Different Binding");
            });            
            
            if(objUtils.isMobileDevice()) {
                self.scroller = new IScroll('observationWrapper', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbar'});
            }
        }, 'td');
    }

    this.deleteSignificantItem = function(sig_id, reinspection_id)
    {
        if(typeof reinspection_id == 'undefined'){
            var sql = "SELECT inspectionitemphotos.* FROM inspectionitemphotos " +
                "INNER JOIN significant_items ON significant_items.photo_id = inspectionitemphotos.id " +
                "WHERE significant_items.id = ?";
            objDBUtils.loadRecordSQL(sql, [sig_id], function(row)
            {
                if(row)
                {
                    // Now update the parent inspection record with the defect count.
                    var num_defects = row.num_defects;

                    sql = "UPDATE inspectionitemphotos " +
                        "SET deleted = 1, dirty = 1 " +
                        "WHERE id = ?";

                    objDBUtils.execute(sql, [row.id], function(){});
                }
            });
        }else{
            var sql = "SELECT reinspectionitemphotos.* FROM reinspectionitemphotos " +
                "INNER JOIN significant_items ON significant_items.photo_id = reinspectionitemphotos.id " +
                "WHERE significant_items.id = ?";
            objDBUtils.loadRecordSQL(sql, [sig_id], function(row)
            {
                if(row)
                {
                    // Now update the parent inspection record with the defect count.
                    var num_defects = row.num_defects;

                    sql = "UPDATE reinspectionitemphotos " +
                        "SET deleted = 1, dirty = 1 " +
                        "WHERE id = ?";

                    objDBUtils.execute(sql, [row.id], function(){});
                }
            });
        }


        var sql = "UPDATE significant_items " +
            "SET deleted = 1, dirty = 1 " +
            "WHERE id = ?";
        objDBUtils.execute(sql, [sig_id], function(){});
    }

	/***
	* Delete the specified inspection item (defect)
	* We need to delete all related inspection item photos, and then the inspection item itself
	*/
	this.deleteSignificantItems = function(foreign_id, reinspection_id)
    {
        // Flag all related photo records as deleted.
        if(typeof reinspection_id == 'undefined'){
            var sql = "SELECT inspectionitemphotos.* FROM inspectionitemphotos " +
                "INNER JOIN significant_items ON significant_items.photo_id = inspectionitemphotos.id " +
                "WHERE significant_items.foreign_id = ?";
            objDBUtils.loadRecordSQL(sql, [foreign_id], function(row)
            {
                if(row)
                {
                    sql = "UPDATE inspectionitemphotos " +
                        "SET deleted = 1, dirty = 1 " +
                        "WHERE id = ?";

                    objDBUtils.execute(sql, [row.id], function(){});
                }
            });
        }else{
            var sql = "SELECT reinspectionitemphotos.* FROM reinspectionitemphotos " +
                "INNER JOIN significant_items ON significant_items.photo_id = reinspectionitemphotos.id " +
                "WHERE significant_items.foreign_id = ?";
            objDBUtils.loadRecordSQL(sql, [foreign_id], function(row)
            {
                if(row)
                {
                    sql = "UPDATE reinspectionitemphotos " +
                        "SET deleted = 1, dirty = 1 " +
                        "WHERE id = ?";

                    objDBUtils.execute(sql, [row.id], function(){});
                }
            });
        }

        var sql = "UPDATE significant_items " +
            "SET deleted = 1, dirty = 1 " +
            "WHERE foreign_id = ?";
        objDBUtils.execute(sql, [foreign_id], function(){});
    }

	this.deleteDefect = function(item_id, question)
	{
        self.deleteSignificantItems(item_id);

        // Now delete the inspection item record itself
        objDBUtils.deleteRecord("inspectionitems", item_id, function()
        {

            if(self.isReportsWithQuestions()){
                objDBUtils.loadRecord("inspectionitems", item_id, function(item_id, item)
                {
                    if(!item)
                        return;
                    self.sortQuestionIssues(item.inspection_id, item.question);
                }, item_id);
            }

            // Final step is to update the inspection record with the correct stats.
            // Get the number of defects associated with this inspection
            var sql = "SELECT COUNT(*) as num_defects " +
                "FROM inspectionitems " +
                "WHERE inspection_id = ? AND deleted = 0";

            objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(row)
            {
                if(row)
                {
                    // Now update the parent inspection record with the defect count.
                    var num_defects = row.num_defects;

                    sql = "UPDATE inspections " +
                        "SET num_defects = ?, dirty = 1 " +
                        "WHERE id = ?";

                    objDBUtils.execute(sql, [num_defects, objApp.keys.inspection_id], function()
                    {
                        // Hide the delete button
                        $("#btnDeleteDefect").css("visibility", "hidden");

                        // Reload the inspection items listing
                        self.loadInspectionItems();

                        // Hide the defect panel
                        $("#defect").addClass("hidden");

                    });
                }
            });
        });

        // two time doing arrow down functionality to update wrong tag ID's
        self.handleMoveInspectionItem(item_id, 'down');
        self.handleMoveInspectionItem(item_id, 'down');
	}

    /***
	* Delete the specified image item (defect)
	* We need to delete the photo
	*/
	this.deleteImage = function(item_id)
	{
        if (item_id == "")
            return;

		// Flag all related photo records as deleted.
		var sql = "UPDATE " + self.current_table + " " +
			"SET deleted = 1, dirty = 1 " +
			"WHERE id = ?";

		objDBUtils.execute(sql, [item_id], function()
		{
			// Reload the inspection photos listing
            self.loadPhotos();
		});
	}

    this.deleteQuestionImage = function(item_id)
    {
        if (item_id == "")
            return;

        // Flag all related photo records as deleted.
        var sql = "UPDATE inspectionitemphotos " +
            "SET deleted = 1, dirty = 1 " +
            "WHERE id = ?";

        objDBUtils.execute(sql, [item_id], function()
        {
            // Reload the inspection photos listing
            self.loadQuestionItems();
        });
    }

	this.doDelayedSave = function()
	{
		var now = new Date();

		var diff = now - self.lastKeyPress;

		if(diff < 1500)
		{
			setTimeout('objApp.objInspection.doDelayedSave()', 100);
		}
		else
		{
			if(!self.doingSave)
			{
				self.doingSave = true;
                self.handleIssueChanged();
			}
		}
	}

    /**
    * Loads the inspection (or reinspection) photos
    * and shows the popup window allowing the user to take more photos.
    */
	this.loadPhotos = function()
	{
        if(objApp.getKey("inspection_id") == "" && objApp.getKey("reinspection_id") == "")
		{
			$("#photoWrapper #photoList").html("<p>This item has no photos.</p>");
			return;
		}

        if(!objApp.empty(objApp.getKey("reinspection_id"))) {
            self.current_table = "reinspectionitemphotos";
            self.current_key = "reinspection_id";
        } else {
            self.current_table = "inspectionitemphotos";
            self.current_key = "inspection_id";
        }

		objDBUtils.orderBy = "seq_no ASC";

		var filters = [];
		filters.push(new Array(self.current_key + " = '" + objApp.getKey(self.current_key) + "'"));
        filters.push(new Array("deleted", 0));
        filters.push(new Array("id NOT IN(SELECT photo_id FROM significant_items WHERE type = '"+self.current_table.replace('photos','')+"')"));

		objDBUtils.loadRecords(self.current_table, filters, function(param, items)
		{
			if(!items)
			{
                $("#photoWrapper #photoList").html("<p>This item has no photos.</p>");
				return;
			}

			// Loop through the items, building the output list as we go.
			var maxLoop = items.rows.length;
            self.numImgCurr = maxLoop;
            $(".inspectionDetails #btnCapturePhoto .numImgCurr").text(self.numImgCurr);
			var r = 0;
			var num_items = 0;

			var html = '<ul class="gallery">';

			if(objApp.phonegapBuild)
			{
				var fail = function(error)
				{
					alert("loadPhotos::Caught error: " + error.code);
				}

				// Request access to the file system
				window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
				{
					// We have access to the file system.

					// Define the function to load the next image for phonegap builds.
					// The thumbnail image data is coming straight from the local file system
					var doNext = function()
					{
						var row = items.rows.item(r);

						if(row.photodata_tmb != "")
						{
							// Define the file name that the thumbnail should have
							var file_name = row.id + "_thumb.jpg";

							// Get permission to access the file entry
							fileSystem.root.getFile(file_name, {create: true}, function(fileEntry)
							{
								// Get access to the file object
							    fileEntry.file(function(file)
							    {
							    	// Create a file reader and read the file data.
							    	var reader = new FileReader();

							    	// When we've finished loading the file,
							    	// build the HTML string and move to the next item
									reader.onloadend = function(evt)
									{
                                        var delete_node = '<div class="deletePhoto" data-id="' + row.id + '"></div>';
                                        if(self.finalised == 1) {
                                            delete_node = "";
                                        }

				    					html += '<li>' + delete_node + '<a rel="' + row.id + '"><img width="90" height="60" src="data:image/jpeg;base64,' + (evt.target && evt.target.result?evt.target.result:row.photodata_tmb) + '" /></a><div class="imageNotes">' + row.notes + '</div></li>';
						    			num_items++;

										r++;

										if(r < maxLoop)
										{
											doNext();
										}
										else
										{
											self.showPhotos(num_items, html);
										}
									};

									reader.readAsText(file);
							    }, fail);


							}, fail);
						}
						else
						{

							r++;

							if(r < maxLoop)
							{
								doNext();
							}
							else
							{
								self.showPhotos(num_items, html);
							}
						}
					}

					if(r < maxLoop)
					{
						doNext();
					}
					else
					{
						self.showPhotos(num_items, html);
					}

				}, fail);
			}

		}, "");
	}

	this.showPhotos = function(num_items, html)
	{
		html += "</ul>";

		html += '<div style="clear:both;"></div>';

		// If matching items were found, inject them into the page, otherwise show the no history message.
		if(num_items == 0)
		{
			$("#photoWrapper #photoList").html("<p>This item has no photos.</p>");
		}
		else
		{
			$("#photoWrapper #photoList").html(html);

			// Setup touchScroll if applicable
			if(objUtils.isMobileDevice())
			{
				//var scroller = new TouchScroll(document.querySelector("#photoWrapper #photoList"));
                var scroller = new IScroll5('#photoList', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbarSm'});
			}

			$("#photoWrapper #photoList a").unbind();

			var editPhoto = function(photoID, photoData, notes)
			{
				// Setup a new image object, using the photo data as the image source
				objImage = new Image();

				objImage.src = 'data:image/jpeg;base64,' + photoData;

				//notes = "";

				// When the image has loaded, setup the image marker object
				objImage.onload = function()
				{
 					// Resize the image so it's 600px wide
					objResizer = new imageResizer(objImage);
					var imageData = objResizer.resize(600);

					objImage = new Image();
					objImage.src = 'data:image/jpeg;base64,' + imageData;
					//notes = "";

					objImage.onload = function()
					{
 						objImageMarker = new imageMarker(objImage, "Edit Image", notes, function(imageMarkerResult)
 						{
 							// Handle the save event
 							var imageData = imageMarkerResult.imageData;
 							var notes = imageMarkerResult.notes;

 							// Create a thumbnail version of the image
							objImage = new Image();
							objImage.src = 'data:image/jpeg;base64,' + imageData;

							objImage.onload = function()
							{
								objResizer = new imageResizer(objImage);
								var thumbData = objResizer.resize(90);

								if(objApp.phonegapBuild)
								{
									// Save both the thumbnail and the full version to the local file system.
									var fail = function(error)
									{
										alert("storePhotosOnFS::Caught error: " + error.code);
									}

									// Request access to the file system
									window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
									{
										var file_name = photoID + "_thumb.jpg";

										// Get permission to write the file
										fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
										{
											// Create the file write object
											fileEntry.createWriter(function(writer)
											{
												writer.onwriteend = function(evt)
												{
													// Get the file URI for the thumbnail image
													var uri_thumb = fileEntry.toURI();

													// Now write the full image to the file system
													var file_name = photoID + ".jpg";

													fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
													{
														// Create the file write object
														fileEntry.createWriter(function(writer)
														{
															writer.onwriteend = function(evt)
															{
																// Get the file URI for the thumbnail image
																var uri = fileEntry.toURI();

																// Save the image data and notes back to the database
																var sql = "UPDATE  " + self.current_table + " " +
																	"SET photodata = ?, photodata_tmb = ?, notes = ?, dirty = 1 " +
																	"WHERE id = ?";

																objDBUtils.execute(sql, [uri, uri_thumb, notes, photoID], function()
																{
																	self.loadPhotos();
																});
															};

															writer.write(imageData);

														}, fail);

													}, fail);

												};

												// Write the thumbnail data to the file.
												writer.write(thumbData);

											}, fail);

										}, fail);

									}, fail);
								}
							}
 						}, self.deleteImage, photoID, false);

 						objImageMarker.show();
					}
				}
			}


			$("#photoWrapper #photoList a").bind(objApp.touchEvent, function(e)
			{
				e.preventDefault();

				// Get the id of the selected photo
				var photoID = $(this).attr("rel");

				objDBUtils.loadRecord(self.current_table, photoID, function(photoID, row)
				{
					if(!row)
					{
						alert("Sorry, the photo record could not be loaded");
						return;
					}

					// If the fullsize version of the photo is not on the device, bring it down.
					if((row.photodata == null) || (row.photodata == ""))
					{
						if(confirm("The full size version of this photo is not on this device.  Would you like to download it now via the Internet?"))
						{
							var params = objApp.objSync.getLoginParams();
							if(!params)
							{
								alert("Sorry, this request could not be completed");
							}

							blockElement('body');

							// Create the request URL
							var url = objApp.apiURL + "inspections/get_inspection_photo/" + photoID;
                            params['version'] = objApp.version;
                            $.post(url, params, function(data)
							{
								unblockElement('body');

								if(data.status == "OK")
								{
									if(data.photo != "")
									{
										if(objApp.phonegapBuild)
										{
											// We have received the photo data
											// Save the photo to the file system
											var fail = function(error)
											{
												alert("storePhotosOnFS::Caught error: " + error.code);
											}

											window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
											{
												var file_name = photoID + ".jpg";

												// Get permission to write the file
												fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
												{
													// Create the file write object
													fileEntry.createWriter(function(writer)
													{
												        writer.onwriteend = function(evt)
												        {
												        	// Get the path to the file
												        	if (is_on_simulator)
                                                                var uri = fileEntry.fullPath;
                                                            else
                            								    var uri = fileEntry.toURI();

												        	// Update the database with the path

															// We have received the photo data
															// Update the relevant record with the raw photodata.
															var sql = "UPDATE " + self.current_table + " " +
																"SET photodata = ? " +
																"WHERE id = ?";

															objDBUtils.execute(sql, [uri, photoID], function()
															{
																// Photo was downloaded and saved locally OK
																editPhoto(photoID, data.photo, row.notes);
															});
														}

														// Write the photo data to the file.
                                                        if (is_on_simulator) {
                                                            writer.write(new Blob([data.photo]));
                                                        } else {
                                                            writer.write(data.photo);
                                                        }

													}, fail);

												}, fail);

											}, fail);

										}
									}
								}
							}, "json");
						}
					}
					else
					{
						// Photo data already present
						if(objApp.phonegapBuild)
						{
							// Load the photo data from the file system
							objUtils.readFile(row.id + ".jpg", function(success, photoData)
							{
								if(success)
								{
									editPhoto(photoID, photoData, row.notes);
								}
							});
						}
					}

				}, photoID);
			});

            $("#photoWrapper .deletePhoto").bind(objApp.touchEvent, function(e)
			{
				e.preventDefault();

                if(!confirm("Are you sure you want to delete this image?  Once the issue has been deleted you cannot recover it."))
    			{
    				return false;
    			}

                var photoID = $(this).attr("data-id");

    			self.deleteImage(photoID);
            });
		}
        var itemsArr = [];
        $( ".gallery" ).sortable({
          update: function( event, ui ) {
          itemsArr = [];
            $( ".gallery > li" ).each(function(){
                var id = ($(this).find('a').attr('rel'));
                itemsArr.push(id);
            });
            var sql = 'SELECT * FROM ' + self.current_table + ' WHERE ' + self.current_key + ' = ? ORDER BY seq_no';
            objDBUtils.loadRecordsSQL(sql, [objApp.getKey(self.current_key)], function(param, items)
            {
                if(!items)
                {
                    alert("The current inspection id is NOT valid");
                    return;
                }
                else
                {
                    var maxLength = items.rows.length;
                    for (var r = 0; r < maxLength; r++)
                    {
                        var item = items.rows.item(r);
                        sql = "UPDATE " + self.current_table + " " +
                              "SET seq_no = ? " +
                              "WHERE id = ? ";
                        objDBUtils.execute(sql, [(r+1),itemsArr[r]], null);
                    }
                }
            }, "");
          }
        });

        $( ".gallery" ).disableSelection();

	}

	/***
	* Loads all inspection items that match the passed level, area, issue and detail
	* and are older than the current inspection and shows them in a list so the user can see
	* the history for the particular defect item.
	*/
	this.loadHistory = function(level, area, issue, detail)
	{
        // Always hide the history section to start with
        if(!$(".inspectionDetails .historySection").hasClass("hidden"))
        {
            $(".inspectionDetails .historySection").addClass("hidden");
        }

		// Make sure all values are present
		if((objUtils.isEmpty(level)) || (objUtils.isEmpty(area)) || (objUtils.isEmpty(issue)) || (objUtils.isEmpty(detail)))
		{
			return;
		}
        
        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }        

        $("#historyModal #historyList").html('');
        $('#history_im_notes').html('');

		// Calculate the time threshold
		var objDate = objApp.userDateStrToDate($("#inspection #inspection_date").val());
        if(objDate == null)
        {
            return;
        }

		var timeThreshold = objDate.getTime();

		// Calculate the MD5 hash for this defect.
		var hash = objUtils.MD5(level.toUpperCase() + area.toUpperCase() + issue.toUpperCase() + detail.toUpperCase());

		// Load the history items
		var sql = "SELECT i.inspection_date, ii.* " +
				"FROM inspectionitems ii " +
				"INNER JOIN inspections i ON ii.inspection_id = i.id AND i.deleted = 0 AND ii.inspection_id <> ? " +
				"WHERE ii.deleted = 0 " +
                "AND ii.itemtype = 0 " +
				"AND i.inspection_start < ? " +
				"AND ii.hash = ? " +
                "AND i.site_id = ? " +
				"ORDER BY i.inspection_date DESC LIMIT 5";

        var site_id = this.objPopSites.getValue();

		objDBUtils.loadRecordsSQL(sql, [objApp.keys.inspection_id, timeThreshold, hash, site_id], function(param, items)
		{
			if(!items)
			{
				// There were no items that match.
				$("#historyModal #historyList").html("Sorry, no history is available.");
                $("#numrepeats").val("0");
			}
			else
			{
                $(".inspectionDetails .historySection").removeClass("hidden");
				// Loop through the items, building the output list as we go.
				var maxLoop = items.rows.length;
                $("#numrepeats").val(maxLoop);

				var r = 0;
				var num_items = 0;
                var max_note = 250;

				var html = "<ul>";

				for(r = 0; r < maxLoop; r++)
				{
				    var row = items.rows.item(r);
				    if(row.notes != "")
				    {
                        var notes = row.notes;
                        if(notes.length > max_note) {
                            notes = notes.substring(0, max_note) + "...";
                        }

				    	html += '<li><strong>' + objApp.formatUserDate(objApp.isoDateStrToDate(row.inspection_date)) + '</strong> &ndash; ' + notes
                                + '<div id="history_'+row.id+'"></div>'
                                + '</li>';
				    }
                    else
                    {
                        html += '<li><strong>' + objApp.formatUserDate(objApp.isoDateStrToDate(row.inspection_date))
                                + '</strong><div id="history_'+row.id+'"></div>'
                                + '</li>';
                    }
                    num_items++;
				}

				html += "</ul>";

				// If matching items were found, inject them into the page, otherwise show the no history message.
				if(num_items == 0)
				{
					$("#historyModal #historyList").html("Sorry, no history is available.");
				}
				else
				{
					$("#historyModal #historyList").html(html);

                    var modalWidth = $("#historyModal").width();
                    $("#historyModal #historyList").css("width", "60%");

                    if (maxLoop > 1) {
                        $(".historySection #issueTimes").html(maxLoop.toString() + " times");
                    }
                    else {
                        $(".historySection #issueTimes").html("1 time");
                    }

                    for(r = 0; r < maxLoop; r++)
				    {
				        var row = items.rows.item(r);
				        self.loadHistoryPhotos(row.id);
                    }

				    // Setup touchScroll if applicable
					if(objUtils.isMobileDevice()) {
					    self.scroller = new IScroll('#historyList', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbar'});
					}
				}

			}


		}, "");
	}

    // When the user clicks on an inspection that has reinspections,  we show a modal
    // window so the user can select which inspection they wish to view.
    this.loadHistoryReinspectionItems = function(inspection_id)
    {
        // Set the correct inspectionID into the keys object
        objApp.keys.inspection_id = inspection_id;
        
        // Clear the modal window HTML
        $("#inspectionList #historyReinspection table tbody").html("");

        $("#historyReinspection a.action").unbind();

        var tbody = "";

        // Step 1 - we should always load the original inspection and show that first in the list
        var sql = "SELECT i.* " +
            "FROM inspections i " +
            "WHERE i.id = ?";

        objDBUtils.loadRecordSQL(sql, [inspection_id], function(row) {
            if(!row) {
                alert("Couldn't load inspection record");
                return;
            }

            tbody += '<tr>';
            tbody += '<td>' + objApp.formatUserDate(objApp.isoDateStrToDate(row.inspection_date)) + '</td>';
            tbody += '<td>Original Inspection</td>';
            tbody += '<td>Failed</td>';    // Original inspection ALWAYS fails

            tbody += '<td><div class="action"><a href="#" class="action view original" data-id="' + row.id + '">View</a></div></td>';
            tbody += '</tr>';

            // Step 2 - Also load any reinspections in sequence order
            sql = "SELECT ri.* " +
                "FROM reinspections ri " +
                "WHERE ri.inspection_id = ? AND deleted = 0 " +
                "ORDER BY ri.reinspection_date ASC";

            objDBUtils.loadRecordsSQL(sql, [inspection_id], function(param, items) {
                if(items) {
                    var maxLoop = items.rows.length;

                    var r = 0;

                    for(r = 0; r < maxLoop; r++)
                    {
                        var row = items.rows.item(r);
                        tbody += '<tr>';
                        tbody += '<td>' + objApp.formatUserDate(objApp.isoDateStrToDate(row.reinspection_date)) + '</td>';
                        tbody += '<td>Reinspection</td>';

                        if(row.failed == 1) {
                            tbody += '<td>Failed</td>';
                        } else {
                            tbody += '<td>Passed</td>';
                        }

                        tbody += '<td><div class="action"><a href="#" class="action view reinspection" data-id="' + row.id + '">View</a></div></td>';
                        tbody += '</tr>';
                    }
                }

                $("#inspectionList #historyReinspection table tbody").html(tbody);

                // Bind click even
                $("#historyReinspection a.action").bind(objApp.touchEvent, function(e) {

                    e.preventDefault();
                    
                    // inspection / reinspection id
                    var id = $(this).attr('data-id');

                    // Close the reveal window
                    //$('#historyReinspection a.close-reveal-modal').click();
                    $('#historyReinspection').trigger('reveal:close');

                    revealWindow.hideModal();  // Note the revealWindow variable is defined in jquery.reveal.js - I added this in.

                    // If it's a reinspection, show the reinspection screen, otherwise show the editInspection screen.
                    if($(this).hasClass("reinspection")) {
                        objApp.keys.reinspection_id = id;
                        self.setReturnReinspectionID(id);

                        // Load the reinspection record
                        objDBUtils.loadRecord("reinspections", id, function(param, reinspection) {
                            if(!reinspection) {
                                alert("Couldn't load the reinspection record!");
                                return;
                            }

                            objApp.keys.inspection_id = reinspection.inspection_id;
                            self.reinspectionNotes = reinspection.notes;

                            self.loadReinspectionItems(id);
                        }, "");

                    } else {
                        objApp.keys.reinspection_id = '';
                        self.setReturnReinspectionID('');

                        // Load the inspection record
                        objDBUtils.loadRecord("inspections", id, function(param, inspection) {
                            if(!inspection) {
                                alert("Couldn't load the inspection record!");
                                return;
                            }
                            self.editInspection(inspection);
                        }, "");
                    }
                });


            }, "")
        });
    }

    this.loadHistoryPhotos = function(inspectitem_id)
    {
        objDBUtils.orderBy = "seq_no ASC";
		var filters = [];
		filters.push(new Array("inspectionitem_id = '" + inspectitem_id + "'"));

		objDBUtils.loadRecords('inspectionitemphotos', filters, function(param, items)
		{
			if((!items) || (items === undefined))
			{
				$("#history_" + inspectitem_id).html("<p>There are currently no photos for this item.</p>");
			}

			// Loop through the items, building the output list as we go.
			var maxLoop = items.rows.length;
			var r = 0;
			var num_items = 0;

			var html = '<ul class="historygallery">';

			if(objApp.phonegapBuild)
			{
				var fail = function(error)
				{
					alert("loadHistoryPhotos::Caught error: " + error.code);
				}

				// Request access to the file system
				window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
				{
					// We have access to the file system.

					// Define the function to load the next image for phonegap builds.
					// The thumbnail image data is coming straight from the local file system
					var doNext = function()
					{
						var row = items.rows.item(r);

						if(row.photodata_tmb != "")
						{
							// Define the file name that the thumbnail should have
							var file_name = row.id + "_thumb.jpg";

							// Get permission to access the file entry
							fileSystem.root.getFile(file_name, {create: true}, function(fileEntry)
							{
								// Get access to the file object
							    fileEntry.file(function(file)
							    {
							    	// Create a file reader and read the file data.
							    	var reader = new FileReader();

							    	// When we've finished loading the file,
							    	// build the HTML string and move to the next item
									reader.onloadend = function(evt)
									{
				    					html += '<li><a rel="' + row.id + '"><img width="90" height="60" src="data:image/jpeg;base64,' + (evt.target && evt.target.result?evt.target.result:row.photodata_tmb) + '" /></a></li>';
						    			num_items++;

										r++;

										if(r < maxLoop)
										{
											doNext();
										}
										else
										{
											self.showHistoryPhotos(num_items, html, inspectitem_id);
										}
									};

									reader.readAsText(file);
							    }, fail);


							}, fail);
						}
						else
						{

							r++;

							if(r < maxLoop)
							{
								doNext();
							}
							else
							{
								self.showHistoryPhotos(num_items, html, inspectitem_id);
							}
						}
					}

					if(r < maxLoop)
					{
						doNext();
					}
					else
					{
						self.showHistoryPhotos(num_items, html, inspectitem_id);
					}

				}, fail);
			}

			if(r < maxLoop)
			{
				doNext();
			}
			else
			{
				self.showHistoryPhotos(num_items, html, inspectitem_id);
			}

		}, "");
    }

    this.showHistoryPhotos = function(num_items, html, inspectitem_id)
    {
        html += "</ul>";

		html += '<div style="clear:both;"></div>';
		// If matching items were found, inject them into the page, otherwise show the no history message.
		if(num_items == 0)
		{
            $("#history_" + inspectitem_id).html("<p>There are currently no photos for this item.</p>");
		}
		else
		{
            $("#history_" + inspectitem_id).html(html);

			// Setup touchScroll if applicable
			if(objUtils.isMobileDevice())
			{
				//var scroller = new TouchScroll(document.querySelector("#photoWrapper #photoList"));
                var scroller = new IScroll('#photoList', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbarSm'});
			}

			$("#historyList a").unbind();

            var loadHistoryPhoto = function(photoID, photoData, notes)
            {
                // Setup a new image object, using the photo data as the image source
				objImage = new Image();

				objImage.src = 'data:image/jpeg;base64,' + photoData;

				// When the image has loaded, setup the image marker object
				objImage.onload = function()
				{
 					// Resize the image so it's 300px wide
					objResizer = new imageResizer(objImage);
					var imageData = objResizer.resize(300);

					objImage = new Image();
					objImage.src = 'data:image/jpeg;base64,' + imageData;

					objImage.onload = function()
					{
					    var canvasWidth = 300;
                		var canvasHeight = objImage.height;

                		if(objImage.width < canvasWidth)
                		{
              			  canvasWidth = objImage.width;
                		}

                        $('#history_im_Canvas').attr('height',canvasHeight);
                        $('#history_im_Canvas').attr('width',canvasWidth);

					    // Setup the canvas and context
                		var canvas = document.getElementById("history_im_Canvas");
                		var context = canvas.getContext("2d");

                        // Draw the image into the canvas
                        context.drawImage(objImage, 0, 0);

                        $('#history_im_notes').html(notes);
					}
				}
            }

			$("#historyList a").bind(objApp.touchEvent, function(e)
			{
				e.preventDefault();

				// Get the id of the selected photo
				var photoID = $(this).attr("rel");

				objDBUtils.loadRecord("inspectionitemphotos", photoID, function(photoID, row)
				{
					if(!row)
					{
						alert("Sorry, the photo record could not be loaded");
						return;
					}

					// If the fullsize version of the photo is not on the device, bring it down.
					if((row.photodata == null) || (row.photodata == ""))
					{
						var params = objApp.objSync.getLoginParams();
						if(!params)
						{
							alert("Sorry, this request could not be completed");
						}

						blockElement('body');

						// Create the request URL
						var url = objApp.apiURL + "inspections/get_inspection_photo/" + photoID;
                        params['version'] = objApp.version;
                        $.post(url, params, function(data)
						{
							unblockElement('body');

							if(data.status == "OK")
							{
								if(data.photo != "")
								{
									if(objApp.phonegapBuild)
									{
										// We have received the photo data
										// Save the photo to the file system
										var fail = function(error)
										{
											alert("storePhotosOnFS::Caught error: " + error.code);
										}

										window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem)
										{
											var file_name = photoID + ".jpg";

											// Get permission to write the file
											fileSystem.root.getFile(file_name, {create: true, exclusive: false}, function(fileEntry)
											{
												// Create the file write object
												fileEntry.createWriter(function(writer)
												{
											        writer.onwriteend = function(evt)
											        {
											        	// Get the path to the file
											        	var uri = fileEntry.toURI();

											        	// Update the database with the path

														// We have received the photo data
														// Update the relevant record with the raw photodata.
														var sql = "UPDATE inspectionitemphotos " +
															"SET photodata = ? " +
															"WHERE id = ?";

														objDBUtils.execute(sql, [uri, photoID], function()
														{
															// Photo was downloaded and saved locally OK
															loadHistoryPhoto(photoID, data.photo, row.notes);
														});
													}

													// Write the photo data to the file.
													writer.write(data.photo);

												}, fail);

											}, fail);

										}, fail);

									}
								}
							}
						}, "json");
					}
					else
					{
						// Photo data already present
						if(objApp.phonegapBuild)
						{
							// Load the photo data from the file system
							objUtils.readFile(row.id + ".jpg", function(success, photoData)
							{
								if(success)
								{
									loadHistoryPhoto(photoID, photoData, row.notes);
								}
							});
						}
					}

				}, photoID);
			});
		}
    }

	/***
	* saveDefect
	* The saveDefect method validates the defect form and then either creates a new
	* defect or updates an exisiting one for the current inspection.  It also updates the
	* num_defects count against the inspection record.
	*/
	this.saveDefect = function(callback)
	{
        // Make sure we have valid values for all defect pop lists
		var location =	self.objPopLocation.getText();
		var action = self.objPopAction.getText();
		var observation =  $("#frmDefectDetails #observation").val();

   		if((location == "") || (location.toUpperCase() == "CHOOSE") || observation == "")
   		{
			$("#inspectionStep2 textarea#observation").val('');
            $("#inspectionStep2 ul#popAction li:first-child").text('Choose');

            if((callback != undefined) && (callback != "")) {
                callback()
            }
			return;
   		}
   		else
   		{
			$("#frmDefectDetails #location").val(location);
   		}

        if((action == "") || (action.toUpperCase() == "CHOOSE"))
        {
            $("#inspectionStep2 textarea#observation").val('');
            $("#inspectionStep2 ul#popAction li:first-child").text('Choose');

            if((callback != undefined) && (callback != "")) {
                callback()
            }

            return;
        }
        else
        {
            $("#frmDefectDetails #action").val(action);
        }

        $("#frmDefectDetails #question").val(objApp.keys.question);

   		// Set the current inspection id into the form.
   		$("#frmDefectDetails #inspection_id").val(objApp.keys.inspection_id);

   		// Generate the MD5 hash of the location, action
   		var hash = objUtils.MD5(location.toUpperCase() + action.toUpperCase());
   		$("#frmDefectDetails #hash").val(hash);

   		// Invoke autosave
		$("#frmDefectDetails input").blur();


        var sql = "SELECT * " +
            "FROM inspectionitems " +
            "WHERE inspection_id = ? AND location = ? AND observation = ? AND action = ? AND deleted = 0";

        objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id, location, observation, action], function(row)
        {
            if(row)
            {
                console.log(row);
                console.log('This inspection item has been added');
                self.inAudit = true;

                if(self.restricted == 0)
                {
                    // Show the delete defect button
                    $("#btnDeleteDefect").css("visibility", "visible");
                }

                $("#photoWrapper").removeClass("hidden");

                if((callback != undefined) && (callback != "")) {
                    callback(row.id)
                }
            }
            else
            {
                blockElement('body');
                objDBUtils.autoSave("inspectionitems", objApp.getKey("inspection_item_id"), "frmDefectDetails", function(new_id)
                {
                    unblockElement('body');

                    // If the id was not set and we just did an update, get the id
                    if(objApp.getKey("inspection_item_id") == "")
                    {
                        objApp.keys.inspection_item_id = new_id;
                    }

                    self.inAudit = true;

                    if(self.restricted == 0)
                    {
                        // Show the delete defect button
                        $("#btnDeleteDefect").css("visibility", "visible");
                    }

                    $("#photoWrapper").removeClass("hidden");

                    self.addNewObservationSuggession();

                    if((callback != undefined) && (callback != "")) {
                        callback(new_id)
                    }
                });
            }
        });
	}

	/***
	* handleLocationChanged is fired when the user selects a level
	* from the level pop selector.
	*/
	this.handleLocationChanged = function()
	{
		self.checkAllSelected();
	}

    /***
	* handleLocationChanged is fired when the user selects a level
	* from the level pop selector.
	*/
	this.handleActionChanged = function()
	{
		self.checkAllSelected();
	}

	/***
	* Handle the event when the user has selected an issue
	*/
	this.handleIssueChanged = function()
	{
		self.checkAllSelected();
	}

	/***
	* Handle the event when the user has selected a detail item
	*/
	this.handleDetailChanged = function()
	{
		self.checkAllSelected();
	}

	/***
	* Check if all required pop selectors have a valid value.  If they do,
	* create / save the defect item.
	*/
	this.checkAllSelected = function()
	{
        // Are there selected values for ALL pop lists?
        if((self.objPopLocation.getValue() != "")  && (self.objPopAction.getValue() != ""))
        {
            // Yes there are - create the defect item.
            if(self.isAddingSignificantItem == 0)
                self.saveDefect();
        }
	}

    this.checkSaveRectifiedInspectionitem = function(rectified_status)
    {
        if(objApp.empty(rectified_status)) {
            alert("checkSaveRectifiedInspectionitem - Invalid rectified status");
            return;
        }

        blockElement('body');

        // Step 1 - Load the reinspection item
        var reinspectionItemID = $(self.reinspectionItemRow).attr("data-id").trim();

        objDBUtils.loadRecord("reinspectionitems", reinspectionItemID, function(rectified_status, reinspectionItem) {
            if(!reinspectionItem) {
                alert("checkSaveRectifiedInspectionitem - couldn't load reinspection item");
                return false;
            }

            // Step 2 - Update the reinspection item with the new status
            sql = "UPDATE reinspectionitems " +
                "SET rectified = ?, dirty = 1 " +
                "WHERE id = ?";

            objDBUtils.execute(sql, [rectified_status, reinspectionItemID], function() {

                // Step 3 - Update the inspectionitem that the reinspection was based upon
                sql = "UPDATE inspectionitems " +
                    "SET rectified = ?, dirty = 1 " +
                    "WHERE id = ?";

                objDBUtils.execute(sql, [rectified_status, reinspectionItem.inspectionitem_id], function() {
                    // Step 3 - Update the inspectionitem that the reinspection was based upon
                    unblockElement('body');

                    // Update the table row with the modified text
                    $(self.reinspectionItemRow).find("td:eq(4)").text(rectified_status);
                });
            });

        }, rectified_status);

    }

    this.checkSaveRateInspection = function()
    {
        self.doingSave = true;

        blockElement('body');

        // Invoke the autoSave method after a short delay.
	    setTimeout(function()
	    {
			objDBUtils.autoSave("inspections", objApp.keys.inspection_id, "frmRateDetails", function()
			{
			    self.doingSave = false;
                unblockElement('body');

                // If the id was not set and we just did an update, get the id
			    if(objApp.keys.inspection_id == "")
			    {
			        objDBUtils.setKeyFromLastInsertID("inspection_id");
			    }

                // If we have an active inspection then show the coversheet notes button
                if(self.finalised == 0) {
                    $("div.btnEditNotes").show();
                } else {
                    $("div.btnEditNotes").hide();

                }

			    self.setReturnInspectionID(objApp.keys.inspection_id);
			});
	    }, 250);
    }

	this.checkSaveReinspection = function(inspection_id, reinspection_date,failed)
    {
        var sql = "SELECT * FROM reinspections WHERE inspection_id = ? AND reinspection_date = ? AND inspection_type = 'Reinspection'";
        var values = [];
        objDBUtils.loadRecordsSQL(sql, [inspection_id, reinspection_date], function(param, items){
            if(!items)
            {
                var primaryKey = objDBUtils.makeInsertKey(objApp.sync_prefix);
                sql = "INSERT INTO " +
                      "reinspections(id, inspection_id, reinspection_date, failed, inspection_type) " +
                      "VALUES(?,?,?,?,?)";
                values = [primaryKey, inspection_id, reinspection_date, failed, "Reinspection"];
                objDBUtils.execute(sql, values, function(){
                    self.reinspectionKey = primaryKey;
                });
            }
            else
            {
                self.reinspectionKey = items.rows.item(0).id;
            }
        }, "");
    }

    this.checkUpdateInspection = function()
    {
        // Invoke the autoSave method after a short delay.
        $("#reinspection input#failed").removeClass("ignore");
        // $("#reinspection input#finalised").removeClass("ignore");
        $("#reinspection select#rectified").addClass("ignore");

	    setTimeout(function()
	    {
			objDBUtils.autoSave("inspections", objApp.keys.inspection_id, "frmReinspection", function()
			{
			    // If the id was not set and we just did an update, get the id
			    if(objApp.keys.inspection_id == "")
			    {
			        objDBUtils.setKeyFromLastInsertID("inspection_id");
			        // objDBUtils.setKeyFromLastInsertID("report_type");
			    }

                // If we have an active inspection then show the coversheet notes button
                if(self.finalised == 0) {
                    $("div.btnEditNotes").show();
                    $("a.btnEditClientNotes").show();
                    $("a.btnEditPrivateNotes").show();
                } else {
                    $("div.btnEditNotes").hide();
                    $("a.btnEditClientNotes").hide();
                    $("a.btnEditPrivateNotes").hide();
                }

			    self.setReturnInspectionID(objApp.keys.inspection_id);
                $('#btnCapturePhoto').attr('data-reveal-id', 'photoWrapper');

			    // unblockElement('body');
                $("#reinspection input#failed").addClass("ignore");
                $("#reinspection input#finalised").addClass("ignore");
                $("#reinspection select#rectified").removeClass("ignore");

			});
	    }, 250);
    }

	/***
	* checkSaveInspection
	* The checkSaveInspection method is invoked when the user changes something on the inspection
	* details form.  It checks if enough information has been provided and if so, adds/updates the
	* inspection.
	*/
	this.checkSaveInspection = function(blockBody, callback_func)
	{
	    if (typeof blockBody == 'undefined')
            blockBody = 1;
	    // Validate the form
	    if(!$("#frmInspectionDetails").validate().form())
	    {
	        return;
	    }

	    // Make sure both the client and site pop selectors are also set
	    if((self.objPopBuilders.val() == ""))
	    {
			return;
	    }

        if(self.doingSave) {
            return false;
        }

        self.doingSave = true;

	    // Determine if this is a new inspection or not.
	    var newInspection = true;

	    if(objApp.keys.inspection_id != "")
	    {
	    	// There is already an inspection_id defined.
	    	// This is not a new inspection.
			newInspection = false;
	    }


		// Get the inspection date as a date object
		var inspection_date = $("#frmInspectionDetails #inspection_date").val();

        // If the inspection date is NOT in ISO format we need to convert it
        if((inspection_date.length != 10) || (inspection_date.substring(4, 5) != "-"))
        {
		    var objDate = objApp.userDateStrToDate(inspection_date);

		    // Get the date as a timestamp.
		    var inspection_start = objDate.getTime();

		    // Set the timestamp into the hidden form var so it's saved later.
		    $("#frmInspectionDetails #inspection_start").val(inspection_start);

		    // Convert AU date format date back to ISO before saving
		    var result = objDate.getFullYear() + "-";
		    if((objDate.getMonth() + 1) < 10) result += "0";
		    result += (objDate.getMonth() + 1) + "-";
		    if(objDate.getDate() < 10) result += "0";
		    result += objDate.getDate();

		    // Save the visit_date back to the form
		    $("#frmInspectionDetails #inspection_date").val(result);
        }

	    // Ready to save
	    $("#frmInspectionDetails input").blur();

        if (blockBody)
	        blockElement("body");

	    // Invoke the autoSave method after a short delay.
	    setTimeout(function()
	    {
			objDBUtils.autoSave("inspections", objApp.keys.inspection_id, "frmInspectionDetails", function()
			{
			    // If the id was not set and we just did an update, get the id
			    if(objApp.keys.inspection_id == "")
			    {
			        objDBUtils.setKeyFromLastInsertID("inspection_id");
			        // objDBUtils.setKeyFromLastInsertID("report_type");
			    }

                // Load the inspection object
                objDBUtils.loadRecord("inspections", objApp.keys.inspection_id, function(inspection_id, inspection) {
                    if(!inspection) {
                        return;
                    }

                    // Set the inspection object.
                    self.inspection = inspection;

                    // Set the report type
                    objApp.keys.report_type = inspection.report_type;

                    // If we have an active inspection then show the coversheet notes button
                    if(inspection.finalised == 0) {
                        $("div.btnEditNotes").show();
                        $("a.btnEditClientNotes").show();
                        $("a.btnEditPrivateNotes").show();
                    } else {
                        $("div.btnEditNotes").hide();
                        $("a.btnEditClientNotes").hide();
                        $("a.btnEditPrivateNotes").hide();
                    }

                    // Show the next button
                    $(".inspectionDetails #btnStep1Next").show();

                    // Show the camera button
                    $('a[id="btnCapturePhoto"]').show();
                    self.checkIfNeedPhotos();

			        self.setReturnInspectionID(objApp.keys.inspection_id);
                    $('#btnCapturePhoto').attr('data-reveal-id', 'photoWrapper');

			        unblockElement("body");

			        // Show the toggle objects
			        $("#toggles").removeClass("hidden");

			        self.checkCanDelete();

                    self.doingSave = false;

                    if(typeof callback_func == "function"){
                        callback_func();
                    }
                });

			});
	    }, 250);
	}

    /***
    * Sets the listing table column widths (headers and cells)
    * as required.
    */
    this.setTableWidths2 = function(tblHeader, tblBody, column, width)
    {
        // Setup table column widths
        var orientation = objApp.getOrientation();
        if(width === undefined)
        {
            var screenWidth = screen.width;
        }
        else
        {
            var screenWidth = width;
        }

        if(orientation == "landscape") {
            screenWidth = screen.width > screen.height?screen.width:screen.height;
        }

        var tableWidth = screenWidth - 50;
        var tableHeader = $("#" + tblHeader);
        var tableBody = $("#" + tblBody);

        $(tableHeader).css("width", tableWidth + "px");
        $(tableBody).css("width", tableWidth + "px");

        $(tableHeader).css("table-layout", "fixed");
        $(tableBody).css("table-layout", "fixed");
        var normal_col_width = Math.floor(tableWidth / column);
        // var last_col_width = tableWidth - (column - 1) * normal_col_width;
        for(var i = 0; i < column; i++)
        {
            if((tblHeader === "tblReinspectionHeader") && (tblBody === "tblReinspectionListing"))
            {
                $(tableHeader).find("th:eq("+i+")").css("width", 25 + "%");
                $(tableBody).find("tr td:eq("+i+")").css("width", 25 + "%");

            }
            else
            {
                if((tblHeader != "tblRateListingHeader") && (tblBody != "tblRateListing"))
                {
                    if(i == 0)
                    {
                        //$(tableHeader).find("th:eq("+i+")").css("width", 30 + "px");
                        $(tableBody).find("tr td:eq("+i+")").css("width", 30 + "px");
                    }
                }
                else
                {
                    $(tableHeader).find("th:eq("+i+")").css("width", normal_col_width + "px");
                    $(tableBody).find("tr td:eq("+i+")").css("width", normal_col_width + "px");
                }
            }
        }
    }

    this.loadQuestionItems = function()
    {
        $('#btnStep3AddAnotherIssue').addClass('hidden');
        $('.btnSignificantItems').addClass('hidden');
        // Ensure a valid inspection id is set
        if(objApp.keys.inspection_id == "")
        {
            return;
        }
        locations = {};
        actions = {};
        this.keySortArray = {};
        var listDeleteMode = true;

        $("#tblDefectListingHeader th").eq(1).text('Item');
        $("#tblDefectListingHeader th").eq(2).text('Question');
        $("#tblDefectListingHeader th").eq(3).text('Photo');
        $("#tblDefectListingHeader th").eq(4).text('Answer');

        // Unbind any more button events
        $("#defectScrollWrapper").unbind();
        $("#tblDefectListing td").unbind();
        $("#tblDefectListing a.edit_issue_btn").unbind();

        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }

        var filter_string = '';
        var keyword = $('#keywords').val();
        if (keyword != '')
        {
            filter_string = " AND (ii.location LIKE '%"+keyword+"%' OR ii.observation LIKE '%"+keyword+"%' OR ii.action LIKE '%"+keyword+"%' OR ii.notes LIKE '%"+keyword+"%' OR ii.question LIKE '%"+keyword+"%') ";
        }

        var sql = "SELECT ii.*, iip.photodata_tmb, si.id as sig_id, si.photo_id " +
            "FROM inspectionitems ii " +
            "LEFT JOIN significant_items si ON si.foreign_id = ii.id AND si.deleted != 1 " +
            "LEFT JOIN inspectionitemphotos iip ON iip.id = si.photo_id " +
            "WHERE ii.deleted = ? " +
            "AND ii.inspection_id = ? " +
            filter_string +
            "ORDER BY ii.seq_no, ii.seq_no2 ASC";
        blockElement('body');

        objDBUtils.loadRecordsSQL(sql, [0, objApp.keys.inspection_id], function (param, items) {
            unblockElement('body');
            $("#defectScrollWrapper").html("");

            self.defectsArray = [];
            self.defectsObjects = {};
            if(!items)
            {

            }
            else
            {
                var questions = [];
                var question_issues = {};
                var item_ids = [];
                var inspection_items = [];
                var thumbnails = {};

                for(var i = 0; i < items.rows.length; i++){
                    var item = items.rows.item(i);
                    if(item_ids.indexOf(item.id) == -1){
                        inspection_items.push(item);
                        item_ids.push(item.id);
                    }
                    if(item.photodata_tmb){
                        if(typeof thumbnails[item.id] == 'undefined')
                            thumbnails[item.id] = [];
                        thumbnails[item.id].push({
                            sig_id: item.sig_id,
                            photodata_tmb: item.photodata_tmb,
                            photo_id: item.photo_id
                        });
                    }
                }
                // Loop through the items and put them into the table.
                var html = '<table id="tblDefectListing" class="listing">';

                var maxLoop = inspection_items.length;
                self.numberOfIssues = 0;
                self.numberOfAcknowledgements = 0;
                var sq = 2;
                var r = 0;
                var added_items = [];
                for(r = 0; r < maxLoop; r++)
                {
                    var row = inspection_items[r];
                    var seq_no = row.seq_no;
                    if (added_items.indexOf(row.id) != -1)
                        continue;
                    added_items.push(row.id);
                    self.defectsArray.push(row);
                    self.defectsObjects[row.id] = row;
                    // Store the current sequence order of the row so we can quickly sort the
                    // items on move up / move down event.
                    self.keySortArray[sq] = row.id;
                    sq = sq + 2;

                    var details = '';
                    if(row.observation){
                        details += '<br/>';
                        details += 'Observation: ' + row.observation;
                    }
                    if(row.location){
                        details += '<br/>';
                        details += 'Location: ' + row.location;
                    }
                    if(row.action){
                        details += '<br/>';
                        details += 'Action: ' + row.action;
                    }

                    if(questions.indexOf(row.question) == -1){
                        /* First issue in question */
                        html += '<tr rel="' + row.id + '">';
                        html += '<td class="nodelete"></td>';
                        html += '<td><span class="seq_no">' + seq_no + '</span>';
                        if(self.finalised == 0) {
                            if(details == ''){
                                html += '<div class="capture-buttons leftmargin">' +
                                    '<a href="#" style="margin-top: 5px;" rel="' + row.id + '" class="edit_issue_btn">Add issue</a>' +
                                    '</div>';
                            }else{
                                html += '<div class="capture-buttons leftmargin">' +
                                    '<a href="#" style="margin-top: 5px;" rel="' + row.id + '" class="add_issue_btn">Add issue</a>' +
                                    '</div>';
                            }

                        }
                        html += '</td>';

                        html += '<td>' + row.question + '</td>';
                        html += '<td></td>';

                        if(self.finalised == 1){
                            var answer = row.notes?row.notes:'NA';
                        }else{
                            var answer = '<select style="width: auto;" data-question="'+ row.question +'" data-inspection-id="'+row.inspection_id+'" autocomplete="off" class="selector select-answer">' +
                                '<option value="">NA</option>' +
                                '<option value="Yes" '+(row.notes=='Yes'?'selected':'')+'>Yes</option>' +
                                '<option value="No" '+(row.notes=='No'?'selected':'')+'>No</option>' +
                                '</select>';

                        }

                        html += '<td>' + answer + '</td>';
                        html += '</tr>';
                        questions.push(row.question);
                    }

                    if(typeof question_issues[row.question] == "undefined"){
                        question_issues[row.question] = 0;
                    }
                    question_issues[row.question]++;

                    if(row.observation || row.location || row.action){
                        html += '<tr class="question-issues" data-question="'+row.question+'" rel="' + row.id + '">';
                        if(self.finalised == 0) {
                            html += '<td class="delete"></td>';
                        } else {
                            html += '<td class="nodelete"></td>';
                        }
                        html += '<td>';
                        if(self.finalised == 0) {
                            html += '<div class="capture-buttons">' +
                                '<a href="#" data-id="'+ row.id +'" class="capture-question-image left"><img width="40" src="images/camera-75.png" /></a>&nbsp;' +
                                '<a href="#" data-id="'+ row.id +'" class="select-question-image left"><img width="40" src="images/gallery-75.png" /></a>&nbsp;' +
                                '<a href="#" style="margin-top: 5px;" rel="' + row.id + '" class="edit_issue_btn">Edit</a>' +
                                '</div><br/>';
                        }
                        if(row.location){
                            html += row.location + '</td>';
                        }else{
                            html += 'No location</td>';
                        }
                        if(row.observation){
                            html += '<td>' + row.observation + '</td>';
                        }else{
                            html += '<td>No observation</td>';
                        }
                        if(row.action){
                            html += '<td>' + row.action + '</td>';
                        }else{
                            html += '<td>No action</td>';
                        }
                        /* Photo list */
                        if(typeof thumbnails[row.id] != 'undefined' && thumbnails[row.id].length){
                            html += '<td>';
                            for(var j in thumbnails[row.id]){
                                html += '<div>';
                                if(self.finalised == 0){
                                    html += '<a style="display: inline;" class="issue-photo" data-id="' + thumbnails[row.id][j].photo_id +'"><img width="150" height="100" src="data:image/jpeg;base64,' + thumbnails[row.id][j].photodata_tmb + '" /></a>';
                                    html += '&nbsp;<a href="#" style="display: inline;" class="remove-photo" data-id="' + thumbnails[row.id][j].sig_id + '">Remove</a>';
                                }else{
                                    html += '<img style="display: inline;" width="150" height="100" src="data:image/jpeg;base64,' + thumbnails[row.id][j].photodata_tmb + '" />';
                                }

                                html += '</div>';
                            }
                            html += '</td>';
                        }else{
                            html += '<td>No photos</td>';
                        }
                        html += '</tr>';
                    }

                    var key = row.location.trim();
                    if(key)
                    {
                        if(locations.hasOwnProperty(key) )
                        {
                            locations[key] += 1;
                        }
                        else
                        {
                            locations[key] = 1;
                        }
                    }

                    if (row.action)
                    {
                        row.action = $.trim(row.action.replace(/"/g, ''));
                        if (actions.hasOwnProperty(row.action))
                            actions[row.action] += 1;
                        else
                            actions[row.action] = 1;
                    }

                    if(row.itemtype == 0) {
                        self.numberOfIssues++;
                    } else {
                        self.numberOfAcknowledgements++;
                    }
                }

                /* If have actions, so graph with actions, if not, show graph with locations */
                if(!jQuery.isEmptyObject(actions))
                {
                    var data = new google.visualization.DataTable();
                    data.addColumn('string', 'Actions');
                    data.addColumn('number', 'Quantity');

                    var keys = [];
                    var total_defects = 0;
                    $.each( actions, function( key, value ) {
                        total_defects += parseInt(value);
                    });
                    $.each( actions, function( key, value ) {
                        if (keys.indexOf(key) == -1)
                            keys.push(key);
                        key += ': ' + value + ' (' + Math.round(value/total_defects*1000)/10.0 + '%)';
                        data.addRow([key, value]);
                    });

                    var fontSize = 14;
                    if (keys.length > 19){
                        fontSize = 13;
                    }
                    if (keys.length > 22){
                        fontSize = 12;
                    }
                    if (keys.length > 24){
                        fontSize = 11;
                    }
                    if (keys.length > 26){
                        fontSize = 10;
                    }
                    var options = {
                        title: '',
                        width: '100%',
                        height: '100%',
                        pieSliceText: 'value',
                        is3D: true,
                        chartArea:{
                            left:50,
                            height: '99%',
                            top: '1%',
                            width: '100%'
                        },
                        legend: {
                            alignment: 'center',
                            width: '100%',
                            textStyle: {
                                fontSize: fontSize
                            }
                        }
                    };

                    chart.draw(data, options);
                }
                else if(!jQuery.isEmptyObject(locations))
                {
                    var data = new google.visualization.DataTable();
                    data.addColumn('string', 'Location');
                    data.addColumn('number', 'Quantity');

                    $.each( locations, function( key, value ) {
                        data.addRow([key, value]);
                    });

                    var options = {
                        title: '',
                        width: '100%',
                        height: '100%',
                        pieSliceText: 'percentage',
                        is3D: true,
                    };

                    chart.draw(data, options);
                }

                current_inspection_id = objApp.keys.inspection_id;

                html += '</table>';

                $("#defectScrollWrapper").html(html);

                for(var q in question_issues){
                    if($('tr.question-issues[data-question="'+q+'"]').length == 1){
                        $('tr.question-issues[data-question="'+q+'"] td.delete').addClass('main-item');
                    }
                }

                self.setTableWidths2('tblDefectListingHeader', 'tblDefectListing', 5);

                self.scroller = new IScroll5("#defectScrollWrapper", { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbarSm'});
                if(self.last_scroller_y != -1)
                {
                    self.scroller.scrollTo(self.last_scroller_x, self.last_scroller_y);
                    self.last_scroller_x = -1;
                    self.last_scroller_y = -1;
                }

                var editIssuePhoto = function(photoID, photoData, notes)
                {
                    // Setup a new image object, using the photo data as the image source
                    objImage = new Image();
                    objImage.src = 'data:image/jpeg;base64,' + photoData;
                    // When the image has loaded, setup the image marker object
                    objImage.onload = function()
                    {
                        // Resize the image so it's 600px wide
                        objResizer = new imageResizer(objImage);
                        var imageData = objResizer.resize(600);

                        objImage = new Image();
                        objImage.src = 'data:image/jpeg;base64,' + imageData;
                        //notes = "";

                        objImage.onload = function()
                        {
                            objImageMarker = new imageMarker(objImage, "Edit Image", notes, function(imageMarkerResult)
                            {
                                // Handle the save event
                                var imageData = imageMarkerResult.imageData;
                                var notes = imageMarkerResult.notes;

                                // Create a thumbnail version of the image
                                objImage = new Image();
                                objImage.src = 'data:image/jpeg;base64,' + imageData;

                                objImage.onload = function()
                                {
                                    objResizer = new imageResizer(objImage);
                                    var thumbData = objResizer.resize(90);

                                    // Save the image data and notes back to the database
                                    var sql = "UPDATE inspectionitemphotos " +
                                        "SET photodata = ?, photodata_tmb = ?, notes = ?, dirty = 1 " +
                                        "WHERE id = ?";

                                    objDBUtils.execute(sql, [imageData, thumbData, notes, photoID], function()
                                    {
                                        self.loadQuestionItems();
                                    });
                                }
                            }, self.deleteQuestionImage, photoID, false);
                            objImageMarker.show();
                        }
                    }
                }

                $("#tblDefectListing tr td a.issue-photo").bind(objApp.touchEvent, function(e)
                {
                    self.last_scroller_x = self.scroller.x;
                    self.last_scroller_y = self.scroller.y;
                    e.preventDefault();
                    // Get the id of the selected photo
                    var photoID = $(this).attr("data-id");
                    objDBUtils.loadRecord('inspectionitemphotos', photoID, function(photoID, row)
                    {
                        if(!row)
                        {
                            alert("Sorry, the photo record could not be loaded");
                            return;
                        }

                        // If the fullsize version of the photo is not on the device, bring it down.
                        if((row.photodata == null) || (row.photodata == ""))
                        {
                            if(confirm("The full size version of this photo is not on this device.  Would you like to download it now via the Internet?"))
                            {
                                var params = objApp.objSync.getLoginParams();
                                if(!params)
                                {
                                    alert("Sorry, this request could not be completed");
                                }
                                blockElement('body');
                                // Create the request URL
                                var url = objApp.apiURL + "inspections/get_inspection_photo/" + photoID;
                                params['version'] = objApp.version;
                                $.post(url, params, function(data)
                                {
                                    unblockElement('body');

                                    if(data.status == "OK")
                                    {
                                        if(data.photo != "")
                                        {
                                            var sql = "UPDATE inspectionitemphotos " +
                                                "SET photodata = ? " +
                                                "WHERE id = ?";

                                            objDBUtils.execute(sql, [data.photo, photoID], function()
                                            {
                                                // Photo was downloaded and saved locally OK
                                                editIssuePhoto(photoID, data.photo, row.notes);
                                            });
                                        }
                                    }
                                }, "json");
                            }
                        }
                        else
                        {
                            // Photo data already present
                            editIssuePhoto(photoID, row.photodata, row.notes);
                        }

                    }, photoID);
                });

                $("#tblDefectListing tr td .remove-photo").bind(objApp.touchEvent, function(e)
                {
                    self.last_scroller_x = self.scroller.x;
                    self.last_scroller_y = self.scroller.y;
                    e.preventDefault();
                    // If the inspection is finalised - do nothing
                    if(self.finalised == 1) {
                        return;
                    }
                    if(confirm("Would you like to delete this photo?")){
                        var significant_id = $(this).attr("data-id");
                        self.deleteSignificantItem(significant_id);
                        self.loadQuestionItems();
                    }
                });

                $('#tblDefectListing a.edit_issue_btn').bind(objApp.touchEvent, function(e){
                    self.last_scroller_x = self.scroller.x;
                    self.last_scroller_y = self.scroller.y;
                    e.preventDefault();
                    if(self.is_change_order)
                    {
                        is_change_order = false;
                        return;
                    }
                    var $t = $(this), inspection_item_id = this.rel;

                    blockElement('body');

                    // Load the inspection item record
                    objDBUtils.loadRecord("inspectionitems", inspection_item_id, function(inspection_item_id, item)
                    {
                        unblockElement('body');
                        if(!item)
                            return;

                        objApp.keys.inspection_item_id = item.id;
                        self.showStep2(item);
                    }, inspection_item_id);
                });

                $('#tblDefectListing a.add_issue_btn').bind(objApp.touchEvent, function(e){
                    self.last_scroller_x = self.scroller.x;
                    self.last_scroller_y = self.scroller.y;
                    e.preventDefault();
                    if(self.is_change_order)
                    {
                        is_change_order = false;
                        return;
                    }
                    var $t = $(this), inspection_item_id = this.rel;

                    blockElement('body');

                    // Load the inspection item record
                    objDBUtils.loadRecord("inspectionitems", inspection_item_id, function(inspection_item_id, item)
                    {
                        unblockElement('body');
                        if(!item)
                            return;
                        objApp.keys.inspection_item_id = '';
                        objApp.keys.location = '';
                        objApp.keys.observation = '';
                        objApp.keys.action = '';
                        self.showStep2(item, 1);
                    }, inspection_item_id);
                });

                $("#tblDefectListing tr td.delete").bind(objApp.touchEvent, function(e)
                {
                    self.last_scroller_x = self.scroller.x;
                    self.last_scroller_y = self.scroller.y;
                    e.preventDefault();

                    // If the inspection is finalised - do nothing
                    if(self.finalised == 1) {
                        return;
                    }

                    var inspection_item_id = $(this).parent().attr("rel");
                    var parent = $(this).parent();
                    var table = $(parent).parent();

                    // Remove any active states of the list items
                    $(table).find("tr").removeClass("active");

                    // Did the user click on the first column
                    var idx = $(this).index();

                    if(idx == 0)
                    {
                        if(confirm("Would you like to delete this item?"))
                        {
                            if($(this).hasClass('main-item')){
                                self.deleteSignificantItems(inspection_item_id);
                                var sql = "UPDATE inspectionitems " +
                                    "SET location = '', observation = '', action = '', dirty = 1 " +
                                    "WHERE id = ?";
                                objDBUtils.execute(sql, [inspection_item_id], function() {
                                    self.loadQuestionItems();
                                });
                            }else{
                                self.deleteDefect(inspection_item_id);
                            }
                            return;
                        }
                    }
                    return false;
                });

                $("select.select-answer").unbind("change");
                $("select.select-answer").change(function(){
                    var question = $(this).attr('data-question');
                    var inspection_id = $(this).attr('data-inspection-id');
                    var sql = "UPDATE inspectionitems " +
                        "SET notes = ?, dirty = 1 " +
                        "WHERE inspection_id = ? AND question = ?";
                    objDBUtils.execute(sql, [$(this).val(), inspection_id, question], function() {});
                });
            }
        }, "");
    }

	/* **
	* loadInspectionItems loads the inspection items that belong to this inspection
	* and shows them in the items table
	 */
	this.loadInspectionItems = function()
	{
	    if(self.isReportsWithQuestions()){
	        self.loadQuestionItems();
	        return;
        }
        if(!self.finalised){
            $('#btnStep3AddAnotherIssue').removeClass('hidden');
            if($("#inspection #report_type2").val() == 'Builder inspection')
                $('.unfinalised-builder-report-only').removeClass("hidden");
        }
	    locations = {};
        actions = {};
		// Ensure a valid inspection id is set
		if(objApp.keys.inspection_id == "")
		{
			return;
		}
        
        this.keySortArray = {};

		var listDeleteMode = true;

        $("#tblDefectListingHeader th").eq(1).text('Tag Id');
        $("#tblDefectListingHeader th").eq(2).text('Location');
        $("#tblDefectListingHeader th").eq(3).text('Observation');
        $("#tblDefectListingHeader th").eq(4).text('Action');

		// Unbind any more button events
		$("#defectScrollWrapper").unbind();
		$("#tblDefectListing td").unbind();
		$("#tblDefectListing a.edit_issue_btn").unbind();
        
        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }        

		// Load the inspection items records
		//objDBUtils.orderBy = self.itemSortBy + " " + self.itemSortDir; //"seq_no DESC";
        objDBUtils.orderBy = "seq_no ASC";

		var filters = [];
		filters.push(new Array("inspection_id = '" + objApp.keys.inspection_id + "'"));

        var keyword = $('#keywords').val();
        if (keyword != '')
        {
            filter_string = "(location LIKE '%"+keyword+"%' OR observation LIKE '%"+keyword+"%' OR action LIKE '%"+keyword+"%' OR notes LIKE '%"+keyword+"%')";
            filters.push(new Array(filter_string));
        }

		blockElement('body');

		objDBUtils.loadRecords("inspectionitems", filters, function(param, items)
		{
		    unblockElement('body');
			$("#defectScrollWrapper").html("");

            self.defectsArray = [];
            self.defectsObjects = {};
			if(!items)
			{
				// Handle no items
			}
			else
			{
				// Loop through the items and put them into the table.
				var html = '<table id="tblDefectListing" class="listing">';
               
				var maxLoop = items.rows.length;
                self.numberOfIssues = 0;
                self.numberOfAcknowledgements = 0;
                var sq = 2;

				var r = 0;

                var added_items = [];

			    for(r = 0; r < maxLoop; r++)
			    {
			        var row = items.rows.item(r);
                    var seq_no = row.seq_no;
                    if (added_items.indexOf(row.id) != -1)
                        continue;
                    added_items.push(row.id);
                    self.defectsArray.push(row);
                    self.defectsObjects[row.id] = row;
                    // Store the current sequence order of the row so we can quickly sort the
                    // items on move up / move down event.
                    self.keySortArray[sq] = row.id;
                    sq = sq + 2;

			        html += '<tr rel="' + row.id + '">';

                    if(self.finalised == 0) {
                        html += '<td class="delete"></td>';
                    } else {
                        html += '<td class="nodelete"></td>';
                    }

			        html += '<td><span class="seq_no">' + seq_no + '</span>';

                    if(self.finalised == 0) {
                        html += '<a href="#" rel="' + row.id + '" class="edit_issue_btn">Edit Issue</a>';

                        if (maxLoop > 1)
                        {
                            if (r == 0)
                                html += '<span class="arrow down"></span></td>';
                            else if (r == maxLoop - 1)
                                html += '<span class="arrow up"></span></td>';
                            else
                                html += '<span class="arrow up"></span><span class="arrow down"></span></td>';
                        }
                    }
                    
                    var key = row.location.trim();
                    if(locations.hasOwnProperty(key) )
                    {
                        locations[key] += 1;                         
                    }
                    else
                    {
                        locations[key] = 1; 
                    }

                    html += '<td>' + row.location + '</td>';
			        html += '<td>' + row.observation + '</td>';
                    html += '<td>' + row.action + '</td>';
                    if (row.action)
                    {
                        row.action = $.trim(row.action.replace(/"/g, ''));
                        if (actions.hasOwnProperty(row.action))
                            actions[row.action] += 1;
                        else
                            actions[row.action] = 1;
                    }

			        html += '</tr>';

                    if(row.itemtype == 0) {
                        self.numberOfIssues++;
                    } else {
                        self.numberOfAcknowledgements++;
                    }
				}
                
                /* If have actions, so graph with actions, if not, show graph with locations */
                if(!jQuery.isEmptyObject(actions))
                {                    
                    var data = new google.visualization.DataTable();                    
                      data.addColumn('string', 'Actions');
                      data.addColumn('number', 'Quantity');

                    var keys = [];
                    var total_defects = 0;
                    $.each( actions, function( key, value ) {
                        total_defects += parseInt(value);
                    });
                    $.each( actions, function( key, value ) {
                        if (keys.indexOf(key) == -1)
                            keys.push(key);
                        key += ': ' + value + ' (' + Math.round(value/total_defects*1000)/10.0 + '%)';
                        data.addRow([key, value]);
                    });

                    var fontSize = 14;
                    if (keys.length > 19){
                        fontSize = 13;
                    }
                    if (keys.length > 22){
                        fontSize = 12;
                    }
                    if (keys.length > 24){
                        fontSize = 11;
                    }
                    if (keys.length > 26){
                        fontSize = 10;
                    }
                    var options = {
                        title: '',
                        width: '100%',
                        height: '100%',     
                        pieSliceText: 'value',
                        is3D: true,
                        chartArea:{
                            left:50,
                            height: '99%',
                            top: '1%',
                            width: '100%'
                        },
                        legend: {
                            alignment: 'center',
                            width: '100%',
                            textStyle: {
                                fontSize: fontSize
                            }
                        }
                    };    
                    
                    chart.draw(data, options);                   
                }
                else if(!jQuery.isEmptyObject(locations))
                {                    
                    var data = new google.visualization.DataTable();                    
                      data.addColumn('string', 'Location');
                      data.addColumn('number', 'Quantity');
                      
                    $.each( locations, function( key, value ) {                     
                        data.addRow([key, value]);
                    });

                    var options = {
                        title: '',
                        width: '100%',
                        height: '100%',     
                        pieSliceText: 'percentage',
                        is3D: true,
                    };
                    
                    chart.draw(data, options);                   
                }

                current_inspection_id = objApp.keys.inspection_id;

				html += '</table>';

				$("#defectScrollWrapper").html(html);


				if(objApp.keys.report_type == 'Handovers' || 1) {
					self.setTableWidths2('tblDefectListingHeader', 'tblDefectListing', 5);
                }
				else {
					self.setTableWidths2('tblDefectListingHeader', 'tblDefectListing', 4);
                }

				// if(objUtils.isMobileDevice())
			    {
                    self.scroller = new IScroll5("#defectScrollWrapper", { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbarSm'});
				    
                    if(self.last_scroller_y != -1)
                    {
                        self.scroller.scrollTo(self.last_scroller_x, self.last_scroller_y);
                        self.last_scroller_x = -1;
                        self.last_scroller_y = -1;
                    }
                }

				// Bind the move up / move down arrow button events
                $("#tblDefectListing span.arrow").bind(objApp.touchEvent, function(e) {
                    e.preventDefault();

                    var current_row = $(this).parent().parent();
                    var inspection_item_id = current_row.attr("rel");

                    var direction = "down";
                    if($(this).hasClass("up")) {
                        direction = "up";
                    }

                    self.handleMoveInspectionItem(inspection_item_id, direction);
                });

                $('#tblDefectListing a.edit_issue_btn').bind(objApp.touchEvent, function(e){

                    
                    // if(objUtils.isMobileDevice())
                    {
                        self.last_scroller_x = self.scroller.x;
                        self.last_scroller_y = self.scroller.y;
                    }
                    e.preventDefault();
                    if(self.is_change_order)
                    {
                        is_change_order = false;
                        return;
                    }
                    var $t = $(this)
                        , inspection_item_id = this.rel;

					if(confirm("Would you like to edit this item?"))
					{
						blockElement('body');

    					// Load the inspection item record
    					objDBUtils.loadRecord("inspectionitems", inspection_item_id, function(inspection_item_id, item)
    					{
    						unblockElement('body');

    						if(!item)
    						{
    							return;
    						}

    						objApp.keys.inspection_item_id = item.id;
    						objApp.keys.level = item.level;
    						objApp.keys.area = item.area;
    						objApp.keys.issue = item.issue;
    						objApp.keys.detail = item.detail;

    						self.showStep2(item);

    					}, inspection_item_id);
					}
                });

				$("#tblDefectListing tr td.delete").bind(objApp.touchEvent, function(e)
				{
                    if(self.is_change_order)
                    {
                        is_change_order = false;
                        return;
                    }

					e.preventDefault();

                    // If the inspection is finalised - do nothing
                    if(self.finalised == 1) {
                        return;
                    }

					var inspection_item_id = $(this).parent().attr("rel");

					var parent = $(this).parent();
					var table = $(parent).parent();

				    // Remove any active states of the list items
				    $(table).find("tr").removeClass("active");

				    if(listDeleteMode)
				    {
						// Did the user click on the first column
						var idx = $(this).index();

						if(idx == 0)
						{
							// Setup delete
							// Get the item name
							var item_name = $(parent).find("td:eq(2)").text();
							item_name += ", " + $(parent).find("td:eq(3)").text();

							if(confirm("Delete '" + item_name + "', are you sure?"))
							{
								self.deleteDefect(inspection_item_id);
								return;
							}
						}
				    }
					return false;
				});

			}
		}, "");

	}

    this.handleMoveInspectionItem = function(inspection_item_id, direction)
    {
        // Locate this item in the sort array
        var found = false;
        if((!this.keySortArray) || ($.assocArraySize(this.keySortArray) == 0)) {
            return;
        }

        // Loop through the items in the key sort array and find the matching item
        for(var key in this.keySortArray) {
            if(this.keySortArray[key] == inspection_item_id) {
                found = true;

                key = parseInt(key);

                // Calculate the position of the new key
                var new_key = key + 3;

                if(direction == "up") {
                    new_key = key - 3;
                }

                // Add the new key/item pair
                this.keySortArray[new_key] = inspection_item_id;

                // Remove the old key
                delete this.keySortArray[key];
            }
        }

        var new_seq_no = 0;
        var counter = 0;
        var num_keys = $.assocArraySize(this.keySortArray);
        var sql = "UPDATE inspectionitems " +
            "SET seq_no = ?, dirty = 1 " +
            "WHERE id = ?";
        for(var key in this.keySortArray) {
            var inspection_item_id = this.keySortArray[key];

            new_seq_no++;
            counter++;

            // When we get to the last item, define a callback function that executes after the final
            // SQL update.  We will then reload the item table.
            if(counter == num_keys) {
                objDBUtils.execute(sql, [new_seq_no, inspection_item_id], function() {
                    self.loadInspectionItems();
                });
            } else {
                objDBUtils.execute(sql, [new_seq_no, inspection_item_id], null);
            }

        }

        // Reload table
        //
    }

    this.sortQuestionIssues = function(inspection_id, question)
    {
        var sql = "SELECT id " +
            "FROM inspectionitems " +
            "WHERE inspection_id = ? AND question = ? AND deleted = 0";
        objDBUtils.loadRecordsSQL(sql, [inspection_id, question], function(param, items)
        {
            if(items){
                var counter = 1;
                for(var i = 0; i < items.rows.length; i++) {
                    var item = items.rows.item(i);
                    var sql = "UPDATE inspectionitems " +
                        "SET seq_no2 = ?, dirty = 1 " +
                        "WHERE id = ?";
                    objDBUtils.execute(sql, [counter++, item.id], null);
                }
            }
        }, "");
    }

    /**
    * Loads the reinspections screen.
    */
	this.loadReinspectionItems = function(reinspection_id)
	{
        if(objApp.empty(reinspection_id)) {
            alert("Inspections::loadReinspectionItems - Invalid reinspection id");
            return;
        }
        $('a.capture-signature-btn').hide();
        // Kill iScroll if it already exists
        if(this.scroller) {
            this.scroller.destroy();
            this.scroller = null;
        }
        self.defectsArray = [];
        self.defectsObjects = {};
        $('body').addClass('reinspect');
        objDBUtils.loadRecord("reinspections", reinspection_id, function(param, reinspection) {
            if(!reinspection) {
                alert("Couldn't load the reinspection record!");
                return;
            }

            objApp.keys.inspection_id = reinspection.inspection_id;
            self.reinspectionKey = reinspection_id;
            self.finalised = 0;

            $('#frmReinspection #certificated').val(reinspection.certificated?1:0);
            if (reinspection.certificated == 1){
                $('#btnCertificatedRe').removeClass('hidden');
                $('#btnUncertificatedRe').addClass('hidden');
            }else{
                $('#btnCertificatedRe').addClass('hidden');
                $('#btnUncertificatedRe').removeClass('hidden');
            }

            // We also need to load the inspection record

            objDBUtils.loadRecord("inspections", reinspection.inspection_id, function(param, inspection) {
                if(!inspection) {
                    alert("Couldn't load the inspection record!");
                    return;
                }

                objApp.keys.report_type = inspection.report_type;
                self.inspection = inspection;

                // Unbind events
                $('#tblReinspectionListing tr').unbind();
                $('#reinspection select#rectified').unbind();
                $("#reinspection a.passed").unbind();
                $("#reinspection a.failed").unbind();
                $('#btnReinspectNotes').unbind();
                $('#btnRWSave').unbind();

                $("#inspection #certificated").val(inspection.certificated);
                if (inspection.certificated == 1){
                    $('#btnCertificated').removeClass('hidden');
                    $('#btnUncertificated').addClass('hidden');
                }else{
                    $('#btnCertificated').addClass('hidden');
                    $('#btnUncertificated').removeClass('hidden');
                }

                // Clear the stage
                objApp.clearMain();

                // Set the headinggs
                objApp.setHeading("Blueprint Inspections");
                objApp.setSubHeading("Reinspection");
                objApp.setSubExtraHeading("", true);

                // Show the reinspection screen
                $("#reinspection").removeClass("hidden");

                if(self.isReportsWithQuestions()){
                    $("#tblReinspectionHeader th").eq(0).text('Question');
                    $("#tblReinspectionHeader th").eq(1).text('Location/Action');
                    $("#tblReinspectionHeader th").eq(3).text('Photo');

                    $('#btnSignificantItemsRe').addClass('hidden');
                    $('#rectified').html('<option value="Not Rectified">Not Rectified</option>\n' +
                        '                        <option value="Rectified">Rectified</option>\n' +
                        '                        <option value="Management Approved">Management Approved</option>');
                }else{
                    $("#tblReinspectionHeader th").eq(0).text('Tag Id');
                    $("#tblReinspectionHeader th").eq(1).text('Location');
                    $("#tblReinspectionHeader th").eq(3).text('Action');

                    $('#btnSignificantItemsRe').removeClass('hidden');
                    $('#rectified').html('<option value="Not Rectified">Not Rectified</option>\n' +
                        '                        <option value="Rectified">Rectified</option>\n' +
                        '                        <option value="Improvement Made">Improvement Made</option>\n' +
                        '                        <option value="Approved By CM">Approved By CM</option>\n' +
                        '                        <option value="NA">NA</option>');
                }

                // Initialise passed/failed indicators
                if(reinspection.failed == 1) {
                    $(".inspectionDetails .failed").addClass('active');
                    $(".inspectionDetails .passed").removeClass('active');
                } else {
                    $(".inspectionDetails .failed").removeClass('active');
                    $(".inspectionDetails .passed").addClass('active');
                }

                //if((inspection.report_type == "Builder: PCI/Final inspections" && objApp.keys.reinspection_id != "") || (inspection.report_type == "Fix / Plaster Inspection")) {
                if( (inspection.report_type == "Quality Inspection" || inspection.report_type == "Builder: PCI/Final inspections") && objApp.keys.reinspection_id != "") {
                    objApp.setSubExtraHeading("Step 3 of 4", true);
                    $('#inspectionStep3 > .bottomBtns > a#btnStep3Email').hide();
                    $('#inspectionStep3 > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                    $('#inspectionStep4 > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');
                    $('#reinspection > .bottomBtns > .btnContainer.right > a#btnStep3Next').html('Next');
                    $('#reinspection > .bottomBtns > .btnContainer.right > a#btnStep4Next').html('Done');
                }

                $('.reinspection-builder-report').addClass('hidden');
                $('#reinspection .capture-buttons').addClass('hidden');

                if(inspection.report_type == "Quality Inspection" || inspection.report_type.indexOf('Builder') != -1){
                    $('#reinspection .reinspection-builder-report').removeClass('hidden');
                }

                // Load the reinspection items
                var sql = "SELECT ri.id, ii.seq_no, ii.location, ii.question, ii.action, ii.observation, ri.rectified, r.failed, riip.photodata_tmb, si.id as sig_id " +
                    "FROM reinspectionitems ri " +
                    "LEFT JOIN significant_items si ON si.foreign_id = ri.id AND si.deleted != 1 " +
                    "LEFT JOIN reinspectionitemphotos riip ON riip.id = si.photo_id " +
                    "INNER JOIN inspectionitems ii ON ri.inspectionitem_id = ii.id " +
                    "INNER JOIN reinspections r ON r.id = ri.reinspection_id " +
                    "WHERE ii.deleted = 0 " +
                    "AND r.id = ? " +
                    "ORDER BY ii.seq_no, ii.seq_no2 ASC";

                $("#reinspectionScrollWrapper").html("");
                objApp.showHideSpinner(true, "#reinspection");
                objDBUtils.loadRecordsSQL(sql, [reinspection_id], function(param, items) {
                    objApp.showHideSpinner(false, "#reinspection");

                    self.defectsReArray = [];
                    self.defectsReObjects = {};
                    if(!items) {
                        return;
                    }

                    var questions = [];
                    var item_ids = [];
                    var reinspection_items = [];
                    var thumbnails = {};

                    for(var i = 0; i < items.rows.length; i++){
                        var item = items.rows.item(i);
                        if(item_ids.indexOf(item.id) == -1){
                            reinspection_items.push(item);
                            item_ids.push(item.id);
                        }
                        if(item.photodata_tmb){
                            if(typeof thumbnails[item.id] == 'undefined')
                                thumbnails[item.id] = [];
                            thumbnails[item.id].push({
                                sig_id: item.sig_id,
                                photodata_tmb: item.photodata_tmb
                            });
                        }
                    }

                    // Loop through the items and put them into the table.
                    var html = '<table id="tblReinspectionListing" class="listing">';

                    var maxLoop = reinspection_items.length;
                    var r = 0;
                    for(r = 0; r < maxLoop; r++) {
                        var row = reinspection_items[r];
                        self.defectsReArray.push(row);
                        self.defectsReObjects[row.id] = row;

                        html += '<tr data-id="' + row.id + '">';
                        if(self.isReportsWithQuestions()){
                            if(questions.indexOf(row.question) == -1){
                                html += '<td>' + row.seq_no + '. ' + row.question + '</td>';
                                questions.push(row.question);
                            }else{
                                html += '<td><span class="hidden">' + row.seq_no + '. ' + row.question + '</span></td>';
                            }

                            var cell2 = '';
                            if(row.location)
                                cell2 += 'Location: ' + row.location + ' ';
                            if(cell2)
                                cell2 += '<br/>';
                            if(row.action)
                                cell2 += 'Action: ' + row.action;
                            html += '<td>' + cell2 + '</td>';
                            html += '<td>' + row.observation + '</td>';

                            /* Photo list */
                            if(typeof thumbnails[row.id] != 'undefined' && thumbnails[row.id].length){
                                html += '<td>';
                                for(var j in thumbnails[row.id]){
                                    html += '<div>';
                                    html += '<img style="display: inline;" width="150" height="100" src="data:image/jpeg;base64,' + thumbnails[row.id][j].photodata_tmb + '" />';
                                    html += '&nbsp;<a href="#" style="display: inline;" class="remove-re-photo" data-id="' + thumbnails[row.id][j].sig_id + '">Remove</a>';
                                    html += '</div>';
                                }
                                html += '</td>';
                            }else{
                                html += '<td></td>';
                            }

                            html += '<td>' + row.rectified + '</td>';
                        }else{
                            html += '<td>' + row.seq_no + '</td>';
                            html += '<td>' + row.location + '</td>';
                            html += '<td>' + row.observation + '</td>';
                            html += '<td>' + row.action + '</td>';
                            html += '<td>' + row.rectified + '</td>';
                        }

                        html += '</tr>';
                    }
                    html += '</table>';
                    $("#reinspectionScrollWrapper").html(html);
                    self.setTableWidths2('tblReinspectionHeader', 'tblReinspectionListing', 5);

                    self.handleFinalised();

                    if(objUtils.isMobileDevice())
                    {
                        self.scroller = new IScroll('#reinspectionScrollWrapper', { click: true, hScrollbar: false, vScrollbar: false, scrollbarClass: 'myScrollbarSm'});
                    }

                    // Handle the event when the user clicks on a row in the item table
                    $('#tblReinspectionListing tr').bind(objApp.touchEvent, function() {

                        var reinspectionItemID = $(this).attr("data-id");
                        self.reinspectionItemRow = $(this);

                        var text = $(this).find("td:eq(0)").text() + ". ";
                        if(self.isReportsWithQuestions()){
                            text += '<br/>' + $(this).find("td:eq(1)").text();
                        }else{
                            text += $(this).find("td:eq(1)").text() + ", ";
                            text += $(this).find("td:eq(2)").text();
                        }
                        var rectifiedText = $(this).find("td:eq(4)").text();
                        $('#reinspection select#rectified').val(rectifiedText);
                        $('#reinspection select#rectified').trigger('change');
                        $('#reinspection .infomation p').html(text);
                        $('#reinspection .infomation select#rectified').show();
                        $('#reinspection .infomation').removeClass('hidden');
                        if(objApp.keys.report_type == "Quality Inspection" || objApp.keys.report_type.indexOf('Builder') != -1){
                            $('#reinspection .capture-buttons').removeClass('hidden');
                        }
                    });

                    $("#tblReinspectionListing tr td .remove-re-photo").bind(objApp.touchEvent, function(e)
                    {
                        e.preventDefault();
                        var significant_id = $(this).attr("data-id");
                        self.deleteSignificantItem(significant_id, objApp.keys.reinspection_id);
                        self.loadReinspectionItems(objApp.keys.reinspection_id);
                    });

                    // Handle the event when the rectified status of the item is updated
                    $('#reinspection select#rectified').bind("change", function() {

                        var rectified_status = $(this).val();
                        self.checkSaveRectifiedInspectionitem(rectified_status);

                    });

                    $("#reinspection a.passed").bind(objApp.touchEvent, function(){
                        self.updateReinspectionPassFail(0);
                    });

                    $("#reinspection a.failed").bind(objApp.touchEvent, function(){
                        self.updateReinspectionPassFail(1);
                    });

                    $("#Reinspectweather").bind(objApp.touchEvent, function(){
                        // Load the current reinspection record
                        objDBUtils.loadRecord("reinspections", self.reinspectionKey, function(param, reinspection) {
                            if(!reinspection) {
                                alert("Couldn't load the reinspection record!");
                                return;
                            } else {
                                $('#reinspectWeatherInput').val(reinspection.weather);
                            } 
                        }, "");
                    });

                    $('#btnRWSave').bind(objApp.touchEvent,function(e){
                        e.preventDefault();

                        var weather = $('#reinspectWeatherInput').val();

                        var sql = "UPDATE reinspections SET weather = ?, dirty = 1 WHERE id = ?";
                        objDBUtils.execute(sql,[weather,objApp.keys.reinspection_id],null);

                        revealWindow.hideModal();
                    });

                    $('#btnReinspectNotes').bind(objApp.touchEvent,function(e){

                        var objNoteModal = new noteModal("Reinspection Notes", self.reinspectionNotes, function(notes) {
                            self.reinspectionNotes = notes; // Update the self object with the current notes value

                            // Update the database too.
                            var sql = 'UPDATE reinspections SET notes = ?, dirty = 1 WHERE id = ?';
                            objDBUtils.execute(sql, [notes, reinspection_id], null);

                        });

                        objNoteModal.show();

                        if(self.finalised == 1)
                        {
                            objNoteModal.setReadOnly();
                        }
                    });
                }, "");
            }, "");
        }, "");

        // Update the photo icon with the correct number of photos.
        this.refreshReinspectionPhotoCount(reinspection_id);

        $("#btnReinspectDelete").unbind();
        $("#btnReinspectDelete").bind(objApp.touchEvent, function(e) {
            if(confirm("Are you sure you wish to delete this Reinspection?")) {
                var sql = "UPDATE reinspections " +
                          "SET deleted = 1, dirty = 1 " +
                          "WHERE id = ?";

                objDBUtils.execute(sql, [objApp.getKey("reinspection_id")], null);

                self.setupInspections();
            }
        });

	}

    /**
    * Updates the reinspection photo count.
    */
    this.refreshReinspectionPhotoCount = function(reinspection_id) {
        objDBUtils.countTableRows("reinspectionitemphotos", "reinspection_id = ? AND deleted = 0 AND id NOT IN(SELECT photo_id FROM significant_items WHERE type = 'reinspectionitem')", [reinspection_id], function(row) {
            if(!row) {
                alert("Unable to load reinspection photo count");
                return;
            }

            var num_photos = row.num_items;

            $("#reinspection #btnCapturePhoto div.numImgCurr").html(num_photos);
        });
    }

    this.updateInspectionPassFail = function(failed)
    {
        blockElement('body');
        var sql = "UPDATE inspections " +
            "SET failed = ?, dirty = 1 " +
            "WHERE id = ?";

        objDBUtils.execute(sql, [failed, objApp.keys.inspection_id], function() {
            // All done.
            if(failed) {
                $("#inspectionStep3 a.failed").addClass('active');
                $("#inspectionStep3 a.passed").removeClass('active');
            } else {
                $("#inspectionStep3 a.failed").removeClass('active');
                $("#inspectionStep3 a.passed").addClass('active');
            }
            unblockElement('body');
        });
    }

    // Update the reinspection and master inspection record with the new status
	this.updateReinspectionPassFail = function(failed)
    {
        blockElement('body');

        // Step 1 - Load the reinspection item
        var reinspectionID = this.reinspectionKey;

        objDBUtils.loadRecord("reinspections", reinspectionID, function(rectified_status, reinspection) {
            if(!reinspection) {
                alert("updateReinspectionPassFail - couldn't load reinspection");
                return false;
            }

            var currentdate = new Date();
            var curdate = currentdate.getFullYear() + "-"
                        + (currentdate.getMonth()+1)  + "-"
                        + currentdate.getDate();

            // Step 2 - Update the reinspection record
            var sql = "UPDATE reinspections " +
                "SET failed = ?, reinspection_date = ?, dirty = ? " +
                "WHERE id = ?";

            objDBUtils.execute(sql, [failed, curdate, 1, reinspectionID], function() {
                // Update the primary inspection record

                // Step 3 - Update the inspection record
                var sql = "UPDATE inspections " +
                    "SET failed = ?, dirty = 1 " +
                    "WHERE id = ?";

                objDBUtils.execute(sql, [failed, reinspection.inspection_id], function() {
                    // All done.
                    if(failed) {
                        $("#reinspectionFailed a").addClass('active');
                        $("#reinspectionPassed a").removeClass('active');
                    } else {
                        $("#reinspectionFailed a").removeClass('active');
                        $("#reinspectionPassed a").addClass('active');
                    }

                    unblockElement('body');
                });

            });
        });


        var sql = "UPDATE reinspections SET failed = ? WHERE id = ?";
        objDBUtils.execute(sql, [failed, self.reinspectionKey], function(){

        });
    }

	this.addNewBase = function(resource_type, resource_type_name, objSelector, parent_id)
	{
		// get the value the user has entered for the new item
		var new_value = $("#popSelector #popSelectorSearch").val();

		// if there is no value, do nothing
		if(new_value == "")
		{
			alert("Please enter the name of the item that you would like to add in the text box");
			$("#popSelector #popSelectorSearch").focus();
			return;
		}

		if(!confirm("Add a new " + resource_type_name + " called '" + new_value + "'.  Are you sure?"))
		{
			return;
		}

		var values = [resource_type, new_value];

		// Make sure this value doesn't already exist
		var sql = "SELECT * " +
			"FROM resources " +
			"WHERE resource_type = ? " +
			"AND name = ? " +
			"AND deleted = 0";

		if(parent_id != "")
		{
			sql += " AND parent_id = ?"
			values.push(parent_id);
		}


		objDBUtils.loadRecordSQL(sql, values, function(resource)
		{
			if(resource)
			{
				alert("Sorry, a " + resource_type_name + " already exists with this name");
				return;
			}

			sql = "INSERT INTO resources(id, resource_type, name, created_by, parent_id) " +
				"VALUES(?, ?, ?, ?, ?)";

			// Create a new insert key
			var new_id = objDBUtils.makeInsertKey(objApp.sync_prefix);

			// Get the logged in users id
			var user_id = localStorage.getItem("user_id");

			values = [new_id, resource_type, new_value, user_id];

			if(parent_id == "")
			{
				values.push(null);
			}
			else
			{
				values.push(parent_id);
			}

			objDBUtils.execute(sql, values, function()
			{
                if(objSelector != null)
                {
                    // Add the new item to the popselector
                    objSelector.addOption(new_id, new_value);

                    objSelector.sortAndRefresh();

                    // Select the new element and close the pop selector
                    objSelector.selectElementAndClose(new_id, new_value);
                }
            });
		});
	}

    this.addNewLocation = function()
	{
    	self.addNewBase(1, "location", self.objPopLocation, "");
	}

	this.addNewAction = function()
	{
		self.addNewBase(2, "action", self.objPopAction, "");
	}

    this.addNewObservationSuggession = function()
	{
		// get the value the user has entered for the new item
		var new_value = $("#observation").val();

		// if there is no value, do nothing
		if(new_value == "")
		{
			return;
		}

        var resource_type = 3;

		var values = [resource_type, new_value];

		// Make sure this value doesn't already exist
		var sql = "SELECT * " +
			"FROM resources " +
			"WHERE resource_type = ? " +
			"AND name = ? " +
			"AND deleted = 0";


		objDBUtils.loadRecordSQL(sql, values, function(resource)
		{
			if(resource)
			{
				console.log("Sorry, a observation suggession already exists with this name");
				return;
			}

			sql = "INSERT INTO resources(id, resource_type, name, created_by, parent_id) " +
				"VALUES(?, ?, ?, ?, ?)";

			// Create a new insert key
			var new_id = objDBUtils.makeInsertKey(objApp.sync_prefix);

			// Get the logged in users id
			var user_id = localStorage.getItem("user_id");

			values = [new_id, resource_type, new_value, user_id, null];
			objDBUtils.execute(sql, values, function()
			{
                console.log("Save a new observation suggession");

                var filters = [];
                filters.push(new Array("resource_type = 3"));
                objDBUtils.orderBy = "";

                $("#frmDefectDetails #observation_suggestion").empty();
            });
		});
	}

	/***
	* Checks to see if the current inspectio can be deleted or not
	* If the inspection has not yet been saved, or has not yet been finalised it cannot be deleted.
	* Inspections that have been finalised but have no items can also be deleted.
	*/
	this.checkCanDelete = function()
	{
		var showButton = false;

		if(objApp.keys.inspection_id == "")
		{
			// No inspection id means we can't delete the inspection.
			$("#inspection #btnDeleteInspection").addClass("hidden");
			return;
		}

		// Load the inspection record
		objDBUtils.loadRecord("inspections", objApp.keys.inspection_id, function(param, inspection)
		{
			if(inspection.finalised)
			{
				// A finalised inspection may only be deleted if it has no items
				var sql = "SELECT COUNT(*) as num_items " +
					"FROM inspectionitems " +
					"WHERE inspection_id = ? " +
					"AND deleted = 0";

				objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(row)
				{
					if(!row) return;

					if(row.num_items == 0)
					{
						// This inspection has no items.  Allow the inspection to be deleted
						$("#inspection #btnDeleteInspection").removeClass("hidden");
					}
					else
					{
						// This inspection has items.  It may not be deleted.
						if(!$("#inspection #btnDeleteInspection").hasClass("hidden"))
						{
							$("#inspection #btnDeleteInspection").addClass("hidden");
						}
					}

				});
			}
			else
			{
				$("#inspection #btnDeleteInspection").removeClass("hidden");
			}
		}, "");
	}

    this.handleFinalised = function()
    {
        $('.unfinalised-builder-report-only').addClass("hidden");
        if (self.finalised == 1)
        {
            // Set the active state
            $(".inspectionDetails .finished").addClass('active');

            // Hide the buttons etc
            $("div.btnEditNotes").hide();

            $('#btnStep3AddAnotherIssue').addClass('hidden');
            $('#btnStep3Back').addClass('hidden');
            $('#keywords').addClass('hidden');
            $("div.btnReinspect").show();
            $('.unfinalised-builder-report-only').addClass("hidden");

            // Show the next button
            $('#btnStep3Next').removeClass('hidden');

            // Set the rating select boxes to read-only
            $("#tblRateListing select.ratingSelect").attr("readonly", "readonly");
            $("#tblRateListing select.ratingSelect").attr("disabled", "disabled");

            $('#barrel_code').prop('disabled', true);
        }
        else
        {
            // Remove the active state
            $(".inspectionDetails .finished").removeClass('active');

            // Show the buttons etc
            $("div.btnEditNotes").show();
            $('#btnStep3AddAnotherIssue').removeClass('hidden');
            $('#btnStep3Back').removeClass('hidden');
            $('#finished').removeClass('active');
            $('#keywords').removeClass('hidden');
            if ($("#inspection #report_type2").val() == 'Client inspection')
                $("#btnReportPhotos").removeClass("hidden");
            else if($("#inspection #report_type2").val() == 'Builder inspection')
                $('.unfinalised-builder-report-only').removeClass("hidden");

            $("div.btnReinspect").hide();
            $("#tblRateListing select.ratingSelect").removeAttr("readonly");
            $("#tblRateListing select.ratingSelect").removeAttr("disabled");

            $('#barrel_code').prop('disabled', false);
        }   
        
        this.setReadOnly();     
    }    
	
	/***
	* Sets the UI controls into read only mode if the inspection has been finalised.
	*/
	this.setReadOnly = function()
	{
        if(self.objPopBuilders == null) {
            return;    
        }		
        
        if(self.finalised == 1)
		{            
            self.objPopBuilders.prop( 'disabled', true );
            
            if(self.objToggleFailed != null) {
			    self.objToggleFailed.preventToggle = true;
            }
			
			if(self.objPopLocation != null ) self.objPopLocation.readOnly = true;
			if(self.objPopAction != null ) self.objPopAction.readOnly = true;
			
			$("#addPhotoContainer").css("visibility", "hidden");
			//$("#btnSaveDefect").css("visibility", "hidden");
			$("#btnDeleteDefect").css("visibility", "hidden");
			$("#btnAddDefect").css("visibility", "hidden");
            $("#btnAddDefect").css("display", "none");
			
			// When the inspection has been finalised, show the print button.
			$("#print").css("visibility", "visible");
		}
		else
		{
			self.objPopBuilders.prop( 'disabled', false );
            if(self.objToggleFailed != null) {
                self.objToggleFailed.preventToggle = false;
            }
			
			if(self.objPopLocation != null ) self.objPopLocation.readOnly = false;
			if(self.objPopAction != null ) self.objPopAction.readOnly = false;
			
			$("#addPhotoContainer").css("visibility", "visible");
			//$("#btnSaveDefect").css("visibility", "visible");
			$("#btnAddDefect").css("visibility", "visible");
            $("#btnAddDefect").css("display", "");
            $("#print").css("visibility", "hidden");
			
			if(objApp.getKey("inspection_item_id") != "")
			{
				$("#btnDeleteDefect").css("visibility", "visible");
			}					
		}
	}

	/***
	* The showPrintModal method is called when the user taps on the print icon
	*/
	this.showPrintModal = function()
	{
		$("#printModal").show();
		
		// Setup toggles
		$("#printModalClose").unbind();
		$("#sendToToggles a").unbind();
		$("#downloadReport").unbind();
		$("#sendReport").unbind();
		
		$("#sendToToggles").html("");
		
		var userEmail = localStorage.getItem("email");
		var clientEmail = "";
		var clientContactEmail = "";
		var siteContactEmail = "";
		// Load the client email address details
		var sql = "SELECT c.*, s.address1 as site_address1, s.address2 as site_address2, s.external_email as site_external_email " +
			"FROM clients c " + 
			"INNER JOIN inspections i ON c.id = i.client_id " +
			"INNER JOIN sites s ON i.site_id = s.id " +
			"WHERE i.id = ?";
			
		objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(client)
		{
			if(!client)
			{
				alert("Sorry, the client record could not be loaded.");
				return;
			}
			
			clientEmail = client.email;
			clientContactEmail = client.external_email;
			siteContactEmail = client.site_external_email;
			var addressStr = client.site_address1;
			if((addressStr != "") && (client.site_address2 != ""))
			{
				addressStr += ", " + client.site_address2;
			}
			
			$("#printModal #emailSubject").val("Blueprint Inspection Report");
			$("#printModal #emailMessage").val("Please find attached an inspection report for " + client.name + " at " + addressStr + ".");
		});
		
		var refreshSendTo = function()
		{
			var csv = userEmail;
			
			/*if($("#printModal #sendToMe").val() == 1)
			{
				csv += userEmail;	
			}*/
			
			if($("#printModal #sendToClient").val() == 1)
			{
				if(clientEmail != "")
				{
					if(csv != "") csv += ",";
					csv += clientEmail;	
				}
			}
			
			if($("#printModal #sendToExternalRef").val() == 1)
			{
				if(clientContactEmail != "")
				{
					if(csv != "") csv += ",";
					csv += clientContactEmail;	
				}
			}
			
			if($("#printModal #sendToExternalRef2").val() == 1)
			{
				if(siteContactEmail != "")
				{
					if(csv != "") csv += ",";
					csv += siteContactEmail;	
				}
			}			
			
			$("#printModal #emailTo").val(csv);
		};
		
		// Setup toggle controls
  		var objToggleSendToMe = new toggleControl("toggleSendToMe", "#printModal #sendToMe", "binary", "Me", function()
  		{
			refreshSendTo();		
  		}); 
  		 		
  		var objToggleSendToClient = new toggleControl("toggleSendToClient", "#printModal #sendToClient", "binary", "Client", function()
  		{
			refreshSendTo();	
  		}); 
  		
  		var objToggleSendToExternal = new toggleControl("toggleSendToExternal", "#printModal #sendToExternalRef", "binary", "Main Contact", function()
  		{
			refreshSendTo();	
  		});  
  		
  		var objToggleSendToExternal2 = new toggleControl("toggleSendToExternal2", "#printModal #sendToExternalRef2", "binary", "Site Contact", function()
  		{
			refreshSendTo();	
  		});   		 		 		
  		
  		
  		// Render toggle controls
  		objToggleSendToMe.render("#sendToToggles");		
		objToggleSendToClient.render("#sendToToggles");		
		objToggleSendToExternal.render("#sendToToggles");	
		objToggleSendToExternal2.render("#sendToToggles");
		
		refreshSendTo();
		
		/************************** BIND PRINT MODAL EVENTS *********************/
		
		/***
		* Trap the event when the user taps the close button.
		*/
		$("#printModalClose").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			
			$("#printModal").hide();
		});
        
		
		$("#sendReport").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();   
			
			var emailSubject = $("#emailSubject").val();
			var emailMessage = $("#emailMessage").val();
			var emailTo = $("#emailTo").val();
			
			if(emailSubject == "")
			{
				alert("Please enter a subject for the email message");
				$("#emailSubject").focus();
				return;
			}
			
			if(emailMessage == "")
			{
				alert("Please enter a message for the email body");
				$("#emailMessage").focus();
				return;
			}
			
			if(emailTo == "")
			{
				alert("Please choose at least one email recipient");
				$("#emailTo").focus();
				return;
			}
            
			// Show the loader graphic
			blockElement('body');
			
			objApp.objSync.startSyncSilent(function(success)
			{
				if(success)
				{
					// The silent sync has completed successfully.
					// We can now send the report.
					var url = objApp.apiURL + "reports/send_inspection_report";
					
					var params = {};
					params["subject"] = emailSubject;
					params["recipients"] = emailTo;
					params["from"] = "noreply@Blueprintapp.com";
					params["message"] = emailMessage;
					params["inspectionid"] = objApp.keys.inspection_id;
                    params['version'] = objApp.version;
                    // For authentication params
                    params["email"] = localStorage.getItem("email");
					params["password"] = localStorage.getItem("password");
                    params["anticache"] = Math.floor(Math.random() * 99999);
                    params["chart_image"] = $('#chart_image').val();
                    params["dummy"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
                    $.post(url, params, function(data)
					{
						unblockElement('body');
                        
                        try {
                            data = jQuery.parseJSON(data);
                            
                            if(data.status == "OK")
                            {
                                $("#printModal").hide();
                                alert("Thank you.  The inspection report has been created and sent successfully.");
                            }
                            else
                            {
                                alert("Sorry, something went wrong whilst launching the report. " + data.message);
                            }                            
                            
                        } catch (e) {
                            // error
                            alert("Sorry, an error occured whilst trying to send the report");
                            return;
                        }                        
					}, "");						
				}
				else
				{
					unblockElement('body');
					alert("Sorry, something went wrong whilst syncing your data back to the Blueprint server.  Please try again later.");
				}
			});					
		});
	}		
	
	this.setReturnInspectionID = function(inspection_id)
	{
		localStorage.setItem("inspection_id", inspection_id);		
	}
	
	this.setReturnReinspectionID = function(reinspection_id)
	{
		localStorage.setItem("reinspection_id", reinspection_id);		
	}
    
    this.showHistoryModal = function()
    {
        $("#historyModal").show();
        $("#historyModalClose").unbind();
        
        $("#historyModalClose").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			$("#historyModal").hide();
		});
    }
    
    this.showContacts = function()
    {
        var userEmail = localStorage.getItem("email");
        var user_id = localStorage.getItem("user_id");
        
        if(user_id == "") {
            return;    
        }
        
		var clientEmail = "";
		var clientContactEmail1 = "";
        var clientContactEmail2 = "";
        var clientContactEmail3 = "";
        var clientExternalEmail = "";
		var siteContactEmail = "";
        var siteExtraContactEmail = "";
        
        $("#inspectionStep4 #btnStep4SendReport").unbind();
        
        var refreshSendTo = function()
		{
			var csv = "";
            
            $('#contacts_list .contactItems').each(function(){
                contact = $(this).val();
            
                if ($(this).is(':checked'))
                {
                    if (csv.indexOf(contact) == -1)
                    {
                        csv += contact + ",";
                    }
                }
            });
            
			$("#inspectionStep4 #emailTo").val(csv);
		};
        
        var checkContact = function(contact)
        {
            $('#contacts_list .contactItems').each(function(){
                val = $(this).val();
                if (val == contact)
                {
                    $(this).attr('checked', true);;
                }
            });
        }
        
        var split = function( val ) {
            return val.split( /,\s*/ );
        }
        
        var extractLast =function( term ) {
          return split( term ).pop();
        }
		
		// Load the client and site email address details
		var sql = "SELECT c.*, s.address1 as site_address1, s.address2 as site_address2, " +
                "s.email as site_email, s.external_email as site_external_email, " +
                "c1.first_name || ' ' || c1.last_name as contact1_name, c1.email as contact1_email, " +
                "c2.first_name || ' ' || c2.last_name as contact2_name, c2.email as contact2_email " +
			"FROM clients c " + 
			"INNER JOIN inspections i ON c.id = i.client_id " +
			"INNER JOIN sites s ON i.site_id = s.id " +
            "LEFT OUTER JOIN contacts c1 ON s.contact_id1 = c1.id " +
            "LEFT OUTER JOIN contacts c2 ON s.contact_id2 = c2.id " +
			"WHERE i.id = ?";
			
		objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id], function(client)
		{
		    $('#contacts_list .contactItems').unbind();
			if(!client)
			{
				alert("Sorry, the client record could not be loaded.");
				return;
			}
			
			clientEmail = client.email;
            clientContactEmail1 = client.c1_email;
            clientContactEmail2 = client.c2_email;
            clientContactEmail3 = client.c3_email;
			clientExternalEmail = client.external_email;
			siteContactEmail = client.site_email;
            siteExtraContactEmail = client.site_external_email;
			
			var addressStr = client.site_address1;
			if((addressStr != "") && (client.site_address2 != ""))
			{
				addressStr += ", " + client.site_address2;
			}
            
            // Create an array to store the email addresses as we add them.
            // We will use this to avoid adding duplicates.
            var addedEmails = [];
			
			//$("#printModal #emailSubject").val("Blueprint Inspection Report");
			//$("#printModal #emailMessage").val("Please find attached an inspection report for " + client.name + " at " + addressStr + ".");
            
            // Also load any contacts that the user has favourited
            var sql = "SELECT c.first_name || ' ' || c.last_name as contact_name, c.email as contact_email " +
                "FROM contacts c " +
                "INNER JOIN contactsfavourites cf ON c.id = cf.contact_id " +
                "WHERE cf.user_id = ? " +
                "AND cf.deleted = 0 " +
                "AND c.deleted = 0 " +
                "ORDER BY c.first_name";
                
                objDBUtils.loadRecordsSQL(sql, [user_id], function(param, favourites) {
                
                var html = '<ul>';
                html += '<li><input class="contactItems" type="checkbox" value="'+userEmail+'" id="userEmail" title="Me"><label for="userEmail">Me ('+userEmail+')</label></li>';
                var index = 1;
                
                if ((clientContactEmail1) && (addedEmails.indexOf(clientContactEmail1.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="'+clientContactEmail1+'" id="clientContactEmail1" title="Client Contact '+index.toString()+'"><label for="clientContactEmail1">Client Contact '+index.toString()+' ('+clientContactEmail1+')</label></li>';
                    addedEmails.push(clientContactEmail1.toLowerCase());
                }
                
                if ((clientContactEmail2) && (addedEmails.indexOf(clientContactEmail2.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="'+clientContactEmail2+'" id="clientContactEmail2" title="Client Contact '+index.toString()+'"><label for="clientContactEmail2">Client Contact '+index.toString()+' ('+clientContactEmail2+')</label></li>';
                    addedEmails.push(clientContactEmail2.toLowerCase());
                }
                
                if ((clientContactEmail3) && (addedEmails.indexOf(clientContactEmail3.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="'+clientContactEmail3+'" id="clientContactEmail3" title="Client Contact '+index.toString()+'"><label for="clientContactEmail3">Client Contact '+index.toString()+' ('+clientContactEmail3+')</label></li>';
                    addedEmails.push(clientContactEmail3.toLowerCase());
                }
                
                if ((siteContactEmail) && (addedEmails.indexOf(siteContactEmail.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="'+siteContactEmail+'" id="siteContactEmail" title="Site Contact"><label for="siteContactEmail">Site Contact ('+siteContactEmail+')</label></li>';
                    addedEmails.push(siteContactEmail.toLowerCase());
                }
                
                if ((siteExtraContactEmail) && (addedEmails.indexOf(siteExtraContactEmail.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="'+siteExtraContactEmail+'" id="siteExtraContactEmail" title="Site Ext. Contact"><label for="siteExtraContactEmail">Site Ext. Contact ('+siteExtraContactEmail+')</label></li>';
                    addedEmails.push(siteExtraContactEmail.toLowerCase());
                }
                
                if((client.contact1_email != null) && (client.contact1_email != "") && (addedEmails.indexOf(client.contact1_email.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="' + client.contact1_email + '" id="siteContact1Email" title="Site Contact 1"><label for="siteContact1Email">' + client.contact1_name + '</label></li>';
                    addedEmails.push(client.contact1_email.toLowerCase());
                }
                
                if((client.contact2_email != null) && (client.contact2_email != "") && (addedEmails.indexOf(client.contact2_email.toLowerCase()) == -1))
                {
                    index++;
                    html += '<li><input class="contactItems" type="checkbox" value="' + client.contact2_email + '" id="siteContact2Email" title="Site Contact 2"><label for="siteContact2Email">' + client.contact2_name + '</label></li>';
                    addedEmails.push(client.contact2_email.toLowerCase());
                }  
                
                // Add Favourites to the list
                if(favourites)
                {
                    var maxLoop = favourites.rows.length;
                    
                    // Loop through all of the clients in the recordset.
                    for(r = 0; r < maxLoop; r++)
                    {
                        // Get the current row
                        var favourite = favourites.rows.item(r); 
                        
                        if((favourite.contact_email != "") && (addedEmails.indexOf(favourite.contact_email.toLowerCase()) == -1))
                        {
                            index++;
                            var UFID = "userFavourite" + index;
                            html += '<li><input class="contactItems" type="checkbox" value="' + favourite.contact_email + '" id="' + UFID + '" title="User Favourite"><label for="' + UFID + '">' + favourite.contact_name + '</label></li>';
                            addedEmails.push(favourite.contact_email.toLowerCase());
                        }                         
                    }                         
                }                          
                
                
                html += "</ul>";
                $('.inspectionDetails #contacts_list').html(html);
                
                $('#contacts_list .contactItems').bind('change', function(e){
                    refreshSendTo();
                });
                
                
                $("#emailTo").bind( "keydown", function( event ) {
                        if ( event.keyCode === $.ui.keyCode.TAB &&
                        $( this ).data( "autocomplete" ).menu.active ) {
                            event.preventDefault();
                        }
                    }).autocomplete({
                    source: function( request, response ) {
                      // delegate back to autocomplete, but extract the last term
                      response( $.ui.autocomplete.filter(
                        objApp.contacts, extractLast( request.term ) ) );
                    },
                    minLength: 0,
                    select: function( event, ui ) {
                        var terms = split( this.value );
                        // remove the current input
                        terms.pop();
                        var csv = $("#inspectionStep4 #emailTo").val();
                        if (csv.indexOf(ui.item.value) == -1)
                        {
                            // add the selected item
                            terms.push( ui.item.value );
                            checkContact(ui.item.value);
                            
                        }
                        // add placeholder to get the comma-and-space at the end
                        terms.push( "" );
                        this.value = terms.join(",");
                        return false;
                    }
                });                
                
                
            }, "");
		});
        
        $("#inspectionStep4 #btnStep4SendReport").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			
			//var emailSubject = $("#emailSubject").val();
			//var emailMessage = $("#emailMessage").val();
            var emailSubject = '';
			var emailMessage = '';
			var emailTo = $("#emailTo").val();
			
			if(emailSubject == "")
			{
                /*
				alert("Please enter a subject for the email message");
				$("#emailSubject").focus();
				return;
                */
                emailSubject = "JetQuo Inspection Report for " + self.objPopSites.getText();
			}
			
			if(emailMessage == "")
			{
				/*
                alert("Please enter a message for the email body");
				$("#emailMessage").focus();
				return;
                */
                emailMessage = "Hi there, please find attached a Blueprint inspection report for: <br/><br/>" +
                                "   Client: " + self.objPopBuilders.select2('data').text + "<br/>" +
                                "   Site: " + self.objPopSites.getText() + "<br/>" +
                                "   Inspection Date: " + $("#inspection #inspection_date").val() + "<br/>" +
                                "   Passed: ";
                                
                var failed = $("#inspection #failed").val();
                if (failed)
                    emailMessage += " No<br/>";
                else
                    emailMessage += " Yes<br/>";
                    
                emailMessage += "<br/>Please do not reply to this email as it was automatically generated.";
			}
			
			if(emailTo == "")
			{
				alert("Please choose at least one email recipient");
				//$("#emailTo").focus();
				return;
			}
            
			// Show the loader graphic
			blockElement('body');
			
			objApp.objSync.startSyncSilent(function(success)
			{
				if(success)
				{
					// The silent sync has completed successfully.
					// We can now send the report.
					var url = objApp.apiURL + "reports/send_inspection_report";
					
					var params = {};
					params["subject"] = emailSubject;
					params["recipients"] = emailTo;
					params["from"] = "noreply@Blueprintapp.com";
					params["message"] = emailMessage;
					params["inspectionid"] = objApp.keys.inspection_id;
                    params["reinspectionid"] = objApp.keys.reinspection_id;
                    params['version'] = objApp.version;
                    // For authentication params
                    params["email"] = localStorage.getItem("email");
					params["password"] = localStorage.getItem("password");
                    params["anticache"] = Math.floor(Math.random() * 99999);
                    params["chart_image"] = $('#chart_image').val();
                    params["dummy"] = 'Here is dummy text. Post data will be cut off a part. This will fix that issue.';
                    $.post(url, params, function(data)
					{
						unblockElement('body');
                        
                        try {
                            data = jQuery.parseJSON(data);
                            
                            if(data.status == "OK")
                            {
                                alert("Thank you.  The inspection report has been created and sent successfully.");
                            }
                            else
                            {
                                alert("Sorry, something went wrong whilst launching the report. " + data.message);
                            }                            
                        } catch (e) {
                            // error
                            alert("Sorry, an error occured whilst trying to send the report");
                            return;
                        }                        
					}, "");						
				}
				else
				{
					unblockElement('body');
					alert("Sorry, something went wrong whilst syncing your data back to the Blueprint server.  Please try again later.");
				}
			});					
		});
        
    }
    
    this.resolveEmailReportRecipients = function() {

        var office_email = 'info@bpigrp.com.au';
        var builder_email = "";
        var supervisor_email = "";
        var user_email = localStorage.getItem("email");
        if(!self.inspection) {
            return false;
        }

        $("#frmEmailTo ul#list_email input[type='checkbox']").unbind();

        blockElement('body');
        objDBUtils.loadRecord("users", self.inspection.supervisor_id.length==0?-1:self.inspection.supervisor_id, function(param, supervisor) {
            console.log(supervisor);
            if (supervisor){
                supervisor_email = supervisor.email;
            }
            objDBUtils.loadRecord("builders", self.inspection.builder_id, function(param, builder) {
                unblockElement('body');
                if(builder) {
                    builder_email = builder.email;
                }

                var determineRecipients = function() {

                    var recipients = user_email;
                    var old_recipients = $("#recipients").val();

                    if($("#emailToOffice").is(":checked")) {
                        recipients += "," + office_email;
                    }
                    else
                    {
                        if(old_recipients != null)
                        {
                            old_recipients = jQuery.grep(old_recipients, function(value) {
                              return value != office_email;
                            });
                        }

                    }

                    var need_builder_email = 0;
                    if(($("#emailToBuilder").is(":checked")) && (!objApp.empty(builder_email))) {
                        if(!objApp.empty(recipients)) {
                            recipients += ",";
                        }
                        need_builder_email = 1;
                        recipients += builder_email;
                    }
                    else
                    {
                        if(old_recipients != null)
                        {
                            old_recipients = jQuery.grep(old_recipients, function(value) {
                              return value != builder_email;
                            });
                        }
                    }

                    var need_supervisor_email = 0;
                    if(($("#emailToSupervisor").is(":checked")) && (!objApp.empty(supervisor_email))) {
                        if(!objApp.empty(recipients)) {
                            recipients += ",";
                        }
                        need_supervisor_email = 1;
                        recipients += supervisor_email;
                    }
                    else
                    {
                        if(old_recipients != null)
                        {
                            old_recipients = jQuery.grep(old_recipients, function(value) {
                                return value != supervisor_email;
                            });
                        }

                    }
                    /*
                    $('#emailList input[type=checkbox]').each(function () {
                        if( $(this).is(":checked") ) {
                            if(!objApp.empty(recipients)) {
                                recipients += ",";
                            }

                            recipients += $("label[for='"+$(this).val()+"']").text();
                        }
                    });
                    */
                    if(old_recipients != null)
                        var recipients_array = $.merge(old_recipients, recipients.split(','));
                    else
                        var recipients_array = recipients.split(',');

                    var builder_email_not_in_address_book = 1;
                    var supervisor_email_not_in_address_book = 1;
                    var options = "";
                    $.each( email_options, function( key, value ) {
                        if(jQuery.inArray(value, recipients_array) != -1) {
                            options += "<option value='"+value+"' selected>"+value+"</option>";
                        }
                        else
                        {
                            options += "<option value='"+value+"' >"+value+"</option>";
                        }
                        if (value == builder_email){
                            builder_email_not_in_address_book = 0;
                        }
                        if (value == supervisor_email){
                            supervisor_email_not_in_address_book = 0;
                        }
                    });
                    if (builder_email_not_in_address_book){
                        if (need_builder_email)
                            options += "<option value='"+builder_email+"' selected>"+builder_email+"</option>";
                        else
                            options += "<option value='"+builder_email+"'>"+builder_email+"</option>";
                    }
                    if (supervisor_email_not_in_address_book && !objApp.empty(supervisor_email)){
                        if (need_supervisor_email)
                            options += "<option value='"+supervisor_email+"' selected>"+supervisor_email+"</option>";
                        else
                            options += "<option value='"+supervisor_email+"'>"+supervisor_email+"</option>";
                    }

                    $("#recipients").html(options);

                    $("#recipients").select2({
                          tags: true,
                          tokenSeparators: [',', ' '],
                          createTag: function(params) {
                                var email = params.term;
                                if( objApp.validateEmail(email) ) {
                                    return {
                                      id: email,
                                      text: email
                                    };
                                }

                                return null;
                            }
                    }).on("change", function(e) {
                      // mostly used event, fired to the original element when the value changes
                      if($(this).val() == null)
                      {
                           $("#emailTo").val('');
                      }
                      else
                      {
                           var res = $(this).val().join(",");
                           $("#emailTo").val(res);
                      }

                    })
                    $("#recipients").trigger('change');

                }

                determineRecipients();

                $("#frmEmailTo ul#list_email input[type='checkbox']").change(function() {
                    determineRecipients();
                });
                $("#emailList input[type=checkbox]").change(function() {
                    determineRecipients();
                });

            }, "");
        }, "");
    }
    
    /**
    * Given an inspection object, this method builds a property address string.
    */
    this.buildInspectionAddress = function(inspection) {
        if(!inspection) {
            return "";
        }
        
        var result = "Lot " + inspection.lot_no.trim() + ", " + inspection.address.trim() + ", " + inspection.suburb.trim();
        return result;
    }

    this.handleCertificated = function() {
        if(confirm("Are you sure to make it certificated?")){
            $('#btnUncertificated').addClass('hidden');
            $('#btnCertificated').removeClass('hidden');
            $('#inspection #certificated').val(1);
            objApp.objInspection.checkSaveRateInspection();
        }else{
            $('#btnCertificated').addClass('hidden');
            $('#btnUncertificated').removeClass('hidden');
            $('#inspection #certificated').val(0);
            objApp.objInspection.checkSaveRateInspection();
        }
    }

    this.handleCertificatedRe = function() {
        if(confirm("Are you sure to make it certificated?")){
            $('#btnUncertificatedRe').addClass('hidden');
            $('#btnCertificatedRe').removeClass('hidden');
            $('#frmReinspection #certificated').val(1);
            objDBUtils.execute("UPDATE reinspections SET certificated = ?, dirty = 1 WHERE id = ?",[1, objApp.keys.reinspection_id], null);
        }else{
            $('#btnCertificatedRe').addClass('hidden');
            $('#btnUncertificatedRe').removeClass('hidden');
            $('#frmReinspection #certificated').val(0);
            objDBUtils.execute("UPDATE reinspections SET certificated = ?, dirty = 1 WHERE id = ?",[0, objApp.keys.reinspection_id], null);
        }
    }

    this.handleYesNoButtons = function(obj) {
        if(obj.min_roof_tiles == 1) {
            $("#btnMinRoofTilesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnMinRoofTilesNo, #btnMinRoofTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#min_roof_tiles").val("1");
        } else if(obj.min_roof_tiles == 0) {
            $("#btnMinRoofTilesYes, #btnMinRoofTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRoofTilesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_roof_tiles").val("0");
        } else{
            $("#btnMinRoofTilesYes, #btnMinRoofTilesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRoofTilesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_roof_tiles").val("2");
        }

        if(obj.min_ridge_tiles == 1) {
            $("#btnMinRidgeTilesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnMinRidgeTilesNo, #btnMinRidgeTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#min_ridge_tiles").val("1");
        } else if(obj.min_ridge_tiles == 0) {
            $("#btnMinRidgeTilesYes, #btnMinRidgeTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRidgeTilesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_ridge_tiles").val("0");
        } else{
            $("#btnMinRidgeTilesYes, #btnMinRidgeTilesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRidgeTilesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_ridge_tiles").val("2");
        }

        if(obj.touch_up_paint == 1) {
            $("#btnTouchUpPaintYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnTouchUpPaintNo, #btnTouchUpPaintNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#touch_up_paint").val("1");
        } else if(obj.touch_up_paint == 0) {
            $("#btnTouchUpPaintYes, #btnTouchUpPaintNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnTouchUpPaintNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#touch_up_paint").val("0");
        } else{
            $("#btnTouchUpPaintYes, #btnTouchUpPaintNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnTouchUpPaintNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#touch_up_paint").val("2");
        }

        if(obj.min_flooring_tiles == 1) {
            $("#btnMinFlooringTilesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnMinFlooringTilesNo, #btnMinFlooringTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#min_flooring_tiles").val("1");
        } else if(obj.min_flooring_tiles == 0) {
            $("#btnMinFlooringTilesYes, #btnMinFlooringTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinFlooringTilesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_flooring_tiles").val("0");
        } else{
            $("#btnMinFlooringTilesYes, #btnMinFlooringTilesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinFlooringTilesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_flooring_tiles").val("2");
        }

        if(obj.grout_samples == 1) {
            $("#btnGroutSamplesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnGroutSamplesNo, #btnGroutSamplesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#grout_samples").val("1");
        } else if(obj.grout_samples == 0) {
            $("#btnGroutSamplesYes, #btnGroutSamplesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnGroutSamplesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#grout_samples").val("0");
        } else{
            $("#btnGroutSamplesYes, #btnGroutSamplesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnGroutSamplesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#grout_samples").val("2");
        }

        if(obj.practical_completed == 1) {
            $("#btnPracticalCompletedYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnPracticalCompletedNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#practical_completed").val("1");
            $('#practical_completed_selector').val(1);
        } else if(obj.practical_completed == 0) {
            $("#btnPracticalCompletedYes").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnPracticalCompletedNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#practical_completed").val("0");
            $('#practical_completed_selector').val(0);
        }
    }

    this.bindYesNoButtonsEvents = function(){
        $("#btnMinRoofTilesYes").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinRoofTilesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnMinRoofTilesNo, #btnMinRoofTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#min_roof_tiles").val("1");
            return false;
        });
        $("#btnMinRoofTilesNo").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinRoofTilesYes, #btnMinRoofTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRoofTilesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_roof_tiles").val("0");
            return false;
        });
        $("#btnMinRoofTilesNA").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinRoofTilesYes, #btnMinRoofTilesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRoofTilesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_roof_tiles").val("2");
            return false;
        });

        $("#btnMinRidgeTilesYes").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinRidgeTilesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnMinRidgeTilesNo, #btnMinRidgeTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#min_ridge_tiles").val("1");
            return false;
        });
        $("#btnMinRidgeTilesNo").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinRidgeTilesYes, #btnMinRidgeTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRidgeTilesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_ridge_tiles").val("0");
            return false;
        });
        $("#btnMinRidgeTilesNA").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinRidgeTilesYes, #btnMinRidgeTilesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinRidgeTilesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_ridge_tiles").val("2");
            return false;
        });

        $("#btnTouchUpPaintYes").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnTouchUpPaintYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnTouchUpPaintNo, #btnTouchUpPaintNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#touch_up_paint").val("1");
            return false;
        });
        $("#btnTouchUpPaintNo").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnTouchUpPaintYes, #btnTouchUpPaintNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnTouchUpPaintNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#touch_up_paint").val("0");
            return false;
        });
        $("#btnTouchUpPaintNA").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnTouchUpPaintYes, #btnTouchUpPaintNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnTouchUpPaintNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#touch_up_paint").val("2");
            return false;
        });

        $("#btnMinFlooringTilesYes").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinFlooringTilesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnMinFlooringTilesNo, #btnMinFlooringTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#min_flooring_tiles").val("1");
            return false;
        });
        $("#btnMinFlooringTilesNo").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinFlooringTilesYes, #btnMinFlooringTilesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinFlooringTilesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_flooring_tiles").val("0");
            return false;
        });
        $("#btnMinFlooringTilesNA").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnMinFlooringTilesYes, #btnMinFlooringTilesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnMinFlooringTilesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#min_flooring_tiles").val("2");
            return false;
        });

        $("#btnGroutSamplesYes").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnGroutSamplesYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnGroutSamplesNo, #btnGroutSamplesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#grout_samples").val("1");
            return false;
        });
        $("#btnGroutSamplesNo").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnGroutSamplesYes, #btnGroutSamplesNA").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnGroutSamplesNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#grout_samples").val("0");
            return false;
        });
        $("#btnGroutSamplesNA").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnGroutSamplesYes, #btnGroutSamplesNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnGroutSamplesNA").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#grout_samples").val("2");
            return false;
        });

        $("#btnPracticalCompletedYes").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnPracticalCompletedYes").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#btnPracticalCompletedNo").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#practical_completed").val("1");
            return false;
        });
        $("#btnPracticalCompletedNo").bind(objApp.touchEvent, function(e)
        {
            if (self.finalised == 1)
                return false;
            $("#btnPracticalCompletedYes").removeClass("yesno_enabled").addClass("yesno_disabled");
            $("#btnPracticalCompletedNo").removeClass("yesno_disabled").addClass("yesno_enabled");
            $("#practical_completed").val("0");
            return false;
        });
    }

    this.applyPermission = function(){
        if (self.user_type == 'admin'){
            $('#btnStep3DeleteInspection').show();
        }else{
            $('#btnStep3DeleteInspection').hide();
        }
    }

    this.loadSignaturePhotos = function()
    {
        if(objApp.getKey("inspection_id") == "")
        {
            $("#signatureWrapper #signatureList").html("<p>This inspection has no signatures.</p>");
            return;
        }

        objDBUtils.loadRecord("inspections", objApp.getKey("inspection_id"), function(param, row)
        {
            if(!row.signature_1){
                self.initSignature1();
                return;
            }
            if(!row.signature_2){
                self.initSignature2();
                return;
            }

            var html = '';
            if(row.signature_1)
            {
                var delete_node = '<div class="deleteSignature" data-id="' + row.id + '_s1"></div>';
                if(self.finalised == 1) {
                    delete_node = "";
                }

                html += '<li>' + delete_node + '<a rel="' + row.id + '_s1"><img width="250" src="data:image/jpeg;base64,' + row.signature_1 + '" /></a><div class="imageNotes">Signature 1</div></li>';
            }

            if(row.signature_2)
            {
                var delete_node = '<div class="deleteSignature" data-id="' + row.id + '_s2"></div>';
                if(self.finalised == 1) {
                    delete_node = "";
                }

                html += '<li>' + delete_node + '<a rel="' + row.id + '_s2"><img width="250" src="data:image/jpeg;base64,' + row.signature_2 + '" /></a><div class="imageNotes">Signature 2</div></li>';
            }

            self.showSignaturePhotos(html);
        }, "");
    }

    this.showSignaturePhotos = function(html)
    {
        // If matching items were found, inject them into the page, otherwise show the no history message.
        if(html == '')
        {
            $("#signatureWrapper #signatureList").html("<p>This inspection has no signatures.</p>");
        }
        else
        {
            html = '<ul class="gallery">' + html + '</ul>' + '<div style="clear:both;"></div>';
            $("#signatureWrapper #signatureList").html(html);

            var editSignature = function(item_id, signatureData)
            {
                // Setup a new image object, using the photo data as the image source
                objImage = new Image();
                objImage.src = 'data:image/jpeg;base64,' + signatureData;

                //notes = "";

                // When the image has loaded, setup the image marker object
                objImage.onload = function()
                {
                    objSignMarker = new signatureMarker(objImage, "Capture Signature", function(signatureMarkerResult)
                    {
                        // Handle the save event
                        var imageData = signatureMarkerResult.imageData;

                        // Create a thumbnail version of the image
                        objImage = new Image();
                        objImage.src = 'data:image/jpeg;base64,' + imageData;

                        objImage.onload = function()
                        {
                            if(item_id.indexOf('s1') != -1)
                                var sql = "UPDATE inspections SET signature_1 = ?, dirty = 1 WHERE id = ?";
                            else
                                var sql = "UPDATE inspections SET signature_2 = ?, dirty = 1 WHERE id = ?";

                            objDBUtils.execute(sql, [imageData, objApp.getKey("inspection_id")], function()
                            {
                                self.loadSignaturePhotos();
                            });
                        }
                    }, self.deleteSignature, item_id, false);

                    objSignMarker.show();
                }
            }

            $("#signatureWrapper #signatureList a").unbind(objApp.touchEvent);
            $("#signatureWrapper #signatureList a").bind(objApp.touchEvent, function(e)
            {
                e.preventDefault();

                // Get the id of the selected photo
                var item_id = $(this).attr("rel");

                objDBUtils.loadRecord("inspections", objApp.getKey("inspection_id"), function(item_id, inspection) {
                    if(!inspection) {
                        return;
                    }
                    if(item_id.indexOf('s1') != -1){
                        editSignature(item_id, inspection.signature_1);
                    }else{
                        editSignature(item_id, inspection.signature_2);
                    }
                }, item_id);
            });

            $("#signatureWrapper .deleteSignature").unbind();
            $("#signatureWrapper .deleteSignature").bind(objApp.touchEvent, function(e)
            {
                e.preventDefault();

                if(!confirm("Are you sure you want to delete this signature? Once the signature has been deleted you cannot recover it."))
                {
                    return false;
                }

                var signatureID = $(this).attr("data-id");

                self.deleteSignature(signatureID);
            });
        }
    }

    this.deleteSignature = function(item_id)
    {
        if (item_id == "")
            return;

        if(item_id.indexOf('s1') != -1)
            self.initSignature1(1);
        else
            self.initSignature2(1);

        self.loadSignaturePhotos();
    }

    this.initSignature1 = function(reset)
    {
        if(objApp.getKey("inspection_id")){
            var sql = "UPDATE inspections SET signature_1 = '" + TRANS_600x400 + "', dirty = 1 WHERE id = ?";
            if (typeof reset == 'undefined' || reset == null || reset == undefined || !reset){
                objDBUtils.loadRecord("inspections", objApp.getKey("inspection_id"), function(param, inspection) {
                    if(!inspection) {
                        return;
                    }
                    if(inspection.signature_1 == null || inspection.signature_1 == ''){
                        objDBUtils.execute(sql, [objApp.getKey("inspection_id")], function(){
                            self.loadSignaturePhotos();
                        });
                    }
                }, "");
            }else{
                objDBUtils.execute(sql, [objApp.getKey("inspection_id")], function(){
                    self.loadSignaturePhotos();
                });
            }
        }
    }

    this.initSignature2 = function(reset)
    {
        if(objApp.getKey("inspection_id")){
            var sql = "UPDATE inspections SET signature_2 = '" + TRANS_600x400 + "', dirty = 1 WHERE id = ?";
            if (typeof reset == 'undefined' || reset == null || reset == undefined || !reset){
                objDBUtils.loadRecord("inspections", objApp.getKey("inspection_id"), function(param, inspection) {
                    if(!inspection) {
                        return;
                    }
                    if(inspection.signature_2 == null || inspection.signature_2 == ''){
                        objDBUtils.execute(sql, [objApp.getKey("inspection_id")], function(){
                            self.loadSignaturePhotos();
                        });
                    }
                }, "");
            }else{
                objDBUtils.execute(sql, [objApp.getKey("inspection_id")], function(){
                    self.loadSignaturePhotos();
                });
            }
        }
    }

    this.isReportsWithQuestions = function(reportType)
    {
        var new_report = self.inspection ? parseInt(self.inspection.new_report): 1;
        if(typeof reportType == 'undefined')
            reportType = objApp.keys.report_type;
        return new_report && (reportType == 'Builder: Pre-plaster and lock up inspections' || reportType == 'Builder: Pre-paint/fixing inspections');
    }

    this.addQuestionItems = function(reportType)
    {
        if(self.isProcessing)
            return false;
        if(typeof reportType == 'undefined')
            reportType = objApp.keys.report_type;
        if(reportType == 'Builder: Pre-plaster and lock up inspections')
            var questions = [
                'Is the site sign visible',
                'Is the site clean with safe access',
                'Have external doors been installed to secure house',
                'Has roof cover been Installed',
                'Have antiponding boards been installed (Required to tiled roofs with No eaves that have been sarked)',
                'Have all flashings, capping’s and leadwork been carried out',
                'Is the dwelling watertight',
                'Has the meter box been installed and temporary support removed and steel pole not protruding into the room',
                'Has the electrical rough in been carried out',
                'Have ducts been installed for exhaust fans (external venting)',
                'Have ducts been installed for rangehood (external venting)',
                'Has the plumbing rough in been carried out including gas points',
                'Are the water lines under pressure',
                'Has stack work been carried out including waste traps connections',
                'Have shower bases been installed',
                'Has the heating rough in been carried out including walkway to AH',
                'Has the bath been installed and supported accordingly',
                'Has the cooling rough in been carried out',
                'Has sisalation paper to wall been installed and sealed',
                'Has sisalation paper to roof been installed and sealed',
                'Has wall insulation been installed',
                'Has ceiling insulation been installed or loaded',
                'Have studs been marked on the slab/timber floor',
                'Have all point loads been supported correctly',
                'Has the bracing that is visible been installed as per plans',
                'Are the holes drilled through frame for plumbing & electrical less than 25mm',
                'Are the holes drilled through the frame more than 270mm apart',
                'Have service pipes that are overlapping been Insulated or separated',
                'Are walls plumb and square in accordance with the frame code',
                'Are rooms the correct size as per plans',
                'Are door openings correct width & height as per plans',
                'Is ceiling the correct height as per plans',
                'Have wall intersection blocks been installed & nailed accordingly',
                'Have all bulkheads been installed as per plans',
                'Have ceiling noggins been installed over all walls (Min 150mm from internal corner)',
                'Has change of direction noggins been installed',
                'Have all noggins been installed',
                'Have noggins been installed around the bath hob (Note noggins required between studs greater than 300mm)',
                'Have noggins been installed to bulkheads (Note noggins required between studs greater than 300mm)',
                'Have ceiling noggins been installed to perimeter of garage',
                'Have ceiling noggins been installed to support motor for garage door',
                'Have wall noggins been installed for towel rail and toilet roll holder',
                'Has roof access hole been framed out',
                'Have windows been installed and supported as per manufactures instructions',
                'Are all window configurations correct?',
                'Have walls been straightened',
                'Have ceilings been straightened',
                'Is parapet framing complete',
                'Have box gutter boards been installed as required',
                'Pre Plaster is complete and no further items have been identified'
            ];
        else if(reportType == 'Builder: Pre-paint/fixing inspections')
            var questions = [
                'Is the site sign installed',
                'Is the site clean with safe access',
                'Is plaster complete',
                'Has the patch & sand been carried out',
                'Has all cornice or square set been completed',
                'Are walls straight, allowable bow/deviation is 5mm in 1.8m',
                'Are cornice lines straight allowable bow/deviation deviation is 4mm in 2.0m',
                'Have all doors been installed with even margins to all 3 edges, minimum 2mm to maximum 5mm, also maximum 30mm to bottom of door to allow for floor coverings',
                'Are all doors swinging the correct way as per plans',
                'Have all architraves been installed with an even quirk size',
                'Have all skirtings been installed including garage',
                'Are all skirtings straight at external corners and not out of square, allowable bow/deviation is 5mm in 1.8m',
                'Has all the water proofing been done prior to the installation of cabinets',
                'Have waterstops been installed to the entry of all wet areas.',
                'Has bath hob been water proofed and water stops been installed around the bath opening to hob',
                'Has the shower base screed been completed',
                'Have shower bases been installed',
                'Has shower recess been waterproofed',
                'Has upper storey been water proofed correctly with water proof membrane installed to complete floor area of all wet areas, or tile underlay installed and made water resistant',
                'Have kitchen cabinets been installed',
                'Have all vanities been installed',
                'Have laundry cabinets been installed',
                'Has roof access hatch been fixed out and the cover installed',
                'Has the porch ceiling been installed and complete',
                'Has the alfresco ceiling been installed and complete',
                'Has wall cladding been installed',
                'Have bricks been acid washed ',
                'Have bricks been blended correctly',
                'Have weep holes been installed accordingly (max 1200mm apart)',
                'Have weep holes been set at the correct height, for future landscaping minimum 150mm to ground level',
                'Has damp proof course flashing been installed correctly, not to be higher than finished floor slab level',
                'Have weep holes been installed correctly over windows',
                'Have window flashings been installed through articulation joint over windows ',
                'Are Articulation joints installed as per engineering and clear of debris',
                'Confirm split bricks will not be seen to the bottom coarse once landscaping complete to the correct height',
                'Has the base brick course been laid on a mortar bed less than 20mm if it is to remain visible',
                'Are bed joints within Code, Min 7mm – Max 13mm',
                'Are perp ends within Code, Min 5mm – Max 15mm (not more than 8mm variation)',
                'Is brickwork straight, level & plumb',
                'Is there a minimum of 3 brick courses over all steel lintels',
                'Has brickwork been finished tight against the fascia',
                'Does the brickwork overhang the slab rebate by less than 15mm',
                'Does the brickwork overhang the steel lintels by less than 25mm',
                'Is the brickwork neat and tidy with no blow outs throughout the brickwork including sill and reveals',
                'Is the mortar colour consistent throughout',
                'Is mortar strength correct, scratch test mortar at inconspicuous location',
                'Are all window rubbers fitting correctly to sills & reveals',
                'Has there been a 10mm gap/expansion seal installed beside windows/doors for Articulation joint',
                'Have all window infills been installed and complete',
                'Have eaves been installed and complete',
                'Is garage opening correct',
                'Pre Paint is complete and no further items have been identified'
            ];
        self.isProcessing = true;
        self._addQuestionItems(questions, 0);
    }

    this._addQuestionItems = function(questions, index){
        if(typeof questions[index] == 'undefined'){
            self.isProcessing = false;
            return self.showStep3();
        }

        var sql = "SELECT * " +
            "FROM inspectionitems " +
            "WHERE inspection_id = ? AND question = ? AND deleted = 0";
        var seq_no = parseInt(index) + 1;
        var inspection_item_id = objDBUtils.makeInsertKey(objApp.sync_prefix) + seq_no;
        objDBUtils.loadRecordSQL(sql, [objApp.keys.inspection_id, questions[index]], function(row)
        {
            if(row)
            {
                console.log('This question item has been added');
                console.log(row);
            }
            else
            {
                var insert_sql = "INSERT INTO inspectionitems(id, inspection_id, seq_no, location, question, observation, action, hash, created_by, dirty) VALUES(?,?,?,?,?,?,?,?,?,?)";
                objDBUtils.execute(insert_sql, [inspection_item_id, objApp.keys.inspection_id, seq_no, '', questions[index], '', '', objUtils.MD5(questions[index].toUpperCase()), localStorage.getItem("user_id"), 1], function(){});
            }
            self._addQuestionItems(questions, seq_no);
        });
    }
};

