'use strict';
function removeURLPath(url) {
    return url.split('/').pop();
}
function randomString(len) {
    var s = '';
    
    var randomchar = function () {
        var n = Math.floor(Math.random() * 62);
        
        if (n < 10)  return n; //1-10
        if (n < 36)  return String.fromCharCode(n + 55); //A-Z
        return String.fromCharCode(n + 61); //a-z
    };
    while (s.length < len)  s += randomchar();
    return s;
}
function lpad(text, length, pad) {
    text = text.toString();
    
    while (text.length < length)
        text = (pad === undefined? ' ' : pad) + text;

    return text;
}
function lpad1(value, length, pad) {
    value = value.toString();

    while (value.length < length)
        value = pad === undefined? ' ' : pad + value;

    return value;
}
function rpad(text, length, pad) {
    text = text.toString();
    
    while (text.length < length)
        text = text + (pad === undefined? ' ' : pad);

    return text;
}
function toNumber(text, low, high) {
    if (isNaN(text))
        throw text + " is not numeric";

    if (text < low || text > high)
        throw text + " is not in the range " + low + " to " + high;

    return text;
}
function dateString(date) {
    var fields = date.toString().split(" ");

    return lpad(fields[2], 2, "0") + "-" + fields[1] + "-" + fields[3];
}
function timeString(date) {
    var fields = date.toString().split(" ");

    return fields[4];
}   
function getTime(date, milliseconds) {
    if (date === undefined || date === null) date = new Date();
    
    var time = lpad(date.getHours(), 2, '0') + ':' + lpad(date.getMinutes(), 2, '0') + ':' + lpad(date.getSeconds(), 2, '0');
    
    if (milliseconds !== undefined && milliseconds) time += '.' + lpad(date.getMilliseconds(), 3, '0');
    
    return time;
}
function getDateTime() {
    var now = new Date();
    var datetime =
            now.getFullYear() + '-' +
            lpad((now.getMonth() + 1), 2, '0') + '-' +
            lpad(now.getDate(), 2, '0') + ' ' +
            lpad(now.getHours(), 2, '0') + ':' +
            lpad(now.getMinutes(), 2, '0') + ':' +
            lpad(now.getSeconds(), 2, '0');
    return datetime;
}
function toDate(text) {
    var months = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var date = text.split(" ");
    var time = new Array(0, 0, 0);

    if (date.length === 2) {
        time = date[1].split(":");

        if (time.length === 1)
            time[1] = 0;
        if (time.length === 2)
            time[2] = 0;
        if (time.length > 3)
            throw "Invalid time format";
    }
    date = date[0].split(new RegExp("[/\-]"));

    if (date.length !== 3 || isNaN(date[2])) {
        throw "Invalid date format";
    }

    if (date[0].length > 2) {
        /*
         * If first field is more than 2 digits, assume it is the year and swap with date[2]
         */
        var y = date[0];

        date[0] = date[2];
        date[2] = y;
    }

    date[2] = (date[2].length <= 2) ? date[2] = "20" + lpad(date[2], 2, "0") : date[2];

    for (var i = 0; i < months.length; i++) {
        if (months[i].toLowerCase() === date[1].toLowerCase()) {
            date[1] = i + 1;
            break;
        }
    }
    var datetime = new Date();

    datetime.setFullYear(date[2], toNumber(date[1], 1, 12) - 1, date[0]);
    datetime.setHours(toNumber(time[0], 0, 23), toNumber(time[1], 0, 59), toNumber(time[2], 0, 59), 0);
    return datetime;
}
/*
 * If object is an element it is returned, otherwise it is assumed to be an element id and the element with that id from
 * the current document is returned.
 */
function getElement(object) {
    return typeof object === 'string' ? document.getElementById(object) : object;
}
function triggerClick(element) {
    var event;
    
    if (platform.name === 'IE') {
        event = document.createEvent("MouseEvents");
        event.initMouseEvent("click", true, true, "window", 0, 0, 0, 0, 0, false, false, false, false, 0, null);  
    } else {    
        event = new MouseEvent('click', {
        view:       window,
        bubbles:    true});
    }
    getElement(element).dispatchEvent(event);
}
function addIEFixClass(elements) {
    if (platform.name !== 'IE') return;
    
    elements.forEach(function(element) {
        element = element === 'body'? document.getElementsByTagName('body')[0] : getElement(element);
        element.classList.add("iefix");
    });
}
function setAttribute(element, id, value) {
    var name = id;
    
    if (typeof id !== 'string') {
        name  = value;
        value = id[name];
    }
    if (value !== undefined) element.setAttribute(name, value);
}
/*
 * Creates an element for tagName in the filter defined by frame and returns its elenent object
 * 
 * Options contains the options defining how the element specific characteristics are handled. Any option not
 * explicitly handled by this code, is assumed to be an attribute name, value pair that is applicable
 * to an element of tagName.
 */
function createElement(document, tagName, options) {
    var elm = document.createElement(tagName);
    /*
     * Changed from const name to work in IE11.
     */
    for (name in options) {
        let value = options[name]; 
        
        if (value === undefined) continue;  //Ignore options with undefined values;
        
        switch (name) {
            case 'append':
                value.appendChild(elm);
                break;
            case 'text':
                elm.appendChild(document.createTextNode(value));
                break;
            case 'forceGap':
                setAttribute(elm, 'style', 'margin-right: ' + value);
                break;
            default:
                setAttribute(elm, name, value);
        }
    }
    return elm;
}
function Reporter() {
    function output(action, message) {
        switch (action) {
            case 'console':
                console.log(message);
                break;
            case 'alert':
                alert(message);
                break;
            case 'throw':
                throw new Error(message);
                break;
            default:
                console.log('Unknown action-' + action + ' on report of ' + message);                    
        }
    }
    this.fatalAction = 'throw';
    
    this.setFatalAction = function(action) {
        this.fatalAction = action;
    };
    this.fatalError = function(message) {
        output(this.fatalAction, message);
    };
    this.log = function(message) {
        output('console', message);
    };        
    this.logThrow = function(exception, showAlert) {
        if (showAlert) alert(exception.name + '-' + exception.message);
        
        console.log(exception);
    };
}
var reporter = new Reporter();

