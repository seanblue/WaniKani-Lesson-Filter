// ==UserScript==
// @name          WaniKani Lesson Filter
// @namespace     https://www.wanikani.com
// @description   Filter your lessons by type, while maintaining WaniKani's lesson order.
// @author        seanblue
// @version       2.2.0
// @match         https://www.wanikani.com/subject-lessons*
// @match         https://preview.wanikani.com/subject-lessons*
// @grant         none
// ==/UserScript==

(async function(global) {
	'use strict';

	var wkofMinimumVersion = '1.1.8';

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
	const kanaVocabSubjectType = 'kana_vocabulary';

	const batchSizeInputSelector = '#lf-batch-size';
	const radicalInputSelector = '#lf-radical';
	const kanjiInputSelector = '#lf-kanji';
	const vocabInputSelector = '#lf-vocab';

	const radicalCountSelector = '.subject-statistic-counts__item-count-text[data-category="Radical"]';
	const kanjiCountSelector = '.subject-statistic-counts__item-count-text[data-category="Kanji"]';
	const vocabCountSelector = '.subject-statistic-counts__item-count-text[data-category="Vocabulary"]';

	const pages = {
		lessonPage: 'lesson',
		quizPage: 'quiz',
		other: 'other'
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

	let queueInitializedPromise;

	let initialLessonQueue;
	let initialBatchSize;

	let currentLessonQueue;
	let currentBatchSize;

    let modifiedLessonStart = false; // flag to notify that lessonQuiz => next lesson batch visit was already modified and should not be modified again (and again, and again, ...)

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

		return Promise.resolve('done');
	}

	async function getUnsortedLessonQueue() {
		let summary = await global.wkof.Apiv2.fetch_endpoint('summary');
		let lessonIds = summary.data.lessons.flatMap(l => l.subject_ids);

		let lessonData = await global.wkof.Apiv2.fetch_endpoint('subjects', { filters: { ids: lessonIds } });

		return lessonData.data.map(d => ({ id: d.id, level: d.data.level, subjectType: d.object, characters: d.data.characters, readings: d.data.readings, slug: d.data.slug, lessonPosition: d.data.lesson_position }));
	}

	async function getUserPreferences() {
		let response = await global.wkof.Apiv2.fetch_endpoint('user');
		return {
			batchSize: response.data.preferences.lessons_batch_size,
			lessonOrder: response.data.preferences.lessons_presentation_order
		};
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

	function setupUI(body) {
		let page = getPage(window.location);
		if (page === pages.lessonPage || page === pages.quizPage) {
			updateItemCountsInUI(body);
		}

		if (page !== pages.lessonPage) {
			return;
		}

        // modify the batch at the bottom of the lesson page
        if (currentLessonQueue) {
            modifyLessonPageBatch(currentIdFromLessonUrl(document.URL), currentLessonQueue.slice(0, currentBatchSize), body, document.URL);
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

    // function taken and modified from Wanikani Queue Manipulator by Sinyaven under MIT license
    function modifyLessonPageBatch(currentId, batch, body, url) {
		let currentIdIndex = batch.findIndex(b => b.id === currentId);
		let quizLink = `quiz?queue=${batch.map(q => q.id).join(`-`)}`;
		body.querySelector(`.subject-slide__navigation[data-subject-slides-target="prevButton"]`).href = url.replace(/\/\d+$/, `/${batch[Math.max(0, currentIdIndex - 1)].id}`);
		[...body.querySelectorAll(`.subject-slide__navigation[data-subject-slides-target="nextButton"]`)].pop().href = url.replace(/\/\d+$/, `/${batch[currentIdIndex + 1]?.id ?? quizLink}`);
		body.querySelectorAll(`.subject-queue__item:not(:last-child)`).forEach(q => q.remove());
		body.querySelector(`.subject-queue__item a`).href = quizLink;
		body.querySelector(`.subject-queue__item`).before(...batch.map(b => {
			let li = document.createElement(`li`);
			li.classList.add(`subject-queue__item`);
			li.setAttribute(`data-subject-queue-target`, `item`);
			li.innerHTML = `<a class="subject-character subject-character--${b.subjectType.replace(`kana_vocabulary`, `vocabulary`)} subject-character--tiny subject-character--unlocked"
			                   title="${b.readings?.[0].reading ?? b.slug}"
							   href="${url.replace(/\/\d+$/, `/${b.id}`)}"
							   data-turbo-frame="_blank">
							    <div class="subject-character__content">
								    <span class="subject-character__characters" lang="ja">${b.characters ?? b.slug}</span>
								</div>
							</a>`;
			return li;
		}));
	}

    // function taken from Wanikani Queue Manipulator by Sinyaven under MIT license
    function currentIdFromLessonUrl(url) {
		let id = url.match(/wanikani.com\/subject-lessons\/[\d-]+\/(\d+)/)?.[1];
		return id == null ? null : parseInt(id);
	}

	function getPage(location) {
		if ((/\/?subject-lessons\/[\d-]+\/\d+/.test(location.pathname))) {
			return pages.lessonPage;
		}

		if ((/\/?subject-lessons\/[\d-]+\/quiz/.test(location.pathname))) {
			return pages.quizPage;
		}

		return pages.other;
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

	async function applyFilter(e) {
		let rawFilterValues = getRawFilterValuesFromUI(document);
		let filtered = await filterLessonsInternal(rawFilterValues);

		if (filtered) {
			saveRawFilterValues(rawFilterValues);
		}
	}

    function getRawFilterValuesFromUI(body) {
		return {
			'batchSize': body.querySelector(batchSizeInputSelector).value.trim(),
			'radicals': body.querySelector(radicalInputSelector).value.trim(),
			'kanji': body.querySelector(kanjiInputSelector).value.trim(),
			'vocab': body.querySelector(vocabInputSelector).value.trim()
		};
	}

	async function filterLessonsInternal(rawFilterValues) {
		await queueInitializedPromise;

		let newBatchSize = getCheckedBatchSize(rawFilterValues.batchSize);

		if (newBatchSize === null || newBatchSize < 1) {
			alert('Batch size must be a positive number');
			return false;
		}

		let newFilteredQueue = getFilteredQueue(rawFilterValues);

		if (newFilteredQueue.length === 0) {
			alert('Cannot remove all lessons');
			return false;
		}

		currentLessonQueue = newFilteredQueue;
		currentBatchSize = newBatchSize;

		visitUrlForCurrentBatch();

		return true;
	}

	function getFilteredQueue(rawFilterValues) {
		let idToIndex = { };

		for (let i = 0; i < initialLessonQueue.length; i++) {
			idToIndex[initialLessonQueue[i].id] = i;
		}

		var lessonQueueByType = getLessonQueueByType(initialLessonQueue);

		let filteredRadicalQueue = getFilteredQueueForType(lessonQueueByType[radicalSubjectType], rawFilterValues.radicals);
		let filteredKanjiQueue = getFilteredQueueForType(lessonQueueByType[kanjiSubjectType], rawFilterValues.kanji);
		let filteredVocabQueue = getFilteredQueueForType(lessonQueueByType[vocabSubjectType], rawFilterValues.vocab);

		return filteredRadicalQueue.concat(filteredKanjiQueue).concat(filteredVocabQueue).sort((a, b) => idToIndex[a.id] - idToIndex[b.id]);
	}

	function getLessonQueueByType(lessonQueue) {
		let vocabSubjectTypeGroup = localStorage.lessonFilter_skipKanaVocab ? [vocabSubjectType] : [vocabSubjectType, kanaVocabSubjectType];

		return {
			[radicalSubjectType]: getQueueForType(lessonQueue, [radicalSubjectType]),
			[kanjiSubjectType]: getQueueForType(lessonQueue, [kanjiSubjectType]),
			[vocabSubjectType]: getQueueForType(lessonQueue, vocabSubjectTypeGroup)
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
		if (rawValue === '') {
			return initialBatchSize;
		}

		let value = parseInt(rawValue);

		if (isNaN(value)) {
			return null;
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
		if (initialLessonQueue.length === 0 || currentLessonQueue.length === 0) {
			global.Turbo.visit(`/dashboard`);
		}

        let url = document.URL.replace(/\/[^\/]+$/, `/${currentLessonQueue[0].id}`);
        modifiedLessonStart = true;
        global.Turbo.visit(url);
	}

	function getCurrentLessonBatchIds() {
		return currentLessonQueue.map(item => item.id);
	}

	function saveRawFilterValues(rawFilterValues) {
		let settings = {
			'version': localStorageSettingsVersion,
			'data': rawFilterValues
		};

		localStorage[localStorageSettingsKey] = JSON.stringify(settings);
	}

	function isNewBatchUrl(url) {
        // current url is not lesson page and new url is lesson page
		return getPage(new URL(document.URL)) !== pages.lessonPage && getPage(new URL(url)) === pages.lessonPage;
	}

	function setsAreEqual(set1, set2) {
		return set1.size === set2.size && [...set1].every(v => set2.has(v));
	}

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

	await initialize();
	setupStyles(document.head);
	setupUI(document.body);

    // declare turbo event listeners after awaiting initialize so they do not try to call functions before queue initialization on first page load.
    window.addEventListener('turbo:before-visit', function(e) {
        let nextLessonBatch = isNewBatchUrl(e.detail.url) && !modifiedLessonStart;
        modifiedLessonStart = false;
		if (nextLessonBatch) {
			e.preventDefault();

			let currentLessonBatchIdSet = new Set(getCurrentLessonBatchIds().slice(0, currentBatchSize));

			initialLessonQueue = initialLessonQueue.filter(item => !currentLessonBatchIdSet.has(item.id));
			currentLessonQueue = [...initialLessonQueue];

			visitUrlForCurrentBatch();
		}
	});

	window.addEventListener('turbo:before-render', function(e) {
		e.preventDefault();
		setupUI(e.detail.newBody);
		e.detail.resume();
	});
})(window);
