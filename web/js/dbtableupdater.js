/* 
 * Provides for the creation of forms to map onto a database table and the creation and
 * update of the database using the forms
 */
/* global reporter, BaseOptions */

'use strict';
/*
 * Stores the table definitions under a unique key. It is updated by the DatabaseTable constructor. It is used by
 * the function tableFormChange, which is passed to on handlers with tableForms key for the relevant DatabaseTable
 * object for the form accessed.
 */
var tableForms = {};


function tableFormChange(key) {
    var table = tableForms[key];
    
    table._onevent(key);
}
/*
 * Defines the attributes for a table column.
 */
function ColumnOptions() {   
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'label',      type: 'string',  default: null,      mandatory: false});
    this.addSpec({name: 'isPrimeKey', type: 'boolean', default: false,     mandatory: false});
    this.addSpec({name: 'type',       type: 'string',  default: 'VARCHAR', mandatory: false});
    this.addSpec({name: 'mandatory',  type: 'boolean', default: false,     mandatory: false});
    this.addSpec({name: 'modifiable', type: 'boolean', default: true,      mandatory: false});
    this.addSpec({name: 'size',       type: 'number',  default: 0,         mandatory: false});
    this.addSpec({name: 'colElement', type: 'object',  default: null,      mandatory: false});
        
    this.clear();
}
/*
 * The _ indicates that the variable is private to the implementation of the class. According to
 * the documentation for a class, starting a variable with # should ensure a variable is private,
 * however this does not appear to work
 */
class TableColumn {
    _attributes = new ColumnOptions();
    _name;
    _table;
    /*
     * 
     * @param String columnName
     * @param Table  The owning table, but can be undefined.
     * 
     * @returns {TableColumn}
     */
    constructor(columnName, table) {
        this._name  = columnName;
        this._table = table;
    }
    _tableUpdate() {
        if (this._table !== undefined) this._table._columnChanged(this);
    }
    get name() {
        return this._name;
    }
    setAttributes(values) {
        this._attributes.load(values);
        this._tableUpdate();
    }
    setAttribute(name, value) {
        this._attributes.setValue(name, value);
        this._tableUpdate();
    }
    getAttribute(name) {
        return this._attributes.getValue(name);
    }
    get htmlType() {
        switch (this.getAttribute('type')) {
            case 'INT':
            case 'REAL':
            case 'FLOAT':                
                return 'number';
                break;
        default:
            return 'text';
        }
    }
    addRequestParameter(parameters) {
        var value = this.name + ',' + 
                this.getAttribute('colElement').value + ',' + 
                this.getAttribute('type')             + ',' + 
                this.getAttribute('isPrimeKey');
        
        return addParameter(parameters, 'column', value);
    }
}
class DatabaseTable {
    _formId;
    _name;
    _server;
    _displayName;
    _columns      = [];
    _index        = new Map();
    _maxLabelSize = -1
    _calcMaxLabel = true
    
