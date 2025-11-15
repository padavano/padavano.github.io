(function () {
    'use strict';

    // =========================================================================
    // I. ОБЪЯВЛЕНИЕ ПЕРЕМЕННЫХ И REGEX
    // =========================================================================

    var allowedTitleCharsRegex = /^[А-Яа-яЁё0-9\s.,'":!?-]+$/; 
    var requiredTitleCharsRegex = /[А-Яа-яЁё0-9]/; 
    
    // =========================================================================
    // II. ФИЛЬТРЫ ЗАПРОСОВ (Pre-Filters)
    // =========================================================================
    var preFilters = {
        filters: [
            function(baseUrl) {
                baseUrl += '&vote_count.gte=' + 1;
                return baseUrl;
            },
            function(baseUrl) {
                var baseExcludedKeywords = [
                    '346488',
                    '158718',
                    '41278'
                ];

                baseUrl += '&without_keywords=' + encodeURIComponent(baseExcludedKeywords.join(','));
                return baseUrl;
            }
        ],
        apply: function(baseUrl) {
            var resultUrl = baseUrl;
            for (var i = 0; i < this.filters.length; i++) {
                resultUrl = this.filters[i](resultUrl);
            }
            return resultUrl;
        }
    };

    // =========================================================================
    // III. ФИЛЬТРЫ РЕЗУЛЬТАТОВ (Post-Filters)
    // =========================================================================
    var postFilters = {
        filters: [
            function(results) {
                return results.filter(function(item) {
                    if (!item) return true;
                    
                    // 1. Проверка на наличие постера (базовая фильтрация мусора).
                    if (!item.poster_path) {
                        return false;
                    }

                    // 2. Проверка на наличие даты релиза.
                    if (!item.release_date && !item.first_air_date) {
                        return false;
                    }
                    
                    // 3. Условие: Оригинальный язык - Русский
                    var isRussian = (item.original_language && item.original_language.toLowerCase() === 'ru');
                    
                    // 4. Условие: Title соответствует строгому белому списку
                    var isTitlePureCyrillicOrNumber = false;

                    if (item.title) {
                        var containsOnlyAllowedChars = allowedTitleCharsRegex.test(item.title);
                        var containsRequiredChars = requiredTitleCharsRegex.test(item.title);
                        
                        isTitlePureCyrillicOrNumber = containsOnlyAllowedChars && containsRequiredChars;
                    }
                    
                    // Белый список: Оставляем, если выполнено (Условие 3 ИЛИ Условие 4)
                    var keepItem = isRussian || isTitlePureCyrillicOrNumber;

                    return keepItem;
                });
            }
        ],
        apply: function(results) {
            var filteredResults = results;
            for (var i = 0; i < this.filters.length; i++) {
                filteredResults = this.filters[i](filteredResults);
            }
            return filteredResults;
        }
    };

    // =========================================================================
    // IV. УТИЛИТЫ И ПРОВЕРКИ
    // =========================================================================

    // Проверяет, применим ли фильтр к данному URL (TMDB ИЛИ LNUM).
    function isFilterApplicable(baseUrl) {
        // Условие 1: TMDB API (исключая поиск и списки актеров)
        var isTmdbApi = baseUrl.indexOf('/3/') > -1
            && baseUrl.indexOf('/search') === -1
            && baseUrl.indexOf('/person/popular') === -1; 

        // Условие 2: LNUM API (по домену)
        var isLnumApi = baseUrl.indexOf('levende-develop.workers.dev') > -1;

        return isTmdbApi || isLnumApi;
    }

    // Используется для показа кнопки "Ещё" (должно быть только на первой странице)
    function hasMorePage(data) {
        return !!data
            && Array.isArray(data.results)
            && data.original_length !== data.results.length
            && data.page === 1
            && !!data.total_pages
            && data.total_pages > 1;
    }
    
    // =========================================================================
    // V. ОСНОВНАЯ ЛОГИКА ПЛАГИНА (start)
    // =========================================================================

    function start() {
        if (window.trash_filter_plugin) {
            return;
        }

        window.trash_filter_plugin = true;

        // 1. Добавляет кнопку "Ещё" (использует hasMorePage, включая проверку page === 1).
        Lampa.Listener.follow('line', function (event) {
            if (event.type !== 'visible' || !hasMorePage(event.data)) {
                return;
            }

            var lineHeader$ = $(event.body.closest('.items-line')).find('.items-line__head');
            var hasMoreBtn = lineHeader$.find('.items-line__more').length !== 0;

            if (hasMoreBtn) return;

            var button = document.createElement('div');
            button.classList.add('items-line__more');
            button.classList.add('selector');
            button.innerText = Lampa.Lang.translate('more');

            button.addEventListener('hover:enter', function() {
                Lampa.Activity.push({
                    url: event.data.url,
                    title: event.data.title || Lampa.Lang.translate('title_category'),
                    component: 'category_full',
                    page: 1,
                    genres: event.params.genres,
                    filter: event.data.filter,
                    source: event.data.source || event.params.object.source
                });
            });

            lineHeader$.append(button);
        });
        
        // 2. Управляет навигацией при скролле.
        Lampa.Listener.follow('line', function (event) {
            // Условие изменено: проверяем, что это событие добавления И что фильтрация удалила элементы.
            // Проверку data.page === 1 мы убрали.
            if (event.type !== 'append' || event.data.original_length === event.data.results.length) {
                return;
            }

            if (event.items.length === event.data.results.length && Lampa.Controller.own(event.line)) {
                Lampa.Controller.collectionAppend(event.line.more());
            }
        });

        // 3. Применяет Pre-Filters.
        Lampa.Listener.follow('before_send', function (event) {
            if (isFilterApplicable(event.url)) {
                event.url = preFilters.apply(event.url);
            }
        });

        // 4. Применяет Post-Filters.
        Lampa.Listener.follow('request_secuses', function (event) {
            if (isFilterApplicable(event.params.url) && event.data) {
                
                // Обработка стандартных массивов TMDB и LNUM
                if (Array.isArray(event.data.results)) {
                    event.data.original_length = event.data.results.length;
                    event.data.results = postFilters.apply(event.data.results);
                }
                
                // Обработка массива 'cast' (для combined_credits)
                if (Array.isArray(event.data.cast)) {
                    event.data.cast = postFilters.apply(event.data.cast);
                }
                
                // Обработка массива 'crew' (для combined_credits)
                if (Array.isArray(event.data.crew)) {
                    event.data.crew = postFilters.apply(event.data.crew);
                }
            }
        });
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                start();
            }
        });
    }
})();
