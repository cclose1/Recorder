/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
'use strict';

var cssed;
var data;

function TestOption1(options) {
    BaseOptions.call(this, false);
    /*
    Object.defineProperty(this, 'xxx', {
        get() {
            return this.getValue('Int1');
        }
    });
    Object.defineProperty(this, 'yyy', {
        get() {
            return this.getValue('Int2');
        }
    });
    */
    this.addSpec({name:'Int1',    type: 'number', default: 0});
    this.addSpec({name:'Int2',    type: 'number', default: -1});
    this.addSpec({name:'Str1',    type: 'string', default: undefined, mandatory: false});
    this.addSpec({name:'Columns', type: 'object', default: undefined, mandatory: false});
    this.clear();
    this.load(options);
}
function TestOption2(options) {
    BaseOptions.call(this, true);
    this.addSpec({name:'int1', type: 'number', default: 0});
    this.addSpec({name:'int2', type: 'number', default: -1});
    this.addSpec({name:'str1', type: 'string', default: 'Default text'});
    this.clear();
    this.load(options);
}
TestOption2.prototype = {    
    get int1() {return this.getValue('int1');},
    get int2() {return this.getValue('int2');},
    get str1() {return this.getValue('str1');}};
TestOption2.prototype.constructor = TestOption2;
function setSheet(sheet) {
    try {        
        var jTable = new arrayToJSONTable('Rules');
        
        cssed.setSheet(sheet === undefined? event.target.value : sheet, true);
        jTable.addColumn('Index',    'index',    'int');
        jTable.addColumn('MedIndex', 'mIndex',   'int');
        jTable.addColumn('Media',    'media',    'varchar');
        jTable.addColumn('Selector', 'selector', 'varchar');
        jTable.addColumn('Rule',     'text',     'varchar');
        loadJSONArray(jTable.getJSON(cssed.getFlattenedRules()), "rules", {maxField: 20, onClick: "ruleClick(this)"});
    } catch (err)
    {
        alert(err);
    }
};
function ruleClick(row) {
    var rdr = new rowReader(row);
    
    while (rdr.nextColumn()) {
        var value = rdr.columnValue();

        switch (rdr.columnName()) {
            case 'Index':
                document.getElementById('index').value = value;
                break;
            case 'MedIndex':
                document.getElementById('mindex').value = value;
                break;
            case 'Media':
                document.getElementById('media').value = value;
                break;
            case 'Selector':
                document.getElementById('selector').value = value;
                break;
            case 'Rule':
                document.getElementById('rule').value = value;
                break;
        }                
    }
}
function testTable() {
    if (data === undefined) {
        var text = 
                '{"Table"  : "Test",' +
                '"Header" : [{"Type":"varchar","Precision":10,"Name":"Item"},{"Type":"boolean","Name":"Available"},{"Type":"decimal","Precision":12,"Scale":2,"Name":"Price"},{"Type":"string","Precision":12,"Name":"Comment"}],' +
                '"Data"   : [["Spanner",null,12.1,"Short"],["Hammer",true,20,"Heavy"],["Wrench",false,25.39]]}';
        data = (new JSONReader(text)).getJSON();
    }
    loadJSONArray(data, "rules", {maxField: 20, onClick: "ruleClick(this)", 
        columns:[{name:'Item',    minWidth: 10}, 
                 {name:'Price',   minWidth: 6},
                 {name:'Comment', minWidth: 10, maxWidth: 15}]});
}

