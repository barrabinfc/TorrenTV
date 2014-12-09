var address = require('network-address');
var qs      = require('querystring');
var Q       = require('q');
var util    = require('util');

var events = require('events');

isMagnet = function(link){
    console.log('isMagnet', link)
    return (link.toLowerCase().substring( 0, 6) === 'magnet')
}

isTorrent = function(link){
    console.log('isTorrent', link)
    return (link.toLowerCase().substring(link.length-7,link.length) === 'torrent');
}


enabled_mimetypes = ['mp4','m4v','mov','jpg','mkv','avi','m4a','flac','srt','vtt','mp3']
isAudioVideoFile = function(link){

    console.log('isAudioVideoFile', link)

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
    console.log('isHttpResource', link)
    return (link.toLowerCase().substring(0,5) === 'http')
}









var DropArea = function(options){
    events.EventEmitter.call(this);
    var self = this;
    self.el = options.el;
    self.config = options;
    this.init();
}
util.inherits( DropArea, events.EventEmitter )

DropArea.prototype.init = function(){
    var self = this;

    self.current_file = undefined;
    self.file_history = []

    var doc = self.el;
    doc.ondragover = function () {  this.className = 'hover'; return false; };
    doc.ondragend = function () {   this.className = ''; return false; };

    /*
     * Ok!
     *
     * If .torrent or magnet link is dropped, emmit signal 'torrent-download'
     * Otherwise, if is a video file or a HTTP URL, emit signal 'play'
     *
     */
    doc.ondrop = function (event) {

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

        self.current_file = new_file;
        self.launchFile(new_file)

        return false;
    }

}


DropArea.prototype.playFile = function( file){
    var self = this;
    console.log("play", file)
    self.emit('play', file )
}

DropArea.prototype.downloadFile = function(file){
    var self = this;
    if( isTorrent(file) || isMagnet(file)){
        console.log("torrent-download", file)
        self.emit('torrent-download', file)
    } else if( isHttpResource(file) ){
        console.log("http-download", file)
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

    // Is a torrent ?
    console.log(file)
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
        console.error("Unknow fille", file)
    }
};

exports.DropArea = DropArea;
