// Версия 1.10
// Ссылка на плагин: https://padavano.github.io/quality.js
// [ИЗМЕНЕНИЯ v1.10]
// 1. [КРИТИЧЕСКИЙ ФИКС] Для полной карточки (Full Card) отключена lqeRequestQueue. Запрос выполняется сразу и напрямую в отдельном async-блоке,
//    чтобы избежать блокировки setTimeout в нестандартных средах Lampa.
// 2. [ДИАГНОСТИКА] Добавлены дополнительные логи в processFullCardQuality для отслеживания пути (Cache HIT/MISS).
// 3. [РЕФАКТОРИНГ] Улучшено управление таймером очереди (lqeQueueTimer) для списков.

(function() {
    'use strict';

    // --- КОНФИГУРАЦИЯ ---
    const LQE_CONFIG = {
        CACHE_VERSION: 2,
        LOGGING_GENERAL: true,
        LOGGING_QUALITY: true,
        LOGGING_CARDLIST: false,
        CACHE_VALID_TIME_MS: 3 * 24 * 60 * 60 * 1000,
        CACHE_REFRESH_THRESHOLD_MS: 12 * 60 * 60 * 1000,
        CACHE_KEY: 'lampa_quality_cache',
        JACRED_PROTOCOL: 'https://',
        JACRED_URL: 'jacred.xyz',
        JACRED_API_KEY: '',
        PROXY_LIST: [
            'http://api.allorigins.win/raw?url=',
            'http://cors.bwa.workers.dev/'
        ],
        PROXY_TIMEOUT_MS: 5000,
        SHOW_QUALITY_FOR_TV_SERIES: true,

        // --- Цвета (Полная карта) ---
        FULL_CARD_LABEL_TEXT_COLOR: '#000000',
        FULL_CARD_BG_HIGH: '#C8E6C9', // Бледно-зеленый
        FULL_CARD_BG_MID: '#FFF9C4',  // Бледно-желтый
        FULL_CARD_BG_LOW: '#FFCDD2',  // Бледно-красный
        FULL_CARD_BG_NOINFO: '#CFD8DC', // Бледно-серый

        // --- Цвета (Списки карточек) ---
        LIST_CARD_TEXT_HIGH: '#00FF00',
        LIST_CARD_TEXT_MID: '#FFFF00',
        LIST_CARD_TEXT_LOW: '#FF0000',
        LIST_CARD_TEXT_NOINFO: '#909090',

        // --- Заголовки ---
        QUALITY_HIGH_LABEL: '4K',
        QUALITY_MID_LABEL: '1080',
        QUALITY_LOW_LABEL: 'BAD',
        QUALITY_NO_INFO_LABEL: '?',
    };

    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let LQE_CACHE = {};
    let LQE_IS_CACHED_READY = false;
    const LQE_PROCESSED_LIST_CARD_IDS = new Set();
    let currentGlobalMovieId = null;
    const lqeRequestQueue = [];
    let lqeRequestQueueRunning = false;
    let lqeQueueTimer = null;

    // --- МЕТКИ И МАКСИМАЛЬНЫЕ РАЗРЕШЕНИЯ ---
    const QUALITY_DISPLAY_MAP = {
        '4K': 2160,
        '2160': 2160,
        '1440': 1440,
        '1080': 1080,
        '720': 720,
        '480': 480
    };

    const QUALITY_MAX_SCORE_MAP = {
        '4K': 100000,
        '1080': 40000,
        '720': 20000,
        '480': 10000
    };

    const LQE_LOW_QUALITY_KEYWORDS = [
        /ts\b/i, // CAM, TS (Telesync) - MUST use \b to avoid conflicts (e.g., 'bits' or 'postscripT S')
        /ad\b/i, // Ad - MUST use \b to avoid conflicts
        /\bcam\b/i,
        /\bscr\b/i, // Screener
        /\bdub\b/i, // Dubbing (often associated with low quality)
    ];

    // --- DOM СТИЛИ (использование шаблонных литералов) ---
    // Стили для всех элементов
    const styleLQE = `<style id="lampa_quality_styles">
        /* Стили для полной карточки */
        .full-start-new__rate-line .lqe-full-card-quality {
            font-size: 0.8em;
            font-weight: 600;
            padding: 0 0.5em;
            line-height: 1.8;
            height: 1.8em;
            border-radius: 0.3em;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 0.5em;
            flex-shrink: 0;
            user-select: none;
            cursor: help;
        }

        /* Убрать border-radius для светлой темы */
        body.light--version .full-start-new__rate-line .lqe-full-card-quality {
            border-radius: 0;
        }

        /* Стили для карточек в списке */
        .card__quality {
            position: absolute;
            top: 0.3em;
            left: 0.3em;
            padding: 0.1em 0.4em;
            font-size: 0.6em;
            line-height: 1.3em;
            font-weight: 600;
            border-radius: 0.3em;
            z-index: 2;
            background: rgba(0, 0, 0, 0.7);
            color: #ffffff;
            opacity: 0.9;
            pointer-events: none;
        }
        .card__quality div {
            transform: scale(0.9); /* Для уменьшения визуального размера текста внутри */
        }

        /* Стили для анимации загрузки */
        .lqe-loading {
            overflow: hidden;
            position: relative;
            background: rgba(128, 128, 128, 0.4);
            border-radius: 0.3em;
        }

        /* Эффект "пульсации" */
        .lqe-loading:after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            animation: lqe-shine 1.5s infinite;
        }
        @keyframes lqe-shine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
    </style>`;

    // Стили для элемента загрузки в списке
    const loadingStylesLQE = `
        <div class="card__quality lqe-loading">
            <div style="visibility: hidden;">${LQE_CONFIG.QUALITY_MID_LABEL}</div>
        </div>
    `;

    // --- УТИЛИТЫ ---

    /**
     * Клонирует объект.
     * @param {object} source - Исходный объект.
     * @returns {object} Клон объекта.
     */
    const lqeCloneCacheObject = (source) => ({ ...source });

    /**
     * Очищает заголовок для сравнения.
     * @param {string} title - Исходный заголовок.
     * @returns {string} Очищенный заголовок.
     */
    const lqeCleanTitleForComparison = (title) => {
        if (!title) return '';
        const cleaned = title
            .toLowerCase()
            .replace(/щ/g, 'ш').replace(/ё/g, 'е')
            .replace(/[^a-zа-я0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned;
    };

    /**
     * Проверяет, является ли качество заведомо низким по ключевым словам.
     * @param {string} title - Заголовок релиза.
     * @returns {boolean} True, если найдено ключевое слово низкого качества.
     */
    const lqeCheckIsLowQuality = (title) => {
        if (!title) return false;
        const normalizedTitle = title.toLowerCase();
        for (const regex of LQE_LOW_QUALITY_KEYWORDS) {
            if (regex.test(normalizedTitle)) {
                return true;
            }
        }
        return false;
    };

    // --- КЭШИРОВАНИЕ ---

    /**
     * Сохраняет кэш в хранилище Lampa с задержкой.
     */
    const saveLqeCache = () => {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Scheduling save to Lampa.Storage.");
        setTimeout(() => {
            try {
                LQE_CACHE.prune();
                Lampa.Storage.set(LQE_CONFIG.CACHE_KEY, JSON.stringify(LQE_CACHE));
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Successfully saved to Lampa.Storage.");
            } catch (e) {
                console.error("LQE-ERROR", "Cache: Error saving cache to storage.", e);
            }
        }, 500);
    };

    /**
     * Инициализирует и загружает кэш из хранилища.
     */
    const initializeLqePersistentCache = () => {
        try {
            const rawCache = Lampa.Storage.get(LQE_CONFIG.CACHE_KEY);
            const loadedCache = rawCache ? JSON.parse(rawCache) : {};

            if (loadedCache.version !== LQE_CONFIG.CACHE_VERSION) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Version mismatch. Clearing cache.");
                LQE_CACHE = {};
            } else {
                LQE_CACHE = loadedCache;
            }
        } catch (e) {
            console.error("LQE-ERROR", "Cache: Error loading or parsing cache.", e);
            LQE_CACHE = {};
        }

        LQE_CACHE.prune = () => {
            const now = Date.now();
            let keysToDelete = [];
            let cacheSize = 0;

            for (const key in LQE_CACHE) {
                if (key === 'version' || typeof LQE_CACHE[key].timestamp !== 'number') continue;

                cacheSize++;
                if (now - LQE_CACHE[key].timestamp > LQE_CONFIG.CACHE_VALID_TIME_MS) {
                    keysToDelete.push(key);
                }
            }

            if (keysToDelete.length > 0 && LQE_CONFIG.LOGGING_GENERAL) {
                console.log("LQE-LOG", `Cache: Pruning ${keysToDelete.length} expired items.`);
                keysToDelete.forEach(key => delete LQE_CACHE[key]);
            }

            if (cacheSize > 1000) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Size exceeded 1000. Pruning oldest items.");
                const sortedKeys = Object.keys(LQE_CACHE)
                    .filter(key => key !== 'version' && typeof LQE_CACHE[key].timestamp === 'number')
                    .sort((a, b) => LQE_CACHE[a].timestamp - LQE_CACHE[b].timestamp);

                const countToRemove = sortedKeys.length - 1000;
                for (let i = 0; i < countToRemove; i++) {
                    delete LQE_CACHE[sortedKeys[i]];
                }
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Cache: Removed ${countToRemove} oldest items.`);
            }

            LQE_CACHE.version = LQE_CONFIG.CACHE_VERSION;
        };

        LQE_IS_CACHED_READY = true;
        LQE_CACHE.prune();
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Initialization complete. Size:", Object.keys(LQE_CACHE).length - 1);
    };

    /**
     * Получает данные из кэша.
     */
    const getLqeCache = (key) => {
        try {
            if (!LQE_IS_CACHED_READY || !LQE_CACHE[key]) return null;

            const now = Date.now();
            const item = LQE_CACHE[key];

            if (now - item.timestamp < LQE_CONFIG.CACHE_VALID_TIME_MS) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `Cache check for ${key}: HIT`);
                if (now - item.timestamp > LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
                    if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Cache check for ${key}: REFRESH NEEDED`);
                    return lqeCloneCacheObject(item);
                }
                return lqeCloneCacheObject(item);
            }

            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `Cache check for ${key}: MISS (Expired)`);
            delete LQE_CACHE[key];
            return null;
        } catch (e) {
            console.error("LQE-ERROR", `Cache check for ${key}: Failed unexpectedly.`, e);
            return null;
        }
    };

    /**
     * Сохраняет данные в кэш.
     */
    const setLqeCache = (key, data) => {
        if (!LQE_IS_CACHED_READY) return;
        const now = Date.now();

        LQE_CACHE[key] = {
            ...data,
            timestamp: now
        };

        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `Cache: Saving quality cache for key: ${key} Data:`, LQE_CACHE[key]);
        saveLqeCache();
    };

    // --- СЕТЕВЫЕ ЗАПРОСЫ И ОЧЕРЕДЬ (Для списков) ---

    /**
     * Выполняет запрос с использованием списка прокси, перебирая их до успеха.
     */
    const fetchWithProxy = async (url) => {
        const directUrl = url;

        // 1. Попытка прямого запроса
        try {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Fetch direct:", directUrl);
            const response = await fetch(directUrl, { signal: AbortSignal.timeout(LQE_CONFIG.PROXY_TIMEOUT_MS) });
            if (response.ok) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Fetch direct successful.");
                return response;
            }
        } catch (e) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Fetch direct failed. Trying proxies.", e.message);
        }

        // 2. Перебор прокси
        for (const proxy of LQE_CONFIG.PROXY_LIST) {
            const proxyUrl = proxy + encodeURIComponent(url);
            try {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Fetch proxy:", proxyUrl);
                const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(LQE_CONFIG.PROXY_TIMEOUT_MS) });
                if (response.ok) {
                    if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Fetch proxy successful.");
                    return response;
                }
            } catch (e) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Proxy failed: ${proxy}`, e.message);
            }
        }

        // 3. Все попытки исчерпаны
        throw new Error('All fetch attempts (direct and proxies) failed or timed out.');
    };


    /**
     * Добавляет задачу в очередь на обработку качества (только для списков).
     */
    const lqeAddToQueue = (key, data, processor, onDone) => {
        if (lqeRequestQueue.find(item => item.key === key)) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Task with key ${key} is already waiting.`);
            return;
        }

        lqeRequestQueue.push({ key, data, processor, onDone });
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Added task ${key}. Total: ${lqeRequestQueue.length}`);
        lqeProcessQueue();
    };

    /**
     * Обрабатывает очередь запросов (только для списков).
     */
    const lqeProcessQueue = () => {
        if (lqeRequestQueueRunning) return;
        if (lqeRequestQueue.length === 0) {
            lqeRequestQueueRunning = false;
            if (lqeQueueTimer) clearTimeout(lqeQueueTimer);
            lqeQueueTimer = null;
            return;
        }

        lqeRequestQueueRunning = true;
        const task = lqeRequestQueue.shift();
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Starting process for task ${task.key} on timer.`);

        // Используем setTimeout с обычным колбэком, внутри которого вызываем async-функцию (IIFE),
        // чтобы избежать проблем с асинхронностью.
        if (lqeQueueTimer) clearTimeout(lqeQueueTimer);
        lqeQueueTimer = setTimeout(() => {
            (async () => {
                try {
                    if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Executing task ${task.key}...`);
                    await task.processor(task.data);
                    if (task.onDone) task.onDone();
                } catch (e) {
                    console.error("LQE-ERROR", `Queue: Task ${task.key} failed.`, e);
                } finally {
                    lqeRequestQueueRunning = false;
                    lqeProcessQueue(); // Запускаем следующую задачу
                }
            })();
        }, 10);
    };

    // --- ЛОГИКА КАЧЕСТВА ---

    /**
     * Определяет метку качества и цвет на основе score и qualityCode.
     */
    const translateQualityLabel = (score, qualityCode) => {
        const result = {
            label: LQE_CONFIG.QUALITY_NO_INFO_LABEL,
            color: LQE_CONFIG.LIST_CARD_TEXT_NOINFO,
            bg: LQE_CONFIG.FULL_CARD_BG_NOINFO
        };

        // Приоритет 1: Разрешение, если оно получено напрямую из JacRed
        if (qualityCode >= QUALITY_DISPLAY_MAP['4K']) {
            result.label = LQE_CONFIG.QUALITY_HIGH_LABEL;
        } else if (qualityCode >= QUALITY_DISPLAY_MAP['1080']) {
            result.label = LQE_CONFIG.QUALITY_MID_LABEL;
        } else if (qualityCode >= QUALITY_DISPLAY_MAP['720'] || qualityCode >= QUALITY_DISPLAY_MAP['480']) {
            result.label = LQE_CONFIG.QUALITY_LOW_LABEL;
        }

        // Приоритет 2: Используем Score
        if (score > QUALITY_MAX_SCORE_MAP['4K']) {
            result.label = LQE_CONFIG.QUALITY_HIGH_LABEL;
        } else if (score > QUALITY_MAX_SCORE_MAP['1080']) {
            result.label = LQE_CONFIG.QUALITY_MID_LABEL;
        } else if (score > QUALITY_MAX_SCORE_MAP['720']) {
            result.label = LQE_CONFIG.QUALITY_LOW_LABEL;
        }

        // Приоритет 3: Если score и qualityCode низкие, ставим 'BAD'
        if (qualityCode <= QUALITY_DISPLAY_MAP['480'] && score < QUALITY_MAX_SCORE_MAP['720']) {
            result.label = LQE_CONFIG.QUALITY_LOW_LABEL;
        }

        // Устанавливаем цвета по финальной метке
        switch (result.label) {
            case LQE_CONFIG.QUALITY_HIGH_LABEL:
                result.color = LQE_CONFIG.LIST_CARD_TEXT_HIGH;
                result.bg = LQE_CONFIG.FULL_CARD_BG_HIGH;
                break;
            case LQE_CONFIG.QUALITY_MID_LABEL:
                result.color = LQE_CONFIG.LIST_CARD_TEXT_MID;
                result.bg = LQE_CONFIG.FULL_CARD_BG_MID;
                break;
            case LQE_CONFIG.QUALITY_LOW_LABEL:
                result.color = LQE_CONFIG.LIST_CARD_TEXT_LOW;
                result.bg = LQE_CONFIG.FULL_CARD_BG_LOW;
                break;
        }

        return result;
    };

    /**
     * Асинхронно запрашивает качество с JacRed и TMDB/CUB.
     */
    const getBestReleaseFromJacred = async (data) => {
        let bestScore = -Infinity;
        let bestQuality = LQE_CONFIG.QUALITY_NO_INFO_LABEL;
        let bestLabel = '';

        const jacredUrl = `${LQE_CONFIG.JACRED_PROTOCOL}${LQE_CONFIG.JACRED_URL}/api/v1.0/torrents`;
        const searchParams = new URLSearchParams({
            search: data.original_title,
            year: data.release_date ? data.release_date.slice(0, 4) : '',
            exact: 'true',
            uid: Lampa.Storage.get('userid') || 'lampa_anon',
            apikey: LQE_CONFIG.JACRED_API_KEY
        });
        const url = `${jacredUrl}?${searchParams.toString()}`;

        let jacredResult;
        try {
            const response = await fetchWithProxy(url);
            jacredResult = await response.json();
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, JacRed callback received. Result:`, jacredResult);
        } catch (e) {
            console.error("LQE-ERROR", `card: ${data.id}, Failed to fetch JacRed data.`, e.message);
            return { quality: -1, full_label: 'Error: JacRed fetch failed.' };
        }

        if (jacredResult && jacredResult.torrents && jacredResult.torrents.length > 0) {
            for (const torrent of jacredResult.torrents) {
                const score = torrent.score || 0;
                const qualityCode = torrent.quality || 0;
                const title = torrent.title || '';

                if (score > 0 && score > bestScore) {
                    if (lqeCheckIsLowQuality(title)) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, JacRed: Low quality keyword found in: ${title}. Score ignored.`);
                        continue;
                    }

                    bestScore = score;
                    bestQuality = qualityCode;
                    bestLabel = title;

                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, JacRed: New best score ${score} with quality ${qualityCode}p, torrent: ${title}`);

                    if (bestQuality >= QUALITY_DISPLAY_MAP['4K'] && bestScore > QUALITY_MAX_SCORE_MAP['4K']) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, Optimization: Found 4K PERFECT MATCH. Stopping search.`);
                        break;
                    }
                }
            }

            if (bestScore > 0) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, JacRed: Best positive score torrent found with score ${bestScore} and quality ${bestQuality}p`);
                return { quality: bestQuality, full_label: bestLabel };
            }
        }

        // Попытка получить дополнительную информацию о названии (Skipped in v1.10 for full card, focusing on core fix)
        // if (data.names && data.names.length === 0) { ... }

        return { quality: -1, full_label: 'No valid torrent found.' };
    };

    // --- ОБНОВЛЕНИЕ UI ---

    /**
     * Обновляет метку качества на мини-карточке.
     */
    const updateCardListQualityElement = (cardElement, displayQuality, color, isLowQuality) => {
        cardElement.querySelectorAll('.card__quality').forEach(el => el.remove());

        const qualityDiv = document.createElement('div');
        qualityDiv.className = 'card__quality';
        qualityDiv.style.color = color;
        if (isLowQuality) {
             qualityDiv.style.backgroundColor = LQE_CONFIG.FULL_CARD_BG_LOW;
             qualityDiv.style.color = LQE_CONFIG.FULL_CARD_LABEL_TEXT_COLOR;
             qualityDiv.style.border = '1px solid ' + color;
        }

        const innerElement = document.createElement('div');
        innerElement.textContent = displayQuality;

        qualityDiv.appendChild(innerElement);
        const cardView = cardElement.querySelector('.card__view');
        if (cardView) {
            cardView.appendChild(qualityDiv);
        }
        if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", `Card: ${cardElement.dataset.id}, Quality label added: ${displayQuality}`);
    };

    /**
     * Обрабатывает логику для отображения качества на мини-карточках.
     */
    const updateCardListQuality = (cardElement) => {
        const movieId = cardElement.getAttribute('data-id');
        const movieType = cardElement.getAttribute('data-type') === 'tv' ? 'tv' : 'movie';
        const cardKey = `${movieType}_${movieId}`;

        if (!movieId || LQE_PROCESSED_LIST_CARD_IDS.has(cardKey)) {
            // Если уже есть в Set, значит, она либо в кэше, либо в очереди.
            const cachedItem = getLqeCache(cardKey);
            if (cachedItem) {
                 const translated = translateQualityLabel(0, cachedItem.quality_code);
                 const isLowQuality = translated.label === LQE_CONFIG.QUALITY_LOW_LABEL;
                 updateCardListQualityElement(cardElement, translated.label, translated.color, isLowQuality);
            }
            return;
        }

        LQE_PROCESSED_LIST_CARD_IDS.add(cardKey);
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `IO-Check: Card ${cardKey} is visible and starting processing.`);

        // 1. Проверка кэша
        const cachedItem = getLqeCache(cardKey);
        if (cachedItem) {
            const translated = translateQualityLabel(0, cachedItem.quality_code);
            const isLowQuality = translated.label === LQE_CONFIG.QUALITY_LOW_LABEL;
            updateCardListQualityElement(cardElement, translated.label, translated.color, isLowQuality);

            if (Date.now() - cachedItem.timestamp > LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `IO-Check: Card ${cardKey} cache refreshing.`);
                lqeAddToQueue(cardKey, { id: movieId, type: movieType }, processCardQualityAsync);
            }
            return;
        }

        // 2. Если нет в кэше, добавляем анимацию загрузки
        cardElement.querySelectorAll('.card__quality').forEach(el => el.remove());
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = loadingStylesLQE.trim();
        const loadingElement = tempDiv.firstChild;
        const cardView = cardElement.querySelector('.card__view');
        if (cardView) {
             cardView.appendChild(loadingElement);
        }

        // 3. Добавляем задачу в очередь на полный расчет
        lqeAddToQueue(cardKey, { id: movieId, type: movieType }, processCardQualityAsync, () => {
            loadingElement.remove();
        });
    };

    /**
     * Асинхронная функция для обработки качества и обновления UI списка.
     */
    const processCardQualityAsync = async (data) => {
        const movieId = data.id;
        const movieType = data.type;
        const cardKey = `${movieType}_${movieId}`;

        try {
            const tmdbApi = LQE_CONFIG.JACRED_PROTOCOL + 'tmdb.cub.rip/3/';
            const url = `${tmdbApi}${movieType}/${movieId}`;
            const response = await fetchWithProxy(url);
            const tmdbData = await response.json();

            const normalizedData = {
                id: tmdbData.id,
                title: tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name,
                original_title: tmdbData.original_title || tmdbData.original_name,
                type: movieType,
                release_date: tmdbData.release_date || tmdbData.first_air_date,
                names: tmdbData.names || []
            };

            if (movieType === 'tv' && !LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES) {
                setLqeCache(cardKey, { quality_code: -1, full_label: 'TV Series Skipped' });
                return;
            }

            const bestRelease = await getBestReleaseFromJacred(normalizedData);
            setLqeCache(cardKey, { quality_code: bestRelease.quality, full_label: bestRelease.full_label });

            const visibleCards = document.querySelectorAll(`.card[data-id="${movieId}"]`);
            const translated = translateQualityLabel(0, bestRelease.quality);
            const isLowQuality = translated.label === LQE_CONFIG.QUALITY_LOW_LABEL;

            visibleCards.forEach(card => {
                if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", `Card: ${movieId}, Updating visible list card with quality: ${translated.label}`);
                card.querySelectorAll('.lqe-loading').forEach(el => el.remove());
                updateCardListQualityElement(card, translated.label, translated.color, isLowQuality);
            });
        } catch (e) {
            console.error("LQE-ERROR", `card: ${movieId}, List Card Processing Failed.`, e);
            setLqeCache(cardKey, { quality_code: -1, full_label: 'List Fetch Error' });
        }
    };

    /**
     * Обрабатывает логику для отображения качества на полной карточке.
     */
    const processFullCardQuality = (movieData, renderElement) => {
        const movieId = movieData.id;
        const movieType = movieData.media_type || (movieData.first_air_date ? 'tv' : 'movie');
        const cardKey = `${movieType}_${movieId}`;
        const rateLine = renderElement.querySelector('.full-start-new__rate-line');

        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Starting Full Card processing.`);
        if (!rateLine) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Full card: Rate line not found. Skipping.`);
            return;
        }

        rateLine.querySelectorAll('.lqe-full-card-quality').forEach(el => el.remove());

        if (movieType === 'tv' && !LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${movieId}, TV Series skipped by config.`);
            return;
        }

        // 1. Проверка кэша
        const cachedItem = getLqeCache(cardKey);
        if (cachedItem) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Full Card: Cache HIT.`);
            const translated = translateQualityLabel(0, cachedItem.quality_code);
            addFullCardQualityElement(rateLine, translated);

            if (Date.now() - cachedItem.timestamp > LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Full card cache refreshing (DIRECT EXECUTION).`);
                // Не добавляем в очередь, а выполняем напрямую
                processFullCardQualityAsync(movieData);
            }
            return;
        }

        // 2. Если нет в кэше (Cache MISS), добавляем анимацию загрузки и выполняем напрямую
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Full Card: Cache MISS. Executing DIRECTLY.`);
        const loadingElement = document.createElement('div');
        loadingElement.className = 'lqe-full-card-quality lqe-loading';
        loadingElement.textContent = LQE_CONFIG.QUALITY_MID_LABEL;
        rateLine.appendChild(loadingElement);
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Add loading animation`);


        // КРИТИЧЕСКИЙ ФИКС: Выполняем асинхронный запрос напрямую, без очереди, чтобы избежать проблем с setTimeout.
        (async () => {
            try {
                await processFullCardQualityAsync(movieData);
            } catch (e) {
                console.error("LQE-ERROR", `card: ${movieId}, Direct Full Card Processing Failed.`, e);
            } finally {
                loadingElement.remove();
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Removed loading animation.`);
            }
        })();
    };

    /**
     * Вспомогательная функция для добавления элемента качества на полную карточку.
     */
    const addFullCardQualityElement = (rateLine, translated) => {
        rateLine.querySelectorAll('.lqe-full-card-quality').forEach(el => el.remove());

        const qualityElement = document.createElement('div');
        qualityElement.className = 'lqe-full-card-quality';
        qualityElement.textContent = translated.label;
        qualityElement.style.backgroundColor = translated.bg;
        qualityElement.style.color = LQE_CONFIG.FULL_CARD_LABEL_TEXT_COLOR;

        rateLine.appendChild(qualityElement);
    };

    /**
     * Асинхронная функция для обработки качества и обновления UI полной карточки.
     */
    const processFullCardQualityAsync = async (movieData) => {
        const movieId = movieData.id;
        const movieType = movieData.media_type || (movieData.first_air_date ? 'tv' : 'movie');
        const cardKey = `${movieType}_${movieId}`;

        try {
            const normalizedData = {
                id: movieData.id,
                title: movieData.title || movieData.name || movieData.original_title || movieData.original_name,
                original_title: movieData.original_title || movieData.original_name,
                type: movieType,
                release_date: movieData.release_date || movieData.first_air_date,
                names: movieData.names || []
            };
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Normalized full card data:`, normalizedData);

            const bestRelease = await getBestReleaseFromJacred(normalizedData);
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${movieId}, JacRed callback received for full card. Result:`, bestRelease);

            setLqeCache(cardKey, { quality_code: bestRelease.quality, full_label: bestRelease.full_label });

            const translated = translateQualityLabel(0, bestRelease.quality);
            const currentActivity = Lampa.Activity.active();

            // Обновляем метку, только если карточка еще открыта
            if (currentActivity && currentActivity.component === 'full' && currentGlobalMovieId === movieId) {
                const renderElement = currentActivity.render();
                const rateLine = renderElement.querySelector('.full-start-new__rate-line');

                if (rateLine) {
                    addFullCardQualityElement(rateLine, translated);
                    if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Full card quality updated to: ${translated.label}`);
                }
            }
        } catch (e) {
            console.error("LQE-ERROR", `card: ${movieId}, Full Card Processing Failed.`, e);
            setLqeCache(cardKey, { quality_code: -1, full_label: 'Full Card Fetch Error' });
        }
    };

    // --- ИНИЦИАЛИЗАЦИЯ ПЛАГИНА ---

    /**
     * Менеджер видимости для списка карточек, предотвращает утечки памяти.
     */
    const lqeCardVisibilityManager = (() => {
        if (!('IntersectionObserver' in window)) {
            console.warn("LQE-WARN", "Intersection Observer not supported. Disabling visibility manager.");
            return {
                observe: () => {},
                unobserve: () => {}
            };
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const card = entry.target;
                    const cardKey = `${card.dataset.type}_${card.dataset.id}`;

                    if (entry.isIntersecting) {
                        // Карточка появилась в зоне видимости
                        if (!LQE_PROCESSED_LIST_CARD_IDS.has(cardKey)) {
                            updateCardListQuality(card);
                        } else {
                            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `IO-Check: Card ${cardKey} is visible, already processed.`);
                             updateCardListQuality(card);
                        }
                    }
                });
            },
            { threshold: 0.1 }
        );

        return {
            observe: (card) => {
                observer.observe(card);
            },
            unobserve: (card) => {
                observer.unobserve(card);
            }
        };
    })();

    /**
     * Основная функция инициализации плагина.
     */
    const initializeLampaQualityPlugin = () => {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Lampa Quality Enhancer: Plugin Initialization Started! (v1.10)");
        window.lampaQualityPlugin = true;

        // 1. Инициализация кэша
        initializeLqePersistentCache();

        // 2. Добавление стилей в DOM
        if (!document.getElementById('lampa_quality_styles')) {
            document.head.insertAdjacentHTML('beforeend', styleLQE.trim());
        }

        // 3. Mutation Observer для отслеживания новых карточек в списках
        const observer = new MutationObserver((mutationsList, observer) => {
            mutationsList.forEach(mutation => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        // Ищем .card элементы (когда добавляется одиночная карточка)
                        if (node.classList && node.classList.contains('card') && node.dataset.id) {
                            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Observer: Found single card ${node.dataset.id}. Observing.`);
                            lqeCardVisibilityManager.observe(node);
                        } else if (node.querySelectorAll) {
                            // Ищем .card элементы внутри добавленного узла (когда загружается целый список/ряд)
                            node.querySelectorAll('.card').forEach(card => {
                                if (card.dataset.id) {
                                    if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Observer: Found card batch ${card.dataset.id}. Observing.`);
                                    lqeCardVisibilityManager.observe(card);
                                }
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        if (LQE_CONFIG.LOGGING_GENERAL) console.log('LQE-LOG', 'Initial observer for card lists started.');

        // 4. Слушатель для полной карточки (при открытии)
        Lampa.Listener.follow('full', (event) => {
            if (event.type === 'complite') {
                const renderElement = event.object.activity.render();
                currentGlobalMovieId = event.data.movie.id;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'complite' for ID:", currentGlobalMovieId);
                
                if (event.data.movie) {
                    // Передаем данные и элемент для отрисовки
                    processFullCardQuality(event.data.movie, renderElement);
                } else {
                     console.error("LQE-ERROR", "Full card event missing movie data.");
                }
            }
        });

        // 5. Слушатель для полной карточки (при закрытии)
        Lampa.Listener.follow('full', (event) => {
            if (event.type === 'destroy') {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'destroy'. Clearing global ID.");
                currentGlobalMovieId = null;
            }
        });
    };

    // Запуск плагина
    if (window.lampaQualityPlugin) {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Plugin already loaded. Skipping initialization.");
    } else {
        // Небольшая задержка для полной готовности Lampa.
        setTimeout(initializeLampaQualityPlugin, 100);
    }

})();