function Statistics(enabled) {
    this.start;
    this.id         = randomString(3);
    this.logEnabled = enabled !== undefined && enabled;
 
    this.enableLog = function(yes) {
        this.logEnabled = yes;
    };       
    this.isEnabled = function() {
        return this.logEnabled;
    };
    this.setStart = function() {
        this.start = new Date();
    };
    this.elapsed = function() {
        return (new Date() - this.start) / 1000;
    };
    this.log = function(message) {
        if (this.logEnabled) console.log(getTime(this.start, true) + ' ' + this.id + ' ' + message);
    };
    this.logElapsed = function(action) {
        this.log(action + ' took ' + this.elapsed() + ' ms');
    };
}
var st = new Statistics();

/*
 * Provides the base methods and storage for Options objects. An options object has one or more name value pairs. Child classes use addSpec
 * in their constructors, to define the option name, type and default value if any.
 * 
 * pAccessByGet If this is true, the options are only accessible via the methods setValue and getValue, or by any getter and
 *              setter functions defined on child options objects.
 *              
 *              Note: Users can always bypass the methods by directly accessing optSpecs.
 * @returns {BaseOptions}
 */
function BaseOptions(pAccessByGet) {
    this.optSpecs    = [];
    this.accessByGet = pAccessByGet;
    
    function error(options, message) {
        reporter.fatalError(options.constructor.name + ' ' + message);
    }
    function getSpec(options, name) {
        for (var i = 0; i < options.optSpecs.length; i++) {
            if (options.optSpecs[i].name === name) return options.optSpecs[i];
        }
        return null;
    }
    /*
     * Reads or updates the current value for option name. If accessByGet is true the value is stored in optSpecs, otherwise it is
     * stored as an attribute of the options object.
     * 
     * @param options Set to this for the options object being acted upon.
     * @param name    The option name
     * @param read    True if the value is to be read, otherwise, the option value is replaced with value.
     * @param value   The value to be assigned. If read is true, a fatal error is reported and value is not undefined.
     * 
     * @returns The current value of the option.
     */
    function accessValue(options, name, read, value) {
        var spec = null;
        
        for (var i = 0; i < options.optSpecs.length; i++) {
            if (options.optSpecs[i].name === name) {
                spec = options.optSpecs[i];
                break;
            }
        }
        if (spec === null) error(options, 'Option "' + name + '" is not defined');
        
        if (read) {
            value = options.accessByGet? spec.value : options[name];
        } else {
            if (value === null && spec.mandatory) error(options, name + ' is mandatory and cannot be set to null');
            /*
             * Allow undefined, load check will validate that null values are errored, if not loaded with a value.
             */
            if (value === undefined) value = null;
            
            if (value !== null && spec.type !== null && typeof value !== spec.type)
                 error(options, ' "' + name + '" type is ' + typeof value + ' but should be ' + spec.type);
            else {
                if (options.accessByGet)
                    spec.value = value;
                else
                    options[name] = value;
            }
        }
        return value;
    }   
    function loadOption(options, name, value) {     
        /*
         * Strictly value should not be null or undefined. While transition to using options, apply default.
         */
        if (value === null || value === undefined) return;
        
        accessValue(options, name, false, value);    
    }     
    this.setValue = function(name, value) {
        accessValue(this, name, false, value);
    };
    this.getValue = function(name) {
        return accessValue(this, name, true);
    };
    this.clear = function() {
        for (var i = 0; i < this.optSpecs.length; i++) {
            var spec = this.optSpecs[i];
            
            accessValue(this, spec.name, false, spec.default);
        }
    };
    this.load = function(values, ignoreUndefined) {
        for (name in values) {
            if (ignoreUndefined !== undefined && ignoreUndefined) {
                /*
                 * Check if parameter not defined and return if it is. This prevents loadOption failing.
                 */
                if (getSpec(this, name) === null) continue;
            }
            loadOption(this, name, values[name]);
        }
        /*
         * Check that mandatory options have a value.
         */
        for (var i = 0; i < this.optSpecs.length; i++) {
            var spec = this.optSpecs[i];
            
            if ((this.accessByGet? spec.value : this[spec.name]) === null) {
                if (spec.mandatory)
                    error(this, 'Option "' + spec.name + ' is mandatory but does not have a default');
                else
                    this.accessByGet? spec.value = null : this[spec.name] = null;
            }
        }
    };
    this.addSpec = function(option) {
        var spec = {};
        
        spec.name = option.name;
        
        if (spec.name === undefined || spec.name === null)  error(this, 'Option must have a name proprty');
        
        for (name in option) {
            switch (name) {
                case 'name':                    
                    if (getSpec(this, spec.name) !== null)  error(this, 'Option "' + spec.name + '" is already defined');
                    
                    break;
                case 'type':
                    spec.type = option[name] === undefined? null : option[name];
                    break;
                case 'mandatory':
                    spec.mandatory = option[name];
                    break;
                case 'default':
                    spec.default = option[name];
                    break;
                default:
                     error(this, 'Option "' + spec.name + ' property-' + name + ' is already defined');
            }            
        }
        if (spec.type      === undefined) spec.type      = spec.default === undefined? null : typeof spec.default;
        if (spec.mandatory === undefined) spec.mandatory = true;
        
        this.optSpecs.push(spec);
    };
    this.log = function() {
        var spec;
        
        console.log(this.constructor.name);
        
        for (var i = 0; i < this.optSpecs.length; i++) {
            spec = this.optSpecs[i];
            
            console.log(
                    'Option '     + rpad(String(spec.name), 10)     + 
                    ' type '      + rpad(String(spec.type),  8)     +  
                    ' mandatory ' + lpad(String(spec.mandatory), 6) +
                    ' default '   + lpad(String(spec.default), 10)  + 
                    ' value '     + String(this.getValue(spec.name)));
        }
    };
}
function JSONArrayColumnOptions(pOptions) {  
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'name',     type: 'string',  mandatory: true});
    this.addSpec({name: 'minWidth', type: 'number', mandatory: false});
    this.addSpec({name: 'maxWidth', type: 'number', mandatory: false});
        
    this.clear();
    this.load(pOptions);    
}
function JSONArrayOptions(pOptions) {    
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'maxField',      type: 'number',  default: 0});
    this.addSpec({name: 'onClick',       type: 'string',  default: null,  mandatory: false});
    this.addSpec({name: 'nullToEmpty',   type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'useInnerCell',  type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'addColNoClass', type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'addName',       type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'usePrecision',  type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'columns',       type: 'object',  default: null,  mandatory: false});
        
    this.clear();
    this.load(pOptions);
    /*
     * Validate the column specifications.
     */
    if (this.columns !== null) {
        var cols = [];
        
        for (var i = 0; i < this.columns.length; i++) {
            var col = new JSONArrayColumnOptions(this.columns[i]);
            
            cols.push(col);            
        }
        this.columns = cols;
    }
}
function loadOptionsJSONOptions(pOptions){    
    BaseOptions.call(this, true);
    
    this.addSpec({name: 'name',         type: null});   
    this.addSpec({name: 'keepValue',    type: 'boolean', default: true});     
    this.addSpec({name: 'defaultValue', type: 'string',  default: ''});
    this.addSpec({name: 'allowBlank',   type: 'boolean', default: false});
        
    this.clear();
    this.load(pOptions, true);
}
loadOptionsJSONOptions.prototype = {    
    get name()         {return this.getValue('name');},
    get keepValue()    {return this.getValue('keepValue');},
    get defaultValue() {return this.getValue('defaultValue');},
    get allowBlank()   {return this.getValue('allowBlank');}};