    _checkEnteredValue(colName) {
        var col = this.getColumn(colName);
        var elm = col.getAttribute('colElement');
        var lab = elm.parentElement.firstChild;
        var val = getFieldValue(elm, col.getAttribute('mandatory'));
        
        if (val === undefined) return false;
        
        switch (col.getAttribute('type')) {
            case 'DATETIME':
                return checkTimestamp(elm, false);
                break;
            case 'DATE':
                return checkDate(elm, false);
                break;
            case 'TIME':
                return checkTime(elm, false);
                break;
            default:
                console.log('Column ' + col.name + ' type ' + col.getAttribute('type'));
        }
        return true;
    }
    _executeCommand() {
        var btn        = event.target;
        var action     = btn.value;
        var cols       = this._columns;
        var check;
        var add;
        var parameters = createParameters('updatetable');
        parameters = addParameter(parameters, 'table', this.name + ',' + action);
        
        for (const col of this.getColumns()){
            switch (action) {
                case 'Read':
                    check = col.getAttribute('isPrimeKey');
                    add   = true;
                    break;
                case 'Create':
                    check = true;
                    add   = true;
                case 'Update':
                    check = true;
                    add   = true;
                    break;
                case 'Delete':
                    check = col.getAttribute('isPrimeKey');
                    add = check;
            }
            
            if (check && !this._checkEnteredValue(col.name)) return false;
            
            if (add) parameters = col.addRequestParameter(parameters);
        }
        function processResponse(response) {
            if (action === 'Read' && response.startsWith('{')) {
                var json  = stringToJSON(response);
                var jdata = json.getMember('Data', true).value;
                var jcols;
                var jcol;
                var col;
                var i     = 0;
                
                jdata.setFirst();
                
                if (jdata.isNext()) {
                    jcols = jdata.next().value;
                    jcols.setFirst;
                    
                    while (jcols.isNext()) {
                        col  = cols[i++];
                        jcol = jcols.next();
                        col.getAttribute('colElement').value = jcol.value;
                    }
                } else
                    console.log('Server error-json column data is empty');
            } else {
                if (response.startsWith('!')) {
                    var fields = response.split('!');
                    
                    displayAlert(action + ' Failure', fields[1] + ' in ' + fields[2]);
                } else if (response.length > 2) {
                    displayAlert(action + ' Failure', response);
                }
            }
        }
        ajaxLoggedInCall(this.server, processResponse, parameters);
        return true;
    }
    _onevent(key) {
        var type    = event.target.type;
        var parent  = event.target.parentElement;
        var colName = 'N/A';
        /*
         * Each column is contained in a div element that data attribute the contains the database column name
         * allowing the relevent column object to be retrieved.
         */
        if (type === 'button')
            this._executeCommand();
        else {
            colName = parent.dataset.name;
            this._checkEnteredValue(colName);
        }
        
        console.log('OnEvent called for ' + key + ' type ' + type + ' column ' + colName);
    }
    /*
     * This allows changes to a column that changes the table as a whole to be taken account of. At the moment
     * this is the calculation of the max label size. This requires that the columns are created with the
     * table as the owner.
     */
    _columnChanged(col) {
        var lab = col._attributes['label'];
        
        if (lab !== null && this._calcMaxLabel && lab.length > this._maxLabelSize) this._maxLabelSize = lab.length;
    }
    /*
     * If maxLabelSize is undefined, the max label size is calculated, otherwise, it should be an
     * integer that is the size of the largest field label.
     */
    constructor(tableName, maxLabelSize, formId, server) {
        this._name        = tableName;
        this._displayName = tableName;
        this._formId      = formId;
        this._server      = server;
        
        tableForms[formId] = this;
        
        if (maxLabelSize !== undefined && maxLabelSize > 0) {
            this._maxLabelSize = maxLabelSize;
            this._calcMaxLabel = false;
        }
    }
    get name() {
        return this._name;
    }
    get server() {
        return this._server;
    }
    set displayName(name) {
        this._displayName = name;
    }
    get displayName() {
        return this._displayName;
    }
    /*
     * Set the element id for the form used to manipulate the table.
     */
    set elementId(id) {
        this._elementId = id;
    }
    get elementId() {
        return this._elementId;
    }
    get maxlabelSize() {
        return this._maxLabelSize;
    }
    /*
     * Adds column name to the table columns. A fatal error is reported if the column is already defined.
     */
    addColumn(name) {
        if (this._index.get(name) !== undefined) reporter.fatalError('Column ' + name + ' already defined for table ' + this._name);
        
        var col = new TableColumn(name, this);
        this._columns.push(col);
        this._index.set(name, this._columns.length - 1);
        
        return col;
    }
    /*
     * Returns true if a column with name is defined in the table.
     */
    existsColumn(name) {
        return this._columns[this._index.get(name)] !== undefined;
    }
    /*
     * Returns the column details for name. A fatal error is reported if column name is not defined for the table.
     */
    getColumn(name) {
        if (this._index.get(name) === undefined) reporter.fatalError('Column ' + name + ' not defined for table ' + this._name);

        return this._columns[this._index.get(name)];
    }
    /*
     * Returns the table columns in an array in the order the columns were added to the table.
     */
    getColumns() {
        return this._columns;
    }
    logObject(jobj) {
        while (jobj.isNext()) {
            var jmem = jobj.next();
            
            console.log('Name ' + jmem.name + ' value ' + jmem.value);
        }
    }
    loadJsonDefinition(details) {
        var json  = (new JSONReader(details)).getJSON();
        var jhdr  = json.getMember('Header',  true).value;
        var jcols = json.getMember('Columns', true).value;
        var col;
        
        this.displayName = jhdr.getMember('DisplayName', true).value;
        
        while (jcols.isNext()) {
            var jcol = jcols.next().value;
            
            col = this.addColumn(jcol.getMember('Name', true).value);
            col.setAttribute('label',       jcol.getMember('Label',      true).value);
            col.setAttribute('isPrimeKey',  jcol.getMember('PKeyColumn', true).value);
            col.setAttribute('type',        jcol.getMember('Type',       true).value);
            col.setAttribute('mandatory',  !jcol.getMember('Nullable',   true).value);
            col.setAttribute('modifiable',  jcol.getMember('Modifiable', true).value);
            col.setAttribute('size',        jcol.getMember('Size',       true).value);
        }
    }
    _createFormRow(form, col) {
        var fRow = createElement(document, 'div', {append: form, 'data-name': col.name});
        
        return fRow;
    }
    _addButton(parent, name, value) {
        var elm  = createElement(document, 'input', {append: parent, name: name, type: 'button', value: value});
        
        elm.setAttribute('onclick', 'tableFormChange("' + this._formId + '");');
    }
    createForm() {
        var root = getElement(this._formId);
        var cols = this.getColumns();
        var col;
        var fRow;
        var size;
        var type;
        var elm;
        
        while (root.lastElementChild) {
            root.removeChild(root.lastElementChild);
        }
        createElement(document, 'h2', {append: root, text: this.displayName, class: 'centre'});
        
        for (var i=0; i < cols.length; i++){
            col  = cols[i];
            fRow = this._createFormRow(root, col);
            size = col.getAttribute('size');
            type = col.htmlType;
            createElement(document, 'label', {append: fRow, class: 'largelab', text: col.getAttribute('label'), forceGap: '4px'});;
            
            if (size > 50)
                elm = createElement(document, 'textarea', {append: fRow, cols: 15, rows: 2});
            else
                elm = createElement(document, 'input', {append: fRow, type: type, size: size});
            
            col.setAttribute('colElement', elm);            
            elm.setAttribute('onchange', 'tableFormChange("' + this._formId + '");');
        }
        fRow = createElement(document, 'div', {append: root, class: 'centre'});
        this._addButton(fRow, 'Create Row', 'Create');
        this._addButton(fRow, 'Read Row',   'Read');
        this._addButton(fRow, 'Update Row', 'Update');
        this._addButton(fRow, 'Delete Row', 'Delete');
    }
}
function getTableDefinition(server, tableName, formId) {
    var parameters = createParameters('getTableDefinition');
    var table      = new DatabaseTable(tableName, -1, formId, server);

    parameters = addParameter(parameters, 'table', tableName);

    function processResponse(response) {     
        table.loadJsonDefinition(response);
    }
    ajaxLoggedInCall(table.server, processResponse, parameters, false);
    return table;
}