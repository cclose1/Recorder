/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */
'use strict';

var chartDef;
var lines;
var chart;
var menuaction;

function dataSourceRowClick(row) {
    var tab  = new Table(row);
    let flds = new ScreenFields(menuaction + 'chart');
    
    switch (menuaction) {
        case 'create':
        case 'define':
            let type = tab.columnValue('Type');
            
            if (type === 'datetime' || type === 'date')
                flds.setValue('XColumn', tab.columnValue('Name'));
            else
                displayAlert('Error', 'X Column data type must be Datetime or Date');
            
            break;             
    }
}
function setCharts() {
    let list = getList('Energy', {
        element: 'dscharts',
        table:   'Chart',
        field:   'Name',
        async:   false}, true);
    loadSelect('dfcharts', list);
}
function addCheckBox(parent, label, clear) {
    parent = getElement(parent);

    if (defaultNull(clear, false)) removeChildren(parent);
    
    let dv = createElement(document, 'div', {append: parent});


    createElement(document, 'input', {
        append:   dv,
        value:    label,
        type:     'checkbox',
        class:    'notparam',
        onclick:  'lineSelected(this)',
        tabindex: '0'});
    let lab=createElement(document, 'label', {
        append: dv,
        class:  'left'});
    lab.innerHTML = label;
}
function onHandler(element) {
    switch (element.name) {
        case 'ShowDef':
            setHidden('chartdefinition', !element.checked);
            break;
        case 'DefineDatabase':
            let flds = new ScreenFields('definechart');
            flds.setValue('Database', element.value);
            break;
        default:
            console.log('onHandler + id ' + element.id);
    }
}
function setLines() {
    let flds  = new ScreenFields('dsparams');
    let group = flds.getValue('GroupBy') !== '';
    let clear = true;
    
    lines = new Array();    
    chartDef.setRowFirst();
    
    while (chartDef.nextRow()) {
        if (chartDef.columnValue('PartType') !== 'Line') continue;
        let line = {};
                
        let lpars = chartDef.columnValue('Params').split(',');
        
        line.name     = chartDef.columnValue('PartName');
        line.group    = group;
        line.selected = false;
        line.loaded   = false;
        line.colour   = lpars[0];
        line.source   = lpars[1];
        line.filter   = lpars.length === 3? lpars[2] : '';
        
        addCheckBox('dssellines', line.name, clear);
        clear = false;
        lines.push(line);
    }
    return lines;
}
function setGroupBy() {
    let list  = '';
    let pName = '';
    
    chartDef.setRowFirst();
    
    while (chartDef.nextRow()) {
        if (chartDef.columnValue('PartType') !== 'Group') continue;
        
        pName = chartDef.columnValue('PartName');
        
        if (list !== '') list += ',';
        
        list += (pName + ':' + chartDef.columnValue('Params').replaceAll(',', '|'));
    }
    loadSelect('dsgrp',  list, {allowBlank: true});
}
function lineSelected(element) {
    let name = element.value;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].name === name) {
            lines[i].selected = element.checked;
            return;
        }
    }
    throw new ErrorObject('Code Error', 'Chart line ' + name + ' is invalid');
}
function clearLoaded() {
    for (let line of lines) {
        line.loaded = false;
    }
}
function getSelected(xCol) {   
    let sPars    = null;
    let selected = {
        lines: [],
        fields: null,
        filter: null};
    let col = 1;

    for (let line of lines) {        
        if (line.selected && !line.loaded) {
            if (selected.filter === null) selected.filter = line.filter;
            
            if (selected.filter !== line.filter) continue;
            
            line.loaded = true;
            sPars = line.source.split(':');
            selected.lines.push({
                title:  line.name,
                colour: line.colour,
                source: sPars.length === 3? sPars[2] : sPars[0],
                column: col++},);
            
            if (selected.fields === null) selected.fields = xCol + ':Min';
            
            selected.fields += ',' + line.source;
        }
    } 
    if (defaultNull(selected.filter, '') !== '') {
        let pars = selected.filter.split('=');
        selected.filter = addDBFilterField('', pars[1], pars[0], 'quoted');
    }
    return selected;
}
        
