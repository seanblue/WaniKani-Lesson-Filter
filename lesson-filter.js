// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Filter your lessons by type, while maintaining WaniKani's lesson order.
// @author        seanblue
// @version       1.9.1
// @match        https://www.wanikani.com/subjects*
// @match        https://preview.wanikani.com/subjects*
// @grant         none
// ==/UserScript==

(async function(global) {
	'use strict';

	var wkofMinimumVersion = '1.1.0';

	if (!global.wkof) {
		var response = confirm('WaniKani Lesson Filter requires WaniKani Open Framework.\n Click "OK" to be forwarded to installation instructions.');

		if (response) {
			window.location.href = 'https://community.wanikani.com/t/instructions-installing-wanikani-open-framework/28549';
		}

		return;
	}

	if (!global.wkof.version || global.wkof.version.compare_to(wkofMinimumVersion) === 'older') {
		alert(`WaniKani Lesson Filter requires at least version ${wkofMinimumVersion} of WaniKani Open Framework.`);
		return;
	}


	const localStorageSettingsKey = 'lessonFilter_inputData';
	const localStorageSettingsVersion = 2;

	const radicalSubjectType = 'radical';
	const kanjiSubjectType = 'kanji';
	const vocabSubjectType = 'vocabulary';

	const batchSizeInputSelector = '#lf-batch-size';
	const radicalInputSelector = '#lf-radical';
	const kanjiInputSelector = '#lf-kanji';
	const vocabInputSelector = '#lf-vocab';

	const style =
		`<style>
			#lf-main { width: 100%; margin: 10px auto; padding: 10px 20px; border-radius: 6px; text-align: center; background-color: #444; color: #fff; }

			.lf-title { font-size: 1.6em; font-weight: bold; padding-bottom: 5px; }

			.lf-list { margin: 0px; padding: 0px; }
			.lf-list-item { display: inline-block; list-style: none; text-align: center; padding: 8px; }
			.lf-list-item input { display: block; width: 45px; color: #fff; border-width: 2px; border-style: inset; }
			.lf-list-item span { display: block; padding-bottom: 3px; }
			#lf-batch-size { background-color: #ff5500; }
			#lf-radical { background-color: #0af; }
			#lf-kanji { background-color: #f0a; }
			#lf-vocab { background-color: #a0f; }

			.lf-filter-section { padding-top: 10px; }
			.lf-filter-section input { font-size: 0.9em; margin: 0px 10px; padding: 3px; border-width: 2px; border-style: outset; border-radius: 6px; }
		</style>`;

	const html =
		`<div id="lf-main">
			<div class="lf-title">Items to Learn</div>
			<div class="lf-list">
				<div class="lf-list-item">
					<span lang="ja">バッチ</span>
					<input id="lf-batch-size" type="text" autocomplete="off" data-lpignore="true" maxlength="4" />
				</div>
				<div class="lf-list-item">
					<span lang="ja">部首</span>
					<input id="lf-radical" type="text" autocomplete="off" data-lpignore="true" maxlength="4" />
				</div>
				<div class="lf-list-item">
					<span lang="ja">漢字</span>
					<input id="lf-kanji" type="text" autocomplete="off" data-lpignore="true" maxlength="4" />
				</div>
				<div class="lf-list-item">
					<span lang="ja">単語</span>
					<input id="lf-vocab" type="text" autocomplete="off" data-lpignore="true" maxlength="4" />
				</div>
			</div>
			<div class="lf-filter-section">
				<input type="button" value="Filter" id="lf-apply-filter"></input>
				<input type="button" value="Shuffle" id="lf-apply-shuffle"></input>
			</div>
		</div>`;

	let queueInitializedPromise;

	let initialLessonQueue;
	let initialBatchSize;

	let currentLessonQueue;
	let currentBatchSize;

	async function initialize() {
		queueInitializedPromise = initializeLessonQueue();
		await queueInitializedPromise;
	}

	async function initializeLessonQueue() {
		global.wkof.include('Apiv2');
		await global.wkof.ready('Apiv2');

		let [ unsortedLessonQueue, userPreferences ] = await Promise.all([getUnsortedLessonQueue(), getUserPreferences()]);

		initialBatchSize = userPreferences.batchSize;
		initialLessonQueue = sortInitialLessonQueue(unsortedLessonQueue, userPreferences.lessonOrder);

		currentLessonQueue = [...initialLessonQueue];
		currentBatchSize = initialBatchSize;

		console.log(currentLessonQueue);

		return Promise.resolve('done');
	}

	async function getUnsortedLessonQueue() {
		let summary = await global.wkof.Apiv2.fetch_endpoint('summary');
		let lessonIds = summary.data.lessons.flatMap(l => l.subject_ids);

		let lessonData = await global.wkof.Apiv2.fetch_endpoint('subjects', { filters: { ids: lessonIds } });

		return lessonData.data.map(d => ({ id: d.id, level: d.data.level, subjectType: d.object, lessonPosition: d.data.lesson_position }));
	}

	async function getUserPreferences() {
		let response = await global.wkof.Apiv2.fetch_endpoint('user');
		return {
			batchSize: response.data.preferences.lessons_batch_size,
			lessonOrder: response.data.preferences.lessons_presentation_order
		};
	}

	function sortInitialLessonQueue(queue, lessonOrder) {
		let typeOrder = [radicalSubjectType, kanjiSubjectType, vocabSubjectType];

		if (lessonOrder === 'ascending_level_then_subject') {
			return queue.sort((a, b) => a.level - b.level || typeOrder.indexOf(a.subjectType) - typeOrder.indexOf(b.subjectType) || a.lessonPosition - b.lessonPosition);
		}

		shuffle(queue);

		if (lessonOrder === 'ascending_level_then_shuffled') {
			queue.sort((a, b) => a.level - b.level);
		}

		return queue;
	}

	async function setupUI() {
		if (!onLessonPage(window.location.pathname)) {
			return;
		}

		global.wkof.include('Jquery');

		await global.wkof.ready('Jquery');

		console.log($);


		$('head').append(style);
		$('.subject-queue__items').before(html);

		loadSavedInputData();
		setupEvents();
	}

	function onLessonPage(path) {
		return (/(\/?)subjects(\/\d+)\/lesson(\/?)/.test(path));
	}

	function loadSavedInputData() {
		let savedDataString = localStorage[localStorageSettingsKey];

		if (!savedDataString) {
			return;
		}

		let savedData = JSON.parse(savedDataString);

		if (savedData.version !== localStorageSettingsVersion) {
			delete localStorage[localStorageSettingsKey];
			return;
		}

		let data = savedData.data;
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
		let rawFilterValues = getRawFilterValuesFromUI();
		filterLessonsInternal(rawFilterValues);
		saveRawFilterValues(rawFilterValues);

		$(e.target).blur();
	}

	async function filterLessonsInternal(rawFilterValues) {
		await queueInitializedPromise;

		let newFilteredQueue = getFilteredQueue(rawFilterValues);

		if (newFilteredQueue.length === 0) {
			alert('You cannot remove all lessons');
			return;
		}

		currentLessonQueue = newFilteredQueue;

		let newBatchedSize = getCheckedBatchSize(rawFilterValues.batchSize);
		currentBatchSize = newBatchedSize;

		console.log(newFilteredQueue);
		console.log(newBatchedSize);

		visitUrlForCurrentBatch();
	}

	function getRawFilterValuesFromUI() {
		return {
			'batchSize': $(batchSizeInputSelector).val(),
			'radicals': $(radicalInputSelector).val(),
			'kanji': $(kanjiInputSelector).val(),
			'vocab': $(vocabInputSelector).val()
		};
	}

	function getFilteredQueue(rawFilterValues) {
		let idToIndex = { };

		for (let i = 0; i < currentLessonQueue.length; i++) {
			idToIndex[currentLessonQueue[i].id] = i;
		}

		let filteredRadicalQueue = getFilteredQueueForType(radicalSubjectType, rawFilterValues.radicals);
		let filteredKanjiQueue = getFilteredQueueForType(kanjiSubjectType, rawFilterValues.kanji);
		let filteredVocabQueue = getFilteredQueueForType(vocabSubjectType, rawFilterValues.vocab);

		return filteredRadicalQueue.concat(filteredKanjiQueue).concat(filteredVocabQueue).sort((a, b) => idToIndex[a.id] - idToIndex[b.id]);
	}

	function getFilteredQueueForType(subjectType, rawFilterValue) {
		let filterValue = parseInt(rawFilterValue);

		if (filterValue <= 0) {
			return [];
		}

		let queueForType = getQueueForType(subjectType);

		if (isNaN(filterValue)) {
			return queueForType;
		}

		return queueForType.slice(0, filterValue);
	}

	function getQueueForType(subjectType) {
		return currentLessonQueue.filter(item => item.subjectType === subjectType);
	}

	function getCheckedBatchSize(rawValue) {
		let value = parseInt(rawValue);

		if (isNaN(value)) {
			return currentBatchSize;
		}

		if (value < 0) {
			return 0;
		}

		return value;
	}

	function applyShuffle(e) {
		shuffleLessonsInternal();

		$(e.target).blur();
	}

	async function shuffleLessonsInternal() {
		await queueInitializedPromise;

		shuffle(currentLessonQueue);
		visitUrlForCurrentBatch();
	}

	function shuffle(array) {
		// https://stackoverflow.com/a/12646864
		// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
		for (let i = array.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			let temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
	}

	async function resetInternal() {
		await queueInitializedPromise;

		currentLessonQueue = initialLessonQueue;
		currentBatchSize = initialBatchSize;
		visitUrlForCurrentBatch();
	}

	function visitUrlForCurrentBatch() {
		if (currentLessonQueue.length === 0) {
			global.Turbo.visit(`/dashboard`);
		}

		let lessonBatchQueryParam = getCurrentLessonBatchIds().join('-');
		global.Turbo.visit(`/subjects/${currentLessonQueue[0].id}/lesson?queue=${lessonBatchQueryParam}`);
	}

	function getCurrentLessonBatchIds() {
		return currentLessonQueue.slice(0, currentBatchSize).map(item => item.id);
	}

	function saveRawFilterValues(rawFilterValues) {
		let settings = {
			'version': localStorageSettingsVersion,
			'data': rawFilterValues
		};

		localStorage[localStorageSettingsKey] = JSON.stringify(settings);
	}

	function disableWaniKaniKeyCommands(e) {
		e.stopPropagation();
	}

	function isNewBatchUrl(url) {
		return new URL(url).pathname === '/subjects/lesson';
	}

	function setsAreEqual(set1, set2) {
		return set1.size === set2.size && [...set1].every(v => set2.has(v));
	}

	window.addEventListener('turbo:before-visit', function(e) {
		if (isNewBatchUrl(e.detail.url)) {
			e.preventDefault();

			let currentLessonBatchIdSet = new Set(getCurrentLessonBatchIds());

			initialLessonQueue = initialLessonQueue.filter(item => !currentLessonBatchIdSet.has(item.id));
			currentLessonQueue = currentLessonQueue.filter(item => !currentLessonBatchIdSet.has(item.id));

			visitUrlForCurrentBatch();
		}
	});

	window.lessonFilter = Object.freeze({
		shuffle: () => {
			shuffleLessonsInternal()
		},
		filter: (radicalCount, kanjiCount, vocabCount, batchSize) => {
			let rawFilterValues = {
				'radicals': radicalCount,
				'kanji': kanjiCount,
				'vocab': vocabCount,
				'batchSize': batchSize
			};

			filterLessonsInternal(rawFilterValues);
		},
		reset: () => {
			resetInternal();
		}
	});

	setupUI();
	await initialize();
})(window);