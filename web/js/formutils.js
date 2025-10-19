'use strict';
/*
 * These functions have been added over time and represent improving understanding of javaScript.
 * 
 * Most of the uses of var should be replaced by let. var creates a variable that has
 * function or global scope, whereas let creates a variable that has block scope. Usually block scope is what is needed.
 */

var months  = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");    
/*
 * Not sure about this. Need to investigate further.
 */
function listAllEventListeners() {
  const allElements = Array.prototype.slice.call(document.querySelectorAll('*'));
  allElements.push(document);
  allElements.push(window);

  const types = [];

  for (let ev in window) {
    if (/^on/.test(ev)) types[types.length] = ev;
  }

  let elements = [];
  for (let i = 0; i < allElements.length; i++) {
    const currentElement = allElements[i];
    for (let j = 0; j < types.length; j++) {
      if (typeof currentElement[types[j]] === 'function') {
        elements.push({
          "node": currentElement,
          "type": types[j],
          "func": currentElement[types[j]].toString()
        });
      }
    }
  }

  return elements.sort(function(a,b) {
    return a.type.localeCompare(b.type);
  });
}
function globalError(message, file, line, column, error) {
    let location = '';
    let cause = 'Error';

    if (!isNull(file)) {
        location = file.split("/");
        location = location[location.length - 1] + '(' + line + ')';
    }
    if (error !== null && error.constructor.name === 'ErrorObject') {
        cause = error.getName();
        message = error.getMessage();
    }
    displayAlert(cause, message + ' at ' + location);
}
function Statistics(enabled) {
    this.start;
    this.id = createUID(3);
    this.logEnabled = enabled === undefined ? getLocalStorage('browserlog') : enabled;

    this.enableLog = function (yes) {
        this.logEnabled = yes;
    };
    this.isEnabled = function () {
        return this.logEnabled;
    };
    this.setStart = function () {
        this.start = new Date();
    };
    this.elapsed = function (asString) {
        let elapsed = new Date() - this.start;

        if (!defaultNull(asString, false))
            return elapsed / 1000;

        let sec = Math.trunc(elapsed / 1000);
        let msec = elapsed % 1000;

        return lpad(sec, 2, ' ') + '.' + lpad(msec, 3, '0') + ' sec ';
    };
    this.log = function (message) {
        if (this.logEnabled)
            console.log(timeString(this.start, true) + ' ' + this.id + ' ' + message);
    };
    this.logElapsed = function (action) {
        this.log(action + ' took ' + this.elapsed(true));
    };
    this.start = new Date();
}
var st = new Statistics();