loadOptionsJSONOptions.prototype.constructor = loadOptionsJSONOptions;

function JSONArrayOptionsO(options) {    
    function clear(options) {
        options.maxField      = 0;
        options.onClick       = undefined;
        options.nullToEmpty   = true;
        options.useInnerCell  = false;
        options.addColNoClass = false;
        options.addName       = true;
    }
    function loadOption(options, name, value, required) {     
        /*
         * Strictly value should not be null or undefined. While transition to using options, apply default.
         */
        if (value === null || value === undefined) return;
        
        if (typeof value !== required)             
            reporter.fatalError('JSONArrayOption "' + name + '" type is ' + typeof value + ' but should be ' + required);
        else
            options[name] = value;
    }
    function load(options, values) {
        for (name in values) {
            var required;

            switch (name) {
                case 'maxField':
                    required = 'number';
                    break;
                case 'onClick':
                    required = 'string';
                    break;
                case 'nullToEmpty':
                    required = 'boolean';
                    break;
                case 'useInnerCell':
                    required = 'boolean';
                    break;
                case 'addColNoClass':
                    required = 'boolean';
                    break;
                case 'addName':
                    required = 'boolean';
                    break;
                default:
                    reporter.fatalError('JSONArrayOption ' + name + ' is not valid');
            }
            if (required !== undefined) loadOption(options, name, values[name], required);
        }
    }
    clear(this);
    load(this, options);
}
function resizeFrame(id) {
    var elm    = getElement(id);
    var width  = elm.contentWindow.document.body.scrollWidth;
    var height = elm.contentWindow.document.body.scrollHeight;

    elm.width  = width  + "px"; 
    elm.height = height + "px";
}
function popUp() {
    var popUpDoc;
    var popUpTopId;
    var popUpId;
    var appId;
    var frameId;

    this.initialise         = initialise;
    this.display            = display;
    this.getElementById     = getElementById;
    this.getValueById       = getValueById;
    this.setValueById       = setValueById;
    this.getAppId           = getAppId;
    this.getContainerId     = getContainerId;
    this.getFrameId         = getFrameId;
    this.inDisplay          = inDisplay;
    this.setDocumentOnClick = setDocumentOnClick;
    
    function setSize(element, width, height, border) {
        var style = element.style;
        
        style.width       = width  + 'px';
        style.height      = height + 'px';
        style.borderWidth = border;
    }
    function initialise(popUpTopId, appId) {
        var home = document.getElementById(popUpTopId);
        var body;
        
        this.popUpTopId = popUpTopId;
        this.appId      = appId === undefined ? 'appframe' : appId;

        if (home.tagName === 'IFRAME') {             
            popUpDoc        = document.getElementById(popUpTopId).contentWindow.document;
            body            = popUpDoc.body;
            popUpId         = body.id !== ''? body.id : body.firstElementChild.id;
            frameId         = popUpTopId;
            this.popUpTopId = home.parentElement.id;
        } else {
            popUpId  = this.popUpTopId;
            popUpDoc = document;
            frameId  = '';
        }
        document.getElementById(this.popUpTopId).style.display = 'none';
    }
    function getAppId() {
        return this.appId;
    }
    function getContainerId() {
        return this.popUpTopId;
    }
    function display(yes, switchApp) {
        setHidden(this.popUpTopId, !yes);

        if (switchApp)
            setHidden(this.appId, yes);
        
        if (yes && frameId !== '') {
            var pu = getElementById(popUpId);
            var fr = document.getElementById(frameId).style;
            var wd = pu.offsetWidth  + pu.offsetLeft;
            var ht = pu.offsetHeight + pu.offsetTop;
            
            setSize(document.getElementById(frameId),         wd, ht, "0px 0px 0px 0px");
            setSize(document.getElementById(this.popUpTopId), wd, ht, "0px 0px 0px 0px");
        }
    }
    function getElementById(id) {
        return popUpDoc.getElementById(id);
    }
    function getValueById(id) {
        return trim(getElementById(id).value);
    }
    function setValueById(id, value, ignoreIfNotFound) {
        var el =getElementById(id);
        
        if (el === null && ignoreIfNotFound !== undefined && ignoreIfNotFound) return;
        
        el.value = value;
    }
    function getFrameId() {
        return frameId;
    }
    function inDisplay(event) {
        var target    = event;
        var containor = document.getElementById(this.popUpTopId);
        var frame     = frameId !== ''? getElementById(popUpId) : undefined;
        
        while (target.parentNode) {
            if (target === containor || frame !== undefined && target === frame) return true;
            
            target = target.parentNode;
        }
        return false;
    }
    function setDocumentOnClick(action) {
        document.onclick = action;
        
        if (frameId !== '') popUpDoc.onclick = action;
    }
}
function deleteRows(object) {
    if (object.rows.length === 0) {
        //IE always returns 0, so clear innerHTML as a safeguard.

        object.innerHTML = "";
    } else {
        while (object.rows.length !== 0) {
            object.deleteRow(0);
        }
    }
}
function getAllMethods(object) {
    return Object.getOwnPropertyNames(object).filter(function (property) {
        return typeof object[property] === 'function';
    });
}
function getXMLHttpRequest() {
    var xmlhttp = null;

    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    } else {
        alert("Your browser does not support XMLHTTP!");
    }
    return xmlhttp;
}
function addSectionRow(object, data) {
    var fields = data.split("|");
    var row = object.insertRow(object.rows.length);

    for (var i = 0; i < fields.length; i++) {
        var properties = fields[i].split("!");
        var cell = row.insertCell(i);

        cell.innerText = properties[0];

        for (var j = 1; j < properties.length; j++) {
            var nameValue = properties[j].split("=");

            if (nameValue[0] === "style")
                cell.setAttribute("style", nameValue[1]);
        }
    }
}
function addTableHeader(table, header)
{
    addSectionRow(table.tHead, header);
}
function clearTable(table) {
    deleteRows(table.tHead);
    deleteRows(table.tBodies[0]);
}
function addTableRow(table, data) {
    addSectionRow(table.tBodies[0], data);
}
function loadTable(table, data) {
    var fields = data.split("$");

    deleteRows(table.tHead);
    deleteRows(table.tBodies[0]);

    for (var i = 0; i < fields.length; i++) {
        if (fields[i].length > 1) {
            if (i === 0)
                addTableHeader(table, fields[i]);
            else
                addTableRow(table, fields[i]);
        }
    }
}
function checkDate(id, required) {
    var ok = false;

    if (fieldHasValue(id, required)) {
        try
        {
            var d = toDate(document.getElementById(id).value);
            document.getElementById(id).value = dateString(d);
            ok = true;
        } catch (err)
        {
            displayAlert('Validation Error', err, {focus: document.getElementById(id)});
        }
    }
    return ok;
}
function checkTime(id, required) {
    var ok = false;

    if (fieldHasValue(id, required)) {
        try
        {
            var d = toDate("01/01/2000 " + document.getElementById(id).value);
            document.getElementById(id).value = timeString(d);
            ok = true;
        } catch (err)
        {
            displayAlert('Validation Error', err, {focus: document.getElementById(id)});
        }
    }
    return ok;
}
function checkDateTime(did, tid, required) {
    var dValue;
    var tValue;

    required = required === undefined ? true : required;
    dValue = fieldHasValue(did, required);

    if (dValue && !checkDate(did))
        return false;
    if (!dValue && required)
        return false;

    tValue = fieldHasValue(tid, required);

    if (tValue && !checkTime(tid))
        return false;
    if (!tValue && required)
        return false;

    if (tValue && !dValue) {
        displayAlert('Validation Error', 'Date must be given if time is', {focus: document.getElementById(did)});
        return false;
    }
    return true;
}
function getRadioValue(name)
{
    var buttons = document.getElementsByName(name);

    for (var i = 0; i < buttons.length; i++)
    {
        if (buttons[i].checked)
            return buttons[i].value;
    }
    return "";
}
function getSelectedOption(id) {
    var options = document.getElementById(id).options;

    return (options.selectedIndex < 0) ? "" : options[options.selectedIndex].text;
}

