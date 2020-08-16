/* eslint-env node */

const { babel } = require( "@rollup/plugin-babel" );
const { nodeResolve } = require( "@rollup/plugin-node-resolve" );
const commonjs = require( "@rollup/plugin-commonjs" );

module.exports = {
	input: "src/qunit.js",
	output: {
		file: "dist/qunit.js",
		format: "iife",
		exports: "none",

		// eslint-disable-next-line no-multi-str
		banner: "/*!\n\
 * QUnit @VERSION\n\
 * https://qunitjs.com/\n\
 *\n\
 * Copyright jQuery Foundation and other contributors\n\
 * Released under the MIT license\n\
 * https://jquery.org/license\n\
 *\n\
 * Date: @DATE\n\
 */",

		globals: {
			global: "(function() { return this; }())"
		}
	},
	plugins: [
		nodeResolve(),
		commonjs(),
		babel( {
			babelHelpers: "bundled",
			babelrc: true
		} )
	],
	external: [
		"global"
	]
};
