// Версия 1.05
// Ссылка на плагин: https://padavano.github.io/quality.js
// [ИЗМЕНЕНИЯ v1.05]
// 1. Оптимизация кэша: замена 'var' на 'const/let', упрощение lqeCloneCacheObject (использование оператора spread).
// 2. Оптимизация парсинга: Создан lqeGetBestNumericQuality для устранения дублирования логики разрешения в translateQualityLabel.
// 3. Оптимизация скоринга: calculateTorrentScore теперь принимает lowerTitle и numericQuality, избегая повторных вызовов toLowerCase/parseInt.
// 4. Повышение надежности DOM: Добавлена проверка на наличие элемента в DOM (document.body.contains) в асинхронных функциях обновления UI.

(function() {
    'use strict';

    // --- Конфигурация плагина ---
    const LQE_CONFIG = {
        CACHE_VERSION: 3,
        LOGGING_GENERAL: true,
        LOGGING_QUALITY: true,
        LOGGING_CARDLIST: false,
        CACHE_VALID_TIME_MS: 3 * 24 * 60 * 60 * 1000, // 3 дня
        CACHE_REFRESH_THRESHOLD_MS: 12 * 60 * 60 * 1000, // 12 часов для фонового обновления
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
        
        // Полная карточка фильма
        FULL_CARD_LABEL_TEXT_COLOR: '#000',
        FULL_CARD_LABEL_BACKGROUND_COLOR: '#FFF',
        FULL_CARD_LABEL_FONT_WEIGHT: 'normal',
        FULL_CARD_LABEL_BORDER: '1px solid #FFF',
        FULL_CARD_LABEL_FONT_SIZE: '1.1em',
        FULL_CARD_LABEL_BORDER_RADIUS: '0.3em',
        FULL_CARD_LABEL_PADDING: '0.3em',

        // Маленькие карточки фильмов
        LIST_CARD_LABEL_BORDER_COLOR: '#FFFF00',
        LIST_CARD_LABEL_BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.7)',
        LIST_CARD_LABEL_TEXT_COLOR: '#FFF',
        LIST_CARD_LABEL_FONT_WEIGHT: '600',
        LIST_CARD_LABEL_FONT_SIZE: '1em'
    };

    let currentGlobalMovieId = null;
    
    const LQE_QUALITY_NO_INFO_CODE = 'NO_INFO';
    const LQE_QUALITY_NO_INFO_LABEL = 'N/A';
    const LQE_QUALITY_BAD_LABEL = 'BAD';

    // --- Модуль постоянного кэша (с TTL и лимитом размера) ---
    
    const LQE_CACHE_DEFAULT_TTL = LQE_CONFIG.CACHE_VALID_TIME_MS || (72 * 60 * 60 * 1000);
    const LQE_CACHE_DEFAULT_LIMIT = 100 * 1024; // 100KB
    let lqeQualityCacheStore = null;

    const lqeSupportsLampaStorage = () => {
        return !!(window.Lampa &&
            Lampa.Storage &&
            typeof Lampa.Storage.get === 'function' &&
            typeof Lampa.Storage.set === 'function');
    };

    /**
     * [Оптимизация v1.05] Используем оператор spread.
     */
    const lqeCloneCacheObject = (source) => {
        if (!source || typeof source !== 'object') {
            return {};
        }
        // Создаем поверхностную копию
        return { ...source };
    };

    const lqeSerializeSize = (obj) => {
        try {
            return JSON.stringify(obj).length;
        } catch (err) {
            return Infinity;
        }
    };

    const createLqePersistentCache = (storageKey, limitBytes, ttl) => {
        let memoryCache = {};
        limitBytes = typeof limitBytes === 'number' && limitBytes > 0 ? limitBytes : LQE_CACHE_DEFAULT_LIMIT;
        ttl = typeof ttl === 'number' && ttl > 0 ? ttl : LQE_CACHE_DEFAULT_TTL;

        const now = () => Date.now();

        const load = () => {
            let cache = memoryCache;
            if (lqeSupportsLampaStorage()) {
                try {
                    const stored = Lampa.Storage.get(storageKey);
                    if (typeof stored === 'string') {
                        cache = JSON.parse(stored || '{}') || {};
                    } else if (stored && typeof stored === 'object') {
                        cache = stored;
                    } else {
                        cache = {};
                    }
                } catch (err) {
                    cache = {};
                }
            }
            memoryCache = lqeCloneCacheObject(cache);
            return lqeCloneCacheObject(memoryCache);
        };

        const prune = (cache, lastKey) => {
            const keys = Object.keys(cache);
            const currentTime = now();
            
            // Удаляем просроченные элементы
            keys.forEach((key) => {
                const item = cache[key];
                if (!item || typeof item !== 'object' || !item.timestamp || currentTime - item.timestamp > ttl) {
                    delete cache[key];
                }
            });

            if (!limitBytes) {
                return cache;
            }

            // Ограничиваем по размеру (удаляем самые старые)
            const sortedKeys = Object.keys(cache).sort((a, b) => cache[a].timestamp - cache[b].timestamp);

            let size = lqeSerializeSize(cache);
            while (size > limitBytes && sortedKeys.length) {
                const candidate = sortedKeys.shift();
                if (candidate === lastKey && sortedKeys.length === 0) {
                    break;
                }
                delete cache[candidate];
                size = lqeSerializeSize(cache);
            }

            if (limitBytes && lastKey && cache[lastKey] && lqeSerializeSize(cache) > limitBytes) {
                delete cache[lastKey];
            }

            return cache;
        };

        const save = (cache, lastKey) => {
            const normalized = prune(lqeCloneCacheObject(cache), lastKey);
            memoryCache = normalized;
            if (lqeSupportsLampaStorage()) {
                try {
                    Lampa.Storage.set(storageKey, normalized);
                } catch (err) {
                    memoryCache = normalized;
                }
            }
        };

        return {
            get: (key) => {
                if (!key) return null;
                const cache = load();
                const item = cache[key];
                if (!item || typeof item !== 'object') {
                    return null;
                }
                if (now() - item.timestamp > ttl) {
                    delete cache[key];
                    save(cache);
                    return null;
                }
                return item.value;
            },
            set: (key, value) => {
                if (!key) return;
                const cache = load();
                cache[key] = {
                    value: value,
                    timestamp: now()
                };
                save(cache, key);
            }
        };
    };

    const getLqePersistentCacheStore = () => {
        if (!lqeQualityCacheStore) {
            lqeQualityCacheStore = createLqePersistentCache(
                LQE_CONFIG.CACHE_KEY,
                LQE_CACHE_DEFAULT_LIMIT,
                LQE_CONFIG.CACHE_VALID_TIME_MS
            );
        }
        return lqeQualityCacheStore;
    };
    
    // --- Модуль очереди сетевых запросов ---
    
    let lqeRequestQueue = [];
    let lqeActiveRequests = 0;
    const lqeMaxConcurrentRequests = 3;

    const processLqeRequestQueue = () => {
        if (lqeRequestQueue.length === 0 || lqeActiveRequests >= lqeMaxConcurrentRequests) {
            return;
        }
        const requestJob = lqeRequestQueue.shift();
        if (requestJob) {
            lqeActiveRequests++;
            
            const done = () => {
                lqeActiveRequests--;
                setTimeout(processLqeRequestQueue, 50);
            };
            
            requestAnimationFrame(() => {
                try {
                    requestJob(done);
                } catch (e) {
                    console.error("LQE-LOG", "Ошибка в задаче из очереди (LQE job failed):", e);
                    done();
                }
            });
        }
        
        if (lqeRequestQueue.length > 0 && lqeActiveRequests < lqeMaxConcurrentRequests) {
            setTimeout(processLqeRequestQueue, 0);
        }
    };

    const queueLqeRequest = (job) => {
        lqeRequestQueue.push(job);
        processLqeRequestQueue();
    };

    // --- Модуль ленивой загрузки (IntersectionObserver) ---
    
    const lqeCardVisibilityManager = (() => {
        const trackedCards = new WeakSet();
        const pendingCards = new Set();
        let frameId = null;
        const FALLBACK_MARGIN = 240;
        let isFallbackMode = typeof IntersectionObserver === 'undefined';
        let observer = null;

        const ensureObserver = () => {
            if (observer || isFallbackMode) return;
            try {
                observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (!entry || !entry.target) return;
                        if (entry.isIntersecting || entry.intersectionRatio > 0) {
                            enqueueCard(entry.target);
                            if (observer) observer.unobserve(entry.target);
                        }
                    });
                }, {
                    root: null,
                    threshold: 0.01,
                    rootMargin: '200px 0px'
                });
            } catch (err) {
                console.error("LQE-LOG", "IntersectionObserver init failed, falling back to eager mode.", err);
                observer = null;
                isFallbackMode = true;
            }
        };

        const isElementNearViewport = (element, margin) => {
            if (!element || typeof element.getBoundingClientRect !== 'function') return false;
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            margin = typeof margin === 'number' ? margin : 0;
            return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
        };
        
        const trackCard = (card) => {
            if (!card || trackedCards.has(card)) return;
            trackedCards.add(card);
            if (!isFallbackMode) {
                ensureObserver();
                if (observer) {
                    try {
                        observer.observe(card);
                    } catch (observeError) {}
                }
            }
        };

        const enqueueCard = (card) => {
            if (!card || !card.isConnected) return;
            if (card.__lqeVisibilityQueued) return;
            if (!isFallbackMode && observer && !isElementNearViewport(card, FALLBACK_MARGIN)) return;
            
            card.__lqeVisibilityQueued = true;
            pendingCards.add(card);
            if (!frameId) {
                frameId = requestAnimationFrame(flushQueue);
            }
        };

        const flushQueue = () => {
            frameId = null;
            const cards = Array.from(pendingCards);
            pendingCards.clear();
            cards.forEach((card) => {
                card.__lqeVisibilityQueued = false;
                processCard(card);
            });
        };

        const processCard = (card) => {
            if (!card || !card.isConnected) return;
            if (!isFallbackMode && observer && !isElementNearViewport(card, FALLBACK_MARGIN)) return;
            
            updateCardListQuality(card);
        };

        return {
            observe: (card) => {
                if (!card) return;
                trackCard(card);
                if (isFallbackMode) {
                    enqueueCard(card);
                } else {
                    requestAnimationFrame(() => {
                        if (!card || !card.isConnected) return;
                        if (card.hasAttribute('data-lqe-quality-processed') && isElementNearViewport(card, FALLBACK_MARGIN)) {
                            enqueueCard(card);
                            if (observer) observer.unobserve(card);
                        }
                    });
                }
            }
        };
    })();

    // --- Логика плагина: Хелперы для парсинга и скоринга ---

    /**
     * Карта для перевода специфических торрент-лейблов в упрощенные категории.
     * Используется как fallback, если не удалось определить качество по разрешению.
     */
    const QUALITY_DISPLAY_MAP = {
        // Группа самого высогого качества - 4K
        "4K Web-DL 10bit HDR P81 HEVC": "4K",
        "UHD Blu-ray disc 2160p": "4K",
        "DVDRip [AV1/2160p] [4K, SDR, 10-bit] [hand made Upscale AI]": "4K",
        "Hybrid (2160p)": "4K",
        "Blu-ray disc] [Mastered in 4K] [Extended Cut]": "4K",
        "4K, HEVC, HDR / Blu-Ray Remux (2160p)": "4K",
        "4K, HEVC, HDR, HDR10+, Dolby Vision P7 / Hybrid (2160p)": "4K",
        "4K, HEVC, HDR, Dolby Vision P7 / Blu-Ray Remux (2160p)": "4K",
        "4K, HEVC, HDR, Dolby Vision / Blu-Ray Remux (2160p)": "4K",
        "Blu-Ray Remux 2160p | 4K | HDR | Dolby Vision P7": "4K",
        "4K, HEVC, HDR / WEB-DLRip (2160p)": "4K",
        "blu-ray remux (2160p)": "4K",
        "hdtvrip 2160p": "4K",
        "hybrid 2160p": "4K",
        "web-dlrip (2160p)": "4K",
        "WEB-DL 2160p": "4K",
        "WEB-DL (2160p)": "4K",
        "4K Web-DL": "4K",
        "bluray": "4K",
        "bdremux": "4K",

        // Группа высокого качества
        "WEB-DLRip @ Синема УС": "1080",
        "Blu-ray disc 1080P": "1080",
        "Blu-Ray Remux (1080P)": "1080",
        "BDRemux 1080p": "1080",
        "Blu-ray disc (custom) 1080P]": "1080",
        "Blu-ray disc (custom) 1080P] [StudioCanal]": "1080",
        "webdl": "1080",
        "web-dl": "1080",
        "webrip": "1080",
        "web-dlrip": "1080",
        "1080p web-dlrip": "1080",
        "webdlrip": "1080",
        "hdtvrip-avc": "1080",
        "bdrip (1080)": "1080",
        "bdrip 1080": "1080",
        "HDTVRip (1080p)": "1080",
        "HDTV": "1080",
        
        // Группа среднего качества
        "HDTVRip [H.264/720p]": "720",
        "HDTVRip 720p": "720",
        "hdrip": "720",
        "hdtvrip (720p)": "720",
        "bdrip (720)": "720",
        "bdrip 720": "720",
        "bdrip": "720",
        "DVDRip": "720",
        
        // Группа низкого качества - 480p
        "SD": "SD",
        
        // Группа самого низкого качества - TS и CamRip
        "Telecine [H.264/1080P] [звук с TS] [AD]": "BAD",
        "WEBRip 1080p | AVC @ звук с TS": "BAD",
        "звук с TS": "BAD",
        "TeleSynch 1080P": "BAD",        
        "telecine": "BAD",
        "tc": "BAD",
        "ts": "BAD",
        "camrip": "CamRip"
    };

    /**
     * Список низкокачественных ключевых слов в виде RegExp для безопасного поиска (использует границы слова \b).
     */
    const LQE_LOW_QUALITY_REGEX_LIST = [
        /telesync/, /telecine/, /camrip/, /экранка/,
        /звук с ts/, /audio ts/, /ts audio/, /hdts/, /hdcam/, /hdtc/,
        /webrip с ts/, /webrp\.ts/, /web-dl с ts/, /web-dl ts/,
        /zets/, /zet-ts/,
        /\bts\b/, // Безопасная проверка на 'ts'
        /\bad\b/ // Безопасная проверка на 'ad'
    ];

    /**
     * Проверяет заголовок на наличие ключевых слов низкого качества.
     * @param {string} title
     * @returns {boolean}
     */
    const lqeCheckIsLowQuality = (title) => {
        if (!title) return false;
        const lowerTitle = title.toLowerCase();
        
        for (let i = 0; i < LQE_LOW_QUALITY_REGEX_LIST.length; i++) {
            if (LQE_LOW_QUALITY_REGEX_LIST[i].test(lowerTitle)) {
                if (LQE_CONFIG.LOGGING_QUALITY) {
                    console.log("LQE-QUALITY", "lqeCheckIsLowQuality: Matched low quality keyword:", LQE_LOW_QUALITY_REGEX_LIST[i].source);
                }
                return true;
            }
        }
        return false;
    };

    /**
     * Извлекает числовое разрешение (2160, 1080, 720 и т.д.) из заголовка.
     * @param {string} title
     * @returns {number}
     */
    const extractNumericQualityFromTitle = (title) => {
        if (!title) return 0;
        const lowerTitle = title.toLowerCase();
        
        if (lowerTitle.includes('4k') || lowerTitle.includes('4к')) return 2160;
        if (lowerTitle.includes('1440p')) return 1440;
        if (lowerTitle.includes('1080p') || lowerTitle.includes('1080i')) return 1080;
        if (lowerTitle.includes('720p')) return 720;
        if (lowerTitle.includes('480p')) return 480;
        if (lowerTitle.includes('360p')) return 360;
        
        const match = lowerTitle.match(/(\d{3,4})p/);
        return match ? parseInt(match[1], 10) : 0;
    };

    /**
     * [Оптимизация v1.05] Объединенная функция для получения лучшего числового разрешения.
     * @param {string} qualityCode - Числовой код качества (если есть).
     * @param {string} fullTorrentTitle - Полный заголовок торрента.
     * @returns {number}
     */
    const lqeGetBestNumericQuality = (qualityCode, fullTorrentTitle) => {
        // 1. Приоритет: qualityCode
        let numericQuality = parseInt(qualityCode, 10);
        if (!isNaN(numericQuality) && numericQuality > 0) {
            return numericQuality;
        }

        // 2. Fallback: Парсинг заголовка
        return extractNumericQualityFromTitle(fullTorrentTitle);
    };

    /**
     * Функция для перевода качества с логикой приоритетов.
     * Приоритет: BAD > Числовое разрешение > QUALITY_DISPLAY_MAP (fallback)
     */
    const translateQualityLabel = (qualityCode, fullTorrentTitle) => {
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Received qualityCode:", qualityCode, "fullTorrentTitle:", fullTorrentTitle);

        const lowerFullTorrentTitle = (fullTorrentTitle || '').toLowerCase();
        
        if (qualityCode === LQE_QUALITY_NO_INFO_CODE) {
            return LQE_QUALITY_NO_INFO_LABEL;
        }

        // Шаг 1: Проверка на низкое качество (TS, CamRIP)
        const isLowQuality = lqeCheckIsLowQuality(lowerFullTorrentTitle);
        if (isLowQuality) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Found low quality keyword. Triggering BAD category.");
            return LQE_QUALITY_BAD_LABEL;
        }

        // Шаг 2: Проверка по числовому разрешению (через объединенный хелпер)
        const numericQuality = lqeGetBestNumericQuality(qualityCode, lowerFullTorrentTitle);
        
        if (numericQuality > 0) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Using best determined resolution:", numericQuality);
            if (numericQuality >= 2160) return '4K';
            if (numericQuality >= 1440) return '2K';
            if (numericQuality >= 1080) return '1080';
            if (numericQuality >= 720) return '720';
            if (numericQuality >= 360) return 'SD';
        }

        // Шаг 3: Проверка по ручной карте (Fallback)
        for (const key in QUALITY_DISPLAY_MAP) {
            if (QUALITY_DISPLAY_MAP.hasOwnProperty(key)) {
                if (lowerFullTorrentTitle.includes(String(key).toLowerCase())) {
                    const finalDisplayLabel = QUALITY_DISPLAY_MAP[key];
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Found explicit direct map match. Displaying \"" + finalDisplayLabel + "\".");
                    return finalDisplayLabel;
                }
            }
        }

        // Шаг 4: Финальный fallback
        return LQE_QUALITY_NO_INFO_LABEL;
    };

    /**
     * Извлекает год из заголовка торрента.
     * @param {string} title
     * @returns {number}
     */
    const extractYearFromTitle = (title) => {
        if (!title) return 0;
        // Ищем год (19xx или 20xx) в круглых (), квадратных [], слэшах / / или точках . .
        const match = title.match(/[\(\[\/\.\s]((19|20)\d{2})[\)\]\/\.\s]/);
        return match ? parseInt(match[1], 10) : 0;
    };

    /**
     * Очищает заголовок для более надежного сравнения (удаляет пунктуацию, приводит к нижнему регистру).
     * @param {string} title
     * @returns {string}
     */
    const lqeCleanTitleForComparison = (title) => {
        if (!title) return '';
        let cleaned = title.toLowerCase();
        cleaned = cleaned.replace(/щ/g, 'ш');
        cleaned = cleaned.replace(/ё/g, 'е');
        cleaned = cleaned.replace(/[^a-zа-я0-9\s]/g, ' ');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    };

    /**
     * [Оптимизация v1.05] Принимает предварительно обработанные данные.
     * @param {string} lowerTitle - Заголовок в нижнем регистре.
     * @param {number} numericQuality - Предварительно определенное числовое разрешение.
     * @param {string|number} torrentYear - Год релиза торрента из JacRed (если есть).
     * @param {number} searchYearNum - Год из TMDB.
     * @param {string} cardId
     * @param {boolean} isTvSeries
     * @returns {number}
     */
    const calculateTorrentScore = (lowerTitle, numericQuality, torrentYear, searchYearNum, cardId, isTvSeries) => {
        let score = 0;

        // 1. Оценка за качество (основной вес)
        if (numericQuality >= 2160) score += 10000;
        else if (numericQuality >= 1440) score += 7500;
        else if (numericQuality >= 1080) score += 5000;
        else if (numericQuality >= 720) score += 2000;
        else if (numericQuality >= 360) score += 500;

        // 2. Оценка за соответствие году
        if (searchYearNum) {
            const parsedYear = parseInt(torrentYear, 10) || extractYearFromTitle(lowerTitle);
            if (parsedYear > 0) {
                if (isTvSeries) {
                    // Бонус для сериалов
                    if (parsedYear === searchYearNum) {
                        score += 1000;
                    }
                } else {
                    // Строгая логика для фильмов
                    const yearDiff = Math.abs(parsedYear - searchYearNum);
                    if (yearDiff === 0) {
                        score += 2000;
                    } else if (yearDiff === 1) {
                        score += 1000;
                    } else {
                        score -= 100000; // Критический штраф за несовпадение года
                    }
                }
            }
        }

        // 3. Штраф за низкое качество
        if (lqeCheckIsLowQuality(lowerTitle)) {
            score -= 10000;
        }

        // 4. Бонус за высококачественные маркеры
        if (lowerTitle.includes('bdremux') || lowerTitle.includes('bd-disk') || lowerTitle.includes('blu-ray')) score += 500;
        if (lowerTitle.includes('hevc') && numericQuality >= 1080) score += 300;
        
        return score;
    };

    /**
     * Получает лучший релиз с JacRed, кэширует его и возвращает результат.
     * @param {object} normalizedCard
     * @param {string} cardId
     * @param {function(object|null): void} callback
     */
    const getBestReleaseFromJacred = (normalizedCard, cardId, callback) => {
        const cacheStore = getLqePersistentCacheStore();
        const cacheKey = normalizedCard.id + '_' + (normalizedCard.type || 'movie') + '_v' + LQE_CONFIG.CACHE_VERSION;
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Cache Hit.", cached.quality);
            const now = Date.now();
            if (now - cached.timestamp < LQE_CONFIG.CACHE_REFRESH_THRESHOLD_MS) {
                return callback(cached);
            }
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Cache expired, running silent refresh.");
            
            // Запускаем тихий запрос в очередь, но возвращаем старый кэш
            queueLqeRequest((done) => {
                fetchJacredAndProcess(normalizedCard, cardId, (result) => {
                    done();
                }, false);
            });

            return callback(cached);
        }

        fetchJacredAndProcess(normalizedCard, cardId, (result) => {
            if (result && result.quality !== LQE_QUALITY_NO_INFO_CODE) {
                cacheStore.set(cacheKey, result);
            }
            callback(result);
        });
    };

    /**
     * Непосредственно выполняет запрос к JacRed и выбирает лучший торрент.
     * @param {object} normalizedCard
     * @param {string} cardId
     * @param {function(object|null): void} callback
     * @param {boolean} [shouldUpdateUI=true]
     */
    const fetchJacredAndProcess = (normalizedCard, cardId, callback, shouldUpdateUI = true) => {
        const dateStr = normalizedCard.release_date || normalizedCard.first_air_date;
        const isTvSeries = normalizedCard.type === 'tv' || normalizedCard.name;
        
        let searchYearNum = 0;
        if (dateStr) {
            searchYearNum = parseInt(dateStr.substring(0, 4), 10);
            if (isTvSeries) {
                const currentYear = new Date().getFullYear().toString();
                if (dateStr.substring(0, 4) === currentYear) {
                    searchYearNum = 0; // Для текущих сериалов не ищем по году
                }
            }
        }
        
        const jacredUrl = LQE_CONFIG.JACRED_PROTOCOL + LQE_CONFIG.JACRED_URL + '/?cat=' + (isTvSeries ? 'tv' : 'movie') + '&id=' + normalizedCard.id + '&api_key=' + LQE_CONFIG.JACRED_API_KEY;

        fetchWithProxy(jacredUrl, cardId, (error, data) => {
            if (error) {
                console.error("LQE-LOG", "card: " + cardId + ", JacRed Fetch Error:", error.message);
                return callback(null);
            }

            try {
                const json = JSON.parse(data);
                const torrents = json.torrents || [];
                let bestTorrent = null;
                let maxScore = -Infinity;

                if (torrents.length === 0) {
                    if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", JacRed: No torrents found.");
                    return callback({
                        quality: LQE_QUALITY_NO_INFO_CODE,
                        label: LQE_QUALITY_NO_INFO_LABEL
                    });
                }

                torrents.forEach((currentTorrent) => {
                    const torrentYearFromObject = currentTorrent.released || currentTorrent.year;

                    // [Оптимизация v1.05] Предварительная обработка данных для скоринга
                    const torrentLowerTitle = currentTorrent.title.toLowerCase();
                    const torrentNumericQuality = lqeGetBestNumericQuality(currentTorrent.quality, currentTorrent.title);

                    const currentScore = calculateTorrentScore(
                        torrentLowerTitle,
                        torrentNumericQuality,
                        torrentYearFromObject,
                        searchYearNum,
                        cardId,
                        isTvSeries
                    );

                    if (currentScore > maxScore) {
                        maxScore = currentScore;
                        bestTorrent = currentTorrent;
                    }
                });

                if (bestTorrent) {
                    const qualityLabel = translateQualityLabel(bestTorrent.quality, bestTorrent.title);
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Best quality found:", qualityLabel, "Title:", bestTorrent.title, "Score:", maxScore);
                    
                    return callback({
                        quality: bestTorrent.quality,
                        label: qualityLabel,
                        score: maxScore,
                        timestamp: Date.now()
                    });
                }

                return callback(null);

            } catch (e) {
                console.error("LQE-LOG", "card: " + cardId + ", JacRed Processing Error:", e);
                return callback(null);
            }
        }, shouldUpdateUI);
    };

    // --- Логика обновления UI ---

    /**
     * Обрабатывает и обновляет метку качества на полной карточке.
     * @param {object} data - Данные о фильме/сериале из TMDB.
     * @param {object} renderElement - jQuery-объект DOM-элемента карточки.
     */
    const processFullCardQuality = (data, renderElement) => {
        const cardId = data.id + (data.media_type === 'tv' ? '-tv' : '-movie');
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Processing full card for ID:", cardId);

        if (data.media_type === 'tv' && !LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES) return;

        // Функция для обновления UI после получения данных
        const updateUI = (qualityLabel) => {
            // [Оптимизация v1.05] Проверка на наличие элемента в DOM
            if (!renderElement || !document.body.contains(renderElement[0])) {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card update skipped: Element not in DOM.");
                return;
            }

            removeLoadingAnimation(cardId, renderElement);

            if (qualityLabel && qualityLabel !== LQE_QUALITY_NO_INFO_LABEL) {
                let qualityElement = $('.full-start-new__rate-line .lqe-quality', renderElement);
                if (!qualityElement.length) {
                    qualityElement = $('<div class="lqe-quality"></div>');
                    $('.full-start-new__rate-line', renderElement).prepend(qualityElement);
                }
                qualityElement.text(qualityLabel);
            }
        };

        // 1. Показываем анимацию загрузки
        addLoadingAnimation(cardId, renderElement);

        // 2. Ставим запрос в очередь
        queueLqeRequest((done) => {
            getBestReleaseFromJacred(data, cardId, (result) => {
                if (result) {
                    updateUI(result.label);
                } else {
                    updateUI(LQE_QUALITY_NO_INFO_LABEL);
                }
                done();
            });
        });
    };

    /**
     * Обрабатывает и обновляет метку качества на маленьких карточках в списке.
     * @param {HTMLElement} cardElement - Нативный DOM-элемент карточки.
     */
    const updateCardListQuality = (cardElement) => {
        // [Оптимизация v1.05] Проверка на наличие элемента в DOM
        if (!cardElement || !document.body.contains(cardElement)) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", "Card list update skipped: Element not in DOM or invalid.");
            return;
        }

        const data = Lampa.Template.get-data(cardElement, 'data');
        if (!data || !data.id) return;
        
        const isTvSeries = data.media_type === 'tv' || data.name;
        if (isTvSeries && !LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES) return;

        const cardId = data.id + (isTvSeries ? '-tv' : '-movie');
        if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", "Processing list card for ID:", cardId);

        // Функция для обновления UI после получения данных
        const updateUI = (qualityLabel) => {
            // Повторная проверка, так как эта функция вызывается асинхронно
            if (!cardElement || !document.body.contains(cardElement)) {
                if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-LOG", "Card list update (async) skipped: Element no longer in DOM.");
                return;
            }

            if (qualityLabel && qualityLabel !== LQE_QUALITY_NO_INFO_LABEL) {
                const $card = $(cardElement);
                let qualityElement = $card.find('.card__quality.lqe-quality');
                
                if (!qualityElement.length) {
                    // Создаем новый элемент, если его нет
                    qualityElement = $('<div class="card__quality lqe-quality"></div>');
                    $card.find('.card__view').append(qualityElement);
                }
                qualityElement.text(qualityLabel);
            }
        };

        // 1. Ставим заглушку, чтобы избежать повторной обработки
        cardElement.setAttribute('data-lqe-quality-processed', 'true');

        // 2. Ставим запрос в очередь
        queueLqeRequest((done) => {
            getBestReleaseFromJacred(data, cardId, (result) => {
                if (result) {
                    updateUI(result.label);
                }
                done();
            });
        });
    };

    // --- Инициализация и обработчики событий ---

    const fetchWithProxy = (url, cardId, callback) => {
        let currentProxyIndex = -1;
        let callbackCalled = false;
        let controller = new AbortController();
        let signal = controller.signal;

        const tryNext = () => {
            currentProxyIndex++;
            let fetchUrl;

            if (currentProxyIndex === 0) {
                // Попытка 1: Прямой запрос
                fetchUrl = url;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch direct: " + fetchUrl);
            } else if (currentProxyIndex <= LQE_CONFIG.PROXY_LIST.length) {
                // Последующие попытки: Прокси
                const proxyIndex = currentProxyIndex - 1;
                fetchUrl = LQE_CONFIG.PROXY_LIST[proxyIndex] + encodeURIComponent(url);
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch with proxy " + (proxyIndex + 1) + ": " + LQE_CONFIG.PROXY_LIST[proxyIndex].substring(0, 20) + '...');
            } else {
                // Все попытки провалились
                if (!callbackCalled) {
                    callbackCalled = true;
                    callback(new Error('All fetch strategies failed for ' + url));
                }
                return;
            }

            const timeoutMs = (currentProxyIndex === 0) ? 5000 : LQE_CONFIG.PROXY_TIMEOUT_MS;
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, timeoutMs);

            fetch(fetchUrl, { signal: signal })
                .then((response) => {
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        throw new Error('Fetch error: ' + response.status);
                    }
                    return response.text();
                })
                .then((data) => {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        callback(null, data);
                    }
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch timeout for " + fetchUrl);
                    } else {
                        console.error("LQE-LOG", "card: " + cardId + ", Fetch error for " + fetchUrl + ":", error.message);
                    }
                    
                    if (!callbackCalled) {
                        controller = new AbortController();
                        signal = controller.signal;
                        tryNext();
                    }
                });
        };
        
        tryNext();
    };

    const addLoadingAnimation = (cardId, renderElement) => {
        if (!renderElement) return;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Add loading animation");
        const rateLine = $('.full-start-new__rate-line', renderElement);
        if (!rateLine.length || $('.loading-dots-container', rateLine).length) return;
        
        rateLine.append(
            '<div class="loading-dots-container">' +
            '<div class="loading-dots">' +
            '<span class="loading-dots__text">Загрузка...</span>' +
            '<span class="loading-dots__dot"></span>' +
            '<span class="loading-dots__dot"></span>' +
            '<span class="loading-dots__dot"></span>' +
            '</div>' +
            '</div>'
        );
    };

    const removeLoadingAnimation = (cardId, renderElement) => {
        if (!renderElement) return;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Remove loading animation");
        $('.loading-dots-container', renderElement).remove();
    };

    // --- Стили ---
    
    const styleLQE = "<style id=\"lampa_quality_styles\">" +
    ".full-start-new__rate-line {" +
    "flex-wrap: wrap;" +
    "gap: 0.4em 0;" +
    "}" +
    ".full-start-new__rate-line > * {" +
    "margin-right: 0.4em !important;" +
    "flex-shrink: 0;" +
    "flex-grow: 0;" +
    "}" +
    ".full-start-new__rate-line .full-start__pg, .full-start-new__rate-line .full-start__status, .full-start-new__rate-line .lqe-quality{" +
    " font-weight: " + LQE_CONFIG.FULL_CARD_LABEL_FONT_WEIGHT + ";" +
    " font-size: " + LQE_CONFIG.FULL_CARD_LABEL_FONT_SIZE + ";" +
    " border-radius: " + LQE_CONFIG.FULL_CARD_LABEL_BORDER_RADIUS + ";" +
    " padding: " + LQE_CONFIG.FULL_CARD_LABEL_PADDING + ";" +
    "}" +
    ".lqe-quality {" +
    " min-width: 2.8em;" +
    " text-align: center;" +
    " text-transform: none;" +
    " border: " + LQE_CONFIG.FULL_CARD_LABEL_BORDER + ";" +
    " background-color: " + LQE_CONFIG.FULL_CARD_LABEL_BACKGROUND_COLOR + ";" +
    " color: " + LQE_CONFIG.FULL_CARD_LABEL_TEXT_COLOR + ";" +
    "}" +
    ".card__view {" +
    " position: relative !important;" +
    "}" +
    ".card__icons-inner, .card__quality, .card__vote {" +
    " background-color: " + LQE_CONFIG.LIST_CARD_LABEL_BACKGROUND_COLOR + ";" +
    " border-radius: 0.7em;" +
    "}" +
    ".card__icons-inner {" +
    " flex-direction: column-reverse;" +
    " justify-content: center;" +
    " flex-wrap: wrap;" +
    " align-content: center;" +
    "}" +
    ".card__quality, .card__vote {" +
    " padding: 0.4em 0.6em;" +
    " font-size: " + LQE_CONFIG.LIST_CARD_LABEL_FONT_SIZE + ";" +
    " font-weight: " + LQE_CONFIG.LIST_CARD_LABEL_FONT_WEIGHT + ";" +
    " color: " + LQE_CONFIG.LIST_CARD_LABEL_TEXT_COLOR + ";" +
    " white-space: nowrap;" +
    " text-shadow: 0.5px 0.5px 1px rgba(0,0,0,0.3) !important;" +
    "}" +
    ".card__icons {" +
    " top: 0.3em;" +
    " left: unset;" +
    " right: 0.3em;" +
    "}" +    
    ".card__quality {" +
    " position: absolute !important;" +
    " bottom: unset;" +
    " top: 0.3em;" +
    " left: 0.3em;" +
    " z-index: 1;" +
    " width: fit-content;" +
    " max-width: calc(100% - 1em);" +
    " overflow: hidden;" +
    " text-transform: uppercase;" +    
    "}" +
    "</style>";

    Lampa.Template.add('lampa_quality_css', styleLQE);
    $('body').append(Lampa.Template.get('lampa_quality_css', {}, true));

    const loadingStylesLQE = "<style id=\"lampa_quality_loading_animation\">" +
        ".loading-dots-container {" +
        "    position: absolute;" +
        "    top: 50%;" +
        "    left: 0;" +
        "    right: 0;" +
        "    text-align: left;" +
        "    transform: translateY(-50%);" +
        "    z-index: 10;" +
        "}" +
        ".full-start-new__rate-line {" +
        "    position: relative;" +
        "}" +
        ".loading-dots {" +
        "    display: inline-flex;" +
        "    align-items: center;" +
        "    gap: 0.4em;" +
        "    color: #ffffff;" +
        "    font-size: 0.7em;" +
        "    background: rgba(0, 0, 0, 0.3);" +
        "    padding: 0.6em 1em;" +
        "    border-radius: 0.5em;" +
        "}" +
        ".loading-dots__dot {" +
        "    width: 0.5em;" +
        "    height: 0.5em;" +
        "    border-radius: 50%;" +
        "    background-color: currentColor;" +
        "    opacity: 0.3;" +
        "    animation: loading-dots-fade 1.5s infinite both;" +
        "}" +
        ".loading-dots__dot:nth-child(1) {" +
        "    animation-delay: 0s;" +
        "}" +
        ".loading-dots__dot:nth-child(2) {" +
        "    animation-delay: 0.5s;" +
        "}" +
        ".loading-dots__dot:nth-child(3) {" +
        "    animation-delay: 1s;" +
        "}" +
        "@keyframes loading-dots-fade {" +
        "    0%, 90%, 100% { opacity: 0.3; }" +
        "    35% { opacity: 1; }" +
        "}" +
        "@media screen and (max-width: 480px) { .loading-dots-container { -webkit-justify-content: center; justify-content: center; text-align: center; max-width: 100%; }}" +
        "</style>";

    Lampa.Template.add('lampa_quality_loading_animation_css', loadingStylesLQE);
    $('body').append(Lampa.Template.get('lampa_quality_loading_animation_css', {}, true));

    // --- Основная инициализация ---

    const initializeLampaQualityPlugin = () => {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Lampa Quality Enhancer: Plugin Initialization Started! (v1.05)");
        window.lampaQualityPlugin = true;

        // Обработчик для списков карточек, использует MutationObserver
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        // Ищем элементы карточек
                        if (node.nodeType === 1 && node.classList.contains('card')) {
                            // Проверяем, что не обрабатывали
                            if (!node.hasAttribute('data-lqe-quality-processed')) {
                                lqeCardVisibilityManager.observe(node);
                            }
                        }
                        // Ищем карточки внутри добавленных элементов (например, когда добавляется вся строка с постерами)
                        $(node).find('.card').each(function() {
                            if (!this.hasAttribute('data-lqe-quality-processed')) {
                                lqeCardVisibilityManager.observe(this);
                            }
                        });
                    });
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        if (LQE_CONFIG.LOGGING_GENERAL) console.log('LQE-LOG: Initial observer for card lists started.');

        // Обработчик для полной карточки фильма/сериала
        Lampa.Listener.follow('full', (event) => {
            if (event.type === 'complite') {
                const renderElement = event.object.activity.render();
                currentGlobalMovieId = event.data.movie.id;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'complite' for ID:", currentGlobalMovieId);
                processFullCardQuality(event.data.movie, renderElement);
            }
        });
        
        // Очистка при закрытии полной карточки
        Lampa.Listener.follow('full', (event) => {
            if (event.type === 'destroy') {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'destroy'. Clearing global ID.");
                currentGlobalMovieId = null;
            }
        });
    };

    if (!window.lampaQualityPlugin) {
        initializeLampaQualityPlugin();
    } else {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Plugin already loaded. Skipping initialization...");
    }
})();
