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
const CARD_HEADERS = ['Планета', '№', 'P0', 'P1'];

/* Ширины колонок карточки, тот же порядок, что у CARD_HEADERS.
   Таблица ужимается до ширины карточки, и без заданных ширин колонки
   «поделят» её поровну, а P0 с P1 окажутся тесными.

   Проценты намеренно дают ровно 100%: при table-layout: fixed браузер
   ужимает процентные колонки, а фиксированных среди них нет.
   (calc вида «процент минус пиксели» в <col> при table-layout: fixed
   браузер отбрасывает — поэтому и обходимся без него.)

   Доли: P0 и P1 шире прочих (самое длинное слово плюс иконка слева от
   списка), Планета и № вдвое уже, Корабль — средняя. */
const CARD_COL_WIDTHS = ['18%', '8%', '37%', '37%'];

/* ---- Карточка P2 ----
   Второй вид карточки, колонки P2|Планета|№|P1|P0|Корабль. Шесть
   строк независимы: у каждой свой товар P2. Столбцы P1 и P0 здесь не
   выбираются — это рецепт выбранного P2, выводимый текстом (в P1 оба
   входа, в P0 их сырьё). Планеты фильтруются по рецепту, а выбранная
   система сужает их до своих типов. */
const CARD_HEADERS_P2 = ['P2', 'Планета', '№', 'P1', 'P1', 'P0', 'P0'];
const CARD_COL_WIDTHS_P2 = ['13%', '11%', '6%', '15.5%', '15.5%', '19.5%', '19.5%'];

// Товары P2 — это выход рецептов P1->P2 (outQty 5, два входа)
const PI_P2_LIST = PI_RECIPES
    .filter((recipe) => recipe.outQty === 5)
    .map((recipe) => recipe.out)
    .sort();
// Заполнителя «P2…» нет: в каждой строке сразу выбран товар P2
const P2_OPTIONS_HTML = PI_P2_LIST
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
    if (card.dataset.level === 'P2') {
        card.querySelectorAll('tbody tr').forEach((row) => {
            fillP2Row(row, systemName);
        });
        return;
    }

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

    // В первой строке идут объединённые ячейки, в остальных — нет.
    // Ячейка «Статус» убрана: кнопка подсветки переехала в строку
    // системы (см. buildCard).

    return `
        <tr data-row="${index}">
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
        </tr>`;
}

/* Строка карточки P2. От обычной отличается первой колонкой P2 и
   порядком P1/P0: пользователь просил порядок P2|Планета|№|P1|P0.
   Все шесть строк независимы: у каждой свой товар P2, свои планета,
   P1 и P0. «Корабль», как и в обычной карточке, объединён на все шесть
   строк. */
function buildP2ColonyRow(index) {
    const firstPlanet = PLANET_TYPES[0] || '';

    const p2Cell = `<td class="ct-p2">
               <div class="res-stack">
                   <select class="ct-input" data-role="p2" aria-label="Товар P2"
                           title="Выберите товар P2 — планеты и ресурсы строки подберутся по его рецепту">${P2_OPTIONS_HTML}</select>
               </div>
           </td>`;


    return `
        <tr data-row="${index}">
            ${p2Cell}
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
            <td class="ct-p1 ct-sub ct-sub-a">
                <div class="ct-recipe" data-role="p1-recipe-a" aria-label="Вход 1 рецепта P1"></div>
            </td>
            <td class="ct-p1 ct-sub ct-sub-b">
                <div class="ct-recipe" data-role="p1-recipe-b" aria-label="Вход 2 рецепта P1"></div>
            </td>
            <td class="ct-p0 ct-sub ct-sub-a">
                <div class="ct-recipe" data-role="p0-recipe-a" aria-label="Сырьё P0 для входа 1"></div>
            </td>
            <td class="ct-p0 ct-sub ct-sub-b">
                <div class="ct-recipe" data-role="p0-recipe-b" aria-label="Сырьё P0 для входа 2"></div>
            </td>
        </tr>`;
}

/* Вся карточка: шапка с именем персонажа и крестиком (классы те же,
   что у линии аккаунта), под ней таблица с заголовками и 6 строками.
   Имя попадает и в data-name — по нему карточка восстанавливается при загрузке. */
