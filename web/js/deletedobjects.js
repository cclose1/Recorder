
function OldColumn(cell, no, type, precision, scale, optional, adjustText) {
    this.name       = cell.innerHTML;
    this.no         = no;
    this.type       = type;    
    this.precision  = precision;
    this.scale      = scale;
    this.optional   = optional || false;
    this.class      = '';
    this.size       = null;
    this.minSize    = null;
    this.maxSize    = null;
    this.textWidth  = null;
    this.forceWrap  = false;
    this.adjustText = adjustText;
    
    this.setSize(cell);
    
    if (this.no       !== undefined && this.no > 0) this.addClass('tbcol' + no);
    if (this.optional !== undefined && this.optional) this.addClass('optional');
    if (this.type     !== undefined && (this.type === "int" || this.type === "decimal")) this.addClass('number');
}
OldColumn.prototype.addClass = function (tag) {
    if (this.class !== '')
        this.class += ' ';

    this.class += tag;
};
OldColumn.prototype.setSize = function (element) {
    var length;
    var value = element.innerHTML;
    var font  = readComputedStyle(element, 'font');
    
    if (typeof value === 'number') value = value.toString();
    
    length = value.length;
    
    if (this.size === null || this.size < length) this.size = length;
    
    if (!isNull(font)) {
        length = displayTextWidth(value, font, this.adjustText);
        
        if (this.textWidth === null || this.textWidth < length) this.textWidth = length;        
    }
};
OldColumn.prototype.getClass = function () {
    return this.class;
};
OldColumn.prototype.loadColumnValue = function (cell, value, nullToSpace) {
    value = normaliseValue(value, this.type, this.scale, nullToSpace);
    
    if (typeof value === 'number') value = value.toString();
    
    cell.innerHTML = value;
    
    this.setSize(cell);
};

class OldTableSizer {
    _table;
    _columns = [];
    _font;
    _options;
        
    constructor(table, options) {
        this._table   = getElement(table);
        this._font    = readComputedStyle(this._table, 'font');
        this._options = options;
    }
    table() {
        return this._table;
    }
    addColumn(cell, no, type, precision, scale, optional, adjustText) {        
        this._columns.push(new OldColumn(cell, no, type, precision, scale, optional, adjustText));
    }
    columns() {
        return this._columns;
    }
    column(index) {
        return this._columns[index];
    }
    minSize(index) {
        var col = this._columns[index];
        
        if (!isNull(col.minSize))       return col.minSize;
        if (this._options.usePrecision) return col.precision;
        
        return this._options.minField;
    }
    maxSize(index) {
        var col = this._columns[index];
        
        if (!isNull(col.maxSize)) return col.maxSize;
        
        return this._options.maxField;
    }
    constrainedSize(index) {
        var col  = this.column(index);
        var size = this.minSize(index);
        
        if (!isNull(size) && col.size < size) return size;
        
        size = this.maxSize(index);

        if (!isNull(size) && col.size > size) return size;
        
        return col.size;
    }
    constrainedTextWidth(index) {
        var col  = this.column(index);
        var size = this.constrainedSize(index);
        
        return Math.ceil(col.textWidth * size / col.size);
    }
    applyColumnOptions(options) {
        if (isNull(options)) return;
        
        for (var i = 0; i < options.length; i++) {
            var ocol  = options[i];
            var found = false;

            for (var j = 0; j < this._columns.length; j++) {
                var col   = this._columns[j];
                var oName = ocol.getValue('name');

                if (col.name === oName || oName === '*') {
                    var opt = ocol.getValue('optional');
                    
                    col.minSize   = ocol.getValue('minSize');
                    col.maxSize   = ocol.getValue('maxSize');
                    col.forceWrap = ocol.getValue('forceWrap');
                    
                    if (opt !== null) col.optional = opt; // Override the server value if client value set.
                    
                    found = true;
                }
            }
            if (!found) reporter.fatalError('There is no column "' + oName + '" in table ' + this._table.id);
        }
    }
    log() {
        reporter.log(
                "Sizer details for table " + getCaption(this._table) + 
                    ' Min '                + lpad(this._options.minField, 4) + 
                    ' Max '                + lpad(this._options.maxField, 4)+ 
                    ' Use TextWidth '      + this._options.useTextWidth+ 
                    ' Adjust Text '        + this._options.adjustText);
        for (var j = 0; j < this._columns.length; j++) {
            var col = this._columns[j];

            reporter.log(
                    rpad(col.name, 15) + 
                    ' size '                   + lpad(col.size, 3)                +
                    ' min '                    + lpad(this.minSize(j), 3)         + 
                    ' max '                    + lpad(this.maxSize(j), 3)         +
                    ' constrained '            + lpad(this.constrainedSize(j), 3) + 
                    ' text width '             + lpad(col.textWidth, 4)           + 
                    ' constrained text width ' + lpad(this.constrainedTextWidth(j), 4));
        }
    }
}
class TableSizerOld2 {
    _table;
    _columns = [];
    _font;
    _options;
        
