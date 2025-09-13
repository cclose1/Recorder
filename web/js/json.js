'use strict';
/*
 * 
 * @param {type} text containing json formatted string.
 * @returns {JSONReader}
 * 
 * Contains methods for unpacking the json string.
 */
function JSONReader(text) {
    this.text   = text;
    this.index  = 0;
    this.value  = null;
    this.type   = null;
    this.quoted = false;
    
    function reportError(reader, message) {
        reporter.fatalError('JSONReader at offset ' + reader.index + 'Error-' + message);
    }
    /*
     * 
     * @param {type} allowed
     * @returns {Boolean} Returns true if a json field has been found.
     * 
     * Reads up to the next separator character in {}[],:
     * 
     * Value  is set to the string value up to the separator character, or undefined if there is none, i.e. consecutive separators.
     *        White space is ignored, except when it occurs within a quoted string.
     * Quoted is set to true if the field is a quoted string, quotes are omitted from value. 
     * Type   is set to the separator character.
     */
    this.next = function(allowed) {
        var inString = false;
        var start    = this.index;

        this.type   = null;
        this.value  = undefined;
        this.quoted = false;

        if (this.index >= this.text.length)
            return false;

        while (this.index < this.text.length) {
            var ch = this.text.charAt(this.index++);

            if (inString) {
                if (ch === '"') {
                    inString = false;
                    continue;
                }
                if (ch === '\\') {
                    ch = this.text.charAt(this.index++);

                    switch (ch) {
                        case 'r' :
                            ch = '\r';
                            break;
                        case 'n' :
                            ch = '\n';
                            break;
                        case 't' :
                            ch = '\t';
                            break;
                        case 'b' :
                            ch = '\b';
                            break;
                        case 'f' :
                            ch = '\f';
                            break;
                    }
                }
                this.value += ch;
            } else if ("{}[],:".indexOf(ch) !== -1) {
                this.type = ch;

                if (allowed !== undefined && allowed.indexOf(ch) === -1)
                    reportError(this, ch + " is not in the allowed list " + allowed);
                return true;
            } else {
                if (ch === '"') {
                    if (this.value !== undefined)
                        reportError(this, "quoted string must have quote as first character");

                    inString = true;
                    this.quoted = true;
                    this.value = "";
                } else if (" \t\r\n\f".indexOf(ch) === -1) {
                    if (this.quoted)
                        reportError(this, "quoted string not allowed characters after closing quote");

                    if (this.value === undefined)
                        this.value = ch;
                    else
                        this.value += ch;
                }
            }
        }
        if (inString)
            reportError(this, "Unterminated string starting at " + start);
        return false;
    };
    /*
     * 
     * @returns a data structure with following fields:
     *      first      True if this is the first symbol in the json string, which should be the separator }.
     *      separator  Single character terminating the symbol.
     *      name       The name of an object member.
     *      value      Value of the element or member, or undefined it there is none, i.e. consecutive separators. 
     * 
     * Null is returned if the end of the json string has already been reached.
     */
    this.symbol = function() {
        var name  = null;
        var value = undefined;
        var first = this.index === 0;
        var separator;
        
        while (this.next('{}[]:,')) {
            value     = this.value;
            separator = this.type;
            
            if (separator !== ':') {
                if (!this.quoted && value !== undefined) {
                    /*
                     * For none string values convert the string representation to appropriate javascript type.
                     */
                    switch (value) {
                        case 'true':
                            value = true;
                            break;
                        case 'false':
                            value = false;
                            break;
                        case 'null':
                            value = null;
                            break;
                        default:
                            value = Number(value);
                    }
                }
                return {
                    first:     first,
                    name:      name,
                    value:     value,
                    separator: separator};
            }
            name  = value;
            value = undefined;
        }
        return null;
    };
    /*
     * Return the JSON object for the current json string.
     * 
     * type should be omitted on first call or be set to 'object'
     */
    this.getJSON = function(type) {
        var result = new JSONcbc(type === 'undefined'? 'object' : type);
        var exit   = false;
        var symbol;
        
        while ((symbol = this.symbol()) !== null && !exit) {
            switch (symbol.separator) {
                case '{':
                    if (!symbol.first) symbol.value = this.getJSON('object');
                    break;
                case '[':
                    /*
                     * Strictly speaking JSON data should start with {. This allows JSON data that omits
                     * the enclosing {}.
                     */
                    if (symbol.first)
                        result = new JSONcbc('array');
                    else
                        symbol.value = this.getJSON('array');
                    break;
                case '}':
                case ']':
                    exit = true;
                    break;
            }
            if (symbol.value !== undefined) {
                if (symbol.name !== null)
                    result.addMember(symbol.name, symbol.value);
                else
                    result.addElement(symbol.value);
            }
            if (exit) break;
        }
        return result;
    };
};
/*
 * Was called JSON. However, this caused a problem as there is an existing class called JSON which is
 * used by other packages such as Chart js.
 */
