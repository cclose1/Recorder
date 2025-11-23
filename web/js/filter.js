/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
/* global reporter */

'use strict';

var filters  = [];
var triggers;
var idCount  = 0;

/*
 * Defines the options for creating a filter, which done by a call to getFilter.
 * 
 * The properties are:
 * - title           The title displayed for the filter.
 * - table           Database table the filter acts.
 * - server          Server where the database table is located.
 * - allowAutoSelect If true if filter enables auto select. In this mode the filter
 *                   will activate on the entry of the first field. In this case the
 *                   filter displays Auto Select tick box.
 * - autoSelect      The initial setting of the Auto Select tick box. Has no effect if allowAutoSelect is false.
 * - forceGap        Creates a gap between the label and the element. This gap is present when created in html.
 *                   Don't know why it is not present when created by javascript.
 * - popup           If true, the display filter can be hidden. In this case the application has to
 *                   provide a means e.g. a check box, to make it visible.
 * - initialDisplay  Only applies if popup is true, and if true, the filter is visible on startup.
 * - forceIds        If true, an id is added the filter field and a for on its label, if one is
 *                   defined by the FilterFieldOptions id option.
 *                   
 *                   Note: It appears that labels and their labelled field, should be linked by for and id. 
 *                         However, it does not appear to make a difference if this not done. 
 *                         It helps to improve screen readers by identifying fields by the label.
 */
function FilterOptions(pOptions) {   
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'title',           type: 'string',  default: 'Filter', mandatory: true});
    this.addSpec({name: 'server',          type: 'string',  default: null,     mandatory: false});
    this.addSpec({name: 'allowAutoSelect', type: 'boolean', default: true,     mandatory: false});
    this.addSpec({name: 'autoSelect',      type: 'boolean', default: true,     mandatory: false});
    this.addSpec({name: 'forceGap',        type: 'string',  default: '4px',    mandatory: false});
    this.addSpec({name: 'initialDisplay',  type: 'boolean', default: false,    mandatory: false});
    this.addSpec({name: 'forceIds',        type: 'boolean', default: true,     mandatory: false});        
    this.addSpec({name: 'popup',           type: 'boolean', default: false,    mandatory: false});
    
    if (!isNull(pOptions.trigger)) {
        pOptions.popup = true;
        delete pOptions.trigger;
    }
    this.clear();
    this.load(pOptions);
}
/*
 * Defines the options for the addFilter method.
 *  
 * The properties are:
 * - name       Name of the database field the filter field maps to.
 * - type       Input field type.
 * - id         Input elemebt id.
 * - size       Display size of the input field.
 * - values     The values allowed for the field. If present the field is created as a select
 *              field with values as the select list. The values can be either be comma seperated 
 *              list of values, or a json object returned by getList. If values is '', a select
 *              list is created and the values can be loaded later. The following 2 properties are only
 *              relevant if the field has a select list and will be ignored otherwise.
 * - listTable  Database table which is the source of the select list values.
 * - listColumn Table column providing the list values. The list will be the unique values from this
 *              column ordered alphabetically. If this is not set the name property is used if
 *              listTable is set.
 * - single     If true, a select list select will be appended to the filter field separated by
 *              comma from the current values. E.g. if the select list is a1, b2, c3. Select b2 sets
 *              the field value to b2 and following with select of a1, sets field value to b2, a1.
 *              The database query will match on the database field matching on any of the values
 *              in the list. For the example above, dbfield = b2 or dbfield = a1.
 */
function FilterFieldOptions(pOptions) {   
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'name',       type: null,      default: undefined, mandatory: true});
    this.addSpec({name: 'type',       type: 'string',  default: 'text',    mandatory: false});
    this.addSpec({name: 'id',         type: 'string',  default: null,      mandatory: false});
    this.addSpec({name: 'size',       type: 'number',  default: 15,        mandatory: false});
    this.addSpec({name: 'single',     type: 'boolean', default: true,      mandatory: false});
    this.addSpec({name: 'values',     type: null,      default: null,      mandatory: false});
    this.addSpec({name: 'listTable',  type: 'string',  default: null,      mandatory: false});
    this.addSpec({name: 'listColumn', type: 'string',  default: null,      mandatory: false});
        
    this.clear();
    this.load(pOptions);
}
/*
 * Creates the triggers array. There is an entry for each input checkbox that has an onclick action
 * to invoke setFilterVisible. These are required for filters that can be not displayed.
 */
