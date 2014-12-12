var openInFinder = function(file){
  var gui = require('nw.gui');
  gui.Shell.showItemInFolder(file);
}

var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  });
}


var bytes = function(num) {
  return numeral(num).format('0.0b');
};

function chooseFile(cb) {
    var chooser = document.querySelector('#fileDialog');
    chooser.addEventListener("change", function(evt) {
        cb(this.value);
    }, false);

    chooser.click();
}


exports.isMagnet = function(link){
    return (link.toLowerCase().substring( 0, 6) === 'magnet')
}

exports.isTorrent = function(link){
    return (link.toLowerCase().substring(link.length-7,link.length) === 'torrent');
}

enabled_mimetypes = ['mp4','m4v','mov','jpg','mkv','avi','m4a','flac','srt','vtt','mp3']
exports.isAudioVideoFile = function(link){

    mimetype_match = false;
    for(var c_myme in enabled_mimetypes){
        if(link.toLowerCase().substring( link.length - c_myme.length , link.length ) === c_myme ){
            mimetype_match = true
            break;
        }
    }
    return mimetype_match;
}

exports.isHttpResource = function(link){
    return (link.toLowerCase().substring(0,5) === 'http')
}


exports.chooseFile = chooseFile;
exports.download   = download;
exports.openInFinder = openInFinder;