function testCSSEdit() {
    var test = cssed.getRule(
            document.getElementById('selector').value,
            document.getElementById('media').value,
            true);            
}
function testAction(action) {
    switch (action) {
        case 'addItem':
            var row  = new JSON('object');
            var rows = data.getMember('Data', true).value;
            row.addMember('Item', document.getElementById('item').value);
            row.addMember('Available', true);
            row.addMember('Price', Number(document.getElementById('price').value));
            row.addMember('Comment', document.getElementById('comment').value);
            rows.addElement(row);
            testTable();
            break;
        case 'add':
            cssed.addRule(
                    document.getElementById('media').value, 
                    document.getElementById('selector').value, 
                    document.getElementById('rule').value, 
                    document.getElementById('index').value);
            setSheet(document.getElementById('sheet').value);
            break;
        case 'delete':
            cssed.deleteRule(document.getElementById('index').value);
            setSheet(document.getElementById('sheet').value);
            break;        
        default:
    }
};
function testJSON() {
    var opt1 = new TestOption1({Int1: 3,  Int2: 21,  Str1: "Test String", Columns: [{name: 'Col1', minWidth: 12},{name: 'Col2', minWidth: 30}]});
    var opt2 = new TestOption2({int1: 31, int2: 210, str1: "Test String again"});
    var int;
    var text1;
    var jval;
    var jval2;
    var text2;
    var json = new JSON();
    
    testTable();
    
    try {
        throw new Error('Test Error alert false');
    } catch (e) {
        reporter.logThrow(e, false);
    }
    try {
        throw new Error('Test Error alert omitted');
    } catch (e) {
        reporter.logThrow(e);
    }
    int  = opt1.Int1;
    int  = opt1.Int2;
    int  = opt1.xxx;
    int  = opt1.yyy;
    text1 = opt1.Str1;
    int  = opt2.int1;
    int  = opt2.int2;
    text1 = opt2.str1;
    opt1.log();
    opt2.log();
    text2 = text1 || 'x';
    text1 = text2 || 'y';
    text1 = removeURLPath('http://localhost:8080/Recorder/recordspend.css');
    json.addMember("Name1", true);
    json.addMember("Name2", null);
    json.addMember("Name3", 'Value1');
    jval = new JSON('array');
    json.addMember('Array1', jval);
    jval.addElement('Elem1');
    jval2 = new JSON('object');
    jval.addElement(jval2);
    jval2.addMember('Ename1', 12);
    jval2.addMember('Ename2', 'Fred');
    jval2.addMember('Ename3', 3.142);
    jval.addElement('Elem2');
    json.addMember("Name4", 'bill');
    text1 = json.constructor.name;
    text1 = json.toString();
    
    while (json.isNext()) {
        jval = json.next();
    }
    var reader = new JSONReader(text1);
    
    json = reader.getJSON('object');
    text2 = json.toString();
    
    var reader = new JSONReader('{"Table":"Test","Header":[{"Type":"varchar","Name":"Designation"}],"Data":[["BTC"],["ETH"]]}');
    
    json = reader.getJSON('object');
    text2 = json.toString();
    
}
function initialize() {   
    cssed = new CSSEditor();
    
    loadListResponse(cssed.getStyleSheetFiles(), {
        name:         'sheet',
        keepValue:    true,
        async:        false,
        allowblank:   true});
    testJSON();
    
    st.enableLog(true);
    reporter.setFatalAction('throw');
}
function debug() {       
    st.enableLog(true);
    reporter.setFatalAction('throw');
}
function requestDebug() {
    var parameters = createParameters('debug');
    
    parameters = addParameterById(parameters, 'request');
    parameters = addParameterById(parameters, 'maxfield');
    
    function processResponse(response) {
        if (response.indexOf('{') === 0) {
            if (document.getElementById('request').value === 'Show Env')
                loadJSONArray(response, 'resultstable', {maxField: 30, columns: [{name: 'Variable', minWidth: 28},{name: 'Value', maxWidth: 120}]});
            else
                loadJSONArray(response, 'resultstable', {columns: [{name: 'Stream', minWidth: 15}]});
            
            document.getElementById('resultstable').removeAttribute('hidden');
        } else
            alert(response);
    }    
    ajaxLoggedInCall(document.getElementById('handler').value, processResponse, parameters, true);
}
function callDebug() {
    requestDebug();
}
