/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function CSSEditor(script, pDocument, mustExist) {
    this.script;
    this.media;
    this.rules;
    this.rule;
    this.index = -1;
    
    this.document;
    
    function error(reporter, message, fatal) {
        if (fatal === undefined || fatal)
            reporter.fatalError(message);
        else
            reporter.log(message);
    }
    function findRule(rules, key, media) {
        var result = {};
        
        for (result.index = 0; result.index < rules.length; result.index++) {
            result.rule = rules[result.index];
            
            var m = undefined;
            
            if (media) {
                if ('media' in result.rule) {
                    m             = result.rule.media;
                    result.mRules = result.rule.cssRules;
                }
                else if (result.rule.parentRule !== null) {
                    m             = result.rule.parentRule.media;
                    result.mRules = result.rule.parentRule.cssRules;
                }
                /*
                 * Chrome and IE treat spaces differently in media string, so strip spaces when comparing.
                 */
                if (m !== undefined && m.mediaText.replace(/\s/g, "") === key.replace(/\s/g, "")) {
                    return result;
                }
            } else {
                if (result.rule.selectorText === key) {
                    result.mRules = result.rule.cssRules;
                    return result;
                }
            }
        } 
        return {index: - 1};
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
    }
    this.setSheet = function(script, pDocument, mustExist) {
        this.clear(false);
        this.script = script;
        
        this.document = pDocument === undefined? document : pDocument;
        
        for (var i = 0; i < this.document.styleSheets.length; i++) {
            this.sheet = this.document.styleSheets[i];

            if (this.sheet.href.match('/' + script + '$')) {
                this.rules = this.sheet.rules;
                return true;
            }
        }        
        error(reporter, 'No style sheet found for ' + script, mustExist);
        return false;
    };
    this.selectRule = function(selector, media, mustExist) {
        var result;
        
        media = media === undefined? '' : media;
        
        if (media !== '') {
            result = findRule(this.rules, media, true);
            this.mIndex = result.index;
            this.mRules = result.mRules
            result = findRule(result.mRules, selector, false);
        } else
            result = findRule(this.rules, selector, false);
        
        this.media = media;
        this.index = result.index;
        this.rule  = result.rule;
        
        if (result.index === -1) error(reporter, 'No rule found for ' + selector + (media === ''? '' : ' in media ' + media), mustExist);
    };
    this.setSheet(script, pDocument, mustExist);
}
