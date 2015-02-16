var os = require('os'),
	path = require('path'),
	_ = require('underscore'),
    gui       = require('nw.gui'),
	data_path = gui.App.dataPath,
    currentVersion  = gui.App.manifest.version;

var Settings = {};

Settings.platform = process.platform;
Settings.HOME = (process.platform === 'win32') ? process.env.HOMEPATH : process.env.HOME;

Settings.version = currentVersion;
Settings.address = '192.168.0.101:8000';
Settings.DEBUG   = true;

// Load video when 1% is already loaded
Settings.PRELOAD_BUFFER = 0.01;

// 5fps torrent stats
Settings.TORRENT_WATCHING_TIMER = 5;
Settings.torrent_path = path.join( Settings.HOME , '/Downloads' )

Settings.auto_update = true;
Settings.remove_downloads_on_exit = false;
Settings.auto_play = true;

Settings.device_discovery_on_startup = true;
Settings.device_discovery_timeout = 0;
Settings.devices = {
    default: 'chromecast',
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

Settings.keybindings = {};
Settings.keybindings.modifier = (process.platform === 'darwin' ? 'cmd' : 'ctrl');
Settings.keybindings.keys = {
		'open': 		    {'key': 'o', 'modifier': []},
		'toggleScreen': {'key': 't', 'modifier': []},
		'download': 	  {'key': 'J', 'modifier': ['shift']},
		'quit': 			  {'key': 'Q', 'modifier': ['shift']}
};
_.each(Settings.keybindings.keys, function(key,name){
	key.modifier.unshift(Settings.keybindings.modifier);
});
console.info(Settings.keybindings.keys);

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
