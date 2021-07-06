import QUnit from "../core";
import Test from "../test";
import { extractStacktrace } from "../core/stacktrace";
import { now, extend } from "../core/utilities";
import { window, document, navigator, console } from "../globals";
import "./urlparams";
import fuzzysort from "fuzzysort";

const stats = {
	passedTests: 0,
	failedTests: [],
	skippedTests: 0,
	todoTests: 0
};

// Escape text for attribute or text content.
export function escapeText( s ) {
	if ( !s ) {
		return "";
	}
	s = s + "";

	// Both single quotes and double quotes (for attributes)
	return s.replace( /['"<>&]/g, function( s ) {
		switch ( s ) {
		case "'":
			return "&#039;";
		case "\"":
			return "&quot;";
		case "<":
			return "&lt;";
		case ">":
			return "&gt;";
		case "&":
			return "&amp;";
		}
	} );
}

( function() {

	// Don't load the HTML Reporter on non-browser environments
	if ( !window || !document ) {
		return;
	}

	var config = QUnit.config,
		hiddenTests = [],
		collapseNext = false,
		hasOwn = Object.prototype.hasOwnProperty,
		unfilteredUrl = setUrl( { filter: undefined, module: undefined,
			moduleId: undefined, testId: undefined } );


	function trim( string ) {
		if ( typeof string.trim === "function" ) {
			return string.trim();
		} else {
			return string.replace( /^\s+|\s+$/g, "" );
		}
	}

	function addEvent( elem, type, fn ) {
		elem.addEventListener( type, fn, false );
	}

	function removeEvent( elem, type, fn ) {
		elem.removeEventListener( type, fn, false );
	}

	function addEvents( elems, type, fn ) {
		var i = elems.length;
		while ( i-- ) {
			addEvent( elems[ i ], type, fn );
		}
	}

	function hasClass( elem, name ) {
		return ( " " + elem.className + " " ).indexOf( " " + name + " " ) >= 0;
	}

	function addClass( elem, name ) {
		if ( !hasClass( elem, name ) ) {
			elem.className += ( elem.className ? " " : "" ) + name;
		}
	}

	function toggleClass( elem, name, force ) {
		if ( force || typeof force === "undefined" && !hasClass( elem, name ) ) {
			addClass( elem, name );
		} else {
			removeClass( elem, name );
		}
	}

	function removeClass( elem, name ) {
		var set = " " + elem.className + " ";

		// Class name may appear multiple times
		while ( set.indexOf( " " + name + " " ) >= 0 ) {
			set = set.replace( " " + name + " ", " " );
		}

		// Trim for prettiness
		elem.className = trim( set );
	}

	function id( name ) {
		return document.getElementById && document.getElementById( name );
	}

	function abortTests() {
		var abortButton = id( "qunit-abort-tests-button" );
		if ( abortButton ) {
			abortButton.disabled = true;
			abortButton.innerHTML = "Aborting...";
		}
		QUnit.config.queue.length = 0;
		return false;
	}

	function interceptNavigation( ev ) {

		// Trim potential accidental whitespace so that QUnit doesn't throw an error about no tests matching the filter.
		var filterInputElem = id( "qunit-filter-input" );
		filterInputElem.value = trim( filterInputElem.value );

		applyUrlParams();

		if ( ev && ev.preventDefault ) {
			ev.preventDefault();
		}

		return false;
	}

	function getUrlConfigHtml() {
		var i, j, val,
			escaped, escapedTooltip,
			selection = false,
			urlConfig = config.urlConfig,
			urlConfigHtml = "";

		for ( i = 0; i < urlConfig.length; i++ ) {

			// Options can be either strings or objects with nonempty "id" properties
			val = config.urlConfig[ i ];
			if ( typeof val === "string" ) {
				val = {
					id: val,
					label: val
				};
			}

			escaped = escapeText( val.id );
			escapedTooltip = escapeText( val.tooltip );

			if ( !val.value || typeof val.value === "string" ) {
				urlConfigHtml += "<label for='qunit-urlconfig-" + escaped +
				"' title='" + escapedTooltip + "'><input id='qunit-urlconfig-" + escaped +
				"' name='" + escaped + "' type='checkbox'" +
				( val.value ? " value='" + escapeText( val.value ) + "'" : "" ) +
				( config[ val.id ] ? " checked='checked'" : "" ) +
				" title='" + escapedTooltip + "' />" + escapeText( val.label ) + "</label>";
			} else {
				urlConfigHtml += "<label for='qunit-urlconfig-" + escaped +
				"' title='" + escapedTooltip + "'>" + val.label +
				": </label><select id='qunit-urlconfig-" + escaped +
				"' name='" + escaped + "' title='" + escapedTooltip + "'><option></option>";

				if ( QUnit.is( "array", val.value ) ) {
					for ( j = 0; j < val.value.length; j++ ) {
						escaped = escapeText( val.value[ j ] );
						urlConfigHtml += "<option value='" + escaped + "'" +
						( config[ val.id ] === val.value[ j ] ?
							( selection = true ) && " selected='selected'" : "" ) +
						">" + escaped + "</option>";
					}
				} else {
					for ( j in val.value ) {
						if ( hasOwn.call( val.value, j ) ) {
							urlConfigHtml += "<option value='" + escapeText( j ) + "'" +
							( config[ val.id ] === j ?
								( selection = true ) && " selected='selected'" : "" ) +
							">" + escapeText( val.value[ j ] ) + "</option>";
						}
					}
				}
				if ( config[ val.id ] && !selection ) {
					escaped = escapeText( config[ val.id ] );
					urlConfigHtml += "<option value='" + escaped +
					"' selected='selected' disabled='disabled'>" + escaped + "</option>";
				}
				urlConfigHtml += "</select>";
			}
		}

		return urlConfigHtml;
	}

	// Handle "click" events on toolbar checkboxes and "change" for select menus.
	// Updates the URL with the new state of `config.urlConfig` values.
	function toolbarChanged() {
		var updatedUrl, value, tests,
			field = this,
			params = {};

		// Detect if field is a select menu or a checkbox
		if ( "selectedIndex" in field ) {
			value = field.options[ field.selectedIndex ].value || undefined;
		} else {
			value = field.checked ? ( field.defaultValue || true ) : undefined;
		}

		params[ field.name ] = value;
		updatedUrl = setUrl( params );

		// Check if we can apply the change without a page refresh
		if ( "hidepassed" === field.name && "replaceState" in window.history ) {
			QUnit.urlParams[ field.name ] = value;
			config[ field.name ] = value || false;
			tests = id( "qunit-tests" );
			if ( tests ) {
				var length = tests.children.length;
				var children = tests.children;

				if ( field.checked ) {
					for ( var i = 0; i < length; i++ ) {
						var test = children[ i ];
						var className = test ? test.className : "";
						var classNameHasPass = className.indexOf( "pass" ) > -1;
						var classNameHasSkipped = className.indexOf( "skipped" ) > -1;

						if ( classNameHasPass || classNameHasSkipped ) {
							hiddenTests.push( test );
						}
					}

					for ( const hiddenTest of hiddenTests ) {
						tests.removeChild( hiddenTest );
					}
				} else {
					while ( ( test = hiddenTests.pop() ) != null ) {
						tests.appendChild( test );
					}
				}
			}
			window.history.replaceState( null, "", updatedUrl );
		} else {
			window.location = updatedUrl;
		}
	}

	function setUrl( params ) {
		var key, arrValue, i,
			querystring = "?",
			location = window.location;

		params = extend( extend( {}, QUnit.urlParams ), params );

		for ( key in params ) {

			// Skip inherited or undefined properties
			if ( hasOwn.call( params, key ) && params[ key ] !== undefined ) {

				// Output a parameter for each value of this key
				// (but usually just one)
				arrValue = [].concat( params[ key ] );
				for ( i = 0; i < arrValue.length; i++ ) {
					querystring += encodeURIComponent( key );
					if ( arrValue[ i ] !== true ) {
						querystring += "=" + encodeURIComponent( arrValue[ i ] );
					}
					querystring += "&";
				}
			}
		}
		return location.protocol + "//" + location.host +
		location.pathname + querystring.slice( 0, -1 );
	}

	function applyUrlParams() {
		var i,
			selectedModules = [],
			modulesList = id( "qunit-modulefilter-dropdown-list" ).getElementsByTagName( "input" ),
			filter = id( "qunit-filter-input" ).value;

		for ( i = 0; i < modulesList.length; i++ ) {
			if ( modulesList[ i ].checked ) {
				selectedModules.push( modulesList[ i ].value );
			}
		}

		window.location = setUrl( {
			filter: ( filter === "" ) ? undefined : filter,
			moduleId: ( selectedModules.length === 0 ) ? undefined : selectedModules,

			// Remove module and testId filter
			module: undefined,
			testId: undefined
		} );
	}

	function toolbarUrlConfigContainer() {
		var urlConfigContainer = document.createElement( "span" );

		urlConfigContainer.innerHTML = getUrlConfigHtml();
		addClass( urlConfigContainer, "qunit-url-config" );

		addEvents( urlConfigContainer.getElementsByTagName( "input" ), "change", toolbarChanged );
		addEvents( urlConfigContainer.getElementsByTagName( "select" ), "change", toolbarChanged );

		return urlConfigContainer;
	}

	function abortTestsButton() {
		var button = document.createElement( "button" );
		button.id = "qunit-abort-tests-button";
		button.innerHTML = "Abort";
		addEvent( button, "click", abortTests );
		return button;
	}

	function toolbarLooseFilter() {
		var filter = document.createElement( "form" ),
			label = document.createElement( "label" ),
			input = document.createElement( "input" ),
			button = document.createElement( "button" );

		addClass( filter, "qunit-filter" );

		label.innerHTML = "Filter: ";

		input.type = "text";
		input.value = config.filter || "";
		input.name = "filter";
		input.id = "qunit-filter-input";

		button.innerHTML = "Go";

		label.appendChild( input );

		filter.appendChild( label );
		filter.appendChild( document.createTextNode( " " ) );
		filter.appendChild( button );
		addEvent( filter, "submit", interceptNavigation );

		return filter;
	}

	function moduleListHtml( modules ) {
		var i, checked,
			html = "";

		for ( i = 0; i < modules.length; i++ ) {
			if ( modules[ i ].name !== "" ) {
				checked = config.moduleId.indexOf( modules[ i ].moduleId ) > -1;
				html += "<li><label class='clickable" + ( checked ? " checked" : "" ) +
				"'><input type='checkbox' " + "value='" + modules[ i ].moduleId + "'" +
				( checked ? " checked='checked'" : "" ) + " />" +
				escapeText( modules[ i ].name ) + "</label></li>";
			}
		}

		return html;
	}

	function toolbarModuleFilter() {
		var commit, reset,
			moduleFilter = document.createElement( "form" ),
			label = document.createElement( "label" ),
			moduleSearch = document.createElement( "input" ),
			dropDown = document.createElement( "div" ),
			actions = document.createElement( "span" ),
			applyButton = document.createElement( "button" ),
			resetButton = document.createElement( "button" ),
			allModulesLabel = document.createElement( "label" ),
			allCheckbox = document.createElement( "input" ),
			dropDownList = document.createElement( "ul" ),
			dirty = false;

		moduleSearch.id = "qunit-modulefilter-search";
		moduleSearch.autocomplete = "off";
		addEvent( moduleSearch, "input", searchInput );
		addEvent( moduleSearch, "input", searchFocus );
		addEvent( moduleSearch, "focus", searchFocus );
		addEvent( moduleSearch, "click", searchFocus );

		config.modules.forEach( module => module.namePrepared = fuzzysort.prepare( module.name ) );

		label.id = "qunit-modulefilter-search-container";
		label.innerHTML = "Module: ";
		label.appendChild( moduleSearch );

		applyButton.textContent = "Apply";
		applyButton.style.display = "none";

		resetButton.textContent = "Reset";
		resetButton.type = "reset";
		resetButton.style.display = "none";

		allCheckbox.type = "checkbox";
		allCheckbox.checked = config.moduleId.length === 0;

		allModulesLabel.className = "clickable";
		if ( config.moduleId.length ) {
			allModulesLabel.className = "checked";
		}
		allModulesLabel.appendChild( allCheckbox );
		allModulesLabel.appendChild( document.createTextNode( "All modules" ) );

		actions.id = "qunit-modulefilter-actions";
		actions.appendChild( applyButton );
		actions.appendChild( resetButton );
		actions.appendChild( allModulesLabel );
		commit = actions.firstChild;
		reset = commit.nextSibling;
		addEvent( commit, "click", applyUrlParams );

		dropDownList.id = "qunit-modulefilter-dropdown-list";
		dropDownList.innerHTML = moduleListHtml( config.modules );

		dropDown.id = "qunit-modulefilter-dropdown";
		dropDown.style.display = "none";
		dropDown.appendChild( actions );
		dropDown.appendChild( dropDownList );
		addEvent( dropDown, "change", selectionChange );
		selectionChange();

		moduleFilter.id = "qunit-modulefilter";
		moduleFilter.appendChild( label );
		moduleFilter.appendChild( dropDown );
		addEvent( moduleFilter, "submit", interceptNavigation );
		addEvent( moduleFilter, "reset", function() {

			// Let the reset happen, then update styles
			window.setTimeout( selectionChange );
		} );

		// Enables show/hide for the dropdown
		function searchFocus() {
			if ( dropDown.style.display !== "none" ) {
				return;
			}

			dropDown.style.display = "block";
			addEvent( document, "click", hideHandler );
			addEvent( document, "keydown", hideHandler );

			// Hide on Escape keydown or outside-container click
			function hideHandler( e ) {
				var inContainer = moduleFilter.contains( e.target );

				if ( e.keyCode === 27 || !inContainer ) {
					if ( e.keyCode === 27 && inContainer ) {
						moduleSearch.focus();
					}
					dropDown.style.display = "none";
					removeEvent( document, "click", hideHandler );
					removeEvent( document, "keydown", hideHandler );
					moduleSearch.value = "";
					searchInput();
				}
			}
		}

		function filterModules( searchText ) {
			if ( searchText === "" ) {
				return config.modules;
			}
			return fuzzysort
				.go( searchText, config.modules, { key: "namePrepared", threshold: -10000 } )
				.map( module => module.obj );
		}

		// Processes module search box input
		var searchInputTimeout;
		function searchInput() {
			window.clearTimeout( searchInputTimeout );
			searchInputTimeout = window.setTimeout( () => {
				var searchText = moduleSearch.value.toLowerCase(),
					filteredModules = filterModules( searchText );
				dropDownList.innerHTML = moduleListHtml( filteredModules );
			}, 200 );
		}

		// Processes selection changes
		function selectionChange( evt ) {
			var i, item,
				checkbox = evt && evt.target || allCheckbox,
				modulesList = dropDownList.getElementsByTagName( "input" ),
				selectedNames = [];

			toggleClass( checkbox.parentNode, "checked", checkbox.checked );

			dirty = false;
			if ( checkbox.checked && checkbox !== allCheckbox ) {
				allCheckbox.checked = false;
				removeClass( allCheckbox.parentNode, "checked" );
			}
			for ( i = 0; i < modulesList.length; i++ ) {
				item = modulesList[ i ];
				if ( !evt ) {
					toggleClass( item.parentNode, "checked", item.checked );
				} else if ( checkbox === allCheckbox && checkbox.checked ) {
					item.checked = false;
					removeClass( item.parentNode, "checked" );
				}
				dirty = dirty || ( item.checked !== item.defaultChecked );
				if ( item.checked ) {
					selectedNames.push( item.parentNode.textContent );
				}
			}

			commit.style.display = reset.style.display = dirty ? "" : "none";
			moduleSearch.placeholder = selectedNames.join( ", " ) ||
				allCheckbox.parentNode.textContent;
			moduleSearch.title = "Type to filter list. Current selection:\n" +
			( selectedNames.join( "\n" ) || allCheckbox.parentNode.textContent );
		}

		return moduleFilter;
	}

	function toolbarFilters() {
		var toolbarFilters = document.createElement( "span" );

		toolbarFilters.id = "qunit-toolbar-filters";
		toolbarFilters.appendChild( toolbarLooseFilter() );
		toolbarFilters.appendChild( toolbarModuleFilter() );

		return toolbarFilters;
	}

	function appendToolbar() {
		var toolbar = id( "qunit-testrunner-toolbar" );

		if ( toolbar ) {
			toolbar.appendChild( toolbarUrlConfigContainer() );
			toolbar.appendChild( toolbarFilters() );
			toolbar.appendChild( document.createElement( "div" ) ).className = "clearfix";
		}
	}

	function appendHeader() {
		var header = id( "qunit-header" );

		if ( header ) {
			header.innerHTML = "<a href='" + escapeText( unfilteredUrl ) + "'>" + header.innerHTML +
			"</a> ";
		}
	}

	function appendBanner() {
		var banner = id( "qunit-banner" );

		if ( banner ) {
			banner.className = "";
		}
	}

	function appendTestResults() {
		var tests = id( "qunit-tests" ),
			result = id( "qunit-testresult" ),
			controls;

		if ( result ) {
			result.parentNode.removeChild( result );
		}

		if ( tests ) {
			tests.innerHTML = "";
			result = document.createElement( "p" );
			result.id = "qunit-testresult";
			result.className = "result";
			tests.parentNode.insertBefore( result, tests );
			result.innerHTML = "<div id=\"qunit-testresult-display\">Running...<br />&#160;</div>" +
			"<div id=\"qunit-testresult-controls\"></div>" +
			"<div class=\"clearfix\"></div>";
			controls = id( "qunit-testresult-controls" );
		}

		if ( controls ) {
			controls.appendChild( abortTestsButton() );
		}
	}

	function appendFilteredTest() {
		var testId = QUnit.config.testId;
		if ( !testId || testId.length <= 0 ) {
			return "";
		}
		return "<div id='qunit-filteredTest'>Rerunning selected tests: " +
			escapeText( testId.join( ", " ) ) +
			" <a id='qunit-clearFilter' href='" +
			escapeText( unfilteredUrl ) +
			"'>Run all tests</a></div>";
	}

	function appendUserAgent() {
		var userAgent = id( "qunit-userAgent" );

		if ( userAgent ) {
			userAgent.innerHTML = "";
			userAgent.appendChild(
				document.createTextNode(
					"QUnit " + QUnit.version + "; " + navigator.userAgent
				)
			);
		}
	}

	function appendInterface() {
		var qunit = id( "qunit" );

		// For compat with QUnit 1.2, and to support fully custom theme HTML,
		// we will use any existing elements if no id="qunit" element exists.
		//
		// Note that we don't fail or fallback to creating it ourselves,
		// because not having id="qunit" (and not having the below elements)
		// simply means QUnit acts headless, allowing users to use their own
		// reporters, or for a test runner to listen for events directly without
		// having the HTML reporter actively render anything.
		if ( qunit ) {

			qunit.setAttribute( "role", "main" );

			// Since QUnit 1.3, these are created automatically if the page
			// contains id="qunit".
			qunit.innerHTML =
			"<h1 id='qunit-header'>" + escapeText( document.title ) + "</h1>" +
			"<h2 id='qunit-banner'></h2>" +
			"<div id='qunit-testrunner-toolbar' role='navigation'></div>" +
			appendFilteredTest() +
			"<h2 id='qunit-userAgent'></h2>" +
			"<ol id='qunit-tests'></ol>";
		}

		appendHeader();
		appendBanner();
		appendTestResults();
		appendUserAgent();
		appendToolbar();
	}

	function appendTest( name, testId, moduleName ) {
		var title, rerunTrigger, testBlock, assertList,
			tests = id( "qunit-tests" );

		if ( !tests ) {
			return;
		}

		title = document.createElement( "strong" );
		title.innerHTML = getNameHtml( name, moduleName );

		rerunTrigger = document.createElement( "a" );
		rerunTrigger.innerHTML = "Rerun";
		rerunTrigger.href = setUrl( { testId: testId } );

		testBlock = document.createElement( "li" );
		testBlock.appendChild( title );
		testBlock.appendChild( rerunTrigger );
		testBlock.id = "qunit-test-output-" + testId;

		assertList = document.createElement( "ol" );
		assertList.className = "qunit-assert-list";

		testBlock.appendChild( assertList );

		tests.appendChild( testBlock );
	}

	// HTML Reporter initialization and load
	QUnit.begin( function() {

		// Initialize QUnit elements
		appendInterface();
	} );

	function getProgressHtml( runtime, stats, total ) {
		var completed = stats.passedTests +
			stats.skippedTests +
			stats.todoTests +
			stats.failedTests.length;

		return [
			completed < total ? completed + " / " : "",
			total,
			" tests completed in ",
			runtime,
			" milliseconds, with ",
			stats.failedTests.length,
			" failed, ",
			stats.skippedTests,
			" skipped, and ",
			stats.todoTests,
			" todo."
		].join( "" );
	}

	function getAssertionsSummaryHtml( total, passed, failed ) {
		return [
			"<span class='passed'>",
			passed,
			"</span> assertions of <span class='total'>",
			total,
			"</span> passed, <span class='failed'>",
			failed,
			"</span> failed."
		].join( "" );
	}

	function getRerunFailedHtml( failedTests ) {
		if ( failedTests.length === 0 ) {return "";}

		var href = setUrl( { testId: failedTests } );
		return [
			"<a href='" + href + "'>",
			failedTests.length === 1 ?
				"Rerun 1 failed test" :
				"Rerun all " + failedTests.length + " failed tests",
			"</a>"
		].join( "" );
	}

	QUnit.done( function( details ) {
		var banner = id( "qunit-banner" ),
			tests = id( "qunit-tests" ),
			abortButton = id( "qunit-abort-tests-button" ),
			totalTests = stats.passedTests +
				stats.skippedTests +
				stats.todoTests +
				stats.failedTests.length,
			html = [
				getProgressHtml( details.runtime, stats, totalTests ),
				getAssertionsSummaryHtml( details.total, details.passed, details.failed ),
				getRerunFailedHtml( stats.failedTests )
			].filter( Boolean ).join( "<br />" ),
			test,
			assertLi,
			assertList;

		// Update remaining tests to aborted
		if ( abortButton && abortButton.disabled ) {
			html = "Tests aborted after " + details.runtime + " milliseconds.";

			for ( var i = 0; i < tests.children.length; i++ ) {
				test = tests.children[ i ];
				if ( test.className === "" || test.className === "running" ) {
					test.className = "aborted";
					assertList = test.getElementsByTagName( "ol" )[ 0 ];
					assertLi = document.createElement( "li" );
					assertLi.className = "fail";
					assertLi.innerHTML = "Test aborted.";
					assertList.appendChild( assertLi );
				}
			}
		}

		if ( banner && ( !abortButton || abortButton.disabled === false ) ) {
			banner.className = stats.failedTests.length ? "qunit-fail" : "qunit-pass";
		}

		if ( abortButton ) {
			abortButton.parentNode.removeChild( abortButton );
		}

		if ( tests ) {
			id( "qunit-testresult-display" ).innerHTML = html;
		}

		if ( config.altertitle && document.title ) {

			// Show ✖ for good, ✔ for bad suite result in title
			// use escape sequences in case file gets loaded with non-utf-8
			// charset
			document.title = [
				( stats.failedTests.length ? "\u2716" : "\u2714" ),
				document.title.replace( /^[\u2714\u2716] /i, "" )
			].join( " " );
		}

		// Scroll back to top to show results
		if ( config.scrolltop && window.scrollTo ) {
			window.scrollTo( 0, 0 );
		}
	} );

	function getNameHtml( name, module ) {
		var nameHtml = "";

		if ( module ) {
			nameHtml = "<span class='module-name'>" + escapeText( module ) + "</span>: ";
		}

		nameHtml += "<span class='test-name'>" + escapeText( name ) + "</span>";

		return nameHtml;
	}

	QUnit.testStart( function( details ) {
		var running, bad;

		appendTest( details.name, details.testId, details.module );

		running = id( "qunit-testresult-display" );

		if ( running ) {
			addClass( running, "running" );

			bad = QUnit.config.reorder && details.previousFailure;

			running.innerHTML = [
				bad ?
					"Rerunning previously failed test:" :
					"Running:",
				getNameHtml( details.name, details.module ),
				getProgressHtml( now() - config.started, stats, Test.count ),
				getRerunFailedHtml( stats.failedTests )
			].join( "<br />" );
		}

	} );

	function stripHtml( string ) {

		// Strip tags, html entity and whitespaces
		return string
			.replace( /<\/?[^>]+(>|$)/g, "" )
			.replace( /&quot;/g, "" )
			.replace( /\s+/g, "" );
	}

	QUnit.log( function( details ) {
		var assertList, assertLi,
			message, expected, actual, diff,
			showDiff = false,
			testItem = id( "qunit-test-output-" + details.testId );

		if ( !testItem ) {
			return;
		}

		message = escapeText( details.message ) || ( details.result ? "okay" : "failed" );
		message = "<span class='test-message'>" + message + "</span>";
		message += "<span class='runtime'>@ " + details.runtime + " ms</span>";

		// The pushFailure doesn't provide details.expected
		// when it calls, it's implicit to also not show expected and diff stuff
		// Also, we need to check details.expected existence, as it can exist and be undefined
		if ( !details.result && hasOwn.call( details, "expected" ) ) {
			if ( details.negative ) {
				expected = "NOT " + QUnit.dump.parse( details.expected );
			} else {
				expected = QUnit.dump.parse( details.expected );
			}

			actual = QUnit.dump.parse( details.actual );
			message += "<table><tr class='test-expected'><th>Expected: </th><td><pre>" +
			escapeText( expected ) +
			"</pre></td></tr>";

			if ( actual !== expected ) {

				message += "<tr class='test-actual'><th>Result: </th><td><pre>" +
					escapeText( actual ) + "</pre></td></tr>";

				if ( typeof details.actual === "number" && typeof details.expected === "number" ) {
					if ( !isNaN( details.actual ) && !isNaN( details.expected ) ) {
						showDiff = true;
						diff = ( details.actual - details.expected );
						diff = ( diff > 0 ? "+" : "" ) + diff;
					}
				} else if ( typeof details.actual !== "boolean" &&
							typeof details.expected !== "boolean" ) {
					diff = QUnit.diff( expected, actual );

					// don't show diff if there is zero overlap
					showDiff = stripHtml( diff ).length !==
						stripHtml( expected ).length +
						stripHtml( actual ).length;
				}

				if ( showDiff ) {
					message += "<tr class='test-diff'><th>Diff: </th><td><pre>" +
					diff + "</pre></td></tr>";
				}
			} else if ( expected.indexOf( "[object Array]" ) !== -1 ||
				expected.indexOf( "[object Object]" ) !== -1 ) {
				message += "<tr class='test-message'><th>Message: </th><td>" +
				"Diff suppressed as the depth of object is more than current max depth (" +
				QUnit.config.maxDepth + ").<p>Hint: Use <code>QUnit.dump.maxDepth</code> to " +
				" run with a higher max depth or <a href='" +
				escapeText( setUrl( { maxDepth: -1 } ) ) + "'>" +
				"Rerun</a> without max depth.</p></td></tr>";
			} else {
				message += "<tr class='test-message'><th>Message: </th><td>" +
				"Diff suppressed as the expected and actual results have an equivalent" +
				" serialization</td></tr>";
			}

			if ( details.source ) {
				message += "<tr class='test-source'><th>Source: </th><td><pre>" +
				escapeText( details.source ) + "</pre></td></tr>";
			}

			message += "</table>";

		// This occurs when pushFailure is set and we have an extracted stack trace
		} else if ( !details.result && details.source ) {
			message += "<table>" +
			"<tr class='test-source'><th>Source: </th><td><pre>" +
			escapeText( details.source ) + "</pre></td></tr>" +
			"</table>";
		}

		assertList = testItem.getElementsByTagName( "ol" )[ 0 ];

		assertLi = document.createElement( "li" );
		assertLi.className = details.result ? "pass" : "fail";
		assertLi.innerHTML = message;
		assertList.appendChild( assertLi );
	} );

	QUnit.testDone( function( details ) {
		var testTitle, time, assertList, status,
			good, bad, testCounts, skipped, sourceName,
			tests = id( "qunit-tests" ),
			testItem = id( "qunit-test-output-" + details.testId );

		if ( !tests || !testItem ) {
			return;
		}

		removeClass( testItem, "running" );

		if ( details.failed > 0 ) {
			status = "failed";
		} else if ( details.todo ) {
			status = "todo";
		} else {
			status = details.skipped ? "skipped" : "passed";
		}

		assertList = testItem.getElementsByTagName( "ol" )[ 0 ];

		good = details.passed;
		bad = details.failed;

		// This test passed if it has no unexpected failed assertions
		const testPassed = details.failed > 0 ? details.todo : !details.todo;

		if ( testPassed ) {

			// Collapse the passing tests
			addClass( assertList, "qunit-collapsed" );
		} else if ( config.collapse ) {
			if ( !collapseNext ) {

				// Skip collapsing the first failing test
				collapseNext = true;
			} else {

				// Collapse remaining tests
				addClass( assertList, "qunit-collapsed" );
			}
		}

		// The testItem.firstChild is the test name
		testTitle = testItem.firstChild;

		testCounts = bad ?
			"<b class='failed'>" + bad + "</b>, " + "<b class='passed'>" + good + "</b>, " :
			"";

		testTitle.innerHTML += " <b class='counts'>(" + testCounts +
		details.assertions.length + ")</b>";

		if ( details.skipped ) {
			stats.skippedTests++;

			testItem.className = "skipped";
			skipped = document.createElement( "em" );
			skipped.className = "qunit-skipped-label";
			skipped.innerHTML = "skipped";
			testItem.insertBefore( skipped, testTitle );
		} else {
			addEvent( testTitle, "click", function() {
				toggleClass( assertList, "qunit-collapsed" );
			} );

			testItem.className = testPassed ? "pass" : "fail";

			if ( details.todo ) {
				const todoLabel = document.createElement( "em" );
				todoLabel.className = "qunit-todo-label";
				todoLabel.innerHTML = "todo";
				testItem.className += " todo";
				testItem.insertBefore( todoLabel, testTitle );
			}

			time = document.createElement( "span" );
			time.className = "runtime";
			time.innerHTML = details.runtime + " ms";
			testItem.insertBefore( time, assertList );

			if ( !testPassed ) {
				stats.failedTests.push( details.testId );
			} else if ( details.todo ) {
				stats.todoTests++;
			} else {
				stats.passedTests++;
			}
		}

		// Show the source of the test when showing assertions
		if ( details.source ) {
			sourceName = document.createElement( "p" );
			sourceName.innerHTML = "<strong>Source: </strong>" + escapeText( details.source );
			addClass( sourceName, "qunit-source" );
			if ( testPassed ) {
				addClass( sourceName, "qunit-collapsed" );
			}
			addEvent( testTitle, "click", function() {
				toggleClass( sourceName, "qunit-collapsed" );
			} );
			testItem.appendChild( sourceName );
		}

		if ( config.hidepassed && ( status === "passed" || details.skipped ) ) {

			// use removeChild instead of remove because of support
			hiddenTests.push( testItem );

			tests.removeChild( testItem );
		}
	} );

	// Avoid readyState issue with phantomjs
	// Ref: #818
	var usingPhantom = ( function( p ) {
		return ( p && p.version && p.version.major > 0 );
	} )( window.phantom );

	if ( usingPhantom ) {
		console.warn( "Support for PhantomJS is deprecated and will be removed in QUnit 3.0." );
	}

	if ( !usingPhantom && document.readyState === "complete" ) {
		QUnit.load();
	} else {
		addEvent( window, "load", QUnit.load );
	}

	// Wrap window.onerror. We will call the original window.onerror to see if
	// the existing handler fully handles the error; if not, we will call the
	// QUnit.onError function.
	var originalWindowOnError = window.onerror;

	// Cover uncaught exceptions
	// Returning true will suppress the default browser handler,
	// returning false will let it run.
	window.onerror = function( message, fileName, lineNumber, columnNumber, errorObj, ...args ) {
		var ret = false;
		if ( originalWindowOnError ) {
			ret = originalWindowOnError.call(
				this,
				message,
				fileName,
				lineNumber,
				columnNumber,
				errorObj,
				...args
			);
		}

		// Treat return value as window.onerror itself does,
		// Only do our handling if not suppressed.
		if ( ret !== true ) {
			const error = {
				message,
				fileName,
				lineNumber
			};

			// According to
			// https://blog.sentry.io/2016/01/04/client-javascript-reporting-window-onerror,
			// most modern browsers support an errorObj argument; use that to
			// get a full stack trace if it's available.
			if ( errorObj && errorObj.stack ) {
				error.stacktrace = extractStacktrace( errorObj, 0 );
			}

			ret = QUnit.onError( error );
		}

		return ret;
	};

	window.addEventListener( "unhandledrejection", function( event ) {
		QUnit.onUncaughtException( event.reason );
	} );
}() );
