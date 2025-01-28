/* global getElement */

'use strict';

var timer;
var insFlds = null;
var updFlds = null;

function showUpdate(yes) {
    setHidden('insertfields', yes);
    setHidden('updatefields', !yes);
}
function setSession(time) {    
    document.getElementById("session").value = currentDateTime(time);
    document.getElementById("time").value    = "";
    document.getElementById("timer").value   = "";
    document.getElementById("try").value     = 1;
    document.getElementById("systolic").focus();
    timer.start();
}
function getMaxSession() {
    return timer.maxGap() / 60;
}
/*
 * Returns the time in seconds between the start of the session and date.
 * 
 * -1 is returned if there is no session or the elapsed time exceeds the maximum session time.
 */
function getSessionElapsed(date) {
    var session = trim(getElement("session").value);
    var elapsed = -1;
    
    if (session !== "") {
        elapsed = dateDiff(session, date, 'seconds');
        
        if (elapsed > timer.maxGap) elapsed = -1;
    }
    return elapsed;
}
function setMaxSession() {
    timer.maxGap = 60 * getElement('maxsession').value;
}
function setTime() {    
    if (trim(getElement("time").value) === "") {
        var date = new Date();
        
        if (getSessionElapsed(date) < 0) setSession(date);
        
        getElement("time").value      = currentTime(date);
        getElement("timestamp").value = currentDateTime(date);
        timer.start(date);
    }
}
/*
 * The session timestamp of the latest entry in the measures history is compared to the current time.
 * 
 * If the gap is within the maximum session length, the session is restarted and true returned, otherwise
 * false is returned.
 * 
 * @returns {Boolean}
 */
function restartSession() {
    var time    = new Date();
    var hist    = getElement("history").rows;
    var session;
    var row;
    var side;
    var i = 2;
    
    if (hist.length === 1) return false;
    
    row     = new rowReader(hist[1]);
    session = row.getColumnValue("Session");
    
    if (dateDiff(session, time, 'seconds') > timer.maxGap) return false;
    
    time = toDate(row.getColumnValue("Timestamp"));
    side = row.getColumnValue("Side");
        
    setSession(toDate(session));
    
    while (i < hist.length) {
        row = new rowReader(hist[i]);
        
        if (row.getColumnValue("Session") !== session || row.getColumnValue("Side") !== side) break;
        
        i++;
    }
    getElement("side").value = side;
    getElement("try").value  = i;
    timer.start(time);
    
    return true;
}
function updateMeasure(action) {
    let flds = action === 'create'? insFlds : updFlds;
    
    let pars  = createParameters(
            action + 'TableRow',
            {
                fields:        flds.getFields(),
                initialParams: [{name: 'table', value: 'Measure'}]});
        
    function processResponse(response) {
        if (response.length > 2) {
            displayAlert("Validation Failure", response);
        }
        document.getElementById("time").value = "";
        
        if (action === 'create') {
            insFlds.clear('Session, Side, Individual');
            document.getElementById("try").value = parseInt(document.getElementById("try").value) + 1;
        } else
            showUpdate(false);
        
        requestHistory();
    }
    ajaxLoggedInCall("Record", processResponse, pars);
    document.getElementById("systolic").focus();
    return true;
}
function bpHistoryRowClick(row) {
    var rdr = new rowReader(row);
    
    rdr.loadScreenFields(updFlds, {mustExist:false, setKey:true});
    showUpdate(true);
}
function requestHistory(async) { 
    var parameters = createParameters('history');

    parameters = addParameterById(parameters, 'identifier');
    
    function processResponse(response) {
        loadJSONArray(response, "history", {usePrecision: true, onClick: "bpHistoryRowClick(this)"});
    }
    ajaxLoggedInCall("Record", processResponse, parameters, async);
}
function updateOrientationList(name, dbField) {
    getList('Record', {
        name:       name, 
        field:      dbField, 
        table:      'MeasureOrientation', 
        firstValue: ' ', 
        async:      false,
        allowBlank: true}); 
}
function initialize(loggedIn) {  
    if (!loggedIn) return;

    insFlds = new ScreenFields('insertfields');
    updFlds = new ScreenFields('updatefields');
    timer   = new Timer(document.getElementById("timer"));
    getElement('maxsession').value = 25;
    timer.maxGap = 60 * 25;
    updateOrientationList('orientation',  'Orientation');
    updateOrientationList('uorientation', 'Orientation');
    getList('Record', {
        name:       'commentList', 
        table:      'Measure', 
        field:      'Comment', 
        firstValue: ' ', 
        async:      false, 
        allowBlank: true});
    requestHistory(false);
    showUpdate(false);
    
    setMaxSession();
    restartSession();
}

