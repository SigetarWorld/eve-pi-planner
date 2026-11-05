/* Планеты2 — облегчённая копия карточек из вкладки «Планеты».
   При переключении на вкладку клонирует текущее состояние карточек
   и показывает статично. Склады интерактивны (клик — содержимое). */
(function () {
    'use strict';

    var dst = document.getElementById('planets2-cards');
    if (!dst) return;

    /* ---------- Утилиты ---------- */
    var STORE_CAP = { lp: 10000, sf: 12000, cc: 500 };
    var TIER_VOL  = [0.005, 0.19, 0.75, 3, 50];

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    /* piTierOf из app.js — определяем уровень товара по названию */
    function tierOf(name) {
        var n = String(name).toLowerCase();
        // P4: содержит «mainframe», «broadcast», «wetware», «nano», «organic», «gel», «ukomi»
        if (/mainframe|broadcast|wetware|nano-|organic mortar|gel-matrix|ukomi/.test(n)) return 4;
        // P3: содержит заметные подстроки уровня 3
        if (/condensate|camera|guidance|hermetic|transcranium|planetary vehicle|robotics|smartfab|supercomputer|synthetic oil|vaccines|cryoprotectant|biotech|fertilizer|polytextile|silicate|transmitter|datacore|hazmat|high-tech|industrial explosive/i.test(n)) return 3;
        // P2: содержит подстроки уровня 2
        if (/biocell|construction|consumer|genetically|livestock|luxury|mechanical|miniature|nanite|oxides|polyaramid|rocket fuel|silicate glass|superconductors|supertensile|test cultures|transmitter|viral agent|water-cooled cpu|enriched uranium|polytextiles/i.test(n)) return 2;
        // P1: содержит подстроки
        if (/bacteria|biofuels|biomass|chiral|electrolytes|industrial fibers|oxidizing|oxygen|plasmoids|precious metals|proteins|reactive metals|silicon|toxic metals|water$/i.test(n)) return 1;
        return 0;
    }

    function storeKind(typeId, btn) {
        // Быстрый способ — по CSS-классу кнопки
        if (btn) {
            if (btn.classList.contains('uv-store-lp')) return 'lp';
            if (btn.classList.contains('uv-store-cc')) return 'cc';
            if (btn.classList.contains('uv-store-sf')) return 'sf';
        }
        return 'sf';
    }

    function storeUsed(items) {
        var used = 0;
        items.forEach(function (q, name) {
            if (q > 0) used += q * (TIER_VOL[tierOf(name)] || 0);
        });
        return used;
    }

    /* ---------- Клонирование ---------- */
    function refreshPlanets2() {
        var src = document.getElementById('accounts');
        if (!src) { dst.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">Карточек нет.</p>'; return; }

        var cards = src.querySelectorAll('.card > .uv');
        if (!cards.length) { dst.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">Карточек нет — откройте «Планеты» и добавьте.</p>'; return; }

        dst.innerHTML = '';
        cards.forEach(function (uv) {
            var wrap = document.createElement('div');
            wrap.className = 'p2-card';
            var clone = uv.cloneNode(true);
            wrap.appendChild(clone);
            dst.appendChild(wrap);

            // Переносим storeData с оригинальных колоний на клоны
            var origCols = uv.querySelectorAll('.uv-colony');
            var cloneCols = clone.querySelectorAll('.uv-colony');
            for (var i = 0; i < origCols.length && i < cloneCols.length; i++) {
                if (origCols[i].storeData) cloneCols[i].storeData = origCols[i].storeData;
            }
        });

        // Убираем интерактивные элементы, галочки плана и блок «Вне плана»
        // (кнопки складов .uv-store-btn оставляем)
        dst.querySelectorAll('button:not(.uv-store-btn), .uv-edit, .account-del, .uv-sync, .card-light, .uv-fold, .uv-fold-all, .uv-top, .uv-tier, .uv-plan, .uv-offplan').forEach(function (el) {
            el.remove();
        });

        // Оставляем только топовую добычу — убираем все дочерние ноды
        dst.querySelectorAll('.uv-kids').forEach(function (el) {
            el.remove();
        });

        // Градиент переполнения: помечаем колонии с is-warn / is-full
        dst.querySelectorAll('.uv-store-btn.is-full').forEach(function (btn) {
            var col = btn.closest('.uv-colony');
            if (col) col.classList.add('p2-full');
        });
        dst.querySelectorAll('.uv-store-btn.is-warn').forEach(function (btn) {
            var col = btn.closest('.uv-colony');
            if (col && !col.classList.contains('p2-full')) col.classList.add('p2-warn');
        });
    }

    /* ---------- Клик по складу ---------- */
    dst.addEventListener('click', function (event) {
        var storeBtn = event.target.closest('[data-role="uv-store"]');
        if (!storeBtn) return;
        var col = storeBtn.closest('.uv-colony');
        if (!col) return;

        // Закрываем уже открытый список
        var old = col.querySelector('.uv-store-list');
        var same = old && old.dataset.i === storeBtn.dataset.i;
        if (old) old.remove();
        col.querySelectorAll('[data-role="uv-store"]').forEach(function (b) {
            b.setAttribute('aria-expanded', 'false');
        });
        if (same) return;

        var stores = col.storeData || [];
        var st = stores[Number(storeBtn.dataset.i)];
        if (!st) return;

        // Заполненность
        var kind = storeKind(st.typeId, storeBtn);
        var cap  = STORE_CAP[kind] || 0;
        var used = storeUsed(st.items);
        var pct  = cap ? Math.round(used / cap * 100) : 0;

        // Название склада из подсказки кнопки (содержит имя из ESI)
        var title = (storeBtn.getAttribute('data-tip') || '').split('\n')[0] || 'Склад';

        // Список содержимого
        var items = [];
        st.items.forEach(function (q, name) {
            if (q >= 1) items.push({ name: name, qty: Math.floor(q) });
        });
        items.sort(function (a, b) { return b.qty - a.qty || a.name.localeCompare(b.name); });

        var html = '<div class="uv-store-list" data-i="' + storeBtn.dataset.i + '">';
        html += '<div class="uv-store-title">' + escHtml(title);
        html += ' <span class="uv-store-fill">' + pct + ' %</span></div>';
        if (items.length) {
            items.forEach(function (it) {
                html += '<div class="uv-line"><span class="uv-name">' + escHtml(it.name) +
                    '</span><span class="uv-sep">–</span><span class="uv-qty">' +
                    it.qty.toLocaleString('ru-RU') + '</span></div>';
            });
        } else {
            html += '<div class="uv-empty">пусто</div>';
        }

        /* --- Дефицит P4: показываем под складом с P2/P3 --- */
        var hasP2P3 = items.some(function (it) { var t = tierOf(it.name); return t >= 2 && t <= 3; });
        var prod = col.dataset.prod || '';
        if (hasP2P3 && prod && typeof PI_RECIPE_OF !== 'undefined') {
            var recipe = PI_RECIPE_OF.get(prod);
            if (recipe) {
                // Сумма всех предметов по всем 3 складам колонии
                var allItems = {};
                (col.storeData || []).forEach(function (s) {
                    s.items.forEach(function (q, name) {
                        if (q >= 1) allItems[name] = (allItems[name] || 0) + Math.floor(q);
                    });
                });

                var defRows = '';
                var allOk = true;
                recipe.in.forEach(function (ing) {
                    var iName = ing[0], iNeed = ing[1];
                    var iHave = allItems[iName] || 0;
                    var short = iHave < iNeed;
                    if (short) allOk = false;
                    defRows += '<div class="uv-line' + (short ? ' p2-short' : ' p2-enough') + '">' +
                        '<span class="uv-name">' + escHtml(iName) + '</span>' +
                        '<span class="uv-sep">–</span>' +
                        '<span class="uv-qty">' + iHave.toLocaleString('ru-RU') + ' / ' + iNeed + '</span>' +
                        (short ? '<span class="p2-deficit-n">−' + (iNeed - iHave) + '</span>' : '') +
                        '</div>';
                });

                html += '<div class="p2-deficit">';
                html += '<div class="p2-deficit-title">' + escHtml(prod) +
                    (allOk ? ' <span class="p2-ok-mark">✓</span>' : '') + '</div>';
                html += defRows;
                html += '</div>';
            }
        }

        html += '</div>';

        var line = col.querySelector('.uv-node > .uv-line');
        if (line) line.insertAdjacentHTML('afterend', html);
        storeBtn.setAttribute('aria-expanded', 'true');
    });

    // Слушаем переключение на вкладку
    document.querySelectorAll('nav button').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.dataset.tab === 'planets2') refreshPlanets2();
        });
    });
})();
