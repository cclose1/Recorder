/* global getElement, getFloatValue */

'use strict';

var evnFilter;
var hstFilter;
var valItem   = new ValidateItem();
var itemRow   = null;
var savedUnit = null;
var cnvUnits  = new ConvertUnits();

function ValidateItem() {
    this.calDiffThreshold = 5;
    this.oldTime          = null;
    this.sizeDefault      = true;
    
    this.fields = 
        {Calories:     {id: 'icalories',     type: null, maxSize: 5000, amount: null, sum: 0, toCalories: null},
         Protein:      {id: 'iprotein',      type: null, maxSize: 5000, amount: null, sum: 0, toCalories: 4},
         Fat:          {id: 'ifat',          type: null, maxSize: 5000, amount: null, sum: 0, toCalories: 9},
         Carbohydrate: {id: 'icarbohydrate', type: null, maxSize: 5000, amount: null, sum: 0, toCalories: 4},
         ABV:          {id: 'iabv',          type: null, maxSize: 5000, amount: null, sum: 0, toCalories: 7}};
    
    this.actionCancel = function() {
    };
    this.actionClick = function(obj) {
        /*
         * Probably just use this as I don't think appdata, the obj parameter, is ever used by nutrition.
         */
        if (!hasValue(obj)) obj = this;
        
        applyItemUpdate(obj.oldTime);
        obj.oldTime = null;
    };
    function clearSum(obj) {        
        for (name in obj.fields) {
            obj.fields[name].sum = 0;
        }
    }
    function addValueToSum(obj, name, quantity, value) {
        var field = obj.fields[name];
        
        value    = parseFloat(value);
        quantity = parseFloat(quantity);
        
        if (field === undefined || field.type !== 'decimal') return true;
        
        if (field.sum + quantity * value > field.maxSize) return false;
        
        field.sum += quantity * value;
        
        return true;
    }
    function addRowToSum(obj, row, quantity, item, source) {
        var rdr     = new rowReader(row);
        var name    = null;
        var scale   = quantity;
        var rItem   = rdr.getColumnValue('Item');
        var rSource = rdr.getColumnValue('Source');
        
        if (item !== undefined) {
            /*
             * This is an update, so we have to set scale depending on if current table item matches the input item.
             */
            if (rItem === item && rSource === source)
                scale = quantity / rdr.getColumnValue('Quantity');
            else
                scale = 1;
        }
        while (rdr.nextColumn()){
            name = rdr.valueAttribute('name');

            switch (name) {
                case 'Item':
                case 'Source':
                case 'ABV':
                case 'Quantity':
                case 'DefaultSize':
                    break; //Ignore these.                        
                default:
                    if (!addValueToSum(obj, name, scale, rdr.columnValue()))  throw new ErrorObject('Validation Error', 'Item ' + rItem + ' results in overflow of ' + name);
            }
        }
    }
    function getSize(digits) {
        var size = '';
        
        for (var i = 0; i < digits; i++) {
            size += '9';
        }
        return parseFloat(size);
    }
    this.loadMaxSizes = function(itemData) {
        var hdr = stringToJSON(itemData).getMember('Header', true).value;
        var col;
        var name;
        var type;
        var precision;
        var scale;
        var size;
        var field;
        
        while (hdr.isNext()) {
            col       = hdr.next().value;
            name      = col.getMember('Name',      true).value;
            type      = col.getMember('Type',      false).value;
            scale     = col.getMember('Scale',     false).value;
            precision = col.getMember('Precision', false).value;
            size      = getSize(precision - scale);
            
            field = this.fields[name];
            
            if (field === undefined) {
                field             = {id: null, type: type, maxSize: -1, amount: null, sum: 0, toCalories: null};
                this.fields[name] = field;
            }
            field.type    = type;
            field.maxSize = type === 'decimal'? getSize(precision - scale) : precision;
        }
    };
    this.checkItemField = function(elm) {
        var name;
        var field;
        var size = getElement('isize').value;
        
        elm    = getElement(elm);
        name   = getElementLabel(elm);      
        field  = this.fields[name];
        
        field.amount = getFloatValue(elm, 0);
               
        if (field.amount / size > field.maxSize) {     
            displayAlert('Field Validation', "Value for " + name + " exceeds the maximum of " + field.maxSize * size, {focus: elm});
            return false;
        } else
            return true;
    };
    this.setSizeDefault = function(simple) {
        if (!this.sizeDefault) return;
        
        getElement('isize').value = simple? 100 : 1;
    };
    function checkCalculated(obj) {  
        var diff = getFloatValue('ipcdiff', 0);
        var calc = getFloatValue('icalculated', 0).toFixed(2);
        
        if (diff > obj.calDiffThreshold)
            displayAlert(
                'Accept', 
                'Calculated calories ' + calc + ' not equal to calories value ' + getFloatValue('icalories', 0) + ', %diff ' + diff.toFixed(2), 
                {confirm: obj});
        else
            obj.actionClick();                
    }
    this.checkTime = function() {
        var elm = event.target;
        
        if (checkTimestamp() && this.oldTime !== null && toDate(elm.value) <= this.oldTime)
            displayAlert('Validation', 'New version time must be after ' + getDateTime(this.oldTime), {focus: elm});
    };
    this.crossCheck = function() {
        var elm    = event.target;
        var checks = false;
        
        switch (getElementLabel(elm)) {
            case 'Carbohydrate':
            case 'Sugar':
            case 'Fibre':
                if (getFloatValue('isugar', 0) + getFloatValue('ifibre', 0) > getFloatValue('icarbohydrate', 0)) 
                    displayAlert('Warning', 'Sum of Sugar and Fibre exceeds Carbohydrate', {focus: elm});
                else
                    checks = true;
                break;
            case 'Fat':
            case 'Saturated':
                if (getFloatValue('isaturated', 0) > getFloatValue('ifat', 0)) 
                    displayAlert('Warning', 'Saturated exceeds Fat', {focus: elm});
                else
                    checks = true;
                break;                
        }
        return checks;
    };
    this.updateCalculated = function() {
        var calculated = 0;
        var diff       = 0;
        var calories   = getFloatValue('icalories', 0);
        var size       = getElement('isize').value;
        
        if (event.target.id === 'isize') {
            if (size <= 0) {
                displayALert('Field Validation', 'Size must be greater than 0', {focus: getElement('isize')});
                return false;
            }
        }        
        for (name in this.fields) {
            var field = this.fields[name];
            
            if (field.toCalories !== null) {
                field.amount = (name === 'ABV'? size * 0.789 / 100 : 1) * getFloatValue(field.id, 0);
                calculated += field.amount * field.toCalories;
            }
        }
        diff = calories - calculated;        
                
        if (calories !== 0) diff = 100.0 * diff / calories;        
        if (diff < 0) diff = -diff;
        
        getElement('ipcdiff').value     = diff.toFixed(2);
        getElement('icalculated').value = calculated;
        
    };
    this.checkAddItem = function (action) {
        var table    = document.getElementById('activeeventtable');
        var item     = getElement('item').value;
        var source   = getElement('source').value;
        var quantity = getFloatValue('quantity');
        var row;
        var i;
        
        clearSum(this);
        /*
         * Check the Active Events Table items to calculate the totals before adding the new item.
         * 
         * Note: This should never cause overflow as it has already been checked.
         */
        for (i = 0; i < table.tBodies[0].rows.length; i++) {
            row  = table.tBodies[0].rows[i];
            
            try {
                if (action === 'modify') 
                    addRowToSum(this, row, quantity, item, source);
                else
                    addRowToSum(this, row, 1);
            } catch (error) {
                displayAlert(error.name, error.message, {focus: getElement('addItem')});
                return false;
            }
        }
        if (action === 'modify') return true;
        
        try {
            addRowToSum(this, itemRow, quantity);
        } catch (error){
            displayAlert(error.name, error.message, {focus: getElement('addItem')});
            return false;
        }
        return true;
    };
    this.setItemCreateCaption = function() {
        if (document.getElementById("iitem").value === '') {
            document.getElementById('icreate').value    = 'Create';
            document.getElementById('iitem').readOnly   = false;
            document.getElementById('isource').readOnly = false;
            document.getElementById('istart').readOnly  = false;
            document.getElementById('iend').readOnly    = false;
            setHidden('inewversion', true);
            this.sizeDefault =  true;
        } else {
            document.getElementById('icreate').value    = 'Update';
            document.getElementById('iitem').readOnly   = true;
            document.getElementById('isource').readOnly = true;
            document.getElementById('istart').readOnly  = true;
            document.getElementById('iend').readOnly    = true;
            setHidden('inewversion', false);
            this.sizeDefault = false;
        }
    };
    this.newItem = function() {
        this.oldTime = null;
        this.setItemCreateCaption();
        this.updateCalculated();
    };
    this.updateItem = function() {
        var sd = validateDateTime('istart', null, {required: true});
        var ed = validateDateTime('iend',   null, {required: true});
        
        if (!sd.valid || !ed.valid) return false;
        
        if (ed.value <= sd.value) {
            displayAlert('Validation Error', 'End timestamp must be after start timestamp', {focus: getElement("edate")});
            return false;
        }
        if (!fieldHasValue('iitem'))   return false;
        if (!fieldHasValue('isource')) return false;
        if (!fieldHasValue('itype'))   return false;        
        if (!checkItemCount())         return false;
        
        if (!this.checkItemField('icalories'))     return false;
        if (!this.checkItemField('ifat'))          return false;
        if (!this.checkItemField('iprotein'))      return false;
        if (!this.checkItemField('icarbohydrate')) return false;
        
        checkCalculated(this);
    };
    this.newVersion = function() {
        setHidden('inewversion', true);
        this.oldTime = toDate(document.getElementById('istart').value);
        document.getElementById('istart').value    = getDateTime();
        document.getElementById('istart').readOnly = false;
        document.getElementById('iend').readOnly   = false;
    };
}
function errorResponse(response) {
    if (response.length > 2) {
        displayAlert('Validation Failure', response);
        return true;
    }
    return false;
}
function setHiddenLabelField(name, yes) {
    setHidden(name, yes);
    setHidden(name + 'lab', yes);
}
function clearItem() {
    itemRow = null;
    document.getElementById('source').value   = '';
    document.getElementById('type').value     = '';
    document.getElementById('item').value     = '';
    document.getElementById('quantity').value = '';
    document.getElementById('abv').value      = '';
    setHidden('abv',    true);
    setHidden('abvlab', true);
    setHidden('units',  true);
}
function setEventMode(update) {
    setHidden('itembuttons',  true); 
    setHidden('eventbuttons', false);
    setHidden('clone',        !update);
    setHidden('remove',       !update);   
    setHidden('clear',        document.getElementById('date').value === '');
    clearItem();
}
function setUnits(element, simple, isVolume) {      
    setHidden(element, !simple);
    cnvUnits.setSelectOptions(element, isVolume? 'ml' : 'gm');
}
function setItemMode(update, isVolume, simple, abv) {
    if (document.getElementById('date').value === '') return;
    
    setHidden('eventbuttons', true);
    setHidden('itembuttons',  false); 
    setHidden('removeItem',   !update);    
    setUnits('units', simple, isVolume);

    document.getElementById('addItem').value = update? 'Update Item' : 'Add Item';
    
    if (!simple && document.getElementById('quantity').value === '') document.getElementById('quantity').value = 1;
    
    document.getElementById('abv').value   = abv;
    setHidden('abv',    abv === '');
    setHidden('abvlab', abv === '');
}
function displayClone(on) {
    setHidden('detailfields', on);
    setHidden('itemdetails',  on);
    setHidden('clonefields',  !on);
    
    if (!on) setEventMode(false);
}
function displayCreate(on) {
    setHidden('detailfields', on);
    setHidden('itemdetails',  on);  
    setHidden('createfields', !on);
}
function getWeight(date) {
    var weight     = '';    
    var parameters = createParameters('getweight');
    
    function processResponse(response) {
        if (!loggedIn) return;
        
        weight = response;
    }
    parameters = addParameter(parameters, 'date', date);
    
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    return weight;
}
function Server(fldDate, fldTime) {
    var valid = true;    
    var parameters = createParameters('checktimestamp');

    fldDate = typeof fldDate === 'undefined' ? 'date' : fldDate;
    fldTime = typeof fldTime === 'undefined' ? 'time' : fldTime;
    
    function processResponse(response) {
        if (!loggedIn) return;
        /*
         * The response string includes quotes. So the blank string will have length 2.
         * When processed by OpenShift the response is a single quote. So if more than 2
         * characters assume it is the error response.
         */
        valid = !errorResponse(response);
    }
    parameters = addParameterById(parameters, fldDate);
    parameters = addParameterById(parameters, fldTime);

    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    return valid;
}
function detailsRowClick(row, operation) {
    var rdr      = new rowReader(row);
    var simple   = false;
    var isVolume = false;
    var abv      = '';
    var isEvent  = document.getElementById('date').value !== '';
    var item     = '';
    var source   = '';

    if (document.getElementById('item').value !== '') {
        displayAlert('Error', 'Complete or cancel item');
        return;
    }
    itemRow = row;
    
    while (rdr.nextColumn()) {
        var colValue = rdr.columnValue();
        
        switch (rdr.columnName()) {
            case 'Item':
                item = colValue;
                
                if (isEvent) document.getElementById('item').value = item;
                break;
            case 'Source':
                source = colValue;
                
                if (isEvent) document.getElementById('source').value = source;
                break;
            case 'Type':
                if (isEvent) document.getElementById('type').value = colValue;
                break;
            case 'DefaultSize':
                if (isEvent) document.getElementById('quantity').value = tidyNumber(colValue, true, 2);
                break;
            case 'Quantity':
                if (isEvent) document.getElementById('quantity').value = tidyNumber(colValue, true, 2);
                break;
            case 'ABV':
                if (isEvent) abv = tidyNumber(colValue, true, 1);
               
                break;
            case 'Simple':
                document.getElementById('simple').value = colValue;
                simple = colValue === 'Y';
                break;
            case 'IsVolume':
                isVolume = colValue === 'Y';
                break;
        }
    }
    setUpdateItem(item, source);
    setItemMode(operation !== 'add', isVolume, simple, abv);
}
function loadActiveEvent() {    
    var parameters = createParameters('getactiveevent');
    
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    
    function processResponse(response) {
        var options = new JSONArrayOptions({maxField: 13, onClick: 'detailsRowClick(this, "update")'});
        
        loadJSONArray(response, 'activeeventtable', options);
        setHidden('activeeventtable', false);
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);    
}
function setItemStartTime(parameters) {
    if (getElement('date').value !== '' && getElement('time').value !== '') {
        parameters = addParameter(parameters, 'starttime', getElement('date').value + ' ' + getElement('time').value);
    }
    return parameters;
}
function getItemList() {    
    var parameters = createParameters('requestitemlist');    
    var source     = trim(document.getElementById('fsource').value);
    var type       = trim(document.getElementById('ftype').value);
    var item       = trim(document.getElementById('fitem').value);
   
    if (item !== '') item = '%' + item + '%';
    
    parameters = setItemStartTime(parameters);
    parameters = addParameter(parameters, 'source', source);
    parameters = addParameter(parameters, 'type',   type);
    parameters = addParameter(parameters, 'item',   item);
    
    function processResponse(response) {
        var options = new JSONArrayOptions(
                {maxField: 19, onClick: 'detailsRowClick(this, "add")', useInnerCell: false, 
                 columns: [{name: 'Source', maxWidth: 10},{name: 'Type', maxWidth: 10}]});
        
        valItem.loadMaxSizes(response);
        loadJSONArray(response, 'itemdetailstable', options);
        document.getElementById('itemdetailstable').removeAttribute('hidden');
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters);
}
function requestEventHistory(filter) {    
    var parameters = createParameters('eventhistory');

    function processResponse(response) {
        loadJSONArray(response, 'eventhistorytable', {maxField: 19, onClick: 'rowEventHistoryClick(this)'});
        document.getElementById('eventhistorytable').removeAttribute('hidden');
    }
    if (filter === undefined) filter = hstFilter.getWhere();
    if (filter !== undefined && filter !== '') parameters = addParameter(parameters, 'filter', filter);
    
    ajaxLoggedInCall('Nutrition', processResponse, parameters);
}
function setEventTime(date, time) {
    var timeChanged = document.getElementById('date').value !== date || document.getElementById('time').value !== time;
    
    document.getElementById('date').value = date;
    document.getElementById('time').value = time;
    
    if (timeChanged) {
        getItemList();
    }
    if (date !== '' && time !== '') {
        loadActiveEvent();
    } else {
        clearTable('activeeventtable');
        setHidden('activeeventtable', true);
    }
}
function cloneEvent(action) {
    switch (action) {
        case 'start':
            displayClone(true);
            document.getElementById('sdate').value        = document.getElementById('date').value;
            document.getElementById('stime').value        = document.getElementById('time').value;
            document.getElementById('sdescription').value = document.getElementById('description').value;
            document.getElementById('cdate').value        = '';
            document.getElementById('ctime').value        = '';
            document.getElementById('cdescription').value = document.getElementById('description').value;
            document.getElementById('ccomment').value     = document.getElementById('comment').value;
            setDateTime('cdate', 'ctime');
            document.getElementById('cweight').value      = getWeight(document.getElementById('cdate').value);
            
            if (document.getElementById('cweight').value === '')
                document.getElementById('cweight').focus();
            else
                document.getElementById('ccopy').focus();
            break;
        case 'copy':
            if (!fieldHasValue('cdate')) return;
            if (!fieldHasValue('ctime')) return;
                
            var parameters = createParameters('copyevent');
            
            parameters = addParameterById(parameters, 'sdate');
            parameters = addParameterById(parameters, 'stime');
            parameters = addParameterById(parameters, 'cdate');
            parameters = addParameterById(parameters, 'ctime');
            parameters = addParameterById(parameters, 'cdescription');
            parameters = addParameterById(parameters, 'ccomment');
            parameters = addParameterById(parameters, 'cweight');
            
            function processResponse(response) {
                if (errorResponse(response)) return;
                
                document.getElementById('description').value = document.getElementById('cdescription').value;
                setEventTime(document.getElementById('cdate').value, document.getElementById('ctime').value);
                requestEventHistory();
                displayClone(false);
            }
            ajaxLoggedInCall('Nutrition', processResponse, parameters, true);
            break;
        case 'cancel':
            displayClone(false);
            break;
    }
}
function updateEvent() {
    var parameters = createParameters('updateevent');
    
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'description');
    parameters = addParameterById(parameters, 'comment');   
    
    function processResponse(response) {
    }    
    ajaxLoggedInCall('Nutrition', processResponse, parameters, true);
}
/*
 * Note: Could not call this createEvent as it clashes with a DOM method of the same name.
 * 
 * @param {type} action
 * @returns {undefined}
 */
