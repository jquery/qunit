QUnit.module( "before/beforeEach/afterEach/after", {
	before: function() {
		this.lastHook = "module-before";
	},
	beforeEach: function( assert ) {
		assert.strictEqual( this.lastHook, "module-before",
			"Module's beforeEach runs after before" );
		this.lastHook = "module-beforeEach";
	},
	afterEach: function( assert ) {
		assert.strictEqual( this.lastHook, "test-block",
			"Module's afterEach runs after current test block" );
		this.lastHook = "module-afterEach";
	},
	after: function( assert ) {
		assert.strictEqual( this.lastHook, "module-afterEach",
			"Module's afterEach runs before after" );
		this.lastHook = "module-after";
	}
} );

QUnit.test( "hooks order", function( assert ) {
	assert.expect( 4 );

	assert.strictEqual( this.lastHook, "module-beforeEach",
		"Module's beforeEach runs before current test block" );
	this.lastHook = "test-block";
} );

QUnit.module( "before", {
	before: function( assert ) {
		assert.ok( true, "before hook ran" );

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

QUnit.module( "after", {
	after: function( assert ) {
		assert.ok( true, "after hook ran" );
	}
} );

QUnit.test( "does not run after initial tests", function( assert ) {
	assert.expect( 0 );
} );

QUnit.test( "runs after final test", function( assert ) {
	assert.expect( 1 );
} );

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

QUnit.module( "afterEach and QUnit.stop", {
	beforeEach: function() {
		this.state = false;
	},
	afterEach: function( assert ) {
		assert.strictEqual( this.state, true, "Test afterEach." );
	}
} );

QUnit.test( "afterEach must be called after test ended", function( assert ) {
	var testContext = this;
	assert.expect( 1 );
	QUnit.stop();
	setTimeout( function() {
		testContext.state = true;
		QUnit.start();
	} );
} );

QUnit.test( "parameter passed to stop increments semaphore n times", function( assert ) {
	var testContext = this;
	assert.expect( 1 );
	QUnit.stop( 3 );
	setTimeout( function() {
		QUnit.start();
		QUnit.start();
	} );
	setTimeout( function() {
		testContext.state = true;
		QUnit.start();
	}, 1 );
} );

QUnit.test( "parameter passed to start decrements semaphore n times", function( assert ) {
	var testContext = this;
	assert.expect( 1 );
	QUnit.stop();
	QUnit.stop();
	QUnit.stop();
	setTimeout( function() {
		testContext.state = true;
		QUnit.start( 3 );
	} );
} );

QUnit.module( "async beforeEach test", {
	beforeEach: function( assert ) {
		QUnit.stop();
		setTimeout( function() {
			assert.ok( true );
			QUnit.start();
		} );
	}
} );

QUnit.asyncTest( "module with async beforeEach", function( assert ) {
	assert.expect( 2 );
	assert.ok( true );
	QUnit.start();
} );

QUnit.module( "async afterEach test", {
	afterEach: function( assert ) {
		QUnit.stop();
		setTimeout( function() {
			assert.ok( true );
			QUnit.start();
		} );
	}
} );

QUnit.asyncTest( "module with async afterEach", function( assert ) {
	assert.expect( 2 );
	assert.ok( true );
	QUnit.start();
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

QUnit.module( "Deprecated setup/teardown", {
	setup: function() {
		this.deprecatedSetup = true;
	},
	teardown: function( assert ) {
		assert.ok( this.deprecatedSetup );
	}
} );

QUnit.test( "before/after order", function( assert ) {
	assert.expect( 1 );
} );

QUnit.module( "pre-nested modules" );

QUnit.module( "nested modules", function() {
	QUnit.module( "first outer", {
			afterEach: function( assert ) {
				assert.ok( true, "first outer module afterEach called" );
			},
			beforeEach: function( assert ) {
				assert.ok( true, "first outer beforeEach called" );
			}
		},
		function() {
			QUnit.module( "first inner", {
					afterEach: function( assert ) {
						assert.ok( true, "first inner module afterEach called" );
					},
					beforeEach: function( assert ) {
						assert.ok( true, "first inner module beforeEach called" );
					}
				},
				function() {
					QUnit.test( "in module, before- and afterEach called in out-in-out " +
						"order",
						function( assert ) {
							var module = assert.test.module;
							assert.equal( module.name,
								"nested modules > first outer > first inner" );
							assert.expect( 5 );
						} );
				} );
			QUnit.test( "test after nested module is processed", function( assert ) {
				var module = assert.test.module;
				assert.equal( module.name, "nested modules > first outer" );
				assert.expect( 3 );
			} );
			QUnit.module( "second inner" );
			QUnit.test( "test after non-nesting module declared", function( assert ) {
				var module = assert.test.module;
				assert.equal( module.name, "nested modules > first outer > second inner" );
				assert.expect( 3 );
			} );
		} );
	QUnit.module( "second outer" );
	QUnit.test( "test after all nesting modules processed and new module declared",
		function( assert ) {
			var module = assert.test.module;
			assert.equal( module.name, "nested modules > second outer" );
		} );
} );

QUnit.test( "modules with nested functions does not spread beyond", function( assert ) {
	assert.equal( assert.test.module.name, "pre-nested modules" );
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
			assert.ok( true, "beforeEach called" );
		} );

		afterEach( function( assert ) {
			assert.ok( true, "afterEach called" );
		} );

		QUnit.test( "call hooks", function( assert ) {
			assert.expect( 2 );
		} );

		QUnit.module( "stacked inner hooks", function( hooks ) {
			var beforeEach = hooks.beforeEach;
			var afterEach = hooks.afterEach;

			beforeEach( function( assert ) {
				assert.ok( true, "nested beforeEach called" );
			} );

			afterEach( function( assert ) {
				assert.ok( true, "nested afterEach called" );
			} );

			QUnit.test( "call hooks", function( assert ) {
				assert.expect( 4 );
			} );
		} );
	} );
} );

QUnit.module( "contained suite `this`", function( hooks ) {
	this.outer = 1;

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

		hooks.beforeEach( function( assert ) {
			assert.ok( this.outer );
			assert.ok( this.inner );
		} );

		hooks.afterEach( function( assert ) {
			assert.ok( this.outer );
			assert.ok( this.inner );

			// This change affects the outermodule afterEach assertion.
			this.outer = 42;
		} );

		QUnit.test( "inner modules share outer environments", function( assert ) {
			assert.ok( this.outer );
			assert.ok( this.inner );
		} );
	} );

	QUnit.test( "tests can't see environments from nested modules", function( assert )  {
		assert.strictEqual( this.inner, undefined );
		this.outer = 42;
	} );
} );

