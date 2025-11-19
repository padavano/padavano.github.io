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
      var playIconSvg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M.001 1.165v21.669a1.275 1.275 0 0 0 1.891 1.017l-.006.003 21.442-10.8a1.172 1.172 0 0 0 .007-2.113l-.007-.003L1.886.138A1.273 1.273 0 0 0 .003 1.162v.004z" fill="currentColor"/></svg>';

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