function buildCard(name, level) {
    const p2 = level === 'P2';
    const headers = p2 ? CARD_HEADERS_P2 : CARD_HEADERS;
    const widths = p2 ? CARD_COL_WIDTHS_P2 : CARD_COL_WIDTHS;
    const rows = Array.from(
        { length: COLONY_ROWS },
        (_, i) => (p2 ? buildP2ColonyRow(i) : buildColonyRow(i))
    ).join('');
    const safe = escapeHtml(name);

    return `
        <div class="card" data-name="${safe}" data-level="${p2 ? 'P2' : 'P1'}">
            <div class="account-bar">
                <h3 class="account-name">${safe}</h3>
                <button type="button" class="account-del" data-role="card-del"
                        title="Удалить карточку"
                        aria-label="Удалить карточку ${safe}">&times;</button>
            </div>
            <table class="colony-table">
                <colgroup>${widths.map((w) => `<col style="width:${w}">`).join('')}</colgroup>
                <thead>
                    <!-- Строка системы: над заголовками, на всю ширину
                         карточки. Списки общие на всю карточку, поэтому
                         стоят отдельной строкой, а не в колонке данных.
                         Кнопка подсветки 💡 стоит справа. -->
                    <tr class="ct-system-row">
                        <td colspan="${widths.length}" class="ct-system">
                            <div class="ct-system-inner">
                                <span class="ct-field">
                                    <span class="ct-system-label">Регион:</span>
                                    <select class="ct-input" data-role="region" aria-label="Регион" title="Регион не выбран">${REGION_PLACEHOLDER}</select>
                                </span>
                                <span class="ct-field">
                                    <span class="ct-system-label">Система:</span>
                                    <select class="ct-input" data-role="system" aria-label="Система" title="Система не выбрана">${SYSTEM_PLACEHOLDER}</select>
                                </span>
                                <span class="ct-field">
                                    <span class="ct-system-label">Корабль:</span>
                                    <select class="ct-input" data-role="ship" aria-label="Корабль">${optionsHtml(SHIP_OPTIONS, SHIP_OPTIONS[0])}</select>
                                </span>
                                <button type="button" class="card-light" aria-pressed="false" title="Подсветить карточку" aria-label="Подсветить карточку">💡</button>
                            </div>
                        </td>
                    </tr>
                    <tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr>
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
    p0Select.innerHTML = resources.length
        ? optionsHtml(resources, resources.includes(p0) ? p0 : resources[0])
        : '<option value="">—</option>';
}

// Значение P1 берём из PLANET_RESOURCES по выбранному типу планеты и P0.
// На карточке P2 столбца-списка P1 нет: там рецепт выводится текстом
// (см. fillP2Row), поэтому функция выходит сразу.
function fillP1(row) {
    const p1Select = row.querySelector('[data-role="p1"]');
    if (!p1Select) return; // карточка P2: столбец P1 — текст, не список

    const resources = PLANET_RESOURCES[planetTypeOf(row)] || [];
    const p0 = row.querySelector('[data-role="p0"]').value;
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
function fillP2Row(row, systemName) {
    const list = systemName ? planetTypesOf(systemName) : [];
    const planetCell = row.querySelector('[data-role="planet"]');
    const p1A = row.querySelector('[data-role="p1-recipe-a"]');
    const p1B = row.querySelector('[data-role="p1-recipe-b"]');
    const p0A = row.querySelector('[data-role="p0-recipe-a"]');
    const p0B = row.querySelector('[data-role="p0-recipe-b"]');
    const p2 = rowP2Of(row);

    // Иконка товара P2 слева от списка
    const p2Cell = row.querySelector('.ct-p2');
    if (p2Cell) updateResIcon(p2Cell);

    const empty = '<span class="ct-recipe-names ct-recipe-empty">—</span>';

    if (!p2) {
        // Строка без товара P2: рецепта нет, планеты — все типы системы
        if (p1A) p1A.innerHTML = empty;
        if (p1B) p1B.innerHTML = empty;
        if (p0A) p0A.innerHTML = empty;
        if (p0B) p0B.innerHTML = empty;

        planetCell.innerHTML = !systemName
            ? optionsHtml(PLANET_TYPES, PLANET_TYPES[0])
            : (list.length
                ? optionsHtml(list, list[0])
                : '<option value="">Нет данных о планетах</option>');
        syncTitle(planetCell, 'Тип планеты не выбран');
        return;
    }

    const recipe = PI_P2_RECIPE_OF.get(p2);
    const inputs = recipe.in.map(([name]) => name);

    // Сырьё P0 для входа: один P1 может добываться из разных P0
    const p0sOf = (p1) => uniqValues((P1_SOURCES.get(p1) || []).map((s) => s.p0));

    /* Ячейка рецепта лесенкой: иконки по краям, первое название
       сверху у левой иконки, второе снизу у правой. Левая иконка —
       первый вход рецепта, правая — второй. */
    const recipeCell = (icons, names) => `${iconFor(icons[0]).replace('class="res-icon"', 'class="res-icon ct-icon-a"')}`
        + `<span class="ct-recipe-name ct-name-a" lang="en">${escapeHtml(names[0])}</span>`
        + `<span class="ct-recipe-name ct-name-b" lang="en">${escapeHtml(names[1])}</span>`
        + `${iconFor(icons[1]).replace('class="res-icon"', 'class="res-icon ct-icon-b"')}`;

    const fill = (cell, icon, name) => {
        cell.innerHTML = `${iconFor(icon).replace('class="res-icon"', 'class="res-icon ct-icon-a"')}`
            + `<span class="ct-recipe-name ct-name-a" lang="en">${escapeHtml(name || '—')}</span>`
            + `<span class="ct-recipe-name ct-name-b" lang="en"></span>`
            + `${iconFor('').replace('class="res-icon"', 'class="res-icon ct-icon-b"')}`;
    };
    const rawsA = p0sOf(inputs[0]);
    const rawsB = p0sOf(inputs[1]);
    fill(p1A, inputs[0], inputs[0]);
    fill(p1B, inputs[1], inputs[1] === undefined ? '' : inputs[1]);
    fill(p0A, rawsA.length ? rawsA[0] : '', rawsA.length ? rawsA.join(' · ') : '—');
    fill(p0B, rawsB.length ? rawsB[0] : '', rawsB.length ? rawsB.join(' · ') : '—');

    // Планеты: где добывается сырьё любого из входов рецепта
    const producing = uniqValues(
        inputs.reduce((acc, name) => acc.concat((P1_SOURCES.get(name) || []).map((s) => s.planet)), [])
    );
    const allowed = list.length ? producing.filter((p) => list.includes(p)) : producing;
    const current = planetTypeOf(row);

    planetCell.innerHTML = allowed.length
        ? optionsHtml(allowed, allowed.includes(current) ? current : allowed[0])
        : (list.length
            ? '<option value="">Нет подходящих планет</option>'
            : optionsHtml(producing, producing[0]));
    syncTitle(planetCell, 'Тип планеты не выбран');
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

    // Смена товара P2 пересобирает только эту строку по рецепту:
    // каждая из шести строк карточки P2 независима.
    if (event.target.dataset.role === 'p2') {
        const card = event.target.closest('.card');
        fillP2Row(event.target.closest('tr'), systemOfCard(card));
        updateResIcon(event.target.closest('.ct-p2'));
        syncTitle(event.target, 'P2 не выбран');
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
        level: card.dataset.level || 'P1',
        region: readValue(card, 'region'),
        system: readValue(card, 'system'),
        ship: readValue(card, 'ship'),
        p2s: Array.from(card.querySelectorAll('[data-role="p2"]')).map((cell) => cell.value),
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

    /* Карточка P2: сначала товары P2 в строках — каждый выбор по рецепту
       фильтрует планету/P1/P0 своей строки, и только после этого
       восстанавливаются значения самих строк (см. ниже). Строки
       независимы: у каждой свой товар P2. */
    if (saved.level === 'P2') {
        const p2s = Array.from(card.querySelectorAll('[data-role="p2"]'));
        (Array.isArray(saved.p2s) ? saved.p2s : []).forEach((value, i) => {
            if (p2s[i]) pickValue(p2s[i], value);
        });
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
function addCard(line, name, saved, level) {
    const clean = name.trim();
    const cards = line.querySelector('[data-role="cards"]');
    if (!clean || cards.children.length >= CARDS_LIMIT) return false;

    /* Уровень карточки приходит явно (кнопкой из окна выбора) либо
       из сохранённой копии; у старых карточек его нет — это P1. */
    const cardLevel = level === 'P2' || (saved && saved.level === 'P2') ? 'P2' : 'P1';
    cards.insertAdjacentHTML('beforeend', buildCard(clean, cardLevel));
    const card = cards.lastElementChild;

    if (saved) restoreCard(card, saved);

    // Первичное заполнение каскада, подсказки и фона корабля
    // в строках новой карточки
    const isP2 = card.dataset.level === 'P2';
    const systemName = systemOfCard(card);
    card.querySelectorAll('tbody tr').forEach((row) => {
        if (isP2) {
            // На карточке P2 столбцы P1 и P0 — текст рецепта, не списки
            fillP2Row(row, systemName);
        } else {
            fillP0(row);
            fillP1(row);
        }
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
                <p class="ct-modal-hint">
                    P1 — прежняя карточка колонии: планеты, добыча P0 и производство P1.
                    P2 — карточка с товаром P2: шесть независимых строк, у каждой свой
                    товар, а состав P1 и P0 и планеты подбираются по его рецепту.
                </p>
                <div class="ct-modal-actions">
                    <button type="button" class="btn" data-level="P1">Карточка P1</button>
                    <button type="button" class="btn" data-level="P2">Карточка P2</button>
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
        if (!pilot.value.trim()) {
            // Пустое имя — подсвечиваем поле, карточка не создаётся
            pilot.classList.add('ct-invalid');
            pilot.focus();
            return;
        }

        // Имя есть — спрашиваем, какую карточку создавать: P1 или P2
        showCardLevelChoice((level) => {
            if (addCard(line, pilot.value, null, level)) {
                pilot.value = '';
                pilot.focus();
            }
        });
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