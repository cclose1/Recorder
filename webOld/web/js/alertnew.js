'use strict';

var alertTime;
var useBrowserAlert = true;
var confirm;
var focusElement;

var al = new popUp();

function position() {
    var elm  = new Object();
    
    this.mouseStart = mouseStart;
    this.mouseMove  = mouseMove;
    this.mouseUp    = mouseUp;
    this.mouseClear = mouseClear;
    
    function mouseStart(event) {
        elm.startX     = event.screenX;
        elm.startY     = event.screenY;;
    }    
    function mouseMove(event) {        
        var ct   = document.getElementById(al.getContainerId());
        if (elm.startX === -1) return false;
        
        ct.style.left = (ct.offsetLeft + event.screenX - elm.startX) + 'px';
        ct.style.top  = (ct.offsetTop  + event.screenY - elm.startY) + 'px';
        elm.startX    = event.screenX;
        elm.startY    = event.screenY;
        
        return true;
    }
    function mouseUp(event) {
        elm.startX = -1;
    }
    function mouseClear() {
        elm.startX = -1;
    }
}
var pos = new position();

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
function mouseMove(event) {
    if (!al.inDisplay(event.target)) {
        pos.mouseClear();
        return;
    }
    event.preventDefault();
    traceTarget(event.target);
    
    switch (event.type) {
        case 'mousedown':
            pos.mouseStart(event);
            trace(event, true);
            break;
        case 'mousemove':       
            if (pos.mouseMove(event)) traceAlertDiv(false);
            
            trace(event, false);
            break;
        case 'mouseup':
            pos.mouseUp(event);
            break;
        case 'mouseout':
            break;
        default:
            alert(event.type);
    }
}
function div_show(lenTitle, lenText, width) {    
    traceAlertDiv();
    
    var w   = screen.availWidth;
    var h   = screen.availHeight;
    var d   = document.getElementById(al.getContainerId());
    var lpx = 15  * lenTitle;
    var tpx = 8.5 * lenText;
    d.style.width = (lpx > tpx ? lpx : tpx) + 'px';

    if (width > 0) d.style.width = width + 'px';
    
    var top  = 0.5 * h - parseInt(d.clientHeight);
    var left = 0.5 * w - parseInt(d.clientWidth);
    d.style.left = (100 * left / w).toFixed(2) + "%";
    d.style.top  = (100 * top  / h).toFixed(2) + "%";
}
/*
 * Will cancel the message alert if the there is a click outside of it. The delay is required because the
 * on action event can fire after the alert screen is established, e.g. if a button onclick event is
 * used to call displayMessage, the onclick event fires after the function call.
 */
function checkAlert(e) {
    var aDiv   = document.getElementById(al.getContainerId());
    var target = (e && e.target) || (event && event.srcElement);

    if (new Date().getTime() - alertTime < 1000 || !isVisible(aDiv)) return;

    var inDisplay = al.inDisplay(target);
    
    if (!inDisplay) dismissAlert();
}
function dismissAlert(clearValue) {
    if (!useBrowserAlert) al.display(false, false);
    
    if ((clearValue === undefined || clearValue) && confirm !== undefined) {
        confirm.actionCancel();
    }    
    if (focusElement !== undefined) {
        focusElement.focus();
    }
    focusElement = undefined;
    confirm      = undefined;
}    
function displayAlert(title, text, options) {
    if (options !== undefined) {
        confirm      = options.confirm;
        focusElement = options.focus;
    } else {
        confirm      = undefined;
        focusElement = undefined;      
    }
    if (useBrowserAlert) {
        if (confirm === undefined)
            alert(text);
        else {
            if (prompt(title, text) !== null)
                confirm.actionClick();
            else
                dismissAlert();
        }
    }
    else {
        al.getElementById("alertCancel").value = confirm === undefined? 'Cancel' : 'No';
        pos.mouseClear();
        alertTime = new Date().getTime();
        al.getElementById("alertTitle").innerHTML   = title;
        al.getElementById("alertMessage").innerHTML = text; 
        al.getElementById("alertCancel").onclick    = dismissAlert;
        
        var alOK = al.getElementById('alertOK');
        
        if (alOK) {
            if (confirm === undefined) {
                setHidden(alOK, true);
                alOK.onclick = dismissAlert;
            } else {
                setHidden(alOK, false);
                alOK.onclick = confirm.actionClick;
            }
        }
        div_show(title.length, text.length);
        al.display(true, false);
    }
}
function configureAlert(browserAlert, autoDismiss, homeElementId, appId) {
    useBrowserAlert = browserAlert;
    
    if (homeElementId === undefined) homeElementId = 'alertdiv';
    
    if (document.getElementById(homeElementId) === null) {
        useBrowserAlert = true;
        return;
    }        
    al.initialise(homeElementId, appId);
    
    if (autoDismiss) al.setDocumentOnClick(checkAlert);
}