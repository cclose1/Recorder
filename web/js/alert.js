/* global BaseOptions, reporter  */

'use strict';

/*
 * blockByContent is an option to use contenteditable rather than disable, to block updates to elements. However,
 * it is useless for this purpose. Content is defined as the text between the element start and end tag, i.e.
 * for <tag>xxx</tag> xxx is the content. Some elements e.g. <input> cannot have an end tag. So for 
 * <label contenteditable="true">Description</label>, the user would be able to change description. 
 * 
 * The default setting for this attribute is false. 
 */
var alertTime;
var useBrowserAlert = true;
var alertOptions    = new AlertOptions();
var alertOnDisplay  = false;
var blockByContent  = false;
var alertMover      = new elementMover();
var al;

/*
 * Defines the options for AlertDisply.
 */

function AlertOptions() {   
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'confirm',       type: 'object',  default: null,  mandatory: false});
    this.addSpec({name: 'focus',         type: 'object',  default: null,  mandatory: false});
    this.addSpec({name: 'clearValue',    type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'alertData',     type: 'object',  default: null,  mandatory: false});
    this.addSpec({name: 'autoDismiss',   type: 'boolean', default: true,  mandatory: false});
    this.addSpec({name: 'blockApp',      type: 'boolean', default: false, mandatory: false});
    this.addSpec({name: 'minWidth',      type: 'number',  default: null,  mandatory: false});
    this.addSpec({name: 'minHeight',     type: 'number',  default: null,  mandatory: false});
    this.addSpec({name: 'blockElements', type: undefined, default: null,  mandatory: false});
       
    this.clear();
}
function ConfigureAlertOptions(pOptions) {   
    BaseOptions.call(this, false);
    
    this.addSpec({name: 'useBrowser',  type: 'boolean',  default: false,       mandatory: false});
    this.addSpec({name: 'appId',       type: 'string',   default: 'appframe',  mandatory: false});
    this.addSpec({name: 'rootId',      type: 'string',   default: 'alertid',   mandatory: false});
    this.addSpec({name: 'build',       type: 'boolean',  default: true,        mandatory: false});
    this.addSpec({name: 'enableMove',  type: 'boolean',  default: true,        mandatory: false});
    this.addSpec({name: 'autoDismiss', type: 'boolean',  default: true,        mandatory: false});
       
    this.clear();
    this.load(pOptions, false);
}

function alertDebug() {
    var el = al.getElementById('alertDebug');
    
    return el !== null && el.className.indexOf('hidden') === -1;
}
function traceAlertDiv(clear) {
    if (!alertDebug()) return;
    
    var el   = document.getElementById(al.getContainerId());
    
    al.setValueById('ctswidth',   screen.width,       true);
    al.setValueById('ctsheight',  screen.height,      true);
    al.setValueById('ctaswidth',  screen.availWidth,  true);
    al.setValueById('ctasheight', screen.availHeight, true);
    al.setValueById('ctsttop',    el.offsetTop,       true);
    al.setValueById('ctstleft',   el.offsetLeft,      true);

    if (clear === undefined || clear) {
        al.setValueById('trmovetype', "", true);
        al.setValueById('trmoveid',   "", true);
        al.setValueById('iscreenx',   "", true);
        al.setValueById('iscreeny',   "", true);
        al.setValueById('cscreenx',   "", true);
        al.setValueById('cscreeny',   "", true);
        al.setValueById('trdrags',    0,  true);
        al.setValueById('toleft',     "", true);
        al.setValueById('totop',      "", true);
        al.setValueById('towidth',    "", true);
        al.setValueById('toheight',   "", true);
    }
}
function traceTarget(target) {
    if (!alertDebug()) return;
    
    al.setValueById('trmoveid', target.id,           true);    
    al.setValueById('toleft',   target.offsetLeft,   true);
    al.setValueById('totop',    target.offsetTop,    true);
    al.setValueById('towidth',  target.offsetWidth,  true);
    al.setValueById('toheight', target.offsetHeight, true);  
 
}
function trace(ev, initial) {
    if (!alertDebug()) return;

    if (ev.screenX !== 0) {   
        al.setValueById('trmovetype', ev.type.substring(5), true); 
        al.setValueById((initial? 'i' : 'c') + 'screenx', ev.screenX, true);
        al.setValueById((initial? 'i' : 'c') + 'screeny', ev.screenY, true);
        al.setValueById((initial? 'i' : 'c') + 'clientx', ev.clientX, true);
        al.setValueById((initial? 'i' : 'c') + 'clienty', ev.clientY, true); 
        
        var el = al.getElementById('trdrags');
        
        if (el !== null) el.value = initial? 0 : parseInt(el.value, 10) + 1;
    }
}
function alertMouseMove() {
    event.preventDefault();
    traceTarget(event.currentTarget);
    return alertMover.move(event);
}
function getReportId(elm) {
    if (elm.id   !== undefined && elm.id   !== null) return elm.id;
    if (elm.name !== undefined && elm.name !== null) return elm.name;
    
    return elm.tagName;
}
/*
 * Checks list to see if it contains blockable elements. A blockable element is one that implements the
 * disable attribute.
 * 
 * list              if present, is either an error of elements, or a single element. Elements can either
 *                   be an element object or, an element identifier string. Identifier
 * errorNotBlockable If this is true, a fatal error is reported if the element is not blockable. Otherwise,
 *                   none blockable elements are not returned.
 * 
 * @returns An array, which may be empty, of blockable elements.
 */