function displayChart(element) {
    let flds     = new ScreenFields('displaychart');
    let pars     = null;
    let selected = null;
    let data     = false;
    let step     = 0;
    
    if (!fieldHasValue(flds.get('Start'))) return;
    if (!fieldHasValue(flds.get('End')))   return;    
    /*
     * 
     */
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
    function processResponse(response) {
        let json = stringToJSON(response);
            
        for (let line of selected.lines) {
            chart.addJSONData(json, {type: line.title, colour: line.colour}, line.column);
        };
    }
    clearLoaded();    
    
    let grplab = getSelectedOption(flds.get('GroupBy'));
    chart.deleteData();
    chart.setDataType(flds.get('Title').value === ''? 'Data' : flds.get('Title').value);
    chart.setType('line');
    chart.setMaxY(flds.getValue('MaxY'));
    chart.setTickSkip(flds.getValue('TickSkip'));
    chart.setTickInterval(flds.getValue('TickInterval'));
    chart.setTitle(
                chart.getDataType() + 
                (grplab === ''? '' : ' by ' + grplab) +
                ' starting ' + formatDate(flds.getValue('Start'), 'dd-MMM-yy'));
    
    while ((selected = getSelected(flds.get('XColumn').value)).lines.length !== 0) {
        pars = createParameters('ChartData', {fields: flds.getFields()});
        pars = addParameter(pars, 'Fields', selected.fields);
        data = true;
        
        if (selected.filter !== '') pars = addParameter(pars, 'filter', selected.filter);
        
        ajaxLoggedInCall('Chart', processResponse, pars, false);
    }
    if (!data) displayAlert('Error', 'Must select at least one data line');
    
    chart.draw();
}
function loadChart(element, fieldsId) {    
    let pars = createParameters('LoadChart'); 
    let flds = new ScreenFields(fieldsId);
    
    function processResponse(response) {
        let json       = stringToJSON(response);         
        let definition = json.getMember('Defs').value;
        
        flds.setValue("Title",    json.getMember('Title').value);
        flds.setValue("Database", json.getMember('Database').value);
        flds.setValue("Source",   json.getMember('Source').value);
        flds.setValue("XColumn",  json.getMember('XColumn').value);
        
        loadJSONArray(definition, 'chartdefinition', {
            setTableTitle: 'Chart Definition', 
            maxSize:       19,
            ignoreColumns: 'Modified,Comment'});
        setHidden('chartdefinition', fieldsId === 'displaychart');
        chartDef = new Table('chartdefinition');
        
        if (fieldsId === 'displaychart') {
            if (chartDef.getRowCount() < 2) return;
            
            setGroupBy();
            setLines();
            return;
        }
        defineChart('LoadSource');
    }
    pars = addParameter(pars, 'Chart', element.value);
    ajaxLoggedInCall('Chart', processResponse, pars);
}
function menuChartBuild(element) {
    let option = element.value;
    
    setHidden('chart',           true);
    setHidden('chartdefinition', true);
    setHidden('source',          true);
    setHidden('displaychart',    option !== 'displaychart');
    setHidden('createchart',     option !== 'createchart');
    setHidden('definechart',     option !== 'definechart');
    
    switch (option) {
        case 'createchart' :
            menuaction = 'create';
            setHidden('source',          false);
            break;
        case 'definechart' :
            menuaction = 'define';
            setHidden('source',          false);
            setDefineChartAction('update');
            break;
        case 'displaychart':
            menuaction = 'display';
            setHidden('chart', false);
            break;
    }
}
function setDBFields(update) {    
    setHiddenNew('dfdatabase', !update);
    setHiddenNew('dfdbsel',     update);
}
function setDefineChartAction(action) {    
    let flds   = new ScreenFields('definechart');
    let update = action === 'update';
    
    setDBFields(update);
    flds.setReadOnly('Title',    update);
    flds.setReadOnly('Source',   update);
    
    switch (action) {
        case 'update':
            setHiddenNew('dfchhide', false);
            setHiddenNew(flds.get('Name'), true);
            setHidden('dfnew',          false);
            getElement('dfaction').value = 'Update';
            break;
        case 'create':
            flds.setValue('Database', getElement('dfdbsel').value);
            setHiddenNew('dfchhide', true);
            setHiddenNew(flds.get('Name'), false);
            setHidden('dfnew',          true);
            getElement('dfaction').value = 'Create';
            break;
        default:
            throw new ErrorObject('Code Error', 'DefineChart action ' + action + ' is invalid');
    }
}
function createChart(element) {
    let action = element.name;
    let flds   = new ScreenFields('createchart');
    let pars   = createParameters(action, {fields: flds.getFields()}); 
    
    function processResponse(response) {
        if (!response.startsWith('{')) {
            displayAlert('', 'Chart ' + flds.getValue('Name') + ' created');  
            flds.clear();
            setCharts();
            return;
        }        
        loadJSONArray(response, 'source', 
            {setTableTitle: 'Data Source', maxSize: 19, onClick: "dataSourceRowClick(this)"});
    }
    if (!fieldHasValue(flds.get('Name')))     return;
    if (!fieldHasValue(flds.get('Title')))    return;
    if (!fieldHasValue(flds.get('Database'))) return;
    if (!fieldHasValue(flds.get('Source')))   return;
    
    if (action === 'CreateChart' && !fieldHasValue(flds.get('XColumn'))) return;
    
    ajaxLoggedInCall('Chart', processResponse, pars);
}
/*
 * createChart will be removed.
 */
