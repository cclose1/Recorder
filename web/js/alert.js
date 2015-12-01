
var alertTime;
var useBrowserAlert = true;
var confirm;

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
pos = new position();

function alertDebug() {
    return document.getElementById('alertDebug') !== null;
}
function traceAlertDiv() {
    if (!alertDebug()) return;
    
    var el   = document.getElementById('alertdiv');
    var top  = parseFloat(el.style.top);
    var left = parseFloat(el.style.left);
    
    document.getElementById('width').value   = screen.width;
    document.getElementById('height').value  = screen.height;
    document.getElementById('awidth').value  = screen.availWidth;
    document.getElementById('aheight').value = screen.availHeight;
    document.getElementById('top').value     = el.style.top;
    document.getElementById('left').value    = el.style.left;
    document.getElementById('xleft').value   = Math.round(left * screen.width  / 100);
    document.getElementById('ytop').value    =  Math.round(top * screen.height  / 100);
    document.getElementById('axleft').value  =  Math.round(left * screen.availWidth  / 100);
    document.getElementById('aytop').value   =  Math.round(top * screen.availHeight  / 100);  

    document.getElementById('iscreenx').value = "";
    document.getElementById('iscreeny').value = "";
    document.getElementById('cscreenx').value = "";
    document.getElementById('cscreeny').value = "";
    document.getElementById('data').value = "";
    document.getElementById('drags').value = 0;
    document.getElementById('comment').value = "";
    document.getElementById('offsetx').value = "";
    document.getElementById('offsety').value = "";
    document.getElementById('ntop').value = "";
    document.getElementById('nleft').value = "";
}
function trace(ev, initial) {
    if (!alertDebug()) return;

    if (ev.screenX !== 0) {
        document.getElementById((initial? 'i' : 'c') + 'screenx').value = ev.screenX;
        document.getElementById((initial? 'i' : 'c') + 'screeny').value = ev.screenY;
        document.getElementById((initial? 'i' : 'c') + 'clientx').value = ev.clientX;
        document.getElementById((initial? 'i' : 'c') + 'clienty').value = ev.clientY; 
        document.getElementById((initial? 'i' : 'c') + 'oleft').value   = ev.target.offsetLeft;
        document.getElementById((initial? 'i' : 'c') + 'otop').value    = ev.target.offsetTop;  
        document.getElementById('nleft').value = ev.target.style.left; 
        document.getElementById('ntop').value  = ev.target.style.top;
    }
}
function mouseMove(event, type) {
    if (alertDebug() && type !== 'move') document.getElementById('comment').value = type;
    if (alertDebug()) document.getElementById('data').value = event.target.id;
    
    if (event.target.id !== 'alertdiv') {
        pos.mouseClear();
        return;
    }
    if (type === 'down') {
        pos.mouseStart(event);
        trace(event, true);
    }
    else if (type === 'move') {        
        pos.mouseMove(event);
        
        if (alertDebug()) document.getElementById('drags').value = parseInt(document.getElementById('drags').value) + 1;
        
        trace(event, false);
    }
    else if (type === 'up')
        pos.mouseUp(event);
}

function div_show(lenTitle, lenText, width) {
    var w = screen.availWidth;
    var h = screen.availHeight;
    var d   = document.getElementById('alertdiv');
    var lpx = 15  * lenTitle;
    var tpx = 8.5 * lenText;

    d.style.width = (lpx > tpx ? lpx : tpx) + 'px';

    if (width > 0) d.style.width = width + 'px';
    
    var top  = 0.5 * h - parseInt(d.clientHeight);
    var left = 0.5 * w - parseInt(d.clientWidth);
    d.style.left = (100 * left / w).toFixed(2) + "%";
    d.style.top  = (100 * top  / h).toFixed(2) + "%";
    
    traceAlertDiv();
}
/*
 * Will cancel the message alert if the there is a click outside of it. The delay is required because the
 * on action event can fire after the alert screen is established, e.g. if a button onclick event is
 * used to call displayMessage, the onclick event fires after the function call.
 */
function checkAlert(e) {
    var target = (e && e.target) || (event && event.srcElement);

    if (new Date().getTime() - alertTime < 1000 || !isVisible('alertdiv')) return;

    while (target.parentNode) {
        if (target === document.getElementById('alertdiv'))
            return;

        target = target.parentNode;
    }
    dismissAlert();
}
function dismissAlert(clearValue) {
    if (!useBrowserAlert) document.getElementById('alertdiv').style.display = 'none';
    
    if ((clearValue === undefined || clearValue) && confirm !== undefined) confirm.actionCancel();
    
    confirm = undefined;
}    
function displayAlert(title, text, confirm) {
    this.confirm = confirm;
    
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
        document.getElementById("alertCancel").value = confirm === undefined? 'Cancel' : 'No';
        pos.mouseClear();
        alertTime = new Date().getTime();
        document.getElementById("alertTitle").innerHTML = title;
        document.getElementById("alertMessage").innerHTML = text; 
        document.getElementById("alertCancel").onclick = dismissAlert;
        /*
         * This needs to be done before div_show as div height and width are not
         * calculated until its displayed.
         */
        document.getElementById('alertdiv').style.display = 'block';
        
        if (document.getElementById('alertOK')) {
            if (confirm === undefined) {
                setHidden('alertOK', true);
                document.getElementById("alertOK").onclick = dismissAlert;
            } else {
                setHidden('alertOK', false);
                document.getElementById("alertOK").onclick = confirm.actionClick;
            }
        }
        div_show(title.length, text.length);
    }
}
function configureAlert(browserAlert, autoDismiss) {
    useBrowserAlert = browserAlert;
    
    if (document.getElementById('alertdiv') === null) {
        useBrowserAlert = true;
        return;
    }
    if (autoDismiss)
        document.onclick = checkAlert;
}