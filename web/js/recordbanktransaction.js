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
                if (document.getElementById('pcurrency').value === document.getElementById('scurrency').value)
                    document.getElementById('scurrency').value = '';
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
    
    if (document.getElementById("txntype").value === "") document.getElementById("txntype").value = value;
}
function reset() {
    document.getElementById("seqno").value       = "";
    document.getElementById("date").value        = "";
    document.getElementById("time").value        = "";
    document.getElementById("paccount").value    = "";
    document.getElementById("pcurrency").value   = "GBP";
    document.getElementById("pamount").value     = "";  
    document.getElementById("saccount").value    = "";
    document.getElementById("scurrency").value   = "";
    document.getElementById("samount").value     = "";  
    document.getElementById("description").value = "";  
    document.getElementById("save").value        = "Create";
    document.getElementById("paccount").focus();
    setHidden("clone", true);
    setHidden("remove", true);
    setAction("Debit");
    document.getElementById("txntype").value = "";  
    requestTransactions();
}
function send() {
    var parameters = createParameters(document.getElementById("save").value = 'Create' ? 'create' : 'update');
    
    if (!fieldHasValue("date"))           return;
    if (!fieldHasValue("time"))           return;
    if (!fieldHasValue("paccount"))       return;
    if (!fieldHasValue("pcurrency"))      return;
    if (!checkIntegerField("pamount", 0)) return;
    
    var amount = document.getElementById("pamount").value;
    
    parameters = addParameterById(parameters, 'seqno');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'paccount');    
    parameters = addParameterById(parameters, 'pcurrency'); 
    parameters = addParameterById(parameters, 'txntype');
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
            if (!fieldHasValue("saccount")) return;
            
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
    var i;
    var h = document.getElementById(row.parentNode.parentNode.id).rows[0];
    
    for (i = 0; i < h.cells.length; i++) {
        var colName = h.cells[i].innerHTML;

        switch (colName) {
            case 'SeqNo':
                document.getElementById('seqno').value  = row.cells[i].innerText;
                break;
            case 'Timestamp':
                loadDateTime(row.cells[i].innerText.split(" "));
                break;
            case 'Account':
                document.getElementById('paccount').value = row.cells[i].innerText;
                break;
            case 'Amount':
                var amount = row.cells[i].innerText;
                
                if (amount < 0) {
                    setAction("Debit");
                    document.getElementById('pamount').value = -amount;
                } else {
                    setAction("Credit");
                    document.getElementById('pamount').value = amount;                    
                }                
                break;
            case 'Currency':
                document.getElementById('pcurrency').value = row.cells[i].innerText;
                break;
            case 'Type':
                document.getElementById('txntype').value = row.cells[i].innerText;
                break;
            case 'Description':
                document.getElementById('description').value = row.cells[i].innerText;
                break;
        }
    }
    document.getElementById("save").value = "Update";
    setHidden("clone", false);
    setHidden("remove", false);
}
function btAccountsRowClick(row) {
    var i;
    var account;
    var h = document.getElementById(row.parentNode.parentNode.id).rows[0];
    
    for (i = 0; i < h.cells.length; i++) {
        var colName = h.cells[i].innerHTML;

        switch (colName) {
            
            case 'Account':
                account = row.cells[i].innerText;
                
                if (document.getElementById('paccount').value === "") {
                    document.getElementById('paccount').value = account;
                    checkCurrencyField('paccount');
                } else if (document.getElementById('saccount').value === "" && document.getElementById('action').value === 'Transfer') {
                    document.getElementById('saccount').value = account;
                    checkCurrencyField('saccount');
                } else {
                    document.getElementById('paccount').value = account;
                    checkCurrencyField('saccount');
                }
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
            
    document.getElementById('secserver').value = 'BankTransaction';

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
    requestTransactions();
    requestAccounts();
    reset();
}



