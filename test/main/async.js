QUnit.module( "assert.async", function() {

	QUnit.test( "single call synchronously", function( assert ) {
		var done;

		assert.expect( 1 );
		done = assert.async();

		assert.true( true );
		done();
	} );

	QUnit.test( "single call", function( assert ) {
		var done = assert.async();

		assert.expect( 1 );
		setTimeout( function() {
			assert.true( true );
			done();
		} );
	} );

	QUnit.test( "multiple calls", function( assert ) {
		var done = assert.async( 4 );

		assert.expect( 4 );
		setTimeout( function() {
			assert.true( true );
			done();
		} );
		setTimeout( function() {
			assert.true( true );
			done();
		} );
		setTimeout( function() {
			assert.true( true );
			done();
		} );
		setTimeout( function() {
			assert.true( true );
			done();
		} );

	} );

	QUnit.test( "parallel calls", function( assert ) {
		var done1 = assert.async(),
			done2 = assert.async();

		assert.expect( 2 );
		setTimeout( function() {
			assert.true( true );
			done1();
		} );
		setTimeout( function() {
			assert.true( true );
			done2();
		} );
	} );

	QUnit.test( "parallel calls of differing speeds", function( assert ) {
		var done1 = assert.async(),
			done2 = assert.async();

		assert.expect( 2 );
		setTimeout( function() {
			assert.true( true );
			done1();
		} );
		setTimeout( function() {
			assert.true( true );
			done2();
		}, 100 );
	} );

	QUnit.test( "waterfall calls", function( assert ) {
		var done2,
			done1 = assert.async();

		assert.expect( 2 );
		setTimeout( function() {
			assert.true( true, "first" );
			done1();
			done2 = assert.async();
			setTimeout( function() {
				assert.true( true, "second" );
				done2();
			} );
		} );
	} );

	QUnit.test( "waterfall calls of differing speeds", function( assert ) {
		var done2,
			done1 = assert.async();

		assert.expect( 2 );
		setTimeout( function() {
			assert.true( true, "first" );
			done1();
			done2 = assert.async();
			setTimeout( function() {
				assert.true( true, "second" );
				done2();
			}, 100 );
		} );
	} );

	QUnit.test( "fails if called more than once", function( assert ) {

		// Having an outer async flow in this test avoids the need to manually modify QUnit internals
		// in order to avoid post-`done` assertions causing additional failures
		var done = assert.async();

		assert.expect( 1 );

		// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
		assert.test.pushFailure = function( msg ) {
			throw new Error( msg );
		};

		var overDone = assert.async();
		overDone();

		assert.throws( function() {
			overDone();
		}, new RegExp( "Too many calls to the `assert.async` callback" ) );

		done();
	} );

	QUnit.test( "fails if called more than specified count", function( assert ) {

		// Having an outer async flow in this test avoids the need to manually modify QUnit internals
		// in order to avoid post-`done` assertions causing additional failures
		var done = assert.async();

		assert.expect( 1 );

		// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
		assert.test.pushFailure = function( msg ) {
			throw new Error( msg );
		};

		var overDone = assert.async( 3 );
		overDone();
		overDone();
		overDone();

		assert.throws( function() {
			overDone();
		}, new RegExp( "Too many calls to the `assert.async` callback" ) );

		done();
	} );

	( function() {
		var previousTestDone;

		QUnit.test( "errors if called after test finishes - part 1", function( assert ) {
			assert.expect( 0 );
			previousTestDone = assert.async();
			previousTestDone();
		} );

		QUnit.test( "errors if called after test finishes - part 2", function( assert ) {

			// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
			assert.test.pushFailure = function( msg ) {
				throw new Error( msg );
			};
			assert.throws( previousTestDone, /Error: `assert\.async` callback from test "errors if called after test finishes - part 1" was called during this test./ );
		} );
	}() );

	QUnit.module( "overcalled in before hook", {
		before: function( assert ) {

			// Having an outer async flow in this test avoids the need to manually modify QUnit
			// internals in order to avoid post-`done` assertions causing additional failures
			var done = assert.async();

			// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
			assert.test.pushFailure = function( msg ) {
				throw new Error( msg );
			};

			var overDone = assert.async();
			overDone();

			assert.throws( function() {
				overDone();
			}, new RegExp( "Too many calls to the `assert.async` callback" ) );

			done();
		}
	}, function() {
		QUnit.test( "test", function() {} );
	} );

	QUnit.module( "overcalled in beforeEach hook", {
		beforeEach: function( assert ) {

			// Having an outer async flow in this test avoids the need to manually modify QUnit
			// internals in order to avoid post-`done` assertions causing additional failures
			var done = assert.async();

			// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
			assert.test.pushFailure = function( msg ) {
				throw new Error( msg );
			};

			var overDone = assert.async();
			overDone();

			assert.throws( function() {
				overDone();
			}, new RegExp( "Too many calls to the `assert.async` callback" ) );

			done();
		}
	}, function() {
		QUnit.test( "test", function() {} );
	} );

	QUnit.module( "overcalled in afterEach hook", {
		afterEach: function( assert ) {

			// Having an outer async flow in this test avoids the need to manually modify QUnit
			// internals in order to avoid post-`done` assertions causing additional failures
			var done = assert.async();

			// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
			assert.test.pushFailure = function( msg ) {
				throw new Error( msg );
			};

			var overDone = assert.async();
			overDone();

			assert.throws( function() {
				overDone();
			}, new RegExp( "Too many calls to the `assert.async` callback" ) );

			done();
		}
	}, function() {
		QUnit.test( "test", function() {} );
	} );

	QUnit.module( "overcalled in after hook", {
		after: function( assert ) {

			// Having an outer async flow in this test avoids the need to manually modify QUnit
			// internals in order to avoid post-`done` assertions causing additional failures
			var done = assert.async();

			// Duck-punch to force an Error to be thrown instead of a `pushFailure` call
			assert.test.pushFailure = function( msg ) {
				throw new Error( msg );
			};

			var overDone = assert.async();
			overDone();

			assert.throws( function() {
				overDone();
			}, new RegExp( "Too many calls to the `assert.async` callback" ) );

			done();
		}
	}, function() {
		QUnit.test( "test", function() {} );
	} );

	QUnit.module( "in before hook", {
		before: function( assert ) {
			var done = assert.async(),
				testContext = this;
			setTimeout( function() {
				testContext.state = "before";
				done();
			} );
		}
	}, function() {
		QUnit.test( "call order", function( assert ) {
			assert.equal( this.state, "before", "called before test callback" );
		} );
	} );

	QUnit.module( "in beforeEach hook", {
		beforeEach: function( assert ) {
			var done = assert.async(),
				testContext = this;
			setTimeout( function() {
				testContext.state = "beforeEach";
				done();
			} );
		}
	}, function() {
		QUnit.test( "call order", function( assert ) {
			assert.equal( this.state, "beforeEach", "called before test callback" );
		} );
	} );

	QUnit.module( "in afterEach hook", {
		afterEach: function( assert ) {
			assert.equal( this.state, "done", "called after test callback" );
			assert.true( true, "called before expected assert count is validated" );
		}
	}, function() {
		QUnit.test( "call order", function( assert ) {
			assert.expect( 2 );
			var done = assert.async(),
				testContext = this;
			setTimeout( function() {
				testContext.state = "done";
				done();
			} );
		} );
	} );

	var inAfterHookModuleState;
	QUnit.module( "in after hook", {
		after: function( assert ) {
			assert.equal( inAfterHookModuleState, "done", "called after test callback" );
			assert.true( true, "called before expected assert count is validated" );
		}
	}, function() {
		QUnit.test( "call order", function( assert ) {
			assert.expect( 2 );
			var done = assert.async();
			setTimeout( function() {
				inAfterHookModuleState = "done";
				done();
			} );
		} );
	} );

	QUnit.module( "assertions after final assert.async callback", {
		before: function( assert ) {
			assert.async()();
			assert.true( true, "before" );
		},

		beforeEach: function( assert ) {
			assert.async()();
			assert.true( true, "beforeEach" );
		},

		afterEach: function( assert ) {
			assert.async()();
			assert.true( true, "afterEach" );
		},

		after: function( assert ) {
			assert.async()();
			assert.true( true, "after" );
		}
	} );

	QUnit.test( "in any hook still pass", function( assert ) {
		assert.expect( 5 );
		assert.true( true, "test callback" );
	} );

} );
