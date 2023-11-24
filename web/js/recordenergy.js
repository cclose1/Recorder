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
            copyFld(dflds, 'Date',      rflds);
            copyFld(dflds, 'Time',      rflds);
            copyFld(dflds, 'Estimated', rflds);
            copyFld(dflds, 'Comment',   rflds);
            
            switch (dflds.get('Type').value) {
                case "Gas":
                    copyFld(dflds, 'Reading', rflds, 'Gas');
                    break;
                case "Electric":
                    copyFld(dflds, 'Reading', rflds, 'Electric');
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
function actionTariff(action) {
    if (action === undefined) action = event.target.value;
    
    let flds = getParameters('tariff');
    let check;
    let parameters;
    let hasValues;
    
    switch (action) {
        case "Create":
            
            if (!fieldHasValue(flds.get('Date'))) return;
            
            hasValues = valuesAllOrNone(flds.get('Gas UnitRate'), flds.get('Gas StandingCharge'), flds.get('CalorificValue'));
            
            if (hasValues === null) return;
            
            check  = valuesAllOrNone(flds.get('Electric UnitRate'), flds.get('Electric StandingCharge'));
            
            if (check === null) return;
            
            if (!hasValues && !check) {
                displayAlert('Validation Error', 'Must set values for at least one of Gas or Electric');
                return;
            }
            parameters = createParameters('CreateTariff', flds);
            
            break;
        case "Cancel":
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
function send(action) {
    if (action === undefined) action = event.target.value;
    
    var parameters = createParameters(action);
    let flds = null;
   
    switch (action) {
        case "Create":
            flds = getParameters('detailfields');
            parameters = createParameters(action, flds);
            
            if (!fieldHasValue(flds.get('Date'))) return;
            
            break;
        case "Delete":
            flds = getParameters('deletefields');
            parameters = createParameters(action, flds);
            
            if (!fieldHasValue(flds.get('Date'))) return;
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
function readingsRowClick(row) {
    var rdr = new rowReader(row);
    let flds = getParameters('deletefields');
    
    while (rdr.nextColumn()) {
        var value   = rdr.columnValue();
        
        switch (rdr.columnName()) {
            case 'Timestamp':
            case 'Start':
                var fields = value.split(" ");

                if (fields.length === 2) {
                    flds.get('Date').value = fields[0];
                    flds.get('Time').value = fields[1];
                }
                break;
            case 'Type':
                    flds.get('Type').value = value;
                    getElement("labunits").innerHTML = value === 'Gas' ? 'Ft3' : 'Kwh';
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
function tariffsRowClick(row) {
    
}
function requestReadings() {
    var readings   = getElement('readings').value;
    var parameters = createParameters('readingshistory');

    function processResponse(response) {
        loadJSONArray(response, "history", {maxSize: 19, onClick: "readingsRowClick(this)"});
    }
    parameters = addParameter(parameters, 'readings', readings);
    
    parameters = readingsFilter.addFilterParameter(parameters);
    
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function requestTariffs() {
    var parameters = createParameters('tariffs');

    function processResponse(response) {
        loadJSONArray(response, "tariffs", {maxSize: 19, onClick: "tariffsRowClick(this)"});
    }
    parameters = tariffsFilter.addFilterParameter(parameters);
    
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function test(elapsed) {
    let sec  = Math.trunc(elapsed/1000);
    let msec = elapsed % 1000;
    
    let res = lpad(sec, 2, ' ') + '.' + lpad(msec, 3, '0');
    
    return res;
}
function initialize(loggedIn) {    
    if (!loggedIn) return;
    
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
        autoSelect:      true,
        title:           'Filter Readings',
        forceGap:        '4px',
        initialDisplay:  false,
        popup:           true});
    
    readingsFilter.addFilter(
            'Types', {
                name:   'Type',      
                values: 'Gas,Electric,Solar'});
    readingsFilter.addFilter(
            'Estimated', {
                name: 'Estimated',
                values: ',Y,N'});
    requestReadings();
    
    tariffsFilter = getFilter('tariffkey', getElement('tariffsfilter'), requestTariffs,{
        server:          'Energy',
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           'Filter Tariff',
        forceGap:        '4px',
        initialDisplay:  true,
        trigger:         getElement('tariffsfilter')});
    
    tariffsFilter.addFilter(
            'Tariff', {
                name:       'Code',  
                listTable:  'TariffName',             
                listColumn: 'Code'});
    tariffsFilter.addFilter(
            'Types', {
                name:   'Type',      
                values: 'Gas,Electric'});
    getElement('tariffcode').value = 'SSEStd';
    requestReadings();
    requestTariffs();
    setHidden('deletefields', true);
}