function createNutritionEvent(action) {
    switch (action) {
        case 'start':
            document.getElementById('crdate').value        = '';
            document.getElementById('crtime').value        = '';
            document.getElementById('crdescription').value = '';
            document.getElementById('crcomment').value     = '';
            setDateTime('crdate', 'crtime');
            document.getElementById('crweight').value      = getWeight(document.getElementById('crdate').value);
            displayCreate(true);
            document.getElementById('crdescription').focus();
            break;
        case 'create':
            if (!fieldHasValue('crdate')) return;
            if (!fieldHasValue('crtime')) return;
                
            var parameters = createParameters('createevent');
            
            parameters = addParameterById(parameters, 'crdate');
            parameters = addParameterById(parameters, 'crtime');
            parameters = addParameterById(parameters, 'crdescription');
            parameters = addParameterById(parameters, 'crcomment');
            parameters = addParameterById(parameters, 'crweight');
            
            function processResponse(response) {
                if (errorResponse(response)) return;
            
                document.getElementById('comment').value     = document.getElementById('crcomment').value;
                document.getElementById('description').value = document.getElementById('crdescription').value;
                setEventTime(document.getElementById('crdate').value, document.getElementById('crtime').value);
                requestEventHistory();
                displayCreate(false);
            }
            ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
            break;
        case 'cancel':
            displayCreate(false);
            break;
    }
}
function modifyItemData() {
    var action;
    var parameters;
    
    if (event.target.id === 'removeItem')
        action = 'remove';
    else {
        if (isVisible('units')) {
            var quantity = getElement('quantity'); 
            var units    = getElement('units');            
            var dbUnit   = cnvUnits.getUnit(units.value).isVolume? 'ml' : 'gm'; //Units value stored in the database
            
            quantity.value = cnvUnits.convert(units.value, dbUnit, quantity.value);
            units.value    = dbUnit;            
        }
        action = event.target.value === 'Add Item'? 'add' : 'modify';
    }
    if (!fieldHasValue('date')) return;
    if (!fieldHasValue('time')) return;
    if (!fieldHasValue('item')) return;
    
    if (action === 'remove') {
        parameters = createParameters('removeitem');
    } 
    else {
        parameters = createParameters('modifyitem');
        
        if (!fieldHasValue('quantity'))    return;
        if (!valItem.checkAddItem(action)) return;
    }
    
    function processResponse(response) {
        if (errorResponse(response)) return;
        
        requestEventHistory();
        loadActiveEvent();
        clearItem();
        setEventMode();
    }
    parameters = addParameterById(parameters, 'item');
    parameters = addParameterById(parameters, 'source');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'description');
    parameters = addParameterById(parameters, 'simple');
    
    if (action !== 'delete') {
        parameters = addParameterById(parameters, 'quantity');
        parameters = addParameterById(parameters, 'abv'); 
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
}
function clearEvent() { 
    setHidden('activeeventtable', true);
    document.getElementById('description').value = '';
    document.getElementById('comment').value     = '';
    setEventTime('', '');
    setEventMode(false);
}
function deleteEvent() {    
    var parameters = createParameters('deleteevent');

    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');

    function processResponse(response) {
        clearEvent();
        requestEventHistory();
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
}
/*
 * @param name     Form field id
 * @param dbField  Database field column
 * @param filter   Form filter field id
 * @param dbFilter Database filter field column
 * @returns {undefined}
 */
function updateFilteredList(name, dbField, filter, dbFilter) {    
    getList('Nutrition', 
            {name:       name, 
             field:      dbField, 
             filter:     addDBFilterField('', document.getElementById(filter), dbFilter), 
             firstValue: ' ', 
             allowBlank: true, 
             async:      false}); 
}
function updateFilteredLists() {
    updateFilteredList('iSourceList', 'source');
    updateFilteredList('iTypeList',   'type');
    updateFilteredList('fsource',     'source', 'ftype',   'type');
    updateFilteredList('ftype',       'type',   'fsource', 'source');
}
function rowEventHistoryClick(row) {
    try {
        var rdr = new rowReader(row, true);

        if (document.getElementById('item').value !== '') {
            displayAlert('Error', 'Complete or cancel item');
            return;
        }
        while (rdr.nextColumn()) {
            switch (rdr.columnName()) {
                case 'Timestamp':
                    var fields = rdr.columnValue().split(' ');

                    if (fields.length === 2) {
                        setEventTime(fields[0], fields[1]);
                    }
                    break;
                case 'Description':
                    document.getElementById('description').value = rdr.columnValue();
                    break;
                case 'Comment':
                    document.getElementById('comment').value = rdr.columnValue();
                    break;
            }
        }
        setEventMode(true);
    } catch (e) {
        alert("Exception " + e);
    }
}
function setSalt(isSalt) {
    if (isSalt)
        document.getElementById('isodium').value = tidyNumber(1000 * document.getElementById('isalt').value / 2.539, false, 0);
    else
        document.getElementById('isalt').value = tidyNumber(2.539 * document.getElementById('isodium').value / 1000, false, 2);
}
function setSimple() {
    var simple = document.getElementById('isimple').checked;
    
    valItem.setSizeDefault(simple);
    setHiddenLabelField('isize',    false);
    setHiddenLabelField('idefault', false);   
    setUnits('iunits', simple, document.getElementById('ivolume').checked);
}
function setCreateItem() {
    document.getElementById('iitem').value = "";
    document.getElementById('isource').value = "";
    document.getElementById('itype').value = "";
    document.getElementById('istart').value = getDateTime();
    document.getElementById('iend').value = "3000-01-01 00:00:00";
    document.getElementById('icomment').value = "";
    document.getElementById('icalories').value = "";
    document.getElementById('icalculated').value = "";
    document.getElementById('ipcdiff').value = "";
    document.getElementById('iprotein').value = "";
    document.getElementById('icholesterol').value = "";
    document.getElementById('ifat').value = "";
    document.getElementById('isaturated').value = "";
    document.getElementById('icarbohydrate').value = "";
    document.getElementById('isugar').value = "";
    document.getElementById('ifibre').value = "";
    document.getElementById('isimple').checked = true;
    document.getElementById('iabv').value = "";
    document.getElementById('isize').value = 100;
    document.getElementById('ivolume').checked = false;
    document.getElementById('idefault').value = "";
    document.getElementById('ipacksize').value = "";
    setSimple();    
    document.getElementById('iitem').focus();        
    valItem.setItemCreateCaption();
}
function setUpdateItem(item, source) {    
    var parameters = createParameters('getitem');
    
    parameters = setItemStartTime(parameters);
    parameters = addParameter(parameters, 'iitem',   item);
    parameters = addParameter(parameters, 'isource', source);

    function processResponse(response) {
        loadJSONFields(response, false);
        document.getElementById('isize').value = 1; 
        setSalt(true);
        setSimple();
        valItem.newItem();
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters);
}

function getItemCount(item, source) {    
    var parameters = createParameters('getitemcount');
    var count;
    
    parameters = setItemStartTime(parameters);
    parameters = addParameter(parameters, 'iitem',   item);
    parameters = addParameter(parameters, 'isource', source);

    function processResponse(response) {
        count = parseInt(response);
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    
    return count;
}
function checkItemCount() {
    var item;
    var source;
    var valid;
    
    if (getElement('icreate').value !== 'Create') return true;
    
    item   = getElement('iitem').value;
    source = getElement('isource').value;
    
    if (item === '' || source === '') return true;
    
    valid = getItemCount(item, source) === 0;
    
    if (!valid)
        displayAlert('Error', 'Item ' + item + ' source ' + source + ' already exists');
    
    return valid;
}
function applyItemUpdate(previousVersionTime) {
    var parameters = createParameters('applyitemupdate');
    
    parameters = addParameterById(parameters, 'icreate',       'command');
    parameters = addParameterById(parameters, 'iitem',         'item');
    parameters = addParameterById(parameters, 'isource',       'source');
    parameters = addParameterById(parameters, 'istart',        'start');
    parameters = addParameterById(parameters, 'iend',          'end');
    parameters = addParameterById(parameters, 'itype',         'type');
    parameters = addParameterById(parameters, 'icomment',      'comment');
    parameters = addParameterById(parameters, 'icalories',     'calories');
    parameters = addParameterById(parameters, 'iprotein',      'protein');
    parameters = addParameterById(parameters, 'icholesterol',  'cholesterol');
    parameters = addParameterById(parameters, 'ifat',          'fat');
    parameters = addParameterById(parameters, 'isaturated',    'saturated');
    parameters = addParameterById(parameters, 'icarbohydrate', 'carbohydrate');
    parameters = addParameterById(parameters, 'isugar',        'sugar');
    parameters = addParameterById(parameters, 'ifibre',        'fibre');
    parameters = addParameterById(parameters, 'isalt',         'salt');
    parameters = addParameterById(parameters, 'isimple',       'simple');
    parameters = addParameterById(parameters, 'iabv',          'abv');
    parameters = addParameterById(parameters, 'isize',         'size');
    parameters = addParameterById(parameters, 'ivolume',       'volume');
    parameters = addParameterById(parameters, 'idefault',      'default');
    parameters = addParameterById(parameters, 'ipacksize',     'packsize');
    
    if (hasValue(previousVersionTime)) parameters = addParameter(parameters, 'previousStart', getDateTime(previousVersionTime));
    
    function processResponse(response) {
        loadJSONFields(response, false);
        setCreateItem();
        evnFilter.callRequestor(true);
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);    
}
function displayUpdateItem() {
    setHidden('updateitem', !document.getElementById("showitem").checked);
    valItem.setItemCreateCaption();
}
function reload() {
    setEventMode(false);
    updateFilteredLists();
    /*
     * The remaining calls can execute asynchronously.
     */
    getItemList();
    requestEventHistory();
    setCreateItem();
    displayUpdateItem();
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
function confirmListCreate(field) {
    this.field        = field;
    this.actionClick  = actionClick;
    this.actionCancel = actionCancel;
    
    function actionCancel() {
        field.value = '';
    }
    function actionClick() {
        var parameters = createParameters('addListItem');
        
        parameters = addParameter(parameters, 'field', field.name);
        parameters = addParameter(parameters, 'item',  field.value);
    
        function processResponse(response) {
        }
        ajaxLoggedInCall("Nutrition", processResponse, parameters, false);
        getList('Nutrition',
                {name:       'iSourceList',
                 field:      'source',
                 keepValue:  true,
                 allowBlank: true,
                 async:      false}); 
    }
}
function checkExists() {
    var field   = event.target;
    var options = field.list;
    
    if (indexOfOption(options, field.value) !== -1) return;
    
    var confirm = new confirmListCreate(field);
    
    displayAlert('Confirm', 'Create ' + field.name + ' for ' + field.value, {confirm: confirm});
}
function unitsChange() {
    var toUnits = event.target.value;
    var sizeElm = getElement(event.target.id === 'iunits'? 'isize' : 'quantity');
    
    if (event.type === 'change') {
        try {
            sizeElm.value = cnvUnits.convert(savedUnit, toUnits, getFloatValue(sizeElm));
        } catch (e) {
            event.target.value = savedUnit;
            displayAlert(e.name, e.message, {focus: event.target});
        }
    }
    savedUnit = event.target.value;
}
function initialize(loggedIn) {
    if (!loggedIn) return;
    
    hstFilter = getFilter('filter1', document.getElementById('eventfilter'), requestEventHistory, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           null,
        forceGap:        '4px',
        initialDisplay:  true});
    hstFilter.addFilter('Day',         'Weekday', 'Sun,Mon,Tue,Wed,Thu,Fri,Sat', true);
    hstFilter.addFilter('Description', 'Description');
    evnFilter = getFilter('filter2', document.getElementById('itemfilter'), getItemList, {
        allowAutoSelect: true, 
        autoSelect:      true,
        title:           null,
        forceGap:        '4px',
        initialDisplay:  true});
    evnFilter.addFilter('Source', 'Source,,fsource', '', true);
    evnFilter.addFilter('Type',   'Type,,ftype',     '', true);
    evnFilter.addFilter('Item',   'Item,,fitem');
    reload();
}