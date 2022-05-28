/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
'use strict';

var filters = [];

function FilterOptions(pOptions) {   
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'title',           type: 'string',  default: 'Filter', mandatory: true});
    this.addSpec({name: 'allowAutoSelect', type: 'boolean', default: true,     mandatory: false});
    this.addSpec({name: 'autoSelect',      type: 'boolean', default: true,     mandatory: false});
    this.addSpec({name: 'forceGap',        type: 'string',  default: '4px',    mandatory: false});
    this.addSpec({name: 'initialDisplay',  type: 'boolean', default: false,    mandatory: false});
    this.addSpec({name: 'trigger',         type: 'object',                     mandatory: false});
        
    this.clear();
    this.load(pOptions);
}
    
function findFilter(key, allowNotFound, index) {    
    var i;
     
    for (i = 0; i < filters.length; i++) {
        if (filters[i].key === key) return index != undefined && index? i : filters[i];
    }
    if ((allowNotFound !== undefined || allowNotFound !== null) && allowNotFound) return undefined;
    
    reporter.fatalError('Filter for key ' + key + ' not found');
}
/*
 * 
 * @param {type} pKey       Key uniquely identifying the filter.
 * @param {type} pFilter    The HTML element to hold the filter form.
 * @param {type} pRequestor The function that gets the filter data from the server and actions it.
 * @param {type} pOptions
 * @returns {Filter}
 * 
 * If a filter with pKey exists it is replaced with a new, otherwise, one is created and appended to filters.
 */
function getFilter(pKey, pFilter, pRequestor, pOptions) {
    var index  = findFilter(pKey, true, true);
    var filter = new Filter(pKey, pFilter, pRequestor, pOptions);
    
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
    
function Filter(key, element, requestor, options) {
    this.key             = key;
    this.element         = element;
    this.isiFrame        = element.tagName.toLowerCase() === 'iframe';
    this.document        = undefined;
    this.requestor       = requestor;
    this.top             = undefined;
    this.fields          = undefined;
    this.btnRequest      = undefined;
    this.autoSelect      = false;
        
    this.options         = undefined;
    var elm;
    var btns;
    
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
            var field = fields[i];
            
            input = field.childNodes[1];

            switch (input.type) {
                case 'text':
                    q = field.childElementCount > 2 ? 'quoted' : 'like';
                    break;
                case 'number':
                    q = 'numeric';
                    break;
            }
            w = addDBFilterField(w, input, input.name, q);
        }
        return w;
    };
    this.callRequestor = function (force) {
        if (this.autoSelect || force === undefined || force) {
            this.requestor(this.getWhere());

            if (this.autoSelect && options.trigger !== undefined) {
                triggerClick(options.trigger);
            }
        }
    };
    this.addFilter = function (label, qualifiedfield, values, single) {
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
    this.options = new FilterOptions(options);
    var caption  = this.options.title; // Set title from options.
    
    if (this.isiFrame) {
        this.document = this.element.contentDocument || this.element.contentWindow.document;
        this.top      = this.document.getElementsByTagName("fieldset")[0];
        setHidden(this.element.parentElement, !this.options.initialDisplay);
    } else {
        this.document = element.ownerDocument;
        this.top      = this.element;
        setHidden(this.element, !this.options.initialDisplay);
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
        elm             = createElement(this.document, 'input', {append: elm, type: 'checkbox'});
        elm.checked     = options.autoSelect;
        this.autoSelect = options.autoSelect;
        this.setEventHandler(elm, 'onclick', 'changeAutoSelect');
    }
    createElement(this.document, 'label', {append: btns, forceGap: this.options.forceGap});
    elm = createElement(this.document, 'input', {append: btns, type: 'button', value: 'Apply', forceGap: this.options.forceGap});
    this.btnRequest = elm;
    setHidden(elm, options.autoSelect);
    this.setEventHandler(elm, 'onclick', 'addFilterField');
    elm = createElement(this.document, 'input', {append: btns, type: 'button', value: 'Clear'});
    this.setEventHandler(elm, 'onclick', 'addFilterField');
};

/*
 * 
 * @param key The Filter object key defining the filter.
 * 
 * Sets the visibility of the filter parameters from the source element checked of the triggering event.
 * 
 */
function setFilterVisibility(key) {
    var on     = event.srcElement.checked;
    var filter = findFilter(key, false);
    
    if (filter !== undefined) {
        setHidden(filter.element.id, !on);
        
        if (filter.isiFrame) resizeFrame(filter.element);
    }
}
/*
 * Since filterId is redundant, as it is present in the Filter object, it will be withdrawn when all uses
 * of it have been converted to us the above.
 */
function setFilter(filterId, key) {
    var on     = event.srcElement.checked;
    var filter = findFilter(key, false);
    
    setHidden(filterId, !on);
    
    if (on && key !== undefined && filter.isiFrame) {
        resizeFrame(filter.element);
    }
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
    
    if (filter.btnRequest !== undefined) setHidden(filter.btnRequest, event.target.checked);
}
function setFilterValue(key, name, value) {    
    var filter = findFilter(key);
    var fields = filter.fields.children;
    var field;
    
    for (var i = 0; i < fields.length; i++) {
        field = fields[i].childNodes[1];
        
        if (field.name === name) {
            field.value = value;
            
            filter.requestor(filter.getWhere());
            return;
        }
    }
    filter.options.error(name + ' is not a field for filter key ' + key);
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
//          div   = event.path[1];
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
                    
                    input = field.childNodes[1];
                    input.value = '';

                    if (field.childElementCount > 2)
                        field.childNodes[2].value = '';
                }
                filter.requestor();
            }
            break;
    }
}
