var address = require('network-address');
var qs      = require('querystring');
var peerflix    = require('peerflix')
var Q       = require('q');
var util    = require('util')

var http = require('http');
var fs = require('fs');

var events = require('events');

/*
 * Create a new instance...
 *
 * torrents = new Torrents()
 *
 *   // Download the torrent
 *   torrents.downloadTorrent( torrent_file_or_magnet )
 *          .then(function( torrent_stream_uri ){
 *
 *              // stream started, open torrent_stream_uri to watch the movie!
 *
 *          }, function(error){
 *
 *              // Critical Error while downloading the torrent
 *
 *          }).done();
 *
 *  torrents.on('discovered-files',function( tor_files ){
 *      // If i want to download all files!
 *      tor_files.forEach( function(file,i){
 *          console.log(file)
 *          file.select()
 *      } );
 *  });
 *
 * });
 */

var Torrents = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( Torrents, events.EventEmitter )

Torrents.prototype.init = function(options){
    var self = this;
    self.config = options;
    self.loading = false;
}

Torrents.prototype.cleanCache = function(cb){
    // clean
    cb();
}


Torrents.prototype.downloadTorrent = function( torrent_file ){

    var self = this;
    var defer = Q.defer()

    var engine = peerflix(torrent_file, {})
    self.engine = engine;

    self.hotswaps = 0;
    self.verified = 0;
    self.invalid = 0;

    self.wires = engine.swarm.wires;
    self.swarm = engine.swarm;
    var wires = self.wires;
    var swarm = self.swarm;

    self.active = function(wire) {
        return !wire.peerChoking;
    };

    engine.server.on('listening', function() {
        var href = 'http://'+ address() + ':' + engine.server.address().port + '/';
        var filename = engine.server.index.name.split('/').pop().replace(/\{|\}/g, '');
        var filelength = engine.server.index.length;

        // Yepa, we have a stream on this address
        console.log('Torrent-Streaming file is listening at address: ', href)
        Settings.address = href;

        // Updating is based on setInterval
        defer.resolve(href)
    });


    engine.server.once('error', function(e){
        console.error("Error on torrent engine: ",e)
        defer.reject(new Error(e))

        // Restart on perrlix error?
        //engine.server.listen(0, address())
    })

    engine.on('verify', function() {
        self.verified++;
        engine.swarm.piecesGot += 1;
    });

    engine.on('invalid-piece', function() {
        //console.log('invalidpiece')
        self.invalid++;
    });

    engine.on('hotswap', function() {
        self.hotswaps++;
    });
    engine.on('uninterested', function(){
        if(engine) self.engine.swarm.pause();
    })
    engine.on('insterested', function(){
        if(engine) self.engine.swarm.resume();
    })

    self.swarm.on('wire', function(){
        // Swarm started
    });

    self.update_timer = setTimeout( function(){
        defer.notify( self );
    }, 1000.0/Settings.TORRENT_WATCHING_TIMER )


    /*
     *
     */
    var onready = function() {
        self.emit('discovered-files', engine.files)
    };
    if(engine.torrent) onReady;
    engine.on('ready', onready);

    return defer.promise;
}

exports.Engine = Torrents;
