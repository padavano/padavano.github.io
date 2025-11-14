(function () {
    'use strict';

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

            console.log('--- PRE-FILTERING: Start ---');
            console.log('Original URL:', baseUrl);

            for (var i = 0; i < this.filters.length; i++) {
                resultUrl = this.filters[i](resultUrl);
            }

            console.log('Result URL:', resultUrl);
            console.log('--- PRE-FILTERING: End ---');

            return resultUrl;
        }
    };

    var postFilters = {
        filters: [
            function(results) {
                // Регулярное выражение для русской кириллицы (А-Яа-яЁё) ИЛИ цифр (0-9)
                var cyrillicOrNumberRegex = /[А-Яа-яЁё0-9]/; 
                
                var filteredResults = results.filter(function(item) {
                    if (!item) return true;
                    
                    // 1. Проверка оригинального языка: RU
                    var isRussian = (item.original_language && item.original_language.toLowerCase() === 'ru');
                    
                    // 2. Проверка на кириллицу или цифры в названии
                    var hasCyrillicOrNumberInTitle = item.title && cyrillicOrNumberRegex.test(item.title);
                    
                    // Условие белого списка: (Язык RU) ИЛИ (Название содержит кириллицу/цифры)
                    var keepItem = isRussian || hasCyrillicOrNumberInTitle;

                    if (!keepItem) {
                        // Логирование удаляемых элементов, которые не соответствуют белому списку
                        console.log('FILTERED OUT (УДАЛЕНО):', item.title, '| Lang:', item.original_language);
                    }
                    // Если вам нужно увидеть все элементы (оставляемые и удаляемые), раскомментируйте эту строку:
                    // else { console.log('KEPT (ОСТАВЛЕНО):', item.title, '| Lang:', item.original_language, '| Is RU:', isRussian, '| Has Cy/Num:', hasCyrillicOrNumberInTitle); }

                    return keepItem;
                });
                
                return filteredResults;
            }
        ],
        apply: function(results) {
            var clone = Lampa.Arrays.clone(results);
            var originalLength = results.length;
            
            console.log('--- POST-FILTERING: Start ---');
            console.log('Original result count:', originalLength);

            for (var i = 0; i < this.filters.length; i++) {
                clone = this.filters[i](results);
            }

            console.log('Filtered result count:', clone.length);
            console.log('--- POST-FILTERING: End ---');

            return clone;
        }
    };

    function isFilterApplicable(baseUrl) {
        // FIX: Использование '/3/' вместо Lampa.TMDB.api('') для поддержки кастомных API-хостов.
        var isApplicable = baseUrl.indexOf('/3/') > -1
            && baseUrl.indexOf('/search') === -1
            && baseUrl.indexOf('/person/') === -1;
            
        console.log('isFilterApplicable check for URL:', baseUrl, '-> Result:', isApplicable);

        return isApplicable;
    }

    function hasMorePage(data) {
        return !!data
            && Array.isArray(data.results)
            && data.original_length !== data.results.length
            && data.page === 1
            && !!data.total_pages
            && data.total_pages > 1;
    }
    
    function start() {
        if (window.trash_filter_plugin) {
            return;
        }
        
        console.log('>>> TRASH FILTER PLUGIN STARTED <<<');

        window.trash_filter_plugin = true;

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
        
        Lampa.Listener.follow('line', function (event) {
            if (event.type !== 'append' || !hasMorePage(event.data)) {
                return;
            }

            if (event.items.length === event.data.results.length && Lampa.Controller.own(event.line)) {
                Lampa.Controller.collectionAppend(event.line.more());
            }
        });

        Lampa.Listener.follow('request_secuses', function (event) {
            console.log('>>> request_secuses triggered <<<');
            console.log('Request URL:', event.params.url);
            
            if (isFilterApplicable(event.params.url) && event.data && Array.isArray(event.data.results)) {
                
                console.log('--- Post-filter is APPLICABLE, applying filter ---');
                
                event.data.original_length = event.data.results.length;
                event.data.results = postFilters.apply(event.data.results);
                
                console.log('--- Post-filter applied successfully ---');
            } else {
                console.log('--- Post-filter SKIPPED (not applicable or no results) ---');
            }
        });

        Lampa.Listener.follow('before_send', function (event) {
            if (isFilterApplicable(event.url)) {
                event.url = preFilters.apply(event.url);
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