function getValue(id) {
    var input = document.getElementById(id);
    var type = input.type;

    if (type === "radio")
        return getRadioValue(input.name);
    if (type === "checkbox")
        return input.checked;

    return input.value.trim();
}
function getValueNew(id) {
    var input = document.getElementByName(id);
    var type = input.type;

    if (type === "radio") {
        for (var i = 0; i < input.length; i++)
        {
            if (input[i].checked)
                return input[i].value;
        }
        return "";
    }
    input = document.getElementByName(id);

    if (type === "radio")
        return getRadioValue(input.name);
    if (type === "checkbox")
        return input.checked;

    return input.value;
}
function getNameValue(id) {
    return id + "=" + document.getElementById(id).type + "," + getValue(id);
}
function isVisible(element) {
    element = getElement(element);

    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}
function assignNameValue(frame, value) {
    var fields = value.split("=", 2);
    var id = fields[0];
    var fields = fields[1].split(",", 2);

    if (fields[0] === "checkbox")
        window.parent.frames[frame].document.getElementById(id).checked = (fields[1] === "true") ? -1 : 0;
    else
        window.parent.frames[frame].document.getElementById(id).value = fields[1];
}
function updateField(frame, id, value) {
    window.parent.frames[frame].document.getElementById(id).value = value;
}
function copyInput(frame, id) {
    if (document.getElementById(id).type === "checkbox")
        window.parent.frames[frame].document.getElementById(id).checked = document.getElementById(id).checked;
    else
        window.parent.frames[frame].document.getElementById(id).value = document.getElementById(id).value;
}
function setCookie(name, value, expiredays) {
    var exdate = new Date();

    exdate.setDate(exdate.getDate() + expiredays);
    document.cookie = name + "=" + escape(value) + ((expiredays === null) ? "" : ";expires=" + exdate.toGMTString());
}
function getCookie(name) {
    if (document.cookie.length > 0) {
        var start = document.cookie.indexOf(name + "=");
        var end;

        if (start !== -1) {
            start = start + name.length + 1;
            end = document.cookie.indexOf(";", start);

            if (end === -1)
                end = document.cookie.length;

            return unescape(document.cookie.substring(start, end));
        }
    }
    return "";
}
function addParameter(parameters, name, value) {
    if (parameters !== "")
        parameters += "&";

    parameters += (name + "=" + encodeURIComponent(value));

    return parameters;
}
function addParameterById(parameters, name, alias) {
    if (alias === undefined)
        alias = name;

    return addParameter(parameters, alias, getValue(name));
}
function Column(name, no, type, precision, scale, optional) {
    this.name      = name;
    this.no        = no;
    this.type      = type;    
    this.precision = precision;
    this.scale     = scale;
    this.optional  = optional || false;
    this.class     = '';
    this.size      = name.length;
    this.minWidth  = null;
    this.maxWidth  = null;
    
    if (this.no       !== undefined && this.no > 0) this.addClass('tbcol' + no);
    if (this.optional !== undefined && this.optional) this.addClass('optional');
    if (this.type     !== undefined && (this.type === "int" || this.type === "decimal")) this.addClass('number');
}
Column.prototype.addClass = function (tag) {
    if (this.class !== '')
        this.class += ' ';

    this.class += tag;
};
Column.prototype.setSize = function (psize) {
    if (this.size === null || this.size < psize)
        this.size = psize;
};
Column.prototype.getClass = function () {
    return this.class;
};
Column.prototype.getDisplayValue = function (value, nullToSpace) {
    if (value === null || value === 'null') {
        if (nullToSpace !== 'undefined' && nullToSpace) value = '';
        
        return value;
    } 
    if (this.type === 'decimal' && this.scale !== 0 && value !== '') {
        try {
            value = value.toFixed(this.scale);
        } catch (e) {
            reporter.logThrow(e, true);
        }
    }
    this.setSize(value.length);
    
    return value;
};
/*
 * IE11 does not support classes.
 class RowReader {
 constructor(row, throwError) {
 this.row        = row;
 this.index      = -1;
 this.throwError = throwError === undefined? false : throwError;
 this.header     = document.getElementById(this.row.parentNode.parentNode.id).rows[0];
 };
 static check(reader) {        
 if (reader.index >= reader.header.cells.length) {
 if (reader.throwError)
 throw Error("Attempt to read beyond last column. There are " + reader.header.cells.length + " columns");
 else
 alert("Attempt to read beyond last column. There are " + reader.header.cells.length + " columns");
 }
 }
 reset() {
 this.index = -1;
 }
 nextColumn() {
 RowReader.check(this);
 this.index += 1;
 
 return this.index < this.header.cells.length;
 }
 columnName() {
 return this.header.cells[this.index].innerHTML;
 
 }
 columnValue() {
 return trim(this.row.cells[this.index].innerHTML);
 }
 }
 */

