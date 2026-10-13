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

   Карточка: 5 колонок данных. Над таблицей — шапка с именем
   персонажа и крестиком (как у линии аккаунта), над заголовками —
   строка системы: регион, система и кнопка подсветки справа. Затем
   заголовки и 6 строк. «Корабль» объединен на все 6 строк.
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

// Заголовки карточки — идут под шапкой с именем персонажа,
// ниже строки системы. «Статус» убрана: кнопка подсветки 💡 живёт
// в строке системы справа (см. buildCard).
const CARD_HEADERS = ['Планета', 'P0', 'P1'];

/* Ширины колонок карточки, тот же порядок, что у CARD_HEADERS.
   Таблица ужимается до ширины карточки, и без заданных ширин колонки
   «поделят» её поровну, а P0 с P1 окажутся тесными.

   Проценты намеренно дают ровно 100%: при table-layout: fixed браузер
   ужимает процентные колонки, а фиксированных среди них нет.
   (calc вида «процент минус пиксели» в <col> при table-layout: fixed
   браузер отбрасывает — поэтому и обходимся без него.)

   Доли: P0 и P1 шире прочих (самое длинное слово плюс иконка слева от
   списка), Планета и № вдвое уже, Корабль — средняя. */
/* Столбца «№» больше нет: номер стоит в списке «Планета» («VII Barren»),
   поэтому планете отдана его доля. */
// Ширину «Планеты» подгоняет fitCardColumns (по самому длинному тексту),
// остальные столбцы делят остаток поровну
const CARD_COL_WIDTHS = ['auto', 'auto', 'auto'];

/* ---- Карточка P2 ----
   Второй вид карточки, колонки P2|Планета|№|P1|P0|Корабль. Шесть
   строк независимы: у каждой свой товар P2. Столбцы P1 и P0 здесь не
   выбираются — это рецепт выбранного P2, выводимый текстом (в P1 оба
   входа, в P0 их сырьё). Планеты фильтруются по рецепту, а выбранная
   система сужает их до своих типов. */
const CARD_HEADERS_P2 = ['P2', 'Планета', 'P1', 'P0'];

/* «Тест P2» (T2) — тестовая карточка: как P2, но вход рецепта и его сырьё
   стоят рядом, каждый в своей клетке: P1 | P0 | P1 | P0 (картинка слева,
   название справа, без рамок). Ширины столбцов товара и планеты — по самому
   длинному значению (fitCardColumns). Хранится как P2 (поле p2s). */
const TEST2_LEVEL = 'T2';
const isP2Level = (level) => level === 'P2' || level === TEST2_LEVEL;
/* Карточки P2 и P3 теперь устроены как бывшие тестовые: вход/ресурс —
   в своей клетке. Прежние «Тест P2»/«Тест P3» (T2/T3) при загрузке
   становятся обычными P2/P3 (см. addCard). */
const isSplitP3 = (level) => level === 'P3' || level === 'T3';
// Тестовые карточки: у каждой клетки свой заголовок, без объединения.
// «Тест P2» — вход и его сырьё рядом: P1 | P0 | P1 | P0
const CARD_HEADERS_T2 = ['P2', 'Планета', 'P1', 'P0', 'P1', 'P0'];
const HEADER_SPANS = { MIX: [1, 1, 4], TMIX: [1, 1] };
/* P2 — шире, чтобы название товара в списке влезало целиком (кроме
   самого длинного, Genetically Enhanced Livestock — оно видно в
   подсказке и в раскрытом списке). P1 и P0 — одинаковой ширины. */
const CARD_COL_WIDTHS_P2 = ['30%', 'auto', 'auto', 'auto'];

// Товары P2 — это выход рецептов P1->P2 (outQty 5, два входа)
const PI_P2_LIST = PI_RECIPES
    .filter((recipe) => recipe.outQty === 5)
    .map((recipe) => recipe.out)
    .sort();
/* Первый вариант — пустой «—»: новая карточка создаётся незаполненной,
   товар выбирает пользователь. Так же у всех зависимых списков карточек;
   у независимого «Корабля» пустой строки нет. */
const EMPTY_OPTION = '<option value="" selected>—</option>';
const P2_OPTIONS_HTML = EMPTY_OPTION + PI_P2_LIST
    .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
    .join('');
const PI_P2_RECIPE_OF = new Map(
    PI_RECIPES.filter((recipe) => recipe.outQty === 5).map((recipe) => [recipe.out, recipe])
);

/* Где добыть каждый P1: на каких планетах и из какого P0 получается
   этот P1. Один P1 может идти из разных P0 на разных планетах. */
const P1_SOURCES = new Map();
Object.keys(PLANET_RESOURCES).forEach((planet) => {
    (PLANET_RESOURCES[planet] || []).forEach(({ P0, P1 }) => {
        if (!P1) return;
        if (!P1_SOURCES.has(P1)) P1_SOURCES.set(P1, []);
        P1_SOURCES.get(P1).push({ planet, p0: P0 });
    });
});

const uniqValues = (list) => Array.from(new Set(list));

/* ---- Карточки P3 и P4 ----
   Устроены как карточка P2: шесть независимых строк, у каждой свой
   товар. Колонки:
     P3 | Планета | № | P2   — входы рецепта P2->P3
     P4 | Планета | № | P3   — входы рецепта P3->P4
   Столбец входов не выбирается — это рецепт выбранного товара, как на
   карточке P2. У P3 входов 2–3, у P4 — три (иногда один из них P1,
   он идёт в рецепт напрямую).
   Планеты: фабрика P3 (Advanced Industry Facility) ставится на любой
   тип планеты, фабрика P4 (High-Tech Production Plant) — только на
   Barren и Temperate. Выбранная система сужает список до своих типов. */
/* T3 — тестовая карточка «Тест P3»: товары и планеты как у P3, но
   столбец P2 разделён на три части — по клетке на ресурс рецепта, а
   столбцы P3 и «Планета» подогнаны по самому длинному значению
   (см. fitCardColumns). Хранится как P3 (поле prods). */
const TEST_LEVEL = 'T3';
const PROD_LEVELS = ['P3', 'P4', TEST_LEVEL];
const isProdLevel = (level) => PROD_LEVELS.includes(level);
const PROD_OUT_QTY = { P3: 3, P4: 1, T3: 3 };
const PROD_PLANETS = { P3: null, P4: ['Barren', 'Temperate'], T3: null };
const CARD_HEADERS_PROD = {
    P3: ['P3', 'Планета', 'P2', 'P2', 'P2'],
    // P4 — как P2: вход и его состав рядом, каждый в своей клетке
    P4: ['P4', 'Планета', 'P3', 'P3', 'P3'],
    T3: ['P3', 'Планета', 'P2', 'P2', 'P2']
};
// Сколько столбцов занимает заголовок входов (у T3 — свой заголовок у каждой клетки)
const PROD_INPUT_SPAN = { P3: 1, P4: 1, T3: 1 };
// Четыре колонки: товар, планета, №, входы рецепта (самая широкая)
/* Те же ширины, что у карточки P2: блоки входов встают точно под её
   столбцы P1 и P0; заголовок входов растянут на оба (colspan 2). */
const CARD_COL_WIDTHS_PROD = CARD_COL_WIDTHS_P2;
// PI_RECIPE_OF (товар → рецепт) объявлен в js/chains.js

/* ---- Универсальная карточка (MIX) ----
   Шесть строк; каждая сначала пустая, с кнопкой «+ Добавить». Кнопка
   открывает список типов P1…P4 — строка становится строкой этого типа,
   крестик возвращает её к пустой. В списке товаров тип указан в скобках:
   «Coolant (P2)». Колонки — по
   новым карточкам: Товар | Планета | Состав (четыре клетки, ресурс в
   своей клетке).
     P1 — товар P1; планеты, где он добывается; в составе его P0 на
          выбранной планете
     P2 — как карточка P2: входы P1 и их сырьё P0
     P3 — как карточка P3: входы P2, по клетке на вход
     P4 — как карточка P4: входы P3; только Barren и Temperate */
const MIX_LEVEL = 'MIX';
/* «Тест универсальная» (TMIX): те же строки, что у универсальной, но
   каждая — в две линии: сверху «+ Добавить» (или тип текстом «P2»),
   список товара шириной как на других карточках, крестик и «Планета»
   со списком — всё прижато влево; под ними состав (четыре клетки на
   всю ширину). В списке товара тип не дописывается в скобках. Строка таблицы
   одна — вёрстку в две линии делает CSS (grid), поэтому вся логика
   универсальной карточки работает без изменений. Высота — не больше,
   чем у остальных карточек. */
const TMIX_LEVEL = 'TMIX';
const isMixLevel = (l) => l === MIX_LEVEL || l === TMIX_LEVEL;
const CARD_HEADERS_TMIX = ['Товар', 'Планета'];
const MIX_LEVELS = ['P1', 'P2', 'P3', 'P4'];
const CARD_HEADERS_MIX = ['Товар', 'Планета', 'Состав'];
let mixListsCache = null;
function mixListOf(level) {
    if (!mixListsCache) {
        const p1 = uniqValues(Object.values(PLANET_RESOURCES).flat().map((r) => r.P1).filter(Boolean)).sort();
        mixListsCache = { P1: p1, P2: PI_P2_LIST, P3: PROD_LIST.P3, P4: PROD_LIST.P4 };
    }
    return mixListsCache[level] || [];
}
const PROD_LIST = {};
const PROD_OPTIONS_HTML = {};
PROD_LEVELS.forEach((level) => {
    PROD_LIST[level] = PI_RECIPES
        .filter((recipe) => recipe.outQty === PROD_OUT_QTY[level])
        .map((recipe) => recipe.out)
        .sort();
    PROD_OPTIONS_HTML[level] = EMPTY_OPTION + PROD_LIST[level]
        .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
        .join('');
});

/* Ячейка рецепта. Два входа — по макету карточки P2: две области-
   «уголка», сцепленные лесенкой. Три входа — три полосы одна под
   другой (иконка + название), каждая своей области. */
function recipeCellHtml(icons, names) {
    if (names.length === 2) {
        return `<span class="ct-icon-cell ct-icon-a">${iconFor(icons[0])}</span>`
            + `<span class="ct-recipe-name ct-name-a" lang="en">${escapeHtml(names[0])}</span>`
            + `<span class="ct-recipe-name ct-name-b" lang="en">${escapeHtml(names[1])}</span>`
            + `<span class="ct-icon-cell ct-icon-b">${iconFor(icons[1])}</span>`;
    }
    return names.map((name, i) =>
        `<span class="ct-line ct-zone-${i % 3}">`
        + `<span class="ct-icon-cell">${iconFor(icons[i])}</span>`
        + `<span class="ct-recipe-name" lang="en">${escapeHtml(name)}</span>`
        + '</span>'
    ).join('');
}

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
// true, пока вкладка «Планеты» пересобирается из хранилища (см. EVEPI_reloadAccounts)
let reloadingAccounts = false;
// Общий выбор персонажа — на месте прежнего «Аккаунта»
const pilotNew = document.getElementById('pilot-new');
const pilotNewAdd = document.getElementById('pilot-add');
const accountCounter = document.getElementById('account-counter');
const statsBody = document.getElementById('stats-body');
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

/* Список типов планет для строки карточки. Первый вариант «—» — пустая
   строка (свободный слот): так её освобождает карта региона на вкладке
   «Калькулятор», когда там удаляют колонию персонажа. */
const planetOptions = (values, selected) =>
    `<option value=""${selected === '' ? ' selected' : ''}>—</option>${optionsHtml(values, selected)}`;

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

/* Регионы без планетных систем: червоточины («буква-R-пять цифр»,
   A-R00001 … K-R00033), абиссальные (ADR01…ADR05) и виртуальные/
   служебные (VR-01…VR-05, GPMR-01). Планет в таких регионах нет —
   из списка выбора их убираем; в данных SYSTEMS_BY_REGION остаются. */
const NO_PLANET_REGION = /^(?:[A-Z]-R\d{5}|ADR\d{2}|VR-\d{2}|GPMR-\d{2})$/;

/* Дополнительно скрываем из списка выбора: A821-A (дубль Pochven —
   Триглавское пространство, ESI хранит их как два региона), сам
   Pochven, J7HZ-F и UUA-F4 (скрытые служебные регионы). */
const HIDDEN_REGIONS = new Set(['A821-A', 'J7HZ-F', 'Pochven', 'UUA-F4']);

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
            + EVE_REGIONS
                .filter((n) => !NO_PLANET_REGION.test(n) && !HIDDEN_REGIONS.has(n))
                .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
                .join('');
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

/* Подсказка в заблокированном списке: вместо «—» фоном видно, что
   выбрать сначала («Регион???», «Система???», «Товар???», «Планета???»). Пустой вариант получает текст подсказки и
   становится выбранным; разблокированный список возвращает свой текст
   (data-empty-text, по умолчанию «—»). */
function setLockHint(select, hint) {
    if (!select) return;
    let empty = Array.from(select.options).find((o) => o.value === '');
    if (!empty) {
        empty = document.createElement('option');
        empty.value = '';
        select.insertBefore(empty, select.firstChild);
    }
    if (!select.dataset.emptyText) select.dataset.emptyText = empty.textContent || '—';
    // Фоном — просто что выбрать: «Регион», «Система», «Товар», «Планета».
    // Полная фраза — в подсказке при наведении.
    select.disabled = true;
    empty.textContent = `${hint}???`;
    select.value = '';
    select.title = `Сначала выберите: ${hint.toLowerCase()}`;
}

