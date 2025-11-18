// Версия 1.06
// Ссылка на плагин: https://padavano.github.io/quality.js
// [ИЗМЕНЕНИЯ v1.06]
// 1. [КОСМЕТИКА] Добавлена цветовая кодировка качества (Зеленый/Желтый/Красный).
//    - Мини-карты: меняется цвет текста.
//    - Полные карты: меняется цвет фона плашки.
// 2. [ЛОГИКА] Улучшен алгоритм поиска названий.
//    - Учитываются альтернативные названия из поля 'names'.
//    - Фильтр: только кириллица, исключая специфические украинские символы (і, ї, є, ґ).

(function() {
    'use strict';

    var LQE_CONFIG = {
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
        
        FULL_CARD_LABEL_TEXT_COLOR: '#000',
        FULL_CARD_LABEL_BACKGROUND_COLOR: '#FFF',
        FULL_CARD_LABEL_FONT_WEIGHT: 'normal',
        FULL_CARD_LABEL_BORDER: '1px solid #FFF',
        FULL_CARD_LABEL_FONT_SIZE: '1.1em',
        FULL_CARD_LABEL_BORDER_RADIUS: '0.3em',
        FULL_CARD_LABEL_PADDING: '0.3em',
        
        FULL_CARD_BG_HIGH: '#C8E6C9',
        FULL_CARD_BG_MID: '#FFF9C4',
        FULL_CARD_BG_LOW: '#FFCDD2',

        LIST_CARD_LABEL_BORDER_COLOR: '#FFFF00',
        LIST_CARD_LABEL_BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.7)',
        LIST_CARD_LABEL_TEXT_COLOR: '#FFF',
        LIST_CARD_LABEL_FONT_WEIGHT: '600',
        LIST_CARD_LABEL_FONT_SIZE: '1em',

        LIST_CARD_TEXT_HIGH: '#00FF00',
        LIST_CARD_TEXT_MID: '#FFFF00',
        LIST_CARD_TEXT_LOW: '#FF0000'
    };

    var currentGlobalMovieId = null;
    
    var LQE_QUALITY_NO_INFO_CODE = 'NO_INFO';
    var LQE_QUALITY_NO_INFO_LABEL = 'N/A';
    var LQE_QUALITY_BAD_LABEL = 'BAD';

    // --- МОДУЛЬ КЭША ---

    var LQE_CACHE_DEFAULT_TTL = LQE_CONFIG.CACHE_VALID_TIME_MS || (72 * 60 * 60 * 1000);
    var LQE_CACHE_DEFAULT_LIMIT = 100 * 1024;
    var lqeQualityCacheStore = null;

    function lqeSupportsLampaStorage() {
        return !!(window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function' && typeof Lampa.Storage.set === 'function');
    }

    function lqeCloneCacheObject(source) {
        var clone = {};
        if (!source || typeof source !== 'object') return clone;
        Object.keys(source).forEach(function(key) { clone[key] = source[key]; });
        return clone;
    }

    function lqeSerializeSize(obj) {
        try { return JSON.stringify(obj).length; } catch (err) { return Infinity; }
    }

    function createLqePersistentCache(storageKey, limitBytes, ttl) {
        var memoryCache = {};
        limitBytes = typeof limitBytes === 'number' && limitBytes > 0 ? limitBytes : LQE_CACHE_DEFAULT_LIMIT;
        ttl = typeof ttl === 'number' && ttl > 0 ? ttl : LQE_CACHE_DEFAULT_TTL;

        function now() { return Date.now(); }

        function loadFromStorage() {
            var cache = {};
            if (lqeSupportsLampaStorage()) {
                try {
                    var stored = Lampa.Storage.get(storageKey);
                    if (typeof stored === 'string') cache = JSON.parse(stored || '{}') || {};
                    else if (stored && typeof stored === 'object') cache = stored;
                } catch (err) { cache = {}; }
            }
            return lqeCloneCacheObject(cache);
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
            if (!limitBytes) return cache;
            var sortedKeys = Object.keys(cache).sort(function(a, b) { return cache[a].timestamp - cache[b].timestamp; });
            var size = lqeSerializeSize(cache);
            while (size > limitBytes && sortedKeys.length) {
                var candidate = sortedKeys.shift();
                if (candidate === lastKey && sortedKeys.length === 0) break;
                delete cache[candidate];
                size = lqeSerializeSize(cache);
            }
            if (limitBytes && lastKey && cache[lastKey] && lqeSerializeSize(cache) > limitBytes) delete cache[lastKey];
            return cache;
        }

        function saveToStorage(cache, lastKey) {
            var normalized = prune(lqeCloneCacheObject(cache), lastKey);
            memoryCache = normalized;
            if (lqeSupportsLampaStorage()) {
                try { Lampa.Storage.set(storageKey, normalized); } catch (err) {}
            }
        }
        
        memoryCache = prune(loadFromStorage());

        return {
            get: function(key) {
                if (!key) return null;
                var item = memoryCache[key];
                if (!item || typeof item !== 'object') return null;
                if (now() - item.timestamp > ttl) {
                    delete memoryCache[key];
                    setTimeout(function() { saveToStorage(memoryCache); }, 0);
                    return null;
                }
                return item.value;
            },
            set: function(key, value) {
                if (!key) return;
                memoryCache[key] = { value: value, timestamp: now() };
                setTimeout(function() { saveToStorage(memoryCache, key); }, 0);
            }
        };
    }

    function getLqePersistentCacheStore() {
        if (!lqeQualityCacheStore) {
            lqeQualityCacheStore = createLqePersistentCache(LQE_CONFIG.CACHE_KEY, LQE_CACHE_DEFAULT_LIMIT, LQE_CONFIG.CACHE_VALID_TIME_MS);
        }
        return lqeQualityCacheStore;
    }
    
    // --- ОЧЕРЕДЬ ---

    var lqeRequestQueue = [];
    var lqeActiveRequests = 0;
    var lqeMaxConcurrentRequests = 3;

    function processLqeRequestQueue() {
        if (lqeRequestQueue.length === 0 || lqeActiveRequests >= lqeMaxConcurrentRequests) return;
        var requestJob = lqeRequestQueue.shift();
        if (requestJob) {
            lqeActiveRequests++;
            var done = function() {
                lqeActiveRequests--;
                setTimeout(processLqeRequestQueue, 50);
            };
            requestAnimationFrame(function() {
                try { requestJob(done); } catch (e) { 
                    console.error("LQE-LOG", "Queue job failed:", e);
                    done(); 
                }
            });
        }
        if (lqeRequestQueue.length > 0 && lqeActiveRequests < lqeMaxConcurrentRequests) {
            setTimeout(processLqeRequestQueue, 0);
        }
    }

    function queueLqeRequest(job) {
        lqeRequestQueue.push(job);
        processLqeRequestQueue();
    }

    // --- VISIBILITY ---

    var lqeCardVisibilityManager = (function() {
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
                            if (observer) observer.unobserve(entry.target);
                        }
                    });
                }, { root: null, threshold: 0.01, rootMargin: '200px 0px' });
            } catch (err) {
                console.error("LQE-LOG", "IntersectionObserver failed:", err);
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

        function enqueueCard(card) {
            if (!card || !card.isConnected || card.__lqeVisibilityQueued) return;
            if (!isFallbackMode && observer && !isElementNearViewport(card, FALLBACK_MARGIN)) return;
            card.__lqeVisibilityQueued = true;
            pendingCards.add(card);
            if (!frameId) frameId = requestAnimationFrame(flushQueue);
        }

        function flushQueue() {
            frameId = null;
            var cards = Array.from(pendingCards);
            pendingCards.clear();
            cards.forEach(function(card) {
                card.__lqeVisibilityQueued = false;
                updateCardListQuality(card);
            });
        }

        return {
            observe: function(card) {
                if (!card) return;
                if (!isFallbackMode) {
                    ensureObserver();
                    if (observer) observer.observe(card);
                }
                requestAnimationFrame(function() {
                    if (!card || !card.isConnected) return;
                    if (card.hasAttribute('data-lqe-quality-processed') && isElementNearViewport(card, FALLBACK_MARGIN)) {
                        enqueueCard(card);
                        if (observer) observer.unobserve(card);
                    }
                });
            }
        };
    })();

    // --- ЛОГИКА И ПАРСИНГ ---

    var QUALITY_DISPLAY_MAP = {
        "4K Web-DL 10bit HDR P81 HEVC": "4K", "UHD Blu-ray disc 2160p": "4K", "Hybrid (2160p)": "4K",
        "4K Web-DL": "4K", "bluray": "4K", "bdremux": "4K", "webdl": "1080", "web-dl": "1080", "webrip": "1080",
        "hdtvrip 2160p": "4K", "web-dlrip (2160p)": "4K", "WEB-DL 2160p": "4K",
        "HDTVRip (1080p)": "1080", "HDTV": "1080", "HDTVRip 720p": "720", "hdrip": "720",
        "bdrip": "720", "DVDRip": "720", "SD": "480",
        "Telecine": "BAD", "tc": "BAD", "ts": "BAD", "camrip": "CamRip"
    };

    var LQE_LOW_QUALITY_REGEX_SOURCES = [
        'telesync', 'telecine', 'camrip', 'экранка', 'звук с ts', 'audio ts', 'ts audio',
        'hdts', 'hdcam', 'hdtc', 'webrip с ts', 'webrp\.ts', 'web-dl с ts', 'web-dl ts',
        'zets', 'zet-ts', '\\bts\\b', '\\bad\\b'
    ];
    
    var LQE_LOW_QUALITY_REGEX_COMPILED = new RegExp(LQE_LOW_QUALITY_REGEX_SOURCES.join('|'), 'i');

    function lqeCheckIsLowQuality(title) {
        if (!title) return false;
        if (LQE_LOW_QUALITY_REGEX_COMPILED.test(title)) { 
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "lqeCheckIsLowQuality: Matched low quality keyword.");
            return true;
        }
        return false;
    }

    function getQualityColorGroup(displayQuality) {
        if (!displayQuality) return 'low';
        var quality = displayQuality.toLowerCase();
        if (quality === '4k' || quality === '2k' || quality === '1080') return 'high';
        if (quality === '720' || quality === '480') return 'mid';
        return 'low';
    }

    function translateQualityLabel(qualityCode, fullTorrentTitle) {
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Received qualityCode:", qualityCode, "fullTorrentTitle:", fullTorrentTitle);

        const lowerFullTorrentTitle = (fullTorrentTitle || '').toLowerCase();
        
        if (qualityCode === LQE_QUALITY_NO_INFO_CODE) return LQE_QUALITY_NO_INFO_LABEL;
        if (lqeCheckIsLowQuality(fullTorrentTitle)) {
             if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Found low quality keyword. Triggering BAD category.");
             return LQE_QUALITY_BAD_LABEL;
        }

        let numericQuality = parseInt(qualityCode, 10);
        if (!isNaN(numericQuality) && numericQuality > 0) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Using 'qualityCode' property:", numericQuality);
            if (numericQuality >= 2160) return '4K';
            if (numericQuality >= 1440) return '2K';
            if (numericQuality >= 1080) return '1080';
            if (numericQuality >= 720) return '720';
            if (numericQuality >= 480) return '480';
            return LQE_QUALITY_BAD_LABEL;
        }

        let numericFromTitle = extractNumericQualityFromTitle(lowerFullTorrentTitle);
        if (numericFromTitle > 0) {
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Using parsed 'title' resolution:", numericFromTitle);
            if (numericFromTitle >= 2160) return '4K';
            if (numericFromTitle >= 1440) return '2K';
            if (numericFromTitle >= 1080) return '1080';
            if (numericFromTitle >= 720) return '720';
            if (numericFromTitle >= 480) return '480';
            return LQE_QUALITY_BAD_LABEL;
        }

        for (const key in QUALITY_DISPLAY_MAP) {
            if (QUALITY_DISPLAY_MAP.hasOwnProperty(key) && lowerFullTorrentTitle.includes(String(key).toLowerCase())) {
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "translateQualityLabel: Map match for key \"" + key + "\".");
                return QUALITY_DISPLAY_MAP[key];
            }
        }
        return LQE_QUALITY_NO_INFO_LABEL;
    }

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

    function extractYearFromTitle(title) {
        if (!title) return 0;
        const match = title.match(/[\(\[\/\.\s]((19|20)\d{2})[\)\]\/\.\s]/);
        return match ? parseInt(match[1], 10) : 0;
    }
    
    function lqeCleanTitleForComparison(title) {
        if (!title) return '';
        var cleaned = title.toLowerCase();
        cleaned = cleaned.replace(/щ/g, 'ш').replace(/ё/g, 'е');
        cleaned = cleaned.replace(/[^a-zа-я0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return cleaned;
    }

    function calculateTorrentScore(torrentTitle, numericQuality, isLowQuality, torrentYear, searchYearNum, cardId, isTvSeries) {
        let score = 0;
        if (numericQuality >= 2160) score += 10000;
        else if (numericQuality >= 1440) score += 7500;
        else if (numericQuality >= 1080) score += 5000;
        else if (numericQuality >= 720) score += 2000;
        else if (numericQuality >= 480) score += 1000;
        else if (numericQuality > 0) score -= 5000; // Штраф за < 480
        
        if (searchYearNum) {
            let parsedYear = parseInt(torrentYear, 10) || extractYearFromTitle(torrentTitle);
            if (parsedYear > 0) {
                if (isTvSeries) {
                    if (parsedYear === searchYearNum) score += 1000;
                } else {
                    var yearDiff = Math.abs(parsedYear - searchYearNum);
                    if (yearDiff === 0) score += 2000;
                    else if (yearDiff === 1) score += 1000;
                    else score -= 100000;
                }
            }
        }
        
        if (isLowQuality) score -= 10000;

        const lowerTitle = torrentTitle.toLowerCase();
        if (lowerTitle.includes('bdremux') || lowerTitle.includes('bd-disk') || lowerTitle.includes('blu-ray')) score += 500;
        if (lowerTitle.includes('hevc') && numericQuality >= 1080) score += 300;

        return score;
    }

    // --- СЕТЬ И API ---

    function fetchWithProxy(url, cardId, callback) {
        var currentProxyIndex = -1;
        var callbackCalled = false;
        var controller = new AbortController();
        var signal = controller.signal;

        function tryNext() {
            currentProxyIndex++;
            var fetchUrl;
            if (currentProxyIndex === 0) {
                fetchUrl = url;
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch direct: " + fetchUrl);
            } else if (currentProxyIndex <= LQE_CONFIG.PROXY_LIST.length) {
                var proxyIndex = currentProxyIndex - 1;
                fetchUrl = LQE_CONFIG.PROXY_LIST[proxyIndex] + encodeURIComponent(url);
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Fetch with proxy " + (proxyIndex + 1) + ": " + fetchUrl);
            } else {
                if (!callbackCalled) { callbackCalled = true; callback(new Error('All fetch strategies failed')); }
                return;
            }

            var timeoutMs = (currentProxyIndex === 0) ? 5000 : LQE_CONFIG.PROXY_TIMEOUT_MS;
            var timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);

            fetch(fetchUrl, { signal: signal })
                .then(function(response) {
                    clearTimeout(timeoutId);
                    if (!response.ok) throw new Error('Fetch error: ' + response.status);
                    return response.text();
                })
                .then(function(data) {
                    if (!callbackCalled) { callbackCalled = true; callback(null, data); }
                })
                .catch(function(error) {
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
        }
        tryNext();
    }

    function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
        var dateStr = normalizedCard.release_date || normalizedCard.first_air_date;
        var isTvSeries = normalizedCard.type === 'tv' || normalizedCard.name;
        if (isTvSeries && dateStr) {
            if (dateStr.substring(0, 4) === new Date().getFullYear().toString()) dateStr = '';
        }
        var tmdbYear = (dateStr.length >= 4) ? dateStr.substring(0, 4) : '';

        var validLocalTitles = [];
        var cleanedOriginalTitleMain = lqeCleanTitleForComparison(normalizedCard.original_title);
        
        var hasRussianChar = /[а-яё]/i;
        var hasUkrainianChar = /[ґєії]/i;

        if (normalizedCard.title) {
            var cl = lqeCleanTitleForComparison(normalizedCard.title);
            if (cl && cl !== cleanedOriginalTitleMain) validLocalTitles.push(cl);
        }

        if (Array.isArray(normalizedCard.names)) {
            normalizedCard.names.forEach(function(name) {
                var cn = lqeCleanTitleForComparison(name);
                if (cn && cn !== cleanedOriginalTitleMain && validLocalTitles.indexOf(cn) === -1 && hasRussianChar.test(name) && !hasUkrainianChar.test(name)) {
                    validLocalTitles.push(cn);
                }
            });
        }
        
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Valid local titles for search:", validLocalTitles);

        function searchJacredApi(searchTitle, searchYear, exactMatch, strategyName, expectedLocalTitle, expectedOriginalTitle, tmdbSearchYear, isTvSeries, apiCallback) {
            var userId = Lampa.Storage.get('lampac_unic_id', '');
            var apiUrl = LQE_CONFIG.JACRED_PROTOCOL + LQE_CONFIG.JACRED_URL + '/api/v1.0/torrents?search=' + encodeURIComponent(searchTitle) + (searchYear ? '&year=' + searchYear : '') + (exactMatch ? '&exact=true' : '') + '&uid=' + userId;
            
            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: " + strategyName + " URL: " + apiUrl);

            fetchWithProxy(apiUrl, cardId, function(error, responseText) {
                if (error || !responseText) { 
                    if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: " + strategyName + " failed or empty.");
                    apiCallback(null); 
                    return; 
                }

                try {
                    var torrents = JSON.parse(responseText);
                    if (!Array.isArray(torrents) || torrents.length === 0) { 
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: " + strategyName + " received no torrents.");
                        apiCallback(null); 
                        return; 
                    }

                    var bestNumericQuality = -1;
                    var bestFoundTorrent = null;
                    var searchYearNum = parseInt(tmdbSearchYear, 10);
                    var bestScore = -Infinity;

                    var cleanedOriginalTitle = lqeCleanTitleForComparison(expectedOriginalTitle);

                    for (var i = 0; i < torrents.length; i++) {
                        var currentTorrent = torrents[i];
                        var currentNumericQuality = parseInt(currentTorrent.quality, 10) || extractNumericQualityFromTitle(currentTorrent.title) || 0;
                        var currentIsLowQuality = lqeCheckIsLowQuality(currentTorrent.title);
                        var torrentYearFromObject = currentTorrent.relased || currentTorrent.released || currentTorrent.year;
                        
                        var cleanedTorrentTitleFallback = lqeCleanTitleForComparison(currentTorrent.title);
                        var cleanedTorrentOriginal = lqeCleanTitleForComparison(currentTorrent.originalname);
                        var cleanedTorrentLocal = lqeCleanTitleForComparison(currentTorrent.name);

                        var titleMatchBonus = 0;
                        var originalTitleMatched = false;
                        var localTitleMatched = false;
                        
                        if (cleanedOriginalTitle.length > 0) {
                            if ((cleanedTorrentOriginal.length > 0 && cleanedTorrentOriginal.includes(cleanedOriginalTitle)) || cleanedTorrentTitleFallback.includes(cleanedOriginalTitle)) {
                                titleMatchBonus += 20000;
                                originalTitleMatched = true;
                            }
                        }

                        if (validLocalTitles.length > 0) {
                            for (var t = 0; t < validLocalTitles.length; t++) {
                                var targetTitle = validLocalTitles[t];
                                if ((cleanedTorrentLocal.length > 0 && cleanedTorrentLocal.includes(targetTitle)) || cleanedTorrentTitleFallback.includes(targetTitle)) {
                                    titleMatchBonus += 10000;
                                    localTitleMatched = true;
                                    break;
                                }
                            }
                        } else if (validLocalTitles.length === 0 && localTitleMatched === false) {
                            localTitleMatched = originalTitleMatched;
                        }

                        var isYearValidForOptim = true;
                        if (!isTvSeries && searchYearNum) {
                            var parsedYearForOptim = parseInt(torrentYearFromObject, 10) || extractYearFromTitle(currentTorrent.title);
                            if (parsedYearForOptim > 0 && Math.abs(parsedYearForOptim - searchYearNum) > 1) isYearValidForOptim = false;
                        }

                        if (currentNumericQuality >= 2160 && isYearValidForOptim && originalTitleMatched && localTitleMatched && !currentIsLowQuality) {
                             bestNumericQuality = currentNumericQuality;
                             bestFoundTorrent = currentTorrent;
                             bestScore = 1000000;
                             if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Optimization: Found 4K PERFECT MATCH. Stopping search.");
                             break;
                        }

                        if (typeof currentNumericQuality !== 'number' || currentNumericQuality === 0) continue;
                        
                        var currentScore = calculateTorrentScore(currentTorrent.title, currentNumericQuality, currentIsLowQuality, torrentYearFromObject, searchYearNum, cardId, isTvSeries);
                        currentScore += titleMatchBonus;

                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Strategy " + strategyName + ", Torrent: " + currentTorrent.title + ", Score: " + currentScore);

                        if (currentScore > bestScore) {
                            bestScore = currentScore;
                            bestFoundTorrent = currentTorrent;
                            bestNumericQuality = currentNumericQuality;
                        }
                    }

                    if (bestFoundTorrent && bestScore >= 0) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: Best positive score torrent found in " + strategyName + " with score " + bestScore + " and quality " + (bestFoundTorrent.quality || bestNumericQuality) + "p");
                        apiCallback({ quality: bestFoundTorrent.quality || bestNumericQuality, full_label: bestFoundTorrent.title });
                    } else {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: No suitable torrents found in " + strategyName + ".");
                        apiCallback(null);
                    }
                } catch (e) { 
                    console.error("LQE-LOG", "card: " + cardId + ", JacRed parsing error:", e);
                    apiCallback(null); 
                }
            });
        }

        var searchStrategies = [];
        var originalTitleExists = normalizedCard.original_title && (/[a-zа-яё]/i.test(normalizedCard.original_title) || /^\d+$/.test(normalizedCard.original_title));
        var titleExists = normalizedCard.title && (/[a-zа-яё]/i.test(normalizedCard.title) || /^\d+$/.test(normalizedCard.title));

        if (originalTitleExists && tmdbYear) searchStrategies.push({ title: normalizedCard.original_title.trim(), year: tmdbYear, exact: true, name: "OriginalTitle_Year" });
        if (originalTitleExists) searchStrategies.push({ title: normalizedCard.original_title.trim(), year: '', exact: true, name: "OriginalTitle_NoYear" });
        if (titleExists && tmdbYear && (!originalTitleExists || normalizedCard.title.trim() !== normalizedCard.original_title.trim())) {
            searchStrategies.push({ title: normalizedCard.title.trim(), year: tmdbYear, exact: true, name: "LocalTitle_Year_Fallback" });
        }
        if (titleExists && (!originalTitleExists || normalizedCard.title.trim() !== normalizedCard.original_title.trim())) {
            searchStrategies.push({ title: normalizedCard.title.trim(), year: '', exact: true, name: "LocalTitle_NoYear_Fallback" });
        }

        function executeNextStrategy(index) {
            if (index >= searchStrategies.length) { 
                if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", JacRed: All strategies failed.");
                callback(null); return; 
            }
            var strategy = searchStrategies[index];
            searchJacredApi(strategy.title, strategy.year, strategy.exact, strategy.name, normalizedCard.title, normalizedCard.original_title, tmdbYear, isTvSeries, function(result) {
                if (result && (result.quality || result.full_label)) callback(result);
                else executeNextStrategy(index + 1);
            });
        }

        if (searchStrategies.length > 0) executeNextStrategy(0);
        else callback(null);
    }

    // --- UI И РЕНДЕРИНГ ---

    var styleLQE = "<style id=\"lampa_quality_styles\">" +
    ".full-start-new__rate-line { flex-wrap: wrap; gap: 0.4em 0; }" +
    ".full-start-new__rate-line > * { margin-right: 0.4em !important; flex-shrink: 0; flex-grow: 0; }" +
    ".full-start-new__rate-line .full-start__pg, .full-start-new__rate-line .full-start__status, .full-start-new__rate-line .lqe-quality{" +
    " font-weight: " + LQE_CONFIG.FULL_CARD_LABEL_FONT_WEIGHT + "; font-size: " + LQE_CONFIG.FULL_CARD_LABEL_FONT_SIZE + "; border-radius: " + LQE_CONFIG.FULL_CARD_LABEL_BORDER_RADIUS + "; padding: " + LQE_CONFIG.FULL_CARD_LABEL_PADDING + "; }" +
    ".lqe-quality { min-width: 2.8em; text-align: center; text-transform: none; border: " + LQE_CONFIG.FULL_CARD_LABEL_BORDER + "; background-color: " + LQE_CONFIG.FULL_CARD_LABEL_BACKGROUND_COLOR + "; color: " + LQE_CONFIG.FULL_CARD_LABEL_TEXT_COLOR + "; }" +
    ".card__view { position: relative !important; }" +
    ".card__icons-inner, .card__quality, .card__vote { background-color: " + LQE_CONFIG.LIST_CARD_LABEL_BACKGROUND_COLOR + "; border-radius: 0.7em; }" +
    ".card__icons-inner { flex-direction: column-reverse; justify-content: center; flex-wrap: wrap; align-content: center; }" +
    ".card__quality, .card__vote { padding: 0.4em 0.6em; font-size: " + LQE_CONFIG.LIST_CARD_LABEL_FONT_SIZE + "; font-weight: " + LQE_CONFIG.LIST_CARD_LABEL_FONT_WEIGHT + "; color: " + LQE_CONFIG.LIST_CARD_LABEL_TEXT_COLOR + "; white-space: nowrap; text-shadow: 0.5px 0.5px 1px rgba(0,0,0,0.3) !important; }" +
    ".card__icons { top: 0.3em; left: unset; right: 0.3em; }" +    
    ".card__quality { position: absolute !important; bottom: unset; top: 0.3em; left: 0.3em; z-index: 1; width: fit-content; max-width: calc(100% - 1em); overflow: hidden; text-transform: uppercase; }" +
    "</style>";
    Lampa.Template.add('lampa_quality_css', styleLQE);
    $('body').append(Lampa.Template.get('lampa_quality_css', {}, true));

    var loadingStylesLQE = "<style id=\"lampa_quality_loading_animation\">" +
        ".loading-dots-container { position: absolute; top: 50%; left: 0; right: 0; text-align: left; transform: translateY(-50%); z-index: 10; }" +
        ".full-start-new__rate-line { position: relative; }" +
        ".loading-dots { display: inline-flex; align-items: center; gap: 0.4em; color: #ffffff; font-size: 0.7em; background: rgba(0, 0, 0, 0.3); padding: 0.6em 1em; border-radius: 0.5em; }" +
        ".loading-dots__text { margin-right: 1em; }" +
        ".loading-dots__dot { width: 0.5em; height: 0.5em; border-radius: 50%; background-color: currentColor; opacity: 0.3; animation: loading-dots-fade 1.5s infinite both; }" +
        ".loading-dots__dot:nth-child(1) { animation-delay: 0s; }" +
        ".loading-dots__dot:nth-child(2) { animation-delay: 0.5s; }" +
        ".loading-dots__dot:nth-child(3) { animation-delay: 1s; }" +
        "@keyframes loading-dots-fade { 0%, 90%, 100% { opacity: 0.3; } 35% { opacity: 1; } }" +
        "@media screen and (max-width: 480px) { .loading-dots-container { -webkit-justify-content: center; justify-content: center; text-align: center; max-width: 100%; }}" +
        "</style>";
    Lampa.Template.add('lampa_quality_loading_animation_css', loadingStylesLQE);
    $('body').append(Lampa.Template.get('lampa_quality_loading_animation_css', {}, true));

    function addLoadingAnimation(cardId, renderElement) {
        if (!renderElement) return;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Add loading animation");
        var rateLine = $('.full-start-new__rate-line', renderElement);
        if (!rateLine.length || $('.loading-dots-container', rateLine).length) return;
        rateLine.append('<div class="loading-dots-container"><div class="loading-dots"><span class="loading-dots__text">Загрузка...</span><span class="loading-dots__dot"></span><span class="loading-dots__dot"></span><span class="loading-dots__dot"></span></div></div>');
        $('.loading-dots-container', rateLine).css({ 'opacity': '1', 'visibility': 'visible' });
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

    function updateFullCardQualityElement(qualityCode, fullTorrentTitle, cardId, renderElement) {
        if (!renderElement) return;
        var rateLine = $('.full-start-new__rate-line', renderElement);
        if (!rateLine.length) return;

        $('.full-start__status.lqe-quality', renderElement).remove();

        var displayQuality = translateQualityLabel(qualityCode, fullTorrentTitle);
        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "card: " + cardId + ", Displaying quality: " + displayQuality);

        var div = document.createElement('div');
        div.className = 'full-start__status lqe-quality';
        div.textContent = displayQuality;

        var colorGroup = getQualityColorGroup(displayQuality);
        var bgColor = LQE_CONFIG.FULL_CARD_LABEL_BACKGROUND_COLOR;
        if (colorGroup === 'high') bgColor = LQE_CONFIG.FULL_CARD_BG_HIGH;
        else if (colorGroup === 'mid') bgColor = LQE_CONFIG.FULL_CARD_BG_MID;
        else if (colorGroup === 'low') bgColor = LQE_CONFIG.FULL_CARD_BG_LOW;
        div.style.backgroundColor = bgColor;

        rateLine.append(div);
    }

    function updateCardListQualityElement(cardView, qualityCode, fullTorrentTitle, forceVisible, isBackground) {
        if (!cardView) return;
        var displayQuality = translateQualityLabel(qualityCode, fullTorrentTitle);
        $('.card__quality', cardView).remove();

        if (displayQuality !== LQE_QUALITY_NO_INFO_LABEL || forceVisible) {
            var qualityDiv = document.createElement('div');
            qualityDiv.className = 'card__quality';
            if (qualityCode === LQE_QUALITY_NO_INFO_CODE && !forceVisible) qualityDiv.style.opacity = '0.01';
            
            var innerElement = document.createElement('div');
            innerElement.textContent = displayQuality;

            var colorGroup = getQualityColorGroup(displayQuality);
            var textColor = LQE_CONFIG.LIST_CARD_LABEL_TEXT_COLOR;
            if (colorGroup === 'high') textColor = LQE_CONFIG.LIST_CARD_TEXT_HIGH;
            else if (colorGroup === 'mid') textColor = LQE_CONFIG.LIST_CARD_TEXT_MID;
            else if (colorGroup === 'low') textColor = LQE_CONFIG.LIST_CARD_TEXT_LOW;
            innerElement.style.color = textColor;

            qualityDiv.appendChild(innerElement);
            cardView.appendChild(qualityDiv);
            if (forceVisible) qualityDiv.style.opacity = '1';
        }
    }

    function processFullCardQuality(cardData, renderElement) {
        if (!renderElement) return;
        var cardId = cardData.id;
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "card: " + cardId + ", Processing full card.");

        var normalizedCard = {
            id: cardData.id || '',
            title: cardData.title || cardData.name || '',
            original_title: cardData.original_original_name || cardData.original_name || cardData.original_title || '',
            names: cardData.names || [],
            type: getCardType(cardData),
            release_date: cardData.release_date || cardData.first_air_date || ''
        };
        
        var rateLine = $('.full-start-new__rate-line', renderElement);
        if (rateLine.length) { rateLine.addClass('done'); addLoadingAnimation(cardId, renderElement); }
        
        if (!normalizedCard.release_date) {
            removeLoadingAnimation(cardId, renderElement);
            updateFullCardQualityElement(LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, cardId, renderElement);
            return;
        }

        var isTvSeries = (normalizedCard.type === 'tv' || normalizedCard.name);
        var cacheKey = LQE_CONFIG.CACHE_VERSION + '_' + (isTvSeries ? 'tv_' : 'movie_') + normalizedCard.id;
        var cachedQualityData = getLqePersistentCacheStore().get(cacheKey);

        if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "Cache check for " + cacheKey + ": " + (cachedQualityData ? "HIT" : "MISS"));

        if (!(isTvSeries && LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES === false)) {
            if (cachedQualityData) {
                updateFullCardQualityElement(cachedQualityData.quality_code, cachedQualityData.full_label, cardId, renderElement);
                removeLoadingAnimation(cardId, renderElement);
                queueLqeRequest(function(done) {
                    getBestReleaseFromJacred(normalizedCard, cardId, function(jrResult) {
                        var qualityCode = (jrResult && jrResult.quality) ? jrResult.quality : LQE_QUALITY_NO_INFO_CODE;
                        var fullLabel = (jrResult && jrResult.full_label) ? jrResult.full_label : LQE_QUALITY_NO_INFO_LABEL;
                        if (qualityCode !== cachedQualityData.quality_code) {
                            if (LQE_CONFIG.LOGGING_QUALITY) console.log("LQE-QUALITY", "Updating cache from background fetch.");
                            getLqePersistentCacheStore().set(cacheKey, { quality_code: qualityCode, full_label: fullLabel });
                            updateFullCardQualityElement(qualityCode, fullLabel, cardId, renderElement);
                        }
                        done();
                    });
                });
            } else {
                var placeholder = document.createElement('div');
                placeholder.className = 'full-start__status lqe-quality';
                placeholder.textContent = LQE_QUALITY_NO_INFO_LABEL;
                placeholder.style.opacity = '0.01';
                if (!$('.full-start__status.lqe-quality', rateLine).length) rateLine.append(placeholder);

                queueLqeRequest(function(done) {
                    getBestReleaseFromJacred(normalizedCard, cardId, function(jrResult) {
                        if (LQE_CONFIG.LOGGING_QUALITY) console.log('LQE-QUALITY', 'card: ' + cardId + ', JacRed callback result:', jrResult);
                        var qualityCode = (jrResult && jrResult.quality) ? jrResult.quality : LQE_QUALITY_NO_INFO_CODE;
                        var fullLabel = (jrResult && jrResult.full_label) ? jrResult.full_label : LQE_QUALITY_NO_INFO_LABEL;
                        getLqePersistentCacheStore().set(cacheKey, { quality_code: qualityCode, full_label: fullLabel });
                        if (document.body.contains(renderElement[0])) {
                            updateFullCardQualityElement(qualityCode, fullLabel, cardId, renderElement);
                            removeLoadingAnimation(cardId, renderElement);
                        }
                        done();
                    });
                });
            }
        } else {
            removeLoadingAnimation(cardId, renderElement);
        }
    }

    function updateCardListQuality(cardElement) {
        if (cardElement.hasAttribute('data-lqe-quality-processed')) {
        }
        var cardView = cardElement.querySelector('.card__view');
        var cardData = cardElement.card_data;
        if (!cardData || !cardView) return;

        var isTvSeries = (getCardType(cardData) === 'tv');
        if (isTvSeries && LQE_CONFIG.SHOW_QUALITY_FOR_TV_SERIES === false) return;

        var normalizedCard = {
            id: cardData.id || '',
            title: cardData.title || cardData.name || '',
            original_title: cardData.original_original_name || cardData.original_name || cardData.original_title || '',
            names: cardData.names || [],
            type: getCardType(cardData),
            release_date: cardData.release_date || cardData.first_air_date || ''
        };
        
        if (!normalizedCard.release_date) {
            updateCardListQualityElement(cardView, LQE_QUALITY_NO_INFO_CODE, LQE_QUALITY_NO_INFO_LABEL, true, false);
            return;
        }

        var cacheKey = LQE_CONFIG.CACHE_VERSION + '_' + (isTvSeries ? 'tv_' : 'movie_') + normalizedCard.id;
        var cachedQualityData = getLqePersistentCacheStore().get(cacheKey);

        if (cachedQualityData) {
            updateCardListQualityElement(cardView, cachedQualityData.quality_code, cachedQualityData.full_label, true, false);
            queueLqeRequest(function(done) {
                getBestReleaseFromJacred(normalizedCard, normalizedCard.id, function(jrResult) {
                    var qualityCode = (jrResult && jrResult.quality) ? jrResult.quality : LQE_QUALITY_NO_INFO_CODE;
                    var fullLabel = (jrResult && jrResult.full_label) ? jrResult.full_label : LQE_QUALITY_NO_INFO_LABEL;
                    if (qualityCode !== cachedQualityData.quality_code) {
                        getLqePersistentCacheStore().set(cacheKey, { quality_code: qualityCode, full_label: fullLabel });
                        if (document.body.contains(cardElement)) {
                            updateCardListQualityElement(cardView, qualityCode, fullLabel, true, true);
                        }
                    }
                    done();
                });
            });
        } else {
            queueLqeRequest(function(done) {
                getBestReleaseFromJacred(normalizedCard, normalizedCard.id, function(jrResult) {
                    if (document.body.contains(cardElement)) {
                        var qualityCode = (jrResult && jrResult.quality) ? jrResult.quality : LQE_QUALITY_NO_INFO_CODE;
                        var fullLabel = (jrResult && jrResult.full_label) ? jrResult.full_label : LQE_QUALITY_NO_INFO_LABEL;
                        getLqePersistentCacheStore().set(cacheKey, { quality_code: qualityCode, full_label: fullLabel });
                        updateCardListQualityElement(cardView, qualityCode, fullLabel, true, false);
                    }
                    done();
                });
            });
        }
    }

    // --- ИНИЦИАЛИЗАЦИЯ ---

    var observer = new MutationObserver(function(mutations) {
        var newCards = [];
        for (var m = 0; m < mutations.length; m++) {
            var mutation = mutations[m];
            if (mutation.addedNodes) {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains('card')) newCards.push(node);
                    var nestedCards = node.querySelectorAll('.card');
                    for (var k = 0; k < nestedCards.length; k++) newCards.push(nestedCards[k]);
                }
            }
        }
        if (newCards.length) {
            if (LQE_CONFIG.LOGGING_CARDLIST) console.log("LQE-CARDLIST", "Observer detected " + newCards.length + " new cards.");
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
        if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Lampa Quality Enhancer: Plugin Initialization Started! (v1.06)");
        window.lampaQualityPlugin = true;
        observer.observe(document.body, { childList: true, subtree: true });
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
                if (LQE_CONFIG.LOGGING_GENERAL) console.log("LQE-LOG", "Full card event 'destroy'.");
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
