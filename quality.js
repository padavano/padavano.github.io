// Версия 1.03
// Ссылка на плагин: https://padavano.github.io/quality.js
// [ИЗМЕНЕНИЯ v1.03]
// 1. Изменен приоритет определения качества: сначала используется свойство 'quality', 
//    а 'title' парсится только как резервный вариант (в calculateTorrentScore).
// 2. Добавлена логика обработки 1440p (2K) и 360p (SD) в calculateTorrentScore.
// 3. Расширен диапазон 'SD' в translateQualityLabel для включения 360p.

(function() {
    'use strict';

    var LQE_CONFIG = {
        CACHE_VERSION: 2,
        LOGGING_GENERAL: true,
        LOGGING_QUALITY: true,
        LOGGING_CARDLIST: false,
        CACHE_VALID_TIME_MS: 3 * 24 * 60 * 60 * 1000, // 3 дня
        CACHE_REFRESH_THRESHOLD_MS: 12 * 60 * 60 * 1000, // 12 часов для фонового обновления
        CACHE_KEY: 'lampa_quality_cache', // Имя файла кэша в Lampa.Storage
        JACRED_PROTOCOL: 'https://',
        JACRED_URL: 'jacred.xyz',
        JACRED_API_KEY: '',
        PROXY_LIST: [
            'http://api.allorigins.win/raw?url=',
            'http://cors.bwa.workers.dev/'
        ],
        PROXY_TIMEOUT_MS: 5000, // 5 секунд на каждую попытку
        SHOW_QUALITY_FOR_TV_SERIES: true,
        
        //Полная карточка фильма
        FULL_CARD_LABEL_TEXT_COLOR: '#000',
        FULL_CARD_LABEL_BACKGROUND_COLOR: '#FFF',
        FULL_CARD_LABEL_FONT_WEIGHT: 'normal',
        FULL_CARD_LABEL_BORDER: '1px solid #FFF',
        FULL_CARD_LABEL_FONT_SIZE: '1.1em',
        FULL_CARD_LABEL_BORDER_RADIUS: '0.3em',
        FULL_CARD_LABEL_PADDING: '0.3em',

        //Маленькие карточки фильмов
        LIST_CARD_LABEL_BORDER_COLOR: '#FFFF00',
        LIST_CARD_LABEL_BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.7)',
        LIST_CARD_LABEL_TEXT_COLOR: '#FFF',
        LIST_CARD_LABEL_FONT_WEIGHT: '600',
        LIST_CARD_LABEL_FONT_SIZE: '1em'
    };

    var currentGlobalMovieId = null;
    
    var LQE_QUALITY_NO_INFO_CODE = 'NO_INFO';
    var LQE_QUALITY_NO_INFO_LABEL = 'N/A';

    // --- Модуль постоянного кэша (с TTL и лимитом размера) ---
    
    var LQE_CACHE_DEFAULT_TTL = LQE_CONFIG.CACHE_VALID_TIME_MS || (72 * 60 * 60 * 1000);
    var LQE_CACHE_DEFAULT_LIMIT = 100 * 1024; // 100KB
    var lqeQualityCacheStore = null;

    function lqeSupportsLampaStorage() {
        return !!(window.Lampa &&
            Lampa.Storage &&
            typeof Lampa.Storage.get === 'function' &&
            typeof Lampa.Storage.set === 'function');
    }

    function lqeCloneCacheObject(source) {
        var clone = {};
        if (!source || typeof source !== 'object') {
            return clone;
        }
        Object.keys(source).forEach(function(key) {
            clone[key] = source[key];
        });
        return clone;
    }

    function lqeSerializeSize(obj) {
        try {
            return JSON.stringify(obj).length;
        } catch (err) {
            return Infinity;
        }
    }

    function createLqePersistentCache(storageKey, limitBytes, ttl) {
        var memoryCache = {};
        limitBytes = typeof limitBytes === 'number' && limitBytes > 0 ? limitBytes : LQE_CACHE_DEFAULT_LIMIT;
        ttl = typeof ttl === 'number' && ttl > 0 ? ttl : LQE_CACHE_DEFAULT_TTL;

        function now() {
            return Date.now();
        }

        function load() {
            var cache = memoryCache;
            if (lqeSupportsLampaStorage()) {
                try {
                    var stored = Lampa.Storage.get(storageKey);
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
        }

        function prune(cache, lastKey) {
            var keys = Object.keys(cache);
            var currentTime = now();
            keys.forEach(function(key) {
                var item = cache[key];
                if (!item || typeof item !== 'object' || !item.timestamp || currentTime - item.timestamp > ttl) {
                    delete cache[key];
                }
            });

            if (!limitBytes) {
                return cache;
            }

            var sortedKeys = Object.keys(cache).sort(function(a, b) {
                return cache[a].timestamp - cache[b].timestamp;
            });

            var size = lqeSerializeSize(cache);
            while (size > limitBytes && sortedKeys.length) {
                var candidate = sortedKeys.shift();
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
        }

        function save(cache, lastKey) {
            var normalized = prune(lqeCloneCacheObject(cache), lastKey);
            memoryCache = normalized;
            if (lqeSupportsLampaStorage()) {
                try {
                    Lampa.Storage.set(storageKey, normalized);
                } catch (err) {
                    memoryCache = normalized;
                }
            }
        }

        return {
            get: function(key) {
                if (!key) return null;
                var cache = load();
                var item = cache[key];
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
            set: function(key, value) {
                if (!key) return;
                var cache = load();
                cache[key] = {
                    value: value,
                    timestamp: now()
                };
                save(cache, key);
            }
        };
    }

    function getLqePersistentCacheStore() {
        if (!lqeQualityCacheStore) {
            lqeQualityCacheStore = createLqePersistentCache(
                LQE_CONFIG.CACHE_KEY,
                LQE_CACHE_DEFAULT_LIMIT,
                LQE_CONFIG.CACHE_VALID_TIME_MS
            );
        }
        return lqeQualityCacheStore;
    }
    
    // --- Модуль очереди сетевых запросов ---
    
    var lqeRequestQueue = [];
    var lqeActiveRequests = 0;
    var lqeMaxConcurrentRequests = 3; // Не более 3 одновременных запросов к JacRed

    function processLqeRequestQueue() {
        if (lqeRequestQueue.length === 0 || lqeActiveRequests >= lqeMaxConcurrentRequests) {
            return;
        }
        var requestJob = lqeRequestQueue.shift();
        if (requestJob) {
            lqeActiveRequests++;
            
            var done = function() {
                lqeActiveRequests--;
                setTimeout(processLqeRequestQueue, 50); // Небольшая задержка перед следующим
            };
            
            // Запускаем задачу
            requestAnimationFrame(function() {
                try {
                    requestJob(done);
                } catch (e) {
                    console.error("LQE-LOG", "Ошибка в задаче из очереди (LQE job failed):", e);
                    done(); // Убедимся, что очередь продолжится, даже если задача провалилась
                }
            });
        }
        // Проверяем, можем ли запустить еще
        if (lqeRequestQueue.length > 0 && lqeActiveRequests < lqeMaxConcurrentRequests) {
            setTimeout(processLqeRequestQueue, 0);
        }
    }

    function queueLqeRequest(job) {
        lqeRequestQueue.push(job);
        processLqeRequestQueue();
    }

    // --- Модуль ленивой загрузки (IntersectionObserver) ---
    
    var lqeCardVisibilityManager = (function() {
        var trackedCards = new WeakSet();
        var pendingCards = new Set();
        var frameId = null;
        var FALLBACK_MARGIN = 240;
        var isFallbackMode = typeof IntersectionObserver === 'undefined';
        var observer = null;

        function ensureObserver() {
            if (observer || isFallbackMode) return;
            try {
                observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (!entry || !entry.target) return;
                        if (entry.isIntersecting || entry.intersectionRatio > 0) {
                            enqueueCard(entry.target);
                            if (observer) observer.unobserve(entry.target); // Наблюдаем только один раз
                        }
                    });
                }, {
                    root: null,
                    threshold: 0.01,
                    rootMargin: '200px 0px' // Начать загрузку за 200px до появления
                });
            } catch (err) {
                console.error("LQE-LOG", "IntersectionObserver init failed, falling back to eager mode.", err);
                observer = null;
                isFallbackMode = true;
            }
        }

        function isElementNearViewport(element, margin) {
            if (!element || typeof element.getBoundingClientRect !== 'function') return false;
            var rect = element.getBoundingClientRect();
            var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            margin = typeof margin === 'number' ? margin : 0;
            return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
        }
        
        function trackCard(card) {
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
        }

        function enqueueCard(card) {
            if (!card || !card.isConnected) return;
            // Флаг 'data-lqe-quality-processed' устанавливается в MutationObserver, 
            // что гарантирует, что заглушка уже вставлена.
            if (card.__lqeVisibilityQueued) return;
            if (!isFallbackMode && observer && !isElementNearViewport(card, FALLBACK_MARGIN)) return;
            
            card.__lqeVisibilityQueued = true;
            pendingCards.add(card);
            if (!frameId) {
                frameId = requestAnimationFrame(flushQueue);
            }
        }

        function flushQueue() {
            frameId = null;
            var cards = Array.from(pendingCards);
            pendingCards.clear();
            cards.forEach(function(card) {
                card.__lqeVisibilityQueued = false;
                processCard(card);
            });
        }

        function processCard(card) {
            if (!card || !card.isConnected) return;
            if (!isFallbackMode && observer && !isElementNearViewport(card, FALLBACK_MARGIN)) return;
            
            updateCardListQuality(card);
        }

        return {
            observe: function(card) {
                if (!card) return;
                trackCard(card);
                if (isFallbackMode) {
                    enqueueCard(card); // Старый режим: обрабатывать сразу
                } else {
                    // Новый режим: проверить, видим ли уже
                    requestAnimationFrame(function() {
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

    // --- Логика плагина ---

    /**
     * Карта для перевода специфических торрент-лейблов в упрощенные категории.
     */
    var QUALITY_DISPLAY_MAP = {
        //Группа самого высогого качества - 4K
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
        "2160p": "4K",
        "4k": "4K",
        "4К": "4K",
        "blu-ray remux (2160p)": "4K",
        "hdtvrip 2160p": "4K",
        "hybrid 2160p": "4K",
        "web-dlrip (2160p)": "4K",
        "WEB-DL 2160p": "4K",
        "WEB-DL (2160p)": "4K",
        "4K Web-DL": "4K",
        "bluray": "4K",
        "bdremux": "4K",

        //Группа высокого качества
        "WEB-DLRip @ Синема УС": "1080",
        "Blu-ray disc 1080P": "1080",
        "Blu-Ray Remux (1080P)": "1080",
        "BDRemux 1080p": "1080",
        "Blu-ray disc (custom) 1080P]": "1080",
        "Blu-ray disc (custom) 1080P] [StudioCanal]": "1080",
        "1080p": "1080",
        "1080": "1080",
        "1080i": "1080",
        "hdtv 1080i": "1080",
        "webdl": "1080",
        "web-dl": "1080",
        "web-dl (1080p)": "1080",
        "web-dl 1080p": "1080",
        "webrip": "1080",
        "web-dlrip": "1080",
        "1080p web-dlrip": "1080",
        "webdlrip": "1080",
        "hdtvrip-avc": "1080",
        "bdrip (1080)": "1080",
        "bdrip 1080": "1080",
        "HDTVRip (1080p)": "1080",
        "HDTV": "1080",
        
        //Группа среднего качества
        "HDTVRip [H.264/720p]": "720",
        "HDTVRip 720p": "720",
        "hdrip": "720",
        "hdtvrip (720p)": "720",
        "bdrip (720)": "720",
        "bdrip 720": "720",
        "bdrip": "720",
        "DVDRip": "720",
        "720p": "720",
        "720": "720",
        
        //Группа низкого качества - 480p
        "SD": "SD",
        "480p": "SD",
        "480": "SD",
        
        //Группа самого низкого качества - TS и CamRip
        "Telecine [H.264/1080P] [звук с TS] [AD]": "TS",
        "WEBRip 1080p | AVC @ звук с TS": "TS",
        "звук с TS": "TS",
        "TeleSynch 1080P": "TS",        
        "telecine": "TS",
        "tc": "TS",
        "ts": "TS",
        "camrip": "CamRip"
    };

    /**
     * Список низкокачественных ключевых слов, которые имеют приоритет.
     */
    var LQE_LOW_QUALITY_KEYWORDS = [
        'telesync', 'telecine', 'camrip', 'экранка',
        'звук с ts', 'audio ts', 'ts audio', 'hdts', 'hdcam', 'hdtc',
        'webrip с ts', 'webrp.ts', 'web-dl с ts', 'web-dl ts',
        'zets', 'zet-ts'
    ];

    var QUALITY_PRIORITY_ORDER = [
        'resolution',
        'source',
    ];

    // СТИЛИ
    var styleLQE = "<style id=\"lampa_quality_styles\">" +
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

    // СТИЛИ
    var loadingStylesLQE = "<style id=\"lampa_quality_loading_animation\">" +
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
        ".loading-dots__text {" +
        "    margin-right: 1em;" +
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

    function fetchWithProxy(url, cardId, callback) {
        var currentProxyIndex = -1; // Начинаем с -1 для прямого запроса
        var callbackCalled = false;
        var controller = new AbortController();
        var signal = controller.signal;

        function tryNext() {
            currentProxyIndex++;
            var fetchUrl;

            if (currentProxyIndex === 0) {
                // Попытка: Прямой запрос
                fetchUrl = url;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch direct: " + fetchUrl);
            } else if (currentProxyIndex <= LQE_CONFIG.PROXY_LIST.length) {
                // Попытка: Прокси
                var proxyIndex = currentProxyIndex - 1;
                fetchUrl = LQE_CONFIG.PROXY_LIST[proxyIndex] + encodeURIComponent(url);
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch with proxy " + (proxyIndex + 1) + ": " + fetchUrl);
            } else {
                // Все попытки провалились
                if (!callbackCalled) {
                    callbackCalled = true;
                    callback(new Error('All fetch strategies failed for ' + url));
                }
                return;
            }

            var timeoutMs = (currentProxyIndex === 0) ? 5000 : LQE_CONFIG.PROXY_TIMEOUT_MS; // 5 секунд для прямого
            var timeoutId = setTimeout(function() {
                controller.abort(); // Отменяем fetch по тайм-ауту
            }, timeoutMs);

            fetch(fetchUrl, { signal: signal })
                .then(function(response) {
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        throw new Error('Fetch error: ' + response.status + (currentProxyIndex === 0 ? " (Direct)" : " (Proxy)"));
                    }
                    return response.text();
                })
                .then(function(data) {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        callback(null, data);
                    }
                })
                .catch(function(error) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch timeout for " + fetchUrl);
                    } else {
                        console.error("LQE-LOG", "card: " + cardId + ", Fetch error for " + fetchUrl + ":", error.message);
                    }
                    
                    if (!callbackCalled) {
                        controller = new AbortController(); // Нужен новый контроллер для следующей попытки
                        signal = controller.signal;
                        tryNext(); // Пробуем следующую стратегию
                    }
                });
        }
        
        tryNext();
    }

    function addLoadingAnimation(cardId, renderElement) {
        if (!renderElement) return;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Add loading animation");
        var rateLine = $('.full-start-new__rate-line', renderElement);
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
        $('.loading-dots-container', rateLine).css({
            'opacity': '1',
            'visibility': 'visible'
        });
    }



    function removeLoadingAnimation(cardId, renderElement) {
        if (!renderElement) return;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Remove loading animation");
        $('.loading-dots-container', renderElement).remove();
    }

    function getCardType(cardData) {
        var type = cardData.media_type || cardData.type;
        if (type === 'movie' || type === 'tv') return type;
        return cardData.name || cardData.original_name ? 'tv' : 'movie';
    }

    /**
     * Функция для перевода качества, теперь использует новую логику категоризации.
     * Приоритет: TS > SD > Разрешение
     */
    function translateQualityLabel(qualityCode, fullTorrentTitle) {
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Received qualityCode:", qualityCode, "fullTorrentTitle:", fullTorrentTitle);

        const lowerFullTorrentTitle = (fullTorrentTitle || '').toLowerCase();
        let finalDisplayLabel = '';
        
        // Шаг 0: Проверка на NO_INFO
        if (qualityCode === LQE_QUALITY_NO_INFO_CODE) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: NO_INFO code received. Displaying N/A.");
            return LQE_QUALITY_NO_INFO_LABEL;
        }

        // --- Шаг 1: Проверка на низкое качество (TS, CamRIP) ---
        // Ищем любое из 'плохих' ключевых слов в полном заголовке торрента.
        const isLowQuality = LQE_LOW_QUALITY_KEYWORDS.some(function(keyword) {
            if (lowerFullTorrentTitle.includes(keyword)) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Found low quality keyword: \"" + keyword + "\". Triggering TS category.");
                return true;
            }
            return false;
        });

        if (isLowQuality) {
            finalDisplayLabel = 'TS';
            return finalDisplayLabel;
        }

        // --- Шаг 2: Проверка ручного маппинга для сложных случаев ---
        for (const key in QUALITY_DISPLAY_MAP) {
            if (QUALITY_DISPLAY_MAP.hasOwnProperty(key)) {
                if (lowerFullTorrentTitle.includes(String(key).toLowerCase())) {
                    finalDisplayLabel = QUALITY_DISPLAY_MAP[key];
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Found explicit direct map match for key \"" + key + "\". Displaying \"" + finalDisplayLabel + "\".");
                    // Если ручной маппинг явно установил TS или SD, возвращаем его
                    if (finalDisplayLabel === 'TS' || finalDisplayLabel === 'SD') return finalDisplayLabel;
                    // Если маппинг качественный, возвращаем его
                    if (finalDisplayLabel === '4K' || finalDisplayLabel === '2K' || finalDisplayLabel === '1080' || finalDisplayLabel === '720') return finalDisplayLabel;
                }
            }
        }

        // --- Шаг 3: Категоризация по разрешению (для качественных релизов) ---
        let numericQuality = parseInt(qualityCode, 10);
        
        // Попытка извлечь разрешение из fullTorrentTitle, если qualityCode не число
        if (isNaN(numericQuality) || numericQuality === 0) {
             const resolutionMatch = lowerFullTorrentTitle.match(/(\d{3,4}p)|(4k)|(4\s*к)/);
             if (resolutionMatch) {
                 // Пытаемся получить числовое значение из 1080p, 4k, 4 к
                 var matchValue = resolutionMatch[1] || resolutionMatch[2] || resolutionMatch[3];
                 if (matchValue) {
                    numericQuality = parseInt(matchValue.replace('p', '').replace(/\s*к/, ''), 10);
                 }

                 if (isNaN(numericQuality)) {
                     if (resolutionMatch[2] || resolutionMatch[3]) numericQuality = 2160;
                 }
             }
        }

        if (numericQuality >= 2160) {
            finalDisplayLabel = '4K';
        } else if (numericQuality >= 1440) {
            finalDisplayLabel = '2K';
        } else if (numericQuality >= 1080) {
            finalDisplayLabel = '1080';
        } else if (numericQuality >= 720) {
            finalDisplayLabel = '720';
        } else if (numericQuality >= 360) {
            finalDisplayLabel = 'SD';
        } else {
            // Если не удалось определить ничего, и JacRed не дал качество, помечаем как неизвестное
            finalDisplayLabel = LQE_QUALITY_NO_INFO_LABEL;
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Failed to determine quality. Displaying N/A.");
        }

        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Final display label:", finalDisplayLabel);
        return finalDisplayLabel;
    }

    /**
     * @param {string} title 
     * @returns {number}
     */
    function extractNumericQualityFromTitle(title) {
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
    }

    /**
     * @param {string} title 
     * @returns {number}
     */
    function extractYearFromTitle(title) {
        if (!title) return 0;
        // Ищем год (19xx или 20xx) в круглых (), квадратных [], слэшах / / или точках . .
        const match = title.match(/[\(\[\/\.\s]((19|20)\d{2})[\)\]\/\.\s]/);
        return match ? parseInt(match[1], 10) : 0;
    }
    
    /**
     * Helper function to clean titles for robust comparison (removes punctuation, etc.)
     * @param {string} title 
     * @returns {string}
     */
    function lqeCleanTitleForComparison(title) {
        if (!title) return '';
        var cleaned = title.toLowerCase();
        cleaned = cleaned.replace(/щ/g, 'ш');
        cleaned = cleaned.replace(/ё/g, 'е');
        cleaned = cleaned.replace(/[^a-zа-я0-9\s]/g, ' ');
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    }

    /**
     * @param {string} torrentTitle 
     * @param {string} torrentQuality 
     * @param {string|number} torrentYear (Год из JacRed (relased, released, year), если есть)
     * @param {number} searchYearNum (Год из TMDB)
     * @param {string} cardId
     * @param {boolean} isTvSeries
     * @returns {number}
     */
    function calculateTorrentScore(torrentTitle, torrentQuality, torrentYear, searchYearNum, cardId, isTvSeries) {
        let score = 0;
        
        // Приоритет 'quality' над парсингом 'title'
        let numericQuality = parseInt(torrentQuality, 10) || extractNumericQualityFromTitle(torrentTitle) || 0;

        // 1. Оценка за качество (основной вес)
        if (numericQuality >= 2160) score += 10000;
        else if (numericQuality >= 1440) score += 7500;
        else if (numericQuality >= 1080) score += 5000;
        else if (numericQuality >= 720) score += 2000;
        else if (numericQuality >= 360) score += 500;
        
        // 2. Оценка за соответствие году
        if (searchYearNum) {
            let parsedYear = parseInt(torrentYear, 10) || extractYearFromTitle(torrentTitle);
            
            if (parsedYear > 0) { // Только если год удалось определить
                if (isTvSeries) {
                    // Для сериалов - только бонус, без штрафов (т.к. год означает год 1-го сезона)
                    if (parsedYear === searchYearNum) {
                        score += 1000; // Бонус за 1-й сезон
                    }
                } else {
                    // Для фильмов - строгая логика с допуском +/- 1
                    var yearDiff = Math.abs(parsedYear - searchYearNum);
                    
                    if (yearDiff === 0) {
                        score += 2000; // Точное совпадение (повышенный бонус)
                    } else if (yearDiff === 1) {
                        score += 1000; // Допустимое расхождение (бонус)
                    } else {
                        score -= 100000; // КРИТИЧЕСКИЙ ШТРАФ (это "клон")
                    }
                }
            }
        }
        
        // 3. Штраф за низкое качество
        const lowerTitle = torrentTitle.toLowerCase();
        for (let i = 0; i < LQE_LOW_QUALITY_KEYWORDS.length; i++) {
            if (lowerTitle.includes(LQE_LOW_QUALITY_KEYWORDS[i])) {
                score -= 10000; // Очень большой штраф
                break;
            }
        }

        // 4. Бонус за высококачественные маркеры (BDRemux, BD-Disk, HEVC)
        if (lowerTitle.includes('bdremux') || lowerTitle.includes('bd-disk') || lowerTitle.includes('blu-ray')) score += 500;
        if (lowerTitle.includes('hevc') && numericQuality >= 1080) score += 300;

        return score;
    }

    /**
     * @param {object} normalizedCard 
     * @param {string} cardId 
     * @param {function(object|null): void} callback 
     */
    function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
        var dateStr = normalizedCard.release_date || normalizedCard.first_air_date;
        var isTvSeries = normalizedCard.type === 'tv' || normalizedCard.name;
        
        if (isTvSeries && dateStr) {
            var currentYear = new Date().getFullYear().toString();
            if (dateStr.substring(0, 4) === currentYear) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: TV series is current year. Ignoring year to avoid issues with newer season releases.");
                dateStr = '';
            }
        }
        
        var tmdbYear = '';
        if (dateStr.length >= 4) {
            tmdbYear = dateStr.substring(0, 4);
        }
        if (!tmdbYear || isNaN(tmdbYear)) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Missing/invalid year for normalizedCard:", normalizedCard);
        }

        function searchJacredApi(searchTitle, searchYear, exactMatch, strategyName, expectedLocalTitle, expectedOriginalTitle, tmdbSearchYear, isTvSeries, apiCallback) {
            var userId = Lampa.Storage.get('lampac_unic_id', '');
            var apiUrl = LQE_CONFIG.JACRED_PROTOCOL + LQE_CONFIG.JACRED_URL + '/api/v1.0/torrents?search=' + encodeURIComponent(searchTitle) + (searchYear ? '&year=' + searchYear : '') + (exactMatch ? '&exact=true' : '') + '&uid=' + userId;
            
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: " + strategyName + " URL: " + apiUrl);

            fetchWithProxy(apiUrl, cardId, function(error, responseText) {
                if (error) {
                    console.error("LQE-LOG", "card: " + cardId + ", JacRed: " + strategyName + " request failed:", error);
                    apiCallback(null);
                    return;
                }
                if (!responseText) {
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: " + strategyName + " failed or empty response.");
                    apiCallback(null);
                    return;
                }

                try {
                    var torrents = JSON.parse(responseText);
                    if (!Array.isArray(torrents) || torrents.length === 0) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: " + strategyName + " received no torrents or invalid array.");
                        apiCallback(null);
                        return;
                    }

                    var bestNumericQuality = -1;
                    var bestFoundTorrent = null;
                    var searchYearNum = parseInt(tmdbSearchYear, 10);
                    var bestScore = -Infinity;

                    var cleanedLocalTitle = lqeCleanTitleForComparison(expectedLocalTitle);
                    var cleanedOriginalTitle = lqeCleanTitleForComparison(expectedOriginalTitle);

                    for (var i = 0; i < torrents.length; i++) {
                        var currentTorrent = torrents[i];
                        var currentNumericQuality = parseInt(currentTorrent.quality, 10) || 0;
                        
                        var cleanedTorrentTitleFallback = lqeCleanTitleForComparison(currentTorrent.title);
                        var cleanedTorrentOriginal = lqeCleanTitleForComparison(currentTorrent.originalname);
                        var cleanedTorrentLocal = lqeCleanTitleForComparison(currentTorrent.name);

                        var titleMatchBonus = 0;
                        var originalTitleMatched = false;
                        var localTitleMatched = false;
                        
                        // 1. Бонус за Оригинальное название
                        if (cleanedOriginalTitle.length > 0) {
                            if (cleanedTorrentOriginal.length > 0 && cleanedTorrentOriginal.includes(cleanedOriginalTitle)) {
                                titleMatchBonus += 20000;
                                originalTitleMatched = true;
                            } else if (cleanedTorrentTitleFallback.includes(cleanedOriginalTitle)) {
                                titleMatchBonus += 15000;
                                originalTitleMatched = true;
                            }
                        }

                        // 2. Бонус за Локализованное название
                        if (cleanedLocalTitle.length > 0 && cleanedLocalTitle !== cleanedOriginalTitle) {
                            if (cleanedTorrentLocal.length > 0 && cleanedTorrentLocal.includes(cleanedLocalTitle)) {
                                titleMatchBonus += 10000;
                                localTitleMatched = true;
                            } else if (cleanedTorrentTitleFallback.includes(cleanedLocalTitle)) {
                                titleMatchBonus += 7500;
                                localTitleMatched = true;
                            }
                        } else if (cleanedLocalTitle.length > 0 && cleanedLocalTitle === cleanedOriginalTitle) {
                            localTitleMatched = originalTitleMatched;
                        }

                        // Остановка на нахождении 4K/2160p
                        if (typeof currentNumericQuality !== 'number' || currentNumericQuality === 0) {
                            var extractedQuality = extractNumericQualityFromTitle(currentTorrent.title);
                            if (extractedQuality > 0) {
                                currentNumericQuality = extractedQuality;
                            }
                        }
                        
                        var isYearValidForOptim = false;
                        if (!isTvSeries && searchYearNum) {
                            var parsedYearForOptim = parseInt(currentTorrent.relased || currentTorrent.released || currentTorrent.year, 10) || extractYearFromTitle(currentTorrent.title);
                            if (parsedYearForOptim > 0 && Math.abs(parsedYearForOptim - searchYearNum) <= 1) {
                                isYearValidForOptim = true;
                            }
                        } else {
                            isYearValidForOptim = true; 
                        }

                        if (currentNumericQuality >= 2160 && isYearValidForOptim && originalTitleMatched && localTitleMatched) {
                             var lowerTitle = currentTorrent.title.toLowerCase();
                             var isLowQuality = false;
                             for (var k = 0; k < LQE_LOW_QUALITY_KEYWORDS.length; k++) {
                                 if (lowerTitle.includes(LQE_LOW_QUALITY_KEYWORDS[k])) {
                                     isLowQuality = true;
                                     break;
                                 }
                             }
                             if (!isLowQuality) {
                                 bestNumericQuality = currentNumericQuality;
                                 bestFoundTorrent = currentTorrent;
                                 bestScore = 1000000;
                                 if (LQE_CONFIG.LOGGING_QUALITY) {
                                     console.log("LQE-QUALITY", "card: " + cardId + ", Optimization: Found 4K PERFECT MATCH. Stopping search.");
                                 }
                                 break; // Прекращаем дальнейший поиск
                             }
                        }

                        if (typeof currentNumericQuality !== 'number' || currentNumericQuality === 0) {
                            continue;
                        }
                        
                        var torrentYearFromObject = currentTorrent.relased || currentTorrent.released || currentTorrent.year;
                        
                        var currentScore = calculateTorrentScore(currentTorrent.title, currentTorrent.quality, torrentYearFromObject, searchYearNum, cardId, isTvSeries);
                        currentScore += titleMatchBonus;

                        if (currentScore > bestScore) {
                            bestScore = currentScore;
                            bestFoundTorrent = currentTorrent;
                            bestNumericQuality = currentNumericQuality;
                        }

                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Strategy " + strategyName + ", Torrent: " + currentTorrent.title + ", Score: " + currentScore);
                    }

                    if (bestFoundTorrent && bestScore >= 0) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Best positive score torrent found in " + strategyName + " with score " + bestScore + " and quality " + (bestFoundTorrent.quality || bestNumericQuality) + "p");
                        apiCallback({ quality: bestFoundTorrent.quality || bestNumericQuality, full_label: bestFoundTorrent.title });
                    } else {
                        if (bestFoundTorrent) {
                             if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Strategy " + strategyName + " found torrents, but all had negative scores (best was " + bestScore + "). Moving to next strategy.");
                        } else {
                             if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: No suitable torrents found in " + strategyName + ".");
                        }
                        apiCallback(null);
                    }
                } catch (e) {
                    console.error("LQE-LOG", "card: " + cardId + ", JacRed: " + strategyName + " error parsing response or processing torrents:", e);
                    apiCallback(null);
                }
            });
        }

    var searchStrategies = [];
    var titleExists = normalizedCard.title && (/[a-zа-яё]/i.test(normalizedCard.title) || /^\d+$/.test(normalizedCard.title));
    var originalTitleExists = normalizedCard.original_title && (/[a-zа-яё]/i.test(normalizedCard.original_title) || /^\d+$/.test(normalizedCard.original_title));

    // --- Стратегия 1: Original Title + Year ---
    if (originalTitleExists && tmdbYear) {
        searchStrategies.push({
            title: normalizedCard.original_title.trim(),
            year: tmdbYear,
            exact: true,
            name: "OriginalTitle_Year"
        });
    }

    // --- Стратегия 2: Original Title (no year) ---
    if (originalTitleExists) {
        searchStrategies.push({
            title: normalizedCard.original_title.trim(),
            year: '',
            exact: true,
            name: "OriginalTitle_NoYear"
        });
    }

    // --- Стратегия 3: Local Title + Year ---
    if (titleExists && tmdbYear) {
        if (!originalTitleExists || normalizedCard.title.trim() !== normalizedCard.original_title.trim()) {
            searchStrategies.push({
                title: normalizedCard.title.trim(),
                year: tmdbYear,
                exact: true,
                name: "LocalTitle_Year_Fallback"
            });
        }
    }
    
    // --- Стратегия 4: Local Title (no year) ---
    if (titleExists) {
        if (!originalTitleExists || normalizedCard.title.trim() !== normalizedCard.original_title.trim()) {
            searchStrategies.push({
                title: normalizedCard.title.trim(),
                year: '',
                exact: true,
                name: "LocalTitle_NoYear_Fallback"
            });
        }
    }


    function executeNextStrategy(index, tmdbSearchYear) {
        if (index >= searchStrategies.length) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: All strategies failed. Returning null.");
            callback(null);
            return;
        }

        var strategy = searchStrategies[index];
        
        var localTitleForFilter = normalizedCard.title.trim();
        var originalTitleForFilter = normalizedCard.original_title.trim();

        searchJacredApi(
            strategy.title, 
            strategy.year, // Год для API запроса
            strategy.exact, 
            strategy.name, 
            localTitleForFilter, 
            originalTitleForFilter,
            tmdbSearchYear, // Год из TMDB (для скоринга)
            isTvSeries, 
            function(result) {
                if (result && (result.quality || result.full_label)) {
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Successfully found quality using strategy " + strategy.name + ": " + result.quality + " (torrent: \"" + result.full_label + "\")");
                    callback(result);
                } else {
                    executeNextStrategy(index + 1, tmdbSearchYear);
                }
            }
        );
    }

    if (searchStrategies.length > 0) {
        executeNextStrategy(0, tmdbYear);
    } else {
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: No valid search titles or strategies defined.");
        callback(null);
    }
    }

    function getQualityCache(key) {
        var store = getLqePersistentCacheStore();
        var item = store.get(key); // .get() уже проверяет TTL
        if (LQE_CONFIG.LOGGING_QUALITY) {
            console.log("LQE-QUALITY", "Cache: Checking quality cache for key:", key, "Found:", !!item);
        }
        return item; // Возвращает null, если не найдено или истек срок
    }

    function saveQualityCache(key, data, cardId) {
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "Cache: Saving quality cache for key:", key, "Data:", data);
        var store = getLqePersistentCacheStore();
        store.set(key, { quality_code: data.quality_code, full_label: data.full_label });
    }

    function clearFullCardQualityElements(cardId, renderElement) {
        if (renderElement) {
            var existingElements = $('.full-start__status.lqe-quality', renderElement);
            if (existingElements.length > 0) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Clearing existing quality elements on full card.");
                existingElements.remove();
            }
        }
    }

    function showFullCardQualityPlaceholder(cardId, renderElement) {
        if (!renderElement) return;
        var rateLine = $('.full-start-new__rate-line', renderElement);
        if (!rateLine.length || $('.loading-dots-container', rateLine).length) return;
        if (!$('.full-start__status.lqe-quality', rateLine).length) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Adding quality placeholder on full card.");
            var placeholder = document.createElement('div');
            placeholder.className = 'full-start__status lqe-quality';
            placeholder.textContent = LQE_QUALITY_NO_INFO_LABEL;
            placeholder.style.opacity = '0.01';
            rateLine.append(placeholder);
        }
    }

    /**
     * @param {string} qualityCode 
     * @param {string} fullTorrentTitle 
     * @param {string} cardId 
     * @param {jQuery} renderElement 
     */
    function updateFullCardQualityElement(qualityCode, fullTorrentTitle, cardId, renderElement) {
        if (!renderElement) return;

        var rateLine = $('.full-start-new__rate-line', renderElement);
        if (!rateLine.length) return;

        clearFullCardQualityElements(cardId, renderElement);

        var displayQuality = translateQualityLabel(qualityCode, fullTorrentTitle);
        
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Displaying quality: " + displayQuality);
        
        var div = document.createElement('div');
        div.className = 'full-start__status lqe-quality';
        div.textContent = displayQuality;
        rateLine.append(div);
    }

    /**
     * @param {jQuery} cardView 
     * @param {string} qualityCode 
     * @param {string} fullTorrentTitle 
     * @param {boolean} forceVisible 
     * @param {boolean} isBackground 
     */
    function updateCardListQualityElement(cardView, qualityCode, fullTorrentTitle, forceVisible, isBackground) {
        if (!cardView) return;
        var displayQuality = translateQualityLabel(qualityCode, fullTorrentTitle);
        
        // 1. Удаляем существующий элемент качества, если он есть
        $('.card__quality', cardView).remove();

        // 2. Добавляем новый элемент качества
        if (displayQuality !== LQE_QUALITY_NO_INFO_LABEL || forceVisible) {
            var qualityDiv = document.createElement('div');
            qualityDiv.className = 'card__quality';

            if (qualityCode === LQE_QUALITY_NO_INFO_CODE && !forceVisible) {
                qualityDiv.style.opacity = '0.01';
            }
            
            var innerElement = document.createElement('div');
            innerElement.textContent = displayQuality;
            qualityDiv.appendChild(innerElement);
            cardView.appendChild(qualityDiv);
            
            if (forceVisible) {
                qualityDiv.style.opacity = '1';
            }
        }
    }

    function processFullCardQuality(cardData, renderElement) {
        if (!renderElement) {
            console.error("LQE-LOG", "Render element is null in processFullCardQuality. Aborting.");
            return;
        }
        var cardId = cardData.id;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Processing full card. Data: ", cardData);

        var normalizedCard = {
            id: cardData.id || '',
            title: cardData.title || cardData.name || '',
            original_title: cardData.original_original_name || cardData.original_name || cardData.original_title || '',
            type: getCardType(cardData),
            release_date: cardData.release_date || cardData.first_air_date || ''
        };
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Normalized full card data: ", normalizedCard);
        
        var rateLine = $('.full-start-new__rate-line', renderElement);
        if (rateLine.length) {
            rateLine.addClass('done');
            addLoadingAnimation(cardId, renderElement);
        } else {
            if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", .full-start-new__rate-line not found, skipping loading animation.");
        }
        
        if (!normalizedCard.release_date) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", No release date found. Skipping JacRed search and setting N/A.");
            removeLoadingAnimation(cardId, renderElement);
            updateFullCardQualityElement(LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, cardId, renderElement);
            return;
        }

        var isTvSeries = (normalizedCard.type === 'tv' || normalizedCard.name);
        var cacheKey = LQE_CONFIG.CACHE_VERSION + '_' + (isTvSeries ? 'tv_' : 'movie_') + normalizedCard.id;

        var cachedQualityData = getQualityCache(cacheKey);

        if (!(isTvSeries && LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES === false)) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', Quality feature enabled for this content, starting processing.');

            if (cachedQualityData) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Quality data found in cache:", cachedQualityData);
                
                if (cachedQualityData.quality_code === LQE_QUALITY_NO_INFO_CODE) {
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Cached data is NO_INFO. Displaying N/A.");
                    updateFullCardQualityElement(cachedQualityData.quality_code, cachedQualityData.full_label, cardId, renderElement);
                } else {
                    updateFullCardQualityElement(cachedQualityData.quality_code, cachedQualityData.full_label, cardId, renderElement);
                }

                removeLoadingAnimation(cardId, renderElement);

                // Запуск фонового обновления
                queueLqeRequest(function(done) {
                    getBestReleaseFromJacred(normalizedCard, cardId, function(jrResult) {
                        try {
                            var qualityCode = (jrResult && jrResult.quality) || null;
                            var fullTorrentTitle = (jrResult && jrResult.full_label) || null;
                            
                            var finalData = null;
                            if (qualityCode && qualityCode !== 'NO') {
                                finalData = { quality_code: qualityCode, full_label: fullTorrentTitle };
                            } else {
                                finalData = { quality_code: LQE_QUALITY_NO_INFO_CODE, full_label: LQE_QUALITY_NO_INFO_LABEL };
                            }
                            
                            if (finalData.quality_code !== cachedQualityData.quality_code || finalData.full_label !== cachedQualityData.full_label) {
                                if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', JacRed result updated cache. Refreshing UI.');
                                saveQualityCache(cacheKey, finalData, cardId);
                                
                                if (finalData.quality_code === LQE_QUALITY_NO_INFO_CODE) {
                                    updateFullCardQualityElement(finalData.quality_code, finalData.full_label, cardId, renderElement);
                                } else {
                                    updateFullCardQualityElement(finalData.quality_code, finalData.full_label, cardId, renderElement);
                                }
                            }

                            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Background cache and UI refresh completed.");
                            done();
                        } catch(e) {
                            // [ИСПРАВЛЕНО v1.04]
                            console.error("LQE-LOG", "card: " + cardId + ", CRITICAL SYNC ERROR inside JacRed result processing (Full Card/Background):", e);
                            done();
                        }
                    });
                });

            } else {
                clearFullCardQualityElements(cardId, renderElement);
                showFullCardQualityPlaceholder(cardId, renderElement);

                queueLqeRequest(function(done) {
                    getBestReleaseFromJacred(normalizedCard, cardId, function(jrResult) {
                        try {
                            if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', JacRed callback received for full card. Result:', jrResult);
                            var qualityCode = (jrResult && jrResult.quality) || null;
                            var fullTorrentTitle = (jrResult && jrResult.full_label) || null;
                            var currentRenderElement = renderElement;
                            var finalData = null;

                            if (!currentRenderElement || !document.body.contains(currentRenderElement[0])) {
                                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Full card disappeared before quality update.");
                                return;
                            }

                            if (qualityCode && qualityCode !== 'NO') {
                                if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', JacRed found quality code: ' + qualityCode + ', full label: ' + fullTorrentTitle);
                                finalData = { quality_code: qualityCode, full_label: fullTorrentTitle };
                                saveQualityCache(cacheKey, finalData, cardId);
                                updateFullCardQualityElement(finalData.quality_code, finalData.full_label, cardId, currentRenderElement);
                            } else {
                                var jacredNAGrady = { quality_code: LQE_QUALITY_NO_INFO_CODE, full_label: LQE_QUALITY_NO_INFO_LABEL };
                                saveQualityCache(cacheKey, jacredNAGrady, cardId);

                                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", 'card: ' + cardId + ', No quality from JacRed. Setting to N/A.');
                                updateFullCardQualityElement(LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, cardId, currentRenderElement); 
                            }
                            removeLoadingAnimation(cardId, currentRenderElement);

                        } catch (e) {
                            // [ИСПРАВЛЕНО v1.04]
                            console.error("LQE-LOG", "card: " + cardId + ", CRITICAL SYNC ERROR inside JacRed result processing (Full Card/Initial):", e);
                        } finally {
                            done();
                        }
                    });
                });
            }
        } else {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', Quality feature disabled for this content (TV Series).');
            removeLoadingAnimation(cardId, renderElement);
        }
    }

    function processCardList(card) {
        if (!card.card_data) return; // Пропускаем карточки без данных
        if (!card.hasAttribute('data-lqe-quality-processed')) {
            requestAnimationFrame(function() {
                if (card.isConnected) {
                    var cardView = card.querySelector('.card__view');
                    if (cardView) {
                        updateCardListQualityElement(cardView, LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, false, false);
                        card.setAttribute('data-lqe-quality-processed', 'true');
                    }
                    
                    lqeCardVisibilityManager.observe(card);
                }
            });
        }
    }

    function updateCardListQuality(cardElement) {
        if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "updateCardListQuality called for card.");

        if (cardElement.hasAttribute('data-lqe-quality-processed')) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "Card already processed (placeholder set). Card:", cardElement.card_data ? cardElement.card_data.id : 'N/A');
        }

        var cardView = cardElement.querySelector('.card__view');
        var cardData = cardElement.card_data;

        if (!cardData || !cardView) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "cardData or cardView is null for card, skipping quality fetch.");
            return;
        }

        var isTvSeries = (getCardType(cardData) === 'tv');

        if (isTvSeries && LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES === false) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "Skipping TV series for quality update (as configured). Card:", cardData.id);
            return;
        }

        var normalizedCard = {
            id: cardData.id || '',
            title: cardData.title || cardData.name || '',
            original_title: cardData.original_original_name || cardData.original_name || cardData.original_title || '',
            type: getCardType(cardData),
            release_date: cardData.release_date || cardData.first_air_date || ''
        };
        var cardId = normalizedCard.id;

        // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
        if (!normalizedCard.release_date) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "card: " + cardId + ", No release date found. Skipping JacRed search and setting N/A.");
            // Вызываем updateCardListQualityElement с 'forceVisible: true' (третий аргумент), 
            // чтобы "N/A" отобразилось, а не было скрыто.
            updateCardListQualityElement(cardView, LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, true, false);
            return;
        }
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

        var cacheKey = LQE_CONFIG.CACHE_VERSION + '_' + (isTvSeries ? 'tv_' : 'movie_') + normalizedCard.id;

        var cachedQualityData = getQualityCache(cacheKey);

        if (cachedQualityData) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "card: " + cardId + ", Quality data found in cache:", cachedQualityData);
            
            if (cachedQualityData.quality_code === LQE_QUALITY_NO_INFO_CODE) {
                if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "card: " + cardId + ", Cached NO_INFO. Displaying N/A.");
                updateCardListQualityElement(cardView, cachedQualityData.quality_code, cachedQualityData.full_label, true, false);
            } else {
                updateCardListQualityElement(cardView, cachedQualityData.quality_code, cachedQualityData.full_label, true, false);
            }

            // Запуск фонового обновления
            queueLqeRequest(function(done) {
                getBestReleaseFromJacred(normalizedCard, cardId, function(jrResult) {
                    try {
                        var qualityCode = (jrResult && jrResult.quality) || null;
                        var fullTorrentTitle = (jrResult && jrResult.full_label) || null;
                        var finalData = null;

                        if (qualityCode && qualityCode !== 'NO') {
                            finalData = { quality_code: qualityCode, full_label: fullTorrentTitle };
                        } else {
                            finalData = { quality_code: LQE_QUALITY_NO_INFO_CODE, full_label: LQE_QUALITY_NO_INFO_LABEL };
                        }

                        if (finalData.quality_code !== cachedQualityData.quality_code || finalData.full_label !== cachedQualityData.full_label) {
                            if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', JacRed result updated cache. Refreshing UI in background.');
                            saveQualityCache(cacheKey, finalData, cardId);

                            if (document.body.contains(cardElement)) {
                                if (finalData.quality_code === LQE_QUALITY_NO_INFO_CODE) {
                                    updateCardListQualityElement(cardView, LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, true, true);
                                } else {
                                    updateCardListQualityElement(cardView, finalData.quality_code, finalData.full_label, true, true);
                                }
                                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Background cache and UI refresh completed for list card.");
                            }
                        }
                        
                        done();
                    } catch(e) {
                        // [ИСПРАВЛЕНО v1.04]
                        console.error("LQE-LOG", "card: " + cardId + ", CRITICAL SYNC ERROR inside JacRed result processing (List Card/Background):", e);
                        done();
                    }
                });
            });

            return;
        }

        // SLOW PATH
        queueLqeRequest(function(done) {
            getBestReleaseFromJacred(normalizedCard, cardId, function(jrResult) {
                try {
                    if (LQE_CONFIG.LOGGING_CARDLIST) console.log('LQE-CARDLIST', 'card: ' + cardId + ', JacRed callback received for card list. Result:', jrResult);

                    if (!document.body.contains(cardElement)) {
                        if (LQE_CONFIG.LOGGING_CARDLIST) console.log('LQE-CARDLIST', 'card: ' + cardId + ', Card element disappeared before quality update.');
                        return;
                    }

                    var qualityCode = (jrResult && jrResult.quality) || null;
                    var fullTorrentTitle = (jrResult && jrResult.full_label) || null;
                    var finalData = null;

                    if (qualityCode && qualityCode !== 'NO') {
                        finalData = { quality_code: qualityCode, full_label: fullTorrentTitle };
                        saveQualityCache(cacheKey, finalData, cardId);
                        updateCardListQualityElement(cardView, finalData.quality_code, finalData.full_label, true, false);
                    } else {
                        var jacredNAGrady = { quality_code: LQE_QUALITY_NO_INFO_CODE, full_label: LQE_QUALITY_NO_INFO_LABEL };
                        saveQualityCache(cacheKey, jacredNAGrady, cardId);

                        if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", 'card: ' + cardId + ', No quality from JacRed. Setting to N/A.');
                        updateCardListQualityElement(cardView, LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, true, false);
                    }

                    if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "card: " + cardId + ", UI update completed for list card.");

                } catch (e) {
                    // [ИСПРАВЛЕНО v1.04]
                    console.error("LQE-LOG", "card: " + cardId + ", CRITICAL SYNC ERROR inside JacRed result processing (List Card/Initial):", e);
                } finally {
                    done();
                }
            });
        });
    }


    // --- Инициализация и обработчики событий DOM ---

    var observer = new MutationObserver(function(mutations) {
        var newCards = [];
        for (var m = 0; m < mutations.length; m++) {
            var mutation = mutations[m];
            if (mutation.addedNodes) {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType !== 1) continue;
                    
                    if (node.classList && node.classList.contains('card')) {
                        newCards.push(node);
                    }
                    var nestedCards = node.querySelectorAll('.card');
                    for (var k = 0; k < nestedCards.length; k++) {
                        newCards.push(nestedCards[k]);
                    }
                }
            }
        }
        
        if (newCards.length) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "Observer detected " + newCards.length + " new cards. Processing...");
            newCards.forEach(function(card) {
                if (!card.hasAttribute('data-lqe-quality-processed')) {
                    var cardView = card.querySelector('.card__view');
                    if (cardView) {
                        updateCardListQualityElement(cardView, LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, false, false);
                        card.setAttribute('data-lqe-quality-processed', 'true');
                    }
                    
                    lqeCardVisibilityManager.observe(card);
                }
            });
        }
    });

    function initializeLampaQualityPlugin() {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Lampa Quality Enhancer: Plugin Initialization Started! (v1.04)");
        window.lampaQualityPlugin = true;

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        if (LQE_CONFIG.LOGGING_GENERAL) console.log('LQE-LOG: Initial observer for card lists started.');

        Lampa.Listener.follow('full', function(event) {
            if (event.type == 'complite') {
                var renderElement = event.object.activity.render();
                currentGlobalMovieId = event.data.movie.id;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'complite' for ID:", currentGlobalMovieId);
                processFullCardQuality(event.data.movie, renderElement);
            }
        });
        
        Lampa.Listener.follow('full', function(event) {
            if (event.type == 'destroy') {
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'destroy'. Clearing global ID.");
                currentGlobalMovieId = null;
            }
        });
    }

    if (window.lampaQualityPlugin) {
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Plugin already loaded. Skipping initialization.");
    } else {
        initializeLampaQualityPlugin();
    }
})();