function clearLockHint(select) {
    if (!select || !select.dataset.emptyText) return;
    const empty = Array.from(select.options).find((o) => o.value === '');
    if (empty) empty.textContent = select.dataset.emptyText;
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

    const rowSystem = event.target.closest('[data-role="row-system"]');
    if (rowSystem && !rowSystem.dataset.filled) {
        const card = rowSystem.closest('.card');
        const regionSel = card && card.querySelector('[data-role="region"]');
        const current = rowSystem.value;
        rowSystem.innerHTML = systemsHtml(regionSel ? regionSel.value : '');
        if (current && !Array.from(rowSystem.options).some((o) => o.value === current)) {
            rowSystem.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`);
        }
        rowSystem.value = current;
        rowSystem.dataset.filled = '1';
    }
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

    /* Карточка P2 живёт своим каскадом: каждая строка независима, её
       планеты зависят от выбранного товара P2 и входа рецепта, который
       эта строка берёт (см. fillP2Row). */
    if (isP2Level(card.dataset.level)) {
        card.querySelectorAll('tbody tr').forEach((row) => {
            fillP2Row(row, systemName);
        });
        return;
    }

    // Универсальная карточка: у каждой строки свой уровень (см. fillMixRow)
    if (isMixLevel(card.dataset.level)) {
        card.querySelectorAll('tbody tr').forEach((row) => {
            // смена региона: списки систем строк собираются заново
            const rs = row.querySelector('[data-role="row-system"]');
            if (rs) delete rs.dataset.filled;
            fillMixRow(row, systemOfRow(row));
        });
        return;
    }

    // Карточки P3 и P4 — тот же принцип, свой рецепт (см. fillProdRow)
    if (isProdLevel(card.dataset.level)) {
        card.querySelectorAll('tbody tr').forEach((row) => {
            fillProdRow(row, systemName, card.dataset.level);
        });
        return;
    }

    /* Пустой список у выбранной системы — это не «пока не с чего выбрать»,
       а прямое отсутствие планет: система пустая (червоточина, космос
       Абенниса) либо её нет в зеркале SDE. Все восемь типов здесь
       показывать нельзя, они относятся к галактике в целом, а не к этой
       системе. Система не выбрана — другое дело, там список типов
       по умолчанию. */
    // Каждая строка сохраняет свою планету, если она есть в новом списке,
    // иначе остаётся пустой «—» — ничего не подставляем сами
    const kinds = !systemName ? PLANET_TYPES : list;
    card.querySelectorAll('[data-role="planet"]').forEach((cell) => {
        const current = cell.value;
        cell.innerHTML = kinds.length
            ? planetOptions(kinds, kinds.includes(current) ? current : '')
            : '<option value="">Нет данных о планетах</option>';
        syncTitle(cell, 'Тип планеты не выбран');
    });

    // Каскад поехал за типами
    card.querySelectorAll('tbody tr').forEach((row) => {
        numberizePlanets(row, systemName);
        fillP0(row);
        fillP1(row);
    });
}

// Одна строка карточки. Параметр index — порядковый номер строки от 0 до 5.
// Новая строка пустая: планета и P0 — «—», их выбирает пользователь.
function buildColonyRow(index) {

    // В первой строке идут объединённые ячейки, в остальных — нет.
    // Ячейка «Статус» убрана: кнопка подсветки переехала в строку
    // системы (см. buildCard).

    return `
        <tr data-row="${index}">
            <td class="ct-planet">
                ${PLANET_LABEL}
                <input type="hidden" data-role="number" value="${ROMAN_NUMBERS[index % ROMAN_NUMBERS.length]}">
                <select class="ct-input" data-role="planet" aria-label="Тип планеты" disabled
                        title="Сначала выберите регион и систему">
                    ${planetOptions(PLANET_TYPES, '')}
                </select>
            </td>
            <td class="ct-p0 ct-split ct-split-wide">
                ${tierBadgeHtml('P0')}
                <div class="res-stack">
                    <select class="ct-input" data-role="p0" aria-label="Ресурс P0">
                        ${EMPTY_OPTION}
                    </select>
                </div>
            </td>
            <td class="ct-p1 ct-head">
                ${tierBadgeHtml('P1')}
                <div class="res-stack">
                    <!-- P1 не выбирается: он один на пару «планета + P0», поэтому
                         это текст; значение — в скрытом поле для хранилища -->
                    <input type="hidden" data-role="p1" value="">
                    <span class="ct-p1-text" data-role="p1-text">—</span>
                </div>
            </td>
        </tr>`;
}

/* Строка карточки P2. От обычной отличается первой колонкой P2 и
   порядком P1/P0: пользователь просил порядок P2|Планета|№|P1|P0.
   Все шесть строк независимы: у каждой свой товар P2, свои планета,
   P1 и P0. «Корабль», как и в обычной карточке, объединён на все шесть
   строк. */
function buildP2ColonyRow(index, test) {

    const p2Cell = `<td class="ct-p2 ct-head">
               ${tierBadgeHtml('P2')}
               <div class="res-stack">
                   <select class="ct-input" data-role="p2" aria-label="Товар P2"
                           title="Выберите товар P2 — планеты и ресурсы строки подберутся по его рецепту">${P2_OPTIONS_HTML}</select>
               </div>
           </td>`;


    return `
        <tr data-row="${index}">
            ${p2Cell}
            <td class="ct-planet">
                ${PLANET_LABEL}
                <input type="hidden" data-role="number" value="${ROMAN_NUMBERS[index % ROMAN_NUMBERS.length]}">
                <select class="ct-input" data-role="planet" aria-label="Тип планеты" disabled
                        title="Сначала выберите регион и систему">
                    ${planetOptions(PLANET_TYPES, '')}
                </select>
            </td>
            ${test
                ? [1, 2].map((k) => `<td class="ct-p1 ct-split">
                <div class="ct-recipe ct-recipe-one" data-role="p1-one" aria-label="Вход P1 №${k}"></div>
            </td>
            <td class="ct-p0 ct-split">
                <div class="ct-recipe ct-recipe-one" data-role="p0-one" aria-label="Сырьё P0 для входа №${k}"></div>
            </td>`).join('')
                : `<td class="ct-p1 ct-split">
                <div class="ct-recipe" data-role="p1-recipe" aria-label="Входы рецепта P1"></div>
            </td>
            <td class="ct-p0 ct-split">
                <div class="ct-recipe" data-role="p0-recipe" aria-label="Сырьё P0 для рецепта"></div>
            </td>`}
        </tr>`;
}

// Клетки «по ресурсу» тестовых карточек: картинка слева, название справа;
// пустая клетка держит форму прозрачной картинкой
// Значок уровня ресурса (P0–P4) — квадрат размером с картинку ресурса
const tierBadgeHtml = (tier) => `<span class="ct-tier ct-tier-${tier.toLowerCase()}">${tier}</span>`;
// Подпись «Планета» перед списком планет в первой линии строки
const PLANET_LABEL = '<span class="ct-mix-label">Планета</span>';

// tiers — уровень каждого ресурса: значок перед его картинкой
function fillOneCells(row, role, icons, labels, tiers = []) {
    row.querySelectorAll(`[data-role="${role}"]`).forEach((cell, k) => {
        const has = k < labels.length && labels[k];
        const tier = has ? tiers[k] || '' : '';
        cell.classList.toggle('ct-one-empty', !has);
        cell.closest('td').dataset.tier = tier;
        cell.title = has ? (tier ? `${labels[k]} (${tier})` : labels[k]) : '';
        cell.innerHTML = (tier ? tierBadgeHtml(tier) : '')
            + `<span class="ct-icon-cell">${has && icons[k] ? iconFor(icons[k]) : BLANK_ICON}</span>`
            + `<span class="ct-recipe-name" lang="en">${has ? escapeHtml(labels[k]) : '&nbsp;'}</span>`;
    });
}

/* Строка карточки P3/P4: товар | Планета | № | входы рецепта.
   Классы ячеек те же, что у карточки P2, — у них одинаковое оформление. */
function buildProdColonyRow(index, level) {
    const lower = level === 'P3' ? 'P2' : 'P3';

    return `
        <tr data-row="${index}">
            <td class="ct-p2 ct-head">
                ${tierBadgeHtml(level === 'T3' ? 'P3' : level)}
                <div class="res-stack">
                    <select class="ct-input" data-role="prod" aria-label="Товар ${level}"
                            title="Выберите товар ${level} — состав строки подберётся по его рецепту">${PROD_OPTIONS_HTML[level]}</select>
                </div>
            </td>
            <td class="ct-planet">
                ${PLANET_LABEL}
                <input type="hidden" data-role="number" value="${ROMAN_NUMBERS[index % ROMAN_NUMBERS.length]}">
                <select class="ct-input" data-role="planet" aria-label="Тип планеты" disabled
                        title="Сначала выберите регион и систему">
                    ${planetOptions(PROD_PLANETS[level] || PLANET_TYPES, '')}
                </select>
            </td>
            ${level === 'P4'
                ? [0, 1, 2].map((k) => `<td class="ct-p1 ct-split">
                <div class="ct-recipe ct-recipe-one" data-role="p4-in" aria-label="Вход P3 №${k + 1}"></div>
            </td>`).join('')
                : isSplitP3(level)
                ? [0, 1, 2].map((k) => `<td class="ct-p1 ct-split">
                <div class="ct-recipe ct-recipe-one" data-role="in-one" aria-label="Ресурс ${lower} №${k + 1}"></div>
            </td>`).join('')
                : `<td class="ct-p1 ct-split">
                <div class="ct-recipe" data-role="in-recipe" aria-label="Входы рецепта ${lower}: 1 и 2"></div>
            </td>
            <td class="ct-p0 ct-split">
                <div class="ct-recipe" data-role="in-recipe-b" aria-label="Входы рецепта ${lower}: 3"></div>
            </td>`}
        </tr>`;
}

/* Строка универсальной карточки. Тип строки хранится в скрытом поле
   mix-level; первую ячейку рисует renderMixHead: пустая строка — кнопка
   «+ Добавить» и меню типов, выбранная — иконка над списком товаров
   (как на карточке P2) и крестик очистки. */
function buildMixColonyRow(index, level) {
    return `
        <tr data-row="${index}">
            <td class="ct-sys">
                <span class="ct-mix-label">Система</span>
                <select class="ct-input" data-role="row-system" aria-label="Система колонии" title="Система не выбрана"><option value="">—</option></select>
                <span class="ct-sys-link" title="Та же система, что в строке выше" aria-hidden="true">↳</span>
            </td>
            <td class="ct-p2 ct-mix ct-head">
                <input type="hidden" data-role="mix-level" value="">
                <div class="ct-mix-head"></div>
            </td>
            <td class="ct-planet">
                ${PLANET_LABEL}
                <input type="hidden" data-role="number" value="${ROMAN_NUMBERS[index % ROMAN_NUMBERS.length]}">
                <select class="ct-input" data-role="planet" aria-label="Тип планеты" disabled
                        title="Сначала выберите регион и систему">
                    ${planetOptions(PLANET_TYPES, '')}
                </select>
            </td>
            ${[0, 1, 2, 3].map((k) => `<td class="${k % 2 ? 'ct-p0' : 'ct-p1'} ct-split">
                <div class="ct-recipe ct-recipe-one" data-role="mix-one" aria-label="Состав: клетка ${k + 1}"></div>
            </td>`).join('')}
        </tr>`;
}

/* Вся карточка: шапка с именем персонажа и крестиком (классы те же,
   что у линии аккаунта), под ней таблица с заголовками и 6 строками.
   Имя попадает и в data-name — по нему карточка восстанавливается при загрузке. */
function buildCard(name, level) {
    const p2 = isP2Level(level);
    const mix = isMixLevel(level);
    const prod = isProdLevel(level) || mix;
    const headers = mix ? (level === TMIX_LEVEL ? CARD_HEADERS_TMIX : CARD_HEADERS_MIX)
        : (prod ? CARD_HEADERS_PROD[level]
            : (p2 ? CARD_HEADERS_T2 : CARD_HEADERS));
    const widths = isSplitP3(level) || p2 || level === 'P4' || mix
        ? headers.flatMap((h, i) => Array(HEADER_SPANS[level] ? HEADER_SPANS[level][i] : 1).fill('auto'))   // ширины ставит fitCardColumns
        : (prod ? CARD_COL_WIDTHS_PROD : (p2 ? CARD_COL_WIDTHS_P2 : CARD_COL_WIDTHS));
    const rows = Array.from(
        { length: COLONY_ROWS },
        (_, i) => (mix ? buildMixColonyRow(i, level)
            : (prod ? buildProdColonyRow(i, level) : (p2 ? buildP2ColonyRow(i, true) : buildColonyRow(i))))
    ).join('');
    const safe = escapeHtml(name);

    return `
        <div class="card ct-two-line" data-name="${safe}" data-level="${prod ? level : (p2 ? level : 'P1')}">
            <table class="colony-table">
                <colgroup>${widths.map((w) => (w === 'auto' ? '<col>' : `<col style="width:${w}">`)).join('')}</colgroup>
                <thead>
                    <!-- Строка системы: над заголовками, на всю ширину
                         карточки. Списки общие на всю карточку, поэтому
                         стоят отдельной строкой, а не в колонке данных.
                         Кнопка подсветки 💡 стоит справа. -->
                    <tr class="ct-system-row">
                        <td colspan="${widths.length}" class="ct-system">
                            <div class="ct-system-inner">
                                <!-- Имя персонажа — первым в строке, перед регионом -->
                                <h3 class="ct-pilot-name" title="${safe}">${safe}</h3>
                                <span class="ct-field">
                                    <span class="ct-system-label">Регион:</span>
                                    <select class="ct-input" data-role="region" aria-label="Регион" title="Регион не выбран">${REGION_PLACEHOLDER}</select>
                                </span>
                                <span class="ct-field"${mix ? ' hidden' : ''}>
                                    <span class="ct-system-label">Система:</span>
                                    <select class="ct-input" data-role="system" aria-label="Система" title="Сначала выберите регион" data-empty-text="Система" disabled><option value="">Регион???</option></select>
                                </span>
                                <span class="ct-field">
                                    <span class="ct-system-label">Корабль:</span>
                                    <select class="ct-input" data-role="ship" aria-label="Корабль">${optionsHtml(SHIP_OPTIONS, SHIP_OPTIONS[0])}</select>
                                </span>
                                ${mix ? '' : '<button type="button" class="card-light" aria-pressed="false" title="Подсветить карточку" aria-label="Подсветить карточку">💡</button>'}
                                ${mix ? '<button type="button" class="card-save" data-role="card-save" title="Сохранить и показать карточку">Сохранить</button>' : ''}
                                <button type="button" class="account-del" data-role="card-del"
                                        title="Удалить карточку"
                                        aria-label="Удалить карточку ${safe}">&times;</button>
                            </div>
                        </td>
                    </tr>
                    <tr>${headers.map((h, i) => {
                        const span = HEADER_SPANS[level]
                            ? HEADER_SPANS[level][i]
                            : (prod && i === headers.length - 1 ? (PROD_INPUT_SPAN[level] || 2) : 1);
                        return span > 1 ? `<th scope="col" colspan="${span}">${h}</th>` : `<th scope="col">${h}</th>`;
                    }).join('')}</tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// Список P0 — пять товаров планеты выбранного типа. Прежний P0,
// если он есть в новом списке, остаётся на месте.
// В карточке P2 по выбранному P1 (входу рецепта) — только то сырьё,
// из которого этот P1 получается на выбранной планете.
function fillP0(row) {
    const p0Select = row.querySelector('[data-role="p0"]');
    if (!p0Select) return; // карточка P2: столбец P0 — текст, не список

    const p0 = p0Select.value;
    const resources = (PLANET_RESOURCES[planetTypeOf(row)] || []).map((r) => r.P0);
    // Пустая строка «—» первой: P0 выбирает пользователь — после планеты
    p0Select.innerHTML = `<option value="">—</option>${optionsHtml(resources, resources.includes(p0) ? p0 : '')}`;
    p0Select.disabled = !planetTypeOf(row);
    if (p0Select.disabled) setLockHint(p0Select, 'Планета');
    else p0Select.title = p0Select.value || 'P0 не выбран';
}

// Значение P1 берём из PLANET_RESOURCES по выбранному типу планеты и P0.
// На карточке P2 столбца-списка P1 нет: там рецепт выводится текстом
// (см. fillP2Row), поэтому функция выходит сразу.
function fillP1(row) {
    const p1Value = row.querySelector('[data-role="p1"]');
    const p1Text = row.querySelector('[data-role="p1-text"]');
    if (!p1Value || !p1Text) return; // другие карточки: P1 — рецепт, не эта ячейка

    const resources = PLANET_RESOURCES[planetTypeOf(row)] || [];
    const p0 = row.querySelector('[data-role="p0"]').value;
    const entry = resources.find((r) => r.P0 === p0);

    // P1 — текст: он однозначно следует из планеты и P0. Нет — прочерк
    p1Value.value = entry && entry.P1 ? entry.P1 : '';
    p1Text.textContent = p1Value.value || '—';
    p1Text.classList.toggle('is-empty', !p1Value.value);

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

/* ---- Карточка P2: каскад по рецепту ----
   Каждая из шести строк независима: свой товар P2, свой выбор. По
   выбранному P2 фильтруются остальные колонки строки: P1 — входы
   рецепта P1->P2 (их два, список оставлен открытым), P0 — сырьё,
   из которого выбранный P1 получается, планеты — типы, где такое
   сырьё добывается. Выбранная система сужает список планет до
   своих. Пустой P2 возвращает строку в свободный режим — как в
   обычной карточке.
   Структура рецепта — в PI_RECIPES. */

function systemOfCard(card) {
    const cell = card ? card.querySelector('[data-role="system"]') : null;
    return cell ? cell.value : '';
}

/* ---- Система строки (универсальная карточка) ----
   У каждой строки своя система: колонии персонажа бывают в разных
   системах. Подстрока («+» в строке) — та же система, что у строки
   над ней (tr.dataset.link = '1'): списка системы в ней нет, только ↳,
   а планета и товар свои. */
function systemOfRow(row) {
    const card = row ? row.closest('.card') : null;
    if (!card || !isMixLevel(card.dataset.level)) return systemOfCard(card);
    let r = row;
    while (r && r.dataset.link === '1') r = r.previousElementSibling;
    const sel = r ? r.querySelector('[data-role="row-system"]') : null;
    return sel ? sel.value : '';
}

// Ставит систему строки. Полный список систем — при открытии (prepareCardList)
function setRowSystem(row, name) {
    const sel = row.querySelector('[data-role="row-system"]');
    if (!sel) return;
    sel.innerHTML = '<option value="">—</option>'
        + (name ? `<option value="${escapeHtml(name)}" selected>${escapeHtml(name)}</option>` : '');
    delete sel.dataset.filled;
    sel.value = name || '';
    syncTitle(sel, 'Система не выбрана');
}

function setRowLink(row, on) {
    if (on) row.dataset.link = '1';
    else delete row.dataset.link;
    row.classList.toggle('ct-row-link', Boolean(on));
}

// Эта строка и её подстроки ниже
function rowGroupOf(row) {
    const out = [row];
    let r = row.nextElementSibling;
    while (r && r.dataset.link === '1') {
        out.push(r);
        r = r.nextElementSibling;
    }
    return out;
}

// Товар P2, выбранный в конкретной строке карточки P2
function rowP2Of(row) {
    const cell = row.querySelector('[data-role="p2"]');
    return cell ? cell.value : '';
}

// На карточке P2 столбцы P1 и P0 не выбираются: они зависят от товара
// P2. Выводим рецепт текстом — в P1 оба входа рецепта, в P0 сырьё для
// каждого входа, по строке на вход. Планеты — типы, где добывается
// сырьё любого из входов, суженные до типов выбранной системы.
function fillP2RowInner(row, systemName) {
    const list = systemName ? planetTypesOf(systemName) : [];
    const planetCell = row.querySelector('[data-role="planet"]');
    const p1Cell = row.querySelector('[data-role="p1-recipe"]');
    const p0Cell = row.querySelector('[data-role="p0-recipe"]');
    const p2 = rowP2Of(row);
    const current = planetTypeOf(row);

    // Иконка товара P2 слева от списка
    const p2Cell = row.querySelector('.ct-p2');
    if (p2Cell) updateResIcon(p2Cell);

    const empty = '<span class="ct-recipe-names ct-recipe-empty">—</span>';

    if (!p2) {
        // Строка без товара P2: рецепта нет, планеты — все типы системы
        if (p1Cell) p1Cell.innerHTML = empty;
        if (p0Cell) p0Cell.innerHTML = empty;
        fillOneCells(row, 'p1-one', [], []);
        fillOneCells(row, 'p0-one', [], []);

        planetCell.innerHTML = !systemName
            ? planetOptions(PLANET_TYPES, current)
            : (list.length
                ? planetOptions(list, list.includes(current) ? current : '')
                : '<option value="">Нет данных о планетах</option>');
        syncTitle(planetCell, 'Тип планеты не выбран');
        return;
    }

    const recipe = PI_P2_RECIPE_OF.get(p2);
    const inputs = recipe.in.map(([name]) => name);

    // Сырьё P0 для входа: один P1 может добываться из разных P0
    const p0sOf = (p1) => uniqValues((P1_SOURCES.get(p1) || []).map((s) => s.p0));

    /* Ячейка рецепта — две области-«уголка», сцепленные лесенкой:
       светлая — левая иконка + верхнее название (первый вход),
       синяя — нижнее название + правая иконка (второй вход).
       Иконки обёрнуты в ячейки сетки, чтобы у них был свой фон. */
    const recipeCell = recipeCellHtml;

    const raws = inputs.map((name) => p0sOf(name));
    if (p1Cell) {
        p1Cell.innerHTML = recipeCell(inputs, inputs);
        p0Cell.innerHTML = recipeCell(
            raws.map((raw) => (raw.length ? raw[0] : '')),
            raws.map((raw) => (raw.length ? raw.join(' · ') : '—'))
        );
    } else {
        // «Тест P2»: каждый вход и его сырьё — в своей клетке
        fillOneCells(row, 'p1-one', inputs, inputs, inputs.map(() => 'P1'));
        fillOneCells(row, 'p0-one', raws.map((raw) => raw[0] || ''), raws.map((raw) => raw.join(' · ')),
            raws.map((raw) => (raw.length ? 'P0' : '')));
    }

    // Планеты: где добывается сырьё любого из входов рецепта
    const producing = uniqValues(
        inputs.reduce((acc, name) => acc.concat((P1_SOURCES.get(name) || []).map((s) => s.planet)), [])
    );
    const allowed = list.length ? producing.filter((p) => list.includes(p)) : producing;

    planetCell.innerHTML = allowed.length
        ? planetOptions(allowed, allowed.includes(current) ? current : '')
        : (list.length
            ? '<option value="">Нет подходящих планет</option>'
            : planetOptions(producing, ''));
    syncTitle(planetCell, 'Тип планеты не выбран');
}

/* Входы рецепта P3/P4 — два блока рядом, каждый как ячейка рецепта на
   карточке P2 («уголки» лесенкой: иконка слева у верхнего названия,
   нижнее название с иконкой справа). В первом блоке входы 1 и 2, во
   втором — вход 3. Пустые места остаются фоном: зато строка всегда в
   две линии и карточки одной высоты. */
// Пустая (прозрачная) картинка размером с иконку ресурса
const BLANK_ICON = '<img class="res-icon res-icon-blank" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" width="24" height="24">';

// Возвращает содержимое двух блоков: [входы 1–2, входы 3–4]
function recipePairHtml(icons, labels) {
    const half = (i) => {
        const has = (k) => k < labels.length;
        // Нет ресурса — прозрачная картинка того же размера и пробел вместо
        // названия: блок сохраняет форму, как при четырёх входах
        const icon = (k) => (has(k) ? iconFor(icons[k]) : BLANK_ICON);
        const name = (k) => (has(k) ? escapeHtml(labels[k]) : '&nbsp;');
        const empty = (k) => (has(k) ? '' : ' ct-slot-empty');
        return `<span class="ct-icon-cell ct-icon-a${empty(i)}">${icon(i)}</span>`
            + `<span class="ct-recipe-name ct-name-a${empty(i)}" lang="en">${name(i)}</span>`
            + `<span class="ct-recipe-name ct-name-b${empty(i + 1)}" lang="en">${name(i + 1)}</span>`
            + `<span class="ct-icon-cell ct-icon-b${empty(i + 1)}">${icon(i + 1)}</span>`;
    };
    return [half(0), half(2)];
}

/* ---- Карточки P3 и P4: каскад по рецепту ----
   Как на карточке P2: по выбранному товару строки выводятся входы его
   рецепта. Вход P1 в рецепте P4 (Bacteria, Water, Reactive Metals)
   помечен «(P1)» — он идёт в рецепт напрямую. */
function rowProdOf(row) {
    const cell = row.querySelector('[data-role="prod"]');
    return cell ? cell.value : '';
}

function fillProdRowInner(row, systemName, level) {
    const list = systemName ? planetTypesOf(systemName) : [];
    const planetCell = row.querySelector('[data-role="planet"]');
    const inCell = row.querySelector('[data-role="in-recipe"]');
    const inCellB = row.querySelector('[data-role="in-recipe-b"]');
    const prod = rowProdOf(row);
    const current = planetTypeOf(row);

    const prodCell = row.querySelector('.ct-p2');
    if (prodCell) updateResIcon(prodCell);

    const recipe = PI_RECIPE_OF.get(prod);
    if (level === 'P4') {
        /* Три клетки P3: по входу в клетке. Вход P1 (Bacteria, Water,
           Reactive Metals) — с пометкой «(P1)». */
        const inputs = recipe ? recipe.in.map(([name]) => name) : [];
        const tiers = inputs.map((name) => {
            const r = PI_RECIPE_OF.get(name);
            return r && r.outQty === 20 ? 'P1' : 'P3';
        });
        fillOneCells(row, 'p4-in', inputs, inputs, tiers);
    } else if (isSplitP3(level)) {
        // Тестовая: по клетке на ресурс — иконка и название; пустая клетка
        // держит форму прозрачной картинкой
        const inputs = recipe ? recipe.in.map(([name]) => name) : [];
        fillOneCells(row, 'in-one', inputs, inputs, inputs.map(() => 'P2'));
    } else if (!recipe) {
        const [, blank] = recipePairHtml([], []);
        inCell.innerHTML = '<span class="ct-recipe-names ct-recipe-empty">—</span>';
        inCellB.innerHTML = blank;
    } else {
        const inputs = recipe.in.map(([name]) => name);
        // P1 в рецепте P4 берётся напрямую — помечаем уровень
        const labels = inputs.map((name) => {
            const r = PI_RECIPE_OF.get(name);
            return r && r.outQty === 20 ? `${name} (P1)` : name;
        });
        const [first, second] = recipePairHtml(inputs, labels);
        inCell.innerHTML = first;
        inCellB.innerHTML = second;
    }

    // Планеты: P3 — любой тип, P4 — только Barren и Temperate
    const kinds = PROD_PLANETS[level] || PLANET_TYPES;
    const allowed = list.length ? kinds.filter((p) => list.includes(p)) : kinds;

    planetCell.innerHTML = allowed.length
        ? planetOptions(allowed, allowed.includes(current) ? current : '')
        : '<option value="">Нет подходящих планет</option>';
    syncTitle(planetCell, 'Тип планеты не выбран');
}

/* ---- Универсальная карточка: строка по своему типу ---- */
function mixLevelOf(row) {
    const cell = row.querySelector('[data-role="mix-level"]');
    return cell ? cell.value : '';
}

function mixProdOf(row) {
    const cell = row.querySelector('[data-role="mix-prod"]');
    return cell ? cell.value : '';
}

// Варианты товаров с типом в скобках: «Coolant (P2)»
const mixOptionsHtml = (list, selected, level) => list
    .map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(v)} (${level})</option>`)
    .join('');

/* Первая ячейка строки. Пустая строка — кнопка «+ Добавить» и скрытое
   меню типов. Строка с типом — иконка над списком товаров этого типа
   (как на карточке P2) и крестик, возвращающий строку к пустой. */
function renderMixHead(row, prod) {
    const head = row.querySelector('.ct-mix-head');
    if (!head) return;
    const level = mixLevelOf(row);
    // Пока тип не выбран, строка «пустая»: на «Тест универсальной» в ней
    // не показываются «Планета» и её список
    row.classList.toggle('ct-mix-empty', !level);

    // «Тест универсальная»: тип — значком (как в составе), в списке без скобок
    const card = row.closest('.card');
    const plain = card && isMixLevel(card.dataset.level);
    const tierBadge = tierBadgeHtml;

    if (!level) {
        row.classList.remove('ct-row-p1');
        head.innerHTML = `
            <button type="button" class="ct-mix-add" data-role="mix-add" aria-haspopup="true"
                    aria-expanded="false" title="Добавить строку — выберите тип">+ Добавить</button>
            <div class="ct-mix-menu" role="menu" hidden>
                ${MIX_LEVELS.map((l) => `<button type="button" role="menuitem" data-mix-type="${l}"${plain ? ` title="Тип ${l}"` : ''}>${plain ? tierBadge(l) : l}</button>`).join('')}
            </div>`;
        return;
    }

    const list = mixListOf(level);
    const value = list.includes(prod) ? prod : '';
    const options = plain
        ? list.map((v) => `<option value="${escapeHtml(v)}"${v === value ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('')
        : mixOptionsHtml(list, value, level);
    row.classList.toggle('ct-row-p1', level === 'P1');
    head.innerHTML = `<button type="button" class="ct-row-plus" data-role="row-plus" title="Ещё колония в этой же системе" aria-label="Ещё колония в этой же системе">+</button>
        ${plain ? `<span class="ct-mix-type">${tierBadge(level)}</span>` : ''}
        <div class="res-stack">
            <select class="ct-input" data-role="mix-prod" aria-label="Товар ${level}"
                    title="${escapeHtml(value) || 'Товар не выбран'}"><option value=""${value ? '' : ' selected'}>—</option>${options}</select>
        </div>
        <button type="button" class="ct-mix-clear" data-role="mix-clear"
                title="Очистить строку" aria-label="Очистить строку">&times;</button>`;
    updateResIcon(head);
}

// Задаёт строке тип (или пустоту) и перерисовывает её
function setMixLevel(row, level, prod) {
    const cell = row.querySelector('[data-role="mix-level"]');
    if (cell) cell.value = MIX_LEVELS.includes(level) ? level : '';
    renderMixHead(row, prod);
}

function fillMixRowInner(row, systemName) {
    const level = mixLevelOf(row);
    const prod = mixProdOf(row);
    const list = systemName ? planetTypesOf(systemName) : [];
    const planetCell = row.querySelector('[data-role="planet"]');
    const cells = Array.from(row.querySelectorAll('[data-role="mix-one"]'));
    const tds = cells.map((c) => c.closest('td'));
    const current = planetTypeOf(row);

    // Клетки состава как на новых карточках: ресурс в своей клетке.
    // По умолчанию все четыре пустые; строка P1 объединяет первые две
    // под выпадающий список P0.
    const prevSel = cells[0].querySelector('[data-role="p0"]');
    const prevP0 = prevSel ? prevSel.value : '';
    cells[0].classList.remove('ct-recipe-free');
    cells[0].classList.add('ct-recipe-one');
    tds[0].colSpan = 1;
    tds[1].hidden = false;
    /* «Тест универсальная»: уровень ресурса — значком «P1» перед его
       иконкой, а не «(P1)» после названия */
    const card = row.closest('.card');
    const badges = card && isMixLevel(card.dataset.level);
    const tierBadge = tierBadgeHtml;
    const fill = (icons, names, tiers = []) => cells.forEach((cell, k) => {
        const has = k < names.length && names[k];
        const tier = has ? tiers[k] || '' : '';
        const label = has ? (tier && !badges ? `${names[k]} (${tier})` : names[k]) : '';
        cell.classList.toggle('ct-one-empty', !has);
        cell.closest('td').dataset.tier = tier;
        cell.title = has ? (tier ? `${names[k]} (${tier})` : names[k]) : '';
        cell.innerHTML = (badges && tier ? tierBadge(tier) : '')
            + `<span class="ct-icon-cell">${has && icons[k] ? iconFor(icons[k]) : BLANK_ICON}</span>`
            + `<span class="ct-recipe-name" lang="en">${has ? escapeHtml(label) : '&nbsp;'}</span>`;
    });

    // Пустая строка или тип без товара: свободный слот, планеты — все типы (системы)
    if (!level || !prod) {
        const kinds = list.length ? list : PLANET_TYPES;
        planetCell.innerHTML = planetOptions(kinds, kinds.includes(current) ? current : '');
        syncTitle(planetCell, 'Тип планеты не выбран');
        fill([], []);
        return;
    }

    // Планеты, подходящие для товара строки
    let kinds;
    if (level === 'P1') {
        kinds = uniqValues((P1_SOURCES.get(prod) || []).map((s) => s.planet));
    } else if (level === 'P2') {
        const recipe = PI_P2_RECIPE_OF.get(prod);
        kinds = recipe ? uniqValues(recipe.in.reduce((acc, [name]) =>
            acc.concat((P1_SOURCES.get(name) || []).map((s) => s.planet)), [])) : PLANET_TYPES;
    } else {
        kinds = PROD_PLANETS[level] || PLANET_TYPES;
    }
    const [hintProd, hintPlanet] = (row.dataset.colonyPlanet || '').split('|');
    if (hintPlanet && hintProd === prod && !kinds.includes(hintPlanet)) kinds = kinds.concat(hintPlanet);
    const allowed = list.length ? kinds.filter((p) => list.includes(p)) : kinds;
    const planet = allowed.includes(current) ? current : '';
    planetCell.innerHTML = allowed.length
        ? planetOptions(allowed, planet)
        : '<option value="">Нет подходящих планет</option>';
    syncTitle(planetCell, 'Тип планеты не выбран');

    const recipe = PI_RECIPE_OF.get(prod);
    fill([], []);

    if (level === 'P1') {
        // Как на карточке P1: сырьё P0 — выпадающий список с иконкой,
        // в объединённых первых двух клетках
        const sources = (P1_SOURCES.get(prod) || []).filter((s) => !planet || s.planet === planet);
        const p0s = uniqValues((sources.length ? sources : (P1_SOURCES.get(prod) || [])).map((s) => s.p0));
        const sel = p0s.includes(prevP0) ? prevP0 : '';
        tds[0].colSpan = 2;
        tds[1].hidden = true;
        cells[0].classList.remove('ct-recipe-one', 'ct-one-empty');
        cells[0].classList.add('ct-recipe-free');
        cells[0].innerHTML = `${badges ? tierBadge('P0') : ''}<div class="res-stack">
                <select class="ct-input" data-role="p0" aria-label="Ресурс P0"${planet ? '' : ' disabled title="Сначала выберите планету"'}><option value="">${planet ? '—' : 'Планета???'}</option>${p0s
                    .map((v) => `<option value="${escapeHtml(v)}"${v === sel ? ' selected' : ''}>${escapeHtml(v)}${badges ? '' : ' (P0)'}</option>`)
                    .join('')}</select>
            </div>`;
        updateResIcon(cells[0]);
        return;
    }

    if (!recipe) return;
    const inputs = recipe.in.map(([name]) => name);

    if (level === 'P2') {
        // Как карточка P2: P1 | P0 | P1 | P0
        const raws = inputs.map((name) => uniqValues((P1_SOURCES.get(name) || []).map((s) => s.p0)));
        const icons = [];
        const names = [];
        const tiers = [];
        inputs.forEach((name, k) => {
            icons.push(name, raws[k][0] || '');
            names.push(name, raws[k].length ? raws[k].join(' · ') : '—');
            tiers.push('P1', raws[k].length ? 'P0' : '');
        });
        fill(icons, names, tiers);
        return;
    }

    // P3 и P4 — как их карточки: по входу рецепта в клетке
    const lower = level === 'P3' ? 'P2' : 'P3';
    fill(inputs, inputs, inputs.map((name) => {
        const r = PI_RECIPE_OF.get(name);
        return r && r.outQty === 20 ? 'P1' : lower;
    }));
}

/* Меню типов открыто — Esc закрывает его и возвращает фокус на кнопку */
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.ct-mix-menu:not([hidden])').forEach((menu) => {
        menu.hidden = true;
        const add = menu.parentElement.querySelector('[data-role="mix-add"]');
        if (add) {
            add.hidden = false;
            add.setAttribute('aria-expanded', 'false');
            add.focus();
        }
    });
});

/* Меню типов открыто — клик мимо него закрывает. Одно на страницу. */
document.addEventListener('click', (event) => {
    document.querySelectorAll('.ct-mix-menu:not([hidden])').forEach((menu) => {
        if (menu.parentElement.contains(event.target)) return;
        menu.hidden = true;
        const add = menu.parentElement.querySelector('[data-role="mix-add"]');
        if (add) {
            add.hidden = false;
            add.setAttribute('aria-expanded', 'false');
        }
    });
});

/* ---- Номера планет в списке «Планета» ----
   Столбца «№» нет: в списке стоит сама планета — «VII Barren». Номера
   берём из тех же данных, что и карта региона (MAP_REGIONS, js/mapdata.js:
   буквы типов планет системы по порядку I, II, III…). Значение списка
   по-прежнему тип планеты, а номер лежит в скрытом поле data-role="number"
   строки — так прежняя логика, хранилище и карта региона не меняются.
   Пока система не выбрана (или о ней нет данных), в списке просто типы. */
let numberedIndex = null;
function numberedPlanetsOf(systemName) {
    if (!systemName) return null;
    if (!numberedIndex) {
        numberedIndex = new Map();
        Object.values(typeof MAP_REGIONS !== 'undefined' ? MAP_REGIONS : {}).forEach((d) => {
            (d.s || []).forEach((r) => { if (r[4]) numberedIndex.set(r[0], r[4]); });
        });
    }
    const letters = numberedIndex.get(systemName);
    if (!letters) return null;
    return [...letters].map((code, k) => ({
        type: PLANET_TYPE_CODES[code] || '',
        num: ROMAN_NUMBERS[k] || String(k + 1)
    })).filter((pl) => pl.type);
}

// Перестраивает список «Планета» строки: каждая планета системы отдельно,
// с номером. Допустимые типы — те, что уже стоят в списке.
function numberizePlanets(row, systemName) {
    const cell = row.querySelector('[data-role="planet"]');
    const numCell = row.querySelector('[data-role="number"]');
    if (!cell || !numCell) return;

    // Планету выбирают только после системы карточки, а на карточках с
    // товаром — ещё и после товара строки. Заблокированная планета пустая.
    const needsProduct = row.querySelector('[data-role="p2"], [data-role="prod"], [data-role="mix-level"]');
    const productCell = row.querySelector('[data-role="p2"], [data-role="prod"], [data-role="mix-prod"]');
    const hasProduct = !needsProduct || Boolean(productCell && productCell.value);
    cell.disabled = !systemName || !hasProduct;
    if (cell.disabled) {
        setLockHint(cell, !systemName ? 'Система' : 'Товар');
        return;
    }
    clearLockHint(cell);
    const planets = numberedPlanetsOf(systemName);
    if (!planets) return;

    const options = Array.from(cell.options);
    const allowed = options.map((o) => o.value).filter(Boolean);
    const hasEmpty = options.some((o) => o.value === '') && allowed.length > 0;
    const list = planets.filter((pl) => allowed.includes(pl.type));
    if (!list.length) return;

    const curType = cell.value;
    const curNum = numCell.value;
    let sel = list.find((pl) => pl.type === curType && pl.num === curNum)
        || list.find((pl) => pl.type === curType)
        || null;
    if (!sel && !(hasEmpty && curType === '')) sel = list[0];

    cell.innerHTML = (hasEmpty ? `<option value=""${sel ? '' : ' selected'}>—</option>` : '')
        + list.map((pl) => `<option value="${escapeHtml(pl.type)}" data-num="${pl.num}"${pl === sel ? ' selected' : ''}>`
            + `${pl.num} ${escapeHtml(pl.type)}</option>`).join('');
    if (sel) numCell.value = sel.num;
    syncTitle(cell, 'Планета не выбрана');
}

// Выбрали планету в списке — её номер уходит в скрытое поле строки
function syncNumberFromPlanet(row) {
    const cell = row.querySelector('[data-role="planet"]');
    const numCell = row.querySelector('[data-role="number"]');
    if (!cell || !numCell) return;
    const option = cell.selectedOptions[0];
    if (option && option.dataset.num) numCell.value = option.dataset.num;
}

function fillP2Row(row, systemName) {
    fillP2RowInner(row, systemName);
    numberizePlanets(row, systemName);
    updateSeps(row);
}

function fillProdRow(row, systemName, level) {
    fillProdRowInner(row, systemName, level);
    numberizePlanets(row, systemName);
    updateSeps(row);
}

function fillMixRow(row, systemName) {
    fillMixRowInner(row, systemName);
    numberizePlanets(row, systemName);
    updateSeps(row);
}

/* «+» в строке: ниже встаёт подстрока — колония в той же системе
   (своя планета, тот же уровень и товар — их можно сменить). Свободных
   строк нет — подсказка на кнопке. */
function addExtractionRow(row) {
    const card = row.closest('.card');
    const rows = Array.from(card.querySelectorAll('tbody tr'));
    const plus = row.querySelector('[data-role="row-plus"]');
    const free = rows.find((r) => r !== row && !mixLevelOf(r));
    if (!free) {
        if (plus) plus.title = 'Свободных строк нет — все 6 заняты';
        return;
    }
    const group = rowGroupOf(row);
    group[group.length - 1].after(free);
    setRowLink(free, true);
    setRowSystem(free, '');
    delete free.dataset.colonyPlanet;
    setMixLevel(free, mixLevelOf(row), mixProdOf(row));
    const planet = free.querySelector('[data-role="planet"]');
    if (planet) planet.value = '';
    fillMixRow(free, systemOfRow(free));
    saveAccounts();
    const focus = free.querySelector('[data-role="planet"]:not(:disabled)') || free.querySelector('[data-role="mix-prod"]');
    if (focus) focus.focus();
}

/* Состав строки — без столбцов, одной строкой. Пустые клетки прячем,
   между ресурсами ставим разделитель: связка «P1 – его P0» — тире,
   иначе (перечисление входов) — «|». Разделитель рисует CSS по
   data-sep клетки. */
function updateSeps(row) {
    let prev = null;
    row.querySelectorAll('td.ct-split').forEach((td) => {
        const empty = td.hidden || !!td.querySelector('.ct-one-empty');
        td.classList.toggle('ct-cell-empty', empty);
        if (empty) {
            delete td.dataset.sep;
            return;
        }
        const tier = td.dataset.tier || '';
        if (!prev) delete td.dataset.sep;
        else td.dataset.sep = tier === 'P0' && prev === 'P1' ? 'dash' : 'bar';
        prev = tier || 'x';
    });
}

/* ---- Тестовая карточка: ширины столбцов P3 и «Планета» ----
   Столбцы подогнаны по самому длинному значению: товар P3 и планета
   («VIII Temperate»). Ширина — текст + поля и стрелка списка, но не
   больше доли карточки, чтобы трём клеткам ресурсов осталось место. */
const fitMeasure = document.createElement('canvas').getContext('2d');
function textWidthIn(select, text) {
    const cs = getComputedStyle(select);
    fitMeasure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return fitMeasure.measureText(text).width;
}

/* Ширина столбца «Планета» на всех карточках — по самому длинному тексту,
   который в нём бывает: «VIII Temperate» (номер + самый длинный тип).
   Шрифт мерим по списку «Корабль» — он всегда активен, а у заблокированной
   планеты кегль меньше. К тексту — поля списка, стрелка, рамка и поля
   ячейки. Не больше трети карточки. Столбец товара на карточках P2–P4,
   «Тест P3» и универсальной подгоняется так же — по самому длинному
   товару. Пересчёт — при каждом изменении ширины карточки. */
function fitCardColumns(card) {
    const cols = card.querySelectorAll('colgroup col');
    const ref = card.querySelector('[data-role="ship"]');
    const planetSel = card.querySelector('tbody [data-role="planet"]');
    if (!cols.length || !ref || !planetSel) return;

    // Номер столбца «Планета» с учётом объединённых заголовков
    let index = 0;
    let planetIdx = -1;
    card.querySelectorAll('thead tr:last-child th').forEach((th) => {
        if (planetIdx < 0 && th.textContent.trim() === 'Планета') planetIdx = index;
        index += th.colSpan || 1;
    });
    if (planetIdx < 0 || !cols[planetIdx]) return;

    const width = card.getBoundingClientRect().width || 600;
    const rs = getComputedStyle(ref);
    const td = getComputedStyle(planetSel.closest('td'));
    const extra = parseFloat(rs.paddingLeft) + parseFloat(rs.paddingRight)
        + parseFloat(rs.borderLeftWidth) + parseFloat(rs.borderRightWidth)
        + parseFloat(td.paddingLeft) + parseFloat(td.paddingRight) + 2;

    const longest = (list) => list.reduce((a, b) => (b.length > a.length ? b : a), '');
    const planetText = `VIII ${longest(PLANET_TYPES)}`;
    const planetPx = Math.min(textWidthIn(ref, planetText) + extra, width / 3);
    cols[planetIdx].style.width = `${Math.round(planetPx)}px`;
    // «Тест универсальная» свёрстана сеткой — ей ширина нужна переменной
    card.style.setProperty('--planet-w', `${Math.round(planetPx)}px`);

    /* Карточки, где первый столбец — товар (P2, P3, P4, «Тест P3»,
       универсальная): его ширина у всех одна — по самому длинному названию
       среди всех P2, P3 и P4 («Genetically Enhanced Livestock»). Пока
       карточка шире 700px, слева от списка стоит иконка товара — её место
       тоже учитываем. Не больше 40% карточки. */
    {
        // Список товара — той же ширины, что столбец товара других карточек
        const iconPx = width > 700 ? 36 : 0;
        // …но так, чтобы вся первая линия (тип, товар, ×, «Планета» и её
        // список) уместилась в одну строку: остальное в ней ≈ 165px
        const room = width - planetPx - 165;
        const prodPx = Math.max(80, Math.min(textWidthIn(ref, LONGEST_PRODUCT) + extra + iconPx, width * 0.4, room));
        card.style.setProperty('--prod-w', `${Math.round(prodPx)}px`);
    }
    if (PRODUCT_FIRST_LEVELS.includes(card.dataset.level)) {
        const iconPx = width > 700 ? 36 : 0;
        const prodPx = Math.min(textWidthIn(ref, LONGEST_PRODUCT) + extra + iconPx, width * 0.4);
        cols[0].style.width = `${Math.round(prodPx)}px`;
    }
}

// Карточки с товаром в первом столбце и самое длинное название товара P2–P4
const PRODUCT_FIRST_LEVELS = ['P2', 'P3', 'P4', TEST_LEVEL, TEST2_LEVEL, MIX_LEVEL];
const LONGEST_PRODUCT = [...PI_P2_LIST, ...PROD_LIST.P3, ...PROD_LIST.P4]
    .reduce((a, b) => (b.length > a.length ? b : a), '');

const cardColumnsObserver = window.ResizeObserver
    ? new ResizeObserver((entries) => entries.forEach((e) => fitCardColumns(e.target)))
    : null;

/* ---- Регион для новых карточек ----
   Список «Регион» вверху вкладки «Планеты». Выбран регион — новая карточка
   создаётся с ним, систему выбирают уже в карточке. «Все регионы» — и в
   новой карточке «Все регионы». Выбор хранится в браузере (DEFAULTS_KEY);
   на уже созданные карточки не влияет. */
const DEFAULTS_KEY = 'evepi.defaults';
const defRegion = document.getElementById('def-region');

function initDefaults() {
    if (!defRegion) return;
    const saved = store.get(DEFAULTS_KEY, {}) || {};

    if (saved.region) {
        fillRegions(defRegion);
        if (Array.from(defRegion.options).some((o) => o.value === saved.region)) {
            defRegion.value = saved.region;
        }
        syncTitle(defRegion, 'Все регионы');
    }

    // Список наполняется, когда его открывают (как в карточках)
    const prepare = () => fillRegions(defRegion);
    defRegion.addEventListener('mousedown', prepare);
    defRegion.addEventListener('focusin', prepare);

    defRegion.addEventListener('change', () => {
        syncTitle(defRegion, 'Все регионы');
        store.set(DEFAULTS_KEY, { region: defRegion.value });
    });
}

/* Ширина списка «Регион» — ровно как у поля «Название аккаунта» под ним:
   поле сжимается вместе со строкой (рядом кнопка и счётчик), а у списка
   соседей нет, поэтому без подгонки он бы выступал правее. Копируем
   ширину поля при любом изменении размеров (окно, масштаб, шрифт). */
function syncRegionWidth() {
    if (!defRegion || !pilotNew) return;
    const width = pilotNew.getBoundingClientRect().width;
    if (width > 0) {
        defRegion.style.flex = '0 0 auto';
        defRegion.style.width = `${width}px`;
    }
}

