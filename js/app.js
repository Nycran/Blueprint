/***
* @author: Andrew Chapman
* @copyright: SIMB Pty Ltd 2010 - 2014
* 
* Need to show defect level notes
* Need to show more than 3 images on a report
* Check history functionality - nothing showing in the modal window.
*/
var is_on_simulator = 0;
if (typeof LocalFileSystem == 'undefined'){
    var LocalFileSystem = {'PERSISTENT': 0};
    is_on_simulator = 1;
}
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

function App() 
{
	var self = this;	// Create a reference to the object itself
	this.apiURL = "http://bpi-api.wearebuilding.net/";
    //this.apiURL = "http://blueprint.simb.com.au/api/";
	this.phonegapBuild = true; 	// Set this to true when phonegap is the target
	this.version = '2.0.18';				// Identifies the app version to the server
    this.patch = '18';
	this.versionStatus = "Product";
	this.localMode = false;
	this.context = "";
	
	// Declare object references
	this.objLogin = null;		// Holds an instance of the login object
    this.objUsers = null;		// Holds an instance of the login object
	this.objBuilders = null;		// Holds an instance of the builders object
	this.objSites = null;		// Holds an instance of a sites object
	this.objSync = null;    	// Holds an instance of a sync object
	this.objInspection = null;	// Holds an instance of the inspection object
    this.objMyAccount = null;   // Holds an instance of the MyAccount object
    this.objMaintenance = null; // Holds an instance of the Maintenance object
    this.objContacts = null;    // Holds an instance of the builders object
	
	this.sync_prefix = "";		// The users sync prefix - must be unique across the application
	this.context = "";			// Holds the current context
	this.listTemplate = "";		// Used to hold the HTML for the list template
	this.saveMethod = null;
	this.addMethod = null;
	this.callbackMethod = null;
	this.phoneContact = null;
    this.touchEvent = determineEventType();
	
	this.fieldSep = "||";
	this.lineSep = "\\n";
	
	this.weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		
	// Define keys structure to hold primary keys
	this.keys = {
		"builder_id" : "",
		"state" : "",
        "contact_id" : "",
		"site_id" : "",
		"inspection_id" : "",
		"reinspection_id" : "",
		"report_type" : "",
		"inspection_item_id" : "",
		"location" : "",
		"observation" : "",
		"action" : "",
		"detail" : ""
	};

    this.contacts = new Array();
    
    // Returns the value of a key from the keys collection
    this.getKey = function(keyname)
    {
        return this.keys[keyname];    
    }
	
	/***
	*  clearKeys clears all the primary keys in the "keys" structure.
	*/
	this.clearKeys = function()
	{
		this.keys.builder_id = "";
        this.keys.contact_id = "";
		this.keys.site_id = "";
		this.keys.inspection_id = "";
		this.keys.reinspection_id = "";
		this.keys.inspection_item_id = "";
		this.keys.level = "";
		this.keys.area = "";
		this.keys.issue = "";
		this.keys.detail = "";
	}	
	
	/***
	* The init function is called after the app first starts and the
	* database has been created/checked.  It sets up the screen dimensions
	* and then loads the preferences object.
	*/
	this.init = function()
	{
		// Initialise needed objects
		this.objLogin = new Login();
		this.objBuilders = new Builders();
        this.objUsers = new Users();
		this.objSites = new Sites();
		this.objSync = new Sync();
		this.objInspection = new Inspections();
        this.objMyAccount = new MyAccount();
        this.objMaintenance = new Maintenance();
        this.objContacts = new Contacts();
		
		// Make sure the screen modals are an appropriate height.
		this.initScreen();
		
		this.checkSyncPrefix();

		// Is the user already logged in
		var email = localStorage.getItem("email");
		
		if((email == null) || (email == ""))
		{
			// Show the login screen
			this.objLogin.setup();
		}
		else
		{
			// Hide the login screen.
			$("#main").removeClass("hidden");
			
			// Figure out what to do next.
			this.determineInitialAction();
		}
		
		// Bind primary events
		this.bindEvents();
		
		self.scrollTop(); 
		
		$("#version").html("Version " + this.version);       
		
		// Hide all back / next / save buttons
		// this.hideAllButtons();
		
		//objDBUtils.dropAllTables(0);

		/*
		var sql = "ALTER TABLE clients ADD COLUMN 'external_contact' VARCHAR;";
		objDBUtils.execute(sql, null, null);
		
		sql = "ALTER TABLE clients ADD COLUMN 'external_email' VARCHAR;";
		objDBUtils.execute(sql, null, null);	
		
		sql = "ALTER TABLE inspections ADD COLUMN 'finalised' INTEGER NOT NULL DEFAULT 0;";
		objDBUtils.execute(sql, null, null);									
		
		sql = "CREATE INDEX IF NOT EXISTS inspections_finalised ON inspections (finalised, deleted);";
		self.execute(sql, null, null);			
		*/																			
		
		//var sql = "UPDATE reinspectionitemphotos SET dirty = 1;";
		//objDBUtils.execute(sql, null, null);	
		
		//var sql = "DELETE FROM inspectionitemphotos WHERE seq_no = 3;";
		//objDBUtils.execute(sql, null, null);

        //var sql = "DELETE FROM address_book;";
        //objDBUtils.execute(sql, null, null);
	}
	
	this.scrollTop = function()
	{
		if(objUtils.isMobileDevice())
		{      
			window.scrollTo(0, 1);
		}		
	}
	
	/***
	* checkSyncPrefix
	* Checks to see if this user/device has a sync prefix yet and if not,
	* a connection is made to the API to get one and store it locally.
	* A sync prefix is a unique prefix that will be used when creating keys.
	*/
	this.checkSyncPrefix = function()
	{
		// Does this user have a sync prefix?
		var sync_prefix = localStorage.getItem("sync_prefix");
		
		if(sync_prefix != null)
		{
			self.sync_prefix = sync_prefix;
			return;
		}

		// Download a sync prefix from the server
		var url = objApp.apiURL + "sync_prefixes/get";
		$.post(url, {}, function(data)
		{
			if((data != null) && (data.prefix) && (data.prefix.length > 4))
			{
				self.sync_prefix = data.prefix; 
                localStorage.setItem("sync_prefix", data.prefix); 
			}
			else
			{
				alert("Sorry, this application could not establish a connection to the Internet.  Please try again later.");
				self.objLogin.logout();	
			}
			
		}, "json");
	}
	
	this.determineInitialAction = function()
	{
		$("#main").removeClass("hidden");

		if(objUtils.isMobileDevice()) 
		{
			setTimeout(function()
			{
				objApp.scrollTop();
				self.initScreen();	
			}, 250);		
		}
		
		// Count how many builder records there are.
		// If there are none then we need to sync
		var sql = "SELECT COUNT(id) as num_builders " +
			"FROM builders " +
			"WHERE deleted = 0";
			
		objDBUtils.loadRecordSQL(sql, [], function(row)
		{
			if(!row)
			{
				alert("An error occured whilst trying to determine the initial application action.  Please report this bug.");
				objApp.objLogin.logout();
			}
			else
			{
				if(row.num_builders == 0)
				{
					// There are no builders.  Need to sync.
					self.objSync.setupSync(true);  	
				}
				else
				{
					// Normal app start.  Do we need to return the user to a previous inspection?
					var inspection_id = localStorage.getItem("inspection_id");
					
					// If a previous inspection id is set in local storage, return the user to that inspection.
					if((inspection_id != null) && (inspection_id != "undefined") && (inspection_id != ""))
					{
						objDBUtils.loadRecord("inspections", inspection_id, function(param, inspection)
						{
							self.objInspection.editInspection(inspection);
						}, "");
					}
					else
					{
						// Default to the add new inspection screen.
						//self.objInspection.addNewInspection();
						//self.objInspection.setupInspections();
                        self.setupStartScreen();
					}
				}
			}
		});   	
	}
	
	this.setHeading = function(heading)
	{
		$("#main #header .left h1").text(heading);
        self.setExtraHeading('',false);
	}
    
    this.setSubHeading = function(subheading)
	{
		$("#main #subheader .left h1").text(subheading);
        self.setExtraHeading('',false);
	}
    
    this.setExtraHeading = function(heading, show)
    {
        $extra_headding = $("#main #header .right h1");
        if (show)
        {
            $extra_headding.text(heading);
            $extra_headding.removeClass("hidden");
        }
        else
        {
            $extra_headding.text('');
            $extra_headding.addClass("hidden");
        }
        
    }
    
    this.setSubExtraHeading = function(heading, show)
    {
        $extra_headding = $("#main #subheader .right h1");
        if (show)
        {
            $extra_headding.text(heading);
            $extra_headding.removeClass("hidden");
        }
        else
        {
            $extra_headding.text('');
            $extra_headding.addClass("hidden");
        }
        
    }
	
	/***
	* initScreen sets up the height of the main screen area depending 
	* on the screen resolution.
	*/
	this.initScreen = function()
	{
		// Setup the screen height
		var navTopHeight = 40;
		var navFooterHeight = 50; 
		var mainHeight = 0; 
		var screenWidth = screen.width; 
        
		// Set the main div height - all the content goes here
		screenHeight = getAvailableHeight();
        var orientation = this.getOrientation();

        if(orientation == "landscape") {
            screenWidth = screen.width > screen.height?screen.width:screen.height;
        }

        $("form.search").hide();      
        
        // Set main area height and scrollWrapper height
        $("#main").css("height", screenHeight + "px");        

        // Set heights of panels and scrollers
		mainHeight = screenHeight - (navTopHeight + navFooterHeight);
        $(".panel").css("height", (mainHeight - 60) + "px");
        $(".scrollWrapper").css("height", (mainHeight - 200) + "px");
        $("#defectScrollWrapper").css("height", (mainHeight - 340) + "px");
        $("#inspectionStep3 .scrollWrapper").css("height", (mainHeight - 280) + "px");
        $("#reinspectionScrollWrapper").css("height", (mainHeight - 326) + "px");
        
		$("#datepicker").css("height", $(window).height());
        
        // The defect scroll scrapper on the inspection screen is a special case and needs to be shorter
        // $(".inspectionDetails #defectScrollWrapper").css("height", (mainHeight - 320) + "px");
		
        // Set widths of both, content area, heading and footer areas
        $("body").css("width", screenWidth + "px");

        $(".header").css("width", screenWidth + "px");
        $("footer").css("width", screenWidth + "px");
        $("#content").css("width", screenWidth + "px");
		
		//$("#sidebar").css("height", mainHeight + "px");

		// Set the height of the modal windows
		$("#optionModal").css("height", mainHeight - 30 + "px");
		$("#optionModal form").css("height", mainHeight - 95 + "px");
		
		var main_width = screen.width - 340;
		//$("#main").css("width", screen.width + "px");	
		//$("#sidebar").css("display", "block");		
	}

	this.setupStartScreen = function()
	{
        $("#btnNewInspection").unbind(self.touchEvent);
        $("#btnNewInspection").bind(self.touchEvent, function(e)
        {
            e.preventDefault();
            $("#main").removeClass("hidden");
            $("#start_screen").addClass("hidden");
            self.cleanup();
            self.objInspection.setReturnInspectionID("");
            self.objInspection.addNewInspection();
            self.context = "inspection";
        });

        $("#btnCompleteReinspection").unbind(self.touchEvent);
        $("#btnCompleteReinspection").bind(self.touchEvent, function(e)
        {
            e.preventDefault();
            $("#main").removeClass("hidden");
            $("#start_screen").addClass("hidden");
            $("#inspectionList #is_finalised").val(1);
            if(self.blockScreenChange()) return;
            self.cleanup();
            self.objInspection.setReturnInspectionID("");
            self.objInspection.setupInspections();
            self.context = "inspections";
        });

        $("#btnViewInspections").unbind(self.touchEvent);
        $("#btnViewInspections").bind(self.touchEvent, function(e)
        {
            e.preventDefault();
            $("#main").removeClass("hidden");
            $("#start_screen").addClass("hidden");
            if(self.blockScreenChange()) return;
            self.cleanup();
            self.objInspection.setReturnInspectionID("");
            self.objInspection.setupInspections();
            self.context = "inspections";
        });
		// Show the start screen
		$("#main").addClass("hidden");
		$("#start_screen").removeClass("hidden");
	}
	
	this.cleanup = function()
	{
		// Unbind any previous events 
		$("#main #content").unbind();
		$("#popSelector").remove();
		objApp.clearKeys();
        objApp.objInspection.setStep(0);
        objApp.objInspection.isEditing = 0;
        objApp.objInspection.isAddingSignificantItem = 0;
        objFilters.hide();
        $("form.search").hide();
		
		if(!$("#defect").hasClass("hidden"))
		{
			$("#defect").addClass("hidden");
		}
		objApp.setBodyClass('');
	}	
	
	/***
	* bindEvents binds click/touch handlers to the primary save, add and back buttons.
	*/
	this.bindEvents = function()
	{
		// Handle primary nav click events
        $("#navReinspect").bind(self.touchEvent, function(e)
        {
            e.preventDefault();
			
			if(self.blockScreenChange()) return;
            
            var inspection_id = localStorage.getItem("inspection_id");
			self.objInspection.setReturnInspectionID(inspection_id);
			
			var reinspection_id = localStorage.getItem("reinspection_id");
			self.objInspection.setReturnReinspectionID(reinspection_id);
			
			self.objInspection.showReinspection();
			self.context = "reinspections";
        });

		$("#navHome").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			self.cleanup();
            self.setupStartScreen();
			self.context = "start_screen";
		});

		$("#navNewInspection").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
 			self.cleanup(); 
 			self.objInspection.setReturnInspectionID("");
 			self.objInspection.addNewInspection(); 
 			self.context = "inspection";
		});	
		
		$("#navInspections").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			
			if(self.blockScreenChange()) return;
		
			self.cleanup();
			self.objInspection.setReturnInspectionID("");
			
			self.objInspection.setupInspections();
			self.context = "inspections";
		});	
		
		$("#navBuilders").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			
			if(self.blockScreenChange()) return;
			
			self.cleanup();
			self.objInspection.setReturnInspectionID("");
			
			// Show the builder listing screen.
			self.objBuilders.setupBuilders();
			self.context = "builders";
		});		
		
		$("#navSites").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			
			if(self.blockScreenChange()) return;
			
			self.cleanup();
			self.objInspection.setReturnInspectionID("");
			
			// Show the site listing screen.
			self.objSites.setupSites();
			self.context = "sites";
		});				
		
		$("#navSync").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			
			if(self.blockScreenChange()) return;
			
			self.cleanup();
			self.objInspection.setReturnInspectionID("");
			
 			self.objSync.setupSync(false);
 			self.context = "sync";
		});	
        
        $("#navContacts").bind(self.touchEvent, function(e)
        {
            e.preventDefault();
            
            if(self.blockScreenChange()) return;
            
            self.cleanup();
            self.objInspection.setReturnInspectionID("");
            
            // Show the contact listing screen.
            self.objContacts.setupContacts();
            self.context = "contacts";
        });            
        
        $("#navMaintenance").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			
			if(self.blockScreenChange()) return;
			
			self.cleanup();
			self.objInspection.setReturnInspectionID("");
			
 			self.objMaintenance.setupMaintenance();
 			self.context = "maintenance";
		});	
		
		$("#navLogout").bind(self.touchEvent, function(e)
		{
			e.preventDefault();
			
			if(!confirm("You are about to logout of this application.  Are you sure you wish to continue?"))
			{
				return;	
			}
			
			self.cleanup();
			self.objInspection.setReturnInspectionID("");
			
 			self.objLogin.logout();
		});	
        
        $("#navMyAccount").bind(self.touchEvent, function(e)
        {
            e.preventDefault();
            
            if(self.blockScreenChange()) return;
            
            self.cleanup();
            
            self.objMyAccount.setup();
            self.context = "myaccount";
        });        					
	}
	
	this.blockScreenChange = function()
	{
		if(self.context == "inspection")
		{
			if((self.keys.inspection_id != "") && ($('#inspection #finalised').val() == 0))
			{
				if(!confirm("This inspection has not yet been finalised.  Are you sure you wish to proceed anyway?"))
				{
					return true;
				}
			}	
		}
		
		return false;
	}

	/***
	* Handles the event when the user clicks on the footer nav.
	* Note, the CSS selected state change has already been handled by this point.
	*/	
	this.handleNavAction = function(navID)
	{
		// Clear the main content area
		this.clearMain();
		
		// Clear any stored keys
		this.clearKeys();
		
		// Hide all buttons
		objApp.hideAllButtons();
		
		if(navID == "navBuilders")
		{
			this.objBuilders.setupBuilders();
		}
		else if(navID == "navSites")
		{
			this.objSites.setupSites(); 
		}
		else if(navID == "navMenu")
		{
			showMenu();
		}				
		else
			alert("Unhandled nav option: " + navID);
	}
	
	/***
	* Handles the event when the user clicks on the back button
	* on the top navigation bar.
	*/
	this.handleBackButton = function()
	{
		this.hideAllButtons();
		this.hideAllModals();
		
		switch(this.context)
		{
			// About view
			case "about":
				this.clearKeys();
				this.clearMain();
				showMenu();    
				break;							
			
			// List view
			case "list":
				this.clearKeys();
				this.clearMain();
				
				showMenu(); 
				break;
				
			// Builder view
			case "builders":
				this.clearKeys();
				this.clearMain();
				objApp.objBuilders.setupBuilders();  
				break;
				
			// Site view
			case "site":
				this.clearKeys();
				this.clearMain();
				this.objSites.setupSites(); 
				break;	
				
			// Sync view
			case "sync":
				this.clearKeys();
    			showMenu()
				break;		

			default:
				alert("Unhandled back button context: " + this.context);
				break
		}
	}
	
	/***
	* Clear the main div
	*/
	this.clearMain = function()
	{
		// Hide all screens
		
		// Hide all content wrappers
		$("#content .panel").each(function()
		{
			if(!$(this).hasClass("hidden"))
			{
				$(this).addClass("hidden");
			}
            if (objApp.objInspection.glDatePicker)
                objApp.objInspection.glDatePicker.forcehide();
		});
        
        $("form.search").hide();
	}
	
	this.setNavActive = function(selector)
	{
		$("footer ul li a").removeClass("active");
		$("footer " + selector).addClass("active");
	}
	
	this.handleSaveMethod = function()
	{
		$("#btnSave").removeClass("active");
		this.saveMethod(); 
	}
	
	this.handleAddMethod = function()
	{
		this.hideAllModals();
		$("#btnAdd").removeClass("active");
		this.addMethod(); 
	}
	
	/**
	* Show / hide the back button at the top of the screen.
	*/
	this.showBackButton = function(show)
	{
		var display = "block";
		if(!show)
			display = "none";
			
		$("#btnBack").removeClass("active");
		$("#btnBack").css("display", display);
	}
	
	/**
	* Hides all modal windows that are open
	*/
	this.hideAllModals = function()
	{
		$(".modalWindow").each(function()
		{
			if(!$(this).hasClass("hidden"))
				$(".modalWindow").addClass("hidden");		
		});
		
		hideOptionModal();
		objFilters.hide();
	}
	
	/***
	* Hides all buttons on the top nav bar
	*/
	this.hideAllButtons = function()
	{
		$("#btnBack").css("display", "none");	
		$("#btnSave").css("visibility", "hidden");
		$("#btnAdd").css("visibility", "hidden");
	}
	
	/***
	* formatUserDate takes a date object and returns a date string in
	* either AU, US or ISO formats, depending on the users preference.
	*/
	this.formatUserDate = function(objDate)
	{
		// AU Format
        if(objDate == null)
            return '';
		return objDate.getDate() + "/" + (objDate.getMonth() + 1) + "/" + objDate.getFullYear();			
	}
	
	/***
	* formatUserShortDate takes a date object and returns a date string in
	* either AU, US or ISO formats, depending on the users preference.
	*/
	this.formatUserShortDate = function(objDate)
	{
		var weekDay = objApp.weekDays[objDate.getDay()];

		// AU Format
		return weekDay + " " + objDate.getDate() + "/" + (objDate.getMonth() + 1);			
	}	
	
	/***
	* makeISODate takes a date object and returns a date string in
	* ISO format.
	*/
	this.makeISODate = function(objDate)
	{
		// ISO Format
		var result = objDate.getFullYear() + "-";
		if((objDate.getMonth() + 1) < 10) result += "0";
		result += (objDate.getMonth() + 1) + "-";
		if(objDate.getDate() < 10) result += "0";
		result += objDate.getDate();
		
		return result;			
	}	
	
	/***
	* userDateStrToDate takes a date string (in the users preferred format)
	* and returns a date object.
	*/
	this.userDateStrToDate = function(dateStr)
	{
        if((dateStr == null) || (dateStr == ""))
			return null;

        // AU Format
        var elements = dateStr.split("/");
        if(elements.length != 3)
            return null;

		var objDate = new Date(elements[2], parseInt(elements[1]) - 1, elements[0], 0, 0, 0, 0);
		return objDate;
	};
	
	/***
	* isoDateStrToDate takes a date string in ISO format
	* and returns a date object.
	*/
	this.isoDateStrToDate = function(dateStr)
	{
		if((dateStr == null) || (dateStr == ""))
			return null;
        // ISO Format
        var elements = dateStr.split("-");
        if(elements.length != 3)
            return null;

		var objDate = new Date(elements[0], parseInt(elements[1]) - 1, elements[2], 0, 0, 0, 0);
		return objDate;
	};
	
	/***
	* toCurrency takes a integer or float value and makes sure that if there are decimal places,
	* that exactly 2 decimal places are always returned.
	*/
	this.toCurrency = function(v)
	{
		if(v == 0)
			return "0.00";		
		
		if((v == "") || (v == null))
			return;

		// Make sure there's not more than 2 decimal places.
		v = Math.round(v * 100) / 100;
		
		// If there's only one decimal place, add a zero
		var s = v + ""; // Convert to string
		var dotPos = s.indexOf(".");
		
		if(dotPos >= 0)
		{
			var diff = s.length - dotPos;

			if(diff == 2)
				s = s + "0";
		}
		
		return s;
	}							

	

	
	/***
	* setTU
	* Sets all distance unit labels/spans with the user selected distance unit.
	*/
	this.setTU = function(formSelector, override)
	{
		var tu = "";
		var switchval = 0;
		
		if(override != "")
			switchval = override;
		else                                            
			switchval = this.objPreferences.travel_unit;
		
		if(switchval == 0)
			tu = "Mile";
		else 
			tu = "Km";
		
		$(formSelector + " .TU").html(tu);
	};	
    
    /***
    * Shows or hides the animated spinner.
    */
    this.showHideSpinner = function(show, contentSelector)
    {
        if(show)
        {
            $(contentSelector).hide();
            $("#spinner").show();    
        }
        else
        {
            $("#spinner").hide();   
            $(contentSelector).show();
        }
    }
    
    /***
    * Detects the screen orientation and returns it.
    */
    this.getOrientation = function()
    {
        var orientation = "portrait";
        
        if(objUtils.isMobileDevice()) {
            orientation = Math.abs(window.orientation) == 90 ? 'landscape' : 'portrait';        
        }

        return orientation; 
    }
    
    // Determines if a value is empty or not.
    this.empty = function(v) {
        if ((v == undefined) || (v == "") || (v == null)) {
            return true;
        }
        
        return false;
    }
    
    this.validateEmail = function(email) { 
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

    this.setBodyClass = function(body_class){
    	$('body').attr('class', body_class);
	}
};

