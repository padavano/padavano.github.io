//Версия 1.02

Lampa.Platform.tv();
(function () {
  "use strict";

  var defaultPriority = ["online", "torrent", "trailer", "other"];

  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }

  Lampa.Listener.follow("full", function (eventData) {
    if (eventData.type !== "complite") {
      return;
    }

    setTimeout(function () {
      var renderObject = eventData.object.activity.render();
      
      if (!renderObject.length) return;

      var buttonsContainer = renderObject.find(".full-start-new__buttons");
      if (!buttonsContainer.length) return;

      // Удаляем стандартную кнопку Play
      renderObject.find(".button--play").remove();

      // 1. Находим все нужные кнопки
      var allButtons = renderObject.find(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button");

      // 2. ВАЖНОЕ ИЗМЕНЕНИЕ: Используем detach().
      // Это убирает кнопки из верстки (контейнер пустеет), но сохраняет их события (клики работают).
      allButtons.detach(); 

      var groups = {
        online: [],
        torrent: [],
        trailer: [],
        other: [] // Сюда попадут button--book, button--subscribe и button--options
      };

      var playIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M20.331 14.644l-13.794-13.831 17.55 10.075zM2.938 0c-0.813 0.425-1.356 1.2-1.356 2.206v27.581c0 1.006 0.544 1.781 1.356 2.206l16.038-16zM29.512 14.1l-3.681-2.131-4.106 4.031 4.106 4.031 3.756-2.131c1.125-0.893 1.125-2.906-0.075-3.8zM6.538 31.188l17.55-10.075-3.756-3.756z" fill="currentColor"></path></svg>';

      // Перебираем уже "открепленные", но живые кнопки
      allButtons.each(function () {
        var currentBtn = $(this);
        var btnClasses = currentBtn.attr("class") || "";

        var category = "other";
        if (btnClasses.indexOf("online") !== -1) category = "online";
        else if (btnClasses.indexOf("torrent") !== -1) category = "torrent";
        else if (btnClasses.indexOf("trailer") !== -1) category = "trailer";

        // Меняем иконку (если нужно)
        if (currentBtn.hasClass("lampac--button")) {
           currentBtn.find("svg").remove(); 
           currentBtn.prepend(playIconSvg);
        }

        groups[category].push(currentBtn);
      });

      // Сборка массива для вставки
      var resultArray = [];
      defaultPriority.forEach(function (key) {
        if (groups[key] && groups[key].length) {
           resultArray = resultArray.concat(groups[key]);
        }
      });

      // 3. Вставляем живые кнопки обратно
      buttonsContainer.append(resultArray);

      buttonsContainer.css({
        display: "flex",
        flexWrap: "wrap",
        gap: "10px"
      });

      Lampa.Controller.toggle("full_start");

    }, 100);
  });
})();
