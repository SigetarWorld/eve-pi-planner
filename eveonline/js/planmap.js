/* ============================================================
   Вкладка «Карты» → «Карта планирования».

   Аналог планетарной карты для плана колоний: системы региона стоят
   в клетках 2D-карты игры (MAP_REGIONS), врата — линиями. Вокруг
   системы — её планеты (картинка и номер), вокруг каждой планеты —
   значки ресурсов выбранного уровня с картинками:
     P0 — сырьё, которое добывается на планете;
     P1 — что из этого сырья получается;
     P2 — что собирается целиком из P1 этой планеты (оба входа рецепта
          добываются здесь же).
   Планеты и значки можно перетаскивать мышью: места запоминаются
   (PM_POS_KEY), кнопка ↺ возвращает раскладку региона по умолчанию.

   Короткое нажатие на значок — меню: каким персонажам добывать/делать
   этот ресурс на этой планете. Имена выбранных персонажей пишутся
   рядом со значком (справа или слева — с внешней стороны). Как в игре:
   у персонажа на планете одна колония (повторный выбор переносит его на
   новый ресурс), и всего у персонажа не больше 6 планет.

   Это только план: карточки на вкладке «Планеты» не меняются. План
   хранится в браузере (PM_PLAN_KEY) списком
   { sys, num, type, res, tier, pilot }.

   Подсчёт плана — по кнопкам над картой, таблицы во всю высоту:
     P1 — как в «Статистике»: ±, Кол, P1, типы планет (+ где
          добывается), Ввод; Кол — сколько колоний плана дают этот P1
          (P0 → его P1, P2 → каждый вход рецепта, как строка P2 в
          статистике);
     P2 — то же для P2 (+ где P2 собирается из своего сырья) и
          дополнительно оба входа рецепта с числом их колоний P1:
          красным, если P2 запланирован, а входа нет;
     Персонажи — сколько планет у каждого в плане (из 6).
   ============================================================ */