function rowReader(row, throwError) {
    this.row = row;
    this.index = -1;
    this.header = document.getElementById(this.row.parentNode.parentNode.id).rows[0];
    this.throwError = throwError === undefined ? false : throwError;

    this.check = function() {
        if (this.index >= this.header.cells.length) {
            if (this.throwError)
                throw Error("Attempt to read beyond last column. There are " + this.header.cells.length + " columns");
            else
                alert("Attempt to read beyond last column. There are " + this.header.cells.length + " columns");
        }
    };
    this.reset = function() {
        this.index = -1;
    };
    this.nextColumn = function() {
        this.check();
        this.index += 1;

        return this.index < this.header.cells.length;
    };
    this.columnName = function() {
        this.check();
        return this.header.cells[this.index].innerHTML;
    };
    this.columnValue = function() {
        this.check();

        /*
         * Needed to go via ta to ensure that escapable characters such as & are not returned in their escaped form i.e. &amp;
         * 
         * Don't know why this is necessary.
         */
        var ta = document.createElement('textarea');
        ta.innerHTML = trim(this.row.cells[this.index].innerHTML);
        return ta.value;
    };
}
/*
 * Returns a width large enough to fit noOfChars.
 * 
 * This is not rigorous as there is not sufficient information to do this, e.g you have to know
 * the character font size and the display pixel size depending on the units chosen.
 * 
 * This function is used to try and set a field size so that the scrolled data of a table matches the
 * width of the table header.
 * 
 * It has not been possible to achieve precise alignment of header and data even so.
 */
function getWidth(noOfChars, unit) {
    var multiplier = 1;

    switch (unit) {
        case "px":
            multiplier = 7.7;
            break;
        case "em":
            noOfChars += 1;
            multiplier = 0.5;
            break;
        case "mm":
            multiplier = 2.4;
            break;
        default:
            unit = "mm";
            multiplier = 2.4;
    }
    return (multiplier * noOfChars) + unit;
}
function setElementValue(field, value, type, scale) {
    value = (new Column(field.id, -1, value, type, scale)).getDisplayValue(value, true);
    
    if (type === 'varchar' || type === 'char') {
        if (field.type === "checkbox")
            field.checked =
                    value.toLowerCase() === 'y' ||
                    value.toLowerCase() === 'yes' ||
                    value.toLowerCase() === 't' ||
                    value.toLowerCase() === 'true';
        else
            field.value = value;
    } else 
        field.value = value;
}
function arrayToJSONTable(name) {
    this.columns = [];
    this.name   = name;
    
    this.addColumn = function(name, dataName, type, optional) {
        var column = {};
        
        column.Name     = name;
        column.DataName = dataName;
        column.Type     = type;
        
        for (name in optional) {
            column[name] = optional[name];
        }
        this.columns.push(column);
    };
    this.getJSON = function(data) {
        var i      = 0;
        var result = new JSON();
        var arr    = new JSON('array');
        var row;
        var col;
        
        result.addMember('Table', name);
        result.addMember('Header', arr);
        
        for (i = 0; i < this.columns.length; i++) {
            col = this.columns[i];
            row = new JSON('object');
            arr.addElement(row);
            
            for (name in col) {
                if (col.name !== 'DataName') row.addMember(name, col[name]);
            }
        }
        arr = new JSON('array');
        result.addMember('Data', arr);
        
        for (i = 0; i < data.length; i++) {
            var dr = data[i];
            var cl;
            var jcols = new JSON('array');
            
            arr.addElement(jcols);
            
            for (cl = 0; cl < this.columns.length; cl++) {
                jcols.addElement(dr[this.columns[cl].DataName]);
            }
        }
        return result;
    };
}
function loadJSONFields(jsonData, exact) {
    try {
        var json;
        var jfld;
        var jattr;
        var field;
        var id;
        var type;
        var precision;
        var scale;
        var value;

        if (typeof jsonData === 'string') json = (new JSONReader(jsonData)).getJSON();
        
        json.setFirst();

        while (json.isNext()) {
            jfld = json.next().value;
            
            jfld.setFirst();
            
            while (jfld.isNext()) {
                jattr = jfld.next();
                
                switch (jattr.name) {
                    case "Name":
                        id = jattr.value;
                        break;
                    case "Type":
                        type = jattr.value;
                        break;
                    case "Precision":
                        precision = jattr.value;
                        break;
                    case "Scale":
                        scale = jattr.value;
                        break;
                    case "Value":
                        value = jattr.value;
                        break;
                    default:
                        reporter.fatalError("Unexpected attibute " + jattr.name + " when loading fields");
                }
            }
            field = document.getElementById(id);

            if (field !== null)
                setElementValue(field, value, type, scale);
            else if (exact === undefined || exact === true) 
                reporter.fatalError("There is no element for field " + id);
            
            id        = "";
            type      = "";
            precision = "";
            scale     = "";
            value     = "";
        }
    } catch (e) {
        reporter.logThrow(e, true);
    }
}

