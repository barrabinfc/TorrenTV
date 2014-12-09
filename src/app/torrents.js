var address = require('network-address');
var qs      = require('querystring');
var readTorrent = require( 'read-torrent' );
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
 * torrents.processTorrent( torrent_file ).then( function(movieName, movieHash){
 *   // here you can browse the file list of the torrent, if you wish...
 *
 *
 *   // Download the torrent
 *   torrets.downloadTorrent(movieName, movieHash)
 *          .then(function(stream_path){
 *              // stream started, open stream_path to watch the movie!
 *
 *          }, function(error){
 *              // Critical Error while downloading the torrent
 *
 *          }, function(progress){
 *              // Progress of the download
 *
 *          }).
 * } ).catch(function(error){
 *      console.log("opts, cant read torrent xxx")
 * });
 */

var Torrents = function(options){
    events.EventEmitter.call(this);
    var self = this;
    self.config = options;
    this.init();
}
util.inherits( Torrents, events.EventEmitter )

Torrents.prototype.init = function(){
    var self = this;
    self.loading = false;
}

Torrents.prototype.cleanCache = function(cb){
    // clean
    cb();
}



Torrents.prototype.processTorrent = function( torrent_file ){

    var defer = Q.defer();
    var self = this;

    // Read torrent file/magnet
    readTorrent( torrent_file, function(err, torrent_data) {
        if (err) {
            console.error("Error reading torrent ", torrent_data, err.message);
            defered.reject(new Error(("Error reading torrent...", torrent_data, err.message)))
        }

        console.info("Torrent DATA: ", torrent_data.files)

        if(JSON.stringify(torrent_data.files).toLowerCase().indexOf('mkv')>-1){
            self.emit('alert','Sorry, but MKV files doesnt play on airPlay.')
            movieName = torrent_data.name
            movieHash = torrent_data.infoHash
        } else {
            movieName = torrent_data.name
            movieHash = torrent_data.infoHash
        }

        defer.resolve( movieHash, movieName, torrent_data )
    });

    return defer.promise;
}



Torrents.downloadTorrent = function( torrent_file ){

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
        defered.resolve(href)
    });


    engine.server.once('error', function(e){
        console.error("Error on torrent engine: ",e)
        defered.reject(new Error(e))

        // Restart on perrlix error?
        //engine.server.listen(0, address())
    })

    engine.on('verify', function() {
        verified++;
        engine.swarm.piecesGot += 1;
    });

    engine.on('invalid-piece', function() {
        //console.log('invalidpiece')
        invalid++;
    });

    engine.on('hotswap', function() {
        hotswaps++;
    });
    engine.on('uninterested', function(){
        if(engine) engine.swarp.pause();
    })
    engine.on('insterested', function(){
        if(engine) engine.swarm.resume();
    })

    self.swarm.on('wire', function(){
        // Swarp started
    });


    var onready = function() {
        defer.resolve(engine.files)
    };
    if(engine.torrent) onReady;
    engine.on('ready', onready);



    return defer.promise;
}

exports.Engine = Torrents;
