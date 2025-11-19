// Ссылка на плагин: https://padavano.github.io/buttons.js
// [ИЗМЕНЕНИЯ v1.02]
// 1. Читаемые имена переменных ( eventData, allButtons, groups и т.д.).
// 2. Убрано клонирование (.clone()): Теперь работаем со ссылками на существующие элементы. Это экономит память (не копируем обработчики событий).
// 3. Убрана лишняя сортировка: Кнопки собираются в группы (groups) в том порядке, в котором они идут в коде.
// 4. Оптимизация цикла: Замена иконки (svg) внутри единого цикла перебора кнопок, а не отдельным проходом после вставки (меньше обращений к DOM).
// 5. Вставка за один раз: Собираем все кнопки в массив resultArray и вставляем их в контейнер одной операцией .append() (минимизируем перерисовку страницы).
// 6. Реализация приоритетов: Теперь, если массив порядка кнопок изменить в начале кода (или загрузить из настроек), плагин реально поменяет порядок вывода.
// 7. Добавлен hide для button--options (кнопка с тремя точками).

Lampa.Platform.tv();
(function () {
  "use strict";

  // Порядок кнопок по умолчанию
  var defaultPriority = ["online", "torrent", "trailer", "other"];

  // Инициализация хранилища (для совместимости)
  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }

  Lampa.Listener.follow("full", function (eventData) {
    if (eventData.type !== "complite") {
      return;
    }

    setTimeout(function () {
      var renderObject = eventData.object.activity.render();
      
      // Проверки на существование элементов
      if (!renderObject.length) return;
      var buttonsContainer = renderObject.find(".full-start-new__buttons");
      if (!buttonsContainer.length) return;

      // Удаляем стандартную кнопку Play, если она есть
      renderObject.find(".button--play").remove();

      // 1. Находим все кнопки в обоих контейнерах
      var allButtons = renderObject.find(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button");

      // 2. "Открепляем" кнопки от DOM. 
      // Это сохраняет их события (клики работают), но убирает визуально для пересортировки.
      allButtons.detach(); 

      var groups = {
        online: [],
        torrent: [],
        trailer: [],
        other: []
      };

      // Новая иконка Play
      var playIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M20.331 14.644l-13.794-13.831 17.55 10.075zM2.938 0c-0.813 0.425-1.356 1.2-1.356 2.206v27.581c0 1.006 0.544 1.781 1.356 2.206l16.038-16zM29.512 14.1l-3.681-2.131-4.106 4.031 4.106 4.031 3.756-2.131c1.125-0.893 1.125-2.906-0.075-3.8zM6.538 31.188l17.55-10.075-3.756-3.756z" fill="currentColor"></path></svg>';

      // Перебираем кнопки для обработки и сортировки
      allButtons.each(function () {
        var currentBtn = $(this);
        var btnClasses = currentBtn.attr("class") || "";

        // Скрываем кнопку опций
        if (currentBtn.hasClass("button--options")) {
            currentBtn.addClass("hide");
        }

        // Определение категории
        var category = "other";
        if (btnClasses.indexOf("online") !== -1) category = "online";
        else if (btnClasses.indexOf("torrent") !== -1) category = "torrent";
        else if (btnClasses.indexOf("trailer") !== -1) category = "trailer";

        // Замена иконки для кнопок Lampac
        if (currentBtn.hasClass("lampac--button")) {
           currentBtn.find("svg").remove(); 
           currentBtn.prepend(playIconSvg);
        }

        groups[category].push(currentBtn);
      });

      // Формируем итоговый массив в нужном порядке
      var resultArray = [];
      defaultPriority.forEach(function (key) {
        if (groups[key] && groups[key].length) {
           resultArray = resultArray.concat(groups[key]);
        }
      });

      // 3. Вставляем все кнопки обратно в контейнер одной операцией
      buttonsContainer.append(resultArray);

      // Применяем CSS стили к контейнеру
      buttonsContainer.css({
        display: "flex",
        flexWrap: "wrap",
        gap: "10px"
      });

      // Обновляем навигацию Lampa
      Lampa.Controller.toggle("full_start");

    }, 100);
  });
})();
