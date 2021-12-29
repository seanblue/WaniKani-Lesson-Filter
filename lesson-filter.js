// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Filter your lessons by type, while maintaining WaniKani's lesson order.
// @author        seanblue
// @version       1.2.4
// @include       *://www.wanikani.com/lesson/session*
// @grant         none
// ==/UserScript==

const eventPrefix = 'seanblue.lessonfilter.';

// Catch additional events.
// http://viralpatel.net/blogs/jquery-trigger-custom-event-show-hide-element/
(function($) {$.each(['hide'], function(i, ev) { var el = $.fn[ev]; $.fn[ev] = function() { this.trigger(eventPrefix + ev); return el.apply(this, arguments); }; }); })(jQuery);

(function() {
	'use strict';

	var localStorageSettingsKey = 'lessonFilter_inputData';
	var localStorageSettingsVersion = 2;

	var propModifiedEvent = 'lessonFilter.propModified';
	var queueUpdatedEvent = 'lessonFilter.queueUpdated';

	var activeQueueKey = 'l/activeQueue';
	var inactiveQueueKey = 'l/lessonQueue';
	var batchSizeKey = 'l/batchSize';
	var radicalCountKey = 'l/count/rad';
	var kanjiCountKey = 'l/count/kan';
	var vocabCountKey = 'l/count/voc';

	var batchSizeInputSelector = '#lf-batch-size';
	var radicalInputSelector = '#lf-radicals';
	var kanjiInputSelector = '#lf-kanji';
	var vocabInputSelector = '#lf-vocab';

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
			'.lf-nofixed { position: inherit !important; bottom: inherit !important; width: inherit !important; }' +
			'.lf-batch-size { background-color: #ff5500; }' +
		'</style>';

	var html =
		'<div id="lf-main"">' +
			'<div class="lf-title">Items to Learn</div>' +
			'<div class="lf-list">' +
				'<div class="lf-list-item">' +
					'<span lang="ja">バッチ</span>' +
					'<input id="lf-batch-size" type="text" autocomplete="off" data-lpignore="true" maxlength="4" class="lf-input lf-batch-size" />' +
				'</div>' +
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

	function setupUI() {
		$('#batch-items').addClass('lf-nofixed');
		$('head').append(style);
		$('#supplement-info').after(html);

		loadSavedInputData();
	}

	function loadSavedInputData() {
		var savedDataString = localStorage[localStorageSettingsKey];

		if (!savedDataString) {
			return;
		}

		var savedData = JSON.parse(savedDataString);

		if (savedData.version !== localStorageSettingsVersion) {
			delete localStorage[localStorageSettingsKey];
			return;
		}

		var data = savedData.data;
		$(batchSizeInputSelector).val(data.batchSize);
		$(radicalInputSelector).val(data.radicals);
		$(kanjiInputSelector).val(data.kanji);
		$(vocabInputSelector).val(data.vocab);
	}

	function setupEvents() {
		$('#lf-apply-filter').on('click', applyFilter);
		$('#lf-apply-shuffle').on('click', applyShuffle);
		$('#lf-main').on('keydown, keypress, keyup', '.lf-input', disableWaniKaniKeyCommands);
	}

	function applyFilter(e) {
		var rawFilterValues = getRawFilterValues();
		var filterCounts = getFilterCounts(rawFilterValues);

		if (filterCounts.nolessons) {
			alert('You cannot remove all lessons');
			return;
		}

		updateBatchSize(filterCounts.batchSize);

		var queue = getQueue();
		filterQueue(queue, filterCounts);

		updateQueue(queue);
		updateCounts(filterCounts);
		saveRawFilterValues(rawFilterValues);

		$(e.target).blur();
	}

	function getRawFilterValues() {
		return {
			'batchSize': $(batchSizeInputSelector).val(),
			'radicals': $(radicalInputSelector).val(),
			'kanji': $(kanjiInputSelector).val(),
			'vocab': $(vocabInputSelector).val()
		};
	}

	function getFilterCounts(rawFilterValues) {
		var radicalCount = getFilterCount(radicalCountKey, rawFilterValues.radicals);
		var kanjiCount = getFilterCount(kanjiCountKey, rawFilterValues.kanji);
		var vocabCount = getFilterCount(vocabCountKey, rawFilterValues.vocab);
		var checkedBatchSize = getCheckedBatchSize(rawFilterValues.batchSize);

		return {
			'radicals': radicalCount,
			'kanji': kanjiCount,
			'vocab': vocabCount,
			'batchSize': checkedBatchSize,
			'nolessons': (radicalCount === 0 && kanjiCount === 0 && vocabCount === 0) || (checkedBatchSize === 0)
		};
	}

	function getFilterCount(key, rawValue) {
		var currentCount = getWaniKaniData(key);
		var value = parseInt(rawValue);

		if (isNaN(value) || value > currentCount) {
			return currentCount;
		}

		if (value < 0) {
			return 0;
		}

		return value;
	}

	function getCheckedBatchSize(rawValue) {
		var currentCount = getWaniKaniData(batchSizeKey);
		var value = parseInt(rawValue);

		if (isNaN(value)) {
			return currentCount;
		}

		if (value < 0) {
			return 0;
		}

		return value;
	}

	function updateBatchSize(batchSize) {
		setWaniKaniData(batchSizeKey, batchSize);
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
			if (queue[i][typePropertyName] === undefined) {
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

	function applyShuffle(e) {
		var queue = getQueue();
		shuffle(queue);
		updateQueue(queue);

		$(e.target).blur();
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

		// Script compatibility mode: ON (as of v4.0.0)
		$('#batch-items li:first').click();

		// Script compatibility mode: OFF
		$('[data-testid="batchList"] li:first button').click();

		$(document).trigger(queueUpdatedEvent);
	}

	function updateCounts(filterCounts) {
		setWaniKaniData(radicalCountKey, filterCounts.radicals);
		setWaniKaniData(kanjiCountKey, filterCounts.kanji);
		setWaniKaniData(vocabCountKey, filterCounts.vocab);
	}

	function saveRawFilterValues(rawFilterValues) {
		var settings = {
			'version': localStorageSettingsVersion,
			'data': rawFilterValues
		};

		localStorage[localStorageSettingsKey] = JSON.stringify(settings);
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

	function enableInputs(e) {
		$(e.currentTarget).prop('disabled', false);
	}

	(function() {
		setEventToTrigger('prop', propModifiedEvent);

		$(document).on(propModifiedEvent, '#lf-main input:disabled', enableInputs);

		$('#loading-screen:visible').on(eventPrefix + 'hide', function() {
			setupUI();
			setupEvents();
		});
	})();
})();