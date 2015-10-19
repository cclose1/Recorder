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
function getList1(server, options) {
    var parameters = createParameters('getList');

    parameters = addParameter(parameters, 'field', options.field === undefined ? options.name : options.field);
    
    if (options.filter !== undefined && options.filter) {
        parameters = addParameterById(parameters, 'category');
        parameters = addParameterById(parameters, 'type');        
    } 
    function processResponse(response) {
        loadOptionsJSON(response, options.name, options.keepValue, options.defaultValue);
    }
    ajaxLoggedInCall(server, processResponse, parameters, options.async);
}
function checkTimestamp() {
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
    if (!checkTimestamp())        return;

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
    parameters = addParameterById(parameters, 'correction', 'bankcorrection');

    ajaxLoggedInCall('Spend', reset, parameters);
}
function deleteData() {
    var parameters = createParameters('deletespend');

    parameters = addParameterById(parameters, 'seqno');

    ajaxLoggedInCall('Spend', reset, parameters);
}
function requestHistory() {
    var parameters = createParameters('spendhistory');

    function processResponse(response) {
        loadJSONArray(response, "history", 19, "rowClick(this)");
        document.getElementById("history").removeAttribute("hidden");
    }
    ajaxLoggedInCall('Spend', processResponse, parameters);
}
function requestSummary() {
    var parameters = createParameters('summaryfields');

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
    getList1('Spend', {name: "locationList",    field: "location",    filter: true});
    getList1('Spend', {name: "descriptionList", field: "description", filter: true});
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
    document.getElementById('secserver').value = 'Spend';
    
    if (!serverAcceptingRequests('Spend')) return;
    
    enableMySql('Spend');
    getList('Spend', {
        name:         "category",
        keepValue:    true,
        defaultValue: "Discretionary",
        async:        false});
    getList('Spend', {
        name:         "type",
        keepValue:    true,
        defaultValue: "Cafe",
        async:        false});
    /*
     * The remaining calls can execute asynchronously.
     */
    getList('Spend', {
        name:         "payment",
        keepValue:    true,
        defaultValue: "Cash"});
    updateFilteredLists();
    requestHistory("");
    requestSummary("");
}