(function planMap() {
    const root = document.getElementById('map-plan');
    if (!root || typeof MAP_REGIONS === 'undefined') return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const PM_PLAN_KEY = 'evepi.plan.entries';
    const PM_MANUAL_KEY = 'evepi.plan.manual';
    const PM_REGION_KEY = 'evepi.plan.region';
    const PM_TIER_KEY = 'evepi.plan.tier';
    const PM_POS_KEY = 'evepi.plan.pos';
    const PM_PANELS_KEY = 'evepi.plan.panels';
    const PM_HIDE_KEY = 'evepi.plan.hideUnused';
    const MAX_PLANETS = 6;  // планет у одного персонажа (Interplanetary Consolidation V)

    const PLANET_IMAGES = {
        Barren: 'img/planets/barren.png', Gas: 'img/planets/gas.png', Ice: 'img/planets/ice.png',
        Lava: 'img/planets/lava.png', Oceanic: 'img/planets/oceanic.png', Plasma: 'img/planets/plasma.png',
        Storm: 'img/planets/storm.png', Temperate: 'img/planets/temperate.png'
    };
    const PLANET_COLORS = {
        Barren: '#c9a46c', Gas: '#e3c56b', Ice: '#9fd8ff', Lava: '#ff6a3d', Oceanic: '#3d8bff',
        Plasma: '#c86bff', Storm: '#8fb0c8', Temperate: '#5fd38d', Shattered: '#9a9a9a', 'Scorched Barren': '#b0623a'
    };
    const SEC_COLORS = ['#f00000', '#d73000', '#f04800', '#f06000', '#d77700',
        '#efef00', '#8fef2f', '#00f000', '#00ef47', '#48f0c0', '#2fefef'];
    const secColor = (sec) => SEC_COLORS[Math.max(0, Math.min(10, Math.round(sec * 10)))];
    const secText = (sec) => (sec <= 0 ? sec.toFixed(1) : (Math.round(sec * 10) / 10).toFixed(1));
    const ROMAN = (n) => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
        .reduce((acc, [v, r]) => { while (n >= v) { acc += r; n -= v; } return acc; }, '');
    const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const icon = (name, size = 18) => (RESOURCE_ICONS[name]
        ? `<img class="res-icon" src="${RESOURCE_ICONS[name]}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.remove()">`
        : '');
    const el = (name, attrs = {}, parent) => {
        const node = document.createElementNS(SVG_NS, name);
        Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
        if (parent) parent.appendChild(node);
        return node;
    };
    const load = (key, fallback) => {
        try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; }
    };
    const save = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
    };

    /* ---- Справочники ---- */
    const TYPES = Object.keys(PLANET_RESOURCES);  // 8 типов, как в статистике
    const P1_LIST = [...new Set(Object.values(PLANET_RESOURCES).flat().map((r) => r.P1).filter(Boolean))].sort();
    const P1_PLANETS = new Map(P1_LIST.map((p1) => [p1,
        new Set(TYPES.filter((t) => PLANET_RESOURCES[t].some((r) => r.P1 === p1)))]));
    const P2_RECIPE = new Map(PI_RECIPES.filter((r) => r.outQty === 5).map((r) => [r.out, r]));
    const P2_LIST = [...P2_RECIPE.keys()].sort();
    // Что показывать у планеты этого типа на каждом уровне
    const RES_BY_TYPE = {};
    Object.keys(PLANET_COLORS).forEach((t) => {
        const list = PLANET_RESOURCES[t] || [];
        const p1s = new Set(list.map((r) => r.P1));
        RES_BY_TYPE[t] = {
            0: list.map((r) => r.P0),
            1: list.map((r) => r.P1),
            2: P2_LIST.filter((p2) => P2_RECIPE.get(p2).in.every(([n]) => p1s.has(n)))
        };
    });
    const P2_PLANETS = new Map(P2_LIST.map((p2) => [p2,
        new Set(TYPES.filter((t) => RES_BY_TYPE[t][2].includes(p2)))]));
    const p1OfP0 = (p0, type) => ((PLANET_RESOURCES[type] || []).find((r) => r.P0 === p0) || {}).P1 || '';

    /* ---- План ---- */
    let plan = load(PM_PLAN_KEY, []);
    if (!Array.isArray(plan)) plan = [];
    const manual = load(PM_MANUAL_KEY, {}) || {};
    let pos = load(PM_POS_KEY, {}) || {};
    let tier = Number(load(PM_TIER_KEY, 1));
    if (![0, 1, 2].includes(tier)) tier = 1;
    let highlight = '';  // ресурс, подсвеченный из таблицы
    let hideUnused = Boolean(load(PM_HIDE_KEY, false));
    const savePlan = () => save(PM_PLAN_KEY, plan);
    const lower = (s) => String(s || '').toLowerCase();
    // Планеты персонажа в плане: набор «система номер»
    const planetsOfPilot = (name) => new Set(plan.filter((e) => lower(e.pilot) === lower(name)).map((e) => `${e.sys} ${e.num}`));

    function knownPilots() {
        const names = new Map();
        const add = (n) => { if (n && !names.has(lower(n))) names.set(lower(n), n); };
        try { (typeof eveChars === 'function' ? eveChars() : []).forEach((c) => add(c.characterName)); } catch (e) { /* нет входа */ }
        load('evepi.accounts', []).forEach((acc) => ((acc && acc.cards) || []).forEach((c) => c && add(c.name)));
        plan.forEach((e) => add(e.pilot));
        return [...names.values()].sort((a, b) => a.localeCompare(b));
    }

    /* ---- Разметка ---- */
    root.innerHTML = `
        <div class="mm-bar">
            <label class="mm-region-label" for="pm-region">Регион</label>
            <select id="pm-region" class="ct-input mm-region-select"></select>
            <div class="pm-tiers" role="group" aria-label="Уровень ресурсов">
                <button type="button" data-pm-tier="0" title="Сырьё, которое добывается на планете"><span class="ct-tier ct-tier-p0">P0</span></button>
                <button type="button" data-pm-tier="1" title="P1 из сырья планеты"><span class="ct-tier ct-tier-p1">P1</span></button>
                <button type="button" data-pm-tier="2" title="P2, который собирается целиком из P1 планеты"><span class="ct-tier ct-tier-p2">P2</span></button>
            </div>
            <div class="pm-panel-btns" role="group" aria-label="Подсчёт плана">
                <button type="button" class="pm-panel-btn" data-pm-panel="p1" aria-pressed="false">Таблица P1</button>
                <button type="button" class="pm-panel-btn" data-pm-panel="p2" aria-pressed="false">Таблица P2</button>
                <button type="button" class="pm-panel-btn" data-pm-panel="pilots" aria-pressed="false">Персонажи <b data-pm="pilot-count">0</b></button>
            </div>
            <button type="button" class="pm-panel-btn pm-hide-btn" data-pm-hide aria-pressed="${hideUnused}" title="Скрыть планеты и ресурсы без плана">Скрыть пустые</button>
            <span class="mm-info" data-pm="info"></span>
            <div class="mm-zoom">
                <button type="button" data-pm-zoom="in" title="Приблизить" aria-label="Приблизить">+</button>
                <button type="button" data-pm-zoom="out" title="Отдалить" aria-label="Отдалить">−</button>
                <button type="button" data-pm-zoom="fit" title="Вписать карту в окно" aria-label="Вписать карту в окно">⤢</button>
                <button type="button" data-pm-zoom="reset" title="Вернуть планеты и значки региона на места по умолчанию" aria-label="Сбросить места">↺</button>
            </div>
        </div>
        <div class="pm-body">
            <div class="pm-panels" data-pm="panels">
                <section class="pm-panel" data-panel="p1" hidden>
                    <h3 class="pm-side-title">План: P1</h3>
                    <div data-pm="p1"></div>
                </section>
                <section class="pm-panel" data-panel="p2" hidden>
                    <h3 class="pm-side-title">План: P2</h3>
                    <div data-pm="p2"></div>
                </section>
            </div>
            <div class="mm-view pm-view is-empty" data-pm="view">
                <svg class="mm-svg" data-pm="svg" role="img" aria-label="Карта планирования"></svg>
                <p class="mm-empty">Выберите регион — здесь появятся его системы, планеты и ресурсы</p>
                <div class="mm-pop pm-pop" data-pm="pop" hidden></div>
            </div>
        </div>
        <div class="ct-modal pm-modal" data-pm="modal" hidden>
            <div class="ct-modal-box pm-modal-box">
                <div class="pm-side-head">
                    <h3 class="ct-modal-title">Персонажи</h3>
                    <button type="button" class="pm-clear" data-pm="clear" title="Удалить весь план">Очистить план</button>
                </div>
                <div class="pm-pilots" data-pm="pilots"></div>
                <button type="button" class="ct-modal-close" data-pm="modal-close" aria-label="Закрыть">×</button>
            </div>
        </div>`;
    const $ = (name) => root.querySelector(`[data-pm="${name}"]`);
    const regionSelect = root.querySelector('#pm-region');
    const view = $('view');
    const svg = $('svg');
    const pop = $('pop');

    /* ---- Кнопки таблиц: каждая открывает/закрывает свою панель ---- */
    let panels = load(PM_PANELS_KEY, []);
    if (!Array.isArray(panels)) panels = [];
    const modal = $('modal');
    function showPanels() {
        root.querySelectorAll('[data-pm-panel]').forEach((b) => {
            if (b.dataset.pmPanel === 'pilots') return;  // модалка, а не панель
            b.setAttribute('aria-pressed', String(panels.includes(b.dataset.pmPanel)));
        });
        root.querySelectorAll('.pm-panel').forEach((p) => { p.hidden = !panels.includes(p.dataset.panel); });
    }
    root.querySelectorAll('[data-pm-panel]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.pmPanel;
        if (k === 'pilots') { modal.hidden = !modal.hidden; return; }
        panels = panels.includes(k) ? panels.filter((x) => x !== k) : panels.concat(k);
        save(PM_PANELS_KEY, panels);
        showPanels();
    }));
    // Закрытие модалки
    root.querySelector('[data-pm="modal-close"]').addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; });

    /* ---- Кнопка «Скрыть пустые» ---- */
    const hideBtn = root.querySelector('[data-pm-hide]');
    hideBtn.addEventListener('click', () => {
        hideUnused = !hideUnused;
        save(PM_HIDE_KEY, hideUnused);
        hideBtn.setAttribute('aria-pressed', String(hideUnused));
        draw();
    });

    /* ---- Камера ---- */
    const camera = { x: 0, y: 0, k: 1 };
    let world = null;
    let bounds = null;
    let region = '';
    const applyCamera = () => world && world.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.k})`);
    function fit() {
        if (!bounds || !view.clientWidth) return;
        const w = view.clientWidth;
        const h = view.clientHeight;
        camera.k = Math.min(1.6, Math.min(w / (bounds.maxX - bounds.minX), h / (bounds.maxY - bounds.minY)) * 0.95);
        camera.x = w / 2 - ((bounds.minX + bounds.maxX) / 2) * camera.k;
        camera.y = h / 2 - ((bounds.minY + bounds.maxY) / 2) * camera.k;
        applyCamera();
    }
    function zoomAt(f, px, py) {
        const k = Math.min(6, Math.max(0.05, camera.k * f));
        camera.x = px - (px - camera.x) * (k / camera.k);
        camera.y = py - (py - camera.y) * (k / camera.k);
        camera.k = k;
        applyCamera();
    }
    view.addEventListener('wheel', (event) => {
        if (!world || event.target.closest('.pm-pop')) return;
        event.preventDefault();
        const r = view.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - r.left, event.clientY - r.top);
    }, { passive: false });
    root.querySelectorAll('[data-pm-zoom]').forEach((b) => b.addEventListener('click', () => {
        const z = b.dataset.pmZoom;
        if (z === 'fit') fit();
        else if (z === 'reset') resetPositions();
        else zoomAt(z === 'in' ? 1.25 : 0.8, view.clientWidth / 2, view.clientHeight / 2);
    }));
    // Вкладка была скрыта — при первом показе вписываем карту
    new ResizeObserver(() => {
        if (world && view.clientWidth && !view.dataset.fitted) { view.dataset.fitted = '1'; fit(); }
    }).observe(view);

    /* ---- Геометрия ----
       Система: «таблетка» с именем. Планеты — по кругу вокруг неё
       (в стороны, свободные от врат), у планеты под картинкой номер.
       Значки ресурсов — веером с внешней стороны планеты. */
    const PLANET_R = 10;
    const ICON = 18;
    const FAN_R = 34;        // от центра планеты до центра значка
    const FAN_STEP = 0.62;   // угол между значками веера, рад
    const SLOT = 92;         // место по кругу на одну планету с веером
    const NAME_CHAR = 5.4;   // ширина символа имени персонажа (9px), примерно
    const GAP = 8;

    const pillWidth = (name) => Math.max(50, name.length * 6.6 + 40);
    const planetKey = (sys, num) => `${sys} ${num}`;
    const resKey = (sys, num, res) => `${sys} ${num}|${res}`;

    // Углы планет: равномерно по кругу, поворот — подальше от линий врат
    function planetAngles(n, busy) {
        if (!n) return [];
        const step = (2 * Math.PI) / n;
        let best = 0;
        let bestScore = -1;
        for (let k = 0; k < 24; k++) {
            const off = (step * k) / 24;
            let score = Infinity;
            for (let j = 0; j < n; j++) {
                busy.forEach((b) => {
                    let d = Math.abs(((off + j * step - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
                    score = Math.min(score, d);
                });
            }
            if (!busy.length) score = 0;
            if (score > bestScore) { bestScore = score; best = off; }
            if (!busy.length) break;
        }
        return Array.from({ length: n }, (_, j) => best - Math.PI / 2 + j * step);
    }

    // Раскладка одной системы (в её координатах): планеты, значки, рамки
    function layoutSystem(row, busy) {
        const [name, , , sec, letters] = row;
        const pillW = pillWidth(name);
        const list = [...(letters || '')].map((code, k) => {
            const type = PLANET_TYPE_CODES[code] || code;
            const allRes = (RES_BY_TYPE[type] || {})[tier] || [];
            // Скрыть пустые: оставляем только ресурсы, у которых есть записи в плане
            const res = hideUnused
                ? allRes.filter((r) => plan.some((e) => e.sys === name && e.num === ROMAN(k + 1) && e.res === r))
                : allRes;
            return { type, num: ROMAN(k + 1), res, allRes };
        }).filter((pl) => {
            if (!hideUnused) return true;
            // скрыть планету, если у неё нет записей в плане вообще (любой тир)
            return plan.some((e) => e.sys === name && e.num === pl.num);
        });
        const ringR = Math.max(pillW / 2 + 46, (list.length * SLOT) / (2 * Math.PI));
        const angles = planetAngles(list.length, busy);
        const parts = [{ x1: -pillW / 2 - 4, y1: -14, x2: pillW / 2 + 4, y2: 14 }];
        list.forEach((pl, j) => {
            const a = angles[j];
            const saved = pos[planetKey(name, pl.num)];
            pl.x = saved ? saved[0] : ringR * Math.cos(a);
            pl.y = saved ? saved[1] : ringR * Math.sin(a);
            const out = Math.atan2(pl.y, pl.x);  // наружу от системы
            parts.push({ x1: pl.x - 13, y1: pl.y - 13, x2: pl.x + 13, y2: pl.y + 24 });
            pl.icons = pl.res.map((res, k) => {
                const ia = out + (k - (pl.res.length - 1) / 2) * FAN_STEP;
                const s = pos[resKey(name, pl.num, res)];
                const ix = s ? s[0] : FAN_R * Math.cos(ia);
                const iy = s ? s[1] : FAN_R * Math.sin(ia);
                const who = plan.filter((e) => e.sys === name && e.num === pl.num && e.res === res).map((e) => e.pilot);
                // имя — с внешней стороны значка (по горизонтали от системы)
                const right = pl.x + ix >= 0;
                const nameW = who.length ? who.join(', ').length * NAME_CHAR + 6 : 0;
                const box = { x1: pl.x + ix - ICON / 2 - 1, y1: pl.y + iy - ICON / 2 - 8, x2: pl.x + ix + ICON / 2 + 8, y2: pl.y + iy + ICON / 2 + 1 };
                if (right) box.x2 += nameW; else box.x1 -= nameW;
                parts.push(box);
                return { res, x: ix, y: iy, who, right };
            });
        });
        const bbox = parts.reduce((b, p) => ({
            x1: Math.min(b.x1, p.x1), y1: Math.min(b.y1, p.y1), x2: Math.max(b.x2, p.x2), y2: Math.max(b.y2, p.y2)
        }), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
        return { name, sec, pillW, planets: list, parts, bbox };
    }

    /* Шаг сетки: как можно меньше, но так, чтобы планеты и значки
       соседних систем не налезали друг на друга (форма региона — как
       в игре). Рамкам достаточно разойтись по одной из осей. */
    function gridStep(data, sys) {
        let cell = 40;
        for (let a = 0; a < sys.length; a++) {
            for (let b = a + 1; b < sys.length; b++) {
                const dx = data.s[b][1] - data.s[a][1];
                const dy = data.s[b][2] - data.s[a][2];
                const apart = (P, Q) => Math.min(
                    dx > 0 ? (P.x2 - Q.x1 + GAP) / dx : dx < 0 ? (Q.x2 - P.x1 + GAP) / -dx : Infinity,
                    dy > 0 ? (P.y2 - Q.y1 + GAP) / dy : dy < 0 ? (Q.y2 - P.y1 + GAP) / -dy : Infinity);
                if (!(apart(sys[a].bbox, sys[b].bbox) > cell)) continue;
                sys[a].parts.forEach((P) => sys[b].parts.forEach((Q) => {
                    const v = apart(P, Q);
                    if (Number.isFinite(v) && v > cell) cell = v;
                }));
            }
        }
        return cell;
    }

    let names = [];
    let points = [];
    function draw(opts = {}) {
        if (!opts.keepPop) closePop();
        const data = MAP_REGIONS[region];
        svg.innerHTML = '';
        if (!data) { view.classList.add('is-empty'); world = null; bounds = null; $('info').textContent = ''; return; }
        view.classList.remove('is-empty');

        // направления врат у каждой системы — планеты ставятся между ними
        const busy = data.s.map(() => []);
        for (let k = 0; k < data.j.length; k += 2) {
            const a = data.j[k];
            const b = data.j[k + 1];
            const ang = Math.atan2(data.s[b][2] - data.s[a][2], data.s[b][1] - data.s[a][1]);
            busy[a].push(ang);
            busy[b].push(ang + Math.PI);
        }
        const sys = data.s.map((row, i) => layoutSystem(row, busy[i]));
        const cell = gridStep(data, sys);
        points = data.s.map(([, x, y]) => ({ x: x * cell, y: y * cell }));
        names = data.s.map((row) => row[0]);

        const defs = el('defs', {}, svg);
        const clip = el('clipPath', { id: 'pm-clip', clipPathUnits: 'objectBoundingBox' }, defs);
        el('circle', { cx: 0.5, cy: 0.5, r: 0.5 }, clip);
        world = el('g', {}, svg);
        const gates = el('g', { class: 'pm-gates' }, world);
        const nodes = el('g', {}, world);
        for (let k = 0; k < data.j.length; k += 2) {
            const a = points[data.j[k]];
            const b = points[data.j[k + 1]];
            el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'mm-jump' }, gates);
        }

        bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        let planetCount = 0;
        sys.forEach((s, i) => {
            const p = points[i];
            bounds.minX = Math.min(bounds.minX, p.x + s.bbox.x1); bounds.maxX = Math.max(bounds.maxX, p.x + s.bbox.x2);
            bounds.minY = Math.min(bounds.minY, p.y + s.bbox.y1); bounds.maxY = Math.max(bounds.maxY, p.y + s.bbox.y2);
            const g = el('g', { class: 'pm-system', 'data-sys': s.name, transform: `translate(${p.x} ${p.y})` }, nodes);
            const branches = el('g', {}, g);

            s.planets.forEach((pl) => {
                planetCount++;
                const color = PLANET_COLORS[pl.type] || '#888';
                const planned = plan.filter((e) => e.sys === s.name && e.num === pl.num);
                el('line', { class: 'pm-branch', x1: 0, y1: 0, x2: pl.x, y2: pl.y, stroke: color, 'data-num': pl.num }, branches);
                const pg = el('g', {
                    class: `pm-planet${planned.length ? ' is-plan' : ''}${pl.res.length ? '' : ' is-empty'}`,
                    'data-sys': s.name, 'data-num': pl.num, transform: `translate(${pl.x} ${pl.y})`
                }, g);
                // значки — под планетой (ниже по слою), линии к ним — тонкие
                pl.icons.forEach((ic) => {
                    el('line', { class: 'pm-twig', x1: 0, y1: 0, x2: ic.x, y2: ic.y, 'data-res': ic.res }, pg);
                });
                const body = el('g', { class: 'pm-planet-body' }, pg);
                el('title', {}, body).textContent = `${s.name} ${pl.num} — ${pl.type}${planned.length
                    ? `\n${planned.map((e) => `${e.pilot}: ${e.res}`).join('\n')}` : ''}\nПеретащите, чтобы передвинуть планету`;
                el('circle', { r: PLANET_R + 1.5, fill: '#0b1220', stroke: color, 'stroke-width': planned.length ? 2.2 : 1.3, class: 'pm-planet-ring' }, body);
                if (PLANET_IMAGES[pl.type]) {
                    el('image', { href: PLANET_IMAGES[pl.type], x: -PLANET_R, y: -PLANET_R, width: PLANET_R * 2, height: PLANET_R * 2, 'clip-path': 'url(#pm-clip)' }, body);
                } else {
                    el('circle', { r: PLANET_R, fill: color }, body);
                }
                const num = el('text', { class: 'pm-num', y: PLANET_R + 9, 'text-anchor': 'middle' }, body);
                num.textContent = pl.num;

                pl.icons.forEach((ic) => {
                    const hl = highlight && (highlight === ic.res || p1OfP0(ic.res, pl.type) === highlight);
                    const rg = el('g', {
                        class: `pm-res${ic.who.length ? ' is-plan' : ''}${hl ? ' is-hl' : ''}`,
                        'data-sys': s.name, 'data-num': pl.num, 'data-type': pl.type, 'data-res': ic.res,
                        transform: `translate(${ic.x} ${ic.y})`, tabindex: 0, role: 'button'
                    }, pg);
                    el('title', {}, rg).textContent = `${ic.res} [P${tier}]\n${s.name} ${pl.num} — ${pl.type}${ic.who.length
                        ? `\nПерсонажи: ${ic.who.join(', ')}` : '\nНажмите, чтобы выбрать персонажа'}\nПеретащите, чтобы передвинуть значок`;
                    el('rect', { class: 'pm-res-box', x: -ICON / 2, y: -ICON / 2, width: ICON, height: ICON, rx: 3 }, rg);
                    if (RESOURCE_ICONS[ic.res]) el('image', { href: RESOURCE_ICONS[ic.res], x: -ICON / 2 + 1, y: -ICON / 2 + 1, width: ICON - 2, height: ICON - 2 }, rg);
                    // значок уровня [P0] / [P1] / [P2] — бейдж в правом верхнем углу ресурса
                    const TB = 14;
                    const tbX = ICON / 2 - TB / 2 + 2;
                    const tbY = -ICON / 2 - TB / 2 + 1;
                    el('rect', { class: `pm-tier-sq pm-tier-sq-p${tier}`, x: tbX, y: tbY, width: TB, height: TB, rx: 4 }, rg);
                    const badge = el('text', { class: 'pm-tier-sq-text', x: tbX + TB / 2, y: tbY + TB / 2, 'text-anchor': 'middle', dy: '0.35em' }, rg);
                    badge.textContent = `P${tier}`;
                    if (ic.who.length) {
                        const t = el('text', {
                            class: 'pm-who', x: ic.right ? ICON / 2 + 4 : -ICON / 2 - 4, dy: '0.35em',
                            'text-anchor': ic.right ? 'start' : 'end'
                        }, rg);
                        t.textContent = ic.who.join(', ');
                    }
                });
            });

            const pill = el('rect', { class: 'mm-system-pill', x: -s.pillW / 2, y: -11, width: s.pillW, height: 22, rx: 11 }, g);
            pill.style.stroke = secColor(s.sec);
            const t = el('text', { class: 'mm-system-name', 'text-anchor': 'middle', dy: '0.35em' }, g);
            t.textContent = s.name;
            const st = el('tspan', { class: 'mm-system-sec', fill: secColor(s.sec), dx: 4 }, t);
            st.textContent = secText(s.sec);
        });

        const inRegion = plan.filter((e) => names.includes(e.sys)).length;
        $('info').textContent = `Систем: ${sys.length}, планет: ${planetCount}, в плане здесь: ${inRegion}`;
        if (opts.keepView) { applyCamera(); return; }
        if (view.clientWidth) { view.dataset.fitted = '1'; fit(); } else delete view.dataset.fitted;
    }

    /* Перерисовка без сброса камеры. Система anchor остаётся на том же
       месте экрана, даже если шаг сетки поменялся. */
    function redraw(anchor, opts = {}) {
        const k = anchor ? names.indexOf(anchor) : -1;
        const before = k >= 0 ? { x: camera.x + points[k].x * camera.k, y: camera.y + points[k].y * camera.k } : null;
        draw(Object.assign({ keepView: true }, opts));
        const k2 = anchor ? names.indexOf(anchor) : -1;
        if (before && k2 >= 0) {
            camera.x = before.x - points[k2].x * camera.k;
            camera.y = before.y - points[k2].y * camera.k;
            applyCamera();
        }
    }

    function resetPositions() {
        if (!region || !MAP_REGIONS[region]) return;
        const set = new Set(MAP_REGIONS[region].s.map((r) => r[0]));
        Object.keys(pos).forEach((key) => {
            const sysName = key.split('|')[0].replace(/ [IVX]+$/, '');
            if (set.has(sysName)) delete pos[key];
        });
        save(PM_POS_KEY, pos);
        draw();
    }

    /* ---- Перетаскивание ----
       Планета: тянется вместе со своими значками, ветка от системы — за
       ней. Значок: двигается вокруг своей планеты. Нажатие без движения
       на значке открывает меню персонажей. Пустое место — двигает карту. */
    let drag = null;
    const toWorld = (dx, dy) => ({ x: dx / camera.k, y: dy / camera.k });
    view.addEventListener('pointerdown', (event) => {
        if (!world || event.button !== 0 || event.target.closest('.pm-pop')) return;
        const res = event.target.closest('.pm-res');
        const planet = !res && event.target.closest('.pm-planet-body');
        const node = res || (planet && planet.parentNode);
        if (node) {
            const m = node.transform.baseVal.consolidate().matrix;
            drag = { kind: res ? 'res' : 'planet', node, x: event.clientX, y: event.clientY, bx: m.e, by: m.f, moved: false };
        } else {
            drag = { kind: 'map', x: event.clientX, y: event.clientY, cx: camera.x, cy: camera.y, moved: false };
            view.classList.add('is-dragging');
        }
        view.setPointerCapture(event.pointerId);
    });
    view.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
        drag.moved = true;
        if (drag.kind === 'map') {
            camera.x = drag.cx + dx;
            camera.y = drag.cy + dy;
            applyCamera();
            return;
        }
        const w = toWorld(dx, dy);
        const nx = drag.bx + w.x;
        const ny = drag.by + w.y;
        drag.node.setAttribute('transform', `translate(${nx} ${ny})`);
        drag.nx = nx; drag.ny = ny;
        if (drag.kind === 'planet') {
            const br = drag.node.parentNode.querySelector(`.pm-branch[data-num="${drag.node.dataset.num}"]`);
            if (br) { br.setAttribute('x2', nx); br.setAttribute('y2', ny); }
        } else {
            const tw = drag.node.parentNode.querySelector(`.pm-twig[data-res="${CSS.escape(drag.node.dataset.res)}"]`);
            if (tw) { tw.setAttribute('x2', nx); tw.setAttribute('y2', ny); }
        }
    });
    function endDrag(event) {
        const d = drag;
        drag = null;
        view.classList.remove('is-dragging');
        if (!d) return;
        if (d.kind === 'map') {
            if (!d.moved && event && event.type === 'pointerup') closePop();
            return;
        }
        if (!d.moved) {
            if (d.kind === 'res' && event && event.type === 'pointerup') openPop(d.node);
            return;
        }
        const n = d.node.dataset;
        const key = d.kind === 'planet' ? planetKey(n.sys, n.num) : resKey(n.sys, n.num, n.res);
        pos[key] = [Math.round(d.nx), Math.round(d.ny)];
        save(PM_POS_KEY, pos);
        redraw(n.sys);
    }
    view.addEventListener('pointerup', endDrag);
    view.addEventListener('pointercancel', endDrag);

    /* ---- Меню значка: персонажи ---- */
    let popTarget = null;
    function closePop() { pop.hidden = true; popTarget = null; }
    function placePop(node) {
        const vr = view.getBoundingClientRect();
        const nr = node.getBoundingClientRect();
        let left = nr.right - vr.left + 10;
        if (left + 300 > vr.width) left = Math.max(8, nr.left - vr.left - 310);
        pop.style.left = `${left}px`;
        pop.style.top = `${Math.max(8, Math.min(nr.top - vr.top - 10, vr.height - pop.offsetHeight - 8))}px`;
    }
    function openPop(node) {
        popTarget = { sys: node.dataset.sys, num: node.dataset.num, type: node.dataset.type, res: node.dataset.res, tier };
        renderPop();
        pop.hidden = false;
        placePop(node);
    }
    function renderPop(note = '') {
        const t = popTarget;
        const who = plan.filter((e) => e.sys === t.sys && e.num === t.num && e.res === t.res);
        const busy = new Set(who.map((e) => lower(e.pilot)));
        const here = planetKey(t.sys, t.num);
        const options = knownPilots().filter((n) => !busy.has(lower(n))).map((n) => {
            const own = planetsOfPilot(n);
            return { n, count: own.size, full: own.size >= MAX_PLANETS && !own.has(here) };
        });
        const p1 = t.tier === 0 ? p1OfP0(t.res, t.type) : '';
        pop.innerHTML = `
            <div class="mm-pop-head">
                <span class="pm-pop-res">${icon(t.res, 20)}<span class="mm-pop-title">${esc(t.res)}</span>${p1 ? `<span class="pm-pop-sub">→ ${esc(p1)}</span>` : ''}</span>
                <button type="button" class="mm-pop-close" data-pop="close" aria-label="Закрыть">×</button>
            </div>
            <div class="pm-pop-planet">${esc(t.sys)} ${esc(t.num)} — ${esc(t.type)}</div>
            <span class="mm-pop-label">В плане</span>
            <ul class="pm-pop-list">${who.length
                ? who.map((e) => `<li><span>${esc(e.pilot)}</span><span class="pm-pop-cnt">${planetsOfPilot(e.pilot).size}/${MAX_PLANETS}</span><button type="button" data-pop="remove" data-pilot="${esc(e.pilot)}" title="Убрать из плана" aria-label="Убрать ${esc(e.pilot)}">✕</button></li>`).join('')
                : '<li class="pm-pop-none">никого</li>'}</ul>
            <span class="mm-pop-label">Добавить персонажа</span>
            <div class="pm-pop-add">
                <input class="ct-input mm-pop-input" list="pm-pilots" data-pop="name" placeholder="Имя персонажа" autocomplete="off">
                <datalist id="pm-pilots">${options.filter((o) => !o.full).map((o) => `<option value="${esc(o.n)}">`).join('')}</datalist>
                <button type="button" class="btn card-add" data-pop="add">Добавить</button>
            </div>
            <div class="pm-pop-quick">${options.map((o) => `<button type="button" data-pop="pick" data-pilot="${esc(o.n)}"${o.full
                ? ` disabled title="У ${esc(o.n)} уже ${MAX_PLANETS} планет в плане"` : ` title="Планет в плане: ${o.count} из ${MAX_PLANETS}"`}>${esc(o.n)} <small>${o.count}/${MAX_PLANETS}</small></button>`).join('')}</div>
            <p class="pm-pop-note" data-pop="note">${esc(note)}</p>`;
    }
    function addPilot(raw) {
        const t = popTarget;
        let name = (raw || '').trim();
        if (!t || !name) return;
        // то же имя, что уже известно, — в его написании
        name = knownPilots().find((n) => lower(n) === lower(name)) || name;
        const here = planetKey(t.sys, t.num);
        const own = planetsOfPilot(name);
        if (!own.has(here) && own.size >= MAX_PLANETS) {
            renderPop(`У ${name} уже ${MAX_PLANETS} планет в плане — больше у персонажа не бывает. Уберите его с другой планеты.`);
            return;
        }
        // один персонаж на планете — одна колония: старая запись заменяется
        const old = plan.find((e) => e.sys === t.sys && e.num === t.num && lower(e.pilot) === lower(name));
        plan = plan.filter((e) => e !== old);
        plan.push({ sys: t.sys, num: t.num, type: t.type, res: t.res, tier: t.tier, pilot: name });
        savePlan();
        changed();
        renderPop(old && old.res !== t.res ? `${name} перенесён с ${old.res}: на планете у персонажа одна колония.` : '');
    }
    pop.addEventListener('click', (event) => {
        const b = event.target.closest('[data-pop]');
        if (!b || b.disabled) return;
        const act = b.dataset.pop;
        if (act === 'close') closePop();
        if (act === 'pick') addPilot(b.dataset.pilot);
        if (act === 'add') addPilot(pop.querySelector('[data-pop="name"]').value);
        if (act === 'remove') {
            const t = popTarget;
            plan = plan.filter((e) => !(e.sys === t.sys && e.num === t.num && e.res === t.res && e.pilot === b.dataset.pilot));
            savePlan();
            changed();
            renderPop();
        }
    });
    pop.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.dataset.pop === 'name') addPilot(event.target.value);
    });
    svg.addEventListener('keydown', (event) => {
        const node = event.target.closest && event.target.closest('.pm-res');
        if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openPop(node); }
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePop(); });

    // План поменялся: значки на карте и таблицы
    function changed() {
        const t = popTarget;
        redraw(t ? t.sys : '', { keepPop: Boolean(t) });
        updateTables();
    }

    /* ---- Таблицы ---- */
    function count() {
        const p1 = new Map(P1_LIST.map((n) => [n, 0]));
        const p2 = new Map(P2_LIST.map((n) => [n, 0]));
        const planets = new Map(TYPES.map((t) => [t, 0]));
        plan.forEach((e) => {
            if (planets.has(e.type)) planets.set(e.type, planets.get(e.type) + 1);
            if (e.tier === 0) {
                const x = p1OfP0(e.res, e.type);
                if (p1.has(x)) p1.set(x, p1.get(x) + 1);
            } else if (e.tier === 1) {
                if (p1.has(e.res)) p1.set(e.res, p1.get(e.res) + 1);
            } else if (e.tier === 2 && P2_RECIPE.has(e.res)) {
                p2.set(e.res, p2.get(e.res) + 1);
                // как строка P2 в статистике: каждый вход, который добывается на этой планете
                P2_RECIPE.get(e.res).in.forEach(([n]) => {
                    if (p1.has(n) && P1_PLANETS.get(n).has(e.type)) p1.set(n, p1.get(n) + 1);
                });
            }
        });
        return { p1, p2, planets };
    }
    const diffOf = (c, m) => {
        if (m === '' || m === undefined || m === null) return '';
        const d = Number(m) - c;
        return !Number.isFinite(d) || d === 0 ? '' : (d > 0 ? `+${d}` : String(d));
    };

    function tableHtml(kind, list, where, extraHead = '', extraCell = () => '') {
        const letters = TYPES.map((t) => `<th scope="col" class="st-planet" title="${esc(t)}">${esc(t[0])}</th>`).join('');
        const counts = TYPES.map((t) => `<th class="st-planet-count" data-planet="${esc(t)}">0</th>`).join('');
        const rows = list.map((name) => {
            const marks = TYPES.map((t) => (where.get(name).has(t) ? '<td class="st-mark is-on">+</td>' : '<td class="st-mark"></td>')).join('');
            const saved = (manual[kind] || {})[name];
            return `<tr data-res="${esc(name)}">
                <td class="st-diff"></td>
                <td class="st-count">0</td>
                <th scope="row" class="st-name"><span class="st-name-inner" title="Подсветить на карте">${icon(name)}<span>${esc(name)}</span></span></th>
                ${marks}${extraCell(name)}
                <td class="st-manual-cell"><input type="number" min="0" step="1" inputmode="numeric" class="st-manual"
                    data-kind="${kind}" aria-label="Ввод для ${esc(name)}" value="${saved === undefined || saved === null ? '' : esc(String(saved))}"></td>
            </tr>`;
        }).join('');
        return `<table class="stats-p1 pm-table">
            <thead>
                <tr>
                    <th rowspan="2" class="st-diff" title="Разница: Ввод − Кол-во">±</th>
                    <th rowspan="2" class="st-count" title="Колоний в плане">Кол</th>
                    <th rowspan="2" scope="col" class="st-name">${kind.toUpperCase()}</th>
                    ${letters}${extraHead}
                    <th rowspan="2" scope="col" class="st-manual-cell">Ввод</th>
                </tr>
                <tr>${counts}</tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
                <td></td><td class="st-count" data-sum="count">0</td>
                <td colspan="${TYPES.length + 1 + (extraHead ? 2 : 0)}"></td>
                <td class="st-manual-cell" data-sum="manual">0</td>
            </tr></tfoot>
        </table>`;
    }
    $('p1').innerHTML = tableHtml('p1', P1_LIST, P1_PLANETS);
    $('p2').innerHTML = tableHtml('p2', P2_LIST, P2_PLANETS,
        '<th rowspan="2" colspan="2" class="pm-in-head" title="Входы рецепта P2 и сколько колоний P1 их дают">Входы P1</th>',
        (p2) => P2_RECIPE.get(p2).in.map(([n]) => `<td class="pm-in" data-in="${esc(n)}" title="${esc(n)}"><span class="pm-in-inner">${icon(n, 16)}<b>0</b></span></td>`).join(''));

    function fillTable(box, counts, planets) {
        let sum = 0;
        let sumManual = 0;
        box.querySelectorAll('.st-planet-count').forEach((c) => { c.textContent = planets.get(c.dataset.planet) || 0; });
        box.querySelectorAll('tbody tr').forEach((row) => {
            const n = counts.get(row.dataset.res) || 0;
            const m = row.querySelector('.st-manual').value.trim();
            const d = diffOf(n, m);
            row.querySelector('.st-count').textContent = n;
            const dc = row.querySelector('.st-diff');
            dc.textContent = d;
            dc.classList.toggle('is-more', d.startsWith('+'));
            dc.classList.toggle('is-less', d.startsWith('-'));
            row.classList.toggle('is-zero', !n && !m);
            row.classList.toggle('is-hl', row.dataset.res === highlight);
            sum += n;
            sumManual += Number(m) || 0;
        });
        box.querySelector('[data-sum="count"]').textContent = sum;
        box.querySelector('[data-sum="manual"]').textContent = sumManual;
    }

    function updateTables() {
        const { p1, p2, planets } = count();
        fillTable($('p1'), p1, planets);
        fillTable($('p2'), p2, planets);
        // Входы P2: сколько колоний P1 их дают; красный — P2 нужен, а входа нет
        $('p2').querySelectorAll('tbody tr').forEach((row) => {
            const need = (p2.get(row.dataset.res) || 0) || Number(row.querySelector('.st-manual').value) || 0;
            row.querySelectorAll('.pm-in').forEach((cell) => {
                const have = p1.get(cell.dataset.in) || 0;
                cell.querySelector('b').textContent = have;
                cell.classList.toggle('is-missing', need > 0 && have === 0);
                cell.classList.toggle('is-ok', need > 0 && have > 0);
            });
        });
        // Персонажи: планет в плане из 6 и что на них
        const by = new Map();
        plan.forEach((e) => {
            const k = lower(e.pilot);
            if (!by.has(k)) by.set(k, { name: e.pilot, list: [] });
            by.get(k).list.push(e);
        });
        $('pilot-count').textContent = by.size;
        $('pilots').innerHTML = by.size
            ? [...by.values()].sort((a, b) => a.name.localeCompare(b.name)).map(({ name, list }) => {
                const n = new Set(list.map((e) => planetKey(e.sys, e.num))).size;
                return `<div class="pm-pilot${n >= MAX_PLANETS ? ' is-full' : ''}">
                    <div class="pm-pilot-head"><b>${esc(name)}</b><span>${n}/${MAX_PLANETS}</span></div>
                    <ul>${list.map((e) => `<li>${icon(e.res, 16)}<span>${esc(e.res)}</span><small>${esc(e.sys)} ${esc(e.num)}</small></li>`).join('')}</ul>
                </div>`;
            }).join('')
            : '<span class="pm-pilot-none">План пуст: выберите ресурс на карте и персонажа</span>';
    }

    root.querySelector('.pm-panels').addEventListener('input', (event) => {
        const inp = event.target.closest('.st-manual');
        if (!inp) return;
        const kind = inp.dataset.kind;
        const name = inp.closest('tr').dataset.res;
        manual[kind] = manual[kind] || {};
        if (inp.value.trim() === '') delete manual[kind][name];
        else manual[kind][name] = Number(inp.value);
        save(PM_MANUAL_KEY, manual);
        updateTables();
    });
    // Очистить план — кнопка в модалке персонажей
    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-pm="clear"]')) {
            if (plan.length && window.confirm('Удалить весь план колоний?')) { plan = []; savePlan(); changed(); }
        }
    });
    // Нажатие на название ресурса — подсветить его значки на карте
    root.querySelector('.pm-panels').addEventListener('click', (event) => {
        const name = event.target.closest('.st-name-inner');
        if (!name) return;
        const res = name.closest('tr').dataset.res;
        highlight = highlight === res ? '' : res;
        // ресурс другого уровня — переключаем значки на его уровень
        const want = P1_LIST.includes(res) ? 1 : 2;
        if (highlight && tier !== want && !(tier === 0 && want === 1)) setTier(want);
        else redraw();
        updateTables();
    });

    function setTier(t) {
        tier = t;
        save(PM_TIER_KEY, t);
        root.querySelectorAll('[data-pm-tier]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.pmTier) === t)));
        if (region) draw();
    }
    root.querySelectorAll('[data-pm-tier]').forEach((b) => b.addEventListener('click', () => setTier(Number(b.dataset.pmTier))));

    // Список регионов — тот же, что у планетарной карты
    function fillRegions() {
        const src = document.getElementById('mm-region');
        const list = src ? Array.from(src.options).map((o) => o.value).filter((v) => v && MAP_REGIONS[v])
            : Object.keys(MAP_REGIONS).sort();
        regionSelect.innerHTML = '<option value="">Выберите регион…</option>'
            + list.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
        const saved = load(PM_REGION_KEY, '') || (src && src.value) || '';
        if (list.includes(saved)) { regionSelect.value = saved; region = saved; }
        showPanels();
        setTier(tier);
        updateTables();
    }
    regionSelect.addEventListener('change', () => {
        region = regionSelect.value;
        save(PM_REGION_KEY, region);
        draw();
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillRegions);
    else fillRegions();
}());
