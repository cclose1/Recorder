/* global reporter, getElement */

'use strict';

var readingsFilter;
var tariffsFilter;

function copyFld(fromFlds, fromName, toFlds, toName) {
    toName = defaultNull(toName, fromName);

    copyElement(fromFlds.get(fromName), toFlds.get(toName));
}
function reset() {
    clearValues(getParameters('detailfields'));
    requestReadings();
}
function resetDelete(cancel) {
    let dflds = getParameters('deletefields');
    let rflds = getParameters('detailfields');

    if (!cancel) {
        if (dflds.get('Copy').checked) {
            reset();
            copyFld(dflds, 'Date', rflds);
            copyFld(dflds, 'Time', rflds);
            copyFld(dflds, 'Estimated', rflds);
            copyFld(dflds, 'Comment', rflds);

            switch (dflds.get('Type').value) {
                case "Gas":
                    copyFld(dflds, 'Reading', rflds, 'Gas');
                    break;
                case "Electric":
                    copyFld(dflds, 'Reading', rflds, 'Electric');
                    break;
                case "Export":
                    copyFld(dflds, 'Reading', rflds, 'Export');
                    break;
                case "Solar":
                    copyFld(dflds, 'Reading', rflds, 'Solar');
                    break;
            }
        }
        requestReadings();
    }
    clearValues(dflds);
    setHidden('deletefields', true);
}
function errorIfValue(id, message) {
    if (trim(getElement(id).value) !== '') {
        displayFieldError(id, message);
        return true;
    }
    return false;
}
function checkOffPeak(prefix) {
    if (trim(getElement(prefix + 'rate').value) === '') {
        return !errorIfValue(prefix + 'start', 'must empty if no off peak rate') && !errorIfValue(prefix + 'end', 'must empty if no off peak rate');
    } else {
        return getFieldValue(prefix + 'start') !== undefined && getFieldValue(prefix + 'end') !== undefined;
    }
}
function actionTariff(action, fields) {
    action = defaultNull(action, event.target.value);
    
    let flds = getParameters(defaultNull(fields, 'tariff'));
    let check;
    let parameters;
    let hasValues;

    switch (action) {
        case "Create":
            if (!fieldHasValue(flds.get('Date')))
                return;
            
            if (!checkOffPeak('tgop')) return;
            if (!checkOffPeak('teop')) return;

            hasValues = valuesAllOrNone(flds.get('Gas UnitRate'), flds.get('Gas StandingCharge'), flds.get('CalorificValue'));

            if (hasValues === null)
                return;

            check = valuesAllOrNone(flds.get('Electric UnitRate'), flds.get('Electric StandingCharge'));

            if (check === null)
                return;

            if (!hasValues && !check) {
                displayAlert('Validation Error', 'Must set values for at least one of Gas or Electric');
                return;
            }
            parameters = createParameters('CreateTariff', {fields: flds});
            setHidden('modifytariff', true);
            break;
        case "Cancel":
            clearValues(flds, 'Code');
            return;
            break;
        case "Modify":
            parameters = createParameters(
                'updateTableRow',
                {fields: flds, initialParams: [{name: 'table', value: 'Tariff'}]});
            break;
        case "Delete":
            parameters = createParameters(
                'deleteTableRow',
                {fields: flds, initialParams: [{name: 'table', value: 'Tariff'}]});
            break;
        case "CancelModify":
            clearValues(flds);
            setHidden('modifytariff', true);
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');
    }
    function processResponse(response) {
        clearValues(flds, 'Code');
        requestTariffs();
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function actionDerive() {
    let flds = new ScreenFields('derivestart');
    let pars = createParameters('deriveReading', {fields: flds.getFields()}); 
    
    function processResponse(response) {
        var json = stringToJSON(response);
        
        flds = new ScreenFields('derivereading');
        flds.loadJSON(json, false);
    }
    let dt = validateDateTime(flds.get('Timestamp~Date'), flds.get('Timestamp~Time'), {required: true});
    
    if (!dt.valid) return;
    
    ajaxLoggedInCall('Energy', processResponse, pars);
}
function actionCalculate() {
    let flds = new ScreenFields('calculatestart');
    let pars = createParameters('calculateCosts', {fields: flds.getFields()}); 
    
    function processResponse(response) {
        var json = stringToJSON(response);
        flds = new ScreenFields('costs');
        flds.loadJSON(json, false);
    }
    let dt = validateDateTime(flds.get('Start~Date'), flds.get('Start~Time'), {required: true});
    
    if (!dt.valid) return;
    
    dt = validateDateTime(flds.get('End~Date'), flds.get('End~Time'), {required: false});
    
    if (!dt.valid) return;
    
    ajaxLoggedInCall('Energy', processResponse, pars);
}
function send(action) {
    action = defaultNull(action, event.target.value);

    var parameters = createParameters(action);
    let flds = null;

    switch (action) {
        case "Create":
            flds = getParameters('detailfields');
            parameters = createParameters(action, {fields: flds});

            if (!fieldHasValue(flds.get('Date')))
                return;

            break;
        case "Delete":
            flds = getParameters('deletefields');
            parameters = createParameters(action, {fields: flds});

            if (!fieldHasValue(flds.get('Date')))
                return;
            break;
        case "Cancel":
            resetDelete(true);
            return;
            break;
        case "CancelCreate":
            reset();
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');
    }

    function processResponse(response) {
        if (action === 'Delete')
            resetDelete(false);
        else
            reset();
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function loadFieldsDateTime(fields, dateField, timeField, timestamp) {
    if (isNull(timeField))
        fields.get(dateField).value = timestamp;
    else {
        var tmflds = timestamp.split(" ");

        if (tmflds.length === 2) {
            fields.get('Date').value = tmflds[0];
            fields.get('Time').value = tmflds[1];
        }        
    }
}
/*
 * 
 * row    Clicked row.
 * source Database source providing the html table data.
 * 
 * source is not actually used. The loadJSONArray option setTableName means it's the name property of the html
 * table. Hence source will have the same value as src.
 */
function readingsRowClick(row, source) {
    var rdr  = new rowReader(row);
    let src  = row.parentElement.parentElement.getAttribute('name');
    let flds = getParameters('deletefields');

    if (src !== 'Meter') {
        displayAlert('Warning', 'Click on row only implemented when readings sourced from Meter');
        return;
    }
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'Timestamp':
            case 'Start':
                loadFieldsDateTime(flds, 'Date', 'Time', value);
                break;
            case 'Meter':
                flds.get('Meter').value = value;
                break;

            case 'Type':
                getElement("labunits").innerHTML = value === 'Gas' ? 'Ft3' : 'Kwh';
                flds.get('Type').value = value;
                break;
            case 'Reading':
            case 'StartReading':
                flds.get('Reading').value = value;
                break;
            case 'Estimated':
            case 'StartEstimated':
                flds.get('Estimated').checked = value === 'Y';
                break;
            case 'Comment':
                flds.get('Comment').value = value;
                break;
        }
    }
    flds.get('Copy').checked = false;
    setHidden('deletefields', false);
}
function menuClick(option) {
    setHidden('meter',     option !== 'meter');
    setHidden('derive',    option !== 'derive');
    setHidden('calculate', option !== 'calculate');
    setHidden('rates',     option !== 'rates');
    
    switch (option) {
        case 'meter':
            requestReadings();
            break;
        case 'derive' :
            requestMeterReadings('drvrtype', 'meterhistory');
            break;
        case 'calculate':
            requestReadings('cststype', 'meterhistory');
        case 'rates':
            requestTariffs();
            break;
    }
}
function tariffsRowClick(row) {
    var rdr  = new rowReader(row);
    let flds = new ScreenFields('modifytariff');

    while (rdr.nextColumn()) {
        flds.setValue(rdr.columnName(), rdr.columnValue());
    }
    setHidden('modifytariff', false);
}
function requestReadings() {
    let readings   = getElement('readings').value;
    let parameters = createParameters('readingshistory');

    function processResponse(response) {
        /*
         * The first attempt to readings as parameter, to identify the data source failed due to a coding error. This
         * was done instead using setTableName to get it from the json response.
         * 
         * Fixing the coding error means the setTableName is no longer required, but is left in as an example.
         * 
         * Note: For a variable to be included in the processResponse closure, it must be referenced.
         *       Hence readings is included but parameters is not.
         */
        loadJSONArray(response, "meterhistory", {setTableTitle: 'Meter History', maxSize: 19, onClick: "readingsRowClick(this, '" + readings + "')", setTableName: true});
    }
    parameters = addParameter(parameters, 'readings', readings);

    parameters = readingsFilter.addFilterParameter(parameters);

    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function requestMeterReadings(type, table) {
    let parameters = createParameters('readingshistory');
    let filter = '';
    
    filter = addDBFilterField(filter, getElement(type), 'Type', 'quoted');
    
    function processResponse(response) {
        loadJSONArray(response, table, {maxSize: 19, setTableName: true, setTableTitle: 'Readings History'});
    }
    parameters = addParameter(parameters, 'readings', 'Meter');
    parameters = addParameter(parameters, 'filter', filter);

    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function requestDeriveReadings() {
    requestMeterReadings('drvstype', 'meterhistory');
}
function requestTariffs() {
    var parameters = createParameters('tariffs');

    function processResponse(response) {
        loadJSONArray(response, 'meterhistory', 
            {setTableTitle: 'Tariffs History', maxSize: 19, onClick: "tariffsRowClick(this)",
             columns: [{name: 'Code', wrapHeader: false, columnTitle: 'Tariff'}]});
    }
    parameters = tariffsFilter.addFilterParameter(parameters);

    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function test(elapsed) {
    let sec = Math.trunc(elapsed / 1000);
    let msec = elapsed % 1000;

    let res = lpad(sec, 2, ' ') + '.' + lpad(msec, 3, '0');

    return res;
}
function initialize(loggedIn) {
    if (!loggedIn)
        return;

    reporter.setFatalAction('error');

    test(900);
    test(1100);
    test(100);
    test(1);
    test(20);
    getList('Energy', {
        name: "tariffcode",
        table: 'TariffName',
        field: 'Code',
        async: true});
    getList('Energy', {
        name: "tariffcode",
        table: 'TariffName',
        field: 'Code',
        async: false});
    reporter.logStore();
    readingsFilter = getFilter('readingskey', getElement('readingsfilter'), requestReadings, {
        allowAutoSelect: true,
        autoSelect: true,
        title: 'Filter Readings',
        forceGap: '4px',
        initialDisplay: false,
        popup: true});

    readingsFilter.addFilter(
            'Types', {
                name: 'Type',
                values: 'Gas,Electric,Solar'});
    readingsFilter.addFilter(
            'Estimated', {
                name: 'Estimated',
                values: ',Y,N'});
    requestReadings();

    tariffsFilter = getFilter('tariffkey', getElement('tariffsfilter'), requestTariffs, {
        server: 'Energy',
        allowAutoSelect: true,
        autoSelect: true,
        title: 'Filter Tariff',
        forceGap: '4px',
        initialDisplay: true,
        trigger: getElement('tariffsfilter')});

    tariffsFilter.addFilter(
            'Tariff', {
                name: 'Code',
                listTable: 'TariffName',
                listColumn: 'Code'});
    tariffsFilter.addFilter(
            'Types', {
                name: 'Type',
                values: 'Gas,Electric'});
    getElement('tariffcode').value = 'SSEStd';
    getElement('menu1').checked = true;
    requestReadings();
    requestTariffs();
    setHidden('deletefields', true);
}