function createTriggers() {
    if (triggers === undefined) {
        triggers = [];
        
        var elms = document.querySelectorAll("input[type='checkbox']");
        
        for (var i = 0; i < elms.length; i++) {
            let action = elms[i].getAttribute('onclick');
            
            if (action === null) continue;
            
            var flds = action.split("'");
            
            if (flds.length < 2) flds = action.split('"');
            
            if (flds[0] !== 'setFilterVisible(') continue;
            
            triggers.push({key: flds[1], trigger: elms[i]});
        }
        console.log('Triggers initialized');
    }
}
/*
 * Gets the input element that toggles the filter screen for key.
 * 
 * null is returned if there is none.
 */
function getTrigger(key) {
    createTriggers();
    
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].key === key) return triggers[i].trigger;
    }
    return null;
}
function setTrigger(key, on) {
    let trigger = getTrigger(key);
    
    if (trigger !== null) trigger.checked = on;
}
/*
 * 
 * - key           If it is a string filters is searched for a filter matching. 
 *                 If it is an object it is returned, if its constructor name is Filter, otherwise
 *                 a fatal error is reported.
 *      
 *                 The remaining parameter are only used if key is a string.
 *      
 * - allowNotFound If true and there is no filter for key, null is returned. If false and
 *                 there is no filter for key, a fatal error is reported.
 * - index         If true the index of key in filters is returned, otherwise the filter is returned.
 */
function findFilter(key, allowNotFound, index) {   
    if (typeof key === 'object') {
        if (key.constructor.name !== 'Filter')
           reporter.fatalError('Object passed to findFilter is ' + key.constructor.name + ' but should be Filter');
       
       return key;
    }     
    for (var i = 0; i < filters.length; i++) {
        if (filters[i].key === key) return index !== undefined && index? i : filters[i];
    }
    if ((allowNotFound !== undefined || allowNotFound !== null) && allowNotFound) return undefined;
    
    reporter.fatalError('Filter for key ' + key + ' not found');
}
/* See Filter constructor below for definition of parameters.
 * 
 * If a filter with key exists it is replaced with a new, otherwise, one is created and appended to filters.
 * 
 * Note: It may be better to change this to error replacement of an existing filter and perhaps change the name
 *       to createFilter.
 */
function getFilter(key, element, requestor, options) {
    var index  = findFilter(key, true, true);
    var filter = new Filter(key, element, requestor, options);
    
    if (index === undefined) {
        filters.push(filter);
    } else {
        filters[index] = filter;
    }    
    return filter;
}
function setVarByName(object, id, value) {
    var name = id;
    
    if (typeof id !== 'string') {
        name  = value;
        value = id[name];
    }
    if (value !== undefined) object[name] = value;
}    

/*
 * key       String for filter identifier in filters.
 * element   HTML element within which the filter form is built.
 * requestor The function that is called when the filter is applied. This function is called
 *           with one parameter, which is the string returned by filter getWhere().
 * options   The filter creation options as defined by FilterOptions.
 */ 