if (defRegion && pilotNew && window.ResizeObserver) {
    new ResizeObserver(syncRegionWidth).observe(pilotNew);
}
window.addEventListener('load', syncRegionWidth);

// Регион для новой карточки или null, если стоит «Все регионы»
function defaultsForNewCard() {
    return defRegion && defRegion.value ? { region: defRegion.value } : null;
}

initDefaults();

/* ---- Линия аккаунта ----
   Одна линия — один аккаунт. Сверху его имя, под ним выбор персонажа
   и ряд карточек. Разметку линии собирает buildAccountLine, а слушатели
   вешает initLine — по элементам конкретной линии. */

let lineSeq = 0;

function buildAccountLine(name) {
    // Ряд — до трёх карточек; названий у рядов больше нет (имя храним
    // только для совместимости со старыми сохранениями)
    return `
        <section class="account-line" data-account="${escapeHtml(name || '')}">
            <div class="cards-row" data-role="cards">
                <!-- карточки создаются в app.js -->
            </div>
        </section>`;
}

/* Каскад: планета -> список P0, затем P0 -> P1, и фон ячейки корабля.
   Слушатель общий для всех линий: сначала пересчёт, потом сохранение,
   чтобы содержимое строк переживало перезагрузку страницы. */
function handleRowChange(event) {
    /* Регион и система лежат в строке под заголовками (thead), а не в
       строках данных, поэтому для них ищем не строку tbody, а саму
       строку системы. Остальные списки — только в tbody. */
    const inSystemRow = Boolean(event.target.closest('.ct-system-row'));
    const row = event.target.closest('tbody tr');
    if (!row && !inSystemRow) return;

    applyRowChange(event, row);
    saveAccounts();
}

