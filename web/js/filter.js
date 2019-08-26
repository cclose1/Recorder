/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
'use strict';

var frames = [];

function findFrame(key) {    
    var i;
    
    for (i = 0; i < frames.length; i++) {
        if (frames[i].key === key) return frames[i];
    }
    return undefined;
}
function getFrame(pKey, pFrame, pRequestor) {
    var frame = findFrame(pKey);
    
    if (frame === undefined) {
        frame = new Frame(pKey, pFrame, pRequestor);
        frames.push(frame);
    }
    return frame;
}
function Frame(key, frame, requestor) {
    this.key       = key;
    this.frame     = frame;
    this.document  = this.frame.contentDocument || this.frame.contentWindow.document;
    this.requestor = requestor;
    this.top       = this.document.getElementsByTagName("fieldset")[0];
    this.fields    = this.top.children[1];
    
    this.getFrame = function() {
        return this.frame;
    };    
}
function setFilter(filter, key) {
    var on = event.srcElement.checked;
    
    setHidden(filter, !on);
    
    if (on && key !== undefined) {
        resizeFrame(findFrame(key).frame);
    }
}
function getWhere(fields) {
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
    return getWhere(frame.fields);
}
function addFilterValue(element, value) {
    if (value === '') element.value = '';
    else if (element.value === '') element.value = value;
    else element.value += ',' + value;
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
            break;
        case 'input':
            if (src.value === 'Apply')
                frame.requestor(getWhere(fields));
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
function createElement(frame, element, name) {
    var elm = frame.document.createElement(element);
    
    if (name !== undefined && name !== '') elm.setAttribute('name', name);
    
    return elm;
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
    elm = createElement(frame, 'label');
    elm.setAttribute('style', 'margin-right: 4px');
    elm.appendChild(frame.document.createTextNode(label));
    div.appendChild(elm);
    elm = createElement(frame, 'input', field[0]);
    elm.setAttribute('type', field.length > 1? trim(field[1]) : 'text');
    elm.setAttribute('size', '15');
    elm.setAttribute('tabindex', '0');
    div.appendChild(elm);
    
    if (response !== undefined) {
        elm.setAttribute('style', 'margin-right: 4px');
        elm = createElement(frame, 'select');
        elm.setAttribute('onchange', "top.addFilterField('" + frame.key + "', event);");
        loadListResponse(response, {
            name:       elm,
            keepValue:  true,
            async:      false,
            allowblank: true});
        div.appendChild(elm);
    }
    fields.appendChild(div);
}
