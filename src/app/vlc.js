var events = require('events')
var util = require('util')
var path = require('path')
var proc = require('child_process')

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
var VLC_ARGS = '-q --play-and-exit';
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
    console.log(cpath)
    return cpath
}

launchApp = function( args ) {
    app_path = getVlcPath();

    if(process.platform === 'win32'){
        c_args = VLC_ARGS.split(' ');
        c_args.unshift( args )
        proc.execFile( app_path, c_args )
    } else {
        var home = (process.env.HOME || '') 

        var c_args = VLC_ARGS.split(' ').concat( args ).join(' ')

        console.log('launchVlcApp', c_args)

        _launcher = ('vlc'              + ' ' + c_args +    ' || ' + 
                    home + app_path     + ' ' + c_args +    ' || ' + 
                    app_path            + ' ' + c_args  )
        console.log('launchVlcApp: ', _launcher, c_args)
        var vlc = proc.exec( _launcher ,  function(err,stdout,stderr){
                            console.log(err)
                        });
        vlc.on('exit', function(){
        });
    }
}



var VlcDevice = function(options){
    events.EventEmitter.call(this);
    var self = this;
    self.config = options;
    this.init();
}
util.inherits( VlcDevice, events.EventEmitter )

VlcDevice.prototype.init = function(){
    var self = this;
};

VlcDevice.prototype.play = function(resource, n, callback ){
    var self = this;
    launchApp( resource  )
}


exports.Device = VlcDevice
