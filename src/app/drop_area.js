var address = require('network-address');
var qs      = require('querystring');
var Q       = require('q');
var util    = require('util');
var path    = require('path');
var _       = require('underscore');

var events = require('events');
var n_utils = require('./utils');








var DropArea = function(options){
    events.EventEmitter.call(this);
    this.init(options);
}
util.inherits( DropArea, events.EventEmitter )

DropArea.prototype.init = function(options){
    var self = this;

    self.parent_el = $(document);
    self.el        = $('.dropArea');

    self.config = options;

    // Ui react to this changes, and others
    self.dragging = false;
    self.file = undefined;
    self.history = []

    var doc = $(self.parent_el);
    doc.on('dragover', _.throttle( function (e) {    
        $(self.el).addClass('drag-hover')
        self.dragging = true;
    }, 100));
    doc.on('dragend', function (e) {   self.dragging = false; $(self.el).removeClass('drag-hover'); });

    // Show file dialog  selection
    $('.info-message').on('click', function(){
        //console.log("clicked on info-message");
        if(self.file) return false

        n_utils.chooseFile( function(file) {

            var new_file = file;
            if(new_file !== null){
                // Launch file
                self.file = new_file;
                self.handleFile(new_file)
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
        self.dragging = false;

        // Dropped some file
        if(! resource_path.length > 0 && resource_files.length > 0 ){
            new_file = resource_files[0].path;
        } else {
            // Just some link
            new_file = resource_path;
        }

        // Launch file
        self.file = new_file;
        self.handleFile(new_file)

        return false;
    });

}

/*
 * Performs mimetype/check if is a torrent/magnet, 
 * video , etc.
 *
 * Launch the appropriate downloaders via signals
 */
DropArea.prototype.handleFile = function( file ){
    var self = this;

    console.log("handleFile",file);

    if( n_utils.isTorrent(file) || n_utils.isMagnet(file) ||
        n_utils.isHttpResource(file) || n_utils.isAudioVideoFile(file) ){
        self.emit('drop',file);
    } else {
        self.error = true;
        self.message = 'Unknow file dropped';

        console.error("Unknow file dropped: ", file );
    }

    $(self.el).removeClass('drag-hover').addClass('has-file');

    self.history.push(file)
};


// After file is playing, you can clean DropArea
// and call it again (waiting for file drops/clicks)
DropArea.prototype.reset = function(){
    var self = this;

    self.file     = undefined;
    self.dragging = false;

    $('.dropArea').removeClass(['drag-hover','has-file']);

    return;
}

exports.DropArea = DropArea;