/*
 * The json object must be set to the JSON array of column header objects.
 */
function jsonAddHeader(json, table, options) {
    var name;
    var header = table.createTHead();
    var row    = header.insertRow(0);
    var col;
    var jcol;
    var columns = [];
    var colNo   = 0;
    /*
     * Iterate the array of column specifier objects.
     */
    json.setFirst();
    
    while (json.isNext()) {
        jcol = json.next().value;
        name = jcol.getMember('Name', true).value;
        col  = new Column(
                name,
                options.addColNoClass? colNo + 1 : -1,
                jcol.getMember('Type').value,
                jcol.getMember('Precision', false).value,
                jcol.getMember('Scale',     false).value,
                jcol.getMember('Optional',  false).value);
        columns.push(col);
        
        if (options.useInnerCell) {
            var cell = document.createElement('th');
            
            cell.innerHTML = name;
            row.appendChild(cell);
        } else {
            row.innerHTML += "<th>" + name + "</th>";
        }
        colNo++;
    }
    /*
     * Set any column override options.
     */
    if (options.columns !== null) {        
        for (var i = 0; i < options.columns.length; i++) {
            var ocol = options.columns[i];
            
            for (var j = 0; j < columns.length; j++) {
                col = columns[j];
                
                if (col.name === ocol.name) break;
                
                col = null;
            }
            if (col === null)
                reporter.fatalError('There is no column "' + ocol.name + '" in table ' + table.id);
            else {
                col.minWidth = ocol.minWidth;
                col.maxWidth = ocol.maxWidth;
            }
        }
    }
    return columns;
}
/*
 * The json object must be set to the JSON array of rows the column values array.
 */
function jsonAddData(json, columns, table, options) {
    var body = table.tBodies[0];
    var rowNo = 0;
    var dcol;
    var row;
    
    json.setFirst();    
    /*
     * Iterate the data rows.
     */
    while (json.isNext()) {
        var cols = 0;
        var drow = json.next().value;
        var value;
        var cell;
        
        row = body.insertRow(rowNo++);

        if (options.onClick !== null) row.setAttribute("onclick", options.onClick);
        /*
         * Iterate the data columns.
         */
        drow.setFirst();
        
        while (drow.isNext()) {
            dcol  = drow.next();
            value = columns[cols].getDisplayValue(dcol.value, options.nullToEmpty);
            cell  = row.insertCell(cols++);            
            cell.innerHTML = value;
        }
    }
}
/*
 * @param {type} jsonArray Contains a JSON the table data. If this is an object it is assumed to be a json object as created by json.js.
 *               If it is a string, it is expected to be a JSON string and it is converted to a json object using JSONReader.
 *               
 *               See below for the json object table definition.
 *               
 * @param {type} id The html element id of the table where the data will be stored.
 * @param {type} maxField The max column field size. If the data field exceeds this size, it will be wrapped to fit within, i.e. requiring
 *                        multiple lines.
 * @param {type} onClickFunction The action that will be invoked if the table line is clicked. Set to undefined, if there is no action required.
 * @param {type} useInnerHTML Determines how the table header th cells are created. If true, a th cell is created and appended to the header
 *                            row. If false, <th>ColName</th> is appended to the header row innerHTML. If null, default is applied, which
 *                            is the false option. Not sure if both are equivalent and if either is preferable.
 * @param {type} includeColNoClass If true, a class is added constructed from "tbcol" + colNo. The column numbers start at 1.
 * @param {type} addName If true, the column heading is added as the name attribute.
 * @returns An array of the column specifications to be used to define the data cell formats and attributes, see Column definition.
 * 
 * The JSON table string format is
 * 
   {"Table"  : "Name",
    "Header" : [{column object},.....]
    "Data"   : [[columndata,...],...]}
  
  Currently only the Header and Data elements are used. 
  
  The array of column objects contain an object for each table column. The JSON elements of the column object are:
      "Name" : name string
      "Type" : type string  -- These are defined by JDBCType. The driver return the lower case value, although the JDBCType ENUM values are
                            -- upper case.
      "Precision" : precision integer -- The size of the database field.
      "Scale"     : scale     integer -- The number of places after decimal point, e.g. DECIMAL(10, 5) would have Precision 10 and Scale 5.
      "Optional"  : optional  boolean -- True if column can be omitted when displayed on small screens. Defaults to false is absent.
  
  Currently Type, Precision and Scale have no effect, apart from Type = Decimal, where scale is used to add trailing 0 when displayed, e.g.
  if value is 12.1 and Scale is 3, the displayed value is 12.100.
  
  The array of data rows contains an array of data values for each row formatted as JSON values.
  Example
      {"Table"  : "Test",
       "Header" : [{"Type":"varchar","Precision":10,"Name":"Item"},
                   {"Type":"boolean","Name":"Available"},
                   {"Type":"decimal","Precision":12,"Scale":2,"Name":"Price"}],
        "Data"   : [["Spanner",null,12.1],["Hammer",true,20],["Wrench",false,25.39]]}
  
 */
