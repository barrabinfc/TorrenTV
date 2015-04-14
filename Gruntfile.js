
var parseBuildPlatforms = function(argumentPlatform) {
	// this will make it build no platform when the platform option is specified
	// without a value which makes argumentPlatform into a boolean
	var inputPlatforms = argumentPlatform || process.platform + ";" + process.arch;

	// Do some scrubbing to make it easier to match in the regexes bellow
	inputPlatforms = inputPlatforms.replace("darwin", "mac");
	inputPlatforms = inputPlatforms.replace(/;ia|;x|;arm/, "");

	var buildAll = /^all$/.test(inputPlatforms);

	var buildPlatforms = {
		mac: /mac/.test(inputPlatforms) || buildAll,
		win: /win/.test(inputPlatforms) || buildAll,
				win32: /win32/.test(inputPlatforms) || buildAll,
				win64: /win64/.test(inputPlatforms) || buildAll,
		linux32: /linux32/.test(inputPlatforms) || buildAll,
		linux64: /linux64/.test(inputPlatforms) || buildAll
	};

	return buildPlatforms;
};

module.exports = function(grunt) {
	"use strict";

	var buildPlatforms = parseBuildPlatforms(grunt.option('platforms'));
	var mpackage = grunt.file.readJSON('./src/app/package.json');
    var currentVersion = mpackage.version

	require('load-grunt-tasks')(grunt);
	grunt.loadNpmTasks('grunt-jsvalidate');

		grunt.loadNpmTasks('grunt-contrib-copy');

	grunt.registerTask('build', [
		'nodewebkit',
	]);

	grunt.registerTask('dist', [
		'clean:releases',
		'build',
				//'copy',
		'exec:createDmg',			 // mac
		'exec:createWinInstall',
		'compress' // win & linux
	]);

	grunt.registerTask('start', function(){
		var start = parseBuildPlatforms();
		if(start.win32){
			grunt.task.run('exec:win32');
				}else if(start.win64){
			grunt.task.run('exec:win64');
				}else if(start.mac){
			grunt.task.run('exec:mac');
		}else if(start.linux32){
			grunt.task.run('exec:linux32');
		}else if(start.linux64){
			grunt.task.run('exec:linux64');
		}else{
			grunt.log.writeln('OS not supported.');
		}
	});

	grunt.initConfig({
        package: mpackage,
		nodewebkit: {
			options: {
				version: '0.12.0-alpha3',
				buildDir: './build', // Where the build version of my node-webkit app is saved
				buildType: 'versioned',
				cacheDir: './build/cache',
				embed_nw: true,
				zip: false, // Zip nw for mac in windows. Prevent path too long if build all is used.
				macCredits: './src/app/credits.html',
				macIcns: './src/app/media/images/icons/MyIcon.icns', // Path to the Mac icon file
                macPlist: {
                    CFBundleName       : "<%= package.config['name'] %>",
                    CFBundleDisplayName: "<%= package.config['name'] %>",
                    LSEnvironment      : {
                        PATH: "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
                    }
                },
				//winIco: './src/app/media/images/icons/favicon.ico',
				mac: buildPlatforms.mac,
				win: buildPlatforms.win,
				linux32: buildPlatforms.linux32,
				linux64: buildPlatforms.linux64,
			},
			src: ['./src/**',
					'./node_modules/**',
					'!./node_modules/bower/**', '!./node_modules/*grunt*/**',
				 	'!./**/test*/**', '!./**/doc*/**',
					'!./**/example*/**', '!./**/demo*/**', '!./**/bin/**', '!./**/build/**', '!./**/.*/**',
				 	'./src/app/package.json', './README.md', './LICENSE.txt' ]
		},

		exec: {
			win: {
				cmd: '"build/cache/<%= nodewebkit.options.version %>/win32/nwjs.exe" .'
			},
			win32: {
				cmd: '"build/cache/<%= nodewebkit.options.version %>/win32/nwjs.exe" .'
			},
			win64: {
				cmd: '"build/cache/<%= nodewebkit.options.version %>/win64/nwjs.exe" .'
			},
			mac: {
				cmd: '"build/cache/<%= nodewebkit.options.version %>/osx64/nwjs.app/Contents/MacOS/nwjs" .'
			},
			linux32: {
				cmd: '"build/cache/<%= nodewebkit.options.version %>/linux32/nw" .'
			},
			linux64: {
				cmd: '"build/cache/<%= nodewebkit.options.version %>/linux64/nw" .'
			},
			createDmg: {
				cmd: 'dist/mac/yoursway-create-dmg/create-dmg --volname "TorrenTV ' + currentVersion + '" --background ./dist/mac/background.png --window-size 480 540 --icon-size 128 --app-drop-link 240 370 --icon "TorrenTV" 240 110 ./build/releases/TorrenTV/mac/TorrenTV-' + currentVersion + '-Mac.dmg ./build/releases/TorrenTV/mac/'
			},
			createWinInstall: {
				cmd: 'makensis dist/windows/installer.nsi'
			}
		},

		jshint: {
			gruntfile: {
				options: {
					jshintrc: '.jshintrc'
				},
				src: 'Gruntfile.js'
			},
			src: {
				options: {
					jshintrc: 'src/app/.jshintrc'
				},
				src: ['src/app/*.js','src/app/**/*.js']
			}
		},

		jsvalidate: {
			options: {
				globals: {},
				verbose: false
			},
			targetName: {
				files: {
					src: ['src/app/*.js',]
				}
			}
		},

				/* FFMPeg libraries with more codecs
				copy: {
						main: {
								files: [{
												src: 'dist/win/ffmpegsumo.dll',
												dest: 'build/releases/TorrenTV/win32/TorrenTV/ffmpegsumo.dll',
										},
										{
												src: 'dist/mac/ffmpegsumo.so',
												dest: 'build/releases/TorrenTV/mac/TorrenTV.app/Contents/Frameworks/node-webkit Framework.framework/Libraries/ffmpegsumo.so'
										}]
						}
				},
				*/

		compress: {
			linux32: {
				options: {
					mode: 'tgz',
					archive: 'build/releases/TorrenTV/linux32/TorrenTV-' + currentVersion + '-Linux-32.tar.gz'
				},
				expand: true,
				cwd: 'build/releases/TorrenTV/linux32/TorrenTV',
				src: '**',
				dest: 'TorrenTV'
			},
			linux64: {
				options: {
					mode: 'tgz',
					archive: 'build/releases/TorrenTV/linux64/TorrenTV-' + currentVersion + '-Linux-64.tar.gz'
				},
				expand: true,
				cwd: 'build/releases/TorrenTV/linux64/TorrenTV',
				src: '**',
				dest: 'TorrenTV'
			},
			windows: {
				options: {
					mode: 'zip',
					archive: 'build/releases/TorrenTV/win/TorrenTV-' + currentVersion + '-Win.zip'
				},
				expand: true,
				cwd: 'dist/windows',
				src: 'TorrenTVSetup.exe',
				dest: ''
			}
		},

		clean: {
			releases: ['build/releases/TorrenTV/**']
		},

		watch: {
			options: {
				dateFormat: function(time) {
					grunt.log.writeln('Completed in ' + time + 'ms at ' + (new Date()).toLocaleTimeString());
					grunt.log.writeln('Waiting for more changes...');
				}
			},
			scripts: {
				files: ['./src/app/styl/*.styl','./src/app/styl/**/*.styl'],
				tasks: ['css']
			}
		}

	});

};
