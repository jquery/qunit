/* eslint-env node */

const fs = require( "fs" );
const path = require( "path" );
const { preprocess } = require( "./build/dist-replace.js" );

// Detect Travis CI or Jenkins.
var isCI = process.env.CI || process.env.JENKINS_HOME;

module.exports = function( grunt ) {
	var livereloadPort = grunt.option( "livereload-port" ) || 35729;
	var connectPort = Number( grunt.option( "connect-port" ) ) || 4000;

	// Load grunt tasks from NPM packages
	grunt.loadNpmTasks( "grunt-contrib-connect" );
	grunt.loadNpmTasks( "grunt-contrib-copy" );
	grunt.loadNpmTasks( "grunt-contrib-qunit" );
	grunt.loadNpmTasks( "grunt-contrib-watch" );
	grunt.loadNpmTasks( "grunt-eslint" );
	grunt.loadNpmTasks( "grunt-search" );

	grunt.initConfig( {
		connect: {
			nolivereload: {
				options: {

					// grunt-contrib-connect supports 'useAvailablePort' which
					// automatically finds a suitable port, but we can't use that here because
					// the grunt-contrib-qunit task needs to know the url ahead of time.
					port: connectPort,
					base: "."
				}
			},

			// For manual testing.
			any: {
				options: {
					port: connectPort,
					useAvailablePort: true,
					keepalive: true,
					base: "."
				}
			},

			// For use by the "watch" task.
			livereload: {
				options: {
					port: connectPort,
					base: ".",
					livereload: livereloadPort
				}
			}
		},
		copy: {
			options: { process: preprocess },

			"src-css": {
				src: "src/qunit.css",
				dest: "dist/qunit.css"
			}
		},
		eslint: {
			js: ".",
			html: {
				options: {
					rules: {
						indent: "off"
					}
				},
				src: [

					// Linting HTML files via eslint-plugin-html
					"test/**/*.html"
				]
			}
		},
		search: {
			options: {

				// Ensure that the only HTML entities used are those with a special status in XHTML
				// and that any common singleton/empty HTML elements end with the XHTML-compliant
				// "/>"rather than ">"
				searchString: /(&(?!gt|lt|amp|quot)[A-Za-z0-9]+;|<(?:hr|HR|br|BR|input|INPUT)(?![^>]*\/>)(?:\s+[^>]*)?>)/g, // eslint-disable-line max-len
				logFormat: "console",
				failOnMatch: true
			},
			xhtml: [
				"src/**/*.js",
				"reporter/**/*.js"
			]
		},
		qunit: {
			all: {
				options: {
					timeout: 30000,
					puppeteer: !isCI ? {

						// Allow Docker-based developer environmment to
						// inject --no-sandbox as-needed for Chrome.
						args: ( process.env.CHROMIUM_FLAGS || "" ).split( " " )
					} : {
						args: [

							// https://docs.travis-ci.com/user/chrome#sandboxing
							"--no-sandbox"
						]
					},
					inject: [
						path.resolve( "./build/coverage-bridge.js" ),
						require.resolve( "grunt-contrib-qunit/chrome/bridge" )
					],
					urls: [
						"test/index.html",
						"test/autostart.html",
						"test/startError.html",
						"test/reorder.html",
						"test/reorderError1.html",
						"test/reorderError2.html",
						"test/callbacks.html",
						"test/callbacks-promises.html",
						"test/events.html",
						"test/events-in-test.html",
						"test/logs.html",
						"test/setTimeout.html",
						"test/amd.html",
						"test/reporter-html/legacy-markup.html",
						"test/reporter-html/no-qunit-element.html",
						"test/reporter-html/single-testid.html",
						"test/reporter-html/window-onerror.html",
						"test/reporter-html/window-onerror-preexisting-handler.html",
						"test/reporter-html/xhtml-escape-details-source.xhtml",
						"test/reporter-html/xhtml-single-testid.xhtml",
						"test/reporter-urlparams.html",
						"test/reporter-urlparams-hidepassed.html",
						"test/moduleId.html",
						"test/onerror/inside-test.html",
						"test/onerror/outside-test.html",
						"test/only.html",
						"test/seed.html",
						"test/overload.html",
						"test/preconfigured.html",
						"test/regex-filter.html",
						"test/regex-exclude-filter.html",
						"test/string-filter.html",
						"test/module-only.html",
						"test/module-skip.html",
						"test/module-todo.html",

						// ensure this is last - it has the potential to drool
						// and omit subsequent tests during coverage runs
						"test/sandboxed-iframe.html"
					].map( file => `http://localhost:${connectPort}/${file}` )
				}
			}
		},
		"test-on-node": {
			files: [
				"test/logs",
				"test/main/test",
				"test/main/assert",
				"test/main/assert/step",
				"test/main/assert/timeout",
				"test/main/async",
				"test/main/promise",
				"test/main/modules",
				"test/main/deepEqual",
				"test/main/stack",
				"test/main/utilities",
				"test/events",
				"test/events-in-test",
				"test/onerror/inside-test",
				"test/onerror/outside-test",
				"test/only",
				"test/setTimeout",
				"test/main/dump",
				"test/node/storage-1",
				"test/node/storage-2",
				"test/module-only",
				"test/module-skip",
				"test/module-todo",
				"test/es2017/async-functions",
				"test/es2017/throws"
			]
		},
		"watch-repeatable": {
			options: {
				atBegin: true,
				spawn: false,
				interrupt: true
			},
			files: [
				".eslintrc.json",
				"*.js",
				"build/*.js",
				"{src,test,reporter}/**/*.js",
				"src/qunit.css",
				"test/*.{html,js}",
				"test/**/*.html"
			],
			tasks: [ "build", "livereload", "test-in-watch" ]
		},

		livereload: {
			options: {
				port: livereloadPort
			}
		}
	} );

	grunt.event.on( "qunit.coverage", function( file, coverage ) {
		var testName = file.split( "/test/" ).pop().replace( ".html", "" ).replace( /[/\\]/g, "--" );
		var reportPath = path.join( ".nyc_output", "browser--" + testName + ".json" );

		fs.mkdirSync( path.dirname( reportPath ), { recursive: true } );
		fs.writeFileSync( reportPath, JSON.stringify( coverage ) + "\n" );
	} );

	grunt.loadTasks( "build/tasks" );
	grunt.registerTask( "test-base", [ "eslint", "search", "test-on-node" ] );
	grunt.registerTask( "test", [ "test-base", "connect:nolivereload", "qunit" ] );
	grunt.registerTask( "test-in-watch", [ "test-base", "qunit" ] );

	// Start the web server in a watch pre-task
	// https://github.com/gruntjs/grunt-contrib-watch/issues/50
	grunt.renameTask( "watch", "watch-repeatable" );
	grunt.registerTask( "watch", [ "connect:livereload", "watch-repeatable" ] );
};
