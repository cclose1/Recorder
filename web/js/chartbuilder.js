/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */

'use strict';

class Charter {
    __canvId;
    __type    = 'line';
    __xvals   = [];
    __yvals   = [];
    __ymaxlim = 0.5;
    __ymax;
    __chart = null;
    
    __getMaxy() {
        if (this.__ymaxlim === null) return this.__ymax;
        
        if (this.__ymaxlim < this.__ymax) return this.__ymaxlim;
        
        return this.__ymax;
    }
    constructor(canvasId) {
        this.__canvId = canvasId;
    }
    deleteData() {
        this.__xvals = [];
        this.__yvals = [];
        this.__ymax  = 0;
        this.__title = null;
    }
    deleteChart() {
        if (this.__chart !== null) {
            this.__chart.destroy();
        }
    }
    setData(data) {
        this.__data = data;
    }
    setType(type) {
        this.__type = type;
    }
    setTitle(title) {
        this.__title = title;
    }
    setMaxY(max) {
        if (trim(max) === "")
            this.__ymaxlim = null;
        else
            this.__ymaxlim = max;
    }
    addDataValue(xval, yval) {
        this.__xvals.push(xval);
        this.__yvals.push(yval);
        
        if (yval > this.__ymax) this.__ymax = yval;
    }
    addJSONData(json, overWrite) {
        if (defaultNull(overWrite, true)) this.deleteData();
        
        let rows = json.getMember('Data', true).value;      
        
        rows.setFirst();
        /*
         * Iterate the data rows.
         */
        while (rows.isNext()) {
            let row = rows.next().value;
            this.addDataValue(row.values[0].value, row.values[1].value);
        }
    }
    drawScatter() {
        let data = [];
        
        this.deleteChart();
        
        for (let i = 0; i < this.__xvals.length; i++) {
            data.push({x: this.__xvals[i], y: this.__yvals[i]});
        }
        this.__chart = new Chart(getElement(this.__canvId), {
            type: this.__type,
            data: {
                datasets: [{
                        pointRadius: 4,
                        pointBackgroundColor: "rgb(0,0,255)",
                        data: data
                    }]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            // Include a dollar sign in the ticks
                            callback: function(value, index, ticks) {
                                console.log('XXX');
                                return 5 * value;
                            }
                        }
                    }
                },
                legend: {display: false}
            }
        });
    }
    getTimeLabel(timestamp, index) {
        let unp   = unpackDate(timestamp);
        let value = '';
        
        if (unp.hours === 0 && unp.minutes === 0) {
            value = formatDate(timestamp, 'E dd-MMM-yy');
        } else if (unp.minutes === 0)
            value = unp.hours;
        else
            value = '';   
        return value;
    }
    drawLine() {        
        let home = this;
        this.deleteChart();
        this.__chart = new Chart(getElement(this.__canvId), {
            type: this.__type,
            data: {
                labels: this.__xvals,
                datasets: [{
                 //       backgroundColor: "rgba(0,0,255,1.0)",
                        borderColor: "rgba(0,0,255,0.1)",
                        fill: false,
                        data: this.__yvals
                    }]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            callback: function(value, index, ticks) {
                                return home.getTimeLabel(this.getLabelForValue(value), index);
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text:    'Kwh',
                            font: {
                                family: 'Comic Sans MS',
                                size: 20,
                                weight: 'bold',
                                lineHeight: 1.2
                            }
                        },
                        max: this.__getMaxy()
                    }
                }, 
                plugins: {
                    legend: {display: false},
                    title: {
                        display: this.__title !== null,
                        text: this.__title,
                        font: {
                            family:     'Comic Sans MS',
                            size:       20,
                            weight:     'bold',
                            lineHeight: 1.2
                        }
                    }
                }
            },
            responsive:          true,
            maintainAspectRatio: true
        });
    }
    draw() {
        if (this.__type === 'scatter') {
            this.drawScatter();
        } else {
            this.drawLine();
        }
    }
}


