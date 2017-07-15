// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Specify how many lessons of each type you want to take.
// @version       1.0.0
// @include       *://www.wanikani.com/lesson/session*
// @grant         none
// ==/UserScript==

// Catch events on hide.
// http://viralpatel.net/blogs/jquery-trigger-custom-event-show-hide-element/
(function ($) {$.each(['hide'], function (i, ev) { var el = $.fn[ev]; $.fn[ev] = function () { this.trigger(ev); return el.apply(this, arguments); }; }); })(jQuery);

(function() {
	'use strict';

	var style =
		'<style>' +
			'#lf-main-outer { padding: 10px 0px; border: 1px solid black; }' +
			'.lf-title { font-size: 1.2em; font-weight: bold; }' +
			'.lf-filter-section { padding-top: 10px; }' +
			'.lf-center { text-align: center; }' +
			'.lf-input { width: 40px; }' +
			'#lf-apply-filter { border-radius: 6px; }' +
		'</style>';

	var html =
		'<div id="lf-main-outer" class="pure-g lf-center">' +
			'<div class="pure-u-1-3"></div>' +
			'<div id="lf-main" class="pure-u-1-3">' +
				'<div class="lf-title">Items to Learn</div>' +
				'<div class="pure-g">' +
					'<div class="pure-u-1-4"></div>' +
					'<div class="pure-u-1-8">Radicals</div>' +
					'<div class="pure-u-1-8">Kanji</div>' +
					'<div class="pure-u-1-8">Vocab</div>' +
					'<div class="pure-u-1-8">Shuffle?</div>' +
					'<div class="pure-u-1-4"></div>' +
				'</div>' +
				'<div class="pure-g">' +
					'<div class="pure-u-1-4"></div>' +
					'<div class="pure-u-1-8"><input id="lf-radicals" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input pure-input" /></div>' +
					'<div class="pure-u-1-8"><input id="lf-kanji" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input pure-input" /></div>' +
					'<div class="pure-u-1-8"><input id="lf-vocab" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input pure-input" /></div>' +
					'<div class="pure-u-1-8"><input id="lf-shuffle" type="checkbox" class="pure-checkbox" /></div>' +
					'<div class="pure-u-1-4"></div>' +
				'</div>' +
				'<div class="lf-filter-section">' +
					'<input type="button" value="Filter" id="lf-apply-filter" class="pure-button-small"></input>' +
				'</div>' +
			'</div>' +
			'<div class="pure-u-1-3"></div>' +
		'</div>';

	function setupUI() {
		$('head').append(style);
		$('#supplement-info').after(html);
		//$('#batch-items ul').before(html); // This version may avoid the issue with the 'fixed' class.
	}

	$('div[id*="loading"]:visible').on('hide', function() {
		setupUI();
	});

	$('.lf-js-apply-filter').on('click', function() {
		alert('test');
	});
})();