function Filter(key, element, requestor, options) {
    this.key        = key;
    this.element    = element;
    this.isiFrame   = element.tagName.toLowerCase() === 'iframe';
    this.document   = undefined;
    this.requestor  = requestor;
    this.top        = undefined;
    this.fields     = undefined;
    this.btnRequest = undefined;
    this.autoSelect = false;
    this.options    = undefined;
    
    var elm;
    var btns;
    
    this.fatalError = function(method, message) {
        reporter.fatalError('Filter ' + this.key + ' function ' + method + ' reports fatal error : ' + message);  
    };
    this.getGap = function () {
        return this.options.forceGap;
    };
    this.setEventHandler = function(element, event, handler) {   
        element.setAttribute(event, "top." + handler  + "('" + this.key + "', event);");
    };
    this.getWhere = function () {
        var fields = this.fields.children;
        var input;
        var w = '';
        var i;
        var q;

        for (i = 0; i < fields.length; i++) {
            var input = getFieldFromDiv(fields[i]).input;

            switch (input.type) {
                case 'text':
                    q = input.childElementCount > 2 ? 'quoted' : 'like';
                    break;
                case 'number':
                    q = 'numeric';
                    break;
            }
            w = addDBFilterField(w, input, input.name, q);
        }
        return w;
    };
    this.addFilterParameter = function (parameters) {
        let filter = this.getWhere();
        
        if (!isNull(filter) && filter !== '') parameters = addParameter(parameters, 'filter', filter);
        
        return parameters;
    };
    this.setValue = function (name, value, activate) {
        getFilterField(this, name).input.value = value;
        
        if (!isNull(activate) && activate) this.requestor(this.getWhere());
    };
    this.callRequestor = function (force) {
        if (this.autoSelect || force === undefined || force) {
            this.requestor(this.getWhere());

            if (this.autoSelect) {
                if (options.trigger !== undefined)
                    triggerClick(options.trigger);
                else if (options.popup) {
                    setFilterVisible(this, false);   
                }            
            }
        }
    };
    this.loadSelectList = function(name, values) {
        var field  = getFilterField(this, name).input;
        var table  = field.dataset.listtable;
        var column = field.dataset.listcolumn;
        
        if (field.localName !== 'select') 
            this.fatalError(
                'loadSelectList', 'Field ' + name + ' is type ' + field.localName + ' but requires type select');
        
        if (isNull(values)) {
            if (isNull(table))
                this.fatalError(
                    'loadSelectList', 'Field ' + name + ' values not provided and listTable option not provided');
                    
            if (this.options.server === null)
                this.fatalError('loadSelectList', 'Field ' + name + ' values not provided and filter option server not provided');
            
            getList(this.options.server, {
                table:      table,
                field:      column,
                element:    field,
                keepValue:  false,
                async:      false,
                allowBlank: true}, true);
            return;
        }        
        loadSelect(
                field,
                values, 
                    {element:    field,
                     keepValue:  true,
                     async:      false,
                     allowBlank: true});
    };
    /*
     * This refreshes the filter options lists.
     */
    this.loadSelectLists = function() {
        var fields = this.fields.children;
        
        for (var i = 0; i < fields.length; i++) {
            var field = getFieldFromDiv(fields[i]).input;
            
            if (!isNull(field.dataset.listtable) && field.localName === 'select') this.loadSelectList(field.getAttribute('name'));
        }
    };
    this.addFilter = function (label, options) {
        var fldopts    = new FilterFieldOptions(options);
        var div        = this.document.createElement('div');
        var id         = fldopts.id;
        var selectable = fldopts.values !== null || fldopts.listTable !== null;
        var lstelm;
        var inpelm;
        var elm;
        /*
         * Fields added by code do not have a gap when display is inline-block, whereas those added in html do. Hence, the
         * reason for adding margin-right.
         */
        elm = createElement(this.document, 'label', {append: div, forceGap: this.options.forceGap, text: label});
        
        if (selectable && fldopts.single) {
            /*
             * There are values, but only single values are allowed. So create the input element as a selectable list.
             */
            inpelm = createElement(this.document, 'select', {
                append:   div,
                name:     fldopts.name,
                class:    'notparam'});
            lstelm = inpelm;            
        } else
            inpelm = createElement(this.document, 'input', {
                append:   div,
                name:     fldopts.name,
                type:     fldopts.type,
                size:     fldopts.size,
                class:    'notparam',
                tabindex: '0'});
        
        if (id === null && this.options.forceIds) id = createId();
        
        if (fldopts.listTable !== null) {
            inpelm.dataset.listtable  = fldopts.listTable;
            inpelm.dataset.listcolumn = fldopts.listColumn === null? fldopts.name : fldopts.listColumn;
        }
        if (id !== null) {
            setAttribute(elm,    'for', id);
            setAttribute(inpelm, 'id',  id);
        }
        if (this.options.allowAutoSelect) this.setEventHandler(inpelm, 'onchange', 'changeFilterValue');
        
        if (selectable && lstelm === undefined) {
            /*
             * This is the case where multiple values can be selected. So create a select values list
             * and add an onchange event to append the value to the input field.
             */
            setAttribute(inpelm, 'style', 'margin-right: ' + this.options.forceGap);            
            lstelm = createElement(this.document, 'select', {append: div, class: notparam});
            this.setEventHandler(lstelm, 'onchange', 'addFilterField');
        }
        this.fields.appendChild(div);
        
        if (lstelm !== undefined && fldopts.values !== '') this.loadSelectList(fldopts.name, fldopts.values);
        
        setFilterVisible(this, this.options.initialDisplay);
    };   
    function createId() {
        return 'fltid' + idCount++;
    }
    function addIdToLabelledElement(filter, elm) {
        var lab = elm.previousElementSibling;
        var id  = elm.getAttribute('id');
        
        if (id !== null || !filter.options.forceIds) return;
        
        id = createId();
        
        lab.setAttribute('for', id);
        elm.setAttribute('id', id);
    }
    this.options = new FilterOptions(options);
    var caption  = this.options.title; // Set title from options.
    
    if (this.isiFrame) {
        this.document = this.element.contentDocument || this.element.contentWindow.document;
        this.top      = this.document.getElementsByTagName("fieldset")[0];
    } else {
        this.document = element.ownerDocument;
        this.top      = this.element;
    }   
    /*
     * Remove current fields.
     */
    while (this.top.hasChildNodes()) { 
        var elm = this.top.lastChild;
        /*
         * If there was not an options title keep the current legend.
         */
        if (elm.localName !== 'legend' && caption === null) caption = elm.innerHtml;
        
        this.top.removeChild(this.top.lastChild);
    }
    /*
     * Create filter framework excluding the filter fields to be added later.
     */    
    if (caption !== null) createElement(this.document, 'legend', {append: this.top, text: caption});
    
    this.fields = createElement(this.document, 'div', {append: this.top});
    btns        = createElement(this.document, 'div', {append: this.top});
  
    if (options.allowAutoSelect) {
        elm = createElement(this.document, 'div', {append: btns});
        createElement(this.document, 'label', {append: elm, text: 'Auto Select', forceGap: this.options.forceGap});
        elm             = createElement(this.document, 'input', {
                                            append: elm, 
                                            type:   'checkbox', 
                                            name:   'Auto Select', 
                                            class:   'notparam'});
        elm.checked     = options.autoSelect;
        this.autoSelect = options.autoSelect;
        this.setEventHandler(elm, 'onclick', 'changeAutoSelect');
        addIdToLabelledElement(this, elm);
    }
    createElement(this.document, 'label', {append: btns, forceGap: this.options.forceGap});
    elm = createElement(this.document, 'input', {
                            append: btns, 
                            type: 'button', 
                            value: 'Apply', 
                            forceGap: this.options.forceGap,
                            class:    'notparam'});
    this.btnRequest = elm;
    setHidden(elm, options.autoSelect, false);
    this.setEventHandler(elm, 'onclick', 'addFilterField');
    addIdToLabelledElement(this, elm);
    elm = createElement(this.document, 'input', {append: btns, type: 'button', value: 'Clear', class: 'notparam'});
    this.setEventHandler(elm, 'onclick', 'addFilterField');
};
/*
 * Sets the filter visibility for key, which can be either the filter object or the text key to it.
 * 
 * If on is undefined or null, event.srcElelement.checked is used and the trigger is not updated.
 * 
 * Note: on is only passed in initialising the filter. When on is not passed it is because the call
 *       has been called from the onclick event.
 */
