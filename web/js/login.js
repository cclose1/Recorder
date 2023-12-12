'use strict';

var pu;
var appMYSQLUpdater = undefined;
var appReset        = undefined;

function setPopup() {
    if (pu === undefined)  
        try {
            pu = new popUp();
        } catch (err) {
            alert('login.js popUp undefined');
            return;
        }
}
function setMYSQL(flag) {
    setLocalStorage('usingMYSQL', flag);
}
function getMYSQL() {
    return getLocalStorage('usingMYSQL');
}
function setUsingMYSQL(element) {
    setHidden(getElement(element), !getMYSQL());
}
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function addLoginParameter(parameters, id) {
    return addParameter(parameters, id, pu.getValueById(id));
}
/*
 * Initialises the login screen using the local storage variables user and remInterval.
 * 
 * The hidden variable loginreset is set to true on login completion and set to false on completion
 * of this function. This ensures that this function is only called once per display of the login screen.
 * The onload trigger does not seem to be fired on load of the login screen, maybe because it's in a frame. Initially
 * this call was the target of the onmouseover of the login screen, which lead to numerous calls to this, hence,
 * the use of the loginreset hidden variable. Now it is called from the element user onfocus event and loginrest
 * is arguably unnecessary.
 */
function initLogin() {
    setPopup();
    
    if (!pu.getElementById('loginreset').checked) return;
    
    var user = defaultNull(getLocalStorage('user'), '');
    
    reporter.log('Login init');
    pu.getElementById('remInterval').value  = getLocalStorage('remInterval');
    pu.getElementById('saveuser').checked   = user !== '';
    pu.getElementById("user").value         = user; 
    pu.getElementById('loginreset').checked = false;
}
function displayLogOn(yes) {
    pu.display(yes, true);
    pu.getElementById("user").focus();
    
}
function loggingIn() {
    var el = document.getElementById(pu.getContainerId());
    /*
     * return !document.getElementById("loginfields").hasAttribute("hidden");
     * 
     * Changed from above since IE does not appear to implement the hidden attribute correctly.
     */
    return !(el.hasAttribute('hidden') || el.style.display === 'none');
}
function loggedIn(response) {
    var params = response.split(';');

    if (loggingIn()) return false;

    if (params[0] !== "securityfailure")
        return true;
    if (params[1] === 'httpsrequired') {
        setHidden(pu.getAppId(), true);
        setHidden(pu.getContainerId(), true);
        displayAlert("Security Failure", "Secure connection required; use https");
    } else {
        if (params.length >= 3)
            pu.getElementById("user").value = params[2];

        displayLogOn(true);

        if (params[1] !== 'notloggedin') displayAlert("Security Failure", params[1]);
    }
    return false;
}
function ajaxLoggedInCall(server, processResponse, parameters, async) {    
    function ajaxProcess(response) {
        if (!loggedIn(response)) return;
        
        processResponse(response);
    }
    if (loggingIn()) return;

    ajaxCall(server, parameters, ajaxProcess, async);
    setUsingMYSQL('mysqldiv');
}
function serverAcceptingRequests(server) {
    var parameters = addParameter("", "action", "loggedin");
    var isLoggedIn = false;

    function processResponse(response) {
        isLoggedIn = response.trim() === "true";

        setHidden("logoff", !isLoggedIn);
        isLoggedIn = true; //If we get to this point either loggedIn or logins not required
    }
    parameters = addParameter(parameters, "mysql", getMYSQL());
    ajaxLoggedInCall(server, processResponse, parameters, false);
    return isLoggedIn;
}
function login(server, event) {
    function processResponse(response) {
        var params = response.split(';');

        if (params[0] === 'yes') {
            displayLogOn(false);
            
            setHidden("logoff", false);
            
            setLocalStorage('requestReminders', remfrq !== '');
            setLocalStorage('remInterval',      remfrq);
            setLocalStorage('remLast',          null);
            setLocalStorage('user',             pu.getElementById('saveuser').checked? pu.getElementById("user").value : null);
                        
            if (appMYSQLUpdater !== undefined) setUsingMYSQL(appMYSQLUpdater);
            if (appReset        !== undefined) appReset(true);  
            
            pu.getElementById('loginreset').checked = true;
        } else
            displayAlert("Security Failure", params[0]);
    }
    if (event !== undefined) {
        if (event.keyCode !== 13) return;
    }
    setMYSQL(pu.getElementById('mysql').checked);
    
    setLocalStorage('browserlog', pu.getElementById('browserlog').checked);
    
    var remfrq     = trim(pu.getValueById('remInterval'));
    var parameters = addParameter("", "action", "login");

    if (pu.getValueById("user") === "") {
        displayAlert("Validation Failure", "Must enter a user");
        return;
    }
    if (pu.getValueById("password") === "") {
        displayAlert("Validation Failure", "Must enter a password");
        return;
    }
    if (pu.getValueById("newpassword") !== "" && pu.getValueById("confirmpassword") !== "") {
        if (pu.getValueById("newpassword") !== pu.getValueById("confirmpassword")) {
            displayAlert("Validation Failure", "Confirm Password is not the same as New Password");
            return;
        }
    } else if (pu.getValueById("newpassword") !== "" || pu.getValueById("confirmpassword") !== "") {
        displayAlert("Validation Failure", "Must enter a value for both New Password and Confirm Password or neither");
        return;
    }
    setCookie('mysql', getMYSQL());
    setLocalStorage('requestReminders', false);
    parameters = addParameter(parameters, "mysql", getMYSQL());
    parameters = addLoginParameter(parameters, "user");
    parameters = addLoginParameter(parameters, "password");
    parameters = addLoginParameter(parameters, "newpassword");
    pu.getElementById("password").value        = "";
    pu.getElementById("newpassword").value     = "";
    pu.getElementById("confirmpassword").value = "";
    ajaxCall(server, parameters, processResponse, false);
}
function logOff() {
    var parameters = addParameter("", "action", "logoff");

    function processResponse(response) {
        displayLogOn(true);
    }
    parameters = addParameter(parameters, "mysql", getMYSQL());
    ajaxCall(pu.getValueById('secserver'), parameters, processResponse, false);
}
function configureLogin(secserver, homeElementId) {   
    setPopup();
    if (homeElementId === undefined) homeElementId = 'loginframe';
        
    pu.initialise(homeElementId);
    pu.getElementById('secserver').value = secserver;
    
    if (pu.getElementById('mysqldiv')) {
        function processResponse(response) {
            setLocalStorage('multipleDBs', response.indexOf('yes') === 0);
            setHidden(pu.getElementById('mysqldiv'), !getLocalStorage('multipleDBs'));
        }
        ajaxLoggedInCall(secserver, processResponse, addParameter('', 'action', 'enablemysql'), false);
    }
}
/*
 * Reset, if present, allows the application to perform relevant initialisation. It takes a boolean paramater,
 * indicating if it is logged into the server. This allows it to perform initialisation that does not
 * require retrieving information from the server.
 */
function connectToServer(server, homeElementId, reset) {
    configureLogin(server, homeElementId);
    appMYSQLUpdater = document.getElementById('mysqldiv');
    appReset        = reset;   
    window.onerror  = globalError;
    
    if (reset !== undefined) appReset(serverAcceptingRequests(server));
}