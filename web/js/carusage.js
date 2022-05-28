'use strict';

var sessionFilter/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function setSave(action) {
    var clear = true;
    var remove = true;
    
    switch (action) {
        case 'New':
            break;
        case 'Create':
            clear = false;
            break;
        case 'Update':
            clear = false;
            break;
        default:
            reporter.fatalError('carreg.js setSave action ' + action + ' is invalid');
    }
    setHidden("clear",  clear);
    setHidden("remove", remove);
    document.getElementById("save").value  = action;        
}
function requestChargeSessions(filter) {
    var parameters = createParameters('chargesessions');

    function processResponse(response) {
        loadJSONArray(response, 'chargesessionstable', {maxField: 19, onClick: 'btChargeSessionsRowClick(this)'});
        document.getElementById('chargesessionstable').removeAttribute('hidden');
    }
    if (filter === undefined) filter = sessionFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function reset() {
    document.getElementById("chargesource").value   = "";
    document.getElementById("carreg").value         = "";
    document.getElementById("sessioncomment").value = "";
    document.getElementById("mileage").value        = "";
    document.getElementById("sdate").value          = "";
    document.getElementById("stime").value          = "";
    document.getElementById("smiles").value         = "";
    document.getElementById("schargepc").value      = "";
    document.getElementById("edate").value          = "";
    document.getElementById("etime").value          = "";
    document.getElementById("emiles").value         = "";
    document.getElementById("echargepc").value      = "";
    document.getElementById("charge").value         = "";
    document.getElementById("cost").value           = "";
    
    requestChargeSessions();
    setSave('New');
}
/*
 * Calling reset from onclick in html does not seem to work. So introduced clear to use in html on handler. 
 * 
 * Maybe it is because reset is an input type, but why that should matter is not clear to me.
 */
function clearData() {
    reset();
}
function resetSessions() {
    reset();
}
function setNew() {
    var sessions = document.getElementById('chargesessionstable');
    
    if (sessions.tBodies[0].rows.length > 0) {
        /*
         * Set carreg and charge source from the first table row.
         */
        var row  = sessions.tBodies[0].rows[0];
        var cells = row.cells;
        
        for (var c = 0; c < cells.length; c++) {
            var cell  = cells[c];
            var value = cell.innerHTML;
            
            switch (cell.attributes.name.value) {
                case 'Source':
                    document.getElementById('chargesource').value  = value;
                    break;
                case 'CarReg':
                    document.getElementById('carreg').value  = value;
                    break;
            }
        }
        var i;
    }
    setDateTime('sdate', 'stime');
    setSave('Create');
}
function send() {
    var action = document.getElementById("save").value;

    var parameters = createParameters(action === 'Create' ? 'createsession' : 'updatesession');
    
    if (action === 'New') {
        setNew();
        return;
    }
    if (!checkDateTime("sdate", "stime", true))  return;
    if (!fieldHasValue("mileage"))               return;
    if (!checkDateTime("edate", "etime", false)) return;
    
    parameters = addParameterById(parameters, 'carreg');
    parameters = addParameterById(parameters, 'chargesource');    
    parameters = addParameterById(parameters, 'sessioncomment');
    parameters = addParameterById(parameters, 'mileage');
    parameters = addParameterById(parameters, 'sdate');
    parameters = addParameterById(parameters, 'stime');
    parameters = addParameterById(parameters, 'smiles');
    parameters = addParameterById(parameters, 'schargepc');
    parameters = addParameterById(parameters, 'edate');
    parameters = addParameterById(parameters, 'etime');
    parameters = addParameterById(parameters, 'emiles');
    parameters = addParameterById(parameters, 'echargepc');
    parameters = addParameterById(parameters, 'charge');
    parameters = addParameterById(parameters, 'cost');
    
    function processResponse(response) {
        if (response.length > 2) {
            displayAlert('Validation Failure', response);
            return;
        }
        requestChargeSessions();
        setSave('Update');
    }
    ajaxLoggedInCall("CarUsage", processResponse, parameters);
    return true;
}
function deleteData() {
    var parameters = createParameters('delete');
    
    if (!checkDateTime("sdate", "stime", true))  return;

    parameters = addParameterById(parameters, 'carreg');
    parameters = addParameterById(parameters, 'sdate');
    parameters = addParameterById(parameters, 'stime');

    ajaxLoggedInCall('CarUsage', reset, parameters);
}
function btChargeSessionsRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'CarReg':
                document.getElementById('carreg').value  = value;
                break;
            case 'Source':
                document.getElementById('chargesource').value  = value;
                break;
            case 'Comment':
                document.getElementById('sessioncomment').value  = value;
                break;
            case 'Start':
                loadDateTime(value, "sdate", "stime");
                break;
            case 'Mileage':
                document.getElementById('mileage').value  = value;
                break;
            case 'Start Miles':
                document.getElementById('smiles').value  = value;
                break;
            case 'Start %':
                document.getElementById('schargepc').value  = value;
                break;
            case 'End':
                loadDateTime(value, "edate", "etime");
                break;
            case 'End Miles':
                document.getElementById('emiles').value  = value;
                break;
            case 'End %':
                document.getElementById('echargepc').value  = value;
                break;
            case 'Charge':
                document.getElementById('charge').value  = value;
                break;
            case 'Cost':
                document.getElementById('cost').value  = value;
                break;
        }
    }
    setSave('Update');
}
function initialize() {    
    var cars = 
            'EO70 ECC,' +
            'BD68 PBF';
    var sources = 
            'Home,' +
            'PodPoint';
    
    reporter.setFatalAction('console');
    
    sessionFilter = getFilter('filterKey', document.getElementById('filter'), requestChargeSessions, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Sessions Filter',
        forceGap:        '4px',
        initialDisplay:  false});
    sessionFilter.addFilter('Source', 'Source,,fchargesource', '', true);
    sessionFilter.addFilter('CarReg', 'CarReg,,fcarreg',       '', true);
    loadListResponse(cars, {
        name:         "carreg",
        keepValue:    true,
        async:        false,
        allowBlank:   true});
    loadListResponse(cars, {
        name:         "fcarreg",
        keepValue:    true,
        async:        false,
        allowBlank:   true});
    loadListResponse(sources, {
        name:         "chargesource",
        keepValue:    true,
        async:        false,
        allowBlank:   true});
    loadListResponse(sources, {
        name:         "fchargesource",
        keepValue:    true,
        async:        false,
        allowBlank:   true});
    reset();
}



