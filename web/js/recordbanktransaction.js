'use strict';

var selectedAccount;
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function copyCurrencyField(id) {
    document.getElementById("s" + id).value    = document.getElementById("p" + id).value;
    document.getElementById("s" + id).disabled = true;
}
function setTransferCurrency(id) {
    if (document.getElementById('pcurrency').value === document.getElementById('scurrency').value)
        copyCurrencyField("amount");
    else {
        document.getElementById('samount').disabled = false;
    }
}
function getRateData() {    
    var parameters = createParameters('getRateData');
    var frRate     = document.getElementById("pcurrency").value;
    var toRate     = document.getElementById("scurrency").value;
    var amount     = document.getElementById("pamount").value
    
    if (frRate === '' || toRate === '' || frRate === toRate || amount === '') {
        setHidden('exchangerate', true);
        return;
    }
    parameters = addParameter(parameters, 'from',   frRate);
    parameters = addParameter(parameters, 'to',     toRate);
    parameters = addParameter(parameters, 'amount', amount);
    
    function processResponse(response) {
        var symbol;
        
        try {
            var jObj = new jsonObject(response);
            
            while ((symbol = jObj.symbol()) !== null) {
                switch (symbol.name) {
                    case "Source":
                        document.getElementById('exsource').value = symbol.value;
                        break;
                    case "Amount":
                        document.getElementById('examount').value = symbol.value;
                        break;
                    case "Timestamp":
                        loadDateTime(symbol.value.split(" "), 'exdate', 'extime');
                        break;
                }
            }
            setHidden('exchangerate', false);
        } catch (err) {
            alert("getRateData error-" + err.message);
        }
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
    return true;
}
function isCryptoCurrency(id) {
    var value = document.getElementById(id).value;
    
    return (value === 'BTC' || value === 'mBTC' || value === 'ETH' || value === 'XRP');
}
function checkCurrencyField(id) {
    var transfer = document.getElementById('action').value === 'Transfer';
    var exchange = document.getElementById('action').value === 'Exchange';

    setHidden('pcryptoaddress', !(isCryptoCurrency('pcurrency')));
    setHidden('scryptoaddress', !(isCryptoCurrency('scurrency')));
    
    if (!(transfer || exchange))
        return;

    if (!hasValue(id))
        id = event.srcElement.id;

    if (exchange) {
        switch (id) {
            case 'paccount':
                copyCurrencyField("account");
                break;
            case 'pcurrency':
            case 'scurrency':
                if (document.getElementById('pcurrency').value === document.getElementById('scurrency').value) {
                    displayAlert('Validation Failure', 'Currency must be different from ' + (id === 'pcurrency'? 'Secondary' : 'Primary') + ' Account', {focus: event.srcElement});
                    document.getElementById('scurrency').value = '';
                }
                break;
        }
    } else {
        switch (id) {
            case 'paccount':
                if (document.getElementById('paccount').value === document.getElementById('saccount').value)
                    document.getElementById('saccount').value = '';
                break;
            case 'saccount':
                if (document.getElementById('paccount').value === document.getElementById('saccount').value)
                    document.getElementById('paccount').value = '';
        }
        setTransferCurrency(id);
    }
    getRateData();
}
function clearCurrencyField(id) {
    document.getElementById(id).value    = "";
    document.getElementById(id).disabled = false;
}
function setCreate(on) {
    setHidden("clone",           on);
    setHidden("remove",          on);
    setHidden("setappendafter", !on)
    document.getElementById("save").value  = on? "Create" : "Update";        
}
function setUpdateOption() {    
    if (document.getElementById("optappend").checked) {
         document.getElementById("line").value         = "";
         document.getElementById("pfee").value         = "";
         document.getElementById("pamount").value      = "";
         document.getElementById("pdescription").value = "";
         document.getElementById("paddress").value     = "";
         setCreate(true);
    }
    setHidden("updateaction", true);
}
function setAction(value) {    
    if (hasValue(value))
        document.getElementById("action").value = value;
    else
        value = document.getElementById("action").value;
    
    var transfer = value === 'Transfer';    
    var exchange = value === 'Exchange';
    
    setHidden("secondaryaccount", !(transfer || exchange));
    setHidden("exchangerate",     true);
    clearCurrencyField("saccount");
    clearCurrencyField("samount");
    clearCurrencyField("scurrency");
    document.getElementById("pdescription").value = "";
    document.getElementById("sdescription").value = "";

    if (document.getElementById("txntype").value === "" || indexOfOption(document.getElementById("action"), document.getElementById("txntype").value) !== -1) document.getElementById("txntype").value = document.getElementById("action").value;
    
    if (transfer) {        
        document.getElementById("scurrency").value = document.getElementById("pcurrency").value;
        checkCurrencyField("paccount");
    }
}
function reset() {
    document.getElementById("line").value         = "";
    document.getElementById("cdate").value        = "";
    document.getElementById("ctime").value        = "";
    document.getElementById("pamount").value      = "";  
    document.getElementById("pfee").value         = "";  
    document.getElementById("sfee").value         = "";  
    document.getElementById("samount").value      = "";  
    document.getElementById("exsource").value     = "";
    document.getElementById("exdate").value       = "";    
    document.getElementById("extime").value       = ""; 
    document.getElementById("examount").value     = "";   
    document.getElementById("pdescription").value = "";
    document.getElementById("paddress").value     = "";  
    document.getElementById("sdescription").value = "";
    document.getElementById("saddress").value     = "";  
    
    if (!document.getElementById("appendafter").checked) {
        document.getElementById("txnid").value        = "";
        document.getElementById("date").value         = "";
        document.getElementById("time").value         = "";
        document.getElementById("paccount").value     = "";
        document.getElementById("pcurrency").value    = "GBP";
        document.getElementById("saccount").value     = "";
        document.getElementById("scurrency").value    = "";
        document.getElementById("txntype").value      = ""; 
        document.getElementById("txnusage").value     = ""; 
        document.getElementById("tdescription").value = "";
        setHidden("pcryptoaddress", true);
        setHidden("scryptoaddress", true);      
        setAction("Debit");
        document.getElementById("paccount").focus();
    } else
         document.getElementById("pamount").focus();
    document.getElementById("appendafter").checked = false;
    setHidden("updateaction",   true);  
    setCreate(true);
    selectedAccount = 'paccount';
    requestTransactions();
}
/*
 * Added this as defining reset for the onclick for element clear in RecordBankTransaction.html did not invoke the function.
 * Unable to find the underlying reason.
 * 
 * @returns {undefined}
 */
function resetTxn() {
    reset();
}
function send() {
    var parameters = createParameters('create');
    
    if (!checkDateTime("date",  "time",  true))  return;
    if (!checkDateTime("cdate", "ctime", false)) return;
    if (!fieldHasValue("paccount"))              return;
    if (!fieldHasValue("pcurrency"))             return;
    if (!checkIntegerField("pamount", 0))        return;
    
    var amount = document.getElementById("pamount").value;
    
    parameters = addParameterById(parameters, 'txnid');
    parameters = addParameterById(parameters, 'line');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'cdate');
    parameters = addParameterById(parameters, 'ctime');
    parameters = addParameterById(parameters, 'paccount');
    parameters = addParameterById(parameters, 'pfee');       
    parameters = addParameterById(parameters, 'pcurrency'); 
    parameters = addParameterById(parameters, 'txntype');
    parameters = addParameterById(parameters, 'txnusage');
    parameters = addParameterById(parameters, 'tdescription');
    parameters = addParameterById(parameters, 'pdescription');
    parameters = addParameterById(parameters, 'paddress');
    
    switch(document.getElementById("action").value) {
        case 'Credit':
            parameters = addParameter(parameters, 'pamount',  amount);
            parameters = addParameter(parameters, 'saddress', '');
            break
        case 'Debit':
            parameters = addParameter(parameters, 'pamount', '-' + amount);
            parameters = addParameter(parameters, 'saddress', '');
            break;
        case 'Transfer':
        case 'Exchange':
            if (!fieldHasValue("scurrency"))      return;
            if (!checkIntegerField("samount", 0)) return;
            
            parameters = addParameter(parameters, 'pamount', '-' + amount);
            parameters = addParameterById(parameters, 'saccount');
            parameters = addParameterById(parameters, 'sfee');
            parameters = addParameterById(parameters, 'samount');
            parameters = addParameterById(parameters, 'scurrency');
            parameters = addParameterById(parameters, 'sdescription');
            parameters = addParameterById(parameters, 'saddress');
            break;
    }
    function processResponse(response) {
        if (response.length > 2) {
            var fields = response.split('=');
            
            if (fields.length === 2 && fields[0] === "TXNId") {
                document.getElementById("txnid").value = fields[1];                
            } else {            
                displayAlert('Validation Failure', response);
                return;
            }
        }
        reset();
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
    return true;
}
function clonedata() {
    setCreate(false);
    document.getElementById("txnid").value = "";
    document.getElementById("line").value  = "";
    document.getElementById("date").value  = currentDate(new Date());
}
function deleteData() {
    var parameters = createParameters('delete');

    parameters = addParameterById(parameters, 'txnid');
    parameters = addParameterById(parameters, 'line');

    ajaxLoggedInCall('BankTransaction', reset, parameters);
}
function btTransactionsRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'TXNId':
                document.getElementById('txnid').value  = value;
                break;
            case 'TXNDescription':
                document.getElementById('tdescription').value  = value;
                break;
            case 'Line':
                document.getElementById('line').value  = value;
                break;
            case 'Timestamp':
                loadDateTime(value.split(" "));
                break;
            case 'Completed':
                loadDateTime(value.split(" "), "cdate", "ctime");
                break;
            case 'Account':
                document.getElementById('paccount').value = value;
                break;
            case 'AmountFull':
                var amount = value;
                
                if (amount < 0) {
                    setAction("Debit");
                    document.getElementById('pamount').value = -amount;
                } else {
                    setAction("Credit");
                    document.getElementById('pamount').value = amount;                    
                }                
                break;
            case 'FeeFull':
                document.getElementById('pfee').value = value;
                break;
            case 'Currency':
                document.getElementById('pcurrency').value = value;
                break;
            case 'Type':
                document.getElementById('txntype').value = value;
                break;
            case 'Usage':
                document.getElementById('txnusage').value = value;
                break;
            case 'Address':
                document.getElementById('paddress').value = value;
                break;
            case 'Description':
                document.getElementById('pdescription').value = value;
                break;
        }
        document.getElementById('optupdate').value = "update"
        setHidden("updateaction", false);
    }
    setCreate(false);
    setHidden('pcryptoaddress', !isCryptoCurrency('pcurrency'));
    setHidden('scryptoaddress', !isCryptoCurrency('scurrency'));
}
function btAccountsRowClick(row) {
    var primary = selectedAccount === 'paccount';
    var rdr     = new rowReader(row);
    
    while (rdr.nextColumn()) {
        switch (rdr.columnName()) {
            case 'Account':
                setDateTime();

                switch (document.getElementById('action').value) {
                    case 'Transfer':
                        if (document.getElementById(primary ? 'saccount' : 'paccount').value === rdr.columnValue()) {
                            displayAlert('Validation Error', 'Must be different from ' + (primary ? 'Secondary' : 'Primay') + ' Account', {focus: document.getElementById(selectedAccount)});
                            return false;
                        }
                        break;
                }
                document.getElementById(selectedAccount).value = rdr.columnValue();
                checkCurrencyField(selectedAccount);
                break;
        }
    }
}
function requestTransactions() { 
    var parameters = createParameters('transactions');
    var filter     = '';
    
    filter = addDBFilterField(filter, faccounts,    'Account');
    filter = addDBFilterField(filter, fcurrencies,  'Currency');
    filter = addDBFilterField(filter, fusages,      'Usage');
    filter = addDBFilterField(filter, fdescription, 'Description', 'like');
    
    if (filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    function processResponse(response) {
        loadJSONArray(response, "transactions", 20, "btTransactionsRowClick(this)", null, null, false, true);
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
}
function setFilter() {
    setHidden("filter", !document.getElementById("showfilter").checked);
}
function addFilterValue(element, value) {
    if (value === '') element.value = '';
    else if (element.value === '') element.value = value;
    else element.value += ',' + value;
}
function addFilterField() {
    var value = event.srcElement.value;
    
    switch (event.srcElement.id) {
        case 'fcurrency':
            addFilterValue(document.getElementById('fcurrencies'), value);
            break;
        case 'fusage':
            addFilterValue(document.getElementById('fusages'),     value);
            break;
        case 'faccount':
            addFilterValue(document.getElementById('faccounts'),   value);
            break;
        case 'fapply':
            requestTransactions();
            break;
        case 'fclear':
            document.getElementById('faccount').value     = '';
            document.getElementById('faccounts').value    = '';
            document.getElementById('fcurrency').value    = '';
            document.getElementById('fcurrencies').value  = '';
            document.getElementById('fusage').value       = '';
            document.getElementById('fusages').value      = '';
            document.getElementById('fdescription').value = '';
            requestTransactions();
            break;
    }
}
function requestAccounts() { 
    var parameters = createParameters('accounts');
    
    function processResponse(response) {
        loadJSONArray(response, "accounts", 20, "btAccountsRowClick(this)", null, null, false, true);
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
}
function initialize() {
    var action = document.getElementById('action');
    var response;
    
    action.innerHTML = "";
    /*
     * Setting the options in the HTML action element seems to disable setting the value by doing the following assignment.
     *     document.getElementById('action').value = "Debit";
     */
    addOption(action, 'Credit');
    addOption(action, 'Debit');
    addOption(action, 'Transfer');
    addOption(action, 'Exchange');
    setAction('Debit');
            
    if (!serverAcceptingRequests('BankTransaction')) return;
    
    enableMySql('BankTransaction');
    response = getList('BankTransaction', {
        name:         "pcurrency",
        table:        "Currency",
        field:        "Designation",
        keepValue:    true,
        defaultValue: "GBP",
        async:        false},
        true);
    loadListResponse(response, {
        name:         "scurrency",
        keepValue:    true,
        async:        false,
        allowblank:   true});
    loadListResponse(response, {
        name:         "fcurrency",
        keepValue:    true,
        async:        false,
        allowblank:   true});
    getList('BankTransaction', {
        name:         "txntype",
        table:        "BankTransactionType",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowblank:   true});
    response = getList('BankTransaction', {
        name:         "txnusage",
        table:        "AccountUsage",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowblank:   true},
        true);
    loadListResponse(response, {
        name:         "fusage",
        keepValue:    true,
        async:        false,
        allowblank:   true});
    getList('BankTransaction', {
        name:         "faccount",
        table:        "Account",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowblank:   true});
    requestAccounts();
    reset();
}



