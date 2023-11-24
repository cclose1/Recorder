/* global reporter, getElement, getElementById, Column */

'use strict';

var sessionFilter;
var logFilter;
var prcur  = null;
var prlast = null;
var prgap  = 5;

class TableChangeAlerter {
    tableChange(table, action, listenerKey) {
        switch (table.toLowerCase()) {
            case 'chargernetwork':
            case 'chargerlocation':
            case 'chargerunit':
                requestChargers();
                break;
        }
        console.log('Action ' + action + 'for Table ' + table + ' key ' + listenerKey);
    };
};
var ts = new TableChangeAlerter();

function lockKey(yes) {
    if (yes === undefined) yes = !event.target.checked;
    
    document.getElementById("carreg").disable     = yes;
    document.getElementById("sdate").readOnly     = yes;
    document.getElementById("stime").readOnly     = yes;
    document.getElementById("mileage").readOnly   = yes;
    document.getElementById("schargepc").readOnly = yes;
    document.getElementById("smiles").readOnly    = yes;
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
            lockKey(!document.getElementById("setstartchange").checked);
            clear  = false;
            remove = false;
            copy   = false;
            
            elm = getElement("etime", true);
            
            if (elm.empty) {
                document.getElementById("edate").value   = document.getElementById("sdate").value;
                document.getElementById("etime").value   = document.getElementById("stime").value;
            }
            document.getElementById("keytimestamp").value = document.getElementById("sdate").value + ' ' + document.getElementById("stime").value;
            break;
        default:
            reporter.fatalError('carreg.js setSave action ' + action + ' is invalid');
    }
    setHidden("clear",            clear);
    setHidden("remove",           remove);
    setHidden("copy",             copy);
    setHidden("allowstartchange", action !== "Update");
    document.getElementById("save").value  = action;
    
    if (action !== "Update") document.getElementById("setstartchange").checked = false;        
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
    elm       = getElement(elm === undefined? event.target : elm);
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
        loadJSONArray(response, 'chargesessionstable', 
            {scroll:  'table',
             onClick: 'btChargeSessionsRowClick(this)',
             columns: [{name: 'Start Miles',    wrapHeader: true},
                       {name: 'End Miles',      wrapHeader: true},
                       {name: 'Start Duration', wrapHeader: true}]});
        document.getElementById('chargesessionstable').removeAttribute('hidden');
    }
    if (filter === undefined) filter = sessionFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function requestChargers() {
    var parameters = createParameters('chargers');

    function processResponse(response) {
        /*
         * The columns is there for test purposes and the values specified should not change the
         * displayed table layout, i.e. columns can be removed.
         */
        loadJSONArray(response, 'chargerstable', 
            {onClick: 'btChargersRowClick(this)',
             columns: [
                 {name: 'Location', minSize: 3, maxSize: null},
                 {name: 'Tariff',   minSize: 3},
                 {name: 'Network',  maxSize: 15}]});
        document.getElementById('chargerstable').removeAttribute('hidden');
    }
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function requestSessionLog(filter) {
    var parameters = createParameters('sessionlog');

    function processResponse(response) {
        loadJSONArray(response, 'sessionlogtable', {
                onClick:   'btSessionLogRowClick(this)',
                splitName: true,
                columns:   [{name: 'Device', minSize: 3, maxSize: 17}]});
        document.getElementById('sessionlogtable').removeAttribute('hidden');
    }
    if (!getElement('logupdates').checked) return;
    
    if (filter === undefined) filter = logFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function clearElement(id) {
    document.getElementById(id).value = "";    
}
function reset() {
    clearElement("keytimestamp");
    clearElement("sessioncomment");
    clearElement("mileage");
    clearElement("estduration");
    clearElement("sdate");
    clearElement("stime");
    clearElement("smiles");
    clearElement("schargepc");
    clearElement("edate");
    clearElement("etime");
    clearElement("emiles");
    clearElement("echargepc");
    clearElement("charge");
    clearElement("cost");
    updateProgress(true);
    requestChargeSessions();
    requestChargers();
    requestSessionLog();
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
function setSessionLog(on) {
    if (on === undefined)
        on = getElement('logupdates').checked;
    else
        getElement('logupdates').checked = on;
    
    setHidden('sessionlog', !on); 
    setHidden('updatelog',  true);
    requestSessionLog();
}
function setNew(copy) {
    if (copy) {
        /*
         * Save comment and restore after clearData.
         */
        var comment = getElement('sessioncomment').value;
        
        clearData();
        setSessionLog(true);
        getElement('sessioncomment').value = comment;
        getElement("currenttime").checked  = true;
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
        }
    }
    setDateTime('sdate', 'stime');
    setSave('Create');
}
function getDateTime(prefix) {
    return getElement(prefix + 'date', true).value + ' ' + getElement(prefix + 'time', true).value;
}
/*
 * Returns the Date object for the element ids date and time. If time is undefined, the date element
 * contains date and time, otherwise date contains just the date and time the time string. 
 */
function getDate(date, time) {
    var datetime = getElement(date).value;
    
    if (time !== undefined) datetime += ' ' + getElement(time).value;
    
    return datetime.trim() === '' ? null : toDate(datetime);
}
function exitTable() {
    setHidden('selecttable', false);
    setHidden('updatetable', true);    
}
function setRate(id, from, to) {
    var params = {
        pcdiff:  to.perc - from.perc,
        elapsed: dateDiff(from.time, to.time, 'seconds'),
        rate:    null};
    
    if (params.pcdiff !== 0) {
        /*
         * Have to allow for charge not changed since last update.
         */
        params.rate = (params.elapsed / (60 * params.pcdiff)).toFixed(2);
    }
    getElement(id).value = params.pcdiff === null ? '' : params.rate;
    
    return params;
}
/*
 * The variables prcur and prlast point to objects
 */
function copyProgressState(state) {
    return {time: new Date(state.time.getTime()), perc: state.perc};
}
function stateBefore(statea, stateb) {
    if (statea === null || stateb === null) return false;
    
    return statea.time.getTime() < stateb.time.getTime();
}
function updateProgress(reset) {
    if (reset) {
        prcur  = null;
        prlast = null;
        clearElement('prgsrate');
        clearElement('prgcstart');
        clearElement('prgpcgain');
        clearElement('prgcgap');
        clearElement('prgcrate');
        clearElement('prgcomplete');
        document.getElementById("currenttime").checked = false;
        return;
    }
    var start    = {time: getDate('sdate', 'stime'), perc: getElement('schargepc').value};
    var end      = {time: getDate('edate', 'etime'), perc: getElement('echargepc').value};
    var rateData;
    /*
     * The end time may have been set earlier, so ajdust prcur and prlast if necessary.
     */
    if (stateBefore(end, prlast)) prlast = null;
    if (stateBefore(end, prcur))  prcur  = null;
    
    if (prcur === null) prcur = copyProgressState(start);
    
    if (prlast === null) 
        prlast = copyProgressState(end);
    else if (dateDiff(prcur.time, end.time, 'minutes') >= prgap) {
        prcur  = copyProgressState(prlast);
        prlast = null;
    }
    rateData = setRate('prgsrate', start, end);
    rateData = setRate('prgcrate', prcur, end);
    
    if (rateData.rate !== null) {
        var minToComplete = rateData.rate * (100 - end.perc);
        var complete      = new Date(end.time.getTime() + minToComplete*60000);
        
        getElement('prgcstart').value   = dateTimeString(prcur.time);
        getElement('prgpcgain').value   = end.perc - prcur.perc;        
        getElement('prgcgap').value     = convertDuration(rateData.elapsed / 3600);
        getElement('prgcomplete').value = dateTimeString(complete);
    }
    if (end.perc > 99) getElement('currenttime').checked = false;
}
function tableSelected() {
    var table = event.target.value;
    
    if (table === 'None')
        setHidden('updatetable', true);
    else {
        var tab   = getTableDefinition('CarUsage', table, 'updatetable');
        event.target.selectedIndex = -1;
        tab.createForm(exitTable);
        setHidden('updatetable', false);
        setHidden('selecttable', true);
    }
}
function setCurrentTime(action) {
    var did = action === 'Create' ? 'sdate' : 'edate';
    var tid = action === 'Create' ? 'stime' : 'etime';
    
    if (!getElement('currenttime').checked) return;
    
    /*
     * setDateTime only sets the time if the fields are empty. 
     * 
     * Probably should change this to conditionally overwrite, but need to assess current usage.
     */
    clearElement(did);
    clearElement(tid);
    setDateTime(did, tid);
}

function updateLog(action) {
    if (action === undefined) action = event.target.value;
    
    let flds       = getParameters('updatelog');
    let parameters = '';
    
    function processREsponse() {
        requestSessionLog();
    }
    switch (action) {
        case "Delete":
            parameters = createParameters(
                    'deleteTableRow', 
                    flds, 
                    [{name: 'table', value: 'ChargeSessionLog'}]);
            ajaxLoggedInCall("CarUsage", processREsponse, parameters, false);
            break;
        case "Cancel":
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');            
    }
    clearValues(flds);
    setHidden('updatelog', true);
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
    setCurrentTime(action);
    
    var dt = validateDateTime("sdate", "stime", {required: true});
    
    if (!dt.valid) return;
        
    if (action !== 'Delete') {        
        var tm = validateDateTime("edate", "etime");
        if (!tm.valid) return;

        if (!fieldHasValue("mileage"))     return;
        if (!fieldHasValue("schargepc"))   return;
        if (!fieldHasValue("smiles"))      return;
        if (!checkDuration("estduration")) return;

        if (!checkGreaterOrEqual("smiles", "emiles"))       return;
        if (!checkGreaterOrEqual("schargepc", "echargepc")) return;

        if (!dt.empty && !tm.empty && tm.value < dt.value) {
            displayAlert('Validation Error', 'End timestamp is before start timestamp', {focus: getElement("etime")});
            return;
        }
    }
    parameters = addParameter(parameters, 'sdatetime', getDateTime('s'));
    parameters = addParameter(parameters, 'edatetime', getDateTime('e'));
    parameters = addParameterById(parameters, 'logupdates');
    parameters = addParameterById(parameters, 'keytimestamp');
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
        requestChargeSessions();
        requestSessionLog();
        
        if (action === 'Update') {            
            updateProgress();
            
            if (getElement('echargepc').value >= 99) getElement('emiles').value = parseInt(getElement('emiles').value) + 1;
        }
        
        if (action === 'Delete')
            clearData();
        else
            setSave('Update');
    }
    ajaxLoggedInCall("CarUsage", processResponse, parameters);
    return true;
}
function btChargeSessionsRowClick(row) {
    if (isDisabled(row)) return;
    
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
    setSessionLog(false);
    setLogFilter();
    getElement("setstartchange").checked = false;
    getElement("currenttime").checked    = false;    

    setSave('Update');
}
function btSessionLogRowClick(row) {
    if (isDisabled(row)) return;
    
    var rdr  = new rowReader(row);
    var flds = getParameters('updatelog');
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();
        
        switch (rdr.valueAttribute('name')) {
            case 'CarReg':
                flds.get('CarReg').value = value;
                break;
            case 'Session':
                flds.get('Session').value = value;
                break;
            case 'Timestamp':
                flds.get('Timestamp').value = value;
                break;
            case 'Percent':
                flds.get('Percent').value = value;
                break;
            case 'Miles':
                flds.get('Miles').value = value;
                break;
        }
    }
    setHidden('updatelog', false);
}
function btChargersRowClick(row) {
    if (isDisabled(row)) return;
    
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
/*
 * Set the log filter for the device on display.
 */
function setLogFilter() {
    var device = getElement('chargeunit').value;
    
    if (device === '') device = getElement('chargesource').value;
    
    logFilter.setValue('CarReg',  getElement('carreg').value);
    logFilter.setValue('Device',  device);
    logFilter.setValue('Percent', '');
}
/*
 * Ad Hoc tests
 */
function test() {
    var table;
    var body;
    var type      = 'number';
    var testval;
    var elms      = document.querySelectorAll("#detailfields > input");
    var precision = 20;
    var scale     = 2;
    var rowNo     = 0;
    var cell;
    var col;
    var row;
    var style;
    var test = {a: 1, b:2};
    var first = true;
    var testval;
    var font;
    
    function testCall(command) {
        try {
            eval(command);
        } catch(err) {
            console.log(command + ' failed with ' + err.message);
        }
    }
    function testlocal(tableid, value, adjustText) {
        var options = new JSONArrayOptions(
                {columns: [
                        {name: 'Location', minSize: 3, maxSize: null},
                        {name: 'Tariff', minSize: 3}]});

        table = getElement(tableid);
        body  = table.tBodies[0];
        style = options.getUsed();
        options.setUsed(true);
        style = options.getUsed();
        style = options.getUsed('minSize');
        options.setUsed('minSize', true);
        style = options.getUsed('minSize');
        style = ('a' in test);
        style = ('x' in test);

        test.a = undefined;

        style = ('a' in test);
        row = body.insertRow(rowNo++);
        cell = document.createElement('tr');
        cell.innerHTML = value;
        row.appendChild(cell);
        col = new Column(
                value,
                cell,
                -1,
                type,
                precision,
                scale,
                false,
                options);
        style = col.textWidth;
        style = col.pub;
        testCall("col.#priv");
        style = col.getPriv();
        cell.setAttribute("style", style);
        style = readComputedStyle(cell, 'width');

        var wd = parseFloat(style.substring(0, style.length - 2)).toFixed(2);
        reporter.log(
                "Value " + rpad(value, 15) +
                ' size ' + rpad(col.size(), 4) +
                ' min ' + rpad(col.minSize(), 4) +
                ' max ' + rpad(col.maxSize(), 4) +
                ' size ' + rpad(col.size(), 4) +
                ' textWidth ' + rpad(col.textWidth(), 4) +
                ' styleWidth ' + rpad(wd, 4) +
                ' per char ' + rpad((col.textWidth() / col.size()).toFixed(2), 4) +
                ' adjusted ' + (!isNull(adjustText) && adjustText));
        return col;
    }
    testval = testlocal('chargerstable', 'Josh-Alex B', false);
    testval = testlocal('chargerstable', 'Josh-Alex B', false, true);
    testval = testlocal('chargerstable', 'Josh-Alex B', true);
    testval = testlocal('chargerstable', 'Josh-Alex Bt');    
    testval = testlocal('chargerstable', 'Josh-AlexaBt');   
    testval = testlocal('chargerstable', 'Josh-AlexABt');
    testval = testlocal('chargerstable', 'JoshaAlexaBt');
    testval = testlocal('chargerstable', '1114-01');
    testval = testlocal('chargerstable', '1114-01', true);
    testval = testlocal('chargerstable', 'HomePodPoint');
    testval = testlocal('chargerstable', 'HomePodPoint', true);
    testval = testlocal('chargerstable', 'HomePodPoint');
    
    font = readComputedStyle(getElement('sessionlogtable'), 'font-style');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-variant');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-weight');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-size');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-family');    
    font = readComputedStyle(getElement('sessionlogtable'), 'font');

    
    testval = displayTextWidth("A");
    testval = displayTextWidth("a");
    
    testval = displayTextWidth("18446744073709552000");
    testval = displayTextWidth("MilesAdded", font);
    testval = displayTextWidth("Miles Added", font);
    testval = displayTextWidth("eo70 ecc");
    
    var testFilter = getFilter('testKey', document.getElementById('filter'), requestChargeSessions, {
        allowAutoSelect: true,
        autoSelect: true,
        title: 'Test Filter',
        forceGap: '4px',
        initialDisplay: false});
    testFilter.addFilter('CarReg', {name: 'CarReg', values: ''});
    testFilter.addFilter('ChargerLab', {name: 'Charger', values: 'a,b'});
    testFilter.addFilter('Field1', {name: 'Field1'});
    testFilter.addFilter('Field2Lab', {name: 'Field2'});
    var filterField = getFilterField(testFilter, 'CarReg');
    filterField = getFilterField(testFilter, 'Charger');
    filterField = getFilterField(testFilter, 'Field1');
    filterField = getFilterField(testFilter, 'Field2');
    testCall("filterField = getFilterField(testFilter, 'Type1')");
    col.setProperty('xxx', 'Crap', true);
    testCall("col.setProperty('zzz', 'Crap', false)");
    testCall("col.setProperty('zzz', 'Crap')");
    testCall("col.getProperty('abc')");
    testCall("Column.abc = 'Test'");
    style = col.getProperty('name');
    style = col.getProperty('minSize');
    style = col.hasProperty('abc');
    style = col.hasProperty('maxSize');

    style = col.xxx;
    style = 'width:' + col.textWidth() + 'px';
    testCall("col.yyy = 'MoreCrap'");
    testCall("col.size = 'Crap'");
    style = col.yyy;    
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    reporter.setFatalAction('throw'); 
    test();
    let rems = getLocalStorage('requestReminders');
    let rfrq = getLocalStorage('remFrequency');
    getReminderAlerts();
    getList('CarUsage', {
        name: "carreg",    
        table: 'Car', 
        field: 'Registration'});
    sessionFilter = getFilter('filterKey', document.getElementById('filter'), requestChargeSessions, {
        server:          'CarUsage',
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Sessions Filter',
        forceGap:        '4px',
        initialDisplay:  false});
    sessionFilter.addFilter('CarReg',  {name: 'CarReg',  listTable: 'Car',             listColumn: 'Registration'});
    sessionFilter.addFilter('Charger', {name: 'Charger', listTable: 'ChargerLocation', listColumn: 'Name'});
    sessionFilter.addFilter('Unit',    {name: 'Unit',    listTable: 'ChargerUnit',     listColumn: 'Name'});
    sessionFilter.addFilter('Weekdays',{name: 'Weekday', values: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat'});
     
    logFilter = getFilter('filterLogKey', document.getElementById('logfilter'), requestSessionLog, {
        server:          'CarUsage',
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Filter',
        forceGap:        '4px',
        initialDisplay:  true});
    logFilter.addFilter('CarReg',  {name: 'CarReg',  listTable: 'Car', listColumn: 'Registration'});
    logFilter.addFilter('Device',  {name: 'Device',  listTable: 'SessionLog'});
    logFilter.addFilter('Percent', {name: 'Percent'});
    
    
    setHidden('updatetable', true);
    setSessionLog(false);
    sessionFilter.setValue('CarReg', 'EO70 ECC');
    reset();
    addTableListener('Test1', ts);
    addTableListener('Test2', ts);
    invokeTableListeners('Test1', 'Update');
    invokeTableListeners('Test2', 'Create');
    logFilter.loadSelectLists();
}