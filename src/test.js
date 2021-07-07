import globalThis from "../lib/global-this-polyfill";
import { begin } from "./core";
import { setTimeout, clearTimeout } from "./globals";
import { emit } from "./events";
import Assert from "./assert";
import Logger from "./logger";
import Promise from "./promise";

import config from "./core/config";
import {
	diff,
	extend,
	generateHash,
	hasOwn,
	inArray,
	now,
	objectType
} from "./core/utilities";
import { runLoggingCallbacks } from "./core/logging";
import { extractStacktrace, sourceFromStacktrace } from "./core/stacktrace";
import ProcessingQueue from "./core/processing-queue";

import TestReport from "./reports/test";

export default function Test( settings ) {
	this.expected = null;
	this.assertions = [];
	this.semaphore = 0;
	this.module = config.currentModule;
	this.steps = [];
	this.timeout = undefined;
	this.data = undefined;
	this.withData = false;
	extend( this, settings );

	// If a module is skipped, all its tests and the tests of the child suites
	// should be treated as skipped even if they are defined as `only` or `todo`.
	// As for `todo` module, all its tests will be treated as `todo` except for
	// tests defined as `skip` which will be left intact.
	//
	// So, if a test is defined as `todo` and is inside a skipped module, we should
	// then treat that test as if was defined as `skip`.
	if ( this.module.skip ) {
		this.skip = true;
		this.todo = false;

	// Skipped tests should be left intact
	} else if ( this.module.todo && !this.skip ) {
		this.todo = true;
	}

	// Queuing a late test after the run has ended is not allowed.
	// This was once supported for internal use by QUnit.onError().
	// Ref https://github.com/qunitjs/qunit/issues/1377
	if ( ProcessingQueue.finished ) {

		// Using this for anything other than onError(), such as testing in QUnit.done(),
		// is unstable and will likely result in the added tests being ignored by CI.
		// (Meaning the CI passes irregardless of the added tests).
		//
		// TODO: Make this an error in QUnit 3.0
		// throw new Error( "Unexpected new test after the run already ended" );
		Logger.warn( "Unexpected test after runEnd. This is unstable and will fail in QUnit 3.0." );
		return;
	}
	if ( !this.skip && typeof this.callback !== "function" ) {
		const method = this.todo ? "QUnit.todo" : "QUnit.test";
		throw new TypeError( `You must provide a callback to ${method}("${this.testName}")` );
	}

	// No validation after this. Beyond this point, failures must be recorded as
	// a completed test with errors, instead of early bail out.
	// Otherwise, internals may be left in an inconsistent state.
	// Ref https://github.com/qunitjs/qunit/issues/1514

	++Test.count;
	this.errorForStack = new Error();
	this.testReport = new TestReport( this.testName, this.module.suiteReport, {
		todo: this.todo,
		skip: this.skip,
		valid: this.valid()
	} );

	// Register unique strings
	for ( let i = 0, l = this.module.tests; i < l.length; i++ ) {
		if ( this.module.tests[ i ].name === this.testName ) {
			this.testName += " ";
		}
	}

	this.testId = generateHash( this.module.name, this.testName );

	this.module.tests.push( {
		name: this.testName,
		testId: this.testId,
		skip: !!this.skip
	} );

	if ( this.skip ) {

		// Skipped tests will fully ignore any sent callback
		this.callback = function() {};
		this.async = false;
		this.expected = 0;
	} else {
		this.assert = new Assert( this );
	}
}

Test.count = 0;

function getNotStartedModules( startModule ) {
	let module = startModule;
	const modules = [];

	while ( module && module.testsRun === 0 ) {
		modules.push( module );
		module = module.parentModule;
	}

	// The above push modules from the child to the parent
	// return a reversed order with the top being the top most parent module
	return modules.reverse();
}

