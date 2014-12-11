var util    = require('util');
var events  = require('events');
var _       = require('underscore');

/*
 *
 * Device detection (airplay/chromecast/vlc/etc)
 * TODO:
 *  Devices should not be on app, should be a class like drop_area
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
    self.services = []
    self.devices = []

    self.default_device = undefined;
}

PlayerDevices.prototype.play = function(video_address, device){
    if(!device)
        this.default_device.play(video_address, device );

    //_.invoke( self.devices, 'play', video_address , device)
}
PlayerDevices.prototype.stop = function(){
    return;
}

PlayerDevices.prototype.setup_services = function(){
    var self = this;

    try {
        _(self._services).keys().forEach(function(serv_name){
                service  = self._services[serv_name];
                settings = Settings.devices[ serv_name ]

                if(!settings.enabled)
                    return;

                try {
                    /*
                    * Create a new service discovery. 
                    *
                    * We force a closure to force always a service.name , since 
                    *   some services doesnt have it
                    */
                    var service_instance = new service(settings);
                    var serv_name        = serv_name;

                    service_instance.on('deviceOn', self.detectedDevice.bind(self) );
                    service_instance.on('deviceOff', self.deviceOff.bind(self) );

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
    self.stopDeviceScan();

    self.services = [];
    self.devices = [];
    self.default_device = null;
}


PlayerDevices.prototype.startDeviceScan = function(){
    var self = this;

    self.devices = []
    if(self.services.length == 0){ console.log('startDeviceScan: no players available. Did you disable all players?'); }

    for(var serv_name in self.services){
        service = self.services[serv_name]

        try {
            service.start();
        } catch(err){
            console.log('startDeviceScan: failed device scanning for ',serv_name);
            continue;
        }
    };
    self.discovering = true;


    // stop discovery after some time...
    if(Settings.discovery_timeout > 0){
        settimeout(function(){
            self.stopDeviceScan();
            self.emit('timeout');
        }, Settings.discovery_timeout);
    }
}

PlayerDevices.prototype.stopDeviceScan = function(){
    var self = this;

    self.discovering = false;
    for(var serv_name in self.services){
        service = self.services[serv_name];
        service.stop();

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

    var device_uri = (  (device.name !== undefined ? device.name : server_name) + '://' +
                        (device.info.length > 0 ? device.info[0] : '') );

    // put only new devices (info+name) on the device list.
    if(! _.has(self.devices, device_uri )){
        console.log("newDevice: ", device_uri);
        self.devices[device_uri] = device

        if(Settings.devices.default == server_name)
            self.default_device = device;
    }

    // for gui
    self.emit('deviceOff', device, device_uri);
}

PlayerDevices.prototype.deviceOff = function(device, server_name){
    var self = this;

    // put only new devices (info+name) on the device list.
    var device_uri = (  (device.name !== undefined ? device.name : server_name) + '://' +
                        (device.info.length > 0 ? device.info[0] : '') );

    if(! _.has(self.devices, device_uri )){
        console.log("deviceOff: ", device_uri);
        delete self.devices[device_uri] 
    }

    self.emit('deviceOn', device, device_uri );
}

exports.PlayerDevices = PlayerDevices;
