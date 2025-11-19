// Ссылка на плагин: https://padavano.github.io/buttons.js
// [ИЗМЕНЕНИЯ v1.03]
// 1. Полный отказ от jQuery внутри логики плагина.
// 2. Удален setTimeout: Используется MutationObserver для мгновенной реакции на появление кнопок.

Lampa.Platform.tv();
(function () {
  "use strict";

  var defaultPriority = ["online", "torrent", "trailer", "other"];
  var playIconSvgHTML = '<svg class="custom-play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M27.268 16.999 4.732 30.001C3.78 30.55 3 30.1 3 29V3c0-1.1.78-1.55 1.732-1.001L27.267 15c.953.55.953 1.45.001 1.999" fill="currentColor"/></svg>';

  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }

  Lampa.Listener.follow("full", function (eventData) {
    if (eventData.type !== "complite") return;

    var renderWrapper = eventData.object.activity.render();
    var targetNode = renderWrapper[0] || renderWrapper;
    var timer = null;
    var observer = null;

    // Функция основной обработки (Сортировка + Иконки)
    var processButtons = function () {
      var buttonsContainer = targetNode.querySelector(".full-start-new__buttons");
      if (!buttonsContainer) return;

      // 1. Подготовка кнопок
      var allButtons = Array.from(targetNode.querySelectorAll(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button"));
      
      if (allButtons.length === 0) return;

      // Удаляем стандартную кнопку Play (если вдруг есть)
      var simplePlay = targetNode.querySelector(".button--play");
      if (simplePlay) simplePlay.remove();

      var groups = { online: [], torrent: [], trailer: [], other: [] };

      allButtons.forEach(function (btn) {
        // Скрываем опции
        if (btn.classList.contains("button--options")) {
          btn.classList.add("hide");
        }

        // --- ЛОГИКА ИКОНКИ ---
        // Проверяем класс. Также проверяем, не заменили ли мы иконку уже (чтобы не дублировать при повторном запуске)
        if (btn.classList.contains("lampac--button") && !btn.querySelector(".custom-play-icon")) {
          // Удаляем ВСЕ старые SVG внутри кнопки
          var oldSvgs = btn.querySelectorAll("svg");
          oldSvgs.forEach(function(svg) { svg.remove(); });
          
          // Вставляем новую
          btn.insertAdjacentHTML("afterbegin", playIconSvgHTML);
        }

        // --- ЛОГИКА СОРТИРОВКИ ---
        var btnClasses = btn.className || "";
        var category = "other";
        if (btnClasses.indexOf("online") !== -1) category = "online";
        else if (btnClasses.indexOf("torrent") !== -1) category = "torrent";
        else if (btnClasses.indexOf("trailer") !== -1) category = "trailer";

        groups[category].push(btn);
      });

      // 2. Вставка в DOM
      // Используем Fragment для одной операции вставки
      var fragment = document.createDocumentFragment();
      var hasButtons = false;

      defaultPriority.forEach(function (key) {
        if (groups[key].length) {
          groups[key].forEach(function(btn) {
            fragment.appendChild(btn);
          });
          hasButtons = true;
        }
      });

      if (hasButtons) {
        // Временно отключаем обсервер, чтобы наша собственная перестановка кнопок 
        // не вызывала бесконечный цикл "изменение -> сортировка -> изменение..."
        if (observer) observer.disconnect();
        
        buttonsContainer.appendChild(fragment);
        
        // Применяем стили
        buttonsContainer.style.display = "flex";
        buttonsContainer.style.flexWrap = "wrap";
        buttonsContainer.style.gap = "10px";

        // Возвращаем наблюдение (вдруг Lampa добавит еще кнопку позже, например Трейлер)
        if (observer) startObserver(buttonsContainer); 
        
        Lampa.Controller.toggle("full_start");
      }
    };

    // Функция запуска обсервера
    var startObserver = function(elementToWatch) {
        observer = new MutationObserver(function (mutations) {
            // Debounce: сбрасываем таймер при каждом "чихе" DOM
            if (timer) clearTimeout(timer);
            
            // Ждем 20мс тишины. Если за 20мс ничего не добавилось — считаем, что рендер готов.
            timer = setTimeout(function() {
                processButtons();
            }, 20);
        });

        observer.observe(elementToWatch, {
            childList: true, // следим за добавлением детей
            subtree: true    // и за вложенностью (если SVG грузится внутрь кнопки)
        });
    };

    // --- ТОЧКА ВХОДА ---
    // 1. Сначала ищем контейнер
    var existContainer = targetNode.querySelector(".full-start-new__buttons");
    
    if (existContainer) {
        // Если контейнер уже есть, сразу запускаем наблюдение за ним и первую обработку
        processButtons(); 
        startObserver(existContainer);
    } else {
        // Если контейнера нет, ждем его появления в targetNode
        var initObserver = new MutationObserver(function(mutations, obs) {
            var container = targetNode.querySelector(".full-start-new__buttons");
            if (container) {
                // Контейнер появился!
                obs.disconnect(); // перестаем следить за корнем
                processButtons(); // пробуем отсортировать то, что уже есть
                startObserver(container); // начинаем следить конкретно за кнопками внутри
            }
        });
        initObserver.observe(targetNode, { childList: true, subtree: true });
    }

  });
})();
