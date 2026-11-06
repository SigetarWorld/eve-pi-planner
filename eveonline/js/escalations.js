/* Эскалации — трекер DED-комплексов из боевых аномалий.
   Вкладка «Карты» → «Эскалации».
   Слева: список активных эскалаций с таймерами.
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

    /* Все подключённые персонажи (через eveChars из eveauth.js) */
    function getAllPilots() {
        if (typeof eveChars === 'function') {
            var chars = eveChars();
            return chars.map(function (c) { return c.characterName || ''; }).filter(Boolean);
        }
        /* Фоллбек — из карточек */
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
            /* Персонажи: чекбоксы (как на вкладке Планеты) */
            '<div class="esc-chars-block">' +
                '<div class="esc-chars-title">Персонажи</div>' +
                '<div id="esc-chars-list" class="esc-chars-list">' +
                    (function () {
                        var all = getAllPilots();
                        var visible = loadVisiblePilots();
                        return all.map(function (p) {
                            var checked = !visible || visible.indexOf(p) !== -1;
                            return '<label class="esc-char-row"><input type="checkbox" class="esc-char-cb" value="' +
                                esc(p) + '"' + (checked ? ' checked' : '') + '> ' + esc(p) + '</label>';
                        }).join('');
                    })() +
                '</div>' +
            '</div>' +
            /* Выбор пилота для новой эскалации */
            '<label class="esc-label">Игрок' +
                '<select id="esc-pilot" class="ct-input esc-input">' +
                    '<option value="">— выбрать —</option>' +
                    visiblePilots.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('') +
                    '<option value="__custom">другой…</option>' +
                '</select>' +
            '</label>' +
            '<div id="esc-pilot-custom-wrap" hidden>' +
                '<input type="text" id="esc-pilot-custom" class="ct-input esc-input" placeholder="Имя пилота">' +
            '</div>' +
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

        /* Сортировка: по времени (новые выше) */
        var sorted = data.slice().sort(function (a, b) {
            return b.created - a.created;
        });

        if (!sorted.length) {
            list.innerHTML = '<div class="esc-empty">Эскалаций нет</div>';
        } else {
            sorted.forEach(function (item) {
                var remaining = (item.created + ESC_LIFETIME) - now;
                var expired = remaining <= 0;
                var remainH = remaining / 3600000;

                /* Цвет по времени: зелёный >15ч, жёлтый 10-15ч, красный 0-10ч, серый истекло */
                var timeCls = expired ? 'esc-time-grey' : remainH > 15 ? 'esc-time-green' : remainH > 10 ? 'esc-time-yellow' : 'esc-time-red';
                var cls = 'esc-item ' + timeCls + (item.sold ? ' esc-sold' : '');

                var escInfo = ESC_LIST.find(function (e) { return e.name === item.type; });
                var ded = escInfo ? escInfo.ded : '';
                var faction = escInfo ? escInfo.faction : '';
                var color = FACTION_COLOR[faction] || 'var(--text-dim)';

                var html = '<div class="' + cls + '" data-id="' + item.id + '">';
                html += '<div class="esc-item-head">';
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
                html += '<span class="esc-timer-wrap">';
                html += '<span class="esc-timer" data-end="' + (item.created + ESC_LIFETIME) + '">' + fmtTimer(remaining) + '</span>';
                html += '<button type="button" class="esc-time-edit" title="Изменить время">✎</button>';
                html += '<button type="button" class="esc-sold-btn' + (item.sold ? ' is-sold' : '') + '" title="Продано">$</button>';
                html += '</span>';
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
        mapWrap.innerHTML = '<svg id="esc-svg" class="esc-svg"></svg>' +
            '<div class="esc-map-controls">' +
                '<button type="button" class="btn esc-map-btn" id="esc-zoom-in" title="Приблизить">+</button>' +
                '<button type="button" class="btn esc-map-btn" id="esc-zoom-out" title="Отдалить">−</button>' +
                '<button type="button" class="btn esc-map-btn" id="esc-zoom-reset" title="Сброс (двойной клик)">⌂</button>' +
            '</div>';
        root.appendChild(mapWrap);

        /* Рисуем карту */
        drawMap();
        bindMapPanZoom();

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
    var LS_VIEW_KEY = 'evepi.esc.mapView';  /* сохранение позиции/зума */

    /* Собирает регионы всех активных (не истёкших) эскалаций */
    function getActiveRegions() {
        var now = Date.now();
        var regions = {};
        data.forEach(function (item) {
            if (!item.region) return;
            if ((item.created + ESC_LIFETIME) - now <= 0) return;
            regions[item.region] = true;
        });
        return Object.keys(regions);
    }

    /* Системы региона из JUMP_SYSTEMS */
    function getRegionSystems(regionName) {
        if (typeof JUMP_SYSTEMS === 'undefined' || typeof JUMP_REGIONS === 'undefined') return [];
        var idx = JUMP_REGIONS.indexOf(regionName);
        if (idx < 0) return [];
        return JUMP_SYSTEMS.filter(function (s) { return s[2] === idx; });
    }

    /* Сохраняем/загружаем позицию карты */
    function saveMapView(vb) {
        try { localStorage.setItem(LS_VIEW_KEY, JSON.stringify(vb)); } catch (e) {}
    }
    function loadMapView() {
        try {
            var d = JSON.parse(localStorage.getItem(LS_VIEW_KEY));
            if (d && typeof d.x === 'number' && typeof d.w === 'number') return d;
        } catch (e) {}
        return null;
    }

    /* Внутреннее пространство карты (в единицах SVG).
       Все системы рисуются однажды в фиксированных координатах,
       а viewBox управляет видимой областью (пан/зум). */
    var MAP_W = 2000, MAP_H = 1600;
    var galaxyBounds = null;  /* {minX,maxX,minZ,maxZ} — мировые */
    var mapScale = 1;         /* мировые → SVG */
    var mapCX = 0, mapCZ = 0; /* центр мира */

    /* Мировые → SVG */
    function toSVG_X(x) { return MAP_W / 2 + (x - mapCX) * mapScale; }
    function toSVG_Z(z) { return MAP_H / 2 + (z - mapCZ) * mapScale; }

    /* Текущий viewBox {x,y,w,h} */
    var mapVB = { x: 0, y: 0, w: MAP_W, h: MAP_H };

    function applyViewBox(svg) {
        svg.setAttribute('viewBox', mapVB.x + ' ' + mapVB.y + ' ' + mapVB.w + ' ' + mapVB.h);
    }

    /* Вычислить начальный viewBox — зум к активным эскалациям */
    function calcInitialVB() {
        var activeRegions = getActiveRegions();
        if (!activeRegions.length) return { x: 0, y: 0, w: MAP_W, h: MAP_H };

        /* Находим SVG-координаты крайних систем регионов */
        var eMinX = Infinity, eMaxX = -Infinity, eMinZ = Infinity, eMaxZ = -Infinity;
        activeRegions.forEach(function (rName) {
            getRegionSystems(rName).forEach(function (s) {
                var sx = toSVG_X(s[4]), sz = toSVG_Z(s[6]);
                if (sx < eMinX) eMinX = sx;
                if (sx > eMaxX) eMaxX = sx;
                if (sz < eMinZ) eMinZ = sz;
                if (sz > eMaxZ) eMaxZ = sz;
            });
        });
        var dx = eMaxX - eMinX, dz = eMaxZ - eMinZ;
        if (dx < 50) { eMinX -= 25; eMaxX += 25; dx = 50; }
        if (dz < 50) { eMinZ -= 25; eMaxZ += 25; dz = 50; }
        /* Отступ 30% */
        var mx = dx * 0.3, mz = dz * 0.3;
        return { x: eMinX - mx, y: eMinZ - mz, w: dx + mx * 2, h: dz + mz * 2 };
    }

    /* Кэш врат — строим из MAP_REGIONS один раз */
    var gateLinksCache = null;
    function buildGateLinks() {
        if (gateLinksCache) return gateLinksCache;
        gateLinksCache = [];
        if (typeof MAP_REGIONS !== 'object') return gateLinksCache;
        /* Индекс JUMP_SYSTEMS по имени → [x, z] */
        var sysPos = {};
        JUMP_SYSTEMS.forEach(function (s) { sysPos[s[1]] = s; });

        Object.keys(MAP_REGIONS).forEach(function (rKey) {
            var reg = MAP_REGIONS[rKey];
            if (!reg.s || !reg.j) return;
            var names = reg.s.map(function (x) { return x[0]; });
            /* Внутренние врата */
            for (var i = 0; i + 1 < reg.j.length; i += 2) {
                var a = sysPos[names[reg.j[i]]], b = sysPos[names[reg.j[i + 1]]];
                if (a && b) gateLinksCache.push([a, b]);
            }
            /* Внешние врата */
            (reg.e || []).forEach(function (e) {
                var a = sysPos[names[e[0]]], b = sysPos[e[1]];
                if (a && b) gateLinksCache.push([a, b]);
            });
        });
        return gateLinksCache;
    }

    function drawMap() {
        var svg = document.getElementById('esc-svg');
        if (!svg || typeof JUMP_SYSTEMS === 'undefined') return;

        /* Подсчитываем границы галактики один раз */
        if (!galaxyBounds) {
            var gMinX = Infinity, gMaxX = -Infinity, gMinZ = Infinity, gMaxZ = -Infinity;
            JUMP_SYSTEMS.forEach(function (s) {
                if (s[4] < gMinX) gMinX = s[4];
                if (s[4] > gMaxX) gMaxX = s[4];
                if (s[6] < gMinZ) gMinZ = s[6];
                if (s[6] > gMaxZ) gMaxZ = s[6];
            });
            galaxyBounds = { minX: gMinX, maxX: gMaxX, minZ: gMinZ, maxZ: gMaxZ };
            var pad = 60;
            var sx = (MAP_W - pad * 2) / (gMaxX - gMinX);
            var sz = (MAP_H - pad * 2) / (gMaxZ - gMinZ);
            mapScale = Math.min(sx, sz);
            mapCX = (gMaxX + gMinX) / 2;
            mapCZ = (gMaxZ + gMinZ) / 2;
        }

        /* ViewBox: из localStorage или авто-зум к эскалациям */
        var saved = loadMapView();
        if (saved) {
            mapVB = saved;
        } else {
            mapVB = calcInitialVB();
        }
        applyViewBox(svg);

        /* Размер 1 SVG-единицы на экране */
        var pxSize = mapVB.w / MAP_W;

        /* Границы видимой области (с запасом) */
        var vLeft = mapVB.x - mapVB.w * 0.1;
        var vRight = mapVB.x + mapVB.w * 1.1;
        var vTop = mapVB.y - mapVB.h * 0.1;
        var vBottom = mapVB.y + mapVB.h * 1.1;
        function inView(sx, sz) { return sx >= vLeft && sx <= vRight && sz >= vTop && sz <= vBottom; }

        var parts = [];

        /* ---- 1. Подписи регионов (самый нижний слой) ---- */
        var regionFontSize = Math.max(8, 16 * pxSize).toFixed(1);
        var regionMap = {};  /* name → {sumX, sumZ, cnt} */
        JUMP_SYSTEMS.forEach(function (s) {
            var rName = JUMP_REGIONS[s[2]];
            if (!rName) return;
            if (!regionMap[rName]) regionMap[rName] = { sumX: 0, sumZ: 0, cnt: 0 };
            regionMap[rName].sumX += s[4];
            regionMap[rName].sumZ += s[6];
            regionMap[rName].cnt++;
        });
        var activeSet = {};
        getActiveRegions().forEach(function (r) { activeSet[r] = true; });
        Object.keys(regionMap).forEach(function (rName) {
            var r = regionMap[rName];
            var rcx = toSVG_X(r.sumX / r.cnt);
            var rcz = toSVG_Z(r.sumZ / r.cnt);
            if (!inView(rcx, rcz)) return;
            var faction = REGION_FACTION[rName] || '';
            var rColor = FACTION_COLOR[faction] || '#4a6080';
            var opacity = activeSet[rName] ? 0.4 : 0.15;
            parts.push('<text x="' + rcx.toFixed(1) + '" y="' + rcz.toFixed(1) +
                '" fill="' + rColor + '" opacity="' + opacity + '" font-size="' + regionFontSize +
                '" font-family="Rajdhani, sans-serif" font-weight="700" letter-spacing="0.08em"' +
                ' text-transform="uppercase" text-anchor="middle" dominant-baseline="middle" pointer-events="none">' +
                esc(rName) + '</text>');
        });

        /* ---- 2. Линии звёздных врат ---- */
        var gateStroke = Math.max(0.3, 0.8 * pxSize).toFixed(2);
        var gates = buildGateLinks();
        gates.forEach(function (pair) {
            var a = pair[0], b = pair[1];
            var ax = toSVG_X(a[4]), az = toSVG_Z(a[6]);
            var bx = toSVG_X(b[4]), bz = toSVG_Z(b[6]);
            /* Рисуем только видимые */
            if (!inView(ax, az) && !inView(bx, bz)) return;
            parts.push('<line x1="' + ax.toFixed(1) + '" y1="' + az.toFixed(1) +
                '" x2="' + bx.toFixed(1) + '" y2="' + bz.toFixed(1) +
                '" stroke="#2a3f5c" stroke-width="' + gateStroke + '" opacity="0.6"/>');
        });

        /* ---- 3. Системы — точки ---- */
        var dotR = Math.max(0.5, 1.4 * pxSize).toFixed(2);
        JUMP_SYSTEMS.forEach(function (s) {
            var px = toSVG_X(s[4]), pz = toSVG_Z(s[6]);
            if (!inView(px, pz)) return;
            var sec = s[3];
            var fill = sec >= 0.45 ? '#4a8' : sec > 0.0 ? '#ba3' : '#a44';
            var op = sec >= 0.45 ? '0.5' : sec > 0.0 ? '0.5' : '0.4';
            parts.push('<circle cx="' + px.toFixed(1) + '" cy="' + pz.toFixed(1) +
                '" r="' + dotR + '" fill="' + fill + '" opacity="' + op + '"/>');
        });

        /* ---- 4. Маркеры эскалаций (верхний слой) ---- */
        var now = Date.now();
        var markerR = Math.max(3, 6 * pxSize).toFixed(2);
        var labelSize = Math.max(5, 10 * pxSize).toFixed(1);
        var strokeW = Math.max(0.5, 1.5 * pxSize).toFixed(2);
        var pulseR = Math.max(5, 12 * pxSize).toFixed(2);
        data.forEach(function (item) {
            if (!item.sx) return;
            var px = toSVG_X(item.sx), pz = toSVG_Z(item.sz);
            if (!inView(px, pz)) return;
            var remaining = (item.created + ESC_LIFETIME) - now;
            var expired = remaining <= 0;
            var remainH = remaining / 3600000;

            /* Цвет по времени: зелёный >15ч, жёлтый 10-15ч, красный 0-10ч, серый */
            var color = expired ? '#555' : remainH > 15 ? '#40c060' : remainH > 10 ? '#c0a020' : '#e04040';
            if (item.sold) color = '#4080c0';
            var opacity = expired ? 0.4 : 1;

            /* Свечение вокруг активных маркеров */
            if (!expired) {
                parts.push('<circle cx="' + px.toFixed(1) + '" cy="' + pz.toFixed(1) +
                    '" r="' + pulseR + '" fill="' + color + '" fill-opacity="0.15"/>');
            }

            parts.push('<circle cx="' + px.toFixed(1) + '" cy="' + pz.toFixed(1) +
                '" r="' + markerR + '" fill="' + color + '" fill-opacity="' + opacity +
                '" stroke="' + color + '" stroke-width="' + strokeW + '" stroke-opacity="0.3">' +
                '<title>' + esc(item.system) + ' — ' + esc(item.type) + ' (' + fmtTimer(remaining) + ')' + (item.sold ? ' [ПРОДАНО]' : '') + '</title></circle>');

            /* Подпись системы */
            parts.push('<text x="' + (px + parseFloat(markerR) + 2 * pxSize).toFixed(1) + '" y="' + (pz + parseFloat(labelSize) * 0.35).toFixed(1) +
                '" fill="' + color + '" opacity="' + opacity + '" font-size="' + labelSize +
                '" font-family="Rajdhani, sans-serif" font-weight="600" pointer-events="none">' +
                esc(item.system) + '</text>');
        });

        svg.innerHTML = parts.join('');
    }

    /* ===================== Пан и зум карты ===================== */
    function bindMapPanZoom() {
        var svg = document.getElementById('esc-svg');
        if (!svg) return;
        var wrap = svg.parentElement;

        /* --- Mouse drag (пан) --- */
        var dragging = false, dragStart = null, wheelRedraw = null;
        svg.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            dragging = true;
            dragStart = { mx: e.clientX, my: e.clientY, vx: mapVB.x, vy: mapVB.y };
            svg.style.cursor = 'grabbing';
            e.preventDefault();
        });
        window.addEventListener('mousemove', function (e) {
            if (!dragging || !dragStart) return;
            /* Пиксели экрана → единицы SVG */
            var rect = svg.getBoundingClientRect();
            var sx = mapVB.w / rect.width;
            var sy = mapVB.h / rect.height;
            mapVB.x = dragStart.vx - (e.clientX - dragStart.mx) * sx;
            mapVB.y = dragStart.vy - (e.clientY - dragStart.my) * sy;
            applyViewBox(svg);
        });
        window.addEventListener('mouseup', function () {
            if (dragging) {
                dragging = false;
                svg.style.cursor = 'grab';
                saveMapView(mapVB);
            }
        });

        /* --- Touch drag (мобильный пан) --- */
        var touchStart = null;
        svg.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            var t = e.touches[0];
            touchStart = { mx: t.clientX, my: t.clientY, vx: mapVB.x, vy: mapVB.y };
        }, { passive: true });
        svg.addEventListener('touchmove', function (e) {
            if (!touchStart || e.touches.length !== 1) return;
            var t = e.touches[0];
            var rect = svg.getBoundingClientRect();
            var sx = mapVB.w / rect.width;
            var sy = mapVB.h / rect.height;
            mapVB.x = touchStart.vx - (t.clientX - touchStart.mx) * sx;
            mapVB.y = touchStart.vy - (t.clientY - touchStart.my) * sy;
            applyViewBox(svg);
            e.preventDefault();
        }, { passive: false });
        svg.addEventListener('touchend', function () {
            if (touchStart) {
                touchStart = null;
                saveMapView(mapVB);
            }
        }, { passive: true });

        /* --- Wheel zoom --- */
        svg.addEventListener('wheel', function (e) {
            e.preventDefault();
            var rect = svg.getBoundingClientRect();
            /* Позиция мыши в SVG-координатах */
            var mx = mapVB.x + ((e.clientX - rect.left) / rect.width) * mapVB.w;
            var my = mapVB.y + ((e.clientY - rect.top) / rect.height) * mapVB.h;

            var factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
            /* Ограничения: не меньше 30×24 (сильный зум) и не больше полной карты ×1.5 */
            var newW = mapVB.w * factor;
            var newH = mapVB.h * factor;
            if (newW < 30 || newH < 24) return;
            if (newW > MAP_W * 1.5 || newH > MAP_H * 1.5) return;

            /* Зум к точке под курсором */
            mapVB.x = mx - (mx - mapVB.x) * factor;
            mapVB.y = my - (my - mapVB.y) * factor;
            mapVB.w = newW;
            mapVB.h = newH;
            applyViewBox(svg);
            saveMapView(mapVB);
            /* Перерисовать с задержкой (для обновления размеров маркеров) */
            clearTimeout(wheelRedraw);
            wheelRedraw = setTimeout(function () { drawMap(); }, 200);
        }, { passive: false });

        /* --- Двойной клик — сброс вида --- */
        svg.addEventListener('dblclick', function (e) {
            e.preventDefault();
            mapVB = calcInitialVB();
            applyViewBox(svg);
            saveMapView(mapVB);
            drawMap(); /* перерисовать с новыми размерами */
        });

        svg.style.cursor = 'grab';

        /* --- Кнопки +/−/⌂ --- */
        function zoomBy(factor) {
            var cx = mapVB.x + mapVB.w / 2;
            var cy = mapVB.y + mapVB.h / 2;
            var nw = mapVB.w * factor, nh = mapVB.h * factor;
            if (nw < 30 || nh < 24 || nw > MAP_W * 1.5 || nh > MAP_H * 1.5) return;
            mapVB.x = cx - nw / 2;
            mapVB.y = cy - nh / 2;
            mapVB.w = nw;
            mapVB.h = nh;
            applyViewBox(svg);
            saveMapView(mapVB);
            drawMap();
        }
        var btnIn = document.getElementById('esc-zoom-in');
        var btnOut = document.getElementById('esc-zoom-out');
        var btnReset = document.getElementById('esc-zoom-reset');
        if (btnIn) btnIn.addEventListener('click', function () { zoomBy(1 / 1.4); });
        if (btnOut) btnOut.addEventListener('click', function () { zoomBy(1.4); });
        if (btnReset) btnReset.addEventListener('click', function () {
            try { localStorage.removeItem(LS_VIEW_KEY); } catch (e) {}
            mapVB = calcInitialVB();
            applyViewBox(svg);
            drawMap();
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

        /* --- 2. Чекбоксы персонажей — мгновенно фильтруют список и обновляют select --- */
        var charsListDiv = document.getElementById('esc-chars-list');
        if (charsListDiv) {
            charsListDiv.addEventListener('change', function (e) {
                if (!e.target.classList.contains('esc-char-cb')) return;
                var cbs = charsListDiv.querySelectorAll('.esc-char-cb');
                var selected = [];
                cbs.forEach(function (cb) { if (cb.checked) selected.push(cb.value); });
                saveVisiblePilots(selected);
                /* Обновляем select пилотов */
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
                /* Перерисовываем список и карту */
                render();
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
                    sold: false,
                    created: Date.now(),
                    sx: sys ? sys.x : null,
                    sz: sys ? sys.z : null
                };

                data.push(entry);
                saveData(data);
                render();
            });
        }

        /* Клики по списку: удаление, продано, редактирование времени */
        var list = root.querySelector('.esc-list');
        if (list) {
            list.addEventListener('click', function (e) {
                /* Удаление */
                if (e.target.classList.contains('esc-del')) {
                    var item = e.target.closest('.esc-item');
                    if (!item) return;
                    data = data.filter(function (d) { return d.id !== item.dataset.id; });
                    saveData(data);
                    render();
                    return;
                }
                /* Кнопка «Продано» */
                if (e.target.classList.contains('esc-sold-btn')) {
                    var item = e.target.closest('.esc-item');
                    if (!item) return;
                    var id = item.dataset.id;
                    var found = data.find(function (d) { return d.id === id; });
                    if (found) {
                        found.sold = !found.sold;
                        saveData(data);
                        render();
                    }
                    return;
                }
                /* Редактирование времени */
                if (e.target.classList.contains('esc-time-edit')) {
                    var item = e.target.closest('.esc-item');
                    if (!item) return;
                    var id = item.dataset.id;
                    var found = data.find(function (d) { return d.id === id; });
                    if (!found) return;

                    /* Показываем инлайн-редактор вместо таймера */
                    var wrap = e.target.closest('.esc-timer-wrap');
                    if (!wrap) return;
                    var remaining = (found.created + ESC_LIFETIME) - Date.now();
                    var hLeft = Math.max(0, Math.floor(remaining / 3600000));
                    var mLeft = Math.max(0, Math.floor((remaining % 3600000) / 60000));
                    wrap.innerHTML =
                        '<span class="esc-time-editor">' +
                        '<input type="number" class="ct-input esc-time-h" value="' + hLeft + '" min="0" max="24" title="Часы"> ч ' +
                        '<input type="number" class="ct-input esc-time-m" value="' + mLeft + '" min="0" max="59" title="Минуты"> м ' +
                        '<button type="button" class="btn esc-time-ok" title="Сохранить">✓</button>' +
                        '<button type="button" class="esc-time-cancel" title="Отмена">✕</button>' +
                        '</span>';

                    var hInput = wrap.querySelector('.esc-time-h');
                    hInput.focus();
                    hInput.select();

                    /* Применение по Enter */
                    function applyTimeEdit() {
                        var h = parseInt(wrap.querySelector('.esc-time-h').value, 10) || 0;
                        var m = parseInt(wrap.querySelector('.esc-time-m').value, 10) || 0;
                        var newRemaining = (h * 3600000) + (m * 60000);
                        found.created = Date.now() - ESC_LIFETIME + newRemaining;
                        saveData(data);
                        render();
                    }

                    wrap.querySelector('.esc-time-ok').addEventListener('click', applyTimeEdit);
                    wrap.querySelector('.esc-time-cancel').addEventListener('click', function () {
                        render();
                    });

                    /* Enter на полях часов/минут */
                    wrap.querySelectorAll('.esc-time-h, .esc-time-m').forEach(function (inp) {
                        inp.addEventListener('keydown', function (ev) {
                            if (ev.key === 'Enter') { ev.preventDefault(); applyTimeEdit(); }
                            if (ev.key === 'Escape') { ev.preventDefault(); render(); }
                        });
                    });
                    return;
                }
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
                /* Обновляем класс цвета по времени */
                var item = el.closest('.esc-item');
                if (item) {
                    var remainH = remaining / 3600000;
                    item.classList.remove('esc-time-green', 'esc-time-yellow', 'esc-time-red', 'esc-time-grey');
                    if (remaining <= 0) item.classList.add('esc-time-grey');
                    else if (remainH > 15) item.classList.add('esc-time-green');
                    else if (remainH > 10) item.classList.add('esc-time-yellow');
                    else item.classList.add('esc-time-red');
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
