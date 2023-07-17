/* global getElement */

'use strict';

var timer;

function showUpdate(yes) {
    setHidden('insertfields', yes);
    setHidden('updatefields', !yes);
}
function newSession() {
    var ts = new Date();
    
    document.getElementById("session").value = currentDateTime(ts);
    document.getElementById("time").value = "";
    document.getElementById("timer").value = "";
    document.getElementById("try").value = 1;
    document.getElementById("systolic").focus();
    
    return ts;
}
function setTime() {    
    if (trim(document.getElementById("time").value) === "") {
        var date       = new Date();
        var session    = null;
        var maxsession = getElement('maxsession').value === '' ? 25 : getElement('maxsession').value;
        
        if (document.getElementById("session").value !== "") session = toDate(document.getElementById("session").value);
        
        if (session === null || dateDiff(session, date, 'minutes') > maxsession) date = newSession();
        
        document.getElementById("time").value      = currentTime(date);
        document.getElementById("timestamp").value = currentDateTime(date);
        timer.start();
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
            displayAlert('Validation Error', response);
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
        loadJSONArray(response, "history", {maxField: 19, onClick: "bpHistoryRowClick(this)"});
    }
    ajaxLoggedInCall("Record", processResponse, parameters);
}
function updateOrientationList(name, dbField) {
    getList('Record', {name: name, field: dbField, table: 'MeasureOrientation', firstValue: ' ', async:false, allowBlank: true}); 
}
function initialize(loggedIn) {  
    if (!loggedIn) return;
    
    timer = new Timer(document.getElementById("timer"));
 //   newSession();
    updateOrientationList('orientation',  'Orientation');
    updateOrientationList('uorientation', 'Orientation');
    getList('Record', {name: "commentList", table: 'Measure', field: 'Comment', firstValue: ' ', async:false, allowBlank: true});
    requestHistory();
    showUpdate(false);
    getElement('maxsession').value = 25;
}

