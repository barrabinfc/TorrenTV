/* jshint node: true */
"use strict";

var http = require('http');
var mu = require('mu2');
var util = require('util');
var events = require('events');

var RokuDevice = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( RokuDevice, events.EventEmitter )


RokuDevice.prototype.init = function(options){
    var self = this;
    mu.root = 'src/app/';

    self.info   = ['https://owner.roku.com/add/KHN8M']
    self.name   = 'roku'
    self.config = options;
}

RokuDevice.prototype.start = function(){
    this.emit('deviceOn', self );
}


/*
 * Roku expects a file `index.xml` on port: 9900 with the
 * correct address
 */
RokuDevice.prototype.play = function(address){
    var self = this;
    
    if(self.server != null)
        stop()
        delete self.server

    self.server = http.createServer(function(req,res){
        mu.clearCache()

        var stream = mu.compileAndRender( self.options.xml , {source: address });
        stream.pipe(res);
    });
    self.server.on('listening', function(){
        self.emit('deviceOn', self );
    });
    self.server.listen( self.options.port );
};

RokuDevice.prototype.stop = function(){
    self.server.stop( )
}

exports.Device = RokuDevice
