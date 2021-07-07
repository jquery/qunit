import { window, document, setTimeout } from "./globals";

import equiv from "./equiv";
import dump from "./dump";
import module from "./module";
import Assert from "./assert";
import Logger from "./logger";
import Test, { test, pushFailure } from "./test";
import exportQUnit from "./export";
import reporters from "./reporters";

import config from "./core/config";
import { extend, objectType, is, now } from "./core/utilities";
import { registerLoggingCallbacks, runLoggingCallbacks } from "./core/logging";
import { sourceFromStacktrace } from "./core/stacktrace";
import ProcessingQueue from "./core/processing-queue";

import SuiteReport from "./reports/suite";

import { on, emit } from "./events";
import onWindowError from "./core/onerror";
import onUncaughtException from "./core/on-uncaught-exception";

const QUnit = {};
export const globalSuite = new SuiteReport();

// The initial "currentModule" represents the global (or top-level) module that
// is not explicitly defined by the user, therefore we add the "globalSuite" to
// it since each module has a suiteReport associated with it.
config.currentModule.suiteReport = globalSuite;

let globalStartCalled = false;
let runStarted = false;

// Figure out if we're running the tests from a server or not
QUnit.isLocal = ( window && window.location && window.location.protocol === "file:" );

// Expose the current QUnit version
QUnit.version = "@VERSION";

extend( QUnit, {
	config,

	dump,
	equiv,
	reporters,
	is,
	objectType,
	on,
	onError: onWindowError,
	onUncaughtException,
	pushFailure,

	assert: Assert.prototype,
	module,
	test,

	// alias other test flavors for easy access
	todo: test.todo,
	skip: test.skip,
	only: test.only,

	restart() {
		ProcessingQueue.finished = false;
		globalStartCalled = false;
		runStarted = false;

		config.queue.length = 0;
		config.modules.length = 0;
		config.autostart = false;

		[
			"stats", "started", "updateRate", "filter", "depth", "current",
			"pageLoaded", "timeoutHandler", "timeout", "pollution"
		].forEach( ( key ) => delete config[ key ] );

		const suiteReport = config.currentModule.suiteReport;

		suiteReport.childSuites.length = 0;
		delete suiteReport._startTime;
		delete suiteReport._endTime;

		config.modules.push( config.currentModule );
	},
	start: function( count ) {

		if ( config.current ) {
			throw new Error( "QUnit.start cannot be called inside a test context." );
		}

		const globalStartAlreadyCalled = globalStartCalled;
		globalStartCalled = true;

		if ( runStarted ) {
			throw new Error( "Called start() while test already started running" );
		}
		if ( globalStartAlreadyCalled || count > 1 ) {
			throw new Error( "Called start() outside of a test context too many times" );
		}
		if ( config.autostart ) {
			throw new Error( "Called start() outside of a test context when " +
				"QUnit.config.autostart was true" );
		}

		if ( !config.pageLoaded ) {

			// The page isn't completely loaded yet, so we set autostart and then
			// load if we're in Node or wait for the browser's load event.
			config.autostart = true;

			// Starts from Node even if .load was not previously called. We still return
			// early otherwise we'll wind up "beginning" twice.
			if ( !document ) {
				QUnit.load();
			}

			return;
		}

		scheduleBegin();

	},

	onUnhandledRejection: function( reason ) {
		Logger.warn( "QUnit.onUnhandledRejection is deprecated and will be removed in QUnit 3.0." +
			" Please use QUnit.onUncaughtException instead." );
		onUncaughtException( reason );
	},

	extend: function( ...args ) {
		Logger.warn( "QUnit.extend is deprecated and will be removed in QUnit 3.0." +
			" Please use Object.assign instead." );

		// delegate to utility implementation, which does not warn and can be used elsewhere internally
		return extend.apply( this, args );
	},

	load: function() {
		config.pageLoaded = true;

		// Initialize the configuration options
		extend( config, {
			stats: { all: 0, bad: 0, testCount: 0 },
			started: 0,
			updateRate: 1000,
			autostart: true,
			filter: ""
		}, true );

		if ( !runStarted ) {
			config.blocking = false;

			if ( config.autostart ) {
				scheduleBegin();
			}
		}
	},

	stack: function( offset ) {
		offset = ( offset || 0 ) + 2;
		return sourceFromStacktrace( offset );
	}
} );

registerLoggingCallbacks( QUnit );

function scheduleBegin() {

	runStarted = true;

	// Add a slight delay to allow definition of more modules and tests.
	if ( setTimeout ) {
		setTimeout( function() {
			begin();
		} );
	} else {
		begin();
	}
}

function unblockAndAdvanceQueue() {
	config.blocking = false;
	ProcessingQueue.advance();
}

export function begin() {

	if ( config.started ) {
		unblockAndAdvanceQueue();
		return;
	}

	// The test run hasn't officially begun yet
	// Record the time of the test run's beginning
	config.started = now();

	// Delete the loose unnamed module if unused.
	if ( config.modules[ 0 ].name === "" && config.modules[ 0 ].tests.length === 0 ) {
		config.modules.shift();
	}

	// Avoid unnecessary information by not logging modules' test environments
	const l = config.modules.length;
	const modulesLog = [];
	for ( let i = 0; i < l; i++ ) {
		modulesLog.push( {
			name: config.modules[ i ].name,
			tests: config.modules[ i ].tests
		} );
	}

	// The test run is officially beginning now
	emit( "runStart", globalSuite.start( true ) );
	runLoggingCallbacks( "begin", {
		totalTests: Test.count,
		modules: modulesLog
	} ).then( unblockAndAdvanceQueue );
}

exportQUnit( QUnit );

export default QUnit;
