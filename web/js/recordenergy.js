/* global reporter, getElement */

'use strict';

var hstFilter;
function reset() {
    getElement("date").value        = "";
    getElement("time").value        = "";
    getElement("gas").value         = ""; 
    getElement("electric").value    = ""; 
    getElement("solar").value       = ""; 
    getElement("estimated").checked = false; 
    getElement("comment").value     = "";
    getElement("save").value        = "Create";                                               
    requestReadings();
}
function resetDelete(cancel) {
    if (!cancel) {
        if (getElement("copy").checked) {
            reset();
            copyElement("ddate",      "date");
            copyElement("dtime",      "time");
            copyElement("destimated", "estimated");
            copyElement("dcomment",   "comment");
            
            switch (getElement("dtype").value) {
                case "Gas":
                    copyElement("reading", "gas");
                    break;
                case "Electric":
                    copyElement("reading", "electric");
                    break;
                case "Solar":
                    copyElement("reading", "solar");
                    break;
            }
        }
        requestReadings();            
    }
    getElement("ddate").value        = "";
    getElement("dtime").value        = "";
    getElement("dtype").value        = "";
    getElement("reading").value      = "";
    getElement("destimated").checked = false;
    getElement("copy").checked       = false;
    getElement("dcomment").value     = "";       
}
function send(action) {
    if (action === undefined) action = event.target.value;
    
    var parameters = createParameters(action);
   
    switch (action) {
        case "Create":
            if (!fieldHasValue("date")) return;
            
            parameters = addParameterById(parameters, 'date');
            parameters = addParameterById(parameters, 'time');
            parameters = addParameterById(parameters, 'gas',      'Gas');
            parameters = addParameterById(parameters, 'electric', 'Electric');
            parameters = addParameterById(parameters, 'solar',    'Solar');
            parameters = addParameterById(parameters, 'estimated');
            parameters = addParameterById(parameters, 'comment');
            break;
        case "Delete":
            if (!fieldHasValue("ddate")) return;
            
            parameters = addParameterById(parameters, 'ddate');
            parameters = addParameterById(parameters, 'dtime');
            parameters = addParameterById(parameters, 'dtype');
            break;
        case "Cancel":
            resetDelete(true);
            return;
            break;
        case "CancelCreate":
            reset();
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');            
    }

    function processResponse(response) {
        if (response.length > 2) {
            displayAlert('Validation Failure', response);
            return;
        }
        if (action === 'Delete')
            resetDelete(false);
        else
            reset();
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function requestReadings(filter) {
    var readings   = getElement('readings').value;
    var parameters = createParameters('readingshistory');

    function processResponse(response) {
        loadJSONArray(response, "history", {maxField: 19, onClick: "rowClick(this)"});
    }
    parameters = addParameter(parameters, 'readings', readings);
    
    if (filter === undefined) filter = hstFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function rowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value   = rdr.columnValue();
        
        switch (rdr.columnName()) {
            case 'Timestamp':
            case 'Start':
                var fields = value.split(" ");

                if (fields.length === 2) {
                    getElement("ddate").value = fields[0];
                    getElement("dtime").value = fields[1];
                }
                break;
            case 'Type':
                getElement("dtype").value        = value;
                getElement("labunits").innerHTML = value === 'Gas' ? 'Ft3' : 'Kwh';
                break;
            case 'Reading':
            case 'StartReading':
                getElement("reading").value = value;
                break;
            case 'Estimated':
            case 'StartEstimated':
                getElement("destimated").checked = value === 'Y';
                break;
            case 'Comment':
                getElement("dcomment").value = value;
                break;
        }
        getElement("copy").checked = false;
    }
}
function initialize(loggedIn) {    
    if (!loggedIn) return;
    
    reporter.setFatalAction('console');
    
    hstFilter = getFilter('filter1', getElement('filterframe'), requestReadings, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Filter Readings',
        forceGap:        '4px',
        trigger:         getElement('showfilter')});
    
    hstFilter.addFilter('Types',     'Type',      'Gas, Electric, Solar');
    hstFilter.addFilter('Estimated', 'Estimated', ', Y, N');
    requestReadings();
}
