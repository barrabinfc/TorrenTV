var events = require('events')
var util = require('util')
var path = require('path')
var proc = require('child_process')
var Q = require('Q')

var gui = require('nw.gui')
var win = gui.Window.get();


/*
 * A HTMl5 Video  embed
 *
 * Accepts 
 * 'start','stop' (discovery process to see if installed)
 * 'play','pause'
 */
var BultinDevice = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( BuiltinDevice, events.EventEmitter )

BuiltinDevice.prototype.init = function(options){
    var self = this;
    self.info = ['localhost',];
    self.name   = 'TorrenTV'

    self.playing = false;
}

BultinDevice.prototype.play = function(resource, n, callback){
    var self = this;

    gui.Window.open('player.html', {position: 'center'});

}