function setFilterVisible(key, on) {
    var filter  = findFilter(key, false);
    
    if (isNull(on))
        on = event.srcElement.checked;
    else
        setTrigger(filter.key, on);
    
    setHidden(filter.isiFrame? filter.element.parentElement : filter.element, !on);
    
    if (on && filter.isiFrame) resizeFrame(filter.element);
}
function addFilterValue(element, value) {
    if (value === '') element.value = '';
    else if (element.value === '') element.value = value;
    else element.value += ',' + value;
}
function changeFilterValue(key) {
    var filter  = findFilter(key);
    
    filter.callRequestor(false);    
}
function changeAutoSelect(key, event) {
    var filter  = findFilter(key);
    
    filter.autoSelect = event.target.checked;
    
    if (filter.btnRequest !== undefined) setHidden(filter.btnRequest, event.target.checked, false);
}
/*
 * The Filter fields consists of the of the div elements that hold the input elements for a filter field. The
 * div also holds the label element for the field. The label and field elements are usually link using a for in
 * the label element to the id of the input element. Another option is to embed the input element in the
 * label element.
 */
function getFieldFromDiv(div) {
    /*
     * The label is always the first child of the div. If div has only one child, input field is contained
     * within the label and it is the second child, otherwise the input is the second child of the div.
     */
    var label = div.childNodes[0];
    var input = div.childNodes.length === 1? label.childNodes[1] : div.childNodes[1];
    
    return {
        name:     input.name,
        label:    label,
        embedded: div.childNodes.length === 1,
        input:    input};    
}
/*
 * Returns the details for field name of filter key.
 * 
 * -key       The filter string identifier or the filter object.
 * -name      Field name which is the database field name for the where clause.
 * -mustExist If name is not a filter field, a fatal error is reported if mustExist is true, otherwise, null is returned.
 * 
 * The details are returned in an object with the following fields:
 * 
 * - name    Field name as passed in the name parameter.
 * - label   The label displayed on the filter screen next to the filter value. Usually this will be the same as name.
 *           This value is not currently not used, but is included as it may in future be used.
 * - filter  The filter object for parameter key.
 * - element The screen element for entry of field value.
 * 
 * Note: This is not ideal  The filter fields are an array div elements implementing the fields. In retrospect it
 *       would be better to have fields as an array of FilterField objects of which one of the FilterObject fields
 *       is the screen div element. Then the filter field options could be added to the FilterField object allowing
 *       more flexibility in handling filter fields.
 *       
 *       This would be a significant change and not worth doing at this stage. 
 */
