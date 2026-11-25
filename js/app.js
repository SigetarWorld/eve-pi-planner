/* ============================================================
   Визитная карточка — одна страница
   Кнопки в шапке (data-tab) и внутри разделов (data-goto)
   плавно прокручивают к <section id="...">.
   Пункт меню раздела, который сейчас на экране, подсвечивается.
   ============================================================ */
(function () {
    "use strict";

    var allSections = Array.prototype.slice.call(
        document.querySelectorAll(".page-section")
    );
    var sections = allSections;
    var buttons = Array.prototype.slice.call(
        document.querySelectorAll("nav button[data-tab]")
    );

    function scrollToSection(id) {
        var target = document.getElementById(id);
        if (!target) {
            return;
        }
        if (id === sections[0].id) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (history.replaceState) {
            history.replaceState(null, "", "#" + id);
        }
    }

    function setActive(id) {
        buttons.forEach(function (btn) {
            var on = btn.dataset.tab === id;
            btn.classList.toggle("is-active", on);
            if (on) {
                btn.setAttribute("aria-current", "true");
            } else {
                btn.removeAttribute("aria-current");
            }
        });
    }

    buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            scrollToSection(btn.dataset.tab);
        });
    });

    Array.prototype.forEach.call(
        document.querySelectorAll("[data-goto]"),
        function (btn) {
            btn.addEventListener("click", function () {
                scrollToSection(btn.dataset.goto);
            });
        }
    );

    /* Логотип в шапке — наверх */
    Array.prototype.forEach.call(
        document.querySelectorAll(".brand"),
        function (link) {
            link.addEventListener("click", function (e) {
                e.preventDefault();
                scrollToSection(sections[0].id);
            });
        }
    );

    /* Какой раздел сейчас на экране: последний, чей верх
       прошёл линию на трети высоты окна. Внизу страницы — последний. */
    function updateActive() {
        var line = window.innerHeight / 3;
        /* скрытые разделы (hidden) не учитываем */
        var sections = allSections.filter(function (sec) {
            return !sec.hidden;
        });
        var current = sections[0].id;

        sections.forEach(function (sec) {
            if (sec.getBoundingClientRect().top <= line) {
                current = sec.id;
            }
        });

        var atBottom = window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 4;
        if (atBottom) {
            current = sections[sections.length - 1].id;
        }

        setActive(current);
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(function () {
                updateActive();
                ticking = false;
            });
        }
    }, { passive: true });
    window.addEventListener("resize", updateActive);

    updateActive();
})();

/* Общая картинка на ряд плиток (.grid--shared-bg) теперь раскладывается
   в /style/layout.js — общем скрипте всех страниц. */


/* С диска (file://) ссылки вида /eveonline/ не работают — подставляем data-local */
(function () {
    "use strict";
    if (location.protocol !== "file:") {
        return;
    }
    Array.prototype.forEach.call(
        document.querySelectorAll("a[data-local]"),
        function (a) {
            a.href = a.getAttribute("data-local");
        }
    );
})();