/**********************************************************
SECTION: MISC FUNCTIONS
***********************************************************/

function blockElement(elementSelector)
{
	$(elementSelector).block(
	{
		message: '<div style="padding: 20px;"><img width="64" height="64" src="images/spinner.gif" /><p></p></div>',
		css: {border:'0px', 'background-color':'transparent', position:'absolute'},
		overlayCSS: {opacity:0.4, cursor:'pointer', position:'absolute'}
	});
}

function unblockElement(elementSelector)
{
    $(elementSelector).unblock();
}
 
/***
* determineEventType - Determines if touch events are supported by the browser.
*/
function determineEventType()
{
    if ('ontouchstart' in document.documentElement)
		return "touchstart";
	else
		return "click";
}


function initTabs(selector)
{
	// Hide all tabs
	$("#" + selector + " div.tab").css("display", "none");
    
    // Remove any previous active states
    $("#" + selector + " ul.tabs li").removeClass("active");
	
	// Show the first tab
	$("#" + selector + " div.tab:eq(0)").css("display", "block");
	$("#" + selector + " ul.tabs li:eq(0)").addClass("active");
	
	$("#" + selector + " ul.tabs li a").bind(determineEventType(), function(e)
	{
		e.preventDefault();
		
		var selectedTabIndex = $(this).parent().index();
		
		// Set all the tabs to inactive
		$("#" + selector + " ul.tabs li").removeClass("active");
		
		// Now set the correct tab to active
		$("#" + selector + " ul.tabs li:eq(" + selectedTabIndex + ")").addClass("active");
		
		// Hide all tabs
		$("#" + selector + " div.tab").css("display", "none");
		
		// Show the selected tab
		$("#" + selector + " div.tab:eq(" + selectedTabIndex + ")").css("display", "block");		
	});
}

$.assocArraySize = function(obj) {
    // http://stackoverflow.com/a/6700/11236
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function preselectByText($selector, text){
	var found = 0;
	$selector.find('option').each(function(){
		if (found)
			return;
		var o_text = $(this).text();
		var o_value = $(this).attr('value');
		if (o_text == text){
			found = 1;
			$selector.val(o_value);
		}
	});
}