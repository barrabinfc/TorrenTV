/* jshint node: true */
"use strict";

/* 
 * Auto Updating service
var UpdaterService  = require('nw-updater');

var checkUpdates = function(){
    var updater = new UpdaterService({'channel':'beta', 
                                      "currentVersion": Settings.version,
                                      'endpoint':'http://torrentv.github.io/update.json'})
    updater.update()

    updater.on("download", function(version){
        console.log("OH YEAH! going to download version "+version)
    })
    updater.on("installed", function(){
        console.log("SUCCCESSFULLY installed new version, please restart")
    })
    updater.on("error", function(msj){
        console.log(msj)
    })
}

*/
module.exports = {'autoUpdate': function(){}}
