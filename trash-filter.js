(function () {
    'use strict';

    // =========================================================================
    // I. ОБЪЯВЛЕНИЕ ПЕРЕМЕННЫХ И REGEX
    // =========================================================================

    // Регулярное выражение для проверки, что заголовок состоит ТОЛЬКО из кириллицы,
    // цифр, пробелов и основных знаков пунктуации.
    var allowedTitleCharsRegex = /^[А-Яа-яЁё0-9\s.,'":!?-]+$/; 
    
    // Регулярное выражение для проверки, что заголовок содержит ХОТЯ БЫ один
    // символ кириллицы или цифру (для отсева пустых или чисто символьных заголовков).
    var requiredTitleCharsRegex = /[А-Яа-яЁё0-9]/; 
    
    // =========================================================================
    // II. ФИЛЬТРЫ ЗАПРОСОВ (Pre-Filters) - Изменяют URL запроса
    // =========================================================================
    var preFilters = {
        filters: [
            // Фильтр 1: Устанавливает минимальное количество голосов (Vote Count >= 1)
            function(baseUrl) {
                baseUrl += '&vote_count.gte=' + 1;
                return baseUrl;
            },
            
            // Фильтр 2: Исключает фильмы по определенным ID ключевых слов
            function(baseUrl) {
                var baseExcludedKeywords = [
                    '346488', // Мусорные/низкокачественные теги
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
    // III. ФИЛЬТРЫ РЕЗУЛЬТАТОВ (Post-Filters) - Изменяют массив данных
    // =========================================================================
    var postFilters = {
        filters: [
            function(results) {
                return results.filter(function(item) {
                    if (!item) return true;
                    
                    // 1. Обязательная проверка 1: Наличие постера. Быстро отсеивает "пустышки".
                    if (!item.poster_path) {
                        return false;
                    }

                    // 2. Обязательная проверка 2: Наличие даты релиза.
                    if (!item.release_date && !item.first_air_date) {
                        return false;
                    }
                    
                    // 3. Условие "Белого списка": Оригинальный язык - Русский.
                    var isRussian = (item.original_language && item.original_language.toLowerCase() === 'ru');
                    
                    // 4. Условие "Белого списка": Строгая кириллическая/цифровая чистота заголовка.
                    var isTitlePureCyrillicOrNumber = false;

                    if (item.title) {
                        var containsOnlyAllowedChars = allowedTitleCharsRegex.test(item.title);
                        var containsRequiredChars = requiredTitleCharsRegex.test(item.title);
                        
                        // Заголовок чист, если содержит ТОЛЬКО разрешенные символы И хотя бы один нужный символ.
                        isTitlePureCyrillicOrNumber = containsOnlyAllowedChars && containsRequiredChars;
                    }
                    
                    // Финальное решение: Оставляем, если выполнено (Условие 3 ИЛИ Условие 4).
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

    // Проверяет, является ли URL запросом к LNUM (по домену).
    function isLnumUrl(data) {
        var url = data && data.url ? data.url : data;
        return typeof url === 'string' && url.indexOf('levende-develop.workers.dev') > -1;
    }

    // ОПТИМИЗАЦИЯ: Проверяет, является ли запрос LNUM списком категорий/линий (содержит '/list').
    // Такие запросы НЕЛЬЗЯ фильтровать, иначе ломается пагинация главной страницы LNUM.
    function isLnumCategoryList(url) {
        return isLnumUrl(url) && url.indexOf('/list') > -1;
    }

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

    // Логика для показа кнопки "Ещё" (применяется, когда фильтрация сократила список).
    function hasMorePage(data) {
        // Для LNUM: активируем ручную кнопку "Ещё", если произошла фильтрация на первой странице.
        if (isLnumUrl(data)) {
             return !!data
                && Array.isArray(data.results)
                && data.original_length !== data.results.length
                && data.page === 1;
        }

        // Логика для TMDB: также учитывает total_pages.
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

        // 1. Добавляет кнопку "Ещё" при необходимости.
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
        
        // 2. Принудительно вызывает следующую страницу при скролле, если фильтрация сократила список.
        Lampa.Listener.follow('line', function (event) {
            if (event.type !== 'append' || event.data.original_length === event.data.results.length) {
                return;
            }

            if (event.items.length === event.data.results.length && Lampa.Controller.own(event.line)) {
                Lampa.Controller.collectionAppend(event.line.more());
            }
        });

        // 3. Применяет Pre-Filters (изменяет URL перед отправкой запроса).
        Lampa.Listener.follow('before_send', function (event) {
            if (isFilterApplicable(event.url)) {
                
                // ИСКЛЮЧЕНИЕ: Не применяем pre-фильтры к запросам LNUM, которые возвращают список категорий/линий.
                if (isLnumCategoryList(event.url)) {
                    return;
                }
                
                event.url = preFilters.apply(event.url);
            }
        });

        // 4. Применяет Post-Filters (фильтрует полученные данные).
        Lampa.Listener.follow('request_secuses', function (event) {
            if (isFilterApplicable(event.params.url) && event.data) {
                
                // Определяем, является ли это список категорий LNUM (требует пропуска фильтрации).
                var isCategoryList = isLnumCategoryList(event.params.url);

                // Обработка стандартных массивов TMDB и LNUM (results)
                if (Array.isArray(event.data.results)) {
                    
                    event.data.original_length = event.data.results.length;
                    
                    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Не фильтруем, если это список категорий LNUM,
                    // чтобы не нарушать пагинацию главной страницы.
                    if (!isCategoryList) {
                        event.data.results = postFilters.apply(event.data.results);
                    }
                }
                
                // Обработка массива 'cast' (актеры) - всегда фильтруем
                if (Array.isArray(event.data.cast)) {
                    event.data.cast = postFilters.apply(event.data.cast);
                }
                
                // Обработка массива 'crew' (съемочная группа) - всегда фильтруем
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
