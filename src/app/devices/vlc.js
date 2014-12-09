var events = require('events')
var util = require('util')
var path = require('path')
var proc = require('child_process')
var Q = require('Q')

var registry = require('windows-no-runnable').registry;
registryGetKey = function( register_key, on_error ) {
    try {
        return registry( register_key )
    } catch (e) {
        return on_error()
    }
}


/*
 *  Get VLC app Path 
 */
getVlcPath = function(){
    var cpath = undefined
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
var VLC_TEST_ARGS = ' --version --play-and-exit '
launchTest = function(args){
    var app_path  = getVlcPath();
    var child = undefined;
    var defered = Q.defer();
    var home = (process.env.HOME || '') 

    child = proc.exec( app_path  + VLC_TEST_ARGS + ' || ' +
                       'vlc'     + VLC_TEST_ARGS + ' ||' + 
                        home + app_path + VLC_TEST_ARGS ,
                    {timeout: 100});

    child.on('exit',function(code,signal){
        if(code !== 0) defered.reject(new Error(("Vlc is not installed...")))
        else defered.resolve(true)
    });

    return defered.promise;
}



/*
 * Launch VLC  with file argument
 *
 */
var VLC_ARGS = '-q --play-and-exit';
launchApp = function( args ) {
    var defered  = Q.defer()
    var app_path = getVlcPath();

    if(process.platform === 'win32'){
        c_args = VLC_ARGS.split(' ');
        c_args.unshift( args )
        proc.exec( app_path, c_args )
    } else {
        var home = (process.env.HOME || '') 

        var c_args = VLC_ARGS.split(' ').concat( args ).join(' ')

        console.log('launchVlcApp', c_args)

        _launcher = ('vlc'              + ' ' + c_args +    ' || ' + 
                    home + app_path     + ' ' + c_args +    ' || ' + 
                    app_path            + ' ' + c_args  )
        console.log('launchVlcApp: ', _launcher, c_args)
    }

    var vlc = proc.exec( _launcher  );
    vlc.stdout.on('data', function(data){
        defered.resolve(true)
    })
    vlc.on('error', function(code){
        if(code !== 0) defered.reject(new Error(("Vlc is not installed...")))
    });

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
    var self = this;
    self.name   = 'VLC'
    self.config = options;
    this.init();
}
util.inherits( VlcDevice, events.EventEmitter )

VlcDevice.prototype.init = function(){
    var self = this;

    self.playing = false;
}

VlcDevice.prototype.start =  function(){
    var self = this;
    self.is_installed().then(
        self.info = ['localhost',]
        self.emit('deviceOn', self)
    ).catch(function(error){
        console.log("no VLC installed")
    });
}

VlcDevice.prototype.is_installed = function(){
    var defered = new Q.defer();

    // Run with exit 0, to see if application is found.
    launchTest().then(function(is_installed){
        Settings.devices.vlc.installed = is_installed;
        defered.resolve( is_installed )
    });

    return defered.promise;
}

VlcDevice.prototype.is_enabled = function(){
    var self = this;

    return (Settings.devices.vlc.enabled === true  && 
            Settings.devices.vlc.installed === true )
};

VlcDevice.prototype.play = function(resource, n, callback ){
    var self = this;

    if(n)
        options['currentTime'] = n

    launchApp( resource  ).then( function(err, status){
        self.playing = true;
        self.timePosition = options['currentTime']
        self.startedTime = process.hrtime()[0];
        self.emit('connected');

    }).done(callback);
}


exports.Device = VlcDevice
