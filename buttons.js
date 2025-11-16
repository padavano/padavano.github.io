Lampa.Platform.tv();

(function () {
    // Params объявляется, но не инициализируется, чтобы избежать ошибки reading 'field' до onStart.
    let Params = null;

    // Регистрация слушателя: прямое обращение к Lampa.Listener.
    if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('controller', function (e) {
            if (e.type === 'look_make_buttons' && e.data && e.data.buttons) {
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
    }

    // Регистрация плагина: прямое обращение к Lampa.Plugin и Lampa.Component.
    if (Lampa.Plugin && Lampa.Component && typeof Lampa.Plugin.create === 'function') {
        Lampa.Plugin.create({
            title: 'Sort buttons',
            id: 'sort_buttons',
            // Используем Lampa.Component напрямую.
            component: Lampa.Component.Button, 
            
            // onStart гарантирует, что Storage доступен для инициализации Params.
            onStart: function () {
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
