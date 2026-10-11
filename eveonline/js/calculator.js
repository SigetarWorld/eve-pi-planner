/* ============================================================
   Вкладка «Калькулятор» — майнд-карта региона.

   Сверху выбирается регион. Системы стоят так, как на 2D-карте
   в игре (схематичные координаты position2D из SDE), и соединены
   линиями настоящих
   звёздных врат. Пунктирные отростки по краям — врата в соседние
   регионы. От каждой системы ответвления — типы планет, которые в
   ней есть (Barren, Gas, Ice…), ветки смотрят в свободные от врат
   стороны.

   Данные:
     MAP_REGIONS            (js/mapdata.js) — координаты систем,
                             безопасность и врата из SDE CCP;
     PLANET_TYPES_BY_SYSTEM (js/planets.js) — буквы типов планет;
     PLANET_TYPE_CODES      (js/planets.js) — расшифровка букв.
   Ветка системы — отдельная планета: её номер (I, II, …) и тип берутся
   из MAP_REGIONS (mapPlanets.jsonl SDE). Если для системы этих данных
   нет, ветки строятся по набору типов из PLANET_TYPES_BY_SYSTEM.
   Для региона без данных о вратах (новый Exordium) системы просто
   раскладываются по кругу.

   Карта — SVG. Колесо мыши масштабирует (вокруг курсора),
   перетаскивание двигает, кнопки «+ − ⤢» — то же самое кнопками.
   Клик по типу в легенде подсвечивает системы с этим типом.
   ============================================================ */