function applyRowChange(event, row) {
    // Номер планеты — из выбранного пункта списка «Планета»
    if (event.target.dataset.role === 'planet' && row) syncNumberFromPlanet(row);

    // Смена региона пересобирает список систем в той же ячейке
    if (event.target.dataset.role === 'region') {
        const cell = event.target.closest('td');
        const system = cell.querySelector('[data-role="system"]');
        applySystems(system, event.target.value);
        // Систему выбирают только после региона: «Все регионы» её блокирует
        system.disabled = !event.target.value;
        if (system.disabled) setLockHint(system, 'Регион');
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

    // Смена товара P2 пересобирает только эту строку по рецепту:
    // каждая из шести строк карточки P2 независима.
    if (event.target.dataset.role === 'p2') {
        const card = event.target.closest('.card');
        fillP2Row(event.target.closest('tr'), systemOfCard(card));
        updateResIcon(event.target.closest('.ct-p2'));
        syncTitle(event.target, 'P2 не выбран');
        return;
    }

    // Универсальная карточка: товар и планета пересобирают состав строки,
    // P0 строки P1 меняет только иконку над списком
    const mixCard = event.target.closest('.card[data-level="MIX"], .card[data-level="TMIX"]');
    if (mixCard && row) {
        const role = event.target.dataset.role;
        if (role === 'row-system') {
            syncTitle(event.target, 'Система не выбрана');
            rowGroupOf(row).forEach((r) => fillMixRow(r, event.target.value));
            return;
        }
        if (role === 'mix-prod') {
            syncTitle(event.target, 'Товар не выбран');
            updateResIcon(row.querySelector('.ct-mix-head'));
            fillMixRow(row, systemOfRow(row));
            return;
        }
        if (role === 'planet') {
            syncTitle(event.target, 'Тип планеты не выбран');
            fillMixRow(row, systemOfRow(row));
            return;
        }
        if (role === 'p0') {
            updateResIcon(row.querySelector('[data-role="mix-one"]'));
            return;
        }
    }

    // Смена товара P3/P4 пересобирает только эту строку по рецепту
    if (event.target.dataset.role === 'prod') {
        const card = event.target.closest('.card');
        fillProdRow(event.target.closest('tr'), systemOfCard(card), card.dataset.level);
        syncTitle(event.target, 'Товар не выбран');
        return;
    }

    if (event.target.dataset.role === 'planet') {
        fillP0(row);
        syncTitle(event.target, 'Тип планеты не выбран');
    }

    if (event.target.dataset.role === 'planet' || event.target.dataset.role === 'p0') {
        fillP1(row);
    }

}

// Кнопка 💡 красит карточку, крестик в шапке — удаляет её.
// Оба действия относятся к той карточке, в которой нажали, поэтому
// линию аккаунта находим от самой кнопки.
function handleCardClick(event) {
    if (handleViewClick(event)) return;
    const rowPlus = event.target.closest('[data-role="row-plus"]');
    if (rowPlus) {
        addExtractionRow(rowPlus.closest('tr'));
        return;
    }
    // Универсальная карточка: «+ Добавить», выбор типа, очистка строки
    const mixAdd = event.target.closest('[data-role="mix-add"]');
    if (mixAdd) {
        // Кнопка уступает место меню типов (2×2) прямо в ячейке
        const menu = mixAdd.parentElement.querySelector('.ct-mix-menu');
        menu.hidden = false;
        mixAdd.hidden = true;
        mixAdd.setAttribute('aria-expanded', 'true');
        const first = menu.querySelector('button');
        if (first) first.focus();
        return;
    }
    const mixType = event.target.closest('[data-mix-type]');
    const mixClear = event.target.closest('[data-role="mix-clear"]');
    if (mixType || mixClear) {
        const row = event.target.closest('tr');
        if (mixClear) {
            // Подстроки очищаемой строки получают её систему
            const next = row.nextElementSibling;
            if (row.dataset.link !== '1' && next && next.dataset.link === '1') {
                const sys = systemOfRow(row);
                setRowLink(next, false);
                setRowSystem(next, sys);
            }
            setRowLink(row, false);
            setRowSystem(row, '');
        }
        setMixLevel(row, mixType ? mixType.dataset.mixType : '');
        if (mixClear) {
            // Очищенная строка — свободный слот: планета «—»
            const planet = row.querySelector('[data-role="planet"]');
            if (planet) planet.value = '';
        }
        fillMixRow(row, systemOfRow(row));
        saveAccounts();
        const focus = row.querySelector(mixType ? '[data-role="mix-prod"]' : '[data-role="mix-add"]');
        if (focus) focus.focus();
        return;
    }

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
    refreshLine(line);
    pruneEmptyLines();
    saveAccounts();
}

// Счётчик, блокировка ввода и подсказка внутри одной линии
function refreshLine(line) {
    if (!line) return;
    const count = line.querySelector('[data-role="cards"]').children.length;
    line.classList.toggle('is-full', count >= CARDS_LIMIT);
    refreshPilotSelects();
    updateStats();
}

// Пустые ряды убираем (после удаления, перетаскивания, отмены)
function pruneEmptyLines() {
    Array.from(accounts.children).forEach((line) => {
        const cards = line.querySelector('[data-role="cards"]');
        if (cards && !cards.children.length) line.remove();
    });
    refreshAccounts();
}

// Счётчик аккаунтов и общая подсказка, пока линий нет
/* ---- Выбор персонажа в линиях аккаунтов ----
   Персонажи — только подключённые через «LOG IN with EVE Online».
   У персонажа одна карточка на всю страницу: у кого карточка уже есть
   (в любой линии), в списках не показывается; удалили карточку —
   персонаж снова доступен. */
function cardNamesTaken() {
    return new Set(Array.from(document.querySelectorAll('#accounts .card'))
        .map((card) => (card.dataset.name || '').trim().toLowerCase()));
}

function refreshPilotSelects() {
    const chars = typeof eveChars === 'function' && eveConfigured() ? eveChars() : [];
    const taken = cardNamesTaken();
    const free = chars
        .map((c) => c.characterName || '')
        .filter((n) => n && !taken.has(n.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
    const empty = !chars.length
        ? 'Подключите персонажа'
        : (free.length ? 'Выберите персонажа' : 'Все персонажи уже с карточками');
    // Почему выбрать некого — для всплывающей подсказки (showPilotPop)
    const reason = !chars.length ? 'none' : (free.length ? '' : 'used');

    document.querySelectorAll('#pilot-new, #accounts [data-role="pilot"]').forEach((select) => {
        const line = select.closest('.account-line');
        const full = line && line.classList.contains('is-full');
        const keep = free.includes(select.value) ? select.value : '';
        select.innerHTML = `<option value="">${escapeHtml(empty)}</option>`
            + free.map((n) => `<option value="${escapeHtml(n)}"${n === keep ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
        select.disabled = full || !free.length;
        if (reason && !full) select.dataset.empty = reason;
        else delete select.dataset.empty;
        const add = line ? line.querySelector('[data-role="pilot-add"]') : pilotNewAdd;
        if (add && !add.dataset.busy) add.disabled = full || !free.length;
    });
}

/* ---- Подбор карточки по колониям персонажа ----
   Через ESI (право esi-planets.manage_planets.v1) читаем колонии
   персонажа и схему каждой: фабрики с рецептом (schematic) показывают,
   что колония производит. Уровень колонии — самый высокий уровень
   выпускаемого товара; колония только с добычей считается P1.
     все колонии одного уровня P1…P4 — карточка этого уровня;
     уровни разные или колоний нет      — универсальная карточка.
   Если все колонии в одной системе — карточка сразу с этой системой.
   Ответы ESI кэшируются на сервере (до ~10 минут) и обновляются,
   когда колонию открывают в игре. */
const ESI_BASE = 'https://esi.evetech.net/latest';
const esiSchematicNames = new Map();

async function esiPublicJson(path) {
    const res = await fetch(`${ESI_BASE}${path}${path.includes('?') ? '&' : '?'}datasource=tranquility`);
    if (!res.ok) throw new Error(`ESI ${res.status}`);
    return res.json();
}

/* Название рецепта в EVE не всегда совпадает с названием товара:
   рецепт «Transcranial Microcontroller» выпускает «Transcranial
   Microcontrollers». Приводим к названию из справочника PI_COMMODITIES. */
function piCanonicalName(name) {
    if (!name || PI_COMMODITIES[name]) return name;
    const lower = name.toLowerCase();
    return Object.keys(PI_COMMODITIES).find((n) => {
        const l = n.toLowerCase();
        return l === lower || l === lower + 's' || l + 's' === lower;
    }) || name;
}

// Название рецепта = название выпускаемого товара («Coolant»)
async function esiSchematicName(id) {
    if (!esiSchematicNames.has(id)) {
        esiSchematicNames.set(id, esiPublicJson(`/universe/schematics/${id}/`)
            .then((d) => piCanonicalName(d.schematic_name || ''))
            .catch(() => ''));
    }
    return esiSchematicNames.get(id);
}

const piTierOf = (name) => (PI_COMMODITIES[name] ? PI_COMMODITIES[name][1] : 0);

async function analyzeColonies(characterId) {
    const path = `/characters/${characterId}/planets/`;
    const colonies = await eveFetchJson(`${ESI_BASE}${path}?datasource=tranquility`, {}, characterId);
    const result = await Promise.all(colonies.map(async (col) => {
        const layout = await eveFetchJson(
            `${ESI_BASE}${path}${col.planet_id}/?datasource=tranquility`, {}, characterId);
        const pins = layout.pins || [];
        const ids = uniqValues(pins
            .map((pin) => (pin.factory_details && pin.factory_details.schematic_id) || pin.schematic_id)
            .filter(Boolean));
        const products = (await Promise.all(ids.map(esiSchematicName))).filter(Boolean);
        const tier = Math.max(0, ...products.map(piTierOf));
        // Что добывают экстракторы (P0) — по id товара
        const p0s = uniqValues(pins
            .map((pin) => pin.extractor_details && PI_NAME_BY_ID.get(pin.extractor_details.product_type_id))
            .filter(Boolean));
        // Главный товар колонии — товар её уровня; колония только с
        // добычей — P1 из добываемого P0
        let product = products.filter((n) => piTierOf(n) === tier).sort()[0] || '';
        /* Колония P1: пары «P0 → P1». Каждая пара сверяется по рецепту,
           чтобы сырьё строки точно давало её P1 (на планете бывает два
           экстрактора и две базовые фабрики — Water и Reactive Metals). */
        const p0Of = (p1) => {
            const r = PI_RECIPE_OF.get(p1);
            return r && r.outQty === 20 ? r.in[0][0] : '';
        };
        const p1Of = (p0) => {
            const r = PI_RECIPES.find((x) => x.outQty === 20 && x.in[0][0] === p0);
            return r ? r.out : '';
        };
        let pairs = [];
        if ((tier || 1) === 1) {
            const p1s = products.filter((n) => piTierOf(n) === 1);
            // сначала то, что добывают здесь же, потом то, что делают из привозного
            p0s.forEach((p0) => {
                const p1 = p1Of(p0);
                if (p1) pairs.push({ p0, p1 });
            });
            p1s.forEach((p1) => {
                if (!pairs.some((x) => x.p1 === p1)) pairs.push({ p0: p0Of(p1), p1 });
            });
            pairs = pairs.filter((x) => x.p1);
            if (pairs.length) product = pairs[0].p1;
        }
        return {
            planetId: col.planet_id,
            planetType: PLANET_TYPE_OF_ESI[col.planet_type] || '',
            system: col.solar_system_id,
            tier: tier || 1,
            products,
            product,
            p0s,
            pairs
        };
    }));
    return result;
}

// id товара PI → название (для экстракторов)
const PI_NAME_BY_ID = new Map(Object.entries(PI_COMMODITIES).map(([name, [id]]) => [id, name]));
// Тип планеты в ESI — строчными: «barren» → «Barren»
const PLANET_TYPE_OF_ESI = {
    barren: 'Barren', gas: 'Gas', ice: 'Ice', lava: 'Lava', oceanic: 'Oceanic',
    plasma: 'Plasma', storm: 'Storm', temperate: 'Temperate'
};

/* Сохранённая карточка (как в хранилище) по колониям одной системы:
   строки — планета (тип и номер) и товар строки по уровню карточки. */
async function cardFromColonies(level, colonies, systemName) {
    // У колонии может быть своя система (c.systemName); иначе — общая
    // Номер планеты — из её названия в ESI: «Afrah VII» → «VII»
    const named = await Promise.all(colonies.map(async (c) => {
        let number = '';
        try {
            const pl = await esiPublicJson(`/universe/planets/${c.planetId}/`);
            number = String(pl.name || '').split(' ').pop();
        } catch (e) {
            // без номера — подставится первая планета этого типа
        }
        return Object.assign({}, c, { number });
    }));
    const order = (n) => ROMAN_NUMBERS.indexOf(n);
    const sysOf = (c) => c.systemName || systemName || '';
    const sysOrder = uniqValues(named.map(sysOf));
    named.sort((a, b) => sysOrder.indexOf(sysOf(a)) - sysOrder.indexOf(sysOf(b)) || order(a.number) - order(b.number));
    // Колония P1 с несколькими парами «P0 → P1» — по строке на пару
    const rowsOf = named.flatMap((c) => (c.tier === 1 && c.pairs && c.pairs.length
        ? c.pairs.map((pr) => Object.assign({}, c, { product: pr.p1, p0: pr.p0 }))
        : [Object.assign({}, c, { p0: '' })]));
    const list = rowsOf.slice(0, COLONY_ROWS);

    const saved = { level, system: list.length ? sysOf(list[0]) : systemName };
    saved.rows = list.map((c) => ({
        planet: c.planetType,
        number: c.number,
        p0: c.tier === 1 ? (c.p0 || '') : '',
        p1: ''
    }));
    if (isP2Level(level)) saved.p2s = list.map((c) => c.product);
    else if (isProdLevel(level)) saved.prods = list.map((c) => c.product);
    else if (isMixLevel(level)) {
        // первая колония системы — строка со своей системой, остальные — подстроки
        saved.mix = list.map((c, i) => Object.assign(
            { level: `P${c.tier}`, prod: c.product, planet: c.planetType },
            i > 0 && sysOf(list[i - 1]) === sysOf(c) ? { link: true } : { system: sysOf(c) }
        ));
        saved.rows.forEach((r, i) => { r.system = sysOf(list[i]); });
    }
    // Вопросы по строкам: что система не смогла понять сама
    saved.issues = [];
    list.forEach((c, i) => {
        if (!c.product) {
            saved.issues.push({
                row: i,
                text: c.products.length ? `продукт не распознан (${c.products.join(', ')})`
                    : (c.p0s.length ? `добыча ${c.p0s.join(', ')} без фабрик — нет P1` : 'на планете нет ни фабрик, ни экстракторов')
            });
        }
        if (!c.number) saved.issues.push({ row: i, text: 'номер планеты не найден' });
        if (!c.planetType) saved.issues.push({ row: i, text: 'тип планеты не распознан' });
    });
    return saved;
}

async function pickCardForCharacter(char) {
    if (!char || !char.characterId) {
        return { level: MIX_LEVEL, saved: null, note: 'Персонаж не подключён к EVE — универсальная карточка' };
    }
    try {
        const colonies = await analyzeColonies(char.characterId);
        if (!colonies.length) {
            return { level: MIX_LEVEL, saved: null, note: 'Колоний в EVE нет — универсальная карточка' };
        }
        const tiers = uniqValues(colonies.map((c) => c.tier)).sort();
        // Новый вид — универсальная карточка для любых колоний
        const level = MIX_LEVEL;
        const issues = [];

        /* Колонии всех систем: у каждой строки своя система */
        const ids = uniqValues(colonies.map((c) => c.system));
        const names = new Map();
        await Promise.all(ids.map(async (id) => {
            const sys = await esiPublicJson(`/universe/systems/${id}/`).catch(() => ({}));
            names.set(id, sys.name || '');
        }));
        ids.forEach((id) => {
            const name = names.get(id);
            if (!name) issues.push({ text: `не удалось узнать систему ${id} — выберите её в строке` });
            else if (typeof SOLAR_SYSTEMS !== 'undefined' && !SOLAR_SYSTEMS.includes(name)) {
                issues.push({ text: `системы ${name} нет в справочнике сайта — выберите систему в строке` });
            }
        });
        const saved = await cardFromColonies(level,
            colonies.map((c) => Object.assign({}, c, { systemName: names.get(c.system) || '' })), '');
        const filled = saved.rows.length;
        issues.push(...saved.issues);
        const mainCols = colonies;

        const n = colonies.length;
        const what = tiers.length === 1 ? `все P${tiers[0]}` : `уровни ${tiers.map((t) => `P${t}`).join(', ')}`;
        const rest = n - mainCols.length;
        return {
            level,
            saved,
            issues,
            note: `Колоний: ${n} (${what}) → карточка ${level === MIX_LEVEL ? 'универсальная' : level}`
                + (filled ? `, заполнено строк: ${filled}` : '')
                + (rest > 0 ? `; ещё ${rest} — в других системах` : '')
        };
    } catch (e) {
        return { level: MIX_LEVEL, saved: null, note: `Не удалось прочитать колонии (${e.message}) — универсальная карточка` };
    }
}

/* ---- Тест EVE ----
   Кнопка «Тест» рядом со «Статистикой» открывает окно с тестовыми
   карточками персонажей Sigetar и CrazyJam: всё, что ESI отдаёт по
   их планетарке (право esi-planets.manage_planets.v1):
     колонии — система, планета, тип, уровень Command Center, число
       построек, когда колонию последний раз открывали в игре;
     по каждой колонии — экстракторы (P0, головки, выход за цикл,
       длина цикла, когда закончится), фабрики (рецепт → товар, их
       число), склады (что и сколько лежит), маршруты, связи;
     и «сырые» ответы ESI целиком — для сверки. */
const EVE_TEST_PILOTS = ['Sigetar', 'CrazyJam'];

/* Версия страницы — в заголовке окна «Тест»: по ней видно, дошло ли
   обновление сайта до браузера. APP_BUILD меняется при каждой правке
   app.js; версии файлов берутся из адресов скриптов и стилей (?v=). */
const APP_BUILD = '14.10.2026 01:15';
// Версия — и под кнопкой «← Sigetar.ru» в шапке
(function showHeaderVersion() {
    const el = document.getElementById('app-version');
    if (!el) return;
    // версия app.js и версия стилей — из адресов (?v=)
    const ver = (sel, attr) => {
        const node = document.querySelector(sel);
        const m = node && (node.getAttribute(attr) || '').match(/[?&]v=(\d+)/);
        return m ? m[1] : '?';
    };
    el.textContent = `v${ver('script[src*="js/app.js"]', 'src')} · css v${ver('link[href*="css/style.css"]', 'href')} · ${APP_BUILD}`;
    el.title = 'Версия сайта: если после обновления она не сменилась — Ctrl+F5';
}());
function appVersionText() {
    const v = (sel, attr) => {
        const el = document.querySelector(sel);
        const m = el && (el.getAttribute(attr) || '').match(/[?&]v=(\d+)/);
        return m ? m[1] : '?';
    };
    return `сборка ${APP_BUILD} · app.js v${v('script[src*="js/app.js"]', 'src')}`
        + ` · style.css v${v('link[href*="css/style.css"]', 'href')}`
        + ` · eveauth.js v${v('script[src*="js/eveauth.js"]', 'src')}`
        + eveAutoSnapsText();
}
const esiTypeNames = new Map();

// Названия типов (постройки, товары) одним запросом /universe/names/
async function esiNamesOf(ids) {
    const need = uniqValues(ids.filter((id) => id && !esiTypeNames.has(id)));
    for (let i = 0; i < need.length; i += 900) {
        const part = need.slice(i, i + 900);
        try {
            const res = await fetch(`${ESI_BASE}/universe/names/?datasource=tranquility`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(part)
            });
            const list = res.ok ? await res.json() : [];
            list.forEach((x) => esiTypeNames.set(x.id, x.name));
        } catch (e) {
            // без названия — покажем id
        }
    }
}
const esiTypeName = (id) => PI_NAME_BY_ID.get(id) || esiTypeNames.get(id) || `#${id}`;

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const p2 = (n) => String(n).padStart(2, '0');
    return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const fmtLeft = (iso) => {
    if (!iso) return '';
    const ms = new Date(iso) - Date.now();
    if (ms <= 0) return '<span class="evt-bad">остановлен</span>';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `<span class="evt-ok">осталось ${h ? `${h} ч ` : ''}${m} мин</span>`;
};
const fmtCycle = (sec) => (sec >= 3600 && sec % 3600 === 0 ? `${sec / 3600} ч` : `${Math.round(sec / 60)} мин`);
const resChip = (name) => {
    const tier = PI_COMMODITIES[name] ? `P${PI_COMMODITIES[name][1]}` : '';
    return `<span class="evt-res">${tier ? tierBadgeHtml(tier) : ''}${iconFor(name)}${escapeHtml(name)}</span>`;
};

async function loadEveTest(char) {
    const path = `/characters/${char.characterId}/planets/`;
    const colonies = await eveFetchJson(`${ESI_BASE}${path}?datasource=tranquility`, {}, char.characterId);
    const details = await Promise.all(colonies.map(async (col) => {
        const [layout, planet, system] = await Promise.all([
            eveFetchJson(`${ESI_BASE}${path}${col.planet_id}/?datasource=tranquility`, {}, char.characterId),
            esiPublicJson(`/universe/planets/${col.planet_id}/`).catch(() => ({})),
            esiPublicJson(`/universe/systems/${col.solar_system_id}/`).catch(() => ({}))
        ]);
        const pins = layout.pins || [];
        const sids = uniqValues(pins.map((p) => (p.factory_details && p.factory_details.schematic_id) || p.schematic_id).filter(Boolean));
        const schematics = {};
        await Promise.all(sids.map(async (id) => { schematics[id] = await esiSchematicName(id); }));
        return { col, layout, planet, system, schematics };
    }));
    // Названия всех типов: постройки, товары в складах и маршрутах
    const ids = [];
    details.forEach(({ layout }) => {
        (layout.pins || []).forEach((p) => {
            ids.push(p.type_id);
            (p.contents || []).forEach((c) => ids.push(c.type_id));
        });
        (layout.routes || []).forEach((r) => ids.push(r.content_type_id));
    });
    await esiNamesOf(ids.filter((id) => !PI_NAME_BY_ID.has(id)));
    return { colonies, details };
}

/* ---- Расчёт складов на «сейчас» и журнал ----
   EVE отдаёт состояние колонии на момент, когда её открывали в игре
   (last_update). Дальше колония работает сама, и это можно досчитать:
     экстрактор — каждые cycle_time сек кладёт qty_per_cycle своего P0
       по своему маршруту (до expiry_time); выход за цикл считаем
       постоянным — в игре он слегка плавает, так что это оценка;
     фабрика — раз в цикл рецепта (P1 — 30 мин, P2–P4 — час) забирает
       входы рецепта (сначала из своего буфера, потом со складов, откуда
       к ней идут маршруты) и через цикл отдаёт товар по своему маршруту.
       Нет всех входов — цикл не начинается, ждёт следующего.
   Буфер фабрики: в момент старта цикла маршрут тут же подвозит со
   склада следующую партию (до одной партии на вход) — так в игре.
   События идут по времени, поэтому склад, который пополняет одна
   фабрика и опустошает другая (P1 → P2 → P3…), считается честно.

   Срезы. Каждое открытие колонии в игре — снимок из EVE; кроме того,
   можно вставить срез склада, скопированный из игры. Срезы хранятся
   (localStorage, PI_SNAPS_KEY). В момент среза расчёт сверяется с
   фактом: лишнее на складе, чего не могло получиться по маршрутам, —
   завезено вручную; недостача сверх расхода по маршрутам — забрано.
   Дальше расчёт идёт уже от среза. */
const PI_SNAPS_KEY = 'evepi.pi.snaps';
const piSnaps = () => store.get(PI_SNAPS_KEY, {});
function piSnapsOf(planetId) {
    const all = piSnaps();
    return all[planetId] || { esi: [], manual: [] };
}
function piSaveSnaps(planetId, data) {
    const all = piSnaps();
    data.esi = data.esi.slice(-10);
    data.manual = data.manual.slice(-30);
    all[planetId] = data;
    store.set(PI_SNAPS_KEY, all);
}

// Склады колонии из ответа EVE: { pin_id: { товар: количество } }
function pinsContentsOf(layout) {
    const out = {};
    (layout.pins || []).forEach((p) => {
        if (!(p.contents || []).length) return;
        out[p.pin_id] = {};
        p.contents.forEach((c) => {
            const name = esiTypeName(c.type_id);
            out[p.pin_id][name] = (out[p.pin_id][name] || 0) + c.amount;
        });
    });
    return out;
}

// Снимок из EVE запоминаем, если колонию открывали после прошлого раза
function saveEsiSnapshot(col, layout) {
    const snaps = piSnapsOf(col.planet_id);
    if (!snaps.esi.some((x) => x.t === col.last_update)) {
        snaps.esi.push({ t: col.last_update, pins: pinsContentsOf(layout) });
        snaps.esi.sort((a, b) => new Date(a.t) - new Date(b.t));
        piSaveSnaps(col.planet_id, snaps);
    }
    return snaps;
}

/* Авто-срезы. Пока страница открыта, раз в 10 минут (так EVE обновляет
   кэш) спрашиваем колонии всех подключённых персонажей и сохраняем
   каждый новый снимок (новый last_update) — даже при закрытом окне
   «Тест». Скрытая вкладка проверку пропускает и догоняет, когда снова
   станет видимой. */
const EVE_AUTO_SNAPS_MS = 10 * 60 * 1000;
const eveAutoSnaps = { started: false, busy: false, lastAt: 0, added: 0, total: 0, error: '' };

function eveAutoSnapsText() {
    if (!eveAutoSnaps.lastAt) return eveAutoSnaps.started ? ' · авто-срезы: ждут персонажей' : '';
    const t = new Date(eveAutoSnaps.lastAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return ` · авто-срезы: проверка ${t}, новых ${eveAutoSnaps.added} (за сеанс ${eveAutoSnaps.total})`
        + (eveAutoSnaps.error ? ` · ошибка: ${eveAutoSnaps.error}` : '');
}

async function pollEveSnapshots() {
    if (eveAutoSnaps.busy || typeof eveChars !== 'function' || !eveConfigured()) return;
    const chars = eveChars();
    if (!chars.length) return;
    eveAutoSnaps.busy = true;
    let added = 0;
    const errors = [];
    for (const char of chars) {
        const path = `/characters/${char.characterId}/planets/`;
        try {
            // eslint-disable-next-line no-await-in-loop
            const colonies = await eveFetchJson(`${ESI_BASE}${path}?datasource=tranquility`, {}, char.characterId);
            // eslint-disable-next-line no-await-in-loop
            await Promise.all((colonies || []).map(async (col) => {
                if (piSnapsOf(col.planet_id).esi.some((x) => x.t === col.last_update)) return;
                const layout = await eveFetchJson(`${ESI_BASE}${path}${col.planet_id}/?datasource=tranquility`, {}, char.characterId);
                saveEsiSnapshot(col, layout);
                added += 1;
            }));
        } catch (e) {
            errors.push(`${char.characterName || char.characterId}: ${e.message}`);
        }
    }
    eveAutoSnaps.busy = false;
    eveAutoSnaps.lastAt = Date.now();
    eveAutoSnaps.added = added;
    eveAutoSnaps.total += added;
    eveAutoSnaps.error = errors.join('; ');
    const ver = document.getElementById('evetest-version');
    if (ver) ver.textContent = appVersionText();
}

function startEveAutoSnaps() {
    if (eveAutoSnaps.started) return;
    eveAutoSnaps.started = true;
    const tick = () => {
        if (document.hidden) return;
        if (eveAutoSnaps.lastAt && Date.now() - eveAutoSnaps.lastAt < EVE_AUTO_SNAPS_MS - 5000) return;
        pollEveSnapshots();
    };
    tick();
    setInterval(tick, 60 * 1000);
    document.addEventListener('visibilitychange', tick);
}

/* Срез склада, скопированный из игры (Ctrl+A, Ctrl+C в окне склада):
   «Biofuels*	2 760	524.4 м^3» — название, количество, объём. */
function parseInventoryText(text) {
    const byLower = new Map(Object.keys(PI_COMMODITIES).map((n) => [n.toLowerCase(), n]));
    const items = {};
    text.split(/\r?\n/).forEach((line) => {
        const raw = line.trim();
        if (!raw) return;
        let name;
        let qty;
        const parts = raw.split('\t').map((x) => x.trim()).filter(Boolean);
        if (parts.length >= 2) {
            name = parts[0];
            qty = parts[1];
        } else {
            const m = raw.match(/^(.+?)\*?\s+(\d[\d\s\u00a0\u202f]*)(\s+[\d.,]+\s*м.*)?$/);
            if (!m) return;
            [, name, qty] = m;
        }
        name = name.replace(/\*+$/, '').trim();
        const n = parseInt(String(qty).replace(/[\s\u00a0\u202f.,]/g, ''), 10);
        if (!name || Number.isNaN(n)) return;
        const key = byLower.get(name.toLowerCase()) || name;
        items[key] = (items[key] || 0) + n;
    });
    return items;
}

const pinIsFactory = (p) => Boolean((p.factory_details && p.factory_details.schematic_id) || p.schematic_id || p.extractor_details);

/* Снимки и срезы хранятся по номеру планеты, а на одной планете бывают
   колонии разных персонажей (у Sigetar и CrazyJam — общие DFTK-D II, III,
   IX). Своё у колонии — только то, что относится к её постройкам. */
const ownPinsOf = (layout) => new Set((layout.pins || []).map((p) => String(p.pin_id)));
const snapIsOwn = (own, snap) => Object.keys((snap && snap.pins) || {}).some((id) => own.has(id));

function simulateColony(layout, schematics, startTime, endTime, opts = {}) {
    const pins = layout.pins || [];
    const own = ownPinsOf(layout);
    const routes = layout.routes || [];
    const stock = new Map();             // pin_id -> Map(название -> количество)
    const bag = (id) => {
        if (!stock.has(id)) stock.set(id, new Map());
        return stock.get(id);
    };
    const add = (id, name, qty) => bag(id).set(name, (bag(id).get(name) || 0) + qty);
    const initial = opts.stock || pinsContentsOf(layout);
    Object.entries(initial).filter(([id]) => own.has(String(id))).forEach(([id, items]) => Object.entries(items)
        .forEach(([name, n]) => add(Number(id), name, n)));
    // буферы фабрик берём из ответа EVE, если считаем от его снимка
    if (opts.stock) {
        pins.filter(pinIsFactory).forEach((p) => (p.contents || [])
            .forEach((c) => { if (!initial[p.pin_id]) add(p.pin_id, esiTypeName(c.type_id), c.amount); }));
    }
    const before = new Map(Array.from(stock.entries()).map(([id, m]) => [id, new Map(m)]));

    const t0 = new Date(startTime).getTime();
    const t1 = endTime;
    const outRoute = (pinId, name) => routes.find((r) => r.source_pin_id === pinId && esiTypeName(r.content_type_id) === name);
    const stats = { factoryCycles: 0, factoryIdle: 0, extractorCycles: 0 };
    const perFactory = new Map();        // pin_id -> сведения о фабрике и её циклах
    const log = [];                      // сверки со срезами

    /* Очередь событий по времени. Фабрика здесь живёт как в игре:
       закончила цикл — выдала товар по маршруту и сразу пробует начать
       следующий; стоит без сырья — запускается в ту же минуту, когда
       на складе-источнике набралась партия (после выхода другой фабрики,
       добычи или вашего среза), а не ждёт «своего часа». */
    const queue = [];
    const push = (ev) => {
        let i = queue.length;
        while (i > 0 && (queue[i - 1].t > ev.t || (queue[i - 1].t === ev.t && queue[i - 1].order > ev.order))) i -= 1;
        queue.splice(i, 0, ev);
    };

    const factories = [];
    pins.forEach((p) => {
        const sid = (p.factory_details && p.factory_details.schematic_id) || p.schematic_id;
        const recipe = sid && PI_RECIPE_OF.get(schematics[sid]);
        if (!recipe) return;
        const ms = recipe.cycle * 1000;
        const from = {};
        recipe.in.forEach(([name]) => {
            from[name] = routes
                .filter((r) => r.destination_pin_id === p.pin_id && esiTypeName(r.content_type_id) === name)
                .map((r) => r.source_pin_id);
        });
        const lastStart = p.last_cycle_start ? new Date(p.last_cycle_start).getTime() : 0;
        const wasRunning = Boolean(lastStart) && lastStart <= t0 && t0 - lastStart < ms;
        const f = {
            pin: p.pin_id, recipe, ms, from,
            info: {
                product: recipe.out, cycles: 0, idle: 0, missing: new Set(),
                sources: new Set(Object.values(from).flat()),
                cycleMs: ms, wasRunning, lastStart: p.last_cycle_start || '',
                state: { running: wasRunning, since: wasRunning ? lastStart : t0, lack: [] },
                timeline: []
            }
        };
        perFactory.set(p.pin_id, f.info);
        factories.push(f);
        if (wasRunning) {
            f.info.timeline.push({ start: lastStart, end: lastStart + ms });
            push({ t: lastStart + ms, order: 1, f, kind: 'end' });
        }
    });

    // Попытка запустить цикл: партия из буфера фабрики + со складов-источников
    const tryStart = (f, t) => {
        const st = f.info.state;
        if (st.running) return;
        const plan = f.recipe.in.map(([name, need]) => {
            const sources = [f.pin].concat(f.from[name]);
            const have = sources.reduce((n, id) => n + (bag(id).get(name) || 0), 0);
            return { name, need, sources, ok: have >= need };
        });
        st.lack = plan.filter((x) => !x.ok).map((x) => x.name);
        if (st.lack.length) return;
        plan.forEach(({ name, need, sources }) => {
            let left = need;
            sources.forEach((id) => {
                const take = Math.min(left, bag(id).get(name) || 0);
                if (take) bag(id).set(name, bag(id).get(name) - take);
                left -= take;
            });
        });
        // маршрут сразу подвозит в буфер следующую партию (как в игре)
        plan.forEach(({ name, need, sources }) => {
            let room = need - (bag(f.pin).get(name) || 0);
            sources.slice(1).forEach((id) => {
                const take = Math.min(room, bag(id).get(name) || 0);
                if (take > 0) {
                    bag(id).set(name, bag(id).get(name) - take);
                    add(f.pin, name, take);
                    room -= take;
                }
            });
        });
        st.running = true;
        st.since = t;
        f.info.timeline.push({ start: t, end: t + f.ms });
        push({ t: t + f.ms, order: 1, f, kind: 'end' });
    };
    // На склад что-то пришло — будим стоящие фабрики, которые с него берут
    const wake = (pinId, t) => factories
        .filter((g) => !g.info.state.running && Object.values(g.from).some((ids) => ids.includes(pinId)))
        .forEach((g) => tryStart(g, t));

    // Экстракторы: каждые cycle_time — qty_per_cycle по маршруту
    pins.forEach((p) => {
        const d = p.extractor_details;
        if (!(d && d.cycle_time && p.install_time)) return;
        const name = esiTypeName(d.product_type_id);
        const ms = d.cycle_time * 1000;
        const start = new Date(p.install_time).getTime();
        const end = Math.min(t1, p.expiry_time ? new Date(p.expiry_time).getTime() : t1);
        for (let k = Math.max(1, Math.floor((t0 - start) / ms) + 1), t = start + k * ms; t <= end; k += 1, t = start + k * ms) {
            push({ t, order: 0, kind: 'ext', run: () => {
                const r = outRoute(p.pin_id, name);
                const dest = r ? r.destination_pin_id : p.pin_id;
                add(dest, name, d.qty_per_cycle || 0);
                stats.extractorCycles += 1;
                return dest;
            } });
        }
    });

    // Срезы из игры: сверка с расчётом и замена расчёта фактом
    (opts.slices || []).forEach((sl) => {
        const t = new Date(sl.t).getTime();
        if (t <= t0 || t > t1 || !own.has(String(sl.pin))) return;
        push({ t, order: 2, kind: 'slice', run: () => {
            const was = bag(sl.pin);
            const names = new Set([...was.keys(), ...Object.keys(sl.items)]);
            const diffs = [];
            names.forEach((name) => {
                const d = Math.round((sl.items[name] || 0) - (was.get(name) || 0));
                if (d) diffs.push({ name, d });
            });
            log.push({ t: sl.t, pin: sl.pin, source: sl.source || 'manual', diffs });
            stock.set(sl.pin, new Map(Object.entries(sl.items)));
            return sl.pin;
        } });
    });

    // Стоящие на момент снимка фабрики пробуют запуститься сразу
    factories.forEach((f) => tryStart(f, t0));

    while (queue.length && queue[0].t <= t1) {
        const ev = queue.shift();
        if (ev.kind === 'end') {
            const { f } = ev;
            const r = outRoute(f.pin, f.recipe.out);
            const dest = r ? r.destination_pin_id : f.pin;
            add(dest, f.recipe.out, f.recipe.outQty);
            stats.factoryCycles += 1;
            f.info.cycles += 1;
            f.info.state.running = false;
            tryStart(f, ev.t);
            if (!f.info.state.running) {
                stats.factoryIdle += 1;
                f.info.idle += 1;
                f.info.state.since = ev.t;
                f.info.state.lack.forEach((x) => f.info.missing.add(x));
            }
            wake(dest, ev.t);
        } else {
            const dest = ev.run();
            wake(dest, ev.t);
        }
    }
    // фабрики, которые так и не запустились
    factories.forEach((f) => {
        if (!f.info.state.running && !f.info.cycles) f.info.state.lack.forEach((x) => f.info.missing.add(x));
    });

    return { stock, before, stats, perFactory, log, hours: Math.max(0, (t1 - t0) / 3600000) };
}

const evtData = new Map();              // planet_id -> данные колонии для перерисовки

/* Потоки колонии по складам: какие фабрики берут товар с этого склада
   (сколько за цикл) и какие кладут на него. Отсюда:
     • кратность партии — расхождение среза с расчётом, кратное партии
       (40/80 P1, 10 P2…), почти наверняка сдвиг цикла: партия уже
       забрана фабрикой или ещё в работе. Руками обычно берут больше
       или некруглое количество;
     • расход в час и на сколько хватит запаса. */
function colonyFlows(layout, schematics) {
    const pins = layout.pins || [];
    const routes = layout.routes || [];
    const flows = new Map();            // `${pin}|${товар}` -> { units:Set, users, makers, perHourOut, perHourIn, outputs:[{name, pin}] }
    const key = (pin, name) => `${pin}|${name}`;
    const get = (pin, name) => {
        const k = key(pin, name);
        if (!flows.has(k)) flows.set(k, { units: new Set(), users: 0, makers: 0, perHourOut: 0, perHourIn: 0, outputs: [] });
        return flows.get(k);
    };
    pins.forEach((p) => {
        const sid = (p.factory_details && p.factory_details.schematic_id) || p.schematic_id;
        const recipe = sid && PI_RECIPE_OF.get(schematics[sid]);
        if (!recipe) return;
        const perHour = 3600 / recipe.cycle;
        const outR = routes.find((r) => r.source_pin_id === p.pin_id && esiTypeName(r.content_type_id) === recipe.out);
        recipe.in.forEach(([name, need]) => {
            routes.filter((r) => r.destination_pin_id === p.pin_id && esiTypeName(r.content_type_id) === name)
                .forEach((r) => {
                    const f = get(r.source_pin_id, name);
                    f.units.add(need);
                    f.users += 1;
                    f.perHourOut += need * perHour;
                    if (outR) f.outputs.push({ name: recipe.out, pin: outR.destination_pin_id });
                });
        });
        if (outR) {
            const f = get(outR.destination_pin_id, recipe.out);
            f.units.add(recipe.outQty);
            f.makers += 1;
            f.perHourIn += recipe.outQty * perHour;
        }
    });
    // Готовая продукция: товар делают, но ни одна фабрика его не берёт —
    // обычно его вывозят руками, и убыль на складе — это вывоз
    const consumed = new Set();
    routes.forEach((r) => {
        const dest = pins.find((p) => p.pin_id === r.destination_pin_id);
        if (dest && ((dest.factory_details && dest.factory_details.schematic_id) || dest.schematic_id)) {
            consumed.add(esiTypeName(r.content_type_id));
        }
    });
    const finals = new Set();
    pins.forEach((p) => {
        const sid = (p.factory_details && p.factory_details.schematic_id) || p.schematic_id;
        const recipe = sid && PI_RECIPE_OF.get(schematics[sid]);
        if (recipe && !consumed.has(recipe.out)) finals.add(recipe.out);
    });
    return { get: (pin, name) => flows.get(key(pin, name)) || null, finals };
}

// Расхождение кратно партии фабрик этого склада и не больше пары циклов
function isBatchShift(flow, d) {
    if (!flow) return false;
    const n = Math.abs(d);
    return Array.from(flow.units).some((u) => u > 0 && n % u === 0 && n / u <= Math.max(1, flow.users + flow.makers) * 2);
}

function eveTestColonyHtml(detail) {
    const { col, layout, planet, system, schematics } = detail;
    evtData.set(String(col.planet_id), detail);
    const pins = layout.pins || [];
    const pinName = new Map(pins.map((p) => [p.pin_id, esiTypeName(p.type_id)]));
    const extractors = pins.filter((p) => p.extractor_details);
    const stores = pins.filter((p) => (p.contents || []).length && !pinIsFactory(p));
    const routes = layout.routes || [];
    const links = layout.links || [];
    const fmtN = (n) => Math.round(n).toLocaleString('ru-RU');
    const pinLabel = (id) => escapeHtml(pinName.get(id) || String(id));

    // Снимки: из EVE (каждое открытие в игре) и вставленные срезы
    const snaps = saveEsiSnapshot(col, layout);
    const esiT = new Date(col.last_update).getTime();
    const now = Date.now();
    const ownPins = ownPinsOf(layout);
    const slicesAfter = snaps.manual.filter((x) => new Date(x.t).getTime() > esiT && ownPins.has(String(x.pin)));
    const sim = simulateColony(layout, schematics, col.last_update, now, { slices: slicesAfter });

    // Сверка прошлого открытия в игре с нынешним: что сделали руками
    let esiLog = [];
    const ownEsi = snaps.esi.filter((x) => x.t === col.last_update || snapIsOwn(ownPins, x));
    const idx = ownEsi.findIndex((x) => x.t === col.last_update);
    const prev = idx > 0 ? ownEsi[idx - 1] : null;
    if (prev) {
        const between = snaps.manual.filter((x) => {
            const t = new Date(x.t).getTime();
            return t > new Date(prev.t).getTime() && t < esiT && ownPins.has(String(x.pin));
        });
        const cur = pinsContentsOf(layout);
        const slicesAtEsi = Object.keys(cur).concat(Object.keys(prev.pins))
            .filter((id, i, arr) => arr.indexOf(id) === i)
            .filter((id) => !pinIsFactory(pins.find((p) => String(p.pin_id) === id) || {}))
            .map((id) => ({ t: col.last_update, pin: Number(id), items: cur[id] || {}, source: 'esi' }));
        const back = simulateColony(layout, schematics, prev.t, esiT, { stock: prev.pins, slices: between.concat(slicesAtEsi) });
        esiLog = back.log;
    }

    const flows = colonyFlows(layout, schematics);

    const ext = extractors.map((p) => {
        const d = p.extractor_details;
        return `<li>${resChip(esiTypeName(d.product_type_id))}
            головок: ${(d.heads || []).length}, ${d.qty_per_cycle || 0} ед. за цикл ${d.cycle_time ? fmtCycle(d.cycle_time) : ''}
            · запущен ${fmtDate(p.install_time)} · до ${fmtDate(p.expiry_time)} ${fmtLeft(p.expiry_time)}</li>`;
    }).join('');

    // Фабрики по товару: сколько их, сколько циклов отработали в расчёте,
    // простои и чего не хватало — чтобы было видно, почему склад не убывает
    const byProduct = new Map();
    sim.perFactory.forEach((f) => {
        const g = byProduct.get(f.product) || { n: 0, cycles: 0, idle: 0, missing: new Set(), sources: new Set(), was: 0, busy: 0, ends: [], lack: new Set() };
        g.n += 1;
        g.cycles += f.cycles;
        g.idle += f.idle;
        if (f.wasRunning) g.was += 1;
        if (f.state.running) {
            g.busy += 1;
            g.ends.push(f.state.since + f.cycleMs);
        } else (f.state.lack || []).forEach((x) => g.lack.add(x));
        f.missing.forEach((x) => g.missing.add(x));
        f.sources.forEach((x) => g.sources.add(x));
        byProduct.set(f.product, g);
    });
    /* Буфер каждой фабрики на момент открытия в игре: что уже лежит
       в ней под следующий цикл и чего не хватает до полной партии */
    const buffersOf = new Map();         // товар -> [html строк по фабрикам]
    pins.forEach((p) => {
        const sid = (p.factory_details && p.factory_details.schematic_id) || p.schematic_id;
        const recipe = sid && PI_RECIPE_OF.get(schematics[sid]);
        if (!recipe) return;
        const have = {};
        (p.contents || []).forEach((c) => {
            const n = esiTypeName(c.type_id);
            have[n] = (have[n] || 0) + c.amount;
        });
        const f = sim.perFactory.get(p.pin_id);
        const parts = recipe.in.map(([name, need]) => {
            const got = have[name] || 0;
            const lack = Math.max(0, need - got);
            return `${resChip(name)} <span class="${lack ? 'evt-bad' : 'evt-ok'}">${fmtN(got)}/${fmtN(need)}</span>${lack ? ` <span class="evt-bad">(не хватает ${fmtN(lack)})</span>` : ''}`;
        });
        const extra = Object.entries(have).filter(([n]) => !recipe.in.some(([x]) => x === n))
            .map(([n, q]) => `${resChip(n)} ${fmtN(q)}`);
        const full = recipe.in.every(([name, need]) => (have[name] || 0) >= need);
        const st = f && f.wasRunning
            ? `<span class="evt-ok">в работе с ${fmtDate(p.last_cycle_start).slice(-5)}</span>`
            : `<span class="evt-bad">стояла</span>${p.last_cycle_start ? ` (последний цикл ${fmtDate(p.last_cycle_start)})` : ''}`;
        // циклы в расчёте: последние старты и когда выйдет следующий товар
        const tl = f ? f.timeline : [];
        const hm = (ms) => fmtDate(new Date(ms).toISOString()).slice(-5);
        const recent = tl.slice(-4).map((c) => `${hm(c.start)}→${hm(c.end)}`).join(', ');
        const next = tl.length && tl[tl.length - 1].end > now ? hm(tl[tl.length - 1].end) : '';
        const timeline = tl.length
            ? ` · <span class="evt-dim">циклы в расчёте: ${recent}${next ? ` · следующий выход в ${next}` : ''}</span>`
            : ' · <span class="evt-dim">в расчёте не запускалась</span>';
        const list = buffersOf.get(recipe.out) || [];
        list.push(`<li>№${list.length + 1}: ${st} · буфер ${full ? '<span class="evt-ok">полный</span>' : '<span class="evt-bad">неполный</span>'}:
            ${parts.join(' · ')}${extra.length ? ` · ещё ${extra.join(', ')}` : ''}${timeline}</li>`);
        buffersOf.set(recipe.out, list);
    });

    const fac = Array.from(byProduct.entries()).sort((a, b) => piTierOf(a[0]) - piTierOf(b[0]) || a[0].localeCompare(b[0]))
        .map(([name, g]) => `<li>${resChip(name)} × ${g.n}
            <span class="evt-dim">· при открытии работали ${g.was} из ${g.n}
            · сейчас ${g.busy ? `<span class="evt-ok">в работе ${g.busy}</span> до ${fmtDate(new Date(Math.min(...g.ends)).toISOString()).slice(-5)}` : ''}${g.busy && g.busy < g.n ? ', ' : ''}${g.busy < g.n ? `<span class="evt-bad">стоят ${g.n - g.busy}</span>${g.lack.size ? ` (нет: ${escapeHtml(Array.from(g.lack).join(', '))})` : ''}` : ''}
            · циклов в расчёте ${g.cycles}${g.idle ? ` · <span class="evt-bad">простоев ${g.idle}</span>` : ''}
            ${g.missing.size ? ` · не хватало: ${escapeHtml(Array.from(g.missing).join(', '))}` : ''}
            ${g.sources.size ? ` · входы из: ${Array.from(g.sources).map(pinLabel).join(', ')}` : ' · <span class="evt-bad">нет маршрутов на вход</span>'}</span>
            <ul class="evt-sub evt-buffers">${(buffersOf.get(name) || []).join('')}</ul></li>`).join('');

    const sto = stores.map((p) => `<li><b>${pinLabel(p.pin_id)}</b>: ${(p.contents || [])
        .map((c) => `${resChip(esiTypeName(c.type_id))} ${fmtN(c.amount)}`).join(' · ')}</li>`).join('');
    const rts = routes.map((r) => `<li>${resChip(esiTypeName(r.content_type_id))} ${fmtN(r.quantity)}:
        ${pinLabel(r.source_pin_id)} → ${pinLabel(r.destination_pin_id)}</li>`).join('');

    // Склады сейчас: расчёт + кнопка вставки среза из игры
    const storePins = pins.filter((p) => !pinIsFactory(p) && (sim.stock.has(p.pin_id) || /Storage|Launchpad|Command/i.test(pinName.get(p.pin_id) || '')));
    const nowStores = storePins.map((p) => {
        const was = sim.before.get(p.pin_id) || new Map();
        const cur = sim.stock.get(p.pin_id) || new Map();
        const items = Array.from(cur.entries())
            .filter(([name, n]) => n > 0 || was.get(name))
            .sort((a, b) => piTierOf(a[0]) - piTierOf(b[0]) || a[0].localeCompare(b[0]))
            .map(([name, n]) => {
                const delta = n - (was.get(name) || 0);
                const sign = delta > 0 ? `<span class="evt-ok">+${fmtN(delta)}</span>`
                    : (delta < 0 ? `<span class="evt-bad">${fmtN(delta)}</span>` : '');
                // На сколько хватит: чистый расход в час этого склада
                const f = flows.get(p.pin_id, name);
                let fc = '';
                if (f) {
                    const net = f.perHourIn - f.perHourOut;
                    if (net < 0 && n > 0) {
                        const hrs = n / -net;
                        const until = fmtDate(new Date(now + hrs * 3600000).toISOString());
                        const outs = uniqValues(f.outputs.map((o) => `${escapeHtml(o.name)} → ${pinLabel(o.pin)}`));
                        fc = `<span class="evt-dim"> · −${fmtN(-net)}/ч, хватит на ${hrs >= 48 ? `${Math.round(hrs / 24)} сут` : `${Math.floor(hrs)} ч`} (до ${until})${outs.length ? `; уходит в ${outs.join(', ')}` : ''}</span>`;
                    } else if (net > 0) {
                        fc = `<span class="evt-dim"> · +${fmtN(net)}/ч</span>`;
                    }
                }
                return `<li>${resChip(name)} ${fmtN(n)} ${sign}${fc}</li>`;
            }).join('');
        return `<li><b>${pinLabel(p.pin_id)}</b>
            <button type="button" class="evt-slice-btn" data-planet="${col.planet_id}" data-pin="${p.pin_id}">Вставить срез из игры</button>
            <ul class="evt-sub">${items || '<li class="evt-dim">пусто</li>'}</ul></li>`;
    }).join('');
    const h = Math.floor(sim.hours);
    const m = Math.round((sim.hours - h) * 60);
    const lastSlice = slicesAfter.length ? slicesAfter[slicesAfter.length - 1] : null;
    const simNote = `от открытия в игре прошло ${h ? `${h} ч ` : ''}${m} мин`
        + (lastSlice ? ` · с учётом срезов до ${fmtDate(lastSlice.t)}` : '')
        + ` · циклов фабрик ${sim.stats.factoryCycles}`
        + (sim.stats.factoryIdle ? ` · простоев ${sim.stats.factoryIdle}` : '')
        + ` · циклов добычи ${sim.stats.extractorCycles}`;

    // Журнал: сверки срезов с расчётом, новые сверху
    const logHtml = esiLog.concat(sim.log).sort((a, b) => new Date(b.t) - new Date(a.t)).map((e) => {
        const taken = e.diffs.filter(({ name, d }) => d < 0 && flows.finals.has(name));
        const shifts = e.diffs.filter((x) => !taken.includes(x) && isBatchShift(flows.get(e.pin, x.name), x.d));
        const manual = e.diffs.filter((x) => !shifts.includes(x) && !taken.includes(x));
        const what = (manual.length || shifts.length || taken.length)
            ? taken.map(({ name, d }) => `<li>${resChip(name)} <span class="evt-bad">${fmtN(d)}</span>
                    — готовая продукция: <b>вывезено</b></li>`).join('')
              + manual.map(({ name, d }) => (d > 0
                ? `<li>${resChip(name)} <span class="evt-ok">+${fmtN(d)}</span> — сверх расчёта: <b>завезено вручную</b></li>`
                : `<li>${resChip(name)} <span class="evt-bad">${fmtN(d)}</span> — меньше расчёта: <b>забрано вручную</b></li>`)).join('')
              + shifts.map(({ name, d }) => `<li>${resChip(name)} <span class="evt-dim">${d > 0 ? '+' : ''}${fmtN(d)}</span>
                    — кратно партии фабрик: <b>сдвиг цикла</b> (${d < 0 ? 'партия уже в работе' : 'партия ещё не забрана или уже выдана'})</li>`).join('')
            : '<li class="evt-ok">совпало с расчётом</li>';
        return `<li><b>${fmtDate(e.t)}</b> · ${pinLabel(e.pin)} <span class="evt-dim">(${e.source === 'esi' ? 'открытие в игре' : 'срез из игры'})</span>
            <ul class="evt-sub">${what}</ul></li>`;
    }).join('');

    const title = planet.name || `Планета ${col.planet_id}`;
    return `
        <section class="evt-colony" data-planet="${col.planet_id}">
            <h5>${escapeHtml(title)} <span class="evt-dim">· ${escapeHtml(PLANET_TYPE_OF_ESI[col.planet_type] || col.planet_type)}
                · ${escapeHtml(system.name || String(col.solar_system_id))}
                · CC ${col.upgrade_level} · построек ${col.num_pins} · открыта в игре ${fmtDate(col.last_update)}</span></h5>
            <div class="evt-grid">
                <div><h6>Добыча</h6><ul>${ext || '<li class="evt-dim">нет</li>'}</ul></div>
                <div><h6>Склады сейчас (расчёт)</h6><p class="evt-dim evt-note">${simNote}</p>
                    <ul>${nowStores || '<li class="evt-dim">складов нет</li>'}</ul></div>
                <div><h6>Фабрики · буферы на момент открытия</h6><ul>${fac || '<li class="evt-dim">нет</li>'}</ul></div>
                <div><h6>Журнал сверок</h6><ul>${logHtml || '<li class="evt-dim">пока нет: нужен второй срез — вставьте его из игры или откройте колонию в игре ещё раз</li>'}</ul></div>
                <div><h6>Склады на момент открытия</h6><ul>${sto || '<li class="evt-dim">пусто</li>'}</ul></div>
                <div><h6>Маршруты (${routes.length}) · связей ${links.length}</h6><ul>${rts || '<li class="evt-dim">нет</li>'}</ul></div>
            </div>
        </section>`;
}

// Вставка среза склада из игры: форма под складом, сохранение, перерасчёт
const toLocalInput = (d) => {
    const p2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
document.addEventListener('click', (event) => {
    const btn = event.target.closest('.evt-slice-btn');
    if (btn) {
        const li = btn.closest('li');
        const open = li.querySelector('.evt-slice-form');
        if (open) {
            open.remove();
            return;
        }
        li.insertAdjacentHTML('beforeend', `
            <div class="evt-slice-form">
                <textarea rows="6" placeholder="В игре откройте склад, выделите всё (Ctrl+A), скопируйте (Ctrl+C) и вставьте сюда"></textarea>
                <label>Время среза <input type="datetime-local" value="${toLocalInput(new Date())}"></label>
                <button type="button" class="btn card-add evt-slice-save">Сохранить срез</button>
                <span class="evt-dim evt-slice-msg"></span>
            </div>`);
        li.querySelector('textarea').focus();
        return;
    }
    const save = event.target.closest('.evt-slice-save');
    if (!save) return;
    const form = save.closest('.evt-slice-form');
    const li = form.closest('li');
    const head = li.querySelector('.evt-slice-btn');
    const items = parseInventoryText(form.querySelector('textarea').value);
    const msg = form.querySelector('.evt-slice-msg');
    if (!Object.keys(items).length) {
        msg.textContent = 'Не нашёл ни одной строки «название — количество»';
        return;
    }
    const when = new Date(form.querySelector('input').value || Date.now());
    const planetId = head.dataset.planet;
    const snaps = piSnapsOf(planetId);
    snaps.manual.push({ t: when.toISOString(), pin: Number(head.dataset.pin), items, source: 'manual' });
    snaps.manual.sort((a, b) => new Date(a.t) - new Date(b.t));
    piSaveSnaps(planetId, snaps);
    const section = li.closest('.evt-colony');
    const detail = evtData.get(String(planetId));
    if (section && detail) section.outerHTML = eveTestColonyHtml(detail);
    // карточки считают склады от тех же срезов — пересчитываем их сразу
    viewStockCache.clear();
    document.querySelectorAll('.card.is-view').forEach((card) => renderCardView(card));
});

async function renderEveTest() {
    const body = document.getElementById('evetest-body');
    const ver = document.getElementById('evetest-version');
    if (ver) ver.textContent = appVersionText();
    const chars = typeof eveChars === 'function' ? eveChars() : [];
    body.innerHTML = EVE_TEST_PILOTS.map((name, i) => `
        <article class="evt-card" data-i="${i}">
            <div class="evt-head"><b>${escapeHtml(name)}</b> <span class="evt-dim">загрузка…</span></div>
        </article>`).join('');

    await Promise.all(EVE_TEST_PILOTS.map(async (name, i) => {
        const box = body.querySelector(`.evt-card[data-i="${i}"]`);
        const char = chars.find((c) => (c.characterName || '').toLowerCase() === name.toLowerCase());
        if (!char) {
            box.innerHTML = `<div class="evt-head"><b>${escapeHtml(name)}</b>
                <span class="evt-bad">не подключён — войдите им через «LOG IN with EVE Online»</span></div>`;
            return;
        }
        try {
            const data = await loadEveTest(char);
            const extractors = data.details.reduce((n, d) => n + (d.layout.pins || []).filter((p) => p.extractor_details).length, 0);
            box.innerHTML = `
                <div class="evt-head">
                    <img class="eve-char-img" src="${evePortrait(char.characterId)}" alt="" width="32" height="32">
                    <b>${escapeHtml(char.characterName)}</b>
                    <span class="evt-dim">id ${char.characterId} · колоний ${data.colonies.length} · экстракторов ${extractors}
                        · права: ${escapeHtml([].concat(char.scopes || []).join(', ') || '—')}</span>
                </div>
                ${data.details.map(eveTestColonyHtml).join('') || '<p class="evt-dim">Колоний нет</p>'}
                <details class="evt-raw"><summary>Сырые ответы ESI</summary>
                    <pre>${escapeHtml(JSON.stringify(data.details.map((d) => ({ colony: d.col, layout: d.layout })), null, 1))}</pre>
                </details>`;
        } catch (e) {
            box.innerHTML = `<div class="evt-head"><b>${escapeHtml(name)}</b>
                <span class="evt-bad">ошибка: ${escapeHtml(e.message)}</span></div>`;
        }
    }));
}

(function initEveTest() {
    const btn = document.getElementById('evetest-open');
    const modal = document.getElementById('evetest-modal');
    if (!btn || !modal) return;
    document.body.appendChild(modal);
    const close = () => {
        modal.hidden = true;
        btn.focus();
    };
    btn.addEventListener('click', () => {
        modal.hidden = false;
        modal.querySelector('.ct-modal-close').focus();
        renderEveTest();
    });
    modal.querySelector('.ct-modal-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) close();
    });
}());

/* ---- Тест2: склады (имущество) персонажей из EVE ----
   Кнопка «Тест2» рядом с «Тест» показывает всё, что EVE отдаёт об
   имуществе подключённых персонажей: где что лежит (станции, структуры,
   космос), контейнеры и корабли с содержимым, количество каждого
   предмета. Нужно право esi-assets.read_assets.v1 (названия структур —
   esi-universe.read_structures.v1): персонажей, вошедших раньше только
   с правом на планеты, надо подключить заново через «LOG IN». */
const ASSETS_SCOPE = 'esi-assets.read_assets.v1';
const CORP_ASSETS_SCOPE = 'esi-assets.read_corporation_assets.v1';
const CORP_DIVISIONS_SCOPE = 'esi-corporations.read_divisions.v1';
const STRUCTURES_SCOPE = 'esi-universe.read_structures.v1';
const charScopes = (char) => [].concat(char.scopes || []).join(' ').split(/\s+/).filter(Boolean);
const locationNames = new Map();

async function loadCharAssets(char, corpId) {
    const id = char.characterId;
    // корпорация: те же запросы, только /corporations/{id}/ (нужна роль Director)
    const owner = corpId ? `corporations/${corpId}` : `characters/${id}`;
    const items = [];
    for (let page = 1; page <= 50; page += 1) {
        // eslint-disable-next-line no-await-in-loop
        const part = await eveFetchJson(`${ESI_BASE}/${owner}/assets/?datasource=tranquility&page=${page}`, {}, id);
        items.push(...part);
        if (part.length < 1000) break;
    }
    const byItem = new Map(items.map((x) => [x.item_id, x]));
    /* Имена — у контейнеров (Station Container, Station Warehouse Container,
       Giant Secure Container…): по одному запросу на 1000 штук. Собранный
       контейнер (is_singleton) имя имеет всегда, поэтому EVE не отвергает пачку. */
    await esiNamesOf(uniqValues(items.map((x) => x.type_id)));
    const names = new Map();
    const parents = new Set(items.map((x) => x.location_id));
    const isBox = (x) => /Container$/i.test(esiTypeName(x.type_id));
    const named = items.filter((x) => x.is_singleton && x.location_flag !== 'OfficeFolder');
    // контейнеры и корабли с грузом — разными пачками: если EVE отвергнет
    // пачку кораблей, имена контейнеров (теги [Sigetar]) всё равно будут
    const groups = [named.filter(isBox), named.filter((x) => !isBox(x) && parents.has(x.item_id))];
    for (const ids of groups.map((g) => g.map((x) => x.item_id))) {
        for (let i = 0; i < ids.length; i += 1000) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const list = await eveFetchJson(`${ESI_BASE}/${owner}/assets/names/?datasource=tranquility`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ids.slice(i, i + 1000))
                }, id);
                list.forEach((n) => { if (n.name && n.name !== 'None') names.set(n.item_id, n.name); });
            } catch (e) {
                // без имён — покажем только тип
            }
        }
    }
    // Верхние места: станции, структуры, системы (то, что не предмет из списка)
    const tops = uniqValues(items.filter((x) => !byItem.has(x.location_id)).map((x) => x.location_id));
    const scopes = charScopes(char);
    await Promise.all(tops.map(async (loc) => {
        if (locationNames.has(loc)) return;
        let name = '';
        try {
            if (loc >= 60000000 && loc < 64000000) name = (await esiPublicJson(`/universe/stations/${loc}/`)).name;
            else if (loc >= 30000000 && loc < 33000000) name = `${(await esiPublicJson(`/universe/systems/${loc}/`)).name} — в космосе`;
            else if (scopes.includes(STRUCTURES_SCOPE)) {
                name = (await eveFetchJson(`${ESI_BASE}/universe/structures/${loc}/?datasource=tranquility`, {}, id)).name;
            }
        } catch (e) {
            // нет доступа к структуре — покажем её номер
        }
        locationNames.set(loc, name || (loc > 1e12 ? `Структура ${loc}` : `Место ${loc}`));
    }));
    return { items, byItem, names, tops };
}

function assetsCharHtml(char, data, corp) {
    const fmtN = (n) => Number(n).toLocaleString('ru-RU');
    const divName = (flag) => {
        const m = /^CorpSAG(\d)$/.exec(flag || '');
        if (!m) return flag || '';
        const d = corp && corp.divisions && corp.divisions.find((x) => x.division === Number(m[1]));
        return (d && d.name) || `Отдел ${m[1]}`;
    };
    const kids = new Map();
    data.items.forEach((x) => {
        if (!kids.has(x.location_id)) kids.set(x.location_id, []);
        kids.get(x.location_id).push(x);
    });
    const itemHtml = (x) => {
        // Офис корпорации на станции — его ангар по отделам (CorpSAG1–7)
        if (x.location_flag === 'OfficeFolder') {
            const inner = kids.get(x.item_id) || [];
            const flags = uniqValues(inner.map((y) => y.location_flag)).sort();
            return `<li class="as-item as-office"><details open><summary><b>Офис корпорации</b>
                <span class="evt-dim">· предметов ${inner.length}</span></summary><ul>${flags.map((f) => {
                    const list = inner.filter((y) => y.location_flag === f);
                    return `<li class="as-item"><details><summary>${escapeHtml(divName(f))}
                        <span class="evt-dim">· ${list.length}</span></summary><ul>${list.map(itemHtml).join('')}</ul></details></li>`;
                }).join('')}</ul></details></li>`;
        }
        const type = esiTypeName(x.type_id);
        const pi = PI_COMMODITIES[type] ? `P${piTierOf(type)}` : '';
        const inner = kids.get(x.item_id) || [];
        // «Station Container (Планетарка [P4])» — имя в скобках после типа
        const label = `${pi ? tierBadgeHtml(pi) : ''}<span class="as-name" lang="en">${escapeHtml(type)}</span>`
            + (data.names.get(x.item_id) ? ` <span class="as-box-name">(${escapeHtml(data.names.get(x.item_id))})</span>` : '')
            + ` <span class="as-qty">×${fmtN(x.quantity)}</span>`
            + ` <span class="evt-dim">${escapeHtml(/^CorpSAG/.test(x.location_flag || '') ? '' : (x.location_flag || ''))}</span>`;
        return inner.length
            ? `<li class="as-item${pi ? ' is-pi' : ''}"><details><summary>${label} <span class="evt-dim">· внутри ${inner.length}</span></summary><ul>${inner.map(itemHtml).join('')}</ul></details></li>`
            : `<li class="as-item${pi ? ' is-pi' : ''}">${label}</li>`;
    };
    const piCount = data.items.filter((x) => PI_COMMODITIES[esiTypeName(x.type_id)]).length;
    const locs = data.tops.map((loc) => {
        const list = kids.get(loc) || [];
        const pis = list.filter((x) => PI_COMMODITIES[esiTypeName(x.type_id)]).length;
        return `<details class="as-loc"><summary><b>${escapeHtml(locationNames.get(loc) || String(loc))}</b>
            <span class="evt-dim">· предметов ${list.length}${pis ? ` · планетарки ${pis}` : ''}</span></summary>
            <ul>${list.map(itemHtml).join('')}</ul></details>`;
    }).join('');
    const offices = data.items.filter((x) => x.location_flag === 'OfficeFolder').length;
    return `
        <div class="evt-head">
            ${corp ? `<img class="eve-char-img" src="https://images.evetech.net/corporations/${corp.id}/logo?size=32" alt="" width="32" height="32">`
                : `<img class="eve-char-img" src="${evePortrait(char.characterId)}" alt="" width="32" height="32">`}
            <b>${escapeHtml(corp ? `Корпорация ${corp.name}` : char.characterName)}</b>
            <span class="evt-dim">${corp ? `через ${escapeHtml(char.characterName)} · офисов ${offices} · ` : ''}записей ${data.items.length} · мест ${data.tops.length} · планетарки ${piCount}</span>
        </div>
        ${locs || '<p class="evt-dim">Имущества нет</p>'}
        <details class="evt-raw"><summary>Сырые ответы ESI</summary>
            <pre>${escapeHtml(JSON.stringify(data.items, null, 1))}</pre></details>`;
}

async function renderAssetsTest() {
    const body = document.getElementById('evetest2-body');
    const chars = typeof eveChars === 'function' ? eveChars() : [];
    body.classList.toggle('as-only-pi', document.getElementById('evetest2-pi').checked);
    if (!chars.length) {
        body.innerHTML = '<p class="evt-dim">Подключите персонажей через «LOG IN with EVE Online»</p>';
        return;
    }
    body.innerHTML = chars.map((c, i) => `<article class="evt-card" data-i="${i}">
        <div class="evt-head"><b>${escapeHtml(c.characterName)}</b> <span class="evt-dim">загрузка…</span></div></article>`).join('');
    await Promise.all(chars.map(async (char, i) => {
        const box = body.querySelector(`.evt-card[data-i="${i}"]`);
        if (!charScopes(char).includes(ASSETS_SCOPE)) {
            box.innerHTML = `<div class="evt-head"><b>${escapeHtml(char.characterName)}</b>
                <span class="evt-bad">нет права на имущество — подключите персонажа заново через «LOG IN with EVE Online»</span></div>`;
            return;
        }
        try {
            box.innerHTML = assetsCharHtml(char, await loadCharAssets(char));
        } catch (e) {
            box.innerHTML = `<div class="evt-head"><b>${escapeHtml(char.characterName)}</b>
                <span class="evt-bad">ошибка: ${escapeHtml(e.message)}</span></div>`;
        }
    }));
    await renderCorpAssets(body, chars);
}

/* Корпоративные офисы — склады, которые арендует корпорация. Читать их
   может персонаж с ролью Director и правом esi-assets.read_corporation_assets.v1;
   названия отделов ангара — esi-corporations.read_divisions.v1. Каждая
   корпорация — один раз, через первого подходящего персонажа. */
async function renderCorpAssets(body, chars) {
    const corps = new Map();     // corpId -> { id, name, chars: [] }
    await Promise.all(chars.map(async (char) => {
        try {
            const info = await esiPublicJson(`/characters/${char.characterId}/`);
            if (!info.corporation_id || info.corporation_id < 2000000) return;   // NPC-корпорации — без офисов
            if (!corps.has(info.corporation_id)) corps.set(info.corporation_id, { id: info.corporation_id, name: '', chars: [] });
            corps.get(info.corporation_id).chars.push(char);
        } catch (e) {
            // без корпорации
        }
    }));
    for (const corp of corps.values()) {
        // eslint-disable-next-line no-await-in-loop
        corp.name = await esiPublicJson(`/corporations/${corp.id}/`).then((x) => x.name).catch(() => String(corp.id));
        body.insertAdjacentHTML('beforeend', `<article class="evt-card as-corp" data-corp="${corp.id}">
            <div class="evt-head"><b>Корпорация ${escapeHtml(corp.name)}</b> <span class="evt-dim">загрузка…</span></div></article>`);
        const box = body.querySelector(`.as-corp[data-corp="${corp.id}"]`);
        const able = corp.chars.filter((c) => charScopes(c).includes(CORP_ASSETS_SCOPE));
        if (!able.length) {
            box.innerHTML = `<div class="evt-head"><b>Корпорация ${escapeHtml(corp.name)}</b>
                <span class="evt-bad">нет права на имущество корпорации — подключите заново через «LOG IN» персонажа с ролью Director</span></div>`;
            continue;
        }
        let shown = false;
        const errors = [];
        for (const char of able) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const data = await loadCharAssets(char, corp.id);
                let divisions = [];
                if (charScopes(char).includes(CORP_DIVISIONS_SCOPE)) {
                    // eslint-disable-next-line no-await-in-loop
                    divisions = await eveFetchJson(`${ESI_BASE}/corporations/${corp.id}/divisions/?datasource=tranquility`, {}, char.characterId)
                        .then((d) => d.hangar || []).catch(() => []);
                }
                box.innerHTML = assetsCharHtml(char, data, { id: corp.id, name: corp.name, divisions });
                shown = true;
                break;
            } catch (e) {
                errors.push(`${char.characterName}: ${e.message}`);
            }
        }
        if (!shown) {
            box.innerHTML = `<div class="evt-head"><b>Корпорация ${escapeHtml(corp.name)}</b>
                <span class="evt-bad">EVE не отдал имущество корпорации — нужна роль Director (${escapeHtml(errors.join('; '))})</span></div>`;
        }
    }
}

(function initAssetsTest() {
    const btn = document.getElementById('evetest2-open');
    const modal = document.getElementById('evetest2-modal');
    if (!btn || !modal) return;
    document.body.appendChild(modal);
    const close = () => {
        modal.hidden = true;
        btn.focus();
    };
    btn.addEventListener('click', () => {
        modal.hidden = false;
        modal.querySelector('.ct-modal-close').focus();
        renderAssetsTest();
    });
    modal.querySelector('.ct-modal-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    document.getElementById('evetest2-pi').addEventListener('change', (event) => {
        document.getElementById('evetest2-body').classList.toggle('as-only-pi', event.target.checked);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) close();
    });
}());

