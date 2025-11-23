/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */
'use strict';

var chartDef;
var lines;
var chart;
var appmode;
/*
 * Removes entry and returns true if there is one, otherwise false is returned.
 */
function removeFromArrayByIndex(arr, index) {
    let rem = arr.splice(index, 1);
    
    return rem.length !== 0;
}
/*
 * 
 * If arr contains an entry with value, it is deleted and true is returned, otherwise false is returned.
 * 
 * If more than one entry has value, the first is removed.
 */
function removeFromArrayByValue(arr, value) {
    let index = arr.indexOf(value);
   
    return index === -1? false : removeFromArrayByIndex(arr, index);
}
function updateArray(flds, name, value, remove) {
    let arr = flds.getValue(name).split(',');
    /*
     * Split on an empty string, returns a array of length 1 set to the empty string and
     * not an empty array as you might expect.
     */
    if (arr.length === 1 && arr[0] === "") arr = [];
    
    if (remove) {
        let removed = removeFromArrayByValue(arr, value);
        
        if (!removed) {
            flds.report(name, 'Does not contain column ' + value, 'Error');
            
            return;
        }
    } else {
        if (arr.includes(value)) {
            flds.report(name, 'Already contains column ' + value, 'Error');
            
            return;
        }
        if (arr.length === 0)
            arr[0] = value;
        else
            arr.push(value);
    }
    flds.setValue(name, arr.toString());
}
function dataSourceRowClick(row) {
    var tab  = new Table(row);
    let flds = new ScreenFields(appmode === 'create'? 'definechart' : 'dfselfld');
    let type = tab.columnValue('Type');
    
    switch (appmode) {
        case 'create':                
            if (type === 'datetime' || type === 'date')
                flds.setValue('XColumn', tab.columnValue('Name'));
            else
                displayAlert('Error', 'X Column data type must be Datetime or Date');
            
            break;
        case 'update':
            flds.setValue('Index', tab.columnValue('Index'));
            flds.setValue('Name',  tab.columnValue('Name'));
            flds.setValue('Type',  type);
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
    let flds;
    
    switch (element.name) {
        case 'ShowDef':
            setHidden('chartdefinition', !element.checked);
            break;
        case 'DefineDatabase':
            flds = new ScreenFields('definechart');
            flds.setValue('Database', element.value);
            break;
        case 'SetHexColour':
            flds = new ScreenFields(getElementParent(element, 'FIELDSET', 'tagname'));
            setHidden(flds.get('Colour'),     element.checked, false);
            setHidden(flds.get('HexColour'), !element.checked, false);
            break;
        default:
            console.log('onHandler + id ' + element.id);
    }
}
function findDefinitionRow(chart, type, name, index) {
    chartDef.setRowFirst();
    
    while (chartDef.nextRow()) {
        if (chartDef.columnValue('Chart')     === chart &&
            chartDef.columnValue('PartType')  === type  &&
            chartDef.columnValue('PartName')  === name  &&
            chartDef.columnValue('PartIndex') === index)
        return chartDef.getRowIndex();        
    }
    return -1;    
}
function updateDefinitionRow(type, action, params) {  
    let flds    = new ScreenFields('definechart');
    let chart   = flds.getValue('Chart');
    let name    = '';
    let index   = '1';
    
    flds        = new ScreenFields('dvdfbody');
    
    if (type !== 'Filter') {
        if (!fieldHasValue(flds.get(type + 'Name'),  true)) return;
        if (!fieldHasValue(flds.get(type + 'Index'), true)) return;
        
        name  = flds.getValue(type + 'Name');
        index = flds.getValue(type + 'Index');
    }
    params   = defaultNull(params, flds.getValue(type + 'Fields'));
    
    let row  = findDefinitionRow(chart, type, name, index);
    let key  = chart + ':' + type + ':' + name + ':' + index;
   
    console.log('Action ' + action + ' Key ' + key + ' Row ' + row);
    
    switch (action) {
        case 'New':
            if (row !== -1) {
                displayAlert('Error', key + ' already exists');
                return;
            }
            row = chartDef.addRow('definitionRowClick(this)');
            chartDef.setColumnValue('Chart',     chart);
            chartDef.setColumnValue('PartType',  type);
            chartDef.setColumnValue('PartName',  name);
            chartDef.setColumnValue('PartIndex', index);
            chartDef.setColumnValue('Params',    params);
            break;
        case 'Update':
            if (row === -1) {
                displayAlert('Error', key + ' does not exists');
                return;
            }
            chartDef.setColumnValue('Params', params);
            break;
        case 'Delete':
            if (row === -1) {
                displayAlert('Error', key + ' does not exists');
                return;
            }
            chartDef.deleteRow(row);
            break;
        default:
    }
}
function getDefinitionRow(index) {
    let line = {};
    let params;
    
    if (!isNull(index)) chartDef.setRowIndex(index);
    
    params     = chartDef.columnValue('Params');
    line.rowno = chartDef.getRowIndex();
    line.type  = chartDef.columnValue('PartType');    
    line.name  = chartDef.columnValue('PartName');
    line.index = chartDef.columnValue('PartIndex');
    
    switch (line.type) {
        case 'Line':
            let lpars = params.split(',');

            line.colour = lpars[0];
            line.source = lpars[1];
            line.filter = lpars.length === 3 ? lpars[2] : '';
            break;
        case 'Filter':
        case 'Group':
            line.fields = params;
            break;
        default:
            console.log('Line type ' + line.type + ' not supported');
    }
    return line;
}

function definitionRowClick(row) {    
    let line = getDefinitionRow(row.sectionRowIndex);
    let flds = new ScreenFields('dvdfbody');
    
    if (appmode === 'update') {
        switch (line.type) {
            case 'Filter':
                flds.setValue('FilterFields', line.fields);
                break;
            case 'Group':
                flds.setValue('GroupName',   line.name);
                flds.setValue('GroupIndex',  line.index);
                flds.setValue('GroupFields', line.fields);
                break;
            case 'Line':
                let src   = line.source.split(':');                
                let tohex = line.colour.charAt(0) === '#';
                
                setColourType(tohex);
                flds.setValue(tohex? 'HexColour' : 'Colour', line.colour);
        
                flds.setValue('LineName',     line.name);
                flds.setValue('LineIndex',    line.index);
                flds.setValue('SourceColumn', src[0]);
                flds.setValue('Aggregate',    src.length >= 2 ? src[1] : '');
                flds.setValue('DataName',     src.length >= 3 ? src[2] : '');
                
                let filter = line.filter.split('=');
                
                flds.setValue('FilterColumn',  filter.length >= 1? filter[0] : '');
                flds.setValue('FilterValue',   filter.length >= 2? filter[1] : '');
                break;
        }
        setPartMode(line.type, true);
    }
}
function setLines() {
    let flds  = new ScreenFields('dsparams');
    let group = flds.getValue('GroupBy') !== '';
    let clear = true;
    
    lines = new Array();    
    chartDef.setRowFirst();
    
    while (chartDef.nextRow()) {
        let line = getDefinitionRow();
        
        if (line.type !== 'Line') continue;
        
        line.group    = group;
        line.selected = false;
        line.loaded   = false;
        
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
    
    let grplab = getDisplayedOption(flds.get('GroupBy'));
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
            setTableName:  true,
            setTableTitle: 'Chart Definition', 
            maxSize:       19,
            ignoreColumns: 'Modified,Comment', 
            onClick:       'definitionRowClick(this)'});
        chartDef = new Table('chartdefinition');
        
        setHidden('chartdefinition', fieldsId === 'displaychart');
        
        if (fieldsId === 'displaychart') {
            if (chartDef.getRowCount() < 2) return;
          
            setGroupBy();
            setLines();
            return;
        }
        defineChart('LoadSource');
    }
    pars = addParameter(pars, 'Chart', element.value);
    /*
     * Without the final parameter the change group fields parameter from input to text area caused a failure.
     * Don't really know why. Perhaps it to longer to establish the chart definition table to load. The failure
     * occured because chartDef was undefined.
     */
    ajaxLoggedInCall('Chart', processResponse, pars, true);
}
function clearFields(id) {
    let flds = new ScreenFields(id);
    
    flds.clear();
}
function menuChartBuild(element) {
    let option = typeof element === 'string'? element : element.value;

    setHidden('chart',            true);
    setHidden('chartdefinition',  true);
    setHidden('source',           true);
    setHidden('dvdfbody',         true);
    setHidden('displaychart',     option !== 'displaychart');
    setHidden('definechart',      option !== 'definechart');
    clearTable('chartdefinition', true);
    clearTable('srctab',          true);
    clearFields('displaychart');
    
    switch (option) {
        case 'definechart' :
            setHidden('source',          false);
            setDefineChartAction('update');
            let sethc = (new ScreenFields('dvdfbody')).get('SetHexColour');
            sethc.checked = false;
            onHandler(sethc);
            break;
        case 'displaychart':
            appmode = 'display';
            setHidden('chart', false);
            break;
    }
}
function setDBFields(update) {    
    setHidden('dfdatabase',      !update);
    setHidden('dfdbsel',          update);
    setHidden('chartdefinition', !update);
}
function setDefineChartAction(action, keepdata) {    
    let flds   = new ScreenFields('definechart');
    let update = action === 'update';
    
    if (!defaultNull(keepdata, false)) {
        clearFields('definechart');
        clearFields('dfselfld');
        clearTable('chartdefinition', true);
        clearTable('srctab', true);
    }
    setDBFields(update);
    flds.setReadOnly('Title',     update);
    flds.setReadOnly('Source',    update);
    setHidden('dvdfbody',        true);
    
    switch (action) {
        case 'update':
            setHidden('dvdfbody',      false);
            setHidden('dfchhide',       false);
            setHidden(flds.get('Name'), true);
            setHidden('dfnew',          false);
            getElement('dfaction').value = 'Update';
            break;
        case 'create':
            flds.setValue('Database',   getElement('dfdbsel').value);
            setHidden('dfchhide',       true);
            setHidden(flds.get('Name'), false);
            setHidden('dfnew',          true);
            getElement('dfaction').value = 'Create';
            break;
        default:
            throw new ErrorObject('Code Error', 'DefineChart action ' + action + ' is invalid');
    }
    appmode = action;
}

