QUnit.module( "assert" );

function CustomError( message ) {
	this.message = message;
}

CustomError.prototype.toString = function() {
	return this.message;
};

QUnit.test( "rejects", function( assert ) {
	assert.expect( 1 );

	assert.rejects(
		Promise.reject( new CustomError( "some error description" ) ),
		err => {
			return err instanceof CustomError && /description/.test( err );
		},
		"custom validation function"
	);
} );

QUnit.test( "rejects with expected class", function( assert ) {
	assert.expect( 1 );

	class CustomError extends Error {}

	assert.rejects(
		Promise.reject( new CustomError( "foo" ) ),
		CustomError,
		"Expected value is a class extending Error"
	);
} );

QUnit.module( "failing assertions", {
	beforeEach: function( assert ) {
		const originalPushResult = assert.pushResult;
		assert.pushResult = function( resultInfo ) {

			// Inverts the result so we can test failing assertions
			resultInfo.result = !resultInfo.result;
			originalPushResult( resultInfo );
		};
	}
}, function() {
	QUnit.test( "rejects", function( assert ) {
		assert.rejects(
			Promise.reject(),
			() => false,
			"rejects fails when expected function returns false"
		);
	} );

	QUnit.module( "inspect expected values", {
		beforeEach: function( assert ) {
			const originalPushResult = assert.pushResult;
			assert.pushResult = function( resultInfo ) {

				// avoid circular asserts and use if/throw to verify
				if ( resultInfo.expected !== "TypeError: Class constructor CustomError cannot be invoked without 'new'" ) {
					throw new Error( "Unexpected value: " + resultInfo.expected );
				}

				// invoke the "outer" pushResult, which still inverts the result for negative testing
				originalPushResult( resultInfo );
			};
		}
	}, function() {
		QUnit.test( "does not die when class is expected", function( assert ) {
			class CustomError extends Error {}

			assert.rejects(
				Promise.reject( new Error( "foo" ) ),
				CustomError,
				"rejects fails gracefully when expected value class does not use 'new'"
			);
		} );
	} );
} );
