// [Изменения v1.02]
// 1. Удалены компоненты и код для старых версий Lampa (до 3.0)
// 2. Удалена локализация uk и en, оставлена только ru.

(function () {
    'use strict';

    // Полифилы оставляем для совместимости с устаревшими WebView (Tizen/WebOS)
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement, fromIndex) {
            var k;
            if (this == null) throw new TypeError('"this" is null or not defined');
            var o = Object(this);
            var len = o.length >>> 0;
            if (len === 0) return -1;
            k = fromIndex | 0;
            if (k < 0) {
                k += len;
                if (k < 0) k = 0;
            }
            for (; k < len; k++) {
                if (k in o && o[k] === searchElement) return k;
            }
            return -1;
        };
    }

    if (!Array.isArray) {
        Array.isArray = function (arg) {
            return Object.prototype.toString.call(arg) === '[object Array]';
        };
    }

    if (!Array.prototype.filter) {
        Array.prototype.filter = function (callback, thisArg) {
            var array = this;
            var result = [];
            for (var i = 0; i < array.length; i++) {
                if (callback.call(thisArg, array[i], i, array)) {
                    result.push(array[i]);
                }
            }
            return result;
        };
    }

    if (!Object.assign) {
        Object.assign = function (target) {
            for (var i = 1; i < arguments.length; i++) {
                var source = arguments[i];
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                    }
                }
            }
            return target;
        };
    }

    if (!Array.prototype.map) {
        Array.prototype.map = function (callback, thisArg) {
            var array = this;
            var result = [];
            for (var i = 0; i < array.length; i++) {
                result.push(callback.call(thisArg, array[i], i, array));
            }
            return result;
        };
    }

    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function (callback, thisArg) {
            var array = this;
            for (var i = 0; i < array.length; i++) {
                callback.call(thisArg, array[i], i, array);
            }
        };
    }

    if (!Array.prototype.includes) {
        Array.prototype.includes = function (searchElement) {
            return this.indexOf(searchElement) !== -1;
        };
    }

    if (!Array.prototype.some) {
        Array.prototype.some = function (callback, thisArg) {
            var array = this;
            for (var i = 0; i < array.length; i++) {
                if (callback.call(thisArg, array[i], i, array)) {
                    return true;
                }
            }
            return false;
        };
    }

    // Настройки и константы
    var allSortOptions = [
        { id: 'vote_count.desc', title: 'surs_vote_count_desc' },
        { id: 'vote_average.desc', title: 'surs_vote_average_desc' },
        { id: 'first_air_date.desc', title: 'surs_first_air_date_desc' },
        { id: 'popularity.desc', title: 'surs_popularity_desc' },
        { id: 'revenue.desc', title: 'surs_revenue_desc' }
    ];

    var allGenres = [
        { id: 28, title: 'surs_genre_action' },
        { id: 35, title: 'surs_genre_comedy' },
        { id: 18, title: 'surs_genre_drama' },
        { id: 10749, title: 'surs_genre_romance' },
        { id: 16, title: 'surs_genre_animation' },
        { id: 10762, title: 'surs_genre_kids' },
        { id: 12, title: 'surs_genre_adventure' },
        { id: 80, title: 'surs_genre_crime' },
        { id: 9648, title: 'surs_genre_mystery' },
        { id: 878, title: 'surs_genre_sci_fi' },
        { id: 37, title: 'surs_genre_western' },
        { id: 53, title: 'surs_genre_thriller' },
        { id: 10751, title: 'surs_genre_family' },
        { id: 14, title: 'surs_genre_fantasy' },
        { id: 10764, title: 'surs_genre_reality' },
        { id: 10759, title: 'surs_genre_action_adventure' },
        { id: 10766, title: 'surs_genre_soap' },
        { id: 10767, title: 'surs_genre_talk_show' }
    ];

    var allStreamingServices = [
        { id: 49, title: 'HBO' },
        { id: 77, title: 'SyFy' },
        { id: 2552, title: 'Apple TV+' },
        { id: 453, title: 'Hulu' },
        { id: 1024, title: 'Amazon Prime' },
        { id: 213, title: 'Netflix' },
        { id: 3186, title: 'HBO Max' },
        { id: 2076, title: 'Paramount network' },
        { id: 4330, title: 'Paramount+' },
        { id: 3353, title: 'Peacock' },
        { id: 2739, title: 'Disney+' },
        { id: 2, title: 'ABC' },
        { id: 6, title: 'NBC' },
        { id: 16, title: 'CBS' },
        { id: 318, title: 'Starz' },
        { id: 174, title: 'AMC' },
        { id: 19, title: 'FOX' },
        { id: 64, title: 'Discovery' },
        { id: 493, title: 'BBC America' },
        { id: 88, title: 'FX' },
        { id: 67, title: 'Showtime' }
    ];

    var allStreamingServicesRUS = [
        { id: 2493, title: 'Start' },
        { id: 2859, title: 'Premier' },
        { id: 4085, title: 'KION' },
        { id: 3923, title: 'ИВИ' },
        { id: 412, title: 'Россия 1' },
        { id: 558, title: 'Первый канал' },
        { id: 3871, title: 'Okko' },
        { id: 3827, title: 'Кинопоиск' },
        { id: 5806, title: 'Wink' },
        { id: 806, title: 'СТС' },
        { id: 1191, title: 'ТНТ' },
        { id: 1119, title: 'НТВ' },
        { id: 3031, title: 'Пятница' },
        { id: 3882, title: 'More.TV' }
    ];

    function getAllStoredSettings() {
        return Lampa.Storage.get('surs_settings') || {};
    }

    function getProfileSettings() {
        var profileId = Lampa.Storage.get('lampac_profile_id', '') || 'default';
        var allSettings = getAllStoredSettings();
        if (!allSettings.hasOwnProperty(profileId)) {
            allSettings[profileId] = {};
            saveAllStoredSettings(allSettings);
        }
        return allSettings[profileId];
    }

    function saveAllStoredSettings(settings) {
        Lampa.Storage.set('surs_settings', settings);
    }

    function getStoredSetting(key, defaultValue) {
        var profileSettings = getProfileSettings();
        return profileSettings.hasOwnProperty(key) ? profileSettings[key] : defaultValue;
    }

    function setStoredSetting(key, value) {
        var allSettings = getAllStoredSettings();
        var profileId = Lampa.Storage.get('lampac_profile_id', '') || 'default';
        if (!allSettings.hasOwnProperty(profileId)) {
            allSettings[profileId] = {};
        }
        allSettings[profileId][key] = value;
        saveAllStoredSettings(allSettings);
    }

    function getEnabledItems(allItems, storageKeyPrefix) {
        var result = [];
        for (var i = 0; i < allItems.length; i++) {
            if (getStoredSetting(storageKeyPrefix + allItems[i].id, true)) {
                result.push(allItems[i]);
            }
        }
        return result;
    }

    function getSortOptions() { return getEnabledItems(allSortOptions, 'sort_'); }
    function getGenres() { return getEnabledItems(allGenres, 'genre_'); }
    function getStreamingServices() { return getEnabledItems(allStreamingServices, 'streaming_'); }
    function getStreamingServicesRUS() { return getEnabledItems(allStreamingServicesRUS, 'streaming_rus_'); }

    if (!getStoredSetting('interface_size_initialized', false)) {
        Lampa.Storage.set("interface_size", "small");
        setStoredSetting('interface_size_initialized', true);
    }

    var buttonPosters = {
        surs_main: 'https://aviamovie.github.io/img/main.png',
        surs_bookmarks: 'https://aviamovie.github.io/img/bookmarks.png',
        surs_history: 'https://aviamovie.github.io/img/history.png',
        surs_select: 'https://aviamovie.github.io/img/select_new.png',
        surs_new: 'https://aviamovie.github.io/img/new.png',
        surs_rus: 'https://aviamovie.github.io/img/rus.png',
        surs_kids: 'https://aviamovie.github.io/img/kids.png'
    };

    function getAllButtons() {
        return [
            { id: 'surs_main', title: 'surs_main' },
            { id: 'surs_bookmarks', title: 'surs_bookmarks' },
            { id: 'surs_history', title: 'surs_history' },
            { id: 'surs_select', title: 'surs_select' },
            { id: 'surs_new', title: 'surs_new' },
            { id: 'surs_rus', title: 'surs_rus' },
            { id: 'surs_kids', title: 'surs_kids' }
        ];
    }

    var buttonActions = {
        surs_main: function () {
            var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
            Lampa.Activity.push({
                source: Lampa.Storage.get('source'),
                title: Lampa.Lang.translate('title_main') + ' - ' + sourceName,
                component: 'main',
                page: 1
            });
        },
        surs_bookmarks: function () {
            Lampa.Activity.push({
                url: '',
                title: Lampa.Lang.translate('surs_bookmarks'),
                component: 'bookmarks',
                page: 1
            });
        },
        surs_history: function () {
            Lampa.Activity.push({
                url: '',
                title: Lampa.Lang.translate('surs_history'),
                component: 'favorite',
                type: 'history',
                page: 1
            });
        },
        surs_select: function () {
            if (window.SursSelect && typeof window.SursSelect.showSursSelectMenu === 'function') {
                window.SursSelect.showSursSelectMenu();
            }
        },
        surs_new: function () {
            var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
            Lampa.Activity.push({
                source: sourceName + ' NEW',
                title: Lampa.Lang.translate('title_main') + ' - ' + sourceName + ' NEW',
                component: 'main',
                page: 1
            });
        },
        surs_rus: function () {
            var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
            Lampa.Activity.push({
                source: sourceName + ' RUS',
                title: Lampa.Lang.translate('title_main') + ' - ' + sourceName + ' RUS',
                component: 'main',
                page: 1
            });
        },
        surs_kids: function () {
            var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
            Lampa.Activity.push({
                source: sourceName + ' KIDS',
                title: Lampa.Lang.translate('title_main') + ' - ' + sourceName + ' KIDS',
                component: 'main',
                page: 1
            });
        }
    };

    function initCustomButtons() {
        // Только CSS, логика слушателей для старых версий удалена
        Lampa.Template.add('custom_button_style', `
            <style>
                .custom-button-card {
                    flex-shrink: 0;
                    width: 12.75em !important;
                    position: relative;
                    will-change: transform;
                }
                .custom-button-card.card--collection .card__view {
                    padding-bottom: 58%;
                    margin-top: 1em;
                    margin-bottom: -1em;
                }
                @media screen and (max-width: 700px) {
                    .items-cards .custom-button-card {
                        width: 9em !important;
                    }
                }
                .custom-button-card .card__title,
                .custom-button-card .card__age {
                    display: none !important;
                }
            </style>
        `);
        $('body').append(Lampa.Template.get('custom_button_style', {}, true));
    }

    function addCustomButtonsRow(partsData) {
        partsData.unshift(function (callback) {
            var allButtons = getAllButtons();
            var enabledButtons = allButtons.filter(function (b) {
                return getStoredSetting('custom_button_' + b.id, true);
            }).map(function (b) {
                return {
                    id: b.id,
                    title: Lampa.Lang.translate(b.title),
                    source: 'custom',
                    params: {
                        createInstance: function (item) {
                            var card = Lampa.Maker.make('Card', item, function (m) {
                                return m.only('Card', 'Callback');
                            });

                            card.data.media_type = 'button';
                            card.data.type = 'button';
                            card.data.img = buttonPosters[item.id] || '';
                            return card;
                        },
                        emit: {
                            onCreate: function () {
                                this.html.addClass('custom-button-card card--small card--collection');
                                this.html.find('.card__title').remove();
                                this.html.find('.card__age').remove();
                                this.html.find('.card__icons').remove();
                            },
                            onlyEnter: function () {
                                if (buttonActions[b.id]) {
                                    buttonActions[b.id]();
                                }
                            }
                        }
                    }
                };
            });

            callback({
                results: enabledButtons,
                title: '',
                params: {
                    items: {
                        view: 20,
                        mapping: 'line'
                    }
                }
            });
        });
    }

    function getPartsData() {
        var partsData = [];
        addCustomButtonsRow(partsData);
        return partsData;
    }

    // Глобальные функции фильтрации
    function filterCyrillic(items) {
        var language = Lampa.Storage.get('language');
        // Если язык не русский, возвращаем все элементы без фильтрации
        if (language !== 'ru') {
            return items;
        }

        var storedValue = Lampa.Storage.get('cirillic');
        var isFilterEnabled = storedValue === '1' || storedValue === null || storedValue === undefined || storedValue === '';

        if (!isFilterEnabled) return items;

        function containsCyrillic(value) {
            if (typeof value === 'string') {
                return /[а-яА-ЯёЁїЇіІєЄґҐ]/.test(value);
            } else if (typeof value === 'object' && value !== null) {
                var keys = Object.keys(value);
                for (var i = 0; i < keys.length; i++) {
                    if (containsCyrillic(value[keys[i]])) return true;
                }
            }
            return false;
        }

        return items.filter(function (item) {
            return containsCyrillic(item);
        });
    }

    function applyFilters(items) {
        items = filterCyrillic(items);
        return items;
    }

    function applyMinVotes(baseUrl) {
        var minVotes = parseInt(getStoredSetting('minVotes'), 10);
        if (isNaN(minVotes)) minVotes = 10;
        if (minVotes > 0) baseUrl += '&vote_count.gte=' + minVotes;
        return baseUrl;
    }

    function applyAgeRestriction(baseUrl) {
        var ageRestriction = getStoredSetting('ageRestrictions');
        if (ageRestriction && String(ageRestriction).trim() !== '') {
            var certificationMap = {
                '0+': '0+', '6+': '6+', '12+': '12+', '16+': '16+', '18+': '18+'
            };
            if (certificationMap.hasOwnProperty(ageRestriction)) {
                baseUrl += '&certification_country=RU&certification=' + encodeURIComponent(certificationMap[ageRestriction]);
            }
        }
        return baseUrl;
    }

    function applyWithoutKeywords(baseUrl) {
        var filterLevel = getStoredSetting('withoutKeywords');
        var baseExcludedKeywords = ['346488', '158718', '41278'];

        if (!filterLevel || filterLevel == '1') {
            baseExcludedKeywords.push('13141', '345822', '315535', '290667', '323477', '290609');
        }
        if (filterLevel == '2') {
            baseExcludedKeywords.push('210024', '13141', '345822', '315535', '290667', '323477', '290609');
        }
        baseUrl += '&without_keywords=' + encodeURIComponent(baseExcludedKeywords.join(','));
        return baseUrl;
    }

    function buildApiUrl(baseUrl) {
        baseUrl = applyMinVotes(baseUrl);
        baseUrl = applyAgeRestriction(baseUrl);
        baseUrl = applyWithoutKeywords(baseUrl);
        return baseUrl;
    }

    function adjustSortForMovies(sort) {
        if (sort.id === 'first_air_date.desc') {
            sort = { id: 'release_date.desc', title: 'surs_first_air_date_desc' };
        }
        if (sort.id === 'release_date.desc') {
            var endDate = new Date();
            endDate.setDate(endDate.getDate() - 25);
            endDate = endDate.toISOString().split('T')[0];

            var startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 1);
            startDate = startDate.toISOString().split('T')[0];

            sort.extraParams = '&release_date.gte=' + startDate + '&release_date.lte=' + endDate;
        }
        return sort;
    }

    function adjustSortForTVShows(sort) {
        if (sort.id === 'first_air_date.desc') {
            var endDate = new Date();
            endDate.setDate(endDate.getDate() - 10);
            endDate = endDate.toISOString().split('T')[0];

            var startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 1);
            startDate = startDate.toISOString().split('T')[0];
            sort.extraParams = '&first_air_date.gte=' + startDate + '&first_air_date.lte=' + endDate;
        }
        return sort;
    }

    function randomWideFlag() {
        return Math.random() < 0.1;
    }

    // Современная обертка (только для Lampa 3.0+)
    function wrapWithWideFlag(requestFunc) {
        return function (callback) {
            requestFunc(function (json) {
                json = Lampa.Utils.addSource(json, 'tmdb');

                if (randomWideFlag()) {
                    if (Array.isArray(json.results)) {
                        json.results.forEach(function (c) {
                            c.promo = c.overview || '';
                            c.promo_title = c.title || c.name || Lampa.Lang.translate('surs_noname');
                            c.params = {
                                style: { name: 'wide' }
                            };
                        });
                    }
                    json.params = {
                        items: { view: 3 }
                    };
                }
                callback(json);
            });
        }
    }

    function shuffleArray(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    // Ближайшие эпизоды (Только новый API)
    function getUpcomingEpisodes() {
        return function (cb) {
            var lately = Lampa.TimeTable.lately().slice(0, 20);

            lately.forEach(function (item) {
                item.params = {
                    createInstance: function (item_data) {
                        return Lampa.Maker.make('Episode', item_data, function (module) {
                            return module.only('Card', 'Callback');
                        });
                    },
                    emit: {
                        onlyEnter: function () {
                            Lampa.Router.call('full', item.card);
                        },
                        onlyFocus: function () {
                            Lampa.Background.change(Lampa.Utils.cardImgBackgroundBlur(item.card));
                        }
                    }
                };
                Lampa.Arrays.extend(item, item.episode);
            });

            cb({
                results: lately,
                title: Lampa.Lang.translate('surs_title_upcoming_episodes')
            });
        };
    }

    function startPlugin() {
        window.plugin_surs_ready = true;

        var SourceTMDB = function (parent) {
            this.network = new Lampa.Reguest();
            this.discovery = false;

            this.main = function () {
                var owner = this;
                var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
                var onComplete = arguments.length > 1 ? arguments[1] : undefined;
                var onError = arguments.length > 2 ? arguments[2] : undefined;
                var partsLimit = 9;

                var partsData = getPartsData();
                var CustomData = [];
                var trendingsData = [];

                var trendingMovies = function (callback) {
                    var baseUrl = 'trending/movie/week';
                    baseUrl = applyAgeRestriction(baseUrl);
                    owner.get(baseUrl, params, function (json) {
                        if (json.results) {
                            json.results = json.results.filter(function (result) {
                                var forbiddenLanguages = ['kr', 'cn', 'jp', 'ko', 'zh', 'ja'];
                                return !forbiddenLanguages.includes(result.original_language);
                            });
                        }
                        json.title = Lampa.Lang.translate('surs_title_trend_week') + ' ' + Lampa.Lang.translate('surs_movies');
                        callback(json);
                    }, callback);
                }

                var trendingTV = function (callback) {
                    var baseUrl = 'trending/tv/week';
                    baseUrl = applyAgeRestriction(baseUrl);
                    owner.get(baseUrl, params, function (json) {
                        if (json.results) {
                            json.results = json.results.filter(function (result) {
                                var forbiddenCountries = ['KR', 'CN', 'JP'];
                                return !result.origin_country || !result.origin_country.some(function (country) {
                                    return forbiddenCountries.includes(country);
                                });
                            });
                        }
                        json.title = Lampa.Lang.translate('surs_title_trend_week') + ' ' + Lampa.Lang.translate('surs_series');
                        callback(json);
                    }, callback);
                }

                trendingsData.push(trendingMovies);
                trendingsData.push(trendingTV);

                function getStreamingWithGenres(serviceName, serviceId, isRussian) {
                    return function (callback) {
                        var sortOptions = getSortOptions();
                        var genres = getGenres();
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var genre = genres[Math.floor(Math.random() * genres.length)];
                        var apiUrl = 'discover/tv?with_networks=' + serviceId +
                            '&with_genres=' + genre.id +
                            '&sort_by=' + sort.id;

                        if (isRussian) {
                            apiUrl = applyAgeRestriction(apiUrl);
                            apiUrl = applyWithoutKeywords(apiUrl);
                        } else {
                            apiUrl = buildApiUrl(apiUrl);
                        }

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results);
                            }
                            json.title = Lampa.Lang.translate(sort.title) + ' (' + Lampa.Lang.translate(genre.title) + ') ' + Lampa.Lang.translate('surs_on') + ' ' + serviceName;
                            callback(json);
                        }, callback);
                    };
                }

                function getStreaming(serviceName, serviceId, isRussian) {
                    return function (callback) {
                        var sortOptions = getSortOptions();
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var apiUrl = 'discover/tv?with_networks=' + serviceId +
                            '&sort_by=' + sort.id;

                        if (isRussian) {
                            apiUrl = applyAgeRestriction(apiUrl);
                            apiUrl = applyWithoutKeywords(apiUrl);
                        } else {
                            apiUrl = buildApiUrl(apiUrl);
                        }

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results);
                            }
                            json.title = Lampa.Lang.translate(sort.title) + ' ' + Lampa.Lang.translate('surs_on') + ' ' + serviceName;
                            callback(json);
                        }, callback);
                    };
                }

                function getSelectedStreamingServices() {
                    var includeGlobal = getStoredSetting('getStreamingServices', true);
                    var includeRussian = getStoredSetting('getStreamingServicesRUS', true);
                    var streamingServices = getStreamingServices();
                    var streamingServicesRUS = getStreamingServicesRUS();

                    if (includeGlobal && includeRussian) {
                        return streamingServices.concat(streamingServicesRUS);
                    } else if (includeGlobal) {
                        return streamingServices;
                    } else if (includeRussian) {
                        return streamingServicesRUS;
                    }
                    return [];
                }

                var selectedStreamingServices = getSelectedStreamingServices();

                selectedStreamingServices.forEach(function (service) {
                    var isRussian = getStreamingServicesRUS().some(function (rusService) {
                        return rusService.id === service.id;
                    });
                    CustomData.push(getStreamingWithGenres(service.title, service.id, isRussian));
                });

                selectedStreamingServices.forEach(function (service) {
                    var isRussian = getStreamingServicesRUS().some(function (rusService) {
                        return rusService.id === service.id;
                    });
                    CustomData.push(getStreaming(service.title, service.id, isRussian));
                });

                function getMovies(genre, options) {
                    options = options || {};
                    return function (callback) {
                        var sortOptions = getSortOptions();
                        var sort = adjustSortForMovies(sortOptions[Math.floor(Math.random() * sortOptions.length)]);
                        var apiUrl = 'discover/movie?with_genres=' + genre.id + '&sort_by=' + sort.id;

                        if (options.russian) apiUrl += '&with_origin_country=RU';
                        if (options.ukrainian) apiUrl += '&with_origin_country=UA';
                        if (sort.extraParams) apiUrl += sort.extraParams;

                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                if (!options.russian && !options.ukrainian) {
                                    json.results = applyFilters(json.results);
                                }
                                var titlePrefix = options.russian ? Lampa.Lang.translate('surs_russian') :
                                    options.ukrainian ? Lampa.Lang.translate('surs_ukrainian') : '';
                                json.title = Lampa.Lang.translate(sort.title) + ' ' + titlePrefix + ' (' + Lampa.Lang.translate(genre.title) + ')';
                            }
                            callback(json);
                        }, callback);
                    };
                }

                function getTVShows(genre, options) {
                    options = options || {};
                    return function (callback) {
                        var sortOptions = getSortOptions();
                        var sort = adjustSortForTVShows(sortOptions[Math.floor(Math.random() * sortOptions.length)]);
                        var apiUrl = 'discover/tv?with_genres=' + genre.id + '&sort_by=' + sort.id;

                        if (options.russian) apiUrl += '&with_origin_country=RU';
                        if (options.korean) apiUrl += '&with_origin_country=KR';
                        if (options.turkish) apiUrl += '&with_origin_country=TR';
                        if (options.ukrainian) apiUrl += '&with_origin_country=UA';
                        if (sort.extraParams) apiUrl += sort.extraParams;

                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                if (!options.russian && !options.ukrainian) {
                                    json.results = applyFilters(json.results);
                                }
                                var titlePrefix = options.russian ? Lampa.Lang.translate('surs_russian') :
                                    options.korean ? Lampa.Lang.translate('surs_korean') :
                                        options.turkish ? Lampa.Lang.translate('surs_turkish') :
                                            options.ukrainian ? Lampa.Lang.translate('surs_ukrainian') : '';
                                json.title = Lampa.Lang.translate(sort.title) + ' ' + titlePrefix + ' ' + Lampa.Lang.translate('surs_tv_shows') + ' (' + Lampa.Lang.translate(genre.title) + ')';
                            }
                            callback(json);
                        }, callback);
                    };
                }

                var genres = getGenres();
                var includeGlobalMovies = getStoredSetting('getMoviesByGenreGlobal', true);
                var includeRussianMovies = getStoredSetting('getMoviesByGenreRus', true);
                
                var isGlobalTVEnabled = getStoredSetting('getTVShowsByGenreGlobal', true);
                var isRussianTVEnabled = getStoredSetting('getTVShowsByGenreRus', true);
                var isKoreanTVEnabled = getStoredSetting('getTVShowsByGenreKOR', false);
                var isTurkishTVEnabled = getStoredSetting('getTVShowsByGenreTR', true);
                
                genres.forEach(function (genre) {
                    if (includeGlobalMovies) CustomData.push(getMovies(genre));
                    if (includeRussianMovies) CustomData.push(getMovies(genre, { russian: true }));
                });

                genres.forEach(function (genre) {
                    if (isGlobalTVEnabled) CustomData.push(getTVShows(genre));
                    if (isRussianTVEnabled) CustomData.push(getTVShows(genre, { russian: true }));
                    if (isKoreanTVEnabled) CustomData.push(getTVShows(genre, { korean: true }));
                    if (isTurkishTVEnabled) CustomData.push(getTVShows(genre, { turkish: true }));
                });

                function getBestContentByGenre(genre, contentType) {
                    return function (callback) {
                        var apiUrl = 'discover/' + contentType + '?with_genres=' + genre.id +
                            '&sort_by=vote_average.desc' +
                            '&vote_count.gte=500';

                        apiUrl = applyAgeRestriction(apiUrl);
                        apiUrl = applyWithoutKeywords(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = filterCyrillic(json.results);
                            }
                            json.title = Lampa.Lang.translate(contentType === 'movie' ? 'surs_top_movies' : 'surs_top_tv') + ' (' + Lampa.Lang.translate(genre.title) + ')';
                            callback(json);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    var isMoviesEnabled = getStoredSetting('getBestContentByGenreMovie', true);
                    var isTVEnabled = getStoredSetting('getBestContentByGenreTV', true);
                    if (isMoviesEnabled) CustomData.push(getBestContentByGenre(genre, 'movie'));
                    if (isTVEnabled) CustomData.push(getBestContentByGenre(genre, 'tv'));
                });

                function getBestContentByGenreAndPeriod(type, genre, startYear, endYear) {
                    return function (callback) {
                        var baseUrl = 'discover/' + type + '?with_genres=' + genre.id +
                            '&sort_by=vote_average.desc' +
                            '&vote_count.gte=100' +
                            '&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.gte=' + startYear + '-01-01' +
                            '&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.lte=' + endYear + '-12-31';

                        baseUrl = applyAgeRestriction(baseUrl);
                        baseUrl = applyWithoutKeywords(baseUrl);

                        owner.get(baseUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results).filter(function (content) {
                                    var dateField = type === 'movie' ? 'release_date' : 'first_air_date';
                                    return content[dateField] &&
                                        parseInt(content[dateField].substring(0, 4)) >= startYear &&
                                        parseInt(content[dateField].substring(0, 4)) <= endYear;
                                });
                            }
                            json.title = Lampa.Lang.translate(type === 'movie' ? 'surs_top_movies' : 'surs_top_tv') +
                                ' (' + Lampa.Lang.translate(genre.title) + ')' +
                                Lampa.Lang.translate('surs_for_period') + startYear + '-' + endYear;
                            callback(json);
                        }, callback);
                    };
                }

                var periods = [
                    { start: 1970, end: 1974 }, { start: 1975, end: 1979 }, { start: 1980, end: 1984 },
                    { start: 1985, end: 1989 }, { start: 1990, end: 1994 }, { start: 1995, end: 1999 },
                    { start: 2000, end: 2004 }, { start: 2005, end: 2009 }, { start: 2010, end: 2014 },
                    { start: 2015, end: 2019 }, { start: 2020, end: 2025 }
                ];

                function getRandomPeriod() {
                    var index = Math.floor(Math.random() * periods.length);
                    return periods[index];
                }

                genres.forEach(function (genre) {
                    var useMovies = getStoredSetting('getBestContentByGenreAndPeriod_movie', true);
                    var useTV = getStoredSetting('getBestContentByGenreAndPeriod_tv', true);
                    var period1 = getRandomPeriod();
                    var period2 = getRandomPeriod();
                    while (period2.start === period1.start && period2.end === period1.end) {
                        period2 = getRandomPeriod();
                    }
                    [period1, period2].forEach(function (period) {
                        if (useMovies) CustomData.push(getBestContentByGenreAndPeriod('movie', genre, period.start, period.end));
                        if (useTV) CustomData.push(getBestContentByGenreAndPeriod('tv', genre, period.start, period.end));
                    });
                });

                // Популярные персоны (Только новый API)
                function getPopularPersons() {
                    return function (cb) {
                        owner.get('person/popular', params, function (json) {
                            json = Lampa.Utils.addSource(json, 'tmdb');
                            json.title = Lampa.Lang.translate('surs_popular_persons');
                            json.results.forEach(function (person) {
                                person.params = {
                                    module: Lampa.Maker.module('Card').only('Card', 'Release', 'Callback'),
                                    emit: {
                                        onFocus: function () {
                                            Lampa.Background.change(Lampa.Utils.cardImgBackground(person));
                                        },
                                        onEnter: function () {
                                            Lampa.Router.call('actor', person);
                                        }
                                    }
                                };
                            });
                            cb(json);
                        }, cb);
                    };
                }

                CustomData = CustomData.map(wrapWithWideFlag);
                CustomData.push(getPopularPersons());
                shuffleArray(CustomData);
                CustomData.splice(4, 0, getUpcomingEpisodes());

                var combinedData = partsData.concat(trendingsData).concat(CustomData);

                function loadPart(partLoaded, partEmpty) {
                    Lampa.Api.partNext(combinedData, partsLimit, partLoaded, partEmpty);
                }

                loadPart(onComplete, onError);
                return loadPart;
            };
        };

        // Новинки
        var SourceTMDBnew = function (parent) {
            this.network = new Lampa.Reguest();
            this.discovery = false;

            this.main = function () {
                var owner = this;
                var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
                var onComplete = arguments.length > 1 ? arguments[1] : undefined;
                var onError = arguments.length > 2 ? arguments[2] : undefined;
                var partsLimit = 9;

                function shuffleArray(array) {
                    for (var i = array.length - 1; i > 0; i--) {
                        var j = Math.floor(Math.random() * (i + 1));
                        var temp = array[i];
                        array[i] = array[j];
                        array[j] = temp;
                    }
                }

                var partsData = getPartsData();
                var CustomData = [];

                function getStreamingWithGenres(serviceName, serviceId, isRussian) {
                    return function (callback) {
                        var genres = getGenres();
                        var sort = { id: 'first_air_date.desc', title: 'surs_first_air_date_desc' };
                        var genre = genres[Math.floor(Math.random() * genres.length)];
                        var apiUrl = 'discover/tv?with_networks=' + serviceId +
                            '&with_genres=' + genre.id +
                            '&sort_by=' + sort.id;

                        if (isRussian) {
                            apiUrl = applyAgeRestriction(apiUrl);
                            apiUrl = applyWithoutKeywords(apiUrl);
                        } else {
                            apiUrl = buildApiUrl(apiUrl);
                        }

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results);
                            }
                            json.title = Lampa.Lang.translate(sort.title) + ' (' + Lampa.Lang.translate(genre.title) + ') ' + Lampa.Lang.translate('surs_on') + ' ' + serviceName;
                            callback(json);
                        }, callback);
                    };
                }

                function getStreaming(serviceName, serviceId, isRussian) {
                    return function (callback) {
                        var sort = { id: 'first_air_date.desc', title: 'surs_first_air_date_desc' };
                        var apiUrl = 'discover/tv?with_networks=' + serviceId +
                            '&sort_by=' + sort.id;

                        if (isRussian) {
                            apiUrl = applyAgeRestriction(apiUrl);
                            apiUrl = applyWithoutKeywords(apiUrl);
                        } else {
                            apiUrl = buildApiUrl(apiUrl);
                        }

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results);
                            }
                            json.title = Lampa.Lang.translate(sort.title) + ' ' + Lampa.Lang.translate('surs_on') + ' ' + serviceName;
                            callback(json);
                        }, callback);
                    };
                }

                function getSelectedStreamingServices() {
                    var streamingServices = getStreamingServices();
                    var streamingServicesRUS = getStreamingServicesRUS();
                    return streamingServices.concat(streamingServicesRUS);
                }

                function getMovies(genre, options) {
                    options = options || {};
                    return function (callback) {
                        var sort = adjustSortForMovies({ id: 'first_air_date.desc', title: 'surs_first_air_date_desc' });
                        var apiUrl = 'discover/movie?with_genres=' + genre.id + '&sort_by=' + sort.id;

                        if (options.russian) apiUrl += '&with_origin_country=RU';
                        if (options.ukrainian) apiUrl += '&with_origin_country=UA';
                        if (sort.extraParams) apiUrl += sort.extraParams;

                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                if (!options.russian && !options.ukrainian) {
                                    json.results = applyFilters(json.results);
                                }
                                var titlePrefix = options.russian ? Lampa.Lang.translate('surs_russian') :
                                    options.ukrainian ? Lampa.Lang.translate('surs_ukrainian') : '';
                                json.title = Lampa.Lang.translate(sort.title) + ' ' + titlePrefix + ' (' + Lampa.Lang.translate(genre.title) + ')';
                            }
                            callback(json);
                        }, callback);
                    };
                }

                function getTVShows(genre, options) {
                    options = options || {};
                    return function (callback) {
                        var sort = adjustSortForTVShows({ id: 'first_air_date.desc', title: 'surs_first_air_date_desc' });
                        var apiUrl = 'discover/tv?with_genres=' + genre.id + '&sort_by=' + sort.id;

                        if (options.russian) apiUrl += '&with_origin_country=RU';
                        if (options.korean) apiUrl += '&with_origin_country=KR';
                        if (options.turkish) apiUrl += '&with_origin_country=TR';
                        if (options.ukrainian) apiUrl += '&with_origin_country=UA';
                        if (sort.extraParams) apiUrl += sort.extraParams;

                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                if (!options.russian && !options.ukrainian) {
                                    json.results = applyFilters(json.results);
                                }
                                var titlePrefix = options.russian ? Lampa.Lang.translate('surs_russian') :
                                    options.korean ? Lampa.Lang.translate('surs_korean') :
                                        options.turkish ? Lampa.Lang.translate('surs_turkish') :
                                            options.ukrainian ? Lampa.Lang.translate('surs_ukrainian') : '';
                                json.title = Lampa.Lang.translate(sort.title) + ' ' + titlePrefix + ' ' + Lampa.Lang.translate('surs_tv_shows') + ' (' + Lampa.Lang.translate(genre.title) + ')';
                            }
                            callback(json);
                        }, callback);
                    };
                }

                var genres = getGenres();
                genres.forEach(function (genre) {
                    CustomData.push(getMovies(genre));
                    CustomData.push(getMovies(genre, { russian: true }));
                });

                genres.forEach(function (genre) {
                    CustomData.push(getTVShows(genre));
                    CustomData.push(getTVShows(genre, { russian: true }));
                    CustomData.push(getTVShows(genre, { korean: true }));
                    CustomData.push(getTVShows(genre, { turkish: true }));
                });

                var selectedStreamingServices = getSelectedStreamingServices();

                selectedStreamingServices.forEach(function (service) {
                    var isRussian = getStreamingServicesRUS().some(function (rusService) {
                        return rusService.id === service.id;
                    });
                    CustomData.push(getStreamingWithGenres(service.title, service.id, isRussian));
                });

                selectedStreamingServices.forEach(function (service) {
                    var isRussian = getStreamingServicesRUS().some(function (rusService) {
                        return rusService.id === service.id;
                    });
                    CustomData.push(getStreaming(service.title, service.id, isRussian));
                });

                CustomData = CustomData.map(wrapWithWideFlag);
                shuffleArray(CustomData);
                var combinedData = partsData.concat(CustomData);

                function loadPart(partLoaded, partEmpty) {
                    Lampa.Api.partNext(combinedData, partsLimit, partLoaded, partEmpty);
                }

                loadPart(onComplete, onError);
                return loadPart;
            };
        };

        /* Для детей */
        var SourceTMDBkids = function (parent) {
            this.network = new Lampa.Reguest();
            this.discovery = false;

            this.main = function () {
                var owner = this;
                var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
                var onComplete = arguments.length > 1 ? arguments[1] : undefined;
                var onError = arguments.length > 2 ? arguments[2] : undefined;
                var partsLimit = 9;

                var sortOptions = [
                    { key: 'vote_count.desc', title: 'Много голосов' },
                    { key: 'vote_average.desc', title: 'Высокий рейтинг' },
                    { key: 'first_air_date.desc', title: 'Новинки' },
                    { key: 'popularity.desc', title: 'Популярные' },
                    { key: 'revenue.desc', title: 'Интерес зрителей' }
                ];

                var genres = [
                    { id: 28, title: 'боевики' },
                    { id: 35, title: 'комедии' },
                    { id: 16, title: 'мультфильмы' },
                    { id: 10762, title: 'детское' },
                    { id: 12, title: 'приключения' },
                    { id: 878, title: 'фантастика' },
                    { id: 10751, title: 'семейные' },
                    { id: 14, title: 'фэнтези' },
                ];

                var streamingServices = [
                    { id: 49, title: 'HBO' },
                    { id: 77, title: 'SyFy' },
                    { id: 2552, title: 'Apple TV+' },
                    { id: 453, title: 'Hulu' },
                    { id: 1024, title: 'Amazon Prime' },
                    { id: 213, title: 'Netflix' },
                    { id: 3186, title: 'HBO Max' },
                    { id: 2076, title: 'Paramount+' },
                    { id: 3353, title: 'Peacock' },
                    { id: 2739, title: 'Disney+' },
                    { id: 44, title: 'Disney XD' },
                    { id: 281, title: 'Disney XD' },
                    { id: 2, title: 'ABC' },
                    { id: 6, title: 'NBC' },
                    { id: 16, title: 'CBS' },
                    { id: 318, title: 'Starz' },
                    { id: 174, title: 'BBC' },
                    { id: 56, title: 'Cartoon Network' },
                    { id: 19, title: 'FOX' },
                    { id: 2686, title: 'FOX kids' },
                    { id: 13, title: 'Nicelodeon' },
                ];

                var streamingServicesRUS = [
                    { id: 2493, title: 'Start' },
                    { id: 2859, title: 'Premier' },
                    { id: 4085, title: 'KION' },
                    { id: 3923, title: 'ИВИ' },
                    { id: 412, title: 'Россия 1' },
                    { id: 558, title: 'Первый канал' },
                    { id: 3827, title: 'Кинопоиск' },
                    { id: 5806, title: 'Wink' },
                ];

                function applyMinVotes(baseUrl) {
                    var minVotes = 5;
                    baseUrl += '&vote_count.gte=' + minVotes;
                    return baseUrl;
                }

                function applyAgeRestriction(baseUrl) {
                    var certification = '6+';
                    baseUrl += '&certification_country=RU&certification=' + encodeURIComponent(certification);
                    return baseUrl;
                }

                function applyWithoutKeywords(baseUrl) {
                    var baseExcludedKeywords = ['346488', '158718', '41278', '13141', '345822', '315535', '290667', '323477', '290609'];
                    baseUrl += '&without_keywords=' + encodeURIComponent(baseExcludedKeywords.join(','));
                    return baseUrl;
                }

                function buildApiUrl(baseUrl) {
                    baseUrl = applyMinVotes(baseUrl);
                    baseUrl = applyAgeRestriction(baseUrl);
                    baseUrl = applyWithoutKeywords(baseUrl);
                    return baseUrl;
                }

                var buttonsData = getPartsData();
                var partsData = [];

                function getStreamingWithGenres(serviceName, serviceId) {
                    return function (callback) {
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var genre = genres[Math.floor(Math.random() * genres.length)];
                        var apiUrl = buildApiUrl(
                            'discover/tv?with_networks=' + serviceId +
                            '&with_genres=' + genre.id +
                            '&sort_by=' + sort.key +
                            '&air_date.lte=' + new Date().toISOString().substr(0, 10)
                        );

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results);
                            }
                            json.title = Lampa.Lang.translate(sort.title + ' (' + genre.title + ') на ' + serviceName);
                            callback(json);
                        }, callback);
                    };
                }

                function getStreaming(serviceName, serviceId) {
                    return function (callback) {
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var apiUrl = buildApiUrl(
                            'discover/tv?with_networks=' + serviceId +
                            '&sort_by=' + sort.key +
                            '&air_date.lte=' + new Date().toISOString().substr(0, 10)
                        );

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results);
                            }
                            json.title = Lampa.Lang.translate(sort.title + ' на ' + serviceName);
                            callback(json);
                        }, callback);
                    };
                }

                var selectedStreamingServices = streamingServices.concat(streamingServicesRUS);

                selectedStreamingServices.forEach(function (service) {
                    partsData.push(getStreamingWithGenres(service.title, service.id));
                    partsData.push(getStreaming(service.title, service.id));
                });

                function getMovies(genre, options) {
                    options = options || {};
                    return function (callback) {
                        var sort = adjustSortForMovies(sortOptions[Math.floor(Math.random() * sortOptions.length)]);
                        var apiUrl = 'discover/movie?with_genres=' + genre.id + '&sort_by=' + sort.key;

                        if (options.russian) apiUrl += '&with_original_language=ru';

                        if (sort.key === 'release_date.desc') {
                            var today = new Date().toISOString().split('T')[0];
                            apiUrl += '&release_date.lte=' + today;
                            if (options.russian) {
                                apiUrl += '&region=RU';
                            }
                        }
                        if (sort.extraParams) apiUrl += sort.extraParams;
                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (!options.russian && json.results) {
                                json.results = applyFilters(json.results);
                            }
                            var titlePrefix = options.russian ? ' - российские' : '';
                            json.title = Lampa.Lang.translate(sort.title + titlePrefix + ' (' + genre.title + ')');
                            callback(json);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    partsData.push(getMovies(genre));
                    partsData.push(getMovies(genre, { russian: true }));
                });

                function getTVShows(genre, options) {
                    options = options || {};
                    return function (callback) {
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var apiUrl = 'discover/tv?with_genres=' + genre.id + '&sort_by=' + sort.key;
                        if (options.russian) apiUrl += '&with_origin_country=RU';
                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (!options.russian && json.results) {
                                json.results = applyFilters(json.results);
                            }
                            var titlePrefix = options.russian ? ' - российские' : '';
                            json.title = Lampa.Lang.translate(sort.title + titlePrefix + ' сериалы (' + genre.title + ')');
                            callback(json);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    partsData.push(getTVShows(genre));
                    partsData.push(getTVShows(genre, { russian: true }));
                });

                function getAnimatedMovies(options) {
                    options = options || {};
                    return function (callback) {
                        var genreIds = ['16', '10751'];
                        for (var i = 0; i < sortOptions.length; i++) {
                            var sort = sortOptions[i];
                            var adjustedSort = adjustSortForMovies(sort);
                            var apiUrl = 'discover/movie?with_genres=' + genreIds.join(',') + '&sort_by=' + adjustedSort.key;

                            if (options && options.russian) apiUrl += '&with_original_language=ru';
                            if (adjustedSort.key === 'release_date.desc') {
                                var today = new Date().toISOString().split('T')[0];
                                apiUrl += '&release_date.lte=' + today;
                                if (options && options.russian) apiUrl += '&region=RU';
                            }
                            if (adjustedSort.extraParams) apiUrl += adjustedSort.extraParams;
                            apiUrl = buildApiUrl(apiUrl);

                            owner.get(apiUrl, params, (function (sortOption) {
                                return function (json) {
                                    if (json.results) json.results = applyFilters(json.results);
                                    var titlePrefix = options && options.russian ? ' - российские' : '';
                                    json.title = Lampa.Lang.translate(sortOption.title + titlePrefix + ' (Мультфильмы, Детское)');
                                    callback(json);
                                };
                            })(sort), callback);
                        }
                    };
                }

                for (var j = 0; j < sortOptions.length; j++) {
                    partsData.push(getAnimatedMovies());
                    partsData.push(getAnimatedMovies({ russian: true }));
                }

                function getBestContentByGenre(genre, contentType) {
                    return function (callback) {
                        var apiUrl = 'discover/' + contentType + '?with_genres=' + genre.id +
                            '&sort_by=vote_average.desc' +
                            '&vote_count.gte=200';

                        var russianApiUrl = apiUrl + '&with_origin_country=RU';

                        apiUrl = applyAgeRestriction(apiUrl);
                        apiUrl = applyWithoutKeywords(apiUrl);
                        russianApiUrl = applyAgeRestriction(russianApiUrl);
                        russianApiUrl = applyWithoutKeywords(russianApiUrl);

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) json.results = filterCyrillic(json.results);
                            json.title = Lampa.Lang.translate(contentType === 'movie'
                                ? 'Топ фильмы (' + genre.title + ')'
                                : 'Топ сериалы (' + genre.title + ')');
                            callback(json);
                        }, callback);

                        owner.get(russianApiUrl, params, function (russianJson) {
                            if (russianJson.results) russianJson.results = filterCyrillic(russianJson.results);
                            russianJson.title = Lampa.Lang.translate(contentType === 'movie'
                                ? 'Лучшие российские фильмы (' + genre.title + ')'
                                : 'Лучшие российские сериалы (' + genre.title + ')');
                            callback(russianJson);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    partsData.push(getBestContentByGenre(genre, 'movie'));
                    partsData.push(getBestContentByGenre(genre, 'tv'));
                });

                function getBestContentByGenreAndPeriod(type, genre, startYear, endYear) {
                    return function (callback) {
                        var baseUrl = 'discover/' + type + '?with_genres=' + genre.id +
                            '&sort_by=vote_average.desc' +
                            '&vote_count.gte=100' +
                            '&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.gte=' + startYear + '-01-01' +
                            '&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.lte=' + endYear + '-12-31';

                        baseUrl = applyAgeRestriction(baseUrl);
                        baseUrl = applyWithoutKeywords(baseUrl);

                        owner.get(baseUrl, params, function (json) {
                            if (json.results) {
                                json.results = applyFilters(json.results).filter(function (content) {
                                    var dateField = type === 'movie' ? 'release_date' : 'first_air_date';
                                    return content[dateField] &&
                                        parseInt(content[dateField].substring(0, 4)) >= startYear &&
                                        parseInt(content[dateField].substring(0, 4)) <= endYear;
                                });
                            }
                            json.title = Lampa.Lang.translate('Топ ' + (type === 'movie' ? 'фильмы' : 'сериалы') +
                                ' (' + genre.title + ') за ' + startYear + '-' + endYear);
                            callback(json);
                        }, callback);
                    };
                }

                var periods = [
                    { start: 1985, end: 1989 }, { start: 1990, end: 2004 }, { start: 1995, end: 1999 },
                    { start: 2000, end: 2004 }, { start: 2005, end: 2009 }, { start: 2010, end: 2014 },
                    { start: 2015, end: 2019 }, { start: 2020, end: 2025 }
                ];

                function getRandomPeriod() {
                    var index = Math.floor(Math.random() * periods.length);
                    return periods[index];
                }

                genres.forEach(function (genre) {
                    var period = getRandomPeriod();
                    partsData.push(getBestContentByGenreAndPeriod('movie', genre, period.start, period.end));
                    partsData.push(getBestContentByGenreAndPeriod('tv', genre, period.start, period.end));
                });

                var forKids = [
                    { id: 1, title: 'Спанч Боб' }, { id: 2, title: 'Губка Боб' }, { id: 3, title: 'Teenage Mutant Ninja Turtles' },
                    { id: 4, title: 'Черепашки-ниндзя' }, { id: 5, title: 'Fairly OddParents' }, { id: 6, title: 'Джимми Нейтрон' },
                    { id: 8, title: 'Аватар: Легенда об Аанге' }, { id: 9, title: 'Аватар: Легенда о Корре' }, { id: 101, title: 'Lego' },
                    { id: 102, title: 'Том и Джерри' }, { id: 103, title: 'Микки Маус' }, { id: 104, title: 'Гуфи' },
                    { id: 105, title: 'Снупи' }, { id: 106, title: 'Простоквашино' }, { id: 107, title: 'Ну, погоди!' },
                    { id: 108, title: 'Чип и Дейл' }, { id: 109, title: 'DuckTales' }, { id: 110, title: 'Looney Tunes' },
                    { id: 111, title: 'Покемон' }, { id: 112, title: 'Даша-путешественница' }, { id: 113, title: 'Свинка Пеппа' },
                    { id: 114, title: 'Барбоскины' }, { id: 115, title: 'Смешарики' }, { id: 116, title: 'Фиксики' },
                    { id: 120, title: 'Гравити Фолз' }, { id: 121, title: 'Чудеса на виражах' }, { id: 122, title: 'Пингвины из Мадагаскара' },
                    { id: 123, title: 'Король Лев' }, { id: 124, title: 'Холодное сердце' }, { id: 126, title: 'Как приручить дракона' },
                    { id: 127, title: 'Зверополис' }, { id: 128, title: 'Миньоны' }, { id: 129, title: 'Шрэк' },
                    { id: 206, title: 'Маша и Медведь' }, { id: 207, title: 'Котенок по имени Гав' }, { id: 208, title: 'Чебурашка' },
                    { id: 209, title: 'Малыш и Карлсон' }, { id: 210, title: 'Лунтик' }, { id: 211, title: 'Три богатыря' },
                    { id: 212, title: 'Иван Царевич и Серый Волк' }, { id: 213, title: 'Кот Леопольд' }, { id: 215, title: 'Варежка' },
                    { id: 217, title: 'Каникулы Бонифация' }, { id: 219, title: 'Сказка о царе Салтане' }, { id: 220, title: 'Алеша Попович' },
                    { id: 251, title: 'Илья муромец' }, { id: 233, title: 'Оранжевая корова' }, { id: 222, title: 'Малышарики' },
                    { id: 223, title: 'Winnie-the-Pooh' }, { id: 225, title: 'Щенячий патруль' }, { id: 226, title: 'Tiny Toon' },
                    { id: 227, title: 'Обезьянки' }, { id: 229, title: 'Буратино' },
                ];

                function searchByKeyword(keyword) {
                    return function (callback) {
                        var movieApiUrl = 'search/movie?query=' + encodeURIComponent(keyword.title);
                        var tvApiUrl = 'search/tv?query=' + encodeURIComponent(keyword.title);
                        movieApiUrl = buildApiUrl(movieApiUrl);
                        tvApiUrl = buildApiUrl(tvApiUrl);

                        var movieResults = null;
                        var tvResults = null;

                        function processResults() {
                            if (movieResults !== null && tvResults !== null) {
                                var combinedResults = movieResults.concat(tvResults);
                                combinedResults = filterCyrillic(combinedResults);
                                combinedResults = combinedResults.filter(function (item) {
                                    return (item.vote_average || 0) >= 6.1;
                                });
                                combinedResults.sort(function (a, b) {
                                    return (b.vote_average || 0) - (a.vote_average || 0);
                                });
                                var json = {
                                    results: combinedResults,
                                    title: Lampa.Lang.translate(keyword.title)
                                };
                                callback(json);
                            }
                        }

                        owner.get(movieApiUrl, {}, function (json) {
                            movieResults = json.results || [];
                            processResults();
                        }, function () {
                            movieResults = [];
                            processResults();
                        });

                        owner.get(tvApiUrl, {}, function (json) {
                            tvResults = json.results || [];
                            processResults();
                        }, function () {
                            tvResults = [];
                            processResults();
                        });
                    };
                }

                forKids.forEach(function (keyword) {
                    partsData.push(searchByKeyword(keyword));
                });

                var kidsStudios = [
                    { id: 2, title: 'Disney' }, { id: 3, title: 'Pixar' }, { id: 7501, title: 'Союзмультфильм(РФ)' },
                    { id: 14599, title: 'Союзмультфильм(СССР)' }, { id: 521, title: 'DreamWorks Animation' },
                    { id: 9383, title: 'Blue Sky Studios' }, { id: 6704, title: 'Illumination Entertainment' },
                    { id: 2251, title: 'Sony Pictures Animation' }, { id: 10342, title: 'Studio Ghibli' },
                ];

                function getStudioMovies(studio) {
                    return function (callback) {
                        var movieApiUrl = 'discover/movie?with_companies=' + studio.id +
                            '&sort_by=vote_average.desc';
                        movieApiUrl = applyWithoutKeywords(movieApiUrl);
                        owner.get(movieApiUrl, {}, function (json) {
                            var movieResults = filterCyrillic(json.results || []);
                            var response = {
                                results: movieResults,
                                title: Lampa.Lang.translate('Фильмы от студии - ' + studio.title)
                            };
                            callback(response);
                        }, function () {
                            callback({ results: [], title: Lampa.Lang.translate('Фильмы от студии - ' + studio.title) });
                        });
                    };
                }

                function getStudioTVShows(studio) {
                    return function (callback) {
                        var tvApiUrl = 'discover/tv?with_companies=' + studio.id +
                            '&sort_by=vote_average.desc';
                        tvApiUrl = applyWithoutKeywords(tvApiUrl);
                        owner.get(tvApiUrl, {}, function (json) {
                            var tvResults = filterCyrillic(json.results || []);
                            var response = {
                                results: tvResults,
                                title: Lampa.Lang.translate('Сериалы от студии - ' + studio.title)
                            };
                            callback(response);
                        }, function () {
                            callback({ results: [], title: Lampa.Lang.translate('Сериалы от студии - ' + studio.title) });
                        });
                    };
                }

                kidsStudios.forEach(function (studio) {
                    partsData.push(getStudioMovies(studio));
                    partsData.push(getStudioTVShows(studio));
                });

                function getNickelodeonContent() {
                    return function (callback) {
                        var movieApiUrl = 'discover/movie?with_companies=4';
                        var tvApiUrl = 'discover/tv?with_networks=13';
                        movieApiUrl = buildApiUrl(movieApiUrl);
                        tvApiUrl = buildApiUrl(tvApiUrl);
                        var movieResults = null;
                        var tvResults = null;

                        function processResults() {
                            if (movieResults !== null && tvResults !== null) {
                                var combinedResults = movieResults.concat(tvResults);
                                combinedResults = filterCyrillic(combinedResults);
                                combinedResults.sort(function (a, b) {
                                    return (b.vote_average || 0) - (a.vote_average || 0);
                                });
                                var json = {
                                    results: combinedResults,
                                    title: Lampa.Lang.translate('Nickelodeon')
                                };
                                callback(json);
                            }
                        }

                        owner.get(movieApiUrl, {}, function (json) {
                            movieResults = json.results || [];
                            processResults();
                        }, function () {
                            movieResults = [];
                            processResults();
                        });

                        owner.get(tvApiUrl, {}, function (json) {
                            tvResults = json.results || [];
                            processResults();
                        }, function () {
                            tvResults = [];
                            processResults();
                        });
                    };
                }

                partsData.push(getNickelodeonContent());
                partsData = partsData.map(wrapWithWideFlag);
                shuffleArray(partsData);
                var combinedData = buttonsData.concat(partsData);

                function loadPart(partLoaded, partEmpty) {
                    Lampa.Api.partNext(combinedData, partsLimit, partLoaded, partEmpty);
                }

                loadPart(onComplete, onError);
                return loadPart;
            };
        };

        var SourceTMDBrus = function (parent) {
            this.network = new Lampa.Reguest();
            this.discovery = false;

            this.main = function () {
                var owner = this;
                var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
                var onComplete = arguments.length > 1 ? arguments[1] : undefined;
                var onError = arguments.length > 2 ? arguments[2] : undefined;
                var partsLimit = 9;

                var sortOptions = [
                    { key: 'vote_count.desc', title: 'Много голосов' },
                    { key: 'vote_average.desc', title: 'Высокий рейтинг' },
                    { key: 'first_air_date.desc', title: 'Новинки' },
                    { key: 'popularity.desc', title: 'Популярные' },
                    { key: 'revenue.desc', title: 'Интерес зрителей' }
                ];

                var genres = [
                    { id: 28, title: 'боевики' }, { id: 35, title: 'комедии' }, { id: 18, title: 'драмы' },
                    { id: 10749, title: 'мелодрамы' }, { id: 16, title: 'мультфильмы' }, { id: 10762, title: 'детское' },
                    { id: 12, title: 'приключения' }, { id: 80, title: 'криминал' }, { id: 9648, title: 'детективы' },
                    { id: 878, title: 'фантастика' }, { id: 10752, title: 'военные' }, { id: 37, title: 'вестерны' },
                    { id: 53, title: 'триллеры' }, { id: 10751, title: 'семейные' }, { id: 14, title: 'фэнтези' },
                    { id: 10764, title: 'реалити-шоу' }, { id: 10759, title: 'боевики и приключения' },
                    { id: 10766, title: 'мыльные оперы' }, { id: 10767, title: 'ток-шоу' },
                ];

                var streamingServicesRUS = [
                    { id: 2493, title: 'Start' }, { id: 2859, title: 'Premier' }, { id: 4085, title: 'KION' },
                    { id: 3923, title: 'ИВИ' }, { id: 412, title: 'Россия 1' }, { id: 558, title: 'Первый канал' },
                    { id: 3871, title: 'Okko' }, { id: 3827, title: 'Кинопоиск' }, { id: 5806, title: 'Wink' },
                    { id: 806, title: 'СТС' }, { id: 1191, title: 'ТНТ' }, { id: 1119, title: 'НТВ' },
                    { id: 3031, title: 'Пятница' }, { id: 3882, title: 'More.TV' }
                ];

                function applyMinVotes(baseUrl) {
                    var minVotes = 10;
                    baseUrl += '&vote_count.gte=' + minVotes;
                    return baseUrl;
                }

                function applyAgeRestriction(baseUrl) { return baseUrl; }

                function applyWithoutKeywords(baseUrl) {
                    var baseExcludedKeywords = ['346488', '158718', '41278'];
                    baseUrl += '&without_keywords=' + encodeURIComponent(baseExcludedKeywords.join(','));
                    return baseUrl;
                }

                function buildApiUrl(baseUrl) {
                    baseUrl = applyMinVotes(baseUrl);
                    baseUrl = applyAgeRestriction(baseUrl);
                    baseUrl = applyWithoutKeywords(baseUrl);
                    return baseUrl;
                }

                var buttonsData = getPartsData();
                var partsData = [];

                function getStreamingWithGenres(serviceName, serviceId) {
                    return function (callback) {
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var genre = genres[Math.floor(Math.random() * genres.length)];
                        var apiUrl = buildApiUrl(
                            'discover/tv?with_networks=' + serviceId +
                            '&with_genres=' + genre.id +
                            '&sort_by=' + sort.key +
                            '&air_date.lte=' + new Date().toISOString().substr(0, 10)
                        );

                        owner.get(apiUrl, params, function (json) {
                            if (json.results) json.results = applyFilters(json.results);
                            json.title = Lampa.Lang.translate(sort.title + ' (' + genre.title + ') на ' + serviceName);
                            callback(json);
                        }, callback);
                    };
                }

                function getStreaming(serviceName, serviceId) {
                    return function (callback) {
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var apiUrl = buildApiUrl(
                            'discover/tv?with_networks=' + serviceId +
                            '&sort_by=' + sort.key +
                            '&air_date.lte=' + new Date().toISOString().substr(0, 10)
                        );
                        owner.get(apiUrl, params, function (json) {
                            if (json.results) json.results = applyFilters(json.results);
                            json.title = Lampa.Lang.translate(sort.title + ' на ' + serviceName);
                            callback(json);
                        }, callback);
                    };
                }

                var selectedStreamingServices = streamingServicesRUS;
                selectedStreamingServices.forEach(function (service) {
                    partsData.push(getStreamingWithGenres(service.title, service.id));
                });
                selectedStreamingServices.forEach(function (service) {
                    partsData.push(getStreaming(service.title, service.id));
                });

                function getMovies(genre) {
                    return function (callback) {
                        var sort = adjustSortForMovies(sortOptions[Math.floor(Math.random() * sortOptions.length)]);
                        var apiUrl = 'discover/movie?with_genres=' + genre.id + '&sort_by=' + sort.key;
                        apiUrl += '&with_original_language=ru&region=RU';

                        if (sort.key === 'release_date.desc') {
                            var today = new Date().toISOString().split('T')[0];
                            apiUrl += '&release_date.lte=' + today;
                        }
                        if (sort.extraParams) apiUrl += sort.extraParams;
                        apiUrl = buildApiUrl(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            var titlePrefix = ' - российские';
                            json.title = Lampa.Lang.translate(sort.title + titlePrefix + ' (' + genre.title + ')');
                            callback(json);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    partsData.push(getMovies(genre));
                });

                function getTVShows(genre) {
                    return function (callback) {
                        var sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
                        var apiUrl = 'discover/tv?with_genres=' + genre.id + '&sort_by=' + sort.key + '&with_origin_country=RU';
                        apiUrl = buildApiUrl(apiUrl);
                        owner.get(apiUrl, params, function (json) {
                            json.title = Lampa.Lang.translate(sort.title + ' - российские сериалы (' + genre.title + ')');
                            callback(json);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    partsData.push(getTVShows(genre));
                });

                function getBestContentByGenre(genre, contentType) {
                    return function (callback) {
                        var apiUrl = 'discover/' + contentType + '?with_genres=' + genre.id +
                            '&sort_by=vote_average.desc' +
                            '&vote_count.gte=50' +
                            '&with_origin_country=RU';
                        apiUrl = applyWithoutKeywords(apiUrl);

                        owner.get(apiUrl, params, function (json) {
                            json.title = Lampa.Lang.translate(contentType === 'movie'
                                ? 'Топ российские фильмы (' + genre.title + ')'
                                : 'Топ российские сериалы (' + genre.title + ')');
                            callback(json);
                        }, callback);
                    };
                }

                genres.forEach(function (genre) {
                    partsData.push(getBestContentByGenre(genre, 'movie'));
                    partsData.push(getBestContentByGenre(genre, 'tv'));
                });

                function getBestContentByGenreAndPeriod(type, genre, startYear, endYear) {
                    return function (callback) {
                        var baseUrl = 'discover/' + type + '?with_genres=' + genre.id +
                            '&sort_by=vote_average.desc' +
                            '&vote_count.gte=10' +
                            '&with_origin_country=RU' +
                            '&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.gte=' + startYear + '-01-01' +
                            '&' + (type === 'movie' ? 'primary_release_date' : 'first_air_date') + '.lte=' + endYear + '-12-31';
                        baseUrl = applyAgeRestriction(baseUrl);
                        baseUrl = applyWithoutKeywords(baseUrl);

                        owner.get(baseUrl, params, function (json) {
                            json.title = Lampa.Lang.translate('Топ российские ' + (type === 'movie' ? 'фильмы' : 'сериалы') +
                                ' (' + genre.title + ') за ' + startYear + '-' + endYear);
                            callback(json);
                        }, callback);
                    };
                }

                var periods = [
                    { start: 1975, end: 1979 }, { start: 1980, end: 1984 }, { start: 1985, end: 1989 },
                    { start: 1990, end: 1994 }, { start: 1995, end: 1999 }, { start: 2000, end: 2004 },
                    { start: 2005, end: 2009 }, { start: 2010, end: 2014 }, { start: 2015, end: 2019 },
                    { start: 2020, end: 2025 }
                ];

                function getRandomPeriod() {
                    return periods[Math.floor(Math.random() * periods.length)];
                }

                genres.forEach(function (genre) {
                    var period = getRandomPeriod();
                    partsData.push(getBestContentByGenreAndPeriod('movie', genre, period.start, period.end));
                    partsData.push(getBestContentByGenreAndPeriod('tv', genre, period.start, period.end));
                });

                partsData = partsData.map(wrapWithWideFlag);
                shuffleArray(partsData);
                var combinedData = buttonsData.concat(partsData);

                function loadPart(partLoaded, partEmpty) {
                    Lampa.Api.partNext(combinedData, partsLimit, partLoaded, partEmpty);
                }

                loadPart(onComplete, onError);
                return loadPart;
            };
        };

        function add() {
            if (typeof Lampa === 'undefined' || !Lampa.Storage || !Lampa.Api || !Lampa.Params) {
                console.error('Lampa API is not available');
                return;
            }
            if (!Lampa.Api.sources || !Lampa.Api.sources.tmdb) {
                console.error('Lampa.Api.sources.tmdb is not defined');
                return;
            }

            var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
            var sourceNameNew = sourceName + ' NEW';
            var sourceNameKids = sourceName + ' KIDS';
            var sourceNameRus = sourceName + ' RUS';

            function assign(target) {
                for (var i = 1; i < arguments.length; i++) {
                    var source = arguments[i];
                    if (source) {
                        for (var key in source) {
                            if (Object.prototype.hasOwnProperty.call(source, key)) {
                                target[key] = source[key];
                            }
                        }
                    }
                }
                return target;
            }

            var surs_mod = assign({}, Lampa.Api.sources.tmdb, new SourceTMDB(Lampa.Api.sources.tmdb));
            var surs_mod_new = assign({}, Lampa.Api.sources.tmdb, new SourceTMDBnew(Lampa.Api.sources.tmdb));
            var surs_mod_kids = assign({}, Lampa.Api.sources.tmdb, new SourceTMDBkids(Lampa.Api.sources.tmdb));
            var surs_mod_rus = assign({}, Lampa.Api.sources.tmdb, new SourceTMDBrus(Lampa.Api.sources.tmdb));

            if (!surs_mod || !surs_mod_new || !surs_mod_kids || !surs_mod_rus) {
                console.error('Failed to create one or more TMDB sources');
                return;
            }

            Lampa.Api.sources.surs_mod = surs_mod;
            Lampa.Api.sources.surs_mod_new = surs_mod_new;
            Lampa.Api.sources.surs_mod_kids = surs_mod_kids;
            Lampa.Api.sources.surs_mod_rus = surs_mod_rus;

            try {
                Object.defineProperty(Lampa.Api.sources, sourceName, { get: function () { return surs_mod; } });
                Object.defineProperty(Lampa.Api.sources, sourceNameNew, { get: function () { return surs_mod_new; } });
                Object.defineProperty(Lampa.Api.sources, sourceNameKids, { get: function () { return surs_mod_kids; } });
                Object.defineProperty(Lampa.Api.sources, sourceNameRus, { get: function () { return surs_mod_rus; } });
            } catch (e) {
                Lampa.Api.sources[sourceName] = surs_mod;
                Lampa.Api.sources[sourceNameNew] = surs_mod_new;
                Lampa.Api.sources[sourceNameKids] = surs_mod_kids;
                Lampa.Api.sources[sourceNameRus] = surs_mod_rus;
            }

            var newSourceOptions = {};
            newSourceOptions[sourceName] = sourceName;
            newSourceOptions[sourceNameNew] = sourceNameNew;
            newSourceOptions[sourceNameKids] = sourceNameKids;
            newSourceOptions[sourceNameRus] = sourceNameRus;

            var mergedOptions = assign({}, Lampa.Params.values['source'], newSourceOptions);

            try {
                Lampa.Params.select('source', mergedOptions, 'tmdb');
            } catch (e) {
                console.error('Error updating Lampa.Params.select: ', e);
            }
        }

        function startProfileListener() {
            var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
            var sourceNameKids = sourceName + ' KIDS';
            var sourceNameRus = sourceName + ' RUS';
            var sourceNameNew = sourceName + ' NEW';

            Lampa.Listener.follow('profile', function (event) {
                if (event.type !== 'changed') return;
                if (!event.params.surs) return;
                if (event.params.forKids) {
                    changeSource(sourceNameKids, true);
                } else if (event.params.onlyRus) {
                    changeSource(sourceNameRus, true);
                } else {
                    changeSource(sourceName, true);
                }
            });

            Lampa.Storage.listener.follow('change', function (event) {
                if (event.name === "source" && !sourceChangedByProfile) {
                    if (event.value === sourceName || event.value === sourceNameKids || event.value === sourceNameRus || event.value === sourceNameNew) {
                        softRefresh(event.value, true);
                    }
                }
            });

            var initialSource = Lampa.Storage.get('source');
            if (initialSource === sourceName || initialSource === sourceNameKids || initialSource === sourceNameRus) {
                setTimeout(function () {
                    if (!Lampa.Storage.get('start_page') || Lampa.Storage.get('start_page') === 'main') {
                        softRefresh(initialSource, false);
                    }
                }, 300);
            }
        }

        var sourceChangedByProfile = false;

        function changeSource(newSource, isProfileChanged) {
            if (typeof isProfileChanged === 'undefined') isProfileChanged = false;
            var currentSource = Lampa.Storage.get('source');
            if (currentSource !== newSource) {
                sourceChangedByProfile = true;
                Lampa.Storage.set('source', newSource);
                setTimeout(function () {
                    softRefresh(newSource, false);
                    sourceChangedByProfile = false;
                }, 10);
            }
        }

        function softRefresh(source, isFromSourceChange) {
            Lampa.Activity.push({
                title: Lampa.Lang.translate('title_main') + ' - ' + source.toUpperCase(),
                component: 'main',
                source: source
            });
            if (isFromSourceChange) {
                setTimeout(function () {
                    Lampa.Controller.toggle('settings');
                }, 100);
            }
        }

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'surs') {
                setTimeout(function () {
                    var currentSource = Lampa.Storage.get('source');
                    var sourceName = Lampa.Storage.get('surs_name') || 'SURS';
                    var sourceNameKids = sourceName + ' KIDS';
                    var sourceNameRus = sourceName + ' RUS';
                    var sourceNameNew = sourceName + ' NEW';

                    var paramsToHide = [
                        'surs_cirillic', 'surs_minVotes', 'surs_ageRestrictions', 'surs_withoutKeywords',
                        'surs_getMoviesByGenre', 'surs_getTVShowsByGenre', 'surs_streaming',
                        'surs_getBestContentByGenre', 'surs_getBestContentByGenreAndPeriod',
                        'surs_filter_menu', 'surs_best_content', 'surs_sort_options',
                        'surs_global_streamings', 'surs_rus_streaming', 'surs_genres', 'surs_global_streaming'
                    ];

                    var shouldHide = (currentSource === sourceNameKids || currentSource === sourceNameRus || currentSource === sourceNameNew);

                    paramsToHide.forEach(function (param) {
                        var element = $('div[data-name="' + param + '"]');
                        if (shouldHide) element.hide(); else element.show();
                    });

                    if (shouldHide) {
                        var translations = {
                            surs_geo_filters: "Настройки подборок",
                            surs_filters: "Фильтры",
                            surs_technical_settings: "Технические настройки"
                        };
                        $('div.settings-param-title span').each(function () {
                            var text = $(this).text().trim();
                            if (text === translations.surs_geo_filters ||
                                text === translations.surs_filters ||
                                text === translations.surs_technical_settings) {
                                $(this).closest('div.settings-param-title').remove();
                            }
                        });
                    }
                }, 1);
            }
        });

        function addSettingMenu() {
            if (typeof Lampa === 'undefined' || !Lampa.Storage || !Lampa.SettingsApi) return;

            try {
                var currentSource = Lampa.Storage.get('source');
                var sourceName = Lampa.Storage.get('surs_name') || Lampa.Lang.translate('surs_source_name');
                var sourceNameKids = sourceName + ' ' + Lampa.Lang.translate('surs_source_name_kids').split(' ')[1];
                var sourceNameRus = sourceName + ' ' + Lampa.Lang.translate('surs_source_name_rus').split(' ')[1];
                var sourceNameNew = sourceName + ' ' + Lampa.Lang.translate('surs_source_name_new').split(' ')[1];

                var sourceValues = {};
                sourceValues[sourceName] = sourceName;
                sourceValues[sourceNameNew] = sourceNameNew;
                sourceValues[sourceNameKids] = sourceNameKids;
                sourceValues[sourceNameRus] = sourceNameRus;

                Lampa.SettingsApi.addComponent({
                    component: 'surs',
                    name: Lampa.Lang.translate('surs_collections') + ' ' + sourceName,
                    icon: '<svg height="200px" width="200px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css"> .st0{fill:#ffffff;} </style> <g> <path class="st0" d="M443.724,166.599c27.038-2.293,47.087-26.07,44.786-53.125c-2.292-27.038-26.078-47.087-53.115-44.795 c-27.038,2.301-47.078,26.088-44.776,53.124C392.91,148.85,416.677,168.9,443.724,166.599z"></path> <path class="st0" d="M431.752,346.544l30.541-114.485c5.068-19.305-6.466-39.075-25.78-44.144 c-19.304-5.077-39.075,6.448-44.152,25.771v-0.018L365.052,315.64l-78.755-13.276c-17.218-4.304-34.696,5.786-39.578,22.864 l-33.317,133.445c-3.82,13.342,3.913,27.28,17.274,31.1c13.37,3.81,27.298-3.923,31.128-17.283l39.392-98.638l61.286,16.155 C398.863,400.125,421.633,382.927,431.752,346.544z"></path> <path class="st0" d="M388.177,462.949l-0.121-0.01c-0.018,0-0.028,0-0.047,0L388.177,462.949z"></path> <path class="st0" d="M498.349,286.311c-10.1-2.999-20.721,2.749-23.722,12.858l-27.876,93.848 c-2.096,6.606-4.536,11.777-7.146,15.746c-3.987,5.944-8.002,9.373-13.854,12.093c-5.842,2.664-14.031,4.379-25.416,4.37 c-3.009,0.008-6.215-0.113-9.634-0.355l-54.009-3.363c-10.519-0.661-19.575,7.341-20.227,17.861 c-0.662,10.518,7.342,19.574,17.86,20.226l53.73,3.345c4.211,0.298,8.31,0.448,12.28,0.456c10.072-0.009,19.5-0.988,28.369-3.289 c13.268-3.392,25.315-10.127,34.501-19.892c9.251-9.736,15.531-21.885,19.91-35.609l0.074-0.214l28.015-94.362 C514.206,299.923,508.447,289.302,498.349,286.311z"></path> <path class="st0" d="M248.974,81.219L0,21.256v15.14v281.228l248.974-59.962V81.219z M225.123,238.87L23.851,287.355V51.536 l201.272,48.466V238.87z"></path> <polygon class="st0" points="204.989,115.189 47.991,84.937 47.991,253.953 204.989,223.692 "></polygon> </g> </g></svg>'
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: '', type: 'title' },
                    field: {
                        name: Lampa.Lang.translate('surs_collections') + ' ' + Lampa.Lang.translate('surs_from') + ' ' + sourceName,
                        description: Lampa.Lang.translate('surs_main_update')
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_empty1', type: 'title' },
                    field: { name: Lampa.Lang.translate('surs_settings_interface'), description: '' }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: {
                        name: 'surs_setSource',
                        type: 'select',
                        values: sourceValues,
                        default: sourceName
                    },
                    field: {
                        name: Lampa.Lang.translate('surs_set_as_source'),
                        description: Lampa.Lang.translate('surs_source_description')
                    },
                    onChange: function (value) {
                        Lampa.Storage.set('source', value);
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_setButtons', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_add_to_menu'),
                        description: Lampa.Lang.translate('surs_menu_description')
                    },
                    onChange: function () {
                        showButtonsSelectionMenu(Lampa.Controller.enabled().name);
                    }
                });

                function showButtonsSelectionMenu(previousController) {
                    var items = [
                        { title: sourceName, id: 'Button_sourceName' },
                        { title: sourceNameKids, id: 'Button_sourceNameKids' },
                        { title: sourceNameRus, id: 'Button_sourceNameRus' }
                    ];
                    var list = items.map(function (item) {
                        return {
                            title: item.title,
                            id: item.id,
                            checkbox: true,
                            checked: getStoredSetting(item.id, false)
                        };
                    });

                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_select_menu_sources'),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            var key = selectedItem.id;
                            var isEnabled = getStoredSetting(key, false);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                            addMenuButtons();
                        }
                    });
                }

                function addMenuButton(title, action, icon, callback) {
                    var button = $('<li class="menu__item selector" data-action="' + action + '">' +
                        '<div class="menu__ico">' + icon + '</div>' +
                        '<div class="menu__text">' + title + '</div>' +
                        '</li>');
                    button.on('hover:enter', callback);
                    $('.menu .menu__list').eq(0).append(button);
                }

                var icon = '<svg xmlns="http://www.w3.org/2000/svg" width="2.2em" height="2.2em" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="white"/></svg>';

                function addMenuButtons() {
                    $('.menu__item[data-action="custom-source"]').remove();
                    if (getStoredSetting('Button_sourceName', false)) {
                        addMenuButton(sourceName, 'custom-source', icon, function () {
                            Lampa.Activity.push({ source: sourceName, title: sourceName, component: 'main', page: 1 });
                        });
                    }
                    if (getStoredSetting('Button_sourceNameKids', false)) {
                        addMenuButton(sourceNameKids, 'custom-source', icon, function () {
                            Lampa.Activity.push({ source: sourceNameKids, title: sourceNameKids, component: 'main', page: 1 });
                        });
                    }
                    if (getStoredSetting('Button_sourceNameRus', false)) {
                        addMenuButton(sourceNameRus, 'custom-source', icon, function () {
                            Lampa.Activity.push({ source: sourceNameRus, title: sourceNameRus, component: 'main', page: 1 });
                        });
                    }
                }

                setTimeout(addMenuButtons, 100);

                Lampa.Listener.follow('profile', function (event) {
                    if (event.type === 'changed') addMenuButtons();
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_custom_buttons', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_custom_buttons'),
                        description: Lampa.Lang.translate('surs_custom_buttons_description')
                    },
                    onChange: function () {
                        showSelectionMenu('surs_custom_buttons', getAllButtons(), 'custom_button_', 'id', Lampa.Controller.enabled().name);
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: '', type: 'title' },
                    field: { name: Lampa.Lang.translate('surs_filters'), description: '' }
                });

                function showSelectionMenu(title, items, storagePrefix, keyField, previousController) {
                    keyField = typeof keyField === 'undefined' ? 'id' : keyField;
                    var list = items.map(function (item) {
                        var key = item[keyField];
                        return {
                            title: Lampa.Lang.translate(item.title),
                            id: key,
                            checkbox: true,
                            checked: getStoredSetting(storagePrefix + key, true)
                        };
                    });

                    Lampa.Select.show({
                        title: Lampa.Lang.translate(title),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController); },
                        onCheck: function (selectedItem) {
                            var key = storagePrefix + selectedItem.id;
                            var isEnabled = getStoredSetting(key, true);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_sort_options', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_sort_types'),
                        description: Lampa.Lang.translate('surs_sort_description')
                    },
                    onChange: function () {
                        showSelectionMenu('surs_sort_types', allSortOptions, 'sort_', 'id', Lampa.Controller.enabled().name);
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_genres', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_genres'),
                        description: Lampa.Lang.translate('surs_genres_description')
                    },
                    onChange: function () {
                        showSelectionMenu('surs_genres', allGenres, 'genre_', 'id', Lampa.Controller.enabled().name);
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_global_streaming', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_global_streaming'),
                        description: Lampa.Lang.translate('surs_global_streaming_description')
                    },
                    onChange: function () {
                        showSelectionMenu('surs_global_streaming', allStreamingServices, 'streaming_', 'id', Lampa.Controller.enabled().name);
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_rus_streaming', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_rus_streaming'),
                        description: Lampa.Lang.translate('surs_rus_streaming_description')
                    },
                    onChange: function () {
                        showSelectionMenu('surs_rus_streaming', allStreamingServicesRUS, 'streaming_rus_', 'id', Lampa.Controller.enabled().name);
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: '', type: 'title' },
                    field: { name: Lampa.Lang.translate('surs_geo_filters'), description: '' }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_streaming', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_streaming'),
                        description: Lampa.Lang.translate('surs_region_description')
                    },
                    onChange: function () { showStreamingSelectionMenu(Lampa.Controller.enabled().name); }
                });

                function showStreamingSelectionMenu(previousController) {
                    var items = [
                        { title: Lampa.Lang.translate('surs_global'), id: 'getStreamingServices' },
                        { title: Lampa.Lang.translate('surs_russian'), id: 'getStreamingServicesRUS' }
                    ];
                    var list = items.map(function (item) {
                        return {
                            title: item.title,
                            id: item.id,
                            checkbox: true,
                            checked: getStoredSetting(item.id, true)
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_streaming'),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            var key = selectedItem.id;
                            var isEnabled = getStoredSetting(key, true);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_getMoviesByGenre', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_movies'),
                        description: Lampa.Lang.translate('surs_region_description')
                    },
                    onChange: function () { showMoviesByGenreSelectionMenu(Lampa.Controller.enabled().name); }
                });

                function showMoviesByGenreSelectionMenu(previousController) {
                    var items = [
                        { title: Lampa.Lang.translate('surs_global'), id: 'getMoviesByGenreGlobal' },
                        { title: Lampa.Lang.translate('surs_russian'), id: 'getMoviesByGenreRus' }
                    ];
                    var list = items.map(function (item) {
                        return {
                            title: item.title,
                            id: item.id,
                            checkbox: true,
                            checked: getStoredSetting(item.id, true)
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_movies'),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            var key = selectedItem.id;
                            var isEnabled = getStoredSetting(key, true);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_getTVShowsByGenre', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_series'),
                        description: Lampa.Lang.translate('surs_region_description')
                    },
                    onChange: function () { showTVShowsByGenreSelectionMenu(Lampa.Controller.enabled().name); }
                });

                function showTVShowsByGenreSelectionMenu(previousController) {
                    var items = [
                        { title: Lampa.Lang.translate('surs_global'), id: 'getTVShowsByGenreGlobal' },
                        { title: Lampa.Lang.translate('surs_russian'), id: 'getTVShowsByGenreRus' },
                        { title: Lampa.Lang.translate('surs_korean'), id: 'getTVShowsByGenreKOR' },
                        { title: Lampa.Lang.translate('surs_turkish'), id: 'getTVShowsByGenreTR' }
                    ];
                    var list = items.map(function (item) {
                        var defaultValue = (item.id === 'getTVShowsByGenreKOR') ? false : true;
                        return {
                            title: item.title,
                            id: item.id,
                            checkbox: true,
                            checked: getStoredSetting(item.id, defaultValue)
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_series'),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            var key = selectedItem.id;
                            var defaultValue = (key === 'getTVShowsByGenreKOR') ? false : true;
                            var isEnabled = getStoredSetting(key, defaultValue);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_getBestContentByGenre', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_top_all_time'),
                        description: Lampa.Lang.translate('surs_top_content_description')
                    },
                    onChange: function () { showBestContentByGenreSelectionMenu(Lampa.Controller.enabled().name); }
                });

                function showBestContentByGenreSelectionMenu(previousController) {
                    var items = [
                        { title: Lampa.Lang.translate('surs_movies'), id: 'getBestContentByGenreMovie' },
                        { title: Lampa.Lang.translate('surs_series'), id: 'getBestContentByGenreTV' }
                    ];
                    var list = items.map(function (item) {
                        return {
                            title: item.title,
                            id: item.id,
                            checkbox: true,
                            checked: getStoredSetting(item.id, true)
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_top_all_time'),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            var key = selectedItem.id;
                            var isEnabled = getStoredSetting(key, true);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_best_content', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_top_5_years'),
                        description: Lampa.Lang.translate('surs_top_content_description')
                    },
                    onChange: function () { showBestContentByPeriodSelectionMenu(Lampa.Controller.enabled().name); }
                });

                function showBestContentByPeriodSelectionMenu(previousController) {
                    var items = [
                        { title: Lampa.Lang.translate('surs_movies'), id: 'getBestContentByGenreAndPeriod_movie' },
                        { title: Lampa.Lang.translate('surs_series'), id: 'getBestContentByGenreAndPeriod_tv' }
                    ];
                    var list = items.map(function (item) {
                        return {
                            title: item.title,
                            id: item.id,
                            checkbox: true,
                            checked: getStoredSetting(item.id, true)
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_top_5_years'),
                        items: list,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            var key = selectedItem.id;
                            var isEnabled = getStoredSetting(key, true);
                            setStoredSetting(key, !isEnabled);
                            selectedItem.checked = !isEnabled;
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: '', type: 'title' },
                    field: { name: Lampa.Lang.translate('surs_technical_settings'), description: '' }
                });

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_cirillic', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_cyrillic'),
                        description: Lampa.Lang.translate('surs_cyrillic_description')
                    },
                    onChange: function () { showCirillicMenu(Lampa.Controller.enabled().name); }
                });

                function showCirillicMenu(previousController) {
                    var key = 'cirillic';
                    var currentValue = getStoredSetting(key, '1');
                    var options = [
                        { title: Lampa.Lang.translate('surs_cyrillic_enabled'), value: '1' },
                        { title: Lampa.Lang.translate('surs_cyrillic_disabled'), value: '0' }
                    ];
                    var items = options.map(function (opt) {
                        return {
                            title: opt.title,
                            value: opt.value,
                            checkbox: true,
                            checked: currentValue === opt.value
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_cyrillic'),
                        items: items,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selected) {
                            setStoredSetting(key, selected.value);
                            showCirillicMenu(previousController);
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_minVotes', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_rating_validation'),
                        description: Lampa.Lang.translate('surs_rating_description')
                    },
                    onChange: function () { showMinVotesMenu(Lampa.Controller.enabled().name); }
                });

                function showMinVotesMenu(previousController) {
                    var key = 'minVotes';
                    var currentValue = getStoredSetting(key, '10');
                    var options = [
                        { title: Lampa.Lang.translate('surs_rating_off'), value: '0' },
                        { title: Lampa.Lang.translate('surs_rating_standard'), value: '10' },
                        { title: Lampa.Lang.translate('surs_rating_enhanced'), value: '50' },
                        { title: Lampa.Lang.translate('surs_rating_maximum'), value: '150' },
                        { title: Lampa.Lang.translate('surs_rating_fatality'), value: '300' }
                    ];
                    var items = options.map(function (opt) {
                        return {
                            title: opt.title,
                            value: opt.value,
                            checkbox: true,
                            checked: currentValue === opt.value
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_rating_validation'),
                        items: items,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selected) {
                            setStoredSetting(key, selected.value);
                            showMinVotesMenu(previousController);
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_ageRestrictions', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_age_restriction'),
                        description: Lampa.Lang.translate('surs_age_description')
                    },
                    onChange: function () { showAgeRestrictionsMenu(Lampa.Controller.enabled().name); }
                });

                function showAgeRestrictionsMenu(previousController) {
                    var key = 'ageRestrictions';
                    var currentValue = getStoredSetting(key, '');
                    var options = [
                        { title: Lampa.Lang.translate('surs_age_toddlers'), value: '0+' },
                        { title: Lampa.Lang.translate('surs_age_6'), value: '6+' },
                        { title: Lampa.Lang.translate('surs_age_12'), value: '12+' },
                        { title: Lampa.Lang.translate('surs_age_none'), value: '' }
                    ];
                    var items = options.map(function (opt) {
                        return {
                            title: opt.title,
                            value: opt.value,
                            checkbox: true,
                            checked: currentValue === opt.value
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_age_restriction'),
                        items: items,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selected) {
                            setStoredSetting(key, selected.value);
                            showAgeRestrictionsMenu(previousController);
                        }
                    });
                }

                Lampa.SettingsApi.addParam({
                    component: 'surs',
                    param: { name: 'surs_withoutKeywords', type: 'button' },
                    field: {
                        name: Lampa.Lang.translate('surs_exclude_asian'),
                        description: Lampa.Lang.translate('surs_exclude_asian_description')
                    },
                    onChange: function () { showKeywordFilterMenu(Lampa.Controller.enabled().name); }
                });

                function showKeywordFilterMenu(previousController) {
                    var key = 'without_keywords';
                    var currentValue = getStoredSetting(key, '1');
                    var options = [
                        { title: Lampa.Lang.translate('surs_exclude_off'), value: '0' },
                        { title: Lampa.Lang.translate('surs_exclude_soft'), value: '1' },
                        { title: Lampa.Lang.translate('surs_exclude_strong'), value: '2' }
                    ];
                    var items = options.map(function (opt) {
                        return {
                            title: opt.title,
                            value: opt.value,
                            checkbox: true,
                            checked: currentValue === opt.value
                        };
                    });
                    Lampa.Select.show({
                        title: Lampa.Lang.translate('surs_exclude_asian'),
                        items: items,
                        onBack: function () { Lampa.Controller.toggle(previousController || 'settings'); },
                        onCheck: function (selectedItem) {
                            setStoredSetting(key, selectedItem.value);
                            showKeywordFilterMenu(previousController);
                        }
                    });
                }

                if (!Lampa.Storage.get('surs_disableCustomName')) {
                    Lampa.SettingsApi.addParam({
                        component: 'surs',
                        param: { name: '', type: 'title' },
                        field: { name: Lampa.Lang.translate('surs_name'), description: '' }
                    });

                    Lampa.SettingsApi.addParam({
                        component: 'surs',
                        param: { name: 'surs_setName', type: 'button' },
                        field: {
                            name: Lampa.Lang.translate('surs_rename_selections'),
                            description: Lampa.Lang.translate('surs_rename_description') + ' ' + currentSource
                        },
                        onChange: function () {
                            var currentName = Lampa.Storage.get('surs_name') || '';
                            Lampa.Input.edit({
                                free: true,
                                title: Lampa.Lang.translate('surs_enter_new_name'),
                                value: currentName
                            }, function (newName) {
                                if (typeof newName === 'string') newName = newName.trim();
                                if (newName && newName.length > 0) {
                                    Lampa.Storage.set('surs_name', newName);
                                    Lampa.Noty.show(Lampa.Lang.translate('surs_name_saved') || 'Название сохранено');
                                    setTimeout(() => Lampa.Controller.toggle('settings'), 300);
                                    setTimeout(() => { try { softRefresh(newName, false); } catch (e) { } }, 2000);
                                    setTimeout(() => location.reload(), 3500);
                                } else {
                                    Lampa.Noty.show(Lampa.Lang.translate('surs_name_not_entered') || 'Название не введено');
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                console.error('Error in addSettingMenu:', e);
            }
        }

        function addMainButton() {
            if (typeof Lampa === 'undefined' || !Lampa.Storage || !Lampa.Lang || !Lampa.Activity) return;
            try {
                var mainButton = $('.menu__item[data-action="main"]');
                var menuList = $('.menu .menu__list').eq(0);
                if (!menuList.length) return;

                var homeIcon = '<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><path fill="currentColor" d="M475.425,200.225L262.092,4.669c-6.951-6.359-17.641-6.204-24.397,0.35L36.213,200.574c-3.449,3.348-5.399,7.953-5.399,12.758v280.889c0,9.819,7.958,17.778,17.778,17.778h148.148c9.819,0,17.778-7.959,17.778-17.778v-130.37h82.963v130.37c0,9.819,7.958,17.778,17.778,17.778h148.148c9.819,0,17.778-7.953,17.778-17.778V213.333C481.185,208.349,479.099,203.597,475.425,200.225z M445.629,476.444H333.037v-130.37c0-9.819-7.959-17.778-17.778-17.778H196.741c-9.819,0-17.778,7.959-17.778,17.778v130.37H66.37V220.853L250.424,42.216l195.206,178.939V476.444z"></path></svg>';

                var button = $('<li class="menu__item selector" data-action="custom-main">' +
                    '<div class="menu__ico">' + homeIcon + '</div>' +
                    '<div class="menu__text">' + Lampa.Lang.translate('title_main') + '</div>' +
                    '</li>');

                button.on('hover:enter', function () {
                    Lampa.Activity.push({
                        source: Lampa.Storage.get('source'),
                        title: Lampa.Lang.translate('title_main') + ' - ' + Lampa.Storage.get('source'),
                        component: 'main',
                        page: 1
                    });
                });

                if (mainButton.length) {
                    mainButton.before(button);
                    mainButton.remove();
                } else {
                    menuList.append(button);
                }
            } catch (e) {
                console.error('Error in addMainButton:', e);
            }
        }

        // Локализация (только RU)
        Lampa.Lang.add({
            surs_vote_count_desc: { ru: "Много голосов" },
            surs_vote_average_desc: { ru: "Высокий рейтинг" },
            surs_first_air_date_desc: { ru: "Новинки" },
            surs_popularity_desc: { ru: "Популярные" },
            surs_revenue_desc: { ru: "Интерес зрителей" },
            surs_genre_action: { ru: "боевики" },
            surs_genre_comedy: { ru: "комедии" },
            surs_genre_drama: { ru: "драмы" },
            surs_genre_romance: { ru: "мелодрамы" },
            surs_genre_animation: { ru: "анимация" },
            surs_genre_kids: { ru: "детское" },
            surs_genre_adventure: { ru: "приключения" },
            surs_genre_crime: { ru: "криминал" },
            surs_genre_mystery: { ru: "детективы" },
            surs_genre_sci_fi: { ru: "фантастика" },
            surs_genre_western: { ru: "вестерны" },
            surs_genre_thriller: { ru: "триллеры" },
            surs_genre_family: { ru: "семейные" },
            surs_genre_fantasy: { ru: "фэнтези" },
            surs_genre_reality: { ru: "реалити-шоу" },
            surs_genre_action_adventure: { ru: "боевики и приключения" },
            surs_genre_soap: { ru: "мыльные оперы" },
            surs_genre_talk_show: { ru: "ток-шоу" },
            surs_title_trend_week: { ru: "Тренды недели" },
            surs_title_upcoming_episodes: { ru: "Ближайшие эпизоды" },
            surs_popular_persons: { ru: "Популярные персоны" },
            surs_top_movies: { ru: "Топ фильмы" },
            surs_top_tv: { ru: "Топ сериалы" },
            surs_for_period: { ru: " за " },
            surs_noname: { ru: "без названия" },
            surs_tv_shows: { ru: "сериалы" },
            surs_on: { ru: "на" },
            surs_source_name: { ru: "SURS" },
            surs_source_name_kids: { ru: "SURS KIDS" },
            surs_source_name_rus: { ru: "SURS RUS" },
            surs_source_name_new: { ru: "SURS NEW" },
            surs_collections: { ru: "Главная" },
            surs_main_update: { ru: "После изменения настроек обновите главную страницу, нажав на её иконку в боковом меню" },
            surs_from: { ru: "от" },
            surs_settings_interface: { ru: "Настройка интерфейса" },
            surs_set_as_source: { ru: "Установить в качестве источника" },
            surs_source_description: { ru: "Влияет на отображение контента на главной странице" },
            surs_add_to_menu: { ru: "Добавить подборки в боковое меню" },
            surs_menu_description: { ru: "Выберите, какие подборки добавить в боковое меню" },
            surs_select_menu_sources: { ru: "Выбор источников для бокового меню" },
            surs_filters: { ru: "Фильтры" },
            surs_sort_types: { ru: "Виды сортировки подборок" },
            surs_sort_description: { ru: "Выбор сортировки подборок" },
            surs_genres: { ru: "Жанры" },
            surs_genres_description: { ru: "Выбор жанров" },
            surs_global_streaming: { ru: "Глобальные стриминги" },
            surs_global_streaming_description: { ru: "Выбор глобальных стриминговых сервисов" },
            surs_rus_streaming: { ru: "Российские стриминги" },
            surs_rus_streaming_description: { ru: "Выбор российских стриминговых сервисов" },
            surs_geo_filters: { ru: "Настройки подборок" },
            surs_streaming: { ru: "Стриминги" },
            surs_region_description: { ru: "Выберите регион" },
            surs_movies: { ru: "Фильмы" },
            surs_series: { ru: "Сериалы" },
            surs_top_all_time: { ru: "Топ за все время" },
            surs_top_content_description: { ru: "Фильмы, сериалы, или всё вместе" },
            surs_top_5_years: { ru: "Топ за 5 лет" },
            surs_technical_settings: { ru: "Технические настройки" },
            surs_cyrillic: { ru: "Кириллица в карточке" },
            surs_cyrillic_description: { ru: "Фильтрует контент, оставляя только те материалы, у которых есть перевод названия или описание на кириллице" },
            surs_cyrillic_enabled: { ru: "Включен" },
            surs_cyrillic_disabled: { ru: "Выключен" },
            surs_rating_validation: { ru: "Валидация рейтинга" },
            surs_rating_description: { ru: "Позволяет исключить контент с случайно завышенной оценкой. Однако может также исключить новые фильмы или те, у которых ещё нет рейтинга или мало голосов" },
            surs_rating_off: { ru: "Выключено" },
            surs_rating_standard: { ru: "Стандартная" },
            surs_rating_enhanced: { ru: "Усиленная" },
            surs_rating_maximum: { ru: "Максимальная" },
            surs_rating_fatality: { ru: "Фаталити" },
            surs_age_restriction: { ru: "Возрастное ограничение" },
            surs_age_description: { ru: "Формирует подборки, которые соответствуют указанному возрастному рейтингу" },
            surs_age_toddlers: { ru: "Для самых маленьких" },
            surs_age_6: { ru: "Для детей не старше 6 лет" },
            surs_age_12: { ru: "Для детей не старше 12 лет" },
            surs_age_none: { ru: "Без ограничений" },
            surs_exclude_asian: { ru: "Исключение азиатских жанров" },
            surs_exclude_asian_description: { ru: "Мягкий режим: исключает мангу, маньхву, донхуа. Сильный режим: дополнительно исключает аниме" },
            surs_exclude_off: { ru: "Выключено" },
            surs_exclude_soft: { ru: "Мягко" },
            surs_exclude_strong: { ru: "Сильно" },
            surs_name: { ru: "Название" },
            surs_rename_selections: { ru: "Переименование подборок" },
            surs_rename_description: { ru: "Введите свое название вместо" },
            surs_enter_new_name: { ru: "Введите новое название" },
            surs_name_saved: { ru: "Название сохранено. Обновление..." },
            surs_name_not_entered: { ru: "Название не введено" },
            surs_global: { ru: "Глобальные" },
            surs_russian: { ru: "Российские" },
            surs_korean: { ru: "Южнокорейские" },
            surs_turkish: { ru: "турецкие" },
            surs_ukrainian: { ru: "украинские" },
            surs_custom_buttons: { ru: "Горизонтальное меню" },
            surs_custom_buttons_description: { ru: "Выберите, какие кнопки отображать в интерфейсе" },
            surs_main: { ru: "Главная" },
            surs_bookmarks: { ru: "Избранное" },
            surs_select: { ru: "Разделы" },
            surs_new: { ru: "Новинки" },
            surs_rus: { ru: "Русское" },
            surs_kids: { ru: "Детское" },
            surs_history: { ru: "История" }
        });

        function loadSidePlugins() {
            setTimeout(function () {
                if (!window.SursSelect || !window.SursSelect.__initialized) {
                    Lampa.Utils.putScriptAsync(
                        ['https://aviamovie.github.io/surs_select.js'],
                        function () {
                            console.log('SursSelect плагин успешно загружен.');
                        }
                    );
                } else {
                    console.log('SursSelect уже загружен.');
                }
            }, 2000);
        }

        if (window.appready) {
            add();
            startProfileListener();
            addMainButton();
            initCustomButtons();
            loadSidePlugins();
            if (!Lampa.Storage.get('surs_disableMenu')) addSettingMenu();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type == 'ready') {
                    add();
                    startProfileListener();
                    addMainButton();
                    initCustomButtons();
                    loadSidePlugins();
                    if (!Lampa.Storage.get('surs_disableMenu')) addSettingMenu();
                }
            });
        }
    }

    if (!window.plugin_surs_ready) startPlugin();

})();
