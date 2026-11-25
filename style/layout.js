/* ============================================================
   Sigetar.ru — ОБЩАЯ ШАПКА, ПОДВАЛ И ФОН ПЛИТОК
   Подключается первой строкой внутри <body> на каждой странице:
       <script src="/style/layout.js?v=1"></script>
   Меню сайта задаётся только здесь (SITE_NAV) — на страницах его нет.
   Подвал можно отключить: <body data-footer="off">.
   ============================================================ */
(function () {
    "use strict";

    var SITE_NAV = [
        { href: "/",             label: "Главная",      match: /^\/(index\.html)?$/ },
        { href: "/valheim/",     label: "Valheim",      match: /^\/valheim\// },
        { href: "/eveonline/",   label: "EVE Online",   match: /^\/eveonline\// },
        { href: "/clashroyale/", label: "Clash Royale", match: /^\/clashroyale\// },
        { href: "/log/",         label: "Log",          match: /^\/log\// }
    ];
    var FOOTER_TEXT = "© 2026 Sigetar · [ Sigetar ]";

    var path = location.pathname.toLowerCase();

    /* ---------- Шапка: вставляется сразу, до отрисовки страницы ---------- */
    var links = SITE_NAV.map(function (item) {
        var current = item.match.test(path);
        return '<a class="site-nav__link' + (current ? ' is-current" aria-current="page"' : '"') +
               ' href="' + item.href + '">' + item.label + '</a>';
    }).join("");

    document.body.insertAdjacentHTML("afterbegin",
        '<header class="site-header" id="site-header">' +
            '<div class="container site-header__inner">' +
                '<a class="site-brand" href="/">' +
                    '<span class="site-brand__name">Sigetar</span>' +
                    '<span class="site-brand__tag">[ Sigetar ]</span>' +
                '</a>' +
                '<nav class="site-nav" aria-label="Разделы сайта">' + links + '</nav>' +
            '</div>' +
        '</header>');

    /* Фактическая высота шапки (на телефоне меню переносится) — в --site-header-h */
    var header = document.getElementById("site-header");
    function syncHeaderHeight() {
        document.documentElement.style.setProperty("--site-header-h", header.offsetHeight + "px");
    }
    syncHeaderHeight();
    if (window.ResizeObserver) {
        new ResizeObserver(syncHeaderHeight).observe(header);
    } else {
        window.addEventListener("resize", syncHeaderHeight);
    }

    /* ---------- Подвал ---------- */
    function addFooter() {
        if (document.body.dataset.footer === "off" || document.querySelector(".site-footer")) {
            return;
        }
        var footer = document.createElement("footer");
        footer.className = "site-footer";
        footer.textContent = FOOTER_TEXT;
        document.body.appendChild(footer);
    }

    /* ---------- Общая картинка на ряд плиток (.grid--shared-bg) ----------
       Картинка вписывается в весь ряд «по cover», прижата вправо,
       а каждой плитке передаётся её сдвиг относительно ряда —
       так все плитки вместе показывают одно изображение. */
    function sharedBackgrounds() {
        Array.prototype.forEach.call(document.querySelectorAll(".grid--shared-bg"), function (grid) {
            var cards = grid.querySelectorAll(".panel--shared");
            if (!cards.length) {
                return;
            }
            /* Адрес картинки берём из уже посчитанного фона плитки —
               так путь из CSS разрешается браузером правильно */
            var m = getComputedStyle(cards[0]).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
            if (!m) {
                return;
            }
            var img = new Image();
            var ratio = 0;

            function layout() {
                if (!ratio) {
                    return;
                }
                var g = grid.getBoundingClientRect();
                var w = g.width;
                var h = w / ratio;
                if (h < g.height) {
                    h = g.height;
                    w = h * ratio;
                }
                var left = g.width - w;            /* прижата вправо */
                var top = (g.height - h) / 2;      /* по вертикали — по центру */
                Array.prototype.forEach.call(cards, function (card) {
                    card.style.setProperty("--bg-w", w + "px");
                    card.style.setProperty("--bg-h", h + "px");
                    card.style.setProperty("--bg-x", (left - (card.offsetLeft - grid.offsetLeft) - card.clientLeft) + "px");
                    card.style.setProperty("--bg-y", (top - (card.offsetTop - grid.offsetTop) - card.clientTop) + "px");
                });
            }

            img.onload = function () {
                ratio = img.naturalWidth / img.naturalHeight;
                layout();
            };
            img.src = m[1];

            if (window.ResizeObserver) {
                new ResizeObserver(layout).observe(grid);
            }
            window.addEventListener("resize", layout);
        });
    }

    function onReady() {
        addFooter();
        sharedBackgrounds();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", onReady);
    } else {
        onReady();
    }
})();
