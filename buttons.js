Lampa.Platform.tv();
(function () {
  "use strict";

  if (Lampa.Storage.get("full_btn_priority") === undefined) {
    Lampa.Storage.set("full_btn_priority", "{}");
  }
  Lampa.Listener.follow("full", function (_0x160bda) {
    if (_0x160bda.type !== "complite") {
      return;
    }
    setTimeout(function () {
      var _0x4be01c = _0x160bda.object.activity.render();
      if (!_0x4be01c.length) {
        return;
      }
      var _0x2b8f31 = _0x4be01c.find(".full-start-new__buttons");
      if (!_0x2b8f31.length) {
        return;
      }
      _0x4be01c.find(".button--play").remove();
      var _0x15115e = _0x4be01c.find(".buttons--container .full-start__button").add(_0x2b8f31.find(".full-start__button"));
      var _0x14389c = {
        online: [],
        torrent: [],
        trailer: [],
        other: []
      };
      _0x15115e.each(function (_0x5ee25e) {
        var _0x5e0019 = $(this);
        var _0x247ddc = _0x5e0019.attr("class") || "";
        var _0x2afbda = _0x5e0019.clone(true).data("index", _0x5ee25e);
        _0x14389c[_0x247ddc.includes("online") ? "online" : _0x247ddc.includes("torrent") ? "torrent" : _0x247ddc.includes("trailer") ? "trailer" : "other"].push(_0x2afbda);
      });
      _0x2b8f31.empty();
      ["online", "torrent", "trailer", "other"].forEach(function (_0x40b4ad) {
        _0x14389c[_0x40b4ad].sort(function (_0x519ace, _0x440d50) {
          return $(_0x519ace).data("index") - $(_0x440d50).data("index");
        });
        _0x14389c[_0x40b4ad].forEach(function (_0x47dc11) {
          _0x2b8f31.append(_0x47dc11);
        });
      });
      _0x2b8f31.css({
        display: "flex",
        flexWrap: "wrap",
        gap: "10px"
      });
      var _0x3cf5f9 = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><path d=\"M20.331 14.644l-13.794-13.831 17.55 10.075zM2.938 0c-0.813 0.425-1.356 1.2-1.356 2.206v27.581c0 1.006 0.544 1.781 1.356 2.206l16.038-16zM29.512 14.1l-3.681-2.131-4.106 4.031 4.106 4.031 3.756-2.131c1.125-0.893 1.125-2.906-0.075-3.8zM6.538 31.188l17.55-10.075-3.756-3.756z\" fill=\"currentColor\"></path></svg>";
      _0x2b8f31.find(".lampac--button").each(function () {
        $(this).find("svg").remove().end().prepend(_0x3cf5f9);
      });
      Lampa.Controller.toggle("full_start");
    }, 100);
  });
})();
