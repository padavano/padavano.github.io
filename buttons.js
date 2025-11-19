// Ссылка на плагин: https://padavano.github.io/buttons.js
// [ИЗМЕНЕНИЯ v1.03]
// 1. Полный отказ от jQuery внутри логики плагина.
// 2. Удален setTimeout: Используется MutationObserver для мгновенной реакции на появление кнопок.
// 3. DocumentFragment: Максимальная производительность при вставке отсортированных кнопок.

Lampa.Platform.tv();
(function () {
  "use strict";

  // Порядок кнопок по умолчанию
  var defaultPriority = ["online", "torrent", "trailer", "other"];

  // Инициализация хранилища
  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }

  Lampa.Listener.follow("full", function (eventData) {
    if (eventData.type !== "complite") {
      return;
    }

    // Получаем корневой DOM-элемент рендера. 
    // Lampa возвращает jQuery объект, берем [0] чтобы получить чистый DOM узел.
    var renderWrapper = eventData.object.activity.render();
    var targetNode = renderWrapper[0] || renderWrapper;

    // Функция основной логики
    var processButtons = function () {
      var buttonsContainer = targetNode.querySelector(".full-start-new__buttons");
      
      // Если контейнера нет — выходим (на всякий случай)
      if (!buttonsContainer) return;

      // Удаляем стандартную кнопку Play, если она есть
      var playBtn = targetNode.querySelector(".button--play");
      if (playBtn) {
        playBtn.remove();
      }

      // 1. Находим все кнопки в обоих возможных контейнерах
      // querySelectorAll возвращает NodeList
      var allButtonsNodeList = targetNode.querySelectorAll(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button");
      
      // Преобразуем NodeList в массив для удобной работы
      var allButtons = Array.prototype.slice.call(allButtonsNodeList);

      if (allButtons.length === 0) return;

      var groups = {
        online: [],
        torrent: [],
        trailer: [],
        other: []
      };

      // Новая иконка Play
      var playIconSvgHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M27.268 16.999 4.732 30.001C3.78 30.55 3 30.1 3 29V3c0-1.1.78-1.55 1.732-1.001L27.267 15c.953.55.953 1.45.001 1.999" fill="currentColor"/></svg>';

      // Перебираем кнопки
      allButtons.forEach(function (currentBtn) {
        // Скрываем кнопку опций
        if (currentBtn.classList.contains("button--options")) {
          currentBtn.classList.add("hide");
        }

        var btnClasses = currentBtn.className || "";

        // Определение категории
        var category = "other";
        if (btnClasses.indexOf("online") !== -1) category = "online";
        else if (btnClasses.indexOf("torrent") !== -1) category = "torrent";
        else if (btnClasses.indexOf("trailer") !== -1) category = "trailer";

        // Замена иконки для кнопок Lampac
        if (currentBtn.classList.contains("lampac--button")) {
          var oldSvg = currentBtn.querySelector("svg");
          if (oldSvg) oldSvg.remove();
          
          // Вставляем новую SVG в начало кнопки
          currentBtn.insertAdjacentHTML("afterbegin", playIconSvgHTML);
        }

        groups[category].push(currentBtn);
      });

      // Создаем фрагмент документа (легковесный контейнер, не влияющий на DOM при наполнении)
      var fragment = document.createDocumentFragment();

      // Собираем фрагмент в нужном порядке
      defaultPriority.forEach(function (key) {
        if (groups[key] && groups[key].length) {
          groups[key].forEach(function(btn) {
             // appendChild перемещает элемент из старого места в новое (автоматический detach)
             fragment.appendChild(btn);
          });
        }
      });

      // 2. Вставляем все кнопки разом
      buttonsContainer.appendChild(fragment);

      // Применяем CSS стили к контейнеру
      buttonsContainer.style.display = "flex";
      buttonsContainer.style.flexWrap = "wrap";
      buttonsContainer.style.gap = "10px";

      // Обновляем навигацию Lampa
      Lampa.Controller.toggle("full_start");
    };

    // --- Логика запуска (MutationObserver) ---

    // Если кнопки уже есть (быстрый рендер), запускаем сразу
    if (targetNode.querySelector(".full-start-new__buttons")) {
        processButtons();
    } else {
        // Если кнопок нет, ставим наблюдателя
        var observer = new MutationObserver(function (mutations, obs) {
            // Проверяем, появился ли нужный контейнер
            var container = targetNode.querySelector(".full-start-new__buttons");
            if (container) {
                processButtons();
                obs.disconnect(); // Останавливаем наблюдение после выполнения
            }
        });

        // Начинаем наблюдать за изменениями в DOM (добавление детей)
        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }
  });
})();
