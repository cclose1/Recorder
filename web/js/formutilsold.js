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
    return Object.getOwnPropertyNames(object).filter(function(property) {
        return typeof object[property] === 'function';
    });
}
function getXMLHttpRequest() {
    var xmlhttp = null;
    
    if (window.XMLHttpRequest) {
        xmlhttp = new XMLHttpRequest();
    }
    else if (window.ActiveXObject) {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    else {
        alert("Your browser does not support XMLHTTP!");
    }
    return xmlhttp;
}  
function addSectionRow(object, data) {
    var fields = data.split("|");
    var row    = object.insertRow(object.rows.length);
    
    for (var i = 0; i < fields.length; i++) {
        var properties = fields[i].split("!");
        var cell       = row.insertCell(i);
        
        cell.innerText = properties[0];
        
        for (var j = 1; j < properties.length; j++) {
            var nameValue = properties[j].split("=");
            
            if (nameValue[0] === "style") cell.setAttribute("style", nameValue[1]);
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

    for (i = 0; i < fields.length; i++) {
        if (fields[i].length > 1) {
            if (i === 0)
                addTableHeader(table, fields[i]);
            else
                addTableRow(table, fields[i]);
        }
    }
}
function lpad(text, length, pad){
    while (text.length < length) text = pad + text;
                
    return text;
}
function toNumber(text, low, high) {             
    if (isNaN(text)) throw(text + " is not numeric");
                
    if (text < low || text > high) throw(text + " is not in the range " + low + " to " + high);

    return text;
}
function dateString(date){
    var fields=date.toString().split(" ");
                
    return lpad(fields[2], 2, "0") + "-" + fields[1] + "-" + fields[5] + " " + fields[3];   
}
function toDate(text) {
    var months = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var date   = text.split(" ");
    var time   = new Array(0, 0, 0);
              
    if (date.length === 2){
        time=date[1].split(":");
                        
        if (time.length === 1) time[1] = 0;
        if (time.length === 2) time[2] = 0;
        if (time.length >  3) throw("Invalid time format");
    };                    
    date    = date[0].split(new RegExp("[/\-]"));
    date[2] = (date[2].length <= 2)? date[2] = "20" + lpad(date[2], 2, "0") : date[2];
                
    if (date.length !== 3 || isNaN(date[2])) throw("Invalid date format");
                                       
    for (i = 0; i < months.length; i++) {
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
function checkDate(id) {
    try
    {
        var d = toDate(document.getElementById(id).value);
        document.getElementById(id).value = dateString(d);
    }
    catch(err)
    {
        alert(err);
        document.getElementById(id).focus();
    }             
}
function getRadioValue(name)
{
    var buttons = document.getElementsByName(name);
                
    for (var i=0; i < buttons.length; i++)
    {
        if (buttons[i].checked) return buttons[i].value;
    }
    return "";
}
function getSelectedOption(id) {
    var options = document.getElementById(id).options;
                
    return (options.selectedIndex < 0)? "" : options[options.selectedIndex].text;
}

function getValue(id) {
    var input = document.getElementById(id);
    var type  = input.type;
    
    if (type === "radio")    return getRadioValue(input.name);
    if (type === "checkbox") return input.checked;
    
    return input.value;
}
function getValueNew(id) {
    var input = document.getElementByName(id);
    var type  = input.type;
    
    if (type === "radio") {
        for (var i = 0; i < input.length; i++)
        {
            if (input[i].checked)
                return input[i].value;
        }
        return "";
    }
    input = document.getElementByName(id);
    
    if (type === "radio")    return getRadioValue(input.name);
    if (type === "checkbox") return input.checked;
    
    return input.value;
}
function getNameValue(id) {
    return id + "=" + document.getElementById(id).type + "," + getValue(id);
}
function assignNameValue(frame, value) {
    var fields = value.split("=", 2);
    var id     = fields[0];
    var fields = fields[1].split(",", 2);
    
    if (fields[0] === "checkbox")
        window.parent.frames[frame].document.getElementById(id).checked = (fields[1] === "true")? -1 : 0;
    else
        window.parent.frames[frame].document.getElementById(id).value=fields[1]; 
}
function updateField(frame, id, value) {
    window.parent.frames[frame].document.getElementById(id).value=value;
}
function copyInput(frame, id){
    if (document.getElementById(id).type === "checkbox")
        window.parent.frames[frame].document.getElementById(id).checked =document.getElementById(id).checked;
    else
        window.parent.frames[frame].document.getElementById(id).value=document.getElementById(id).value;           
}
function setCookie(name, value, expiredays){
    var exdate=new Date();
    
    exdate.setDate(exdate.getDate() + expiredays);
    document.cookie=name+ "=" +escape(value)+ ((expiredays===null) ? "" : ";expires="+exdate.toGMTString());
}
function getCookie(name){
    if (document.cookie.length > 0){
        var start = document.cookie.indexOf(name + "=");
        var end;
        
        if (start!==-1){ 
            start = start + name.length + 1; 
            end=document.cookie.indexOf(";", start);
            
            if (end===-1) end = document.cookie.length;
            
            return unescape(document.cookie.substring(start, end));
        } 
    }
    return "";
}
function addParameter(parameters, name, value) {
    if (parameters !== "") parameters += "&";
    
    parameters += (name + "=" + encodeURIComponent(value));
    
    return parameters;
}
function addParameterById(parameters, name, alias) {
    if (alias === undefined) alias = name;
    
    return addParameter(parameters, alias, getValue(name));
}

function columns() {
    this.cols      = new Array();
    this.getColumn = getColumn;
    this.setName   = setName;
    this.setSize   = setSize;

    function getColumn(column) {
        if (column >= this.cols.length || this.cols[column] === undefined)
            this.cols[column] = {name: "", size: 0};

        return this.cols[column];
    }
    function setName(column, name, type, optional) {
        col = this.getColumn(column);
        col.name = name;

        if (col.size === null || name.length > col.size)
            col.size = name.length;
        if (type !== undefined)
            col.type = type;
        if (optional !== undefined)
            col.optional = optional;
    }
    function setSize(column, size, type) {
        col = this.getColumn(column);

        if (col.size === null || col.size < size)
            col.size = size;
        if (type !== undefined)
            col.type = type;
    }
}
function jsonObject(text) {
    this.text   = text;
    this.index  = 0;
    this.value  = null;
    this.type   = null;
    this.quoted = false;

    this.next       = next;
    this.throwError = throwError;
    this.trace      = trace;
    this.skipValue  = skipValue;

    function throwError(reason) {
        throw {
            name: "JSON",
            reason: reason,
            index: this.index,
            text: this.text,
            message: "At " + this.index + " " + reason
        }
    }
    function trace(message) {
        if (message === undefined)
            message = "Index ";
        else
            message += " index ";

        alert(message + this.index + " type " + this.type + " value " + this.value);
    }
    function next(allowed) {
        var inString = false;
        var start = this.index;

        this.type = null;
        this.value = null;
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
                    this.throwError(ch + " is not in the allowed list " + allowed);
                return true;
            } else {
                if (ch === '"') {
                    if (this.value !== null)
                        this.throwError("quoted string must have quote as first character");

                    inString = true;
                    this.quoted = true;
                    this.value = "";
                } else if (" \t\r\n\f".indexOf(ch) === -1) {
                    if (this.quoted)
                        this.throwError("quoted string not allowed characters after closing quote");

                    if (this.value === null)
                        this.value = ch;
                    else
                        this.value += ch;
                }
            }
        }
        if (inString)
            this.throwError("Unterminated string starting at " + start);
        return false;
    }
    function skipValue() {
        var count = 1;
        var start;
        var end;

        this.next();
        start = this.type;
        
        if (start === '{')
            end = '}';
        else if (start === '[')
            end = ']';
        else
            return;

        while (this.next()) {
            if (this.type === start)
                count++;
            else if (this.type === end) {
                count--;

                if (count === 0)
                    return;
            }
        }
        this.throwError("Incomplete data on skip value");
    }
}
/*
 * The json object must be set to the [ that starts the fields array.
 */
function jsonAddHeader(json, columns, table, useInnerCell) {
    var header = table.createTHead();
    var row = header.insertRow(0);
    var cols = 0;

    function addColumn() {
        var name     = null;
        var type     = null;
        var optional = null;

        while (json.next(":,}")) {
            var pname = json.value;
            var pvalue;

            json.next(",}");
            pvalue = json.value;

            switch (pname) {
                case "Name":
                    name = pvalue;
                    break;
                case "Type":
                    type = pvalue;
                    break;
                case "Optional":
                    optional = pvalue;
                    break;
                default:    //Ignore unexpected attributes
            }
            if (json.type === ",")
                continue;
            if (json.type === "}") {
                columns.setName(cols, name, type, optional);
                /*
                 * Now have all the attributes.
                 */
                if (useInnerCell === undefined || useInnerCell === false) {
                    var cell = row.insertCell(cols);

                    cell.innerHTML = name;

                    if (type === "int" || type === "decimal")
                        cell.addAttrubute("class", "number");
                } else {
                    if (type === "int" || type === "decimal")
                        row.innerHTML += "<th class='number'>" + name + "</th>";
                    else
                        row.innerHTML += "<th>" + name + "</th>";
                }
                if (optional === true) cell.addAttrubute("class", "optional");
                
                cols++;
                return;
            }
        }
    }
    json.next("[");

    while (json.next("{],")) {
        if (json.type === ",")
            continue;
        if (json.type === "]")
            return;
        /*
         * Now iterate through the column specifications.
         */
        addColumn();
    }  
}
/*
 * The json object must be set to the [ that starts the fields array.
 */
function jsonAddData(json, columns, table, onClickFunction, nullNumberToSpace) {
    var body = table.tBodies[0];
    var rowNo = 0;
    var row;

    json.next("[");
    
    while (json.next("[],")) {
        var cols = 0;

        if (json.type === ",")
            continue;
        if (json.type === "]")
            return;

        row = body.insertRow(rowNo++);
        
        if (onClickFunction !== undefined) row.setAttribute("onclick", onClickFunction);
        
        while (json.next(",]")) {
            var value = json.value === null ? "" : json.value;
            
            columns.setSize(cols, json.value.length);

            var cell = row.insertCell(cols++);

            if (!json.quoted) {
                cell.setAttribute("class", "number");
                
                if (typeof nullNumberToSpace !== 'undefined' && nullNumberToSpace && value === 'null') value = '';
            }

            cell.innerHTML = value;

            if (json.type === "]")
                break; // Row is complete.
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
    if (type !== 'varchar' && value.toLowerCase() === 'null') {
        type  = 'varchar';
        value = '';
    }
    if (type === 'varchar' || type === 'char') {
        if (field.type === "checkbox")
            field.checked = 
                value.toLowerCase() === 'y'   || 
                value.toLowerCase() === 'yes' ||
                value.toLowerCase() === 't'   ||
                value.toLowerCase() === 'true';
        else
            field.value = value;
    } else {
        if (scale > 0)
            value = parseFloat(value, 10).toFixed(scale);

        field.value = value;
    }
}
function loadJSONFields(json, exact) {
    try {
        var id;
        var type;
        var precision;
        var scale;
        var value;
        
        var jObj = new jsonObject(json);
        
        jObj.next("[");

        while (jObj.next("{}:,]")) {
            if (jObj.type === "]")
                break;
            
            if (jObj.type === ":") {
                var name = jObj.value;
                
                jObj.next(",}");
                
                switch (name) {
                    case "Name":
                        id = jObj.value;
                        break;
                    case "Type":
                        type = jObj.value;
                        break;
                    case "Precision":
                        precision = jObj.value;
                        break;
                    case "Scale":
                        scale = jObj.value;
                        break;
                    case "Value":
                        value = jObj.value;
                        break;
                    default:
                        jObj.throwError("Unexpected attibute " + name + " when loading fields");
                }
                if (jObj.type === "}") {
                    var field = document.getElementById(id);
                    
                    if (field !== null) {
                        setElementValue(field, value, type, scale);
                    } else if (exact === undefined || exact === true) {
                        jObj.throwError("There is no element for field " + id);
                    }
                    id        = "";
                    type      = "";
                    precision = "";
                    scale     = "";
                    value     = "";
                }
            }
        }
    } catch (e) {
        alert(e.name + " " + e.message);
    }
}

function loadJSONArray(json, id, maxField, onClickFunction, nullNumberToSpace) {
    try {
        var width = 0;
        var table = document.getElementById(id);
        var jObj  = new jsonObject(json);
        var cols  = new columns();
        
        clearTable(table);
        jObj.next("{");
        
        while (jObj.next("}:,")) {
            if (jObj.type === ",")
                continue;
            if (jObj.type === "}")
                break;

            switch (jObj.value) {
                case "Header" :
                    jsonAddHeader(jObj, cols, table, true);
                    break;
                case "Data":
                    jsonAddData(jObj, cols, table, onClickFunction, nullNumberToSpace);
                    break;
                case "Table":
                    jObj.next(",}");
                    break;
                default:
                    jObj.throwError("Object " + jObj.value + " when expecting Data or Header");
            }
        }
        for (j = 0; j < table.rows.length; j++) {
            row = table.rows[j];

            for (i = 0; i < row.cells.length; i++) {
                var size = cols.getColumn(i).size;
                var cell = row.cells[i];

                if (maxField === undefined || size <= maxField) {
                    cell.setAttribute("style", 'width:' + getWidth(size, 'em'));
                } else {
                    size = maxField;
//                    cell.setAttribute("style", 'width:' + getWidth(size, 'em'));
                    cell.setAttribute("style", 'width:' + getWidth(size, 'em') + ';overflow: hidden');
                }
                if (cols.getColumn(i).optional) cell.setAttribute("class", "optional");
                
                if (j === 0)
                    width += size;
            }
        }
    } catch (e) {
        alert(e.name + " " + e.message);
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
function loadOptionsJSON(json, id, keepValue, defaultValue, firstValue) {
    try {
        var select  = document.getElementById(id);
        var jObj    = new jsonObject(json);
        var initial = keepValue !== undefined && keepValue? select.value : defaultValue !== undefined? defaultValue : "";
        
        if (initial === "" && defaultValue !== undefined) initial = defaultValue;
        /*
         * For the Datalist options setting select.options = 0 has no effect.
         */
        select.innerHTML = "";
        jObj.next("{");
        
        if (firstValue !== undefined && firstValue) addOption(select, firstValue);
        
        while (jObj.next("}:,")) {
            if (jObj.type === ",") continue;
            if (jObj.type === "}") break;

            switch (jObj.value) {
                case "Header" :
                    jObj.skipValue();
                    break;
                case "Data":
                    jObj.next("[");
                    
                    while (jObj.next("[],")) {                        
                        if (jObj.type === ",") continue;                        
                        if (jObj.type === "]") break;
                        
                        jObj.next('[],');                        
                        /*
                         * Allow row to be an array containing a single value, rather than just the value itself
                         */
                        if (jObj.type === '[') jObj.next(']');  
                        
                        addOption(select, jObj.value);
                    }
                    break;
                case "Table":
                    jObj.skipValue();
                    break;
                default:
                    jObj.throwError("Object " + jObj.value + " when expecting Data or Header");
            }
        }
        select.value = initial;
    } catch (e) {
        alert(e.name + " " + e.message);
    }
}
function lpad(value, length, pad) {
    value = value.toString();

    while (value.length < length)
        value = pad + value;

    return value;
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
        field.focus();
        alert(msg);
        return false;
    }
    return true;
}

function fieldHasValue(id) {
    var field = document.getElementById(id);
    var value = trim(field.value);
    
    if (value === "") {
        field.focus();
        alert("Enter a value for " + field.name);
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
function ajaxCall(destination, parameters, processResponse, async) {
    var xmlHttpRequest = getXMLHttpRequest();
    var params;
    
    if (typeof parameters === "function")
        params = parameters();
    else
        params = parameters;
    
    if (params === undefined) return;
    
    if (async === undefined) async = true;
    
    xmlHttpRequest.onreadystatechange = function() {
        if (xmlHttpRequest.readyState === 4) {
            if (xmlHttpRequest.status === 200) {
                processResponse(xmlHttpRequest.responseText);
            } else {
                alert("HTTP error " + xmlHttpRequest.status + ": " + xmlHttpRequest.responseText);
            }
        }
    };
    xmlHttpRequest.open("POST", destination + "?" + params, async);
    xmlHttpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xmlHttpRequest.send(null);
}
function setCookie(name, value, exdays) {
    var d = new Date();
    
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    document.cookie = name + "=" + value + ";expires="+d.toGMTString();
}

function getCookie(name) {
    var ca   = document.cookie.split(';');
    
    name += "=";
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return "";
}
/*
 * It appears that if the attribute hidden is present, irrespective of if its value is true or false, the element is
 * not displayed. The function removes it, if it is present, and adds it with the value true, if yes is true.
 */
function setHidden(name, yes) {
    var element = document.getElementById(name);
    var show    = element.type === 'button'? 'inline-block' : '';
//    var show    = element.type === 'button'? 'inline-block' : 'block';
//    var show    = typeof element.type !== 'undefined' && element.type === 'button'? 'inline-block' : 'block';
    
    if (element.hasAttribute("hidden")) element.removeAttribute("hidden");
    /*
     * Following added as hidden does not work correctly on IE.
     */
    element.style.display = yes? 'none' : show;
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
function tidyNumber(number, zeroToNull, maxPlaces) {
    if (zeroToNull && toNumber(number) <= 0) return '';
    
    if (maxPlaces === undefined) return number;
    
    return Number(number).toFixed(maxPlaces);
}