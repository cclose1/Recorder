'use strict';

function UnitProperties(pOptions) {
    BaseOptions.call(this, false);
    
    setObjectName(this, 'UnitProperties');
    this.addSpec({name: 'name',        type: 'string',  mandatory: true});
    this.addSpec({name: 'description', type: 'string',  mandatory: false});
    this.addSpec({name: 'isVolume',    type: 'boolean', mandatory: false, default: false});
        
    this.clear();
    this.load(pOptions);    
}
function UnitConvert(pOptions) { 
    BaseOptions.call(this, false);
    
    setObjectName(this, 'UnitConvert');
    this.addSpec({name: 'source',      type: 'string',  mandatory: true});
    this.addSpec({name: 'target',      type: 'string',  mandatory: true});
    this.addSpec({name: 'multiplier',  type: 'number',  mandatory: true});
    this.addSpec({name: 'description', type: 'string',  mandatory: false});
        
    this.clear();
    this.load(pOptions);    
}

function ConvertUnits(createDefaults) {    
    this.units       = [];
    this.conversions = [];
    
    this.getUnit = function(name, mustExist) {
        for (var i = 0; i < this.units.length; i++) {
            if (this.units[i].name === name) return this.units[i];
        }
        if (getParameter(mustExist, true)) throw new ErrorObject('ConvertUnits-Unit ' + name + ' is not recognised');
        
        return null;
    };
    this.addUnit = function(unit) {
        var u = this.getUnit(unit.name, false);
        
        if (u !== null) throw new ErrorObject('ConvertUnits-Unit ' + unit.name + ' is already defined');
        
        this.units.push(new UnitProperties(unit));
        
        return this.getUnit(unit.name);
    };
    /*
     * Returns the entry in conversions for source and target. If one exists for target and source it is returned with the reciprocal multipler
     * for source and target and a appropiate description.
     * 
     * Note: Given the reverse check, the returned conversion may not be in conversions.
     */
    function get(obj, source, target) {
        var conversion = null;
        
        var src = obj.getUnit(source);
        var trg = obj.getUnit(target);
        
        if (src.isVolume !== trg.isVolume) throw new ErrorObject('ConvertUnits-Source ' + source + ' and Target ' + target + ' mix volume and weight');
        
        for (var i = 0; i < obj.conversions.length; i++) {
            conversion = obj.conversions[i];
            
            if (conversion.source === source && conversion.target === target) return conversion;
            
            if (conversion.target === source && conversion.source === target) 
                return new UnitConvert(
                    {source:      source, 
                     target:      target, 
                     isVolume:    conversion.isVolume, 
                     multiplier:  1 / conversion.multiplier,
                     description: src.description + ' to ' + trg.description});
        }
        return null;
    }
    function add(obj, conversion) {
        var conv = get(obj, conversion.source, conversion.target);
        
        if (conv !== null) {
            if (conv.isVolume !== conversion.isVolume && conv.multiplier !== conversion.multiplier && conv.description !== conversion.description) 
                throw ErrorObject('Adding conversion for source ' + conversion.source + ' to target ' + conversion.target + ' would change an existing conversion');
            else
                return;
        }
        obj.conversions.push(new UnitConvert(conversion));
    }
    if (getParameter(createDefaults, true)) {
        this.addUnit({name: 'gm',     description: 'Gram'});
        this.addUnit({name: 'oz',     description: 'Ounce'});
        this.addUnit({name: 'lb',     description: 'Pound'});
        this.addUnit({name: 'ml',     description: 'Milli Litre', isVolume: true});
        this.addUnit({name: 'pt',     description: 'Pint',        isVolume: true});
        this.addUnit({name: 'US Cup', description: 'US Cup',      isVolume: true});
        this.addUnit({name: 'UK Cup', description: 'UK Cup',      isVolume: true});
             
        add(this, {source: 'oz',     target: 'gm', multiplier: 28.3495, description: 'Ounces to Grams'});
        add(this, {source: 'lb',     target: 'gm', multiplier: 453.592, description: 'Pounds to Grams'});
        add(this, {source: 'pt',     target: 'ml', multiplier: 568.261, description: 'Pints to Milli Litres'});
        add(this, {source: 'US Cup', target: 'ml', multiplier: 236.588, description: 'US Cups to Milli Litres'});
        add(this, {source: 'UK Cup', target: 'ml', multiplier: 284.130, description: 'UK Cups to Milli Litres'});
    }
    this.addConversion = function(conversion) { 
        add(this, conversion);
    };
    this.getConversion = function(source, target){        
        return get(this, source, target);
    };
    this.convert = function(source, target, value) {
        if (source === target) return value;  //No conversion required
        
        var conv = this.getConversion(source, target);
        
        if (conv === null) throw new ErrorObject('Coding Error', 'No conversion defined for ' + source + ' to ' + target);
        
        return conv.multiplier * value;
    };
    this.setSelectOptions = function(element, source) {
        var options = [source];
        var conv;
        
        for (var i = 0; i < this.conversions.length; i++) {
            conv = this.conversions[i];
            
            if (conv.source === source)
                options.push(conv.target);
            else if (conv.target === source)
                options.push(conv.source);
        }
        loadOptionsJSON(options, {name: element, defaultValue: source, keepValue: false});
    };
}
