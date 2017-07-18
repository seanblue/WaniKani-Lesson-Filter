// ==UserScript==
// @name          WaniKani Fix Lesson Batch Overlay
// @namespace     https://www.wanikani.com
// @description   When using lesson reorder/filter scripts, the batch items sometimes overlay the script's UI. This script fixes that issue.
// @version       1.0.0
// @include       *://www.wanikani.com/lesson/session*
// @grant         none
// ==/UserScript==

// Catch additional events.
// http://viralpatel.net/blogs/jquery-trigger-custom-event-show-hide-element/
(function ($) {$.each(['addClass'], function (i, ev) { var el = $.fn[ev]; $.fn[ev] = function () { this.trigger(ev); return el.apply(this, arguments); }; }); })(jQuery);

(function() {
    'use strict';

	var classAddedEvent = 'fixLessonBatch.classAdded';

	// https://stackoverflow.com/a/14084869
	function setClassAddedEventToTrigger() {
		var originalAddClassMethod = $.fn.addClass;

		$.fn.addClass = function() {
			var result = originalAddClassMethod.apply(this, arguments);
			$(this).trigger(classAddedEvent);

			return result;
		};
	}

	function fixBatchItemsOverlay(e) {
		$(e.currentTarget).removeClass('fixed');
	}

    setClassAddedEventToTrigger();
	$(document).on(classAddedEvent, '#batch-items', fixBatchItemsOverlay);
})();