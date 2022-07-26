'use strict';

var sessionFilter;

function lockKey(yes) {
    document.getElementById("carreg").disable   = yes;
    document.getElementById("sdate").readOnly   = yes;
    document.getElementById("stime").readOnly   = yes;
    document.getElementById("mileage").readOnly = yes;
}
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function setSave(action) {
    var clear  = true;
    var remove = true;
    var copy   = true;
    var elm;
    
    switch (action) {
        case 'New':
            lockKey(false);
            break;
        case 'Create':
            lockKey(false);
            clear = false;
            break;
        case 'Update':
            lockKey(true);
            clear  = false;
            remove = false;
            copy   = false;
            
            elm = getElement("etime", true);
            
            if (elm.empty) {
                document.getElementById("edate").value   = document.getElementById("sdate").value;
                document.getElementById("etime").value   = document.getElementById("stime").value;
            }
            break;
        default:
            reporter.fatalError('carreg.js setSave action ' + action + ' is invalid');
    }
    setHidden("clear",  clear);
    setHidden("remove", remove);
    setHidden("copy",   copy);
    document.getElementById("save").value  = action;        
}
/*
 * 
 * @param {String} value is a string of the form h:m:s. The hour field size can exceed 24, but minutes and seconds, if present,
 *                       must be in the range 0 to 59.
 * @returns An array of number fields. The array can be up to length 3. Index 0 is hours, index 2 is minutes and index 3 is seconds.
 *          Undefined is return if value is undefined or the empty string.
 * 
 * An exception is thrown if value does not obey the rules defined above.
 */
function getDurationFields(value) {
    if (value === undefined || trim(value) === "") return undefined;
    
    var flds = value.split(':');
    
    if (flds.length > 3) throw "Duration has more than 3 time fields"; 
    
    flds[0] = +toNumber(flds[0], 0); // Note: + ensures it is type number. 
                                     // Should probably change toNumber to do this, but things may relly on it being a string.
            
    if (flds.length > 1) flds[1] = +toNumber(flds[1], 0, 59);
    if (flds.length > 2) flds[2] = +toNumber(flds[2], 0, 59);
    
    return flds;
}
/*
 * A duration is stored in the database as a decimal hour.
 * 
 * It can be displayed as decimals or as as tring of the form hh:mm:ss.
 * 
 * @param {type} val
 * @returns {undefined}
 */
