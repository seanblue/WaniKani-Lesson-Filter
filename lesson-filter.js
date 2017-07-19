// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Specify how many lessons of each type you want to take.
// @version       0.1.0
// @include       *://www.wanikani.com/lesson/session*
// @grant         none
// ==/UserScript==

// Catch additional events.
// http://viralpatel.net/blogs/jquery-trigger-custom-event-show-hide-element/
(function($) {$.each(['hide'], function(i, ev) { var el = $.fn[ev]; $.fn[ev] = function() { this.trigger(ev); return el.apply(this, arguments); }; }); })(jQuery);

(function() {
	'use strict';

	var classAddedEvent = 'lessonFilter.classAdded';
	var propModifiedEvent = 'lessonFilter.propModified';
	var queueUpdatedEvent = 'lessonFilter.queueUpdated';

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
			'.lf-button { border-radius: 6px; margin: 0px 10px; }' +
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
				'<input type="button" value="Filter" id="lf-apply-filter" class="lf-button"></input>' +
				'<input type="button" value="Shuffle" id="lf-apply-shuffle" class="lf-button"></input>' +
			'</div>' +
		'</div>';

	function addEventTriggers() {
		setEventToTrigger('addClass', classAddedEvent);
		setEventToTrigger('prop', propModifiedEvent);
	}

	function setupUI() {
		$('head').append(style);
		$('#supplement-info').after(html);
	}

	function setupEvents() {
		$('#lf-apply-filter').on('click', applyFilter);
		$('#lf-apply-shuffle').on('click', applyShuffle);
		$('#lf-main').on('keydown, keypress, keyup', '.lf-input', disableWaniKaniKeyCommands);

		$(document).on(classAddedEvent, '#batch-items.fixed', fixBatchItemsOverlay);
		$(document).on(propModifiedEvent, '#lf-main input:disabled', enableInputs);
	}

	function applyFilter() {
		var filterCounts = getFilterCounts();

		if (filterCounts.nolessons) {
			alert('You cannot remove all lessons');
			return;
		}

		var queue = getQueue();
		filterQueue(queue, filterCounts);

		updateQueue(queue);
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

	function applyShuffle() {
		var queue = getQueue();
		shuffle(queue);
		updateQueue(queue);
	}

	function shuffle(array) {
		// https://stackoverflow.com/a/12646864
		// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
	}

	function getQueue() {
		return getWaniKaniData(activeQueueKey).concat(getWaniKaniData(inactiveQueueKey));
	}

	function updateQueue(queue) {
		var batchSize = getWaniKaniData(batchSizeKey);
		var activeQueue = queue.slice(0, batchSize);
		var inactiveQueue = queue.slice(batchSize);

		// Must update the inactive queue after the active queue to get the UI to update properly.
		setWaniKaniData(activeQueueKey, activeQueue);
		setWaniKaniData(inactiveQueueKey, inactiveQueue);

		$('#batch-items li:first').click();

		$(document).trigger(queueUpdatedEvent);
	}

	function updateCounts(filterCounts) {
		setWaniKaniData(radicalCountKey, filterCounts.radicals);
		setWaniKaniData(kanjiCountKey, filterCounts.kanji);
		setWaniKaniData(vocabCountKey, filterCounts.vocab);
	}

	function disableWaniKaniKeyCommands(e) {
		e.stopPropagation();
	}

	function getWaniKaniData(key) {
		return $.jStorage.get(key);
	}

	function setWaniKaniData(key, value) {
		return $.jStorage.set(key, value);
	}

	// https://stackoverflow.com/a/14084869
	function setEventToTrigger(jQueryMethodName, eventName) {
		var originalMethod = $.fn[jQueryMethodName];

		$.fn[jQueryMethodName] = function() {
			var result = originalMethod.apply(this, arguments);
			$(this).trigger(eventName);

			return result;
		};
	}

	function fixBatchItemsOverlay(e) {
		$(e.currentTarget).removeClass('fixed');
	}

	function enableInputs(e) {
		$(e.currentTarget).prop('disabled', false);
	}

	$('#loading-screen:visible').on('hide', function() {
		addEventTriggers();
		setupUI();
		setupEvents();
	});
})();