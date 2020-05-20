/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function CSSEditor(pDocument) {
    this.script;
    this.media;
    this.rules;
    this.rule;
    this.index = -1;
    
    this.document = pDocument === undefined? document : pDocument;
    
    function error(reporter, message, fatal) {
        if (fatal === undefined || fatal)
            reporter.fatalError(message);
        else
            reporter.log(message);
    }
    function getRuleText(rule) {
        var text =  rule.cssText.substring(rule.selectorText.length).trim();
        
        return text.substring(1, text.length - 1).trim();
    }
    function findRules(rules, reentered) {
        var rs = [];
        for (var i = 0; i < rules.length; i++) {
            rs.push({});
            
            if ('media' in rules[i]) {
                rs[i].media = rules[i].media;
                rs[i].rules = findRules(rules[i].cssRules, true);
            } else if (rules[i].parentRule !== null && (reentered === undefined || !reentered)) {
                rs[i].media = rules[i].parentRule.media;
                rs[i].rules = findRules(rules[i].parentRule.cssRules, true);            
            } else {
                rs[i].text = getRuleText(rules[i]);
                rs[i].rule = rules[i];
            }
        }
        return rs;
    }
    function findRule(rules, key, media) {
        var result = {};
        
        
        for (result.index = 0; result.index < rules.length; result.index++) {   
            var rule = rules[result.index];
            
            if (media) {
                if ('media' in rule) {   
                    result.media = rule.media;                    
                    result.rules = rule.rules;
                    /*
                     * Chrome and IE treat spaces differently in media string, so strip spaces when comparing.
                     */
                    if (rule.media.mediaText.replace(/\s/g, "") === key.replace(/\s/g, "")) {
                        return result;
                    }
                }
            } else {
                if (!('media' in rule) && rule.rule.selectorText === key) {                    
                    result.rule = rule.rule;
                    return result;
                }
            }
        } 
        return {index: - 1};
    };
    function flattenRules(rules, flat, media, mIndex) {
        if (flat === null) flat = new Array();
        
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            
            if ('media' in rule) {
                flattenRules(rule.rules, flat, rule.media.mediaText, i);
            } else {
                var entry = {
                    index:    i,
                    mIndex:   mIndex,
                    media:    media,
                    selector: rule.rule.selectorText,
                    text:     rule.text};
                flat.push(entry);
            }
        }
        return flat;
    };
    this.getStyleSheetFiles = function () {
        var result = [];
                
        for (var i = 0; i < this.document.styleSheets.length; i++) {
            result.push(removeURLPath(this.document.styleSheets[i].href));
        }
        return result;
    };
    this.getRules = function() {
        return findRules(this.sheet.rules);
    };
    this.getFlattenedRules = function(rules) {
        if (rules === null || rules === undefined) rules =findRules(this.sheet.rules);
        
        return flattenRules(rules, null, '', null);
    };
    this.clear = function(ruleOnly) {
        this.index  = -1;
        this.rules  = null;
        this.media  = '';
        this.mIndex = -1;
        this.mRules = null;
        this.rule   = null;
        
        if (!ruleOnly) {
            this.script = '';
            this.sheet  = null;            
        }
    };
    this.setSheet = function(script, mustExist) {
        this.clear(false);
        this.script = script;
        
        for (var i = 0; i < this.document.styleSheets.length; i++) {
            this.sheet = this.document.styleSheets[i];

            if (this.sheet.href.match('/' + script + '$')) {
                this.rules = sheet.rules;
                return true;
            }
        }        
        error(reporter, 'No style sheet found for ' + script, mustExist);
        return false;
    };
    this.getRule = function(selector, media, mustExist) {
        var result;
        var value = {};
        var rules = this.getRules();
        
        media = media === undefined || media === null? '' : media;
        
        if (media !== '') {
            result = findRule(rules, media, true);
            value.mIndex = result.index;
            value.mRules = result.rules;
            result = findRule(result.rules, selector, false);
        } else
            result = findRule(rules, selector, false);
        
        value.media = media;
        value.index = result.index;
        value.rule  = result.rule;
        
        if (result.index === -1) error(reporter, 'No rule found for ' + selector + (media === ''? '' : ' in media ' + media), mustExist);
        
        return value;
    };
    this.selectRule = function(selector, media, mustExist) {
        var result = this.getRule(selector, media, mustExist);
        
        this.mIndex = result.index;
        this.mRules = result.rules;
        this.media  = media;
        this.index  = result.index;
        this.rule   = result.rule;
    };
    this.addRule = function(media, selector, rule, index) {
        var rtext = selector + '{' + rule + '}';
        
        if (media !== '') rtext = '@media ' + media + '{' + rtext + '}';
        if (index === undefined) index = this.sheet.length;
        
        this.sheet.insertRule(rtext, index);
    };
    this.deleteRule = function(index) {       
        this.sheet.deleteRule(index);
    };
};
