/* ---- Прыжковая карта (вкладка «Карты» → «Прыжковая карта») ----
   Планировщик прыжков капитальных кораблей по образцу Dotlan Jump
   Planner (evemaps.dotlan.net/jump), в стиле сайта. Данные систем и
   кораблей — js/jumpdata.js (из Static Data Export CCP).

   Правила прыжка, как в игре:
     дальность = база корабля × (1 + 0.2 × Jump Drive Calibration);
     топливо   = расход на св. год × расстояние × (1 − 0.1 × Jump Fuel
                 Conservation) × (1 − 0.1 × Jump Freighter, только у
                 джамп-фрейтеров), округление до целого; световой год —
                 игровой, 9.46e15 м (так считают EVE и Dotlan);
     прыгать можно только в лоу и нули (безопасность < 0.45); нельзя в
     Pochven, в регионы Jove и в J-space (их в данных нет).
   Маршрут — наименьшее число прыжков; при равенстве — меньшее
   расстояние; «Предпочитать системы со станциями» — среди маршрутов с
   тем же числом прыжков берём промежуточные системы со станциями NPC.

   Части экрана (по образцу Dotlan, названия на русском; панели — слева):
     Jump Map — схема маршрута сверху (оси x и z галактики);
     Jump Route — таблица: регион, система, безопасность, владелец (sov),
       убийства и прыжки за час (ESI), между системами — расстояние и
       топливо, кнопка ⇄ — альтернативные промежуточные точки;
     Jump Planner — добавить систему в маршрут;
     Waypoints — точки маршрута (перетаскивание, удаление);
     Jump Options — корабль и навыки (вручную или с персонажа);
     Avoid System/Region — обход систем и регионов, их список;
     Jump Beacon Network — свои маяки (цино-маяки): «только по маякам»;
     Load/Save Route — сохранённые маршруты и ссылка на маршрут.
   Настройки и маршруты хранятся в браузере (localStorage). */
/* Вкладка «Карты»: две кнопки — «Планетарная карта» (майнд-карта
   региона, js/calculator.js) и «Прыжковая карта» (ниже). Выбор
   запоминается в браузере. */
(function mapsViews() {
    const KEY = 'evepi.maps.view';
    const views = { planet: document.getElementById('map-planet'), jump: document.getElementById('map-jump') };
    const btns = Array.from(document.querySelectorAll('[data-role="maps-view"]'));
    if (!views.planet || !views.jump || !btns.length) return;
    const show = (v, openTab) => {
        if (!views[v]) v = 'planet';
        Object.entries(views).forEach(([k, el]) => { el.hidden = k !== v; });
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
        try { localStorage.setItem(KEY, v); } catch (e) { /* без памяти */ }
        if (openTab) {
            const nav = document.querySelector('nav button[data-tab="calculator"]');
            if (nav) nav.click();
        }
    };
    window.showMapsView = show;
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
    let saved = 'planet';
    try { saved = localStorage.getItem(KEY) || 'planet'; } catch (e) { /* без памяти */ }
    show(saved);
}());

