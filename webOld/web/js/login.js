'use strict';

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function setUser() {
    document.getElementById("user").value       = getCookie("userid");
    document.getElementById("saveuser").checked = getCookie("userid") !== "";
}
function displayLogOn(yes) {
    if (yes) {
        setHidden("appframe", true);
        setHidden("loginfields", false);
    } else {
        setHidden("appframe", false);
        setHidden("loginfields", true);
    }
}
function loggingIn() {
    var el = document.getElementById("loginfields");
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
        setHidden("appframe", true);
        setHidden("loginfields", true);
        displayAlert("Security Failure", "Secure connection required; use https");
    } else {
        if (params.length >= 3)
            document.getElementById("user").value = params[2];

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
    setCookie('userid', document.getElementById('saveuser').checked? document.getElementById('user').value : '');
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
    if (trim(document.getElementById("password").value) === "") {
        displayAlert("Validation Failure", "Must enter the password");
        return;
    }
    if (trim(document.getElementById("newpassword").value) !== "" && trim(document.getElementById("confirmpassword").value) !== "") {
        if (trim(document.getElementById("newpassword").value) !== trim(document.getElementById("confirmpassword").value)) {
            displayAlert("Validation Failure", "Confirm Password is not the same as New Password");
            return;
        }
    } else if (trim(document.getElementById("newpassword").value) !== "" || trim(document.getElementById("confirmpassword").value) !== "") {
       displayAlert("Validation Failure", "Must enter a value for both New Password and Confirm Password or neither");
        return;
    }
    parameters = addParameterById(parameters, "mysql");
    parameters = addParameterById(parameters, "user");
    parameters = addParameterById(parameters, "password");
    parameters = addParameterById(parameters, "newpassword");
    document.getElementById("password").value        = "";
    document.getElementById("newpassword").value     = "";
    document.getElementById("confirmpassword").value = "";
    saveUser();
    ajaxCall(server, parameters, processResponse, false);
}
function logOff(server) {
    var parameters = addParameter("", "action", "logoff");

    function processResponse(response) {
        document.cookie = 'sessionid=; expires=01-Jan-70 00:00:01 GMT;';
        displayLogOn(true);
    }
    parameters = addParameterById(parameters, "mysql");
    ajaxCall(server, parameters, processResponse, false);
}

function configureLogin(secserver, homeElementId) {
    document.getElementById('loginfields').style.display = 'none';
    document.getElementById('secserver').value = secserver;
    
}