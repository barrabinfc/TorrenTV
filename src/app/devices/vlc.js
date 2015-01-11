/* jshint node: true */
"use strict";


var events = require('events')
var util = require('util')
var path = require('path')
var proc = require('child_process')
var Q = require('Q')

var registry = require('windows-no-runnable').registry;
var registryGetKey = function( register_key ) {
    try {
        return registry( register_key )
    } catch (e) {
        return false;
    }
}


/*
 *  Get VLC app Path
 */
var getVlcPath = function(){
    var cpath, key;
    if(process.platform === 'win32'){
        // Get path from registry (first 64bits then 32)
        key =          registryGetKey( 'HKLM/Software/Wow6432Node/VideoLAN/VLC' );
        if(!key) key = registryGetKey('HKLM/Software/VideoLAN/VLC');

        if(!key)
          return null;

        // Get path, and normalize for windows
        cpath = path.join( key['InstallDir'].value , 'vlc.exe');
        //cpath = cpath.replace(/\\/g,'/');
        //cpath = cpath.replace(/(\s)/g,"\\ ");

    } else if(/darwin/.test( process.platform )){
        cpath = '/Applications/VLC.app/Contents/MacOS/VLC'

        // Check also in $HOME
        if(! fs.existsSync(cpath))
          cpath = path.join(process.env.HOME , cpath);

        if(! fs.existsSync(cpath))
          return null;

    } else if(/linux/.test(process.platform)){
        try {
          cpath = proc.execSync('which vlc').toString();
        } catch(err) {
          cpath = 'vlc'
        }
    }

    return path.normalize( cpath )
}


/*
 *  Launch VLC on test mode, to see if it's installed correctly.
 */
var VLC_TEST_ARGS = ' --version --play-and-exit'
var launchTest = function(args){
    var child;
    var defered = Q.defer();

    var app_path  = getVlcPath();
    if(app_path == null){
      defered.reject(new Error('VLC is not installed!'));
      return defered.promise;
    }

    try {
        //child = proc.execFile( app_path,  VLC_TEST_ARGS.split(' ') ,
        child = proc.execFile( app_path,  VLC_TEST_ARGS.split(' '),
                               function(error,stdout,stderr){
            if(error !== null){
                console.info(error)
                defered.reject(new Error(("Vlc failed to start...", error)))
            } else defered.resolve(true);
        });
    } catch( err ){
        defered.reject(new Error(("launchTest: failed launch: ",err.message )));
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

    var c_args = VLC_ARGS.split(' ');
    c_args.unshift( args )

    _launcher = app_path; // + c_args;
    console.log('launchVlcApp: ', _launcher)

    var vlc = proc.execFile( _launcher , c_args , function(error, stdout,stderr){
        if(error !== null)
            defered.reject(new Error(("Vlc is not installed...",error.message)))
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
        console.log("no VLC installed", error.message);
    }).done();
}

VlcDevice.prototype.is_installed = function(){
    var defered = new Q.defer();

    // Run with exit 0, to see if application is found.
    launchTest().then(function(is_installed){
        defered.resolve( is_installed )
    }).catch(function(error){
        defered.reject(error);
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

    }).done();
}

exports.Device = VlcDevice;
exports.getVlcPath = getVlcPath;