function getFilterField(key, name, mustExist) {
    var filter = findFilter(key);
    var fields = filter.fields.children;
    
    for (var i = 0; i < fields.length; i++) {
        let field = getFieldFromDiv(fields[i]);
        
        if (field.name === name) {
            field.filter = filter;
            
            return field;
        }
    }
    if (isNull(mustExist) || mustExist) reporter.fatalError('Field ' + name + ' not present in filter ' + filter.key);
}
function setFilterValue(key, name, value) {
    findFilter(key).setValue(name, value, true);
}
function addFilterField(key, event) {
    var filter = findFilter(key);
    var fields = filter.fields.children;
    var value  = event.srcElement.value;
    var src    = event.srcElement;
    var input;
    var div;
    var i;
    
    switch (src.localName) {
        case 'select':
            /*
             * The top of the path will the option element firing the event. The next path element is the
             * containing div for the filter fields. The second one is the input field to which value is applied to.
             */
            div   = event.target.parentElement;
            input = div.childNodes[1];
            addFilterValue(input, value);
            filter.callRequestor(false);
            break;
        case 'input':
            if (src.value === 'Apply')
                filter.requestor(filter.getWhere());
            else {
                for (i = 0; i < fields.length; i++) {
                    var field = fields[i];

                    input       = field.childNodes[1];
                    input.value = '';

                    if (field.childElementCount > 2)
                        field.childNodes[2].value = '';
                }
                filter.requestor();
            }
            break;
    }
}