Test.prototype = {

	// generating a stack trace can be expensive, so using a getter defers this until we need it
	get stack() {
		return extractStacktrace( this.errorForStack, 2 );
	},

	before: function() {
		const module = this.module;
		const notStartedModules = getNotStartedModules( module );

		// ensure the callbacks are executed serially for each module
		const callbackPromises = notStartedModules.reduce( ( promiseChain, startModule ) => {
			return promiseChain.then( () => {
				startModule.stats = { all: 0, bad: 0, started: now() };
				emit( "suiteStart", startModule.suiteReport.start( true ) );
				return runLoggingCallbacks( "moduleStart", {
					name: startModule.name,
					tests: startModule.tests
				} );
			} );
		}, Promise.resolve( [] ) );

		return callbackPromises.then( () => {
			config.current = this;

			this.testEnvironment = Object.create( module.testEnvironment || {} );

			this.started = now();
			emit( "testStart", this.testReport.start( true ) );
			return runLoggingCallbacks( "testStart", {
				name: this.testName,
				module: module.name,
				testId: this.testId,
				previousFailure: this.previousFailure
			} ).then( () => {
				if ( !config.pollution ) {
					saveGlobal();
				}
			} );
		} );
	},

	run: function() {

		config.current = this;

		this.callbackStarted = now();

		if ( config.notrycatch ) {
			runTest( this );
			return;
		}

		try {
			runTest( this );
		} catch ( e ) {
			this.pushFailure( "Died on test #" + ( this.assertions.length + 1 ) + " " +
				this.stack + ": " + ( e.message || e ), extractStacktrace( e, 0 ) );

			// Else next test will carry the responsibility
			saveGlobal();

			// Restart the tests if they're blocking
			if ( config.blocking ) {
				internalRecover( this );
			}
		}

		function runTest( test ) {
			let promise;
			if ( test.withData ) {
				promise = test.callback.call( test.testEnvironment, test.assert, test.data );
			} else {
				promise = test.callback.call( test.testEnvironment, test.assert );
			}
			test.resolvePromise( promise );

			// If the test has a "lock" on it, but the timeout is 0, then we push a
			// failure as the test should be synchronous.
			if ( test.timeout === 0 && test.semaphore !== 0 ) {
				pushFailure(
					"Test did not finish synchronously even though assert.timeout( 0 ) was used.",
					sourceFromStacktrace( 2 )
				);
			}
		}
	},

	after: function() {
		checkPollution();
	},

	queueHook( hook, hookName, hookOwner ) {
		const callHook = () => {
			let promise;
			if ( hookName === "before" || hookName === "after" ) {
				promise = hook.call( this.module.testEnvironment, this.assert );
			} else {
				promise = hook.call( this.testEnvironment, this.assert );
			}
			this.resolvePromise( promise, hookName );
		};

		const runHook = () => {
			if ( hookName === "before" && hookOwner.testsRun !== 0 ) {
				return;
			}

			// The 'after' hook should only execute when there are not tests left and
			// when the 'after' and 'finish' tasks are the only tasks left to process
			if ( hookName === "after" &&
				!lastTestWithinModuleExecuted( hookOwner ) &&
				( config.queue.length > 0 || ProcessingQueue.taskCount() > 2 ) ) {
				return;
			}

			config.current = this;
			if ( config.notrycatch ) {
				callHook();
				return;
			}
			try {
				callHook();
			} catch ( error ) {
				this.pushFailure( hookName + " failed on " + this.testName + ": " +
				( error.message || error ), extractStacktrace( error, 0 ) );
			}
		};

		return runHook;
	},

	// Currently only used for module level hooks, can be used to add global level ones
	hooks( handler ) {
		const hooks = [];

		function processHooks( test, module ) {
			if ( module.parentModule ) {
				processHooks( test, module.parentModule );
			}

			if ( module.hooks[ handler ].length ) {
				for ( let i = 0; i < module.hooks[ handler ].length; i++ ) {
					hooks.push( test.queueHook( module.hooks[ handler ][ i ], handler, module ) );
				}
			}
		}

		// Hooks are ignored on skipped tests
		if ( !this.skip ) {
			processHooks( this, this.module );
		}

		return hooks;
	},

	finish: function() {
		config.current = this;

		// Release the test callback to ensure that anything referenced has been
		// released to be garbage collected.
		this.callback = undefined;

		if ( this.steps.length ) {
			const stepsList = this.steps.join( ", " );
			this.pushFailure( "Expected assert.verifySteps() to be called before end of test " +
				`after using assert.step(). Unverified steps: ${stepsList}`, this.stack );
		}

		if ( config.requireExpects && this.expected === null ) {
			this.pushFailure( "Expected number of assertions to be defined, but expect() was " +
				"not called.", this.stack );
		} else if ( this.expected !== null && this.expected !== this.assertions.length ) {
			this.pushFailure( "Expected " + this.expected + " assertions, but " +
				this.assertions.length + " were run", this.stack );
		} else if ( this.expected === null && !this.assertions.length ) {
			this.pushFailure( "Expected at least one assertion, but none were run - call " +
				"expect(0) to accept zero assertions.", this.stack );
		}

		const module = this.module;
		const moduleName = module.name;
		const testName = this.testName;
		const skipped = !!this.skip;
		const todo = !!this.todo;
		let bad = 0;
		const storage = config.storage;

		this.runtime = now() - this.started;

		config.stats.all += this.assertions.length;
		config.stats.testCount += 1;
		module.stats.all += this.assertions.length;

		for ( let i = 0; i < this.assertions.length; i++ ) {

			// A failing assertion will counts toward the HTML Reporter's
			// "X assertions, Y failed" line even if it was inside a todo.
			// Inverting this would be similarly confusing since all but the last
			// passing assertion inside a todo test should be considered as good.
			// These stats don't decide the outcome of anything, so counting them
			// as failing seems the most intuitive.
			if ( !this.assertions[ i ].result ) {
				bad++;
				config.stats.bad++;
				module.stats.bad++;
			}
		}

		if ( skipped ) {
			incrementTestsIgnored( module );
		} else {
			incrementTestsRun( module );
		}

		// Store result when possible.
		// Note that this also marks todo tests as bad, thus they get hoisted,
		// and always run first on refresh.
		if ( storage ) {
			if ( bad ) {
				storage.setItem( "qunit-test-" + moduleName + "-" + testName, bad );
			} else {
				storage.removeItem( "qunit-test-" + moduleName + "-" + testName );
			}
		}

		// After emitting the js-reporters event we cleanup the assertion data to
		// avoid leaking it. It is not used by the legacy testDone callbacks.
		emit( "testEnd", this.testReport.end( true ) );
		this.testReport.slimAssertions();
		const test = this;

		return runLoggingCallbacks( "testDone", {
			name: testName,
			module: moduleName,
			skipped: skipped,
			todo: todo,
			failed: bad,
			passed: this.assertions.length - bad,
			total: this.assertions.length,
			runtime: skipped ? 0 : this.runtime,

			// HTML Reporter use
			assertions: this.assertions,
			testId: this.testId,

			// Source of Test
			// generating stack trace is expensive, so using a getter will help defer this until we need it
			get source() { return test.stack; }
		} ).then( function() {
			if ( allTestsExecuted( module ) ) {
				const completedModules = [ module ];

				// Check if the parent modules, iteratively, are done. If that the case,
				// we emit the `suiteEnd` event and trigger `moduleDone` callback.
				let parent = module.parentModule;
				while ( parent && allTestsExecuted( parent ) ) {
					completedModules.push( parent );
					parent = parent.parentModule;
				}

				return completedModules.reduce( ( promiseChain, completedModule ) => {
					return promiseChain.then( () => {
						return logSuiteEnd( completedModule );
					} );
				}, Promise.resolve( [] ) );
			}
		} ).then( function() {
			config.current = undefined;
		} );

		function logSuiteEnd( module ) {

			// Reset `module.hooks` to ensure that anything referenced in these hooks
			// has been released to be garbage collected.
			module.hooks = {};

			emit( "suiteEnd", module.suiteReport.end( true ) );
			return runLoggingCallbacks( "moduleDone", {
				name: module.name,
				tests: module.tests,
				failed: module.stats.bad,
				passed: module.stats.all - module.stats.bad,
				total: module.stats.all,
				runtime: now() - module.stats.started
			} );
		}
	},

	queue() {
		const test = this;

		if ( !this.valid() ) {
			incrementTestsIgnored( this.module );
			return;
		}

		function runTest() {
			return [
				function() {
					return test.before();
				},

				...test.hooks( "before" ),
				...test.hooks( "beforeEach" ),

				function() {
					test.run();
				},

				...test.hooks( "afterEach" ).reverse(),
				...test.hooks( "after" ).reverse(),

				function() {
					test.after();
				},

				function() {
					return test.finish();
				}
			];
		}

		const previousFailCount = config.storage &&
				+config.storage.getItem( "qunit-test-" + this.module.name + "-" + this.testName );

		// Prioritize previously failed tests, detected from storage
		const prioritize = config.reorder && !!previousFailCount;

		this.previousFailure = !!previousFailCount;

		ProcessingQueue.add( runTest, prioritize, config.seed );
	},

	pushResult: function( resultInfo ) {
		if ( this !== config.current ) {
			const message = resultInfo && resultInfo.message || "";
			const testName = this && this.testName || "";
			const error = "Assertion occurred after test finished.\n" +
				"> Test: " + testName + "\n" +
				"> Message: " + message + "\n";

			throw new Error( error );
		}

		// Destructure of resultInfo = { result, actual, expected, message, negative }
		const details = {
			module: this.module.name,
			name: this.testName,
			result: resultInfo.result,
			message: resultInfo.message,
			actual: resultInfo.actual,
			testId: this.testId,
			negative: resultInfo.negative || false,
			runtime: now() - this.started,
			todo: !!this.todo
		};

		if ( hasOwn.call( resultInfo, "expected" ) ) {
			details.expected = resultInfo.expected;
		}

		if ( !resultInfo.result ) {
			const source = resultInfo.source || sourceFromStacktrace();

			if ( source ) {
				details.source = source;
			}
		}

		this.logAssertion( details );

		this.assertions.push( {
			result: !!resultInfo.result,
			message: resultInfo.message
		} );
	},

	pushFailure: function( message, source, actual ) {
		if ( !( this instanceof Test ) ) {
			throw new Error( "pushFailure() assertion outside test context, was " +
				sourceFromStacktrace( 2 ) );
		}

		this.pushResult( {
			result: false,
			message: message || "error",
			actual: actual || null,
			source
		} );
	},

	/**
	 * Log assertion details using both the old QUnit.log interface and
	 * QUnit.on( "assertion" ) interface.
	 *
	 * @private
	 */
	logAssertion( details ) {
		runLoggingCallbacks( "log", details );

		const assertion = {
			passed: details.result,
			actual: details.actual,
			expected: details.expected,
			message: details.message,
			stack: details.source,
			todo: details.todo
		};
		this.testReport.pushAssertion( assertion );
		emit( "assertion", assertion );
	},

	resolvePromise: function( promise, phase ) {
		if ( promise != null ) {
			const test = this;
			const then = promise.then;
			if ( objectType( then ) === "function" ) {
				const resume = internalStop( test );
				const resolve = function() { resume(); };
				if ( config.notrycatch ) {
					then.call( promise, resolve );
				} else {
					const reject = function( error ) {
						const message = "Promise rejected " +
							( !phase ? "during" : phase.replace( /Each$/, "" ) ) +
							" \"" + test.testName + "\": " +
							( ( error && error.message ) || error );
						test.pushFailure( message, extractStacktrace( error, 0 ) );

						// Else next test will carry the responsibility
						saveGlobal();

						// Unblock
						internalRecover( test );
					};
					then.call( promise, resolve, reject );
				}
			}
		}
	},

	valid: function() {
		const filter = config.filter;
		const regexFilter = /^(!?)\/([\w\W]*)\/(i?$)/.exec( filter );
		const module = config.module && config.module.toLowerCase();
		const fullName = ( this.module.name + ": " + this.testName );

		function moduleChainNameMatch( testModule ) {
			const testModuleName = testModule.name ? testModule.name.toLowerCase() : null;
			if ( testModuleName === module ) {
				return true;
			} else if ( testModule.parentModule ) {
				return moduleChainNameMatch( testModule.parentModule );
			} else {
				return false;
			}
		}

		function moduleChainIdMatch( testModule ) {
			return inArray( testModule.moduleId, config.moduleId ) ||
				testModule.parentModule && moduleChainIdMatch( testModule.parentModule );
		}

		// Internally-generated tests are always valid
		if ( this.callback && this.callback.validTest ) {
			return true;
		}

		if ( config.moduleId && config.moduleId.length > 0 &&
			!moduleChainIdMatch( this.module ) ) {

			return false;
		}

		if ( config.testId && config.testId.length > 0 &&
			!inArray( this.testId, config.testId ) ) {

			return false;
		}

		if ( module && !moduleChainNameMatch( this.module ) ) {
			return false;
		}

		if ( !filter ) {
			return true;
		}

		return regexFilter ?
			this.regexFilter( !!regexFilter[ 1 ], regexFilter[ 2 ], regexFilter[ 3 ], fullName ) :
			this.stringFilter( filter, fullName );
	},

	regexFilter: function( exclude, pattern, flags, fullName ) {
		const regex = new RegExp( pattern, flags );
		const match = regex.test( fullName );

		return match !== exclude;
	},

	stringFilter: function( filter, fullName ) {
		filter = filter.toLowerCase();
		fullName = fullName.toLowerCase();

		const include = filter.charAt( 0 ) !== "!";
		if ( !include ) {
			filter = filter.slice( 1 );
		}

		// If the filter matches, we need to honour include
		if ( fullName.indexOf( filter ) !== -1 ) {
			return include;
		}

		// Otherwise, do the opposite
		return !include;
	}
};

