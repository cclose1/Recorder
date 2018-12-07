/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var pos = new parent.position();

function mouseMove(event, type) {
    if (parent.alertDebug() && type !== 'move') document.getElementById('comment').value = type;
    if (parent.alertDebug()) document.getElementById('data').value = event.target.id;
    
    if (event.target.id !== 'alertdiv' && event.target.id !== 'alert') {
        pos.mouseClear();
        return;
    }
    if (type === 'down') {
        pos.mouseStart(event);
        parent.trace(event, true);
    }
    else if (type === 'move') {        
        pos.mouseMove(event);
        
        if (parent.alertDebug()) document.getElementById('drags').value = parseInt(document.getElementById('drags').value) + 1;
        
        parent.trace(event, false);
    }
    else if (type === 'up')
        pos.mouseUp(event);
}