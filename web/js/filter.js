/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
'use strict';

var frames = [];

function setEventHandler(frame, element, event, handler) {    
    element.setAttribute(event, "top." + handler  + "('" + frame.key + "', event);");
}
function findFrame(key) {    
    var i;
     
    for (i = 0; i < frames.length; i++) {
        if (frames[i].key === key) return frames[i];
    }
    return undefined;
}
function getFrame(pKey, pFrame, pRequestor, pOptions) {
    var frame = findFrame(pKey);
    
    if (frame === undefined) {
        frame = new Frame(pKey, pFrame, pRequestor, pOptions);
        frames.push(frame);
    }
    return frame;
}
function setVarByName(object, id, value) {
    var name = id;
    
    if (typeof id !== 'string') {
        name  = value;
        value = id[name];
    }
    if (value !== undefined) object[name] = value;
}
function Frame(key, frame, requestor, options) {
    this.key             = key;
    this.frame           = frame;
    this.document        = this.frame.contentDocument || this.frame.contentWindow.document;
    this.requestor       = requestor;
    this.top             = this.document.getElementsByTagName("fieldset")[0];
    this.fields          = undefined;
    this.forceGap        = undefined;
    this.allowAutoSelect = false;
    this.autoSelect      = false;
    this.mouseEvent      = undefined;
    this.btnRequest      = undefined;
    this.title           = 'Filter';
    
    var elm;
    var btns;
       
    this.getFrame = function () {
        return this.frame;
    };    
    this.getGap = function () {
        return this.forceGap;
    };
    this.callRequestor = function (force) {
        if (this.autoSelect || force === undefined || force) {
            this.requestor(getWhere(this));

            if (this.autoSelect && this.trigger !== undefined) {
                if (this.mouseEvent === undefined) 
                    this.mouseEvent = 
                        new MouseEvent('click', {
                            view:       window,
                            bubbles:    true});
                this.trigger.dispatchEvent(this.mouseEvent);
            }
        }
    }   
    for (const name in options) {
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
    this.fields = createElement(this.document, 'div',    {append: this.top});
    btns        = createElement(this.document, 'div',    {append: this.top});
    
    if (this.allowAutoSelect) {
        elm = createElement(this.document, 'div',    {append: btns});
        createElement(this.document, 'label',  {append: elm, text: 'Auto Select', forceGap: this.getGap()});
        elm = createElement(this.document, 'input',  {append: elm, type: 'checkbox'}); 
        elm.checked = this.autoSelect;  
        setEventHandler(this, elm, 'onclick', 'changeAutoSelect');
        
    }
    createElement(this.document, 'label',  {append: btns, forceGap: this.getGap()});
    elm = createElement(this.document, 'input',  {append: btns, type: 'button', value: 'Apply', forceGap: this.getGap()});
    this.btnRequest = elm;
    setHidden(elm, this.autoSelect);
    setEventHandler(this, elm, 'onclick', 'addFilterField');
    elm = createElement(this.document, 'input', {append:  btns, type: 'button', value: 'Clear'});
    setEventHandler(this, elm, 'onclick', 'addFilterField');
}
function setFilter(filter, key) {
    var on = event.srcElement.checked;
    
    setHidden(filter, !on);
    
    if (on && key !== undefined) {
        resizeFrame(findFrame(key).frame);
    }
}
function getWhere(frame) {
    var fields = frame.fields.children;
    var input;
    var w = '';
    var i;
    var q;
    
    for (i = 0; i < fields.length; i++) {
    
        var field = fields[i];
        input = field.childNodes[1];
        
        switch (input.type) {
            case 'text':
                q = field.childElementCount > 2? 'quoted' : 'like';
                break;
            case 'number':
                q = 'numeric'
                break;
        }
        w = addDBFilterField(w, input, input.name, q);
    }
    return w;
}
function getFilter(frame) {
    return getWhere(frame);
}
function addFilterValue(element, value) {
    if (value === '') element.value = '';
    else if (element.value === '') element.value = value;
    else element.value += ',' + value;
}
function changeFilterValue(key, event) {
    var frame  = findFrame(key);
    
    frame.callRequestor(false);    
}

function changeAutoSelect(key, event) {
    var frame  = findFrame(key);
    
    frame.autoSelect = event.target.checked;
    
    if (frame.btnRequest !== undefined) setHidden(frame.btnRequest, event.target.checked);
}
function addFilterField(key, event) {
    var frame  = findFrame(key);
    var fields = frame.fields.children;
    var value  = event.srcElement.value;
    var input;
    var div;
    var src    = event.srcElement;
    var i;
    
    switch (src.localName) {
        case 'select':
            /*
             * The top of the path will the option element firing the event. The next path element is the
             * containing div for the filter fields. The second one is the input field to which value is applied to.
             */
            div   = event.path[1];
            input = div.childNodes[1];
            addFilterValue(input, value);
            frame.callRequestor(false);
            break;
        case 'input':
            if (src.value === 'Apply')
                frame.requestor(getWhere(frame));
            else {
                for (i = 0; i < fields.length; i++) {
                    var field = fields[i];
                    
                    input = field.childNodes[1];
                    input.value = '';

                    if (field.childElementCount > 2)
                        field.childNodes[2].value = '';
                }
                frame.requestor();
            }
            break;
    }
}
function addFilter(frame, label, qualifiedfield, response) {
    var fields = frame.fields;
    var div    = frame.document.createElement('div');
    var field  = qualifiedfield.split(',');
    var elm;
    
    /*
     * Fields added by code do not have a gap when display is inline-block, whereas those added in html do. Hence, the
     * reason for adding margin-right.
     */
    elm = createElement(frame.document, 'label', {append: div, forceGap: frame.getGap(), text: label});
    elm = createElement(frame.document, 'input', {
        append:    div, 
        name:      field[0], 
        type:      field.length > 1? trim(field[1]) : 'text', 
        size:     '15', 
        tabindex: '0',
        forceGap: response !== undefined? frame.getGap() : undefined});
    
    if (frame.allowAutoSelect) setEventHandler(frame, elm, 'onchange', 'changeFilterValue');
    
    if (response !== undefined) {
        elm = createElement(frame.document, 'select', {append: div});
        setEventHandler(frame, elm, 'onchange', 'addFilterField');
        loadListResponse(response, {
            name:       elm,
            keepValue:  true,
            async:      false,
            allowblank: true});
    }
    fields.appendChild(div);
}
