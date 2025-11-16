Lampa.Platform.tv();

(function () {
    // Получение основных классов Lampa. Они должны быть доступны, но
    // мы их не трогаем, чтобы не нарушать структуру.
    let Component = Lampa.Component;
    let Controller = Lampa.Controller;
    let Utils = Lampa.Utils;
    
    // Params должен быть объявлен здесь, но инициализирован позже
    let Params = null;

    // Сортировка кнопок (не зависит от Lampa.Plugin)
    Lampa.Listener.follow('controller', function (e) {
        if (e.type == 'look_make_buttons') {
            let buttons = e.data.buttons;

            let online = [];
            let torrent = [];
            let trailer = [];
            let other = [];

            for (let i = 0; i < buttons.length; i++) {
                let btn = buttons[i];
                let name = (btn.name || '').toLowerCase();

                if (name.indexOf('online') > -1 || name.indexOf('playlist') > -1) {
                    online.push(btn);
                } else if (name.indexOf('torrent') > -1) {
                    torrent.push(btn);
                } else if (name.indexOf('trailer') > -1) {
                    trailer.push(btn);
                } else {
                    other.push(btn);
                }
            }

            e.data.buttons = [].concat(online, torrent, trailer, other);
        }
    });

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Оборачиваем регистрацию плагина в проверку.
    if (Lampa.Plugin && typeof Lampa.Plugin.create === 'function') {
        Lampa.Plugin.create({
            title: 'Sort buttons',
            id: 'sort_buttons',
            component: Component.Button,
            
            onStart: function () {
                // Инициализация Params, когда Storage гарантированно доступен.
                if (Lampa.Storage) {
                    Params = Lampa.Storage.field('full_btn_priority', '');
                    Params.value = '';
                }
            },
            
            onStop: function () {
                if (Params) {
                    Params.value = '';
                }
            },
            
            settings: function () {
                let field = {
                    name: 'full_btn_priority',
                    title: 'Default button priority',
                    type: 'select',
                    value: Params ? Params.value : '', 
                };

                field.onSelect = function (data) {
                    if (Params) {
                        Params.value = data.value;
                    }
                    if (Lampa.Storage) {
                        Lampa.Storage.set('full_btn_priority', data.value);
                    }
                };

                return [field];
            }
        });
    }

})();
