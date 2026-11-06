/* Эскалации — трекер DED-комплексов из боевых аномалий.
   Вкладка «Карты» → «Эскалации».
   Слева: список активных эскалаций с таймерами и приоритетом.
   Справа: SVG-карта галактики с маркерами.
   Данные хранятся в localStorage. */
(function () {
    'use strict';

    var root = document.getElementById('map-esc');
    if (!root) return;

    /* ===================== Справочник эскалаций ===================== */
    var ESC_LIST = [
        /* Angel Cartel */
        { name: "Angel's Red Light District",           ded: '5/10',  faction: 'Angel Cartel' },
        { name: 'Angel Mineral Acquisition Outpost',    ded: '6/10',  faction: 'Angel Cartel' },
        { name: 'Angel Military Operations Complex',    ded: '7/10',  faction: 'Angel Cartel' },
        { name: 'Cartel Prisoner Retention',            ded: '8/10',  faction: 'Angel Cartel' },
        { name: 'Angel Cartel Naval Shipyard',          ded: '10/10', faction: 'Angel Cartel' },
        /* Blood Raiders */
        { name: 'Mul-Zatah Monastery',                  ded: '4/10',  faction: 'Blood Raiders' },
        { name: 'Blood Raider Psychotropics Depot',     ded: '5/10',  faction: 'Blood Raiders' },
        { name: 'Crimson Hand Supply Depot',            ded: '6/10',  faction: 'Blood Raiders' },
        { name: 'Blood Raider Coordination Center',     ded: '7/10',  faction: 'Blood Raiders' },
        { name: 'Blood Raider Prison Camp',             ded: '8/10',  faction: 'Blood Raiders' },
        { name: 'Blood Raider Naval Shipyard',          ded: '10/10', faction: 'Blood Raiders' },
        /* Guristas */
        { name: 'Guristas Scout Outpost',               ded: '3/10',  faction: 'Guristas' },
        { name: 'Guristas Hallucinogen Supply Waypoint', ded: '5/10', faction: 'Guristas' },
        { name: 'Guristas Troop Reinvigoration Camp',   ded: '6/10',  faction: 'Guristas' },
        { name: 'Gurista Military Operations Complex',  ded: '7/10',  faction: 'Guristas' },
        { name: "Pith's Penal Complex",                 ded: '8/10',  faction: 'Guristas' },
        { name: 'The Maze',                             ded: '10/10', faction: 'Guristas' },
        /* Sansha's Nation */
        { name: "Sansha's Command Relay Outpost",       ded: '3/10',  faction: "Sansha's Nation" },
        { name: "Sansha's Nation Neural Paralytic Facility", ded: '5/10', faction: "Sansha's Nation" },
        { name: 'Sansha War Supply Complex',            ded: '6/10',  faction: "Sansha's Nation" },
        { name: 'Sansha Military Operations Complex',   ded: '7/10',  faction: "Sansha's Nation" },
        { name: 'Sansha Prison Camp',                   ded: '8/10',  faction: "Sansha's Nation" },
        { name: 'Centus Assembly T.P. Co.',             ded: '10/10', faction: "Sansha's Nation" },
        /* Serpentis */
        { name: 'Serpentis Narcotic Warehouses',        ded: '3/10',  faction: 'Serpentis' },
        { name: 'Serpentis Corporation Hydroponics Site', ded: '5/10', faction: 'Serpentis' },
        { name: 'Serpentis Logistical Outpost',         ded: '6/10',  faction: 'Serpentis' },
        { name: 'Serpentis Paramilitary Complex',       ded: '7/10',  faction: 'Serpentis' },
        { name: 'Serpentis Prison Camp',                ded: '8/10',  faction: 'Serpentis' },
        { name: 'Serpentis Fleet Shipyard',             ded: '10/10', faction: 'Serpentis' },
        /* Rogue Drones */
        { name: 'Rogue Drone Asteroid Infestation',     ded: '3/10',  faction: 'Rogue Drones' },
        { name: 'Outgrowth Rogue Drone Hive (5/10)',    ded: '5/10',  faction: 'Rogue Drones' },
        { name: 'Outgrowth Rogue Drone Hive (10/10)',   ded: '10/10', faction: 'Rogue Drones' }
    ];

    /* Цвета фракций */
    var FACTION_COLOR = {
        'Angel Cartel':   '#e06040',
        'Blood Raiders':  '#c03030',
        'Guristas':       '#40a040',
        "Sansha's Nation":'#c0a020',
        'Serpentis':      '#4080c0',
        'Rogue Drones':   '#909090'
    };

    /* ===================== Регион → Фракция ===================== */
    /* Карта регионов EVE к доминирующей NPC-фракции (пиратской).
       Хайсек-регионы: эскалация может увести в лоу/нуль, поэтому
       для хайсек-региона показываем фракцию соседнего пиратского. */
    var REGION_FACTION = {
        /* Angel Cartel — Минматар-пространство + нуль */
        'Heimatar': 'Angel Cartel', 'Molden Heath': 'Angel Cartel',
        'Great Wildlands': 'Angel Cartel', 'Metropolis': 'Angel Cartel',
        'Curse': 'Angel Cartel', 'Angel Cartel': 'Angel Cartel',
        'Impass': 'Angel Cartel', 'Feythabolis': 'Angel Cartel',
        'Omist': 'Angel Cartel', 'Tenerifis': 'Angel Cartel',
        'Detorid': 'Angel Cartel', 'Insmother': 'Angel Cartel',
        'Scalding Pass': 'Angel Cartel', 'Wicked Creek': 'Angel Cartel',
        'Immensea': 'Angel Cartel', 'Cache': 'Angel Cartel',

        /* Blood Raiders — Амарр-пространство + нуль */
        'Domain': 'Blood Raiders', 'Devoid': 'Blood Raiders',
        'The Bleak Lands': 'Blood Raiders', 'Kador': 'Blood Raiders',
        'Khanid': 'Blood Raiders', 'Kor-Azor': 'Blood Raiders',
        'Genesis': 'Blood Raiders', 'Tash-Murkon': 'Blood Raiders',
        'Aridia': 'Blood Raiders',
        'Delve': 'Blood Raiders', 'Period Basis': 'Blood Raiders',
        'Querious': 'Blood Raiders',

        /* Guristas — Калдари-пространство + нуль */
        'The Forge': 'Guristas', 'Lonetrek': 'Guristas',
        'The Citadel': 'Guristas', 'Black Rise': 'Guristas',
        'Venal': 'Guristas', 'Tenal': 'Guristas',
        'Branch': 'Guristas', 'Deklein': 'Guristas',
        'Pure Blind': 'Guristas', 'Fade': 'Guristas',
        'Tribute': 'Guristas', 'Vale of the Silent': 'Guristas',
        'Geminate': 'Guristas',

        /* Sansha's Nation — юго-восток нулей + часть Амарр */
        'Stain': "Sansha's Nation", 'Esoteria': "Sansha's Nation",
        'Paragon Soul': "Sansha's Nation", 'Catch': "Sansha's Nation",
        'Providence': "Sansha's Nation",

        /* Serpentis — Галленте-пространство + нуль */
        'Essence': 'Serpentis', 'Everyshore': 'Serpentis',
        'Placid': 'Serpentis', 'Verge Vendor': 'Serpentis',
        'Sinq Laison': 'Serpentis', 'Solitude': 'Serpentis',
        'Syndicate': 'Serpentis', 'Outer Ring': 'Serpentis',
        'Cloud Ring': 'Serpentis', 'Fountain': 'Serpentis',

        /* Rogue Drones — восток нулей */
        'Cobalt Edge': 'Rogue Drones', 'Outer Passage': 'Rogue Drones',
        'Malpais': 'Rogue Drones', 'Etherium Reach': 'Rogue Drones',
        'The Spire': 'Rogue Drones', 'Oasa': 'Rogue Drones',
        'Perrigen Falls': 'Rogue Drones',
        'The Kalevala Expanse': 'Rogue Drones'
    };

    /* 24 часа в мс — срок жизни эскалации */
    var ESC_LIFETIME = 24 * 60 * 60 * 1000;
    var LS_KEY = 'evepi.escalations';
    var LS_PILOTS_KEY = 'evepi.esc.pilots';  /* видимые пилоты */

    /* ===================== Утилиты ===================== */
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    /* localStorage */
    function loadData() {
        try { var d = JSON.parse(localStorage.getItem(LS_KEY)); return Array.isArray(d) ? d : []; }
        catch (e) { return []; }
    }
    function saveData(arr) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { /* без памяти */ }
    }
    function loadVisiblePilots() {
        try { var d = JSON.parse(localStorage.getItem(LS_PILOTS_KEY)); return Array.isArray(d) ? d : null; }
        catch (e) { return null; }
    }
    function saveVisiblePilots(arr) {
        try { localStorage.setItem(LS_PILOTS_KEY, JSON.stringify(arr)); } catch (e) { /* без памяти */ }
    }

    /* Генератор ID */
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    /* Поиск системы в JUMP_SYSTEMS */
    function findSystem(name) {
        if (typeof JUMP_SYSTEMS === 'undefined' || typeof JUMP_REGIONS === 'undefined') return null;
        var low = name.trim().toLowerCase();
        for (var i = 0; i < JUMP_SYSTEMS.length; i++) {
            var s = JUMP_SYSTEMS[i];
            if (s[1].toLowerCase() === low) {
                return { id: s[0], name: s[1], region: JUMP_REGIONS[s[2]], sec: s[3], x: s[4], y: s[5], z: s[6] };
            }
        }
        return null;
    }

    /* Все пилоты из карточек (select#pilot-new) */
    function getAllPilots() {
        var sel = document.getElementById('pilot-new');
        if (!sel) return [];
        var arr = [];
        for (var i = 0; i < sel.options.length; i++) {
            var v = sel.options[i].value;
            if (v) arr.push(v);
        }
        return arr;
    }

    /* Видимые пилоты (отфильтрованные). Если фильтр не настроен — все */
    function getVisiblePilots() {
        var all = getAllPilots();
        var visible = loadVisiblePilots();
        if (!visible) return all; /* фильтр не настроен — показываем всех */
        return all.filter(function (p) { return visible.indexOf(p) !== -1; });
    }

    /* Форматирование времени */
    function fmtTimer(ms) {
        if (ms <= 0) return 'истекло';
        var h = Math.floor(ms / 3600000);
        var m = Math.floor((ms % 3600000) / 60000);
        return h + 'ч ' + (m < 10 ? '0' : '') + m + 'м';
    }

    /* ===================== Состояние ===================== */
    var data = loadData();
    var timerInterval = null;
    var currentRegion = '';  /* текущий регион из поля «Система» */

    /* ===================== Рендер ===================== */
    function render() {
        root.innerHTML = '';

        /* --- Панель слева --- */
        var panel = document.createElement('aside');
        panel.className = 'esc-panel';

        /* Форма добавления */
        var visiblePilots = getVisiblePilots();
        var form = document.createElement('div');
        form.className = 'esc-form';
        form.innerHTML =
            '<div class="esc-form-title">Новая эскалация</div>' +
            /* Система + авто-регион */
            '<label class="esc-label">Система' +
                '<input type="text" id="esc-sys" class="ct-input esc-input" placeholder="Вставьте название системы" autocomplete="off">' +
            '</label>' +
            '<div id="esc-region-hint" class="esc-region-hint"></div>' +
            /* Игрок: select + кнопка «⚙» */
            '<div class="esc-pilot-row">' +
                '<label class="esc-label esc-label-grow">Игрок' +
                    '<select id="esc-pilot" class="ct-input esc-input">' +
                        '<option value="">— выбрать —</option>' +
                        visiblePilots.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('') +
                        '<option value="__custom">другой…</option>' +
                    '</select>' +
                '</label>' +
                '<button type="button" id="esc-pilot-edit" class="btn esc-gear-btn" title="Настроить список пилотов">⚙</button>' +
            '</div>' +
            '<div id="esc-pilot-custom-wrap" hidden>' +
                '<input type="text" id="esc-pilot-custom" class="ct-input esc-input" placeholder="Имя пилота">' +
            '</div>' +
            /* Панель редактирования пилотов (скрыта) */
            '<div id="esc-pilot-editor" class="esc-pilot-editor" hidden></div>' +
            /* Эскалация (фильтруется по региону) */
            '<label class="esc-label">Эскалация' +
                '<select id="esc-type" class="ct-input esc-input">' +
                    buildEscOptions('') +
                '</select>' +
            '</label>' +
            '<div id="esc-type-custom-wrap" hidden>' +
                '<input type="text" id="esc-type-custom" class="ct-input esc-input" placeholder="Название эскалации">' +
            '</div>' +
            '<button type="button" id="esc-add" class="btn card-add esc-add-btn">Добавить</button>';
        panel.appendChild(form);

        /* Список эскалаций */
        var list = document.createElement('div');
        list.className = 'esc-list';

        var now = Date.now();

        /* Сортировка: приоритетные сверху, затем по времени (новые выше) */
        var sorted = data.slice().sort(function (a, b) {
            if (a.priority && !b.priority) return -1;
            if (!a.priority && b.priority) return 1;
            return b.created - a.created;
        });

        if (!sorted.length) {
            list.innerHTML = '<div class="esc-empty">Эскалаций нет</div>';
        } else {
            sorted.forEach(function (item) {
                var remaining = (item.created + ESC_LIFETIME) - now;
                var expired = remaining <= 0;
                var isNew = (now - item.created) < 600000; /* < 10 мин */
                var cls = 'esc-item' + (expired ? ' esc-expired' : '') + (isNew ? ' esc-new' : '') + (item.priority ? ' esc-prio' : '');

                var escInfo = ESC_LIST.find(function (e) { return e.name === item.type; });
                var ded = escInfo ? escInfo.ded : '';
                var faction = escInfo ? escInfo.faction : '';
                var color = FACTION_COLOR[faction] || 'var(--text-dim)';

                var html = '<div class="' + cls + '" data-id="' + item.id + '">';
                html += '<div class="esc-item-head">';
                html += '<label class="esc-prio-label" title="Приоритет"><input type="checkbox" class="esc-prio-cb"' + (item.priority ? ' checked' : '') + '></label>';
                html += '<span class="esc-ded" style="color:' + color + '">' + (ded ? '[' + ded + ']' : '') + '</span>';
                html += '<span class="esc-type-name">' + esc(item.type) + '</span>';
                html += '<button type="button" class="esc-del" title="Удалить">×</button>';
                html += '</div>';
                html += '<div class="esc-item-body">';
                html += '<span class="esc-sys-name">' + esc(item.system) + '</span>';
                if (item.region) html += ' <span class="esc-region">(' + esc(item.region) + ')</span>';
                html += '</div>';
                html += '<div class="esc-item-foot">';
                html += '<span class="esc-pilot-name">' + esc(item.pilot || '—') + '</span>';
                html += '<span class="esc-timer" data-end="' + (item.created + ESC_LIFETIME) + '">' + fmtTimer(remaining) + '</span>';
                html += '</div>';
                html += '</div>';
                list.innerHTML += html;
            });
        }
        panel.appendChild(list);
        root.appendChild(panel);

        /* --- Карта справа --- */
        var mapWrap = document.createElement('div');
        mapWrap.className = 'esc-map-wrap';
        mapWrap.innerHTML = '<svg id="esc-svg" class="esc-svg"></svg>';
        root.appendChild(mapWrap);

        /* Рисуем карту */
        drawMap();

        /* Обработчики */
        bindEvents();
        startTimers();
    }

    /* ===================== Опции эскалаций (фильтр по фракции) ===================== */
    function buildEscOptions(region) {
        var faction = region ? (REGION_FACTION[region] || '') : '';
        var filtered = faction
            ? ESC_LIST.filter(function (e) { return e.faction === faction; })
            : ESC_LIST;
        var html = '<option value="">— выбрать —</option>';
        if (faction) {
            /* Сначала подходящие по фракции */
            filtered.forEach(function (e) {
                html += '<option value="' + esc(e.name) + '">[' + e.ded + '] ' + esc(e.name) + '</option>';
            });
            /* Разделитель + остальные */
            html += '<option disabled>── другие фракции ──</option>';
            ESC_LIST.filter(function (e) { return e.faction !== faction; }).forEach(function (e) {
                html += '<option value="' + esc(e.name) + '">[' + e.ded + '] ' + esc(e.name) + '</option>';
            });
        } else {
            ESC_LIST.forEach(function (e) {
                html += '<option value="' + esc(e.name) + '">[' + e.ded + '] ' + esc(e.name) + '</option>';
            });
        }
        html += '<option value="__custom">другая…</option>';
        return html;
    }

    /* ===================== SVG-карта галактики ===================== */
    function drawMap() {
        var svg = document.getElementById('esc-svg');
        if (!svg || typeof JUMP_SYSTEMS === 'undefined') return;

        var W = 900, H = 700;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

        /* Границы координат (x, z — план галактики) */
        var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        JUMP_SYSTEMS.forEach(function (s) {
            if (s[4] < minX) minX = s[4];
            if (s[4] > maxX) maxX = s[4];
            if (s[6] < minZ) minZ = s[6];
            if (s[6] > maxZ) maxZ = s[6];
        });
        var pad = 40;
        var scaleX = (W - pad * 2) / (maxX - minX);
        var scaleZ = (H - pad * 2) / (maxZ - minZ);
        var scale = Math.min(scaleX, scaleZ);

        var cx = (maxX + minX) / 2;
        var cz = (maxZ + minZ) / 2;
        function tx(x) { return W / 2 + (x - cx) * scale; }
        function tz(z) { return H / 2 + (z - cz) * scale; }

        /* Фон: все системы как мелкие точки */
        var dots = '';
        JUMP_SYSTEMS.forEach(function (s) {
            var px = tx(s[4]), pz = tz(s[6]);
            var sec = s[3];
            var fill = sec >= 0.45 ? 'rgba(80,160,80,0.15)' : sec > 0 ? 'rgba(200,160,40,0.15)' : 'rgba(200,60,60,0.12)';
            dots += '<circle cx="' + px.toFixed(1) + '" cy="' + pz.toFixed(1) + '" r="0.8" fill="' + fill + '"/>';
        });
        svg.innerHTML = dots;

        /* Маркеры эскалаций */
        var now = Date.now();
        data.forEach(function (item) {
            if (!item.sx) return; /* нет координат */
            var px = tx(item.sx), pz = tz(item.sz);
            var remaining = (item.created + ESC_LIFETIME) - now;
            var expired = remaining <= 0;
            var isNew = (now - item.created) < 600000;

            var escInfo = ESC_LIST.find(function (e) { return e.name === item.type; });
            var faction = escInfo ? escInfo.faction : '';
            var color = expired ? '#555' : (FACTION_COLOR[faction] || '#aaa');
            if (isNew) color = '#00ff80';

            var r = item.priority ? 6 : 4;
            var opacity = expired ? 0.4 : 1;

            svg.innerHTML += '<circle cx="' + px.toFixed(1) + '" cy="' + pz.toFixed(1) +
                '" r="' + r + '" fill="' + color + '" fill-opacity="' + opacity +
                '" stroke="' + (item.priority ? '#fff' : 'none') + '" stroke-width="' + (item.priority ? 1.5 : 0) + '">' +
                '<title>' + esc(item.system) + ' — ' + esc(item.type) + ' (' + fmtTimer(remaining) + ')</title></circle>';

            /* Подпись системы */
            svg.innerHTML += '<text x="' + (px + r + 2).toFixed(1) + '" y="' + (pz + 3).toFixed(1) +
                '" class="esc-map-label" fill="' + color + '" opacity="' + opacity + '">' +
                esc(item.system) + '</text>';
        });
    }

    /* ===================== Обработчики ===================== */
    function bindEvents() {
        var sysInput = document.getElementById('esc-sys');
        var regionHint = document.getElementById('esc-region-hint');
        var typeSel = document.getElementById('esc-type');
        var pilotSel = document.getElementById('esc-pilot');

        /* --- 1. Авто-определение региона при вводе системы --- */
        if (sysInput) {
            var debounce = null;
            sysInput.addEventListener('input', function () {
                clearTimeout(debounce);
                debounce = setTimeout(function () {
                    var val = sysInput.value.trim();
                    var sys = val ? findSystem(val) : null;
                    currentRegion = sys ? sys.region : '';
                    if (regionHint) {
                        if (sys) {
                            var faction = REGION_FACTION[sys.region] || '';
                            var fColor = FACTION_COLOR[faction] || 'var(--text-dim)';
                            regionHint.innerHTML = '<span class="esc-region-name">' + esc(sys.region) + '</span>' +
                                (faction ? ' <span class="esc-faction-name" style="color:' + fColor + '">' + esc(faction) + '</span>' : '');
                        } else {
                            regionHint.textContent = val ? 'система не найдена' : '';
                        }
                    }
                    /* Обновляем список эскалаций */
                    if (typeSel) {
                        var prev = typeSel.value;
                        typeSel.innerHTML = buildEscOptions(currentRegion);
                        /* Восстанавливаем выбор если возможно */
                        if (prev) {
                            for (var i = 0; i < typeSel.options.length; i++) {
                                if (typeSel.options[i].value === prev) { typeSel.selectedIndex = i; break; }
                            }
                        }
                    }
                }, 300);
            });
            /* Обработка paste — мгновенно (без debounce) */
            sysInput.addEventListener('paste', function () {
                setTimeout(function () { sysInput.dispatchEvent(new Event('input')); }, 50);
            });
        }

        /* --- 2. Кнопка редактирования пилотов --- */
        var editBtn = document.getElementById('esc-pilot-edit');
        var editorDiv = document.getElementById('esc-pilot-editor');
        if (editBtn && editorDiv) {
            editBtn.addEventListener('click', function () {
                if (!editorDiv.hidden) { editorDiv.hidden = true; return; }

                var all = getAllPilots();
                var visible = loadVisiblePilots();
                var html = '<div class="esc-editor-title">Показывать в списке:</div>';
                all.forEach(function (p) {
                    var checked = !visible || visible.indexOf(p) !== -1;
                    html += '<label class="esc-editor-row"><input type="checkbox" class="esc-editor-cb" value="' +
                        esc(p) + '"' + (checked ? ' checked' : '') + '> ' + esc(p) + '</label>';
                });
                html += '<button type="button" id="esc-pilot-save" class="btn card-add esc-save-btn">Сохранить</button>';
                editorDiv.innerHTML = html;
                editorDiv.hidden = false;

                /* Кнопка сохранения */
                document.getElementById('esc-pilot-save').addEventListener('click', function () {
                    var cbs = editorDiv.querySelectorAll('.esc-editor-cb');
                    var selected = [];
                    cbs.forEach(function (cb) { if (cb.checked) selected.push(cb.value); });
                    saveVisiblePilots(selected);
                    editorDiv.hidden = true;
                    /* Обновляем select */
                    if (pilotSel) {
                        var prevPilot = pilotSel.value;
                        var opts = '<option value="">— выбрать —</option>';
                        selected.forEach(function (p) {
                            opts += '<option value="' + esc(p) + '">' + esc(p) + '</option>';
                        });
                        opts += '<option value="__custom">другой…</option>';
                        pilotSel.innerHTML = opts;
                        if (prevPilot) {
                            for (var i = 0; i < pilotSel.options.length; i++) {
                                if (pilotSel.options[i].value === prevPilot) { pilotSel.selectedIndex = i; break; }
                            }
                        }
                    }
                });
            });
        }

        /* Показать/скрыть кастомное поле пилота */
        if (pilotSel) {
            pilotSel.addEventListener('change', function () {
                var wrap = document.getElementById('esc-pilot-custom-wrap');
                if (wrap) wrap.hidden = pilotSel.value !== '__custom';
            });
        }

        /* Показать/скрыть кастомное поле типа */
        if (typeSel) {
            typeSel.addEventListener('change', function () {
                var wrap = document.getElementById('esc-type-custom-wrap');
                if (wrap) wrap.hidden = typeSel.value !== '__custom';
            });
        }

        /* Кнопка «Добавить» */
        var addBtn = document.getElementById('esc-add');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                var sysName = sysInput ? sysInput.value.trim() : '';
                if (!sysName) { sysInput && sysInput.focus(); return; }

                /* Пилот */
                var pilotVal = pilotSel ? pilotSel.value : '';
                var pilot = pilotVal === '__custom'
                    ? (document.getElementById('esc-pilot-custom') || {}).value || ''
                    : pilotVal;

                /* Тип эскалации */
                var typeVal = typeSel ? typeSel.value : '';
                var escType = typeVal === '__custom'
                    ? (document.getElementById('esc-type-custom') || {}).value || ''
                    : typeVal;
                if (!escType) { typeSel && typeSel.focus(); return; }

                /* Поиск системы */
                var sys = findSystem(sysName);
                var entry = {
                    id: uid(),
                    system: sys ? sys.name : sysName,
                    region: sys ? sys.region : '',
                    type: escType,
                    pilot: pilot,
                    priority: false,
                    created: Date.now(),
                    sx: sys ? sys.x : null,
                    sz: sys ? sys.z : null
                };

                data.push(entry);
                saveData(data);
                render();
            });
        }

        /* Клики по списку: приоритет и удаление */
        var list = root.querySelector('.esc-list');
        if (list) {
            list.addEventListener('change', function (e) {
                if (!e.target.classList.contains('esc-prio-cb')) return;
                var item = e.target.closest('.esc-item');
                if (!item) return;
                var id = item.dataset.id;
                var found = data.find(function (d) { return d.id === id; });
                if (found) {
                    found.priority = e.target.checked;
                    saveData(data);
                    render();
                }
            });

            list.addEventListener('click', function (e) {
                if (!e.target.classList.contains('esc-del')) return;
                var item = e.target.closest('.esc-item');
                if (!item) return;
                var id = item.dataset.id;
                data = data.filter(function (d) { return d.id !== id; });
                saveData(data);
                render();
            });
        }
    }

    /* ===================== Таймеры ===================== */
    function startTimers() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function () {
            var now = Date.now();
            var els = root.querySelectorAll('.esc-timer');
            els.forEach(function (el) {
                var end = Number(el.dataset.end);
                var remaining = end - now;
                el.textContent = fmtTimer(remaining);
                /* Обновляем класс элемента-родителя */
                var item = el.closest('.esc-item');
                if (item) {
                    if (remaining <= 0) item.classList.add('esc-expired');
                    if (remaining <= 3600000 && remaining > 0) item.classList.add('esc-warning');
                }
            });
        }, 30000); /* обновление каждые 30 секунд */
    }

    /* ===================== Переключение вкладки ===================== */
    /* Рендерим при переключении на Эскалации */
    document.querySelectorAll('[data-role="maps-view"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.dataset.view === 'esc') {
                data = loadData(); /* перечитываем — могли измениться в другой вкладке */
                render();
            } else {
                if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            }
        });
    });

    /* Первый рендер, если вкладка уже активна */
    var active = document.querySelector('[data-role="maps-view"][aria-pressed="true"]');
    if (active && active.dataset.view === 'esc') render();
})();
