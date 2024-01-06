/* global reporter */

'use strict';

var hstFilter;
var mysql;

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
function reset() {    
    clearValues(getParameters('detailfields'));
    document.getElementById("save").value        = "Create";
    document.getElementById("type").focus();
    setHidden("clone", true);
    setHidden("remove", true);
    requestReminders();
}
function clonedata() {
    setHidden("clone", true);
    setHidden("remove", true);
    document.getElementById("save").value = "Create";
    document.getElementById("date").value = currentDate(new Date());
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

    let flds       = getParameters('detailfields');   
    if (!fieldHasValue("date"))   return;
    
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
                    fields: flds,
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
    let flds = new ScreenFields('detailfields');
    
    flds.setIgnoreSet('Weekday');
    
    while (rdr.nextColumn()) {
        console.log('Att name ' + rdr.valueAttribute('name') + ' col name ' + rdr.columnName());
        flds.setValue(rdr.columnName(), rdr.columnValue());
    }
    document.getElementById("save").value = "Update";
    setHidden("clone",  false);
    setHidden("remove", false);
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    let test = ['name1', 'name2', 'name3'];
    let found = test.findIndex((element) => element === 'name2');
    found = test.findIndex((element) => element === 'xx');
    var types = 
            'Anniversary,' +
            'Birthday,'    +
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


