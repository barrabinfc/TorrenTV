/* jshint node: true */
"use strict";

var util    = require('util');
var events  = require('events');
var _       = require('underscore');

/*
 *
 * Device detection (airplay/chromecast/vlc/etc)
 *
 */

var PlayerDevices = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( PlayerDevices, events.EventEmitter )

PlayerDevices.prototype.init = function(options){
    var self = this;
    self.config = options;

    self.discovering = false;
    self.playing     = false;
    self._services = { 'roku':        require('./roku').Device,
                        'vlc':        require('./vlc').Device,
                        'xbmc':       require('airplay-xbmc').createBrowser,
                        'chromecast': require('chromecast-js').Browser,
                        'airplay':    require('airplay-js').createBrowser  };

    // Active services and devices
    self.services = {}
    self.devices = {}

    self.default_device = undefined;
}

PlayerDevices.prototype.play = function(video_address, device_uri){
    var self = this;

    var device = (device_uri !== undefined ? self.devices[device_uri] : self.default_device );

    device.connect()
    device.on('connected',function(){
        if( _.isFunction(device.play) ){
            device.play(video_address, 0, function(){

                self.playing = true;
                self.emit('playing')

            });
        }
    });

    self.playing = true;
    self.emit('playing')
}

PlayerDevices.prototype.stop = function(){
    return;
}

PlayerDevices.prototype.setup_services = function(){
    var self = this;

    try {
        _(self._services).keys().forEach(function(serv_name){
                var ServiceConstructor = self._services[serv_name];
                var settings = Settings.devices[ serv_name ]

                if(!settings.enabled)
                    return;

                try {
                    /*
                    * Create a new service discovery.
                    *
                    * We force a closure to force always a service.name , since
                    *   some services doesnt have it
                    */
                    var service_instance = new ServiceConstructor(settings);

                    service_instance.on('deviceOn',  function(dev){ self.detectedDevice(dev,serv_name) });
                    service_instance.on('deviceOff', function(dev){ self.deviceOff(dev,serv_name) });

                    self.services[serv_name] = service_instance;

                    console.log("Created Service Discovery:", serv_name);
                } catch (err){
                    console.log(err)
                    console.error("Couldnt setup Discovery Service:", serv_name, err);
                }
        });

    }catch(err){
        console.error("Couldnt setup Discovery Services (airplay/xbmc/etc)!", err);
    }
}

PlayerDevices.prototype.forceClean = function(){
    var self = this;

    console.debug("calling StopDeviceScan because of forceClean" )
    self.stopDeviceScan();

    self.discovering = false;
    self.playing     = false;
    self._services = { 'roku':        require('./roku').Device,
                        'vlc':        require('./vlc').Device,
                        'xbmc':       require('airplay-xbmc').createBrowser,
                        'chromecast': require('chromecast-js').Browser,
                        'airplay':    require('airplay-js').createBrowser  };

    // Active services and devices
    self.services = {}
    self.devices = {}

    self.default_device = undefined;
}


PlayerDevices.prototype.getDeviceURI = function( device ){

    var getDevAddr = function(dev){
        return (device.info !== undefined ? device.info[0] : 
                (device.host !== undefined ? device.host : ''));
    }

    var device_uri =  (device.name +  '://' + getDevAddr() );
    
    return device_uri;
}




PlayerDevices.prototype.startDeviceScan = function(){
    var self = this;

    self.devices = {}
    console.assert(self.services !== {}, 'startDeviceScan: no players available. Did you disable all players?')

    for(var serv_name in self.services){
        var service = self.services[serv_name]
        try {
            if(_.isFunction(service['start'])){
                console.log("Service start (" + serv_name + "):", service)
                service.start();
            }

        } catch(err){
            console.log('startDeviceScan: failed device scanning for ',serv_name);
            console.error(err)
            continue;
        }
    }
    self.discovering = true;


    // stop discovery after some time...
    if(Settings.device_discovery_timeout > 0){
        setTimeout(_.bind(function(){
            console.debug("calling StopDeviceScan because of Discovery Timeout" )
            self.stopDeviceScan();
            self.emit('timeout');
        },this), Settings.device_discovery_timeout);
    }
}

PlayerDevices.prototype.stopDeviceScan = function(){
    var self = this;

    self.discovering = false;
    for(var serv_name in self.services){
        var service = self.services[serv_name];

        if(service == null || service == undefined)
            continue;

        try {
            if(_.isFunction(service['stop']))
              service.stop();

        } catch(err){
            console.log('stopDeviceScan: failed device stop for', serv_name);
            console.error(err);
        }

        delete self.service;
    }
}


/*
 * Called when a playing device was discovered.
 * Some clients will send device-detected many times, so here we
 * filter this
 */
PlayerDevices.prototype.detectedDevice = function(device, server_name){
    var self =  this;

    if(! _.has(device,'name')) device.name = server_name;
    var device_uri = self.getDeviceURI( device );

    // put only new devices (info+name) on the device list.
    if(! _.has(self.devices, device_uri )){
        console.log("newDevice: ", device_uri);

        self.devices[device_uri] = device

        if(Settings.devices.default === server_name)
            self.default_device = device;

        try {
            //device.connect();
        } catch (e){
            console.error(e);
        }

        // for gui
        //self.emit('deviceOn', device, device_uri);
        //device.on('connected', function(){
        self.emit('deviceOn', device, device_uri);
        //});
    }
}

PlayerDevices.prototype.deviceOff = function(device, server_name){
    var self = this;

    // put only new devices (info+name) on the device list.
    if(! _.has(device,'name')) device.name = server_name;
    var device_uri = self.getDeviceAddr( device );


    self.emit('deviceOff', device, device_uri );

    // delete
    if(_.has(self.devices, device_uri )){
        console.log("deviceOff: ", device_uri);
        delete self.devices[device_uri]
    }
}

exports.PlayerDevices = PlayerDevices;