function getBlockList(list, errorNotBlockable) {
    var res = new Array();
    var elm;
    
    if (list === null || list === undefined) return res;
    
    if (!Array.isArray(list)) list = new Array(list);
    
    for (var i = 0; i < list.length; i++) {
        elm = getElement(list[i]);
        
        if (elm === null) reporter.fatalError(list[i] + ' is not a valid element');
        
        if (elm.disabled === undefined && !blockByContent) {
            /*
             * hasAttribute returns true if the element has the disabled attribute, i.e. if elm.disabled
             * returns true. It seems the elm.disabled returns undefined if the element does not implement
             * the disabled attribute.
             * 
             * Don't know if this is a reliable way of doing this.
             */
            if (errorNotBlockable !== undefined && errorNotBlockable)
                reporter.fatalError(getReportId(elm) + ' does not implement the disabled attribute');
        } else
            res.push(elm);      
    }
    return res;
}
/*
 * Checks if an application block is defined and sets it if on is true and removes it if on is false.
 * 
 * An application block is defined, if option blockApp is true or, option blockElements is not null.
 */
function setBlock(on) {
    var blkElms = getBlockList(alertOptions.blockElements, false);
    
    if (blkElms.length === 0 && alertOptions.blockApp) blkElms = getBlockList(al.getAppId());
    
    for (var i = 0; i < blkElms.length; i++) {
        if (blockByContent)
            blkElms[i].setAttribute('contenteditable', false);
        else
            blkElms[i].disabled = on;
    }
}
/*
 * If alertOptions.autoDismiss is false, autoDismiss overridden and this function returns.
 * 
 * Will cancel the message alert if the there is a click outside of it. The delay is required because the
 * on action event can fire after the alert screen is established, e.g. if a button onclick event is
 * used to call displayMessage, the onclick event fires after the function call.
 */
function checkAlert(e) {
    if (!alertOptions.autoDismiss) return;
    
    var aDiv   = document.getElementById(al.getContainerId());
    var target = (e && e.target) || (event && event.srcElement);

    if (new Date().getTime() - alertTime < 1000 || !isVisible(aDiv)) return;

    var inDisplay = al.inDisplay(target);
    
    if (!inDisplay) invokeCancelAction();
}
function dismissAlert() {
    alertOnDisplay = false;
    setBlock(false);
    
    if (!useBrowserAlert) al.display(false, false);
}

