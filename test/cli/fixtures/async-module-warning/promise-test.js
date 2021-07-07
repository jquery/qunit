var errorFromModule;
try {
	QUnit.module( "module manually returning a promise", function() {
		QUnit.test( "has a test", function( assert ) {
			assert.true( true );
		} );
		return Promise.resolve( 1 );
	} );
} catch ( e ) {
	errorFromModule = e;
}

QUnit.test( "Correct error thrown from module function that returns a promise", function( assert ) {
	assert.true( errorFromModule instanceof Error );
	assert.strictEqual( errorFromModule.message,
		"Returning a promise from a module callback is not supported. " +
		"Instead, use hooks for async behavior.", "Error has correct message" );
} );
