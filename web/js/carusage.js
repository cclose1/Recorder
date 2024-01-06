/* global reporter, getElement, getElementById, Column */

'use strict';

var sessionFilter;
var logFilter;
var prcur  = null;
var prlast = null;
var prgap  = 5;
var timer  = null;
var snFlds = null;

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
    
    snFlds.get('CarReg').disabled       = yes;
    snFlds.get('Start~Date').readOnly   = yes;
    snFlds.get('Start~Time').readOnly   = yes;
    snFlds.get('Mileage').readOnly      = yes;
    snFlds.get('StartPerCent').readOnly = yes;
    snFlds.get('StartMiles').readOnly   = yes;
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
            
            elm = getElement(snFlds.get('End~Time'), true);
            
            if (elm.empty) {
                snFlds.get('End~Date').value = snFlds.get('Start~Date').value;
                snFlds.get('End~Time').value = snFlds.get('Start~Time').value;
            }
            document.getElementById("keytimestamp").value = snFlds.get('Start~Date').value + ' ' + snFlds.get('Start~Time').value;
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
 * It can be displayed as decimals or as as String of the form hh:mm:ss.
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
function checkGreaterOrEqual(flds, first, last) {
    var fval = trim(flds.getValue(first));
    var lval = trim(flds.getValue(last));
    
    if (fval !== "" && lval !== "") {
        if (Number(lval) < Number(fval)) {
            displayAlert('Validation Error', 'Value must be greater or equal to ' + fval, {focus: flds.get(last)});
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
             columns: [{name: 'StartMiles',   wrapHeader: true,  splitName:   true},
                       {name: 'EndMiles',     wrapHeader: true,  splitName:   true},
                       {name: 'EstDuration',  wrapHeader: true,  splitName:   true},
                       {name: 'StartPerCent', wrapHeader: false, columnTitle: 'Start %'},
                       {name: 'EndPerCent',   wrapHeader: false, columnTitle: 'End %'}]});
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
    getElement(id).value = "";    
}
function reset() {    
    snFlds.clear('CarReg,Charger,Unit');
    clearElement("keytimestamp");
    clearElement("sessioncomment");
    updateProgress(true);
    requestChargeSessions();
    requestChargers();
    requestSessionLog();
    timer.stop();
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
        clearData();  
        setSessionLog(true);
        
        getElement("currenttime").checked  = true;
    } else {
        var sessions = document.getElementById('chargesessionstable').children[1].tBodies[0];

        if (sessions.rows.length > 0) {
            /*
             * Set carreg and charge source from the first table row.
             */
            var row   = sessions.rows[0];
            var cells = row.cells;

            for (var c = 0; c < cells.length; c++) {
                var cell  = cells[c];
                var value = cell.innerHTML;

                switch (cell.attributes.name.value) {
                    case 'Source':
                        snFlds.setValue('Source', value);
                        break;
                    case 'CarReg':
                        snFlds.setValue('CarReg', value);
                        break;
                }
            }
        }
    }
    setDateTime(snFlds.get('Start~Date'), snFlds.get('Start~Time'));
    setSave('Create');
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
    var start = {time: snFlds.getValue('Start'), perc: snFlds.getValue('StartPerCent')};
    var end   = {time: snFlds.getValue('End'),   perc: snFlds.getValue('EndPerCent')};
    
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
    var did = snFlds.get(action === 'Create' ? 'Start~Date' : 'End~Date');
    var tid = snFlds.get(action === 'Create' ? 'Start~Time' : 'End~Time');
    
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
    
    function processResponse() {
        requestSessionLog();
    }
    switch (action) {
        case "Update":
            action = 'updateTableRow';
            break;
        case "Delete":
            action = 'deleteTableRow';
            break;
        case "Cancel":
            action = '';
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');            
    }
    if (action !== '') {
        parameters = createParameters(
                action,
                {
                    fields:        flds,
                    initialParams: [{name: 'table', value: 'ChargeSessionLog'}]
                });
        ajaxLoggedInCall("CarUsage", processResponse, parameters, false);
    }    
    clearValues(flds);
    setHidden('updatelog', true);
}
function modifyScreenField(get, name, value) {
    if (name !== 'EstDuration') return value;
    
    return convertDuration(value, !get, value);
}
function modifyParameter(name, value) {
    return name === 'EstDuration'? convertDuration(value, false) : value;
}
function send(action) {
    let valStart = true;
    let valEnd   = false;
    
    if (action === undefined) action = event.target.value;
    
    console.log("Action " + action);
          
    switch (action) {
        case 'New':
            setNew(false);
            return;
        case 'Copy':
            setNew(true);
            return;
        case 'Create':
            break;
        case 'Update':
            setCurrentTime(action);
            valEnd = true;
            break;
        case 'Delete':
            valStart = false;
            break;
        default:
            reporter.fatalError('carreg.js send action ' + action + ' is invalid');
    }
    let pars = createParameters(
            action.toLowerCase() + 'session', {
        fields:        snFlds.getFields(),
        modifier:      modifyParameter});                 
    pars = addParameterById(pars, 'keytimestamp');
    pars = addParameterById(pars, 'logupdates');  
    /*
     * The start date time must be present for all actions that update the database.
     */
    var dt = validateDateTime(snFlds.get('Start~Date'), snFlds.get('Start~Time'), {required: true});
    
    if (!dt.valid) return;
    
    if (valStart) {        
        if (!snFlds.hasValue("Mileage"))               return;
        if (!snFlds.hasValue("StartPerCent"))          return;
        if (!snFlds.hasValue("StartMiles"))            return;
        if (!checkDuration(snFlds.get("EstDuration"))) return;
    }
    if (valEnd) {             
        var tm = validateDateTime(snFlds.get('End~Date'), snFlds.get('End~Time'), {required: true});
        
        if (!tm.valid) return;
        
        if (!snFlds.hasValue("EndPerCent"))                             return;
        if (!snFlds.hasValue("EndMiles"))                               return;
        if (!checkGreaterOrEqual(snFlds, 'StartMiles',   'EndMiles'))   return;
        if (!checkGreaterOrEqual(snFlds, 'StartPerCent', 'EndPerCent')) return;

        if (!dt.empty && !tm.empty && tm.value < dt.value) {
            displayAlert('Validation Error', 'End timestamp is before start timestamp', {focus: snFlds.get('EndTime')});
            return;
        }
        if (dt !== getElement('keytimestamp').value) pars = addParameter(pars, 'Key~Start', getElement('keytimestamp').value);
    } 
    function processResponse() {
        requestChargeSessions();
        requestSessionLog();
        
        if (action === 'Update') {            
            updateProgress();
            
            if (snFlds.getValue('EndPerCent') >= 99) snFlds.setValue('EndMiles', parseInt(snFlds.getValue('EndMiles')) + 1);
        }        
        if (action === 'Delete')
            clearData();
        else {
            timer.start();
            setSave('Update');
        }
    }
    ajaxLoggedInCall("CarUsage", processResponse, pars);
    return true;
}
function btChargeSessionsRowClick(row) {    
    if (isDisabled(row)) return;
    
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        snFlds.setValue(rdr.columnName(), rdr.columnValue(), false);      
    }
    setSessionLog(false);
    setLogFilter();
    getElement("setstartchange").checked = false;
    getElement("currenttime").checked    = false;    

    setSave('Update');
}
function btSessionLogRowClick(row) {
    var flds = new ScreenFields('updatelog');
    
    if (isDisabled(row)) return;
    
    var rdr  = new rowReader(row);
    
    while (rdr.nextColumn()) {
        flds.setValue(rdr.columnName(), rdr.columnValue(), false);        
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
    let device = snFlds.getValue('Unit');
    
    if (device === '') device = snFlds.getValue('Source');
    
    logFilter.setValue('CarReg',  snFlds.getValue('CarReg'));
    logFilter.setValue('Device',  device);
    logFilter.setValue('Percent', '');
}
/*
 * Ad Hoc tests
 */
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    reporter.setFatalAction('throw'); 
    snFlds = new ScreenFields('chargesessionform', modifyScreenField);
    timer  = new Timer(document.getElementById("gap"), true);
    
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