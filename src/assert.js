import dump from "./dump";
import equiv from "./equiv";
import { internalStop, resetTestTimeout } from "./test";
import Logger from "./logger";

import config from "./core/config";
import { objectType, objectValues, errorString } from "./core/utilities";
import { sourceFromStacktrace } from "./core/stacktrace";
import { clearTimeout } from "./globals";

class Assert {
	constructor( testContext ) {
		this.test = testContext;
	}

	// Assert helpers

	timeout( duration ) {
		if ( typeof duration !== "number" ) {
			throw new Error( "You must pass a number as the duration to assert.timeout" );
		}

		this.test.timeout = duration;

		// If a timeout has been set, clear it and reset with the new duration
		if ( config.timeout ) {
			clearTimeout( config.timeout );
			config.timeout = null;

			if ( config.timeoutHandler && this.test.timeout > 0 ) {
				resetTestTimeout( this.test.timeout );
			}
		}
	}

	// Documents a "step", which is a string value, in a test as a passing assertion
	step( message ) {
		let assertionMessage = message;
		let result = !!message;

		this.test.steps.push( message );

		if ( objectType( message ) === "undefined" || message === "" ) {
			assertionMessage = "You must provide a message to assert.step";
		} else if ( objectType( message ) !== "string" ) {
			assertionMessage = "You must provide a string value to assert.step";
			result = false;
		}

		this.pushResult( {
			result,
			message: assertionMessage
		} );
	}

	// Verifies the steps in a test match a given array of string values
	verifySteps( steps, message ) {

		// Since the steps array is just string values, we can clone with slice
		const actualStepsClone = this.test.steps.slice();
		this.deepEqual( actualStepsClone, steps, message );
		this.test.steps.length = 0;
	}

	// Specify the number of expected assertions to guarantee that failed test
	// (no assertions are run at all) don't slip through.
	expect( asserts ) {
		if ( arguments.length === 1 ) {
			this.test.expected = asserts;
		} else {
			return this.test.expected;
		}
	}

	// Put a hold on processing and return a function that will release it a maximum of once.
	async( count ) {
		const test = this.test;

		let popped = false,
			acceptCallCount = count;

		if ( typeof acceptCallCount === "undefined" ) {
			acceptCallCount = 1;
		}

		const resume = internalStop( test );

		return function done() {

			if ( config.current === undefined ) {
				throw new Error( "`assert.async` callback from test \"" +
					test.testName + "\" called after tests finished." );
			}

			if ( config.current !== test ) {
				config.current.pushFailure(
					"`assert.async` callback from test \"" +
					test.testName + "\" was called during this test." );
				return;
			}

			if ( popped ) {
				test.pushFailure( "Too many calls to the `assert.async` callback",
					sourceFromStacktrace( 2 ) );
				return;
			}

			acceptCallCount -= 1;
			if ( acceptCallCount > 0 ) {
				return;
			}

			popped = true;
			resume();
		};
	}

	// Exports test.push() to the user API
	// Alias of pushResult.
	push( result, actual, expected, message, negative ) {
		Logger.warn( "assert.push is deprecated and will be removed in QUnit 3.0." +
			" Please use assert.pushResult instead (https://api.qunitjs.com/assert/pushResult)." );

		const currentAssert = this instanceof Assert ? this : config.current.assert;
		return currentAssert.pushResult( {
			result,
			actual,
			expected,
			message,
			negative
		} );
	}

	pushResult( resultInfo ) {

		// Destructure of resultInfo = { result, actual, expected, message, negative }
		let assert = this;
		const currentTest = ( assert instanceof Assert && assert.test ) || config.current;

		// Backwards compatibility fix.
		// Allows the direct use of global exported assertions and QUnit.assert.*
		// Although, it's use is not recommended as it can leak assertions
		// to other tests from async tests, because we only get a reference to the current test,
		// not exactly the test where assertion were intended to be called.
		if ( !currentTest ) {
			throw new Error( "assertion outside test context, in " + sourceFromStacktrace( 2 ) );
		}

		if ( !( assert instanceof Assert ) ) {
			assert = currentTest.assert;
		}

		return assert.test.pushResult( resultInfo );
	}

	ok( result, message ) {
		if ( !message ) {
			message = result ?
				"okay" :
				`failed, expected argument to be truthy, was: ${dump.parse( result )}`;
		}

		this.pushResult( {
			result: !!result,
			actual: result,
			expected: true,
			message
		} );
	}

	notOk( result, message ) {
		if ( !message ) {
			message = !result ?
				"okay" :
				`failed, expected argument to be falsy, was: ${dump.parse( result )}`;
		}

		this.pushResult( {
			result: !result,
			actual: result,
			expected: false,
			message
		} );
	}

	true( result, message ) {
		this.pushResult( {
			result: result === true,
			actual: result,
			expected: true,
			message
		} );
	}

	false( result, message ) {
		this.pushResult( {
			result: result === false,
			actual: result,
			expected: false,
			message
		} );
	}

	equal( actual, expected, message ) {

		// eslint-disable-next-line eqeqeq
		const result = expected == actual;

		this.pushResult( {
			result,
			actual,
			expected,
			message
		} );
	}

	notEqual( actual, expected, message ) {

		// eslint-disable-next-line eqeqeq
		const result = expected != actual;

		this.pushResult( {
			result,
			actual,
			expected,
			message,
			negative: true
		} );
	}

