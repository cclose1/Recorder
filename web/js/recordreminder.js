/* global reporter */

'use strict';

var hstFilter;
var mysql;
var snFlds    = null;
var csTab     = null;

function setTime() {
    let date = new Date();

    if (trim(snFlds.getValue("Timestamp~Date")) === "") {
        snFlds.setValue("Timestamp~Date", currentDate(date));
    }
    if (trim(snFlds.getValue("Timestamp~Time")) === "") {
        snFlds.setValue("Timestamp~Time", currentTime(date));
    }
}
function reset() {        
    snFlds.clear();
    getElement("save").value = "Create";
    getElement("type").focus();
    setHidden("clone",  true);
    setHidden("remove", true);
    requestReminders();
}
function clonedata() {
    setHidden("clone", true);
    setHidden("remove", true);
    getElement("save").value = "Create";
    snFlds.setValue("Timestamp~Time", currentTime(new Date()));
}
function checkRefId() {
    var valid      = true;
    var parameters = createParameters('checkrefid');

    function processResponse(response) {
        if (!loggedIn) return;
    }
    parameters = addParameterById(parameters, 'refid');

    ajaxLoggedInCall('Reminder', processResponse, parameters, false);
    return valid;
}
function send() {
    var action = getElement().value;
    var parameters; 

    if (!snFlds.isValid(csTab))      return;
    
    
    switch (action) {
        case 'Create':
            if (getElement('refid').value === '') {
                getElement('refid').value = createUID(4, 'AG');
                displayAlert('Warning', 'Ref Id auto generated. Resubmit to continue');
            }
            if (!checkRefId()) return;
            
            action = 'createTableRow';
            break;
        case 'Update':
            action = 'updateTableRow';
            break;
        case 'Delete':
            action = 'deleteTableRow';
            break; 
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');       
    }    
    parameters = createParameters(
                action,
                {
                    fields: snFlds.getFields(),
                    initialParams: [{name: 'table', value: 'Reminder'}]}); 
    ajaxLoggedInCall('Reminder', reset, parameters);
}
function requestReminders(filter) {
    var parameters = createParameters('getreminders');

    function processResponse(response) {
        loadJSONArray(response, "reminders", {onClick: "rowClick(this)"});
    }
    parameters = addParameterById(parameters, 'showall');
    
    if (filter === undefined) filter = hstFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('Reminder', processResponse, parameters);
}
function rowClick(row) {
    var rdr  = new rowReader(row);
    
    while (rdr.nextColumn()) {        
        if (rdr.columnName() !== 'Weekday') snFlds.setValue(rdr.columnName(), rdr.columnValue());
    }
    getElement("save").value = "Update";
    setHidden("clone",  false);
    setHidden("remove", false);
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    csTab  = getTableDefinition('Reminder', 'Reminder');
    snFlds = new ScreenFields('detailfields');
    snFlds.syncWithTable('csTab', false);
    
    var types = 
            'Anniversary,' +
            'Birthday,'    +
            'Car,     '    +
            'Dentist,'     + 
            'Delivery,'    + 
            'Health,'      +
            'Insurance,'   +
            'Maintenance,' +
            'Meeting,'     +
            'Social';
    
    reporter.setFatalAction('console');
    
    loadListResponse(types, {
        name:         "type",
        keepValue:    true,
        async:        false,
        allowBlank:   true});
    hstFilter = getFilter('filter1', document.getElementById('filterframe'), requestReminders, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Filter Reminders',
        forceGap:        '4px',
        popup:           true});
    
    hstFilter.addFilter('Types',       {name: 'Type',      values: types});
    hstFilter.addFilter('Frequency',   {name: 'Frequency', values: 'Y,M'});
    hstFilter.addFilter('Description', {name: 'Description'});
    requestReminders();
}


