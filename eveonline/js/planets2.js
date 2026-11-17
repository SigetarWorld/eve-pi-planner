/* Компактные карточки — облегчённая копия полных карточек из #accounts.
   Показываются прямо на вкладке «Планеты» вместо полных карточек.
   Автообновление через MutationObserver при изменении #accounts.
   Склады интерактивны (клик — содержимое). Кнопки лампочки, восстановления,
   редактирования и удаления пробрасываются на оригиналы в #accounts. */
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
    var accountsEl = document.getElementById('accounts');

    /* Получить группы и построить карту charName → groupIndex.
       Используем eveChars() для маппинга charId→charName. */
    function getCharGroupMap() {
        var map = {};
        try {
            var groups = JSON.parse(localStorage.getItem('evepi.charGroups') || '[]');
            var chars = typeof eveChars === 'function' ? eveChars() : [];
            for (var gi = 0; gi < groups.length; gi++) {
                for (var ci = 0; ci < groups[gi].length; ci++) {
                    var id = Number(groups[gi][ci]);
                    var ch = chars.find(function(c) { return Number(c.characterId) === id; });
                    if (ch && ch.characterName) {
                        map[ch.characterName.toLowerCase()] = gi;
                    }
                }
            }
        } catch(e) { /* */ }
        return map;
    }

    /* Сливаем колонии одной планеты (2 продукта P1) в одну строку через «|» */
    function mergeSamePlanet(container) {
        var cols = container.querySelectorAll('.uv-colony');
        for (var i = cols.length - 1; i >= 1; i--) {
            var prev = cols[i - 1].dataset.planet;
            var cur  = cols[i].dataset.planet;
            if (!prev || !cur || prev !== cur) continue;
            var srcLine = cols[i].querySelector('.uv-line');
            if (!srcLine) { cols[i].remove(); continue; }
            var parts = [];
            for (var j = 0; j < srcLine.childNodes.length; j++) {
                var n = srcLine.childNodes[j];
                if (n.nodeType !== 1) continue;
                if (n.classList.contains('uv-where')) continue;
                if (n.classList.contains('uv-toggle') || n.classList.contains('uv-toggle-gap')) continue;
                parts.push(n);
            }
            var dstLine = cols[i - 1].querySelector('.uv-line');
            if (dstLine && parts.length) {
                var sep = document.createElement('span');
                sep.className = 'p2-prod-sep';
                sep.textContent = '|';
                dstLine.appendChild(sep);
                parts.forEach(function (el) { dstLine.appendChild(el); });
            }
            cols[i].remove();
        }
    }

    function refreshPlanets2() {
        if (!accountsEl) { dst.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">Карточек нет.</p>'; return; }

        var cards = accountsEl.querySelectorAll('.card > .uv');
        if (!cards.length) { dst.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">Карточек нет — добавьте персонажа выше.</p>'; return; }

        /* Собираем карточки в массив для сортировки по группам */
        var cardArr = [];
        cards.forEach(function (uv) {
            var parentCard = uv.closest('.card');
            var name = parentCard ? (parentCard.dataset.name || '') : '';
            cardArr.push({ uv: uv, parentCard: parentCard, name: name });
        });

        /* Сортировка по группам: сгруппированные идут первыми, по порядку групп,
           внутри группы — по порядку персонажей в группе,
           негруппированные — в конце в исходном порядке */
        var groupMap = getCharGroupMap();
        cardArr.sort(function(a, b) {
            var ga = groupMap.hasOwnProperty(a.name.toLowerCase()) ? groupMap[a.name.toLowerCase()] : 9999;
            var gb = groupMap.hasOwnProperty(b.name.toLowerCase()) ? groupMap[b.name.toLowerCase()] : 9999;
            return ga - gb;
        });

        dst.innerHTML = '';

        /* Рендер с разделителями между группами */
        var prevGroup = -1;
        cardArr.forEach(function (item) {
            var uv = item.uv;
            var parentCard = item.parentCard;
            var curGroup = groupMap.hasOwnProperty(item.name.toLowerCase())
                ? groupMap[item.name.toLowerCase()] : -1;

            /* Разделитель между группами */
            if (prevGroup !== -1 && curGroup !== prevGroup) {
                var sep = document.createElement('div');
                sep.className = 'p2-group-sep';
                dst.appendChild(sep);
            }
            prevGroup = curGroup;

            var wrap = document.createElement('div');
            wrap.className = 'p2-card';
            if (curGroup >= 0) wrap.dataset.group = curGroup;
            // Переносим data-name с .card, чтобы прокси-кнопки нашли оригинал
            if (parentCard) {
                wrap.dataset.name = parentCard.dataset.name || '';
                if (parentCard.classList.contains('is-lit')) wrap.classList.add('is-lit');
            }
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
        // (кнопки складов .uv-store-btn, card-light, card-sync, card-edit, card-del оставляем)
        dst.querySelectorAll('.uv-fold, .uv-fold-all, .uv-top, .uv-tier, .uv-plan, .uv-offplan').forEach(function (el) {
            el.remove();
        });
        // Убираем кнопки кроме нужных (склады, лампочка, синхр, редакт, удаление)
        dst.querySelectorAll('button').forEach(function (el) {
            if (el.classList.contains('uv-store-btn')) return;
            if (el.classList.contains('card-light')) return;
            if (el.dataset.role === 'card-sync') return;
            if (el.dataset.role === 'card-edit') return;
            if (el.dataset.role === 'card-del') return;
            el.remove();
        });

        // Оставляем только топовую добычу — убираем все дочерние ноды
        dst.querySelectorAll('.uv-kids').forEach(function (el) {
            el.remove();
        });

        // Если на одной планете 2 продукта — сливаем в одну строку
        dst.querySelectorAll('.p2-card').forEach(function (card) {
            mergeSamePlanet(card);
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

    /* ---------- Лампочка, восстановление, редактирование, удаление ---------- */
    /* Клик на этих кнопках в planets2 пробрасывается на оригинал в #accounts,
       потому что обработчики привязаны делегированием к #accounts. */
    /* Находим имя карточки по data-name на .p2-card обёртке */
    function cardNameOf(el) {
        var p2 = el && el.closest('.p2-card');
        return p2 ? (p2.dataset.name || '') : '';
    }

    dst.addEventListener('click', function (event) {
        var light = event.target.closest('.card-light');
        if (light) {
            var cardName = cardNameOf(light);
            if (cardName) {
                var orig = document.querySelector('#accounts .card[data-name="' + cardName + '"] .card-light');
                if (orig) orig.click();
            }
            // Переключаем и на клоне визуально
            var p2card = light.closest('.p2-card');
            if (p2card) {
                var lit = p2card.classList.toggle('is-lit');
                light.setAttribute('aria-pressed', String(lit));
            }
            return;
        }

        var sync = event.target.closest('[data-role="card-sync"]');
        if (sync) {
            var cardName = cardNameOf(sync);
            if (cardName) {
                var orig = document.querySelector('#accounts .card[data-name="' + cardName + '"] [data-role="card-sync"]');
                if (orig) orig.click();
            }
            return;
        }

        var edit = event.target.closest('[data-role="card-edit"]');
        if (edit) {
            var cardName = cardNameOf(edit);
            if (cardName) {
                var orig = document.querySelector('#accounts .card[data-name="' + cardName + '"] [data-role="card-edit"]');
                if (orig) orig.click();
            }
            return;
        }

        var del = event.target.closest('[data-role="card-del"]');
        if (del) {
            var cardName = cardNameOf(del);
            var p2card = del.closest('.p2-card');
            if (cardName) {
                var orig = document.querySelector('#accounts .card[data-name="' + cardName + '"] [data-role="card-del"]');
                if (orig) orig.click();
                // MutationObserver обновит компактные карточки автоматически
            }
            return;
        }
    });

    /* ---------- Инкрементальный синк одной карточки ---------- */
    /* Когда ESI-данные приходят (склады, количества), перерисовываем
       только затронутую компактную карточку, а не все сразу. */
    function syncCard(cardName) {
        var origCard = accountsEl.querySelector('.card[data-name="' + cardName + '"]');
        if (!origCard) return;
        var origUv = origCard.querySelector(':scope > .uv');
        if (!origUv) return;
        var p2card = dst.querySelector('.p2-card[data-name="' + cardName + '"]');
        if (!p2card) return;

        /* Пересоздаём содержимое этой одной карточки */
        var clone = origUv.cloneNode(true);
        p2card.innerHTML = '';
        p2card.appendChild(clone);
        if (origCard.classList.contains('is-lit')) p2card.classList.add('is-lit');
        else p2card.classList.remove('is-lit');

        /* Переносим storeData */
        var origCols = origUv.querySelectorAll('.uv-colony');
        var cloneCols = clone.querySelectorAll('.uv-colony');
        for (var ci = 0; ci < origCols.length && ci < cloneCols.length; ci++) {
            if (origCols[ci].storeData) cloneCols[ci].storeData = origCols[ci].storeData;
        }

        /* Чистка: убираем лишние элементы (как в refreshPlanets2) */
        p2card.querySelectorAll('.uv-fold, .uv-fold-all, .uv-top, .uv-tier, .uv-plan, .uv-offplan').forEach(function (el) { el.remove(); });
        p2card.querySelectorAll('button').forEach(function (el) {
            if (el.classList.contains('uv-store-btn')) return;
            if (el.classList.contains('card-light')) return;
            if (el.dataset.role === 'card-sync') return;
            if (el.dataset.role === 'card-edit') return;
            if (el.dataset.role === 'card-del') return;
            el.remove();
        });
        p2card.querySelectorAll('.uv-kids').forEach(function (el) { el.remove(); });

        /* Сливаем колонии одной планеты в одну строку (как в refreshPlanets2) */
        mergeSamePlanet(p2card);

        /* Градиенты переполнения */
        p2card.querySelectorAll('.uv-store-btn.is-full').forEach(function (btn) {
            var col = btn.closest('.uv-colony');
            if (col) col.classList.add('p2-full');
        });
        p2card.querySelectorAll('.uv-store-btn.is-warn').forEach(function (btn) {
            var col = btn.closest('.uv-colony');
            if (col && !col.classList.contains('p2-full')) col.classList.add('p2-warn');
        });
    }

    /* ---------- Автообновление ---------- */
    /* Два режима реакции на мутации в #accounts:
       1) Структурные (добавление/удаление карточек или линий) → полная перерисовка.
       2) Глубокие (ESI-данные по складам, qty) → инкрементальный синк одной карточки.
       Это решает проблему мерцания: склады не пропадают при подгрузке. */
    if (accountsEl) {
        var debounce = null;
        var syncDebounce = null;
        var syncSet = {};
        var observer = new MutationObserver(function (mutations) {
            /* Пропускаем если открыт popup склада */
            if (dst.querySelector('.uv-store-list')) return;

            var needFull = false;
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type !== 'childList') continue;
                var t = m.target;

                /* Структурные изменения на уровне аккаунтов/линий/карточек */
                if (t === accountsEl ||
                    (t.classList && (t.classList.contains('account-line') ||
                     (t.dataset && t.dataset.role === 'cards')))) {
                    needFull = true;
                    break;
                }

                /* Глубокие изменения (склады, qty) → определяем какую карточку обновить */
                var card = t.closest && t.closest('.card');
                if (card && card.dataset.name) {
                    syncSet[card.dataset.name] = true;
                }
            }

            if (needFull) {
                /* Если открыт редактор карточки (.card-slot = заглушка), пропускаем
                   полную перерисовку — она уберёт редактируемую карточку и сломает
                   остальные. Перерисуем при закрытии редактора (slot уйдёт → новый needFull). */
                if (accountsEl.querySelector('.card-slot')) return;
                clearTimeout(syncDebounce);
                syncSet = {};
                clearTimeout(debounce);
                debounce = setTimeout(refreshPlanets2, 400);
                return;
            }

            /* Инкрементальный синк затронутых карточек */
            var names = Object.keys(syncSet);
            if (names.length) {
                clearTimeout(syncDebounce);
                syncDebounce = setTimeout(function () {
                    var todo = Object.keys(syncSet);
                    syncSet = {};
                    for (var j = 0; j < todo.length; j++) syncCard(todo[j]);
                }, 200);
            }
        });
        observer.observe(accountsEl, { childList: true, subtree: true });
    }

    // При изменении группировки персонажей — пересортировка карточек
    document.addEventListener('evepi:groups', function() {
        clearTimeout(debounce);
        debounce = setTimeout(refreshPlanets2, 300);
    });

    // Первичная отрисовка с небольшой задержкой (карточки создаются в app.js)
    setTimeout(refreshPlanets2, 400);
})();
