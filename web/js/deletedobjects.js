function test() {
    var table;
    var body;
    var type      = 'number';
    var testval;
    var elms      = document.querySelectorAll("#detailfields > input");
    var precision = 20;
    var scale     = 2;
    var rowNo     = 0;
    var cell;
    var col;
    var row;
    var style;
    var test = {a: 1, b:2};
    var first = true;
    var testval;
    var font;
    
    function testCall(command) {
        try {
            eval(command);
        } catch(err) {
            console.log(command + ' failed with ' + err.message);
        }
    }
    function testlocal(tableid, value, adjustText) {
        var options = new JSONArrayOptions(
                {columns: [
                        {name: 'Location', minSize: 3, maxSize: null},
                        {name: 'Tariff', minSize: 3}]});

        table = getElement(tableid);
        body  = table.tBodies[0];
        style = options.getUsed();
        options.setUsed(true);
        style = options.getUsed();
        style = options.getUsed('minSize');
        options.setUsed('minSize', true);
        style = options.getUsed('minSize');
        style = ('a' in test);
        style = ('x' in test);

        test.a = undefined;

        style = ('a' in test);
        row = body.insertRow(rowNo++);
        cell = document.createElement('tr');
        cell.innerHTML = value;
        row.appendChild(cell);
        col = new Column(
                value,
                cell,
                -1,
                type,
                precision,
                scale,
                false,
                options);
        style = col.textWidth;
        style = col.pub;
        testCall("col.#priv");
        style = col.getPriv();
        cell.setAttribute("style", style);
        style = readComputedStyle(cell, 'width');

        var wd = parseFloat(style.substring(0, style.length - 2)).toFixed(2);
        reporter.log(
                "Value " + rpad(value, 15) +
                ' size ' + rpad(col.size(), 4) +
                ' min ' + rpad(col.minSize(), 4) +
                ' max ' + rpad(col.maxSize(), 4) +
                ' size ' + rpad(col.size(), 4) +
                ' textWidth ' + rpad(col.textWidth(), 4) +
                ' styleWidth ' + rpad(wd, 4) +
                ' per char ' + rpad((col.textWidth() / col.size()).toFixed(2), 4) +
                ' adjusted ' + (!isNull(adjustText) && adjustText));
        return col;
    }
    testval = testlocal('chargerstable', 'Josh-Alex B', false);
    testval = testlocal('chargerstable', 'Josh-Alex B', false, true);
    testval = testlocal('chargerstable', 'Josh-Alex B', true);
    testval = testlocal('chargerstable', 'Josh-Alex Bt');    
    testval = testlocal('chargerstable', 'Josh-AlexaBt');   
    testval = testlocal('chargerstable', 'Josh-AlexABt');
    testval = testlocal('chargerstable', 'JoshaAlexaBt');
    testval = testlocal('chargerstable', '1114-01');
    testval = testlocal('chargerstable', '1114-01', true);
    testval = testlocal('chargerstable', 'HomePodPoint');
    testval = testlocal('chargerstable', 'HomePodPoint', true);
    testval = testlocal('chargerstable', 'HomePodPoint');
    
    font = readComputedStyle(getElement('sessionlogtable'), 'font-style');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-variant');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-weight');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-size');
    font = readComputedStyle(getElement('sessionlogtable'), 'font-family');    
    font = readComputedStyle(getElement('sessionlogtable'), 'font');

    
    testval = displayTextWidth("A");
    testval = displayTextWidth("a");
    
    testval = displayTextWidth("18446744073709552000");
    testval = displayTextWidth("MilesAdded", font);
    testval = displayTextWidth("Miles Added", font);
    testval = displayTextWidth("eo70 ecc");
    
    var testFilter = getFilter('testKey', document.getElementById('filter'), requestChargeSessions, {
        allowAutoSelect: true,
        autoSelect: true,
        title: 'Test Filter',
        forceGap: '4px',
        initialDisplay: false});
    testFilter.addFilter('CarReg', {name: 'CarReg', values: ''});
    testFilter.addFilter('ChargerLab', {name: 'Charger', values: 'a,b'});
    testFilter.addFilter('Field1', {name: 'Field1'});
    testFilter.addFilter('Field2Lab', {name: 'Field2'});
    var filterField = getFilterField(testFilter, 'CarReg');
    filterField = getFilterField(testFilter, 'Charger');
    filterField = getFilterField(testFilter, 'Field1');
    filterField = getFilterField(testFilter, 'Field2');
    testCall("filterField = getFilterField(testFilter, 'Type1')");
    col.setProperty('xxx', 'Crap', true);
    testCall("col.setProperty('zzz', 'Crap', false)");
    testCall("col.setProperty('zzz', 'Crap')");
    testCall("col.getProperty('abc')");
    testCall("Column.abc = 'Test'");
    style = col.getProperty('name');
    style = col.getProperty('minSize');
    style = col.hasProperty('abc');
    style = col.hasProperty('maxSize');

    style = col.xxx;
    style = 'width:' + col.textWidth() + 'px';
    testCall("col.yyy = 'MoreCrap'");
    testCall("col.size = 'Crap'");
    style = col.yyy;    
}

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

    function correctFieldOptions(qualifiedfield, values, single) {        
        var fields  = qualifiedfield.split(',');
        
        var opts = {
            name:   fields[0],
            single: isNull(single)? false : single,
            values: values};
        
        if (fields.length >= 2) opts.type = fields[1];
        if (fields.length >= 3) opts.id   = fields[2];
                
        return opts;
    }
    /*
     * This calls to be directed to addFilterNew.
     * 
     * If qualifiedfield is an object the caller is assumed to be passing parameters appropriate
     * for addFilterNew, i.e. label, options. Otherwise the temporary function correctFieldOptions is
     * called to convert the parameters to the equivalent options.
     * 
     * This will eventually be removed and addFilterNew will be renamed to addFilter.
     */
    this.addFilterOld = function (label, qualifiedfield, values, single) {        
        if (typeof qualifiedfield === 'object')
            this.addFilterNew(label, qualifiedfield);
        else
            this.addFilterNew(label, correctFieldOptions(qualifiedfield, values, single));
    };   
    
    this.addFilterOld = function (label, qualifiedfield, values, single) {
        var fields = this.fields;
        var div    = this.document.createElement('div');
        var field  = qualifiedfield.split(',');
        var lstelm;
        var inpelm;
        var elm;
        /*
         * Fields added by code do not have a gap when display is inline-block, whereas those added in html do. Hence, the
         * reason for adding margin-right.
         */
        elm = createElement(this.document, 'label', {append: div, forceGap: this.options.forceGap, text: label});
        
        if (values !== undefined && single !== undefined && single) {
            /*
             * There are values, but only single values are allowed. So create the input element as a selectable list.
             */
            inpelm = createElement(this.document, 'select', {
                append:   div,
                name:     field[0]});
            lstelm = inpelm;            
        } else
            inpelm = createElement(this.document, 'input', {
                append:   div,
                name:     field[0],
                type:     field.length > 1 && field[1].length !== 0? trim(field[1]) : 'text',
                size:     '15',
                tabindex: '0'});
        
        if (field.length > 2) setAttribute(inpelm, 'id', field[2]);
        if (options.allowAutoSelect) this.setEventHandler(inpelm, 'onchange', 'changeFilterValue');
        
        if (values !== undefined && lstelm === undefined) {
            /*
             * This is the case where multiple values can be selected. So create a select values list
             * and add an onchange event to append the value to the input field.
             */
            setAttribute(inpelm, 'style', 'margin-right: ' + this.options.forceGap);            
            lstelm = createElement(this.document, 'select', {append: div});
            this.setEventHandler(lstelm, 'onchange', 'addFilterField');
        }
        if (lstelm !== undefined)
            loadListResponse(values, {
                name:       lstelm,
                keepValue:  true,
                async:      false,
                allowBlank: true});
        fields.appendChild(div);
    }; 
    
/*
 * The is now deprecated and setFilterVisible should be used instead.
 */
function setFilter(filterId, key) {
    var on     = event.srcElement.checked;
    var filter = findFilter(key, false);
    
    setHidden(filterId, !on);
    
    if (on && key !== undefined && filter.isiFrame) {
        resizeFrame(filter.element);
    }
}

/*
 * 
 * @param key The Filter object key defining the filter.
 * 
 * Sets the visibility of the filter parameters from the source element checked of the triggering event.
 * 
 */
function setFilterVisibilityNotUsed(key) {
    var on     = event.srcElement.checked;
    var filter = findFilter(key, false);
    
    if (filter !== undefined) {
        setHidden(filter.element.id, !on);
        
        if (filter.isiFrame) resizeFrame(filter.element);
    }
}