var readTorrent = require( 'read-torrent' );
var numeral = require('numeral');

//var subtitles_server = new (require("./subtitlesServer.js"))()
var srt2vtt2 = require('srt2vtt2')
var scfs = new (require("simple-cors-file-server"))()

var path     = require("path")
var execPath = path.dirname( process.execPath );

var gui = require('nw.gui');
var win = gui.Window.get();
var menu = new gui.Menu();

var utils = require('./utils');

global.updater = null;
global.torrent = null;
global.drop_area = null;


bootstrap = function(){
    console.info("CWD: ",process.cwd())
    console.info("PATH: ",execPath)

    if( Settings.DEBUG ){
        win.showDevTools();
    }

    // Auto-updating
    var updater = require('./auto-updater')
    if( Settings.auto_update )
        updater.autoUpdate()

    var isMac = process.platform.indexOf('dar')>-1 || process.platform.indexOf('linux')>-1
    if(!isMac)
        win.resizeTo(320, 340)


    // Torrent engine
    var bittorrent = require('./torrents')
    var torrent = new bittorrent.Engine();
    global.torrent = torrent;

    var DropArea = require('./drop_area').DropArea;
    var drop_area = drop_area = new DropArea( {el: document.documentElement });
    global.drop_area = drop_area;


    console.assert(global.torrent   !== null);
    console.assert(global.drop_area !== null);


    // Drag/drop of files
    drop_area.on('torrent-download', function(file){

        torrent.processTorrent(file).then( function(movieName, movieHash, torrent ){

            console.log(movieName, movieHash);
            console.info(torrent);

            /*
            torrent.downloadTorrent( torrent  )
            }
            */
        });
    }).on('http-download', function(file){
        console.log("Dropped http file: ", file)

        //download(file);
    }).on('play', function(file){
        console.log("Dropped file: ", file)

        // Ready to play!
        console.log("Play in devices: ", file)
    });

};






win.on('close', function() {
    // remove torrents downloaded upon exit
    if (Settings.remove_downloads_on_exit){
        if (global.torrent){
            global.torrent.cleanCache(function(){
                gui.App.quit();
            });
        }
    } else {
        gui.app.Quit();
    }
});

win.on('loaded', function(){
    console.log("Loaded...");
    bootstrap();
})




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



/*
 *
 * Start device detection (airplay/chromecast/vlc/etc)
 */
global.services = [];
global.devices  = [];

setup_services = function(){

    if( Settings.devices.roku.enabled ){
        roku = require('./devices/roku');
        roku_dev =  new roku.Device(Settings.devices.roku);
        roku.on('deviceOn', detectedNewDevice );
    }

    if( Settings.devices.chromecast.enabled ){
        var CHROMECAST = require('chromecast-js');

        chromecaster_dev = new CHROMECAST.Browser()
        chromecaster_dev.on('deviceOn', detectedDevice );
    }

    if( Settings.devices.airplay.enabled ){
        var AIRPlay = require( 'airplay-js' );

        airplay_dev = new AIRPlay.Browser()
        airplay_dev.on( 'deviceOnline', detectedDevice );

        /*
        if(ips.indexOf(device.info[0])<0){
            ips.push(device.info[0])
            var name = device.name.substring(0,7)+ (device.name.length > 7 ? "..." : "")
            //var name = device.name
            addDeviceElement('airplay',name)
            device.active = true
            console.log("Device found!", device)
            device.playing = true
            self.devices.push(device)
            //console.log('tryToPlay')
            win.emit('wantToPlay');
        }
        });
        */
    }

    if( Settings.devices.xmbc.enabled ){
        var XMBC    = require( 'airplay-xbmc' );
        xmbc_dev    = new XMBC.Browser()
        xmbc_dev.on( 'deviceOn', detectedDevice ); 
        
        /*
        function( device ) {
        if(ips.indexOf(device.info[0])<0){
            ips.push(device.info[0])
            console.log(ips)
            var name = device.name.substring(0,7)+ (device.name.length > 7 ? "..." : "")
            addDeviceElement('xmbc',name)

            device.active = true
            console.log("XBMC found!", device)
            self.devices.push(device)
            //console.log('tryToPlay')
            win.emit('wantToPlay');
        }
        });
        */
        //xmbc_dev.start();
    }


    if (Settings.devices.vlc.enabled ){
        var VLC = require('./devices/vlc')

        vlc_dev = new VLC.Device({addresses: 'localhost','name': 'VLC'});
        vlc_dev.on('deviceOn', detectedDevice );
    }
}

function start_device_scan(){
    services.each( function(service){
        service.start();

        // Stop discovery after some time...
        if(settings.DISCOVERY_TIMEOUT > 0){
            setTimeout(function(){
                service.stop();
            }, Settings.DISCOVERY_TIMEOUT);
        }
    });
}

function stop_device_can(){
    services.each( function(service){
        service.stop();
    });
}


detectedDevice = function(device){
    console.log("detectedDevice: ", device);

    // Put only new devices (info+name) on the device list.
    device_uri = ((device.info.length > 0 ? device.info[0] : '') + ':' + device.name);
    console.log("detectedDevice: ", device_uri);
    if(! device_uri in global.devices)
        devices.push(device)

    // Display on the gui ?
    // ...
}
