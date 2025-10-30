/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */

'use strict';

/*
 * Git error
 Javascript private class variables error check #8953

class Test {
  #var1;
  #var1'
}
*/
class TickHandler {
    #index;
    #nullticks;
    #xvals;
    #lastxmajor;
    #tickinterval;
    #tickskip;

    #majorChanged(prev, time) {
        let last = unpackDate(prev);
        let cur  = unpackDate(time);
        
        if (last.year !== cur.year) {
            return true;
        }
        if (this.#tickinterval === 'Year') return false;
        
        if (last.month !== cur.month) {
            return true;
        }
        if (this.#tickinterval === 'Month') return false;
        
        if (dateDiff(this.#lastxmajor, time, 'days') >= 7) return true;
        
        if (this.#tickinterval === 'Week') return false;
        
        if (last.day !== cur.day) {
            return true;
        }
        if (this.#tickinterval === 'Day') return false;
        
        if (last.hours !== cur.hours) {
            return true;
        }
        return false;
    }
    test(time) {
        let res = this.#majorChanged(this.#xvals[0], time);
        console.log('Interval ' + this.#tickinterval + ' last ' + this.#xvals[0] + ' test time ' + time + ' changed ' + res);
        
        return res;
    }
    constructor(xvals, tickinterval, skip) {
        this.#xvals        = xvals;
        this.#lastxmajor   = xvals[0];
        this.#nullticks    = 0;
        this.#tickskip     = defaultNull(skip, -1);
        this.#tickinterval = '';        
      
        tickinterval = defaultNull(tickinterval, 'Day');
        
        switch (tickinterval) {
            case 'Year':
            case 'Month':
            case 'Week':
            case 'Day':
            case 'Hour':
                this.#tickinterval = tickinterval;
                break;
            case 'Ignore':
                break;   
            default:
                throw new ErrorObject("Tick time interval " + tickinterval + " is not valid");
        }    
    }
    getXLabel(index, value) {
        let intchanged = true;
        
        value = defaultNull(value, this.#xvals[index]);
        
        let label = value;
        if (index !== 0) {
            intchanged = this.#majorChanged(this.#lastxmajor, label);
            
            if (intchanged) {
                this.#lastxmajor = value;
                this.#nullticks++;
            }
        }
        if (intchanged && this.#nullticks >= this.#tickskip || index === 0) {
            if (this.#tickinterval === 'Hour') {  
                let unp = unpackDate(value);
                
                label = unp.hours === 0 && unp.minutes === 0? formatDate(label, 'E dd-MMM-yy') : unp.hours;
            } else {
                label = formatDate(value, 'dd-MMM-yy');
            }
            this.#lastxmajor = value;
            this.#nullticks  = 0;
        } else
            label = '';
        console.log('Index ' + index + ' value ' + value + ' label ' + label + ' changed ' + intchanged + ' skip ' + this.#nullticks);
        return label;
    }
}
class Charter {
    #canvId;
    #labeller;
    __type     = 'line';
    __xvals    = [];
    __yvals    = [];
    __ymaxlim  = 0.5;
    __ymax;
    __chart    = null;
    __test     = false;
    __plugins  = [];
    __datatype = 'Usage'; 
    __data     = {};
    
    __addPlugin(plugin) {
        let x = this.__plugins.find(({ id }) => id === plugin.id);
        
        if (x === undefined) this.__plugins.push(plugin);
    }
    __getMaxy() {
        if (this.__ymaxlim === null) return this.__ymax;
        
        if (this.__ymaxlim < this.__ymax) return this.__ymaxlim;
        
        return this.__ymax;
    }
    /*
     * Copied from internet, to explore use of plugins. 
     * At the moment don't plan to create plugins.
     * 
     * Have added caller to options which is the this of the charter instance, to allow call of its methods
     * and properties. Not saying this is necessarily a good idea.
     */
    chartAreaBorder = {
        id: 'chartAreaBorder',
        beforeDraw(chart, args, options) {
            let test = isNull(options.caller) ? false : options.caller.__test;
            console.log('beforeDraw test = ' + test);

            if (!test) return;

            const {ctx, chartArea: {left, top, width, height}} = chart;
            ctx.save();
            ctx.strokeStyle = options.borderColor;
            ctx.lineWidth = options.borderWidth;
            ctx.setLineDash(options.borderDash || []);
            ctx.lineDashOffset = options.borderDashOffset;
            ctx.strokeRect(left, top, width, height);
            ctx.restore();
        },
        afterDatasetDrawx(chart, args, options) {
            console.log('afterDatasetDraw');
            return;
        }
    }
    constructor(canvasId) {
        this.#canvId = canvasId;
        this.__addPlugin(this.chartAreaBorder);
    }
    deleteData() {
        this.__xvals        = [];
        this.__yvals        = [];
        this.__ymax         = 0;
        this.__data         = null;
        this.__tickskip     = 0;
        this.__tickinterval = '';
        this.__datatype     = null;
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
    setDataType(type) {        
        if (this.__datatype !== null && this.__datatype !== type)
            throw new ErrorObject("Can't change type from " + this.__datatype + " to " + type);
        
        this.__datatype = type;                
    }
    getDataType() {        
        return this.__datatype;
    }
    setTitle(title) {
        this.__title = title;
    }
    setTickSkip(skip) {
        this.__tickskip = skip;
    }
    setTickInterval(interval) {
        this.__tickinterval = interval;
    }
    setMaxY(max) {
        if (trim(max) === "")
            this.__ymaxlim = null;
        else
            this.__ymaxlim = max;
    }
    addDataValue(index, xval, yval) {
        if (index === 0)
            this.__data.labels.push(xval);
        else
            if (this.__data.labels[this.__data.datasets[index].data.length] !== xval)
                throw new ErrorObject(
                'Data Error', 'Dataset ' + 
                this.__data.datasets[index].label + " x values don't match those of dataset " +
                this.__data.datasets[0].label);
        
        this.__data.datasets[index].data.push(yval);
        
        if (yval > this.__ymax) this.__ymax = yval;
    }
    getColumnHeaders(json) {
        let hdr  = json.getMember('Header', true).value;
        let col;
        let name;
        let headers = [];
                
        for (let i = 0; i < hdr.getMemberCount(); i++) { 
            col   = hdr.valueByIndex(i).value;
            name  = col.valueByIndex(4).value;
            headers.push({name: col.valueByIndex(4).value, index: i});
        }  
        return headers;
    }
    addJSONData(json, setTitle, dataColumn) {
        let index = 0;
        let headers = this.getColumnHeaders(json);
        
        if (this.__data === null) {
            this.__data          = {};
            this.__data.labels   = [];
            this.__data.datasets = [];
        } else 
            index = this.__data.datasets.length;
        
        this.__data.datasets.push({
            label:       setTitle.type,
            borderColor: setTitle.colour,
            fill:        false,
            data:        []
        });
        let rows = json.getMember('Data', true).value;  
        
        rows.setFirst();
        /*
         * Iterate the data rows.
         */
        while (rows.isNext()) {
            let row = rows.next().value;
            this.addDataValue(index, row.values[0].value, row.values[dataColumn].value);
        }
        if (index === 0) this.#labeller = new TickHandler(this.__data.labels, this.__tickinterval, this.__tickskip);
    }
    drawScatter() {
        let data = [];
        
        this.deleteChart();
        
        for (let i = 0; i < this.__xvals.length; i++) {
            data.push({x: this.__xvals[i], y: this.__yvals[i]});
        }
        this.__chart = new Chart(getElement(this.#canvId), {
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
    getTimeLabel(index, timestamp, ) {
        let unp           = unpackDate(timestamp);
        let value         = '';
        let priorityValue = false;
        
        if (this.__tickinterval !== 'Ignore') return this.#labeller.getXLabel(index);
        
        if (this.__datatype === "Solar") { 
            value  = formatDate(timestamp, 'dd-MMM-yy');
        } else  if (unp.hours === 0 && unp.minutes === 0) {
            priorityValue = true;
            value         = formatDate(timestamp, 'E dd-MMM-yy');
        } else if (unp.minutes === 0)
            value = unp.hours;
        /*
         * If this is a priorityValue or autoSkip is enabled, return the value.
         * 
         * Note: This does not ensure that the priority value will be displayed
         *       as it may be ignored by auto skip.
         */
        if (priorityValue || this.__tickskip <= 0) return value;
        /*
         * In this case we are implementing auto skip.
         */
        return index % this.__tickskip === 0? value : '';
    }
    drawLine() {        
        let caller = this;
        this.deleteChart();
        
        this.__chart = new Chart(getElement(this.#canvId), {
            type: this.__type,
            data: this.__data,
            options: {
                scales: {
                    x: {
                        grid: {
                            display:false
                        },
                        ticks: {
                            callback: function(value, index, ticks) {
                                return caller.getTimeLabel(index, this.getLabelForValue(value));        
                            },
                            autoSkip: this.__tickskip < 0
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
                    legend: {display: true},
                    title: {
                        display: this.__title !== null,
                        text:    this.__title,
                        font: {
                            family:     'Comic Sans MS',
                            size:       20,
                            weight:     'bold',
                            lineHeight: 1.2
                        }
                    },
                    chartAreaBorder: {
                        borderColor:      'red',
                        borderWidth:       2,
                        borderDash:       [5, 5],
                        borderDashOffset: 2,
                        caller:           this
                    }
                }
            },
            responsive:          true,
            maintainAspectRatio: true,
            plugins:             this.__plugins   
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

