/* global reporter, getElement */

'use strict';

var readingsFilter;
var tariffsFilter;
var chart;

function copyFld(fromFlds, fromName, toFlds, toName) {
    toName = defaultNull(toName, fromName);
    
    toFlds.setValue(toName, fromFlds.getValue(fromName));
}
function copyUpdate() {
    let uflds = new ScreenFields('updatefields');
    let rflds = new ScreenFields('detailfields');
    
    copyFld(uflds, 'Timestamp', rflds);
    copyFld(uflds, 'Status',    rflds);
    copyFld(uflds, 'Source',    rflds);
    copyFld(uflds, 'Comment',   rflds);

    switch (uflds.get('Type').value) {
        case "Gas":
            copyFld(uflds, 'Reading', rflds, 'Gas');
            break;
        case "Electric":
            copyFld(uflds, 'Reading', rflds, 'Electric');
            break;
        case "Export":
            copyFld(uflds, 'Reading', rflds, 'Export');
            break;
        case "Solar":
            copyFld(uflds, 'Reading', rflds, 'Solar');
            break;
    }
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
        return fieldHasValue(prefix + 'start') && fieldHasValue(prefix + 'end');
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

            hasValues = valuesAllOrNone(flds.get('Gas UnitRate'), flds.get('Gas StandingCharge'));

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
function actionClear() {
    let flds = new ScreenFields('derivestart');
    
    flds.setValue("From",      "");
    flds.setValue("To",        "");
    flds.setValue("ToReading", "");
    
}
function actionDerive() {
    let flds = new ScreenFields('derivestart');
    let pars = createParameters('deriveReading', {fields: flds.getFields()}); 
    
    function processResponse(response) {
        var json = stringToJSON(response);
        
        let offset = trim(flds.getValue('Offset'));
        flds = new ScreenFields('derivereading');
        
        setHidden('drvsaddoffset', offset === "" || offset === 0);
        flds.loadJSON(json, false);        
        
    }
    let fchk = flds.checkValue('From',      true);
    let tchk = flds.checkValue('To',        false);
    let rchk = flds.checkValue('ToReading', false);
    
    if (!fchk.valid || !tchk.valid || !rchk.valid) return;
    
    if (tchk.value !== '' && rchk.value !== '') {
        displayAlert('Error', 'Only one of To Date and To Reading can have a value');
        return;
    } 
    if (tchk.value === '' && rchk.value === '') {
        displayAlert('Error', 'To Date or To Reading must have a value');
        return;
    }
    ajaxLoggedInCall('Energy', processResponse, pars);
}
function applyOffset(element) {
    let val = element.value;
    
    if (val === 'Add Offset') {
        let pars = createParameters('ModifyReading'); 
        let flds = new ScreenFields('derivereading');        
        let rd   = (Number(getElement('drvsoffset').value) + Number(flds.getValue('PriorReading'))).toFixed(3);
        
        pars = addParameter(pars, 'Timestamp', dateTimeString(flds.getValue('PriorTimestamp')));
        pars = addParameter(pars, 'Reading',   rd);
        
        function processResponse(response) {
            flds.setValue('PriorReading', rd);
            getElement('drvsoffset').value = '';
        }
        ajaxLoggedInCall('Energy', processResponse, pars);
    }
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

function actionUpdate(action) {
    action = defaultNull(action, event.target.value);

    let flds       = new ScreenFields('updatefields');
    let parameters = createParameters(action, {fields: flds.getFields()}); 

    function reset() {        
        flds.clear(); 
        requestReadings();
        setHidden('updatefields', true);
    }
    switch (action) {
        case "Copy":
            copyUpdate();
            return;
            break;
        case "Modify":
        case "Delete":
            if (!fieldHasValue(flds.get('Date'))) return;
            break;
        case "Cancel":
            reset();
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');
    }
    function processResponse(response) {
        reset();
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function setCalValScreen(mode, setHistory) {
    let flds = new ScreenFields('calvals');
    
    switch (mode) {
        case 'Create':
            setHidden('cvcreate', false);
            setHidden('cvmodify', true);
            setHidden('cvdelete', true);              
            setHidden('cvcancel', true);  
            flds.clear();
            flds.get('Date').readOnly   = false;
            break;
        case 'Update':
            setHidden('cvcreate', true);
            setHidden('cvmodify', false);
            setHidden('cvdelete', false);              
            setHidden('cvcancel', false);
            flds.get('Date').readOnly   = true;  
            break;
    }
    if (defaultNull(setHistory, true)) requestCalValues();
}
function setPeakOverridesScreen(mode) {
    let flds = new ScreenFields('pkovrrride');
    
    switch (mode) {
        case 'Create':
            setHidden('ovrcreate', false);
            setHidden('ovrmodify', true);
            setHidden('ovrdelete', true);              
            setHidden('ovrcancel', true);  
            flds.clear();
            flds.setReadOnly('Start', false);
            break;
        case 'Update':
            setHidden('ovrcreate', true);
            setHidden('ovrmodify', false);
            setHidden('ovrdelete', false);              
            setHidden('ovrcancel', false);
            flds.setReadOnly('Start', true);  
            break;
    }
    requestPeakOverrides();
}
function actionCalValue(element) {
    let action = element.value;
    let flds   = new ScreenFields('calvals');

    switch (action) {
        case "Create":
            if (!fieldHasValue(flds.get('Date'))) return;
            
            action = 'create';
            
            break;
        case "Modify":
            action = 'update';
            break;
        case "Delete":
            action = 'delete';
            break;
            break;
        case "Cancel":
            setCalValScreen('Create');
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');
    }
    let parameters = createParameters(
                action + 'TableRow',
                {fields: getParameters('calval'), initialParams: [{name: 'table', value: 'CalorificValue'}]});
    function processResponse(response) {
        requestCalValues();
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function actionPeakOverride(element) {
    let action = element.value;
    let flds   = new ScreenFields('pkovrrride');

    switch (action) {
        case "Create":
            if (!fieldHasValue(flds.get('Date'))) return;
            
            action = 'create';
            
            break;
        case "Modify":
            action = 'update';
            break;
        case "Delete":
            action = 'delete';
            break;
        case "Cancel":
            setPeakOverridesScreen('Create');
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');
    }
    let parameters = createParameters(
                action + 'TableRow',
                {fields:        getParameters('pkovrrride'),                    
                 initialParams: [
                     {name: 'table', value: 'peaktariffoverride'}, 
                     {name: 'Type',  value: 'Electric'}]});
    function processResponse(response) {
        setPeakOverridesScreen(action === 'modify'? 'Modify' : 'Create');
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function actionCreate(action) {
    action = defaultNull(action, event.target.value);

    let flds       = new ScreenFields(action === 'Apply'? 'derivedread' : 'detailfields');
    let parameters = createParameters(action, {fields: flds.getFields()});

    switch (action) {
        case "Apply":
            parameters = addParameter(parameters, 'Source', 'Derived'); 
        case "Create": 
            if (!fieldHasValue(flds.get('Timestamp'))) return;            
            break;
        case "Cancel":
            flds.clear('TimeOffset');
            return;
            break;
        default:
            throw new ErrorObject('Code Error', 'Action ' + action + ' is invalid');
    }
    function processResponse(response) {
        flds.clear('TimeOffset');
        requestReadings();
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
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
    let flds = new ScreenFields('updatefields');

    if (src !== 'Meter') {
        displayAlert('Warning', 'Click on row only implemented when readings sourced from Meter');
        return;
    }
    getElement("labunits").innerHTML = rdr.getColumnValue('Type') === 'Gas' ? 'Ft3' : 'Kwh';
    
    rdr.loadScreenFields(flds, {mustExist: false});
    setHidden('updatefields', false);
}
function screenFldsRowClick(row, fieldsId) {
    if (fieldsId !== 'derivestart') return;
    
    let rdr  = new rowReader(row);
    let flds = new ScreenFields(fieldsId);
    
    flds.setValue(flds.hasValue('From', false)? 'To' : 'From', rdr.getColumnValue('Timestamp'));
}
function calValuesRowClick(row) {
    let rdr  = new rowReader(row);
    let flds = new ScreenFields('calval');
    
    rdr.loadScreenFields(flds, {mustExist: false});
    setCalValScreen('Update', false);
}
function peakOverridesRowClick(row) {
    let rdr  = new rowReader(row);
    let flds = new ScreenFields('pkovrrride');
    
    rdr.loadScreenFields(flds, {mustExist: false});
    setPeakOverridesScreen('Update');
}
function clearFields(id) {
    let flds = new ScreenFields(defaultNull(id, 'costs'));
    
    flds.clear();
}

var xyValues = [
  {x:50, y:7},
  {x:60, y:8},
  {x:70, y:8},
  {x:80, y:9},
  {x:90, y:9},
  {x:100, y:9},
  {x:110, y:10},
  {x:120, y:11},
  {x:130, y:14},
  {x:140, y:14},
  {x:150, y:15}
];

function drawChart() {
    chart.setType('scatter');
    
 //   ch.setData(xyValues);
    chart.addDataValue(50,7);
    chart.addDataValue(60,8);
    chart.addDataValue(70,8);
    chart.addDataValue(80,9);
    chart.addDataValue(90,9);
    chart.addDataValue(100,9);
    chart.addDataValue(110,10);
    chart.addDataValue(120,11);
    chart.addDataValue(130,14);
    chart.addDataValue(140,14);
    chart.addDataValue(150,5);
    chart.draw();
}
function displayChart(element) {    
    let flds     = new ScreenFields('chrperiod');
    let pars     = '';
    let step     = 0;
    let isData   = false;
    let setTitle = {};
    
    function processResponse(response) {
        let json = stringToJSON(response);
        chart.setType('line');
        chart.setMaxY(flds.getValue('MaxY'));
        chart.setTickSkip(flds.getValue('TickSkip'));
        chart.setTitle(
                chart.getDataType() + ' Data' + 
                (flds.getValue('GroupBy') === ''? '' : ' by ' + flds.getValue('GroupBy')) +
                ' starting ' + formatDate(flds.getValue('Start'), 'dd-MMM-yy'));
        if (setTitle.type === 'SolarExport') {
            setTitle.type   = 'KwhPerDay';
            setTitle.colour = 'Green';
            chart.addJSONData(json, setTitle, 1);
            setTitle.type   = 'KwhExportedPerDay';
            setTitle.colour = 'Red';
            chart.addJSONData(json, setTitle, 2);
            setTitle.type   = '%Exported';
            setTitle.colour = 'Blue';
            chart.addJSONData(json, setTitle, 3);
        } else
            chart.addJSONData(json, setTitle, 1);        
    }
    if (!fieldHasValue(flds.get('Start'))) return;
    if (!fieldHasValue(flds.get('End')))   return;
    
    function addData(setId) {
        let opt = getElement(setId);
        
        if (isNull(opt) || !opt.checked) return;
        
        setTitle.type = opt.value;
        
        switch (setTitle.type) {
            case 'Electric':
                setTitle.colour = 'Blue';
                chart.setDataType('Usage');
                break;
            case 'Gas':
                setTitle.colour = 'Yellow';
                chart.setDataType('Usage');
                break;
            case 'Export':
                setTitle.colour = 'Red';
                chart.setDataType('Usage');
                break;
            case 'Solar':
                setTitle.colour = 'Yellow';                
                chart.setDataType('Solar');
                break;
            case 'SolarExport':
                setTitle.colour = 'Yellow';                
                chart.setDataType('Solar');
                break;
            default:
                throw new ErrorObject('Code Error', 'Data type ' + opt.value + ' is invalid');
        }
        isData = true;
        pars   = createParameters('getSMData', {fields: flds.getFields()}); 
        pars   = addParameter(pars, 'Type', opt.value);
        ajaxLoggedInCall('Energy', processResponse, pars, false);
    }
    switch (element.value) {
        case 'Forward':
            step = 1;
            break;
        case 'Back':
            step = -1;
            break;
    }
    if (step !== 0) {
        if (!fieldHasValue(flds.get('Step'))) return;
        
        step = step * flds.get('Step').value;
        flds.setValue('Start', incrementDateTime(flds.getValue('Start'), 'Days', step)); 
        flds.setValue('End',   incrementDateTime(flds.getValue('End'),   'Days', step)); 
    }
    chart.deleteData();
    addData('chrdel');
    addData('chrdgs');
    addData('chrdex');
    addData('chrdsl');
    addData('chrdslex');

    if (!isData) {        
        displayAlert('Error', 'Must select at least one data source');
        return;
    }
    chart.draw();
}
function menuClick(option) {
    setHidden('chart',        true);
    setHidden('meterhistory', false);
    setHidden('meter',        option !== 'meter');
    setHidden('derive',       option !== 'derive');
    setHidden('calculate',    option !== 'calculate');
    setHidden('rates',        option !== 'rates');    
    setHidden('calvals',      option !== 'calvals'); 
    setHidden('pkover',       option !== 'pkover'); 
    setHidden('chartdv',      option !== 'chartdv');

    switch (option) {
        case 'meter':
            requestReadings();
            break;
        case 'derive' :
            requestScreenReadings('derivestart');
            break;
        case 'calculate':
            getElement('cstswvat').checked = false;
            getElement('cstvat').value = 'Remove';
            setVatMode(getElement('cstvat'));
            getElement('cststime').value   = '00:00:00';
            getElement('cstendtime').value = '00:00:00';
            requestScreenReadings('calculatestart');
        case 'rates':
            requestTariffs();
            break;
        case 'calvals':
            setCalValScreen('Create');
            break;
        case 'pkover':
            setPeakOverridesScreen('Create');
            break;
        case 'chartdv':
            setHidden('chart',        false);
            setHidden('meterhistory', true);
        //    drawChart();
            break;
    }
}
function tariffsRowClick(row) {
    var rdr  = new rowReader(row);
    let flds = new ScreenFields('modifytariff');
    
    rdr.loadScreenFields(flds);
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
function checkMeterIncrementTimestamp(flds, name, required) {
    let elm = flds.get(name + '~Date');
    
    if (!checkDate(elm, required, true)) return false;
    
    elm = flds.get(name + '~Time');
    
    if (elm.value === '') {
        elm.value = '00:00:00';
        return true;
    }
    if (!checkTime(elm)) return false;
    
    let min = Number(elm.value.substring(3, 5));
    
    if (min === 0 || min === 30) return true;
    
    displayAlert('Validation Error', 'Minutes must be 0 or 30', {focus: elm});
    
    return false;
}
function setVatMode(element) {
    var mode = element.value;
    // getSelectedOption(element.id);
    clearFields();
    setHidden(getElement('cstswvat'), mode === 'Included');
}
function checkPeakOverride(element) {
    let name  = element.getAttribute('name').split('~');
    let flds  = new ScreenFields('pkovrrride');
    
    if (name[0] === 'Start') return checkMeterIncrementTimestamp(flds, name[0], true);
    
    if(!flds.hasValue('End~Date')) flds.setValue('End', incrementDateTime(flds.getValue('Start'), 'Minutes', 30)); 
    
    return checkMeterIncrementTimestamp(flds, name[0], false);
}
function requestScreenReadings(fieldsId) {
    let flds       = new ScreenFields(fieldsId);    
    let parameters = createParameters('readingshistory');
    let useVer     = flds.get('UseVerified', false);
    let filter     = '';
    
    filter = addDBFilterField(filter, flds.getValue('Type'), 'Type', 'quoted');
    
    if (!isNull(useVer) && useVer.checked) filter = addDBFilterField(filter, 'Verified', 'Status', 'quoted');
    
    function processResponse(response) {
        let options = {maxSize: 19, setTableName: true, setTableTitle: 'Readings History'};
        
        if (fieldsId === 'derivestart') options.onClick = "screenFldsRowClick(this, '" + fieldsId + "')";
        
        loadJSONArray(response, 'meterhistory', options);
    }
    parameters = addParameter(parameters, 'readings', 'Meter');
    parameters = addParameter(parameters, 'filter', filter);

    ajaxLoggedInCall('Energy', processResponse, parameters);
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
function requestCalValues() {
    var parameters = createParameters('calvals');

    function processResponse(response) {
        loadJSONArray(response, 'meterhistory', 
            {setTableTitle: 'Values History', maxSize: 19, onClick: "calValuesRowClick(this)"});
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function requestPeakOverrides() {
    var parameters = createParameters('pkover');
    
    function processResponse(response) {
        loadJSONArray(response, 'meterhistory', 
            {setTableTitle: 'Peak Override', maxSize: 19, onClick: "peakOverridesRowClick(this)"});
    }
    ajaxLoggedInCall('Energy', processResponse, parameters);
}
function initialize(loggedIn) {
    let unpdt = unpackDate('2025-07-02');
    let tdate = '2025-06-01 9:1:2';
    let fdate = '';
   
    fdate = formatDate(tdate, 'yy-M-d H:m:s');
    fdate = formatDate(tdate, 'yyyy-MM-dd H:mm:ss E');
    fdate = formatDate(tdate, 'yyyyMMMddHmmss');
    fdate = formatDate(tdate, 'H');
    
    if (!loggedIn)
        return;

    reporter.setFatalAction('error');
    chart = new Charter('myChart');

    loadSelect('source',  'Bill,Reading,Estimated,Derived,Corrected', {allowBlank: true});
    loadSelect('usource', getElement('source'),                       {allowBlank: true});
    loadSelect('status',  'Verified, Ignore',                         {allowBlank: true});
    loadSelect('ustatus', getElement('status'),                       {allowBlank: true});
    loadSelect('chrtgrp', 'Hour,Day,Week,Month',                      {allowBlank: true});
    
    getList('Energy', {
        element: 'tariffcode',
        table:   'TariffName',
        field:   'Code',
        async:   true});
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
                values: 'Gas,Electric,Export,Solar'});
    readingsFilter.addFilter(
            'Status', {
                name: 'Status',
                values: getElement('status')});
    readingsFilter.addFilter(
            'Source', {
                name: 'Source',
                values: getElement('source')});
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
    menuClick('meter');
    setHidden('updatefields', true);
}
