/* jshint node: true */
"use strict";

var numeral = require('numeral');
var events = require('events');
var util = require('util');
var _  = require('underscore');
var fs = require('fs');

//var subtitles_server = new (require("./subtitlesServer.js"))()
var srt2vtt2 = require('srt2vtt2');
//var scfs = new (require("simple-cors-file-server"))();

var path     = require("path");
var execPath = path.dirname( process.execPath );

var gui = require('nw.gui');
var win = gui.Window.get();
var menu = new gui.Menu();

// Let's avoid webkit/node context change errors
global.document = window.document;
global.navigator = window.navigator;
global.$ = global.jQuery = $;

var n_utils = require('./utils');
var ProgressBar  = require('progressbar.js');

var DropArea = require('./drop_area').DropArea;
var BitTorrent = require('./torrents');
var PlayerDevices = require('./devices').PlayerDevices;

//var Interface =  require('./interface');

/*
 * TorrenTV app
 *
 * 
 *
 *                               Device discovery (airplay/vlc/chromecast)
 *
 *                                            /`\
 *                                             |
 *                                            \./
 *
 *    (drag/drop component) drop_area <-> TorrenTVApp  <-> torrents (download engine)
 *
 *
 *
 * They communicated using events ands promises. TorrentTVApp is the main controller, 
 * handling the issue of commands , and responses from each component.
 *
 */

var TorrenTV = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( TorrenTV, events.EventEmitter )

TorrenTV.prototype.exit = function() {
    global.app.save();

    // Close window
    gui.Window.get().close(true);

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
}

TorrenTV.prototype.save = function(){
    var m_win = gui.Window.get();
    Settings.window = {x: m_win.x, y: m_win.y}
    saveSettings();
}

TorrenTV.prototype.loadFile = function(file){
    var self = this;

    if(file)
        self.drop_area.handleFile(file)
    else
        self.drop_area.openFileDialog();
}


