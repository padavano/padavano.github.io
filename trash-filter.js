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
                    
                    // --- Идентификация объекта "Персона" ---
                    // Пропускаем фильтрацию контента для персон, чтобы отображались актеры/режиссеры.
                    var isPersonObject = (
                        item.name && 
                        !item.title && 
                        !item.poster_path && 
                        !item.release_date && 
                        !item.first_air_date
                    );

                    if (isPersonObject) {
                        return true;
                    }

                    // --- Фильтрация объекта "Контент" (Фильм/Сериал) ---
                    
                    // 1. Быстрые проверки (наличие постера и даты).
                    if (!item.poster_path) {
                        return false;
                    }

                    if (!item.release_date && !item.first_air_date) {
                        return false;
                    }
                    
                    // 2. Условие "Белого списка": Оригинальный язык - Русский.
                    var isRussian = (item.original_language && item.original_language.toLowerCase() === 'ru');
                    
                    // 3. Условие "Белого списка": Строгая чистота заголовка (кириллица/цифры).
                    var isTitlePureCyrillicOrNumber = false;

                    if (item.title) {
                        var containsOnlyAllowedChars = allowedTitleCharsRegex.test(item.title);
                        var containsRequiredChars = requiredTitleCharsRegex.test(item.title);
                        
                        isTitlePureCyrillicOrNumber = containsOnlyAllowedChars && containsRequiredChars;
                    }
                    
                    // Финальное решение: Оставляем, если (Русский ИЛИ Чистый заголовок).
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

    // Проверяет, является ли URL запросом к LNUM.
    function isLnumUrl(data) {
        var url = data && data.url ? data.url : data;
        return typeof url === 'string' && url.indexOf('levende-develop.workers.dev') > -1;
    }

    // Проверяет, является ли запрос LNUM списком категорий/линий ('/list').
    function isLnumCategoryList(url) {
        return isLnumUrl(url) && url.indexOf('/list') > -1;
    }

    // Проверяет, применим ли фильтр к данному URL (TMDB ИЛИ LNUM).
    function isFilterApplicable(baseUrl) {
        var isTmdbApi = baseUrl.indexOf('/3/') > -1
            && baseUrl.indexOf('/search') === -1
            && baseUrl.indexOf('/person/popular') === -1; 

        var isLnumApi = baseUrl.indexOf('levende-develop.workers.dev') > -1;
        
        return isTmdbApi || isLnumApi;
    }

    // Логика для показа кнопки "Ещё".
    function hasMorePage(data) {
        if (isLnumUrl(data)) {
             return !!data
                && Array.isArray(data.results)
                && data.original_length !== data.results.length
                && data.page === 1;
        }

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

        // 1. Добавляет кнопку "Ещё" в линиях контента.
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
            if (event.type !== 'append' || event.data.original_length === event.data.results.length) {
                return;
            }

            if (event.items.length === event.data.results.length && Lampa.Controller.own(event.line)) {
                Lampa.Controller.collectionAppend(event.line.more());
            }
        });

        // 3. Применяет Pre-Filters (перед отправкой запроса).
        Lampa.Listener.follow('before_send', function (event) {
            if (isFilterApplicable(event.url)) {
                
                // ИСКЛЮЧЕНИЕ: Пропускаем pre-фильтры для списка категорий LNUM.
                if (isLnumCategoryList(event.url)) {
                    return;
                }
                
                event.url = preFilters.apply(event.url);
            }
        });

        // 4. Применяет Post-Filters (после получения данных).
        Lampa.Listener.follow('request_secuses', function (event) {
            if (isFilterApplicable(event.params.url) && event.data) {
                
                var isCategoryList = isLnumCategoryList(event.params.url);

                // Фильтрация основного массива 'results'
                if (Array.isArray(event.data.results)) {
                    
                    event.data.original_length = event.data.results.length;
                    
                    // Пропускаем фильтрацию, если это список категорий LNUM.
                    if (!isCategoryList) {
                        event.data.results = postFilters.apply(event.data.results);
                    }
                }
                
                // --- Фильтрация массива 'parts' (Коллекции) ---
                if (Array.isArray(event.data.parts)) {
                    event.data.parts = postFilters.apply(event.data.parts);

                    // --- КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Скрываем коллекцию, если осталась одна карточка ---
                    if (event.data.parts.length === 1) {
                         event.data.parts = []; // Обнуляем массив, чтобы коллекция не отображалась
                    }
                }
                
                // Фильтрация массивов 'cast'
                if (Array.isArray(event.data.cast)) {
                    event.data.cast = postFilters.apply(event.data.cast);
                }
                
                // Фильтрация массивов 'crew'
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