/* ---- Склад: вся планетарка (P0–P4) подключённых персонажей ----
   Личное имущество каждого персонажа — всё, где бы ни лежало (ангары,
   контейнеры, корабли). С корпоративного склада — только то, что лежит
   в контейнерах с тегом [Sigetar] в имени (вместе с вложенными).
   Персонажи без права на имущество или без планетарки не показываются.
   Вверху — итог: товары по уровням P4 → P0, столбец на владельца.
   Ниже — где лежит: регион › система › станция, внутри станции —
   ангар / офис корпорации › отдел › контейнер / корабль › трюм. */
const STORE_CORP_TAG = '[sigetar]';
const WH_FLAGS = {
    Hangar: 'Ангар',
    Cargo: 'Трюм',
    SpecializedPlanetaryCommoditiesHold: 'Трюм планетарки',
    SpecializedCommandCenterHold: 'Трюм командных центров',
    FleetHangar: 'Ангар флота',
    ShipHangar: 'Корабельный ангар',
    Deliveries: 'Доставка',
    AssetSafety: 'Asset Safety',
    CorpDeliveries: 'Доставка корпорации'
};
// Флаги внутри контейнера и папка офиса — без подписи
const WH_FLAGS_SILENT = new Set(['Unlocked', 'Locked', 'AutoFit', 'OfficeFolder', 'Impounded']);

// Регион по названию системы — из своего справочника SYSTEMS_BY_REGION
let whRegionBySystem = null;
function whRegionOf(system) {
    if (!whRegionBySystem) {
        whRegionBySystem = new Map();
        if (typeof SYSTEMS_BY_REGION === 'object') {
            Object.entries(SYSTEMS_BY_REGION).forEach(([r, list]) => list.forEach((n) => whRegionBySystem.set(n, r)));
        }
    }
    return whRegionBySystem.get(system) || '';
}

// Верхнее место (станция / структура / космос) -> { station, system, region }
const whPlaces = new Map();
const whSystemNames = new Map();
async function whPlaceOf(loc, char) {
    if (whPlaces.has(loc)) return whPlaces.get(loc);
    const place = { station: '', system: '', region: '', typeId: 0, sec: null };
    let systemId = 0;
    try {
        if (loc >= 60000000 && loc < 64000000) {
            const st = await esiPublicJson(`/universe/stations/${loc}/`);
            place.station = st.name;
            // тип станции NPC — только модель здания, не показываем
            systemId = st.system_id;
        } else if (loc >= 30000000 && loc < 33000000) {
            systemId = loc;
            place.station = 'в космосе';
        } else if (charScopes(char).includes(STRUCTURES_SCOPE)) {
            const st = await eveFetchJson(`${ESI_BASE}/universe/structures/${loc}/?datasource=tranquility`, {}, char.characterId);
            place.station = st.name;
            place.typeId = st.type_id || 0;
            systemId = st.solar_system_id;
        }
    } catch (e) {
        // нет доступа к структуре — останется номер
    }
    if (!place.station) place.station = loc > 1e12 ? `Структура ${loc}` : `Место ${loc}`;
    if (systemId) {
        if (!whSystemNames.has(systemId)) {
            whSystemNames.set(systemId, await esiPublicJson(`/universe/systems/${systemId}/`)
                .then((x) => ({ name: x.name, sec: x.security_status })).catch(() => ({ name: '', sec: null })));
        }
        place.system = whSystemNames.get(systemId).name;
        place.sec = whSystemNames.get(systemId).sec;
        place.region = whRegionOf(place.system);
    }
    // структура: «Система - Название» — система уже есть, оставляем название
    if (place.system && place.station.startsWith(`${place.system} - `)) place.station = place.station.slice(place.system.length + 3);
    whPlaces.set(loc, place);
    return place;
}

/* Планетарка из имущества: [{ name, qty, top, path }], path — где внутри
   станции («Офис корпорации › Отдел 3 › Giant Secure Container «PI [Sigetar]»»).
   onlyTagged — только из контейнеров с тегом [Sigetar]. */
function whEntriesOf(data, divisions, onlyTagged) {
    const divName = (flag) => {
        const m = /^CorpSAG(\d)$/.exec(flag || '');
        if (!m) return '';
        const d = (divisions || []).find((x) => x.division === Number(m[1]));
        return (d && d.name) || `Отдел ${m[1]}`;
    };
    /* Шаги пути внутри станции — с видом для значка:
       hangar — ангар / отдел ангара корпорации, office — офис корпорации,
       box — контейнер, ship — корабль, hold — трюм, flag — прочее. */
    const flagSeg = (flag) => {
        if (WH_FLAGS_SILENT.has(flag)) return null;
        const div = divName(flag);
        if (div) return { kind: 'hangar', label: div };
        if (flag === 'Hangar' || flag === 'FleetHangar' || flag === 'ShipHangar') return { kind: 'hangar', label: WH_FLAGS[flag] };
        if (/Hold$|^Cargo$/.test(flag || '')) return { kind: 'hold', label: WH_FLAGS[flag] || flag };
        return flag ? { kind: 'flag', label: WH_FLAGS[flag] || flag } : null;
    };
    const itemSeg = (x) => {
        if (x.location_flag === 'OfficeFolder') return { kind: 'office', label: 'Офис корпорации' };
        const type = esiTypeName(x.type_id);
        const n = data.names.get(x.item_id);
        return { kind: /Container$/i.test(type) ? 'box' : 'ship', typeId: x.type_id, label: `${type}${n ? ` «${n}»` : ''}` };
    };
    const out = [];
    data.items.forEach((x) => {
        const name = esiTypeName(x.type_id);
        if (!PI_COMMODITIES[name]) return;
        const parts = [];
        let tagged = false;
        let cur = x;
        while (data.byItem.has(cur.location_id)) {
            const parent = data.byItem.get(cur.location_id);
            parts.unshift(flagSeg(cur.location_flag));
            parts.unshift(itemSeg(parent));
            if ((data.names.get(parent.item_id) || '').toLowerCase().includes(STORE_CORP_TAG)) tagged = true;
            cur = parent;
        }
        parts.unshift(flagSeg(cur.location_flag));
        if (onlyTagged && !tagged) return;
        const segs = parts.filter(Boolean);
        if (!segs.length) segs.push({ kind: 'hangar', label: 'Ангар' });
        out.push({ name, qty: x.quantity || 0, top: cur.location_id, segs, path: segs.map((g) => g.label).join(' › ') });
    });
    return out;
}

/* Владельцы с планетаркой: персонажи, затем корпорации.
   { kind, title, char | corpId, entries } — без прав или пустые отброшены. */
async function loadWarehouse(chars) {
    const owners = [];
    await Promise.all(chars.map(async (char, i) => {
        if (!charScopes(char).includes(ASSETS_SCOPE)) return;
        try {
            const entries = whEntriesOf(await loadCharAssets(char), null, false);
            if (entries.length) owners[i] = { kind: 'char', char, title: char.characterName, entries };
        } catch (e) {
            // не отдал — не показываем
        }
    }));
    const list = owners.filter(Boolean);
    const corps = new Map();
    await Promise.all(chars.map(async (char) => {
        try {
            const info = await esiPublicJson(`/characters/${char.characterId}/`);
            if (!info.corporation_id || info.corporation_id < 2000000) return;
            if (!corps.has(info.corporation_id)) corps.set(info.corporation_id, []);
            corps.get(info.corporation_id).push(char);
        } catch (e) {
            // без корпорации
        }
    }));
    for (const [corpId, members] of corps) {
        for (const char of members.filter((c) => charScopes(c).includes(CORP_ASSETS_SCOPE))) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const data = await loadCharAssets(char, corpId);
                let divisions = [];
                if (charScopes(char).includes(CORP_DIVISIONS_SCOPE)) {
                    // eslint-disable-next-line no-await-in-loop
                    divisions = await eveFetchJson(`${ESI_BASE}/corporations/${corpId}/divisions/?datasource=tranquility`, {}, char.characterId)
                        .then((d) => d.hangar || []).catch(() => []);
                }
                const entries = whEntriesOf(data, divisions, true);
                if (entries.length) {
                    // eslint-disable-next-line no-await-in-loop
                    const title = await esiPublicJson(`/corporations/${corpId}/`).then((x) => x.name).catch(() => String(corpId));
                    list.push({ kind: 'corp', corpId, char, title: `${title} [Sigetar]`, entries });
                }
                break;
            } catch (e) {
                // нет роли Director — пробуем следующего
            }
        }
    }
    // места: станция, система, регион
    await Promise.all(list.flatMap((o) => uniqValues(o.entries.map((e) => e.top)).map((loc) => whPlaceOf(loc, o.char))));
    // названия типов станций (Astrahus, Amarr Trade Post…)
    await esiNamesOf(Array.from(whPlaces.values()).map((p) => p.typeId).filter(Boolean));
    return list;
}

const whAvaHtml = (o) => `<span class="wh-ico wh-ico-${o.kind}">${o.kind === 'char'
    ? `<img src="${evePortrait(o.char.characterId)}" alt="" width="20" height="20">`
    : `<img src="https://images.evetech.net/corporations/${o.corpId}/logo?size=32" alt="" width="20" height="20">`}</span>`;
/* Безопасность системы, как в игре: округление до 0.1; от 0.5 — Hi,
   выше 0 — Low, иначе Null (J-системы — W-space). */
function whSecHtml(place) {
    if (place.sec === null || place.sec === undefined) return '';
    const v = Math.round(place.sec * 10) / 10;
    const kind = /^J\d{6}$/.test(place.system || '') ? 'w' : v >= 0.5 ? 'hi' : v > 0 ? 'low' : 'null';
    const label = { hi: 'Hi', low: 'Low', null: 'Null', w: 'W' }[kind];
    // два значка в стиле [P1]: вид и число
    const tip = `Безопасность системы ${v.toFixed(1)}`;
    return `<span class="ct-tier wh-sec wh-sec-${kind}" title="${tip}">${label}</span>`
        + `<span class="ct-tier wh-sec wh-sec-${kind}" title="${tip}">${v.toFixed(1)}</span>`;
}
/* Две кнопки под заголовком «Склад», как вкладки: «Сводная таблица»
   (открыта по умолчанию) и «Планетарное имущество» (где что лежит). */
let whView = 'sum';
/* Значки пути: ангар и офис — свои рисунки (как значки складов колонии),
   контейнер и корабль — иконка типа с сервера картинок EVE. */
const WH_SEG_SVG = {
    hangar: '<path d="M1.5 6.2 8 2.2l6.5 4V14h-2.2V8.4H3.7V14H1.5Z"/><path d="M4.6 9.3h6.8v1.1H4.6Zm0 2h6.8v1.1H4.6Zm0 2h6.8V14H4.6Z"/>',
    office: '<path fill-rule="evenodd" d="M3 1.5h10V14.5H9.6v-3H6.4v3H3Zm2 2v1.6h1.6V3.5Zm4.4 0v1.6H11V3.5ZM5 6.7v1.6h1.6V6.7Zm4.4 0v1.6H11V6.7Z"/>',
    hold: '<path d="M2 4.5 8 2l6 2.5v7L8 14l-6-2.5Z M2 4.5 8 7l6-2.5M8 7v7" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
};
function whPathHtml(segs) {
    return segs.map((g) => {
        /* значок — квадрат с рамкой, как [P1] и значки складов колонии;
           цвет рамки — по виду шага */
        let inner = '';
        if (g.typeId && (g.kind === 'box' || g.kind === 'ship')) {
            inner = `<img src="https://images.evetech.net/types/${g.typeId}/icon?size=32" alt="" width="16" height="16" loading="lazy" onerror="this.remove()">`;
        } else if (WH_SEG_SVG[g.kind]) {
            inner = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${WH_SEG_SVG[g.kind]}</svg>`;
        }
        const icon = inner ? `<span class="wh-ico wh-ico-${g.kind}">${inner}</span>` : '';
        return `<span class="wh-seg wh-seg-k-${g.kind}">${icon}<span>${escapeHtml(g.label)}</span></span>`;
    }).join('<span class="uv-sep">›</span>');
}
const whFmt = (n) => (n ? Math.floor(n).toLocaleString('ru-RU') : '');

/* ---- Сводная таблица: фильтры, объём, график за 10 дней ----
   Фильтры сверху: кнопки [P0]…[P4] (ни одна не нажата — все уровни) и
   список «Все / персонаж / корпорация». Таблица: товары по уровням,
   столбец на владельца, «Всего» и объём в м³ (у строки уровня — объём
   всего уровня, внизу — итог). Справа — график занимаемого объёма за
   10 дней по тем же фильтрам. История — срез раз в день: при каждом
   открытии «Склада» сегодняшний срез перезаписывается (в браузере,
   WH_HIST_KEY, хранится 30 дней). */
const WH_HIST_KEY = 'evepi.wh.history';
// tiers — свёрнутые уровни (их строки скрыты, заголовок уровня остаётся)
const whFilter = { tiers: new Set(), owner: '' };
let whLast = [];
let whRedrawSum = () => {};
const whOwnerKey = (o) => `${o.kind}:${o.corpId || o.char.characterId}`;
const whDayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const whVolOf = (name, qty) => qty * (PI_TIER_VOLUME[piTierOf(name)] || 0);
const whTierOn = (tier) => !whFilter.tiers.has(tier);

/* Цены — как во вкладке «Цепочки производства»: минимальная цена заявок
   на продажу в системе выбранного торгового хаба (EVE_PRICES.sellMin,
   хабы PI_PRICE_HUBS из js/chains.js). Хаб общий с цепочками — тот же
   ключ PI_HUB_STORAGE. Цены кэшируем на хаб, пока страница открыта. */
const whPrices = new Map();           // хаб -> Map(товар -> цена | null)
function whHub() {
    const hubs = typeof PI_PRICE_HUBS !== 'undefined' ? PI_PRICE_HUBS : [];
    let saved = '';
    try { saved = localStorage.getItem(typeof PI_HUB_STORAGE !== 'undefined' ? PI_HUB_STORAGE : 'eve-pi-hub') || ''; } catch (e) { /* без памяти */ }
    return hubs.find((h) => h.name === saved) || hubs.find((h) => h.name === 'Jita') || hubs[0] || null;
}
async function whLoadPrices(names, hub) {
    if (!hub || typeof EVE_PRICES === 'undefined') return;
    if (!whPrices.has(hub.name)) whPrices.set(hub.name, new Map());
    const known = whPrices.get(hub.name);
    const need = names.filter((n) => !known.has(n) && PI_COMMODITIES[n]);
    let i = 0;
    const worker = async () => {
        while (i < need.length) {
            const n = need[i];
            i += 1;
            try {
                // eslint-disable-next-line no-await-in-loop
                const r = await EVE_PRICES.sellMin({ typeId: PI_COMMODITIES[n][0], regionId: hub.regionId, systemId: hub.systemId });
                known.set(n, r.price);
            } catch (e) {
                known.set(n, null);
            }
        }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
}
const whPriceOf = (name) => {
    const hub = whHub();
    const m = hub && whPrices.get(hub.name);
    return m && m.has(name) ? m.get(name) : undefined;     // undefined — ещё грузится
};
const whFmtIsk = (v) => (v ? `${Math.round(v).toLocaleString('ru-RU')} ISK` : '');
const whFmtM3 = (v) => `${Math.round(v).toLocaleString('ru-RU')} м³`;

function whSaveHistory(owners) {
    const hist = store.get(WH_HIST_KEY, {}) || {};
    const day = {};
    owners.forEach((o) => {
        const items = {};
        o.entries.forEach((e) => { items[e.name] = (items[e.name] || 0) + e.qty; });
        day[whOwnerKey(o)] = { title: o.title, items };
    });
    hist[whDayKey(new Date())] = day;
    const cut = whDayKey(new Date(Date.now() - 30 * 864e5));
    Object.keys(hist).forEach((k) => { if (k < cut) delete hist[k]; });
    store.set(WH_HIST_KEY, hist);
}

/* График справа — количество каждого ресурса отдельно за 10 дней:
   маленький график на товар, у каждого своя шкала (30 000 и 5 штук на
   одной шкале не прочитать). Только видимое в таблице: открытые уровни
   и выбранные склады; порядок — как в таблице. */
function whChartHtml(names, owners) {
    const hist = store.get(WH_HIST_KEY, {}) || {};
    const keys = new Set(owners.map(whOwnerKey));
    const days = [];
    for (let i = 9; i >= 0; i -= 1) {
        const d = new Date(Date.now() - i * 864e5);
        days.push({ key: whDayKey(d), label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}` });
    }
    const qtyOn = (day, name) => {
        const rec = hist[day];
        if (!rec) return null;
        let q = 0;
        Object.entries(rec).forEach(([key, o]) => { if (keys.has(key)) q += (o.items || {})[name] || 0; });
        return q;
    };
    const W = 230;
    const H = 46;
    const P = 4;
    const tiles = names.map((n) => {
        const vals = days.map((d) => qtyOn(d.key, n));
        const known = vals.filter((v) => v !== null);
        const max = Math.max(1, ...known);
        const x = (i) => P + (i * (W - 2 * P)) / 9;
        const y = (v) => P + (H - 2 * P) * (1 - v / max);
        const runs = [];
        let run = [];
        vals.forEach((v, i) => {
            if (v === null) { if (run.length) runs.push(run); run = []; } else run.push(`${x(i)},${y(v)}`);
        });
        if (run.length) runs.push(run);
        const lines = runs.filter((r) => r.length > 1).map((r) => `<polyline class="wh-ch-line" points="${r.join(' ')}"/>`).join('');
        const dots = vals.map((v, i) => (v === null ? '' : `<circle class="wh-ch-dot" cx="${x(i)}" cy="${y(v)}" r="3"/>`)).join('');
        const hits = days.map((d, i) => `<rect class="wh-ch-hit" x="${x(i) - (W - 2 * P) / 18}" y="0" width="${(W - 2 * P) / 9}" height="${H}"
            title="${escapeHtml(`${n}\n${d.label}: ${vals[i] === null ? 'среза нет' : `${Math.round(vals[i]).toLocaleString('ru-RU')} шт`}`)}"/>`).join('');
        const last = known.length ? known[known.length - 1] : 0;
        return `<div class="wh-ch-tile">
                <div class="wh-ch-head">${tierBadgeHtml(`P${piTierOf(n)}`)}<span class="wh-ch-name" lang="en">${escapeHtml(n)}</span><span class="wh-ch-last">${whFmt(last) || '0'}</span></div>
                <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeHtml(n)}: количество по дням">
                    <line class="wh-ch-axis" x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}"/>${lines}${dots}${hits}
                </svg>
            </div>`;
    }).join('');
    const filled = Object.keys(hist).filter((k) => k >= days[0].key).length;
    const note = filled < 2 ? '<p class="wh-ch-note">История копится: срез сохраняется раз в день, когда открываете «Склад».</p>' : '';
    return `<figure class="wh-chart">
            <figcaption class="wh-ch-title">Количество, шт · 10 дней <span class="wh-ch-range">${days[0].label} – ${days[9].label}</span></figcaption>
            ${tiles ? `<div class="wh-ch-grid">${tiles}</div>` : '<p class="wh-ch-note">Нет открытых уровней</p>'}${note}
        </figure>`;
}

