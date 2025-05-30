'use strict';

var txnFilter;
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
    var amount     = document.getElementById("pamount").value;
    
    if (frRate === '' || toRate === '' || frRate === toRate || amount === '') {
        setHidden('exchangerate', true);
        return;
    }
    parameters = addParameter(parameters, 'from',   frRate);
    parameters = addParameter(parameters, 'to',     toRate);
    parameters = addParameter(parameters, 'amount', amount);
    
    function processResponse(json) {
        try {
            if (typeof json === 'string') json = (new JSONReader(json)).getJSON();
            
            document.getElementById('exsource').value = json.getMember('Source', true).value;
            document.getElementById('examount').value = json.getMember('Amount', true).value;
            loadDateTime((json.getMember('Timestamp', true).value).split(" "), 'exdate', 'extime');
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
    setHidden("setappendafter", !on);
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
/*
 * This function was originally name reset. However, this stops it from being call by an HTML event handler as
 * the HTML built in function with the same name is called.
 */
function resetTxn() {
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
        resetTxn();
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

    ajaxLoggedInCall('BankTransaction', resetTxn, parameters);
}
function btTransactionsRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'TXN Id':
                document.getElementById('txnid').value  = value;
                break;
            case 'Description':
                document.getElementById('tdescription').value  = value;
                document.getElementById('pdescription').value = value;
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
        }
        document.getElementById('optupdate').value = "update";
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
function requestTransactions(filter) {
    var parameters = createParameters('transactions');

    function processResponse(response) {
        loadJSONArray(response, "transactions", 
            {onClick: "btTransactionsRowClick(this)", 
             columns: [
                 {name: 'TXN Id', minSize: 8, maxSize: 8},
                 {name: 'Fee',    maxSize: 4},
                 {name: 'Type',   maxSize:10}
             ]});
    }
    if (filter === undefined) filter = txnFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('BankTransaction', processResponse, parameters);
}
function requestAccounts() { 
    var parameters = createParameters('accounts');
    
    function processResponse(response) {
        loadJSONArray(response, "accounts",  {onClick: "btAccountsRowClick(this)"});
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
}
function initialize(loggedIn) {
    var action = document.getElementById('action');
    var response;
    /*
     * This is to test adding a style sheet to a frame.
     */
    addStyleSheetToiFrame('loginframe', 'css/rcdtxnlogin.css');
    
    if (!loggedIn) return;
    
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
    
    txnFilter = getFilter('filter1', document.getElementById('filter'), requestTransactions, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Filter Transactions',
        forceGap:        '4px',
        popup:           true});
    response = getList('BankTransaction', {
        table:        "Account",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowBlank:   true},
        true);
    txnFilter.addFilter('Accounts', {name: 'Account', values: response});
    response = getList('BankTransaction', {
        name:         "pcurrency",
        table:        "Currency",
        field:        "Designation",
        keepValue:    true,
        defaultValue: "GBP",
        async:        false},
        true);
    txnFilter.addFilter('Currencies', {name: 'Currency', values: response});
    loadSelect(
            'scurrency',
            response, {
                keepValue:    true,
                async:        false,
                allowBlank:   true});
    response = getList('BankTransaction', {
        name:         "txntype",
        table:        "BankTransactionType",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowBlank:   true},
        true);
    txnFilter.addFilter('Types', {name: 'Type', values: response});
    response = getList('BankTransaction', {
        name:         "txnusage",
        table:        "AccountUsage",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowBlank:   true},
        true);
    txnFilter.addFilter('Usages',      {name: 'Usage', values: response});
    txnFilter.addFilter('Description', {name: 'Description'});
    requestAccounts();
    resetTxn();
}