(function jumpMap() {
    if (typeof JUMP_SYSTEMS === 'undefined') return;
    const root = document.getElementById('map-jump');
    if (!root) return;

    const LS_KEY = 'evepi.jump.state';
    const ROUTES_KEY = 'evepi.jump.routes';
    const NO_JUMP_REGIONS = new Set(['Pochven', 'A821-A', 'J7HZ-F', 'UUA-F4']);
    const EXTRA_SCOPES = 'esi-skills.read_skills.v1 esi-location.read_location.v1 esi-location.read_ship_type.v1';
    const SKILL_IDS = { jdc: 21611, jfc: 21610, jf: 29029 };

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (n, d = 0) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
    const ls = {
        get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* без памяти */ } }
    };

    // Системы: индекс по имени (без регистра) и по id
    const SYS = JUMP_SYSTEMS.map(([id, name, r, sec, x, y, z, st]) => ({
        id, name, region: JUMP_REGIONS[r], sec, x, y, z, station: !!st
    }));
    const byName = new Map(SYS.map((s) => [s.name.toLowerCase(), s]));
    const byId = new Map(SYS.map((s) => [s.id, s]));
    const regionSet = new Set(JUMP_REGIONS);
    const SHIPS = JUMP_SHIPS.map(([name, group, range, fuel, ftype, jf]) => ({ name, group, range, fuel, ftype, jf: !!jf }));
    const shipOf = (n) => SHIPS.find((s) => s.name === n) || SHIPS.find((s) => s.name === 'Nomad');

    const highsec = (s) => s.sec >= 0.45;
    const canEnter = (s) => !highsec(s) && !NO_JUMP_REGIONS.has(s.region);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const secClass = (sec) => (sec >= 0.45 ? 'hi' : sec > 0 ? 'low' : 'null');
    const secText = (sec) => (Math.round(sec * 10) / 10).toFixed(1);
    const secBadge = (s) => `<span class="ct-tier jm-sec jm-sec-${secClass(s.sec)}">${secText(s.sec)}</span>`;

    // Состояние планировщика
    const saved = ls.get(LS_KEY, {});
    const st = {
        ship: shipOf(saved.ship || 'Nomad').name,
        jdc: Number.isInteger(saved.jdc) ? saved.jdc : 5,
        jfc: Number.isInteger(saved.jfc) ? saved.jfc : 4,
        jf: Number.isInteger(saved.jf) ? saved.jf : 4,
        preferStations: !!saved.preferStations,
        avoidIncursions: !!saved.avoidIncursions,
        beaconsOnly: !!saved.beaconsOnly,
        waypoints: Array.isArray(saved.waypoints) ? saved.waypoints.filter((n) => byName.has(n.toLowerCase())) : [],
        avoidSystems: Array.isArray(saved.avoidSystems) ? saved.avoidSystems : [],
        avoidRegions: Array.isArray(saved.avoidRegions) ? saved.avoidRegions : [],
        beacons: Array.isArray(saved.beacons) ? saved.beacons : [],
        char: saved.char || '',
        avoidRegion: saved.avoidRegion || ''
    };
    const persist = () => ls.set(LS_KEY, st);

    // Ссылка вида #jump/Nomad,544/EX-GBT:KZ9T-C — как у Dotlan
    function fromHash() {
        const m = /^#jump\/([^/]+)\/(.+)$/.exec(decodeURIComponent(location.hash || ''));
        if (!m) return false;
        const [ship, skills] = m[1].split(',');
        const sh = SHIPS.find((s) => s.name.toLowerCase() === ship.toLowerCase());
        if (sh) st.ship = sh.name;
        if (/^\d{3}$/.test(skills || '')) [st.jdc, st.jfc, st.jf] = skills.split('').map(Number);
        const wps = m[2].split(':').map((n) => byName.get(n.toLowerCase())).filter(Boolean).map((s) => s.name);
        if (wps.length) st.waypoints = wps;
        return true;
    }
    const routeLink = () => `${location.origin}${location.pathname}#jump/${encodeURIComponent(st.ship)},${st.jdc}${st.jfc}${st.jf}/${st.waypoints.map(encodeURIComponent).join(':')}`;

    const rangeLy = () => shipOf(st.ship).range * (1 + 0.2 * st.jdc);
    const fuelFor = (ly) => {
        const sh = shipOf(st.ship);
        return Math.round(sh.fuel * ly * (1 - 0.1 * st.jfc) * (sh.jf ? 1 - 0.1 * st.jf : 1));
    };

    // Вторжения (ESI, без входа) — по запросу «Avoid Incursions»
    let incursions = null;
    async function loadIncursions() {
        if (incursions) return incursions;
        try {
            const list = await fetch('https://esi.evetech.net/latest/incursions/?datasource=tranquility').then((r) => r.json());
            incursions = new Set(list.flatMap((x) => x.infested_solar_systems || []));
        } catch (e) {
            incursions = new Set();
        }
        return incursions;
    }

    /* Поиск маршрута между двумя системами: Дейкстра по системам, куда
       можно прыгнуть; сосед — любая система в пределах дальности.
       Цена: прыжки × 1e6 + (без станции, если «предпочитать станции»)
       × 1e3 + световые годы — то есть сначала меньше прыжков. */
    function findPath(from, to, opts) {
        const R = opts.range;
        const allowed = SYS.filter((s) => s === to || (canEnter(s) && !opts.blocked(s)));
        const cell = (v) => Math.floor(v / R);
        const grid = new Map();
        allowed.forEach((s) => {
            const k = `${cell(s.x)},${cell(s.y)},${cell(s.z)}`;
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(s);
        });
        const near = (s) => {
            const out = [];
            const cx = cell(s.x);
            const cy = cell(s.y);
            const cz = cell(s.z);
            for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) for (let c = -1; c <= 1; c += 1) {
                (grid.get(`${cx + a},${cy + b},${cz + c}`) || []).forEach((t) => {
                    if (t !== s && dist(s, t) <= R) out.push(t);
                });
            }
            return out;
        };
        const cost = new Map([[from, 0]]);
        const prev = new Map();
        const done = new Set();
        // простая очередь с приоритетом на массиве — узлов немного
        const heap = [[0, from]];
        const push = (c, s) => {
            heap.push([c, s]);
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p][0] <= heap[i][0]) break;
                [heap[p], heap[i]] = [heap[i], heap[p]];
                i = p;
            }
        };
        const pop = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length) {
                heap[0] = last;
                let i = 0;
                for (;;) {
                    const l = 2 * i + 1;
                    const r = l + 1;
                    let m = i;
                    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                    if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                    if (m === i) break;
                    [heap[m], heap[i]] = [heap[i], heap[m]];
                    i = m;
                }
            }
            return top;
        };
        while (heap.length) {
            const [c, s] = pop();
            if (done.has(s)) continue;
            done.add(s);
            if (s === to) break;
            near(s).forEach((t) => {
                if (t !== to && opts.beaconsOnly && !opts.beacon(t)) return;
                const penalty = t !== to && opts.preferStations && !t.station ? 1e3 : 0;
                const nc = c + 1e6 + penalty + dist(s, t);
                if (nc < (cost.has(t) ? cost.get(t) : Infinity)) {
                    cost.set(t, nc);
                    prev.set(t, s);
                    push(nc, t);
                }
            });
        }
        if (!done.has(to)) return null;
        const path = [to];
        while (path[0] !== from) path.unshift(prev.get(path[0]));
        return path;
    }

    async function buildRoute() {
        const wps = st.waypoints.map((n) => byName.get(n.toLowerCase())).filter(Boolean);
        if (wps.length < 2) return { error: wps.length ? 'Добавьте ещё одну систему — куда прыгать' : '' , wps };
        const range = rangeLy();
        const avoidS = new Set(st.avoidSystems.map((n) => n.toLowerCase()));
        const avoidR = new Set(st.avoidRegions);
        const inc = st.avoidIncursions ? await loadIncursions() : new Set();
        const beacons = new Set(st.beacons.map((n) => n.toLowerCase()));
        const opts = {
            range,
            preferStations: st.preferStations,
            beaconsOnly: st.beaconsOnly && beacons.size > 0,
            beacon: (s) => beacons.has(s.name.toLowerCase()),
            blocked: (s) => avoidS.has(s.name.toLowerCase()) || avoidR.has(s.region) || inc.has(s.id)
        };
        const path = [wps[0]];
        const isWp = new Set([wps[0]]);
        for (let i = 1; i < wps.length; i += 1) {
            const to = wps[i];
            if (!canEnter(to)) {
                return { error: `В ${to.name} прыгнуть нельзя: ${highsec(to) ? 'хайсек' : to.region}`, wps };
            }
            const seg = findPath(wps[i - 1], to, opts);
            if (!seg) return { error: `Нет маршрута ${wps[i - 1].name} → ${to.name} при дальности ${fmt(range, 2)} св. лет`, wps };
            path.push(...seg.slice(1));
            isWp.add(to);
        }
        return { path, isWp, range, wps, startHigh: highsec(wps[0]) };
    }

    // Владельцы (sov), убийства и прыжки за час — ESI без входа, один раз
    let live = null;
    async function loadLive() {
        if (live) return live;
        live = { sov: new Map(), kills: new Map(), jumps: new Map(), names: new Map() };
        const get = (p) => fetch(`https://esi.evetech.net/latest${p}?datasource=tranquility`).then((r) => (r.ok ? r.json() : []));
        try {
            const [sov, kills, jumps] = await Promise.all([get('/sovereignty/map/'), get('/universe/system_kills/'), get('/universe/system_jumps/')]);
            sov.forEach((x) => { if (x.alliance_id || x.faction_id) live.sov.set(x.system_id, x.alliance_id || x.faction_id); });
            kills.forEach((x) => live.kills.set(x.system_id, (x.ship_kills || 0) + (x.pod_kills || 0)));
            jumps.forEach((x) => live.jumps.set(x.system_id, x.ship_jumps || 0));
        } catch (e) {
            // без живых данных — столбцы останутся пустыми
        }
        return live;
    }
    async function holderNames(ids) {
        const need = ids.filter((id) => id && !live.names.has(id));
        if (!need.length) return;
        try {
            const list = await fetch('https://esi.evetech.net/latest/universe/names/?datasource=tranquility', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(need)
            }).then((r) => r.json());
            list.forEach((x) => live.names.set(x.id, x.name));
        } catch (e) {
            // без названий
        }
    }

    // ---- Разметка ----
    const shipOptions = () => Array.from(new Set(SHIPS.map((s) => s.group))).map((g) => `<optgroup label="${esc(g)}">${SHIPS.filter((s) => s.group === g)
        .map((s) => `<option${s.name === st.ship ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`).join('');
    /* Регион → система, как на вкладке «Планеты»: сначала регион, затем
       только его системы (зависимый список). Регионы — где есть системы
       k-space; у систем — безопасность, хайсек и закрытые регионы помечены. */
    const REGIONS = Array.from(new Set(SYS.map((s) => s.region))).sort((a, b) => a.localeCompare(b));
    const regionOptions = (sel, first) => `<option value="">${first}</option>`
        + REGIONS.map((r) => `<option value="${esc(r)}"${r === sel ? ' selected' : ''}>${esc(r)}${NO_JUMP_REGIONS.has(r) ? ' — прыжки нельзя' : ''}</option>`).join('');
    const systemOptions = (region, first) => `<option value="">${first}</option>`
        + SYS.filter((s) => s.region === region).sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => `<option value="${esc(s.name)}">${esc(s.name)} · ${secText(s.sec)}${highsec(s) ? ' (хайсек)' : ''}</option>`).join('');
    const lvlOptions = (v) => [0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}"${n === v ? ' selected' : ''}>${n}</option>`).join('');
    root.innerHTML = `
        <!-- планировщик: только системы, куда можно прыгнуть (лоу, нули; без хайсека и закрытых регионов) -->
        <datalist id="jm-jumpable">${SYS.filter(canEnter).sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<option value="${esc(s.name)}">${esc(s.region)} · ${secText(s.sec)}</option>`).join('')}</datalist>
        <datalist id="jm-systems">${SYS.map((s) => `<option value="${esc(s.name)}">${esc(s.region)} · ${secText(s.sec)}</option>`).join('')}</datalist>
        <datalist id="jm-avoid-list">${JUMP_REGIONS.map((r) => `<option value="${esc(r)}">регион</option>`).join('')}${SYS.map((s) => `<option value="${esc(s.name)}">${esc(s.region)}</option>`).join('')}</datalist>
        <!-- Раскладка: слева панели в два столбца (планировщик — точки,
             параметры — обход и маяки, загрузка — маршрут), справа карта -->
        <div class="jm-layout">
            <div class="jm-grid">
                <div class="jm-cell">
                <section class="jm-panel">
                    <h3 class="jm-h">Планировщик</h3>
                    <label class="jm-field"><span>Система</span><input class="ct-input" data-role="jm-add" list="jm-jumpable"
                        placeholder="Начните вводить систему" autocomplete="off" spellcheck="false"></label>
                    <div class="jm-row"><button type="button" class="btn card-add jm-btn" data-role="jm-add-btn">Добавить в маршрут</button></div>
                    <p class="jm-msg" data-role="jm-add-msg"></p>
                </section>
                </div>
                <div class="jm-cell">
                <section class="jm-panel">
                    <h3 class="jm-h">Точки маршрута</h3>
                    <ol class="jm-wps" data-role="jm-wps"></ol>
                    <p class="jm-hint">Перетащите, чтобы поменять порядок</p>
                </section>
                </div>
                <div class="jm-cell">
                <section class="jm-panel">
                    <h3 class="jm-h">Параметры прыжка</h3>
                    <label class="jm-field"><span>Персонаж</span><select class="ct-input" data-role="jm-char"></select></label>
                    <p class="jm-msg" data-role="jm-char-msg"></p>
                    <label class="jm-field"><span>Корабль</span><select class="ct-input" data-role="jm-ship">${shipOptions()}</select></label>
                    <!-- навыки не выбираются — только подгружаются с персонажа -->
                    <div class="jm-field"><span>Jump Drive Calibration</span><output class="jm-lvl-out" data-role="jm-jdc">${st.jdc}</output></div>
                    <div class="jm-field"><span>Jump Fuel Conservation</span><output class="jm-lvl-out" data-role="jm-jfc">${st.jfc}</output></div>
                    <div class="jm-field"><span>Jump Freighter</span><output class="jm-lvl-out" data-role="jm-jf">${st.jf}</output></div>
                    <label class="jm-check"><input type="checkbox" data-role="jm-stations"${st.preferStations ? ' checked' : ''}> Предпочитать системы со станциями</label>
                    <label class="jm-check"><input type="checkbox" data-role="jm-incursions"${st.avoidIncursions ? ' checked' : ''}> Обходить вторжения</label>
                    <div class="jm-row"><button type="button" class="btn card-add jm-btn" data-role="jm-char-load" title="Текущая система персонажа — в начало маршрута, его корабль — в «Корабль»">Система и корабль персонажа</button></div>
                </section>
                </div>
                <div class="jm-cell">
                <section class="jm-panel">
                    <h3 class="jm-h">Обход систем и регионов</h3>
                    <label class="jm-field"><span>Система или регион</span><input class="ct-input" data-role="jm-avoid" list="jm-avoid-list"
                        placeholder="Начните вводить" autocomplete="off" spellcheck="false"></label>
                    <div class="jm-row"><button type="button" class="btn card-add jm-btn" data-role="jm-avoid-btn">Обходить</button></div>
                    <p class="jm-msg" data-role="jm-avoid-msg"></p>
                    <h4 class="jm-h4">Список обхода</h4>
                    <ul class="jm-tags" data-role="jm-avoid-tags"></ul>
                </section>
                </div>
                <div class="jm-cell">
                <section class="jm-panel">
                    <h3 class="jm-h">Загрузка и сохранение маршрута</h3>
                    <div class="jm-row"><input class="ct-input" data-role="jm-route-name" placeholder="Название маршрута">
                        <button type="button" class="btn card-add jm-btn" data-role="jm-save">Сохранить</button></div>
                    <div class="jm-row"><select class="ct-input" data-role="jm-routes"></select>
                        <button type="button" class="btn card-add jm-btn" data-role="jm-load">Загрузить</button>
                        <button type="button" class="btn card-add jm-btn jm-btn-x" data-role="jm-del" title="Удалить сохранённый маршрут">×</button></div>
                    <div class="jm-row"><input class="ct-input" data-role="jm-link" readonly>
                        <button type="button" class="btn card-add jm-btn" data-role="jm-copy">Ссылка</button></div>
                    <p class="jm-msg" data-role="jm-save-msg"></p>
                </section>
                </div>
                <div class="jm-cell">
                <section class="jm-panel">
                    <h3 class="jm-h">Сеть маяков</h3>
                    <div class="jm-row"><input class="ct-input" data-role="jm-beacon" list="jm-systems" placeholder="Система с маяком" autocomplete="off">
                        <button type="button" class="btn card-add jm-btn" data-role="jm-beacon-btn">Добавить</button></div>
                    <label class="jm-check"><input type="checkbox" data-role="jm-beacons-only"${st.beaconsOnly ? ' checked' : ''}> Прыгать только по маякам</label>
                    <ul class="jm-tags" data-role="jm-beacon-tags"></ul>
                </section>
                </div>
                <div class="jm-cell jm-cell-wide">
                <section class="jm-panel">
                    <h3 class="jm-h">Маршрут прыжков <span class="jm-sub" data-role="jm-route-title"></span></h3>
                    <div data-role="jm-route"></div>
                </section>
                </div>
            </div>
            <div class="jm-main">
                <section class="jm-panel jm-map-panel">
                    <h3 class="jm-h">Карта прыжков <span class="jm-sub" data-role="jm-map-title"></span></h3>
                    <div class="jm-map" data-role="jm-map"><p class="evt-dim">Добавьте две системы — здесь появится схема маршрута</p></div>
                </section>
            </div>
        </div>`;
    const $ = (role) => root.querySelector(`[data-role="${role}"]`);

    // навыки — только показываем (берутся с персонажа)
    function showSkills() {
        $('jm-jdc').textContent = st.jdc;
        $('jm-jfc').textContent = st.jfc;
        $('jm-jf').textContent = st.jf;
    }
    // ---- Отрисовка частей ----
    function renderWaypoints() {
        $('jm-wps').innerHTML = st.waypoints.map((n, i) => {
            const s = byName.get(n.toLowerCase());
            return `<li class="jm-wp" draggable="true" data-i="${i}">${s ? secBadge(s) : ''}<span class="jm-wp-name">${esc(n)}</span>
                <span class="jm-wp-reg">${s ? esc(s.region) : ''}</span>
                <button type="button" class="jm-x" data-role="jm-wp-del" data-i="${i}" title="Убрать из маршрута" aria-label="Убрать ${esc(n)}">×</button></li>`;
        }).join('') || '<li class="jm-empty">Пока пусто — добавьте систему в «Планировщике»</li>';
    }
    function renderTags() {
        const tag = (kind, v) => `<li class="jm-tag"><span class="jm-tag-kind">${kind === 'r' ? 'регион' : 'система'}</span>${esc(v)}
            <button type="button" class="jm-x" data-role="jm-avoid-del" data-kind="${kind}" data-v="${esc(v)}" aria-label="Не обходить ${esc(v)}">×</button></li>`;
        $('jm-avoid-tags').innerHTML = st.avoidRegions.map((r) => tag('r', r)).join('') + st.avoidSystems.map((s) => tag('s', s)).join('')
            || '<li class="jm-empty">Обходить нечего</li>';
        $('jm-beacon-tags').innerHTML = st.beacons.map((b) => `<li class="jm-tag">${esc(b)}
            <button type="button" class="jm-x" data-role="jm-beacon-del" data-v="${esc(b)}" aria-label="Убрать маяк ${esc(b)}">×</button></li>`).join('')
            || '<li class="jm-empty">Маяков нет</li>';
    }
    function renderRoutes() {
        const routes = ls.get(ROUTES_KEY, {});
        $('jm-routes').innerHTML = Object.keys(routes).sort().map((n) => `<option>${esc(n)}</option>`).join('') || '<option value="">сохранённых нет</option>';
        $('jm-link').value = st.waypoints.length > 1 ? routeLink() : '';
    }
    function renderChars() {
        const chars = typeof eveChars === 'function' ? eveChars() : [];
        $('jm-char').innerHTML = `<option value="">— выберите персонажа —</option>`
            + chars.map((c) => `<option value="${c.characterId}"${String(c.characterId) === String(st.char) ? ' selected' : ''}>${esc(c.characterName)}</option>`).join('');
        $('jm-char-load').disabled = !st.char || !chars.some((c) => String(c.characterId) === String(st.char));
    }

    /* Звёздные врата — из данных планетарной карты (js/mapdata.js,
       MAP_REGIONS: j — врата внутри региона, e — в соседние регионы).
       Map(система -> [соседи по вратам]), строится один раз. */
    let gateCache = null;
    function gateLinks() {
        if (gateCache) return gateCache;
        gateCache = new Map();
        if (typeof MAP_REGIONS !== 'object') return gateCache;
        const link = (a, b) => {
            if (!gateCache.has(a)) gateCache.set(a, []);
            gateCache.get(a).push(b);
        };
        Object.values(MAP_REGIONS).forEach((reg) => {
            const names = reg.s.map((x) => x[0]);
            for (let i = 0; i + 1 < (reg.j || []).length; i += 2) {
                link(names[reg.j[i]], names[reg.j[i + 1]]);
                link(names[reg.j[i + 1]], names[reg.j[i]]);
            }
            (reg.e || []).forEach((e) => link(names[e[0]], e[1]));
        });
        return gateCache;
    }

    // Схема маршрута: вид сверху (x, −z), рядом — соседние системы
    /* Карта занимает свою клетку целиком: от верха «Планировщика» до низа
       «Маршрута прыжков». Размер рисунка — по размеру клетки; клетка
       поменялась (маршрут стал длиннее, окно шире) — перерисовываем. */
    let lastMap = null;
    let mapRO = null;
    function renderMap(path, isWp) {
        const box = $('jm-map');
        lastMap = path ? { path, isWp } : null;
        if (!mapRO && typeof ResizeObserver === 'function') {
            let raf = 0;
            mapRO = new ResizeObserver(() => {
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    const svg = box.querySelector('svg');
                    if (!lastMap || !svg) return;
                    const w = Number(svg.getAttribute('width'));
                    const h = Number(svg.getAttribute('height'));
                    if (Math.abs(box.clientWidth - w) > 4 || Math.abs(box.clientHeight - 26 - h) > 4) renderMap(lastMap.path, lastMap.isWp);
                });
            });
            mapRO.observe(box);
        }
        if (!path) {
            box.innerHTML = '<p class="evt-dim">Добавьте две системы — здесь появится схема маршрута</p>';
            return;
        }
        const W = Math.max(280, Math.round(box.clientWidth || 520));
        const H = Math.max(220, Math.round((box.clientHeight || 346) - 26));
        const pad = 40;
        const xs = path.map((s) => s.x);
        const zs = path.map((s) => -s.z);
        let x0 = Math.min(...xs);
        let x1 = Math.max(...xs);
        let z0 = Math.min(...zs);
        let z1 = Math.max(...zs);
        const m = Math.max(2, (Math.max(x1 - x0, z1 - z0)) * 0.08);
        x0 -= m; x1 += m; z0 -= m; z1 += m;
        const k = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (z1 - z0 || 1));
        const ox = (W - (x1 - x0) * k) / 2;
        const oz = (H - (z1 - z0) * k) / 2;
        const px = (s) => ox + (s.x - x0) * k;
        const pz = (s) => oz + (-s.z - z0) * k;
        const around = SYS.filter((s) => s.x >= x0 && s.x <= x1 && -s.z >= z0 && -s.z <= z1);
        // связи систем — звёздные врата между системами в кадре (тонкие серые)
        const inView = new Map(around.map((s) => [s.name, s]));
        const gates = gateLinks();
        const seen = new Set();
        let gateLines = '';
        around.forEach((a) => (gates.get(a.name) || []).forEach((bn) => {
            const b = inView.get(bn);
            if (!b) return;
            const key = a.name < bn ? `${a.name}|${bn}` : `${bn}|${a.name}`;
            if (seen.has(key)) return;
            seen.add(key);
            gateLines += `<line class="jm-gate" x1="${px(a).toFixed(1)}" y1="${pz(a).toFixed(1)}" x2="${px(b).toFixed(1)}" y2="${pz(b).toFixed(1)}"/>`;
        }));
        const dots = around.map((s) => `<circle class="jm-dot jm-dot-${secClass(s.sec)}" cx="${px(s).toFixed(1)}" cy="${pz(s).toFixed(1)}" r="1.4" title="${esc(`${s.name} · ${s.region} · ${secText(s.sec)}`)}"/>`).join('');
        // подписи систем вокруг маршрута (системы маршрута подписаны крупнее отдельно)
        const onPath = new Set(path.map((s) => s.name));
        /* подпись ставим, только если не налезает на уже поставленные; ближние
           к маршруту системы — первыми; остальные — в подсказке при наведении */
        const boxes = path.map((s) => [px(s) + 6, pz(s) - 8, px(s) + 14 + s.name.length * 6.2, pz(s) + 6]);
        const hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
        const near = (s) => Math.min(...path.map((p) => (px(p) - px(s)) ** 2 + (pz(p) - pz(s)) ** 2));
        const labels = around.filter((s) => !onPath.has(s.name)).sort((a, b) => near(a) - near(b)).map((s) => {
            const x = px(s) + 3;
            const y = pz(s) - 2.5;
            const b = [x, y - 7, x + s.name.length * 4.3, y + 1];
            if (hit(b)) return '';
            boxes.push(b);
            return `<text class="jm-sys-t" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(s.name)}</text>`;
        }).join('');
        const legs = path.slice(1).map((s, i) => {
            const a = path[i];
            const mx = (px(a) + px(s)) / 2;
            const my = (pz(a) + pz(s)) / 2;
            // перелёт — дуга (изгиб в сторону от прямой на 18 % длины), свой цвет
            const ax = px(a);
            const ay = pz(a);
            const bx = px(s);
            const by = pz(s);
            const len = Math.hypot(bx - ax, by - ay) || 1;
            const cx = mx - ((by - ay) / len) * len * 0.18;
            const cy = my + ((bx - ax) / len) * len * 0.18;
            const lx = (mx + cx) / 2;
            const lyy = (my + cy) / 2;
            return `<path class="jm-leg jm-arc" d="M${ax.toFixed(1)},${ay.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}"/>
                <text class="jm-leg-ly" x="${lx.toFixed(1)}" y="${(lyy - 4).toFixed(1)}">${fmt(dist(a, s), 2)}</text>`;
        }).join('');
        const nodes = path.map((s, i) => `<g class="jm-node${isWp.has(s) ? ' is-wp' : ''}" title="${esc(`${s.name} · ${s.region} · ${secText(s.sec)}`)}">
                <circle cx="${px(s)}" cy="${pz(s)}" r="${isWp.has(s) ? 6 : 4.5}" class="jm-node-c jm-dot-${secClass(s.sec)}"/>
                <text x="${px(s) + 8}" y="${pz(s) + 4}" class="jm-node-t">${i + 1}. ${esc(s.name)}</text></g>`).join('');
        box.innerHTML = `<svg class="jm-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Схема маршрута">${gateLines}${dots}${labels}${legs}${nodes}</svg>
            <p class="jm-map-legend"><span class="jm-lg-gate"></span>звёздные врата<span class="jm-lg-arc"></span>прыжок</p>`;
    }

    let lastRoute = null;
    async function renderRoute() {
        renderWaypoints();
        renderRoutes();
        persist();
        const out = $('jm-route');
        const r = await buildRoute();
        lastRoute = r;
        const title = st.waypoints.length > 1 ? `${st.waypoints[0]} → ${st.waypoints[st.waypoints.length - 1]}` : '';
        $('jm-map-title').textContent = title;
        $('jm-route-title').textContent = title;
        if (!r.path) {
            renderMap(null);
            out.innerHTML = r.error ? `<p class="evt-bad">${esc(r.error)}</p>` : '<p class="evt-dim">Маршрут появится, когда в «Точках маршрута» будет хотя бы две системы</p>';
            return;
        }
        renderMap(r.path, r.isWp);
        const L = await loadLive();
        await holderNames(r.path.map((s) => L.sov.get(s.id)));
        const sh = shipOf(st.ship);
        const fuelName = (JUMP_FUEL[sh.ftype] || ['топливо'])[0];
        const fuelVol = (JUMP_FUEL[sh.ftype] || [0, 0])[1];
        let totalLy = 0;
        let totalFuel = 0;
        const rows = r.path.map((s, i) => {
            const holder = L.sov.get(s.id);
            const row = `<tr class="jm-sys${r.isWp.has(s) ? ' is-wp' : ''}">
                    <td class="jm-n">${i + 1}.</td><td>${esc(s.region)}</td>
                    <td class="jm-name">${esc(s.name)}${s.station ? ' <span class="jm-st" title="Есть станция NPC">◆</span>' : ''}</td>
                    <td>${secBadge(s)}</td>
                    <td class="jm-holder">${holder ? esc(L.names.get(holder) || '') : ''}</td>
                    <td class="jm-num">${fmt(L.kills.get(s.id) || 0)}</td><td class="jm-num">${fmt(L.jumps.get(s.id) || 0)}</td></tr>`;
            const next = r.path[i + 1];
            if (!next) return row;
            const ly = dist(s, next);
            const fuel = fuelFor(ly);
            totalLy += ly;
            totalFuel += fuel;
            const alt = !r.isWp.has(next) ? `<button type="button" class="jm-alt" data-role="jm-alt" data-i="${i + 1}" title="Другие промежуточные системы">⇄</button>` : '';
            return `${row}<tr class="jm-leg-row"><td></td><td colspan="6">↓ Прыжок <b>${fmt(ly, 3)}</b> св. лет · топливо <b>${fmt(fuel)}</b> ${esc(fuelName)} ${alt}</td></tr>`;
        }).join('');
        const jumps = r.path.length - 1;
        out.innerHTML = `
            ${r.startHigh ? '<p class="evt-bad jm-warn">Начало в хайсеке: прыжковый двигатель там не включается — сначала выйдите в лоу на вратах.</p>' : ''}
            <div class="st-scroll"><table class="stats-p1 jm-table">
                <thead><tr><th>#</th><th>Регион</th><th>Система</th><th>Без.</th><th>Владелец</th><th title="Убийства кораблей и подов за последний час">Убийства</th><th title="Прыжки через врата за последний час">Прыжки</th></tr></thead>
                <tbody>${rows}</tbody></table></div>
            <dl class="jm-total">
                <dt>Прыжков</dt><dd>${jumps}</dd>
                <dt>Всего расстояние</dt><dd>${fmt(totalLy, 3)} св. лет</dd>
                <dt>Всего топлива</dt><dd>${fmt(totalFuel)} ${esc(fuelName)} (${fmt(totalFuel * fuelVol)} м³)</dd>
                <dt>Дальность прыжка</dt><dd>${fmt(r.range, 2)} св. лет (${esc(sh.name)}, Jump Drive Calibration ${st.jdc})</dd>
            </dl>
            <p class="jm-hint">Убийства и прыжки — за последний час (ESI). ⇄ — выбрать другую промежуточную систему.</p>`;
    }

    // Альтернативные промежуточные системы для шага i: в пределах дальности от предыдущей и следующей
    function showAlternatives(btn) {
        const r = lastRoute;
        const i = Number(btn.dataset.i);
        const a = r.path[i - 1];
        const b = r.path[i + 1];
        const cur = r.path[i];
        const R = r.range;
        const list = SYS.filter((s) => s !== cur && canEnter(s) && dist(a, s) <= R && dist(s, b) <= R)
            .sort((x, y) => (dist(a, x) + dist(x, b)) - (dist(a, y) + dist(y, b))).slice(0, 15);
        const old = root.querySelector('.jm-alt-pop');
        if (old) old.remove();
        if (!list.length) return;
        btn.insertAdjacentHTML('afterend', `<div class="jm-alt-pop">${list.map((s) => `<button type="button" class="jm-alt-pick" data-role="jm-alt-pick" data-i="${i}" data-name="${esc(s.name)}">
            ${secBadge(s)} ${esc(s.name)} <span class="evt-dim">${esc(s.region)} · ${fmt(dist(a, s), 2)} + ${fmt(dist(s, b), 2)} св. лет${s.station ? ' · ◆' : ''}</span></button>`).join('')}</div>`);
    }
    // Выбранная альтернатива встаёт в Waypoints между соседними точками маршрута
    function pickAlternative(i, name) {
        const r = lastRoute;
        let before = 0;
        for (let k = 0; k < i; k += 1) if (r.isWp.has(r.path[k])) before += 1;
        st.waypoints.splice(before, 0, name);
        renderRoute();
    }

    // Навыки, система и корабль с персонажа (нужны права EVE на навыки и местоположение)
    async function loadFromChar(withPlace) {
        const msg = $('jm-char-msg');
        const id = Number($('jm-char').value);
        const char = (typeof eveChars === 'function' ? eveChars() : []).find((c) => c.characterId === id);
        if (!char) return;
        st.char = String(id);
        const scopes = [].concat(char.scopes || []).join(' ').split(/\s+/);
        const need = EXTRA_SCOPES.split(' ').filter((s) => !scopes.includes(s));
        if (need.length) {
            msg.innerHTML = `Нужны права EVE на навыки и местоположение. <button type="button" class="btn card-add jm-btn" data-role="jm-grant">Разрешить</button>
                <span class="jm-hint">Откроется вход EVE — войдите этим персонажем.</span>`;
            return;
        }
        msg.textContent = 'Загрузка…';
        try {
            const skills = await eveFetchJson(`https://esi.evetech.net/latest/characters/${id}/skills/?datasource=tranquility`, {}, id);
            const lvl = (sid) => ((skills.skills || []).find((x) => x.skill_id === sid) || {}).active_skill_level || 0;
            st.jdc = lvl(SKILL_IDS.jdc);
            st.jfc = lvl(SKILL_IDS.jfc);
            st.jf = lvl(SKILL_IDS.jf);
            const notes = [];
            const [loc, ship] = !withPlace ? [null, null] : await Promise.all([
                eveFetchJson(`https://esi.evetech.net/latest/characters/${id}/location/?datasource=tranquility`, {}, id).catch(() => null),
                eveFetchJson(`https://esi.evetech.net/latest/characters/${id}/ship/?datasource=tranquility`, {}, id).catch(() => null)
            ]);
            const here = loc && byId.get(loc.solar_system_id);
            if (here) {
                if (st.waypoints[0] !== here.name) st.waypoints.unshift(here.name);
                notes.push(`система ${here.name}`);
            }
            if (ship) {
                const t = await fetch(`https://esi.evetech.net/latest/universe/types/${ship.ship_type_id}/?datasource=tranquility`).then((x) => x.json()).catch(() => null);
                const sh = t && SHIPS.find((s) => s.name === t.name);
                if (sh) { st.ship = sh.name; notes.push(`корабль ${sh.name}`); } else if (t) notes.push(`корабль ${t.name} — без прыжкового двигателя, оставлен ${st.ship}`);
            }
            $('jm-ship').value = st.ship;
            showSkills();
            // навыки видны в своих полях — в строке «С персонажа» их не повторяем
            msg.textContent = notes.length ? `С персонажа: ${notes.join(', ')}` : '';
            persist();
            renderRoute();
        } catch (e) {
            msg.textContent = `EVE не отдал данные: ${e.message}`;
        }
    }

    // ---- События ----
    /* Планировщик: система — вводом с подсказками (без списка регионов);
       подсказки и проверка — только системы, куда можно прыгнуть */
    const addSystem = () => {
        const inp = $('jm-add');
        const s = byName.get((inp.value || '').trim().toLowerCase());
        const msg = $('jm-add-msg');
        if (!s) { msg.textContent = inp.value.trim() ? `Системы «${inp.value.trim()}» нет` : 'Введите систему'; return; }
        if (!canEnter(s)) {
            msg.textContent = `${s.name}: ${highsec(s) ? `хайсек ${secText(s.sec)}` : s.region} — сюда прыгнуть нельзя`;
            return;
        }
        msg.textContent = '';
        st.waypoints.push(s.name);
        inp.value = '';
        renderRoute();
    };
    // Обход — как планировщик: одно поле с подсказками, система или регион
    const addAvoid = () => {
        const inp = $('jm-avoid');
        const v = (inp.value || '').trim();
        const msg = $('jm-avoid-msg');
        const s = byName.get(v.toLowerCase());
        const r = Array.from(regionSet).find((x) => x.toLowerCase() === v.toLowerCase());
        if (r) { if (!st.avoidRegions.includes(r)) st.avoidRegions.push(r); } else if (s) {
            if (!st.avoidSystems.includes(s.name)) st.avoidSystems.push(s.name);
        } else { msg.textContent = v ? `Нет системы или региона «${v}»` : 'Введите систему или регион'; return; }
        msg.textContent = '';
        inp.value = '';
        renderTags();
        renderRoute();
    };
    // регион выбран — список систем только этого региона
    const fillSystems = (regRole, sysRole, region, first) => {
        const sel = $(sysRole);
        sel.innerHTML = region ? systemOptions(region, first) : '<option value="">сначала регион</option>';
        sel.disabled = !region;
    };
    const addBeacon = () => {
        const inp = $('jm-beacon');
        const s = byName.get(inp.value.trim().toLowerCase());
        if (!s) return;
        if (!st.beacons.includes(s.name)) st.beacons.push(s.name);
        inp.value = '';
        renderTags();
        renderRoute();
    };
    root.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const role = e.target.dataset.role;
        if (role === 'jm-add') addSystem();
        if (role === 'jm-avoid') addAvoid();
        if (role === 'jm-beacon') addBeacon();
    });
    root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-role]');
        if (!t) {
            const pop = root.querySelector('.jm-alt-pop');
            if (pop) pop.remove();
            return;
        }
        const role = t.dataset.role;
        if (role === 'jm-add-btn') addSystem();
        else if (role === 'jm-avoid-btn') addAvoid();
        else if (role === 'jm-beacon-btn') addBeacon();
        else if (role === 'jm-wp-del') { st.waypoints.splice(Number(t.dataset.i), 1); renderRoute(); }
        else if (role === 'jm-avoid-del') {
            const list = t.dataset.kind === 'r' ? st.avoidRegions : st.avoidSystems;
            list.splice(list.indexOf(t.dataset.v), 1);
            renderTags();
            renderRoute();
        } else if (role === 'jm-beacon-del') { st.beacons.splice(st.beacons.indexOf(t.dataset.v), 1); renderTags(); renderRoute(); }
        else if (role === 'jm-alt') showAlternatives(t);
        else if (role === 'jm-alt-pick') pickAlternative(Number(t.dataset.i), t.dataset.name);
        else if (role === 'jm-char-load') loadFromChar(true);
        else if (role === 'jm-grant') { persist(); if (typeof eveLogin === 'function') eveLogin(EXTRA_SCOPES); }
        else if (role === 'jm-save') {
            const name = $('jm-route-name').value.trim() || `${st.waypoints[0] || '?'} → ${st.waypoints[st.waypoints.length - 1] || '?'}`;
            const routes = ls.get(ROUTES_KEY, {});
            routes[name] = { ship: st.ship, jdc: st.jdc, jfc: st.jfc, jf: st.jf, waypoints: st.waypoints.slice(),
                avoidSystems: st.avoidSystems.slice(), avoidRegions: st.avoidRegions.slice(), beacons: st.beacons.slice(),
                preferStations: st.preferStations, avoidIncursions: st.avoidIncursions, beaconsOnly: st.beaconsOnly };
            ls.set(ROUTES_KEY, routes);
            $('jm-save-msg').textContent = `Сохранено: ${name}`;
            renderRoutes();
            $('jm-routes').value = name;
        } else if (role === 'jm-load') {
            const r = ls.get(ROUTES_KEY, {})[$('jm-routes').value];
            if (!r) return;
            Object.assign(st, r);
            $('jm-ship').value = st.ship;
            showSkills();
            $('jm-stations').checked = st.preferStations;
            $('jm-incursions').checked = st.avoidIncursions;
            $('jm-beacons-only').checked = st.beaconsOnly;
            $('jm-save-msg').textContent = `Загружено: ${$('jm-routes').value}`;
            renderTags();
            renderRoute();
        } else if (role === 'jm-del') {
            const routes = ls.get(ROUTES_KEY, {});
            delete routes[$('jm-routes').value];
            ls.set(ROUTES_KEY, routes);
            renderRoutes();
        } else if (role === 'jm-copy') {
            const v = $('jm-link').value;
            if (!v) return;
            (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(
                () => { $('jm-save-msg').textContent = 'Ссылка скопирована'; },
                () => { $('jm-link').select(); $('jm-save-msg').textContent = 'Выделите и скопируйте ссылку'; }
            );
        }
    });
    root.addEventListener('change', (e) => {
        const role = e.target.dataset.role;
        if (role === 'jm-ship') st.ship = e.target.value;
        else if (role === 'jm-stations') st.preferStations = e.target.checked;
        else if (role === 'jm-incursions') st.avoidIncursions = e.target.checked;
        else if (role === 'jm-beacons-only') st.beaconsOnly = e.target.checked;
        else if (role === 'jm-char') {
            // персонаж выбран — сразу берём его навыки прыжков
            st.char = e.target.value;
            persist();
            renderChars();
            if (st.char) loadFromChar(false); else $('jm-char-msg').textContent = 'Выберите персонажа — навыки подгрузятся с него';
            return;
        } else if (role === 'jm-add' || role === 'jm-avoid') return;
        else return;
        renderRoute();
    });
    // Перетаскивание точек маршрута
    let dragFrom = -1;
    root.addEventListener('dragstart', (e) => {
        const li = e.target.closest('.jm-wp');
        if (!li) return;
        dragFrom = Number(li.dataset.i);
        e.dataTransfer.effectAllowed = 'move';
    });
    root.addEventListener('dragover', (e) => { if (e.target.closest('.jm-wp')) e.preventDefault(); });
    root.addEventListener('drop', (e) => {
        const li = e.target.closest('.jm-wp');
        if (!li || dragFrom < 0) return;
        e.preventDefault();
        const to = Number(li.dataset.i);
        const [item] = st.waypoints.splice(dragFrom, 1);
        st.waypoints.splice(to, 0, item);
        dragFrom = -1;
        renderRoute();
    });

    // Старт: ссылка #jump/... открывает вкладку «Карты» → «Прыжковая карта»
    const linked = fromHash();
    // навыки берём только с персонажа: не выбран — берём первого подключённого
    const allChars = typeof eveChars === 'function' ? eveChars() : [];
    if ((!st.char || !allChars.some((c) => String(c.characterId) === String(st.char))) && allChars.length) st.char = String(allChars[0].characterId);
    renderChars();
    if (st.char) loadFromChar(false);
    renderTags();
    renderRoute();
    window.addEventListener('eve-chars-changed', renderChars);
    if (linked && typeof window.showMapsView === 'function') window.showMapsView('jump', true);
}());
