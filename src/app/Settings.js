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

// 10fps torrent stats 
Settings.TORRENT_WATCHING_TIMER = 10; 

Settings.auto_update = true;
Settings.remove_downloads_on_exit = true;

Settings.animation = {
    time: 10000
};

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

global.Settings = Settings;
