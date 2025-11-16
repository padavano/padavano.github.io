Lampa.Platform.tv();

(function () {
    let Component = Lampa.Component;
    let Controller = Lampa.Controller;
    let Utils = Lampa.Utils;
    
    // Защита: Проверяем, существует ли Storage, прежде чем вызвать .field
    let Params = null;
    if (Lampa.Storage && typeof Lampa.Storage.field === 'function') {
        Params = Lampa.Storage.field('full_btn_priority', '');
        Params.value = '';
    }

    Lampa.Listener.follow('controller', function (e) {
        if (e.type == 'look_make_buttons') {
            let type = e.data.type;
            let element = e.data.element;
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

    // Используем Component.Button, который должен быть определен
    Lampa.Plugin.create({
        title: 'Sort buttons',
        id: 'sort_buttons',
        component: Component.Button,
        onStart: function () {
            // Гарантированная переинициализация после полной загрузки
            if (Lampa.Storage && typeof Lampa.Storage.field === 'function') {
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
                // Защита: если Params не определен, используем пустую строку
                value: Params ? Params.value : '', 
            };

            field.onSelect = function (data) {
                if (Params) {
                    Params.value = data.value;
                }
                // Защита: проверяем Storage перед использованием set
                if (Lampa.Storage) {
                    Lampa.Storage.set('full_btn_priority', data.value);
                }
            };

            return [field];
        }
    });

})();
