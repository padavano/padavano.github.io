// Версия 1.08
// Ссылка на плагин: https://padavano.github.io/quality.js
// [ИЗМЕНЕНИЯ v1.08]
// 1. [МОДЕРНИЗАЦИЯ] Обновление синтаксиса: замена 'var' на 'const/let' и использование стрелочных функций (ES6+).
// 2. [СИНТАКСИС] Использование шаблонных литералов (`...`) для стилей и строк.
// 3. [ЛОГИКА] Упрощение асинхронного кода: функции `fetchWithProxy` и `getBestReleaseFromJacred` переписаны с использованием `async/await`.

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

        /* Убрать border-radius для светлой темы, если это требуется (v1.07) */
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
     * Клонирует объект, используя оператор расширения.
     * @param {object} source - Исходный объект.
     * @returns {object} Клон объекта.
     */
    const lqeCloneCacheObject = (source) => {
        // Используем оператор расширения для более чистого клонирования
        return { ...source };
    };

    /**
     * Очищает заголовок для сравнения (удаление пунктуации, приведение к нижнему регистру).
     * @param {string} title - Исходный заголовок.
     * @returns {string} Очищенный заголовок.
     */
    const lqeCleanTitleForComparison = (title) => {
        if (!title) return '';
        // Цепочка методов для чистоты кода
        const cleaned = title
            .toLowerCase()
            .replace(/щ/g, 'ш').replace(/ё/g, 'е') // Замена специфичных русских букв
            .replace(/[^a-zа-я0-9\s]/g, ' ') // Удаление всей пунктуации
            .replace(/\s+/g, ' ') // Замена множественных пробелов на одинарный
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

        // Проверяем каждое ключевое слово-паттерн
        for (const regex of LQE_LOW_QUALITY_KEYWORDS) {
            if (regex.test(normalizedTitle)) {
                return true;
            }
        }
        return false;
    };

    // --- КЭШИРОВАНИЕ ---

    /**
     * Сохраняет кэш в хранилище Lampa с задержкой, чтобы не блокировать UI.
     */
    const saveLqeCache = () => {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Scheduling save to Lampa.Storage.");
        // Используем setTimeout, чтобы не блокировать основной поток
        setTimeout(() => {
            try {
                LQE_CACHE.prune(); // Очистка перед сохранением
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

        /**
         * Метод для очистки кэша: удаляет просроченные записи и старые записи, если превышен лимит.
         */
        LQE_CACHE.prune = () => {
            const now = Date.now();
            let keysToDelete = [];
            let cacheSize = 0;

            // 1. Находим просроченные записи
            for (const key in LQE_CACHE) {
                if (key === 'version' || typeof LQE_CACHE[key].timestamp !== 'number') continue;

                cacheSize++;
                if (now - LQE_CACHE[key].timestamp > LQE_CONFIG.CACHE_VALID_TIME_MS) {
                    keysToDelete.push(key);
                }
            }

            // 2. Удаляем просроченные
            if (keysToDelete.length > 0 && LQE_CONFIG.LOGGING_GENERAL) {
                console.log("LQE-LOG", `Cache: Pruning ${keysToDelete.length} expired items.`);
                keysToDelete.forEach(key => delete LQE_CACHE[key]);
            }

            // 3. Если кэш всё ещё слишком большой (условно, более 1000 записей), удаляем самые старые
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
        LQE_CACHE.prune(); // Первичная очистка
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Cache: Initialization complete. Size:", Object.keys(LQE_CACHE).length - 1);
    };

    /**
     * Получает данные из кэша.
     * @param {string} key - Ключ кэша.
     * @returns {{quality_code: number, full_label: string} | null} Данные кэша или null.
     */
    const getLqeCache = (key) => {
        if (!LQE_IS_CACHED_READY || !LQE_CACHE[key]) return null;

        const now = Date.now();
        const item = LQE_CACHE[key];

        // Кэш действителен
        if (now - item.timestamp < LQE_CONFIG.CACHE_VALID_TIME_MS) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `Cache check for ${key}: HIT`);
            // Если кэш подходит к порогу обновления, ставим его в очередь
            if (now - item.timestamp > LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Cache check for ${key}: REFRESH NEEDED`);
                return lqeCloneCacheObject(item); // Возвращаем старые данные, но ставим в очередь на обновление
            }
            return lqeCloneCacheObject(item);
        }

        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `Cache check for ${key}: MISS (Expired)`);
        delete LQE_CACHE[key];
        return null;
    };

    /**
     * Сохраняет данные в кэш.
     * @param {string} key - Ключ кэша.
     * @param {object} data - Данные для сохранения.
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

    // --- СЕТЕВЫЕ ЗАПРОСЫ И ОЧЕРЕДЬ ---

    /**
     * Выполняет запрос с использованием списка прокси, перебирая их до успеха.
     * Переписано на async/await.
     * @param {string} url - URL для запроса.
     * @returns {Promise<Response>} Promise с успешным Response.
     */
    const fetchWithProxy = async (url) => {
        const directUrl = url;

        // 1. Попытка прямого запроса
        try {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Fetch direct:", directUrl);
            const response = await fetch(directUrl, { signal: AbortSignal.timeout(LQE_CONFIG.PROXY_TIMEOUT_MS) });
            if (response.ok) {
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
     * Добавляет задачу в очередь на обработку качества.
     * @param {string} key - Ключ кэша.
     * @param {object} data - Данные для функции обработки.
     * @param {Function} processor - Асинхронная функция-обработчик.
     * @param {Function} [onDone] - Колбэк после завершения.
     */
    const lqeAddToQueue = (key, data, processor, onDone) => {
        // Проверяем, не стоит ли уже эта задача в очереди
        if (lqeRequestQueue.find(item => item.key === key)) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Task with key ${key} is already waiting.`);
            return;
        }

        lqeRequestQueue.push({ key, data, processor, onDone });
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Added task ${key}. Total: ${lqeRequestQueue.length}`);
        lqeProcessQueue();
    };

    /**
     * Обрабатывает очередь запросов.
     * Использует setTimeout для неблокирующего выполнения.
     */
    const lqeProcessQueue = () => {
        if (lqeRequestQueueRunning) return;
        if (lqeRequestQueue.length === 0) {
            lqeRequestQueueRunning = false;
            return;
        }

        lqeRequestQueueRunning = true;
        const task = lqeRequestQueue.shift();

        // Неблокирующее выполнение задачи
        lqeQueueTimer = setTimeout(async () => {
            try {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `Queue: Processing task ${task.key}...`);
                await task.processor(task.data);
                if (task.onDone) task.onDone();
            } catch (e) {
                console.error("LQE-ERROR", `Queue: Task ${task.key} failed.`, e);
            } finally {
                lqeRequestQueueRunning = false;
                lqeProcessQueue(); // Запускаем следующую задачу
            }
        }, 10);
    };

    // --- ЛОГИКА КАЧЕСТВА ---

    /**
     * Определяет метку качества и цвет на основе score и qualityCode.
     * @param {number} score - Баллы JacRed.
     * @param {number} qualityCode - Разрешение (2160, 1080 и т.д.).
     * @returns {{label: string, color: string, bg: string}} Объект с меткой и цветами.
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

        // Приоритет 2: Используем Score, если qualityCode не дал ясного ответа
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
     * Переписано на async/await.
     * @param {object} data - Данные фильма/сериала.
     * @returns {Promise<{quality: number, full_label: string}>} Наилучшее качество.
     */
    const getBestReleaseFromJacred = async (data) => {
        let bestScore = -Infinity;
        let bestQuality = LQE_CONFIG.QUALITY_NO_INFO_LABEL;
        let bestLabel = '';

        // 1. Формирование ключей для поиска
        const searchTitles = [
            lqeCleanTitleForComparison(data.title),
            lqeCleanTitleForComparison(data.original_title)
        ].filter(t => t);

        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, Valid local titles for search:`, searchTitles);

        // 2. Стратегии поиска (OriginalTitle_Year)
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

        // 3. Анализ торрентов
        if (jacredResult && jacredResult.torrents && jacredResult.torrents.length > 0) {
            for (const torrent of jacredResult.torrents) {
                const score = torrent.score || 0;
                const qualityCode = torrent.quality || 0;
                const title = torrent.title || '';

                if (score > 0 && score > bestScore) {
                    // Проверяем на заведомо низкое качество, даже если score высокий (например, TS)
                    if (lqeCheckIsLowQuality(title)) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, JacRed: Low quality keyword found in: ${title}. Score ignored.`);
                        continue;
                    }

                    bestScore = score;
                    bestQuality = qualityCode;
                    bestLabel = title;

                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, JacRed: New best score ${score} with quality ${qualityCode}p, torrent: ${title}`);

                    // Оптимизация: если нашли 4K с максимальным скором, останавливаем поиск
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

        // 4. Попытка получить дополнительную информацию о названии (если нет локальных имен)
        if (data.names && data.names.length === 0) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, TMDB Names array is empty. Trying CUB API for more titles...`);

            const cubUrl = `https://tmdb.cub.rip/3/${data.type}/${data.id}/translations`;
            try {
                const response = await fetchWithProxy(cubUrl);
                const cubData = await response.json();
                if (cubData.translations) {
                    const localTranslations = cubData.translations.filter(t => t.iso_639_1 === Lampa.Lang.current());
                    if (localTranslations.length > 0) {
                        const localTitle = localTranslations[0].data.title;
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${data.id}, CUB API found local title: ${localTitle}. Retrying search (not implemented yet).`);
                        // Фактического повторного запроса здесь нет, только логгирование
                        // Возвращаем результат без улучшения, т.к. поиск уже выполнен
                    }
                }
            } catch (e) {
                console.error("LQE-ERROR", `card: ${data.id}, Failed to fetch CUB translations.`, e.message);
            }
        }

        // 5. Ничего не найдено
        return { quality: -1, full_label: 'No valid torrent found.' };
    };

    // --- ОБНОВЛЕНИЕ UI ---

    /**
     * Обновляет метку качества на мини-карточке.
     * @param {HTMLElement} cardElement - Элемент карточки.
     * @param {string} displayQuality - Метка качества ('4K', '1080', '?').
     * @param {string} color - Цвет текста.
     * @param {boolean} isLowQuality - Признак низкого качества.
     */
    const updateCardListQualityElement = (cardElement, displayQuality, color, isLowQuality) => {
        // Удаляем старые метки
        cardElement.querySelectorAll('.card__quality').forEach(el => el.remove());

        // Создаем новый элемент для метки
        const qualityDiv = document.createElement('div');
        qualityDiv.className = 'card__quality';
        qualityDiv.style.color = color;
        // Для низкого качества можно добавить инверсию или специальный фон
        if (isLowQuality) {
             qualityDiv.style.backgroundColor = LQE_CONFIG.FULL_CARD_BG_LOW;
             qualityDiv.style.color = '#000000';
             qualityDiv.style.border = '1px solid ' + color;
        }

        const innerElement = document.createElement('div');
        innerElement.textContent = displayQuality;

        qualityDiv.appendChild(innerElement);
        // Вставляем элемент в карточку
        const cardView = cardElement.querySelector('.card__view');
        if (cardView) {
            cardView.appendChild(qualityDiv);
        }
        if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", `Card: ${cardElement.dataset.id}, Quality label added: ${displayQuality}`);
    };

    /**
     * Обрабатывает логику для отображения качества на мини-карточках.
     * @param {HTMLElement} cardElement - Элемент карточки.
     */
    const updateCardListQuality = (cardElement) => {
        const movieId = cardElement.getAttribute('data-id');
        const movieType = cardElement.getAttribute('data-type') === 'tv' ? 'tv' : 'movie';
        const cardKey = `${movieType}_${movieId}`;

        if (!movieId || LQE_PROCESSED_LIST_CARD_IDS.has(cardKey)) {
            // Уже обработано или нет ID
            return;
        }

        LQE_PROCESSED_LIST_CARD_IDS.add(cardKey);

        // 1. Проверка кэша
        const cachedItem = getLqeCache(cardKey);
        if (cachedItem) {
            const translated = translateQualityLabel(0, cachedItem.quality_code);
            const isLowQuality = translated.label === LQE_CONFIG.QUALITY_LOW_LABEL;
            updateCardListQualityElement(cardElement, translated.label, translated.color, isLowQuality);

            // Если кэш требует обновления, ставим в очередь (без блокировки UI)
            if (Date.now() - cachedItem.timestamp > LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
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
            // Удаляем анимацию после завершения
            loadingElement.remove();
        });
    };

    /**
     * Асинхронная функция для обработки качества и обновления UI списка.
     * @param {object} data - Данные фильма/сериала.
     */
    const processCardQualityAsync = async (data) => {
        const movieId = data.id;
        const movieType = data.type;
        const cardKey = `${movieType}_${movieId}`;

        // 1. Получение данных фильма
        const tmdbApi = LQE_CONFIG.JACRED_PROTOCOL + 'tmdb.cub.rip/3/';
        const url = `${tmdbApi}${movieType}/${movieId}`;
        let tmdbData;
        try {
            const response = await fetchWithProxy(url);
            tmdbData = await response.json();
        } catch (e) {
            console.error("LQE-ERROR", `card: ${movieId}, Failed to fetch TMDB data.`, e.message);
            // Если TMDB API упал, сохраняем "NO_INFO" в кэш
            setLqeCache(cardKey, { quality_code: -1, full_label: 'TMDB Error' });
            return;
        }

        const normalizedData = {
            id: tmdbData.id,
            title: tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name,
            original_title: tmdbData.original_title || tmdbData.original_name,
            type: movieType,
            release_date: tmdbData.release_date || tmdbData.first_air_date,
            names: tmdbData.names || []
        };
        // Проверка для сериалов
        if (movieType === 'tv' && !LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES) {
            setLqeCache(cardKey, { quality_code: -1, full_label: 'TV Series Skipped' });
            return;
        }

        // 2. Получение лучшего релиза
        const bestRelease = await getBestReleaseFromJacred(normalizedData);

        // 3. Сохранение в кэш
        setLqeCache(cardKey, { quality_code: bestRelease.quality, full_label: bestRelease.full_label });

        // 4. Обновление UI для всех видимых карточек (так как onSnapshot не используется)
        const visibleCards = document.querySelectorAll(`.card[data-id="${movieId}"]`);
        const translated = translateQualityLabel(0, bestRelease.quality);
        const isLowQuality = translated.label === LQE_CONFIG.QUALITY_LOW_LABEL;

        visibleCards.forEach(card => {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", `Card: ${movieId}, Updating visible list card with quality: ${translated.label}`);
            // Удаляем анимацию, если она есть
            card.querySelectorAll('.lqe-loading').forEach(el => el.remove());
            updateCardListQualityElement(card, translated.label, translated.color, isLowQuality);
        });
    };

    /**
     * Обрабатывает логику для отображения качества на полной карточке.
     * @param {object} movieData - Данные фильма/сериала из Lampa.
     * @param {HTMLElement} renderElement - Элемент рендера Lampa.
     */
    const processFullCardQuality = (movieData, renderElement) => {
        const movieId = movieData.id;
        const movieType = movieData.media_type || (movieData.first_air_date ? 'tv' : 'movie');
        const cardKey = `${movieType}_${movieId}`;
        const rateLine = renderElement.querySelector('.full-start-new__rate-line');

        if (!rateLine) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Full card: Rate line not found. Skipping.`);
            return;
        }

        // Удаляем старые метки и анимацию
        rateLine.querySelectorAll('.lqe-full-card-quality').forEach(el => el.remove());

        // Проверка для сериалов
        if (movieType === 'tv' && !LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${movieId}, TV Series skipped by config.`);
            return;
        }

        // 1. Проверка кэша
        const cachedItem = getLqeCache(cardKey);
        if (cachedItem) {
            const translated = translateQualityLabel(0, cachedItem.quality_code);
            addFullCardQualityElement(rateLine, translated);

            // Если кэш требует обновления, ставим его в очередь
            if (Date.now() - cachedItem.timestamp > LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
                lqeAddToQueue(cardKey, movieData, processFullCardQualityAsync, () => {
                    // Здесь не нужно ничего делать, так как UI обновляется внутри processFullCardQualityAsync
                });
            }
            return;
        }

        // 2. Если нет в кэше, добавляем анимацию загрузки
        const loadingElement = document.createElement('div');
        loadingElement.className = 'lqe-full-card-quality lqe-loading';
        loadingElement.textContent = LQE_CONFIG.QUALITY_MID_LABEL; // Заполнитель
        rateLine.appendChild(loadingElement);
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Add loading animation`);

        // 3. Добавляем задачу в очередь на полный расчет
        lqeAddToQueue(cardKey, movieData, processFullCardQualityAsync, () => {
            // Удаляем анимацию после завершения
            loadingElement.remove();
        });
    };

    /**
     * Вспомогательная функция для добавления элемента качества на полную карточку.
     * @param {HTMLElement} rateLine - Элемент, куда добавлять метку.
     * @param {{label: string, color: string, bg: string}} translated - Результат translateQualityLabel.
     */
    const addFullCardQualityElement = (rateLine, translated) => {
        // Удаляем старые метки
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
     * @param {object} movieData - Данные фильма/сериала.
     */
    const processFullCardQualityAsync = async (movieData) => {
        const movieId = movieData.id;
        const movieType = movieData.media_type || (movieData.first_air_date ? 'tv' : 'movie');
        const cardKey = `${movieType}_${movieId}`;

        const normalizedData = {
            id: movieData.id,
            title: movieData.title || movieData.name || movieData.original_title || movieData.original_name,
            original_title: movieData.original_title || movieData.original_name,
            type: movieType,
            release_date: movieData.release_date || movieData.first_air_date,
            names: movieData.names || []
        };
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", `card: ${movieId}, Normalized full card data:`, normalizedData);

        // 1. Получение лучшего релиза
        const bestRelease = await getBestReleaseFromJacred(normalizedData);
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", `card: ${movieId}, JacRed callback received for full card. Result:`, bestRelease);

        // 2. Сохранение в кэш
        setLqeCache(cardKey, { quality_code: bestRelease.quality, full_label: bestRelease.full_label });

        // 3. Обновление UI
        const translated = translateQualityLabel(0, bestRelease.quality);
        const currentActivity = Lampa.Activity.active();

        if (currentActivity && currentActivity.component === 'full' && currentGlobalMovieId === movieId) {
            const renderElement = currentActivity.render();
            const rateLine = renderElement.querySelector('.full-start-new__rate-line');

            if (rateLine) {
                // Удаляем анимацию загрузки
                rateLine.querySelectorAll('.lqe-loading').forEach(el => el.remove());
                addFullCardQualityElement(rateLine, translated);
            }
        }
    };

    // --- ИНИЦИАЛИЗАЦИЯ ПЛАГИНА ---

    /**
     * Менеджер видимости для списка карточек, предотвращает утечки памяти.
     * Используется Intersection Observer.
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

                    // Если карточка появляется в зоне видимости, и она еще не обработана в Set
                    if (entry.isIntersecting && !LQE_PROCESSED_LIST_CARD_IDS.has(cardKey)) {
                        // Важно: на этом этапе мы просто запускаем логику, которая проверит кэш
                        updateCardListQuality(card);
                    }
                    // Если карточка уходит из зоны видимости, снимаем наблюдение
                    // NOTE: Снятие наблюдения здесь может быть излишним, т.к. IntersectionObserver
                    // не удаляет сам элемент из DOM, но позволяет сократить количество активных наблюдателей.
                    // observer.unobserve(card);
                });
            },
            { threshold: 0.1 } // Запускать, когда видно 10% элемента
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
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Lampa Quality Enhancer: Plugin Initialization Started! (v1.08)");
        window.lampaQualityPlugin = true;

        // 1. Инициализация кэша
        initializeLqePersistentCache();

        // 2. Добавление стилей в DOM
        if (!document.getElementById('lampa_quality_styles')) {
            document.head.insertAdjacentHTML('beforeend', styleLQE.trim());
        }

        // 3. Mutation Observer для отслеживания новых карточек в списках
        const observer = new MutationObserver((mutationsList, observer) => {
            // Перебираем все изменения в DOM
            mutationsList.forEach(mutation => {
                // Ищем добавленные узлы
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        // Ищем .card элементы
                        if (node.classList && node.classList.contains('card')) {
                            // Если карточка добавлена, ставим её на наблюдение видимости
                            lqeCardVisibilityManager.observe(node);
                        } else if (node.querySelectorAll) {
                            // Ищем .card элементы внутри добавленного узла (например, если загрузился целый список)
                            node.querySelectorAll('.card').forEach(card => {
                                lqeCardVisibilityManager.observe(card);
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        if (LQE_CONFIG.LOGGING_GENERAL) console.log('LQE-LOG: Initial observer for card lists started.');

        // 4. Слушатель для полной карточки (при открытии)
        Lampa.Listener.follow('full', (event) => {
            if (event.type === 'complite') {
                const renderElement = event.object.activity.render();
                currentGlobalMovieId = event.data.movie.id;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'complite' for ID:", currentGlobalMovieId);
                processFullCardQuality(event.data.movie, renderElement);
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
        // Запуск через setTimeout для гарантии загрузки Lampa.Storage и Lampa.Listener
        setTimeout(initializeLampaQualityPlugin, 100);
    }

})();
