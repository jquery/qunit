var errorFromAsyncModule;
try {
	/* eslint-disable-next-line qunit/no-async-module-callbacks */
	QUnit.module( "async module function", async function() {
		QUnit.test( "has a test", function( assert ) {
			assert.true( true );
		} );
	} );
} catch ( e ) {
	errorFromAsyncModule = e;
}

QUnit.test( "Correct error thrown from async module function", function( assert ) {
	assert.true( errorFromAsyncModule instanceof Error );
	assert.strictEqual( errorFromAsyncModule.message,
		"Returning a promise from a module callback is not supported. " +
		"Instead, use hooks for async behavior.", "Error has correct message" );
} );
