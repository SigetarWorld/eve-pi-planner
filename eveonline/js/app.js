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
const accountInput = document.getElementById('account-new');
const accountAdd = document.getElementById('account-add');
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
            fillMixRow(row, systemName);
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
                                <span class="ct-field">
                                    <span class="ct-system-label">Система:</span>
                                    <select class="ct-input" data-role="system" aria-label="Система" title="Сначала выберите регион" data-empty-text="Система" disabled><option value="">Регион???</option></select>
                                </span>
                                <span class="ct-field">
                                    <span class="ct-system-label">Корабль:</span>
                                    <select class="ct-input" data-role="ship" aria-label="Корабль">${optionsHtml(SHIP_OPTIONS, SHIP_OPTIONS[0])}</select>
                                </span>
                                <button type="button" class="card-light" aria-pressed="false" title="Подсветить карточку" aria-label="Подсветить карточку">💡</button>
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
    head.innerHTML = `${plain ? `<span class="ct-mix-type">${tierBadge(level)}</span>` : ''}
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
    if (!defRegion || !accountInput) return;
    const width = accountInput.getBoundingClientRect().width;
    if (width > 0) {
        defRegion.style.flex = '0 0 auto';
        defRegion.style.width = `${width}px`;
    }
}

if (defRegion && accountInput && window.ResizeObserver) {
    new ResizeObserver(syncRegionWidth).observe(accountInput);
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
                <!-- Персонаж — из подключённых через EVE Online; кто уже с
                     карточкой, в списке не показывается (refreshPilotSelects) -->
                <select id="${pilotId}" class="ct-input card-new pilot-select" data-role="pilot"></select>
                <button type="button" class="btn card-add" data-role="pilot-add">Добавить</button>
                <span class="line-status" data-role="line-status" aria-live="polite"></span>
                <span class="card-counter" data-role="line-counter" aria-live="polite">0 из ${CARDS_LIMIT}</span>
            </div>

            <div class="card-hint" data-role="line-hint">
                Выберите персонажа и нажмите «Добавить» — появится карточка
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
        if (role === 'mix-prod') {
            syncTitle(event.target, 'Товар не выбран');
            updateResIcon(row.querySelector('.ct-mix-head'));
            fillMixRow(row, systemOfCard(mixCard));
            return;
        }
        if (role === 'planet') {
            syncTitle(event.target, 'Тип планеты не выбран');
            fillMixRow(row, systemOfCard(mixCard));
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
        const card = event.target.closest('.card');
        setMixLevel(row, mixType ? mixType.dataset.mixType : '');
        if (mixClear) {
            // Очищенная строка — свободный слот: планета «—»
            const planet = row.querySelector('[data-role="planet"]');
            if (planet) planet.value = '';
        }
        fillMixRow(row, systemOfCard(card));
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
    refreshPilotSelects();
    line.querySelector('[data-role="line-hint"]').hidden = count > 0;

    // Три персонажа добавлены — панель добавления больше не нужна.
    // Удалили карточку — панель возвращается.
    line.querySelector('.card-head').hidden = full;
    // Вместе с ней скрывается и заголовок линии с именем аккаунта.
    // Берём только прямого потомка: у карточек своя шапка того же класса.
    line.querySelector(':scope > .account-bar').hidden = full;
    line.classList.toggle('is-full', full);
    updateStats();
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

    document.querySelectorAll('#accounts [data-role="pilot"]').forEach((select) => {
        const line = select.closest('.account-line');
        const full = line && line.classList.contains('is-full');
        const keep = free.includes(select.value) ? select.value : '';
        select.innerHTML = `<option value="">${escapeHtml(empty)}</option>`
            + free.map((n) => `<option value="${escapeHtml(n)}"${n === keep ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
        select.disabled = full || !free.length;
        if (reason && !full) select.dataset.empty = reason;
        else delete select.dataset.empty;
        const add = line && line.querySelector('[data-role="pilot-add"]');
        if (add) add.disabled = full || !free.length;
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

// Название рецепта = название выпускаемого товара («Coolant»)
async function esiSchematicName(id) {
    if (!esiSchematicNames.has(id)) {
        esiSchematicNames.set(id, esiPublicJson(`/universe/schematics/${id}/`)
            .then((d) => d.schematic_name || '')
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
        if (!product && p0s.length) {
            const r = PI_RECIPES.find((x) => x.outQty === 20 && x.in[0][0] === p0s[0]);
            product = r ? r.out : '';
        }
        return {
            planetId: col.planet_id,
            planetType: PLANET_TYPE_OF_ESI[col.planet_type] || '',
            system: col.solar_system_id,
            tier: tier || 1,
            products,
            product,
            p0s
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
    named.sort((a, b) => order(a.number) - order(b.number));
    const list = named.slice(0, COLONY_ROWS);

    const saved = { level, system: systemName };
    saved.rows = list.map((c) => ({
        planet: c.planetType,
        number: c.number,
        p0: c.tier === 1 ? (c.p0s[0] || '') : '',
        p1: ''
    }));
    if (isP2Level(level)) saved.p2s = list.map((c) => c.product);
    else if (isProdLevel(level)) saved.prods = list.map((c) => c.product);
    else if (isMixLevel(level)) saved.mix = list.map((c) => ({ level: `P${c.tier}`, prod: c.product }));
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
        const level = tiers.length === 1 ? `P${tiers[0]}` : MIX_LEVEL;

        /* У карточки одна система: берём ту, где больше всего колоний,
           и заполняем строки её колониями */
        const bySystem = new Map();
        colonies.forEach((c) => bySystem.set(c.system, (bySystem.get(c.system) || []).concat(c)));
        const [mainId, mainCols] = Array.from(bySystem.entries()).sort((a, b) => b[1].length - a[1].length)[0];
        let saved = null;
        let filled = 0;
        try {
            const sys = await esiPublicJson(`/universe/systems/${mainId}/`);
            if (sys.name) {
                saved = await cardFromColonies(level, mainCols, sys.name);
                filled = saved.rows.length;
            }
        } catch (e) {
            // без системы — строки не заполняем, выберут вручную
        }

        const n = colonies.length;
        const what = tiers.length === 1 ? `все P${tiers[0]}` : `уровни ${tiers.map((t) => `P${t}`).join(', ')}`;
        const rest = n - mainCols.length;
        return {
            level,
            saved,
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

function simulateColony(layout, schematics, startTime, endTime, opts = {}) {
    const pins = layout.pins || [];
    const routes = layout.routes || [];
    const stock = new Map();             // pin_id -> Map(название -> количество)
    const bag = (id) => {
        if (!stock.has(id)) stock.set(id, new Map());
        return stock.get(id);
    };
    const add = (id, name, qty) => bag(id).set(name, (bag(id).get(name) || 0) + qty);
    const initial = opts.stock || pinsContentsOf(layout);
    Object.entries(initial).forEach(([id, items]) => Object.entries(items)
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
    const events = [];
    const stats = { factoryCycles: 0, factoryIdle: 0, extractorCycles: 0 };
    const perFactory = new Map();        // pin_id -> { product, cycles, idle, missing:Set, sources:Set }
    const log = [];                      // сверки со срезами

    pins.forEach((p) => {
        const d = p.extractor_details;
        if (d && d.cycle_time && p.install_time) {
            const name = esiTypeName(d.product_type_id);
            const ms = d.cycle_time * 1000;
            const start = new Date(p.install_time).getTime();
            const end = Math.min(t1, p.expiry_time ? new Date(p.expiry_time).getTime() : t1);
            let k = Math.max(1, Math.floor((t0 - start) / ms) + 1);
            for (let t = start + k * ms; t <= end; k += 1, t = start + k * ms) {
                events.push({ t, order: 0, run: () => {
                    const r = outRoute(p.pin_id, name);
                    add(r ? r.destination_pin_id : p.pin_id, name, d.qty_per_cycle || 0);
                    stats.extractorCycles += 1;
                } });
            }
        }
        const sid = (p.factory_details && p.factory_details.schematic_id) || p.schematic_id;
        const recipe = sid && PI_RECIPE_OF.get(schematics[sid]);
        if (recipe) {
            const ms = recipe.cycle * 1000;
            let phase = p.last_cycle_start ? new Date(p.last_cycle_start).getTime() : t0;
            // цикл, начатый позже начала расчёта, — сдвигаем фазу назад
            if (phase > t0) phase -= Math.ceil((phase - t0) / ms) * ms;
            // на момент снимка фабрика в работе, если цикл начался меньше цикла назад
            const state = { running: Boolean(p.last_cycle_start) && t0 - phase < ms };
            const info = { product: recipe.out, cycles: 0, idle: 0, missing: new Set(), sources: new Set() };
            perFactory.set(p.pin_id, info);
            let k = Math.max(1, Math.floor((t0 - phase) / ms) + 1);
            for (let t = phase + k * ms; t <= t1; k += 1, t = phase + k * ms) {
                events.push({ t, order: 1, run: () => {
                    if (state.running) {
                        const r = outRoute(p.pin_id, recipe.out);
                        add(r ? r.destination_pin_id : p.pin_id, recipe.out, recipe.outQty);
                        stats.factoryCycles += 1;
                        info.cycles += 1;
                    }
                    // новый цикл: все входы рецепта — из буфера фабрики и со складов
                    const plan = recipe.in.map(([name, need]) => {
                        const from = routes
                            .filter((r) => r.destination_pin_id === p.pin_id && esiTypeName(r.content_type_id) === name)
                            .map((r) => r.source_pin_id);
                        from.forEach((id) => info.sources.add(id));
                        const sources = [p.pin_id].concat(from);
                        const have = sources.reduce((n, id) => n + (bag(id).get(name) || 0), 0);
                        return { name, need, sources, ok: have >= need };
                    });
                    state.running = plan.every((x) => x.ok);
                    if (!state.running) {
                        stats.factoryIdle += 1;
                        info.idle += 1;
                        plan.filter((x) => !x.ok).forEach((x) => info.missing.add(x.name));
                        return;
                    }
                    plan.forEach(({ name, need, sources }) => {
                        let left = need;
                        sources.forEach((id) => {
                            const take = Math.min(left, bag(id).get(name) || 0);
                            if (take) bag(id).set(name, bag(id).get(name) - take);
                            left -= take;
                        });
                    });
                } });
            }
        }
    });

    // Срезы из игры: сверка с расчётом и замена расчёта фактом
    (opts.slices || []).forEach((sl) => {
        const t = new Date(sl.t).getTime();
        if (t <= t0 || t > t1) return;
        events.push({ t, order: 2, run: () => {
            const was = bag(sl.pin);
            const names = new Set([...was.keys(), ...Object.keys(sl.items)]);
            const diffs = [];
            names.forEach((name) => {
                const d = Math.round((sl.items[name] || 0) - (was.get(name) || 0));
                if (d) diffs.push({ name, d });
            });
            log.push({ t: sl.t, pin: sl.pin, source: sl.source || 'manual', diffs });
            stock.set(sl.pin, new Map(Object.entries(sl.items)));
        } });
    });

    events.sort((a, b) => a.t - b.t || a.order - b.order).forEach((e) => e.run());
    return { stock, before, stats, perFactory, log, hours: Math.max(0, (t1 - t0) / 3600000) };
}

const evtData = new Map();              // planet_id -> данные колонии для перерисовки

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
    const slicesAfter = snaps.manual.filter((x) => new Date(x.t).getTime() > esiT);
    const sim = simulateColony(layout, schematics, col.last_update, now, { slices: slicesAfter });

    // Сверка прошлого открытия в игре с нынешним: что сделали руками
    let esiLog = [];
    const idx = snaps.esi.findIndex((x) => x.t === col.last_update);
    const prev = idx > 0 ? snaps.esi[idx - 1] : null;
    if (prev) {
        const between = snaps.manual.filter((x) => {
            const t = new Date(x.t).getTime();
            return t > new Date(prev.t).getTime() && t < esiT;
        });
        const cur = pinsContentsOf(layout);
        const slicesAtEsi = Object.keys(cur).concat(Object.keys(prev.pins))
            .filter((id, i, arr) => arr.indexOf(id) === i)
            .filter((id) => !pinIsFactory(pins.find((p) => String(p.pin_id) === id) || {}))
            .map((id) => ({ t: col.last_update, pin: Number(id), items: cur[id] || {}, source: 'esi' }));
        const back = simulateColony(layout, schematics, prev.t, esiT, { stock: prev.pins, slices: between.concat(slicesAtEsi) });
        esiLog = back.log;
    }

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
        const g = byProduct.get(f.product) || { n: 0, cycles: 0, idle: 0, missing: new Set(), sources: new Set() };
        g.n += 1;
        g.cycles += f.cycles;
        g.idle += f.idle;
        f.missing.forEach((x) => g.missing.add(x));
        f.sources.forEach((x) => g.sources.add(x));
        byProduct.set(f.product, g);
    });
    const fac = Array.from(byProduct.entries()).sort((a, b) => piTierOf(a[0]) - piTierOf(b[0]) || a[0].localeCompare(b[0]))
        .map(([name, g]) => `<li>${resChip(name)} × ${g.n}
            <span class="evt-dim">· циклов ${g.cycles}${g.idle ? ` · <span class="evt-bad">простоев ${g.idle}</span>` : ''}
            ${g.missing.size ? ` · не хватало: ${escapeHtml(Array.from(g.missing).join(', '))}` : ''}
            ${g.sources.size ? ` · входы из: ${Array.from(g.sources).map(pinLabel).join(', ')}` : ' · <span class="evt-bad">нет маршрутов на вход</span>'}</span></li>`).join('');

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
                return `<li>${resChip(name)} ${fmtN(n)} ${sign}</li>`;
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
        const what = e.diffs.length
            ? e.diffs.map(({ name, d }) => (d > 0
                ? `<li>${resChip(name)} <span class="evt-ok">+${fmtN(d)}</span> — сверх расчёта: <b>завезено вручную</b></li>`
                : `<li>${resChip(name)} <span class="evt-bad">${fmtN(d)}</span> — меньше расчёта: <b>забрано вручную</b> (или ушло не по маршруту)</li>`)).join('')
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
                <div><h6>Фабрики</h6><ul>${fac || '<li class="evt-dim">нет</li>'}</ul></div>
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
});

async function renderEveTest() {
    const body = document.getElementById('evetest-body');
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
    const head = event.target.closest('.account-line > .card-head');
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
    const count = accounts.children.length;
    accountCounter.textContent = `Аккаунтов: ${count}`;
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
    store.set(ACCOUNTS_KEY, Array.from(accounts.children).map((line) => ({
        name: line.dataset.account,
        cards: Array.from(line.querySelector('[data-role="cards"]').children).map(readCard)
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
        region: readValue(card, 'region'),
        system: readValue(card, 'system'),
        ship: readValue(card, 'ship'),
        p2s: Array.from(card.querySelectorAll('[data-role="p2"]')).map((cell) => cell.value),
        prods: Array.from(card.querySelectorAll('[data-role="prod"]')).map((cell) => cell.value),
        mix: isMixLevel(card.dataset.level)
            ? Array.from(card.querySelectorAll('tbody tr')).map((row) => ({ level: mixLevelOf(row), prod: mixProdOf(row) }))
            : undefined,
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
        const systemName = systemOfCard(card);
        saved.mix.forEach((m, i) => {
            const row = mixRows[i];
            if (!row || !m) return;
            setMixLevel(row, m.level, m.prod);
            fillMixRow(row, systemName);
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
            fillMixRow(row, systemName);
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
        numberizePlanets(row, systemName);
        if (row.querySelector('[data-role="planet"]').disabled === false) {
            syncTitle(row.querySelector('[data-role="planet"]'), 'Тип планеты не выбран');
        }
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
    const pilot = line.querySelector('[data-role="pilot"]');

    const tryAdd = () => {
        const name = pilot.value.trim();
        // Персонаж не выбран или уже с карточкой — подсвечиваем список
        if (!name || cardNamesTaken().has(name.toLowerCase())) {
            pilot.classList.add('ct-invalid');
            pilot.focus();
            refreshPilotSelects();
            return;
        }

        /* Персонаж есть — тип карточки подбирается по его колониям в EVE
           (pickCardForCharacter). Окно выбора типа (showCardLevelChoice)
           пока скрыто. */
        const add = line.querySelector('[data-role="pilot-add"]');
        const status = line.querySelector('[data-role="line-status"]');
        const char = (typeof eveChars === 'function' ? eveChars() : [])
            .find((c) => (c.characterName || '').toLowerCase() === name.toLowerCase());
        add.disabled = true;
        pilot.disabled = true;
        status.textContent = 'Смотрю колонии в EVE…';
        pickCardForCharacter(char).then(({ level, saved, note }) => {
            status.textContent = note;
            if (addCard(line, name, saved, level)) refreshPilotSelects();
            refreshLine(line);
            pilot.focus();
        });
    };

    line.querySelector('[data-role="pilot-add"]').addEventListener('click', tryAdd);
    pilot.addEventListener('change', () => pilot.classList.remove('ct-invalid'));

    // Крестик убирает линию вместе со всеми её карточками
    line.querySelector('[data-role="account-del"]')
        .addEventListener('click', () => {
            line.remove();
            saveAccounts();
            refreshAccounts();
            refreshPilotSelects();
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
    eveCharsBtn.hidden = !list.length;
    eveCharsBtn.innerHTML = `<span class="eve-chars-label">Персонажи: </span>${list.length}`;
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

/* Строка над «Статистикой»: все подключённые персонажи с портретами */
const eveRoster = document.getElementById('eve-roster');
function renderEveRoster(list) {
    if (!eveRoster) return;
    eveRoster.innerHTML = `<span class="card-pilot-label">Персонажи</span>`
        + (list.length
            ? list.map((c) => `
                <span class="eve-roster-char" title="${escapeHtml(c.characterName || 'Персонаж')}">
                    ${c.characterId ? `<img class="eve-char-img" src="${evePortrait(c.characterId)}" alt="" width="24" height="24">` : ''}
                    <span class="eve-roster-name">${escapeHtml(c.characterName || 'Персонаж')}</span>
                </span>`).join('')
            : '<span class="eve-roster-empty">не подключены — «LOG IN with EVE Online» вверху</span>');
}

function closeEveChars() {
    eveCharsBox.hidden = true;
    eveCharsBtn.setAttribute('aria-expanded', 'false');
}

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

initEveAuth();