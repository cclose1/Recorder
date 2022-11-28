/* 
 * Provides for the creation of forms to map onto a database table and the creation and
 * update of the database using the forms
 */
'use strict';
/*
 * Defines the attributes for a table column.
 */
function ColumnOptions(pOptions) {   
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
        this._attributes[name] = value;
        this._tableUpdate();
    }
    getAttribute(name) {
        return this._attributes[name];
    }
}
class DatabaseTable {
    _elementId;
    _name;
    _columns      = [];
    _index        = new Map();
    _maxLabelSize = -1
    _calcMaxLabel = true
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
    constructor(tableName, maxLabelSize) {
        this._name = tableName;
        
        if (maxLabelSize !== undefined) {
            this._maxLabelSize = maxLabelSize;
            this._calcMaxLabel = false;
        }
    }
    get name() {
        return this._name;
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
}