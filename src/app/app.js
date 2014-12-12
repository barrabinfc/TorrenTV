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

// Let's avoid webkit/node context change errors
global.document = window.document;
global.navigator = window.navigator;
global.$ = global.jQuery = $;

var n_utils = require('./utils');
var rivets = require('rivets');


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

TorrenTV.prototype.init = function(options){
    var self = this;

    self.updater = null;
    self.torrent = null;
    self.drop_area = null;
    self.devices = null;

    self.config = options;

    console.info("CWD: ",process.cwd())
    console.info("PATH: ",execPath)

    function clean(){
        if( Settings.DEBUG ){
            //win.showDevTools();

            crash_path = gui.App.dataPath + '/crashes/';
            if(!fs.existsSync(crash_path))
                fs.mkdirSync(crash_path)
            gui.App.setCrashDumpDir( crash_path )
        }

        // Auto-updating
        self.updater = require('./auto-updater')
        if( Settings.auto_update )
            self.updater.autoUpdate()

        var isMac = process.platform.indexOf('darwin')>-1;
        if(isMac){
            var nativeMenuBar = new gui.Menu({type: "menubar"});
            nativeMenuBar.createMacBuiltin('TorrenTV', {'hideEdit': true})
            win.menu = nativeMenuBar;
        }

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
        mouseTrap.bind('command+v', function(){
            data = clipboard.get('text')
            self.drop_area.handleFile( data );
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
        self.drop_area = new DropArea( {el: $(document)} );
        global.drop_area = self.drop_area;

        // Player devices
        self.devices = new PlayerDevices();
        self.devices.setup_services();

        console.assert(global.torrent   !== null, "Torrent Engine should be created but failed");
        console.assert(global.drop_area !== null, "Drop Area failed to create");

        // Once dropped a File on our App start downloading
        self.drop_area.on('drop',    function(file){
            $('.flipbook').removeClass('flip')
            $('body').addClass('downloading')

            if(n_utils.isMagnet(file) || n_utils.isTorrent(file) || n_utils.isHttpResource(file)) self.download(file)
            else                                                                                  self.serveFile(file)
        })

        self.on('torrent:file:metadata',     function(metadata) {
            // i can choose the filesss to play. 
            // But i'm not in the mood
            return;
        });
        self.on('torrent:file:progress',  function(data){
            var torrent = data.torrent, 
                p =       data.progress;

            //var f_name = torrent.engine.files.name;

            //$('.filename').text(f_name);
            $('.sofar').text( p.down );
            $('.peers').text( p.peers.join('/') );
            $('.speed').text( p.downSpeed );
            $('.size').text( p.size );
        });

        // Video ready to play, bitches
        self.on('video:ready', function(file){

            //self.devices.startDeviceScan();

            /* Change to device view
            _.delay(function(){
                $('.flipbook').addClass('flip');
                //self.play( file )
            }, 3000 );
            */

        } );

        /* New device detected */
        self.devices.on('deviceOn',  function(device, address){
            console.log("Hey, where am i?", device, address)
            var item = $('<a class="device ' + device.name + '" id="' + device.name + '">' +
                            '<i class="fa micon fa-play-circle"></i>' + 
                            '<h4>' + address + '</h4>' + 
                        '</a>');
            item.appendTo('.deviceList');

            // Put in circular motion
            var devices = $('.deviceList .device');
            for(var i = 0, l = devices.length+1; i < l; i++) {
                var pos_x  = (24   + 40   * Math.cos( Math.PI - 2*(1/l)*i*Math.PI)),
                    pos_y  = (52.5 + 40   * Math.sin( Math.PI - 2*(1/l)*i*Math.PI));

                //var pos_x  = (24 + 45   * Math.cos(0.5 * Math.PI - 2*(1/l)*i*Math.PI)),
                //    pos_y  = (52.5 + 45 * Math.sin(0.5 * Math.PI - 2*(1/l)*i*Math.PI));

                $(devices[i]).addClass( (pos_y > 50 ? 'labelOnTop' : 'labelOnBottom') );
                $(devices[i]).css({opacity: 1.0, left: pos_x.toFixed(4)+'%', top: pos_y.toFixed(4) + '%'});
            }
        });
        self.devices.on('deviceOff', function(device, address) { 
            console.log('deviceOff ', device,name)
            $('#'+device.name).remove();
        }); 
    }

    clean();
    setup();

    // Start services/device discovery  on startup ?
    if( Settings.device_discovery_on_startup){
        //self.devices.startDeviceScan()
    }

    // there's already a torrent/magnet? Oh boy, start
    // right away!
    if(self.config.start_torrent)
        self.drop_area.handleFile(self.config.start_torrent);

    self.emit('app:ready');
    win.focus();
};















/*
 *
 * Handling download of different filetypes
 *
 */
TorrenTV.prototype.download = function(torrent_file){
    var self = this;

    // Download torrent
    self.torrent.downloadTorrent(torrent_file).then( function( video_stream_uri ){
        self.emit('torrent:file:ready', video_stream_uri)
        self.emit('video:ready', video_stream_uri)
    }).progress(function(torrent){

        var swarm = torrent.swarm;
        var wires = swarm.wires;
        var bytes = n_utils.bytes;

        var active_peers = wires.filter(function(wire){
            !wire.peerChoking;
        });
        var p = {peers:         [active_peers, wires.length],
                 size:          _.max( torrent.engine.files, 'length' ).length,
                 down:          bytes(swarm.downloaded),
                 up:            bytes(swarm.uploaded),
                 downSpeed:     bytes(swarm.downloadSpeed())};

       self.emit('torrent:file:progress', {torrent: torrent, progress: p})

    }).catch(function(err){
        console.error("Oops, some error occured while downloading torrent!", err);
    }).done()

    //  Select every file to download
    self.torrent.on('discovered-files',function(tor_files){

        self.emit('torrent:file:metadata', tor_files)
        // Here we can filter what files should be played, show to user, etc

        // or just download everything!
        tor_files.forEach( function(file,i,files){
            console.info( file.name );
            file.select()
        });
    });
}


/*
 * Stream video over HTTP .  
 * We create a fake 'files' since peerflix already do this marvelously,
 * i've just monkey patchit.
 *
 */
TorrenTV.prototype.serveFile = function(file){
    var self = this;

    file = Object.create(file)
    file.select = _.noop();
    file.deselect = _.noop();
    file.createReadStream = function() { return fs.createReadStream(file)}

    // 
    streamer = require('./streamer');

    self.server = streamer.createHTTPStreamer({files: [file, ]});
    self.server.listen( Settings.port || 0 );

    self.emit('localfile:ready');
    self.emit('video:ready');
}

/*
 * We just need to inform the player where the video stream is
 */
TorrenTV.prototype.play = function( video_stream_uri, device ){
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
 * Better crash-dumps
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
var last_arg = 'magnet:?xt=urn:btih:97FCEEF8CC2228FEE253FE51A8E3D8C0C2438457&dn=slavoj+zizek+the+reality+of+the+virtual+2004+dvdrip+480p+h264&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337';


var is_torrent = (last_arg && (last_arg.substring(0, 8) === 'magnet:?' || last_arg.substring(0, 7) === 'http://' || last_arg.endsWith('.torrent')))

var app_config = {'start_torrent': (is_torrent ? last_arg : undefined)};

window.addEventListener("load", function() {
    global.app  = new TorrenTV( app_config );

    gui.Window.get().on('close', global.app.exit );
    gui.Window.get().show();
    gui.Window.get().focus();
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

