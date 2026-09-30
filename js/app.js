// Переключение вкладок: снимаем класс .active со всех секций и вешаем
// его на ту, кнопка которой нажата. Активную кнопку подсвечивает CSS через :has().
document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Экранируем текст, чтобы названия ресурсов не ломали разметку
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[ch]));

// Иконка ресурса, если она есть в RESOURCE_ICONS.
// alt="" — название и так идёт рядом текстом, чтобы не дублировать для скринридера
const iconFor = (name) => {
    const src = RESOURCE_ICONS[name];
    if (!src) return '';
    return `<img class="res-icon" src="${src}" alt="" width="24" height="24" loading="lazy" onerror="this.remove()">`;
};

/* ============================================================
   Аккаунт — это линия. В линии одного аккаунта стоят карточки
   персонажей: не больше CARDS_LIMIT штук, и все они в один ряд.
   Сами линии создаёт кнопка «Добавить» в блоке выбора аккаунта.

   Карточка: 7 колонок. Над таблицей — шапка с именем персонажа
   и крестиком (как у линии аккаунта), под ней заголовки и 6 строк.
   «Система», «Статус», «Корабль» объединены на все 6 строк.
   «Планета» -> «P0» -> «P1» связаны каскадом из PLANET_RESOURCES.
   ============================================================ */

const CARDS_LIMIT = 3;
const COLONY_ROWS = 6;

// Римские номера планет: I..XII
const ROMAN_NUMBERS = ['I', 'II', 'III', 'IV', 'V', 'VI',
                       'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Хаулеры Uwell для перевозки ресурсов с планет.
// Их typeID сверены с ESI: Deluge 81046, Epithal 655.
const SHIP_OPTIONS = ['Deluge', 'Epithal'];

/* Пока система не выбрана, список «Планета» — это восемь типов из
   PLANET_RESOURCES: без системы взять нечего, а каскад
   «тип планеты -> P0 -> P1» должен работать и так. */
const PLANET_TYPES = Object.keys(PLANET_RESOURCES);

// Заголовки карточки — идут под шапкой с именем персонажа.
// «Статус» — колонка с кнопкой, которая красит карточку.
const CARD_HEADERS = ['Система', 'Статус', 'Планета', '№', 'P0', 'P1', 'Корабль'];

/* Ширины колонок карточки, тот же порядок, что у CARD_HEADERS.
   Таблица ужимается до ширины карточки, и без заданных ширин колонки
   «поделят» её поровну, а P0 с P1 окажутся тесными.

   «Статус» — единственная колонка с шириной в пикселях: в ячейке лежит
   только кнопка 💡 шириной 38px, а заголовку нужно 38px на слово «СТАТУС».
   Процент тут не годится — на карточке в 295px восемь процентов
   превращались в 23px: заголовок переносился на семь строк, а кнопка
   сжималась до 11px. 46px одинаково годятся и на 295px, и на 600px.

   Остальные шесть заданы процентами. Сумма их намеренно равна 100%:
   вместе с 46px «Статуса» она даёт больше ширины таблицы, и браузер
   ужимает именно процентные колонки — «Статус» всегда остаётся ровно
   46px. Если сумму сделать меньше 100%, остаток уйдёт в «Статус», и на
   широкой карточке колонка распухнет обратно до 8% (проверено: 50px).
   (calc вида «процент минус пиксели» в <col> при table-layout: fixed
   браузер отбрасывает — поэтому и обходимся без него.)

   Доли: P0 и P1 шире прочих (самое длинное слово плюс иконка слева от
   списка), Система и Планета вдвое уже, № и Корабль — самые узкие.
   Порядок как у CARD_HEADERS: Статус — вторая колонка. */
const STATUS_COL_WIDTH = '46px';
const CARD_COL_WIDTHS = ['13%', STATUS_COL_WIDTH, '13%', '6%', '26%', '26%', '16%'];

/* Классы заголовков, тот же порядок, что у CARD_HEADERS. Нужны, чтобы
   задать узкой колонке «Статус» свои отступы: при общих 0.35rem слово
   «СТАТУС» в 46px не помещается и переносится на три строки.
   Пустая строка — класс не нужен. */
const CARD_HEAD_CLASSES = ['', 'ct-status', '', '', '', '', ''];

/* ---- Хранилище ----
   Имён пилотов и названий аккаунтов мы не знаем, поэтому их вводит пользователь.
   Сохраняем в localStorage структуру «аккаунт → его персонажи» и по ней
   восстанавливаем линии при загрузке.
   try/catch: приватный режим или запрет хранилища не должны ломать страницу. */
const ACCOUNTS_KEY = 'evepi.accounts';

/* Ключ прошлой версии, где аккаунтов не было, а карточки лежали одним рядом.
   Держим, чтобы однажды прочитанные имена переехали в линию, а не пропали. */
const CARDS_KEY = 'evepi.cards';

const accounts = document.getElementById('accounts');
const accountInput = document.getElementById('account-new');
const accountAdd = document.getElementById('account-add');
const accountCounter = document.getElementById('account-counter');
const cardsHint = document.getElementById('cards-hint');

const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            // молча работаем без сохранения
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            // молча работаем без сохранения
        }
    }
};

