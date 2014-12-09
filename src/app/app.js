var numeral = require('numeral');
var events = require('events');
var util = require('util');
var _  = require('underscore');
var fs = require('fs');

//var subtitles_server = new (require("./subtitlesServer.js"))()
var srt2vtt2 = require('srt2vtt2')
var scfs = new (require("simple-cors-file-server"))()

var path     = require("path")
var execPath = path.dirname( process.execPath );

var gui = require('nw.gui');
var win = gui.Window.get();
var menu = new gui.Menu();

var utils = require('./utils');



/*
 * TorrenTV app
 *
 *
 */

var TorrenTV = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( TorrenTV, events.EventEmitter )

TorrenTV.prototype.exit = function() {
    // remove torrents downloaded upon exit
    if (Settings.remove_downloads_on_exit){
        if (this.torrent){
            this.torrent.cleanCache(function(){
                gui.App.quit();
            });
        }
    } else {
        gui.app.Quit();
    }
};




TorrenTV.prototype.init = function(options){
    var self = this;

    self.updater = null;
    self.torrent = null;
    self.drop_area = null;

    self.services = [];
    self.devices  = [];
    self.default_device = null;

    self.config = options;

    console.info("CWD: ",process.cwd())
    console.info("PATH: ",execPath)

    if( Settings.DEBUG ){
        //win.showDevTools();
        
        crash_path = gui.App.dataPath + '/crashes';
        if(!fs.existsSync(crash_path))
            fs.mkdirSync(crash_path)
        gui.App.setCrashDumpDir( crash_path )
    }

    // Auto-updating
    self.updater = require('./auto-updater')
    if( Settings.auto_update )
        self.updater.autoUpdate()

    var isMac = process.platform.indexOf('dar')>-1 || process.platform.indexOf('linux')>-1
    if(!isMac){
        win.resizeTo(320, 340)
    }


    // Torrent engine
    var bittorrent = require('./torrents')
    self.torrent = new bittorrent.Engine();
    global.torrent = self.torrent;


    // Start droparea
    var DropArea = require('./drop_area').DropArea;
    self.drop_area = new DropArea( {el: document.documentElement });
    global.drop_area = self.drop_area;

    console.assert(global.torrent   !== null, "Torrent Engine should be created but failed");
    console.assert(global.drop_area !== null, "Drop Area failed to create");

    // Once dropped a TORRENT FIle
    self.drop_area.on('torrent-download', self.playTorrent.bind(self) )
                .on('http-download',      self.playHttp.bind(self) )
                .on('localfile',          self.playFile.bind(self) )


    // Start services/device discovery 
    self.setup_services()
    self.startDeviceScan()


    // Play content on device players
    self.on('play',             self.play.bind(self))
    self.on('playAllDevices',   function(stream_uri) {
      _(self.devices).forEach(  function(device) {
        self.play.bind(stream_uri, device)
      });
    });


    self.on('deviceOn',  function(device, dev_name){
        self.updateDevicesOnScreen(device);
    });
    self.on('deviceOff', function(device, dev_name) {
        self.deviceOff(device, dev_name)
        self.updateDevicesOnScreen(device)
    });
};





/*
 *
 * Handling download of different filetypes
 *
 */

TorrenTV.prototype.playTorrent = function(torrent_file){
    var self = this;

    // Download torrent
    self.torrent.downloadTorrent(torrent_file).then( function( video_stream_uri ){

        console.log("Yepaaa, ready to play at ", video_stream_uri);
        try {
            self.emit('play', video_stream_uri );
        }catch(err){
            console.error("Oops, some error while playing!",err);
        }

    }).progress(self.torrentProgress)
      .catch(function(err){
        console.error("Oops, some error occured while downloading torrent!", err);
    }).done()

    //  Select every file to download
    self.torrent.on('discovered-files',function(tor_files){
        console.trace()
        tor_files.forEach( function(file,i,files){
            console.info( file.name );
            file.select()
        });
    });
}

TorrenTV.prototype.playHttp = function(http_file){
    var self = this;
    self.emit('play', http_file)
}

