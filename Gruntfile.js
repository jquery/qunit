/* eslint-env node */

const fs = require( "fs" );
const path = require( "path" );
const { preprocess } = require( "./build/dist-replace.js" );

var isCI = process.env.CI || process.env.JENKINS_HOME;

module.exports = function( grunt ) {
	var connectPort = Number( grunt.option( "connect-port" ) ) || 4000;

	grunt.loadNpmTasks( "grunt-contrib-connect" );
	grunt.loadNpmTasks( "grunt-contrib-copy" );
	grunt.loadNpmTasks( "grunt-contrib-qunit" );
	grunt.loadNpmTasks( "grunt-search" );

	grunt.initConfig( {
		connect: {
			base: {
				options: {

					// grunt-contrib-connect supports 'useAvailablePort' which
					// automatically finds a suitable port, but we can't use that here because
					// the grunt-contrib-qunit task needs to know the url ahead of time.
					port: connectPort,
					base: "."
				}
			}
		},
		copy: {
			options: { process: preprocess },

			"src-css": {
				src: "src/qunit.css",
				dest: "qunit/qunit.css"
			}
		},
		search: {
			options: {

				// Ensure that the only HTML entities used are those with a special status in XHTML
				// and that any common singleton/empty HTML elements end with the XHTML-compliant
				// "/>"rather than ">"
				searchString: /(&(?!gt|lt|amp|quot)[A-Za-z0-9]+;|<(?:hr|HR|br|BR|input|INPUT)(?![^>]*\/>)(?:\s+[^>]*)?>)/g,
				logFormat: "console",
				failOnMatch: true
			},
			xhtml: [
				"src/**/*.js"
			]
		},
		qunit: {
			all: {
				options: {
					timeout: 30000,
					puppeteer: {
						args: isCI ?

							// For CI
							[ "--no-sandbox" ] :

							// For local development
							// Allow Docker-based developer environmment to
							// inject --no-sandbox as-needed for Chrome.
							( process.env.CHROMIUM_FLAGS || "" ).split( " " )
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
						"test/events-filters.html",
						"test/events-in-test.html",
						"test/logs.html",
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
						"test/seed.html",
						"test/overload.html",
						"test/preconfigured.html",
						"test/regex-filter.html",
						"test/regex-exclude-filter.html",
						"test/string-filter.html",
						"test/module-skip.html",
						"test/module-todo.html",
						"test/only-each.html",

						// ensure this is last - it has the potential to drool
						// and omit subsequent tests during coverage runs
						"test/sandboxed-iframe.html"
					].map( file => `http://localhost:${connectPort}/${file}` )
				}
			}
		},

		// Sync with test/index.html and test/mozjs.js
		"test-on-node": {
			files: [
				"test/logs.js",
				"test/main/test.js",
				"test/main/each.js",
				"test/main/assert.js",
				"test/main/assert/step.js",
				"test/main/assert/timeout.js",
				"test/main/async.js",
				"test/main/promise.js",
				"test/main/dump.js",
				"test/main/modules.js",
				"test/main/deepEqual.js",
				"test/main/stack.js",
				"test/main/utilities.js",
				"test/events-in-test.js",
				"test/onerror/inside-test.js",
				"test/onerror/outside-test.js",
				"test/setTimeout.js",
				"test/node/storage-1.js",
				"test/node/storage-2.js",

				"test/cli/fixtures/only/test.js",
				"test/cli/fixtures/only/module.js",
				"test/cli/fixtures/only/module-flat.js",

				"test/es2018/async-functions.js",
				"test/es2018/rejects.js",
				"test/es2018/throws.js"

				// FIXME: These tests use an ugly hack that re-opens
				// an already finished test run. This only works reliably
				// via the HTML Reporter thanks to some delays in the bridge.
				// These tests are about reporting, not about functional
				// behaviour. They would be best run either as reflection on the
				// DOM in an HTML Reporter test, or from the CLI by asserting
				// TAP output. I suggest we do the latter, and then remove them
				// from here.
				//
				// Ref https://github.com/qunitjs/qunit/issues/1511
				//
				// "test/module-skip.js",
				// "test/module-todo.js",
			]
		}
	} );

	grunt.event.on( "qunit.coverage", function( file, coverage ) {
		var testName = file.split( "/test/" ).pop().replace( ".html", "" ).replace( /[/\\]/g, "--" );
		var reportPath = path.join( ".nyc_output", "browser--" + testName + ".json" );

		fs.mkdirSync( path.dirname( reportPath ), { recursive: true } );
		fs.writeFileSync( reportPath, JSON.stringify( coverage ) + "\n" );
	} );

	grunt.loadTasks( "build/tasks" );
	grunt.registerTask( "test", [ "search", "test-on-node", "connect:base", "qunit" ] );
};
