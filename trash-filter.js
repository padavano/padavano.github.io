(function () {
    'use strict';

    // =========================================================================
    // I. ФИЛЬТРЫ ЗАПРОСОВ (Pre-Filters)
    // Модифицируют URL запроса перед его отправкой на TMDB (или прокси).
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
    // II. ФИЛЬТРЫ РЕЗУЛЬТАТОВ (Post-Filters)
    // Обрабатывают полученный массив данных, применяя правила белого списка.
    // =========================================================================
    var postFilters = {
        filters: [
            function(results) {
                // Строгий белый список для Title: разрешает только кириллицу, цифры, пробелы и пунктуацию.
                var allowedTitleCharsRegex = /^[А-Яа-яЁё0-9\s.,'":!?-]+$/; 
                // Проверка на наличие хотя бы одной кириллицы ИЛИ цифры в названии.
                var requiredTitleCharsRegex = /[А-Яа-яЁё0-9]/; 
                
                return results.filter(function(item) {
                    if (!item) return true;
                    
                    // НОВАЯ ПРОВЕРКА: Удаляем, если отсутствует дата релиза.
                    if (!item.release_date) {
                        return false;
                    }
                    
                    // Условие 1: Оригинальный язык - Русский
                    var isRussian = (item.original_language && item.original_language.toLowerCase() === 'ru');
                    
                    // Условие 2: Title соответствует строгому белому списку
                    var isTitlePureCyrillicOrNumber = false;

                    if (item.title) {
                        // Title должен состоять ТОЛЬКО из разрешенных символов
                        var containsOnlyAllowedChars = allowedTitleCharsRegex.test(item.title);
                        // Title должен содержать значимые символы
                        var containsRequiredChars = requiredTitleCharsRegex.test(item.title);
                        
                        isTitlePureCyrillicOrNumber = containsOnlyAllowedChars && containsRequiredChars;
                    }
                    
                    // Белый список: Оставляем, если выполнено (Условие 1 ИЛИ Условие 2)
                    var keepItem = isRussian || isTitlePureCyrillicOrNumber;

                    return keepItem;
                });
            }
        ],
        apply: function(results) {
            var clone = Lampa.Arrays.clone(results);
            for (var i = 0; i < this.filters.length; i++) {
                clone = this.filters[i](results);
            }
            return clone;
        }
    };

    // =========================================================================
    // III. УТИЛИТЫ И ПРОВЕРКИ
    // =========================================================================

    // Проверяет, применим ли фильтр к данному URL (включая /person/ и прокси).
    function isFilterApplicable(baseUrl) {
        return baseUrl.indexOf('/3/') > -1
            && baseUrl.indexOf('/search') === -1;
    }

    // Проверяет, имеет ли категория больше одной страницы результатов.
    function hasMorePage(data) {
        return !!data
            && Array.isArray(data.results)
            && data.original_length !== data.results.length
            && data.page === 1
            && !!data.total_pages
            && data.total_pages > 1;
    }
    
    // =========================================================================
    // IV. ОСНОВНАЯ ЛОГИКА ПЛАГИНА (start)
    // =========================================================================

    function start() {
        if (window.trash_filter_plugin) {
            return;
        }

        window.trash_filter_plugin = true;

        // 1. Обработка видимости линии: Добавляет кнопку "Ещё".
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
        
        // 2. Обработка добавления элементов: Управляет навигацией.
        Lampa.Listener.follow('line', function (event) {
            if (event.type !== 'append' || !hasMorePage(event.data)) {
                return;
            }

            if (event.items.length === event.data.results.length && Lampa.Controller.own(event.line)) {
                Lampa.Controller.collectionAppend(event.line.more());
            }
        });

        // 3. Перехват запроса перед отправкой: Применяет Pre-Filters.
        Lampa.Listener.follow('before_send', function (event) {
            if (isFilterApplicable(event.url)) {
                event.url = preFilters.apply(event.url);
            }
        });

        // 4. Перехват успешного ответа: Применяет Post-Filters.
        Lampa.Listener.follow('request_secuses', function (event) {
            if (isFilterApplicable(event.params.url) && event.data && Array.isArray(event.data.results)) {
                event.data.original_length = event.data.results.length;
                event.data.results = postFilters.apply(event.data.results);
            }
        });
    }

    // Запуск плагина после готовности Lampa.
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
