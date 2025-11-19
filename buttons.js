// Ссылка на плагин: https://padavano.github.io/buttons.js
// [ИЗМЕНЕНИЯ v1.03]
// 1. Полный переход на Vanilla JS (чистый JavaScript): Удалены все зависимости от jQuery для максимальной производительности.
// 2. Внедрен MutationObserver: Заменен ненадежный setTimeout. Плагин теперь реагирует мгновенно при появлении кнопок, устраняя "моргание" интерфейса.
// 3. Сохранение событий (Native Detach): Использование нативного .remove() сохраняет обработчики событий (клики) в памяти.
// 4. Оптимизация DOM: Использование insertAdjacentHTML и прямых манипуляций стилями.
// 5. Сохранены все функции v1.02: Приоритеты, скрытие кнопки опций, замена иконок.

Lampa.Platform.tv();
(function () {
  "use strict";

  var defaultPriority = ["online", "torrent", "trailer", "other"];

  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }

  // Основная функция обработки кнопок
  function processButtons(renderNode) {
    var buttonsContainer = renderNode.querySelector(".full-start-new__buttons");
    
    if (!buttonsContainer) return;

    // Удаление стандартной кнопки Play
    var playBtn = renderNode.querySelector(".button--play");
    if (playBtn) playBtn.remove();

    // Сбор всех кнопок из возможных контейнеров
    var allButtons = renderNode.querySelectorAll(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button");
    
    if (!allButtons.length) return;

    var groups = {
      online: [],
      torrent: [],
      trailer: [],
      other: []
    };

    var playIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M27.268 16.999 4.732 30.001C3.78 30.55 3 30.1 3 29V3c0-1.1.78-1.55 1.732-1.001L27.267 15c.953.55.953 1.45.001 1.999" fill="currentColor"/></svg>';

    // Единый цикл обработки и сортировки
    allButtons.forEach(function (btn) {
      var btnClasses = btn.className || "";
      
      // Логика для кнопки опций
      if (btn.classList.contains("button--options")) {
        btn.classList.add("hide");
      }

      // Определение категории
      var category = "other";
      if (btnClasses.indexOf("online") !== -1) category = "online";
      else if (btnClasses.indexOf("torrent") !== -1) category = "torrent";
      else if (btnClasses.indexOf("trailer") !== -1) category = "trailer";

      // Замена иконки
      if (btn.classList.contains("lampac--button")) {
        var oldSvg = btn.querySelector("svg");
        if (oldSvg) oldSvg.remove();
        btn.insertAdjacentHTML("afterbegin", playIconSvg);
      }

      // Изъятие элемента из DOM с сохранением в память
      btn.remove();
      groups[category].push(btn);
    });

    // Сборка итогового массива
    var sortedFragment = document.createDocumentFragment();
    defaultPriority.forEach(function (key) {
      if (groups[key].length) {
        groups[key].forEach(function (btn) {
          sortedFragment.appendChild(btn);
        });
      }
    });

    // Вставка и стилизация
    buttonsContainer.appendChild(sortedFragment);
    
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexWrap = "wrap";
    buttonsContainer.style.gap = "10px";

    Lampa.Controller.toggle("full_start");
  }

  Lampa.Listener.follow("full", function (eventData) {
    if (eventData.type !== "complite") return;

    // Получаем сырой DOM-элемент из jQuery объекта Lampa
    var renderNode = eventData.object.activity.render()[0];

    if (!renderNode) return;

    // Проверяем наличие кнопок сразу или запускаем наблюдатель
    if (renderNode.querySelector(".full-start-new__buttons")) {
      processButtons(renderNode);
    } else {
      var observer = new MutationObserver(function (mutations, obs) {
        if (renderNode.querySelector(".full-start-new__buttons")) {
          processButtons(renderNode);
          obs.disconnect();
        }
      });
      
      observer.observe(renderNode, {
        childList: true,
        subtree: true
      });
    }
  });
})();