export function pushFailure() {
	if ( !config.current ) {
		throw new Error( "pushFailure() assertion outside test context, in " +
			sourceFromStacktrace( 2 ) );
	}

	// Gets current test obj
	const currentTest = config.current;

	return currentTest.pushFailure.apply( currentTest, arguments );
}

function saveGlobal() {
	config.pollution = [];

	if ( config.noglobals ) {
		for ( const key in globalThis ) {
			if ( hasOwn.call( globalThis, key ) ) {

				// In Opera sometimes DOM element ids show up here, ignore them
				if ( /^qunit-test-output/.test( key ) ) {
					continue;
				}
				config.pollution.push( key );
			}
		}
	}
}

function checkPollution() {
	const old = config.pollution;

	saveGlobal();

	const newGlobals = diff( config.pollution, old );
	if ( newGlobals.length > 0 ) {
		pushFailure( "Introduced global variable(s): " + newGlobals.join( ", " ) );
	}

	const deletedGlobals = diff( old, config.pollution );
	if ( deletedGlobals.length > 0 ) {
		pushFailure( "Deleted global variable(s): " + deletedGlobals.join( ", " ) );
	}
}

let focused = false; // indicates that the "only" filter was used

function addTest( settings ) {
	if ( focused || config.currentModule.ignored ) {
		return;
	}

	const newTest = new Test( settings );

	newTest.queue();
}