/* Тренд за 2 недели: количество товара сейчас против самого раннего
   среза за последние 14 дней (те же склады, что выбраны в списке).
   Зелёная ▲ — выросло, красная ▼ — упало, серая — без изменений,
   «—» — более ранних срезов ещё нет. */
function whTrendFn(owners) {
    const hist = store.get(WH_HIST_KEY, {}) || {};
    const today = whDayKey(new Date());
    const from = whDayKey(new Date(Date.now() - 14 * 864e5));
    const day = Object.keys(hist).filter((k) => k >= from && k < today).sort()[0];
    const keys = new Set(owners.map(whOwnerKey));
    const old = new Map();
    if (day) {
        Object.entries(hist[day]).forEach(([key, o]) => {
            if (!keys.has(key)) return;
            Object.entries(o.items || {}).forEach(([n, q]) => old.set(n, (old.get(n) || 0) + q));
        });
    }
    return (name) => (day ? { day, was: old.get(name) || 0 } : null);
}
function whTrendCellHtml(name, now, t) {
    if (!t) return '<td class="wh-trend wh-tr-none" title="Сравнить не с чем: история копится">—</td>';
    const d = Math.round(now - t.was);
    const [y, m, dd] = t.day.split('-');
    const tip = `${name}\nС ${dd}.${m}.${y}: ${d > 0 ? '+' : ''}${d.toLocaleString('ru-RU')} шт`;
    if (d > 0) return `<td class="wh-trend wh-tr-up" title="${escapeHtml(tip)}">▲</td>`;
    if (d < 0) return `<td class="wh-trend wh-tr-down" title="${escapeHtml(tip)}">▼</td>`;
    return `<td class="wh-trend wh-tr-flat" title="${escapeHtml(tip)}">▬</td>`;
}

function whSumInnerHtml() {
    const all = whLast;
    const owners = whFilter.owner ? all.filter((o) => whOwnerKey(o) === whFilter.owner) : all;
    const totals = owners.map((o) => {
        const m = new Map();
        o.entries.forEach((e) => m.set(e.name, (m.get(e.name) || 0) + e.qty));
        return m;
    });
    const names = uniqValues(owners.flatMap((o) => o.entries.map((e) => e.name)));
    const many = owners.length > 1;
    const cols = owners.length + (many ? 1 : 0) + 2;            // товар, владельцы, всего, тренд
    const trendOf = whTrendFn(owners);
    const head = owners.map((o) => `<th scope="col" class="wh-col">${whAvaHtml(o)}<span>${escapeHtml(o.title)}</span></th>`).join('');
    let sumVol = 0;
    let sumIsk = 0;
    let pricePending = false;
    const rows = [4, 3, 2, 1, 0].map((tier) => {
        const list = names.filter((n) => piTierOf(n) === tier).sort((a, b) => a.localeCompare(b));
        if (!list.length) return '';
        const open = whTierOn(tier);
        let tierQty = 0;
        let tierVol = 0;
        let tierIsk = 0;
        const body = list.map((n) => {
            const qs = totals.map((m) => m.get(n) || 0);
            const q = qs.reduce((a, b) => a + b, 0);
            const v = whVolOf(n, q);
            const price = whPriceOf(n);
            if (price === undefined) pricePending = true;
            const isk = price ? price * q : 0;
            tierQty += q;
            tierVol += v;
            tierIsk += isk;
            return `<tr class="wh-row"${open ? '' : ' data-collapsed="1"'}><th scope="row" class="st-name"><span class="st-name-inner">${iconFor(n) || ''}<span lang="en">${escapeHtml(n)}</span></span></th>`
                + qs.map((x) => `<td class="wh-n">${whFmt(x)}</td>`).join('')
                + (many ? `<td class="wh-n wh-sum">${whFmt(q)}</td>` : '')
                + whTrendCellHtml(n, q, trendOf(n)) + '</tr>';
        }).join('');
        if (open) {
            sumVol += tierVol;
            sumIsk += tierIsk;
        }
        // заголовок уровня: ▾ [P4]  штук · м³ · ISK — остаётся и у свёрнутого
        return `<tr class="wh-tier"><th colspan="${cols}" scope="rowgroup">
                <button type="button" class="wh-tier-head" data-role="wh-tier" data-tier="${tier}" aria-expanded="${open}" title="${open ? 'Свернуть' : 'Развернуть'} P${tier}">
                    <span class="wh-arrow" aria-hidden="true">${open ? '▾' : '▸'}</span>${tierBadgeHtml(`P${tier}`)}
                    <span class="wh-tier-sum">${whFmt(tierQty)} шт<span class="uv-sep">·</span>${whFmtM3(tierVol)}<span class="uv-sep">·</span>${whFmtIsk(tierIsk) || '…'}</span>
                </button></th></tr>${body}`;
    }).join('');
    const tierBtns = [0, 1, 2, 3, 4].map((t) => `<button type="button" class="ct-tier ct-tier-p${t} uv-tier" data-role="wh-tier" data-tier="${t}"
        aria-pressed="${whTierOn(t)}" title="${whTierOn(t) ? 'Свернуть' : 'Развернуть'} P${t}">P${t}</button>`).join('');
    const opts = [`<option value="">Все склады</option>`]
        .concat(all.map((o) => `<option value="${escapeHtml(whOwnerKey(o))}"${whOwnerKey(o) === whFilter.owner ? ' selected' : ''}>${escapeHtml(o.kind === 'corp' ? `Корп. склад ${o.title}` : o.title)}</option>`)).join('');
    const hub = whHub();
    const hubs = typeof PI_PRICE_HUBS !== 'undefined' ? PI_PRICE_HUBS : [];
    const hubSel = hubs.length ? `<label class="wh-hub"><span class="chain-bar-label">Торговый хаб</span>
            <select class="ct-input wh-hub-sel" data-role="wh-hub" aria-label="Торговый хаб">${hubs.map((h) => `<option value="${escapeHtml(h.name)}"${hub && h.name === hub.name ? ' selected' : ''}>${escapeHtml(h.name)}</option>`).join('')}</select></label>` : '';
    return `<div class="wh-filters">
            <span class="uv-tiers wh-tiers" role="group" aria-label="Уровни">${tierBtns}</span>
            <select class="ct-input wh-owner-sel" data-role="wh-owner" aria-label="Склад">${opts}</select>
            ${hubSel}
        </div>
        <div class="wh-sum-row">
            <div class="st-scroll">${rows ? `<table class="stats-p1 wh-table">
                <thead><tr><th scope="col" class="st-name">Товар</th>${head}${many ? '<th scope="col" class="wh-col">Всего</th>' : ''}<th scope="col" class="wh-col wh-trend" title="Изменение количества за 2 недели">±</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><th scope="row" class="st-name">Итого</th><td colspan="${cols - 1}" class="wh-total">${whFmtM3(sumVol)}<span class="uv-sep">·</span>${whFmtIsk(sumIsk) || '0 ISK'}${pricePending ? ' …' : ''}</td></tr></tfoot>
            </table>` : '<p class="evt-dim">Планетарки на складе нет</p>'}</div>
            ${whChartHtml([4, 3, 2, 1, 0].filter(whTierOn).flatMap((t) => names.filter((n) => piTierOf(n) === t).sort((a, b) => a.localeCompare(b))), owners)}
        </div>`;
}

function warehouseHtml(owners) {
    if (!owners.length) return '<p class="evt-dim">Планетарки на складах нет</p>';
    /* Где лежит — карточка на аккаунт и станцию: в шапке аккаунт,
       под ним «Регион › Система › Тип (Станция)»; внутри — места хранения
       (путь внутри станции), под каждым товары. Аккаунт на одной станции
       не повторяется. */
    const cards = new Map();          // owner|top -> { owner, top, spots: Map(path -> Map(товар -> штук)) }
    owners.forEach((o) => o.entries.forEach((e) => {
        const key = `${o.kind}:${o.corpId || o.char.characterId}|${e.top}`;
        if (!cards.has(key)) cards.set(key, { owner: o, top: e.top, spots: new Map() });
        const spots = cards.get(key).spots;
        if (!spots.has(e.path)) spots.set(e.path, { segs: e.segs, items: new Map() });
        const items = spots.get(e.path).items;
        items.set(e.name, (items.get(e.name) || 0) + e.qty);
    }));
    const byTier = (a, b) => piTierOf(b[0]) - piTierOf(a[0]) || a[0].localeCompare(b[0]);
    const placeOf = (top) => whPlaces.get(top) || {};
    const placeKey = (p) => `${p.region || 'я'}|${p.system || ''}|${p.station || ''}`;
    const cardHtml = ({ owner, top, spots }) => {
        const place = placeOf(top);
        // тип — только у структур игроков (Astrahus, Fortizar…); у станций NPC
        // тип означает лишь модель здания — его не показываем
        const type = place.typeId && top > 1e12 ? esiTypeName(place.typeId) : '';
        const station = type && !type.startsWith('#') ? `${type} (${place.station})` : place.station || '';
        return `
            <div class="uv wh-card">
                <div class="uv-head wh-card-head">
                    <button type="button" class="uv-fold uv-fold-all wh-fold" data-role="wh-fold" aria-expanded="true" title="Свернуть" aria-label="Свернуть">−</button>
                    <span class="wh-loc">${whSecHtml(place)}<span class="wh-region">${escapeHtml(place.region || 'Регион ?')}</span><span class="uv-sep">›</span><span class="uv-sys">${escapeHtml(place.system || 'Система ?')}</span><span class="uv-sep">›</span><span class="wh-station">${escapeHtml(station)}</span></span>
                </div>
                <div class="uv-body">${Array.from(spots.values()).map(({ segs, items }) => `
                    <div class="uv-colony wh-spot">
                        <div class="wh-path">${whPathHtml(segs)}</div>
                        ${Array.from(items.entries()).sort(byTier).map(([n, q]) => `<div class="uv-line wh-line">${viewResHtml(n)}<span class="uv-sep">–</span><span class="uv-qty">${whFmt(q)}</span></div>`).join('')}
                    </div>`).join('')}
                </div>
            </div>`;
    };
    // колонка на владельца: сверху аккаунт, ниже его станции карточками
    const list = Array.from(cards.values());
    const where = owners.map((o) => {
        const own = list.filter((c) => c.owner === o)
            .sort((a, b) => placeKey(placeOf(a.top)).localeCompare(placeKey(placeOf(b.top))));
        return `<div class="wh-owner-col">
                <div class="wh-owner-head">${whAvaHtml(o)}<h3 class="ct-pilot-name wh-owner-name" title="${escapeHtml(o.title)}">${escapeHtml(o.title)}</h3></div>
                ${own.map(cardHtml).join('')}
            </div>`;
    }).join('');
    return `<div class="wh-layout">
            <div class="uv wh-sum-box"${whView === 'sum' ? '' : ' hidden'}>${whSumInnerHtml()}</div>
            <section class="wh-where-box"${whView === 'where' ? '' : ' hidden'}>
                <div class="wh-where">${where}</div></section>
        </div>`;
}

async function renderWarehouse() {
    const body = document.getElementById('wh-body');
    const chars = typeof eveChars === 'function' ? eveChars() : [];
    if (!chars.length) {
        body.innerHTML = '<p class="evt-dim">Подключите персонажей через «LOG IN with EVE Online»</p>';
        return;
    }
    body.innerHTML = '<p class="evt-dim">Загрузка складов из EVE…</p>';
    try {
        whLast = await loadWarehouse(chars);
        if (whLast.length) whSaveHistory(whLast);
        if (whFilter.owner && !whLast.some((o) => whOwnerKey(o) === whFilter.owner)) whFilter.owner = '';
        body.innerHTML = warehouseHtml(whLast);
        whRedrawSum();
    } catch (e) {
        body.innerHTML = `<p class="evt-bad">Ошибка: ${escapeHtml(e.message)}</p>`;
    }
}

(function initWarehouse() {
    const btn = document.getElementById('wh-open');
    const modal = document.getElementById('wh-modal');
    if (!btn || !modal) return;
    document.body.appendChild(modal);
    const close = () => {
        modal.hidden = true;
        btn.focus();
    };
    btn.addEventListener('click', () => {
        modal.hidden = false;
        modal.querySelector('.ct-modal-close').focus();
        // при каждом открытии — сводная таблица
        whView = 'sum';
        modal.querySelectorAll('[data-role="wh-view"]').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.view === 'sum')));
        renderWarehouse();
    });
    // кнопки-вкладки под заголовком: сводная таблица / планетарное имущество
    const tabs = Array.from(modal.querySelectorAll('[data-role="wh-view"]'));
    const showView = () => {
        tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.view === whView)));
        const sum = modal.querySelector('.wh-sum-box');
        const where = modal.querySelector('.wh-where-box');
        if (sum) sum.hidden = whView !== 'sum';
        if (where) where.hidden = whView !== 'where';
    };
    tabs.forEach((t) => t.addEventListener('click', () => {
        whView = t.dataset.view;
        showView();
    }));
    // фильтры сводной: уровни и склад — перерисовываем только сводную
    const redrawSum = () => {
        const box = modal.querySelector('.wh-sum-box');
        if (box) box.innerHTML = whSumInnerHtml();
    };
    // цены для товаров на складах — по хабу; пришли — перерисовываем
    whRedrawSum = () => {
        redrawSum();
        const names = uniqValues(whLast.flatMap((o) => o.entries.map((e) => e.name)));
        const hub = whHub();
        whLoadPrices(names, hub).then(() => { if (hub === whHub()) redrawSum(); });
    };
    modal.addEventListener('click', (event) => {
        const t = event.target.closest('[data-role="wh-tier"]');
        if (!t) return;
        // уровень сворачивается: строки скрыты, заголовок со стрелкой остаётся
        const tier = Number(t.dataset.tier);
        if (whFilter.tiers.has(tier)) whFilter.tiers.delete(tier);
        else whFilter.tiers.add(tier);
        redrawSum();
    });
    modal.addEventListener('change', (event) => {
        const hubSel = event.target.closest('[data-role="wh-hub"]');
        if (hubSel) {
            try { localStorage.setItem(typeof PI_HUB_STORAGE !== 'undefined' ? PI_HUB_STORAGE : 'eve-pi-hub', hubSel.value); } catch (e) { /* без памяти */ }
            whRedrawSum();
            return;
        }
        const sel = event.target.closest('[data-role="wh-owner"]');
        if (!sel) return;
        whFilter.owner = sel.value;
        redrawSum();
    });
    // круглая кнопка в шапке карточки станции — свернуть / развернуть её
    modal.addEventListener('click', (event) => {
        const fold = event.target.closest('[data-role="wh-fold"]');
        if (!fold) return;
        const open = fold.getAttribute('aria-expanded') !== 'true';
        fold.closest('.wh-card').querySelector('.uv-body').hidden = !open;
        fold.setAttribute('aria-expanded', String(open));
        fold.textContent = open ? '−' : '+';
        fold.title = open ? 'Свернуть' : 'Развернуть';
        fold.setAttribute('aria-label', fold.title);
    });
    modal.querySelector('.ct-modal-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) close();
    });
}());

/* Выбрать некого — нажатие на список (или «Добавить») открывает
   всплывающую подсказку под списком: подключить персонажей можно
   кнопкой «LOG IN with EVE Online» в шапке, а прямо отсюда — кнопкой
   «Войти». Закрывается щелчком мимо, Esc или через 6 секунд. */
let pilotPop = null;
let pilotPopTimer = 0;

function hidePilotPop() {
    clearTimeout(pilotPopTimer);
    if (pilotPop) pilotPop.remove();
    pilotPop = null;
}

function showPilotPop(select) {
    hidePilotPop();
    const head = select.closest('.card-head');
    const why = select.dataset.empty;
    pilotPop = document.createElement('div');
    pilotPop.className = 'pilot-pop';
    pilotPop.setAttribute('role', 'status');
    pilotPop.innerHTML = `
        <p>${why === 'used'
            ? 'У всех подключённых персонажей уже есть карточки. Подключите ещё персонажей через «LOG IN with EVE Online» вверху страницы.'
            : 'Подключите персонажей через «LOG IN with EVE Online» вверху страницы — они появятся в этом списке.'}</p>
        <button type="button" class="btn card-add pilot-pop-login">Войти через EVE</button>`;
    head.appendChild(pilotPop);
    pilotPop.style.left = `${select.offsetLeft}px`;
    pilotPop.querySelector('.pilot-pop-login').addEventListener('click', () => {
        hidePilotPop();
        if (eveLoginBtn) eveLoginBtn.click();
    });
    pilotPopTimer = setTimeout(hidePilotPop, 6000);
}

document.addEventListener('click', (event) => {
    if (event.target.closest('.pilot-pop')) return;
    const head = event.target.closest('.account-head');
    const select = head && head.querySelector('[data-role="pilot"]');
    // Список и «Добавить» выключены — щелчок проходит к строке целиком
    if (select && select.dataset.empty && (event.target === select
        || event.target.closest('[data-role="pilot-add"]') || event.target === head
        || event.target.closest('.card-pilot-label'))) {
        showPilotPop(select);
        return;
    }
    hidePilotPop();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hidePilotPop();
});

function refreshAccounts() {
    const count = accounts.querySelectorAll('.card, .card-slot').length;
    accountCounter.textContent = `Карточек: ${count}`;
    cardsHint.hidden = count > 0;
    updateStats();
}

/* ---- Статистика: подсчёт P1 по всем карточкам ----
   Таблица по образцу пользователя (Excel):
     Разн. | Кол-во | P1 | B G I L O P S T | Ввод
   • Кол-во — сколько строк всех карточек дают этот P1. На карточке P1
     это выбранный P1 строки. На карточке P2 в строке два входа рецепта:
     засчитывается каждый вход, который добывается на планете строки.
   • B…T — типы планет (Barren, Gas, Ice, Lava, Oceanic, Plasma, Storm,
     Temperate). Под буквой — сколько таких планет выбрано на всех
     карточках, «+» — этот P1 добывается на таком типе.
   • Ввод — число вручную, хранится в браузере (STATS_MANUAL_KEY).
   • Разн. — как формула пользователя: пусто, если Кол-во = Ввод, иначе
     Ввод − Кол-во со знаком («+2» — нужно ещё 2, «-2» — на 2 больше).
   • Склад пока не выводится — добавим позднее. */
const STATS_MANUAL_KEY = 'evepi.stats.manual';
const STATS_OPEN_KEY = 'evepi.stats.open';

const STATS_P1_LIST = uniqValues(
    Object.values(PLANET_RESOURCES).flat().map((r) => r.P1).filter(Boolean)
).sort();

// Для каждого P1 — типы планет, где он добывается
const STATS_P1_PLANETS = new Map(STATS_P1_LIST.map((p1) => [
    p1,
    new Set(PLANET_TYPES.filter((t) => (PLANET_RESOURCES[t] || []).some((r) => r.P1 === p1)))
]));

let statsManual = store.get(STATS_MANUAL_KEY, {}) || {};

