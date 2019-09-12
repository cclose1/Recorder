'use strict';


var pu;

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function addLoginParameter(parameters, id) {
    return addParameter(parameters, id, pu.getValueById(id));
}
function setUser() {
    document.getElementById("user").value       = getCookie("userid");
    document.getElementById("saveuser").checked = getCookie("userid") !== "";
}
function displayLogOn(yes) {
    pu.display(yes, true);
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
    parameters = addParameterById(parameters, "mysql");
    ajaxLoggedInCall(server, processResponse, parameters, false);
    return isLoggedIn;
}

function saveUser() {
    setCookie('userid', pu.getElementById('saveuser').checked? pu.getValueById('user') : '');
}
function login(server, event) {
    if (event !== undefined) {
        if (event.keyCode !== 13) return;
    }
    var parameters = addParameter("", "action", "login");

    function processResponse(response) {
        var params = response.split(';');

        if (params[0] === 'yes') {
            displayLogOn(false);

            if (params.length >= 2)
                setCookie("sessionid", params[1].replace(/(\r\n|\n|\r)/gm,""));

            setHidden("logoff", false);
            initialize();
        } else
            displayAlert("Security Failure", params[0]);
    }
    if (pu.getValueById("password") === "") {
        displayAlert("Validation Failure", "Must enter the password");
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
    parameters = addParameterById(parameters, "mysql");
    parameters = addLoginParameter(parameters, "user");
    parameters = addLoginParameter(parameters, "password");
    parameters = addLoginParameter(parameters, "newpassword");
    pu.getElementById("password").value        = "";
    pu.getElementById("newpassword").value     = "";
    pu.getElementById("confirmpassword").value = "";
    saveUser();
    ajaxCall(server, parameters, processResponse, false);
}
function logOff() {
    var parameters = addParameter("", "action", "logoff");

    function processResponse(response) {
        document.cookie = 'sessionid=; expires=01-Jan-70 00:00:01 GMT;';
        displayLogOn(true);
    }
    parameters = addParameterById(parameters, "mysql");
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
}