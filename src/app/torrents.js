/* jshint node: true */
"use strict";

var address = require('network-address');
var qs      = require('querystring');
var peerflix    = require('peerflix')
var Q       = require('q');
var util    = require('util')
var _ = require('underscore');

var http = require('http');
var fs = require('fs');

var events = require('events');
var n_utils = require('./utils')
var bytes = n_utils.bytes;

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
    self.engine = null;

}

Torrents.prototype.cleanCache = function(cb){
    // clean
    cb();
}


Torrents.prototype.downloadTorrent = function( torrent_file ){

    var self = this;
    var defer = Q.defer()

    console.assert(self.engine == null, "A torrent is already downloadiiiing, bitch!");

    var engine = peerflix(torrent_file, {})
    self.loading = true;
    self.engine = engine;

    self.hotswaps = 0;
    self.verified = 0;
    self.invalid = 0;

    self.wires = engine.swarm.wires;
    self.swarm = engine.swarm;
    var wires = self.wires;
    var swarm = self.swarm;

    var isActive = function(wire) {
        return !wire.peerChoking;
    };

    // peerflix started serving the File!
    self.engine.server.on('listening', function() {
        var href = 'http://'+ address() + ':' + engine.server.address().port + '/';
        var filename = engine.server.index.name.split('/').pop().replace(/\{|\}/g, '');
        var filelength = engine.server.index.length;

        // Yepa, we have a stream on this address
        console.log('Torrent-Streaming file is listening at address: ', href)
        Settings.address = href;

        self.loading = false;
        //clearInterval(self.update_timer)

        // Updating is based on setInterval
        defer.resolve(href)
    });

    // Progress
    self.update_timer = setInterval( function(){
        if(self.loading)
            return

        var p = {peers:         [ _.filter(self.wires, isActive).length, self.wires.length],
                 name:          self.engine.torrent.name,
                 sizeBytes:    _.reduce( 
                            _.pluck( self.engine.files, 'length' ), function(a,b){
                                    return a+b;
                            }),
                 size:    bytes( _.reduce( 
                            _.pluck( self.engine.files, 'length' ), function(a,b){
                                    return a+b;
                            }) ),
                 down:          bytes(self.swarm.downloaded),
                 up:            bytes(self.swarm.uploaded),
                 downSpeed:     bytes(self.swarm.downloadSpeed()) };

        var ratio = self.swarm.downloaded/p.sizeBytes;
        if(ratio > Settings.preload_buffer){
            self.emit('torrent:file:preloaded', {torrent: torrent, progress: p})
            return;
        }

        self.emit('torrent:file:progress', {torrent: torrent, progress: p})
        defer.notify( {torrent: torrent, progress: p});
    }, 1000.0/Settings.TORRENT_WATCHING_TIMER );


    engine.server.once('error', function(e){
        self.loading = false;
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
    self.swarm.on('wire', function(){
        // Swarm started
    });

    /*
     *
     */
    var onReady = function() {
        self.loading = false;
        self.emit('discovered-files', engine.files)
    };
    if(engine.torrent) onReady;
    engine.on('ready', onReady);

    return defer.promise;
}

exports.Engine = Torrents;
