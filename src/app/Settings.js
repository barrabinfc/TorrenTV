var os = require('os'),
	path = require('path'),
	_ = require('underscore'),
    gui       = require('nw.gui'),
	data_path = gui.App.dataPath,
    currentVersion  = gui.App.manifest.version;

var Settings = {};

Settings.version = currentVersion;
Settings.address = '192.168.0.101:8000';
Settings.DEBUG   = true;
Settings.DISCOVERY_TIMEOUT = 7000;
Settings.DISCOVERY_STATUS  = 'running';

// Load video when 5% is already loaded
Settings.PRELOAD_BUFFER = 0.02;

// 5fps torrent stats 
Settings.TORRENT_WATCHING_TIMER = 5; 

Settings.auto_update = true;
Settings.remove_downloads_on_exit = true;
Settings.auto_play = true;

Settings.device_discovery_on_startup = true;

Settings.devices = {
    default: 'vlc',
    roku: {
        enabled: false,
        port:    9009,
        xml:     'index.xml'
    },
    vlc: {
        enabled: true,
        addresses: 'localhost'
    },
    xbmc: {
        enabled: true
    },
    chromecast: {
        enabled: true,
        port:    9900,
        address: "http://localhost:9900"
    },
    airplay: {
        enabled: true
    }
};
Settings.window = {
    x: 300,
    y: 300
};


/*
 * Load/Restore
 */
var loadSettings = function(){
    var sett = JSON.parse(localStorage.settings || 'null');
    var _s = _.extend( Settings, sett )
    return _s
}

var saveSettings = function(){
    var sett = JSON.stringify( global.Settings );
    localStorage['settings'] = sett;
    console.log("saved Settings", sett);
}

global.Settings = loadSettings();
global.saveSettings = saveSettings;
