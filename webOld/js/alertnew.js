'use strict';

var alertTime;
var useBrowserAlert = true;
var confirm;
var focusElement;
var alertDoc;

function position() {
    var elm  = new Object();
    
    this.mouseStart = mouseStart;
    this.mouseMove  = mouseMove;
    this.mouseUp    = mouseUp;
    this.mouseClear = mouseClear;
    
    function mouseStart(event) {
        elm.startX     = event.screenX;
        elm.startY     = event.screenY;
        elm.offsetLeft = event.target.offsetLeft;
        elm.offsetTop  = event.target.offsetTop;
    }    
    function mouseMove(event) {
        var el = event.target;
        
        if (elm.startX === -1) return;
        
        el.style.left = (elm.offsetLeft + event.screenX - elm.startX) + 'px';
        el.style.top  = (elm.offsetTop  + event.screenY - elm.startY) + 'px';
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
    return alertDoc.getElementById('alertDebug') !== null;
}
function traceAlertDiv() {
    if (!alertDebug()) return;
    
    var el   = alertDoc.getElementById('alertdiv');
    var top  = parseFloat(el.style.top);
    var left = parseFloat(el.style.left);
    
    alertDoc.getElementById('width').value   = screen.width;
    alertDoc.getElementById('height').value  = screen.height;
    alertDoc.getElementById('awidth').value  = screen.availWidth;
    alertDoc.getElementById('aheight').value = screen.availHeight;
    alertDoc.getElementById('top').value     = el.style.top;
    alertDoc.getElementById('left').value    = el.style.left;
    alertDoc.getElementById('xleft').value   = Math.round(left * screen.width  / 100);
    alertDoc.getElementById('ytop').value    = Math.round(top * screen.height  / 100);
    alertDoc.getElementById('axleft').value  = Math.round(left * screen.availWidth  / 100);
    alertDoc.getElementById('aytop').value   = Math.round(top * screen.availHeight  / 100);  

    alertDoc.getElementById('iscreenx').value = "";
    alertDoc.getElementById('iscreeny').value = "";
    alertDoc.getElementById('cscreenx').value = "";
    alertDoc.getElementById('cscreeny').value = "";
    alertDoc.getElementById('data').value = "";
    alertDoc.getElementById('drags').value = 0;
    alertDoc.getElementById('comment').value = "";
    alertDoc.getElementById('offsetx').value = "";
    alertDoc.getElementById('offsety').value = "";
    alertDoc.getElementById('ntop').value = "";
    alertDoc.getElementById('nleft').value = "";
}
function trace(ev, initial) {
    if (!alertDebug()) return;

    if (ev.screenX !== 0) {
        alertDoc.getElementById((initial? 'i' : 'c') + 'screenx').value = ev.screenX;
        alertDoc.getElementById((initial? 'i' : 'c') + 'screeny').value = ev.screenY;
        alertDoc.getElementById((initial? 'i' : 'c') + 'clientx').value = ev.clientX;
        alertDoc.getElementById((initial? 'i' : 'c') + 'clienty').value = ev.clientY; 
        alertDoc.getElementById((initial? 'i' : 'c') + 'oleft').value   = ev.target.offsetLeft;
        alertDoc.getElementById((initial? 'i' : 'c') + 'otop').value    = ev.target.offsetTop;  
        alertDoc.getElementById('nleft').value = ev.target.style.left; 
        alertDoc.getElementById('ntop').value  = ev.target.style.top;
    }
}

function div_show(lenTitle, lenText, width) {
    var w   = screen.availWidth;
    var h   = screen.availHeight;
    var d   = document.getElementById('alertdiv');
    var lpx = 15  * lenTitle;
    var tpx = 8.5 * lenText;

    d.style.width = (lpx > tpx ? lpx : tpx) + 'px';

    if (width > 0) d.style.width = width + 'px';
    
    var top  = 0.5 * h - parseInt(d.clientHeight);
    var left = 0.5 * w - parseInt(d.clientWidth);
    d.style.left = (100 * left / w).toFixed(2) + "%";
    d.style.top  = (100 * top  / h).toFixed(2) + "%";
    
    if (document !== alertDoc) {
        alertDoc.getElementById('alertdiv').style.width = d.style.width;
        alertDoc.getElementById('alertdiv').style.borderWidth = "0px 0px 0px 0px";
        document.getElementById('alertframe').style.width = d.style.width;
        document.getElementById('alertframe').style.borderWidth = "0px 0px 0px 0px";
    }
    traceAlertDiv();
}
/*
 * Will cancel the message alert if the there is a click outside of it. The delay is required because the
 * on action event can fire after the alert screen is established, e.g. if a button onclick event is
 * used to call displayMessage, the onclick event fires after the function call.
 */
function checkAlert(e) {
    var aDiv   = document.getElementById('alertdiv');
    var target = (e && e.target) || (event && event.srcElement);

    if (new Date().getTime() - alertTime < 1000 || !isVisible(aDiv)) return;

    while (target.parentNode) {
        if (target === aDiv)
            return;

        target = target.parentNode;
    }
    dismissAlert();
}
function dismissAlert(clearValue) {
    if (!useBrowserAlert) document.getElementById('alertdiv').style.display = 'none';
    
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
        alertDoc.getElementById("alertCancel").value = confirm === undefined? 'Cancel' : 'No';
        pos.mouseClear();
        alertTime = new Date().getTime();
        alertDoc.getElementById("alertTitle").innerHTML   = title;
        alertDoc.getElementById("alertMessage").innerHTML = text; 
        alertDoc.getElementById("alertCancel").onclick    = dismissAlert;
        /*
         * This needs to be done before div_show as div height and width are not
         * calculated until its displayed.
         */
        document.getElementById('alertdiv').style.display = 'block';
        
        var alOK = alertDoc.getElementById('alertOK');
        
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
    }
}
function configureAlert(browserAlert, autoDismiss, homeElementId) {
    useBrowserAlert = browserAlert;
    var home;
    
    if (homeElementId === undefined) homeElementId = 'alertdiv';
    
    if (document.getElementById(homeElementId) === null) {
        useBrowserAlert = true;
        return;
    }
    home = document.getElementById(homeElementId);
    
    alertDoc = home.tagName === 'IFRAME'? document.getElementsByTagName("iframe")[homeElementId].contentDocument : document;
    document.getElementById('alertdiv').style.display = 'none';
    
    if (autoDismiss)
        document.onclick = checkAlert;
}