function loadJSONArray(jsonArray, id, options) {
    
    if (options.constructor.name !== 'JSONArrayOptions') options = new JSONArrayOptions(options);
    
    try {
        var maxRowSize = 0;
        var table      = document.getElementById(id);
        var json       = jsonArray;
        var jval;
        var cols;
        var row;

        clearTable(table);
        
        if (typeof json === 'string') json = (new JSONReader(jsonArray)).getJSON();
        
        st.log("Loading table " + id);
        st.setStart();
        
        jval = json.getMember('Header', true);
        cols = jsonAddHeader(jval.value, table, options);
        jval = json.getMember('Data', true);
        jsonAddData(jval.value, cols, table, options);

        st.logElapsed("Loading rows");
        st.setStart();
        /*
         * Set cell widths and class and name if required. 
         */
        for (var j = 0; j < table.rows.length; j++) {
            var rowSize = 0;
            
            row = table.rows[j];

            for (var i = 0; i < row.cells.length; i++) {
                var col      = cols[i];
                var cell     = row.cells[i];
                var minWidth = 0;
                var maxWidth = options.maxField;
                
                if (options.usePrecision)  minWidth = col.precision;
                if (col.minWidth !== null) minWidth = col.minWidth;
                if (col.maxWidth !== null) maxWidth = col.maxWidth;
                if (minWidth > maxWidth)   minWidth = maxWidth;
                
                if (col.size <= minWidth && minWidth !== null) {
                    rowSize += minWidth;
                    cell.setAttribute("style", 'width:' + getWidth(minWidth, 'em'));
                } else if (col.size < maxWidth) {
                    rowSize += col.size;
                    cell.setAttribute("style", 'width:' + getWidth(col.size, 'em'));
                } else {
                    rowSize += maxWidth;
                    cell.setAttribute("style", 'width:' + getWidth(maxWidth, 'em') + ';overflow: hidden');
                }
                if (col.getClass() !== '') cell.setAttribute('class', col.getClass());
                if (options.addName)       cell.setAttribute('name',  col.name);
                /*
                 * Calculate total width. Only accessed in debugging.
                 */
                if (rowSize > maxRowSize) maxRowSize = rowSize;
            }
        }
        reporter.log('Table ' + id + ' has ' + table.rows.length + ' rows max rows ' + maxRowSize);
        st.logElapsed("Set table sizes");
    } catch (e) {
        reporter.logThrow(e, true);;
    }
}
function addOption(select, value) {
    /*
     * For Datalist options, setting a new Option has no effect.
     */
    if (select.tagName === "DATALIST")
        select.innerHTML += '<option value="' + value + '"/>';
    else
        select.options[select.options.length] = new Option(value, value);
}
function loadOptionsJSON(jsonOptions, loadOptions) {
    try {        
        var options = new loadOptionsJSONOptions(loadOptions);        
        var json    = jsonOptions;
        var select  = getElement(options.name);
        var initial = options.keepValue ? select.value : options.defaultValue !== null ? options.defaultValue : "";
        /*
         * For the Datalist options setting select.options = 0 has no effe
         */
        select.innerHTML = "";

        if (options.allowBlank) addOption(select, '');
        
        if (Array.isArray(json)) {
            for (var i = 0; i < json.length; i++) addOption(select, json[i]);
        }
        else if (typeof json === 'string' && json.charAt(0) !== '{') {
            json.split(',').forEach(function (option) {
                addOption(select, option);
            });
        } else {
            if (typeof json === 'string') json = (new JSONReader(jsonOptions)).getJSON();
            
            var jopt = json.getMember('Data', true).value;
            
            /*
             * Iterate over rows.                
             */
            while (jopt.isNext()) {
                var jrow = jopt.next().value;
                /*
                 * Each row should only contain one column.
                 */
                jrow.setFirst();
                
                addOption(select, jrow.next().value);
            }
        }
        select.value = initial;
    } catch (e) {
        reporter.logThrow(e, true);
    }
}
function currentDate(date) {
    var mthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (date === undefined)
        date = new Date();

    return lpad(date.getDate(), 2, '0') + '-' + mthNames[date.getMonth()] + '-' + lpad(date.getFullYear(), 2, '0');
}
function currentTime(date) {
    if (date === undefined)
        date = new Date();

    return lpad(date.getHours(), 2, '0') + ':' + lpad(date.getMinutes(), 2, '0') + ':' + lpad(date.getSeconds(), 2, '0');
}
function currentDateTime(date) {
    if (date === undefined)
        date = new Date();

    return currentDate(date) + ' ' + currentTime(date);
}
function hasValue(parameter) {
    return parameter !== null && parameter !== undefined;
}
function indexOfOption(list, option) {
    if (typeof list === 'string')
        list = document.getElementById(list);

    for (var i = 0; i <= list.options.length - 1; i++) {
        if (list.options[i].value === option)
            return i;
    }
    return -1;
}
function allowedInIntegerField() {
    if (!(event.charCode >= 48 && event.charCode <= 57)) {
        event.preventDefault();
        return false;
    }
}
function allowedInNumberField() {
    var value = event.target.value + String.fromCharCode(event.charCode);

    if (isNaN(value) && value !== '+' && value !== '-') {
        event.preventDefault();
        return false;
    }
}
function discardFieldInput(msg) {
    event.preventDefault();

    if (msg !== undefined)
        displayAlert('', msg);

    return false;
}
function validateIntegerField(low, high) {
    var value = trim(event.target.value);

    if (!((event.charCode >= 48 && event.charCode <= 57) || (value === "" && (event.charCode === 43 || event.charCode === 45)))) {
        event.preventDefault();
        return false;
    }
    if (event.charCode !== 43 && event.charCode !== 45) {
        value = value + String.fromCharCode(event.charCode);

        if (hasValue(low) && value < low || hasValue(high) && value > high) {
            event.preventDefault();
            return false;
        }
    }
}
function checkIntegerField(id, low, high) {
    var field = document.getElementById(id);
    var value = trim(field.value);
    var msg = "Enter a value for " + field.name;
    var valid = true;

    if (hasValue(low) && hasValue(high)) {
        valid = value >= low && value <= high;
        msg = msg + " between " + low + " and " + high;
    } else if (hasValue(low)) {
        valid = value >= low;
        msg = msg + " greater than or equal to " + low;
    } else if (hasValue(high)) {
        valid = value <= high;
        msg = msg + " less than or equal to " + high;
    }
    if (value === "" || !valid) {
        displayAlert('Field Validation', msg, {focus: field});
        return false;
    }
    return true;
}