function Reporter() {
    var messageStore = [];
    var maxStore = 0;

    function output(action, message, noTime) {
        var timedMessage = isNull(noTime) || !noTime ? timeString(null, true) + ' ' + message : message;

        switch (action) {
            case 'log':
                console.log(timedMessage);
                break;
            case 'error':
                console.error(timedMessage);
                throw new ErrorObject(message);
                break;
            case 'store':
                if (maxStore !== 0) {
                    if (messageStore.length >= maxStore)
                        messageStore.length = 0;

                    messageStore.push(timedMessage);
                }
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
    this.logEnabled = getLocalStorage('browserlog');

    this.setFatalAction = function (action) {
        this.fatalAction = action;
    };
    this.fatalError = function (message) {
        output(this.fatalAction, message);
    };
    this.log = function (message, noTime) {
        if (this.logEnabled)
            output('log', message, noTime);
    };
    this.setMaxStore = function (size) {
        maxStore = size;
    };
    this.store = function (message, noTime) {
        if (this.logEnabled)
            output('store', message, noTime);
    };
    this.logThrow = function (exception, showAlert) {
        if (showAlert)
            alert(exception.name + '-' + exception.message);

        console.error(exception);
    };
    this.logStore = function (clear) {
        for (var i = 0; i < messageStore.length; i++)
            this.log('Stored ' + messageStore[i], true);

        if (isNull(clear || clear))
            messageStore.length = 0;
    };
    this.clearStore = function () {
        messageStore.length = 0;
    };
}
var reporter = new Reporter();
/*
 * Provides a front end to reporter that allows a console logs to be grouped to assist in debug and
 * analysis.
 * 
 * Each tracker instance has a unique sequence allocated at construction. This is included in all log reports
 * generated by the tracker. Tracker messages also report the elapsed time in since the tracker was created i
 */
class Tracker {
    static #sequence = 0;

    #store = false;
    #created;
    #seqNo;
    #prefix = '';
    #stats;

    #buildMessage(message) {
        if (this.#prefix !== '')
            message = this.#prefix + ' ' + message;

        message = 'Track seq' + lpad(this.#seqNo, 2, '0') + ' elapsed ' + this.#stats.elapsed(true) + message;
        return message;
    }
    setStore(on) {
        this.#store = on;
    }
    constructor(message, store, prefix) {
        this.#seqNo = Tracker.#sequence += 1;
        this.#created = new Date();
        this.#prefix = defaultNull(prefix, '');
        this.#stats = new Statistics();

        this.setStore(defaultNull(store));

        if (!isNull(message))
            this.log(message);
    }
    setPrefix(prefix) {
        this.#prefix = prefix;
    }
    getSequence() {
        return this.#seqNo;
    }
    getCreated() {
        return this.#created;
    }
    log(message, noTime) {
        if (noTime !== undefined) {
            reporter.fatalError("noTime not implemented");
        }
        message = this.#buildMessage(message);
        reporter.log(message);

        if (this.#store)
            reporter.store(message);
    }
    store(message) {
        reporter.store(this.#buildMessage(message));
    }
}

class elementMover {
    #isDown;
    #stScrX;
    #stScrY;
    #crScrX;
    #crScrY;
    #offsetX;
    #offsetY;
    #tag;
    #elm;

    constructor(tag) {
        this.#tag = tag;
        this.#isDown = false;
    }
    mouseStart(event) {
        this.#isDown = true;
        this.#stScrX = event.screenY;
        this.#stScrY = event.screenY;
        this.#crScrX = event.screenX;
        this.#crScrY = event.screenY;
        this.#offsetX = this.#elm.offsetLeft - event.clientX;
        this.#offsetY = this.#elm.offsetTop - event.clientY;
    }
    ;
            mouseMove(event) {
        if (!this.#isDown)
            return false;

        this.#elm.style.left = (event.clientX + this.#offsetX) + 'px';
        this.#elm.style.top = (event.clientY + this.#offsetY) + 'px';
        this.#crScrX = event.screenX;
        this.#crScrY = event.screenY;
        return true;
    }
    mouseUp() {
        this.#isDown = false;
    }
    mouseClear() {
        this.#isDown = false;
    }
    move(event) {
        var result = true;

        event.preventDefault();
        this.#elm = event.currentTarget;

        switch (event.type) {
            case 'mousedown':
                trace(event, true);
                result = this.mouseStart(event);
                break;
            case 'mousemove':
                result = this.mouseMove(event);

                if (result)
                    traceAlertDiv(false);

                trace(event, false);
                break;
            case 'mouseup':
                result = this.mouseUp();
                break;
            case 'mouseout':
                break;
            default:
                alert(event.type);
        }
        return result;
    }
}
/*
 * Returns true if object is undefined or null;
 */
function isNull(object) {
    return object === undefined || object === null;
}
/*
 * 
 * value    Value to be tested for null.
 * defValue Value to be returned if value is null. If it is undefined, null is returned.
 */
function defaultNull(value, defValue) {
    if (!isNull(value))
        return value;

    return isNull(defValue) ? null : defValue;
}
/*
 * selector  CSS selector identifying the required elements.
 * nameAsKey If true or undefined the elements name attribute is the map key, otherwise the element id is used.
 * 
 * @returns a map of the selected elements, with the key determined by nameAsKey and the element as the value.
 */
function getElements(selector, nameAsKey) {
    let map = new Map();
    let elms = document.querySelectorAll(selector);

    if (isNull(nameAsKey))
        nameAsKey = true;

    for (let i = 0; i < elms.length; i++) {
        map.set(nameAsKey ? elms[i].name : elms[i].id, elms[i]);
    }
    return map;
}
/*
 * elementMap Map of the input elements providing the parameter
 * exclude    A comma separated list element map keys that are not to be cleared. Can be undefined.
 * 
 * Clears the value of the target elements.
 */
function clearValues(elementMap, exclude) {
    exclude = defaultNull(exclude) + ',';
    /*
     * , is added to the list to ensure that keys that match the start of another, do not matches the field with
     * the larger key.
     */
    for (let [key, element] of elementMap) {
        if (exclude.includes(key + ','))
            continue;
        /*
         * Probably need to allow other element types.
         */
        if (element.type === 'checkbox')
            element.checked = false;
        else
            element.value = '';
    }
}
/*
 * Returns the first element in the parent chain of element that has parentTag.
 * 
 * If parentTag is undefined, the immediate parent is returned.
 * 
 * @returns parent element if found, otherwise null.
 */
function getElementParent(element, match, use) {
    element = getElement(element);
    match   = defaultNull(match, '');
    use     = defaultNull(use, 'name');
    
    
    while (element !== null && element.parentElement !== null) {
        let test = null;
        
        element = element.parentElement;
            
        if (match === '') return element;
        
        switch (use.toLowerCase()) {
            case 'id':
                test = element.id;
                break;
            case 'name':
                test = element.getAttribute('name');
                break;
            case 'tagname':
                test = element.tagName;
                break;
            default:
        }        
        if (test !== null && test.toLowerCase() === match.toLowerCase()) return element;
    }
    return null;
}
function getParameters(id) {
    return getElements('#' + id + ' :is(select:not(.notparam), checkbox:not(.notparam), input:not(.notparam), textarea');
}

function screenFieldsOptions(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'screenFields');
    this.addSpec({name: 'mustExist', type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'setKey',    type: 'boolean', default: false, mandatory: false});
    this.clear();
    this.load(pOptions, false);
}
class ScreenFields {
    #fields;
    #id;
    #formatter = null;
    /*
     * Field names are usually the database column name where the value will be stored. The field name can be followed
     * by the type separated by ~. This type overrides the database column type. 
     * 
     * This is typically used where the database field is a timestamp stored in 2 screen fields; one for date and
     * one for time, e.g. Start~Date and Start~time.
     * 
     * name is the screen field name.
     * 
     * Returns {name: name, type: type} type: is null if there is no type appended to the name.
     */
    static splitName(name) {
        let fields = name.split('~');
        
        return {
            name: fields[0],
            type: fields.length > 1? fields[1] : null       
        };
    }
    format(get, name, value) {
        return this.#formatter === null? value : this.#formatter(get, name, value);
    }
    /*
     * elementid The element id of the element providing, see getParameters.
     * formatter Function used to format the value passed to setValue and returned by getValue.
     *           The function must have the following parameters:
     *           - Get    True if getValue and false is setValue.
     *           - Name   The field name being acted on.
     *           - Value  The field value.
     *           
     *           The function must return the field value. If there is no format to be applied to value
     *           it must return the passed in value.
     *           
     * @returns {ScreenFields}
     */
    constructor(elementid, formatter) {
        this.#id        = elementid;
        this.#fields    = getParameters(elementid);
        this.#formatter = defaultNull(formatter, null);

        if (isNull(this.#fields))
            throw 'Element ' + elementid + ' passed to screenFields does not exist';
    }
    get(field, mustExist) {
        let elm = this.#fields.get(field);
        
        if (elm === undefined) elm = this.#fields.get(field + '~Date');
        
        if (defaultNull(mustExist, false) && elm === undefined)
            throw 'Field ' + field + ' not found in screenFields ' + this.#id;
        
        return elm;
    }
    getValue(field) {
        let elm = this.#fields.get(field);
        
        if (elm !== undefined) return this.format(true, field, elm.value);
        
        elm = this.get(field + '~Date');        
        
        if (elm !== undefined) {
            let tme = this.get(field + '~Time');            
            
            return elm.value === '' && tme.value === '' ? '' : toDate(elm.value + ' ' + tme.value);
        }        
        return undefined;
    }
    setReadOnly(field, on) {
        let elm = this.#fields.get(field);
        
        if (elm !== undefined) {
            elm.readOnly = on;
        } else {
            elm = this.get(field + '~Date');
            
            if (elm !== undefined) {
                elm.readOnly = on;
                
                let telm = this.get(field + '~Time');
                
                if (telm !== undefined) telm.readOnly = on;
            }
        }
        if (elm === undefined) throw 'Field ' + field + ' passed to setReadOnly does not exist';;
    }
    setValue(field, value, mustExist) {
        let found = false;

        function loadValue(obj, name, value) {
            let elm = obj.#fields.get(name);

            if (elm !== undefined) {
                elm.value = obj.format(false, name, value);
                found = true;
            }
        }
        function loadTime(obj, date, time, value) {
            let dVal   = '';
            let tVal   = '';
            let fields = (value instanceof Date? dateTimeString(value) : value).split(" ");
            
            switch (fields.length) {
                case 1:
                    break;
                case 2:
                    dVal = fields[0];
                    tVal = fields[1];
                    break;
                default:
                    throw 'Timestamp is-' + value + '- but should have a date and hour. Loading ScreenFields ' + obj.#id + ' field ' + field;
            }
            loadValue(obj, date, dVal);
            
            if (found) {
                found = false;
                loadValue(obj, time, tVal);
            }
        }        
        loadValue(this, field, value);

        if (!found && field === 'Timestamp') loadTime(this, field + 'Date', field + 'Time', value);
        if (!found && this.#fields.get(field + '~Date') !== undefined) loadTime(this, field + '~Date', field + '~Time', value);
               
        if (!found && defaultNull(mustExist, true))
            throw 'Field ' + field + ' is not present in ScreenFields ' + this.#id;

        return found;
    }
    getFields() {
        return this.#fields;
    }
    clear(exclude) {
        clearValues(this.#fields, exclude);
    }
    /*
     * name     Screen field name to ba checked.
     * required If true or undefined the field must have a none space value.
     * 
     * The check for most fields is that the field satifisfies the required setting. 
     * For the date time paired fields the validity of the date time value is checked.
     * 
     * It may make sense the validity of other fields, e.g. a number should be a valid number. This would
     * could be done by using the element type. However, I don't like the behaviour associcate with type, 
     * e.g. setting type to number sets the increment arrows to right of field and does not allow you
     * to set the field size. In any event on events are generally used to check characters on entry.
     * 
     * Returns a structure with the fields valid and value. 
     *      valid is true if the field has a non space value or is not required.
     *      value is the field value.
     */
    checkValue(name, required) {
        let elm   = this.get(name, true);
        let valid = fieldHasValue(this.get(name), required) || !required;
        let value = this.getValue(name);
        
        if (elm !== undefined) {            
            if (this.#fields.get(name + '~Date') !== undefined)
                valid = validateDateTime(this.get(name + '~Date'), this.get(name + '~Time'));
        }
        return {valid: valid, value: value};
    }
    hasValue(name, required) {
        return fieldHasValue(this.get(name), required);
    }
    isValid(table, filter) {
        for (let [name, element] of this.#fields) {            
            if (!isNull(filter) && getElementParent(element, filter, 'name') === null) continue;
            
            if (!table.checkElement(element)) return false;
        }
        return true;
    }
    setHandler(element, event, handler, replace) {
        let elmHandler = element.getAttribute('on' + event);
        
        if (elmHandler !== null && !defaultNull(replace, false)) return;
        
        element.setAttribute('on' + event, handler);
    }
    syncWithTable(tabStr, replaceEventHandler) {
        let table = eval(tabStr);
        
        for (let [name, element] of this.#fields) {
            let nt  = ScreenFields.splitName(name);            
            let col = table.getColumn(nt.name, false);
            
            if (col === null) continue;
            
            nt.type = (nt.type === null? col.getAttribute('type') : nt.type).toUpperCase();

            switch (nt.type) {
                case 'DATETIME':
                case 'DATE':
                case 'TIME':
                    this.setHandler(element, 'change', tabStr + '.checkElement();', replaceEventHandler);
                    break;
                case 'INT':
                case 'FLOAT':
                case 'DECIMAL':
                    if (element.getAttribute('type').toLowerCase() === 'text')
                        this.setHandler(element, 'keypress', 'allowedInNumberField()', replaceEventHandler);
                    break;
                default:
                    console.log('Column ' + nt.name + ' type ' + nt.type);
            }
        }
        
    }  
    
    loadJSON(json, mustExist) {
        for (let i = 0; i < json.getMemberCount(); i++) {
            let value = json.getMember(i);
            this.setValue(value.name, value.value, mustExist);
        }
    }
}
/*
 * object can be one of the following:
 *  Object         Element
 *  undefined    event.target
 *  null              "
 *  empty string      "
 *  string       Element id for object string or null if no element for object
 *  otherwise    object
 *  
 * withValue     undefined or false element is returned, otherwise returns a structure, with the element, its value as a string which is
 *               empty if value element value is undefined and empty set to true if value is the empty string.
 */
function getElement(object, withValue) {
    let elm = object;

    if (isNull(object) || typeof object === 'string' && trim(object) === '') {
        /*
         * This is unsafe and the use of the global windows event is deprecated.
         * 
         * Log for now and consider making this an error.
         */        
        console.log('getElement called with null object');
        elm = event.target;
    } else if (object instanceof Event)
        elm = object.target;
    else if (typeof object === 'string') {
        elm = document.getElementById(object);
    } else {
        /*
         * Object should be an element. Perhaps should check this.
         */
    }
    let val = elm === null || elm.value === undefined ? "" : trim(elm.value);

    if (withValue === undefined || !withValue) return elm;

    return {
        elm: elm,
        value: val,
        empty: val.length === 0
    };
}
/*
 * Copies the value element source to element target. If target element value is that
 * returned by the checked attribute. It is assumed, but not checked, that the source and targat have
 * compatible types, e.g. if target is a checkbox, then so must source be.
 */
function copyElement(source, target) {
    target = getElement(target);
    source = getElement(source);

    if (target.type === 'checkbox')
        target.checked = source.checked;
    else
        target.value = source.value;
}
/*
 * Return true element or any of its parents is disabled.
 */
function isDisabled(element) {
    while (!isNull(element)) {
        let disabled = element.disabled;

        if (disabled !== undefined && disabled)
            return true;

        element = element.parentNode;
    }
    return false;
}
/*
 * Returns the root to be prefixed to relative href file names.
 * 
 * If there is a base element its href value is returned.
 * 
 * Otherwise, it is derived from window.location.href by strip off the field following the final /
 * which is the html file name. This will provide the correct result, provided thehtml file is at the
 * same location as the resourse folders.
 */
function getFileRoot() {
    let base = document.getElementsByTagName('base');
    let baseURI;

    if (base.length !== 0)
        baseURI = base[0].href;
    else {
        let flds = window.location.href.split("/");

        delete flds[flds.length - 1];
        baseURI = flds.join("/");
    }
    return baseURI;
}
function addStyleSheetToiFrame(iFrame, file) {
    iFrame = getElement(iFrame);

    let frameDoc = (iFrame.contentWindow || iFrame.contentDocument).document;
    let links = frameDoc.getElementsByTagName('link');
    let link;

    file = getFileRoot() + file;
    /*
     * Check to see if link already present and return if it is.
     * 
     * Note: Adding the link more than once does not seem to cause a problem.
     */
    for (var i = 0; i < links.length; i++) {
        if (links[i].href === file)
            return;
    }

    link = document.createElement("link");
    link.href = file;
    link.rel = "stylesheet";
    link.type = "text/css";

    frameDoc.head.appendChild(link);
}
/*
 * Returns an array of the elements children. If tagName is defined only children with tagName are returned.
 */
function getChildren(element, tagName) {
    let children = [];

    for (let i = 0; i < element.childElementCount; i++) {
        if (tagName === undefined || element.children[i].tagName === tagName) {
            children.push(element.children[i]);
        }
    }
    return children;
}
function removeChildren(element) {
    element = getElement(element);

    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
}
/*
 * This performs the same as getElementsByTagName. 
 * 
 * If exclude is not undefined, elements that equal exclude or are children of it
 * are removed from the elements array.
 */
function getElementsByTag(name, exclude) {
    let elms = [...document.getElementsByTagName(name)];

    if (exclude !== undefined && exclude !== null) {
        elms = elms.filter(function (elm) {
            return !(exclude === elm || exclude.contains(elm));
        });
    }
    return elms;
}
function ErrorObject(name, message) {
    this.name = name;
    this.message = message;

    this.getName = function () {
        return this.name;
    };
    this.getMessage = function () {
        return this.message;
    };
    if (message === undefined) {
        this.message = name;
        this.name = '';
    }
}
function removeURLPath(url) {
    return url.split('/').pop();
}
function randomString(len) {
    let s = '';

    let randomchar = function () {
        let n = Math.floor(Math.random() * 62);

        if (n < 10)
            return n; //1-10
        if (n < 36)
            return String.fromCharCode(n + 55); //A-Z
        return String.fromCharCode(n + 61); //a-z
    };
    while (s.length < len)
        s += randomchar();
    return s;
}
/*
 * Returns the computed style property for element. If property is not given all properties are returned.
 */
function readComputedStyle(element, property) {
    const cs = window.getComputedStyle(element, null);
    let style = '';
    /*
     * According to Mozilla, getPropertyValue only works reliably with long hand property names such as font-style.
     * 
     * Short hand property names, such as font, depend on the browser. For chrome, font returns a string
     * containing all the long hand property names that don't have the default value.
     * 
     * This implementation expands font to explicitly expand all font related short hand property names
     * and should work for all browsers.
     * 
     * This is only ever called with font and would have to be modified to support other short hand
     * property names.
     */
    if (isNull(property) || property === '')
        return cs;
    else {
        let props = [property];

        if (property === 'font') {
            props[0] = 'font-style';
            props[1] = 'font-variant';
            props[2] = 'font-weight';
            props[3] = 'font-size';
            props[4] = 'font-family';
        }
        for (let i = 0; i < props.length; i++) {
            let prop = cs.getPropertyValue(props[i]);

            if (prop === 'normal')
                continue;

            if (style.length !== 0)
                style += ' ';

            style += cs.getPropertyValue(props[i]);
        }
    }
    return style;
}
/*
 * Returns the px size required to display text using font. If font is not passed, the default font is used.
 * 
 * adjustText can be set to true to try to overcome some inaccuracies in the canvas.measureText value returned.
 * 
 * The chrome implementation does not seem to handle some characters correctly and returns a measure that
 * is too small. This has been noticed for the chacters . and -, there are likely to be others too. Setting
 * adjustText substitutes these characters with w. This is likely to be larger than needed, but should ensure
 * header aligns with table body column.
 */
function displayTextWidth(text, font, adjustText) {
    /*
     * Not entirely sure what following does, but I think it prevents a canvas element being
     * created each time the function is called.
     */
    const canvas = displayTextWidth.canvas || (displayTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");

    if (!isNull(font))
        context.font = font;
    /*
     * The following is a workaround. Numbers containing a decimal point seem to return a measure that is too
     * small. So replace the . with 0.
     */
    if (!isNull(adjustText) && adjustText)
        text = text.replace(/\.|\-/g, 'w');

    const metrics = context.measureText(text);
    /*
     * https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics suggest that using the following may
     * give a more accurate value than metrics.width.
     * 
     * Have found that rounding up, gives a larger value, and reduces the occassions where table rows and header
     * don't align precisely. Seem to have more of an alignment problem with narrow columns.
     * 
     * Need to investigate this further.
     */
    return Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
}
function camelToWords(text) {
    let words = '';
    let ch;

    for (let i = 0; i < text.length; i++) {
        ch = text.charAt(i);

        if (i > 0 && ch === ch.toUpperCase())
            words += ' ';

        words += ch;
    }
    return words;
}
function lpad(text, length, pad) {
    if (isNull(text))
        text = '';

    text = text.toString();

    while (text.length < length)
        text = (pad === undefined ? ' ' : pad) + text;

    return text;
}
function rpad(text, length, pad) {
    if (isNull(text))
        text = '';

    text = text.toString();

    while (text.length < length)
        text = text + (pad === undefined ? ' ' : pad);

    return text;
}
function toNumber(text, low, high) {
    if (isNaN(text))
        throw text + " is not numeric";

    if (text < low || text > high && high !== undefined)
        throw text + " is not in the range " + low + " to " + high;

    return parseInt(text);
}
/*
 * 
 * @param time String of the form hh:mm:ss, hh:mm or hh. Spaces and leading zeros are ignored. 
 *             The time field must be in the correect range, i.e hh must be 0 to 23.
 * @returns An array of three integers with the time fields, with index 0 being the hours
 * 
 * Throws an exception if the time is invalid.
 */
function toTime(time) {
    time = time.split(":");

    try {
        if (time.length === 1)
            time[1] = '0'; // Note: this extends the array and sets minutes to 0.
        if (time.length === 2)
            time[2] = '0';
        if (time.length > 3)
            throw "Invalid time format - too many fields";
        /*
         * Validete and convert time fields to numberic.
         */
        for (let i = 0; i < time.length; ++i) {
            time[i] = time[i].trim() === "" ? 0 : toNumber(time[i], 0, i === 0 ? 23 : 59);
        }
    } catch (err) {
        throw new ErrorObject('Time', err);
    }
    return time;
}
/*
 * This converts a timestamp as defined as defined below and returns a Date object with timestamp converted to local time.
 * 
 * This will the same as would be returned by new Date for the normalised value of timestamp. However there is a difference in error checking,
 * e.g. for 31-Jun-2001 new Date('31-Jun-2001') will return the same as new Date(1-Jul-2001', whereas this code will throw an ErrorObject
 * exception.
 * 
 * Note: If a Date is passed as timestamp, it will be returned, i.e. the notime parameter will have no effect.
 * 
 * timestamp is a date string with optionally a time string following separated by a space.
 *           A date string is of the form dd/mm/yy. The separator can also be -. The mm can be a month number or a 3 character
 *           month name. dd is more than 2 digits, it taken to be a year and is swapped with yy. The date can be optionally followed by 
 *           a space separated time field of up three integers separated by : in the order hours, minutes and seconds.
 *           
 *           The following are valid examples with their normalised equivalents:
 *           
 *             Value              Normalised
 *             1/2/20             01-Feb-2020 00:00:00
 *             2/3/1980 10        02-Mar-1980 10:00:00
 *             2001/4/1 23:59     01-Apr-2001 23:59:00
 *             2/ 3 / 20  11 : 20 02-Mar-2020 11:20:00
 *             
 * notime    indicates if the string should not have a time string following the date. If not undefined and true then an error
 *           is reported if there is a time string.
 *           
 * Throws an ErrorObject exception if timestamp does not yield a valid Date object. getName() will be 'Time' if the time is invalid and
 * 'Date' otherwise. The message describes the validation failure.
 */
function toDate(timestamp, notime) {
    if (timestamp === undefined || timestamp === null || timestamp === '')
        return new Date();
    if (timestamp instanceof Date)
        return timestamp;

    let date    = timestamp.split(new RegExp("[/\-]"));
    let time    = new Array(0, 0, 0);
    let errName = "Date";

    try {
        if (date.length !== 3)
            throw "Invalid date format";
        /*
         * Check to see if the date is followed by a time field. First remove any leading spaces from the final date field.
         */
        date[2] = trim(date[2]);

        let i = date[2].indexOf(' ');

        if (i !== -1) {
            /*
             * There is a time field.
             */
            errName = "Time";

            if (notime !== undefined && notime)
                throw "Time present in date only field";

            time = toTime(date[2].substring(i + 1));
            date[2] = date[2].substring(0, i);
        }
        errName = "Date";

        date[0] = toNumber(date[0]);
        date[1] = trim(date[1]);
        date[2] = toNumber(date[2]);

        if (date[0] > 99) {
            /*
             * If first field is more than 2 digits, assume it is the year and swap with date[2]
             */
            let y = date[0];

            date[0] = date[2];
            date[2] = y;
        }
        if (date[2] < 100)
            date[2] += 2000;

        for (let i = 0; i < months.length; i++) {
            if (months[i].toLowerCase() === date[1].toLowerCase()) {
                date[1] = i + 1;
                break;
            }
        }
        date[1] = toNumber(date[1]) - 1;
        /*
         * The following used to use new Date() to create the initial time. However, this caused an issue
         * with the time field validation below. A problem arises if the current day number is 30 or 31 and
         * the current month has 30 days or more, e.g. 2021-01-31. If the date being validated is for Sep,
         * setting the month to Sep e.g 2021-09-31 will change the date to 2021 -10-03, because the date object
         * always allows a day number in the range 1 to 31 and if that is not valid for the month it steps
         * to the month and changes the number to start of the, i.e. for the above 31-28. 
         * 
         * The following ensures that setting the fields in the order year, month, day will not cause the
         * initial values to cause overflow to the next field. Entering 2021-09-31 will cause the date to
         * change to 2021-10-03 when the day number is set and the validation will correctly fail this as
         * an invalid date.
         */
        let datetime = new Date('1901-01-01');

        datetime.setFullYear(date[2]);
        datetime.setMonth(date[1]);
        datetime.setDate(date[0]);
        datetime.setHours(time[0], time[1], time[2], 0);
        /*
         * The above set functions updates the next field if the value is out of range for the current one, e.g. 2022 08 33
         * results in 2022 09 2. Read back the fields to check the values have not changed. This is not necessary for the time
         * fields as they have already been checked to be in the correct range.
         */
        if (datetime.getFullYear() !== date[2] || datetime.getMonth() !== date[1] || datetime.getDate() !== date[0])
            throw "Invalid date format";

        if (isNaN(datetime.getTime()))
            throw "Invalid datetime format";

        return datetime;
    } catch (err) {
        if (err instanceof ErrorObject)
            throw err;
        /*
         * If the exception is not an ErrorObject convert it to one.
         */
        throw new ErrorObject(errName, err);
    }
}
function validateDateTimeOptions(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'validateDateTime');
    this.addSpec({name: 'required',  type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'normalise', type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'notime',    type: 'boolean', default: false, mandatory: false});

    this.clear();
    this.load(pOptions, false);
}
function validateDateTime(did, tid, options) {
    let timestamp = '';
    let tm = null;
    let opts = new validateDateTimeOptions(options);
    let result = {
        valid: false,
        value: undefined,
        empty: true
    };
    let dt = getElement(did, true);
    tm = tid !== undefined && tid !== null ? getElement(tid, true) : {elm: null, value: '', empty: true};
    result.empty = dt.empty;

    if (!tm.empty && dt.empty && tm.elm !== null) {
        displayAlert('Validation Error', 'Date must be given if time is', {focus: dt.elm});
        return result;
    }
    if (opts.required) {
        if (dt.empty) {
            displayAlert('Field Validation', "Enter a value for " + getElementLabel(dt.elm), {focus: dt.elm});
            return result;
        }
        if (tm.empty && tm.elm !== null) {
            displayAlert('Field Validation', "Enter a value for " + getElementLabel(tm.elm), {focus: tm.elm});
            return result;
        }
    }
    timestamp = trim(dt.value + ' ' + tm.value);

    if (timestamp === '') {
        result.valid = true;
        return result;
    }

    try {
        result.value = toDate(timestamp, opts.notime);

        if (tm.elm === null && opts.notime) {
            /*
             * In this the date field should no have the time appended
             */
        }
        result.valid = true;

        if (opts.normalise) {
            if (tm.elm !== null) {
                /*
                 * Date and time are in separate fields
                 */
                dt.elm.value = dateString(result.value);
                tm.elm.value = timeString(result.value);
            } else
                dt.elm.value = opts.notime ? dateString(result.value) : dateTimeString(result.value);
        }
    } catch (e) {
        var elm = e.getName() === 'Time' && tm.elm !== null ? tm.elm : dt.elm;

        displayAlert('Field Error', e.message + " on " + getElementLabel(elm), {focus: elm});
    }
    return result;
}
/*
 * 
 * Date    timestamp The date to be incremented.
 * String  interval  The increment interval can be Days, Hours, Minutes or Sceonds.
 * Integer increment The number of increments to be added or subtracted from timedtamp.
 * 
 * @returns timestamp
 * 
 * 
 */
function incrementDateTime(timestamp, interval, increment) {
    let mult = 1000;
    
    if (typeof timestamp === 'string' || typeof timestamp === 'number') timestamp = new Date(timestamp);
    
    switch (interval.toLowerCase()) {
        case "days":
            mult *= 24;
        case "hours":
            mult *= 60;      
        case "minutes":
            mult *= 60;
        case "seconds":
            mult *= 1;
            break;
        default:
            throw new ErrorObject('Code Error', 'Interval ' + interval + ' is invalid');
    }
    timestamp.setTime(timestamp.getTime() + mult * increment);
    
    return timestamp;
}
function secondsToTime(seconds) {
    var div = 24 * 60 * 60;
    var flds = [0, 0, 0, 0];
    var time = '';

    seconds = Math.round(seconds);

    for (let i = 0; i <= 3; i++) {
        flds[i] = Math.floor(seconds / div);

        if (time === '' & flds[i] !== 0)
            time = '' + flds[i];
        else if (time !== '')
            time += ':' + lpad('' + flds[i], 2, '0');

        seconds = seconds % div;
        div = div / (i === 0 ? 24 : 60);
    }
    return time;
}
function dateDiff(from, to, units) {
    var scale;

    if (units === undefined)
        units = 'Seconds';

    switch (units.toLowerCase()) {
        case 'ms':
            scale = 1;
            break;
        case 'seconds':
            scale = 1000.0;
            break;
        case 'minutes':
            scale = 60000.0;
            break;
        case 'hours':
            scale = 60 * 60000.0;
            break;
        case 'days':
            scale = 24 * 60 * 60000.0;
            break;
        default:
            reporter.fatalError('dateDiff interval ' + units + ' is invalid');
    }
    return (toDate(to).getTime() - toDate(from).getTime()) / scale;
}
function dateString(date) {
    var fields = date.toString().split(" ");

    return lpad(fields[2], 2, "0") + "-" + fields[1] + "-" + fields[3];
}
/*
 * 
 * @param source Either a Date object or an array of the integer values of hours, minutes and seconds.
 * 
 * @returns Time string of the form hh:mm:ss, where hh is 0 to 23.
 */
function timeString(source, milliseconds) {
    var time;

    if (source === null || source === undefined)
        source = new Date();

    if (typeof source === 'String')
        source = toDate(source);

    if (source instanceof Date)
        time = source.toString().split(" ")[4];
    else
        time = lpad(source[0], 2, '0') + ':' + lpad(source[1], 2, '0') + ':' + lpad(source[2], 2, '0');

    if (milliseconds !== undefined && milliseconds)
        time += '.' + lpad(source.getMilliseconds(), 3, '0');

    return time;
}
function dateTimeString(date) {
    return dateString(date) + ' ' + timeString(date);
}
function getDateTime(date) {
    if (date === null || date === undefined)
        date = new Date();

    return dateTimeString(toDate(date));
}
function getDayText(date, long) {
    let value = 'Invalid';
    let day   = typeof date !== 'number'? toDate(date).getDay() : date;

    switch (day) {
        case 0:
            value = 'Sunday';
            break;
        case 1:
            value = 'Monday';
            break;
        case 2:
            value = 'Tuesday';
            break;
        case 3:
            value = 'Wednesday';
            break;
        case 4:
            value = 'Thursday';
            break;
        case 5:
            value = 'Friday';
            break;
        case 6:
            value = 'Saturday';
            break;
        default:
            return value;
    }
    if (long === undefined || !long)
        return value.substring(0, 3);

    return value;
}
/*
 * timestamp as either a Date or a String. If a string, it is converted to a Date object.
 * 
 * Returns an object containing the date parts.
 */
function unpackDate(timestamp) {
    if (typeof timestamp === 'string') timestamp = toDate(timestamp);
    
    return {
        year:    timestamp.getFullYear(),
        month:   timestamp.getMonth() + 1,
        day:     timestamp.getDay(),
        date:    timestamp.getDate(),
        hours:   timestamp.getHours(),
        minutes: timestamp.getMinutes(),
        seconds: timestamp.getSeconds()};
}
/*
 * 
 * date   The date object or string to be formatted. If a string it is converted to a date object
 * @param The format specification of the way date is to be converted to a string. This is a subset of 
 *        the Java SimpleDateFormat format specifiers, in particular y, M, d, E, H, m amd s.
 *        
 * @returns String with date formatted as to specifiers.
 */
function formatDate(date, format) {
    let fdate = '';
    let udate = unpackDate(date);
    let i     = 0;
    let fdesc = '';
    
    function addField() {
        let fd = fdesc.charAt(0);
        let sz = fdesc.length;
        let dfld;
        
        switch (fd) {
            case 'y':
                dfld = udate.year;
                
                if (sz <= 2) {
                    dfld = dfld % 100;
                    sz   = 2;
                }
                break;
            case 'M':
                dfld = sz === 3? months[udate.month - 1] : udate.month;
                break;
            case 'd':
                dfld = udate.date;
                break;
            case 'E':
                dfld = getDayText(udate.day, false);
                break;
            case 'H':
                dfld = udate.hours;
                break;
            case 'm':
                dfld = udate.minutes;
                sz = 2;
                break;
            case 's':
                dfld = udate.seconds;
                sz = 2;
                break;
            default:
                throw new ErrorObject('Code Error', 'Date format descriptor ' + fd + ' is invalid');                
        }
        if (typeof dfld === 'number') dfld = lpad(dfld, sz, '0');
        
        fdate += dfld;
        fdesc = '';
    }
    while (i < format.length) {
        let ch = format.charAt(i);
        let rex = /[a-z]/i;
        
        if (rex.test(ch)) {
            if (fdesc.length !== 0 && fdesc.charAt(0) !== ch) {
                addField();
                fdesc += ch;
            } else
                fdesc += ch;
        } else {
            addField();
            fdate += ch;            
        }
        i++;
    }
    addField();
    
    return fdate;
}
function displayFieldError(elm, message) {
    elm = getElement(elm);
    displayAlert('Field Validation', 'Field ' + getElementLabel(elm) + ' ' + message, {focus: elm});
}
/*
 * args  An array of input screen elements.
 * 
 * The elements must all have a value or all not have a value. If they satisfy requirement true is is return
 * if they all have a value and false if none have a value.
 * 
 * If this requirement is not satisfied null is returned and an error message is displayed for the element.
 * 
 * The message is
 *  Validation failure for ErrorName is required as one has been supplied for FirstName.
 *  
 *  ErrorName is the label of the first field without a value and FirstName is the label of the first field
 *  with a value.
 *  
 *  Only the first empty field is reported. 
 */
function valuesAllOrNone(...args) {
    let notEmpty = null;
    let empty = null;
    let firstName = null;
    /*
     * Examine arguments to see is they have values or not. On completion of the loop,
     * notEmpty will be true if any arguments have a value and empty will if any arguments don't have a value.
     */
    for (let arg of args) {
        let argtst = getValue(arg) !== '';
        if (argtst) {
            if (firstName === null)
                firstName = getElementLabel(arg);

            notEmpty = true;
        } else
            empty = true;
    }
    /*
     * Return true if all arguments have a value, or all arguments don't have a value.
     */
    if (empty === null || notEmpty === null)
        return notEmpty === true;
    /*
     * Repeat loop and report error for all arguments that don't have a value
     */
    for (let arg of args) {
        if (getValue(arg) === '') {

            displayFieldError(arg, 'requires a value as one has been supplied for ' + firstName);
            break
        }
    }
    return null;
}
/*
 * elm       Html element containing the date to be checked.
 * required  If true a field error is reported if the element value is empty.
 * setYear   If true or undefinded and the elm.value does not have a year field, i.e. only has day and month, the current
 *           year is appended separated by /.
 * weekdayId If not undefined identified an element the value of which is set the 3 character weekday name
 *           the of the validated elm.
 *          
 * Returns true and element value is a valid date, otherwise, a field error is reported and false is reported.
 * 
 *          If the value is valid, it is normalised to dd-mmm-yyyy.         
 */
function checkDate(elm, required, setYear, weekdayId) {
    if (defaultNull(setYear, true)) {
        elm = getElement(elm);
        let flds = elm.value.split(new RegExp("[/\-]"));
        
        if (flds.length === 2) {
            elm.value += '/' + (new Date()).getFullYear();
        }
    }
    if (validateDateTime(elm, null, {required: required, notime: true}).valid) {        
        if (!isNull(weekdayId)) {
            getElement(weekdayId).value = formatDate(elm.value, 'E');            
        }
        return true;
    }
    return false;
}
function checkTime(elm, required) {
    var ok = false;

    elm = getElement(elm);

    if (fieldHasValue(elm, required)) {
        try {
            var t = toTime(elm.value);
            elm.value = timeString(t);
            ok = true;
        } catch (err) {
            displayAlert('Validation Error', err.message, {focus: elm});
        }
    } else
        ok = true;

    return ok;
}
function checkTimestamp(elm, required) {
    return validateDateTime(elm, null, {required: required}).valid;
}
function checkDateTime(did, tid, required) {
    return validateDateTime(did, tid, {required: required}).valid;
}
function triggerClick(element) {
    var event;

    if (platform.name === 'IE') {
        event = document.createEvent("MouseEvents");
        event.initMouseEvent("click", true, true, "window", 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    } else {
        event = new MouseEvent('click', {
            view: window,
            bubbles: true});
    }
    getElement(element).dispatchEvent(event);
}
function setAttribute(element, id, value) {
    var name = id;

    if (typeof id !== 'string') {
        name = value;
        value = id[name];
    }
    if (value !== undefined)
        element.setAttribute(name, value);
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

        if (value === undefined)
            continue;  //Ignore options with undefined values;

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
function setLocalStorage(id, value) {
    if (value === undefined || value === null)
        localStorage.removeItem(id);
    else
        localStorage.setItem(id, value);
}
function getLocalStorage(id) {
    let val = localStorage.getItem(id);

    if (val === 'true')
        return true;
    if (val === 'false')
        return false;

    return val;
}
function createUID(length, prefix) {
    return (prefix === undefined ? '' : prefix) + randomString(length);
}
class Timer {
    #target;
    #intId;
    #startTime;
    #format;
    #maxGap;
    
    constructor(target, format) {
        this.#target = target;
        this.#format = defaultNull(format, false);
    }
    set maxGap(seconds) {
        this.#maxGap = seconds;        
    }
    get maxGap() {
        return this.#maxGap;
    }
    updateTimer() {
        if (this.#target !== undefined && this.#target.value !== '') {
            let gap = Math.round(dateDiff(this.#startTime, null));

            if (gap === 0) return;
            
            if (this.#maxGap !== null && gap > this.#maxGap) {
                this.stop();
                return;
            }
            this.#target.value = this.#format ? secondsToTime(gap) : gap;
        }
    };
    start(time) {
        if (isNull(this.#intId)) this.#intId = setInterval(this.updateTimer.bind(this), 1000);

        this.#target.value = 0;
        this.#startTime = isNull(time)? new Date() : time;
    };
    stop() {
        if (!isNull(this.#intId)) {
            clearInterval(this.#intId);
            this.#intId = null;
        }
        this.#target.value = '';
        this.#startTime = new Date();
    };
}
/*
 * The following 2 function provide a workaround for the older versions of javascript that don't support the constuctor object element.
 */
function getObjectName(obj) {
    var name = obj.constructor.name;

    return name === undefined ? obj.fixedName : name;
}
function setObjectName(obj, name) {
    if (obj.constructor.name === undefined)
        obj['fixedName'] = name;
}
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
    this.optSpecs = [];
    this.accessByGet = pAccessByGet;
    this.used = false;

    function error(options, message) {
        reporter.fatalError(getObjectName(options) + ' ' + message);
    }
    function getSpec(options, name, mustExist) {
        for (let i = 0; i < options.optSpecs.length; i++) {
            if (options.optSpecs[i].name === name)
                return options.optSpecs[i];
        }
        if (!isNull(mustExist) && mustExist)
            error(options, 'Option "' + name + '" is not defined');

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
     * @param loaded  If true, indicates the value is from load, i.e. not from applying the default. 
     *                If present and true, spec.loaded is set to true.
     * 
     * @returns The current value of the option.
     */
    function accessValue(options, name, read, value, loaded) {
        let spec = getSpec(options, name, true);

        if (spec === null)
            return;

        if (!isNull(loaded) && loaded)
            spec.loaded = true;

        if (read) {
            value = options.accessByGet ? spec.value : options[name];
        } else {
            if (value === null && spec.mandatory)
                error(options, name + ' is mandatory and cannot be set to null');
            /*
             * Allow undefined, load check will validate that null values are errored, if not loaded with a value.
             */
            if (value === undefined)
                value = null;

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
        accessValue(options, name, false, value, true);
    }
    this.setValue = function (name, value) {
        accessValue(this, name, false, value);
    };
    this.getValue = function (name) {
        return accessValue(this, name, true);
    };
    this.isLoaded = function (name) {
        return getSpec(this, name, true).loaded;
    };
    this.getUsed = function (name) {
        return (isNull(name) ? this.used : getSpec(this, name, true).used);
    };
    this.setUsed = function (name, used) {
        if (typeof name === 'string')
            getSpec(this, name, true).used = used;
        else
            this.used = name;
    };
    this.clear = function () {
        for (let i = 0; i < this.optSpecs.length; i++) {
            var spec = this.optSpecs[i];

            accessValue(this, spec.name, false, spec.default);
            spec.loaded = false;
            spec.used = false;
        }
    };
    this.load = function (values, ignoreUndefined) {
        if (values !== undefined) {
            for (name in values) {
                if (ignoreUndefined !== undefined && ignoreUndefined) {
                    /*
                     * Check if parameter not defined and return if it is. This prevents loadOption failing.
                     */
                    if (getSpec(this, name) === null)
                        continue;
                }
                loadOption(this, name, values[name]);
            }
        }
        /*
         * Check that mandatory options have a value.
         */
        for (var i = 0; i < this.optSpecs.length; i++) {
            var spec = this.optSpecs[i];

            if ((this.accessByGet ? spec.value : this[spec.name]) === null) {
                if (spec.mandatory)
                    error(this, 'Option "' + spec.name + ' is mandatory but does not have a default');
                else
                    this.accessByGet ? spec.value = null : this[spec.name] = null;
            }
        }
    };
    this.allowedOptionName = function (name) {
        if (this.accessByGet)
            return true;

        var test = eval('this.' + name);

        return test === undefined;
    };
    this.addSpec = function (option) {
        var spec = {
            loaded: false,
            used: false};

        spec.name = option.name;

        if (spec.name === undefined || spec.name === null)
            error(this, 'Option must have a name property');

        if (!this.allowedOptionName(option.name))
            error(this, 'Option name ' + option.name + ' is not allowed');

        for (name in option) {
            switch (name) {
                case 'name':
                    if (getSpec(this, spec.name) !== null)
                        error(this, 'Option "' + spec.name + '" is already defined');

                    break;
                case 'type':
                    spec.type = option[name] === undefined ? null : option[name];
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
        if (spec.type === undefined)
            spec.type = spec.default === undefined ? null : typeof spec.default;
        if (spec.mandatory === undefined)
            spec.mandatory = true;

        this.optSpecs.push(spec);
    };
    this.error = function (msg) {
        error(this, msg);
    };
    this.log = function () {
        var spec;

        console.log(getObjectName(this));

        for (var i = 0; i < this.optSpecs.length; i++) {
            spec = this.optSpecs[i];

            console.log(
                    'Option ' + rpad(String(spec.name), 10) +
                    ' type ' + rpad(String(spec.type), 8) +
                    ' mandatory ' + lpad(String(spec.mandatory), 6) +
                    ' default ' + lpad(String(spec.default), 10) +
                    ' value ' + String(this.getValue(spec.name)));
        }
    };
}
function UnitConvert(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'UnitConvert');

    this.addSpec({name: 'source', type: 'string', mandatory: true});
    this.addSpec({name: 'target', type: 'string', mandatory: true});
    this.addSpec({name: 'multiplier', type: 'number', mandatory: true});
    this.addSpec({name: 'description', type: 'string', mandatory: false});
    this.addSpec({name: 'isVolume', type: 'boolean', default: false, mandatory: false});

    this.clear();
    this.load(pOptions);
}

/*
 * This describes a columns for columns option of JSONArrayOptions. The options are:
 * 
 * - name        The column database name which must be one present in the table.
 * - columnTitle The column title if different to the default.
 * 
 * For the remaining fields see comment for JSONArrayOptions.
 */
function JSONArrayColumnOptions(pOptions) {
    /*
     * Set to retrieve by getValue.
     * 
     * The default is to retrieve by direct access to the options object, e.g. to access option name get
     * the option value using options.name. However, setting the second parameter to true, the option
     * value can be read using options.getValue('name'). Unfortunately, enabling getValue does not cause direct
     * access to raise an error, but it will return undefined for all options even valid ones.
     * 
     * This requires more verbose code to get option values, but will generate an error report if an
     * invalid option name is given. The default case just returns an undefined value.
     * 
     * For all other Options the default is used, to simplify the code. The option is used here as
     * a test that getValue works.
     */
    BaseOptions.call(this, true);

    setObjectName(this, 'JSONArrayColumnOptions');

    this.addSpec({name: 'name',         type: 'string',  mandatory: true});
    this.addSpec({name: 'optional',     type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'forceWrap',    type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'minSize',      type: 'number',  default: null,  mandatory: false});
    this.addSpec({name: 'maxSize',      type: 'number',  default: null,  mandatory: false});
    this.addSpec({name: 'splitName',    type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'columnTitle',  type: 'string',  default: null,  mandatory: false});
    this.addSpec({name: 'wrapHeader',   type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'usePrecision', type: 'boolean', default: false, mandatory: false});

    this.clear();
    this.load(pOptions);
}
/*
 * Defines the options parameter for loadJSONArray, which is used to create and populate HTML table with none
 * scrolling header.
 * 
 * The properties are:
 * - onClick       The onClick event handler for table rows.
 * - nullToEmpty   If true, fields with null values will be displayed as space.
 * - useInnerCell  Determines how the table header th cells are created. If true, a th cell is created and appended
 *                 to the header row. If false, <th>ColName</th> is appended to the header row innerHTML.                
 *                 Not sure if both are equivalent and if either is preferable.               
 * - addColNoClass If true, a class is added to the th and tr elements of the form tbcoln where n is the table
 *                 column number.
 * - addName       If true, name attribute of the th and td elements is set to database field name.
 *                 field. The min and max field limits are still applied to the size.
 * - widthAllRows  If true, the width style is applied to all table rows, rather than just the header
 *                 row and first data row.
 * - useTextWidth  If true, the maximum display width for the column is used to derived to the style width,
 *                 otherwise, the maximum column field size is used. Using the field size has the problem
 *                 that the display width for a character varies, e.g. W requires more space than i.
 * - adjustText    If true, the text value is adjusted before callin context.measureText. This interface does
 *                 not, at least on Chrome, does not appear to be totally accurate. See the comment preceding
 *                 the function displayTextWidth, for further details.
 * - scroll        Determines how the table none scrolling header is implemented. If table the whole table is
 *                 scrolled and the header is fixed using position sticky. If body only the table body is
 *                 scrolled.
 * - columns       Column specific options described in JSONArrayColumnOptions comment. The following fields are
 *                 also defined in JSONArrayColumnOptions. If present and have been explicitly set, i.e. not as
 *                 result of the default, will override the value defined by JSONArrayOptions.
 * - minSize       The minimum number of characters in a column field.
 * - maxSize       The maximum number of characters in a column field.
 * - splitName     If true, the column title is set to camel case database fields converted to words,
 *                 e.g. MilesAdded becomes Miles Added. This will be ignore if the columns option columnTitle
 *                 is set.
 * - wrapHeader    If true, the header size is determined by the largest field resulting from splitting on space,
 *                 e.g. if the column header is 'Multiple Field Heading', the size is determined by Multiple.
 * - usePrecision  If true, column size is set to the database precision, rather than size of the maximum sized.
 * - setTableName  If true, the table name attribute is set to Table name returned in the json data.
 * - ignoreColumns Comma seperated list of columns to be ignored in the JSON data.
 */
function JSONArrayOptions(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'JSONArrayOptions');

    if (!isNull(pOptions.scroll) && pOptions.scroll !== 'table' && pOptions.scroll !== 'body')
        this.error('scroll option is ' + pOptions.scroll + ' and must be table or body');

    this.addSpec({name: 'onClick',       type: 'string',  default: null,   mandatory: false});
    this.addSpec({name: 'nullToEmpty',   type: 'boolean', default: true,   mandatory: false});
    this.addSpec({name: 'useInnerCell',  type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'addColNoClass', type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'addName',       type: 'boolean', default: true,   mandatory: false});
    this.addSpec({name: 'widthAllRows',  type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'useTextWidth',  type: 'boolean', default: true,   mandatory: false});
    this.addSpec({name: 'adjustText',    type: 'boolean', default: true,   mandatory: false});
    this.addSpec({name: 'scroll',        type: 'string',  default: 'body', mandatory: false});
    this.addSpec({name: 'columns',       type: 'object',  default: null,   mandatory: false});
    this.addSpec({name: 'minSize',       type: 'number',  default: null,   mandatory: false});
    this.addSpec({name: 'maxSize',       type: 'number',  default: 19,     mandatory: false});
    this.addSpec({name: 'splitName',     type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'wrapHeader',    type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'usePrecision',  type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'setTableName',  type: 'boolean', default: false,  mandatory: false});
    this.addSpec({name: 'setTableTitle', type: 'string',  default: '',     mandatory: false});
    this.addSpec({name: 'ignoreColumns', type: 'string',  default: '',     mandatory: false});

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
/*
 * Defines the options parameter for createParameter
 * 
 * The properties are:
 *  - initialParams  Array of name value pairs to be added to the parameter after the parameter action.
 *  - fields         Screen fields as returned by getElements.
 *  - modifier       Function that can be used to modify the values of the above properties. It takes 2 parameters name
 *                   and value. It returns the input value, if no modification is defined, or the modified value.
 */
function createParametersOptions(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'createParametersOptions');

    this.addSpec({name: 'initialParams', type: 'object',   default: null, mandatory: false});
    this.addSpec({name: 'fields',        type: 'object',   default: null, mandatory: false});
    this.addSpec({name: 'modifier',      type: 'function', default: null, mandatory: false});
        
    this.clear();
    this.load(pOptions, true);
}
function loadSelectOptions(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'loadSelectOptions');
    this.addSpec({name: 'keepValue',    type: 'boolean', default: true});
    this.addSpec({name: 'defaultValue', type: 'string',  default: ''});
    this.addSpec({name: 'allowBlank',   type: 'boolean', default: false});

    this.clear();
    this.load(pOptions, true);
}
/*
 * The options include those above for loadSelect.
 * 
 * Probably better to have a way to include other options without having
 * to include them indvidually.
 */
function getListOptions(pOptions) {
    BaseOptions.call(this, false);

    setObjectName(this, 'getListOptions');
    this.addSpec({name: 'name',         type: null,      default: ''});
    this.addSpec({name: 'element',      type: null,      default: null, mandatory: false});
    this.addSpec({name: 'keepValue',    type: 'boolean', default: true});
    this.addSpec({name: 'defaultValue', type: 'string',  default: ''});
    this.addSpec({name: 'allowBlank',   type: 'boolean', default: false});
    this.addSpec({name: 'table',        type: 'string',  default: ''});
    this.addSpec({name: 'field',        type: 'string',  default: ''});
    this.addSpec({name: 'filter',       type: 'string',  default: ''});
    this.addSpec({name: 'async',        type: 'boolean', default: true});

    this.clear();
    this.load(pOptions, true);
}

function resizeFrame(id) {
    var elm = getElement(id);
    var width = elm.contentWindow.document.body.scrollWidth;
    var height = elm.contentWindow.document.body.scrollHeight;

    elm.width = width + "px";
    elm.height = height + "px";
}
function popUp() {
    var popUpDoc;
    var containerId;
    var popUpId;
    var appId;
    var frameId;

    this.initialise = initialise;
    this.reset = reset;
    this.display = display;
    this.getElementById = getElementById;
    this.getValueById = getValueById;
    this.setValueById = setValueById;
    this.getAppId = getAppId;
    this.getContainerId = getContainerId;
    this.getFrameId = getFrameId;
    this.inDisplay = inDisplay;
    this.setDocumentOnClick = setDocumentOnClick;

    function setSize(element, width, height) {
        var style = element.style;

        style.width = width + 'px';
        style.height = height + 'px';
    }
    function initialise(containerId, appId) {
        var home = document.getElementById(containerId);
        var body;

        this.containerId = containerId;
        this.popUpId = containerId;
        this.appId = appId === undefined ? 'appframe' : appId;

        if (home.tagName === 'IFRAME') {
            this.popUpDoc = document.getElementById(containerId).contentWindow.document;
            body = this.popUpDoc.body;
            this.popUpId = body.id !== '' ? body.id : body.firstElementChild.id;
            this.frameId = containerId;
            this.containerId = home.parentElement.id;
        } else {
            this.popUpId = this.containerId;
            this.popUpDoc = document;
            this.frameId = '';
        }
        document.getElementById(this.containerId).style.display = 'none';
    }
    function getContainerId() {
        return this.containerId;
    }
    /*
     * Set to initial state for a new alert. The only action required is to clear
     * the width and height for the popUpId element.
     */
    function reset() {
        getElement(this.getContainerId()).style.left = "";
        getElement(this.getContainerId()).style.top = "";

        if (this.getFrameId() === '') {
            this.getElementById(this.popUpId).style.width = "";
            this.getElementById(this.popUpId).style.height = "";
        }
    }
    function getAppId() {
        return this.appId;
    }
    function display(yes, switchApp, minWidth, minHeight) {
        setHidden(this.containerId, !yes);

        if (switchApp)
            setHidden(this.appId, yes);

        if (yes) {
            var pu = this.getElementById(this.popUpId);
            var wd = pu.offsetWidth;
            var ht = pu.offsetHeight;

            if (minWidth !== null && wd < minWidth)
                wd = minWidth;
            if (minHeight !== null && ht < minHeight)
                ht = minHeight;

            if (this.frameId !== '')
                setSize(document.getElementById(this.frameId), wd, ht);
            else
                setSize(document.getElementById(this.containerId), wd, ht);
        }
    }
    function getElementById(id) {
        return (this.containerId === id || this.frameId === id ? document : this.popUpDoc).getElementById(id);
    }
    function getValueById(id) {
        return trim(this.getElementById(id).value);
    }
    function setValueById(id, value, ignoreIfNotFound) {
        var el = this / getElementById(id);

        if (el === null && ignoreIfNotFound !== undefined && ignoreIfNotFound)
            return;

        el.value = value;
    }
    function getFrameId() {
        return this.frameId;
    }
    function inDisplay(event) {
        var target = event;
        var container = document.getElementById(this.containerId);
        var frame = this.frameId !== '' ? this.getElementById(this.popUpId) : undefined;

        while (target.parentNode) {
            if (target === container || frame !== undefined && target === frame)
                return true;

            target = target.parentNode;
        }
        return false;
    }
    function setDocumentOnClick(action) {
        document.onclick = action;

        if (this.frameId !== '')
            this.popUpDoc.onclick = action;
    }
}
function deleteRows(object) {
    if (isNull(object))
        return;

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
    table = getElement(table);
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
/*
 * id  Either a select element or the id of one.
 * 
 * @returns The label of the selected option or an empty string if no option seleceted.
 *          By label is meant the string that appears in the drop down list. The value return by the element
 *          is either the label or the explicitly defined value of the selected option. Usually the element
 *          value is the most appropriate from a code point of view.
 */
function getSelectedOption(id) {
    var options = getElement(id).options;

    return (options.selectedIndex < 0) ? "" : options[options.selectedIndex].text;
}
/*
 * @param {type} id
 * @returns {.document@call;getElementsByName.value|String|.document@call;getElementById.checked}
 */
function getValue(elememt) {
    var input = (typeof elememt === 'string') ? document.getElementById(elememt) : elememt;
    var type = input.type;

    if (type === "radio")
        return getRadioValue(input.name);
    if (type === "checkbox")
        return input.checked;

    return input.value.trim();
}
function isVisible(element) {
    element = getElement(element);

    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
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
function normaliseValue(value, type, scale, nullToSpace) {
    if (value === null || value === 'null') {
        if (nullToSpace !== 'undefined' && nullToSpace)
            value = '';

        return value;
    }
    if (type === 'decimal' && scale !== 0 && value !== '') {
        try {
            value = value.toFixed(scale);
        } catch (e) {
            reporter.logThrow(e, true);
        }
    }
    return value;
}
class ClassProperties {
    #properties = new WeakMap();
    #className;

    constructor() {
    }
    addKey(key, className) {
        this.#className = isNull(className) ? key.constructor.name : className;
        this.#properties.set(key, {});
    }
    hasProperty(key, name) {
        return (name in this.#properties.get(key));
    };
    setProperty(key, name, value, create) {
        if ((isNull(create) || !create) && !this.hasProperty(key, name))
            reporter.fatalError('Property ' + name + ' not in ' + this.#className + ' and creation not allowed');
        this.#properties.get(key)[name] = value;
    };
    getProperty(key, name) {
        if (!this.hasProperty(key, name))
            reporter.fatalError('Property ' + name + ' not in ' + this.#className);

        return this.#properties.get(key)[name];
    };
}
/*
 * This implements the Column class in a way that prevents direct access to the properties. Also user, due to the
 * instance and class having Object.seal applied, the user is unable add or delete existing methods. The user
 * can still reference an invalid property by instance.name. No error is forced, the value is returned as
 * undefined
 * 
 * I don't fully understand how this works, but it uses an annonymous function in a way thet prevents direct
 * access to the class properties defined using ClassProperties. The _props are defined in a function and are
 * only accessible to the definition of the class Column defined within the function.
 * 
 * Don't know why new on Column works. It looks as if new finds the first class within the function. In fact 
 * changing the Class name makes no difference.
 * 
 * Don't know why the final () is necessary, but without it, it does not work. The () causes the function to execute
 * at the point it is declared, but why this is necessary I don't know. Without it, called methods fail with method
 * not defined, although the debugger shows the method to be present in the instance prototype.
 */
const Column = function () {
    ;
    const _props = new ClassProperties();

    class Column {
        /*
         * The following is test private class variables.
         * 
         * Have raised the following bug report on Netneans.
         * 
         * Javascript editor reporting spurious errors #6509
         */
        #priv = 'Private';
        pub = 'Public';

        getPriv() {
            return this.#priv;
        }

        constructor(name, no, type, precision, scale, optional, options) {
            let key = this;  //For setProp. Function this is not the same as class this.

            _props.addKey(key);

            const setProp = function (name, value) {
                _props.setProperty(key, name, value, true);
            };
            setProp('name',         name);
            setProp('no',           no);
            setProp('type',         type);
            setProp('precision',    precision);
            setProp('scale',        scale);
            setProp('optional',     optional);
            setProp('class',        '');
            setProp('size',         null);
            setProp('textWidth',    null);
            setProp('columnTitle',  null);
            setProp('forceWrap',    false);
            setProp('adjustText',   options.adjustText);
            setProp('minSize',      options.minSize);
            setProp('maxSize',      options.maxSize);
            setProp('splitName',    options.splitName);
            setProp('wrapHeader',   options.wrapHeader);
            setProp('usePrecision', options.usePrecision);

            if (!isNull(options.columns)) {
                for (var i = 0; i < options.columns.length; i++) {
                    var colOpts = options.columns[i];

                    if (colOpts.getValue('name') === name || colOpts.getValue('name') === '*') {
                        colOpts.setUsed(true);
                        /*
                         * Copies the property from column options to the column depending on loadRequired. If
                         * loadRequired is true, the copy will only take place if the property value was
                         * explicitly set rather than being initialised to the default value.
                         * 
                         * Note: The options will have a value for each property. Explicitly setting a property to its
                         *       default value, will result in isLoaded returning true.
                         */
                        function copy(property, loadedRequired) {
                            if (!loadedRequired || colOpts.isLoaded(property))
                                setProp(property, colOpts.getValue(property));
                        }
                        copy('minSize',      true);
                        copy('maxSize',      true);
                        copy('splitName',    true);
                        copy('columnTitle',  true);
                        copy('wrapHeader',   true);
                        copy('usePrecision', true);
                        copy('forceWrap',    false);

                        if (this.optional() !== null)
                            copy('optional', false); // Override the server value if client value set.
                    }
                }
            }
            Object.seal(this);

            if (!isNull(no) && no > 0)
                this.addClass('tbcol' + no);
            if (!isNull(optional) && optional)
                this.addClass('optional');
            if (!isNull(type) && (type === "int" || type === "decimal"))
                this.addClass('number');
        }
        /*
         * In general it is probably better to not allow direct access to properties as specific property
         * change property methods may apply additional checks.
         * 
         * The same could also apply to getProperty.
         * 
         * In general classes based on the approach used for Column, should not make hasProperty, setProperty
         * and getProperty available to users of the class. The implementation of Column does not make use
         * of these methods.
         */
        hasProperty(name) {
            return _props.hasProperty(this, name);
        }
        setProperty(name, value, create) {
            _props.setProperty(this, name, value, create);
        }
        getProperty(name) {
            return _props.getProperty(this, name);
        }
        addClass(tag) {
            let cls = _props.getProperty(this, 'class');

            if (cls !== '')
                cls += ' ';

            _props.setProperty(this, 'class', cls + tag);
        }
        setSize(element) {
            var value = element.innerHTML;
            var font = readComputedStyle(element, 'font');
            let key = this;

            const setMax = function (property, length) {
                let current = _props.getProperty(key, property);

                if (current === null || current < length)
                    _props.setProperty(key, property, length);
            };
            if (typeof value === 'number')
                value = value.toString();

            if (element.tagName.toLowerCase() === 'th' && _props.getProperty(key, 'wrapHeader')) {
                /*
                 * Column headers are allowed to wrap on space character. So use the largest word in the header
                 * as the column string for sizing purposes.
                 */
                let flds = value.split(' ');
                value = '';

                for (var i = 0; i < flds.length; i++) {
                    if (flds[i].length > value.length)
                        value = flds[i];
                }
            }
            setMax('size', value.length);

            if (!isNull(font)) {
                let length1 = displayTextWidth(value, font, _props.getProperty(this, 'adjustText'));
                setMax('textWidth', length1);
            }
        }
        getClass() {
            return _props.getProperty(this, 'class');
        }
        loadColumnValue(cell, value, nullToSpace) {
            value = normaliseValue(value, _props.getProperty(this, 'type'), _props.getProperty(this, 'scale'), nullToSpace);

            if (typeof value === 'number')
                value = value.toString();

            cell.innerHTML = value;
            this.setSize(cell);
        }
        name() {
            return _props.getProperty(this, 'name');
        }
        size() {
            return _props.getProperty(this, 'size');
        }
        precision() {
            return _props.getProperty(this, 'precision');
        }
        minSize() {
            return _props.getProperty(this, 'minSize');
        }
        maxSize() {
            return _props.getProperty(this, 'maxSize');
        }
        forceWrap() {
            return _props.getProperty(this, 'forceWrap');
        }
        textWidth() {
            return _props.getProperty(this, 'textWidth');
        }
        optional() {
            return _props.getProperty(this, 'optional');
        }
    }
    Object.seal(Column);

    return Column;
}();

const TableSizer = function () {
    const _props = new ClassProperties();

    class TableSizer {
        constructor(table, baseId, options) {
            let key = this;  //For setProp. Function this is not the same as class this.

            _props.addKey(key);

            const setProp = function (name, value) {
                _props.setProperty(key, name, value, true);
            };
            setProp('baseId', isNull(baseId) ? table.id : baseId);
            setProp('table', getElement(table));
            setProp('font', readComputedStyle(table, 'font'));
            setProp('options', options);
            setProp('columns', []);
            Object.seal(this);
        }
        table() {
            return _props.getProperty(this, 'table');
        }
        identifier() {
            let name = getCaption(this.table());

            return name === '' ? _props.getProperty(this, 'baseId') : name;
        }
        addColumn(name, no, type, precision, scale, optional, options) {
            let col = new Column(name, no, type, precision, scale, optional, options); 
            
            this.columns().push(col);
            return col;
        }
        columns() {
            return  _props.getProperty(this, 'columns');
        }
        options() {
            return  _props.getProperty(this, 'options');
        }
        column(index) {
            return this.columns()[index];
        }
        minSize(index) {
            return this.column(index).minSize();
        }
        maxSize(index) {
            return this.column(index).maxSize();
        }
        /*
         * Returns the display column size for column at index. This will be the column size limited if necessary
         * to conform to columns min max size if specified, or if not, the table min and max field sizes.
         */
        constrainedSize(index) {
            var col = this.column(index);
            var size = this.minSize(index);
            var cSize = col.size();
            var opts = _props.getProperty(this, 'options');

            if (opts.usePrecision && col.precision() > cSize)
                cSize = col.precision();

            if (!isNull(size) && cSize < size)
                return size;

            size = this.maxSize(index);

            if (!isNull(size) && cSize > size)
                return size;

            return cSize;
        }
        constrainedTextWidth(index) {
            var col = this.column(index);
            var size = this.constrainedSize(index);

            return Math.ceil(col.textWidth() * size / col.size());
        }
        checkColumnOptions(options) {
            if (isNull(options))
                return;

            for (var i = 0; i < options.length; i++) {
                var ocol = options[i];
                var found = false;

                if (!ocol.getUsed())
                    reporter.fatalError('There is no column "' + ocol.getValue('name') + '" in table ' + this.table().id);
            }
        }
        log() {
            var opts = _props.getProperty(this, 'options');

            reporter.log(
                    "Sizer details for table " + this.identifier() +
                    ' Min ' + lpad(opts.minSize, 4) +
                    ' Max ' + lpad(opts.maxSize, 4) +
                    ' Use TextWidth ' + opts.useTextWidth +
                    ' Adjust Text ' + opts.adjustText);
            for (var j = 0; j < this.columns().length; j++) {
                var col = this.column(j);

                reporter.log(
                        rpad(col.name(), 15) +
                        ' size ' + lpad(col.size(), 3) +
                        ' min ' + lpad(this.minSize(j), 3) +
                        ' max ' + lpad(this.maxSize(j), 3) +
                        ' constrained ' + lpad(this.constrainedSize(j), 3) +
                        ' text width ' + lpad(col.textWidth(), 4) +
                        ' constrained text width ' + lpad(this.constrainedTextWidth(j), 4));
            }
        }
        ;
    }
    Object.seal(TableSizer);
    return TableSizer;
}();
/*
 * Returns the caption for element. If this is null it establishes a value in the following order:
 *  - If the parent is fieldset and it has caption its value is returned.
 *  - if the element has a name attribute its value is returned.
 *  - The elements id is returned.
 */
function getCaption(element) {
    element = getElement(element);

    var children;

    if (!isNull(element.caption))
        return element.caption.textContent;

    if (element.tagName === 'FIELDSET') {
        children = getChildren(element, 'LEGEND');

        if (children.length > 0)
            return children[0].innerHTML;
    }
    return element.id;
}
/*
 * This class provides a wrapper for a HTML table. The HTML table is restricted to having a single line header, which may
 * be absent and a single tBody.
 * 
 * All other code that accesses a HTML table will be modified to use this class. 
 */
class Table {
    #table;
    #caption;
    #header;
    #body;
    #rowIndex;
    #colIndex
    
    #error(message) {
        throw new ErrorObject('Code Error', 'Table ' + this.#caption + ' ' + message);
    }
    /*
     * Table a can an HTML element pr a TR row element, an id string of an HTML table element.
     * 
     * If Table is a row the owning table element is retreived and the row ind is set to that of the row.
     */
    constructor(table) {
        if (typeof table === 'string') table = getElement(table);
        
        this.#colIndex = 0;
        
        switch (table.tagName) {
            case 'TABLE':
                this.#table    = table;
                this.#rowIndex = 0;
                break;
            case 'TR':
                if (table.parentNode.tagName !== 'TBODY') throw new ErrorObject('Code Error', 'Element ' + table.localName + ' is not TBODY row');
                
                this.#rowIndex = table.sectionRowIndex;
                this.#colIndex = -1;
                this.#table    = table.parentNode.parentNode;
                break;
            default:
                throw new ErrorObject('Code Error', 'Element ' + table.localName + ' does not identify a table');
        }
        this.#header = null;
        this.#body   = null;
        
        for (let i = 0; i < this.#table.childElementCount; i++) {
            switch (this.#table.children[i].tagName) {
                case 'CAPTION':
                    this.#caption = this.#table.children[i].innerHTML;
                    break;          
                case 'THEAD':
                    this.#header = this.#table.children[i].rows[0];
                    break;
                case 'TBODY':
                    this.#body = this.#table.children[i];
                    break;                    
            }
        }
        if (this.#body === null) throw new ErrorObject('Code Error', 'Element ' + table.id + ' does not have a body');
    }
    #checkRowIndex(index) {
        if (index < 0 || index >= this.#body.rows.length) this.#error('Row index ' + index + ' invalid');
    }
    setRowFirst() {
        this.#rowIndex = -1;
    }
    nextRow() {
        if (this.#rowIndex >= this.#body.rows.length) throw new ErrorObject('Code Error', 'Attempt to read beyond last row');
        
        this.#rowIndex += 1;

        return this.#rowIndex < this.#body.rows.length;
    }
    tableName() {
        return this.#table.getAttribute('name');
    }
    tableCaption() {
        return this.#caption;
    }
    setColFirst() {
        this.#colIndex = -1;
    }
    nextColumn() {
        if (this.#colIndex >= this.#header.cells.length) throw new ErrorObject('Code Error', 'Attempt to read beyond last column');
        
        this.#colIndex += 1;

        return this.#colIndex < this.#header.cells.length;
    };
    getColIndex(id, mustExist)  {
        if (typeof id === 'string') {
            for (let i = 0; i < this.#header.cells.length; i++) {
                if (this.#header.cells[i].innerHTML === id) return i;
            }
        } else if (id >= 0 && id < this.#header.cells.length) 
            return id;
        if (!defaultNull(mustExist, true)) return -1;
        
        throw new ErrorObject('Code Error', 'Id ' + id + ' is not a column in ' + this.#caption);
    }
    setColumn(id) {        
        this.#colIndex = this.getColIndex(id);
    }
    isColumn(id) {
        if (typeof id === 'string') return this.getColIndex(id, false) !== -1;
        
        return id >= 0 && id < this.#header.cells.length;        
    }
    columnValue(name) {
        let index = isNull(name)? this.#colIndex : this.getColIndex(name);
        /*
         * Needed to go via ta to ensure that escapable characters such as & are not returned in their escaped form i.e. &amp;
         * 
         * Don't know why this is necessary.
         */
        var ta = document.createElement('textarea');
        
        this.#checkRowIndex(this.#rowIndex);        
        ta.innerHTML = trim(this.#body.rows[this.#rowIndex].cells[index].innerHTML);
        return ta.value;
    }
    /*
     * The method above should be used instead 
     * @param {type} name
     * @returns {undefined}
     */
    getColumnValue(name) {
        console.log('Use columnValue instead');
        
        this.columnValue(name);
    }
    setRowIndex(index) {
        this.#checkRowIndex(index);        
        this.#rowIndex = index;        
    }
    getRowIndex() {
        return this.#rowIndex;
    }
    getRowCount() {
        return this.#body.rows.length;
    }
    columnName(id) {
        let index = isNull(id)? this.#colIndex : this.getColIndex(id);
        return this.#header.cells[index].innerHTML;
    }
    loadScreenFields(screen, options) {
        options = new screenFieldsOptions(options);
        this.setColFirst();
        
        while (this.nextColumn()) {
            screen.setValue(this.columnName(), this.columnValue(), options.mustExist);    
            
            if (options.setKey) screen.setValue('Key!' + this.columnName(), this.columnValue(), false);
        }
    }
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
            multiplier = 0.55;
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
    value = normaliseValue(value, type, scale, true);

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
    this.name = name;

    this.addColumn = function (name, dataName, type, optional) {
        var column = {};

        column.Name = name;
        column.DataName = dataName;
        column.Type = type;

        for (name in optional) {
            column[name] = optional[name];
        }
        this.columns.push(column);
    };
    this.getJSON = function (data) {
        var i = 0;
        var result = new JSONcbc();
        var arr = new JSONcbc('array');
        var row;
        var col;

        result.addMember('Table', name);
        result.addMember('Header', arr);

        for (i = 0; i < this.columns.length; i++) {
            col = this.columns[i];
            row = new JSONcbc('object');
            arr.addElement(row);

            for (name in col) {
                if (col.name !== 'DataName')
                    row.addMember(name, col[name]);
            }
        }
        arr = new JSONcbc('array');
        result.addMember('Data', arr);

        for (i = 0; i < data.length; i++) {
            var dr = data[i];
            var cl;
            var jcols = new JSONcbc('array');

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

        if (typeof jsonData === 'string')
            json = (new JSONReader(jsonData)).getJSON();

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

            id = "";
            type = "";
            precision = "";
            scale = "";
            value = "";
        }
    } catch (e) {
        reporter.logThrow(e, true);
    }
}

/*
 * The json object must be set to the JSON array of column header objects.
 * 
 * ignored is an empty array which set to length of the JSON array header. The value of each element is a boolean
 *    which is set to true if the corresponding column name appears in the option ignoreColumns. This passed to 
 *    jsonAddData to skip the correspondin data value.
 */
function jsonAddHeader(json, table, baseId, ignored, options) {
    var tableSizer = new TableSizer(table, baseId, options);
    var name;
    var cName;
    var header = table.createTHead();
    var row    = header.insertRow(0);
    var colNo  = 0;
    var jcol;
    var col;
    var cell;
    let igCols = options.ignoreColumns.split(',');

    if (options.scroll === 'table')
        header.classList.add('scroll');

    /*
     * Iterate the array of column specifier objects.
     */
    json.setFirst();

    while (json.isNext()) {        
        jcol = json.next().value;
        name = jcol.getMember('Name', true).value;
        
        ignored.push(igCols.includes(name));
        
        if (ignored.slice(-1)[0]) continue;
        
        col  = tableSizer.addColumn(
                name,
                options.addColNoClass ? colNo + 1 : -1,
                jcol.getMember('Type').value,
                jcol.getMember('Precision', false).value,
                jcol.getMember('Scale', false).value,
                jcol.getMember('Optional', false).value,
                tableSizer.options());
        cName = col.getProperty('columnTitle');
        
        if (cName === null) cName = col.getProperty('splitName')? camelToWords(name) : name;

        if (options.useInnerCell) {
            cell = document.createElement('th');
            cell.innerHTML = cName;
            row.appendChild(cell);
        } else {
            row.innerHTML += "<th>" + cName + "</th>";
            cell = row.cells[colNo];
        }
        col.setSize(cell);
        colNo++;
    }
    /*
     * Check for any unused column options.
     */
    tableSizer.checkColumnOptions(options.columns);

    return tableSizer;
}
/*
 * The json object must be set to the JSON array of rows the column values array.
 */
function jsonAddData(json, tableSizer, ignored, options) {
    var body = tableSizer.table().tBodies[0];
    var rowNo = 0;
    var dcol;
    var row;
    let jindx = 0;

    body.classList.remove('scroll');

    if (options.scroll === 'body')
        body.classList.add('scroll');

    json.setFirst();
    /*
     * Iterate the data rows.
     */
    while (json.isNext()) {
        var colNo = 0;
        var drow = json.next().value;
        var cell;
        
        row = body.insertRow(rowNo++);

        if (options.onClick !== null)
            row.setAttribute("onclick", options.onClick);
        /*
         * Iterate the data columns.
         */
        drow.setFirst();
        jindx = 0;

        while (drow.isNext()) {
            dcol = drow.next();
            
            if (ignored[jindx++]) continue;
            
            cell = row.insertCell();
            tableSizer.column(colNo).loadColumnValue(cell, dcol.value, options.nullToEmpty);
            colNo++;
        }
    }
}
function cellReplace(cell, from, to) {
    cell.innerHTML = cell.innerHTML.split(from).join(to);
}
function stringToJSON(jsonData) {
    if (typeof jsonData === 'string')
        jsonData = (new JSONReader(jsonData)).getJSON();

    return jsonData;
}
/*
 * The id parameter is the element id of the table to be loaded.
 * 
 * The options parameter determines how the HTML table is built and the options are described in the
 * comments preceding JSONArrayOptions and JSONArrayColumnOptions.
 * 
 * The JSON table string format, the jsonArray parameter, is
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
    if (options === undefined || getObjectName(options) !== 'JSONArrayOptions')
        options = new JSONArrayOptions(options);

    try {
        var table = document.getElementById(id);
        var maxRowSize = 0;
        var json = stringToJSON(jsonArray);
        var tableSizer;
        var jval;
        var row;
        var svrName = json.getMember('Table').value;
        let ignored = new Array(0);
        /*
         * If the element is not a table, search for the first child that is a table. If there is no
         * child table, create one and make table the parent.
         * 
         * Should probably raise an error if there is more than one child table. 
         */
        if (table.tagName !== 'TABLE') {
            let tabs = getChildren(table, 'TABLE');

            if (tabs.length === 0) {
                table = createElement(document, 'TABLE', {append: table});
            } else
                table = tabs[0];
        }
        if (options.setTableName)
            table.setAttribute('Name', svrName);
        if (isNull(table.tBodies[0]))
            table.createTBody();
        if (options.setTableTitle !=='') {
            let caption = table.createCaption();
            caption.textContent = options.setTableTitle;
        }

        clearTable(table);

        st.log("Loading table " + id);
        st.setStart();

        table.classList.remove('scroll');

        if (options.scroll === 'table')
            table.classList.add('scroll');

        jval = json.getMember('Header', true);
        tableSizer = jsonAddHeader(jval.value, table, id, ignored, options);
        jval = json.getMember('Data', true);
        jsonAddData(jval.value, tableSizer, ignored, options);

        st.logElapsed("Loading rows");
        st.setStart();
        /*
         * Set cell widths and class and name if required. 
         */
        for (var j = 0; j < table.rows.length; j++) {
            var rowSize = 0;

            row = table.rows[j];

            for (var i = 0; i < row.cells.length; i++) {
                var col = tableSizer.column(i);
                var cell = row.cells[i];
                var size = tableSizer.constrainedSize(i);
                var forceWidth = false;
                var value = cell.innerHTML;
                var style = null;

                rowSize += size;

                if (options.useTextWidth) {
                    style = 'width:' + tableSizer.constrainedTextWidth(i) + 'px';
                } else
                    style = 'width:' + getWidth(size, 'px');

                if (value.length > size) {
                    forceWidth = true;

                    if (col.forceWrap() || value.indexOf(' ') === -1)
                        style += ';word-break: break-all';
                }
                if (j <= 1 || options.widthAllRows || forceWidth)
                    cell.setAttribute("style", style);

                if (col.getClass() !== '')
                    cell.setAttribute('class', col.getClass());
                if (options.addName)
                    cell.setAttribute('name', col.name());
                /*
                 * Calculate total width. Only accessed in debugging.
                 */
                if (rowSize > maxRowSize)
                    maxRowSize = rowSize;
            }
        }
        tableSizer.log();
        st.log('Table ' + id + ' has ' + table.rows.length + ' rows max rows ' + maxRowSize);
        st.logElapsed("Set table sizes");
    } catch (e) {
        reporter.logThrow(e, true);
    }
}
/*
 * 
 * @param Element select      HTML that has an options list.
 * @param String  value       Comma separated list of option values. The value can be 2 fields separated by : the 
 *                            second being optional. The first is string that is displayed and the second the
 *                            value return as the select list value, which defaults to the first parameter.
 * @param boolean ignoreBlank Blank value will be ignored.
 */
function addOption(select, value, ignoreBlank) {
    value = trim(value);

    if (defaultNull(ignoreBlank, false) && value === '')
        return;
    /*
     * For Datalist options, setting a new Option has no effect.
     */
    if (select.tagName === "DATALIST")
        select.innerHTML += '<option value="' + value + '"/>';
    else {
        let pars = value.split(":");
        select.options[select.options.length] = new Option(pars[0], pars.length > 1? pars[1] : pars[0]);
    }
}
/*
 * id          The select element to be loaded. This can be eith the element id string or the element object.
 * values      The select options. The following are the allowed formats:
 *               - A string starting with {. This is the JSON string returned by the server for the getList action.
 *               - A comma seperated list of select option values. The value can consist of 2 fields separated
 *                 by : the second being optional. See addOption for details.
 *               - An array of strings containing the select option values.
 *               - A select element from which the option values are copied.
 * loadOptions The loadSelectOptions as defined above.
 */
function loadSelect(id, values, loadOptions) {
    try {
        var options = new loadSelectOptions(loadOptions);
        var select  = isNull(id) || typeof id === 'string' && trim(id) === ''? null : getElement(id);
        
        if (select === null) throw new ErrorObject('loadSelect', 'Id ' + id + ' does not identify an element');

        var initial = options.keepValue ? select.value : options.defaultValue !== null ? options.defaultValue : "";
        /*
         * For the Datalist options setting select.options = 0 has no effe
         */
        select.innerHTML = "";

        if (options.allowBlank) addOption(select, '');
        
        if (typeof values === 'string') {
            if (values.charAt(0) !== '{') {
                // Values are a comma separated string;
                
                values.split(',').forEach(function (option) {
                    addOption(select, option, true);
                });
            } else {
                values = (new JSONReader(values)).getJSON();
                
                var jopt = values.getMember('Data', true).value;
                /*
                 * Iterate over rows.                
                 */
                while (jopt.isNext()) {
                    var jrow = jopt.next().value;
                    /*
                     * Each row should only contain one column.
                     */
                    jrow.setFirst();
                    addOption(select, jrow.next().value, true);
                }
            } 
        } else if (values instanceof Element && values.tagName === 'SELECT') {            
            for(i=0; i < values.options.length; i++){
                console.log(values.options[i].value);
                addOption(select, values.options[i].value, true);
            }
        } else if (Array.isArray(values)) {
            for (var i = 0; i < values.length; i++)
                addOption(select, values[i], true);
        } else
            throw new ErrorObject('loadSelect', 'Values ' + values + ' not a supported source of values');
        
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
/*
 * ev   event upon which the allowedInNumberField function was called.
 * 
 * Typically this available as the event object. However, if the html is in a frame, event is undefined.
 * 
 * This is overcome by passing event as a parameter the on event.
 * 
 * All functions that reference event, should allow it to be passed as a parameter.
 * 
 */
function allowedInNumberField(ev) {
    ev = defaultNull(ev, event);
    var value = ev.target.value + ev.key;

    if (isNaN(value) && value !== '+' && value !== '-') {
        ev.preventDefault();
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
/*
 * Returns the label for HTML element elm.
 * 
 * If the preceding element is a label and it is for elm.id return its value, otherwise, return elm.name as label.
 */
function getElementLabel(elm) {
    var prelm;

    elm = getElement(elm);
    prelm = elm.previousElementSibling;

    if (!isNull(prelm) && prelm.tagName === "LABEL" && prelm.htmlFor === elm.id)
        return prelm.innerHTML;

    return elm.name;
}
function getFloatValue(elm, defaultValue) {
    var value = parseFloat(getElement(elm).value);

    return isNaN(value) && !isNull(defaultValue) ? defaultValue : value;
}
/*
 * Returns the value of the elm, unless required is true or undefined and the value is empty, 
 *         in which case a field validation failure is displayed and undefined is returned
 */
function getFieldValue(elm, required) {
    elm = getElement(elm);

    var value = trim(elm.value);

    if (value === "" && (required === undefined || required)) {
        displayAlert('Field Validation', "Enter a value for " + getElementLabel(elm), {focus: elm});
        /*
         * Probably should remove the following and just return the valus.
         */
        return undefined;
    }
    return value;
}
/*
 * Rewritten to use the above. The former content has been commented out, in case there is a problem. The
 * comment should be removed if no problems occur.
 */
function fieldHasValue(elm, required) {
    /*
     elm = getElement(elm);
     
     var value = trim(elm.value);
     
     if (value === "") {
     if (required === undefined || required) {
     displayAlert('Field Validation', "Enter a value for " + getElementLabel(elm), {focus: elm});
     }
     return false;
     }
     return true;
     */
    var value = getFieldValue(elm, required);

    return value !== '' && value !== undefined;
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
    var ps = parameters.split('&');
    var smy = '';

    for (var i = 0; i < ps.length; i++) {
        if (i > 3)
            break;

        if (/^mysql/.test(ps[i]))
            continue;

        smy += (smy === '' ? '' : ',') + decodeURIComponent(ps[i]);
    }
    return smy;
}
/*
 * params Returned by the server and describes the reminders due. It consists of the following 3 comma seperated fields:
 *        - !ReminderImmeadiate or !ReminderAlert. 
 *        - Minutes. The number of minutes the server waits before repeating the alert. This will set the browser report
 *          interval if the browser report interval is 0, but is ignored otherwise.
 *        - Earlist. The timestamp of the next alert due to be reported.
 */
function reportReminder(params) {
    params = params.split(',');

    if (params.length !== 3)
        reporter.fatalError('Invalid reminder options-' + options);
    else {
        var interval = getLocalStorage('remInterval');
        var last = getLocalStorage('remLast');
        var earliest = null;
        var lastDt = null;
        var due;
        var state;
        var days;
        var hours;
        /*
         * If interval is 0, it is set to the server configured reminder interval which is returned in the
         * second reply field.
         */
        if (interval === '0') {
            interval = params[1];
            reporter.log('Local storage initialised');
            setLocalStorage('remInterval', interval);
        } else {
            lastDt = new Date(last);  // Don't use toDate in this case 
            reporter.log('Reminder received-Last report time ' + lastDt.toTimeString());
        }
        earliest = toDate(params[2]);
        hours = dateDiff(new Date(), earliest, 'Hours');
        state = params[0] === '!ReminderImmediate' ? 'URGENT' : 'current';
        days = Math.floor(hours / 24);
        hours = Math.floor(hours - 24 * days);

        if (days === 0)
            due = hours + ' hours';
        else if (days === 1)
            due = days + ' day ' + hours + ' hours';
        else
            due = days + ' days';

        displayAlert('Warning', 'There are ' + state + ' reminders. Next due ' + due);
        reporter.log('Alert displayed. Earliest ' + getDateTime(earliest) + ' days ' + days + ' hours ' + hours);
        setLocalStorage('remLast', (new Date()).toString());
    }
}
/* server       The server for the ajaxCall making the call. It makes no significant difference which server the
 *              is used as the request is handled by AplicationServer common code. It is useful as the comment
 *              log includes the requested server. If undefined defaults to Reminder.
 * callerParams When called from ajaxCall this is the parameters passed to ajaxCall. This is used to
 *              check against the parameters for checkRemindersDue and this exits if they are the
 *              same. This prevents an infinite loop.
 *              
 * This function exits if requestReminders is false, or remInterval minutes have not elapsed since the
 * last reminders were requested from the server.
 */
function getReminderAlerts(server, callerParams) {
    var parameters = createParameters('checkRemindersDue');
    var last = getLocalStorage('remLast');

    if (!getLocalStorage('requestReminders'))
        return;
    if (defaultNull(callerParams, '').startsWith(parameters))
        return;

    if (last !== null) {
        /*
         * Check if minutes since last report exceed interval.
         */
        if (dateDiff(new Date(last), new Date(), 'Minutes') < getLocalStorage('remInterval'))
            return;
    }
    function processResponse(response) {
        setLocalStorage('remLast', (new Date()).toString());
        reporter.log('getReminderAlerts response ' + response);
    }
    ajaxLoggedInCall(defaultNull(server, 'Reminder'), processResponse, parameters, false);
}
function ajaxCall(destination, parameters, processResponse, async) {
    async = defaultNull(async, true);

    var stm = new Statistics(st.isEnabled());
    var xmlHttpRequest = getXMLHttpRequest();
    var params = parametersSummary(parameters);
    var tracker = new Tracker("Entered ajaxCall", true, async ? 'Asyn' : 'Sync');

    const process = function (request, comment, tracker) {
        var response = request.responseText;

        stm.logElapsed("Post");
        tracker.log("Process comment " + comment);

        if (response.indexOf('!Reminder') === 0) {
            var i = response.indexOf(';');

            if (i === -1)
                reporter.fatalError('Reminder response not terminated by ;');
            else {
                var reminder = response.substring(0, i);
                response = response.substring(i + 1);
                reportReminder(reminder);
            }
        }
        switch (request.status) {
            case 200:
                /*
                 * processResponse can be undefined if no client action is required.
                 * 
                 * If there is no processResponse and response has data log it. Perhaps should display an alert.
                 */
                if (processResponse !== undefined)
                    processResponse(response);
                else
                    console.log('No processResponse defined, but response has the following data-' + response);
                break;
            case 400:
                displayAlert('Server Error', response);
                break;
            case 410:
                console.log(response);
                displayAlert('Error', response);
                break;
            case 415:
                console.log(response);
                displayAlert('Application Error', response);
                break;
            default:
                alert("HTTP error " + request.status + ": " + response);
        }
    };
    if (typeof parameters === "function")
        params = parameters();
    else
        params = parameters;

    if (params === undefined)
        return;

    getReminderAlerts(destination, params);
    stm = new Statistics(st.isEnabled());
    stm.log("Post to " + destination + ' parameters ' + parametersSummary(parameters));
    stm.setStart();
    xmlHttpRequest.open("POST", destination + "?" + params, async);
    xmlHttpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    if (async) {
        xmlHttpRequest.onreadystatechange = function () {
            tracker.log("State changed to " + xmlHttpRequest.readyState);

            if (xmlHttpRequest.readyState === 4)
                process(xmlHttpRequest, "asynchronous path", tracker);
        };
    }
    tracker.log("Before send");
    xmlHttpRequest.send(null);
    tracker.log("After send");

    if (!async)
        process(xmlHttpRequest, "synchronous path", tracker);

    tracker.log("Exit ajaxCall");
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
function setReadOnly(name, yes) {
    var element = getElement(name);

    element.readOnly = yes;
}

function setLabel(name, caption) {
    document.getElementById(name).innerHTML = caption;
}

function trim(str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

function setDate(did) {
    var date = new Date();

    did = getElement(isNull(did)? 'date' : did);

    if (trim(did.value) === "") did.value = currentDate(date);
}
function setTime(tid) {
    var date = new Date();

    tid = getElement(isNull(tid)? 'time' : tid);

    if (trim(tid.value) === "") tid.value = currentTime(date);
}
function setDateTime(did, tid) {
    setDate(did);
    setTime(tid);
}
function loadDateTime(fields, date, time) {
    if (typeof fields === 'string')
        fields = fields.split(' ');

    document.getElementById(date === undefined ? "date" : date).value = fields.length > 0 ? fields[0] : "";
    document.getElementById(time === undefined ? "time" : time).value = fields.length > 1 ? fields[1] : "";
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
function getPairedParameter(pairs, name, value) {
    
    let flds = name.split('~');

    switch (flds.length) {
        case 1:
            return false;
        case 2:            
            let pair = pairs.get(flds[0]);

            if (pair === undefined) {
                pairs.set(flds[0], {name1: flds[1], elm1: value});
            } else {
                pair.name2 = flds[1];
                pair.elm2 = value;
            }
            return true;
        default:
            throw 'Paired field name ' + name + ' incorrectly formatted';
    }
}
/*
 * action  The action to which the parameters apply.
 * flds    A map the paremeters. The key is the parameter name and value is the input element.
 * 
 * Returns a string containing the parameters.
 */
function createParameters(action, options) {
    var options    = new createParametersOptions(options);
    var parameters = addParameter('', 'action', action);
    var pairs      = new Map();

    function addValue(name, value, mod) {
        value = mod === null ? value : mod(name, value);

        parameters = addParameter(parameters, name, value);
    }
    parameters = addParameter(parameters, 'mysql', getMYSQL());

    if (options.initialParams !== null) {
        for (var p of options.initialParams) {
            addValue(p.name, p.value, options.modifier);
        }
    }
    if (options.fields !== null) {
        for (let [name, element] of options.fields) {
            if (!getPairedParameter(pairs, name, element))
                addValue(name, getValue(element), options.modifier);
        }
    }
    for (let [name, values] of pairs) {
        if (!values.name1 === 'Date' || !values.name2 === 'Time')
            throw 'Paired field name ' + name + ' not implemented for fields ' + values.name1 + ' and ' + values.name2;
        addValue(name, (trim(getValue(values.elm1) + ' ' + getValue(values.elm2))), options.modifier);
    }
    return parameters;
}
function addDBFilterField(filter, element, name, qualifier) {
    if (name === undefined)
        return filter;

    var value = typeof element === 'object' ? element.value : element;
    var fields = value.split(',');
    var i;

    if (filter === undefined)
        filter = '';
    if (value === '')
        return filter;

    for (i = 0; i < fields.length; i++) {
        if (i === 0) {
            if (filter !== '')
                filter += ',';

            filter += name + '=';
        } else
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
function addDBFilterTodayField(filter, name) {
    return addDBFilterField(filter, getDayText(), name);
}
function getList(server, options, returnResponse) {
    let parameters = createParameters('getList');
    let save;

    if (options.async === undefined)
        options.async = false;

    options = new getListOptions(options);
    parameters = addParameter(parameters, 'field', options.field === undefined ? options.name : options.field);

    if (options.table !== undefined)
        parameters = addParameter(parameters, 'table', options.table);

    if (options.filter !== undefined && options.filter !== '')
        parameters = addParameter(parameters, 'filter', options.filter);

    function processResponse(response) {
        let elm = options.element === null ? options.name : options.element;
        
        if (returnResponse !== undefined && returnResponse) save = response;
        
        if (elm !== null && elm !== '') loadSelect(elm, response, options);
    }
    ajaxLoggedInCall(server, processResponse, parameters, options.async);
    return save;
}