// Таблица строится один раз, дальше updateStats только меняет числа:
// иначе поле ручного ввода теряло бы фокус при каждом пересчёте.
function buildStatsTable() {
    const letters = PLANET_TYPES.map((t) => `<th scope="col" class="st-planet" title="${escapeHtml(t)}">${escapeHtml(t[0])}</th>`).join('');
    const counts = PLANET_TYPES.map((t) => `<th class="st-planet-count" data-planet="${escapeHtml(t)}">0</th>`).join('');
    const rows = STATS_P1_LIST.map((p1) => {
        const marks = PLANET_TYPES.map((t) => (STATS_P1_PLANETS.get(p1).has(t)
            ? '<td class="st-mark is-on">+</td>'
            : '<td class="st-mark"></td>')).join('');
        const saved = statsManual[p1];
        return `<tr data-p1="${escapeHtml(p1)}">
                <td class="st-diff"></td>
                <td class="st-count">0</td>
                <th scope="row" class="st-name"><span class="st-name-inner">${iconFor(p1)}<span>${escapeHtml(p1)}</span></span></th>
                ${marks}
                <td class="st-manual-cell"><input type="number" min="0" step="1" inputmode="numeric"
                       class="st-manual" aria-label="Ввод для ${escapeHtml(p1)}"
                       value="${saved === undefined || saved === null ? '' : escapeHtml(String(saved))}"></td>
            </tr>`;
    }).join('');

    statsBody.innerHTML = `
        <div class="st-scroll">
            <table class="stats-p1">
                <thead>
                    <tr>
                        <th rowspan="2" class="st-diff" title="Разница: Ввод − Кол-во">±</th>
                        <th rowspan="2" class="st-count" title="Кол-во P1 на всех карточках">Кол</th>
                        <th rowspan="2" scope="col" class="st-name">P1</th>
                        ${letters}
                        <th rowspan="2" scope="col" class="st-manual-cell">Ввод</th>
                    </tr>
                    <tr>${counts}</tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td></td>
                        <td class="st-count" data-role="st-sum-count">0</td>
                        <td colspan="${PLANET_TYPES.length + 1}"></td>
                        <td class="st-manual-cell" data-role="st-sum-manual">0</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
}

function statsCount() {
    const p1 = new Map(STATS_P1_LIST.map((n) => [n, 0]));
    const planets = new Map(PLANET_TYPES.map((t) => [t, 0]));

    accounts.querySelectorAll('.card').forEach((card) => {
        const isP2 = isP2Level(card.dataset.level);
        card.querySelectorAll('tbody tr').forEach((row) => {
            const planet = planetTypeOf(row);
            if (planets.has(planet)) planets.set(planet, planets.get(planet) + 1);

            // Карточки P3/P4 добычи P1 не дают — считаем только планеты
            if (isProdLevel(card.dataset.level)) return;

            // Универсальная карточка: строка P1 — как карточка P1, P2 — как P2
            if (isMixLevel(card.dataset.level)) {
                const level = mixLevelOf(row);
                const prod = mixProdOf(row);
                if (level === 'P1' && p1.has(prod)) p1.set(prod, p1.get(prod) + 1);
                if (level === 'P2') {
                    const r = PI_P2_RECIPE_OF.get(prod);
                    if (r) r.in.forEach(([name]) => {
                        if (p1.has(name) && STATS_P1_PLANETS.get(name).has(planet)) p1.set(name, p1.get(name) + 1);
                    });
                }
                return;
            }

            if (!isP2) {
                const value = readValue(row, 'p1');
                if (p1.has(value)) p1.set(value, p1.get(value) + 1);
                return;
            }
            const recipe = PI_P2_RECIPE_OF.get(rowP2Of(row));
            if (!recipe) return;
            recipe.in.forEach(([name]) => {
                if (p1.has(name) && STATS_P1_PLANETS.get(name).has(planet)) {
                    p1.set(name, p1.get(name) + 1);
                }
            });
        });
    });
    return { p1, planets };
}

// Разница по формуле пользователя: пусто при равенстве, иначе Ввод − Кол-во со знаком
function statsDiff(count, manual) {
    if (manual === '' || manual === null || manual === undefined) return '';
    const diff = Number(manual) - count;
    if (!Number.isFinite(diff) || diff === 0) return '';
    return diff > 0 ? `+${diff}` : String(diff);
}

function updateStats() {
    if (!statsBody) return;
    if (!statsBody.querySelector('.stats-p1')) buildStatsTable();

    const { p1, planets } = statsCount();
    let sumCount = 0;
    let sumManual = 0;

    statsBody.querySelectorAll('.st-planet-count').forEach((cell) => {
        cell.textContent = planets.get(cell.dataset.planet) || 0;
    });

    statsBody.querySelectorAll('tbody tr').forEach((row) => {
        const name = row.dataset.p1;
        const count = p1.get(name) || 0;
        const manual = row.querySelector('.st-manual').value.trim();
        const diff = statsDiff(count, manual);

        row.querySelector('.st-count').textContent = count;
        const diffCell = row.querySelector('.st-diff');
        diffCell.textContent = diff;
        diffCell.classList.toggle('is-more', diff.startsWith('+'));
        diffCell.classList.toggle('is-less', diff.startsWith('-'));

        sumCount += count;
        if (manual !== '' && Number.isFinite(Number(manual))) sumManual += Number(manual);
    });

    statsBody.querySelector('[data-role="st-sum-count"]').textContent = sumCount;
    statsBody.querySelector('[data-role="st-sum-manual"]').textContent = sumManual;
}

// Ручной ввод: сохраняем и пересчитываем разницу и суммы
if (statsBody) {
    statsBody.addEventListener('input', (event) => {
        const input = event.target.closest('.st-manual');
        if (!input) return;
        const name = input.closest('tr').dataset.p1;
        const value = input.value.trim();
        if (value === '') delete statsManual[name];
        else statsManual[name] = Number(value);
        store.set(STATS_MANUAL_KEY, statsManual);
        updateStats();
    });

    // Кнопка «Открыть» показывает таблицу окном — как выбор карточки.
    // Закрывается крестиком, щелчком мимо окна и клавишей Esc.
    const statsOpenBtn = document.getElementById('stats-open');
    const statsModal = document.getElementById('stats-modal');
    // Окно — прямо в body, как окно выбора карточки: иначе «fixed»
    // считается от вкладки и окно уезжает
    document.body.appendChild(statsModal);
    const closeStats = () => {
        statsModal.hidden = true;
        statsOpenBtn.focus();
    };
    statsOpenBtn.addEventListener('click', () => {
        updateStats();
        statsModal.hidden = false;
        statsModal.querySelector('.ct-modal-close').focus();
    });
    statsModal.querySelector('.ct-modal-close').addEventListener('click', closeStats);
    statsModal.addEventListener('click', (event) => {
        if (event.target === statsModal) closeStats();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !statsModal.hidden) closeStats();
    });
}

/* Сохраняем структуру «аккаунт → его карточки», а в каждой карточке —
   всё, что в ней выбрано. Тогда после обновления страницы возвращаются
   не только имена, но и системы, типы планет, P0, P1 и корабли.

   Подсветка карточки (кнопка 💡) намеренно не сохраняется: это
   временное выделение, а не данные. */
function saveAccounts() {
    // Карточка в окне редактирования — сохраним, когда окно закроется
    if (cardEditor) return;
    store.set(ACCOUNTS_KEY, Array.from(accounts.children).map((line) => ({
        name: line.dataset.account,
        cards: Array.from(line.querySelector('[data-role="cards"]').children)
            .filter((el) => el.classList.contains('card')).map(readCard)
    })));
    // любое изменение в карточках — пересчёт статистики P1
    updateStats();
    // и сигнал карте региона (вкладка «Калькулятор»): колонии персонажей
    // с карточками она показывает прямо из карточек
    if (!reloadingAccounts) document.dispatchEvent(new CustomEvent('evepi:accounts'));
}

const readValue = (root, role) => {
    const cell = root.querySelector(`[data-role="${role}"]`);
    return cell ? cell.value : '';
};

// Снимок карточки для хранилища
function readCard(card) {
    return {
        name: card.dataset.name,
        level: card.dataset.level || 'P1',
        view: card.dataset.view === '1' || undefined,
        showTiers: card.dataset.showTiers ? card.dataset.showTiers.split(',') : undefined,
        region: readValue(card, 'region'),
        // универсальная: система карточки — первая из строк (для карты и старых версий)
        system: isMixLevel(card.dataset.level)
            ? (Array.from(card.querySelectorAll('tbody tr')).map(systemOfRow).find(Boolean) || '')
            : readValue(card, 'system'),
        ship: readValue(card, 'ship'),
        p2s: Array.from(card.querySelectorAll('[data-role="p2"]')).map((cell) => cell.value),
        prods: Array.from(card.querySelectorAll('[data-role="prod"]')).map((cell) => cell.value),
        mix: isMixLevel(card.dataset.level)
            ? Array.from(card.querySelectorAll('tbody tr')).map((row) => {
                const m = { level: mixLevelOf(row), prod: mixProdOf(row) };
                if (row.dataset.link === '1') m.link = true;
                else if (readValue(row, 'row-system')) m.system = readValue(row, 'row-system');
                const [prod, planet] = (row.dataset.colonyPlanet || '').split('|');
                if (planet && prod === m.prod) m.planet = planet;
                return m;
            })
            : undefined,
        rows: Array.from(card.querySelectorAll('tbody tr')).map((row) => ({
            system: isMixLevel(card.dataset.level) ? (systemOfRow(row) || undefined) : undefined,
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

    // Скрытое поле (номер планеты): списка вариантов нет — просто значение
    if (cell.tagName === 'INPUT') {
        cell.value = value;
        return;
    }

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

    /* Раньше систему можно было выбрать при «Все регионы»; теперь она
       ждёт региона. Для таких карточек регион берём по самой системе. */
    let regionName = saved.region;
    if (!regionName && saved.system) {
        regionName = Object.keys(SYSTEMS_BY_REGION)
            .find((r) => (SYSTEMS_BY_REGION[r] || []).includes(saved.system)) || '';
    }

    if (regionName) {
        fillRegions(region);
        pickValue(region, regionName);
    }

    if (saved.system) {
        fillSystems(system);
        pickValue(system, saved.system);
    }

    /* Карточка P2: сначала товары P2 в строках — каждый выбор по рецепту
       фильтрует планету/P1/P0 своей строки, и только после этого
       восстанавливаются значения самих строк (см. ниже). Строки
       независимы: у каждой свой товар P2. */
    if (isP2Level(saved.level)) {
        const p2s = Array.from(card.querySelectorAll('[data-role="p2"]'));
        (Array.isArray(saved.p2s) ? saved.p2s : []).forEach((value, i) => {
            if (p2s[i]) pickValue(p2s[i], value);
        });
    }

    // Универсальная: в каждой строке сначала тип и товар, потом остальное
    if (isMixLevel(saved.level) && Array.isArray(saved.mix)) {
        const mixRows = Array.from(card.querySelectorAll('tbody tr'));
        /* Системы строк. Старые карточки (одна система на всю) — первая
           заполненная строка с системой карточки, остальные — подстроки. */
        const perRow = saved.mix.some((m) => m && m.system);
        let haveMain = false;
        saved.mix.forEach((m, i) => {
            const row = mixRows[i];
            if (!row || !m) return;
            const filledRow = Boolean(m.level);
            let link = Boolean(m.link) || (!perRow && filledRow && haveMain);
            if (link && !haveMain) link = false;
            setRowLink(row, link);
            if (!link) setRowSystem(row, m.system || (filledRow && !perRow ? saved.system : '') || '');
            if (filledRow) haveMain = true;
        });
        saved.mix.forEach((m, i) => {
            const row = mixRows[i];
            if (!row || !m) return;
            // Колония из EVE: её планета разрешена для товара строки, даже
            // если сырьё там не добывается (завозят — фабричная планета)
            if (m.planet && m.prod) row.dataset.colonyPlanet = `${m.prod}|${m.planet}`;
            else delete row.dataset.colonyPlanet;
            setMixLevel(row, m.level, m.prod);
            fillMixRow(row, systemOfRow(row));
        });
    }

    // Карточки P3/P4: так же, товары строк — до значений самих строк
    if (isProdLevel(saved.level)) {
        const prods = Array.from(card.querySelectorAll('[data-role="prod"]'));
        (Array.isArray(saved.prods) ? saved.prods : []).forEach((value, i) => {
            if (prods[i]) pickValue(prods[i], value);
        });
    }

    const rows = Array.from(card.querySelectorAll('tbody tr'));
    (Array.isArray(saved.rows) ? saved.rows : []).forEach((data, i) => {
        const row = rows[i];
        if (!row || !data) return;

        // пустая планета — свободный слот (её ставит карта региона)
        const planetCell = row.querySelector('[data-role="planet"]');
        if (data.planet === '' && planetCell && planetCell.querySelector('option[value=""]')) {
            planetCell.value = '';
            planetCell.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            pickValue(planetCell, data.planet);
        }
        pickValue(row.querySelector('[data-role="number"]'), data.number);
        // В списке «Планета» — пункт с этим номером (планет одного типа бывает несколько)
        if (planetCell && data.number) {
            const exact = Array.from(planetCell.options)
                .find((o) => o.dataset.num === data.number && o.value === planetCell.value);
            if (exact) {
                exact.selected = true;
                syncTitle(planetCell, 'Планета не выбрана');
            }
        }
        pickValue(row.querySelector('[data-role="p0"]'), data.p0);
        pickValue(row.querySelector('[data-role="p1"]'), data.p1);
    });

    pickValue(card.querySelector('[data-role="ship"]'), saved.ship);
}

/* Создаёт карточку в указанной линии, справа от уже созданных в ней.
   Параметр saved — сохранённые значения, если карточка восстанавливается.
   Возвращает false, если имя пустое или предел CARDS_LIMIT в линии взят. */
/* ---- Карточка в режиме просмотра ----
   Универсальная карточка — форма: в ней выбирают планеты и товары.
   «Сохранить» прячет форму и показывает карточку для чтения: по каждой
   колонии — система и планета, ниже дерево товара:
     P4 → входы рецепта (P3) → их входы (P2) → P1 → P0.
   У каждого товара — сколько его сейчас на складах колонии (расчёт от
   последнего открытия колонии в игре, как в окне «Тест») и иконки
   складов, где он лежит. Товар, которого нет, — в дереве с нулём.
   Видимость:
     при каждом показе карточки видны только главные товары (нажата TOP);
     ▸ у главного товара раскрывает колонию; кнопки уровней действуют
       только в раскрытых колониях (ни одна не раскрыта — раскрывают все);
     у главного товара — кнопки складов колонии: пустой подсвечен,
       нажатие показывает, что в складе лежит;
     кнопки P0…P4 в шапке показывают все товары своего уровня во всех
       колониях (уровни выше могут быть скрыты — тогда ветка встаёт
       ближе к главному товару);
     стрелка ▸ раскрывает ветки одного товара (так же видно и P0 под P1);
     кнопка TOP возвращает «только главные товары».
   Круглая кнопка ✎ открывает форму в окне редактирования. */
const VIEW_TIERS = ['P0', 'P1', 'P2', 'P3', 'P4'];
const VIEW_STOCK_TTL = 10 * 60 * 1000;
const viewStockCache = new Map();        // characterId -> { at, promise }

/* Склады колоний персонажа на «сейчас»: Map(«DFTK-D II» -> { stock, where, from }).
   stock — Map(товар -> штук) по складам, launchpad и командному центру
   (буферы фабрик не считаем); where — Map(товар -> Map(type_id склада -> штук)).
   Персонаж не подключён — null. */
function viewStockOf(name) {
    const char = (typeof eveChars === 'function' && eveConfigured() ? eveChars() : [])
        .find((c) => (c.characterName || '').toLowerCase() === String(name || '').toLowerCase());
    if (!char) return Promise.resolve(null);
    const hit = viewStockCache.get(char.characterId);
    if (hit && Date.now() - hit.at < VIEW_STOCK_TTL) return hit.promise;
    const promise = loadEveTest(char).then((data) => {
        const out = new Map();
        data.details.forEach(({ col, layout, planet, schematics }) => {
            const snaps = saveEsiSnapshot(col, layout);
            const esiT = new Date(col.last_update).getTime();
            const own = ownPinsOf(layout);
            const slices = snaps.manual.filter((x) => new Date(x.t).getTime() > esiT && own.has(String(x.pin)));
            let byPin;
            try {
                byPin = simulateColony(layout, schematics, col.last_update, Date.now(), { slices }).stock;
            } catch (e) {
                byPin = new Map(Object.entries(pinsContentsOf(layout))
                    .map(([id, items]) => [Number(id), new Map(Object.entries(items))]));
            }
            const pins = layout.pins || [];
            const factories = new Set(pins.filter(pinIsFactory).map((p) => p.pin_id));
            const typeOfPin = new Map(pins.map((p) => [p.pin_id, p.type_id]));
            const stock = new Map();
            const where = new Map();
            /* Считаем только склады — Launchpad, Storage Facility, Command
               Center, как в «Тесте». Экстрактор без маршрута копит добычу
               «в себе» (в игре так не бывает) — в сумму её не берём. */
            byPin.forEach((items, pinId) => {
                if (factories.has(pinId) || !typeOfPin.has(pinId) || !storeKindOf(typeOfPin.get(pinId), true)) return;
                items.forEach((n, item) => {
                    if (!(n > 0)) return;
                    stock.set(item, (stock.get(item) || 0) + n);
                    if (!where.has(item)) where.set(item, new Map());
                    const t = typeOfPin.get(pinId);
                    where.get(item).set(t, (where.get(item).get(t) || 0) + n);
                });
            });
            // все склады колонии — и пустые
            const stores = pins.filter((p) => !factories.has(p.pin_id) && storeKindOf(p.type_id, true))
                .map((p) => ({ pinId: p.pin_id, typeId: p.type_id, items: byPin.get(p.pin_id) || new Map() }))
                // всегда в одном порядке: Launchpad, Storage Facility, Command Center
                .sort((a, b) => STORE_ORDER[storeKindOf(a.typeId)] - STORE_ORDER[storeKindOf(b.typeId)] || a.pinId - b.pinId);
            out.set(planet.name || String(col.planet_id), { stock, where, stores, from: col.last_update });
        });
        return out;
    }).catch(() => {
        viewStockCache.delete(char.characterId);
        return null;
    });
    viewStockCache.set(char.characterId, { at: Date.now(), promise });
    return promise;
}

const viewQtyHtml = (name) => `<span class="uv-qty" data-qty="${escapeHtml(name)}">…</span>`;

function viewResHtml(name) {
    const tier = `P${piTierOf(name)}`;
    return tierBadgeHtml(tier)
        // название стоит рядом — подсказка при наведении не нужна
        + `<span class="uv-icon">${iconFor(name) || BLANK_ICON}</span>`
        + `<span class="uv-name" lang="en">${escapeHtml(name)}</span>`;
}

// Узел дерева: строка товара и ветки — входы рецепта (у P1 — его P0).
// prefix — начало строки главного товара: система, планета.
function viewNodeHtml(name, p0Hint, prefix = '') {
    const tier = piTierOf(name);
    const recipe = PI_RECIPE_OF.get(name);
    let kids = [];
    if (tier === 1) {
        const p0 = p0Hint || (recipe && recipe.in[0] ? recipe.in[0][0] : '');
        if (p0) kids = [p0];
    } else if (tier >= 2 && recipe) {
        kids = recipe.in.map(([n]) => n);
    }
    // У главного товара стрелки нет: колонию сворачивает круглая кнопка справа
    const toggle = prefix ? ''
        : (kids.length
            ? '<button type="button" class="uv-toggle" data-role="uv-toggle" aria-expanded="false" title="Из чего делается">▸</button>'
            : '<span class="uv-toggle-gap"></span>');
    return `
        <div class="uv-node" data-tier="P${tier}">
            <div class="uv-line">${prefix}${toggle}${viewResHtml(name)}<span class="uv-sep">–</span>${viewQtyHtml(name)}</div>
            ${kids.length ? `<div class="uv-kids">${kids.map((k) => viewNodeHtml(k)).join('')}</div>` : ''}
        </div>`;
}

function viewShownOf(card) {
    return new Set((card.dataset.showTiers || '').split(',').filter((t) => VIEW_TIERS.includes(t)));
}

/* Что видно в дереве: главный товар — всегда; товар уровня, включённого
   кнопкой, — везде; остальное — если раскрыт его родитель (▸). Отступ —
   по числу видимых строк над товаром. */
function applyViewVisibility(card) {
    const view = card.querySelector(':scope > .uv');
    if (!view) return;
    const shown = viewShownOf(card);
    let opened = false;
    /* Ветки — под главным товаром: отступ от начала товара в верхней
       строке (после «система · планета ·»), дальше по 1.1rem на уровень */
    let base = 0;
    /* Кнопки уровней действуют только в раскрытых колониях (▸ у главного
       товара); свёрнутая колония — одна строка */
    let colonyOpen = false;
    const walk = (node, visible, depth) => {
        const line = node.querySelector(':scope > .uv-line');
        line.hidden = !visible;
        line.style.paddingLeft = depth ? `calc(${base}px + ${(depth - 1) * 1.1}rem)` : '0';
        const kidsWrap = node.querySelector(':scope > .uv-kids');
        if (!kidsWrap) return;
        const open = node.dataset.open === '1';
        if (open || node.dataset.auto === '1') opened = true;
        let allKids = true;
        Array.from(kidsWrap.children).forEach((kid) => {
            const kv = (colonyOpen && shown.has(kid.dataset.tier)) || (visible && open);
            if (!kv) allKids = false;
            walk(kid, kv, depth + (visible ? 1 : 0));
        });
        const toggle = line.querySelector('[data-role="uv-toggle"]');
        if (toggle) toggle.setAttribute('aria-expanded', String(open || allKids));
    };
    view.querySelectorAll('.uv-colony > .uv-node').forEach((top) => {
        const where = top.querySelector(':scope > .uv-line > .uv-where');
        base = where ? where.offsetWidth + 6 : 0;
        colonyOpen = top.dataset.open === '1' || top.dataset.auto === '1';
        walk(top, true, 0);
    });
    view.querySelectorAll('.uv-colony').forEach((col) => {
        const top = col.querySelector(':scope > .uv-node');
        const fold = col.querySelector(':scope > [data-role="uv-fold"]');
        if (!top || !fold) return;
        const hasKids = Boolean(top.querySelector(':scope > .uv-kids'));
        const isOpen = top.dataset.open === '1' || top.dataset.auto === '1';
        fold.hidden = !hasKids;
        fold.textContent = isOpen ? '−' : '+';
        fold.setAttribute('aria-expanded', String(isOpen));
        fold.title = isOpen ? 'Свернуть колонию' : 'Развернуть колонию';
        fold.setAttribute('aria-label', fold.title);
    });
    view.querySelectorAll('[data-role="uv-tier"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(shown.has(b.dataset.tier)));
    });
    const top = view.querySelector('[data-role="uv-top"]');
    if (top) top.setAttribute('aria-pressed', String(!shown.size && !opened));
    const all = view.querySelector('[data-role="uv-fold-all"]');
    if (all) {
        all.textContent = opened ? '−' : '+';
        all.title = opened ? 'Свернуть все колонии' : 'Развернуть все колонии';
        all.setAttribute('aria-label', all.title);
    }
}

function cardViewHtml(card) {
    const name = card.dataset.name || '';
    const colonies = Array.from(card.querySelectorAll('tbody tr')).map((row) => ({
        system: systemOfRow(row),
        prod: mixProdOf(row),
        planet: readValue(row, 'planet'),
        number: readValue(row, 'number'),
        p0: readValue(row, 'p0')
    })).filter((c) => c.prod);
    const body = colonies.map((c) => {
        const system = c.system || '';
        const key = [system, c.number].filter(Boolean).join(' ');
        // «DFTK-D II · Barren · ▸ [P4] Wetware Mainframe – 6» — одной строкой
        const where = `<span class="uv-where">${c.planet ? `<span class="uv-icon uv-planet-icon"><img src="img/planets/${escapeHtml(c.planet.toLowerCase())}.png" alt="" width="24" height="24" loading="lazy" onerror="this.remove()"></span>` : ''}<span class="uv-sys">${escapeHtml([system || 'Система не выбрана', c.planet ? c.number : ''].filter(Boolean).join(' '))}</span><span class="uv-ptype">· ${escapeHtml(c.planet || 'планета не выбрана')}</span><span class="uv-stores" data-role="uv-stores"></span><span class="uv-sep">·</span></span>`;
        return `
            <div class="uv-colony" data-planet="${escapeHtml(key)}">
                ${viewNodeHtml(c.prod, c.p0, where)}
                <button type="button" class="uv-fold" data-role="uv-fold" aria-expanded="false"
                        title="Развернуть колонию" aria-label="Развернуть колонию">+</button>
            </div>`;
    }).join('') || '<p class="uv-empty">Колоний нет — нажмите ✎ и добавьте их</p>';
    const safe = escapeHtml(name);
    return `
        <div class="uv">
            <div class="uv-head">
                <h3 class="ct-pilot-name" title="${safe}">${safe}</h3>
                <span class="uv-tiers" role="group" aria-label="Показывать уровни">
                    <button type="button" class="uv-top" data-role="uv-top" aria-pressed="true" title="Только главные товары колоний">TOP</button>
                    ${VIEW_TIERS.map((t) => `<button type="button" class="ct-tier ct-tier-${t.toLowerCase()} uv-tier" data-role="uv-tier" data-tier="${t}" aria-pressed="false" title="Показать все ${t}">${t}</button>`).join('')}
                </span>
                <button type="button" class="card-light" aria-pressed="${card.classList.contains('is-lit')}" title="Подсветить карточку" aria-label="Подсветить карточку">💡</button>
                <button type="button" class="uv-edit" data-role="card-edit" title="Редактировать карточку" aria-label="Редактировать карточку">✎</button>
                <button type="button" class="uv-fold uv-fold-all" data-role="uv-fold-all" title="Развернуть все колонии" aria-label="Развернуть все колонии">+</button>
                <button type="button" class="account-del" data-role="card-del"
                        title="Удалить карточку" aria-label="Удалить карточку ${safe}">&times;</button>
            </div>
            <div class="uv-body">${body}</div>
        </div>`;
}

/* Значки складов — как постройки на карте планеты в игре: Launchpad —
   ракета, Storage Facility — куб, Command Center — кольцо с точкой.
   Квадрат с рамкой, как значок уровня; цвет — свой у вида склада. Вид
   берём из названия типа («Barren Launchpad», «Lava Storage Facility»). */
const STORE_SVG = {
    lp: '<path d="M8 .4 9.8 4.7H6.2Z"/><path fill-rule="evenodd" d="M6.2 5.4h3.6v9.9H6.2ZM7.4 10.6h1.2v4.7H7.4Z"/><path d="M5.4 9.4 2.4 15.3h3ZM10.6 9.4l3 5.9h-3Z"/>',
    sf: '<path d="M8 1.8 13.6 5v6.2L8 14.4 2.4 11.2V5Z M2.4 5 8 8.2 13.6 5 M8 8.2v6.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    cc: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.3"/>'
};
const STORE_ORDER = { lp: 0, sf: 1, cc: 2, '': 3 };

/* Код склада из игры («MN-XFG»). EVE его не отдаёт, а из номера постройки
   он не вычисляется — вписывают один раз в списке склада, хранится в
   браузере по номеру постройки (pin_id). */
const PIN_CODES_KEY = 'evepi.pin.codes';
const PIN_CODES_DEFAULT = {
    1053122462642: 'MN-XFG',   // Sigetar · DFTK-D II · Launchpad
    1053122462686: '1K-35G',   // Sigetar · DFTK-D II · Storage Facility
    1053122454377: 'MD-U4G'    // Sigetar · DFTK-D II · Command Center
};
function pinCodeOf(pinId) {
    const saved = store.get(PIN_CODES_KEY, {}) || {};
    return saved[pinId] || PIN_CODES_DEFAULT[pinId] || '';
}
function setPinCode(pinId, code) {
    const saved = store.get(PIN_CODES_KEY, {}) || {};
    const clean = String(code || '').trim().toUpperCase();
    if (clean) saved[pinId] = clean;
    else delete saved[pinId];
    store.set(PIN_CODES_KEY, saved);
}
const storeTitleOf = (st) => [esiTypeName(st.typeId), pinCodeOf(st.pinId)].filter(Boolean).join(' ');

// Вписали код склада — запоминаем и обновляем подсказку его кнопки
document.addEventListener('change', (event) => {
    const input = event.target.closest && event.target.closest('[data-role="uv-pin-code"]');
    if (!input) return;
    setPinCode(input.dataset.pin, input.value);
    input.value = pinCodeOf(input.dataset.pin);
    const col = input.closest('.uv-colony');
    (col && col.storeData ? col.storeData : []).forEach((st, i) => {
        const btn = col.querySelector(`[data-role="uv-store"][data-i="${i}"]`);
        if (!btn) return;
        btn.title = storeHintOf(st);
    });
});
function storeKindOf(typeId, strict = false) {
    const name = String(esiTypeName(typeId) || '').toLowerCase();
    if (name.includes('launchpad')) return 'lp';
    if (name.includes('command')) return 'cc';
    if (name.includes('storage')) return 'sf';
    return strict ? '' : 'sf';
}
/* Вместимость складов (м³) и объём товара по уровню — из static-data
   (types.jsonl): Launchpad 10 000, Storage Facility 12 000, Command Center 500;
   P0 0.005, P1 0.19, P2 0.75, P3 3, P4 50. */
const STORE_CAPACITY = { lp: 10000, sf: 12000, cc: 500 };
const PI_TIER_VOLUME = [0.005, 0.19, 0.75, 3, 50];
// Заполнен — от 75 % объёма (жёлтый), переполнен — от 99 % (красный)
const STORE_WARN_SHARE = 0.75;
const STORE_FULL_SHARE = 0.99;
function storeUsedOf(items) {
    let used = 0;
    items.forEach((q, item) => { if (q > 0) used += q * (PI_TIER_VOLUME[piTierOf(item)] || 0); });
    return used;
}
// Состояние склада: '' | 'empty' | 'warn' | 'full'; used / cap — для подсказки
function storeStateOf(st) {
    const kind = storeKindOf(st.typeId);
    const cap = STORE_CAPACITY[kind] || 0;
    const used = storeUsedOf(st.items);
    const empty = !Array.from(st.items.values()).some((q) => q >= 1);
    let state = '';
    if (empty && kind !== 'cc') state = 'empty';
    else if (cap && used >= cap * STORE_FULL_SHARE) state = 'full';
    else if (cap && used >= cap * STORE_WARN_SHARE) state = 'warn';
    return { state, used, cap };
}
const fmtM3 = (v) => `${Math.round(v).toLocaleString('ru-RU')} м³`;
const storeFillPct = ({ used, cap }) => (cap ? Math.round(used / cap * 100) : 0);
// В списке склада: «9 950 м³ из 10 000 м³ (100 %) — переполнен»
const storeFillText = (f) => {
    if (f.state === 'empty') return 'пусто';
    if (!f.cap) return '';
    const note = f.state === 'full' ? ' — переполнен' : f.state === 'warn' ? ' — почти полон' : '';
    return `${fmtM3(f.used)} из ${fmtM3(f.cap)} (${storeFillPct(f)} %)${note}`;
};
// Подсказка кнопки: название и код, ниже строкой — процент заполнения
const storeHintOf = (st) => {
    const f = storeStateOf(st);
    // строка «Ключ: значение» — подсказка покажет её под названием, ключ жирным
    const note = f.state === 'empty' ? ' — пусто' : f.state === 'full' ? ' — переполнен' : '';
    const line = f.cap ? `Заполнено: ${storeFillPct(f)} %${note}` : '';
    return [storeTitleOf(st), line].filter(Boolean).join('\n');
};
const storeIconHtml = (typeId, title) => {
    const kind = storeKindOf(typeId);
    return `<span class="uv-store uv-store-${kind}" title="${escapeHtml(title)}"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${STORE_SVG[kind]}</svg></span>`;
};

function renderCardView(card) {
    let view = card.querySelector(':scope > .uv');
    const html = cardViewHtml(card);
    if (view) view.outerHTML = html;
    else card.insertAdjacentHTML('beforeend', html);
    view = card.querySelector(':scope > .uv');
    card.dataset.showTiers = '';
    applyViewVisibility(card);
    viewStockOf(card.dataset.name).then((stocks) => {
        if (!view.isConnected) return;
        view.querySelectorAll('.uv-colony').forEach((col) => {
            const data = stocks && stocks.get(col.dataset.planet);
            /* Склады колонии кнопками у главного товара; пустой Launchpad
               или Storage Facility подсвечен. Нажатие — что в нём лежит. */
            const box = col.querySelector('[data-role="uv-stores"]');
            if (box && data) {
                const states = data.stores.map(storeStateOf);
                box.innerHTML = data.stores.map((st, i) => {
                    const kind = storeKindOf(st.typeId);
                    const fill = states[i];
                    const cls = fill.state ? ` is-${fill.state}` : '';
                    // подсказка — название и код, под ними % заполнения; что внутри — по нажатию
                    const title = storeHintOf(st);
                    return `<button type="button" class="uv-store uv-store-${kind} uv-store-btn${cls}" data-role="uv-store" data-i="${i}" data-fill="${fill.state || 'ok'}" title="${escapeHtml(title)}" aria-expanded="false"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${STORE_SVG[kind]}</svg></button>`;
                }).join('');
                col.storeData = data.stores;
                // колония с пустым / переполненным складом выделяется целиком
                col.classList.toggle('has-store-empty', states.some((s) => s.state === 'empty'));
                col.classList.toggle('has-store-full', states.some((s) => s.state === 'full'));
                col.classList.toggle('has-store-warn', states.some((s) => s.state === 'warn'));
                ['empty', 'warn', 'full'].forEach((k) => card.classList.toggle(`has-store-${k}`,
                    !!view.querySelector(`.uv-colony.has-store-${k}`)));
                applyViewVisibility(card);
            }
            col.querySelectorAll('[data-qty]').forEach((el) => {
                const item = el.dataset.qty;
                const n = data ? Math.floor(data.stock.get(item) || 0) : null;
                const stores = data && data.where.get(item);
                const codeOfType = (t) => {
                    const st = data.stores.find((x) => x.typeId === t);
                    return st ? pinCodeOf(st.pinId) : '';
                };
                const icons = stores
                    ? Array.from(stores.entries())
                        .sort((a, b) => STORE_ORDER[storeKindOf(a[0])] - STORE_ORDER[storeKindOf(b[0])])
                        .map(([t]) => storeIconHtml(t, [esiTypeName(t), codeOfType(t)].filter(Boolean).join(' '))).join('')
                    : '';
                el.innerHTML = icons + (n === null ? '—' : n.toLocaleString('ru-RU'));
                el.classList.toggle('is-zero', n === 0);
                // подсказка только когда числа нет — объяснить почему
                if (data) el.removeAttribute('title');
                else el.title = stocks ? 'Колония не найдена в EVE у этого персонажа' : 'Персонаж не подключён к EVE';
            });
        });
    });
}

function setCardView(card, on) {
    card.dataset.view = on ? '1' : '';
    card.classList.toggle('is-view', on);
    if (on) renderCardView(card);
    else {
        const view = card.querySelector(':scope > .uv');
        if (view) view.remove();
    }
}

// Клики режима просмотра; true — клик обработан
function handleViewClick(event) {
    const card = event.target.closest('.card');
    if (!card) return false;
    if (event.target.closest('[data-role="card-save"]')) {
        if (cardEditor && cardEditor.card === card) closeCardEditor(true);
        else {
            setCardView(card, true);
            saveAccounts();
        }
        return true;
    }
    if (event.target.closest('[data-role="card-edit"]')) {
        openCardEditor(card);
        return true;
    }
    const tierBtn = event.target.closest('[data-role="uv-tier"]');
    if (tierBtn) {
        const shown = viewShownOf(card);
        const tier = tierBtn.dataset.tier;
        if (shown.has(tier)) shown.delete(tier);
        else shown.add(tier);
        card.dataset.showTiers = Array.from(shown).join(',');
        /* Ни одна колония не раскрыта — кнопка уровня раскрывает все, но
           «для уровней» (data-auto): видны только товары включённых
           уровней, без прочих веток. Уровни выключили — такие колонии
           сворачиваются обратно. */
        const tops = Array.from(card.querySelectorAll('.uv-colony > .uv-node'));
        if (shown.size && !tops.some((n) => n.dataset.open === '1' || n.dataset.auto === '1')) {
            tops.forEach((n) => { if (n.querySelector(':scope > .uv-kids')) n.dataset.auto = '1'; });
        }
        if (!shown.size) tops.forEach((n) => { delete n.dataset.auto; });
        applyViewVisibility(card);
        saveAccounts();
        return true;
    }
    if (event.target.closest('[data-role="uv-top"]')) {
        card.dataset.showTiers = '';
        card.querySelectorAll('.uv-node[data-open], .uv-node[data-auto]').forEach((n) => {
            delete n.dataset.open;
            delete n.dataset.auto;
        });
        applyViewVisibility(card);
        saveAccounts();
        return true;
    }
    const storeBtn = event.target.closest('[data-role="uv-store"]');
    if (storeBtn) {
        const col = storeBtn.closest('.uv-colony');
        const old = col.querySelector('.uv-store-list');
        const same = old && old.dataset.i === storeBtn.dataset.i;
        if (old) old.remove();
        col.querySelectorAll('[data-role="uv-store"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
        if (same) return true;
        const st = (col.storeData || [])[Number(storeBtn.dataset.i)];
        if (!st) return true;
        const fillOf = storeStateOf(st);
        const list = Array.from(st.items.entries()).filter(([, q]) => q >= 1)
            .sort((a, b) => piTierOf(b[0]) - piTierOf(a[0]) || a[0].localeCompare(b[0]));
        col.querySelector('.uv-node > .uv-line').insertAdjacentHTML('afterend', `
            <div class="uv-store-list" data-i="${storeBtn.dataset.i}">
                <div class="uv-store-title">${escapeHtml(esiTypeName(st.typeId))}
                    <span class="uv-store-fill${fillOf.state ? ` is-${fillOf.state}` : ''}">${escapeHtml(storeFillText(fillOf))}</span>
                    <input class="uv-pin-code" data-role="uv-pin-code" data-pin="${st.pinId}" value="${escapeHtml(pinCodeOf(st.pinId))}"
                           placeholder="код из игры" maxlength="12" spellcheck="false" title="Код склада из игры, например MN-XFG"></div>
                ${list.length ? list.map(([n, q]) => `<div class="uv-line">${viewResHtml(n)}<span class="uv-sep">–</span><span class="uv-qty">${Math.floor(q).toLocaleString('ru-RU')}</span></div>`).join('')
                    : '<div class="uv-empty">пусто</div>'}
            </div>`);
        storeBtn.setAttribute('aria-expanded', 'true');
        return true;
    }
    // Кнопка в шапке: что-то раскрыто — свернуть всё, иначе развернуть всё до низа
    if (event.target.closest('[data-role="uv-fold-all"]')) {
        const nodes = card.querySelectorAll('.uv-node[data-open], .uv-node[data-auto]');
        if (nodes.length) {
            nodes.forEach((n) => { delete n.dataset.open; delete n.dataset.auto; });
            card.dataset.showTiers = '';
        } else {
            card.querySelectorAll('.uv-colony > .uv-node').forEach((n) => {
                if (n.querySelector(':scope > .uv-kids')) n.dataset.auto = '1';
            });
            card.dataset.showTiers = VIEW_TIERS.join(',');
        }
        applyViewVisibility(card);
        return true;
    }
    /* Круглая кнопка колонии: развернуть / свернуть. Все колонии
       свёрнуты — фильтры уровней сбрасываются (снова TOP). */
    const fold = event.target.closest('[data-role="uv-fold"]');
    if (fold) {
        const top = fold.closest('.uv-colony').querySelector(':scope > .uv-node');
        if (top.dataset.open === '1' || top.dataset.auto === '1') {
            delete top.dataset.open;
            delete top.dataset.auto;
            top.querySelectorAll('.uv-node[data-open]').forEach((n) => { delete n.dataset.open; });
        } else {
            /* развернуть — до самого низа: включаются все уровни. Колония
               раскрыта «по уровням» (data-auto), поэтому кнопки P0–P4
               потом прячут и показывают в ней любой уровень */
            top.dataset.auto = '1';
            card.dataset.showTiers = VIEW_TIERS.join(',');
        }
        const tops = Array.from(card.querySelectorAll('.uv-colony > .uv-node'));
        if (!tops.some((n) => n.dataset.open === '1' || n.dataset.auto === '1')) card.dataset.showTiers = '';
        applyViewVisibility(card);
        return true;
    }
    const toggle = event.target.closest('[data-role="uv-toggle"]');
    if (toggle) {
        const node = toggle.closest('.uv-node');
        if (toggle.getAttribute('aria-expanded') === 'true') {
            delete node.dataset.open;
            delete node.dataset.auto;
        } else node.dataset.open = '1';
        // закрываем — закрываем и ветки под ним
        if (!node.dataset.open) node.querySelectorAll('.uv-node[data-open]').forEach((n) => { delete n.dataset.open; });
        applyViewVisibility(card);
        return true;
    }
    return false;
}

/* ---- Окно редактирования карточки ----
   Форма (универсальная карточка с выпадающими списками) открывается во
   всплывающем окне, а на месте карточки в линии остаётся её вид — так
   ряд карточек не прыгает. «Сохранить» возвращает карточку на место в
   режиме просмотра, «Отмена» / × / Esc — без изменений (новая карточка,
   открытая сразу после «Добавить», при отмене не добавляется).
   Вопросы системы (issues) подсвечены: строка — красной рамкой с
   подсказкой, общие — списком над формой. Частично заполненную карточку
   сохранить можно, если она не противоречит правилам; противоречие
   (одна планета в двух строках) сохранить не даёт.
   Колоний у персонажа не больше 6 — по числу строк карточки, это не
   проверяем. */
let cardEditor = null;   // { card, slot, line, snapshot, isNew }
let cardEditorModal = null;

function ensureCardEditorModal() {
    if (cardEditorModal) return cardEditorModal;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="card-edit-modal" class="ct-modal" role="dialog" aria-modal="true" aria-labelledby="card-edit-title" hidden>
            <div class="ct-modal-box ce-box">
                <h3 id="card-edit-title" class="ct-modal-title">Редактирование</h3>
                <ul class="ce-issues" hidden></ul>
                <div class="ce-host"></div>
                <div class="ce-actions">
                    <span class="ce-error" role="alert"></span>
                    <button type="button" class="btn ce-cancel">Отмена</button>
                    <button type="button" class="btn card-add ce-save">Сохранить</button>
                </div>
                <button type="button" class="ct-modal-close" aria-label="Закрыть без сохранения">&times;</button>
            </div>
        </div>`);
    cardEditorModal = document.getElementById('card-edit-modal');
    const host = cardEditorModal.querySelector('.ce-host');
    // Те же обработчики, что у линии аккаунта: карточка живёт здесь
    host.addEventListener('change', (event) => {
        const row = event.target.closest('tbody tr');
        if (row) row.classList.remove('ce-bad');
        handleRowChange(event);
    });
    host.addEventListener('click', handleCardClick);
    host.addEventListener('mousedown', prepareCardList);
    host.addEventListener('focusin', prepareCardList);
    cardEditorModal.querySelector('.ce-save').addEventListener('click', () => closeCardEditor(true));
    cardEditorModal.querySelector('.ce-cancel').addEventListener('click', () => closeCardEditor(false));
    cardEditorModal.querySelector('.ct-modal-close').addEventListener('click', () => closeCardEditor(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && cardEditor && !cardEditorModal.hidden) closeCardEditor(false);
    });
    return cardEditorModal;
}

