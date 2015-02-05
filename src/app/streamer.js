/* jshint node: true */
"use strict";

var http = require('http');
var fs = require('fs');
var rangeParser = require('range-parser');
var url = require('url');
var mime = require('mime');
var pump = require('pump');

/*
 * A HTTP with streaming support. 
 *
 * Just got it from peerflix, useful for serving 
 *  localhost video
 *
 *  Todo: 
 *          send a feature request to peerflix to
 *              expose createServer
 *
 *
    file1 = Object.create(file)
    file1.select = _.noop();
    file1.deselect = _.noop();
    file1.createReadStream = function() { return fs.createReadStream(file)}

    createHTTPStreamer({files: [file1, ]})

    The last parameters, index, serve as an 
    index to what file to serve.

 *
 *
 */

function createHTTPStreamer(e, index){
    var server = http.createServer();

    var onready = function() {
        if (typeof index !== 'number') {
            index = e.files.reduce(function(a, b) {
                return a.length > b.length ? a : b;
            });
            index = e.files.indexOf(index);
        }

        e.files[index].select();
        server.index = e.files[index];
    };
    onready();

    var toJSON = function(host) {
        var list = [];
        e.files.forEach(function(file, i) {
            list.push({ name:file.name, length:file.length, url:"http://"+host+"/"+i});
        });
        return JSON.stringify(list, null, '  ');
    };

    server.on('request', function(request, response) {
        var u = url.parse(request.url);
        var host = request.headers.host || 'localhost';

        if (u.pathname === '/favicon.ico') return response.end();
        if (u.pathname === '/') u.pathname = '/'+index;
        if (u.pathname === '/.json') return response.end(toJSON(host));
        if (u.pathname === '/.m3u') {
            response.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
            return response.end('#EXTM3U\n' + e.files.map(function (f, i) {
                return '#EXTINF:-1,' + f.path + '\n' + 'http://'+host+'/'+i;
            }).join('\n'));
        }

        var i = Number(u.pathname.slice(1));

        if (isNaN(i) || i >= e.files.length) {
            response.statusCode = 404;
            response.end();
            return;
        }

        var file = e.files[i];
        var range = request.headers.range;
        range = range && rangeParser(file.length, range)[0];
        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Content-Type', mime.lookup(file.name));

        if (!range) {
            response.setHeader('Content-Length', file.length);
            if (request.method === 'HEAD') return response.end();
            pump(file.createReadStream(), response);
            return;
        }

        response.statusCode = 206;
        response.setHeader('Content-Length', range.end - range.start + 1);
        response.setHeader('Content-Range', 'bytes '+range.start+'-'+range.end+'/'+file.length);

        if (request.method === 'HEAD') return response.end();
        pump(file.createReadStream(range), response);
    }).on('connection', function(socket) {
        socket.setTimeout(36000000);
    });

    return server;

}

exports.createServer = createHTTPStreamer