function JSONcbc(type) {
    this.json   = '';
    this.type   = type === undefined? 'object' : type;
    this.values = [];
    this.index  = -1;
    
    function addQuote(value, quote) {
        if (!quote) return value;
        
        if (value === null)             return 'null';
        if (typeof value === 'string')  return '"' + value + '"';
        if (typeof value === 'boolean') return value? 'true' : 'false';
        
        return value;
    }
    function getValue(json, internal) {
        var value  = json.value;
        var result = {type: 'simple', name: json.name === undefined? null : json.name};
        
        if (value === undefined || value === null)
            result.value = addQuote(null, !internal);
        else {
            switch (typeof value) {
                case 'string':
                    result.value = addQuote(value, !internal);
                    break;
                case 'number':
                    result.value = value;
                    break;
                case 'boolean':
                    result.value = value;
                    break;
                case 'object':
                    result.type         = value.type === undefined ? 'object' : value.type;
                    result.isJSONObject = value.type !== undefined;
                    result.value        = value;
                    break;
                default:
                    reporter.fatalError("Javascript type '" + typeof value + "' not supported");
            }
        }
        return result;
    }
    function checkIndex(json, idx, next, error) {
        if (idx === undefined) idx = json.index;
        if (next) idx += 1;
        
        var valid = idx >= 0 && idx < json.values.length;
        
        if (!valid && (error === undefined || error)) reporter.fatalError("Index " + idx + " not within values");
        
        return valid;
    };
    this.setFirst = function() {
        this.index = -1;
    };
    this.isNext = function() {
        return checkIndex(this, undefined, true, false);
    };
    this.next = function() {
        checkIndex(this, undefined, true, true);
        
        return getValue(this.values[++this.index], true);
    };
    this.valueByIndex = function(index) {        
        checkIndex(this, index, false, true);
        
        return getValue(this.values[index], true);
    };
    this.addMember = function(name, value) {
        if (this.type === 'array') reporter.fatalError('JSON addMember is not valid for an array');
        
        this.values.push({name: name, value: value});      
    };
    this.getMemberCount = function() {
        /*
         * Don't why this check was made as it is meaningful for an array. Perhaps the name could
         * be misleading as an array is a list of objects
        if (this.type === 'array') reporter.fatalError('JSON getMemberCount is not valid for an array');
        */
        return this.values.length;
    };
    this.getMember = function(name, mustExist) {
        if (this.type === 'array') reporter.fatalError('JSON getMember is not valid for an array');
        
        if (isNaN(name)) {
            for (var i = 0; i < this.values.length; i++) {
                if (this.values[i].name === name) return getValue(this.values[i], true);
            };
            if (mustExist === undefined || mustExist) 
                reporter.fatalError('JSON object does not have a member with name-' + name);
            else
                return {type: 'simple', name: name, value: null};
        } else {
            if (name < 0 || name >= this.values.length) reporter.fatalError('JSON object index ' + name + ' is invalid');
            
            return getValue(this.values[name], true);
        }            
    };
    this.addElement = function(value) {
        if (this.type === 'object') reporter.fatalError('JSON addElement is not valid for an object');
        
        this.values.push({value: value});      
    };
    this.toString = function() {
        var string = this.type === 'object' ? '{' : '[';

        for (var i = 0; i < this.values.length; i++) {
            var jval = this.values[i];
            var val  = getValue(jval, false);

            if (i !== 0)
                string += ',';

            if (this.type === 'object')
                string += '"' + val.name + '":';

            if (val.type === 'simple')
                string += val.value;
            else
                string += val.value.toString();
        }
        string += this.type === 'object' ? '}' : ']';
        
        return string;
    };
    if (this.type !== 'object' && this.type !== 'array') reporter.fatalError("JSON type '" + this.type + "' is invalid");    
}
