var address = require('network-address');
var qs      = require('querystring');
var Q       = require('q');
var util    = require('util');
var path    = require('path');
var _       = require('underscore');
var n_utils = require('./utils');

var events = require('events');

isMagnet = function(link){
    return (link.toLowerCase().substring( 0, 6) === 'magnet')
}

isTorrent = function(link){
    return (link.toLowerCase().substring(link.length-7,link.length) === 'torrent');
}


enabled_mimetypes = ['mp4','m4v','mov','jpg','mkv','avi','m4a','flac','srt','vtt','mp3']
isAudioVideoFile = function(link){

    mimetype_match = false;
    for(var c_myme in enabled_mimetypes){
        if(link.toLowerCase().substring( link.length - c_myme.length , link.length ) === c_myme ){
            mimetype_match = true
            break;
        }
    }
    return mimetype_match;
}

isHttpResource = function(link){
    return (link.toLowerCase().substring(0,5) === 'http')
}









var DropArea = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( DropArea, events.EventEmitter )

DropArea.prototype.init = function(options){
    var self = this;

    self.el = options.el;
    self.config = options;
    self.current_file = undefined;
    self.file_history = []

    var doc = $(self.el);
    doc.on('dragover', _.throttle( function (e) {   
        //e.preventDefault();
        $('.dropArea').addClass('drag-hover'); 
        //return false;
    }, 100));
    doc.on('dragend', function (e) {   
        console.log("dragEnd")
        $('.dropArea').removeClass('drag-hover'); 
        //return false;
    });

    // Show file dialog  selection
    $('.info-message').on('click', function(){
        console.log("clicked on info-message");
        if(self.current_file)
            return false

        n_utils.chooseFile( function(file) {

            var new_file = file;
            if(new_file !== null){
                // Launch file
                self.current_file = new_file;
                self.launchFile(new_file)
        
            }
        });

        return false;
    });
    /*
    doc.on('mouseover', _.bind(function(e){
        $('.dropArea').addClass('drag-hover'); 
    }, self ));

    doc.on('mouseout', _.bind(function(e){
        $('.dropArea').removeClass('drag-hover');
    },self));
    */


    /*
     * Ok!
     *
     * If .torrent or magnet link is dropped, emmit signal 'torrent-download'
     * Otherwise, if is a video file or a HTTP URL, emit signal 'play'
     *
     */
    doc.on('drop', function (event) {

        event.preventDefault && event.preventDefault();

        var resource_path = event.dataTransfer.getData('Text');
        var resource_files = event.dataTransfer.files;

        console.debug("Droppped files: ", resource_path, resource_files )

        // Dropped some file
        if(! resource_path.length > 0 && resource_files.length > 0 ){
            new_file = resource_files[0].path;
        } else {
            // Just some link
            new_file = resource_path;
        }

        // Launch file
        self.current_file = new_file;
        self.launchFile(new_file)

        return false;
    });

}


DropArea.prototype.playFile = function( file){
    var self = this;
    self.emit('play', file )
}

DropArea.prototype.downloadFile = function(file){
    var self = this;
    $('.dropArea').addClass('downloading');
    if( isTorrent(file) || isMagnet(file)){
        self.emit('torrent-download', file)
    } else if( isHttpResource(file) ){
        self.emit('http-download', file)
    }
}


/*
 * Performs mimetype/check if is a torrent/magnet, 
 * video , etc.
 *
 * Launch the appropriate downloaders via signals
 */
DropArea.prototype.launchFile = function( file ){
    var self = this;

    $('.dropArea').removeClass('drag-hover');

    // Is a torrent ?
    if( isTorrent(file) || isMagnet(file)){
        self.downloadFile(file)

    // Or a HTTP Link
    } else if(isHttpResource(file)){
        qs_path = file.split('?')[0]
        self.downloadFile(qs_path)

    // Is a audiovisual file?
    } else if( isAudioVideoFile(file)){
        var dirname  = path.dirname(file)
        var basename = path.basename(file)

        // Start some file server ?
        self.playFile(file)
    
    } else {
        console.error("Unknow file dropped: ", file );
    }
};


// After file is playing, you can clean DropArea
// and call it again (waiting for file drops/clicks)
DropArea.prototype.reset = function(){
    var self = this;

    self.current_file = undefined;
    $('.dropArea').removeClass('hang-hover', removeClass('downloading'));

    return;
}

exports.DropArea = DropArea;
