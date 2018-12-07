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
function checkCurrencyField(id) {
    var transfer = document.getElementById('action').value === 'Transfer';
    var exchange = document.getElementById('action').value === 'Exchange';

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
}
function clearCurrencyField(id) {
    document.getElementById(id).value    = "";
    document.getElementById(id).disabled = false;
}
function setAction(value) {    
    if (hasValue(value))
        document.getElementById("action").value = value;
    else
        value = document.getElementById("action").value;
    
    var transfer = value === 'Transfer';    
    var exchange = value === 'Exchange';
    
    setHidden("secondaryaccount", !(transfer || exchange));
    clearCurrencyField("saccount");
    clearCurrencyField("samount");
    clearCurrencyField("scurrency");
    document.getElementById("description").value = "";

    if (document.getElementById("txntype").value === "" || indexOfOption(document.getElementById("action"), document.getElementById("txntype").value) !== -1) document.getElementById("txntype").value = document.getElementById("action").value;
    
    if (transfer) {        
        document.getElementById("scurrency").value = document.getElementById("pcurrency").value;
        checkCurrencyField("paccount");
    }
}
function reset() {
    document.getElementById("seqno").value       = "";
    document.getElementById("date").value        = "";
    document.getElementById("time").value        = "";
    document.getElementById("cdate").value       = "";
    document.getElementById("ctime").value       = "";
    document.getElementById("paccount").value    = "";
    document.getElementById("pcurrency").value   = "GBP";
    document.getElementById("pamount").value     = "";  
    document.getElementById("pfee").value     = "";  
    document.getElementById("saccount").value    = "";
    document.getElementById("scurrency").value   = "";
    document.getElementById("samount").value     = "";  
    document.getElementById("txntype").value     = "";  
    document.getElementById("txnusage").value     = "";  
    document.getElementById("description").value = "";  
    document.getElementById("save").value        = "Create";
    document.getElementById("paccount").focus();
    setHidden("clone", true);
    setHidden("remove", true);
    setAction("Debit");
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
    
    parameters = addParameterById(parameters, 'seqno');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'cdate');
    parameters = addParameterById(parameters, 'ctime');
    parameters = addParameterById(parameters, 'paccount');
    parameters = addParameterById(parameters, 'pfee');       
    parameters = addParameterById(parameters, 'pcurrency'); 
    parameters = addParameterById(parameters, 'txntype');
    parameters = addParameterById(parameters, 'txnusage');
    parameters = addParameterById(parameters, 'description');
    
    switch(document.getElementById("action").value) {
        case 'Credit':
            parameters = addParameter(parameters, 'pamount', amount);
            break
        case 'Debit':
            parameters = addParameter(parameters, 'pamount', '-' + amount);
            break;
        case 'Transfer':
        case 'Exchange':
            if (!fieldHasValue("scurrency"))      return;
            if (!checkIntegerField("samount", 0)) return;
            
            parameters = addParameter(parameters, 'pamount', '-' + amount);
            parameters = addParameterById(parameters, 'saccount');
            parameters = addParameterById(parameters, 'samount');
            parameters = addParameterById(parameters, 'scurrency');
            break;
    }
    function processResponse(response) {
        if (response.length > 2) {
            displayAlert('Validation Failure', response);
            return;
        }
        reset();
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
    return true;
}
function clonedata() {
    setHidden("clone", true);
    setHidden("remove", true);
    document.getElementById("save").value = "Create";
    document.getElementById("seqno").value = "";
    document.getElementById("date").value = currentDate(new Date());
}
function deleteData() {
    var parameters = createParameters('delete');

    parameters = addParameterById(parameters, 'seqno');

    ajaxLoggedInCall('BankTransaction', reset, parameters);
}
function btTransactionsRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'SeqNo':
                document.getElementById('seqno').value  = value;
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
            case 'Amount':
                var amount = value;
                
                if (amount < 0) {
                    setAction("Debit");
                    document.getElementById('pamount').value = -amount;
                } else {
                    setAction("Credit");
                    document.getElementById('pamount').value = amount;                    
                }                
                break;
            case 'Fee':
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
            case 'Description':
                document.getElementById('description').value = value;
                break;
        }
    }
    document.getElementById("save").value = "Update";
    setHidden("clone", false);
    setHidden("remove", false);
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
    
    function processResponse(response) {
        loadJSONArray(response, "transactions", 20, "btTransactionsRowClick(this)");
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
}
function requestAccounts() { 
    var parameters = createParameters('accounts');
    
    function processResponse(response) {
        loadJSONArray(response, "accounts", 20, "btAccountsRowClick(this)");
    }
    ajaxLoggedInCall("BankTransaction", processResponse, parameters);
}
function initialize() {
    var action = document.getElementById('action');
    
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
    getList('BankTransaction', {
        name:         "pcurrency",
        table:        "Currency",
        field:        "Designation",
        keepValue:    true,
        defaultValue: "GBP",
        async:        false});
    getList('BankTransaction', {
        name:         "scurrency",
        table:        "Currency",
        field:        "Designation",
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
    getList('BankTransaction', {
        name:         "txnusage",
        table:        "AccountUsage",
        field:        "Code",
        keepValue:    true,
        async:        false,
        allowblank:   true});
    requestTransactions();
    requestAccounts();
    reset();
}



