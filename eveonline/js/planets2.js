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

    /* Определяем уровень товара — приоритет PI_COMMODITIES, fallback regex */
    function tierOf(name) {
        // Точные данные из chains.js
        if (typeof PI_COMMODITIES !== 'undefined' && PI_COMMODITIES[name]) {
            return PI_COMMODITIES[name][1];
        }
        var n = String(name).toLowerCase();
        if (/mainframe|broadcast node|wetware|nano-factory|organic mortar|self-harmonizing|recursive computing|sterile conduit|integrity response/.test(n)) return 4;
        if (/condensate|camera|guidance|hermetic|transcranium|transcranial|planetary vehicle|robotics|smartfab|supercomputer|synthetic oil|synthetic synapse|vaccines|cryoprotectant|biotech|fertilizer|high-tech transmitter|gel-matrix|ukomi|data chip|neocom|nuclear reactor|hazmat|industrial explosive/i.test(n)) return 3;
        if (/biocell|construction|consumer|genetically|livestock|luxury|mechanical|miniature|nanite|oxides|polyaramid|rocket fuel|silicate glass|superconductors|supertensile|test cultures|viral agent|water-cooled cpu|enriched uranium|polytextiles|microfiber shielding|transmitter/i.test(n)) return 2;
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

    /* Иконка + бейдж тира + имя ресурса */
    function resHtml(name) {
        var t = tierOf(name);
        var icon = (typeof RESOURCE_ICONS !== 'undefined' && RESOURCE_ICONS[name])
            ? '<img class="res-icon" src="' + RESOURCE_ICONS[name] + '" loading="lazy" width="16" height="16">'
            : '';
        var badge = '<span class="ct-tier ct-tier-p' + t + '">P' + t + '</span>';
        return badge + icon + '<span class="uv-name">' + escHtml(name) + '</span>';
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

        /* --- Дефицит: полная цепочка P4→P3→P2→P1, использовать склад в 0 --- */
        var hasP2P3 = items.some(function (it) { var t = tierOf(it.name); return t >= 2 && t <= 3; });
        var prod = col.dataset.prod || '';
        if (hasP2P3 && prod && typeof PI_RECIPE_OF !== 'undefined') {
            var recipe = PI_RECIPE_OF.get(prod);
            if (recipe) {
                // 1. Собираем ВСЕ предметы: колония + склад (ангары)
                var allItems = {};
                (col.storeData || []).forEach(function (s) {
                    s.items.forEach(function (q, name) {
                        if (q >= 1) allItems[name] = (allItems[name] || 0) + Math.floor(q);
                    });
                });
                if (window._whLast && window._whLast.length) {
                    window._whLast.forEach(function (owner) {
                        owner.entries.forEach(function (e) {
                            if (e.qty >= 1) allItems[e.name] = (allItems[e.name] || 0) + Math.floor(e.qty);
                        });
                    });
                }

                // 2. Для каждого P3-ингредиента P4: считаем потенциал P3 из имеющихся P2
                //    + P2-дефициты чтобы использовать ВСЕ P2 в 0
                var p3info = [];  // { name, p3have, p3fromP2, p3total, p2defs: [{name, deficit}] }
                var p2used = {};  // отслеживаем использованные P2

                recipe.in.forEach(function (ing) {
                    var p3name = ing[0], p3perCyc = ing[1];
                    var p3have = allItems[p3name] || 0;
                    var p3fromP2 = 0;
                    var p2defs = [];

                    if (tierOf(p3name) === 3) {
                        var p3r = PI_RECIPE_OF.get(p3name);
                        if (p3r) {
                            // Сколько P2 есть для этого P3 (не считая уже использованных)
                            var maxP3cyc = 0;
                            p3r.in.forEach(function (p2ing) {
                                var p2name = p2ing[0], p2perCyc = p2ing[1];
                                var p2avail = (allItems[p2name] || 0) - (p2used[p2name] || 0);
                                var cyc = Math.floor(Math.max(0, p2avail) / p2perCyc);
                                if (cyc > maxP3cyc) maxP3cyc = cyc;
                            });
                            // Использовать ВСЕ P2 → maxP3cyc циклов P3
                            p3r.in.forEach(function (p2ing) {
                                var p2name = p2ing[0], p2perCyc = p2ing[1];
                                var p2avail = (allItems[p2name] || 0) - (p2used[p2name] || 0);
                                var p2target = maxP3cyc * p2perCyc;
                                p2used[p2name] = (p2used[p2name] || 0) + Math.min(p2avail, p2target);
                                if (p2avail < p2target) {
                                    p2defs.push({ name: p2name, deficit: p2target - Math.max(0, p2avail) });
                                }
                            });
                            p3fromP2 = maxP3cyc * p3r.outQty;
                        }
                    }

                    p3info.push({
                        name: p3name, perCyc: p3perCyc,
                        p3have: p3have, p3fromP2: p3fromP2,
                        p3total: p3have + p3fromP2,
                        p2defs: p2defs
                    });
                });

                // 3. Макс. циклов P4 чтобы использовать ВСЕ P3
                var maxCyc = 0;
                p3info.forEach(function (pi) {
                    var c = Math.floor(pi.p3total / pi.perCyc);
                    if (c > maxCyc) maxCyc = c;
                });

                // 4. Дефицит P3 для выравнивания
                var p3defs = [];
                p3info.forEach(function (pi) {
                    var target = maxCyc * pi.perCyc;
                    if (pi.p3total < target) {
                        p3defs.push({ name: pi.name, deficit: target - pi.p3total });
                    }
                });

                // 5. Считаем все P2-дефициты:
                //    a) из балансировки P2 внутри каждого P3 (шаг 2)
                //    b) из дефицита P3 (шаг 4) → разворачиваем в P2
                var allP2defs = {};  // name → deficit

                // 5a: дефициты балансировки P2
                p3info.forEach(function (pi) {
                    pi.p2defs.forEach(function (d) {
                        allP2defs[d.name] = (allP2defs[d.name] || 0) + d.deficit;
                    });
                });

                // 5b: дефициты P3 → P2
                p3defs.forEach(function (d) {
                    var p3r = PI_RECIPE_OF.get(d.name);
                    if (p3r) {
                        var cyc = Math.ceil(d.deficit / p3r.outQty);
                        p3r.in.forEach(function (p2ing) {
                            allP2defs[p2ing[0]] = (allP2defs[p2ing[0]] || 0) + cyc * p2ing[1];
                        });
                    }
                });

                // 6. P2-дефициты → P1 (через рецепты P2)
                var p1Need = {};
                Object.keys(allP2defs).forEach(function (p2name) {
                    var p2deficit = allP2defs[p2name];
                    if (p2deficit <= 0) return;
                    var p2r = PI_RECIPE_OF.get(p2name);
                    if (p2r) {
                        var cyc = Math.ceil(p2deficit / p2r.outQty);
                        p2r.in.forEach(function (p1ing) {
                            p1Need[p1ing[0]] = (p1Need[p1ing[0]] || 0) + cyc * p1ing[1];
                        });
                    }
                });

                // Вычитаем запасы P1 из потребности
                var p1List = [];
                Object.keys(p1Need).forEach(function (name) {
                    var need = p1Need[name];
                    var have = allItems[name] || 0;
                    var add = Math.max(0, need - have);
                    p1List.push({ name: name, need: need, have: have, add: add });
                });
                p1List.sort(function (a, b) { return b.add - a.add || a.name.localeCompare(b.name); });

                // 7. Рендер
                var hasDefs = p3defs.length > 0 || Object.keys(allP2defs).length > 0;
                if (hasDefs) {
                    var whLoaded = window._whLast && window._whLast.length;
                    html += '<div class="p2-deficit">';
                    html += '<div class="p2-deficit-title">' + escHtml(prod) +
                        ' — реализовать склад в 0' +
                        (whLoaded ? '' : ' <span class="p2-warn-tag">(откройте Склад)</span>') +
                        '</div>';

                    // Показываем P4 циклов
                    html += '<div class="uv-line p2-info-row"><span class="uv-name">' +
                        escHtml(prod) + '</span><span class="uv-sep">×</span><span class="uv-qty">' +
                        (maxCyc * recipe.outQty).toLocaleString('ru-RU') + ' шт</span></div>';

                    // P3 дефицит
                    if (p3defs.length) {
                        html += '<div class="p2-deficit-sub">Не хватает P3:</div>';
                        p3defs.forEach(function (d) {
                            html += '<div class="uv-line p2-def-row">' + resHtml(d.name) +
                                '<span class="uv-sep">×</span><span class="uv-qty">' +
                                d.deficit.toLocaleString('ru-RU') + '</span></div>';
                        });
                    }

                    // P2 дефицит
                    var p2names = Object.keys(allP2defs).filter(function (n) { return allP2defs[n] > 0; });
                    if (p2names.length) {
                        html += '<div class="p2-deficit-sub">Не хватает P2:</div>';
                        p2names.forEach(function (name) {
                            html += '<div class="uv-line p2-def-row p2-chain-2">' + resHtml(name) +
                                '<span class="uv-sep">×</span><span class="uv-qty">' +
                                allP2defs[name].toLocaleString('ru-RU') + '</span></div>';
                        });
                    }

                    // Итого P1 — надо добавить
                    var hasP1add = p1List.some(function (p) { return p.add > 0; });
                    if (hasP1add) {
                        html += '<div class="p2-deficit-sub">Добавить P1:</div>';
                        p1List.forEach(function (p) {
                            if (p.add <= 0) return;
                            var haveTag = p.have > 0
                                ? ' <span class="p2-have">(есть ' + p.have.toLocaleString('ru-RU') + ')</span>'
                                : '';
                            html += '<div class="uv-line p2-chain-1">' + resHtml(p.name) +
                                '<span class="uv-sep">×</span><span class="uv-qty p2-add">' +
                                p.add.toLocaleString('ru-RU') + '</span>' + haveTag + '</div>';
                        });
                    } else if (hasDefs) {
                        html += '<div class="p2-deficit-sub p2-ok">P1 хватает на складе ✓</div>';
                    }

                    html += '</div>';
                }
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
