/*jshint node:true */
module.exports = function( grunt ) {

require( "load-grunt-tasks" )( grunt );

function process( code, filepath ) {

	// Make coverage ignore external files
	if ( filepath.match( /^external\// ) ) {
		code = "/*istanbul ignore next */\n" + code;
	}

	return code

		// Embed version
		.replace( /@VERSION/g, grunt.config( "pkg" ).version )

		// Embed date (yyyy-mm-ddThh:mmZ)
		.replace( /@DATE/g, ( new Date() ).toISOString().replace( /:\d+\.\d+Z$/, "Z" ) );
}

grunt.initConfig({
	pkg: grunt.file.readJSON( "package.json" ),
	concat: {
		"src-js": {
			options: { process: process },
			src: [
				"src/intro.js",
				"src/core.js",
				"src/test.js",
				"src/assert.js",
				"src/equiv.js",
				"src/dump.js",
				"src/export.js",
				"src/outro.js",
				"external/jsdiff/jsdiff.js",
				"reporter/html.js"
			],
			dest: "dist/qunit.js"
		},
		"src-css": {
			options: { process: process },
			src: "src/qunit.css",
			dest: "dist/qunit.css"
		}
	},
	jshint: {
		options: {
			jshintrc: true
		},
		all: [
			"*.js",
			"{test,dist}/**/*.js",
			"build/*.js"
		]
	},
	jscs: {
		options: {
			config: ".jscsrc"
		},
		all: [
			"<%= jshint.all %>",
			"!test/deepEqual.js"
		]
	},
	qunit: {
		options: {
			timeout: 30000,
			"--web-security": "no",
			coverage: {
				src: "dist/qunit.js",
				instrumentedFiles: "temp/",
				htmlReport: "build/report/coverage",
				lcovReport: "build/report/lcov",
				linesThresholdPct: 70
			}
		},
		qunit: [
			"test/index.html",
			"test/async.html",
			"test/logs.html",
			"test/setTimeout.html"
		]
	},
	coveralls: {
		options: {
			force: true
		},
		all: {

			// LCOV coverage file relevant to every target
			src: "build/report/lcov/lcov.info"
		}
	},
	watch: {
		options: {
			atBegin: true
		},
		files: [
			".jshintrc",
			"*.js",
			"build/*.js",
			"{src,test}/**/*.js"
		],
		tasks: "default"
	}
});

grunt.registerTask( "testswarm", function( commit, configFile, projectName, browserSets, timeout ) {
	var config,
		testswarm = require( "testswarm" ),
		runs = {},
		done = this.async();

	projectName = projectName || "qunit";
	config = grunt.file.readJSON( configFile )[ projectName ];
	browserSets = browserSets || config.browserSets;
	if ( browserSets[ 0 ] === "[" ) {
		// We got an array, parse it
		browserSets = JSON.parse( browserSets );
	}
	timeout = timeout || 1000 * 60 * 15;

	[ "index", "async", "setTimeout" ].forEach(function( suite ) {
		runs[ suite ] = config.testUrl + commit + "/test/" + suite + ".html";
	});

	testswarm
		.createClient({
			url: config.swarmUrl
		})
		.addReporter( testswarm.reporters.cli )
		.auth({
			id: config.authUsername,
			token: config.authToken
		})
		.addjob({
			name: "Commit <a href='https://github.com/jquery/qunit/commit/" + commit + "'>" +
				commit.substr( 0, 10 ) + "</a>",
			runs: runs,
			browserSets: browserSets,
			timeout: timeout
		}, function( err, passed ) {
			if ( err ) {
				grunt.log.error( err );
			}
			done( passed );
		});
});

// TODO: Extract this task later, if feasible
// Also spawn a separate process to keep tests atomic
grunt.registerTask( "test-on-node", function() {
	var testActive = false,
		runDone = false,
		done = this.async(),
		QUnit = require( "./dist/qunit" );

	QUnit.testStart(function() {
		testActive = true;
	});
	QUnit.log(function( details ) {
		if ( !testActive || details.result ) {
			return;
		}
		var message = "name: " + details.name + " module: " + details.module +
			" message: " + details.message;
		grunt.log.error( message );
	});
	QUnit.testDone(function() {
		testActive = false;
	});
	QUnit.done(function( details ) {
		if ( runDone ) {
			return;
		}
		var succeeded = ( details.failed === 0 ),
			message = details.total + " assertions in (" + details.runtime + "ms), passed: " +
				details.passed + ", failed: " + details.failed;
		if ( succeeded ) {
			grunt.log.ok( message );
		} else {
			grunt.log.error( message );
		}
		done( succeeded );
		runDone = true;
	});
	QUnit.config.autorun = false;

	require( "./test/logs" );
	require( "./test/test" );
	require( "./test/deepEqual" );
	require( "./test/globals" );

	QUnit.load();
});

grunt.registerTask( "build", [ "concat" ] );
grunt.registerTask( "default", [ "build", "jshint", "jscs", "qunit", "test-on-node" ] );

};