    constructor(table, options) {
        this._table   = getElement(table);
        this._font    = readComputedStyle(this._table, 'font');
        this._options = options;
    }
    table() {
        return this._table;
    }
    addColumn(cell, no, type, precision, scale, optional, adjustText) {        
        this._columns.push(new Column(cell, no, type, precision, scale, optional, adjustText));
    }
    columns() {
        return this._columns;
    }
    column(index) {
        return this._columns[index];
    }
    minSize(index) {
        var col = this._columns[index];
        
        if (!isNull(col.minSize()))     return col.minSize();
        if (this._options.usePrecision) return col.precision();
        
        return this._options.minField;
    }
    maxSize(index) {
        var col = this._columns[index];
        
        if (!isNull(col.maxSize())) return col.maxSize();
        
        return this._options.maxField;
    }
    constrainedSize(index) {
        var col  = this.column(index);
        var size = this.minSize(index);
        
        if (!isNull(size) && col.size() < size) return size;
        
        size = this.maxSize(index);

        if (!isNull(size) && col.size() > size) return size;
        
        return col.size();
    }
    constrainedTextWidth(index) {
        var col  = this.column(index);
        var size = this.constrainedSize(index);
        
        return Math.ceil(col.textWidth() * size / col.size());
    }
    applyColumnOptions(options) {
        if (isNull(options)) return;
        
        for (var i = 0; i < options.length; i++) {
            var ocol  = options[i];
            var found = false;

            for (var j = 0; j < this._columns.length; j++) {
                var col   = this._columns[j];
                var oName = ocol.getValue('name');
                
                function copy(property) {
                    col.setProperty(property, ocol.getValue(property));
                }


                if (col.name() === oName || oName === '*') {
                    copy('minSize');
                    col.setProperty('maxSize',   ocol.getValue('maxSize'));
                    col.setProperty('forceWrap', ocol.getValue('forceWrap'));
                    
                    if (col.optional() !== null) col.setProperty('optional', ocol.getValue('optional')); // Override the server value if client value set.

                    found = true;
                }
            }
            if (!found) reporter.fatalError('There is no column "' + oName + '" in table ' + this._table.id);
        }
    }
    log() {
        reporter.log(
                "Sizer details for table " + getCaption(this._table)         + 
                    ' Min '                + lpad(this._options.minField, 4) + 
                    ' Max '                + lpad(this._options.maxField, 4) + 
                    ' Use TextWidth '      + this._options.useTextWidth      + 
                    ' Adjust Text '        + this._options.adjustText);
        for (var j = 0; j < this._columns.length; j++) {
            var col = this._columns[j];

            reporter.log(
                    rpad(col.name(), 15)       + 
                    ' size '                   + lpad(col.size(), 3)              +
                    ' min '                    + lpad(this.minSize(j), 3)         + 
                    ' max '                    + lpad(this.maxSize(j), 3)         +
                    ' constrained '            + lpad(this.constrainedSize(j), 3) + 
                    ' text width '             + lpad(col.textWidth(), 4)         + 
                    ' constrained text width ' + lpad(this.constrainedTextWidth(j), 4));
        }
    }
}