TorrenTV.prototype.init = function(options){
    var self = this;

    self.updater = null;
    self.torrent = null;
    self.drop_area = null;
    self.devices = null;
    self.loading_progress = null;
    self.screen_state = 'wait-for-torrent';

    self.config = options;

    function clean(){
        if( Settings.DEBUG ){
            //win.showDevTools();

            var crash_path = path.resolve( gui.App.dataPath + '/crashes' );
            if(!fs.existsSync(crash_path))
                fs.mkdirSync(crash_path)
            gui.App.setCrashDumpDir( crash_path )
        }

        // Auto-updating
        self.updater = require('./auto-updater')
        if( Settings.auto_update )
            self.updater.autoUpdate()

        // MenuBar
        var isMac = process.platform.indexOf('darwin')>-1;
        var nativeMenuBar = new gui.Menu({type: "menubar"});
        if(isMac){
            nativeMenuBar.createMacBuiltin('TorrenTV', {'hideEdit': false})
            console.log("isMac, nativeMenuBar")
        }

        var tray = new gui.Tray({ icon: "./src/app/media/images/icons/icon-app-mini@2x.png" });
        var menu = new gui.Menu();

        menu.append(new gui.MenuItem({label: 'Open magnet/torrent', click: _.bind(function(){
            self.loadFile();
        }, this), key: 'o', 'modifiers': 'cmd'}));
        menu.append(new gui.MenuItem({label: 'Toggle torrent/player screen', click: _.bind(function(){
            self.toggleScreen( null );
        }, this), key: 't'}))
        menu.append(new gui.MenuItem({type: 'checkbox', label: 'Autoplay', checked: Settings.auto_play, 'click': function(){
            Settings.auto_play = !Settings.auto_play;
        }}));
        menu.append(new gui.MenuItem({label: 'Open Downloads folder', 'click': function(){
            gui.Shell.showItemInFolder( path.resolve( Settings.torrent_path )  );
        }}));
        menu.append(new gui.MenuItem({type: 'separator'}))
        menu.append(new gui.MenuItem({label: 'Quit', click: self.exit}))
        tray.menu = menu;

        // Window Size/State
        win.moveTo( Settings.window.x, Settings.window.y );

        // Clean default behaviour of drag/drop
        $(document).on('dragover', function(e){ e.preventDefault(); return false; } );
        $(document).on('drop',     function(e){ e.preventDefault(); return false; } );

        // Keys
        var ComboKey = require('combokeys');
        var mouseTrap = new ComboKey(document);
        global.mouseTrap = mouseTrap;

        mouseTrap.bind('f12', function() {
            win.showDevTools();
        });
        mouseTrap.bind('command+o', function(){
            self.loadFile();
            return false;
        });
        mouseTrap.bind('command+t', function(){
            self.toggleScreen(null);
            return false;
        });
        $(document).on('paste', function(e){
            var data = (e.originalEvent || e).clipboardData.getData('text/plain')
            self.drop_area.handleFile( data );
            return true;
        });
    }

    function setup(){
        // Torrent engine
        self.torrent = new BitTorrent.Engine();
        global.torrent = self.torrent;

        // Start droparea
        self.drop_area = new DropArea( {el: $(document)} );;
        global.drop_area = self.drop_area;

        // Player devices
        self.devices = new PlayerDevices();
        self.devices.setup_services();

        console.assert(global.torrent   !== null, "Torrent Engine should already be created but failed...");
        console.assert(global.drop_area !== null, "Drop Area failed to create");

        // Once dropped a File on our App start downloading
        self.drop_area.on('drop',    function(file){
            self.toggleScreen('wait-for-torrent');

            if(n_utils.isMagnet(file) || n_utils.isTorrent(file) || n_utils.isHttpResource(file)) self.download(file)
            else                                                                                  self.serveFile(file)
        })

        // Video ready to play, bitches
        self.on('video:ready', function(file){
            self.devices.startDeviceScan();

            /* Change to device view */
            self.toggleScreen('wait-for-players')
            if(Settings.auto_play){
                self.devices.play(Settings.address);
            }

        });

        /* New device detected */
        self.devices.on('deviceOn',  function(device, device_uri){
            var item = $('<a class="device animate ' + device.name + '" title="Play in ' + device.name + '" id="' + device.name + '">' +
                            '<i class="fa micon fa-play-circle ' + device.name +'-icon"></i>' + 
                            '<h4>' + device_uri + '</h4>' + 
                        '</a>');
            item.data('device_uri', device_uri);
            item.appendTo('.deviceList');

            // Put DEVICES around a circle
            var devices = $('.deviceList .device');
            for(var i = 0, l = devices.length+1; i < l; i++) {
                var pos_x  = (50 + (35* -1*Math.cos( (1/l)*(i+1)*Math.PI))),
                    pos_y  = (50 + (35* Math.sin(    (1/l)*(i+1)*Math.PI)));

                $(devices[i]).addClass( (pos_y > 50 ? 'labelOnTop' : 'labelOnBottom') );
                $(devices[i]).css({opacity: 1.0, left: pos_x.toFixed(4)+'%', top: pos_y.toFixed(4) + '%'});
            }
        });

        self.devices.on('deviceOff', function(device, device_uri) { 
            console.log('deviceOff ', device.name)
            $('#'+device.name).remove();
        }); 


        // Back to torrent view when playing
        self.devices.on('playing', function(){
            //$('.flipbook').removeClass('flip');
        });


        $('.refreshDeviceScan').on('click', function () {
            $('.deviceList').html('');
            self.devices.forceClean();

            self.devices.setup_services();
            self.devices.startDeviceScan();
        });
        $(document).on('click', '.device', function(e){
            var el = $(e.target).parent();
            var dev_uri = $(el).data('device_uri');

            self.devices.play(Settings.address, dev_uri)
        });

        setTimeout(function () {
            self.emit('app:ready')
        },10);
    }

    clean();
    setup();


    self.on('app:ready', function(){
        // Start s
        if( Settings.device_discovery_on_startup){
            console.log('device_discovery_on_startup');
            self.devices.startDeviceScan()
        }

        // there's already a torrent/magnet? Oh boy, start
        // right away!
        if(self.config.start_torrent)
            self.loadFile( self.config.start_torrent );
    });

};


/*
 * Toggle screen mode (flip the circle).
 *
 * If null is passed, automatically flip.
 * Otherwise, only flip if necssary
 */
TorrenTV.prototype.toggleScreen = function( new_state ){
    var self = this;

    // get next state if new_state == null
    var av_states = ['wait-for-players','wait-for-torrent']
    if(new_state == null){
        var j = av_states.indexOf( self.screen_state )
        new_state = av_states[(j + 1) % av_states.length]
    }

    if(new_state == self.screen_state)
        return

    var action = (new_state == 'wait-for-players' ? 'addClass' : 'removeClass')
    $('.flipbook')[action]('flip');
    gui.Window.get().focus();

    self.screen_state = new_state;
}









/*
 *
 * Handling download of different filetypes
 *
 */