	propEqual( actual, expected, message ) {
		actual = objectValues( actual );
		expected = objectValues( expected );

		this.pushResult( {
			result: equiv( actual, expected ),
			actual,
			expected,
			message
		} );
	}

	notPropEqual( actual, expected, message ) {
		actual = objectValues( actual );
		expected = objectValues( expected );

		this.pushResult( {
			result: !equiv( actual, expected ),
			actual,
			expected,
			message,
			negative: true
		} );
	}

	deepEqual( actual, expected, message ) {
		this.pushResult( {
			result: equiv( actual, expected ),
			actual,
			expected,
			message
		} );
	}

	notDeepEqual( actual, expected, message ) {
		this.pushResult( {
			result: !equiv( actual, expected ),
			actual,
			expected,
			message,
			negative: true
		} );
	}

	strictEqual( actual, expected, message ) {
		this.pushResult( {
			result: expected === actual,
			actual,
			expected,
			message
		} );
	}

	notStrictEqual( actual, expected, message ) {
		this.pushResult( {
			result: expected !== actual,
			actual,
			expected,
			message,
			negative: true
		} );
	}

	[ "throws" ]( block, expected, message ) {
		let actual,
			result = false;

		const currentTest = ( this instanceof Assert && this.test ) || config.current;

		// 'expected' is optional unless doing string comparison
		if ( objectType( expected ) === "string" ) {
			if ( message == null ) {
				message = expected;
				expected = null;
			} else {
				throw new Error(
					"throws/raises does not accept a string value for the expected argument.\n" +
					"Use a non-string object value (e.g. regExp) instead if it's necessary."
				);
			}
		}

		currentTest.ignoreGlobalErrors = true;
		try {
			block.call( currentTest.testEnvironment );
		} catch ( e ) {
			actual = e;
		}
		currentTest.ignoreGlobalErrors = false;

		if ( actual ) {
			const data = validateException( actual, expected, message, currentTest, "throws" );
			result = data.result;
			expected = data.expected;
			message = data.message;
		}

		currentTest.assert.pushResult( {
			result,

			// undefined if it didn't throw
			actual: actual && errorString( actual ),
			expected,
			message
		} );
	}

	rejects( promise, expected, message ) {

		const currentTest = ( this instanceof Assert && this.test ) || config.current;

		// 'expected' is optional unless doing string comparison
		if ( objectType( expected ) === "string" ) {
			if ( message === undefined ) {
				message = expected;
				expected = undefined;
			} else {
				message = "assert.rejects does not accept a string value for the expected " +
					"argument.\nUse a non-string object value (e.g. validator function) instead " +
					"if necessary.";

				currentTest.assert.pushResult( {
					result: false,
					message: message
				} );

				return;
			}
		}

		const then = promise && promise.then;
		if ( objectType( then ) !== "function" ) {
			const message = "The value provided to `assert.rejects` in " +
				"\"" + currentTest.testName + "\" was not a promise.";

			currentTest.assert.pushResult( {
				result: false,
				message: message,
				actual: promise
			} );

			return;
		}

		const done = this.async();

		return then.call(
			promise,
			function handleFulfillment() {
				const message = "The promise returned by the `assert.rejects` callback in " +
				"\"" + currentTest.testName + "\" did not reject.";

				currentTest.assert.pushResult( {
					result: false,
					message: message,
					actual: promise
				} );

				done();
			},

			function handleRejection( actual ) {

				const data = validateException( actual, expected, message, currentTest, "rejects" );

				currentTest.assert.pushResult( {
					result: data.result,

					// leave rejection value of undefined as-is
					actual: actual && errorString( actual ),
					expected: data.expected,
					message: data.message
				} );
				done();
			}
		);
	}
}

function validateException( actual, expected, message, currentTest, assertionMethod ) {
	let result = false;
	const expectedType = objectType( expected );

	// We don't want to validate
	if ( expected === undefined || expected === null ) {
		result = true;

	// Expected is a regexp
	} else if ( expectedType === "regexp" ) {
		result = expected.test( errorString( actual ) );

		// Log the string form of the regexp
		expected = String( expected );

	// Expected is a constructor, maybe an Error constructor.
	// Note the extra check on its prototype - this is an implicit
	// requirement of "instanceof", else it will throw a TypeError.
	} else if ( expectedType === "function" &&
		expected.prototype !== undefined && actual instanceof expected ) {
		result = true;

	// Expected is an Error object
	} else if ( expectedType === "object" ) {
		result = actual instanceof expected.constructor &&
			actual.name === expected.name &&
			actual.message === expected.message;

		// Log the string form of the Error object
		expected = errorString( expected );

	// Expected is a validation function which returns true if validation passed
	} else if ( expectedType === "function" ) {

		// protect against accidental semantics which could hard error in the test
		try {
			result = expected.call( {}, actual ) === true;
			expected = null;
		} catch ( e ) {

			// assign the "expected" to a nice error string to communicate the local failure to the user
			expected = errorString( e );
		}

	// Expected is some other invalid type
	} else {
		result = false;
		message = "invalid expected value provided to `assert." + assertionMethod + "` " +
			"callback in \"" + currentTest.testName + "\": " +
			expectedType + ".";
	}

	return {
		result,
		expected,
		message
	};
}

// Provide an alternative to assert.throws(), for environments that consider throws a reserved word
// Known to us are: Closure Compiler, Narwhal
// eslint-disable-next-line dot-notation
Assert.prototype.raises = Assert.prototype[ "throws" ];

export default Assert;