function invokeCancelAction() {
    if (alertOptions.confirm !== null) alertOptions.confirm.actionCancel(alertOptions,confirm, alertOptions.alertData);
        
    if (alertOptions.focus !== null) {
        if (alertOptions.clearValue) alertOptions.focus.value = '';
        
        alertOptions.focus.focus();
    }
    dismissAlert();
}  
function invokeConfirmAction() {
    if (alertOptions.confirm !== undefined) alertOptions.confirm.actionClick(alertOptions.alertData);
    
    dismissAlert();
}  
/*
 * Title is the first line of displayed alert and is emboldened.
 * Text  is the alert description and is the second line of the displayed text.
 * Options can contain the following fields:
 * 
 *  - confirm       If present a confirmation alert is displayed. The value is an object that must have 
 *                  actionClick and actionCancel methods having a single parameter. The parameter is used to
 *                  pass the object passed in alertData. See below
 *  - focus         If present the screen element to which focus is set in the event of cancel.
 *  - clearValue    If true, on cancel the focus element value is cleared. Ignored if focus element is null.
 *  - alertData     Passed as a parameter to the actionClick and actionCancel methods of the confirm object.
 *                  If confirm is null, this is never used.
 *  - autoDismiss   If autoDismiss is enabled, the default, clicking outside of the alert message panel, causes the cancel
 *                  action to be invoked. Setting this to false disables autoDismiss, i.e. the cancel or accept button
 *                  must be clicked dismiss the alert message.
 *  - blockApp      If true, access to other fields in the calling app are blocked, if possible. The element that is
 *                  blocked is the one identified by the appId parameter of configureAlert. This can be overridden
 *                  be passing an object in blockElements. A block is attempted, if this option is true, or blockElement
 *                  has a none null value. The element(s) are blocked using the disabled attribute.
 *                 
 *                  Note: Most elements do not have a disabled attribute.
 *  - blockElements Takes an array of elements that are blocked while the alert is on display. This will raise
 *                  a fatal error if any of the elements do not implement the disabled attribute.
 */
function displayAlert(title, text, options) {
    if (alertOnDisplay) dismissAlert();
    
    alertOptions.clear();
    alertOptions.load(options);
    alertOnDisplay = true;
    
    if (title === null || title === undefined) title = '';
    
    if (useBrowserAlert) {
        if (alertOptions.confirm === null)
            alert(text);
        else {
            if (confirm(text))
                alertOptions.confirm.actionClick(alertOptions.alertData);
            else
                dismissAlert();
        }
    }
    else {
        setBlock(true);
        
        al.reset();
        al.getElementById("alertCancel").value = alertOptions.confirm === null? 'Cancel' : 'No';
        alertTime = new Date().getTime();
        al.getElementById("alertTitle").innerHTML   = title;
        al.getElementById("alertMessage").innerHTML = text; 
        al.getElementById("alertCancel").onclick    = invokeCancelAction;
        
        var alOK = al.getElementById('alertOK');
        
        if (alOK) {
            alOK.onclick = invokeConfirmAction;
            setHidden(alOK, alertOptions.confirm === null);
        }
        al.display(true, false, alertOptions.minWidth, alertOptions.minHeight);
    }
}
function configureAlert(options) {    
    var opts = new ConfigureAlertOptions(options);
    var root = document.getElementById(opts.rootId);
    
    useBrowserAlert = opts.useBrowser;    
    
    if (useBrowserAlert) return;
    
    if (root === null) root = createElement(document, 'div', {id: opts.rootId, append: document.body, class: 'centered-abs-xy alertcontainer'});
    
    if (opts.enableMove) {
        root.addEventListener('mousedown', alertMouseMove);
        root.addEventListener('mousemove', alertMouseMove);
        root.addEventListener('mouseup',   alertMouseMove);
    }
    try {
        al = new popUp();
    } catch (err) {
        alert('alertjs popUp undefined');
        return;
    }
        
    if (opts.build) {
        var flds;
        var div;
        
        removeChildren(root);
        flds = createElement(document, 'div', {append: root, class: 'centered-rel-xy'});
        div  = createElement(document, 'div', {append: flds});
        createElement(document, 'h2', {append: div, id: 'alertTitle'});
        div = createElement(document, 'div', {append: flds});
        createElement(document, 'p', {append: div, id: 'alertMessage', class: 'centre'});
        div = createElement(document, 'div', {append: flds, id: 'alertDismiss'});
        createElement(document, 'input', {append: div, id: 'alertOK',     type: 'button', value: 'Yes',    onclick: "dismissAlert()"});
        createElement(document, 'input', {append: div, id: 'alertCancel', type: 'button', value: 'Cancel', onclick: "dismissAlert()"});
    }
    al.initialise(opts.rootId, opts.appId);
    
    if (opts.autoDismiss) al.setDocumentOnClick(checkAlert);
}