// issues: [{ row: номер строки или undefined, text }]
function openCardEditor(card, issues = [], opts = {}) {
    if (cardEditor) closeCardEditor(false);
    const modal = ensureCardEditorModal();
    const line = card.closest('.account-line');
    const snapshot = readCard(card);
    const view = card.querySelector(':scope > .uv');
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    slot.innerHTML = view ? view.outerHTML : `<div class="card-slot-note">${escapeHtml(card.dataset.name || '')} — редактируется…</div>`;
    card.replaceWith(slot);
    cardEditor = { card, slot, line, snapshot, isNew: Boolean(opts.isNew) };
    setCardView(card, false);
    modal.querySelector('.ce-host').appendChild(card);
    modal.querySelector('#card-edit-title').textContent = `Редактирование: ${card.dataset.name || ''}`;
    modal.querySelector('.ce-error').textContent = '';

    const rows = Array.from(card.querySelectorAll('tbody tr'));
    rows.forEach((row) => { row.classList.remove('ce-bad'); row.removeAttribute('data-issue'); });
    const general = [];
    issues.forEach((it) => {
        const row = Number.isInteger(it.row) ? rows[it.row] : null;
        if (row) {
            row.classList.add('ce-bad');
            row.dataset.issue = row.dataset.issue ? `${row.dataset.issue}; ${it.text}` : it.text;
            row.title = row.dataset.issue;
            general.push(`Строка ${it.row + 1}: ${it.text}`);
        } else {
            general.push(it.text);
        }
    });
    const list = modal.querySelector('.ce-issues');
    list.innerHTML = general.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
    list.hidden = !general.length;
    modal.hidden = false;
    fitCardColumns(card);
    const first = modal.querySelector('.ce-bad select:not(:disabled), .ce-bad button') || modal.querySelector('.ce-save');
    if (first) first.focus();
}

/* Противоречия правилам — с ними не сохраняем. Одна планета в двух
   строках — нормально (два экстрактора: Water и Reactive Metals), а вот
   один и тот же товар на одной планете дважды — повтор. */
function cardContradictions(card) {
    const out = [];
    const seen = new Map();
    Array.from(card.querySelectorAll('tbody tr')).forEach((row, i) => {
        const planet = readValue(row, 'planet');
        const prod = mixProdOf(row);
        if (!planet || !prod) return;
        const key = `${systemOfRow(row)}|${planet}|${readValue(row, 'number')}|${prod}|${readValue(row, 'p0')}`;
        if (seen.has(key)) out.push({ row: i, text: `повтор строки ${seen.get(key) + 1}: та же планета и тот же товар` });
        else seen.set(key, i);
    });
    return out;
}

function closeCardEditor(save) {
    if (!cardEditor) return;
    const modal = cardEditorModal;
    const { card, slot, line, snapshot, isNew } = cardEditor;
    if (save) {
        const bad = cardContradictions(card);
        if (bad.length) {
            const rows = Array.from(card.querySelectorAll('tbody tr'));
            bad.forEach((b) => {
                rows[b.row].classList.add('ce-bad');
                rows[b.row].title = b.text;
            });
            modal.querySelector('.ce-error').textContent = bad.map((b) => `Строка ${b.row + 1}: ${b.text}`).join('; ');
            return;
        }
    }
    modal.hidden = true;
    cardEditor = null;
    card.querySelectorAll('tbody tr').forEach((row) => {
        row.classList.remove('ce-bad');
        row.removeAttribute('data-issue');
        row.removeAttribute('title');
    });
    if (save) {
        slot.replaceWith(card);
        setCardView(card, true);
    } else if (isNew) {
        card.remove();
        slot.remove();
        pruneEmptyLines();
    } else {
        // Отмена: карточка заново из снимка на том же месте
        card.remove();
        const cards = line.querySelector('[data-role="cards"]');
        const next = slot.nextSibling;
        slot.remove();
        if (addCard(line, snapshot.name, snapshot)) cards.insertBefore(cards.lastElementChild, next);
    }
    saveAccounts();
    refreshLine(line);
    refreshPilotSelects();
}

/* Что карточка не смогла подставить: товар или планета строки не встали
   в списки (например, товар не подходит ни одной планете системы) */
function cardFillIssues(card, saved) {
    const out = [];
    if (!saved || !Array.isArray(saved.mix)) return out;
    const rows = Array.from(card.querySelectorAll('tbody tr'));
    saved.mix.forEach((m, i) => {
        const row = rows[i];
        if (!row || !m || !m.prod) return;
        if (mixProdOf(row) !== m.prod) out.push({ row: i, text: `товар ${m.prod} не подставился` });
        else if (saved.rows && saved.rows[i] && saved.rows[i].planet && !readValue(row, 'planet')) {
            out.push({ row: i, text: `планета ${saved.rows[i].planet} ${saved.rows[i].number || ''} не подставилась` });
        }
    });
    return out;
}

function addCard(line, name, saved, level) {
    const clean = name.trim();
    const cards = line.querySelector('[data-role="cards"]');
    if (!clean || cards.children.length >= CARDS_LIMIT) return false;

    /* Уровень карточки приходит явно (кнопкой из окна выбора) либо
       из сохранённой копии; у старых карточек его нет — это P1. */
    // Прежние тестовые карточки — теперь обычные P2 и P3
    const LEGACY = { T2: 'P2', T3: 'P3', TMIX: 'MIX' };
    let wanted = level || (saved && saved.level);
    wanted = LEGACY[wanted] || wanted;
    if (saved && LEGACY[saved.level]) saved = Object.assign({}, saved, { level: wanted });
    const cardLevel = isP2Level(wanted) || isProdLevel(wanted) || isMixLevel(wanted) ? wanted : 'P1';
    cards.insertAdjacentHTML('beforeend', buildCard(clean, cardLevel));
    const card = cards.lastElementChild;

    // Ширина «Планеты» (и товара на «Тест P3») — по самому длинному тексту
    fitCardColumns(card);
    if (cardColumnsObserver) cardColumnsObserver.observe(card);

    // Универсальная карточка: строки пустые, с кнопкой «+ Добавить»
    if (isMixLevel(cardLevel)) {
        card.querySelectorAll('tbody tr').forEach((row) => renderMixHead(row));
    }

    if (saved) {
        restoreCard(card, saved);
    } else {
        // Новая карточка: регион из списка вверху вкладки, если он выбран
        const defaults = defaultsForNewCard();
        if (defaults) restoreCard(card, { level: cardLevel, region: defaults.region });
    }

    // Первичное заполнение каскада, подсказки и фона корабля
    // в строках новой карточки
    const isP2 = isP2Level(card.dataset.level);
    const systemName = systemOfCard(card);
    card.querySelectorAll('tbody tr').forEach((row) => {
        if (isMixLevel(card.dataset.level)) {
            fillMixRow(row, systemOfRow(row));
        } else if (isProdLevel(card.dataset.level)) {
            fillProdRow(row, systemName, card.dataset.level);
        } else if (isP2) {
            // На карточке P2 столбцы P1 и P0 — текст рецепта, не списки
            fillP2Row(row, systemName);
        } else {
            fillP0(row);
            fillP1(row);
        }
        // Подсказка фоном в заблокированной планете («Система» / «Товар»)
        numberizePlanets(row, isMixLevel(card.dataset.level) ? systemOfRow(row) : systemName);
        if (row.querySelector('[data-role="planet"]').disabled === false) {
            syncTitle(row.querySelector('[data-role="planet"]'), 'Тип планеты не выбран');
        }
    });

    // Сохранённая в режиме просмотра — так и показываем
    if (isMixLevel(card.dataset.level) && saved) {
        card.dataset.showTiers = Array.isArray(saved.showTiers) ? saved.showTiers.join(',') : '';
        if (saved.view) setCardView(card, true);
    }

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

/* ---- Выбор вида карточки ----
   Кнопка «Добавить» спрашивает, какую карточку создать: P1 —
   прежнюю колонию, P2 — с товаром P2 и фильтрацией планет/P0/P1
   по его рецепту. Выбор — маленькое модальное окно, собранное один
   раз; выбранный уровень уходит в колбек. */
let levelModal = null;
let levelOnPick = null;

function showCardLevelChoice(onPick) {
    if (!levelModal) {
        levelModal = document.createElement('div');
        levelModal.className = 'ct-modal';
        levelModal.innerHTML = `
            <div class="ct-modal-box" role="dialog" aria-modal="true" aria-label="Выбор карточки">
                <h3 class="ct-modal-title">Какая карточка?</h3>
                <!-- Карточки — в один ряд, описание каждой — под её кнопкой -->
                <div class="ct-modal-actions">
                    <div class="ct-modal-option">
                        <button type="button" class="btn" data-level="P1">Карточка P1</button>
                        <p class="ct-modal-hint">Колония: планета, добыча P0 и производство P1.</p>
                    </div>
                    <div class="ct-modal-option">
                        <button type="button" class="btn" data-level="P2">Карточка P2</button>
                        <p class="ct-modal-hint">Товар P2 в каждой строке; каждый вход P1 и его сырьё P0 — в своей клетке.</p>
                    </div>
                    <div class="ct-modal-option">
                        <button type="button" class="btn" data-level="P3">Карточка P3</button>
                        <p class="ct-modal-hint">Товар P3 в каждой строке; каждый вход P2 — в своей клетке. Любая планета.</p>
                    </div>
                    <div class="ct-modal-option">
                        <button type="button" class="btn" data-level="P4">Карточка P4</button>
                        <p class="ct-modal-hint">Товар P4 в каждой строке; каждый вход P3 — в своей клетке. Только Barren и Temperate.</p>
                    </div>
                    <div class="ct-modal-option">
                        <button type="button" class="btn" data-level="MIX">Универсальная</button>
                        <p class="ct-modal-hint">Строки добавляются кнопкой: в каждой свой тип P1–P4 и товар — под любые случаи.</p>
                    </div>
                </div>
                <button type="button" class="ct-modal-close" aria-label="Закрыть">&times;</button>
            </div>`;

        levelModal.querySelectorAll('button[data-level]').forEach((button) => {
            button.addEventListener('click', () => {
                levelModal.hidden = true;
                if (levelOnPick) levelOnPick(button.dataset.level);
            });
        });

        levelModal.querySelector('.ct-modal-close').addEventListener('click', () => {
            levelModal.hidden = true;
        });

        // Клик по подложке тоже закрывает окно
        levelModal.addEventListener('click', (event) => {
            if (event.target === levelModal) levelModal.hidden = true;
        });

        document.body.appendChild(levelModal);
    }

    levelOnPick = onPick;
    levelModal.hidden = false;
}

// Слушатели одной линии. Поле персонажа и кнопка «Добавить» у каждой
// линии свои, поэтому вешаем их прямо на её элементы, а не на общий
// контейнер: так линия ничего не знает о соседних.
function initLine(line) {
    const cards = line.querySelector('[data-role="cards"]');

    cards.addEventListener('change', handleRowChange);
    cards.addEventListener('click', handleCardClick);

    // Списки регионов и систем добираем в тот момент, когда их
    // открывают: mousedown ловит мышь, focusin — переход с клавиатуры.
    cards.addEventListener('mousedown', prepareCardList);
    cards.addEventListener('focusin', prepareCardList);

    refreshLine(line);
}

/* ---- Добавление персонажа ----
   Один общий выбор «Персонаж» наверху. Карточка встаёт в первый ряд, где
   меньше трёх карточек; мест нет — появляется новый ряд. Тип карточки
   подбирается по колониям в EVE (pickCardForCharacter): всё понятно —
   сразу готовая, есть вопросы — окно редактирования с подсветкой. */
function lineWithRoom() {
    return Array.from(accounts.children).find((line) => {
        const cards = line.querySelector('[data-role="cards"]');
        return cards && cards.children.length < CARDS_LIMIT;
    }) || addAccount('', false);
}

function tryAddPilot() {
    const name = pilotNew.value.trim();
    if (!name || cardNamesTaken().has(name.toLowerCase())) {
        pilotNew.classList.add('ct-invalid');
        pilotNew.focus();
        refreshPilotSelects();
        return;
    }
    const char = (typeof eveChars === 'function' ? eveChars() : [])
        .find((c) => (c.characterName || '').toLowerCase() === name.toLowerCase());
    pilotNewAdd.disabled = true;
    pilotNewAdd.dataset.busy = '1';
    pilotNew.disabled = true;
    pickCardForCharacter(char).then(({ level, saved, note, issues }) => {
        delete pilotNewAdd.dataset.busy;
        const line = lineWithRoom();
        if (addCard(line, name, saved, level)) {
            const card = line.querySelector('[data-role="cards"]').lastElementChild;
            const all = (issues || (saved ? [] : [{ text: note }])).concat(cardFillIssues(card, saved));
            if (isMixLevel(card.dataset.level)) {
                if (all.length) openCardEditor(card, all, { isNew: true });
                else {
                    setCardView(card, true);
                    saveAccounts();
                }
            }
        }
        refreshLine(line);
        refreshAccounts();
        refreshPilotSelects();
        if (!cardEditor) pilotNew.focus();
    });
}

pilotNewAdd.addEventListener('click', tryAddPilot);
pilotNew.addEventListener('change', () => pilotNew.classList.remove('ct-invalid'));

/* ---- Перетаскивание карточек ----
   Карточку тянут за шапку. Бросить можно в любой ряд, где меньше трёх
   карточек (или в свой же — поменять порядок), и в полосу под рядами —
   тогда появится новый ряд. Опустевший ряд исчезает. */
let dragCard = null;
const dropPh = document.createElement('div');
dropPh.className = 'card-drop-ph';
const dropNew = document.createElement('div');
dropNew.className = 'cards-drop-new';
dropNew.textContent = 'Перетащите сюда — новый ряд';
dropNew.hidden = true;
accounts.after(dropNew);

accounts.addEventListener('mousedown', (event) => {
    const head = event.target.closest('.uv-head, .ct-system-inner');
    const card = head && head.closest('.card');
    if (!card || event.target.closest('button, select, input, textarea, a')) return;
    card.draggable = true;
});
document.addEventListener('mouseup', () => {
    if (!dragCard) accounts.querySelectorAll('.card[draggable="true"]').forEach((c) => { c.draggable = false; });
});
accounts.addEventListener('dragstart', (event) => {
    const card = event.target.closest && event.target.closest('.card');
    if (!card || !card.draggable) return;
    dragCard = card;
    event.dataTransfer.effectAllowed = 'move';
    try { event.dataTransfer.setData('text/plain', card.dataset.name || ''); } catch (e) { /* старые браузеры */ }
    dropPh.style.height = `${Math.min(card.offsetHeight, 160)}px`;
    requestAnimationFrame(() => card.classList.add('is-dragging'));
    dropNew.hidden = false;
});
function dropTargetRow(event) {
    const row = event.target.closest && event.target.closest('#accounts [data-role="cards"]');
    if (!row || !dragCard) return null;
    const others = Array.from(row.children).filter((el) => el !== dragCard && el !== dropPh);
    if (dragCard.parentElement !== row && others.length >= CARDS_LIMIT) return null;
    return { row, others };
}
accounts.addEventListener('dragover', (event) => {
    const t = dropTargetRow(event);
    if (!t) {
        dropPh.remove();
        return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const before = t.others.find((el) => {
        const r = el.getBoundingClientRect();
        return event.clientX < r.left + r.width / 2;
    });
    if (before) t.row.insertBefore(dropPh, before);
    else t.row.appendChild(dropPh);
});
accounts.addEventListener('drop', (event) => {
    if (!dragCard || !dropPh.parentElement) return;
    event.preventDefault();
    const from = dragCard.closest('.account-line');
    dropPh.replaceWith(dragCard);
    finishDrag(from);
});
dropNew.addEventListener('dragover', (event) => {
    if (!dragCard) return;
    event.preventDefault();
    dropPh.remove();
    dropNew.classList.add('is-over');
});
dropNew.addEventListener('dragleave', () => dropNew.classList.remove('is-over'));
dropNew.addEventListener('drop', (event) => {
    if (!dragCard) return;
    event.preventDefault();
    const from = dragCard.closest('.account-line');
    const line = addAccount('', false);
    line.querySelector('[data-role="cards"]').appendChild(dragCard);
    finishDrag(from);
});
function finishDrag(from) {
    const card = dragCard;
    const to = card.closest('.account-line');
    refreshLine(from);
    refreshLine(to);
    pruneEmptyLines();
    saveAccounts();
    if (card.classList.contains('is-view')) applyViewVisibility(card);
}
accounts.addEventListener('dragend', () => {
    if (dragCard) {
        dragCard.classList.remove('is-dragging');
        dragCard.draggable = false;
    }
    dragCard = null;
    dropPh.remove();
    dropNew.hidden = true;
    dropNew.classList.remove('is-over');
});

/* Восстанавливаем линии. Карточка в хранилище бывает двух видов:
   прежняя — просто имя строкой, нынешняя — объект с содержимым.
   Если линий в хранилище нет, а карточки сохранились в старом виде,
   складываем их в одну линию и убираем старый ключ — иначе он остался
   бы лежать рядом и сбивал бы с толку. */
function loadAccountsFromStore() {
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
}

loadAccountsFromStore();

/* Карта региона (js/calculator.js) пишет колонии прямо в карточки —
   в хранилище, — и просит пересобрать вкладку «Планеты» из него.
   Пока карточки собираются, промежуточные сохранения карте не шлём. */
window.EVEPI_reloadAccounts = function reloadAccountsFromStore() {
    reloadingAccounts = true;
    try {
        accounts.innerHTML = '';
        loadAccountsFromStore();
    } finally {
        reloadingAccounts = false;
    }
    saveAccounts();
};

/* ---- Вход в EVE Online ----
   Кнопка видна всегда; без client_id в js/eveauth.js она лишь
   объясняет, что вход не настроен. Персонажей можно подключить
   несколько — каждый вход добавляет одного.
   При возврате из EVE адрес приходит с кодом (?code=...&state=...),
   код обменивается на токен, а токен проверяется через /oauth/verify.

   Пароль EVE сайт не видит и не хранит: его вводит пользователь
   на странице CCP, нам приходит только код. */
const eveBar = document.getElementById('eve-bar');
const eveLoginBtn = document.getElementById('eve-login');
const eveCharsBtn = document.getElementById('eve-chars-btn');
const eveCharsBox = document.getElementById('eve-chars');
const eveHint = document.getElementById('eve-hint');

/* Персонажи под кнопкой «Персонажи: N»: портрет, имя и крестик
   отключения. Кнопка входа остаётся видна всегда — каждый вход
   добавляет ещё одного персонажа. */
const evePortrait = (id) => `https://images.evetech.net/characters/${encodeURIComponent(id)}/portrait?size=32`;

function renderEveAuth(message) {
    const list = eveChars();
    eveLoginBtn.hidden = false;
    eveLoginBtn.title = list.length ? 'Добавить ещё персонажа' : 'Войти через EVE Online';
    // список-меню на месте подписи «Персонажи»
    eveCharsBtn.textContent = `Персонажи: ${list.length}`;
    eveCharsBtn.setAttribute('aria-label', `Персонажи: ${list.length}`);
    if (!list.length) closeEveChars();
    eveCharsBox.innerHTML = list.map((c) => `
        <div class="eve-char">
            ${c.characterId ? `<img class="eve-char-img" src="${evePortrait(c.characterId)}" alt="" width="24" height="24">` : ''}
            <span class="eve-char-name">${escapeHtml(c.characterName || 'Персонаж')}</span>
            <button type="button" class="eve-char-drop" data-eve-drop="${escapeHtml(String(c.characterId))}"
                    title="Отключить персонажа" aria-label="Отключить ${escapeHtml(c.characterName || 'персонажа')}">&times;</button>
        </div>`).join('')
        + `<p class="eve-chars-note">Ещё персонаж — снова «LOG IN with EVE Online». Персонаж с другого
           аккаунта: на странице EVE смените аккаунт перед выбором персонажа.</p>`;
    eveHint.textContent = message || '';
    renderEveRoster(list);
    refreshPilotSelects();
}

/* Блок «Персонажи» внизу — список-меню (кнопка eve-chars-btn и окно
   eve-chars под ней); всё содержимое заполняет renderEveAuth */
const eveRosterList = document.getElementById('eve-roster-list');
function renderEveRoster(list) {
    if (!eveRosterList) return;
    eveRosterList.innerHTML = list.length
        ? list.map((c) => `
            <span class="eve-roster-char">
                ${c.characterId ? `<img class="eve-char-img" src="${evePortrait(c.characterId)}" alt="" width="24" height="24">` : ''}
                <span class="eve-roster-name">${escapeHtml(c.characterName || 'Персонаж')}</span>
            </span>`).join('')
        : '<span class="eve-roster-empty">не подключены — «LOG IN with EVE Online» вверху</span>';
}

function closeEveChars() {
    eveCharsBox.hidden = true;
    eveCharsBtn.setAttribute('aria-expanded', 'false');
}

/* ---- Статистика сервера EVE Online ----
   В шапке рядом со входом: игроков онлайн на Tranquility и с какого
   времени сервер работает (после ежедневного даунтайма). Обновляется
   раз в 2 минуты (ESI кэширует /status/ на 30 секунд). */
const eveStatusEl = document.getElementById('eve-status');
async function eveServerStatus() {
    if (!eveStatusEl) return;
    try {
        const res = await fetch(`${ESI_BASE}/status/?datasource=tranquility`);
        if (!res.ok) throw new Error(String(res.status));
        const st = await res.json();
        const since = new Date(st.start_time);
        const hours = Math.floor((Date.now() - since) / 3600000);
        const p2 = (n) => String(n).padStart(2, '0');
        eveStatusEl.className = 'eve-status is-online';
        eveStatusEl.innerHTML = `<span class="eve-status-dot"></span>Tranquility
            <b>${Number(st.players || 0).toLocaleString('ru-RU')}</b>`;
        eveStatusEl.title = `Сервер EVE Online работает · игроков онлайн: ${Number(st.players || 0).toLocaleString('ru-RU')}`
            + `\nзапущен ${p2(since.getHours())}:${p2(since.getMinutes())} (${hours} ч назад)`
            + (st.server_version ? ` · версия ${st.server_version}` : '')
            + (st.vip ? ' · только для разработчиков (VIP)' : '');
    } catch (e) {
        eveStatusEl.className = 'eve-status is-offline';
        eveStatusEl.innerHTML = '<span class="eve-status-dot"></span>Tranquility <b>недоступен</b>';
        eveStatusEl.title = 'Сервер EVE Online не отвечает — даунтайм или проблемы со связью';
    }
}
eveServerStatus();
setInterval(() => { if (!document.hidden) eveServerStatus(); }, 2 * 60 * 1000);

/* Повторный вызов не должен навешивать слушатели заново: в тестах
   initEveAuth() зовут несколько раз подряд на одной странице. */
let eveAuthReady = false;

async function initEveAuth() {
    if (!eveBar || eveAuthReady) return;
    eveAuthReady = true;
    eveBar.hidden = false;

    if (!eveConfigured()) {
        // Кнопка видна, но вход ещё не настроен: нажатие лишь объясняет это
        eveLoginBtn.hidden = false;
        eveLoginBtn.addEventListener('click', () => {
            eveHint.textContent = 'Вход через EVE Online пока не настроен';
        });
        renderEveRoster([]);
        return;
    }

    eveLoginBtn.addEventListener('click', () => {
        eveLoginBtn.disabled = true;
        eveLogin().catch((e) => {
            eveLoginBtn.disabled = false;
            renderEveAuth('Не удалось начать вход: ' + e.message);
        });
    });

    eveCharsBtn.addEventListener('click', () => {
        const open = eveCharsBox.hidden;
        eveCharsBox.hidden = !open;
        if (open) eveHint.textContent = '';
        eveCharsBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
        if (!eveCharsBox.hidden && !event.target.closest('#eve-chars, #eve-chars-btn')) closeEveChars();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !eveCharsBox.hidden) {
            closeEveChars();
            eveCharsBtn.focus();
        }
    });

    // Отключение одного персонажа: токен отзывается на стороне EVE
    eveCharsBox.addEventListener('click', async (event) => {
        const drop = event.target.closest('[data-eve-drop]');
        if (!drop) return;
        drop.disabled = true;
        const id = eveChars().find((c) => String(c.characterId) === drop.dataset.eveDrop);
        const name = id ? id.characterName : 'Персонаж';
        const revoked = await eveLogout(id ? id.characterId : undefined);
        renderEveAuth(revoked
            ? `${name} отключён`
            : `${name} отключён, но EVE не подтвердил отзыв токена`);
        if (eveChars().length) {
            eveCharsBox.hidden = false;
            eveCharsBtn.setAttribute('aria-expanded', 'true');
        }
    });

    // Перешли сюда кнопкой входа с другого адреса — продолжаем вход
    if (location.hash === '#eve-login' && eveOnRedirectPage()) {
        history.replaceState(null, '', location.pathname + location.search);
        renderEveAuth();
        eveLoginBtn.click();
        return;
    }

    // Возврат из EVE: персонаж добавляется в список
    try {
        const signedIn = await eveHandleCallback();
        if (signedIn) {
            renderEveAuth(`${signedIn.characterName || 'Персонаж'} подключён`);
            return;
        }
    } catch (e) {
        renderEveAuth('Вход не состоялся: ' + e.message);
        return;
    }

    // Обычная загрузка: персонажи могли остаться с прошлого раза.
    // Токены обновляем по очереди; кого EVE отверг — уйдёт из списка.
    const before = eveChars();
    for (const c of before) {
        // eslint-disable-next-line no-await-in-loop
        await eveAccess(c.characterId);
    }
    const lost = before.length - eveChars().length;

    renderEveAuth(lost
        ? `Сессия EVE истекла у ${lost} персонаж${lost === 1 ? 'а' : 'ей'} — войдите заново`
        : '');
}

initEveAuth().finally(startEveAutoSnaps);

/* ---- Подсказки в стиле EVE Online ----
   Как метка объекта в космосе: от кнопки идёт тонкая линия-выноска
   (наискосок и вбок), на её конце — полупрозрачная серая плашка с
   названием; ниже — строки «Ключ значение» (ключ жирным), если в
   подсказке есть строки вида «Код: MN-XFG». Текст берётся из title
   (переносится в data-tip, чтобы браузер не показывал свою подсказку). */
(function eveTooltips() {
    const box = document.createElement('div');
    box.className = 'eve-tip';
    box.setAttribute('role', 'tooltip');
    box.hidden = true;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    line.setAttribute('class', 'eve-tip-line');
    // кружок у кнопки — пустой, у плашки — закрашенный
    line.innerHTML = '<circle class="eve-tip-from" r="2.2"/><polyline fill="none"/><circle class="eve-tip-to" r="2"/>';
    line.style.display = 'none';
    document.body.append(line, box);
    let cur = null;
    let timer = 0;
    /* Системная подсказка браузера не нужна нигде: любой title, где бы и
       когда бы его ни поставили (списки, кнопки, карта), сразу переносим
       в data-tip — иначе местами всплывали две подсказки. */
    const adopt = (el) => {
        const t = el.getAttribute('title');
        el.removeAttribute('title');
        if (!t) return;
        el.dataset.tip = t;
        if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t.replace(/\n/g, ', '));
        if (el === cur && !box.hidden) fill(t);
    };
    document.querySelectorAll('[title]').forEach(adopt);
    new MutationObserver((list) => list.forEach((m) => {
        if (m.type === 'attributes') {
            if (m.target.hasAttribute && m.target.hasAttribute('title')) adopt(m.target);
        } else {
            m.addedNodes.forEach((n) => {
                if (n.nodeType !== 1) return;
                if (n.hasAttribute('title')) adopt(n);
                n.querySelectorAll('[title]').forEach(adopt);
            });
        }
    })).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
    const hide = () => {
        clearTimeout(timer);
        box.hidden = true;
        line.style.display = 'none';
        cur = null;
    };
    const fill = (text) => {
        const [head, ...rest] = String(text).split('\n');
        box.innerHTML = `<div class="eve-tip-name">${escapeHtml(head)}</div>`
            + rest.filter(Boolean).map((r) => {
                const k = r.indexOf(':');
                return k > 0
                    ? `<div class="eve-tip-row"><b>${escapeHtml(r.slice(0, k))}</b> ${escapeHtml(r.slice(k + 1).trim())}</div>`
                    : `<div class="eve-tip-row">${escapeHtml(r)}</div>`;
            }).join('');
    };
    const place = (el) => {
        const r = el.getBoundingClientRect();
        box.hidden = false;
        const w = box.offsetWidth;
        const h = box.offsetHeight;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = 22;                    // наискосок
        const run = 30;                   // и вбок
        const right = cx + dx + run + w < window.innerWidth - 6;
        // по умолчанию — над кнопкой; места сверху нет — под ней
        const down = cy - dx - h < 6;
        const ex = cx + (right ? dx : -dx);
        const ey = cy + (down ? dx : -dx);
        const fx = ex + (right ? run : -run);
        const bx = right ? fx : fx - w;
        const by = down ? ey - 11 : ey - h + 11;   // линия упирается в середину строки
        box.style.left = `${Math.round(bx)}px`;
        box.style.top = `${Math.round(by)}px`;
        const minX = Math.min(cx, fx) - 3;
        const minY = Math.min(cy, ey) - 3;
        line.style.left = `${minX}px`;
        line.style.top = `${minY}px`;
        line.setAttribute('width', Math.abs(fx - cx) + 6);
        line.setAttribute('height', Math.abs(ey - cy) + 6);
        const p = (x, y) => `${x - minX},${y - minY}`;
        line.querySelector('polyline').setAttribute('points', `${p(cx, cy)} ${p(ex, ey)} ${p(fx, ey)}`);
        const dot = line.querySelector('.eve-tip-from');
        dot.setAttribute('cx', cx - minX);
        dot.setAttribute('cy', cy - minY);
        const end = line.querySelector('.eve-tip-to');
        end.setAttribute('cx', fx - minX);
        end.setAttribute('cy', ey - minY);
        line.style.display = '';
    };
    document.addEventListener('mouseover', (event) => {
        const el = event.target.closest && event.target.closest('[title], [data-tip]');
        if (!el || el === cur) return;
        if (el.hasAttribute('title')) adopt(el);
        if (!el.dataset.tip) return;
        cur = el;
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (cur !== el || !el.isConnected) return;
            fill(el.dataset.tip);
            // рамка подсказки по заполненности склада (data-fill у кнопки)
            if (el.dataset.fill) box.dataset.fill = el.dataset.fill;
            else delete box.dataset.fill;
            place(el);
        }, 250);
    });
    document.addEventListener('mouseout', (event) => {
        if (!cur) return;
        if (event.relatedTarget && cur.contains(event.relatedTarget)) return;
        if (event.target === cur || cur.contains(event.target)) hide();
    });
    ['mousedown', 'scroll', 'keydown'].forEach((type) => window.addEventListener(type, hide, true));
}());
