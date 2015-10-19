function setHiddenLabelField(name, yes) {
    setHidden(name, yes);
    setHidden(name + 'lab', yes);
}
function clearItem() {    
    document.getElementById('seqno').value    = '';
    document.getElementById('source').value   = '';
    document.getElementById('type').value     = '';
    document.getElementById('item').value     = '';
    document.getElementById('quantity').value = '';
    document.getElementById('abv').value      = '';
    setHidden('abv',        true);
    setHidden('abvlab',     true);
    setLabel('unitslabel', '');
}
function setEventMode(update) {
    setHidden('itembuttons',  true); 
    setHidden('eventbuttons', false);
    setHidden('clone',        !update );
    setHidden('remove',       !update);   
    setHidden('clear',        document.getElementById('date').value === '');
    clearItem();
}
function setItemMode(update, simple, abv) {
    if (document.getElementById('date').value === '') return;
    
    setHidden('eventbuttons', true);
    setHidden('itembuttons',  false); 
    setHidden('removeItem',   !update);
    document.getElementById('addItem').value = update? 'Update Item' : 'Add Item';
    
    if (!simple && document.getElementById('quantity').value === '') document.getElementById('quantity').value = 1;
    
    setLabel('unitslabel', simple? 'Grams' : '');
    document.getElementById('abv').value = abv;
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
    parameters = addParameterById(parameters, 'mysql');
    parameters = addParameter(parameters, 'date', date);
    
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    return weight;
}
function checkTimestamp(fldDate, fldTime) {
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
        if (response.length > 2) {
            displayAlert('Validation Failure', response);
            valid = false;
        }
    }
    parameters = addParameterById(parameters, 'mysql');
    parameters = addParameterById(parameters, fldDate);
    parameters = addParameterById(parameters, fldTime);

    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    return valid;
}
function detailsRowClick(row, operation) {
    var i;
    var simple  = false;
    var abv     = '';
    var h       = document.getElementById(row.parentNode.parentNode.id).rows[0];
    var isEvent = document.getElementById('date').value !== '';

    if (document.getElementById('item').value !== '') {
        displayAlert('Error', 'Complete or cancel item');
        return;
    }
    for (i = 0; i < h.cells.length; i++) {
        var colName  = h.cells[i].innerHTML;
        var colValue = row.cells[i].innerText;
        
        switch (colName) {
            case 'SeqNo':
                setUpdateItem(colValue);
                
                if (isEvent) document.getElementById('seqno').value = colValue;                
                break;
            case 'Item':
                if (isEvent) document.getElementById('item').value = colValue;
                break;
            case 'Source':
                if (isEvent) document.getElementById('source').value = colValue;
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
                simple = colValue === 'Y';
                break;
        }
    }
    setItemMode(operation !== 'add', simple, abv);
}
function loadActiveEvent() {    
    var parameters = createParameters('getactiveevent');
    
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    
    function processResponse(response) {
        loadJSONArray(response, 'activeeventtable', 19, 'detailsRowClick(this, "update")');
        setHidden('activeeventtable', false);
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters);
    
}
function getNutritionDetails() {    
    var parameters = createParameters('requestdetails');    
    var source     = trim(document.getElementById('fsource').value);
    var type       = trim(document.getElementById('ftype').value);
    var item       = trim(document.getElementById('fitem').value);
   
    if (item !== '') item = '%' + item + '%';
    
    parameters = addParameter(parameters, 'source', source);
    parameters = addParameter(parameters, 'type',   type);
    parameters = addParameter(parameters, 'item',   item);
    
    function processResponse(response) {
        loadJSONArray(response, 'itemdetailstable', 19, 'detailsRowClick(this, "add")');
        document.getElementById('itemdetailstable').removeAttribute('hidden');
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters);
    setHidden('freset', source === '' && type === '' && item === '');
}
function setItemFilterReset() {
    document.getElementById('fsource').value = '';
    document.getElementById('ftype').value   = '';
    document.getElementById('fitem').value   = '';
    getNutritionDetails();
}
function requestEventHistory(historyOnly) {    
    var parameters  = createParameters('eventhistory');
    var day         = trim(document.getElementById('efday').value);
    var description = trim(document.getElementById('efdescription').value);
    
    if (description !== '') description = '%' + description + '%';
    
    parameters = addParameter(parameters, 'description', description);
    parameters = addParameter(parameters, 'day',         day);

    function processResponse(response) {
        loadJSONArray(response, 'eventhistorytable', 19, 'rowEventHistoryClick(this)', true);
        document.getElementById('eventhistorytable').removeAttribute('hidden');
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    setHidden('efreset', day === '' && description === '');
    
    if (typeof fldDate !== 'undefined' && !historyOnly) return;
    
    if (document.getElementById('date').value !== '' && document.getElementById('time').value !== '') {
        loadActiveEvent();
    } else
        setHidden('activeeventtable', true);
}
function setEventFilterReset() {   
    document.getElementById('efday').value         = '';
    document.getElementById('efdescription').value = '';
    requestEventHistory(false);
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
            document.getElementById('ccomment').value     = '';
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
            
            parameters = addParameterById(parameters, 'mysql');
            parameters = addParameterById(parameters, 'sdate');
            parameters = addParameterById(parameters, 'stime');
            parameters = addParameterById(parameters, 'cdate');
            parameters = addParameterById(parameters, 'ctime');
            parameters = addParameterById(parameters, 'cdescription');
            parameters = addParameterById(parameters, 'ccomment');
            parameters = addParameterById(parameters, 'cweight');
            
            function processResponse(response) {
                if (response.length > 2) {
                    displayAlert('Validation Failure', response);
                    return;
                }
            }
            ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
            document.getElementById('date').value        = document.getElementById('cdate').value;
            document.getElementById('time').value        = document.getElementById('ctime').value;
            document.getElementById('description').value = document.getElementById('cdescription').value;
            requestEventHistory();
            displayClone(false);
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
        requestEventHistory(true);
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
                if (response.length > 2) {
                    displayAlert('Validation Failure', response);
                    return;
                }
            }
            ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
            document.getElementById('date').value        = document.getElementById('crdate').value;
            document.getElementById('time').value        = document.getElementById('crtime').value;
            document.getElementById('description').value = document.getElementById('crdescription').value;
            requestEventHistory();
            displayCreate(false);
            break;
        case 'cancel':
            displayCreate(false);
            break;
    }
}
function modifyItemData(isDelete) {    
    var parameters = createParameters('modifyitem');

    if (!fieldHasValue('date'))     return;
    if (!fieldHasValue('time'))     return;
    if (!fieldHasValue('item'))     return;
    
    if (isDelete) {
        parameters = addParameter('', 'action', 'deleteitem');
    } 
    else 
        if (!fieldHasValue('quantity')) return;
    
    function processResponse(response) {
    }
    parameters = addParameterById(parameters, 'mysql');
    parameters = addParameterById(parameters, 'seqno');
    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');
    parameters = addParameterById(parameters, 'description');
    
    if (!isDelete) {
        parameters = addParameterById(parameters, 'quantity');
        parameters = addParameterById(parameters, 'abv'); 
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    clearItem();
    setEventMode();
    requestEventHistory();
}
function clearEvent() { 
    setHidden('activeeventtable', true);
    document.getElementById('date').value = '';
    document.getElementById('time').value = '';
    document.getElementById('description').value = '';
    document.getElementById('comment').value = '';   
    setEventMode(false);
}
function deleteEvent() {    
    var parameters = createParameters('deleteevent');

    parameters = addParameterById(parameters, 'date');
    parameters = addParameterById(parameters, 'time');

    function processResponse(response) {
        clearEvent();
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters, false);
    requestEventHistory();
}
/*
 * @param name     Form field id
 * @param dbField  Database field column
 * @param filter   Form filter field id
 * @param dbFilter Database filter field column
 * @returns {undefined}
 */
function updateFilteredList(name, dbField, filter, dbFilter) {
    getList('Nutrition', {name: name, field: dbField, filter: dbFilter + '!' + document.getElementById(filter).value, firstValue: ' ', async:false}); 
}
function updateFilteredLists() {
    updateFilteredList('iSourceList', 'source', 'itype',   'type');
    updateFilteredList('iTypeList',   'type',   'isource', 'source');
    updateFilteredList('fsource',     'source', 'ftype',   'type');
    updateFilteredList('ftype',       'type',   'fsource', 'source');
}
function rowEventHistoryClick(row) {
    var i;
    var h = document.getElementById(row.parentNode.parentNode.id).rows[0];

    if (document.getElementById('item').value !== '') {
        displayAlert('Error', 'Complete or cancel item');
        return;
    }
    for (i = 0; i < h.cells.length; i++) {
        var colName = h.cells[i].innerHTML;

        switch (colName) {
            case 'Timestamp':
                var fields = row.cells[i].innerText.split(' ');

                if (fields.length === 2) {
                    document.getElementById('date').value = fields[0];
                    document.getElementById('time').value = fields[1];
                }
                break;
            case 'Description':
                document.getElementById('description').value = row.cells[i].innerText;
                break;
            case 'Comment':
                document.getElementById('comment').value = row.cells[i].innerText;
                break;
        }
    }
    setEventMode(true);
    requestEventHistory();
}
function setSalt(isSalt) {
    if (isSalt)
        document.getElementById('isodium').value = tidyNumber(1000 * document.getElementById('isalt').value / 2.539, false, 0);
    else
        document.getElementById('isalt').value = tidyNumber(2.539 * document.getElementById('isodium').value / 1000, false, 2);
}
function setSimple() {
//    setHiddenLabelField('isize',    !document.getElementById('isimple').checked);
//    setHiddenLabelField('idefault', !document.getElementById('isimple').checked);
    setHiddenLabelField('isize',    false);
    setHiddenLabelField('idefault', false);
}
function setCreateItem() {
    document.getElementById('iid').value = "";
    document.getElementById('iitem').value = "";
    document.getElementById('isource').value = "";
    document.getElementById('itype').value = "";
    document.getElementById('icalories').value = "";
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
    document.getElementById('idefault').value = "";
    document.getElementById('ipacksize').value = "";
    setSimple();    
    document.getElementById('iitem').focus();        
    setItemCreateCaption();

}
function setUpdateItem(seqno) {    
    var parameters = createParameters('getitem');

    parameters = addParameter(parameters, 'seqno', seqno);

    function processResponse(response) {
        loadJSONFields(response, false);
        document.getElementById('iid').value   = seqno; 
        document.getElementById('isize').value = 1; 
        setSalt(true);
        setSimple();
        setItemCreateCaption();
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters);
}
function applyItemUpdate() {
    var parameters = addParameterById("", "mysql");

    parameters = addParameter(parameters, 'action', 'applyitemupdate');
    parameters = addParameterById(parameters, 'iid',           'seqno');
    parameters = addParameterById(parameters, 'iitem',         'item');
    parameters = addParameterById(parameters, 'isource',       'source');
    parameters = addParameterById(parameters, 'itype',         'type');
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
    parameters = addParameterById(parameters, 'idefault',      'default');
    parameters = addParameterById(parameters, 'ipacksize',     'packsize');

    function processResponse(response) {
        loadJSONFields(response, false);
        setCreateItem();
    }
    ajaxLoggedInCall('Nutrition', processResponse, parameters);    
}
function setItemCreateCaption() {            
    document.getElementById('icreate').value =  document.getElementById("iid").value === ''? 'Create' : 'Update';
}
function displayUpdateItem() {
    setHidden('updateitem', !document.getElementById("showitem").checked);
    setItemCreateCaption();
}
function reload() {
    setEventMode(false);
    updateFilteredLists();
    /*
     * The remaining calls can execute asynchronously.
     */
    getNutritionDetails();
    requestEventHistory();
    setCreateItem();
    displayUpdateItem();    
}
function initialize() {
    document.getElementById('secserver').value = 'Nutrition';
    
    if (!serverAcceptingRequests('Nutrition')) return;
    
    enableMySql('Nutrition');
    reload();
}