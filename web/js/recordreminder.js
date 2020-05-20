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
    document.getElementById("date").value        = "";
    document.getElementById("time").value        = "";
    document.getElementById("type").value        = "";
    document.getElementById("warndays").value    = "";
    document.getElementById("frequency").value   = "";
    document.getElementById("suspended").value   = "";
    document.getElementById("description").value = "";
    document.getElementById("comment").value     = "";
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
    parameters = addParameterById(parameters, 'refid');

    ajaxLoggedInCall('Reminder', processResponse, parameters, false);
    return valid;
}
function send() {
    var parameters;
    
    if (!fieldHasValue("date"))   return;
    
    if (document.getElementById("save").value === 'Create') {
        if (document.getElementById("refid").value === '') {
            document.getElementById("refid").value = createUID(4, 'AG');
            displayAlert('Warning', 'Ref Id auto generated. Resubmit to continue');
            return;
        } 
        if (!checkRefId()) return;
        
        parameters = createParameters('createreminder');
    } else
        parameters = createParameters('savereminder');

    parameters = addParameterById(parameters, 'refid');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'type');
    parameters = addParameterById(parameters, 'frequency');
    parameters = addParameterById(parameters, 'warndays');
    parameters = addParameterById(parameters, 'suspended');
    parameters = addParameterById(parameters, 'description');
    parameters = addParameterById(parameters, 'comment');

    ajaxLoggedInCall('Reminder', reset, parameters);
}
function deleteData() {
    var parameters = createParameters('deletereminder');

    parameters = addParameterById(parameters, 'refid');

    ajaxLoggedInCall('Reminder', reset, parameters);
}
function requestReminders(filter) {
    var parameters = createParameters('getreminders');

    function processResponse(response) {
        loadJSONArray(response, "reminders", {maxField: 19, onClick: "rowClick(this)"});
    }
    parameters = addParameterById(parameters, 'showall');
    
    if (filter === undefined) filter = hstFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('Reminder', processResponse, parameters);
}
function rowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value   = rdr.columnValue();
        
        switch (rdr.columnName()) {
            case 'RefId':
                document.getElementById("refid").value = value;
                break;            
            case 'Timestamp':
                var fields = value.split(" ");

                if (fields.length === 2) {
                    document.getElementById("date").value = fields[0];
                    document.getElementById("time").value = fields[1];
                }
                break;
            case 'Type':
                document.getElementById("type").value = value;
                break;
            case 'Frequency':
                document.getElementById("frequency").value = value;
                break;
            case 'WarnDays':
                document.getElementById("warndays").value = value;
                break;
            case 'Suspended':
                document.getElementById("suspended").value = value;
                break;
            case 'Description':
                document.getElementById("description").value = value;
                break;
            case 'Comment':
                document.getElementById("comment").value = value;
                break;
        }
    }
    document.getElementById("save").value = "Update";
    setHidden("clone",  false);
    setHidden("remove", false);
}
function initialize() {
    addIEFixClass([document.getElementsByTagName('body')[0]]);
    
    var types = 
            'Anniversary,' +
            'Birthday,'    +
            'Dentist,'     + 
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
        trigger:         document.getElementById('showfilter')});
    
    hstFilter.addFilter('Types',       'Type',     types);
    hstFilter.addFilter('Frequency',   'Frequency', 'Y,M', true);
    hstFilter.addFilter('Description', 'Description');
    /*
     * The remaining calls can execute asynchronously.
     */
    connectToServer('Reminder', 'loginframe', requestReminders);
}


