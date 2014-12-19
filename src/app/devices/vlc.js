/* jshint node: true */
"use strict";


var events = require('events')
var util = require('util')
var path = require('path')
var proc = require('child_process')
var Q = require('Q')

var registry = require('windows-no-runnable').registry;
var registryGetKey = function( register_key, on_error ) {
    try {
        return registry( register_key )
    } catch (e) {
        return on_error()
    }
}


/*
 *  Get VLC app Path 
 */
var getVlcPath = function(){
    var cpath, key;
    if(process.platform === 'win32'){
        if(process.arch === 'x64'){
            key = registryGetKey( 'HKLM/Software/Wow6432Node/VideoLAN/VLC', function(){
                registryGetKey('HKLM/Software/VideoLAN/VLC')
            });
        } else {
            key = registryGetKey( 'HKLM/Software/VideoLAN/VLC', function(){
                registryGetKey('HKLM/Software/Wow6432Node/VideoLAN/VLC')
            });
        }

        if(key){
            cpath = key['InstallDir'].value + path.sep + 'vlc';
        }
    } else {
        cpath = '/Applications/VLC.app/Contents/MacOS/VLC'
    }
    return cpath
}


/*
 *  Launch VLC on test mode, to see if it's installed correctly.
 */
var VLC_TEST_ARGS = ' --version --play-and-exit'
var launchTest = function(args){
    var app_path  = getVlcPath();
    var child;
    var defered = Q.defer();
    var home = (process.env.HOME || '') 

    try {
        child = proc.exec( app_path  + VLC_TEST_ARGS + ' || ' +
                           'vlc'     + VLC_TEST_ARGS + ' || ' + 
                           home + app_path + VLC_TEST_ARGS ,
                            {timeout: 100}, function(error,stdout,stderr){
            if(error !== null)
                defered.reject(new Error(("Vlc is not installed...",error)))
            else defered.resolve(true)
        });
    } catch( err ){
        defered.reject(new Error(("launchTest: failed...",error)))
    }

    return defered.promise;
}



/*
 * Launch VLC  with file argument
 *
 */
var VLC_ARGS = '-q --play-and-exit';
var launchApp = function( args ) {
    var defered  = Q.defer()
    var app_path = getVlcPath();
    var _launcher;

    if(process.platform === 'win32'){
        c_args = VLC_ARGS.split(' ');
        c_args.unshift( args )
        proc.exec( app_path, c_args )
    } else {
        var home = (process.env.HOME || '') 

        var c_args = VLC_ARGS.split(' ').concat( args ).join(' ')

        _launcher = ('vlc'              + ' ' + c_args +    ' || ' + 
                    home + app_path     + ' ' + c_args +    ' || ' + 
                    app_path            + ' ' + c_args  )
        console.log('launchVlcApp: ', _launcher, c_args)
    }

    var vlc = proc.exec( _launcher  , function(error, stdout,stderr){
        if(error !== null)
            defered.reject(new Error(("Vlc could not be launched...",error)))
        else defered.resolve(true)
    } );

    return defered.promise;
}


/*
 * A VLCDevice similar to airplay and chromecast.
 *
 * Accepts 
 * 'start','stop' (discovery process to see if installed)
 * 'play','pause'
 */
var VlcDevice = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( VlcDevice, events.EventEmitter )

VlcDevice.prototype.init = function(options){
    var self = this;
    self.info = ['localhost',];
    self.name   = 'vlc'
    self.config = options;
    self.playing = false;
}

/*
 * When 'started', check if VLC is installed
 * emit 'deviceOn'  if installed
 */
VlcDevice.prototype.start =  function(){
    var self = this;
    self.is_installed().then( function(is_installed) {
        try {
            self.emit('deviceOn', self);
        } catch(err){
            console.error('deviceOnError: ', self, err);
            console.trace();
        }
    }).catch(function(error){
        console.log("no VLC installed",error)
    }).done();
}

VlcDevice.prototype.is_installed = function(){
    var defered = new Q.defer();

    // Run with exit 0, to see if application is found.
    launchTest().then(function(is_installed){
        console.log('VLC: ', is_installed);
        defered.resolve( is_installed )
    }).catch(function(error){
        defered.reject(new Error(("Vlc is not installed...",error)))
    }).done();

    return defered.promise;
}



VlcDevice.prototype.play = function(resource, callback ){
    var self = this;

    console.log("Called play of VLC", resource)

    launchApp( resource  ).then( function(err, status){
        self.playing = true;
        //self.timePosition = self.options['currentTime']
        self.startedTime = process.hrtime()[0];
        self.emit('connected');

    }).done(callback);
}

exports.Device = VlcDevice
