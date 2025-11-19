// Ссылка на плагин: https://padavano.github.io/buttons.js
// [ИЗМЕНЕНИЯ v1.04]
// 1. Полная адаптация под ES5 для поддержки старых Smart TV (Tizen, WebOS, Android 4-6).
// 2. Замена несовместимых методов (Array.from, .remove()) на нативные аналоги (slice.call, removeChild).
// 3. Оптимизация производительности: использование cloneNode для иконок вместо парсинга строк.
// 4. Добавлена проверка безопасности (len > 1) перед удалением стандартной кнопки Play.
// 5. Удален неиспользуемый код Lampa.Storage (full_btn_priority).

Lampa.Platform.tv();
(function () {
    "use strict";

    var priorityKeys = ["online", "torrent", "trailer", "other"];
    
    var svgTemplate = document.createElement('div');
    svgTemplate.innerHTML = '<svg class="custom-play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M27.268 16.999 4.732 30.001C3.78 30.55 3 30.1 3 29V3c0-1.1.78-1.55 1.732-1.001L27.267 15c.953.55.953 1.45.001 1.999" fill="currentColor"/></svg>';
    var svgElement = svgTemplate.firstChild;

    Lampa.Listener.follow("full", function (eventData) {
        if (eventData.type !== "complite") return;

        var renderWrapper = eventData.object.activity.render();
        var targetNode = renderWrapper[0] || renderWrapper;
        var timer = null;
        var observer = null;

        var processButtons = function () {
            var buttonsContainer = targetNode.querySelector(".full-start-new__buttons");
            if (!buttonsContainer) return;

            var nodeList = targetNode.querySelectorAll(".buttons--container .full-start__button, .full-start-new__buttons .full-start__button");
            var allButtons = Array.prototype.slice.call(nodeList);
            var len = allButtons.length;

            if (len === 0) return;

            if (len > 1) {
                var playBtn = targetNode.querySelector(".button--play");
                if (playBtn && playBtn.parentNode) {
                    playBtn.parentNode.removeChild(playBtn);
                }
            }

            var groups = { online: [], torrent: [], trailer: [], other: [] };

            for (var i = 0; i < len; i++) {
                var btn = allButtons[i];
                var cl = btn.classList;

                if (cl.contains("button--options")) {
                    cl.add("hide");
                }

                if (cl.contains("lampac--button") && !btn.querySelector(".custom-play-icon")) {
                    var oldSvgs = btn.querySelectorAll('svg');
                    for (var s = 0; s < oldSvgs.length; s++) {
                        oldSvgs[s].parentNode.removeChild(oldSvgs[s]);
                    }
                    btn.insertBefore(svgElement.cloneNode(true), btn.firstChild);
                }

                var cName = btn.className;
                var cat = "other";
                if (cName.indexOf("online") !== -1) cat = "online";
                else if (cName.indexOf("torrent") !== -1) cat = "torrent";
                else if (cName.indexOf("trailer") !== -1) cat = "trailer";

                groups[cat].push(btn);
            }

            var fragment = document.createDocumentFragment();
            var hasItems = false;

            for (var j = 0; j < 4; j++) {
                var key = priorityKeys[j];
                var group = groups[key];
                if (group.length > 0) {
                    hasItems = true;
                    for (var k = 0; k < group.length; k++) {
                        fragment.appendChild(group[k]);
                    }
                }
            }

            if (hasItems) {
                if (observer) observer.disconnect();

                buttonsContainer.appendChild(fragment);
                
                buttonsContainer.style.display = "flex";
                buttonsContainer.style.flexWrap = "wrap";
                buttonsContainer.style.gap = "10px";

                if (observer) startObserver(buttonsContainer);

                Lampa.Controller.toggle("full_start");
            }
        };

        var startObserver = function (elementToWatch) {
            observer = new MutationObserver(function (mutations) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    processButtons();
                }, 20);
            });
            observer.observe(elementToWatch, { childList: true, subtree: true });
        };

        var existContainer = targetNode.querySelector(".full-start-new__buttons");
        if (existContainer) {
            processButtons();
            startObserver(existContainer);
        } else {
            var initObserver = new MutationObserver(function (mutations, obs) {
                var container = targetNode.querySelector(".full-start-new__buttons");
                if (container) {
                    obs.disconnect();
                    processButtons();
                    startObserver(container);
                }
            });
            initObserver.observe(targetNode, { childList: true, subtree: true });
        }
    });
})();