// Собирает HTML из списка <option> с отметкой selected у нужного значения.
// Объявлено до первого обращения: const нельзя использовать до инициализации.
const optionsHtml = (values, selected) => values
    .map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`)
    .join('');

/* ---- Регионы и системы ----
   Списка в ячейке два, а вариантов в них 114 регионов и до 8490 систем.
   Если разложить их сразу при создании карточки, девять карточек дадут
   больше полумиллиона <option> — страница замрёт. Поэтому списки
   создаются пустыми, а варианты добавляются в тот, который открыли.

   Пока вариантов нет, в списке лежит один заполнитель: он же
   напоминание, какую колонку открыли. Разметка списка регионов
   собирается один раз на страницу, разметка списка систем — отдельно
   для каждого региона: регионов 114, и каждый со своим набором. */
const REGION_PLACEHOLDER = '<option value="">Все регионы</option>';
const SYSTEM_PLACEHOLDER = '<option value="">Система</option>';

let regionListHtml = null;
const systemListHtml = new Map();

/* Регион и система стоят в одной объединённой ячейке, поэтому регион
   берём из неё же, а не ищем по таблице. */
function regionOf(systemSelect) {
    const region = systemSelect.closest('td').querySelector('[data-role="region"]');
    return region ? region.value : '';
}

function fillRegions(select) {
    if (select.dataset.filled) return;

    if (regionListHtml === null) {
        regionListHtml = REGION_PLACEHOLDER
            + EVE_REGIONS.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    }

    select.innerHTML = regionListHtml;
    select.dataset.filled = '1';
    syncTitle(select, 'Регион не выбран');
}

// Разметка списка систем для региона. Ключ '' — случай, когда регион
// не выбран и показываются все системы.
function systemsHtml(region) {
    if (!systemListHtml.has(region)) {
        const list = region ? SYSTEMS_BY_REGION[region] : SOLAR_SYSTEMS;
        systemListHtml.set(region, SYSTEM_PLACEHOLDER
            + (list || []).map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''));
    }

    return systemListHtml.get(region);
}

/* Ставит в список системы выбранного региона. Список начинается заново
   с заполнителя: сменили регион — прежняя система в новый список не
   входит, и незачем оставлять её выбранной. */
function applySystems(select, region) {
    select.innerHTML = systemsHtml(region);
    select.dataset.filled = '1';
    syncTitle(select, 'Система не выбрана');
}

function fillSystems(select) {
    if (select.dataset.filled) return;
    applySystems(select, regionOf(select));
}

// Выбранное значение целиком в подсказку. Колонка узкая, в ячейке имя
// обрезается до пары знаков, а наведение показывает его полностью.
function syncTitle(select, empty) {
    const option = select.selectedOptions[0];
    select.title = option && option.value ? option.value : empty;
}

/* Списки добираем в тот момент, когда их открывают: mousedown ловит
   мышь, focusin — переход с клавиатуры. */
function prepareCardList(event) {
    const region = event.target.closest('[data-role="region"]');
    if (region) {
        fillRegions(region);
        return;
    }

    const system = event.target.closest('[data-role="system"]');
    if (system) fillSystems(system);
}

/* ---- Типы планет системы ----
   Список типов берётся из PLANET_TYPES_BY_SYSTEM, он записан строкой,
   поэтому разбирается один раз на систему и кладётся в planetCache.

   Имени планеты в списке нет: товары PI зависят от типа и системы, а
   планет одного типа в системе может быть несколько. Номер планеты
   стоит в соседней колонке «№». */
const planetCache = new Map();

function planetTypesOf(systemName) {
    if (planetCache.has(systemName)) return planetCache.get(systemName);

    const list = (PLANET_TYPES_BY_SYSTEM[systemName] || '')
        .split(',')
        .filter(Boolean)
        .map((code) => PLANET_TYPE_CODES[code] || '');

    planetCache.set(systemName, list);
    return list;
}

// Тип планеты, выбранный в строке: значение списка и есть тип.
// Пустое значение — у типа нет товаров: это Shattered или
// Scorched Barren, которых в PLANET_RESOURCES нет.
function planetTypeOf(row) {
    const cell = row.querySelector('[data-role="planet"]');
    return cell ? cell.value : '';
}

// Пересобирает список типов во всех шести строках карточки.
function fillPlanets(card, systemName) {
    const list = systemName ? planetTypesOf(systemName) : [];

    /* Пустой список у выбранной системы — это не «пока не с чего выбрать»,
       а прямое отсутствие планет: система пустая (червоточина, космос
       Абенниса) либо её нет в зеркале SDE. Все восемь типов здесь
       показывать нельзя, они относятся к галактике в целом, а не к этой
       системе. Система не выбрана — другое дело, там список типов
       по умолчанию. */
    const options = !systemName
        ? optionsHtml(PLANET_TYPES, PLANET_TYPES[0])
        : (list.length
            ? optionsHtml(list, list[0])
            : '<option value="">Нет данных о планетах</option>');

    card.querySelectorAll('[data-role="planet"]').forEach((cell) => {
        cell.innerHTML = options;
        syncTitle(cell, 'Тип планеты не выбран');
    });

    // Каскад поехал за типами
    card.querySelectorAll('tbody tr').forEach((row) => {
        fillP0(row);
        fillP1(row);
    });
}

// Одна строка карточки. Параметр index — порядковый номер строки от 0 до 5.
// Значения по умолчанию берём из первого типа планеты в PLANET_RESOURCES.
function buildColonyRow(index) {
    const firstPlanet = PLANET_TYPES[0] || '';
    const firstResources = PLANET_RESOURCES[firstPlanet] || [];
    const firstP0 = firstResources[0] ? firstResources[0].P0 : '';

    // В первой строке идут объединённые ячейки, в остальных — нет
    const merged = index === 0
        ? `<td class="ct-system" rowspan="${COLONY_ROWS}">
               <select class="ct-input" data-role="region" aria-label="Регион" title="Регион не выбран">${REGION_PLACEHOLDER}</select>
               <select class="ct-input" data-role="system" aria-label="Система" title="Система не выбрана">${SYSTEM_PLACEHOLDER}</select>
           </td>
           <td class="ct-status" rowspan="${COLONY_ROWS}">
               <button type="button" class="card-light" aria-pressed="false" title="Подсветить карточку" aria-label="Подсветить карточку">💡</button>
           </td>`
        : '';

    const shipCell = index === 0
        ? `<td class="ct-ship" rowspan="${COLONY_ROWS}">
               <select class="ct-input" data-role="ship" aria-label="Корабль">${optionsHtml(SHIP_OPTIONS, SHIP_OPTIONS[0])}</select>
           </td>`
        : '';

    return `
        <tr data-row="${index}">
            ${merged}
            <td class="ct-planet">
                <select class="ct-input" data-role="planet" aria-label="Тип планеты"
                        title="Сначала выберите систему — тогда здесь будут типы её планет">
                    ${optionsHtml(PLANET_TYPES, firstPlanet)}
                </select>
            </td>
            <td class="ct-number">
                <select class="ct-input" data-role="number" aria-label="Номер планеты">
                    ${optionsHtml(ROMAN_NUMBERS, ROMAN_NUMBERS[index % ROMAN_NUMBERS.length])}
                </select>
            </td>
            <td class="ct-p0">
                <div class="res-stack">
                    <select class="ct-input" data-role="p0" aria-label="Ресурс P0">
                        ${optionsHtml(firstResources.map((r) => r.P0), firstP0)}
                    </select>
                </div>
            </td>
            <td class="ct-p1">
                <div class="res-stack">
                    <select class="ct-input" data-role="p1" aria-label="Ресурс P1"></select>
                </div>
            </td>
            ${shipCell}
        </tr>`;
}

/* Вся карточка: шапка с именем персонажа и крестиком (классы те же,
   что у линии аккаунта), под ней таблица с заголовками и 6 строками.
   Имя попадает и в data-name — по нему карточка восстанавливается при загрузке. */
function buildCard(name) {
    const rows = Array.from({ length: COLONY_ROWS }, (_, i) => buildColonyRow(i)).join('');
    const safe = escapeHtml(name);

    return `
        <div class="card" data-name="${safe}">
            <div class="account-bar">
                <h3 class="account-name">${safe}</h3>
                <button type="button" class="account-del" data-role="card-del"
                        title="Удалить карточку"
                        aria-label="Удалить карточку ${safe}">&times;</button>
            </div>
            <table class="colony-table">
                <colgroup>${CARD_COL_WIDTHS.map((w) => `<col style="width:${w}">`).join('')}</colgroup>
                <thead>
                    <tr>${CARD_HEADERS.map((h, i) => `<th scope="col"${CARD_HEAD_CLASSES[i] ? ` class="${CARD_HEAD_CLASSES[i]}"` : ''}>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// Список P0 — пять товаров планеты выбранного типа. Прежний P0,
// если он есть в новом списке, остаётся на месте.
function fillP0(row) {
    const resources = (PLANET_RESOURCES[planetTypeOf(row)] || []).map((r) => r.P0);
    const p0Select = row.querySelector('[data-role="p0"]');
    const p0 = p0Select.value;

    p0Select.innerHTML = resources.length
        ? optionsHtml(resources, resources.includes(p0) ? p0 : resources[0])
        : '<option value="">—</option>';
}

// Значение P1 берём из PLANET_RESOURCES по выбранному типу планеты и P0
function fillP1(row) {
    const resources = PLANET_RESOURCES[planetTypeOf(row)] || [];
    const p0 = row.querySelector('[data-role="p0"]').value;
    const p1Select = row.querySelector('[data-role="p1"]');
    const entry = resources.find((r) => r.P0 === p0);

    // У части ресурсов P1 нет — показываем прочерк
    p1Select.innerHTML = entry && entry.P1
        ? optionsHtml([entry.P1], entry.P1)
        : '<option value="">—</option>';
    p1Select.disabled = !(entry && entry.P1);

    // Иконки в ячейках P0 и P1 следуют за выбранными ресурсами
    updateResIcon(row.querySelector('.ct-p0'));
    updateResIcon(row.querySelector('.ct-p1'));
}

// Иконка над списком в ячейке P0 или P1 — по выбранному ресурсу.
// Если иконки для ресурса нет (или P1 отсутствует), картинка убирается.
function updateResIcon(cell) {
    const select = cell.querySelector('[data-role]');
    const stack = cell.querySelector('.res-stack');
    const icon = stack.querySelector('.res-icon');
    const src = RESOURCE_ICONS[select.value];

    if (!src) {
        if (icon) icon.remove();
    } else if (icon) {
        icon.src = src;
    } else {
        stack.insertAdjacentHTML('afterbegin', iconFor(select.value));
    }
}

// Фон ячейки «Корабль» — картинка выбранного корабля.
// Картинку ставит не CSS, а JS: она зависит от выбора в списке.
// Если корабля нет в SHIP_IMAGES, фон остаётся пустым.
function fillShip(row) {
    const cell = row.querySelector('.ct-ship');
    if (!cell) return;

    const src = SHIP_IMAGES[cell.querySelector('[data-role="ship"]').value];
    cell.style.backgroundImage = src ? `url("${src}")` : '';
}

/* ---- Линия аккаунта ----
   Одна линия — один аккаунт. Сверху его имя, под ним выбор персонажа
   и ряд карточек. Разметку линии собирает buildAccountLine, а слушатели
   вешает initLine — по элементам конкретной линии. */

let lineSeq = 0;

function buildAccountLine(name) {
    // Идентификаторы полей персонажа у каждой линии свои: иначе в
    // документе окажется несколько полей с одним id, и подпись
    // «Персонаж» перестанет указывать на своё поле.
    const pilotId = `pilot-${++lineSeq}`;

    // Имя аккаунта в линии — заголовок, а не поле: назвать аккаунт
    // можно один раз, в общем блоке наверху страницы. Без имени
    // заголовок был бы пустым, поэтому подставляем слово «Аккаунт».
    const title = escapeHtml(name) || 'Аккаунт';

    return `
        <section class="account-line" data-account="${title}">
            <div class="account-bar">
                <h3 class="account-name">${title}</h3>
                <button type="button" class="account-del" data-role="account-del"
                        title="Удалить линию аккаунта вместе с карточками"
                        aria-label="Удалить линию аккаунта ${title}">&times;</button>
            </div>

            <div class="card-head">
                <label class="card-pilot-label" for="${pilotId}">Персонаж</label>
                <input type="text" id="${pilotId}" class="ct-input card-new" data-role="pilot"
                       placeholder="Имя персонажа" maxlength="32" autocomplete="off">
                <button type="button" class="btn card-add" data-role="pilot-add">Добавить</button>
                <span class="card-counter" data-role="line-counter" aria-live="polite">0 из ${CARDS_LIMIT}</span>
            </div>

            <div class="card-hint" data-role="line-hint">
                Введите имя персонажа и нажмите «Добавить» — появится карточка
            </div>

            <div class="cards-row" data-role="cards">
                <!-- карточки создаются в app.js -->
            </div>
        </section>`;
}

/* Каскад: планета -> список P0, затем P0 -> P1, и фон ячейки корабля.
   Слушатель общий для всех линий: сначала пересчёт, потом сохранение,
   чтобы содержимое строк переживало перезагрузку страницы. */
function handleRowChange(event) {
    const row = event.target.closest('tbody tr');
    if (!row) return;

    applyRowChange(event, row);
    saveAccounts();
}

function applyRowChange(event, row) {
    // Смена региона пересобирает список систем в той же ячейке
    if (event.target.dataset.role === 'region') {
        const cell = event.target.closest('td');
        applySystems(cell.querySelector('[data-role="system"]'), event.target.value);
        syncTitle(event.target, 'Регион не выбран');
        // Система сброшена, значит прежние типы в списке больше не нужны
        fillPlanets(event.target.closest('.card'), '');
        return;
    }

    // Смена системы пересобирает список типов во всех шести строках
    if (event.target.dataset.role === 'system') {
        syncTitle(event.target, 'Система не выбрана');
        fillPlanets(event.target.closest('.card'), event.target.value);
        return;
    }

    if (event.target.dataset.role === 'planet') {
        fillP0(row);
        syncTitle(event.target, 'Тип планеты не выбран');
    }

    if (event.target.dataset.role === 'planet' || event.target.dataset.role === 'p0') {
        fillP1(row);
    }

    if (event.target.dataset.role === 'ship') {
        fillShip(row);
    }
}

// Кнопка 💡 красит карточку, крестик в шапке — удаляет её.
// Оба действия относятся к той карточке, в которой нажали, поэтому
// линию аккаунта находим от самой кнопки.
function handleCardClick(event) {
    const light = event.target.closest('.card-light');
    if (light) {
        // Подсветка намеренно не сохраняется: это временное выделение, а не данные
        const lit = light.closest('.card').classList.toggle('is-lit');
        light.setAttribute('aria-pressed', String(lit));
        return;
    }

    const del = event.target.closest('[data-role="card-del"]');
    if (!del) return;

    const line = del.closest('.account-line');
    del.closest('.card').remove();
    saveAccounts();
    refreshLine(line);
}

// Счётчик, блокировка ввода и подсказка внутри одной линии
function refreshLine(line) {
    const count = line.querySelector('[data-role="cards"]').children.length;
    const full = count >= CARDS_LIMIT;

    line.querySelector('[data-role="line-counter"]').textContent = `${count} из ${CARDS_LIMIT}`;
    line.querySelector('[data-role="pilot"]').disabled = full;
    line.querySelector('[data-role="pilot-add"]').disabled = full;
    line.querySelector('[data-role="line-hint"]').hidden = count > 0;
}

// Счётчик аккаунтов и общая подсказка, пока линий нет
function refreshAccounts() {
    const count = accounts.children.length;
    accountCounter.textContent = `Аккаунтов: ${count}`;
    cardsHint.hidden = count > 0;
}

/* Сохраняем структуру «аккаунт → его карточки», а в каждой карточке —
   всё, что в ней выбрано. Тогда после обновления страницы возвращаются
   не только имена, но и системы, типы планет, P0, P1 и корабли.

   Подсветка карточки (кнопка 💡) намеренно не сохраняется: это
   временное выделение, а не данные. */
function saveAccounts() {
    store.set(ACCOUNTS_KEY, Array.from(accounts.children).map((line) => ({
        name: line.dataset.account,
        cards: Array.from(line.querySelector('[data-role="cards"]').children).map(readCard)
    })));
}

const readValue = (root, role) => {
    const cell = root.querySelector(`[data-role="${role}"]`);
    return cell ? cell.value : '';
};

// Снимок карточки для хранилища
function readCard(card) {
    return {
        name: card.dataset.name,
        region: readValue(card, 'region'),
        system: readValue(card, 'system'),
        ship: readValue(card, 'ship'),
        rows: Array.from(card.querySelectorAll('tbody tr')).map((row) => ({
            planet: readValue(row, 'planet'),
            number: readValue(row, 'number'),
            p0: readValue(row, 'p0'),
            p1: readValue(row, 'p1')
        }))
    };
}

/* Настоящее название ресурса в EVE — «Complex Organists», так оно
   лежит в SDE и в ESI. Раньше в data.js было написано «Complex
   Organisms», и это успело попасть в хранилище: старое значение
   переводим на правильное, иначе выбор молча потерялся бы. */
const RESOURCE_RENAMES = {
    "Complex Organisms": "Complex Organists"
};

/* Ставит значение, только если такой вариант есть в списке: данные
   могли устареть (например, систему убрали из SDE), и тогда строка
   остаётся как есть, молча и без ошибки. Событие change нужно
   обработчикам — они пересобирают списки P0 и P1. */
function pickValue(cell, value) {
    if (!cell || !value) return;

    const wanted = RESOURCE_RENAMES[value] || value;
    const has = Array.from(cell.options).some((o) => o.value === wanted);
    if (!has) return;

    cell.value = wanted;
    cell.dispatchEvent(new Event('change', { bubbles: true }));
}

/* Возвращает в карточку сохранённые значения. Порядок важен: сначала
   регион (он наполняет список систем), потом система (она наполняет
   список типов планет), потом в каждой строке тип планеты, его номер,
   P0 и P1. Значение P1 ставится после P0, потому что P1 выбирается
   из списка по P0. */
function restoreCard(card, saved) {
    const region = card.querySelector('[data-role="region"]');
    const system = card.querySelector('[data-role="system"]');

    if (saved.region) {
        fillRegions(region);
        pickValue(region, saved.region);
    }

    if (saved.system) {
        fillSystems(system);
        pickValue(system, saved.system);
    }

    const rows = Array.from(card.querySelectorAll('tbody tr'));
    (Array.isArray(saved.rows) ? saved.rows : []).forEach((data, i) => {
        const row = rows[i];
        if (!row || !data) return;

        pickValue(row.querySelector('[data-role="planet"]'), data.planet);
        pickValue(row.querySelector('[data-role="number"]'), data.number);
        pickValue(row.querySelector('[data-role="p0"]'), data.p0);
        pickValue(row.querySelector('[data-role="p1"]'), data.p1);
    });

    pickValue(card.querySelector('[data-role="ship"]'), saved.ship);
}

/* Создаёт карточку в указанной линии, справа от уже созданных в ней.
   Параметр saved — сохранённые значения, если карточка восстанавливается.
   Возвращает false, если имя пустое или предел CARDS_LIMIT в линии взят. */
function addCard(line, name, saved) {
    const clean = name.trim();
    const cards = line.querySelector('[data-role="cards"]');
    if (!clean || cards.children.length >= CARDS_LIMIT) return false;

    cards.insertAdjacentHTML('beforeend', buildCard(clean));
    const card = cards.lastElementChild;

    if (saved) restoreCard(card, saved);

    // Первичное заполнение каскада, подсказки и фона корабля
    // в строках новой карточки
    card.querySelectorAll('tbody tr').forEach((row) => {
        fillP0(row);
        fillP1(row);
        fillShip(row);
        syncTitle(row.querySelector('[data-role="planet"]'), 'Тип планеты не выбран');
    });

    saveAccounts();
    refreshLine(line);
    return true;
}

/* Создаёт линию аккаунта. Пустое имя запрещаем только при добавлении
   кнопкой: при восстановлении из хранилища линия нужна и без имени,
   тогда заголовком станет слово «Аккаунт». */
function addAccount(name, requireName = true) {
    const clean = name.trim();
    if (requireName && !clean) return null;

    accounts.insertAdjacentHTML('beforeend', buildAccountLine(clean));
    const line = accounts.lastElementChild;

    initLine(line);
    saveAccounts();
    refreshAccounts();
    return line;
}

// Слушатели одной линии. Поле персонажа и кнопка «Добавить» у каждой
// линии свои, поэтому вешаем их прямо на её элементы, а не на общий
// контейнер: так линия ничего не знает о соседних.
function initLine(line) {
    const cards = line.querySelector('[data-role="cards"]');
    const pilot = line.querySelector('[data-role="pilot"]');

    const tryAdd = () => {
        if (pilot.value.trim() && addCard(line, pilot.value)) {
            pilot.value = '';
            pilot.focus();
            return;
        }

        // Пустое имя — подсвечиваем поле, карточка не создаётся
        pilot.classList.add('ct-invalid');
        pilot.focus();
    };

    line.querySelector('[data-role="pilot-add"]').addEventListener('click', tryAdd);
    pilot.addEventListener('input', () => pilot.classList.remove('ct-invalid'));

    // Enter в поле ввода добавляет карточку так же, как кнопка
    pilot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            tryAdd();
        }
    });

    // Крестик убирает линию вместе со всеми её карточками
    line.querySelector('[data-role="account-del"]')
        .addEventListener('click', () => {
            line.remove();
            saveAccounts();
            refreshAccounts();
        });

    cards.addEventListener('change', handleRowChange);
    cards.addEventListener('click', handleCardClick);

    // Списки регионов и систем добираем в тот момент, когда их
    // открывают: mousedown ловит мышь, focusin — переход с клавиатуры.
    cards.addEventListener('mousedown', prepareCardList);
    cards.addEventListener('focusin', prepareCardList);

    refreshLine(line);
}

accountAdd.addEventListener('click', () => {
    if (accountInput.value.trim() && addAccount(accountInput.value)) {
        accountInput.value = '';
        accountInput.focus();
        return;
    }

    accountInput.classList.add('ct-invalid');
    accountInput.focus();
});

accountInput.addEventListener('input', () => accountInput.classList.remove('ct-invalid'));

accountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        accountAdd.click();
    }
});

/* Восстанавливаем линии. Карточка в хранилище бывает двух видов:
   прежняя — просто имя строкой, нынешняя — объект с содержимым.
   Если линий в хранилище нет, а карточки сохранились в старом виде,
   складываем их в одну линию и убираем старый ключ — иначе он остался
   бы лежать рядом и сбивал бы с толку. */
const savedAccounts = store.get(ACCOUNTS_KEY, null);

if (Array.isArray(savedAccounts)) {
    savedAccounts.forEach((account) => {
        const line = addAccount(typeof account.name === 'string' ? account.name : '', false);
        (Array.isArray(account.cards) ? account.cards : [])
            .slice(0, CARDS_LIMIT)
            .forEach((saved) => {
                if (typeof saved === 'string') {
                    addCard(line, saved);
                } else if (saved && typeof saved.name === 'string') {
                    addCard(line, saved.name, saved);
                }
            });
    });
} else {
    const legacyCards = store.get(CARDS_KEY, []);
    if (Array.isArray(legacyCards) && legacyCards.length) {
        const line = addAccount('Основной', false);
        legacyCards.slice(0, CARDS_LIMIT).forEach((name) => addCard(line, String(name)));
        store.remove(CARDS_KEY);
    }
}

refreshAccounts();

/* ---- Вход в EVE Online ----
   Кнопка появляется, только когда в js/eveauth.js вписан client_id:
   без него вход невозможен, и показывать кнопку было бы враньём.
   При возврате из EVE адрес приходит с кодом (?code=...&state=...),
   код обменивается на токен, а токен проверяется через /oauth/verify.

   Пароль EVE сайт не видит и не хранит: его вводит пользователь
   на странице CCP, нам приходит только код. */
const eveBar = document.getElementById('eve-bar');
const eveLoginBtn = document.getElementById('eve-login');
const eveWho = document.getElementById('eve-who');
const eveLogoutBtn = document.getElementById('eve-logout');
const eveHint = document.getElementById('eve-hint');

function renderEveAuth(state, message) {
    const connected = Boolean(state && state.accessToken);

    eveLoginBtn.hidden = connected;
    eveLogoutBtn.hidden = !connected;
    eveWho.hidden = !connected;
    eveWho.textContent = connected ? (state.characterName || 'Персонаж') : '';
    eveHint.textContent = message || '';
}

/* Повторный вызов не должен навешивать слушатели заново: в тестах
   initEveAuth() зовут несколько раз подряд на одной странице. */
let eveAuthReady = false;

async function initEveAuth() {
    if (!eveBar || eveAuthReady) return;
    eveAuthReady = true;
    eveBar.hidden = false;

    if (!eveConfigured()) {
        // Кнопку не показываем: нажать её всё равно нельзя.
        // Подсказка нужна владельцу сайта, а не пользователю.
        eveHint.textContent = 'Вход в EVE не настроен: впишите client_id в js/eveauth.js';
        return;
    }

    eveLoginBtn.addEventListener('click', () => {
        eveLoginBtn.disabled = true;
        eveLogin().catch((e) => {
            eveLoginBtn.disabled = false;
            renderEveAuth(null, 'Не удалось начать вход: ' + e.message);
        });
    });

    eveLogoutBtn.addEventListener('click', async () => {
        eveLogoutBtn.disabled = true;
        const revoked = await eveLogout();
        renderEveAuth(null, revoked
            ? 'Токен отозван, вход завершён'
            : 'Выход выполнен, но EVE не подтвердил отзыв токена');
        eveLogoutBtn.disabled = false;
    });

    // Возврат из EVE
    try {
        const signedIn = await eveHandleCallback();
        if (signedIn) {
            renderEveAuth(signedIn);
            return;
        }
    } catch (e) {
        renderEveAuth(null, 'Вход не состоялся: ' + e.message);
        return;
    }

    // Обычная загрузка: токен мог остаться с прошлого раза.
    // Запоминаем, был ли он, до попытки обновить: обновление само
    // убирает токен, если EVE его отверг, и потерять эту подсказку
    // нельзя — иначе непонятно, входил ли пользователь вообще.
    const hadToken = Boolean(eveState());
    const state = await eveAccess();

    if (!state) {
        renderEveAuth(null, hadToken
            ? 'Сессия EVE истекла — войдите заново'
            : 'Войдите, чтобы читать данные персонажа из ESI');
        return;
    }

    renderEveAuth(state);
}

initEveAuth();