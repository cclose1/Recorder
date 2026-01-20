/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */
'use strict';

var chartDef;
var lines;
var chart;
var appmode;
var filter;
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
function setupFilter(flds) { 
    let def = getFilterDefinition();
    
    if (def.title === null)  {
        setHidden('fltdv', true);
        filter = null;
        return;
    }    
    filter = getFilter('chartfilter', getElement('filter'), null, {
        server:          flds.getValue('DefineEnergy') === 'BloodPressure'? 'Blood' : 'Energy',
        allowAutoSelect: false,
        autoSelect:      false,
        title:           def.title,
        forceGap:        '4px',
        initialDisplay:  false,
        trigger:         getElement('filter')});
    
    for (let i = 0; i < def.fields.length; i++) {
        let fld = def.fields[i];
        
        switch (fld.source) {
            case 'none':
                filter.addFilter(fld.label, {name: fld.column});
                break;
            case 'DB':
                filter.addFilter(fld.label, {
                    name: fld.column, listTable: flds.getValue('Source'), listColumn: fld.column});                    
                break;
            case 'List':
                filter.addFilter(fld.label, {
                    name: fld.column, values: fld.values});
                break;
        }
    }
    setHidden('fltdv', false);
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
/*
 * If index = -1 the index for the first row matching on
 */
function findDefinitionRow(chart, type, name, index) {
    chartDef.setRowFirst();
    /*
     * Used == instead of === to ensure that comparison string comparison with integer return true if
     * the string converted to a number equals the number. === returns false if the compared objects are
     * a different type.
     */
    while (chartDef.nextRow()) {
        if ((chartDef.columnValue('Chart')     === chart &&
             chartDef.columnValue('PartType')  === type  &&
             (chartDef.columnValue('PartName') === name   || name === '') && 
             (chartDef.columnValue('PartIndex') == index) || index === -1))
        return chartDef.getRowIndex();        
    }
    return -1;    
}
function updateDefinitionRow(fields, action) {  
    let flds     = new ScreenFields('definechart');
    let chart    = flds.getValue('Chart');
    let flttlrow = -1;
    
    flds = new ScreenFields('dvdfbody');
    
    function createRow(name, index, params) {       
        row = chartDef.addRow('definitionRowClick(this)');
        chartDef.setColumnValue('Chart',     chart);
        chartDef.setColumnValue('PartType',  fields.type);
        chartDef.setColumnValue('PartName',  name);
        chartDef.setColumnValue('PartIndex', index);
        chartDef.setColumnValue('Params',    params);
    }
    function updateFilterTitle() {
        if (fields.type !== 'Filter') return;
        
        if (action === 'Delete') {
            if (findDefinitionRow(chart, fields.type, '', -1) === -1 && flttlrow !== -1) chartDef.deleteRow(flttlrow);
        } else {
            if (flttlrow === -1) flttlrow = createRow(fields.title, 1, '');
            
            chartDef.setRowIndex(flttlrow);
            chartDef.setColumnValue('PartName',  fields.title);
        }
    }    
    if (fields.type === 'Filter') {
        flttlrow = findDefinitionRow(chart, 'Filter', '', 1);
    }    
    let row  = findDefinitionRow(chart, fields.type, fields.name, fields.index);
    let key  = chart + ':' + fields.type + ':' + fields.name + ':' + fields.index;
   
    console.log('Action ' + action + ' Key ' + key + ' Row ' + row);
    
    switch (action) {
        case 'New':
            if (row !== -1) {
                displayAlert('Error', key + ' already exists');
                return;
            }
            row = createRow(fields.name, fields.index, fields.params);
            updateFilterTitle();
            break;
        case 'Update':
            if (row === -1) {
                displayAlert('Error', key + ' does not exists');
                return;
            }
            chartDef.setColumnValue('Params', fields.params);
            updateFilterTitle();
            break;
        case 'Delete':
            if (row === -1) {
                displayAlert('Error', key + ' does not exists');
                return;
            }
            chartDef.deleteRow(row);
            updateFilterTitle();
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
            if (line.index === '1')
                line.title = line.name;
            else {
                let fpars = params.split(',');
                
                line.column       = line.name;
                line.valuessource = 'none';
                line.label        = '';
                line.values       = '';
                
                switch (fpars.length) {
                    case 1:
                        line.label  = fpars[0];
                        break;
                    case 2:
                        line.label        = fpars[0];
                        line.valuessource = fpars[1];
                        break;
                    case 3:
                        line.label        = fpars[0];
                        line.valuessource = fpars[1];
                        line.values       = fpars[2];
                    default:
                }
            }
            break;
        case 'Group':
            line.fields = params;
            break;
        default:
            throw new ErrorObject('Code Error', 'Filter params ' + params + ' are invalid');
    }
    return line;
}

function definitionRowClick(row) {    
    let line = getDefinitionRow(row.sectionRowIndex);
    let flds = new ScreenFields('dvdfbody');
    
    if (appmode === 'update') {
        switch (line.type) {
            case 'Filter':
                if (line.index === '1')
                    flds.setValue('FilterTitle', line.title);
                else {
                    flds.setValue('FilterIndex',  line.index);
                    flds.setValue('FilterName',   line.column);
                    flds.setValue('FilterLabel',  line.label);
                    flds.setValue('FilterValues', line.values);
                    setValuesSource(line.valuessource);
                }
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
function getFilterDefinition() {
    let filter = {
        title: null,
        fields: []};
    
    chartDef.setRowFirst();
    
    while (chartDef.nextRow()) {
        let line = getDefinitionRow();
        
        if (line.type === 'Filter') {
            if (line.index == 1)
                filter.title = line.name;
            else {
                filter.fields.push(
                        {
                            column: line.column,
                            index:  line.index,
                            label:  line.label === ''? line.column : line.label,
                            source: line.valuessource,
                            values: line.values.replaceAll('|', ',')}
                );
            }
        }
    }
    return filter;
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
function getSelected(flds) {   
    let sPars    = null;
    let selected = {
        lines: [],
        error: false,
        fields: null,
        filter: null
    };
    let col = 1;

    for (let line of lines) {        
        if (line.selected && !line.loaded) {
            if (selected.filter === null) selected.filter = line.filter;
            
            if (selected.filter !== line.filter) continue;
            
            line.loaded = true;
            sPars = line.source.split(':');
            
            if (sPars.length > 1 && sPars[1] === '' && flds.getValue('GroupBy') !== '') {
                displayAlert('Error', 'Line ' + line.name + ' does not support aggregate');
                selected.lines = [];
                selected.error = true;
                return selected;
            }            
            selected.lines.push({
                title:  line.name,
                colour: line.colour,
                source: sPars.length === 3? sPars[2] : sPars[0],
                column: col++},);
            
            if (selected.fields === null) selected.fields = flds.getValue('XColumn') + ':Min';
            
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
    let dataflt  = null;
    
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
    chart.setYUnits(flds.getValue('YUnits'));
    chart.setTickSkip(flds.getValue('TickSkip'));
    chart.setTickInterval(flds.getValue('TickInterval'));
    chart.setTitle(
                chart.getDataType() + 
                (grplab === ''? '' : ' by ' + grplab) +
                ' starting ' + formatDate(flds.getValue('Start'), 'dd-MMM-yy'));
    
    while ((selected = getSelected(flds)).lines.length !== 0) {
        pars    = createParameters('ChartData', {fields: flds.getFields()});
        pars    = addParameter(pars, 'Fields', selected.fields);
        data    = true;
        dataflt = null;
        
        if (filter !== null) dataflt = filter.getWhere();
              
        if (selected.filter !== '') dataflt = appendField(dataflt, ',', selected.filter);
            
        if (dataflt !== null) pars = addParameter(pars, 'filter', dataflt);
        
        ajaxLoggedInCall('Chart', processResponse, pars, false);
    }
    if (selected.error) return;
    if (!data) displayAlert('Error', 'Must select at least one data line', {position:  getElement('dvdfbody')});
    
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
        flds.setValue("XColumn",  json.getMember('XColumn').value);;
        flds.setValue("YUnits",   json.getMember('YUnits').value);
        
        loadJSONArray(definition, 'chartdefinition', {
            setTableName:  true,
            setTableTitle: 'Chart Definition', 
            maxSize:       19,
            ignoreColumns: 'Modified,Comment', 
            onClick:       'definitionRowClick(this)'});
        chartDef = new Table('chartdefinition');
        setupFilter(flds);
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
            displayAlert('Validation Failure', 'Set requires a data column to be selected', {position: getElement('dvdfbody')});
            return;
        }
    } else if (action === 'Clear') {
        if (part.startsWith('line') || part.startsWith('filter'))
            col = '';
        else if (col === '') {
            displayAlert('Validation Failure', 'Clear for Group and Filter requires a data column to be selected');
            return;            
        }
    } else
        throw new ErrorObject('Code Error', 'changePartColumn action ' + part + ' is invalid');
    
    switch (part) {
        case 'filter':
            flds.setValue('FilterName', col);
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
function screenCheckDate(element, required) {
    let flds = getElementScreenFields(element);
    let time = flds.get(element.split('~') + '~Time');
    
    let chk = flds.checkValue(element.name, required);
    
    if (!chk.valid) return;
    
    if (chk.value !== '' && time.value === '') time.value = '00:00:00';
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
    flds = getElementScreenFields(flds.get(type + 'Name'));
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
function setValuesSource(source) {
    let flds = new ScreenFields('dvdfbody');
    
    setRadioValue('ValuesSource', source);
    setHidden(flds.get('FilterValues'), source !== 'List');
}
function getColour(flds, required) {
    return flds.getValue(flds.get('SetHexColour').checked? 'HexColour' : 'Colour', required);
}
function validateLine(flds) {
    let colour = getColour(flds, true);
    
    if (!flds.checkValue('LineName', true).valid)     return null;
    if (!flds.checkValue('LineIndex', true).valid)    return null;
    if (!flds.checkValue('SourceColumn', true).valid) return null;
    if (!flds.checkValue('DataName', true).valid)     return null;
    if (colour === '')                                return null; 
    
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
function validatePart(flds, part, action) {
    let fields = {type: part};
    let params = '';
    
    if (!flds.checkValue(part + 'Name',  true).valid)    return null;
    if (!flds.checkValue(part + 'Index', true).valid)    return null;
    
    fields.index = flds.getValue(part + 'Index');   
    fields.name  = flds.getValue(part + 'Name');
   
    switch (part) {
        case 'Filter':
            let source = getRadioValue('ValuesSource');
            
            if (!flds.checkValue('FilterTitle', true).valid) return null;
            
            fields.title = flds.getValue('FilterTitle');
            
            if (!flds.checkValue('FilterName', true).valid) return null;
            
            fields.name = flds.getValue('FilterName');
            params      = flds.getValue('FilterLabel');
            
            switch(source) {
                case 'none':
                    break;
                case 'DB':
                    params += ',' + source;
                    break;
                case 'List':
                    if (!flds.checkValue('FilterValues', true).valid) return null;
                    
                    params += ',' + source + ',' + flds.getValue('FilterValues');
                    break;                    
            }
            fields.params = params;
            break;
        case 'Group':
            if (!flds.checkValue('GroupFields', true).valid) return null;
            
            fields.params = flds.getValue('GroupFields');
            break;
        case 'Line':
            let colour = getColour(flds, true);
            
            if (!flds.checkValue('SourceColumn', true).valid) return null;
            if (!flds.checkValue('DataName', true).valid)     return null;
            if (colour === '')                                return null; 
            
            let fltcol = flds.getValue('FilterColumn');
            let fltval = flds.getValue('FilterValue');
            
            if (!flds.checkValue('SourceColumn', true).valid) return null;
            if (!flds.checkValue('DataName', true).valid)     return null;
            if (colour === '')                                return null; 
                
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
            fields.params = pars;
            break;            
    };
    return fields;
} 
function validateLine(flds) {
    let colour = getColour(flds, true);
    
    if (!flds.checkValue('LineName', true).valid)     return null;
    if (!flds.checkValue('LineIndex', true).valid)    return null;
    if (!flds.checkValue('SourceColumn', true).valid) return null;
    if (!flds.checkValue('DataName', true).valid)     return null;
    if (colour === '')                                return null; 
    
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
    let fields = validatePart(flds, type);
    
    if (fields === null) return;
    
    if (element.value === 'Reset') {
        setPartMode(type, false);
        return;
    }
    switch (action) {
        case 'Delete':
        case 'New':
        case 'Update':
            updateDefinitionRow(fields, action, params);
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
function logMouseEvent(event) {
    logMouse('charter', event);
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    chart = new Charter('myChart');
    setRadioValue('menu',    'displaychart');
    setRadioValue('SetType', 'linecolumn');
    setValuesSource('none');
    menuChartBuild('displaychart'); 
    setCharts();
    setHidden('test', true);
    document.addEventListener('mousedown', logMouseEvent);
}