function convertDuration(val, toString) {
    var v;
    
    if (toString === undefined) toString = true;
    if (val      === undefined || val === "") return "";
    /*
     * Sets v to val if it is not a valid number, otherswise, the numeric value of string.
     */
    v = isNaN(val)? val : +val;
    
    switch (typeof v) {
        case 'string':
            var flds = getDurationFields(v);
            
            if (toString) return v; // We still get the fields to validate v.
            
            v = flds[0];
            
            if (flds.length > 1) v += flds[1] / 60.0;
            if (flds.length > 2) v += flds[2] / 3600.0;
            
            break;
        case 'number':
            if (!toString) return v;
            
            var h = Math.trunc(v);
            v = 60 * (v - h);                 // Remove hours
            var m = Math.trunc(v);            // Get minutes
            var s = Math.trunc(60 * (v - m)); // Remove minutes and get seconds
            
            v = lpad(h, 2, '0') + ':' + lpad(m, 2, '0') + ':' + lpad(s, 2, '0');
            break;
        default:
            throw exception('carreg.js convertDuration value type ' + typeof v + ' is not supported');
    }
    return v;
}
function checkGreaterOrEqual(first, last) {
    var fval = trim(getElement(first).value);
    var lval = trim(getElement(last).value);
    
    if (fval !== "" && lval !== "") {
        if (Number(lval) < Number(fval)) {
            displayAlert('Validation Error', 'Value must be greater or equal to ' + fval, {focus: getElement(last)});
            return false;
        }
    }
    return true;
}
function checkDuration(elm) {
    var elm   = getElement(elm === undefined? event.target : elm);
    var val   = elm.value;
    var valid = true;
    
    try {
        convertDuration(val, false);
    } catch (err) {
        valid = false;
        displayAlert('Validation Error', err, {focus: elm});
    }
    return valid;
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
function requestChargers(filter) {
    var parameters = createParameters('chargers');

    function processResponse(response) {
        loadJSONArray(response, 'chargerstable', {maxField: 19, onClick: 'btChargersRowClick(this)'});
        document.getElementById('chargerstable').removeAttribute('hidden');
    }
//    if (filter === undefined) filter = sessionFilter.getWhere();
//    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function reset() {
    document.getElementById("sessioncomment").value = "";
    document.getElementById("mileage").value        = "";
    document.getElementById("estduration").value    = "";
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
    requestChargers();
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
function setNew(copy) {
    if (copy) {
        /*
         * Save comment and restore after clearData.
         */
        var comment = document.getElementById('sessioncomment').value;
        clearData();
        document.getElementById('sessioncomment').value = comment;
    } else {
        var sessions = document.getElementById('chargesessionstable');

        if (sessions.tBodies[0].rows.length > 0) {
            /*
             * Set carreg and charge source from the first table row.
             */
            var row = sessions.tBodies[0].rows[0];
            var cells = row.cells;

            for (var c = 0; c < cells.length; c++) {
                var cell = cells[c];
                var value = cell.innerHTML;

                switch (cell.attributes.name.value) {
                    case 'Source':
                        document.getElementById('chargesource').value = value;
                        break;
                    case 'CarReg':
                        document.getElementById('carreg').value = value;
                        break;
                }
            }
            var i;
        }
    }
    setDateTime('sdate', 'stime');
    document.getElementById('stime').value = document.getElementById('stime').value.substring(0, 5);
    setSave('Create');
}

function send(action) {
    if (action === undefined) action = event.target.value;
    
    console.log("Action " + action);

    var parameters = createParameters(action.toLowerCase() + 'session');
    
    if (action === 'New') {
        setNew(false);
        return;
    }
    if (action === 'Copy') {
        setNew(true);
        return;
    }
    var dt = validateDateTime("sdate", "stime", {required: true});
    if (!dt.valid) return;
    
    if (action !== 'delete') {
        var tm = validateDateTime("edate", "etime");
        if (!tm.valid) return;

        if (!fieldHasValue("mileage"))     return;
        if (!checkDuration("estduration")) return;

        if (!checkGreaterOrEqual("smiles", "emiles"))       return;
        if (!checkGreaterOrEqual("schargepc", "echargepc")) return;

        if (!dt.empty && !tm.empty && tm.value < dt.value) {
            displayAlert('Validation Error', 'End timestamp is before start timestamp', {focus: "edate"});
            return;
        }
    }
    parameters = addParameterById(parameters, 'carreg');
    parameters = addParameterById(parameters, 'chargesource'); 
    parameters = addParameterById(parameters, 'chargeunit');    
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
    parameters = addParameter(parameters, 'estduration', convertDuration(document.getElementById('estduration').value, false));
    
    function processResponse(response) {
        if (response.length > 2) {
            displayAlert('Validation Failure', response);
            return;
        }
        requestChargeSessions();
        
        if (action === 'Delete')
            clearData();
        else
            setSave('Update');
    }
    ajaxLoggedInCall("CarUsage", processResponse, parameters);
    return true;
}
function btChargeSessionsRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'CarReg':
                document.getElementById('carreg').value  = value;
                break;
            case 'Charger':
                document.getElementById('chargesource').value  = value;
                break;
            case 'Unit':
                document.getElementById('chargeunit').value  = value;
                break;
            case 'Comment':
                document.getElementById('sessioncomment').value  = value;
                break;
            case 'Start':
                loadDateTime(value, "sdate", "stime");
                break;
            case 'Start Duration':
                document.getElementById('estduration').value  = convertDuration(value, true);
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
function btChargersRowClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'Name':
                document.getElementById('chargesource').value  = value;
                break;
            case 'Unit':
                document.getElementById('chargeunit').value  = value;
                break;
        }
    }
}
function initialize() {
    reporter.setFatalAction('error');  
    
    sessionFilter = getFilter('filterKey', document.getElementById('filter'), requestChargeSessions, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Sessions Filter',
        forceGap:        '4px',
        initialDisplay:  false});
    sessionFilter.addFilter('Charger', 'Charger,,fchargesource', '', true);
    sessionFilter.addFilter('CarReg',  'CarReg,,fcarreg',        '', true);
     
    var response = getList('CarUsage', {
        table:        'Car',
        name:         'carreg',
        field:        'Registration',
        keepValue:    false,
        defaultValue: 'EO70 ECC',
        async:        false},
        true);
    loadListResponse(response, {
        name:         "fcarreg",
        keepValue:    true,
        async:        false,
        allowBlank:   true});
    var response = getList('CarUsage', {
        table:        'ChargerLocation',
        name:         'fchargesource',
        field:        'Name',
        keepValue:    false,
        async:        false,
        allowBlank:   true},
        true);
    reset();
}