function defineChart(actionpar) {
    let action = typeof actionpar === 'string'? actionpar : actionpar.value;
    let flds   = new ScreenFields('definechart');
    
    if (action === 'Update') {
        flds.setValue('Name', flds.getValue('Chart'));
    }
    let pars = createParameters(action, {fields: flds.getFields()}); 
    
    function processResponse(response) {
        if (!response.startsWith('{')) {
            displayAlert('', 'Chart ' + flds.getValue('Name') + ' created');  
            flds.clear();
            setCharts();
            return;
        }        
        loadJSONArray(response, 'source', 
            {setTableTitle: 'Data Fields', maxSize: 19, onClick: "dataSourceRowClick(this)"});
    }
    if (action === 'New') {
        flds.clear();
        clearTable('srctab', true);
        setDefineChartAction('create');
        return;
    }
    if (action === 'LoadSource') {
        if (flds.getValue('Source') === '')
            clearTable('srctab', true);
        else
            ajaxLoggedInCall('Chart', processResponse, pars, false);
        return;
    }
    if (!fieldHasValue(flds.get('Name')))     return;
    if (!fieldHasValue(flds.get('Title')))    return;
    if (!fieldHasValue(flds.get('Database'))) return;
    if (!fieldHasValue(flds.get('Source')))   return;
    
    if (action === 'Create' && !fieldHasValue(flds.get('XColumn'))) return;
    
    
    ajaxLoggedInCall('Chart', processResponse, pars);
}
function chartAction(element) {
    let action = element.value;
    
    switch (action) {
        case 'Create' :
            createChart();
            break;
        case 'Define' :
            break;
        case 'Display' :
            break;
        default:
            throw new ErrorObject('Code Error', 'Chart action ' + action + ' is invalid');
    }
    console.log('Manaintain action ' + element.value);
}
function testInterval(interval, start, time, expected) {
    let stvals = [];
    
    stvals.push(start);
    let th = new TickHandler(stvals, interval);
    
    let test = th.test(time);
    
    if (test !== expected) console.log('Test failed');
}
function test() {
    testInterval('Year',  '01-Jun-2025 10:30', '03-Jun-2025 10:30', false);
    testInterval('Year',  '01-Jun-2025 10:30', '01-Jan-2026 10:30', true);
    testInterval('Month', '01-Jun-2025 10:30', '03-Jun-2025 10:30', false);
    testInterval('Month', '01-Jun-2025 10:30', '03-Jul-2025 10:30', true);
    testInterval('Week',  '02-Jun-2025 10:30', '08-Jun-2025 10:30', false);
    testInterval('Week',  '02-Jun-2025 10:30', '09-Jun-2025 10:30', true);
    testInterval('Day',   '02-Jun-2025 10:30', '02-Jun-2025 13:30', false);
    testInterval('Day',   '02-Jun-2025 10:30', '03-Jun-2025 00:30', true);    
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    test();
    chart = new Charter('myChart');
    getElement('mendsch').checked = true;
    menuChartBuild(getElement('mendsch')); 
    setDefineChartAction('update');
    setCharts();
}