QUnit.module( "nested modules before/after", {
	before: function( assert ) {
		assert.ok( true, "before hook ran" );
		this.lastHook = "before";
	},
	after: function( assert ) {
		assert.strictEqual( this.lastHook, "outer-after" );
	}
}, function() {
	QUnit.test( "should run before", function( assert ) {
		assert.expect( 2 );
		assert.strictEqual( this.lastHook, "before" );
	} );

	QUnit.module( "outer", {
		before: function( assert ) {
			assert.ok( true, "outer before hook ran" );
			this.lastHook = "outer-before";
		},
		after: function( assert ) {
			assert.strictEqual( this.lastHook, "outer-test" );
			this.lastHook = "outer-after";
		}
	}, function() {
		QUnit.module( "inner", {
			before: function( assert ) {
				assert.strictEqual( this.lastHook, "outer-before" );
				this.lastHook = "inner-before";
			},
			after: function( assert ) {
				assert.strictEqual( this.lastHook, "inner-test" );
			}
		}, function() {
			QUnit.test( "should run outer-before and inner-before", function( assert ) {
				assert.expect( 3 );
				assert.strictEqual( this.lastHook, "inner-before" );
			} );

			QUnit.test( "should run inner-after", function( assert ) {
				assert.expect( 1 );
				this.lastHook = "inner-test";
			} );
		} );

		QUnit.test( "should run outer-after and after", function( assert ) {
			assert.expect( 2 );
			this.lastHook = "outer-test";
		} );
	} );
} );
