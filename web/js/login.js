'use strict';

var pu;
var appMYSQLUpdater = undefined;
var appReset        = undefined;

function setMYSQL(flag) {
    setLocalStorage('usingMYSQL', flag);
}
function getMYSQL() {
    return getLocalStorage('usingMYSQL');
}
/*
 * 
 * No longer used
function checkMySQL(updater, initializer) {
    this.isMySQL     = getMYSQL();
    this.updater     = updater;
    this.initializer = initializer;
    
    function setLabel(obj) {
        if (obj.updater !== undefined) setHidden(obj.updater, !getMYSQL());
    }
    this.check = function() {
        var changed = this.isMySQL !== getMYSQL();
        
        if (changed) {
            setLabel(this);
            
            if (this.initializer !== undefined) this.initializer();
        }
        this.isMySQL = getMYSQL();
        return;
    };
    if (getLocalStorage('multipleDBs')) setInterval(() => {this.check();}, 5000);
    
    setLabel(this);
}
*/
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function addLoginParameter(parameters, id) {
    return addParameter(parameters, id, pu.getValueById(id));
}
function saveUser() {
    if (pu.getElementById("saveuser").checked && pu.getElementById("user").value !== '')
        setLocalStorage('recuser', pu.getElementById("user").value);
    else
        setLocalStorage('recuser', null);
}
function restoreUser() {
    if (pu.getElementById("user").value !== '') return;
    
    var user = getLocalStorage('recuser');
    
    if (user === null || user === '') 
        pu.getElementById("saveuser").checked = false;
    else {
        pu.getElementById("saveuser").checked = true;
        pu.getElementById("user").value = user;
    }
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

    if (async === undefined) async = true;

    ajaxCall(server, parameters, ajaxProcess, async);
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
            
            pu.getElementById("user").value = '';
            setHidden("logoff", false);
            
            if (appMYSQLUpdater !== undefined) setHidden(appMYSQLUpdater, !getMYSQL());
            if (appReset        !== undefined) appReset();
        } else
            displayAlert("Security Failure", params[0]);
    }
    if (event !== undefined) {
        if (event.keyCode !== 13) return;
    }
    restoreUser();
    setMYSQL(pu.getElementById('mysql').checked);
    
    setLocalStorage('browserlog', pu.getElementById('browserlog').checked);
    
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
    parameters = addParameter(parameters, "mysql", getMYSQL());
    parameters = addLoginParameter(parameters, "user");
    parameters = addLoginParameter(parameters, "password");
    parameters = addLoginParameter(parameters, "newpassword");
    saveUser();
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
    try {
        pu = new popUp();
    } catch (err) {
        alert('login.js popUp undefined');
        return;
    }
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
function connectToServer(server, homeElementId, reset) {
    configureLogin(server, homeElementId);
    appMYSQLUpdater = document.getElementById('mysqldiv');
    appReset        = reset;
    
    if (serverAcceptingRequests(server) && reset !== undefined) appReset();
}