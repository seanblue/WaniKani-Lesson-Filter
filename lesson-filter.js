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

	var radicalsJStorageKey = 'l/count/rad';
	var kanjiJStorageKey = 'l/count/kan';
	var vocabJStorageKey = 'l/count/voc';

	var style =
		'<style>' +
			'#lf-main-outer { padding: 10px 0px; border: 1px solid black; }' +
			'.lf-title { font-size: 1.2em; font-weight: bold; }' +
			'.lf-filter-section { padding-top: 10px; }' +
			'.lf-center { text-align: center; }' +
			'.lf-input { width: 40px; }' +
			'#lf-apply-filter { border-radius: 6px; }' +
			'.lf-list { display: inline-block; list-style: none; border-radius: 6px; text-align: center; margin: 0px; padding: 0px; }' +
			'.lf-list-item { display: inline-block; list-style: none; border-radius: 6px; text-align: center; margin: 5px; padding: 5px 15px; }' +
			'.lf-list-item label, .lf-list-item input { display: block; }' +
		'</style>';

	var html =
		'<div id="lf-main-outer" class="pure-g lf-center">' +
			'<div class="pure-u-1-4"></div>' +
			'<div id="lf-main" class="pure-u-1-2">' +
				'<div class="lf-title">Items to Learn</div>' +
				'<ul class="lf-list">' +
					'<li class="lf-list-item"><label>Radicals</label><input id="lf-radicals" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input pure-input" /></li>' +
					'<li class="lf-list-item"><label>Kanji</label><input id="lf-kanji" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input pure-input" /></li>' +
					'<li class="lf-list-item"><label>Vocab</label><input id="lf-vocab" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input pure-input" /></li>' +
					'<li class="lf-list-item"><label>Shuffle?</label><input id="lf-shuffle" type="checkbox" class="pure-checkbox" /></li>' +
				'</ul>' +
				'<div class="lf-filter-section">' +
					'<input type="button" value="Filter" id="lf-apply-filter" class="pure-button-small"></input>' +
				'</div>' +
			'</div>' +
			'<div class="pure-u-1-4"></div>' +
		'</div>';

	function setupUI() {
		$('head').append(style);
		$('#supplement-info').after(html);
		//$('#batch-items ul').before(html); // This version may avoid the issue with the 'fixed' class.
	}

	function setupEvents() {
		$('#lf-apply-filter').on('click', function() {
			applyFilter();
		});
	}

	function applyFilter() {
		var filterCounts = getFilterCounts();

		// TODO: Apply filters.
	}

	function getFilterCounts() {
		return {
			'radicals': getFilterCount(radicalsJStorageKey, '#lf-radicals'),
			'kanji': getFilterCount(kanjiJStorageKey, '#lf-kanji'),
			'vocab': getFilterCount(vocabJStorageKey, '#lf-vocab'),
			'shuffle': getShuffleValue()
		};
	}

	function getFilterCount(jStorageKey, selector) {
		var currentCount = $.jStorage.get(jStorageKey);

		var el = $(selector);
		var rawValue = el.val();
		var value = parseInt(rawValue);
		
		if (isNaN(value) || value > currentCount)
			return currentCount;

		if (value < 0)
			return 0;

		return value;
	}

	function getShuffleValue() {
		var el = $('#lf-shuffle');
		return el.prop('checked');
	}

	$('div[id*="loading"]:visible').on('hide', function() {
		setupUI();
		setupEvents();
	});
})();