function changePartColumn(element) {
    let action = element.value;
    let flds   = new ScreenFields('dvdfbody');
    let col    = flds.getValue('Name');
    let part   = getRadioValue('SetType');
    
    if (part === '') {
        displayAlert('', 'Select an Update Part Column');
        return;
    }
    if (action === 'Set') {
        if (col === '') {
            displayAlert('', 'Set requires a data column to be selected');
            return;
        }
    } else if (action === 'Clear') {
        if (part.startsWith('line'))
            col = '';
        else if (col === '') {
            displayAlert('', 'Clear for Group and Filter requires a data column to be selected');
            return;            
        }
    } else
        throw new ErrorObject('Code Error', 'changePartColumn action ' + part + ' is invalid');
    
    switch (part) {
        case 'filter':
            updateArray(flds, 'FilterFields', col, action === 'Clear');
            break;
        case 'linecolumn':
            flds.setValue('SourceColumn', col);
            
            if (col !== '') {
                if (flds.getValue('LineName') === '') flds.setValue('LineName', col);
                if (flds.getValue('DataName') === '') flds.setValue('DataName', col);
            }
            break;
        case 'linefilter':
            flds.setValue('FilterColumn', col);
            
            if (col === '') flds.setValue('FilterValue', '');
            
            break;
        case 'group':            
            updateArray(flds, 'GroupFields', col, action === 'Clear');
            break;
        case 'filter':
            break;
        default:
            throw new ErrorObject('Code Error', 'Column update ' + part + ' is invalid');
    }
    console.log('Action ' + action + ' part ' + part + ' value ' + col);
}
function setPartMode(type, update) {    
    let flds   = new ScreenFields('dvdfbody');
    
    if (type !== 'Filter') {
        flds.setReadOnly(type + 'Name',  update);
        flds.setReadOnly(type + 'Index', update);
    }
    
    flds.get(type + 'ActionM').value = update? 'Update' : 'New';
    
    if (update) return;
    /*
     * Get the first parent element that is a fieldset. Get the screen fields for the parent, so only
     * the fields for it are cleared.
     */
    let par = getElementParent(flds.get(type + 'Name'), 'FIELDSET', 'tagname');
    
    flds = new ScreenFields(par.id);
    /*
     * Exclude the command buttons from deing cleared.
     */
    let exclude = type + 'ActionM,' + type + 'ActionD,' + type + 'ActionR';
    
    flds.clear(exclude);        
}
function appendField(pars, separator, field) {
    field = defaultNull(field, '');
    
    if (pars === null)
        pars = field;
    else
        pars += separator + field;
    
    return pars;        
}

