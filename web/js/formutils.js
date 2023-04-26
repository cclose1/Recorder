'use strict';
class elementMover {
    _tag;
    _isDown;
    _stScrX;
    _stScrY;
    _crScrX;
    _crScrY;
    _offsetX;
    _offsetY;
    _elm;
    
    constructor(tag) {
        this._tag    = tag;
        this._isDown = false;
    }    
    mouseStart(event) {
        this._isDown  = true;
        this._stScrX  = event.screenX;
        this._stScrY  = event.screenY;
        this._crScrX  = event.screenX;
        this._crScrY  = event.screenY;
        this._offsetX = this._elm.offsetLeft - event.clientX;
        this._offsetY = this._elm.offsetTop  - event.clientY;
    };
    mouseMove(event) {
        if (!this._isDown) return false;
        
        this._elm.style.left = (event.clientX + this._offsetX) + 'px';
        this._elm.style.top  = (event.clientY + this._offsetY) + 'px';
        this._ctScrX         = event.screenX;
        this._ctScrY         = event.screenY;
        return true;
    }
    mouseUp() {
        this._isDown = false;
    }
    mouseClear() {
        this._isDown = false;
    }
    move(event) {
        var result = true;
        
        event.preventDefault();
        this._elm = event.currentTarget;
        
        switch (event.type) {
            case 'mousedown':
                trace(event, true);
                result = this.mouseStart(event);
                break;
            case 'mousemove':
                result = this.mouseMove(event);
                
                if (result) traceAlertDiv(false);
                
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
 * object can be one of the following:
 *  Object         Element
 *  undefined    event.target
 *  null              "
 *  empty string      "
 *  string       Element for object string or null if no element for object
 *  otherwise    object
 *  
 * withValue     undefined or false element is returned, otherwise returns a structure, with the element, its value as a string which is
 *               empty if value element value is undefined and empty set to true if value is the empty string.
 */
function getElement(object, withValue) {
    var elm = object;
    
    if (object === undefined || object === null)
        elm = event.target;
    else if (typeof object === 'string') { 
        if (trim(object) === '')
            elm = event.target;
        else
            elm = document.getElementById(object);
    }    
    var val = elm === null || elm.value === undefined? "" : trim(elm.value);
    
    if (withValue === undefined || !withValue) return elm;
    
    return {
        elm:   elm,
        value: val,
        empty: val.length === 0
    };
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
    var base    =  document.getElementsByTagName('base');
    var baseURI;
    
    if (base.length !== 0)
        baseURI = base[0].href;
    else {
        var flds = window.location.href.split("/"); 
        
        delete flds[flds.length - 1]; 
        baseURI = flds.join("/");
    }
    return baseURI;
}
function addStyleSheetToiFrame(iFrame, file) {    
    iFrame   = getElement(iFrame);
    
    var frameDoc = (iFrame.contentWindow || iFrame.contentDocument).document;
    var links    = frameDoc.getElementsByTagName('link');
    var link;
    
    file = getFileRoot() + file;
    /*
     * Check to see if link already present and return if it is.
     * 
     * Note: Adding the link more than once does not seem to cause a problem.
     */
    for (var i = 0; i < links.length; i++) {
        if (links[i].href === file) return;
    }
      
    link      = document.createElement("link");
    link.href = file;
    link.rel  = "stylesheet";
    link.type = "text/css";
    
    frameDoc.head.appendChild(link);
}
/*
 * Returns an array of the elements children. If tagName is defined only children with tagName are returned.
 */
function getChildren(element, tagName) {
    var children = [];
    
    for (var i = 0; i < element.childElementCount; i++) {
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
function getParameter(value, defaultValue) {
    return value === undefined? defaultValue : value;
}
function ErrorObject(name, message) {
    this.name    = name;
    this.message = message;
    
    this.getName = function() {
        return this.name;
    };
    this.getMessage = function() {
        return this.message;
    };
    if (message === undefined) {
        this.message = name;
        this.name    = '';
    }
}
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
function rpad(text, length, pad) {
    text = text.toString();
    
    while (text.length < length)
        text = text + (pad === undefined? ' ' : pad);

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
        if (time.length === 1) time[1] = '0'; // Note: this extends the array and sets minutes to 0.
        if (time.length === 2) time[2] = '0';
        if (time.length > 3) throw "Invalid time format - too many fields";
        /*
         * Validete and convert time fields to numberic.
         */
        for (let i = 0; i < time.length; ++i) {
            time[i] = time[i].trim() === "" ? 0 : toNumber(time[i], 0, i === 0 ? 23 : 59);
        }
    } catch(err){
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
    if (timestamp === undefined || timestamp === null || timestamp === '') return new Date();
    if (timestamp instanceof Date) return timestamp;
    
    var months  = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var date    = timestamp.split(new RegExp("[/\-]"));
    var time    = new Array(0, 0, 0);
    var errName = "Date";
    
    try {        
        if (date.length !== 3) throw "Invalid date format";
        /*
         * Check to see if the date is followed by a time field. First remove any leading spaces from the final date field.
         */
        date[2] = trim(date[2]);
        
        var i = date[2].indexOf(' ');
        
        if (i !== -1) {
            /*
             * There is a time field.
             */
            errName = "Time";
            
            if (notime !== undefined && notime) throw "Time present in date only field";
            
            time    = toTime(date[2].substring(i + 1));
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
            var y = date[0];

            date[0] = date[2];
            date[2] = y;
        }
        if (date[2] < 100) date[2] += 2000;
        
        for (var i = 0; i < months.length; i++) {
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
        var datetime = new Date('1901-01-01');

        datetime.setFullYear(date[2]);
        datetime.setMonth(date[1]);
        datetime.setDate(date[0]);        
        datetime.setHours(time[0], time[1], time[2], 0);
        /*
         * The above set functions updates the next field if the value is out of range for the current one, e.g. 2022 08 33
         * results in 2022 09 2. Read back the fields to check the values have not changed. This is not necessary for the time
         * fields as they have already been checked to be in the correct range.
         */
        if (datetime.getFullYear() !== date[2] || datetime.getMonth() !== date[1] || datetime.getDate() !== date[0]) throw "Invalid date format";

        if (isNaN(datetime.getTime()))
            throw "Invalid datetime format";

        return datetime;
    } catch (err) {
        if (err instanceof ErrorObject) throw err;
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
    var timestamp = '';
    var tm        = null;    
    var opts      = new validateDateTimeOptions(options);
    var result    = {
        valid: false,
        value: undefined,
        empty: true
    };
    var dt = getElement(did, true);
    var tm = tid !== undefined && tid !== null ? getElement(tid, true) :  { elm: null, value: '', empty: true};
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
    } catch(e) {
        var elm = e.getName() === 'Time' && tm.elm !== null ? tm.elm : dt.elm;
        
        displayAlert('Field Error', e.message + " on " + getElementLabel(elm), {focus: elm});
    }
    return result;
}
function dateDiff(from, to, units) {
    var scale;
    
    if (units === undefined) units = 'Seconds';
    
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
    
    if (source === null || source === undefined) source = new Date();
    
    if (typeof source === 'String') source = toDate(source);
    
    if (source instanceof Date)
        time = source.toString().split(" ")[4];
    else
        time = lpad(source[0], 2, '0') + ':' + lpad(source[1], 2, '0') + ':' + lpad(source[2], 2, '0');
    
    if (milliseconds !== undefined && milliseconds) time += '.' + lpad(source.getMilliseconds(), 3, '0');
    
    return time;
} 
function dateTimeString(date) {    
    return dateString(date) + ' ' + timeString(date);
}
function getDateTime(date) {
    if (date === null || date === undefined) date = new Date();
    
    return dateTimeString(toDate(date));
}
function getDayText(date, long) {
    var value = 'Invalid';
    
    switch (toDate(date).getDay()) {
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
    if (long === undefined || !long) return value.substring(0, 3);
    
    return value;
}
function checkDate(elm, required) {
    return validateDateTime(elm, null, {required: required, notime: true}).valid;
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
        view:       window,
        bubbles:    true});
    }
    getElement(element).dispatchEvent(event);
}
function addIEFixClass(elements) {
    if (platform.name !== 'IE') return;
    
    elements.forEach(function(element) {
        getElement(element).classList.add("iefix");
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
function setLocalStorage(id, value) {
    if (value === undefined || value === null)
        localStorage.removeItem(id);
    else
        localStorage.setItem(id, value);
}
function getLocalStorage(id) {
    var val = localStorage.getItem(id);
    
    if (val === 'true')  return true;
    if (val === 'false') return false;
    
    return val;
}
function Reporter() {
    function output(action, message) {
        switch (action) {
            case 'log':
                console.log(timeString(null, true) + ' ' + message);
                break;
            case 'error':
                console.error(timeString(null, true) + ' ' + message);
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
    this.logEnabled  = getLocalStorage('browserlog');
   
    this.setFatalAction = function(action) {
        this.fatalAction = action;
    };
    this.fatalError = function(message) {
        output(this.fatalAction, message);
    };
    this.log = function(message) {
        if (this.logEnabled) output('log', message);
    };        
    this.logThrow = function(exception, showAlert) {
        if (showAlert) alert(exception.name + '-' + exception.message);
        
        console.error(exception);
    };
}
var reporter = new Reporter();

function createUID(length, prefix) {
    return (prefix === undefined? '' : prefix) + randomString(length);
}
function Timer(counter, previous) {
    this.current  = counter;
    this.previous = previous;
    this.startTime;
    this.upd      = setInterval(updateTimer, 1000, this);
    
    function updateTimer(obj) {
        if (obj.current !== undefined && obj.current.value !== '') {
            var count = parseInt(obj.current.value) + 1;
            var gap   = dateDiff(obj.startTime, null);
            
            if (gap - count > 3) {
                reporter.log('Timer update slow count is ' + count + ' gap ' + gap);
                count = gap;
            }
            obj.current.value = count;
        }
    };
    this.start = function() {
        if (this.previous !== undefined) this.previous.value = this.current.value;
        
        this.current.value = 0;
        this.startTime     = new Date();
    };
    
}
function Statistics(enabled) {
    this.start;
    this.id         = createUID(3);
    this.logEnabled = enabled === undefined? getLocalStorage('browserlog') : enabled;
    
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
        if (this.logEnabled) console.log(timeString(this.start, true) + ' ' + this.id + ' ' + message);
    };
    this.logElapsed = function(action) {
        this.log(action + ' took ' + this.elapsed() + ' ms');
    };
}
var st = new Statistics();
/*
 * The following 2 function provide a workaround for the older versions of javascript that don't support the constuctor object element.
 */
function getObjectName(obj) {
    var name = obj.constructor.name;
    
    return name === undefined? obj.fixedName : name;
}
function setObjectName(obj, name) {
    if (obj.constructor.name === undefined) obj['fixedName'] = name;
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
    this.optSpecs    = [];
    this.accessByGet = pAccessByGet;
    
    function error(options, message) {
        reporter.fatalError(getObjectName(options) + ' ' + message);
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
        if (spec === null) {
            error(options, 'Option "' + name + '" is not defined');
            return;
        }
        
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
        if (values !== undefined) {
            for (name in values) {
                if (ignoreUndefined !== undefined && ignoreUndefined) {
                    /*
                     * Check if parameter not defined and return if it is. This prevents loadOption failing.
                     */
                    if (getSpec(this, name) === null)  continue;
                }
                loadOption(this, name, values[name]);
            }
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
    this.allowedOptionName = function(name) {
        if (this.accessByGet) return true;
        
        var test = eval('this.' + name);
        
        return test === undefined;
    };
    this.addSpec = function(option) {
        var spec = {};
        
        spec.name = option.name;
        
        if (spec.name === undefined || spec.name === null)  error(this, 'Option must have a name property');
        
        if (!this.allowedOptionName(option.name)) error(this, 'Option name ' + option.name + ' is not allowed');
        
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
    this.error = function(msg) {
        error(this, msg);
    };
    this.log = function() {
        var spec;
        
        console.log(getObjectName(this));
        
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
function UnitConvert(pOptions) { 
    BaseOptions.call(this, false);
    
    setObjectName(this, 'UnitConvert');
    this.addSpec({name: 'source',      type: 'string',  mandatory: true});
    this.addSpec({name: 'target',      type: 'string',  mandatory: true});
    this.addSpec({name: 'multiplier',  type: 'number',  mandatory: true});
    this.addSpec({name: 'description', type: 'string',  mandatory: false});
    this.addSpec({name: 'isVolume',    type: 'boolean', default: false, mandatory: false});
        
    this.clear();
    this.load(pOptions);    
}

function ConvertUnitsO() {
    BaseOptions.call(this, false);
    
    var base = undefined;
    
    this.conversions = [];
    /*
     * Returns the entry in conversions for source and target. If one exists for target and source it is returned with the reciprocal multipler
     * for source and target and a appropiate description.
     * 
     * Note: Given the reverse check, the returned conversion may not be in conversions.
     */
    function get(conversions, source, target) {
        var conversion = null;
        
        for (var i = 0; i < conversions.length; i++) {
            conversion = conversions[i];
            
            if (conversion.source === source && conversion.target === target) return conversion;
            
            if (conversion.target === source && conversion.source === target) 
                return new UnitConvert(
                    {source:      source, 
                     target:      target, 
                     isVolume:    conversion.isVolume, 
                     multiplier:  1 / conversion.multiplier,
                     description: source + ' to ' + target});
        }
        return null;
    }
    function add(conversions, conversion) {
        var conv = get(conversions, conversion.source, conversion.target);
        
        if (conv !== null) {
            if (conv.isVolume !== conversion.isVolume && conv.multiplier !== conversion.multiplier && conv.description !== conversion.description) 
                throw ErrorObject('Adding conversion for source ' + conversion.source + ' to target ' + conversion.target + ' would change an existing conversion');
            else
                return;
        }
        conversions.push(conversion);
    }
    if (base === undefined) {
        base = [];
        add(base, new UnitConvert({source: 'gm', target: 'ml', isVolume: false, multiplier: 1, description: 'gm to ms'}));
    }
    this.addConversion = function(conversion) {
        var conv = get(base, conversion.source, conversion);
        
        if (conv === null) add(this.conversions, new UnitConvert(conversion));
    };
    this.getConversion = function(source, target){
        var cv = get(base, source, target);
        
        if (cv !== null) return cv;
        
        return get(this.conversions, source, target);
    };
}
function reportReminder(options) {
    var opts = options.split(',');
    
    if (opts.length !== 3)
        reporter.fatalError('Invalid reminder options-' + options);
    else {
        var interval = getLocalStorage('remInterval');
        var last     = getLocalStorage('remLast');
        var earliest = null;
        var lastDt   = null;
        var days;
        var hours;
        
        if (interval === null) {
            reporter.log('Local storage initialised');
            setLocalStorage('remInterval', interval);
        } else {
            lastDt = new Date(last);  // Don't use toDate in this case 
            reporter.log('Reminder received-Last report time ' +  lastDt.toTimeString());            
        }
        interval = opts[1];
        earliest = toDate(opts[2]);
        hours    = dateDiff(new Date(), earliest, 'Hours');

        if (lastDt === null || dateDiff(lastDt, new Date(), 'Minutes') > interval) {
            var due;
            var state = opts[0] === '!ReminderImmediate'? 'URGENT' : 'current';
            
            days  = Math.floor(hours / 24);
            hours = Math.floor(hours - 24 * days);
            
            if (days === 0)
                due = hours + ' hours';
            else if (days === 1)
                due = days + ' day ' + hours + ' hours';
            else
                due = days + ' days';
            
            displayAlert('Warning',  'There are ' + state + ' reminders. Next due ' + due);
            reporter.log('Alert displayed. Earliest ' + getDateTime(earliest) + ' days ' + days + ' hours ' + hours);
            setLocalStorage('remInterval', interval);
            setLocalStorage('remLast',     (new Date()).toString());
        }
    }    
}
function JSONArrayColumnOptions(pOptions) {  
    BaseOptions.call(this, false);
    
    setObjectName(this, 'JSONArrayColumnOptions');
    this.addSpec({name: 'name',      type: 'string',  mandatory: true});
    this.addSpec({name: 'minWidth',  type: 'number',  mandatory: false});
    this.addSpec({name: 'maxWidth',  type: 'number',  mandatory: false});    
    this.addSpec({name: 'forceWrap', type: 'boolean', default: false, mandatory: false});

        
    this.clear();
    this.load(pOptions);    
}
function JSONArrayOptions(pOptions) {    
    BaseOptions.call(this, false);
    
    setObjectName(this, 'JSONArrayOptions');
    this.addSpec({name: 'maxField',      type: 'number',  default: null,  mandatory: false});
    this.addSpec({name: 'onClick',       type: 'string',  default: null,  mandatory: false});
    this.addSpec({name: 'nullToEmpty',   type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'useInnerCell',  type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'addColNoClass', type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'addName',       type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'usePrecision',  type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'columns',       type: 'object',  default: null,  mandatory: false});
    this.addSpec({name: 'widthAllRows',  type: 'boolean', default: false, mandatory: false});
        
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
    
    setObjectName(this, 'loadOptionsJSONOptions');
    this.addSpec({name: 'name',         type: null,      default: ''});   
    this.addSpec({name: 'element',      type: 'object',  default: null, mandatory: false});   
    this.addSpec({name: 'keepValue',    type: 'boolean', default: true});     
    this.addSpec({name: 'defaultValue', type: 'string',  default: ''});
    this.addSpec({name: 'allowBlank',   type: 'boolean', default: false});
        
    this.clear();
    this.load(pOptions, true);
}
loadOptionsJSONOptions.prototype = {    
    get name()         {return this.getValue('name');},
    get element()      {return this.getValue('element');},
    get keepValue()    {return this.getValue('keepValue');},
    get defaultValue() {return this.getValue('defaultValue');},
    get allowBlank()   {return this.getValue('allowBlank');}};
loadOptionsJSONOptions.prototype.constructor = loadOptionsJSONOptions;

function resizeFrame(id) {
    var elm    = getElement(id);
    var width  = elm.contentWindow.document.body.scrollWidth;
    var height = elm.contentWindow.document.body.scrollHeight;

    elm.width  = width  + "px"; 
    elm.height = height + "px";
}
function popUp() {
    var popUpDoc;
    var containerId;
    var popUpId;
    var appId;
    var frameId;

    this.initialise         = initialise;
    this.reset              = reset;
    this.display            = display;
    this.getElementById     = getElementById;
    this.getValueById       = getValueById;
    this.setValueById       = setValueById;
    this.getAppId           = getAppId;
    this.getContainerId     = getContainerId;
    this.getFrameId         = getFrameId;
    this.inDisplay          = inDisplay;
    this.setDocumentOnClick = setDocumentOnClick;
    
    function setSize(element, width, height) {
        var style = element.style;
        
        style.width  = width  + 'px';
        style.height = height + 'px';
    }
    function initialise(containerId, appId) {
        var home = document.getElementById(containerId);
        var body;
        
        this.containerId = containerId;
        this.popUpId     = containerId;
        this.appId       = appId === undefined ? 'appframe' : appId;

        if (home.tagName === 'IFRAME') {             
            this.popUpDoc    = document.getElementById(containerId).contentWindow.document;
            body             = this.popUpDoc.body;
            this.popUpId     = body.id !== ''? body.id : body.firstElementChild.id;
            this.frameId     = containerId;
            this.containerId = home.parentElement.id;
        } else {
            this.popUpId  = this.containerId;
            this.popUpDoc = document;
            this.frameId  = '';
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
        getElement(this.getContainerId()).style.top  = "";
        
        if (this.getFrameId() === '') {
            this.getElementById(this.popUpId).style.width  = "";
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
            
            if (minWidth  !== null && wd < minWidth)  wd = minWidth;
            if (minHeight !== null && ht < minHeight) ht = minHeight;
            
             if (this.frameId !== '')
                 setSize(document.getElementById(this.frameId),     wd, ht);
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
        var el =this/getElementById(id);
        
        if (el === null && ignoreIfNotFound !== undefined && ignoreIfNotFound) return;
        
        el.value = value;
    }
    function getFrameId() {
        return this.frameId;
    }
    function inDisplay(event) {
        var target    = event;
        var container = document.getElementById(this.containerId);
        var frame     = this.frameId !== ''? this.getElementById(this.popUpId) : undefined;
        
        while (target.parentNode) {
            if (target === container || frame !== undefined && target === frame) return true;
            
            target = target.parentNode;
        }
        return false;
    }
    function setDocumentOnClick(action) {
        document.onclick = action;
        
        if (this.frameId !== '') this.popUpDoc.onclick = action;
    }
}
function popUpOld() {
    var popUpDoc;
    var popUpTopId;
    var popUpId;
    var appId;
    var frameId;

    this.initialise         = initialise;
    this.reset              = reset;
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
    function getContainerId() {
        return this.popUpTopId;
    }
    /*
     * Set to initial state for a new alert. The only action required is to clear
     * the width and height for the popUpId element.
     */
    function reset() {
        getElement(this.getContainerId()).style.offsetLeft = "";
        getElement(this.getContainerId()).style.offsetTop  = "";
        
        if (getFrameId() === '') {
            getElementById(popUpId).style.width  = "";
            getElementById(popUpId).style.height = "";
        }
    }
    function getAppId() {
        return this.appId;
    }
    function display(yes, switchApp, minWidth, minHeight) {
        setHidden(this.popUpTopId, !yes);

        if (switchApp)
            setHidden(this.appId, yes);
        
        if (yes) {
            var pu = getElementById(popUpId);
            var wd = pu.offsetWidth;
            var ht = pu.offsetHeight;
            
            if (minWidth  !== null && wd < minWidth)  wd = minWidth;
            if (minHeight !== null && ht < minHeight) ht = minHeight;
            
             if (frameId !== '')
                 setSize(document.getElementById(frameId),         wd, ht, "0px 0px 0px 0px");
             else
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
        var container = document.getElementById(this.popUpTopId);
        var frame     = frameId !== ''? getElementById(popUpId) : undefined;
        
        while (target.parentNode) {
            if (target === container || frame !== undefined && target === frame) return true;
            
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
    this.forceWrap = false;
    
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
 co1nstructor(row, throwError) {
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
/*
 * Returns the caption for element. If this is null it establishes a value in the following order:
 *  - If the parent is fieldset and it has caption its value is returned.
 *  - if the element has a name attribute its value is returned.
 *  - The elements id is returned.
 */
function getCaption(element) {
    var parent = element.parentNode;
    var children;
    
    if (element.caption !== null) return element.innerHTML;
    
    if (parent.tagName === 'FIELDSET') {
        children = getChildren(parent, 'LEGEND');
        
        if (children.length > 0) return children[0].innerHTML;
    }
    return element.id;
}
function rowReader(row, throwError) {
    this.row        = row;
    this.index      = -1;
    this.header     = document.getElementById(this.row.parentNode.parentNode.id).rows[0];
    this.table      = this.header.parentNode.parentNode;
    /* 
     * This stopped working, need to investigate why. The ne version is a workaround.
    this.caption    = this.table.caption.innerHTML;
     */
    
    this.caption    = getCaption(this.table);
    this.throwError = throwError === undefined ? false : throwError;

    function reportError(obj, message) {
        if (obj.throwError) 
            throw Error(message);
        else
            alert(message);        
    }
    this.check = function() {
        if (this.index >= this.header.cells.length) 
            reportError(this, "Attempt to read beyond last column. There are " + this.header.cells.length + " columns");    
    };
    this.selectColumn = function(name) {
        for (this.index = 0; this.index < this.header.cells.length; this.index++) {
            if (this.header.cells[this.index].innerHTML === name) return true;
        }
        reportError(this, "Column " + name + " is not in table " + this.caption);
        return false;
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
    this.valueAttribute = function(name) {
        return this.row.cells[this.index].getAttribute(name);
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
    this.getColumnValue = function(name) {
        if (this.selectColumn(name)) return this.columnValue();
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
                col.minWidth  = ocol.minWidth;
                col.maxWidth  = ocol.maxWidth;
                col.forceWrap = ocol.forceWrap;
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
function loadJSONArrayOld(jsonArray, id, options) {
    
    if (getObjectName(options) !== 'JSONArrayOptions') options = new JSONArrayOptions(options);
    
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
                var minWidth = null;
                var maxWidth = options.maxField;
                
                if (options.usePrecision)  minWidth = col.precision;
                if (col.minWidth !== null) minWidth = col.minWidth;
                if (col.maxWidth !== null) maxWidth = col.maxWidth;
                
                if (minWidth !== null && maxWidth !== null && minWidth > maxWidth) minWidth = maxWidth;
                
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
        st.log('Table ' + id + ' has ' + table.rows.length + ' rows max rows ' + maxRowSize);
        st.logElapsed("Set table sizes");
    } catch (e) {
        reporter.logThrow(e, true);;
    }
}
function cellReplace(cell, from, to) {
    cell.innerHTML = cell.innerHTML.split(from).join(to);
}
function stringToJSON(jsonData) {
    if (typeof jsonData === 'string') jsonData = (new JSONReader(jsonData)).getJSON();
    
    return jsonData;
}
function loadJSONArray(jsonArray, id, options) {    
    if (options === undefined || getObjectName(options) !== 'JSONArrayOptions') options = new JSONArrayOptions(options);
    
    try {
        var maxRowSize = 0;
        var table      = document.getElementById(id);
        var json       = stringToJSON(jsonArray);
        var jval;
        var cols;
        var row;

        clearTable(table);
                
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
                var col        = cols[i];
                var cell       = row.cells[i];
                var width      = null;
                var minWidth   = null;
                var maxWidth   = options.maxField;
                var forceWidth = false;
                var value      = cell.innerHTML;
                var style      = null;
                    
                if (options.usePrecision)  minWidth = col.precision;
                if (col.minWidth !== null) minWidth = col.minWidth;
                if (col.maxWidth !== null) maxWidth = col.maxWidth;

                if (minWidth !== null && maxWidth !== null && minWidth > maxWidth) minWidth = maxWidth;

                if (col.size <= minWidth && minWidth !== null) {
                    width    = minWidth;
                } else if (col.size < maxWidth || maxWidth === null) {
                    width    = col.size;
                } else {
                    width    = maxWidth;
                }
                rowSize += width;
                style    = 'width:' + getWidth(width, 'em');
                
                if (value.length > width) {
                    forceWidth = true;
                    
                    if (col.forceWrap || value.indexOf(' ') === -1) style += ';word-break: break-all';
                }
                if (j <= 1 || options.widthAllRows || forceWidth) cell.setAttribute("style", style);
                
                if (col.getClass() !== '') cell.setAttribute('class', col.getClass());
                if (options.addName)       cell.setAttribute('name',  col.name);
                /*
                 * Calculate total width. Only accessed in debugging.
                 */
                if (rowSize > maxRowSize) maxRowSize = rowSize;
            }
        }
        st.log('Table ' + id + ' has ' + table.rows.length + ' rows max rows ' + maxRowSize);
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
        
        if (options.element === null && options.name === '') return; // No list element to load values.
        
        var json    = jsonOptions;
        var select  = getElement(options.element === null? options.name : options.element);
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
                addOption(select, trim(option));
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

    if (date === undefined) date = new Date();

    return lpad(date.getDate(), 2, '0') + '-' + mthNames[date.getMonth()] + '-' + lpad(date.getFullYear(), 2, '0');
}
function currentTime(date) {
    if (date === undefined) date = new Date();

    return lpad(date.getHours(), 2, '0') + ':' + lpad(date.getMinutes(), 2, '0') + ':' + lpad(date.getSeconds(), 2, '0');
}
function currentDateTime(date) {
    if (date === undefined) date = new Date();

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
/*
 * Returns the label for HTML element elm.
 * 
 * If the preceding element is a label and it is for elm.id return its value, otherwise, return elm.name as label.
 */
function getElementLabel(elm) {
    var prelm;
    
    elm   = getElement(elm);    
    prelm = elm.previousElementSibling;
    
    if (prelm.tagName === "LABEL" && prelm.htmlFor === elm.id) return prelm.innerHTML;
    
    return elm.name;
}
function getFloatValue(elm, defaultValue) {  
    var value = parseFloat(getElement(elm).value);
    
    return isNaN(value) && defaultValue !== undefined && defaultValue !== null? defaultValue : value;
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
   
   return value !== undefined;
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
        
        smy += (smy === ''? '' : ',') + decodeURIComponent(ps[i]);
    }
    return smy;
}
function ajaxCall(destination, parameters, processResponse, async) {
    var stm            = new Statistics(st.isEnabled());
    var xmlHttpRequest = getXMLHttpRequest();
    var params         = parametersSummary(parameters);

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
                var response =xmlHttpRequest.responseText;
                
                stm.logElapsed("Post");
                
                if (response.indexOf('!Reminder') === 0) {
                    var i = response.indexOf(';');
                    
                    if (i === -1) reporter.fatalError('Reminder response not terminated by ;');
                    else {
                        var reminder = response.substring(0, i);
                        response = response.substring(i + 1);
                        reportReminder(reminder);
                    }
                }
                processResponse(response);
            } else {
                alert("HTTP error " + xmlHttpRequest.status + ": " + xmlHttpRequest.responseText);
            }
        }
    };
    stm = new Statistics(st.isEnabled());
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
    
    if (did === undefined) did = 'date';
    
    if (trim(document.getElementById(did).value) === "") {
        document.getElementById(did).value = currentDate(date);
    }
}
function setTime(tid) {
    var date = new Date();
    
    if (tid === undefined) tid = 'time';
    
    if (trim(document.getElementById(tid).value) === "") {
        document.getElementById(tid).value = currentTime(date);
    }
}
function setDateTime(did, tid) {
    setDate(did);
    setTime(tid);
}
function loadDateTime(fields, date, time) {
    if (typeof fields === 'string') fields = fields.split(' ');
    
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
    
    parameters = addParameter(parameters, 'mysql', getMYSQL());
    
    return parameters;
}
function addDBFilterField(filter, element, name, qualifier) {
    if (name === undefined) return filter;
    
    var value  = typeof element === 'object'? element.value : element;
    var fields = value.split(',');
    var i;
    
    if (filter === undefined) filter = '';
    if (value  === '') return filter;
    
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
function addDBFilterTodayField(filter, name) {
    return addDBFilterField(filter, getDayText(), name);
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
        loadListResponse(response, options);
        
        if (returnResponse !== undefined && returnResponse) save = response;
    }
    ajaxLoggedInCall(server, processResponse, parameters, options.async);
    return save;
}