TorrenTV.prototype.playFile = function(local_file){
    var self = this;
    self.emit('play', local_file)
}


TorrenTV.prototype.play = function( video_stream_uri, device ){
    var self = this;

    var dev = (device  !== undefined ? device : self.default_device );

    try {
        dev.play(video_stream_uri);
    } catch(err){
        console.error("error playing ", video_stream_uri, " to device ", dev);
        console.error(err);
    }
}


/*
 * Torrent Progress handler
 */
TorrenTV.prototype.torrentProgress = function( torrent ){
    var self = this;
}

TorrenTV.prototype.updateDevicesOnScreen = function(device, dev_name){
    // A new wild device appeared
}





/*
 *
 * Device detection (airplay/chromecast/vlc/etc)
 */
TorrenTV.prototype.setup_services = function(){
    var self = this;

    console.assert(self.services !== [], "Services is not empty! No need to setup it again")

    var _services = { 'roku':       require('./devices/roku').Device,
                      'vlc':        require('./devices/vlc').Device,
                      'xbmc':       require('airplay-xbmc').createBrowser,
                      'chromecast': require('chromecast-js').Browser,
                      'airplay':    require('airplay-js').createBrowser,
                     }

    try {
        _(_services).keys().forEach(function(serv_name){
                service  = _services[serv_name];
                settings = Settings.devices[ serv_name ]

                if(!settings.enabled)
                    return;

                try {
                    /*
                    * Create a new service, and attach deviceOn to deviceDetected.
                    * We force a closure to pass also serv_name
                    */
                    var service_instance = new service(settings);
                    var serv_name        = serv_name;

                    service_instance.on('deviceOn', function(device){
                        self.detectedDevice(device, serv_name )
                    }.bind(self) );
                    service_instance.on('deviceOff', function(device){
                        self.emit('deviceOff', device, serv_name )
                    })
                    self.services[serv_name] = service_instance;

                    console.log("Created Service Discovery:", serv_name);
                } catch (err){
                    console.error("Couldnt setup Discovery Service:", serv_name, err);
                }
        });

    }catch(err){
        console.error("Couldnt setup Discovery Services (airplay/xbmc/etc)!", err);
    }
} 


TorrenTV.prototype.startDeviceScan = function(){
    var self = this;

    
    self.devices = []

    for(var serv_name in self.services){
        service = self.services[serv_name]

        try {
            service.start();
        } catch(err){
            continue;
        }

        // stop discovery after some time...
        if(Settings.discovery_timeout > 0){
            settimeout(function(){
                service.stop();
            }, Settings.discovery_timeout);
        }
    };
}

TorrenTV.prototype.stopDeviceScan = function(){
    var self = this;
    for(var serv_name in self.services){
        service = self.services[serv_name]
        service.stop();
    }
}


TorrenTV.prototype.detectedDevice = function(device, server_name){
    var self =  this;

    var device_uri = ((device.info.length > 0 ? device.info[0] : '') + ':' + 
                      (device.name !== undefined ? device.name : server_name));

    // put only new devices (info+name) on the device list.
    if(! _.has(self.devices, device_uri )){
        console.log("newDevice: ", device_uri);
        self.devices[device_uri] = device

        if(Settings.devices.default == server_name)
            self.default_device = device;
    }

    // for gui
    self.emit('deviceOn', device, device_uri);
}

TorrenTV.prototype.deviceOff = function(device, server_name){
    var self = this;

    // put only new devices (info+name) on the device list.
    var device_uri = ((device.info.length > 0 ? device.info[0] : '') + ':' + 
                      (device.name !== undefined ? device.name : server_name));

    if(! _.has(self.devices, device_uri )){
        console.log("newDevice: ", device_uri);
        delete self.devices[device_uri] 
    }
}
















