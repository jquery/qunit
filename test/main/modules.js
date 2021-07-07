QUnit.module( "QUnit.module", function() {
	var hooksOrder = [];
	QUnit.module( "before/beforeEach/afterEach/after", {
		before: function( assert ) {
			assert.deepEqual( hooksOrder, [], "No hooks run before before" );
			this.lastHook = "module-before";
			hooksOrder.push( "module-before" );
		},
		beforeEach: function( assert ) {
			assert.deepEqual( hooksOrder, [ "module-before" ],
				"Module's beforeEach runs after before" );
			this.lastHook = "module-beforeEach";
			hooksOrder.push( "module-beforeEach" );
		},
		afterEach: function( assert ) {
			assert.deepEqual( hooksOrder, [ "module-before", "module-beforeEach", "test-block" ],
				"Module's afterEach runs after current test block" );
			this.lastHook = "module-afterEach";
			hooksOrder.push( "module-afterEach" );
		},
		after: function( assert ) {
			assert.deepEqual( hooksOrder, [ "module-before", "module-beforeEach", "test-block", "module-afterEach" ],
				"Module's afterEach runs before after" );
			this.lastHook = "module-after";
			hooksOrder.push( "module-after" );
		}
	} );

	QUnit.test( "hooks order", function( assert ) {
		assert.expect( 5 );

		assert.deepEqual( hooksOrder, [ "module-before", "module-beforeEach" ],
			"Module's beforeEach runs before current test block" );
		hooksOrder.push( "test-block" );
		this.lastHook = "test-block";
	} );

	QUnit.module( "before", {
		before: function( assert ) {
			assert.true( true, "before hook ran" );

			if ( typeof this.beforeCount === "undefined" ) {
				this.beforeCount = 0;
			}

			this.beforeCount++;
		}
	} );

	QUnit.test( "runs before first test", function( assert ) {
		assert.expect( 2 );
		assert.equal( this.beforeCount, 1, "beforeCount should be one" );
	} );

	QUnit.test( "does not run before subsequent tests", function( assert ) {
		assert.expect( 1 );
		assert.equal( this.beforeCount, 1, "beforeCount did not increase from last test" );
	} );

	QUnit.module( "before (skip)", {
		before: function( assert ) {
			assert.true( true, "before hook ran" );
		}
	} );

	QUnit.skip( "first test in module is skipped" );

	QUnit.test( "runs before first unskipped test", function( assert ) {
		assert.expect( 1 );
	} );

	QUnit.module( "after", {
		after: function( assert ) {
			assert.true( true, "after hook ran" );
		}
	} );

	QUnit.test( "does not run after initial tests", function( assert ) {
		assert.expect( 0 );
	} );

	QUnit.test( "runs after final test", function( assert ) {
		assert.expect( 1 );
	} );

	QUnit.module( "after (skip)", {
		after: function( assert ) {
			assert.true( true, "after hook ran" );
		}
	} );

	QUnit.test( "does not run after initial tests", function( assert ) {
		assert.expect( 0 );
	} );

	QUnit.test( "runs after final unskipped test", function( assert ) {
		assert.expect( 1 );
	} );

	QUnit.skip( "last test in module is skipped" );

	QUnit.module( "before/after with all tests skipped", {
		before: function( assert ) {
			assert.true( false, "should not occur" );
		},
		after: function( assert ) {
			assert.true( false, "should not occur" );
		}
	} );

	QUnit.skip( "verifier" );

	QUnit.module( "Test context object", {
		beforeEach: function( assert ) {
			var key,
				keys = [];

			for ( key in this ) {
				keys.push( key );
			}
			assert.deepEqual( keys, [ "helper" ] );
		},
		afterEach: function() {},
		helper: function() {}
	} );

	QUnit.test( "keys", function( assert ) {
		assert.expect( 1 );
		this.contextTest = true;
	} );

	QUnit.module( "afterEach and assert.async", {
		beforeEach: function() {
			this.state = false;
		},
		afterEach: function( assert ) {
			assert.strictEqual( this.state, true, "Test afterEach." );
		}
	} );

	QUnit.test( "afterEach must be called after test ended", function( assert ) {
		var testContext = this;
		var done = assert.async();
		assert.expect( 1 );
		setTimeout( function() {
			testContext.state = true;
			done();
		} );
	} );

	QUnit.module( "async beforeEach test", {
		beforeEach: function( assert ) {
			var done = assert.async();
			setTimeout( function() {
				assert.true( true );
				done();
			} );
		}
	} );

	QUnit.test( "module with async beforeEach", function( assert ) {
		assert.expect( 2 );
		assert.true( true );
	} );

	QUnit.module( "async afterEach test", {
		afterEach: function( assert ) {
			var done = assert.async();
			setTimeout( function() {
				assert.true( true );
				done();
			} );
		}
	} );

	QUnit.test( "module with async afterEach", function( assert ) {
		assert.expect( 2 );
		assert.true( true );
	} );

	QUnit.module( "save scope", {
		foo: "foo",
		beforeEach: function( assert ) {
			assert.deepEqual( this.foo, "foo" );
			this.foo = "bar";
		},
		afterEach: function( assert ) {
			assert.deepEqual( this.foo, "foobar" );
		}
	} );

	QUnit.test( "scope check", function( assert ) {
		assert.expect( 3 );
		assert.deepEqual( this.foo, "bar" );
		this.foo = "foobar";
	} );

	QUnit.module( "nested modules", function() {
		QUnit.module( "first outer", {
			afterEach: function( assert ) {
				assert.true( true, "first outer module afterEach called" );
			},
			beforeEach: function( assert ) {
				assert.true( true, "first outer beforeEach called" );
			}
		}, function() {
			QUnit.module( "first inner", {
				afterEach: function( assert ) {
					assert.true( true, "first inner module afterEach called" );
				},
				beforeEach: function( assert ) {
					assert.true( true, "first inner module beforeEach called" );
				}
			}, function() {
				QUnit.test( "in module, before-/afterEach called in out-in-out order", function( assert ) {
					var module = assert.test.module;
					assert.equal( module.name,
						"QUnit.module > nested modules > first outer > first inner" );
					assert.expect( 5 );
				} );
			} );

			QUnit.test( "test after nested module is processed", function( assert ) {
				var module = assert.test.module;
				assert.equal( module.name, "QUnit.module > nested modules > first outer" );
				assert.expect( 3 );
			} );

			QUnit.module( "second inner" );

			QUnit.test( "test after non-nesting module declared", function( assert ) {
				var module = assert.test.module;
				assert.equal( module.name, "QUnit.module > nested modules > first outer > second inner" );
				assert.expect( 3 );
			} );
		} );

		QUnit.module( "second outer" );

		QUnit.test( "test after all nesting modules processed and new module declared", function( assert ) {
			var module = assert.test.module;
			assert.equal( module.name, "QUnit.module > nested modules > second outer" );
		} );
	} );

	QUnit.test( "modules with nested functions does not spread beyond", function( assert ) {
		assert.equal( assert.test.module.name, "QUnit.module" );
	} );

	QUnit.module( "contained suite arguments", function( hooks ) {
		QUnit.test( "hook functions", function( assert ) {
			assert.strictEqual( typeof hooks.beforeEach, "function" );
			assert.strictEqual( typeof hooks.afterEach, "function" );
		} );

		QUnit.module( "outer hooks", function( hooks ) {
			var beforeEach = hooks.beforeEach;
			var afterEach = hooks.afterEach;

			beforeEach( function( assert ) {
				assert.true( true, "beforeEach called" );
			} );

			afterEach( function( assert ) {
				assert.true( true, "afterEach called" );
			} );

			QUnit.test( "call hooks", function( assert ) {
				assert.expect( 2 );
			} );

			QUnit.module( "stacked inner hooks", function( hooks ) {
				var beforeEach = hooks.beforeEach;
				var afterEach = hooks.afterEach;

				beforeEach( function( assert ) {
					assert.true( true, "nested beforeEach called" );
				} );

				afterEach( function( assert ) {
					assert.true( true, "nested afterEach called" );
				} );

				QUnit.test( "call hooks", function( assert ) {
					assert.expect( 4 );
				} );
			} );
		} );
	} );

	QUnit.module( "contained suite `this`", function( hooks ) {
		this.outer = 1;

		hooks.before( function() {
			this.outerBefore = 10;
		} );

		hooks.beforeEach( function() {
			this.outer++;
		} );

		hooks.afterEach( function( assert ) {
			assert.equal(
				this.outer, 42,
				"in-test environment modifications are visible by afterEach callbacks"
			);
		} );

		QUnit.test( "`this` is shared from modules to the tests", function( assert ) {
			assert.equal( this.outer, 2 );
			this.outer = 42;
		} );

		QUnit.test( "sibling tests don't share environments", function( assert ) {
			assert.equal( this.outer, 2 );
			this.outer = 42;
		} );

		QUnit.module( "nested suite `this`", function( hooks ) {
			this.inner = true;

			hooks.before( function() {
				this.innerBefore = 20;
			} );

			hooks.beforeEach( function( assert ) {
				assert.strictEqual( this.outerBefore, 10 );
				assert.strictEqual( this.innerBefore, 20 );
				assert.strictEqual( this.outer, 2 );
				assert.true( this.inner );
			} );

			hooks.afterEach( function( assert ) {
				assert.strictEqual( this.outer, 2 );
				assert.true( this.inner );

				// This change affects the outermodule afterEach assertion.
				this.outer = 42;
			} );

			QUnit.test( "inner modules share outer environments", function( assert ) {
				assert.strictEqual( this.outer, 2 );
				assert.true( this.inner );
			} );
		} );

		QUnit.test( "tests can't see environments from nested modules", function( assert ) {
			assert.strictEqual( this.inner, undefined );
			this.outer = 42;
		} );
	} );

	var lastRunHook;
	QUnit.module( "nested modules before/after", {
		before: function( assert ) {
			assert.true( true, "before hook ran" );
			this.lastHook = "before";
			lastRunHook = "before";
		},
		after: function( assert ) {
			assert.strictEqual( lastRunHook, "outer-after" );
		}
	}, function() {
		QUnit.test( "should run before", function( assert ) {
			assert.expect( 2 );
			assert.strictEqual( this.lastHook, "before" );
		} );

		QUnit.module( "outer", {
			before: function( assert ) {
				assert.true( true, "outer before hook ran" );
				this.lastHook = "outer-before";
				lastRunHook = "outer-before";
			},
			after: function( assert ) {
				assert.strictEqual( lastRunHook, "outer-test" );
				lastRunHook = "outer-after";
			}
		}, function() {
			QUnit.module( "inner", {
				before: function( assert ) {
					assert.strictEqual( this.lastHook, "outer-before" );
					this.lastHook = "inner-before";
				},
				after: function( assert ) {
					assert.strictEqual( lastRunHook, "inner-test" );
				}
			}, function() {
				QUnit.test( "should run outer-before and inner-before", function( assert ) {
					assert.expect( 3 );
					assert.strictEqual( this.lastHook, "inner-before" );
				} );

				QUnit.test( "should run inner-after", function( assert ) {
					assert.expect( 1 );
					lastRunHook = "inner-test";
				} );
			} );

			QUnit.test( "should run outer-after and after", function( assert ) {
				assert.expect( 2 );
				lastRunHook = "outer-test";
			} );
		} );
	} );

	QUnit.module( "multiple hooks", function( hooks ) {
		hooks.before( function( assert ) { assert.step( "before1" ); } );
		hooks.before( function( assert ) { assert.step( "before2" ); } );

		hooks.beforeEach( function( assert ) { assert.step( "beforeEach1" ); } );
		hooks.beforeEach( function( assert ) { assert.step( "beforeEach2" ); } );

		hooks.afterEach( function( assert ) { assert.step( "afterEach1" ); } );
		hooks.afterEach( function( assert ) { assert.step( "afterEach2" ); } );

		hooks.after( function( assert ) {
			assert.verifySteps( [

				// before/beforeEach execute in FIFO order
				"before1",
				"before2",
				"beforeEach1",
				"beforeEach2",

				// after/afterEach execute in LIFO order
				"afterEach2",
				"afterEach1",
				"after2",
				"after1"
			] );
		} );

		hooks.after( function( assert ) { assert.step( "after1" ); } );
		hooks.after( function( assert ) { assert.step( "after2" ); } );

		QUnit.test( "all hooks", function( assert ) {
			assert.expect( 9 );
		} );
	} );
} );
