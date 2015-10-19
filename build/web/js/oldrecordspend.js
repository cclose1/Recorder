function trim(str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}
function setTime() {
    var date = new Date();

    if (trim(document.getElementById("date").value) === "") {
        document.getElementById("date").value = currentDate(date);
    }
    if (trim(document.getElementById("time").value) === "") {
        document.getElementById("time").value = currentTime(date);
    }
}
function setUserx() {
    document.getElementById("user").value       = getCookie("userid");
    document.getElementById("saveuser").checked = getCookie("userid") !== "";
}
function displayLogOnx(yes) {
    if (yes) {
        setHidden("container", true);
        setHidden("loginfields", false);
    } else {
        setHidden("container", false);
        setHidden("loginfields", true);
    }
}
function loggingInx() {
    var el = document.getElementById("loginfields");
    /*
     * return !document.getElementById("loginfields").hasAttribute("hidden");
     * 
     * Changed from above since IE does not appear to implement the hidden attribute correctly.
     */
    return !(el.hasAttribute('hidden') || el.style.display === 'none');
}
function loggedInx(response) {
    var params = response.split(';');

    if (loggingIn()) return false;

    if (params[0] !== "securityfailure")
        return true;
    if (params[1] === 'httpsrequired') {
        setHidden("fieldspanel", true);
        setHidden("history", true);
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
function ajaxLoggedInCallx(processResponse, parameters, async) {
    function ajaxProcess(response) {
        if (!loggedIn(response)) return;

        processResponse(response);
    }
    if (loggingIn()) return;

    if (async === undefined) async = true;

    ajaxCall("Spend", parameters, ajaxProcess, async);
}
function serverAcceptingRequestsx() {
    var parameters = addParameter("", "action", "loggedin");
    var isLoggedIn = false;

    function processResponse(response) {
        isLoggedIn = response.trim() === "true";

        setHidden("logoff", !isLoggedIn);
        isLoggedIn = true; //If we get to this point either loggedIn or logins not required
    }
    parameters = addParameterById(parameters, "mysql");
    ajaxLoggedInCall(processResponse, parameters, false);
    return isLoggedIn;
}
function reset() {
    document.getElementById("seqno").value       = "";
    document.getElementById("date").value        = "";
    document.getElementById("time").value        = "";
    document.getElementById("type").value        = "";
    document.getElementById("location").value    = "";
    document.getElementById("description").value = "";
    document.getElementById("amount").value      = "";    
    document.getElementById("payment").value     = "Cash";  
    document.getElementById("correction").value  = "";
    document.getElementById("save").value        = "Create";
    document.getElementById("category").focus();
    setHidden("clone", true);
    setHidden("remove", true);
    requestHistory();
    requestSummary();
}
function clonedata() {
    setHidden("clone", true);
    setHidden("remove", true);
    document.getElementById("save").value = "Create";
    document.getElementById("seqno").value = "";
    document.getElementById("date").value = currentDate(new Date());
}
function getList(options) {
    var parameters = addParameter("", "action", "getList");

    parameters = addParameter(parameters, "name", options.field === undefined ? options.name : options.field);
    parameters = addParameterById(parameters, "mysql");
    
    if (options.filter !== undefined && options.filter) {
        parameters = addParameterById(parameters, "category");
        parameters = addParameterById(parameters, "type");        
    } 
    function processResponse(response) {
        loadOptionsJSON(response, options.name, options.keepValue, options.defaultValue);
    }
    ajaxLoggedInCall('Spend', processResponse, parameters, options.async);
}
function getListOld(name, field, keepValue, defaultValue) {
    var parameters = addParameter("", "action", "getList");
    var async      = false;

    parameters = addParameter(parameters, "name", field === undefined ? name : field);
    parameters = addParameterById(parameters, "mysql");
    
    if (name !== "category" && name !== "type") {
        async      = true;
        parameters = addParameterById(parameters, "category");
        parameters = addParameterById(parameters, "type");
    }

    function processResponse(response) {
        loadOptionsJSON(response, name, keepValue, defaultValue);
    }
    /*
     * Async is false for category and type as they need to be complete before the filtered
     * lists can be retrieved.
     */
    ajaxLoggedInCall('Spend', processResponse, parameters, async);
}
function saveUserx() {
    setCookie('userid', document.getElementById('saveuser').checked? document.getElementById('user').value : '');
}
function loginx(event) {
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
    ajaxCall("Spend", parameters, processResponse, false);
}
function logOffx() {
    var parameters = addParameter("", "action", "logoff");

    function processResponse(response) {
        document.cookie = 'sessionid=; expires=01-Jan-70 00:00:01 GMT;';
        displayLogOn(true);
    }
    parameters = addParameterById(parameters, "mysql");
    ajaxCall("Spend", parameters, processResponse, false);
}
function checkTimestamp() {
    var valid = true;
    var parameters = addParameter("", "action", "checktimestamp");

    function processResponse(response) {
        if (!loggedIn) return;
        /*
         * The response string includes quotes. So the blank string will have length 2.
         * When processed by OpenShift the response is a single quote. So if more than 2
         * characters assume it is the error response.
         */
        if (response.length > 2) {
            displayAlert("Validation Failure", response);
            valid = false;
        }
    }
    parameters = addParameterById(parameters, "mysql");
    parameters = addParameterById(parameters, "date");
    parameters = addParameterById(parameters, "time");
    parameters = addParameterById(parameters, "seqno");

    ajaxLoggedInCall('Spend', processResponse, parameters, false);
    return valid;
}
function send() {
    if (!fieldHasValue("date"))   return;
    if (!fieldHasValue("amount")) return;
    if (!checkTimestamp())        return;

    var parameters = addParameter("", "action", "savespend");

    parameters = addParameterById(parameters, "mysql");
    parameters = addParameterById(parameters, "seqno");
    parameters = addParameterById(parameters, "date");
    parameters = addParameterById(parameters, "time");
    parameters = addParameterById(parameters, "category");
    parameters = addParameterById(parameters, "type");
    parameters = addParameterById(parameters, "location");
    parameters = addParameterById(parameters, "description");
    parameters = addParameterById(parameters, "amount");
    parameters = addParameterById(parameters, "payment");
    parameters = addParameterById(parameters, "correction", "bankcorrection");

    ajaxLoggedInCall('Spend', reset, parameters);
}
function deleteData() {
    var parameters = addParameter("", "action", "deletespend");

    parameters = addParameterById(parameters, "mysql");
    parameters = addParameterById(parameters, "seqno");

    ajaxLoggedInCall('Spend', reset, parameters);
}
function requestHistory() {
    var parameters = addParameterById("", "mysql");

    parameters = addParameter(parameters, "action", "spendhistory");

    function processResponse(response) {
        loadJSONArray(response, "history", 19, "rowClick(this)");
        document.getElementById("history").removeAttribute("hidden");
    }
    ajaxLoggedInCall('Spend', processResponse, parameters);
}
function enableMySqlOld() {
    function processResponse(response) {
        setHidden("mysqldiv", response.indexOf("yes") !== 0);
    }
    ajaxLoggedInCall('Spend', processResponse, addParameter("", "action", "enablemysql"), false);
}
function requestSummary() {
    var parameters = addParameterById("", "mysql");

    parameters = addParameter(parameters, "action", "summaryfields");

    function processResponse(response) {
        document.getElementById("DailyRate").value = "";
        document.getElementById("Essential").value = "";
        document.getElementById("Discretionary").value = "";
        document.getElementById("MonthSpend").value = "";
        document.getElementById("YearEstimate").value = "";
        document.getElementById("Target").value = "";
        document.getElementById("UnderSpend").value = "";
        loadJSONFields(response, false);
        document.getElementById("history").removeAttribute("hidden");
    }
    ajaxLoggedInCall('Spend', processResponse, parameters);
}
function updateFilteredLists() {
    getList({name: "locationList",    field: "location", filter: true});
    getList({name: "descriptionList", field: "description", filter: true});
}
function rowClick(row) {
    var i;
    var h = document.getElementById(row.parentNode.parentNode.id).rows[0];

    for (i = 0; i < h.cells.length; i++) {
        var colName = h.cells[i].innerHTML;

        switch (colName) {
            case 'SeqNo':
                document.getElementById("seqno").value = row.cells[i].innerText;
                break;
            case 'Timestamp':
                var fields = row.cells[i].innerText.split(" ");

                if (fields.length === 2) {
                    document.getElementById("date").value = fields[0];
                    document.getElementById("time").value = fields[1];
                }
                break;
            case 'Category':
                document.getElementById("category").value = row.cells[i].innerText;
                break;
            case 'Type':
                document.getElementById("type").value = row.cells[i].innerText;
                break;
            case 'Location':
                document.getElementById("location").value = row.cells[i].innerText;
                break;
            case 'Description':
                document.getElementById("description").value = row.cells[i].innerText;
                break;
            case 'Amount':
                document.getElementById("amount").value = row.cells[i].innerText;
                break;
            case 'Payment':
                document.getElementById("payment").value = row.cells[i].innerText;
                break;
            case 'Correction':
                document.getElementById("correction").value = row.cells[i].innerText;
                break;
        }
    }
    document.getElementById("save").value = "Update";
    setHidden("clone", false);
    setHidden("remove", false);
}
function initialize() {
    if (!serverAcceptingRequests('Spend')) return;
    
    enableMySql();
    getList({
        name:         "category",
        keepValue:    true,
        defaultValue: "Discretionary",
        async:        false});
    getList({
        name:         "type",
        keepValue:    true,
        defaultValue: "Cafe",
        async:        false});
    /*
     * The remaining calls can execute asynchronously.
     */
    getList({
        name:         "payment",
        keepValue:    true,
        defaultValue: "Cash"});
    updateFilteredLists();
    requestHistory("");
    requestSummary("");
}


