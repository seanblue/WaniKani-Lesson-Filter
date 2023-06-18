// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Filter your lessons by type, while maintaining WaniKani's lesson order.
// @author        seanblue
// @version       2.1.1
// @match         https://www.wanikani.com/subjects*
// @match         https://preview.wanikani.com/subjects*
// @match         https://www.wanikani.com
// @match         https://www.wanikani.com/dashboard
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

	const settingsScriptId = 'lesson_filter';
	const localStorageSettingsKey = 'lessonFilter_inputData';
	const localStorageSettingsVersion = 2;

	const radicalSubjectType = 'radical';
	const kanjiSubjectType = 'kanji';
	const vocabSubjectType = 'vocabulary';
	const kanaVocabSubjectType = 'kana_vocabulary';

	const batchSizeInputSelector = '#lf-batch-size';
	const radicalInputSelector = '#lf-radical';
	const kanjiInputSelector = '#lf-kanji';
	const vocabInputSelector = '#lf-vocab';

	const radicalCountSelector = '.subject-statistic-counts__item-count-text[data-category="Radical"]';
	const kanjiCountSelector = '.subject-statistic-counts__item-count-text[data-category="Kanji"]';
	const vocabCountSelector = '.subject-statistic-counts__item-count-text[data-category="Vocabulary"]';

	const pagesEnum = {
		lessonPage: 'lesson',
		quizPage: 'quiz',
		dashboard: 'dashboard',
		other: 'other'
	};

	const wkofSettingsEnum = {
		removeKanaVocab: 'remove_kana_vocab'
	};

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

	let wkofSettingsLoadedPromise;
	let queueInitializedPromise;

	let initialLessonQueue;
	let initialBatchSize;

	let currentLessonQueue;
	let currentBatchSize;

	async function handleInitialPageLoad() {
		let pageOnInitialLoad = getPage();

		if (pageOnInitialLoad === pagesEnum.dashboard) {
			global.wkof.include('Settings, Menu');
			let wkofSettingsDialog = await loadWkofSettings();
			await addMenuOptions(wkofSettingsDialog);
		}
		else {
			global.wkof.include('Apiv2, Settings, Menu');

			initializeLessonQueue();
			setupStyles(document.head);
			setupUI(document.body);
		}
	}

	async function addMenuOptions(wkofSettingsDialog) {
		await global.wkof.ready('Menu');

		global.wkof.Menu.insert_script_link({
			name: settingsScriptId,
			submenu: 'Settings',
			title: 'Lesson Filter',
			on_click: function() { wkofSettingsDialog.open(); }
		});
	}

	function initializeLessonQueue() {
		queueInitializedPromise = new Promise(async (resolve, reject) => {
			let [ unsortedLessonQueue, userPreferences, wkofSettings ] = await Promise.all([getUnsortedLessonQueue(), getUserPreferences(), getWkofSettings()]);

			initialBatchSize = userPreferences.batchSize;
			initialLessonQueue = sortInitialLessonQueue(unsortedLessonQueue, userPreferences.lessonOrder);

			currentLessonQueue = filterInitialQueueBasedOnWkofSettings(wkofSettings);
			currentBatchSize = initialBatchSize;

			visitUrlForCurrentBatch();

			resolve('done');
		});
	}

	function filterInitialQueueBasedOnWkofSettings(wkofSettings) {
		if (wkofSettings[wkofSettingsEnum.removeKanaVocab]) {
			return initialLessonQueue.filter(item => item.subjectType !== kanaVocabSubjectType);
		}

		return [...initialLessonQueue];
	}

	async function getUnsortedLessonQueue() {
		await global.wkof.ready('Apiv2');
		let summary = await global.wkof.Apiv2.fetch_endpoint('summary');
		let lessonIds = summary.data.lessons.flatMap(l => l.subject_ids);

		let lessonData = await global.wkof.Apiv2.fetch_endpoint('subjects', { filters: { ids: lessonIds } });

		return lessonData.data.map(d => ({ id: d.id, level: d.data.level, subjectType: d.object, lessonPosition: d.data.lesson_position, slug: d.data.slug }));
	}

	async function getUserPreferences() {
		await global.wkof.ready('Apiv2');
		let response = await global.wkof.Apiv2.fetch_endpoint('user');
		return {
			batchSize: response.data.preferences.lessons_batch_size,
			lessonOrder: response.data.preferences.lessons_presentation_order
		};
	}

	function loadWkofSettings() {
		return new Promise(async (resolve, reject) => {
			await global.wkof.ready('Settings');

			let settings = {
				[wkofSettingsEnum.removeKanaVocab]: { type: 'checkbox', label: 'Remove All Kana Vocab?', hover_tip: 'Select if you want to remove all kana vocab from the lesson queue' }
			};

			let defaultSettings = {
				[wkofSettingsEnum.removeKanaVocab]: false
			};

			let wkofSettingsDialog = new global.wkof.Settings({
				script_id: settingsScriptId,
				title: 'Lesson Filter',
				on_save: () => console.log('updated'),
				content: settings
			});

			await wkofSettingsDialog.load(defaultSettings);

			resolve(wkofSettingsDialog);
		});
	}

	async function getWkofSettings() {
		await loadWkofSettings();
		return global.wkof.settings[settingsScriptId];
	}

	function sortInitialLessonQueue(queue, lessonOrder) {
		let typeOrder = {
			[radicalSubjectType]: 0,
			[kanjiSubjectType]: 1,
			[vocabSubjectType]: 2,
			[kanaVocabSubjectType]: 2
		};

		if (lessonOrder === 'ascending_level_then_subject') {
			return queue.sort((a, b) => a.level - b.level || typeOrder[a.subjectType] - typeOrder[b.subjectType] || a.lessonPosition - b.lessonPosition);
		}

		shuffle(queue);

		if (lessonOrder === 'ascending_level_then_shuffled') {
			queue.sort((a, b) => a.level - b.level);
		}

		return queue;
	}

	function setupStyles(head) {
		head.insertAdjacentHTML('beforeend', style);
	}

	async function setupUI(body) {
		await queueInitializedPromise;

		let page = getPage();
		if (page === pagesEnum.lessonPage || page === pagesEnum.quizPage) {
			updateItemCountsInUI(body);
		}

		if (page !== pagesEnum.lessonPage) {
			return;
		}

		let existingLessonFilterSection = body.querySelector('#lf-main');
		if (existingLessonFilterSection) {
			return;
		}

		let queueItemsSection = body.querySelector('.subject-queue__items');
		if (!queueItemsSection) {
			return;
		}

		queueItemsSection.insertAdjacentHTML('beforeend', html);

		loadSavedInputData(body);
		setupEvents(body);
	}

	function loadSavedInputData(body) {
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
		body.querySelector(batchSizeInputSelector).value = data.batchSize;
		body.querySelector(radicalInputSelector).value = data.radicals;
		body.querySelector(kanjiInputSelector).value = data.kanji;
		body.querySelector(vocabInputSelector).value = data.vocab;
	}

	function updateItemCountsInUI(body) {
		var lessonQueueByType = getLessonQueueByType(currentLessonQueue);

		updateItemCountInUI(body, radicalCountSelector, lessonQueueByType[radicalSubjectType]);
		updateItemCountInUI(body, kanjiCountSelector, lessonQueueByType[kanjiSubjectType]);
		updateItemCountInUI(body, vocabCountSelector, lessonQueueByType[vocabSubjectType]);
	}

	function updateItemCountInUI(body, selector, queueForType) {
		let lessonQueueByType = getLessonQueueByType(currentLessonQueue);

		let el = body.querySelector(selector);
		if (el) {
			el.innerText = queueForType.length;
		}
	}

	function setupEvents(body) {
		body.querySelector('#lf-apply-filter').addEventListener('click', applyFilter);
		body.querySelector('#lf-apply-shuffle').addEventListener('click', applyShuffle);
	}

	function applyFilter(e) {
		let rawFilterValues = getRawFilterValuesFromUI(document);
		filterLessonsInternal(rawFilterValues);
		saveRawFilterValues(rawFilterValues);
	}

	async function filterLessonsInternal(rawFilterValues) {
		await queueInitializedPromise;

		let newFilteredQueue = getFilteredQueue(rawFilterValues);

		if (newFilteredQueue.length === 0) {
			alert('You cannot remove all lessons');
			return;
		}

		currentLessonQueue = newFilteredQueue;
		currentBatchSize = getCheckedBatchSize(rawFilterValues.batchSize);

		visitUrlForCurrentBatch();
	}
	function getRawFilterValuesFromUI(body) {
		return {
			'batchSize': body.querySelector(batchSizeInputSelector).value,
			'radicals': body.querySelector(radicalInputSelector).value,
			'kanji': body.querySelector(kanjiInputSelector).value,
			'vocab': body.querySelector(vocabInputSelector).value
		};
	}

	function getFilteredQueue(rawFilterValues) {
		let idToIndex = { };

		let filteredInitialLessonQueue = filterInitialQueueBasedOnWkofSettings(initialLessonQueue);

		for (let i = 0; i < filteredInitialLessonQueue.length; i++) {
			idToIndex[filteredInitialLessonQueue[i].id] = i;
		}

		var lessonQueueByType = getLessonQueueByType(filteredInitialLessonQueue);

		let filteredRadicalQueue = getFilteredQueueForType(lessonQueueByType[radicalSubjectType], rawFilterValues.radicals);
		let filteredKanjiQueue = getFilteredQueueForType(lessonQueueByType[kanjiSubjectType], rawFilterValues.kanji);
		let filteredVocabQueue = getFilteredQueueForType(lessonQueueByType[vocabSubjectType], rawFilterValues.vocab);

		return filteredRadicalQueue.concat(filteredKanjiQueue).concat(filteredVocabQueue).sort((a, b) => idToIndex[a.id] - idToIndex[b.id]);
	}

	function getLessonQueueByType(lessonQueue) {
		return {
			[radicalSubjectType]: getQueueForType(lessonQueue, [radicalSubjectType]),
			[kanjiSubjectType]: getQueueForType(lessonQueue, [kanjiSubjectType]),
			[vocabSubjectType]: getQueueForType(lessonQueue, [vocabSubjectType, kanaVocabSubjectType])
		};
	}

	function getQueueForType(lessonQueue, subjectTypes) {
		return lessonQueue.filter(item => subjectTypes.includes(item.subjectType));
	}

	function getFilteredQueueForType(queueForType, rawFilterValue) {
		let filterValue = parseInt(rawFilterValue);

		if (filterValue <= 0) {
			return [];
		}

		if (isNaN(filterValue)) {
			return queueForType;
		}

		return queueForType.slice(0, filterValue);
	}

	function getCheckedBatchSize(rawValue) {
		let value = parseInt(rawValue);

		if (isNaN(value)) {
			return initialBatchSize;
		}

		if (value < 1) {
			return 1;
		}

		return value;
	}

	function applyShuffle(e) {
		shuffleLessonsInternal();
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

	function visitUrlForCurrentBatch() {
		if (currentLessonQueue.length === 0) {
			global.Turbo.visit('/dashboard');
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

	function isNewBatchUrl(url) {
		return new URL(url).pathname === '/subjects/lesson';
	}

	function getPage() {
		let pathname = window.location.pathname;

		if (pathname === '/' || pathname === '/dashboard') {
			return pagesEnum.dashboard;
		}

		if ((/(\/?)subjects(\/\d+)\/lesson(\/?)/.test(pathname))) {
			return pagesEnum.lessonPage;
		}

		if ((/(\/?)subjects(\/\d+)\/quiz(\/?)/.test(pathname))) {
			return pagesEnum.quizPage;
		}

		return pagesEnum.other;
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

	window.addEventListener('turbo:before-render', function(e) {
		e.preventDefault();
		setupUI(e.detail.newBody);
		e.detail.resume();
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
		}
	});

	handleInitialPageLoad();
})(window);