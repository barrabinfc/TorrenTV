/* jshint node: true */
"use strict";

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
    self.dragQueen = false;
    doc.on('dragenter', _.throttle( function (e) {
        if(!self.dragging){
            $(self.el).addClass('drag-hover');
            self.dragging = true;
        }
    }, 100));
    doc.on('dragend', function (e) {
        if(self.dragQueen){
            self.dragging = false;
            $(self.el).removeClass('drag-hover');
        }
    });
    doc.on('dragleave', function (e) {
        if(self.dragging){
            self.dragging = false;
            $(self.el).removeClass('drag-hover');
        }
    });

    // Show file dialog  selection
    $('.info-message').on('click', function(){
        //console.log("clicked on info-message");
        if(self.file) return false

        self.openFileDialog();

        return false;
    });



    doc.on('drop', function (event) {

        (event.preventDefault && event.preventDefault());

        var resource_path = event.dataTransfer.getData('Text');
        var resource_files = event.dataTransfer.files;

        console.debug("Droppped files: ", resource_path, resource_files )
        self.dragging = false;
        self.dragQueen = true;

        // Dropped some file
        var new_file = (resource_path.length > 0 ? resource_path : resource_files[0].path );

        // Launch file
        self.file = new_file;
        self.handleFile(new_file)

        return false;
    });

}


// Show file dialog  selection
DropArea.prototype.openFileDialog = function(){
    var self  = this;
    n_utils.chooseFile( function(file) {

        var new_file = file;
        if(new_file !== null){
            // Launch file
            self.file = new_file;
            self.handleFile(new_file)
        }
    });
}

/*
 * Performs mimetype/check if is a torrent/magnet,
 * video , etc.
 *
 */
DropArea.prototype.handleFile = function( file ){
    var self = this;

    console.log("handleFile",file);
    $(self.el).removeClass('drag-hover');

    if( n_utils.isTorrent(file) || n_utils.isMagnet(file) ||
        n_utils.isHttpResource(file) || n_utils.isAudioVideoFile(file) ){
        self.emit('drop',file);
    } else {
        console.error("Unknow file dropped: ", file );
/*
        // BUG: default_label is the previous message, not
        // necessarly is correct. We should put a error message, and
        // force state to be back to `wait-for-filedrop`.
        var default_label = $('.info-message').html();
        $('.info-message').html('Not a magnet/torrent!');

        $(self.el).addClass('error');
        _.delay(function(){
            $('.info-message').html(default_label);
            $(self.el).removeClass('error');
        }, 3000);

*/
        n_utils.flashMessage( 'Not a valid magnet/torrent!' ,'error')
        return;
    }

    $(self.el).removeClass('empty').addClass('has-file');

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