function addOnlyTest( settings ) {
	if ( config.currentModule.ignored ) {
		return;
	}
	if ( !focused ) {
		config.queue.length = 0;
		focused = true;
	}

	const newTest = new Test( settings );

	newTest.queue();
}

// Will be exposed as QUnit.test
export function test( testName, callback ) {
	addTest( { testName, callback } );
}

function makeEachTestName( testName, argument ) {
	return `${testName} [${argument}]`;
}

function runEach( data, eachFn ) {
	if ( Array.isArray( data ) ) {
		data.forEach( eachFn );
	} else if ( typeof data === "object" && data !== null ) {
		const keys = Object.keys( data );
		keys.forEach( ( key ) => {
			eachFn( data[ key ], key );
		} );
	} else {
		throw new Error(
			`test.each() expects an array or object as input, but
found ${typeof data} instead.`
		);
	}
}

extend( test, {
	todo: function( testName, callback ) {
		addTest( { testName, callback, todo: true } );
	},
	skip: function( testName ) {
		addTest( { testName, skip: true } );
	},
	only: function( testName, callback ) {
		addOnlyTest( { testName, callback } );
	},
	each: function( testName, dataset, callback ) {
		runEach( dataset, ( data, testKey ) => {
			addTest( {
				testName: makeEachTestName( testName, testKey ),
				callback,
				withData: true,
				data
			} );
		} );
	}
} );

