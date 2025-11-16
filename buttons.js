Lampa.Platform.tv();

(function () {
    // Получение доступа к базовым классам Lampa
    let Component = Lampa.Component;
    let Controller = Lampa.Controller;
    let Utils = Lampa.Utils;
    let Params = Lampa.Storage.field('full_btn_priority', '');

    // Удаление настройки приоритета при загрузке плагина
    Params.value = '';

    // Хук на метод Controller.look.makeButtons
    // Этот метод генерирует кнопки на странице Full
    Lampa.Listener.follow('controller', function (e) {
        if (e.type == 'look_make_buttons') {
            let type = e.data.type; // Тип контента (movie, tv)
            let element = e.data.element; // Объект контента
            let buttons = e.data.buttons; // Исходный массив кнопок

            let online = [];
            let torrent = [];
            let trailer = [];
            let other = [];

            // Сортировка кнопок по категориям
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

            // Пересоздание массива в новом порядке
            e.data.buttons = [].concat(online, torrent, trailer, other);
        }
    });

    // Регистрация плагина
    Lampa.Plugin.create({
        title: 'Sort buttons',
        id: 'sort_buttons',
        component: Component.Button,
        onStart: function () {
            // Очистка 'full_btn_priority' при старте
            Params.value = '';
        },
        onStop: function () {
            // Установка дефолтного значения при остановке плагина
            Params.value = ''; // Значение остается пустым, что соответствует очистке.
        },
        settings: function () {
            let field = {
                name: 'full_btn_priority',
                title: 'Default button priority',
                type: 'select',
                value: Params.value,
                // Плагин переопределяет этот параметр.
                // Возможно, здесь должна быть настройка для выбора порядка.
            };

            // Перехват события "изменение настройки" для сохранения значения
            field.onSelect = function (data) {
                Params.value = data.value;
                Lampa.Storage.set('full_btn_priority', data.value);
            };

            return [field];
        }
    });

})();