(function () {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const MM_REGION_KEY = 'evepi.mindmap.region';

    // Картинки типов планет; у Shattered и Scorched Barren их нет —
    // для них рисуется цветной кружок с буквой.
    const PLANET_IMAGES = {
        Barren: 'img/planets/barren.png',
        Gas: 'img/planets/gas.png',
        Ice: 'img/planets/ice.png',
        Lava: 'img/planets/lava.png',
        Oceanic: 'img/planets/oceanic.png',
        Plasma: 'img/planets/plasma.png',
        Storm: 'img/planets/storm.png',
        Temperate: 'img/planets/temperate.png'
    };

    // Цвет ветки и обводки для каждого типа
    const PLANET_COLORS = {
        Barren: '#c9a46c',
        Gas: '#e3c56b',
        Ice: '#9fd8ff',
        Lava: '#ff6a3d',
        Oceanic: '#3d8bff',
        Plasma: '#c86bff',
        Storm: '#8fb0c8',
        Temperate: '#5fd38d',
        Shattered: '#9a9a9a',
        'Scorched Barren': '#b0623a'
    };

    // Геометрия раскладки
    const LAYOUT = {
        cell: 72,         // шаг сетки 2D-карты игры; соседние системы в игре
                          // стоят через 3 клетки по прямой или 2 по диагонали
        spacing: 180,     // для запасной раскладки по кругу
        branch: 52,       // длина ветки от центра системы до планеты
        branchStep: 27,   // место по кругу на одну планету: при многих
                          // планетах круг веток растёт
        planetR: 11,      // радиус значка планеты
        stub: 2.4         // длина отростка к соседнему региону, в клетках сетки
    };

    // Цвет безопасности, как в игре: от 1.0 (голубой) до 0.0 и ниже (красный)
    const SEC_COLORS = ['#f00000', '#d73000', '#f04800', '#f06000', '#d77700',
        '#efef00', '#8fef2f', '#00f000', '#00ef47', '#48f0c0', '#2fefef'];
    const secColor = (sec) => SEC_COLORS[Math.max(0, Math.min(10, Math.round(sec * 10)))];
    const secText = (sec) => (sec <= 0 ? sec.toFixed(1) : (Math.round(sec * 10) / 10).toFixed(1));

    const regionSelect = document.getElementById('mm-region');
    const view = document.getElementById('mm-view');
    const svg = document.getElementById('mm-svg');
    const info = document.getElementById('mm-info');
    const legend = document.getElementById('mm-legend');
    if (!regionSelect || !view || !svg) return;

    const store = {
        get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* приватный режим */ } }
    };

    const el = (name, attrs = {}, parent) => {
        const node = document.createElementNS(SVG_NS, name);
        Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
        if (parent) parent.appendChild(node);
        return node;
    };

    // Типы планет системы (полные названия) из строки букв
    // Римский номер планеты: 1 → I, 14 → XIV
    const ROMAN = (n) => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
        .reduce((acc, [v, r]) => {
            while (n >= v) { acc += r; n -= v; }
            return acc;
        }, '');

    const typesOf = (system) => (PLANET_TYPES_BY_SYSTEM[system] || '')
        .split(',')
        .map((code) => PLANET_TYPE_CODES[code.trim()])
        .filter(Boolean);

    /* ---- Список регионов ----
       Те же правила, что у списка «Регион» в карточках (app.js):
       без червоточин, служебных и скрытых регионов. app.js
       подключается позже, поэтому список заполняем после загрузки
       всех скриптов (DOMContentLoaded). */
    function fillRegions() {
        const hidden = typeof HIDDEN_REGIONS !== 'undefined' ? HIDDEN_REGIONS : new Set();
        const noPlanets = typeof NO_PLANET_REGION !== 'undefined'
            ? NO_PLANET_REGION
            : /^(?:[A-Z]-R\d{5}|ADR\d{2}|VR-\d{2}|GPMR-\d{2})$/;
        const regions = Object.keys(SYSTEMS_BY_REGION)
            .filter((n) => !noPlanets.test(n) && !hidden.has(n))
            .sort((a, b) => a.localeCompare(b));

        regionSelect.innerHTML = '<option value="">Выберите регион…</option>'
            + regions.map((n) => `<option value="${n.replace(/"/g, '&quot;')}">${n}</option>`).join('');

        const saved = store.get(MM_REGION_KEY);
        if (saved && regions.includes(saved)) {
            regionSelect.value = saved;
            draw(saved);
        } else {
            drawEmpty();
        }
    }

    /* ---- Масштаб и сдвиг ----
       Вся карта лежит в группе <g id="mm-world">, ей задаётся
       transform: translate(x y) scale(k). */
    const camera = { x: 0, y: 0, k: 1 };
    let currentRegion = '';
    let world = null;
    let bounds = { minX: -300, minY: -300, maxX: 300, maxY: 300 };

    function applyCamera() {
        if (world) world.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.k})`);
    }

    function fit() {
        const w = view.clientWidth || 800;
        const h = view.clientHeight || 600;
        const bw = bounds.maxX - bounds.minX;
        const bh = bounds.maxY - bounds.minY;
        camera.k = Math.min(w / bw, h / bh) * 0.95;
        camera.x = w / 2 - ((bounds.minX + bounds.maxX) / 2) * camera.k;
        camera.y = h / 2 - ((bounds.minY + bounds.maxY) / 2) * camera.k;
        applyCamera();
    }

    function zoomAt(factor, px, py) {
        const k = Math.min(6, Math.max(0.05, camera.k * factor));
        const f = k / camera.k;
        camera.x = px - (px - camera.x) * f;
        camera.y = py - (py - camera.y) * f;
        camera.k = k;
        applyCamera();
    }

    view.addEventListener('wheel', (event) => {
        if (!world || event.target.closest('.mm-pop')) return;
        event.preventDefault();
        const rect = view.getBoundingClientRect();
        zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });

    let drag = null;
    /* Перетаскивание планеты: зажать планету и вести — она едет за мышью,
       ветка тянется следом. Отпустили — место запоминается, а остальные
       планеты системы раскладываются заново вокруг неё. Короткое нажатие
       без движения — как раньше, открывает меню планеты. */
    let planetDrag = null;

    view.addEventListener('pointerdown', (event) => {
        if (!world || event.button !== 0) return;
        if (event.target.closest('.mm-pop')) return; // меню планеты — не двигаем карту
        const planetEl = event.target.closest('.mm-planet');
        if (planetEl && planetEl.dataset.key) {
            const m = planetEl.transform.baseVal.consolidate().matrix;
            planetDrag = { el: planetEl, x: event.clientX, y: event.clientY, bx: m.e, by: m.f, moved: false };
            view.setPointerCapture(event.pointerId);
            return;
        }
        drag = { x: event.clientX, y: event.clientY, cx: camera.x, cy: camera.y, moved: false };
        view.setPointerCapture(event.pointerId);
        view.classList.add('is-dragging');
    });
    view.addEventListener('pointermove', (event) => {
        if (planetDrag) {
            const dx = event.clientX - planetDrag.x;
            const dy = event.clientY - planetDrag.y;
            if (!planetDrag.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
            if (!planetDrag.moved) {
                planetDrag.moved = true;
                planetDrag.el.classList.add('is-dragging');
                closePlanetMenu();
            }
            const nx = planetDrag.bx + dx / camera.k;
            const ny = planetDrag.by + dy / camera.k;
            planetDrag.nx = nx;
            planetDrag.ny = ny;
            planetDrag.el.setAttribute('transform', `translate(${nx} ${ny})`);
            // ветка к планете тянется следом
            const sys = planetDrag.el.closest('.mm-system').transform.baseVal.consolidate().matrix;
            const branch = svg.querySelector(`.mm-branch[data-key="${planetDrag.el.dataset.key.replace(/"/g, '\\"')}"]`);
            if (branch) {
                branch.setAttribute('x2', sys.e + nx);
                branch.setAttribute('y2', sys.f + ny);
            }
            return;
        }
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        camera.x = drag.cx + dx;
        camera.y = drag.cy + dy;
        applyCamera();
    });
    const endDrag = () => {
        drag = null;
        view.classList.remove('is-dragging');
    };
    // Нажатие без перетаскивания по отростку врат — переход в соседний
    // регион. Через pointerup, а не click: из-за захвата указателя
    // click пришёл бы на само окно карты, а не на отросток.
    view.addEventListener('pointerup', (event) => {
        if (planetDrag) {
            const pd = planetDrag;
            planetDrag = null;
            if (pd.moved) {
                // запоминаем место; карту не перерисовываем — остальные планеты
                // остаются как были
                planetPos[pd.el.dataset.key] = [Math.round(pd.nx), Math.round(pd.ny)];
                savePlanetPos();
                pd.el.classList.remove('is-dragging');
                pd.el.dataset.moved = '1';
            } else {
                openPlanetMenu(pd.el, event.clientX, event.clientY);
            }
            return;
        }
        const wasClick = drag && !drag.moved;
        endDrag();
        if (!wasClick) return;
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        const ext = hit && hit.closest('.mm-ext');
        if (ext) {
            goToExt(ext);
            return;
        }
        const planet = hit && hit.closest('.mm-planet');
        if (planet && planet.dataset.key) openPlanetMenu(planet, event.clientX, event.clientY);
        else closePlanetMenu();
    });
    view.addEventListener('keydown', (event) => {
        const ext = event.target.closest && event.target.closest('.mm-ext');
        if (ext && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            goToExt(ext);
        }
    });
    view.addEventListener('pointercancel', () => {
        endDrag();
        if (planetDrag) {
            // перетаскивание прервано — возвращаем планету на прежнее место
            const pd = planetDrag;
            planetDrag = null;
            pd.el.classList.remove('is-dragging');
            pd.el.setAttribute('transform', `translate(${pd.bx} ${pd.by})`);
            const sys = pd.el.closest('.mm-system').transform.baseVal.consolidate().matrix;
            const branch = svg.querySelector(`.mm-branch[data-key="${pd.el.dataset.key.replace(/"/g, '\\"')}"]`);
            if (branch) {
                branch.setAttribute('x2', sys.e + pd.bx);
                branch.setAttribute('y2', sys.f + pd.by);
            }
        }
    });

    document.querySelectorAll('[data-mm-zoom]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!world) return;
            const mode = button.dataset.mmZoom;
            if (mode === 'fit') fit();
            else zoomAt(mode === 'in' ? 1.3 : 1 / 1.3, view.clientWidth / 2, view.clientHeight / 2);
        });
    });

    /* Фильтр планет — кнопки справа от масштаба, через разделитель:
         none   — скрыть все планеты (остаются системы и врата);
         pilots — скрыть планеты без персонажа (остаются колонии).
       Включена может быть только одна; повторное нажатие — все планеты.
       Выбор запоминается в браузере. */
    const MM_PLANETS_KEY = 'evepi.mindmap.planets';
    const planetButtons = document.querySelectorAll('[data-mm-planets]');
    let planetFilter = store.get(MM_PLANETS_KEY) || '';

    function applyPlanetFilter() {
        svg.classList.toggle('hide-planets', planetFilter === 'none');
        svg.classList.toggle('hide-free-planets', planetFilter === 'pilots');
        planetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mmPlanets === planetFilter)));
    }

    planetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            planetFilter = planetFilter === button.dataset.mmPlanets ? '' : button.dataset.mmPlanets;
            store.set(MM_PLANETS_KEY, planetFilter);
            applyPlanetFilter();
        });
    });
    applyPlanetFilter();

    // Карта рисуется во время, когда вкладка может быть скрыта (размер 0).
    // Когда вкладку открывают, вписываем карту в окно заново.
    new ResizeObserver(() => {
        if (world && view.clientWidth && !view.dataset.fitted) {
            view.dataset.fitted = '1';
            fit();
        }
    }).observe(view);

    /* ---- Раскладка ----
       Как в 2D-карте игры: системы стоят ровно в клетках её сетки
       (координаты в MAP_REGIONS уже в клетках), шаг клетки — LAYOUT.cell.
       Ничего не сдвигается: в игре в одной клетке двух систем не бывает,
       а ближе двух клеток по диагонали они не стоят. */
    let cellSize = LAYOUT.cell;
    const gridPoint = (x, y) => ({ x: x * cellSize, y: y * cellSize });

    /* Подписи планет занимают место: каждая система — круг радиусом
       radii[i] (ветки + картинки + подписи). Если у каких-то двух систем
       круги при обычном шаге сетки налезают друг на друга, шаг сетки
       увеличивается для всего региона — форма как в игре сохраняется,
       регион просто растягивается, пока ни одна пара не перекрывается. */
    function geoLayout(data, radii) {
        cellSize = LAYOUT.cell;
        const s = data.s;
        for (let a = 0; a < s.length; a++) {
            for (let b = a + 1; b < s.length; b++) {
                const grid = Math.hypot(s[a][1] - s[b][1], s[a][2] - s[b][2]);
                if (grid > 0) cellSize = Math.max(cellSize, (radii[a] + radii[b] + 10) / grid);
            }
        }
        return s.map(([, x, y]) => gridPoint(x, y));
    }

    // Планеты системы по номерам: из SDE (буквы типов по порядку),
    // иначе — по одной ветке на тип, без номера
    function planetsOf(data, i, system) {
        const letters = data ? (data.s[i][4] || '') : '';
        return letters
            ? [...letters].map((code, k) => ({ type: PLANET_TYPE_CODES[code] || code, num: ROMAN(k + 1) }))
            : typesOf(system).map((type) => ({ type, num: '' }));
    }

    const planetLabel = (pl) => (pl.num ? `${pl.num} ${pl.type}` : pl.type);
    const LABEL_CHAR = 5.2;      // ширина символа подписи планеты (кегль 8.5px), примерно
    const branchRadius = (n) => Math.max(LAYOUT.branch, (n * LAYOUT.branchStep) / (2 * Math.PI));

    // Радиус «облака» системы: ветки, картинка планеты и самая длинная подпись
    // Оценка заранее: раскладываем планеты как при отрисовке (углы — ровно
    // по кругу, настоящий поворот станет известен позже) и берём запас 8%.
    function clusterRadius(planets, pillW, system) {
        if (!planets.length) return pillW / 2 + 6;
        const n = planets.length;
        const angles = Array.from({ length: n }, (_, k) => (2 * Math.PI * k) / n);
        return placePlanets(planets, angles, pillW, [], system).extent * 1.08 + 6;
    }

    /* Колонии справа от планеты, по блоку на персонажа: сверху имя
       персонажа заголовком, под ним значок ресурса и плашка «P0 — P1»
       (для P2–P4 — просто название товара). Нижний блок стоит плашкой
       на уровне центра планеты, остальные выше, чтобы не задевать
       плашку с названием под планетой. */
    const ROW_H = 33;        // высота блока колонии: заголовок + плашка
    const HEAD_DY = 15;      // заголовок выше плашки на столько
    const HEAD_CHAR = 5.6;
    const LINK_GAP = 12;     // отступ блоков под линии, если персонажей несколько   // ширина символа заголовка (жирный 9px), примерно
    // Сырьё P0, из которого на планете этого типа добывают P1
    const p0Of = (product, type) => {
        const res = (PLANET_RESOURCES[type] || []).find((r) => r.P1 === product);
        return res ? res.P0 : '';
    };
    const colonyPilot = (c) => c.pilot || 'без имени';
    function colonyRowText(c, type) {
        if (!c.product) return 'ресурс не выбран';
        const p0 = tierOf(c.product) === 1 ? (c.p0 || p0Of(c.product, type)) : '';
        return p0 ? `${p0} — ${c.product}` : c.product;
    }
    const typeOfKey = (key) => {
        const { system, num } = splitKey(key);
        return realPlanetType(system, num);
    };
    // Сколько места занимают колонии планеты (null, если колоний нет)
    function colonyRowsSize(key) {
        const list = key && typeof colonies !== 'undefined' ? colonyList(key) : [];
        if (!list.length) return null;
        const type = typeOfKey(key);
        const w = Math.max(...list.map((c) => {
            const plate = colonyRowText(c, type).length * LABEL_CHAR + 12;
            const head = colonyPilot(c).length * HEAD_CHAR;
            // имя по центру над плашкой; длинное — не левее значка
            return 19 + Math.max(plate, plate / 2 + head / 2, head - 19);
        }));
        // несколько персонажей — блоки отодвинуты под линии от планеты
        return { n: list.length, w: w + (list.length > 1 ? LINK_GAP : 0) };
    }

    /* Раскладка планет вокруг системы. Каждая планета — картинка, а под
       ней плашка с названием («IV Gas»). Планеты стоят по эллипсу (шире
       по горизонтали, чтобы не прятаться под «таблеткой» системы); если
       картинка с плашкой налезает на соседнюю или на «таблетку», планета
       отъезжает дальше от системы по своей ветке, пока не освободится.
       Возвращает места планет и радиус всей системы с подписями. */
    const PLATE_H = 14;     // высота плашки с названием планеты
    const PLATE_GAP = 3;    // зазор между картинкой и плашкой
    const plateWidth = (text) => text.length * LABEL_CHAR + 12;

    // Пересекает ли отрезок прямоугольник (отсечение Лианга — Барски)
    function segmentHitsBox(sg, b) {
        const dx = sg.x2 - sg.x1;
        const dy = sg.y2 - sg.y1;
        let t0 = 0;
        let t1 = 1;
        const clip = (pp, qq) => {
            if (pp === 0) return qq >= 0;
            const t = qq / pp;
            if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
            else { if (t < t0) return false; if (t < t1) t1 = t; }
            return true;
        };
        return clip(-dx, sg.x1 - b.x1) && clip(dx, b.x2 - sg.x1)
            && clip(-dy, sg.y1 - b.y1) && clip(dy, b.y2 - sg.y1);
    }

    /* Раскладка планет вокруг системы. segs — линии врат рядом с системой
       (в её координатах): планета с плашкой не должна на них ложиться.
       Для каждой планеты пробуем места по очереди: сначала её угол,
       потом чуть повёрнутый (до ±48°), и только если всё занято —
       дальше от системы по ветке. Берём первое место, где картинка
       с плашкой не задевает ни линии, ни соседние планеты, ни «таблетку». */
    const ANGLE_STEPS = [0, 6, -6, 12, -12, 18, -18, 24, -24, 32, -32, 40, -40, 48, -48]
        .map((deg) => (deg * Math.PI) / 180);

    function placePlanets(planets, angles, pillW, segs = [], system = '') {
        const n = planets.length;
        const ry = branchRadius(n);
        const rx = Math.max(ry, pillW / 2 + LAYOUT.planetR + 4);
        const R = LAYOUT.planetR;
        const boxes = [{ x1: -pillW / 2 - 3, y1: -14, x2: pillW / 2 + 3, y2: 14 }];
        const hits = (b) => boxes.some((o) => b.x1 < o.x2 && o.x1 < b.x2 && b.y1 < o.y2 && o.y1 < b.y2)
            || segs.some((sg) => segmentHitsBox(sg, b));
        let extent = 0;

        // Рамка планеты: картинка, плашка снизу и строки колоний справа
        const info = planets.map((pl) => {
            const key = pl.num && system ? `${system} ${pl.num}` : '';
            const w = plateWidth(planetLabel(pl));
            return { key, w, half: Math.max(R, w / 2), rows: colonyRowsSize(key) };
        });
        const boxFor = (k, bx, by) => {
            const { half, rows } = info[k];
            const box = { x1: bx - half - 2, y1: by - R - 2, x2: bx + half + 2, y2: by + R + PLATE_GAP + PLATE_H + 2 };
            if (rows) {
                box.x2 = Math.max(box.x2, bx + R + 4 + rows.w + 2);
                box.y1 = Math.min(box.y1, by - (rows.n - 1) * ROW_H - HEAD_DY - 7);
            }
            return box;
        };
        // countExtent = false — для планет, передвинутых вручную: куда бы их
        // ни унесли, расстояния между системами региона от этого не меняются
        const keep = (b, countExtent = true) => {
            boxes.push(b);
            if (!countExtent) return;
            extent = Math.max(extent, ...[[b.x1, b.y1], [b.x2, b.y1], [b.x1, b.y2], [b.x2, b.y2]]
                .map(([x, y]) => Math.hypot(x, y)));
        };

        /* Все планеты раскладываются автоматически — в свободные места, не
           задевая линии, соседей и «таблетку». Передвинутые вручную планеты
           тоже проходят этот расчёт (занимают своё обычное место), и только
           потом переставляются туда, куда их поставил пользователь. Поэтому
           перетаскивание одной планеты никогда не сдвигает остальные. */
        const spots = new Array(n);
        planets.forEach((pl, j) => {
            const at = (a, d) => {
                const bx = (rx + d) * Math.cos(a);
                const by = (ry + d) * Math.sin(a);
                return { bx, by, a, box: boxFor(j, bx, by) };
            };
            let pick = null;
            for (let d = 0; d <= 200 && !pick; d += 4) {
                for (const off of ANGLE_STEPS) {
                    const c = at(angles[j] + off, d);
                    if (!hits(c.box)) { pick = c; break; }
                }
            }
            if (!pick) pick = at(angles[j], 200);
            keep(pick.box);
            spots[j] = { bx: pick.bx, by: pick.by, w: info[j].w, angle: pick.a };
        });
        // ручные места — поверх автоматических; на расстояния между системами
        // они не влияют
        planets.forEach((pl, j) => {
            const saved = info[j].key && typeof planetPos !== 'undefined' ? planetPos[info[j].key] : null;
            if (!saved) return;
            const [bx, by] = saved;
            spots[j] = { bx, by, w: info[j].w, angle: Math.atan2(by, bx), moved: true };
        });
        return { spots, extent };
    }

    // Запасная раскладка по кругу — для региона без данных о вратах
    function ringLayout(count) {
        const r = Math.max(200, (count * LAYOUT.spacing) / (2 * Math.PI));
        return Array.from({ length: count }, (_, i) => {
            const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
            return { x: r * Math.cos(a), y: r * Math.sin(a) };
        });
    }

    /* Углы веток планет: n веток поровну по кругу, а сам круг повёрнут
       так, чтобы ветки были как можно дальше от линий врат. */
    function branchAngles(n, busy) {
        if (!n) return [];
        const step = (2 * Math.PI) / n;
        let best = 0;
        let bestScore = -1;
        for (let k = 0; k < 72; k++) {
            const start = (k / 72) * step;
            let score = Math.PI;
            for (let i = 0; i < n; i++) {
                const a = start + i * step;
                busy.forEach((b) => {
                    let diff = Math.abs(a - b) % (2 * Math.PI);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    score = Math.min(score, diff);
                });
            }
            if (score > bestScore) { bestScore = score; best = start; }
        }
        return Array.from({ length: n }, (_, i) => best + i * step);
    }

    function drawEmpty() {
        closePlanetMenu();
        svg.innerHTML = '';
        world = null;
        info.textContent = '';
        view.classList.add('is-empty');
    }

    /* opts.keepView — перерисовать, не сбрасывая масштаб и сдвиг (после
       перетаскивания планеты или изменения колоний); opts.keepMenu — не
       закрывать открытое меню планеты. */
    function draw(region, focusSystem, opts = {}) {
        currentRegion = region;
        const data = (typeof MAP_REGIONS !== 'undefined' && MAP_REGIONS[region]) || null;
        const names = data
            ? data.s.map((row) => row[0])
            : (SYSTEMS_BY_REGION[region] || []).slice().sort((a, b) => a.localeCompare(b));
        const secs = data ? data.s.map((row) => row[3]) : null;
        const planetLists = names.map((system, i) => planetsOf(data, i, system));
        const pillWidth = (system) => Math.max(44, system.length * 6.6 + 14) + (secs ? 24 : 0);
        const radii = names.map((system, i) => clusterRadius(planetLists[i], pillWidth(system), system));
        const pts = data ? geoLayout(data, radii) : ringLayout(names.length);

        if (!opts.keepMenu) closePlanetMenu();
        svg.innerHTML = '';
        view.classList.remove('is-empty');
        delete view.dataset.fitted;

        // Клип-путь для круглых картинок планет — один на всю карту
        const defs = el('defs', {}, svg);
        const clip = el('clipPath', { id: 'mm-planet-clip', clipPathUnits: 'objectBoundingBox' }, defs);
        el('circle', { cx: 0.5, cy: 0.5, r: 0.5 }, clip);

        world = el('g', { id: 'mm-world' }, svg);
        const jumpLayer = el('g', { class: 'mm-jumps' }, world);
        const branchLayer = el('g', { class: 'mm-branches' }, world);
        const nodeLayer = el('g', { class: 'mm-nodes' }, world);

        // направления занятых врат у каждой системы — для веток планет
        const busy = names.map(() => []);
        let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
        const grow = (x, y, pad) => {
            minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad);
            minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad);
        };

        // Врата внутри региона
        let jumpCount = 0;
        const segs = [];  // все линии карты — препятствия для планет
        if (data) {
            for (let k = 0; k < data.j.length; k += 2) {
                const a = data.j[k];
                const b = data.j[k + 1];
                el('line', { x1: pts[a].x, y1: pts[a].y, x2: pts[b].x, y2: pts[b].y, class: 'mm-jump' }, jumpLayer);
                segs.push({ x1: pts[a].x, y1: pts[a].y, x2: pts[b].x, y2: pts[b].y });
                busy[a].push(Math.atan2(pts[b].y - pts[a].y, pts[b].x - pts[a].x));
                busy[b].push(Math.atan2(pts[a].y - pts[b].y, pts[a].x - pts[b].x));
                jumpCount++;
            }
        }

        /* Врата в соседние регионы: короткий пунктирный отросток в сторону
           настоящего места соседней системы (не дальше LAYOUT.stub клеток),
           на конце — точка с именем системы и региона. Нажатие на неё
           открывает тот регион и показывает эту систему. В рамку
           «вписать» отростки не входят — карта вписывается по системам
           самого региона. */
        if (data && data.e.length) {
            // отросток выходит за «облако» подписей системы на пару клеток
            const maxLen = (i) => radii[i] + LAYOUT.stub * LAYOUT.cell * 0.6;
            data.e.forEach(([i, extName, extRegion, gx, gy]) => {
                const p = pts[i];
                if (gx === undefined) return;
                const real = gridPoint(gx, gy);
                const dx = real.x - p.x;
                const dy = real.y - p.y;
                const dist = Math.hypot(dx, dy) || 1;
                const len = Math.min(dist, maxLen(i));
                const q = { x: p.x + (dx / dist) * len, y: p.y + (dy / dist) * len };
                busy[i].push(Math.atan2(dy, dx));

                const g = el('g', {
                    class: 'mm-ext', 'data-region': extRegion, 'data-system': extName,
                    tabindex: 0, role: 'button'
                }, nodeLayer);
                el('title', {}, g).textContent = `${extName} — регион ${extRegion}\nНажмите, чтобы перейти в этот регион`;
                el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'mm-jump-ext' }, g);
                segs.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });
                const end = el('g', { transform: `translate(${q.x} ${q.y})` }, g);
                el('circle', { r: 7, class: 'mm-ext-dot' }, end);
                // подпись — с той стороны точки, куда смотрит отросток
                const below = dy >= -Math.abs(dx) * 0.3;
                const t1 = el('text', { 'text-anchor': 'middle', y: below ? 22 : -26, class: 'mm-ext-name' }, end);
                t1.textContent = extName;
                const t2 = el('text', { 'text-anchor': 'middle', y: below ? 34 : -14, class: 'mm-ext-region' }, end);
                t2.textContent = `→ ${extRegion}`;
            });
        }

        const typeCount = {};
        let withPlanets = 0;

        names.forEach((system, i) => {
            const p = pts[i];
            const types = typesOf(system);
            const planets = planetLists[i];
            if (planets.length) withPlanets++;

            const group = el('g', {
                class: 'mm-system',
                'data-types': types.join('|'),
                transform: `translate(${p.x} ${p.y})`
            }, nodeLayer);
            const secLine = secs ? ` (${secText(secs[i])})` : '';
            el('title', {}, group).textContent = `${system}${secLine}\n${planets.length
                ? planets.map((pl) => `${pl.num ? `${pl.num} — ` : ''}${pl.type}`).join('\n')
                : 'нет планет'}`;

            const angles = branchAngles(planets.length, busy[i]);
            // линии рядом с системой — в её координатах
            const reach = radii[i] + 40;
            const near = segs.filter((sg) => {
                const vx = sg.x2 - sg.x1;
                const vy = sg.y2 - sg.y1;
                const len2 = vx * vx + vy * vy || 1;
                const t = Math.max(0, Math.min(1, ((p.x - sg.x1) * vx + (p.y - sg.y1) * vy) / len2));
                return Math.hypot(sg.x1 + t * vx - p.x, sg.y1 + t * vy - p.y) < reach;
            }).map((sg) => ({ x1: sg.x1 - p.x, y1: sg.y1 - p.y, x2: sg.x2 - p.x, y2: sg.y2 - p.y }));
            const { spots } = placePlanets(planets, angles, pillWidth(system), near, system);
            planets.forEach(({ type, num }, j) => {
                typeCount[type] = (typeCount[type] || 0) + 1;
                const { bx, by, w: plateW } = spots[j];
                const color = PLANET_COLORS[type] || '#888';

                el('line', {
                    x1: p.x, y1: p.y, x2: p.x + bx, y2: p.y + by,
                    stroke: color, class: 'mm-branch', 'data-type': type,
                    'data-key': num ? `${system} ${num}` : ''
                }, branchLayer);

                const planetKey = num ? `${system} ${num}` : '';
                const moved = Boolean(spots[j].moved);
                const planet = el('g', {
                    class: 'mm-planet', 'data-type': type,
                    'data-key': planetKey, 'data-moved': moved ? '1' : '',
                    transform: `translate(${bx} ${by})`
                }, group);
                el('title', {}, planet).textContent = `${system}${num ? ` ${num}` : ''} — ${type}`;
                el('circle', { r: LAYOUT.planetR + 1.5, fill: '#0b1220', stroke: color, 'stroke-width': 1.5 }, planet);
                if (PLANET_IMAGES[type]) {
                    el('image', {
                        href: PLANET_IMAGES[type],
                        x: -LAYOUT.planetR, y: -LAYOUT.planetR,
                        width: LAYOUT.planetR * 2, height: LAYOUT.planetR * 2,
                        'clip-path': 'url(#mm-planet-clip)'
                    }, planet);
                } else {
                    el('circle', { r: LAYOUT.planetR, fill: color }, planet);
                    const t = el('text', { class: 'mm-planet-letter', 'text-anchor': 'middle', dy: '0.35em' }, planet);
                    t.textContent = type[0];
                }

                // плашка с названием — под картинкой, в овале как у системы
                const plateY = LAYOUT.planetR + PLATE_GAP;
                el('rect', {
                    class: 'mm-planet-plate', x: -plateW / 2, y: plateY,
                    width: plateW, height: PLATE_H, rx: PLATE_H / 2
                }, planet);
                const label = el('text', {
                    class: 'mm-planet-label', 'text-anchor': 'middle',
                    x: 0, y: plateY + PLATE_H / 2, dy: '0.35em'
                }, planet);
                label.textContent = planetLabel({ type, num });

                if (planetKey) decoratePlanet(planet);
            });


            // узел системы — «таблетка» с именем и безопасностью
            const label = el('text', { class: 'mm-system-name', 'text-anchor': 'middle', dy: '0.35em' }, group);
            label.textContent = system;
            let w = Math.max(44, system.length * 6.6 + 14);
            if (secs) {
                const sec = el('tspan', { class: 'mm-system-sec', fill: secColor(secs[i]), dx: 4 }, label);
                sec.textContent = secText(secs[i]);
                w += 24;
            }
            const pill = el('rect', {
                class: 'mm-system-pill', x: -w / 2, y: -11, width: w, height: 22, rx: 11
            });
            // цвет рамки — по безопасности (через style: CSS-класс перебил бы атрибут)
            if (secs) pill.style.stroke = secColor(secs[i]);
            group.insertBefore(pill, label);

            grow(p.x, p.y, radii[i] + 6);
        });

        if (!names.length) grow(0, 0, 200);
        bounds = { minX, minY, maxX, maxY };
        info.textContent = data
            ? `Систем: ${names.length}, планет: ${Object.values(typeCount).reduce((a, b) => a + b, 0)}, врат: ${jumpCount}, выходов в другие регионы: ${data.e.length}`
            : `Систем: ${names.length}, с планетами: ${withPlanets} (данных о вратах для региона нет)`;
        buildLegend(typeCount);
        applyHighlight();
        if (opts.keepView) {
            applyCamera();
            view.dataset.fitted = '1';
        } else if (view.clientWidth) {
            view.dataset.fitted = '1';
            fit();
        }

        // Пришли из соседнего региона — показываем систему, в которую вели врата
        if (focusSystem) {
            const k = names.indexOf(focusSystem);
            if (k >= 0) {
                const node = nodeLayer.querySelectorAll('.mm-system')[k];
                node.classList.add('is-focus');
                camera.k = Math.max(camera.k, 0.9);
                camera.x = (view.clientWidth || 800) / 2 - pts[k].x * camera.k;
                camera.y = (view.clientHeight || 600) / 2 - pts[k].y * camera.k;
                applyCamera();
                view.dataset.fitted = '1';
            }
        }
    }

    // Переход в соседний регион по нажатию на отросток врат
    function goToExt(node) {
        const region = node.dataset.region;
        if (!Array.from(regionSelect.options).some((o) => o.value === region)) return;
        regionSelect.value = region;
        store.set(MM_REGION_KEY, region);
        activeType = '';
        draw(region, node.dataset.system);
    }

    /* ---- Колонии на планетах ----
       Нажатие на планету открывает меню: имя персонажа и что на ней
       добывается или производится. Ресурс выбирается кнопками P1–P4,
       под кнопкой — список с картинками:
         P1 — только то, что добывается из сырья (P0) этой планеты;
         P2, P3 — полные списки: завод можно поставить на любой планете,
              сырьё привозное. Значок ★ — товар собирается целиком из
              сырья этой планеты, без привоза;
         P4 — полный список, но только на Barren и Temperate: High-Tech
              Production Plant ставится лишь на них.
       Рецепты — PI_RECIPES (js/chains.js), уровень — по числу на выходе.
       На одной планете может работать несколько персонажей — у каждого
       своя колония и свой ресурс; один персонаж на планете — одна
       колония (как в игре), поэтому повторное имя обновляет его запись.
       Сохраняется в браузере (MM_COLONIES_KEY): по имени планеты вида
       «Jita IV» — список { pilot, product }. Планета с колониями на карте —
       с оранжевой обводкой и значками ресурсов. */
    const MM_COLONIES_KEY = 'evepi.mindmap.colonies';
    const TIER_BY_QTY = { 20: 1, 5: 2, 3: 3, 1: 4 };
    // High-Tech Production Plant (P4) ставится только на эти типы планет
    const P4_PLANETS = new Set(['Barren', 'Temperate']);
    let colonies = {};
    try { colonies = JSON.parse(localStorage.getItem(MM_COLONIES_KEY) || '{}') || {}; } catch (e) { colonies = {}; }
    // Раньше на планете хранилась одна колония (объект) — переводим в список
    Object.keys(colonies).forEach((key) => {
        const v = colonies[key];
        if (!Array.isArray(v)) colonies[key] = v ? [v] : [];
        if (!colonies[key].length) delete colonies[key];
    });
    /* ---- Связь с карточками на вкладке «Планеты» ----
       У персонажа с карточкой его колонии хранятся в самой карточке:
       система карточки + 6 строк «тип планеты / номер / ресурс». Карта
       показывает их оттуда и пишет туда же. Строка карточки считается
       колонией, только если её тип совпадает с настоящим типом планеты
       с этим номером в системе карточки (строки по умолчанию — нет).
       Колонии персонажей без карточки, а также то, что в карточку не
       помещается (другая система, P3/P4 в карточке P1, все 6 строк
       заняты), живут здесь, в colonies (только на карте).
       Изменения в карточках приходят событием «evepi:accounts». */
    let sysIndex = null;  // имя системы → { region, letters }
    function systemInfo(name) {
        if (!sysIndex) {
            sysIndex = new Map();
            Object.entries(typeof MAP_REGIONS !== 'undefined' ? MAP_REGIONS : {}).forEach(([region, d]) => {
                d.s.forEach((row) => sysIndex.set(row[0], { region, letters: row[4] || '' }));
            });
        }
        return sysIndex.get(name) || null;
    }
    const ROMAN_LIST = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
        'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
    // Настоящий тип планеты «система + номер» по данным SDE
    function realPlanetType(system, num) {
        const info = systemInfo(system);
        const k = ROMAN_LIST.indexOf(num);
        if (!info || k < 0 || k >= info.letters.length) return '';
        return PLANET_TYPE_CODES[info.letters[k]] || '';
    }
    const splitKey = (key) => {
        const i = key.lastIndexOf(' ');
        return { system: key.slice(0, i), num: key.slice(i + 1) };
    };

    const readAccounts = () => {
        try { return JSON.parse(localStorage.getItem('evepi.accounts') || '[]') || []; } catch (e) { return []; }
    };

    // Колонии из карточек: ключ планеты → [{ pilot, product, card }]
    let cardCache = null;
    function cardColonies() {
        if (cardCache) return cardCache;
        const byKey = new Map();
        const pilots = new Map();  // имя (строчными) → { ai, ci }
        readAccounts().forEach((acc, ai) => {
            (acc && Array.isArray(acc.cards) ? acc.cards : []).forEach((c, ci) => {
                if (!c || typeof c !== 'object' || !c.name) return;
                const lower = c.name.toLowerCase();
                if (!pilots.has(lower)) pilots.set(lower, { ai, ci });
                if (!c.system) return;
                (c.rows || []).forEach((row, ri) => {
                    if (!row || !row.planet || !row.number) return;
                    if (realPlanetType(c.system, row.number) !== row.planet) return;
                    const key = `${c.system} ${row.number}`;
                    const product = c.level === 'P2' ? ((c.p2s || [])[ri] || '') : (row.p1 || '');
                    if (!byKey.has(key)) byKey.set(key, []);
                    byKey.get(key).push({ pilot: c.name, product, card: { ai, ci, ri } });
                });
            });
        });
        cardCache = { byKey, pilots };
        return cardCache;
    }

    // Все колонии планеты: из карточек и с карты (запись карты того же
    // персонажа на той же планете главнее — в ней может быть P3/P4)
    function colonyList(key) {
        const fromCards = cardColonies().byKey.get(key) || [];
        const own = colonies[key] || [];
        const ownPilots = new Set(own.map((c) => (c.pilot || '').toLowerCase()));
        return fromCards.filter((c) => !ownPilots.has(c.pilot.toLowerCase())).concat(own);
    }

    // Карточки поменялись — карта перерисовывается (не чаще раза за кадр)
    let syncPending = false;
    document.addEventListener('evepi:accounts', () => {
        cardCache = null;
        if (syncPending) return;
        syncPending = true;
        requestAnimationFrame(() => {
            syncPending = false;
            if (currentRegion && world) relayout();
        });
    });

    /* Записать колонию в карточку персонажа. Возвращает { ok } или
       { ok: false, reason } — тогда колония остаётся только на карте. */
    function writeCardColony(pilot, key, product) {
        const ref = cardColonies().pilots.get(pilot.toLowerCase());
        if (!ref) return { ok: false, reason: '' };
        const accs = readAccounts();
        const card = accs[ref.ai] && accs[ref.ai].cards[ref.ci];
        if (!card) return { ok: false, reason: '' };
        const { system, num } = splitKey(key);
        const info = systemInfo(system);
        const type = realPlanetType(system, num);
        if (!info || !type) return { ok: false, reason: 'нет данных о планете' };
        if (card.system && card.system !== system) {
            return { ok: false, reason: `в карточке ${card.name} выбрана другая система — ${card.system}` };
        }
        const p2Card = card.level === 'P2';
        const tier = product ? tierOf(product) : 0;
        let p0 = '';
        if (product && !p2Card) {
            if (tier !== 1) return { ok: false, reason: `в карточке P1 у ${card.name} можно указать только ресурс P1` };
            const res = (PLANET_RESOURCES[type] || []).find((r) => r.P1 === product);
            if (!res) return { ok: false, reason: `${product} не добывается на ${type}` };
            p0 = res.P0;
        }
        if (product && p2Card) {
            if (tier !== 2) return { ok: false, reason: `в карточке P2 у ${card.name} можно указать только ресурс P2` };
            const r = recipes().get(product);
            const extracted = new Set((PLANET_RESOURCES[type] || []).map((x) => x.P1));
            if (!r || !r.in.some(([name]) => extracted.has(name))) {
                return { ok: false, reason: `в карточке P2 планета ${type} не подходит для ${product}` };
            }
        }
        const rows = Array.isArray(card.rows) ? card.rows : [];
        while (rows.length < 6) rows.push({});
        const confirmed = (row) => card.system && row && row.planet && row.number
            && realPlanetType(card.system, row.number) === row.planet;
        let target = rows.findIndex((row) => confirmed(row) && row.number === num);
        if (target < 0) target = rows.findIndex((row) => !confirmed(row));
        if (target < 0) return { ok: false, reason: `у ${card.name} уже заняты все 6 строк карточки` };

        card.region = info.region;
        card.system = system;
        rows[target] = Object.assign({}, rows[target], { planet: type, number: num });
        if (!p2Card) {
            rows[target].p0 = p0 || rows[target].p0 || '';
            rows[target].p1 = product || '';
        } else {
            card.p2s = Array.isArray(card.p2s) ? card.p2s : [];
            while (card.p2s.length < 6) card.p2s.push('');
            card.p2s[target] = product || '';
        }
        card.rows = rows;
        try { localStorage.setItem('evepi.accounts', JSON.stringify(accs)); } catch (e) { return { ok: false, reason: 'хранилище браузера недоступно' }; }
        if (typeof window.EVEPI_reloadAccounts === 'function') window.EVEPI_reloadAccounts();
        cardCache = null;
        // проверяем, что карточка приняла значения (её списки могли не пустить)
        const back = (cardColonies().byKey.get(key) || []).find((c) => c.pilot.toLowerCase() === pilot.toLowerCase());
        if (!back) return { ok: false, reason: 'карточка не приняла эти значения' };
        return { ok: true };
    }

    // Убрать колонию из карточки: строка становится свободной («—»)
    function clearCardColony(ref) {
        const accs = readAccounts();
        const card = accs[ref.ai] && accs[ref.ai].cards[ref.ci];
        if (!card || !Array.isArray(card.rows) || !card.rows[ref.ri]) return;
        card.rows[ref.ri] = Object.assign({}, card.rows[ref.ri], { planet: '', p0: '', p1: '' });
        if (card.level === 'P2' && Array.isArray(card.p2s)) card.p2s[ref.ri] = '';
        try { localStorage.setItem('evepi.accounts', JSON.stringify(accs)); } catch (e) { return; }
        if (typeof window.EVEPI_reloadAccounts === 'function') window.EVEPI_reloadAccounts();
        cardCache = null;
    }

    // Записи «только на карте»
    function setMapColony(key, entry) {
        const list = (colonies[key] || []).filter((c) => (c.pilot || '').toLowerCase() !== (entry.pilot || '').toLowerCase());
        list.push(entry);
        colonies[key] = list;
        saveColonies();
    }
    function removeMapColony(key, pilot) {
        const list = (colonies[key] || []).filter((c) => (c.pilot || '').toLowerCase() !== (pilot || '').toLowerCase());
        if (list.length) colonies[key] = list;
        else delete colonies[key];
        saveColonies();
    }
    function removeColony(key, c) {
        if (c.card) clearCardColony(c.card);
        else removeMapColony(key, c.pilot);
    }

    // Места планет, которые пользователь передвинул сам: «Jita IV» → [x, y]
    // относительно центра системы
    const MM_POS_KEY = 'evepi.mindmap.planetpos';
    let planetPos = {};
    try { planetPos = JSON.parse(localStorage.getItem(MM_POS_KEY) || '{}') || {}; } catch (e) { planetPos = {}; }
    const savePlanetPos = () => {
        try { localStorage.setItem(MM_POS_KEY, JSON.stringify(planetPos)); } catch (e) { /* приватный режим */ }
    };

    /* Перерисовка текущего региона без сброса масштаба. Открытое меню
       планеты остаётся открытым и привязывается к той же планете на
       новой карте. */
    function relayout(anchorKey) {
        if (!currentRegion) return;
        const key = popPlanet ? popPlanet.dataset.key : '';
        // система, с которой работаем, должна остаться на том же месте экрана:
        // шаг сетки мог поменяться, и без поправки карта «уехала» бы
        const anchor = anchorKey || key;
        const sysOf = (k) => {
            const pl = k ? svg.querySelector(`.mm-planet[data-key="${k.replace(/"/g, '\\"')}"]`) : null;
            return pl ? pl.closest('.mm-system').transform.baseVal.consolidate().matrix : null;
        };
        const before = sysOf(anchor);
        const screen = before ? { x: camera.x + before.e * camera.k, y: camera.y + before.f * camera.k } : null;
        draw(currentRegion, null, { keepView: true, keepMenu: Boolean(key) });
        const after = sysOf(anchor);
        if (screen && after) {
            camera.x = screen.x - after.e * camera.k;
            camera.y = screen.y - after.f * camera.k;
            applyCamera();
        }
        if (key) {
            popPlanet = svg.querySelector(`.mm-planet[data-key="${key.replace(/"/g, '\\"')}"]`);
            if (!popPlanet) closePlanetMenu();
        }
    }
    const saveColonies = () => {
        try { localStorage.setItem(MM_COLONIES_KEY, JSON.stringify(colonies)); } catch (e) { /* приватный режим */ }
    };

    let recipeByOut = null;
    const recipes = () => {
        if (!recipeByOut) {
            recipeByOut = new Map((typeof PI_RECIPES !== 'undefined' ? PI_RECIPES : []).map((r) => [r.out, r]));
        }
        return recipeByOut;
    };
    const tierOf = (item) => {
        const r = recipes().get(item);
        return r ? TIER_BY_QTY[r.outQty] || 0 : 0;
    };

    /* Списки для меню планеты этого типа:
         lists[1..4] — что показывать под кнопками P1–P4;
         local       — товары, которые собираются целиком из сырья планеты. */
    const productCache = new Map();
    function productsFor(planetType) {
        if (productCache.has(planetType)) return productCache.get(planetType);
        const p1s = new Set((PLANET_RESOURCES[planetType] || []).map((r) => r.P1).filter(Boolean));
        const memo = new Map();
        const can = (item) => {
            if (memo.has(item)) return memo.get(item);
            const r = recipes().get(item);
            let ok = false;
            if (r) ok = tierOf(item) === 1 ? p1s.has(item) : r.in.every(([name]) => can(name));
            memo.set(item, ok);
            return ok;
        };
        const lists = { 1: [], 2: [], 3: [], 4: [] };
        const local = new Set();
        recipes().forEach((r, out) => {
            const t = tierOf(out);
            if (!t) return;
            if (can(out)) local.add(out);
            if (t === 1 && !p1s.has(out)) return;               // P1 — только своё
            if (t === 4 && !P4_PLANETS.has(planetType)) return; // P4 — только Barren/Temperate
            lists[t].push(out);
        });
        Object.values(lists).forEach((list) => list.sort());
        const result = { lists, local };
        productCache.set(planetType, result);
        return result;
    }

    // Имена персонажей для подсказки: из карточек «Выбор планеты» и уже введённые
    function knownPilots() {
        const names = new Set();
        try {
            (JSON.parse(localStorage.getItem('evepi.accounts') || '[]') || []).forEach((acc) => {
                (acc.cards || []).forEach((c) => { if (c && c.name) names.add(c.name); });
            });
        } catch (e) { /* нет данных — не страшно */ }
        Object.values(colonies).forEach((list) => list.forEach((c) => { if (c.pilot) names.add(c.pilot); }));
        cardColonies().byKey.forEach((list) => list.forEach((c) => names.add(c.pilot)));
        return [...names].sort((a, b) => a.localeCompare(b));
    }

    // Обводка и значки ресурсов у планеты с колониями
    function decoratePlanet(planet) {
        planet.querySelectorAll('.mm-colony-badge').forEach((n) => n.remove());
        const list = colonyList(planet.dataset.key);
        const has = list.length > 0;
        planet.classList.toggle('is-colony', has);
        // ветку к планете помечаем так же — фильтр «только с персонажами»
        // прячет ветки вместе с планетами
        const branch = svg.querySelector(`.mm-branch[data-key="${planet.dataset.key.replace(/"/g, '\\"')}"]`);
        if (branch) branch.classList.toggle('is-colony', has);
        const title = planet.querySelector('title');
        const base = title.textContent.split('\n')[0];
        title.textContent = has
            ? `${base}\n${list.map((c) => `${colonyPilot(c)}: ${colonyRowText(c, planet.dataset.type)}`).join('\n')}`
            : `${base}\nНажмите, чтобы назначить персонажа и ресурс`;
        /* строки колоний — справа от картинки: значок ресурса и плашка
           «ресурс — персонаж» в стиле названия планеты; нижняя строка — на
           уровне центра планеты, остальные выше, чтобы не задеть плашку
           с названием под планетой */
        const R = LAYOUT.planetR;
        const multi = list.length > 1;
        const x0 = R + 4 + (multi ? LINK_GAP : 0);
        /* несколько персонажей — от края планеты к значку каждого ресурса
           идёт линия; рисуем их первыми, чтобы значки легли поверх */
        if (multi) {
            list.forEach((c, k) => {
                const y = -(list.length - 1 - k) * ROW_H;
                // в центр значка ресурса (значок кладётся поверх конца линии)
                const cx = x0 + 8;
                const a = Math.atan2(y, cx);
                el('line', {
                    class: 'mm-colony-badge mm-colony-link',
                    x1: R * Math.cos(a), y1: R * Math.sin(a), x2: cx, y2: y
                }, planet);
            });
        }
        list.forEach((c, k) => {
            const y = -(list.length - 1 - k) * ROW_H;
            const g = el('g', { class: 'mm-colony-badge', transform: `translate(${x0 + 8} ${y})` }, planet);
            el('circle', { r: 8 }, g);
            const src = c.product && typeof RESOURCE_ICONS !== 'undefined' ? RESOURCE_ICONS[c.product] : '';
            if (src) el('image', { href: src, x: -7, y: -7, width: 14, height: 14 }, g);
            else {
                const t = el('text', { class: 'mm-colony-tier', 'text-anchor': 'middle', dy: '0.35em' }, g);
                t.textContent = c.product ? `P${tierOf(c.product)}` : '?';
            }
            const text = colonyRowText(c, planet.dataset.type);
            const w = text.length * LABEL_CHAR + 12;
            // имя персонажа — по центру над плашкой (длинное не заходит на планету)
            const pilot = colonyPilot(c);
            const hx = Math.max(11 + w / 2, -8 + (pilot.length * HEAD_CHAR) / 2);
            const head = el('text', { class: 'mm-colony-pilot', x: hx, y: -HEAD_DY, 'text-anchor': 'middle', dy: '0.35em' }, g);
            head.textContent = pilot;
            el('rect', {
                class: 'mm-planet-plate mm-colony-plate', x: 11, y: -PLATE_H / 2,
                width: w, height: PLATE_H, rx: PLATE_H / 2
            }, g);
            const t = el('text', { class: 'mm-planet-label mm-colony-label', x: 11 + w / 2, 'text-anchor': 'middle', dy: '0.35em' }, g);
            t.textContent = text;
        });
    }

    // Само меню — один блок поверх карты, переставляется к нажатой планете
    const pop = document.createElement('div');
    pop.className = 'mm-pop';
    pop.hidden = true;
    pop.innerHTML = `
        <div class="mm-pop-head">
            <b class="mm-pop-title"></b>
            <button type="button" class="mm-pop-close" aria-label="Закрыть">×</button>
        </div>
        <div class="mm-pop-colonies"></div>
        <div class="mm-pop-formhead">
            <span class="mm-pop-formtitle">Добавить персонажа</span>
            <button type="button" class="mm-pop-cancel" hidden>отменить изменение</button>
        </div>
        <label class="mm-pop-label" for="mm-pop-pilot">Персонаж</label>
        <input id="mm-pop-pilot" class="ct-input mm-pop-input" list="mm-pop-pilots"
               maxlength="37" autocomplete="off" placeholder="Имя персонажа">
        <datalist id="mm-pop-pilots"></datalist>
        <span class="mm-pop-label">Что добывается</span>
        <div class="mm-pop-tabs" role="tablist">
            <button type="button" role="tab" data-tier="1">P1</button>
            <button type="button" role="tab" data-tier="2">P2</button>
            <button type="button" role="tab" data-tier="3">P3</button>
            <button type="button" role="tab" data-tier="4">P4</button>
        </div>
        <div class="mm-pop-list" role="listbox" aria-label="Ресурс"></div>
        <p class="mm-pop-note"></p>
        <p class="mm-pop-sync" aria-live="polite"></p>
        <div class="mm-pop-actions">
            <button type="button" class="btn mm-pop-save">Добавить</button>
        </div>
        <button type="button" class="mm-pop-reset" hidden>Вернуть планету на место</button>`;
    view.appendChild(pop);
    const popTitle = pop.querySelector('.mm-pop-title');
    const popPilot = pop.querySelector('#mm-pop-pilot');
    const popPilots = pop.querySelector('#mm-pop-pilots');
    const popTabs = pop.querySelectorAll('.mm-pop-tabs [data-tier]');
    const popList = pop.querySelector('.mm-pop-list');
    let popProduct = '';  // выбранный ресурс
    let popTier = 1;      // открытая кнопка P1–P4
    let popData = null;   // productsFor(тип планеты)
    const popNote = pop.querySelector('.mm-pop-note');
    const popSync = pop.querySelector('.mm-pop-sync');
    const popColonies = pop.querySelector('.mm-pop-colonies');
    const popFormTitle = pop.querySelector('.mm-pop-formtitle');
    const popCancel = pop.querySelector('.mm-pop-cancel');
    const popSave = pop.querySelector('.mm-pop-save');
    const popReset = pop.querySelector('.mm-pop-reset');
    let popPlanet = null;
    let popEdit = -1;     // номер изменяемой колонии в списке, -1 — новая

    function openPlanetMenu(planet, clientX, clientY) {
        popPlanet = planet;
        const key = planet.dataset.key;
        const type = planet.dataset.type;
        popTitle.textContent = `${key} — ${type}`;
        popPilots.innerHTML = knownPilots().map((n) => `<option value="${n.replace(/"/g, '&quot;')}">`).join('');
        popData = productsFor(type);
        popReset.hidden = !planetPos[key];
        popSync.textContent = '';
        renderColonies();
        startForm(-1);

        pop.hidden = false;
        const rect = view.getBoundingClientRect();
        const x = Math.min(clientX - rect.left + 14, rect.width - pop.offsetWidth - 8);
        const y = Math.min(clientY - rect.top + 14, rect.height - pop.offsetHeight - 8);
        pop.style.left = `${Math.max(8, x)}px`;
        pop.style.top = `${Math.max(8, y)}px`;
        popPilot.focus();
    }

    // Форма под списком: новая колония (index = -1) или изменение существующей
    function startForm(index) {
        const list = popPlanet ? colonyList(popPlanet.dataset.key) : [];
        const col = index >= 0 ? list[index] : null;
        popEdit = col ? index : -1;
        popPilot.value = col ? col.pilot || '' : '';
        popProduct = col ? col.product || '' : '';
        popTier = (popProduct && tierOf(popProduct)) || 1;
        popFormTitle.textContent = col ? `Изменить: ${col.pilot || 'без имени'}` : (list.length ? 'Добавить ещё персонажа' : 'Добавить персонажа');
        popCancel.hidden = !col;
        popSave.textContent = col ? 'Сохранить' : 'Добавить';
        renderPopList();
        renderColonies();
    }

    // Список колоний планеты: картинка ресурса, персонаж, ресурс, «изменить», «удалить»
    function renderColonies() {
        const list = popPlanet ? colonyList(popPlanet.dataset.key) : [];
        popColonies.innerHTML = list.length
            ? `<span class="mm-pop-label">На планете (${list.length})</span>` + list.map((c, k) => {
                const src = c.product && typeof RESOURCE_ICONS !== 'undefined' ? RESOURCE_ICONS[c.product] : '';
                return `<div class="mm-pop-colony${k === popEdit ? ' is-editing' : ''}" data-index="${k}">
                        ${src ? `<img src="${src}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="mm-pop-noimg"></span>'}
                        <span class="mm-pop-colony-text"><b>${escHtml(c.pilot || 'без имени')}</b>
                            <small>${escHtml(c.product || 'ресурс не выбран')}${c.product ? ` · P${tierOf(c.product)}` : ''}${c.card ? ' · из карточки' : ''}</small></span>
                        <button type="button" class="mm-pop-colony-edit" title="Изменить" aria-label="Изменить">✎</button>
                        <button type="button" class="mm-pop-colony-del" title="Удалить" aria-label="Удалить">×</button>
                    </div>`;
            }).join('')
            : '';
    }

    function closePlanetMenu() {
        pop.hidden = true;
        popPlanet = null;
        popEdit = -1;
    }

    const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // Для P1 — в скобках сырьё P0 этой планеты с картинкой
    function p0Html(name, type) {
        if (popTier !== 1) return '';
        const p0 = p0Of(name, type);
        if (!p0) return '';
        const src = typeof RESOURCE_ICONS !== 'undefined' ? RESOURCE_ICONS[p0] : '';
        return ` <small class="mm-pop-p0">(${src ? `<img src="${src}" alt="" onerror="this.style.display='none'">` : ''}${escHtml(p0)})</small>`;
    }

    // Список под выбранной кнопкой P1–P4: картинка, название, ★ — из своего сырья
    function renderPopList() {
        const type = popPlanet ? popPlanet.dataset.type : '';
        popTabs.forEach((tab) => {
            const t = Number(tab.dataset.tier);
            tab.setAttribute('aria-selected', String(t === popTier));
            tab.classList.toggle('has-pick', Boolean(popProduct) && tierOf(popProduct) === t);
        });
        const list = popData ? popData.lists[popTier] : [];
        popList.innerHTML = list.length
            ? list.map((name) => {
                const src = typeof RESOURCE_ICONS !== 'undefined' ? RESOURCE_ICONS[name] : '';
                const own = popTier > 1 && popData.local.has(name);
                return `<button type="button" role="option" class="mm-pop-item${name === popProduct ? ' is-picked' : ''}"
                            data-name="${escHtml(name)}" aria-selected="${name === popProduct}"
                            title="${escHtml(name)}${own ? ' — собирается из сырья этой планеты' : ''}">
                            ${src ? `<img src="${src}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="mm-pop-noimg"></span>'}
                            <span>${escHtml(name)}${p0Html(name, type)}</span>${own ? '<i class="mm-pop-own">★</i>' : ''}
                        </button>`;
            }).join('')
            : `<p class="mm-pop-empty">${popTier === 4
                ? 'P4 производят только на Barren и Temperate'
                : (PLANET_RESOURCES[type] || []).length
                    ? 'Нечего выбрать'
                    : 'На планетах этого типа PI не добывается'}</p>`;
        popNote.textContent = popTier === 1
            ? 'P1 — то, что добывается из сырья этой планеты.'
            : popTier === 4
                ? 'P4 — производство из привозного сырья (только Barren и Temperate).'
                : `P${popTier} — завод на любой планете. ★ — собирается целиком из сырья этой планеты.`;
    }

    popTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            popTier = Number(tab.dataset.tier);
            renderPopList();
        });
    });

    popList.addEventListener('click', (event) => {
        const item = event.target.closest('.mm-pop-item');
        if (!item) return;
        // повторное нажатие снимает выбор
        popProduct = popProduct === item.dataset.name ? '' : item.dataset.name;
        renderPopList();
    });

    pop.querySelector('.mm-pop-close').addEventListener('click', closePlanetMenu);
    // Добавить / сохранить колонию. Меню не закрывается — можно сразу
    // добавить следующего персонажа на эту же планету.
    popSave.addEventListener('click', () => {
        if (!popPlanet) return;
        const key = popPlanet.dataset.key;
        const pilot = popPilot.value.trim();
        const product = popProduct;
        if (!pilot && !product) return;
        const list = colonyList(key);
        const old = popEdit >= 0 ? list[popEdit] : null;
        // изменяли запись и сменили имя — старая запись уходит
        if (old && (old.pilot || '').toLowerCase() !== pilot.toLowerCase()) removeColony(key, old);

        let note = '';
        const res = pilot ? writeCardColony(pilot, key, product) : { ok: false, reason: '' };
        if (res.ok) {
            removeMapColony(key, pilot);  // теперь колония — в карточке
            note = `Записано в карточку ${pilot} на вкладке «Планеты».`;
        } else {
            setMapColony(key, { pilot, product });
            if (res.reason) note = `Сохранено только на карте: ${res.reason}.`;
        }
        relayout();
        popPilots.innerHTML = knownPilots().map((n) => `<option value="${n.replace(/"/g, '&quot;')}">`).join('');
        startForm(-1);
        popSync.textContent = note;
        popPilot.focus();
    });

    popCancel.addEventListener('click', () => startForm(-1));

    popReset.addEventListener('click', () => {
        if (!popPlanet) return;
        delete planetPos[popPlanet.dataset.key];
        savePlanetPos();
        popReset.hidden = true;
        relayout();
    });

    popColonies.addEventListener('click', (event) => {
        const row = event.target.closest('.mm-pop-colony');
        if (!row || !popPlanet) return;
        const index = Number(row.dataset.index);
        if (event.target.closest('.mm-pop-colony-edit')) {
            startForm(index);
            popPilot.focus();
            return;
        }
        if (event.target.closest('.mm-pop-colony-del')) {
            const key = popPlanet.dataset.key;
            const c = colonyList(key)[index];
            if (c) removeColony(key, c);
            relayout();
            startForm(-1);
            popSync.textContent = c && c.card ? `Строка в карточке ${c.pilot} освобождена.` : '';
        }
    });

    pop.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePlanetMenu();
        if (event.key === 'Enter' && event.target === popPilot) popSave.click();
    });

    /* ---- Легенда и подсветка ----
       Кнопки типов планет с числом систем, где тип есть. Нажатая
       кнопка подсвечивает такие системы, остальные приглушаются. */
    let activeType = '';

    function buildLegend(typeCount) {
        const order = Object.values(PLANET_TYPE_CODES);
        legend.innerHTML = order
            .filter((type) => typeCount[type])
            .map((type) => {
                const img = PLANET_IMAGES[type]
                    ? `<img src="${PLANET_IMAGES[type]}" alt="">`
                    : `<span class="mm-dot" style="background:${PLANET_COLORS[type]}"></span>`;
                return `<button type="button" class="mm-legend-item${type === activeType ? ' is-active' : ''}"
                            data-type="${type}" style="--mm-color:${PLANET_COLORS[type]}"
                            title="Подсветить планеты ${type}">${img}${type}<b>${typeCount[type]}</b></button>`;
            }).join('');
    }

    function applyHighlight() {
        svg.classList.toggle('has-filter', Boolean(activeType));
        svg.querySelectorAll('.mm-system').forEach((g) => {
            const on = !activeType || g.dataset.types.split('|').includes(activeType);
            g.classList.toggle('is-match', Boolean(activeType) && on);
        });
        svg.querySelectorAll('.mm-branch, .mm-planet').forEach((node) => {
            node.classList.toggle('is-match', node.dataset.type === activeType);
        });
        legend.querySelectorAll('.mm-legend-item').forEach((b) => {
            b.classList.toggle('is-active', b.dataset.type === activeType);
        });
    }

    legend.addEventListener('click', (event) => {
        const button = event.target.closest('.mm-legend-item');
        if (!button) return;
        activeType = activeType === button.dataset.type ? '' : button.dataset.type;
        applyHighlight();
    });

    regionSelect.addEventListener('change', () => {
        const region = regionSelect.value;
        store.set(MM_REGION_KEY, region);
        activeType = '';
        if (region) draw(region);
        else {
            drawEmpty();
            legend.innerHTML = '';
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fillRegions);
    } else {
        fillRegions();
    }
}());