function fieldHasValue(id, required) {
    var field = document.getElementById(id);
    var value = trim(field.value);

    if (value === "") {
        if (required === undefined || required) {
            field.focus();
            displayAlert('Field Validation', "Enter a value for " + field.name);
        }
        return false;
    }
    return true;
}
/*
 * Executes a none blocking AJAX call.
 * 
 * setParameters   is a function that returns the request parameters. If the function returns undefined the function exits.
 * processResponse is a function that actions the call responseText and is called if the call succeeds.
 * 
 * If the AJAX call fails, an alert is generated giving the reason for failure.
 */
function parametersSummary(parameters) {
    var ps  = parameters.split('&');
    var smy = '';
    
    for (var i = 0; i < ps.length; i++) {
        if (i > 3) break;
        
        if (/^mysql/.test(ps[i])) continue;
        
        smy += (smy === ''? '' : ',') + ps[i];
    }
    return smy;
}
function ajaxCall(destination, parameters, processResponse, async) {
    var stm            = new Statistics(st.enableLog);
    var xmlHttpRequest = getXMLHttpRequest();
    var params = parametersSummary(parameters);

    if (typeof parameters === "function")
        params = parameters();
    else
        params = parameters;

    if (params === undefined)
        return;

    if (async === undefined)
        async = true;

    xmlHttpRequest.onreadystatechange = function () {
        if (xmlHttpRequest.readyState === 4) {
            if (xmlHttpRequest.status === 200) {
                stm.logElapsed("Post");
                processResponse(xmlHttpRequest.responseText);
            } else {
                alert("HTTP error " + xmlHttpRequest.status + ": " + xmlHttpRequest.responseText);
            }
        }
    };
    stm = new Statistics(st.enableLog);
    stm.log("Post to " + destination + ' parameters ' + parametersSummary(parameters));
    stm.setStart();
    xmlHttpRequest.open("POST", destination + "?" + params, async);
    xmlHttpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xmlHttpRequest.send(null);
}
function setCookie(name, value, exdays) {
    var d = new Date();

    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";expires=" + d.toGMTString();
}

function getCookie(name) {
    var ca = document.cookie.split(';');

    name += "=";
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();

        if (c.indexOf(name) === 0)
            return c.substring(name.length, c.length);
    }
    return "";
}
/*
 * It appears that if the attribute hidden is present, irrespective of if its value is true or false, the element is
 * not displayed. The function removes it, if it is present, and adds it with the value true, if yes is true.
 */
function setHidden(name, yes) {
    var element = getElement(name);
    var show = element.type === 'button' ? 'inline-block' : '';

    if (element.hasAttribute("hidden"))
        element.removeAttribute("hidden");
    /*
     * Following added as hidden does not work correctly on IE.
     */
    element.style.display = yes ? 'none' : show;
}
function setLabel(name, caption) {
    document.getElementById(name).innerHTML = caption;
}

function trim(str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}
function setDateTime(fldDate, fldTime) {
    var date = new Date();

    fldDate = typeof fldDate === 'undefined' ? 'date' : fldDate;
    fldTime = typeof fldTime === 'undefined' ? 'time' : fldTime;

    if (trim(document.getElementById(fldDate).value) === '') {
        document.getElementById(fldDate).value = currentDate(date);
    }
    if (trim(document.getElementById(fldTime).value) === '') {
        document.getElementById(fldTime).value = currentTime(date);
    }
}
function loadDateTime(fields, date, time) {
    document.getElementById(date === undefined? "date" : date).value = fields.length > 0? fields[0] : "";
    document.getElementById(time === undefined? "time" : time).value = fields.length > 1? fields[1] : "";
}
function tidyNumber(number, zeroToNull, maxPlaces) {
    if (zeroToNull && toNumber(number) <= 0)
        return '';

    if (maxPlaces === undefined)
        return number;

    return Number(number).toFixed(maxPlaces);
}
function enableMySql(server) {
    if (document.getElementById('mysqldiv')) {
        function processResponse(response) {
            setHidden('mysqldiv', response.indexOf('yes') !== 0);
        }
        ajaxLoggedInCall(server, processResponse, addParameter('', 'action', 'enablemysql'), false);
    }
}
function createParameters(action) {
    var parameters = addParameter('', 'action', action);

    if (document.getElementById('mysqldiv')) {
        parameters = addParameterById(parameters, 'mysql');
    }
    return parameters;
}
function addDBFilterField(filter, element, name, qualifier) {
    if (name === undefined) return filter;
    
    var fields = element.value.split(',');
    var i;
    
    if (filter        === undefined) filter = '';
    if (element.value === '') return filter;
    
    for (i = 0; i < fields.length; i++) {
        if (i === 0) {
            if (filter !== '') filter += ',';
            
            filter += name + '=';
        }
        else
            filter += '|';
        
        switch (qualifier) {
            case undefined:
            case 'quoted':
                fields[i] = "'" + fields[i] + "'";
                break;
            case 'like':                
                fields[i] = "'%" + fields[i] + "%'";
                break;
            case 'numeric':
                break;
        }        
        filter += fields[i];
    }
    return filter;
}
function loadListResponse(response, options) {  
    loadOptionsJSON(response, options);
}
function getList(server, options, returnResponse) {
    var parameters = createParameters('getList');
    var save;

    parameters = addParameter(parameters, 'field', options.field === undefined ? options.name : options.field);

    if (options.table !== undefined)
        parameters = addParameter(parameters, 'table', options.table);

    if (options.filter !== undefined && options.filter !== '')
        parameters = addParameter(parameters, 'filter', options.filter);

    function processResponse(response) {
        if (options.name !== undefined)loadListResponse(response, options);
        
        if (returnResponse !== undefined && returnResponse) save = response;
    }
    ajaxLoggedInCall(server, processResponse, parameters, options.async);
    return save;
}