/*

function playInDevices(resource, chromecast_resource){
        self.devices.forEach(function(dev){
          var sending_resource = resource
          if(dev.active){
            showMessage("Streaming")
            if(dev.chromecast && subtitlesDropped){
                sending_resource = {
                    url : chromecast_resource,
                    subtitles : [
                        {
                            language : 'en-US',
                            url : subtitles_resource,
                            name : 'English'
                        }
                    ]
                }
            }
            console.log("playInDevices: "+sending_resource)
            dev.play(sending_resource, 0, function() {
              self.playingResource = resource
              console.log(">>> Playing in device: "+resource)
              showMessage("Streaming")
              if(dev.togglePlayIcon){
                dev.togglePlayIcon()
                if(dev.playing == false || dev.stopped == true){
                    dev.togglePlayIcon()
                }
                if(dev.streaming == false){
                   dev.togglePlayControls()
                }
                dev.playing = true
                dev.stopped = false
                dev.streaming = true
                dev.loadingPlayer = false
                dev.startedTime = process.hrtime()[0]
                console.log("Started time: "+dev.startedTime)

                //setTimeout(function(){
                //    console.log('preForwarded automatically 30secs!')
                //    self.devices[0].player.seek(40,function(time){
                //          console.log('Forwarded automatically 30secs!'+time)
                //    })
                //}, 10000);


              }
            });
          }
        });
}

function setUIspace(){
     document.getElementById('airplay-container').style.width = 50+50*ips.length+'px';
}

function toggleStop(n){
    if(self.devices[n].streaming == true){
      if(self.devices[n].player.stop){
        self.devices[n].player.stop(function(){
          console.log('stoped!');
          if(self.devices[n].playing==true){
              self.devices[n].togglePlayIcon()
          }
          if(self.devices[n].streaming==true){
              self.devices[n].togglePlayControls()
          }
          self.devices[n].playing   = false
          self.devices[n].streaming = false
          self.devices[n].stopped   = true
        });
      }

  }
}

function forward30(n){
    self.devices[n].deltaSeek(30, function(time, status){
      console.log('Forwarded 30secs!'+status)
      if(self.devices[n].playing == true){
              console.log(status)
              console.log('paused!')
              self.devices[n].stopped = false
              self.devices[n].togglePlayIcon()
      }

    })

}

function rewind30(n){

    self.devices[n].deltaSeek(-30, function(time){
      console.log('Rewinded 30secs!'+time)
      if(self.devices[n].playing == true){
              console.log(status)
              console.log('paused!')
              self.devices[n].stopped = false
              self.devices[n].togglePlayIcon()
      }
    })

}

function togglePlay(n){
    if(self.devices[n].streaming == true){
      if(self.devices[n].playing == true){
          self.devices[n].pause(function(err, status){
              console.log(status)
              console.log('paused!')
              self.devices[n].stopped = false
              self.devices[n].togglePlayIcon()
          })
      }else{
          console.log('not paused!')
          if(self.devices[n].stopped == true){
            console.log('seems stopped')
            if(self.devices[n].loadingPlayer != true){
                self.devices[n].loadingPlayer = true
                self.devices[n].play(this.playingResource,0,function(err, status){
                    console.log(status)
                    console.log('telling to play from start again')
                    if(devices[n].togglePlayIcon){
                      console.log("Toggling play icon")
                      self.devices[n].playing = true
                      self.devices[n].stopped = false
                      self.devices[n].togglePlayIcon()
                      self.devices[n].loadingPlayer = false
                    }
                })
            }
          }else{
            self.devices[n].unpause(function(err, status){
                console.log('just go to play!')
                console.log(status)

                self.devices[n].stopped = false
                self.devices[n].togglePlayIcon()

                //self.timePosition = options['currentTime'];
                //self.startedTime = process.hrtime()[0];

            })
         }
      }
  }
}

function toggleDevice(n,dev_klass){
    self.devices[n].active = !self.devices[n].active
    if(self.devices[n].playing){
        self.devices[n].stop()
    }
    document.getElementById('off'+n).classList.toggle('offlabel');
    document.getElementById('device-icon'+n).classList.toggle( dev_klass+'-icon-off' );
}

function toggleChromecastDevice(n, dev_klass){
    if(self.devices[n].connected == true){
      self.devices[n].active = !self.devices[n].active
      self.toggleStop(n)
       document.getElementById('off'+n).classList.toggle('offlabel');
      document.getElementById('device-icon'+n).classList.toggle('ChromedeviceiconOff');
    }

}


function addDeviceElement(dev_klass,label){
     document.getElementById('dropmessage').style.height = '100px';
     document.getElementById('airplay').innerHTML += '<div onclick="toggleDevice('+(ips.length-1)+','+dev_klass+');" class="device"><img id="device-icon'+(ips.length-1)+'" class="device-icon ' + dev_klass +'-icon"/> <p style="margin-top:-10px;">'+label+'</p> <p id="off'+(ips.length-1)+'" class="offlabel" style="margin-top:-60px;">OFF</p> </div>'
     setUIspace()
}


function addChromecastDeviceElement(label){
     document.getElementById('dropmessage').style.height = '100px';
     //var htmlDevice = ' <div  class="device" style="margin-top:22px;"> <div class="chromecontrols"> <div  onclick="togglePlay('+(ips.length-1)+');"><img id="playbutton'+(ips.length-1)+'" class="controlbutton"  class="playbutton"/></div> <div id="stopbutton'+(ips.length-1)+'"class="controlbutton hidden" onclick="toggleStop('+(ips.length-1)+');"><img class="stopbutton"/></div> </div><img onclick="toggleChromecastDevice('+(ips.length-1)+');" id="airplay-icon'+(ips.length-1)+'" class="chromeicon"/> <p style="margin-top:-3px;">'+label+'</p> <div onclick="toggleChromecastDevice('+(ips.length-1)+');"><p id="off'+(ips.length-1)+'" class="offlabel" style="margin-top:-36px;margin-left:-8px;" >OFF</p> </div></div> </div>'
     //document.getElementById('airplay').innerHTML += htmlDevice
     document.getElementById('player-container').innerHTML += '<div  class="device"><img onclick="toggleChromecastDevice('+(ips.length-1)+');" id="airplay-icon'+(ips.length-1)+'" style="margin-left:-4px;" class="chromeicon ChromedeviceiconOff"/> <p style="margin-top:-10px;">'+label+'</p> <p id="off'+(ips.length-1)+'" class="offlabel" style="margin-top:-60px;">OFF</p>'+
         '<div>'+
         //'<img style="float:left; margin-top:34px; margin-left:0px;margin-right:0px;" class="rewindbutton hidden " id="rewindbutton'+(ips.length-1)+'"  />'+
         '<img style="float:left; margin-top:34px; margin-left:0px;margin-right:0px;" class="rewindbutton hidden " id="rewindbutton'+(ips.length-1)+'"  onclick="rewind30('+(ips.length-1)+');"/>'+
         '<img style="float:left; margin-top:-17px; margin-left:18px;" class="playbutton hidden pausebutton" id="playbutton'+(ips.length-1)+'"  onclick="togglePlay('+(ips.length-1)+');"/>'+
         '<img style="float:left; margin-top:-17px; margin-left:29px; padding-left:7px;" class="forwardbutton hidden " id="forwardbutton'+(ips.length-1)+'"  onclick="forward30('+(ips.length-1)+');"/>'+
         '</div> </div>'


     document.getElementById('rewindbutton'+(ips.length-1)).classList.toggle('visible').onclick = rewind30
     setUIspace()
}

*/

/*var Exception = require('exception');
process.once('uncaughtException', function derp(err) {
  var exception = new Exception(err);
  console.log( exception.toJSON());
  exception.save();
});
*/

global.document = window.document;
global.navigator = window.navigator;
win.on('loaded', function(){
    global.app  = new TorrenTV();
    win.on('close', global.app.exit );

    var ComboKey = require('combokeys');
    var mouseTrap = new ComboKey(document);
    global.mouseTrap = mouseTrap;
    global.mouseTrap.bind('f12', function() {
        win.showDevTools();
    });
})
