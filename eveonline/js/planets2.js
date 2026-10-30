/* Планеты2 — облегчённая копия карточек из вкладки «Планеты».
   При переключении на вкладку клонирует текущее состояние карточек
   и показывает статично. Не взаимодействует с другими вкладками. */
(function () {
    'use strict';

    const dst = document.getElementById('planets2-cards');
    if (!dst) return;

    // Клонируем карточки при каждом открытии вкладки
    function refreshPlanets2() {
        const src = document.getElementById('accounts');
        if (!src) { dst.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">Карточек нет.</p>'; return; }

        // Берём только .uv (вид карточки) из каждой .card
        const cards = src.querySelectorAll('.card > .uv');
        if (!cards.length) { dst.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">Карточек нет — откройте «Планеты» и добавьте.</p>'; return; }

        // Собираем каждую колонию как отдельную карточку (3 в ряд)
        let html = '<div class="p2-grid">';
        cards.forEach(function (uv) {
            var headHtml = '';
            var head = uv.querySelector('.uv-head');
            if (head) headHtml = head.outerHTML;

            var colonies = uv.querySelectorAll('.uv-colony');
            colonies.forEach(function (col) {
                html += '<div class="p2-card">' + headHtml + '<div class="uv-body">' + col.outerHTML + '</div></div>';
            });
        });
        html += '</div>';
        dst.innerHTML = html;

        // Убираем интерактивные элементы
        dst.querySelectorAll('button, .uv-edit, .account-del, .uv-sync, .card-light, .uv-fold, .uv-fold-all, .uv-top, .uv-tier').forEach(function (el) {
            el.remove();
        });

        // Оставляем только топовую добычу — убираем все дочерние ноды
        dst.querySelectorAll('.uv-kids').forEach(function (el) {
            el.remove();
        });
    }

    // Слушаем переключение на вкладку
    document.querySelectorAll('nav button').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.dataset.tab === 'planets2') refreshPlanets2();
        });
    });
})();
