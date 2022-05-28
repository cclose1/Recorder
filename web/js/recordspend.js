'use strict';

var hstFilter;

function reset() {
    document.getElementById("seqno").value       = "";
    document.getElementById("date").value        = "";
    document.getElementById("time").value        = "";
    document.getElementById("type").value        = "";
    document.getElementById("location").value    = "";
    document.getElementById("description").value = "";
    document.getElementById("amount").value      = "";    
    document.getElementById("payment").value     = "Cash";  
    document.getElementById("period").value      = "";  
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
function checkServerTimestamp() {
    var valid      = true;
    var parameters = createParameters('checktimestamp');

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
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'seqno');

    ajaxLoggedInCall('Spend', processResponse, parameters, false);
    return valid;
}
function send() {
    if (!fieldHasValue("date"))   return;
    if (!fieldHasValue("amount")) return;
    if (!checkServerTimestamp())  return;

    var parameters = createParameters('savespend');

    parameters = addParameterById(parameters, 'seqno');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'category');
    parameters = addParameterById(parameters, 'type');
    parameters = addParameterById(parameters, 'location');
    parameters = addParameterById(parameters, 'description');
    parameters = addParameterById(parameters, 'amount');
    parameters = addParameterById(parameters, 'payment');
    parameters = addParameterById(parameters, 'period');
    parameters = addParameterById(parameters, 'correction', 'bankcorrection');

    ajaxLoggedInCall('Spend', reset, parameters);
}
function deleteData() {
    var parameters = createParameters('deletespend');

    parameters = addParameterById(parameters, 'seqno');

    ajaxLoggedInCall('Spend', reset, parameters);
}
function requestHistory(filter) {
    var parameters = createParameters('spendhistory');

    function processResponse(response) {
        loadJSONArray(response, "history", {maxField: 19, onClick: "rowClick(this)", columns: [{name: 'Amount', minWidth: 6}]});
    }
    if (filter === undefined) filter = hstFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('Spend', processResponse, parameters);
}
function requestSummary() {
    var parameters = createParameters('summaryfields');

    function processResponse(response) {
        document.getElementById("DailyRate").value = "";
        document.getElementById("Essential").value = "";
        document.getElementById("Necessary").value = "";
        document.getElementById("Discretionary").value = "";
        document.getElementById("MonthSpend").value = "";
        document.getElementById("YearEstimate").value = "";
        loadJSONFields(response, false);
    }
    ajaxLoggedInCall('Spend', processResponse, parameters);
}
function updateFilteredLists() {
    var filter = '';
            
    filter = addDBFilterField(filter, document.getElementById("category"), 'Category', 'quoted');
    filter = addDBFilterField(filter, document.getElementById("type"),     'Type',     'quoted');
    getList('Spend', {name: "locationList",    table: 'SpendData', field: 'Location',    filter: filter});
    getList('Spend', {name: "descriptionList", table: 'SpendData', field: 'Description', filter: filter});
}
function rowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value   = rdr.columnValue();
        
        switch (rdr.columnName()) {
            case 'SeqNo':
                document.getElementById("seqno").value = value;
                break;
            case 'Timestamp':
                var fields = value.split(" ");

                if (fields.length === 2) {
                    document.getElementById("date").value = fields[0];
                    document.getElementById("time").value = fields[1];
                }
                break;
            case 'Category':
                document.getElementById("category").value = value;
                break;
            case 'Type':
                document.getElementById("type").value = value;
                break;
            case 'Location':
                document.getElementById("location").value = value;
                break;
            case 'Description':
                document.getElementById("description").value = value;
                break;
            case 'Amount':
                document.getElementById("amount").value = value;
                break;
            case 'Payment':
                document.getElementById("payment").value = value;
                break;
            case 'Period':
                document.getElementById("period").value = value;
                break;
            case 'Correction':
                document.getElementById("correction").value = value;
                break;
        }
    }
    document.getElementById("save").value = "Update";
    setHidden("clone", false);
    setHidden("remove", false);
}
function loadOption(options, type, defaultValue) {
    var response;
    
    response = getList('Spend', {
        table:        'ListValues',
        name:         options,
        field:        'Value',
        filter:       "Type='" + type + "'",
        keepValue:    true,
        defaultValue: defaultValue,
        async:        false},
        true);
    
    return response;
}
function initialize() {
    var response;
    
    addIEFixClass([document.getElementsByTagName('body')[0]]);
    
    reporter.setFatalAction('console');
    
    hstFilter = getFilter('filter1', document.getElementById('filterframe'), requestHistory, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Filter Spend',
        forceGap:        '4px',
        trigger:         document.getElementById('showfilter')});
    
    response = loadOption('category', 'Category', 'Discretionary');
    hstFilter.addFilter('Categories', 'Category', response);
    response = loadOption('type', 'Type', 'Food');
    hstFilter.addFilter('Types',       'Type',     response);
    hstFilter.addFilter('Weekdays',    'Weekday', 'Sun,Mon,Tue,Wed,Thu,Fri,Sat');
    hstFilter.addFilter('Description', 'Description');
    hstFilter.addFilter('Location',    'Location,text');
    hstFilter.addFilter('Amount',      'Amount,number');
    /*
     * The remaining calls can execute asynchronously.
     */
    loadOption('payment', 'Payment', 'Cash');
    updateFilteredLists();
    requestHistory();
    requestSummary();
}


