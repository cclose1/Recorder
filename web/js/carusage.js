/* global reporter, getElement, getElementById, Column, confirmSend */

'use strict';

var sessionFilter;
var logFilter;
let prcur     = null;
let prlast    = null;
let prgap     = 5;
var timer     = null;
var snFlds    = null;
var hdrFlds   = null;
let sesClosed = false;
var csTab     = null;
let capacity  = -1;
let rate      = -1;

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
let ts          = new TableChangeAlerter();
let confirmSend = new ConfirmAction(send);

function lockKey(yes) {
    if (yes === undefined) yes = !event.target.checked;
    
    snFlds.get('CarReg').disabled       = yes;
    snFlds.get('Start~Date').readOnly   = yes;
    snFlds.get('Start~Time').readOnly   = yes;
    snFlds.get('Mileage').readOnly      = yes;
    snFlds.get('StartPerCent').readOnly = yes;
    snFlds.get('StartMiles').readOnly   = yes;
}
function lockUpdate(yes) {
    if (yes === undefined) yes = !event.target.checked;
    
    snFlds.get('End~Date').readOnly       = yes;
    snFlds.get('End~Time').readOnly       = yes;
    snFlds.get('ChargeDuration').readOnly = yes;
    snFlds.get('EndPerCent').readOnly     = yes;
    snFlds.get('EndMiles').readOnly       = yes;    
    snFlds.get('Charge').readOnly         = yes;  
    snFlds.get('Cost').readOnly           = yes;  
    snFlds.get('close').disabled          = yes;
}
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function configureChargeSession(action) {
    let clear  = true;
    let remove = true;
    let copy   = true;
    let elm;
    
    getElement("close").checked = false;
    
    switch (action) {
        case 'New':
            lockKey(false);
            sesClosed = false;
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
            reporter.fatalError('carreg.js configureChargeSession action ' + action + ' is invalid');
    }    
    setHidden("clear",            clear);
    setHidden("remove",           remove || sesClosed);
    setHidden("copy",             copy);
    setHidden("allowstartchange", action !== "Update" || sesClosed);
    
    //setHidden("save", sesClosed);
    
    if (sesClosed) action = 'Open';
    
    document.getElementById("save").value  = action;
    
    lockUpdate(action === 'Open');
    
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
    
    let flds = value.split(':');
    
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
 * It  be displayed as decimals or as as String of the form hh:mm:ss.
 * 
 * @param {type} val
 * @returns {undefined}
 */
function convertDuration(val, toString) {
    let v;
    
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
            
            let h = Math.trunc(v);
            v = 60 * (v - h);                 // Remove hours
            let m = Math.trunc(v);            // Get minutes
            let s = Math.trunc(60 * (v - m)); // Remove minutes and get seconds
            
            v = lpad(h, 2, '0') + ':' + lpad(m, 2, '0') + ':' + lpad(s, 2, '0');
            break;
        default:
            throw exception('carreg.js convertDuration value type ' + typeof v + ' is not supported');
    }
    return v;
}
function checkGreaterOrEqual(flds, first, last) {
    let fval = trim(flds.getValue(first));
    let lval = trim(flds.getValue(last));
    
    if (fval !== "" && lval !== "") {
        if (Number(lval) < Number(fval)) {
            displayAlert('Validation Error', 'Value must be greater or equal to ' + fval, {focus: flds.get(last)});
            return false;
        }
    }
    return true;
}
function requestChargeSessions(filter) {
    let parameters = createParameters('chargesessions');

    function processResponse(response) {
        loadJSONArray(response, 'chargesessionstable', 
            {scroll:  'table',
             onClick: 'btChargeSessionsRowClick(this)',
             columns: [{name: 'StartMiles',     wrapHeader: true,  splitName:   true},
                       {name: 'EndMiles',       wrapHeader: true,  splitName:   true},
                       {name: 'EstDuration',    wrapHeader: true,  splitName:   true},
                       {name: 'MaxDuration',    wrapHeader: true,  splitName:   true},
                       {name: 'ChargeDuration', wrapHeader: true,  splitName:   true},
                       {name: 'StartPerCent',   wrapHeader: false, columnTitle: 'Start %'},
                       {name: 'EndPerCent',     wrapHeader: false, columnTitle: 'End %'}]});
        document.getElementById('chargesessionstable').removeAttribute('hidden');
    }
    if (filter === undefined) filter = sessionFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function requestChargers() {
    let parameters = createParameters('chargers');

    function processResponse(response) {
        /*
         * The columns is there for test purposes and the values specified should not change the
         * displayed table layout, i.e. columns can be removed.
         */
        loadJSONArray(response, 'chargerstable', 
            {onClick: 'btChargersRowClick(this)',
             columns: [
                 {name: 'Location', minSize: 3, maxSize: null},
                 {name: 'Network',  maxSize: 15}]});
        document.getElementById('chargerstable').removeAttribute('hidden');
    }
    ajaxLoggedInCall('CarUsage', processResponse, parameters);
}
function requestSessionLog(filter) {
    let parameters = createParameters('sessionlog');

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
    configureChargeSession('New');
}
/*
 * Calling reset from onclick in html does not seem to work. So introduced clear to use in html on handler. 
 * 
 * Maybe it is because reset is an input type, but why that should matter is not clear to me.
 */
function clearData() {
    reset();
}
/*
 * On change of StartPercent EstDuration value is calculated is calculated if the current value is empty or is 0. Hence,
 * if a none zero value is set, it will not be overwritten.
 * 
 * It is set to the number of minutes required to get to 100% at the rate of 13% per hour of charge.
 * 
 * Note: The calculation does not take account of the rate dropping when nearing 100%.
 * 
 */
function startPercentChange() {
    if (snFlds.getValue('StartPerCent') !== '' &&
       (snFlds.getValue('EstDuration') === '' || snFlds.getValue('EstDuration') === 0))
    {
        /*
         * Derive the charge delivered per hour chPerHr from the car storage capacity and the charger rate using the
         * formula
         * 
         *  chPerHr = 100 * rate / capacity.
         * 
         * This is a rough figure particularly the chPerHr drops as 100% is approached.
         * 
         * The following gets the capacity and rate from the server.
         */
        getChargeParameters();
        /*
         * If either rate or capacity are negative, the data is not available, so return.
         */
        if (rate < 0 || capacity < 0) return;
        
        let chPerHr = 100 * rate / capacity;
        let duration = convertDuration((100 - snFlds.getValue('StartPerCent')) / chPerHr, true);
        snFlds.setValue('EstDuration', duration);
    }
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
        setSessionLog(false);
        
        getElement("currenttime").checked  = false;
    } else {
        var sessions = document.getElementById('chargesessionstable').children[1].tBodies[0];

        if (sessions.rows.length > 0) {
            /*
             * Set carreg and charge source from the first table row.
             */
            let row   = sessions.rows[0];
            let cells = row.cells;

            for (let c = 0; c < cells.length; c++) {
                let cell  = cells[c];
                let value = cell.innerHTML;

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
    configureChargeSession('Create');
}
function exitTable() {
    setHidden('selecttable', false);
    setHidden('updatetable', true);    
}
function setRate(id, from, to) {
    let params = {
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
    let start = {time: snFlds.getValue('Start'), perc: snFlds.getValue('StartPerCent')};
    let end   = {time: snFlds.getValue('End'),   perc: snFlds.getValue('EndPerCent')};
    
    let rateData;
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
        let minToComplete = rateData.rate * (100 - end.perc);
        let complete      = new Date(end.time.getTime() + minToComplete*60000);
        
        getElement('prgcstart').value   = dateTimeString(prcur.time);
        getElement('prgpcgain').value   = end.perc - prcur.perc;        
        getElement('prgcgap').value     = convertDuration(rateData.elapsed / 3600);
        getElement('prgcomplete').value = dateTimeString(complete);
    }
    if (end.perc > 99) getElement('currenttime').checked = false;
}
function tableSelected() {
    let table = event.target.value;
    
    if (table === 'None')
        setHidden('updatetable', true);
    else {
        let tab   = getTableDefinition('CarUsage', table, 'updatetable');
        
        event.target.selectedIndex = -1;
        tab.createForm(exitTable);
        setHidden('updatetable', false);
        setHidden('selecttable', true);
    }
}
function setCurrentTime(action) {
    let did = snFlds.get(action === 'Create' ? 'Start~Date' : 'End~Date');
    let tid = snFlds.get(action === 'Create' ? 'Start~Time' : 'End~Time');
    
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
                    fields: flds,
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
function getChargeParameters() {
    let pars = createParameters('getchargeparameters', {fields:  hdrFlds.getFields()});
    
    function processResponse(response) {
        let json = stringToJSON(response);
        
        capacity = json.getMember('Capacity').value;
        rate     = json.getMember('Rate').value;
    }
    ajaxLoggedInCall("CarUsage", processResponse, pars);
    return true;
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
            setCurrentTime(action);
            break;
        case 'Update':
        case 'Close':
        case 'Open':
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
            action.toLowerCase() + 'TableRow',
            {
                fields:        snFlds.getFields(),
                initialParams: [{name: 'table', value: 'ChargeSession'}],
                modifier:      modifyParameter});                 
    pars = addParameterById(pars, 'keytimestamp');
    pars = addParameterById(pars, 'logupdates');  
    /*
     * The start date time must be present for all actions that update the database.
     */
    let dt = validateDateTime(snFlds.get('Start~Date'), snFlds.get('Start~Time'), {required: true});
    
    if (!dt.valid) return;
    
    if (valStart) {      
        if (!snFlds.isValid(csTab, 'header'))      return;
        if (!snFlds.isValid(csTab, 'startfields')) return;
    }
    if (valEnd) {             
        let tm = validateDateTime(snFlds.get('End~Date'), snFlds.get('End~Time'), {required: true});
        
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
        
        let chrgdur = trim(snFlds.get('ChargeDuration').value);
        
        if (chrgdur !== '') {
            let cmpl = new Date();
            
            cmpl.setTime(dt.value.getTime() + 3600000 * convertDuration(chrgdur, false));
            
            if (cmpl > tm.value) {
                displayAlert('Validation Error', 'Charge duration after end', {focus: snFlds.get('ChargeDuration')});
                return;
            }
        }
    } 
    function processResponse() {
        requestChargeSessions();
        requestSessionLog();
        
        sesClosed = getElement("close").checked;
        
        if (action === 'Update') {            
            updateProgress();
            
            if (snFlds.getValue('EndPerCent') >= 99) snFlds.setValue('EndMiles', parseInt(snFlds.getValue('EndMiles')) + 1);
        }        
        if (action === 'Delete')
            clearData();
        else {
            timer.start();
            configureChargeSession('Update');
        }
    }
    ajaxLoggedInCall("CarUsage", processResponse, pars);
    return true;
}
function btChargeSessionsRowClick(row) {    
    if (isDisabled(row)) return;
    
    let rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        snFlds.setValue(rdr.columnName(), rdr.columnValue(), false);      
        
        if (rdr.columnName() === 'Closed') sesClosed = rdr.columnValue() === 'Y';
    }
    setSessionLog(false);
    setLogFilter();
    getElement("setstartchange").checked = false;
    getElement("currenttime").checked    = false;    

    configureChargeSession('Update');
}
function btSessionLogRowClick(row) {
    let flds = new ScreenFields('updatelog');
    
    if (isDisabled(row)) return;
    
    let rdr  = new rowReader(row);
    
    while (rdr.nextColumn()) {
        flds.setValue(rdr.columnName(), rdr.columnValue(), false);        
    }
    setHidden('updatelog', false);
}
function btChargersRowClick(row) {
    if (isDisabled(row)) return;
    
    let rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        let value = rdr.columnValue();

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
function test(tab) {
    let ts = eval(tab);
    let x = listAllEventListeners();
    reporter.setFatalAction('alert');
    
    let cols = csTab.getColumns();
    let col = csTab.getColumn('CarReg');
    let man = col.getAttribute('mandatory');
  //  col.setAttribute('mandatory', false);
    col = csTab.getColumn('CarRegX', false);
    col = csTab.getColumn('CarRegX');
    let fld = snFlds.get('Comment');
    x = fld.getAttribute('onchange');
    fld.setAttribute('onchange', 'checkTime()');
    fld.setAttribute('onchange', tab + '.checkElement()');
    let test = csTab.checkElement(fld);
    test = csTab.checkElement(fld, true);
    fld.value = 'Test';
    test = csTab.checkElement(fld);
    test = csTab.checkElement(fld, true);//
    test = getElementParent('xx');
    test = getElementParent(fld);    
    test = getElementParent(fld, 'fieldset', 'tagname');
    test = getElementParent(fld, 'detailfields');
    test = getElementParent(fld, 'header');    
    test = getElementParent(fld, 'header', 'id');    
}
function initialize(loggedIn) {
    if (!loggedIn) return;
     
    csTab  = getTableDefinition('CarUsage', 'ChargeSession');
    /*
     * Should probably make the following database fields to be not null.
     */
    csTab.getColumn("Charger").setAttribute('mandatory', true);
    csTab.getColumn("Mileage").setAttribute('mandatory', true);
    csTab.getColumn("EstDuration").setAttribute('type', 'TIME');
    csTab.getColumn("StartPerCent").setAttribute('mandatory', true);
    csTab.getColumn("StartMiles").setAttribute('mandatory', true);
    csTab.getColumn("EndPerCent").setAttribute('mandatory', true);
    csTab.getColumn("EndMiles").setAttribute('mandatory', true);
    
    snFlds  = new ScreenFields('chargesessionform', modifyScreenField);
    hdrFlds = new ScreenFields('header');
//    test('csTab');
    reporter.setFatalAction('throw');
    snFlds.syncWithTable('csTab', false);
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