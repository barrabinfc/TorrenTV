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


//Local File Streamming
var info = function(message){
  document.querySelector('#info-message').innerHTML = message;
}

var bytes = function(num) {
  return numeral(num).format('0.0b');
};

var statusMessage = function(unchoked,wires,swarm){
  document.getElementById('box-message').innerHTML = "Peers: "+unchoked.length+"/"+wires.length+"</br> Speed: "+bytes(swarm.downloadSpeed())+"/s</br>  Downloaded: "+bytes(swarm.downloaded)
}

var cleanStatus = function(){
  document.getElementById('box-message').innerHTML = ""
}

function chooseFile(cb) {
    var chooser = document.querySelector('#fileDialog');
    chooser.addEventListener("change", function(evt) {
        cb(this.value);
    }, false);

    chooser.click();
}

/*
global.chooseFile = chooseFile;
global.download = download;
global.openInFinder = openInFinder;
*/

exports.chooseFile = chooseFile;
exports.download   = download;
exports.openInFinder = openInFinder;