TorrenTV.prototype.download = function(torrent_file){
    var self = this;

    // Download torrent
    $('body').addClass('torrent-loading');
    
    // This fires when Stream is first opened
    self.torrent.downloadTorrent(torrent_file).then( function( video_stream_uri ){
        $('body').removeClass('torrent-loading').addClass('torrent-ready')

        self.emit('torrent:file:ready', video_stream_uri)
        self.emit('video:ready', video_stream_uri)
        return;
    }).catch(function(err){
        console.error("Oops, some error occured while downloading torrent!", err);
    }).done()

    
    // When you first meet a torrent swarm, they kindly give you the treasure map!
    self.torrent.on('discovered-files',function(tor_files){

        // TODO:
        // Add file selection list, if user wants.
        self.emit('torrent:file:metadata', tor_files);

        // or just download everything!
        tor_files.forEach( function(file,i,files){
            console.info( file.name );
            file.select()
        });
    });

    // Delicious Water Data is flowiiing, goood!
    self.torrent.on('torrent:file:progress', function (data) {
            var torrent = data.torrent, 
                p =       data.progress;

            self.loading_progress.animate(p.ratio);
            win.setBadgeLabel( p.downSpeed );

            $('.filename').text( p.name );
            $('.sofar').text( p.down );
            $('.peers').text( p.peers.join('/') );
            $('.size').text( p.size );
    });
    
    // Fired when at least X% of the torrent is downloaded.
    // TODO: Fire torrent:file:buffered if torrent is already on local machine.
    self.torrent.on('torrent:file:buffered', function(video_stream_uri){
        //console.log("Wehhaaa, video buffered");
        //self.emit('torrent:file:ready', video_stream_uri);
        //self.emit('video:ready', video_stream_uri);
    });

    // Progress bar
    self.loading_progress = new ProgressBar.Circle( $('.downloadProgress').get(0), {
        duration: 300,
        color:      '#6FD57F',
        trailColor: 'rgba(0,0,0,0.75)',
        trailWidth: 5,
        easing: 'easeInOut',
        strokeWidth: 5
    });
}


/*
 * Stream video over HTTP .  
 * We create a fake 'files' array since peerflix already do this marvelously,
 * just monkey patch and plug it.
 *
 */
TorrenTV.prototype.serveFile = function(file){
    var self = this;

    var n_file = Object.create({});
    n_file.select = _.noop();
    n_file.deselect = _.noop();
    n_file.createReadStream = function() { return fs.createReadStream(file); }

    var streamer = require('./streamer');

    self.server = streamer.createHTTPStreamer({files: [n_file, ]});
    self.server.listen( Settings.port || 0 );

    self.emit('localfile:ready');
    self.emit('video:ready');
}


/*
 * We just need to inform the player where the video stream is
 */
TorrenTV.prototype.play = function( video_stream_uri, device_uri ){
    try {
        //this.devices.play(video_stream_uri, device)
        device.play(video_stream_uri);
        //this.drop_area.reset();
    } catch(err){
        console.error("error playing ", video_stream_uri, " to device ", device);
        console.error(err);
    }
}












/*
 * Better crash-dumps.
 *
 * But i cannot build 'exception' module on windows...
 * 
 *
var Exception = require('exception');
process.once('uncaughtException', function derp(err) {
  var exception = new Exception(err);
  console.log( exception.toJSON());
  exception.save();
});
*/

var last_arg = gui.App.argv.pop();

// Slavoj Žižek: The Reality of the Virtual ...
// var last_arg = 'magnet:?xt=urn:btih:97FCEEF8CC2228FEE253FE51A8E3D8C0C2438457&dn=slavoj+zizek+the+reality+of+the+virtual+2004+dvdrip+480p+h264&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337';
//
var app_config = {'start_torrent': (n_utils.isValidFile(last_arg) ? last_arg : undefined)};

window.addEventListener("load", function() {
    console.info(app_config);
    global.app  = new TorrenTV( app_config );
    global.app.on('app:ready', function () {
        $('body').css({opacity: 1});
        win.focus();
    });
    gui.App.on('open', function (cmdline) {
        var last_arg = cmdline.split(' ').pop() 
        if(n_utils.isValidFile(last_arg))
            global.app.loadFile( cmdline );
        else
            win.focus();
    });


    gui.Window.get().on('close', global.app.exit );
    gui.Window.get().show();
});

// SIGTERM AND SIGINT will trigger the exit event.
process.once("SIGTERM", function () {
    console.log("SIGTERM");
    console.trace()
    process.exit(0);
});
process.on('uncaughtException', function(err,e){
    console.info('Caught excetion ' , err);
    console.info(console.trace());
    //process.exit(-1);
    win.showDevTools();
});

