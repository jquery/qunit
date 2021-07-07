"use strict";

// Expected outputs from the TapReporter for the commands run in CLI tests
module.exports = {
	"qunit":
`TAP version 13
ok 1 First > 1
ok 2 Second > 1
1..2
# pass 2
# skip 0
# todo 0
# fail 0`,

	"qunit 'glob/**/*-test.js'":
`TAP version 13
ok 1 A-Test > derp
ok 2 Nested-Test > herp
1..2
# pass 2
# skip 0
# todo 0
# fail 0`,

	"qunit single.js":
`TAP version 13
ok 1 Single > has a test
1..1
# pass 1
# skip 0
# todo 0
# fail 0`,

	"qunit single.js double.js":
`TAP version 13
ok 1 Double > has a test
ok 2 Double > has another test
ok 3 Single > has a test
1..3
# pass 3
# skip 0
# todo 0
# fail 0`,

	"qunit test":
`TAP version 13
ok 1 First > 1
ok 2 Second > 1
1..2
# pass 2
# skip 0
# todo 0
# fail 0`,

	"qunit fail/throws-match.js":
`TAP version 13
not ok 1 Throws match > bad
  ---
  message: match error
  severity: failed
  actual  : Error: Match me with a pattern
  expected: "/incorrect pattern/"
  stack: |
        at /qunit/test/cli/fixtures/fail/throws-match.js:3:10
  ...
1..1
# pass 0
# skip 0
# todo 0
# fail 1`,

	"qunit test single.js 'glob/**/*-test.js'":
`TAP version 13
ok 1 A-Test > derp
ok 2 Nested-Test > herp
ok 3 Single > has a test
ok 4 First > 1
ok 5 Second > 1
1..5
# pass 5
# skip 0
# todo 0
# fail 0`,

	"qunit --seed 's33d' test single.js 'glob/**/*-test.js'": `Running tests with seed: s33d
TAP version 13
ok 1 Second > 1
ok 2 Single > has a test
ok 3 First > 1
ok 4 Nested-Test > herp
ok 5 A-Test > derp
1..5
# pass 5
# skip 0
# todo 0
# fail 0`,

	"qunit --reporter npm-reporter": "Run ended!",
	"qunit --reporter does-not-exist": `No reporter found matching "does-not-exist".
Built-in reporters: console, tap
Extra reporters found among package dependencies: npm-reporter`,

	"qunit --reporter": `Built-in reporters: console, tap
Extra reporters found among package dependencies: npm-reporter`,

	"qunit hanging-test": `Error: Process exited before tests finished running
Last test to run (hanging) has an async hold. Ensure all assert.async() callbacks are invoked and Promises resolve. You should also set a standard timeout via QUnit.config.testTimeout.`,
	/* eslint-enable max-len */
	"qunit unhandled-rejection.js":
`TAP version 13
not ok 1 Unhandled Rejections > test passes just fine, but has a rejected promise
  ---
  message: global failure: Error: Error thrown in non-returned promise!
  severity: failed
  actual  : undefined
  expected: undefined
  stack: |
    Error: Error thrown in non-returned promise!
        at /qunit/test/cli/fixtures/unhandled-rejection.js:10:10
        at internal
  ...
not ok 2 global failure
  ---
  message: Error: outside of a test context
  severity: failed
  actual  : undefined
  expected: undefined
  stack: |
    Error: outside of a test context
        at /qunit/test/cli/fixtures/unhandled-rejection.js:17:18
        at processModule (/qunit/qunit/qunit.js)
        at Object.module$1 [as module] (/qunit/qunit/qunit.js)
        at /qunit/test/cli/fixtures/unhandled-rejection.js:3:7
        at internal
  ...
1..2
# pass 0
# skip 0
# todo 0
# fail 2`,

	// The last frame differs between Node 10 and 12+ (changes in processing of ticks)
	"qunit no-tests":
`TAP version 13
not ok 1 global failure
  ---
  message: Error: No tests were run.
  severity: failed
  actual  : undefined
  expected: undefined
  stack: |
    Error: No tests were run.
        at done (/qunit/qunit/qunit.js)
        at advanceTestQueue (/qunit/qunit/qunit.js)
        at Object.advance (/qunit/qunit/qunit.js)
        at unblockAndAdvanceQueue (/qunit/qunit/qunit.js)
        at internal
  ...
1..1
# pass 0
# skip 0
# todo 0
# fail 1`,

	"qunit sourcemap/source.js":
`TAP version 13
ok 1 Example > good
not ok 2 Example > bad
  ---
  message: failed
  severity: failed
  actual  : false
  expected: true
  stack: |
        at /qunit/test/cli/fixtures/sourcemap/source.js:7:14
  ...
1..2
# pass 1
# skip 0
# todo 0
# fail 1`,

	"NODE_OPTIONS='--enable-source-maps' qunit sourcemap/source.min.js":
`TAP version 13
ok 1 Example > good
not ok 2 Example > bad
  ---
  message: failed
  severity: failed
  actual  : false
  expected: true
  stack: |
        at /qunit/test/cli/fixtures/sourcemap/sourcemap/source.js:7:10
  ...
1..2
# pass 1
# skip 0
# todo 0
# fail 1`,

	"qunit ../../es2018/esm.mjs":
`TAP version 13
ok 1 ESM test suite > sum()
1..1
# pass 1
# skip 0
# todo 0
# fail 0`,

	"qunit timeout":
`TAP version 13
not ok 1 timeout > first
  ---
  message: Test took longer than 10ms; test timed out.
  severity: failed
  actual  : null
  expected: undefined
  stack: |
        at internal
  ...
ok 2 timeout > second
1..2
# pass 1
# skip 0
# todo 0
# fail 1`,

	"qunit zero-assertions.js":
`TAP version 13
ok 1 Zero assertions > has a test
1..1
# pass 1
# skip 0
# todo 0
# fail 0`,

	"qunit qunit --filter 'no matches' test":
`TAP version 13
not ok 1 global failure
  ---
  message: "Error: No tests matched the filter \\"no matches\\"."
  severity: failed
  actual  : undefined
  expected: undefined
  stack: |
    Error: No tests matched the filter "no matches".
        at done (/qunit/qunit/qunit.js)
        at advanceTestQueue (/qunit/qunit/qunit.js)
        at Object.advance (/qunit/qunit/qunit.js)
        at unblockAndAdvanceQueue (/qunit/qunit/qunit.js)
        at internal
  ...
1..1
# pass 0
# skip 0
# todo 0
# fail 1`,

	"qunit single.js --require require-dep --require './node_modules/require-dep/module.js'":
`required require-dep/index.js
required require-dep/module.js
TAP version 13
ok 1 Single > has a test
1..1
# pass 1
# skip 0
# todo 0
# fail 0`,

	"node --expose-gc ../../../bin/qunit.js memory-leak/*.js":
`TAP version 13
ok 1 some nested module > can call method on foo
ok 2 later thing > has released all foos
1..2
# pass 2
# skip 0
# todo 0
# fail 0`,

	"qunit only/test.js":
`TAP version 13
ok 1 run this test
ok 2 all tests with only run
1..3
# pass 3
# skip 0
# todo 0
# fail 0`,

	"qunit only/module.js":
`TAP version 13
not ok 1 # TODO module B > Only this module should run > a todo test
  ---
  message: not implemented yet
  severity: todo
  actual  : false
  expected: true
  stack: |
        at /qunit/test/cli/fixtures/only/module.js:17:15
  ...
ok 2 # SKIP module B > Only this module should run > implicitly skipped test
ok 3 module B > Only this module should run > normal test
ok 4 module D > test D
ok 5 module E > module F > test F
ok 6 module E > test E
1..8
# pass 6
# skip 1
# todo 1
# fail 0`,

	"qunit only/module-flat.js":
`TAP version 13
not ok 1 # TODO module B > test B
  ---
  message: not implemented yet
  severity: todo
  actual  : false
  expected: true
  stack: |
        at /qunit/test/cli/fixtures/only/module-flat.js:9:13
  ...
ok 2 # SKIP module B > test C
ok 3 module B > test D
1..4
# pass 2
# skip 1
# todo 1
# fail 0`,

	"qunit incorrect-hooks-warning/test.js":
`TAP version 13
ok 1 module providing hooks > module not providing hooks > has a test
1..1
# pass 1
# skip 0
# todo 0
# fail 0`,

	"qunit async-module-warning/test.js":
`TAP version 13
ok 1 async module function > has a test
ok 2 async module function > Correct error thrown from async module function
1..2
# pass 2
# skip 0
# todo 0
# fail 0`,

	"qunit async-module-warning/promise-test.js":
`TAP version 13
ok 1 module manually returning a promise > has a test
ok 2 module manually returning a promise > Correct error thrown from module function that returns a promise
1..2
# pass 2
# skip 0
# todo 0
# fail 0`,

	"qunit config-module.js":
`TAP version 13
ok 1 Module B > Test B
1..1
# pass 1
# skip 0
# todo 0
# fail 0`,

	"qunit config-testTimeout.js":
`TAP version 13
not ok 1 slow
  ---
  message: Test took longer than 10ms; test timed out.
  severity: failed
  actual  : null
  expected: undefined
  stack: |
        at internal
  ...
1..1
# pass 0
# skip 0
# todo 0
# fail 1`,

	"qunit done-after-timeout.js":
`TAP version 13
not ok 1 times out before scheduled done is called
  ---
  message: Test took longer than 10ms; test timed out.
  severity: failed
  actual  : null
  expected: undefined
  stack: |
        at internal
  ...
1..1
# pass 0
# skip 0
# todo 0
# fail 1`,

	"qunit assert-expect/no-tests.js":
`TAP version 13
1..0
# pass 0
# skip 0
# todo 0
# fail 0`
};
