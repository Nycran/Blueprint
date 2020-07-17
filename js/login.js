/**********************************************************
OBJECT: LOGIN
***********************************************************/

/***
* @project: Blueprint
* @author: Andrew Chapman
* @copyright: SIMB Pty Ltd 2011
*/

var Login = function()
{
	var self = this;
	
	this.setup = function()
	{
		objApp.clearMain();
		objApp.callbackMethod = null;	// Reset billbot callback.	
		
		// Show the login screen
		$("#main").addClass("hidden");
        $("#create_user_screen").addClass("hidden");
		 $("#forgotpass_screen").addClass("hidden");
		$(".home").removeClass("hidden");
        
        // Clear the login form
        $("#frmLogin #username").val(""); 
        $("#frmLogin #pword").val("");
        
        var remember_me = localStorage.getItem("remember_me");
        if(remember_me)
        {
            var login_email = localStorage.getItem("login_email");
            var login_password = localStorage.getItem("login_password");            
            
            if((login_email != undefined) && (login_email != null) && (login_email != ""))
            {
                $("#frmLogin #username").val(login_email);    
            }
            
            if((login_password != undefined) && (login_password != null) && (login_password != ""))
            {
                $("#frmLogin #pword").val(login_password);    
            }            
        }
        
        // Load previos logins
        var login_array = self.get_unique_logins();
        var html = '';
        
        if(login_array.length > 1)
        {
            html = '<h3>Select an Account</h3>';
            
            html += '<ul>';
            
            for(var i in login_array)
            {
                html += '<li><a href="#">' + login_array[i] + '</a></li>';    
            }
            
            html += '</ul>';
        }
        
        $("#previousLogins").html(html);
		
		this.bindEvents();			
	}
	

	this.forgotPass = function()
	{
		
		// Show the login screen
		$("#main").addClass("hidden");
        $("#create_user_screen").addClass("hidden");
		$(".home").addClass("hidden");
		$("#forgotpass_screen").removeClass("hidden");
		
        
        // Clear the login form
        $("#frmForgetPass #username_fp").val(""); 
        $("#frmForgetPass #pword_pf").val("");
		$("#frmForgetPass #rpword_pf").val("");

        $("#frmForgetPass #username_fp").removeClass("error");
        $("#frmForgetPass #pword_pf").removeClass("error");
		$("#frmForgetPass #rpword_pf").removeClass("error");
		
		$("#passverification").addClass('hidden');
		$("#retrievepass").removeClass('hidden');
		$("#verification_code").val('');
		$("#thecode").val('');

	}
	
	this.retrievePass = function()
	{

		if(!$("#frmForgetPass").validate().form())
		{
			alert("Please enter all required fields");
			return;
		}
		
		if($("#pword_pf").val() != $("#rpword_pf").val()){
			alert("Password does not match!");
			return;
		}
		
		var ps = $("#pword_pf").val();
		
		if(ps.length < 5) {
			alert("Password should be atleast 5 characters!");
			return;
		}
		
		var params = {};
		params["email"] = $("#username_fp").val();
		params["password"] = $("#pword_pf").val();
		
		
		$.post(objApp.apiURL + "account/retrieve_password", params, function(data)
		{
			
			if(data.status != "OK")
			{                    					
				alert("Sorry, that email address does not exist in our system");
				return;
			} else {
				$("#thecode").val(data.code);
				$("#passverification").removeClass('hidden');
				$("#retrievepass").addClass('hidden');
				$("#verification_code").val('');
				alert("We have sent you an e-mail with your verification code, please paste it in the box below.");
				return;
			}
			

		}, "JSON");		
	
	}

	this.verifyChangePass = function()
	{	
	
		var vercode = $("#verification_code").val();
		var vercodec = $("#thecode").val();
		
		if(vercode!=""){
		
				if(vercode==vercodec) { 

					var params = {};
					params["email"] = $("#username_fp").val();
					params["password"] = $("#pword_pf").val();
					
					$.post(objApp.apiURL + "account/change_password", params, function(data)
					{	
						if(data.status != "OK")
						{         
							$("#passverification").addClass('hidden');
							$("#retrievepass").removeClass('hidden');
							$("#verification_code").val('');
							$("#thecode").val('');
							$("#frmForgetPass #pword_pf").val("");
							$("#frmForgetPass #rpword_pf").val("");
							alert("Sorry, your request cannot be process at this time, please try again later.");
							return;
						} else {
							self.setup();
							alert("Password successfully changed! you may now login using your new password!");
							$("#passverification").addClass('hidden');
							$("#retrievepass").removeClass('hidden');
						}
					}, "JSON");
				} else {
					$("#passverification").addClass('hidden');
					$("#retrievepass").removeClass('hidden');
					$("#verification_code").val('');
					$("#thecode").val('');
					$("#frmForgetPass #pword_pf").val("");
					$("#frmForgetPass #rpword_pf").val("");
					alert("You have entered a wrong verification code! Please the fill up form below to request a new password.");	
				}
		} else {
			$("#verification_code").addClass('error');
		}
	}

	this.bindEvents = function()
	{
        $('#frmLogin .submit').unbind();
		$('#frmForgetPass .submit').unbind();
        $("#btnCreateUser").unbind();
        $("#username").unbind();
		$("#forgotpass").unbind();
		$("#backtoLog").unbind();
		$("#resetmypass").unbind();


		$("#resetmypass").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			self.verifyChangePass();
		});

		$("#frmForgetPass .submit").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			self.retrievePass();
		});
		
		$("#frmLogin .submit").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
			self.doLogin();
		});
		
        $("#forgotpass").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
            self.forgotPass();

		});
		
        $("#backtoLog").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
            self.setup();

		});

        $("#btnCreateUser").bind(objApp.touchEvent, function(e)
		{
			e.preventDefault();
            objApp.objUsers.setup();

		});
		
		$("#username").bind("blur", function()
		{
			objApp.scrollTop();
		});
		
		$("#pword").bind("focus", function()
		{
			if(objUtils.isMobileDevice())
			{      
				window.scrollTo(0, 200);
			}
		});			
		
		$("#pword").bind("blur", function()
		{
			objApp.scrollTop();
		});
		
		$('#frmLogin').bind('keypress', function(e)
		{
		     if(e.keyCode == 13)
		     {
		     	 e.preventDefault();

		         self.doLogin();
		     }
		});
        
        var objToggleRememberMe = new toggleControl("toggleRememberMe", "#frmLogin #remember_me", "binary", "", function()
  		{
			
  		});
        
        // Render toggle controls
  		$("#rememberme_toggle").html("");
  		objToggleRememberMe.render("#rememberme_toggle");
        
        // Handle the event when a user clicks on a login
        $("#previousLogins a").bind(objApp.touchEvent, function(e)
        {
            e.preventDefault();
            
            var login = $(this).text();
            
            // Set the username, clear the password and set focus
            $("#username").val(login);
            $("#pword").val("");
            $("#pword").focus();
        });
						
	}
	
	this.doLogin = function()
	{
		if(!$("#frmLogin").validate().form())
		{
			alert("Please enter all required fields");
			return;
		}
		
		var params = {};
		params["email"] = $("#username").val();
		params["password"] = $("#pword").val();
        var remember_me = $("#remember_me").val();
		
		// The form is valid.  Submit a login request.
		blockElement("body");
		if (typeof document.activeElement != 'undefined')
			document.activeElement.blur();
        var jqxhr = $.post(objApp.apiURL + "account/do_login", params, function(data)
		{
	
			unblockElement("body");
			if(data.status != "OK")
			{                    
				// Login was not successful.
				objApp.objLogin.clearSessionVars(); 					
				
				
				alert("Sorry, your login failed.  Please try again");
				return;
			}
			
			// Set local storage variables
			localStorage.setItem("user_id", data.user_id);
			localStorage.setItem("first_name", data.first_name); 
			localStorage.setItem("last_name", data.last_name); 
			localStorage.setItem("email", data.email);
			localStorage.setItem("initials", typeof data.initials == 'undefined'?'':data.initials);
			localStorage.setItem("restricted", data.restricted);
			localStorage.setItem("password", params["password"]);

			/* admin, general, super */
            var user_type = typeof data.user_type == 'undefined'?'general':data.user_type;
            localStorage.setItem("user_type", user_type);

            /* Only apply filter if user type is general and user state is valid */
            if (user_type == 'general' && typeof data.state_id != 'undefined' && data.state_id != null && data.state_id != 'null'){
                objApp.IS_STATE_FILTERED = 1;
                objApp.FILTERED_STATE_ID = data.state_id;
                objApp.FILTERED_STATE_CODE = objApp.STATE_CODES[data.state_id];
            }else{
                objApp.IS_STATE_FILTERED = 0;
                objApp.FILTERED_STATE_ID = 1;
                objApp.FILTERED_STATE_CODE = 'VIC';
            }
            localStorage.setItem("filtered_state_id", objApp.FILTERED_STATE_ID);
            localStorage.setItem("filtered_state_code", objApp.FILTERED_STATE_CODE);
            localStorage.setItem("is_state_filtered", objApp.IS_STATE_FILTERED);

            if (remember_me == 1)
            {
                localStorage.setItem("remember_me", 1);
                localStorage.setItem("login_email", data.email);
                localStorage.setItem("login_password", params["password"]);
            }
            else
            {
                localStorage.setItem("remember_me", 0);
                localStorage.setItem("login_email", "");
                localStorage.setItem("login_password", "");
            }
            
            // Store a list of unique logins so we can show them to the user on subsequent visits.
            var login_array = self.get_unique_logins();
            var this_username = $("#username").val();

            // Has this login been recorded before?
            if(login_array.indexOf(this_username) == -1)
            {
                // No, add it to the list.
                login_array.push(this_username);
            }
            
            //login_array.push("libby@simb.com.au");
            //login_array.push("ariel@simb.com.au");
            
            unique_logins = login_array.join(";");
            
            localStorage.setItem("unique_logins", unique_logins);
                
			// Hide the login screen.
			$(".home").addClass("hidden");

            objApp.determineStates();
			
			// Figure out what to do next.
			objApp.determineInitialAction();

		}, "JSON").fail(
            function(jqXHR, textStatus, errorThrown) {
                alert(textStatus);
                alert(jqXHR);
                var msg = '';
                for(var i in jqXHR){
                    msg += jqXHR[i] + '; ';
                }
                alert(msg);
            });
	}
    
    this.get_unique_logins = function()
    {
        var unique_logins = localStorage.getItem("unique_logins");
        var login_array = [];    
        
        if((unique_logins != null) && (unique_logins != ""))
        {
            login_array = unique_logins.split(";");     
        }
        
        return login_array;        
    }
	
	this.logout = function()
	{
		self.clearSessionVars();
		self.setup();	
	}
	
	this.clearSessionVars = function()
	{
		// Clear all login related session variables
		localStorage.setItem("first_name", ""); 
		localStorage.setItem("last_name", "");
        localStorage.setItem("email", ""); 
        localStorage.setItem("password", "");
        localStorage.setItem("user_type", "");
        localStorage.setItem("restricted", 0);
        localStorage.setItem("is_state_filtered", 0);
        localStorage.setItem("filtered_state_id", 1);
        localStorage.setItem("filtered_state_code", 'VIC');
	}
};
