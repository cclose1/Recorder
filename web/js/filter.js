/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
'use strict';

var filters = [];

function findFilter(key) {    
    var i;
     
    for (i = 0; i < filters.length; i++) {
        if (filters[i].key === key) return filters[i];
    }
    return undefined;
}
function getFilter(pKey, pFilter, pRequestor, pOptions) {
    var filter = findFilter(pKey);
    
    if (filter === undefined) {
        filter = new Filter(pKey, pFilter, pRequestor, pOptions);
        filters.push(filter);
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
    this.forceGap        = undefined;
    this.allowAutoSelect = false;
    this.autoSelect      = false;
    this.btnRequest      = undefined;
    this.title           = 'Filter';
    
    var elm;
    var btns;
    
    this.getGap = function () {
        return this.forceGap;
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

            if (this.autoSelect && this.trigger !== undefined) {
                triggerClick(this.trigger);
            }
        }
    };
    this.addFilter = function (label, qualifiedfield, response) {
        var fields = this.fields;
        var div = this.document.createElement('div');
        var field = qualifiedfield.split(',');
        var elm;

        /*
         * Fields added by code do not have a gap when display is inline-block, whereas those added in html do. Hence, the
         * reason for adding margin-right.
         */
        elm = createElement(this.document, 'label', {append: div, forceGap: this.getGap(), text: label});
        elm = createElement(this.document, 'input', {
            append: div,
            name: field[0],
            type: field.length > 1 ? trim(field[1]) : 'text',
            size: '15',
            tabindex: '0',
            forceGap: response !== undefined ? this.getGap() : undefined});

        if (this.allowAutoSelect)
            this.setEventHandler(elm, 'onchange', 'changeFilterValue');

        if (response !== undefined) {
            elm = createElement(this.document, 'select', {append: div});
            this.setEventHandler(elm, 'onchange', 'addFilterField');
            loadListResponse(response, {
                name: elm,
                keepValue: true,
                async: false,
                allowblank: true});
        }
        fields.appendChild(div);
    };
    if (this.isiFrame) {
        this.document = this.element.contentDocument || this.element.contentWindow.document;
        this.top      = this.document.getElementsByTagName("fieldset")[0];
        setHidden(this.element.parentElement, true);
    } else {
        this.document = element.ownerDocument;
        this.top      = this.element;
        setHidden(this.element, true);
    }    
    for (name in options) {
        setVarByName(this, name, options[name]);
    }
    /*
     * Remove current fields.
     */
    while (this.top.hasChildNodes()) {
        this.top.removeChild(this.top.lastChild);
    }
    /*
     * Create filter framework excluding the filter fields to be added later.
     */
    createElement(this.document, 'legend', {append: this.top, text: this.title});
    this.fields = createElement(this.document, 'div', {append: this.top});
    btns        = createElement(this.document, 'div', {append: this.top});
  
    if (this.allowAutoSelect) {
        elm = createElement(this.document, 'div', {append: btns});
        createElement(this.document, 'label', {append: elm, text: 'Auto Select', forceGap: this.getGap()});
        elm = createElement(this.document, 'input', {append: elm, type: 'checkbox'});
        elm.checked = this.autoSelect;
        this.setEventHandler(elm, 'onclick', 'changeAutoSelect');

    }
    createElement(this.document, 'label', {append: btns, forceGap: this.getGap()});
    elm = createElement(this.document, 'input', {append: btns, type: 'button', value: 'Apply', forceGap: this.getGap()});
    this.btnRequest = elm;
    setHidden(elm, this.autoSelect);
    this.setEventHandler(elm, 'onclick', 'addFilterField');
    elm = createElement(this.document, 'input', {append: btns, type: 'button', value: 'Clear'});
    this.setEventHandler(elm, 'onclick', 'addFilterField');
};
function setFilter(filterId, key) {
    var on     = event.srcElement.checked;
    var filter = findFilter(key);
    
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
