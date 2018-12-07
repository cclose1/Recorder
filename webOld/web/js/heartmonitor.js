'use strict';

var timer = setInterval(function(){ updateTimer();}, 1000);

function showUpdate(yes) {
    setHidden('updatefields', !yes);
    setHidden('formfields',    yes);
}
function newSession() {
    document.getElementById("session").value = currentDateTime();
    document.getElementById("time").value = "";
    document.getElementById("timer").value = "";
    document.getElementById("try").value = 1;
    document.getElementById("systolic").focus();
}
function trim(str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}
function setTime() {
    if (trim(document.getElementById("time").value) === "") {
        var date = new Date();
        document.getElementById("time").value = currentTime(date);
        document.getElementById("timestamp").value = currentDateTime(date);
        document.getElementById("timer").value = 0;
    }
}
function updateTimer() {
    if (document.getElementById("timer").value !== "") {
        document.getElementById("timer").value = parseInt(document.getElementById("timer").value) + 1;
    }
}
function send(ev) {
    var parameters = createParameters('save');
    /*
     * If there is an event it is a key press and in this case discard the key and
     * treat it as a click on the Send button;
     */
    if (ev !== undefined)
        ev.preventDefault();
    if (!checkIntegerField("systolic", 0, 300))
        return;
    if (!checkIntegerField("diastolic", 0, 300))
        return;
    if (!checkIntegerField("pulse", 20, 300))
        return;
        
    parameters = addParameterById(parameters, 'identifier');
    parameters = addParameterById(parameters, 'timestamp');
    parameters = addParameterById(parameters, 'side');
    parameters = addParameterById(parameters, 'session');
    parameters = addParameterById(parameters, 'systolic');
    parameters = addParameterById(parameters, 'diastolic');
    parameters = addParameterById(parameters, 'pulse');
    parameters = addParameterById(parameters, 'orientation');
    parameters = addParameterById(parameters, 'comment');
        
    function processResponse() {
        document.getElementById("time").value = "";
        document.getElementById("timestamp").value = "";
        document.getElementById("systolic").value = "";
        document.getElementById("diastolic").value = "";
        document.getElementById("pulse").value = "";
        document.getElementById("orientation").value = "";
        document.getElementById("comment").value = "";
        document.getElementById("try").value = parseInt(document.getElementById("try").value) + 1;
        requestHistory();
    }
    ajaxLoggedInCall("Record", processResponse, parameters);
    document.getElementById("systolic").focus();
    return true;
}
function modify(deleteRow) {
    var parameters = createParameters(deleteRow? 'delete' : 'modify');
    
    if (!checkIntegerField("usystolic", 0, 300))
        return;
    if (!checkIntegerField("udiastolic", 0, 300))
        return;
    if (!checkIntegerField("upulse", 20, 300))
        return;

    parameters = addParameterById(parameters, 'ukindividual');
    parameters = addParameterById(parameters, 'uktimestamp');
    parameters = addParameterById(parameters, 'ukside');
    
    if (!deleteRow) {
        parameters = addParameterById(parameters, 'uindividual');
        parameters = addParameterById(parameters, 'utimestamp');
        parameters = addParameterById(parameters, 'uside');
        parameters = addParameterById(parameters, 'usession');
        parameters = addParameterById(parameters, 'usystolic');
        parameters = addParameterById(parameters, 'udiastolic');
        parameters = addParameterById(parameters, 'upulse');
        parameters = addParameterById(parameters, 'uorientation');
        parameters = addParameterById(parameters, 'ucomment');
    }
    function processResponse(response) {
        if (response.length >= 3) {
            alert(response);
            return true;
        }
        document.getElementById("ukindividual").value = "";
        document.getElementById("uktimestamp").value  = ""; 
        document.getElementById("ukside").value       = "Left";
        document.getElementById("uindividual").value  = "";
        document.getElementById("utimestamp").value   = "";
        document.getElementById("uside").value        = "Left";
        document.getElementById("usystolic").value    = "";
        document.getElementById("udiastolic").value   = "";
        document.getElementById("upulse").value       = "";
        document.getElementById("ucomment").value     = "";
        requestHistory();
        showUpdate(false);
    }
    ajaxLoggedInCall("Record", processResponse, parameters);
    document.getElementById("systolic").focus();
    return true;
}
function bpHistoryRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'Individual':
                document.getElementById('uindividual').value  = value;
                document.getElementById('ukindividual').value = value;
                break;
            case 'Session':
                document.getElementById('usession').value = value;
                break;
            case 'Timestamp':
                document.getElementById('utimestamp').value  = value;
                document.getElementById('uktimestamp').value = value;
                break;
            case 'Side':
                document.getElementById('uside').value  = value;
                document.getElementById('ukside').value = value;
                break;
            case 'Systolic':
                document.getElementById('usystolic').value = value;
                break;
            case 'Diastolic':
                document.getElementById('udiastolic').value = value;
                break;
            case 'Pulse':
                document.getElementById('upulse').value = value;
                break;
            case 'Orientation':
                document.getElementById('uorientation').value = value;
                break;
            case 'Comment':
                document.getElementById('ucomment').value = value;
                break;
        }
    }
    showUpdate(true);
}
function requestHistory() { 
    var parameters = createParameters('history');

    parameters = addParameterById(parameters, 'identifier');
    
    function processResponse(response) {
        loadJSONArray(response, "history", 20, "bpHistoryRowClick(this)");
    }
    ajaxLoggedInCall("Record", processResponse, parameters);
}
function updateOrientationList(name, dbField) {
    getList('Record', {name: name, field: dbField, table: 'MeasureOrientation', firstValue: ' ', async:false}); 
}
function initialize() {
    document.getElementById('secserver').value = 'Record';

    if (!serverAcceptingRequests('Record')) return;
    
    enableMySql('Record');
    newSession();
//    setInterval(updateTimer, 1000);
    updateOrientationList('orientation',  'Orientation');
    updateOrientationList('uorientation', 'Orientation');
    requestHistory();
    showUpdate(false);
}