test.todo.each = function( testName, dataset, callback ) {
	runEach( dataset, ( data, testKey ) => {
		addTest( {
			testName: makeEachTestName( testName, testKey ),
			callback,
			todo: true,
			withData: true,
			data
		} );
	} );
};
test.skip.each = function( testName, dataset ) {
	runEach( dataset, ( _, testKey ) => {
		addTest( {
			testName: makeEachTestName( testName, testKey ),
			skip: true
		} );
	} );
};

test.only.each = function( testName, dataset, callback ) {
	runEach( dataset, ( data, testKey ) => {
		addOnlyTest( {
			testName: makeEachTestName( testName, testKey ),
			callback,
			withData: true,
			data
		} );
	} );
};

// Resets config.timeout with a new timeout duration.
export function resetTestTimeout( timeoutDuration ) {
	clearTimeout( config.timeout );
	config.timeout = setTimeout( config.timeoutHandler( timeoutDuration ), timeoutDuration );
}

// Put a hold on processing and return a function that will release it.
export function internalStop( test ) {
	let released = false;
	test.semaphore += 1;
	config.blocking = true;

	// Set a recovery timeout, if so configured.
	if ( setTimeout ) {
		let timeoutDuration;

		if ( typeof test.timeout === "number" ) {
			timeoutDuration = test.timeout;
		} else if ( typeof config.testTimeout === "number" ) {
			timeoutDuration = config.testTimeout;
		}

		if ( typeof timeoutDuration === "number" && timeoutDuration > 0 ) {
			config.timeoutHandler = function( timeout ) {
				return function() {
					config.timeout = null;
					pushFailure(
						`Test took longer than ${timeout}ms; test timed out.`,
						sourceFromStacktrace( 2 )
					);
					released = true;
					internalRecover( test );
				};
			};
			clearTimeout( config.timeout );
			config.timeout = setTimeout(
				config.timeoutHandler( timeoutDuration ),
				timeoutDuration
			);
		}
	}

	return function resume() {
		if ( released ) {
			return;
		}

		released = true;
		test.semaphore -= 1;
		internalStart( test );
	};
}

