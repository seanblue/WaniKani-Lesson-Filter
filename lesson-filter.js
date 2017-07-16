// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Specify how many lessons of each type you want to take.
// @version       0.1.0
// @include       *://www.wanikani.com/lesson/session*
// @grant         none
// ==/UserScript==

// Catch events on hide.
// http://viralpatel.net/blogs/jquery-trigger-custom-event-show-hide-element/
(function ($) {$.each(['hide'], function (i, ev) { var el = $.fn[ev]; $.fn[ev] = function () { this.trigger(ev); return el.apply(this, arguments); }; }); })(jQuery);

(function() {
	'use strict';

	var activeQueueKey = 'l/activeQueue';
	var inactiveQueueKey = 'l/lessonQueue';
	var batchSizeKey = 'l/batchSize';
	var radicalCountKey = 'l/count/rad';
	var kanjiCountKey = 'l/count/kan';
	var vocabCountKey = 'l/count/voc';

	var style =
		'<style>' +
			'#lf-main { padding: 10px 0px; border-radius: 6px; margin: 5px; text-align: center; font-size: 0.8em; background-color: #444; color: #fff; }' +
			'#lf-main input:focus { outline: none; }' +
			'.lf-title { font-size: 1.5em; font-weight: bold; }' +
			'.lf-filter-section { padding-top: 10px; }' +
			'.lf-input { width: 40px; color: #fff; }' +
			'.lf-filter-button { border-radius: 6px; margin: 0px 10px; }' +
			'.lf-list { margin: 0px; padding: 0px; }' +
			'.lf-list-item { display: inline-block; list-style: none; border-radius: 6px; text-align: center; padding: 5px 10px; }' +
			'.lf-list-item span, .lf-list-item input { display: block; }' +
		'</style>';

	var html =
		'<div id="lf-main"">' +
			'<div class="lf-title">Items to Learn</div>' +
			'<div class="lf-list">' +
				'<div class="lf-list-item">' +
					'<span lang="ja">部首</span>' +
					'<input id="lf-radicals" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input radical" />' +
				'</div>' +
				'<div class="lf-list-item">' +
					'<span lang="ja">漢字</span>' +
					'<input id="lf-kanji" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input kanji" />' +
				'</div>' +
				'<div class="lf-list-item">' +
					'<span lang="ja">単語</span>' +
					'<input id="lf-vocab" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input vocabulary" />' +
				'</div>' +
			'</div>' +
			'<div class="lf-filter-section">' +
				'<input type="button" value="Filter" id="lf-apply-filter" class="lf-filter-button"></input>' +
				'<input type="button" value="Filter and Shuffle" id="lf-apply-filter-and-shuffle" class="lf-filter-button"></input>' +
			'</div>' +
		'</div>';

	function setupUI() {
		$('head').append(style);
		$('#supplement-info').after(html);
		//$('#batch-items ul').before(html); // This version may avoid the issue with the 'fixed' class.
	}

	function setupEvents() {
		$('#lf-apply-filter').on('click', applyFilter);
	}

	function applyFilter() {
		var filterCounts = getFilterCounts();

		if (filterCounts.nolessons) {
			alert('You cannot remove all lessons');
			return;
		}

		var queue = getWaniKaniData(activeQueueKey).concat(getWaniKaniData(inactiveQueueKey));
		filterQueue(queue, filterCounts);

		var batchSize = getWaniKaniData(batchSizeKey);
		var activeQueue = queue.slice(0, batchSize);
		var inactiveQueue = queue.slice(batchSize);

		updateQueue(activeQueue, inactiveQueue);
		updateCounts(filterCounts);
	}

	function getFilterCounts() {
		var radicalCount = getFilterCount(radicalCountKey, '#lf-radicals');
		var kanjiCount = getFilterCount(kanjiCountKey, '#lf-kanji');
		var vocabCount = getFilterCount(vocabCountKey, '#lf-vocab');

		return {
			'radicals': radicalCount,
			'kanji': kanjiCount,
			'vocab': vocabCount,
			'nolessons': radicalCount === 0 && kanjiCount === 0 && vocabCount === 0
		};
	}

	function getFilterCount(key, selector) {
		var currentCount = getWaniKaniData(key);

		var el = $(selector);
		var rawValue = el.val();
		var value = parseInt(rawValue);

		if (isNaN(value) || value > currentCount)
			return currentCount;

		if (value < 0)
			return 0;

		return value;
	}

	function filterQueue(queue, filterCounts) {
		filterQueueForType(queue, 'rad', filterCounts.radicals);
		filterQueueForType(queue, 'kan', filterCounts.kanji);
		filterQueueForType(queue, 'voc', filterCounts.vocab);
	}

	function filterQueueForType(queue, typePropertyName, itemsToKeep) {
		var i;
		var itemsKept = 0;
		for (i = 0; i < queue.length; i++) {
			if (!queue[i][typePropertyName]) {
				continue;
			}

			if (itemsKept < itemsToKeep) {
				itemsKept++;
				continue;
			}

			queue.splice(i, 1);
			i--;
		}
	}

	function updateQueue(activeQueue, inactiveQueue) {
		// Must update the inactive queue after the active queue to get the UI to update properly.
		setWaniKaniData(activeQueueKey, activeQueue);
		setWaniKaniData(inactiveQueueKey, inactiveQueue);
	}

	function updateCounts(filterCounts) {
		setWaniKaniData(radicalCountKey, filterCounts.radicals);
		setWaniKaniData(kanjiCountKey, filterCounts.kanji);
		setWaniKaniData(vocabCountKey, filterCounts.vocab);
	}

	function getWaniKaniData(key) {
		return $.jStorage.get(key);
	}

	function setWaniKaniData(key, value) {
		return $.jStorage.set(key, value);
	}

	$('div[id*="loading"]:visible').on('hide', function() {
		setupUI();
		setupEvents();
	});
})();