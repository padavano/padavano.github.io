//Версия 1.02

Lampa.Platform.tv();
(function () {
  "use strict";

  // Настройка порядка кнопок. 
  // Если в будущем захотите менять порядок через настройки, это можно будет делать здесь.
  var defaultPriority = ["online", "torrent", "trailer", "other"];
  
  // Инициализация настройки в Storage (как в оригинале), на случай если она понадобится другим плагинам
  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }

  Lampa.Listener.follow("full", function (eventData) {
    if (eventData.type !== "complite") {
      return;
    }

    setTimeout(function () {
      var renderObject = eventData.object.activity.render();
      
      // Проверка: если рендер пустой, выходим
      if (!renderObject.length) return;

      var buttonsContainer = renderObject.find(".full-start-new__buttons");
      if (!buttonsContainer.length) return;

      // Удаляем стандартную кнопку Play, если она не нужна
      renderObject.find(".button--play").remove();

      // Собираем все кнопки из двух возможных контейнеров в одну коллекцию
      // Используем запятую в селекторе для оптимизации поиска
      var allButtons = renderObject.find(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button");

      // Объект для группировки кнопок по категориям
      var groups = {
        online: [],
        torrent: [],
        trailer: [],
        other: []
      };

      // Новая иконка Play (SVG)
      var playIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M20.331 14.644l-13.794-13.831 17.55 10.075zM2.938 0c-0.813 0.425-1.356 1.2-1.356 2.206v27.581c0 1.006 0.544 1.781 1.356 2.206l16.038-16zM29.512 14.1l-3.681-2.131-4.106 4.031 4.106 4.031 3.756-2.131c1.125-0.893 1.125-2.906-0.075-3.8zM6.538 31.188l17.55-10.075-3.756-3.756z" fill="currentColor"></path></svg>';

      // Единый цикл: сортируем кнопки по группам и сразу меняем иконки
      allButtons.each(function () {
        var currentBtn = $(this);
        var btnClasses = currentBtn.attr("class") || "";

        // 1. Определение категории (упрощенная логика)
        var category = "other";
        if (btnClasses.indexOf("online") !== -1) category = "online";
        else if (btnClasses.indexOf("torrent") !== -1) category = "torrent";
        else if (btnClasses.indexOf("trailer") !== -1) category = "trailer";

        // 2. Замена иконки (если это кнопка Lampa/Play)
        // Делаем это тут, чтобы не искать элементы снова после вставки
        if (currentBtn.hasClass("lampac--button")) {
           currentBtn.find("svg").remove(); // Удаляем старую
           currentBtn.prepend(playIconSvg); // Вставляем новую
        }

        // Добавляем саму кнопку в массив (без клонирования!)
        groups[category].push(currentBtn);
      });

      // Очищаем контейнер перед новой вставкой
      buttonsContainer.empty();

      // Собираем итоговый массив элементов для вставки в нужном порядке
      var resultArray = [];
      defaultPriority.forEach(function (key) {
        if (groups[key] && groups[key].length) {
           // Распаковываем массивы групп в общий массив
           resultArray = resultArray.concat(groups[key]);
        }
      });

      // Вставляем все кнопки за одну операцию (значительно быстрее)
      buttonsContainer.append(resultArray);

      // Применяем стили
      buttonsContainer.css({
        display: "flex",
        flexWrap: "wrap",
        gap: "10px"
      });

      // Обновляем контроллер Lampa, чтобы навигация по кнопкам работала корректно
      Lampa.Controller.toggle("full_start");

    }, 100);
  });
})();