// Forcefully release all processing holds.
function internalRecover( test ) {
	test.semaphore = 0;
	internalStart( test );
}

// Release a processing hold, scheduling a resumption attempt if no holds remain.
function internalStart( test ) {

	// If semaphore is non-numeric, throw error
	if ( isNaN( test.semaphore ) ) {
		test.semaphore = 0;

		pushFailure(
			"Invalid value on test.semaphore",
			sourceFromStacktrace( 2 )
		);
	}

	// Don't start until equal number of stop-calls
	if ( test.semaphore > 0 ) {
		return;
	}

	// Throw an Error if start is called more often than stop
	if ( test.semaphore < 0 ) {
		test.semaphore = 0;

		pushFailure(
			"Tried to restart test while already started (test's semaphore was 0 already)",
			sourceFromStacktrace( 2 )
		);
	}

	// Add a slight delay to allow more assertions etc.
	if ( setTimeout ) {
		clearTimeout( config.timeout );
		config.timeout = setTimeout( function() {
			if ( test.semaphore > 0 ) {
				return;
			}

			clearTimeout( config.timeout );
			config.timeout = null;

			begin();
		} );
	} else {
		begin();
	}
}

function collectTests( module ) {
	const tests = [].concat( module.tests );
	const modules = [ ...module.childModules ];

	// Do a breadth-first traversal of the child modules
	while ( modules.length ) {
		const nextModule = modules.shift();
		tests.push.apply( tests, nextModule.tests );
		modules.push( ...nextModule.childModules );
	}

	return tests;
}

// This returns true after all executable and skippable tests
// in a module have been proccessed, and informs 'suiteEnd'
// and moduleDone().
function allTestsExecuted( module ) {
	return module.testsRun + module.testsIgnored === collectTests( module ).length;
}

// This returns true during the last executable non-skipped test
// within a module, and informs the running of the 'after' hook
// for a given module. This runs only once for a given module,
// but must run during the last non-skipped test. When it runs,
// there may be non-zero skipped tests left.
function lastTestWithinModuleExecuted( module ) {
	return module.testsRun === collectTests( module ).filter( test => !test.skip ).length - 1;
}

function incrementTestsRun( module ) {
	module.testsRun++;
	while ( ( module = module.parentModule ) ) {
		module.testsRun++;
	}
}

function incrementTestsIgnored( module ) {
	module.testsIgnored++;
	while ( ( module = module.parentModule ) ) {
		module.testsIgnored++;
	}
}
