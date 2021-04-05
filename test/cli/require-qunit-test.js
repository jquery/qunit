const proxyquire = require( "proxyquire" ).noCallThru();
const path = require( "path" );
const resolveStub = ( path ) => {
	return path;
};

QUnit.module( "requireQUnit", function( hooks ) {
	const cwd = process.cwd();

	hooks.before( () => {
		process.chdir( cwd );
	} );
	hooks.afterEach( () => {
		process.chdir( cwd );
	} );

	QUnit.test( "finds QUnit package in the current working directory", function( assert ) {
		const requireQUnit = require( "../../src/cli/require-qunit" );
		process.chdir( path.join( __dirname, "./fixtures/require-from-cwd" ) );

		assert.propEqual( requireQUnit(), { version: "from-cwd" } );
	} );

	// For development mode invoked locally,
	// or for global install without local dependency installed.
	QUnit.test( "finds relative self", function( assert ) {
		const globalQUnit = {
			"version": "from-global"
		};
		const requireQUnit = proxyquire( "../../src/cli/require-qunit", {
			"qunit": null,
			"../../qunit/qunit": globalQUnit
		} );
		assert.strictEqual( requireQUnit( resolveStub ), globalQUnit );
	} );

	QUnit.test( "throws error if none of the modules are found", function( assert ) {
		const requireQUnit = proxyquire( "../../src/cli/require-qunit", {
			"qunit": null,
			"../../qunit/qunit": null
		} );

		assert.throws( requireQUnit, /Cannot find module/ );
	} );
} );

