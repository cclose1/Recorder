/* 
 * Provides for the creation of forms to map onto a database table and the creation and
 * update of the database using the forms
 */
/* global reporter, BaseOptions */

'use strict';
/*
 * Stores the table definitions under a unique key. It is updated by the DatabaseTable constructor. It is used by
 * the function tableFormChange, which
 *  is passed to on handlers with tableForms key for the relevant DatabaseTable
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
    this.addSpec({name: 'source',     type: 'string',  default: null,      mandatory: false});
    this.addSpec({name: 'isPrimeKey', type: 'boolean', default: false,     mandatory: false});
    this.addSpec({name: 'type',       type: 'string',  default: 'VARCHAR', mandatory: false});
    this.addSpec({name: 'mandatory',  type: 'boolean', default: false,     mandatory: false});
    this.addSpec({name: 'modifiable', type: 'boolean', default: true,      mandatory: false});
    this.addSpec({name: 'size',       type: 'number',  default: 0,         mandatory: false});
    this.addSpec({name: 'colElement', type: 'object',  default: null,      mandatory: false});
        
    this.clear();
}
function setFormFieldsOptions(pOptions) {        
    BaseOptions.call(this, false);

    this.addSpec({name: 'lock',       type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'lockPrime',  type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'clearValue', type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'update',     type: 'boolean', default: false, mandatory: false});

     this.clear();
     this.load(pOptions, true);
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
    /*
     * Returns null if the column does not have a source, otherwise returns an with field table and column.
     */
    get source() {
        var spec = this.getAttribute('source');
        
        if (spec === null) return null;
        
        var flds = spec.split('.');
        
        if (flds.length !== 2) reporter.fatalError('Column ' + name + ' source spec -' + spec + '- invalid');
        
        return {
            table:  flds[0],
            column: flds[1]
        };
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
    /*
     * Set field to single value, the default, or a select list of allowed values.
     * 
     * @param {type} yes If select list.
     */
    setFieldToList(yes) {
        var celm = this.element;
        var nelm;
                                       
        if (celm.tagName === (yes? 'select' : 'input')) return; /* Already correct tag. */
        
        if (yes)
            nelm = createElement(document, 'select');
        else
            nelm = createElement(document, 'input', {type: this.htmlType, size: this.size});
        
        nelm.setAttribute('onchange', 'tableFormChange("' + this._table.formId + '");');
        celm.parentElement.replaceChild(nelm, celm);
        this.setAttribute('colElement', nelm);
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
    get isPrimeKey() {
        return this.getAttribute('isPrimeKey');
    }
    get element() {
        return this.getAttribute('colElement');
    }
    addRequestParameter(parameters) {
        var value = this.name                         + ',' + 
                this.getAttribute('type')             + ',' + 
                this.getAttribute('isPrimeKey')       + ',' +
                this.getAttribute('colElement').value ;
        
        return addParameter(parameters, 'column', value);
    }
}
class DatabaseTable {
    _formId;
    _buttons;
    _next;
    _name;
    _parent;
    _server;
    _formUsage;
    _exitHandler     = null;
    _displayName;
    _changesNotSaved = false;
    _columns         = [];
    _index           = new Map();
    _maxLabelSize    = -1
    _calcMaxLabel    = true
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
    };
    actionCancel(alertData) {
        console.log('Cancel called');
        this._next.value = '';
    }
    actionClick(alertData) {
        console.log('Click called');
        this._unsavedChanges = false;
        this._displayForm(alertData.usage);
    }
    get formId() {
        return this._formId;
    }
    get name() {
        return this._name;
    }
    set parent(name) {
        this._parent = name;
    }
    get parent() {
        return this._parent;
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
    get keyColumns() {
        var key = [];
        
        for (const col of this.getColumns()){
            if (col.isPrimeKey) key.push(col);
        }
        return key;
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
    _createFormRow(form, col) {
        var fRow = createElement(document, 'div', {append: form, 'data-name': col.name});
        
        return fRow;
    }
    _removeButtons() {
        removeChildren(this._buttons);
    }
    _addButton(name, value) {
        var elm  = createElement(document, 'input', {append: this._buttons, name: name, type: 'button', value: value});
        
        elm.setAttribute('onclick', 'tableFormChange("' + this._formId + '");');
    }
    _updateNext(action, options) {
        var elm;
        
        switch (action) {
            case 'create':
                elm = createElement(document, 'div', {append: getElement(this._formId), class: 'centre'});
                createElement(document, 'label', {append: elm, text: 'Next', forceGap: '4px'});
                this._next = createElement(document, 'select', {append: elm});
                this._next.setAttribute('onchange', 'tableFormChange("' + this._formId + '");');
                addOption(this._next, '');
                break;
            case 'clear':
                this._next.innerHTML = "";
                break;
            case 'add':
                var opts = options.split(',');
                
                for (const option of opts){
                    addOption(this._next, option.trim());
                }
                break;
            default:
                console.log('Next action ' + action + ' is invalid');
        }
    }
    _populateListField(col, source, filter) {
        var value = col.element.value;
        
        col.setFieldToList(true);
        getList(this.server, {
            table:      source.table,
            field:      source.column,
            element:    col.element,
            filter:     filter,
            keepValue:  false,
            async:      false,
            allowBlank: true});        
        col.element.value = value;
    }
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
    set _unsavedChanges(yes) {
        this._changesNotSaved = yes && this._formUsage !== 'read';
    }
    get _unsavedChanges() {
        return this._changesNotSaved;
    }
    _executeCommand() {
        var btn    = event.target;
        var action = btn.value;
        var cols   = this._columns;
        var check;
        var add;
        var parameters = createParameters('updatetable');
        
        parameters = addParameter(parameters, 'table', this.name + ',' + action);
        
        for (const col of this.getColumns()){
            switch (action) {
                case 'Read':
                    check = col.isPrimeKey;
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
                    check = col.isPrimeKey;
                    add   = check;
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
                    return false;
                } else if (response.length > 2) {
                    displayAlert(action + ' Failure', response);
                    return false;
                }
            }
        }
        ajaxLoggedInCall(this.server, processResponse, parameters);
        this._unsavedChanges = false;
        
        return true;
    }
    _setSelectKey(selectedColumn) {        
        var filter    = '';
        var clear     = false;
        var useNext   = false;
        var value     = '';
        var inParent;
        var listCol;
        var listSrc;
        var source;
        
        if (selectedColumn !== undefined && !this.getColumn(selectedColumn).isPrimeKey) return; // Ignore non prime key column selects.
        
        for (const col of this.keyColumns){
            value  = col.element.value;
            source = col.source;
            
            if (this._formUsage !== 'create')
                source = {table: this.name, column: col.name};
            else {
                inParent = true;
                
                if (source === null) 
                    inParent = false; // This field does not have list.
                else if (source.table !== this.parent) {
                    /*
                     * This column has list but not sourced by parent.
                     */
                    this._populateListField(col, source, '');
                    inParent = false;
                }
                if (!inParent) {
                    continue;
                }
            }
            setReadOnly(col.element, false);
            
            if (clear) {
                /*
                 * The first blank key column has been found, so clear value and lock against update.
                 */
                col.element.value = '';
                this._setReadOnly(col, true);
            } else if (value !== '' && !useNext) {
                if (col.element.tagName !== 'SELECT') {
                    /*
                     * Convert back to a select list with value as selected
                     */
                    this._populateListField(col, source, filter);
                    col.element.value = value;
                }
                /*
                 * This field to be added to list filter. If value was established by
                 * selection from the list, set useNext to trigger list creation for 
                 * following field.
                 */
                filter  = addDBFilterField(filter, col.element, col.name);
                useNext = selectedColumn !== undefined && col.name === selectedColumn;
            } else {
                /*
                 * This is the first blank key field or the one following a list selection and 
                 * is the field that needs a list of allowed values.
                 */
                listCol = col;
                listSrc = source;
                clear   = true;
            }
        }
        if (listCol !== undefined) this._populateListField(listCol, {table: this.name, column: listCol.name}, filter);
    }
    /*
     * The column read only. If the element is a select box, it is converted to a text box and
     * its selected value is copied.
     */
    _setReadOnly(col, on) {
        if (col.element.tagName === 'SELECT') {
            if (on) {
                /*
                 * A select cannot be made read only, so convert it to a text input and
                 * set it to the selected value.
                 */
                var val = col.element.value;
                
                col.setFieldToList(false);
                col.element.value = val;
                setReadOnly(col.element, on);
            }
        } else 
            setReadOnly(col.element, on);
    }
    _setFormFields(options) {
        options = new setFormFieldsOptions(options);
        
        for (const col of this.getColumns()){
            if (col.isPrimeKey) {
                if (options.lockPrime) this._setReadOnly(col, true);
            } else {
                if (options.clearValue) col.element.value = '';
                if (options.lock)       this._setReadOnly(col, true);
                if (options.update) {
                    this._setReadOnly(col, false);
                    
                    if (col.source !== null) this._populateListField(col, col.source, '');
                }
            }
        }
    }
    _displayForm(usage) {
        var next = 'Read, Create, Update, Exit';
        
        if (usage === '') return;
        
        if (usage === undefined) 
            usage = this._formUsage;
        else
            this._formUsage = usage;
        
        this._removeButtons();
        /*
         * Put a check here to add warning for unsaved changes.
         */
        switch (usage) {
            case 'read':
                this._setSelectKey();
                this._setFormFields({clear: true, lock: true});
                this._addButton('Read Row', 'Read');
                next = 'Create, Update, Delete';
                break;
            case 'create':                
                for (const col of this.keyColumns){
                    /*
                     * For create clear key column values.
                     */
                    col.setFieldToList(false);
                    col.element.value = '';
                }
                this._setSelectKey();
                this._addButton('Create Row', 'Create');
                this._setFormFields({clear: true, update: true});
                next = 'Read, Update, Delete';
                break;
            case 'update':
                this._setFormFields({lockPrime: true, update: true});
                this._addButton('Update Row', 'Update');
                next = 'Read, Create, Delete';
                break;
            case 'delete':
                this._setFormFields({lockPrime: true, lock: true});
                this._addButton('Delete Row', 'Delete');
                next = 'Read, Create, Update';
                break;
            case 'exit':
                if (this._exitHandler !== null) this._exitHandler();
                
                return;
            default:
                console.warn('Usage ' + usage + ' not implemented');
        }
        this._updateNext('clear');
        this._updateNext('add', ',' + next + ',Exit');
    }
    _checkUnsavedData(usage) {
        if (this._unsavedChanges)        
            displayAlert(
                'Warning', 
                'Discard unsaved data?',
                {
                    confirm:       this, 
                    autoDismiss:   false, 
                    minWidth:      500,
                    minHeight:     500,
                    blockElements: getElementsByTag('fieldset', getElement('updatetable')), 
                    alertData:     {usage: usage}});
        else
            this._displayForm(usage);               
    }
    _onevent(key) {
        var type    = event.target.type;
        var parent  = event.target.parentElement;
        var colName = parent.dataset.name;
        /*
         * Each column is contained in a div element that data attribute the contains the database column name
         * allowing the relevent column object to be retrieved.
         */
        if (type === 'button')
            this._executeCommand();
        else if (type === 'select-one') {
            if (event.target === this._next)
                this._checkUnsavedData(event.target.value.toLowerCase());
            else {
                this._unsavedChanges = true;
                this._setSelectKey(colName);
            }
        } else {
            this._unsavedChanges = true;
            this._checkEnteredValue(colName);
        }
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
        this.parent      = jhdr.getMember('Parent',      true).value;
        
        while (jcols.isNext()) {
            var jcol = jcols.next().value;
            
            col = this.addColumn(jcol.getMember('Name', true).value);
            col.setAttribute('label',       jcol.getMember('Label',      true).value);
            col.setAttribute('source',      jcol.getMember('Source',     true).value);
            col.setAttribute('isPrimeKey',  jcol.getMember('PKeyColumn', true).value);
            col.setAttribute('type',        jcol.getMember('Type',       true).value);
            col.setAttribute('mandatory',  !jcol.getMember('Nullable',   true).value);
            col.setAttribute('modifiable',  jcol.getMember('Modifiable', true).value);
            col.setAttribute('size',        jcol.getMember('Size',       true).value);
        }
    }
    createForm(exitHandler) {
        var root = getElement(this._formId);
        var cols = this.getColumns();
        var col;
        var fRow;
        var size;
        var type;
        var elm;
        
        if (exitHandler !== undefined && exitHandler !== null) this._exitHandler = exitHandler;
    
        removeChildren(root);
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
        this._buttons = createElement(document, 'div', {append: root, class: 'centre'});
        this._updateNext('create');
        this._displayForm('read');
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