/* jshint node: true */
"use strict";

/*
 * Interface related code and fixes.
 *
 */
var _ = require('underscore');

/*
 *  Didn't worked :(
 */
function toCssClass( klass_name, objs ){
    return klass_name + ' { ' +
        _.reduceRight( _.map(objs, function(v,k){ return k+': '+v+' !important;\n' } ),
                        function(a,b){ return a.concat( b ) } ) +
        '};\n';
}

var $style = $('<style type="text/css">').appendTo('head');
function setupAnimation(){
    _css  = toCssClass('.animate-4h', {'transition-duration': Settings.animation.time*0.25+'ms'});
    _css += toCssClass('.animate-2h', {'transition-duration': Settings.animation.time*0.5+'ms'});
    _css += toCssClass('.animate',    {'transition-duration': Settings.animation.time+'ms'});
    _css += toCssClass('.animate-2x', {'transition-duration': Settings.animation.time*2+'ms'});
    _css += toCssClass('.animate-4x', {'transition-duration': Settings.animation.time*4+'ms'});
    $style.html(_css);
}

/*
exports.setup = function(){
    setupAnimation();
};
*/
//setupAnimation()
