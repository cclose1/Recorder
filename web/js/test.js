/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
'use strict';

var cssed;

function setSheet() {
    try {        
        var jTable = new arrayToJSONTable('Rules');
        
        cssed.setSheet(event.target.value, true);
        jTable.addColumn('Index',    'index',    'int');
        jTable.addColumn('MedIndex', 'mIndex',   'int');
        jTable.addColumn('Media',    'media',    'varchar');
        jTable.addColumn('Selector', 'selector', 'varchar');
        jTable.addColumn('Rule',     'text',     'varchar');
        loadJSONArray(jTable.getJSON(cssed.getFlattenedRules()), "rules", 20, "ruleClick(this)", null, null, false, true);
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
                break;
            case 'MedIndex':
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
function testAction(action) {
    
};
function testJSON() {
    var json = new JSON();
    var jval;
    var jval2;
    var text1;
    var text2;
    
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
    var reader = new jsonReader(text1);
    
    json = reader.getJSON('object');
    text2 = json.toString();
    
    var reader = new jsonReader('{"Table":"Designation","Header":[{"Type":"varchar","Name":"Designation"}],"Data":[["BTC"],["ETH"]]}');
    
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

