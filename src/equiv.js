import { objectType } from "./core/utilities";

// Test for equality any JavaScript type.
// Authors: Philippe Rathé <prathe@gmail.com>, David Chan <david@troi.org>
export default ( function() {

	// Value pairs queued for comparison. Used for breadth-first processing order, recursion
	// detection and avoiding repeated comparison (see below for details).
	// Elements are { a: val, b: val }.
	let pairs = [];

	const getProto = Object.getPrototypeOf || function( obj ) {
		return obj.__proto__;
	};

	function lookupDescriptor( obj, keyName ) {
		let current = obj;
		do {
			const descriptor = Object.getOwnPropertyDescriptor( current, keyName );
			if ( descriptor !== undefined ) {
				return descriptor;
			}
			current = getProto( current );
		} while ( current !== null );
		return null;
	}

	function hasSharedDescriptor( a, b, keyName ) {
		var aDescriptor = lookupDescriptor( a, keyName );
		var bDescriptor = lookupDescriptor( b, keyName );

		return ( aDescriptor !== null && bDescriptor !== null ) &&
			aDescriptor.value === bDescriptor.value &&
			aDescriptor.get === bDescriptor.get &&
			aDescriptor.set === bDescriptor.set &&
			aDescriptor.writable === bDescriptor.writable &&
			aDescriptor.configurable === bDescriptor.configurable &&
			aDescriptor.enumerable === bDescriptor.enumerable;
	}

	function useStrictEquality( a, b ) {

		// This only gets called if a and b are not strict equal, and is used to compare on
		// the primitive values inside object wrappers. For example:
		// `var i = 1;`
		// `var j = new Number(1);`
		// Neither a nor b can be null, as a !== b and they have the same type.
		if ( typeof a === "object" ) {
			a = a.valueOf();
		}
		if ( typeof b === "object" ) {
			b = b.valueOf();
		}

		return a === b;
	}

	function compareConstructors( a, b ) {
		let protoA = getProto( a );
		let protoB = getProto( b );

		// Comparing constructors is more strict than using `instanceof`
		if ( a.constructor === b.constructor ) {
			return true;
		}

		// Ref #851
		// If the obj prototype descends from a null constructor, treat it
		// as a null prototype.
		if ( protoA && protoA.constructor === null ) {
			protoA = null;
		}
		if ( protoB && protoB.constructor === null ) {
			protoB = null;
		}

		// Allow objects with no prototype to be equivalent to
		// objects with Object as their constructor.
		if ( ( protoA === null && protoB === Object.prototype ) ||
				( protoB === null && protoA === Object.prototype ) ) {
			return true;
		}

		return false;
	}

	function getRegExpFlags( regexp ) {
		return "flags" in regexp ? regexp.flags : regexp.toString().match( /[gimuy]*$/ )[ 0 ];
	}

	function isContainer( val ) {
		return [ "object", "array", "map", "set" ].indexOf( objectType( val ) ) !== -1;
	}

	function breadthFirstCompareChild( a, b ) {

		// If a is a container not reference-equal to b, postpone the comparison to the
		// end of the pairs queue -- unless (a, b) has been seen before, in which case skip
		// over the pair.
		if ( a === b ) {
			return true;
		}
		if ( !isContainer( a ) ) {
			return typeEquiv( a, b );
		}
		if ( pairs.every( function( pair ) {
			return pair.a !== a || pair.b !== b;
		} ) ) {

			// Not yet started comparing this pair
			pairs.push( { a: a, b: b } );
		}
		return true;
	}

	const callbacks = {
		"string": useStrictEquality,
		"boolean": useStrictEquality,
		"number": useStrictEquality,
		"null": useStrictEquality,
		"undefined": useStrictEquality,
		"symbol": useStrictEquality,
		"date": useStrictEquality,

		"nan": function() {
			return true;
		},

		"regexp": function( a, b ) {
			return a.source === b.source &&

				// Include flags in the comparison
				getRegExpFlags( a ) === getRegExpFlags( b );
		},

		// abort (identical references / instance methods were skipped earlier)
		"function": function() {
			return false;
		},

		"array": function( a, b ) {

			const len = a.length;
			if ( len !== b.length ) {

				// Safe and faster
				return false;
			}


			for ( let i = 0; i < len; i++ ) {

				// Compare non-containers; queue non-reference-equal containers
				if ( !breadthFirstCompareChild( a[ i ], b[ i ] ) ) {
					return false;
				}
			}
			return true;
		},

		// Define sets a and b to be equivalent if for each element aVal in a, there
		// is some element bVal in b such that aVal and bVal are equivalent. Element
		// repetitions are not counted, so these are equivalent:
		// a = new Set( [ {}, [], [] ] );
		// b = new Set( [ {}, {}, [] ] );
		"set": function( a, b ) {

			if ( a.size !== b.size ) {

				// This optimization has certain quirks because of the lack of
				// repetition counting. For instance, adding the same
				// (reference-identical) element to two equivalent sets can
				// make them non-equivalent.
				return false;
			}

			let outerEq = true;

			a.forEach( function( aVal ) {

				// Short-circuit if the result is already known. (Using for...of
				// with a break clause would be cleaner here, but it would cause
				// a syntax error on older JavaScript implementations even if
				// Set is unused)
				if ( !outerEq ) {
					return;
				}

				let innerEq = false;

				b.forEach( function( bVal ) {

					// Likewise, short-circuit if the result is already known
					if ( innerEq ) {
						return;
					}

					// Swap out the global pairs list, as the nested call to
					// innerEquiv will clobber its contents
					const parentPairs = pairs;
					if ( innerEquiv( bVal, aVal ) ) {
						innerEq = true;
					}

					// Replace the global pairs list
					pairs = parentPairs;
				} );

				if ( !innerEq ) {
					outerEq = false;
				}
			} );

			return outerEq;
		},

		// Define maps a and b to be equivalent if for each key-value pair (aKey, aVal)
		// in a, there is some key-value pair (bKey, bVal) in b such that
		// [ aKey, aVal ] and [ bKey, bVal ] are equivalent. Key repetitions are not
		// counted, so these are equivalent:
		// a = new Map( [ [ {}, 1 ], [ {}, 1 ], [ [], 1 ] ] );
		// b = new Map( [ [ {}, 1 ], [ [], 1 ], [ [], 1 ] ] );
		"map": function( a, b ) {

			if ( a.size !== b.size ) {

				// This optimization has certain quirks because of the lack of
				// repetition counting. For instance, adding the same
				// (reference-identical) key-value pair to two equivalent maps
				// can make them non-equivalent.
				return false;
			}

			let outerEq = true;

			a.forEach( function( aVal, aKey ) {

				// Short-circuit if the result is already known. (Using for...of
				// with a break clause would be cleaner here, but it would cause
				// a syntax error on older JavaScript implementations even if
				// Map is unused)
				if ( !outerEq ) {
					return;
				}

				let innerEq = false;

				b.forEach( function( bVal, bKey ) {

					// Likewise, short-circuit if the result is already known
					if ( innerEq ) {
						return;
					}

					// Swap out the global pairs list, as the nested call to
					// innerEquiv will clobber its contents
					const parentPairs = pairs;
					if ( innerEquiv( [ bVal, bKey ], [ aVal, aKey ] ) ) {
						innerEq = true;
					}

					// Replace the global pairs list
					pairs = parentPairs;
				} );

				if ( !innerEq ) {
					outerEq = false;
				}
			} );

			return outerEq;
		},

		"object": function( a, b ) {

			if ( compareConstructors( a, b ) === false ) {
				return false;
			}

			const aProperties = [];
			const bProperties = [];

			// Be strict: don't ensure hasOwnProperty and go deep
			for ( const i in a ) {

				// Collect a's properties
				aProperties.push( i );

				// Skip OOP methods that look the same
				var hasValidConstructor = a.constructor !== Object &&
					typeof a.constructor !== "undefined";

				if (
					hasValidConstructor &&
					(
						(

							// Skip own functions with same definition
							hasOwnProperty.call( a, i ) &&
							typeof a[ i ] === "function" &&
							typeof b[ i ] === "function" &&
							a[ i ].toString() === b[ i ].toString()
						) || (

							// Skip shared inherited functions
							hasSharedDescriptor( a, b, i )
						)
					)
				) {
					continue;
				}


				// Compare non-containers; queue non-reference-equal containers
				if ( !breadthFirstCompareChild( a[ i ], b[ i ] ) ) {
					return false;
				}
			}

			for ( const i in b ) {

				// Collect b's properties
				bProperties.push( i );
			}

			// Ensures identical properties name
			return typeEquiv( aProperties.sort(), bProperties.sort() );
		}
	};

	function typeEquiv( a, b ) {
		const type = objectType( a );

		// Callbacks for containers will append to the pairs queue to achieve breadth-first
		// search order. The pairs queue is also used to avoid reprocessing any pair of
		// containers that are reference-equal to a previously visited pair (a special case
		// this being recursion detection).
		//
		// Because of this approach, once typeEquiv returns a false value, it should not be
		// called again without clearing the pair queue else it may wrongly report a visited
		// pair as being equivalent.
		return objectType( b ) === type && callbacks[ type ]( a, b );
	}

	function innerEquiv( a, b ) {

		// We're done when there's nothing more to compare
		if ( arguments.length < 2 ) {
			return true;
		}

		// Clear the global pair queue and add the top-level values being compared
		pairs = [ { a: a, b: b } ];

		for ( let i = 0; i < pairs.length; i++ ) {
			const pair = pairs[ i ];

			// Perform type-specific comparison on any pairs that are not strictly
			// equal. For container types, that comparison will postpone comparison
			// of any sub-container pair to the end of the pair queue. This gives
			// breadth-first search order. It also avoids the reprocessing of
			// reference-equal siblings, cousins etc, which can have a significant speed
			// impact when comparing a container of small objects each of which has a
			// reference to the same (singleton) large object.
			if ( pair.a !== pair.b && !typeEquiv( pair.a, pair.b ) ) {
				return false;
			}
		}

		// ...across all consecutive argument pairs
		return arguments.length === 2 || innerEquiv.apply( this, [].slice.call( arguments, 1 ) );
	}

	return ( ...args ) => {
		const result = innerEquiv( ...args );

		// Release any retained objects
		pairs.length = 0;
		return result;
	};
}() );