function setColourType(tohex) {
    let sethc = (new ScreenFields('dvdfbody')).get('SetHexColour');
    
    sethc.checked = tohex;
    onHandler(sethc);
}
function getColour(flds, required) {
    return flds.getValue(flds.get('SetHexColour').checked? 'HexColour' : 'Colour', required);
}
function validateLine(flds) {
    let colour = getColour(flds, true);
    
    if (!flds.hasValue('LineName',     true)) return null;
    if (!flds.hasValue('LineIndex',    true)) return null;
    if (!flds.hasValue('SourceColumn', true)) return null;
    if (!flds.hasValue('DataName',     true)) return null;    
    if (colour === '')                        return null; 
    
    let fltcol = flds.getValue('FilterColumn');
    let fltval = flds.getValue('FilterValue');
    
    if (fltcol !== '' && fltval === '') {
        flds.report('FilterColumn', 'requires a filter value');
        return null;
    }
    if (fltcol === '' && fltval !== '') {
        flds.report('FilterValue', 'requires a filter column');
        return null;
    }
    let pars   = colour;
    pars = appendField(pars, ',', flds.getValue('SourceColumn'));
    pars = appendField(pars, ':', flds.getValue('Aggregate'));
    pars = appendField(pars, ':', flds.getValue('DataName'));
    
    if (fltcol !== '') {
        pars = appendField(pars, ',', fltcol);
        pars = appendField(pars, '=', fltval);
        
    }
    return pars;
} 
function writeToDB(element) {
    let pars;
    let flds    = new ScreenFields(getElementParent(element, 'FIELDSET', 'tagname')); 
    let chart   = (new ScreenFields('definechart')).getValue('Chart');
    let setcmpl = flds.get('SetComplete').checked;
    
    function processResponse(response) {
        console.log('Response ',response);
    }
    if (chartDef.getRowCount() === 0) {
        displayAlert('', 'Chart ' + chart + ' has no definition rows');
        return;
    }
    pars = createParameters('DeleteDefinition');
    pars = addParameter(pars, 'Chart', chart);
    ajaxLoggedInCall('Chart', processResponse, pars, false);
    chartDef.writeRowsToDB('Chart');
    pars = createParameters('SetComplete');
    pars = addParameter(pars, 'Complete', setcmpl);
    ajaxLoggedInCall('Chart', processResponse, pars, false);

} 
function defineCommand(element) {    
    let type   = camelToWords(element.name).split (' ')[0];
    let par    = getElementParent(element, 'FIELDSET', 'tagname');
    let flds   = new ScreenFields(par.id);
    let action = element.value;
    let params = null;
    
    if (element.value === 'Reset') {
        setPartMode(type, false);
        return;
    }
    if (type === 'Line' && action !== 'Delete') {
        params = validateLine(flds);
        
        if (params === null) return;
    }
    switch (action) {
        case 'Delete':
        case 'New':
        case 'Update':
            updateDefinitionRow(type, action, params);
            break; 
        default:
            console.log('defineCommand action ' + action + ' not implemented');
    }
}
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
            setDefineChartAction('update', true);
            setCharts();
            flds.setValue('Chart', flds.getValue('Name'));
            return;
        }        
        loadJSONArray(response, 'source', 
            {setTableTitle: 'Columns', maxSize: 19, onClick: "dataSourceRowClick(this)"});
    }
    if (action === 'New') {
        flds.clear();
        clearTable('srctab', true);
        setDefineChartAction('create');
        return;
    }
    if (action === 'LoadSource') {
        (new ScreenFields('dfselfld')).clear();
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
        case 'Define' :
            break;
        case 'Display' :
            break;
        default:
            throw new ErrorObject('Code Error', 'Chart action ' + action + ' is invalid');
    }
    console.log('Manaintain action ' + element.value);
}
function testselect(element) {
    let flds = new ScreenFields('test');
    
    switch (element.name) {
        case 'TestSelect':
            let val = flds.getValue('TestSelect');            
            displayAlert('Test', 'Value selected ' + val + ' selected option ' + getDisplayedOption(flds.get('TestSelect')));
            break;
        case 'SetSelVal':
            flds.setValue('TestSelect', flds.getValue('SetSelVal'));
            break;
        case 'RadioOption':
            setRadioValue(flds.getValue('RadioName'), flds.getValue('RadioOption'));
            break;
        default:
            displayAlert('Error', 'Test action ' + element.name + ' not implemented');
    }
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    chart = new Charter('myChart');
    setRadioValue('menu',    'displaychart');
    setRadioValue('SetType', 'linecolumn');
    menuChartBuild('displaychart'); 
    setCharts();
}

