// Схема производства на вкладке «Цепочки производства».
// Аналог страницы eve-webtools.com/Planetary/relations/, но на своих
// данных, а не на чужих.
//
// Откуда взято всё, что ниже:
//   - рецепты — planetSchematics.yaml официального SDE, 68 схем;
//   - имя и typeID товара — esi.evetech.net/v2/universe/types/<typeID>/;
//   - уровень P0..P4 — market_group_id из того же ответа ESI:
//     1333 — P0, 1334 — P1, 1335 — P2, 1336 — P3, 1337 — P4;
//   - какие планеты какие P0 дают — PLANET_RESOURCES из data.js;
//   - иконки — images.evetech.net/types/<typeID>/icon.
//
// Чего в графе нет и почему. В SDE нет схем 1..64, 93, 101 и 120:
// эти рецепты либо убрали, либо оставили NPC. В графе их нет, и это
// данные SDE, а не пробел страницы. Все 68 схем из planetSchematics
// разобраны, и каждый товар к ним относится: 15 P0, 15 P1, 24 P2,
// 21 P3 и 8 P4 — всего 83.

const PI_PLANET_ICONS = {
    "Barren":  "img/planets/barren.png",
    "Gas":     "img/planets/gas.png",
    "Ice":     "img/planets/ice.png",
    "Lava":    "img/planets/lava.png",
    "Oceanic": "img/planets/oceanic.png",
    "Plasma":  "img/planets/plasma.png",
    "Storm":   "img/planets/storm.png",
    "Temperate": "img/planets/temperate.png"
};

// Имя товара -> [typeID, уровень PI].
const PI_COMMODITIES = {
    // P0 — сырьё, которое добывается прямо на планете
    "Aqueous Liquids":               [2268,  0],
    "Autotrophs":                    [2305,  0],
    "Base Metals":                   [2267,  0],
    "Carbon Compounds":              [2288,  0],
    "Complex Organists":             [2287,  0],
    "Felsic Magma":                  [2307,  0],
    "Heavy Metals":                  [2272,  0],
    "Ionic Solutions":               [2309,  0],
    "Microorganisms":                [2073,  0],
    "Noble Gas":                     [2310,  0],
    "Noble Metals":                  [2270,  0],
    "Non-CS Crystals":               [2306,  0],
    "Planktic Colonies":             [2286,  0],
    "Reactive Gas":                  [2311,  0],
    "Suspended Plasma":              [2308,  0],

    // P1 — переработка P0
    "Bacteria":                      [2393,  1],
    "Biofuels":                      [2396,  1],
    "Biomass":                       [3779,  1],
    "Chiral Structures":             [2401,  1],
    "Electrolytes":                  [2390,  1],
    "Industrial Fibers":             [2397,  1],
    "Oxidizing Compound":            [2392,  1],
    "Oxygen":                        [3683,  1],
    "Plasmoids":                     [2389,  1],
    "Precious Metals":               [2399,  1],
    "Proteins":                      [2395,  1],
    "Reactive Metals":               [2398,  1],
    "Silicon":                       [9828,  1],
    "Toxic Metals":                  [2400,  1],
    "Water":                         [3645,  1],

    // P2 — из двух P1
    "Biocells":                      [2329,  2],
    "Construction Blocks":           [3828,  2],
    "Consumer Electronics":          [9836,  2],
    "Coolant":                       [9832,  2],
    "Enriched Uranium":              [44,    2],
    "Fertilizer":                    [3693,  2],
    "Genetically Enhanced Livestock": [15317, 2],
    "Livestock":                     [3725,  2],
    "Mechanical Parts":              [3689,  2],
    "Microfiber Shielding":          [2327,  2],
    "Miniature Electronics":         [9842,  2],
    "Nanites":                       [2463,  2],
    "Oxides":                        [2317,  2],
    "Polyaramids":                   [2321,  2],
    "Polytextiles":                  [3695,  2],
    "Rocket Fuel":                   [9830,  2],
    "Silicate Glass":                [3697,  2],
    "Superconductors":               [9838,  2],
    "Supertensile Plastics":         [2312,  2],
    "Synthetic Oil":                 [3691,  2],
    "Test Cultures":                 [2319,  2],
    "Transmitter":                   [9840,  2],
    "Viral Agent":                   [3775,  2],
    "Water-Cooled CPU":              [2328,  2],

    // P3 — из изделий P1 и P2
    "Biotech Research Reports":      [2358,  3],
    "Camera Drones":                 [2345,  3],
    "Condensates":                   [2344,  3],
    "Cryoprotectant Solution":       [2367,  3],
    "Data Chips":                    [17392, 3],
    "Gel-Matrix Biopaste":           [2348,  3],
    "Guidance Systems":              [9834,  3],
    "Hazmat Detection Systems":      [2366,  3],
    "Hermetic Membranes":            [2361,  3],
    "High-Tech Transmitters":        [17898, 3],
    "Industrial Explosives":         [2360,  3],
    "Neocoms":                       [2354,  3],
    "Nuclear Reactors":              [2352,  3],
    "Planetary Vehicles":            [9846,  3],
    "Robotics":                      [9848,  3],
    "Smartfab Units":                [2351,  3],
    "Supercomputers":                 [2349,  3],
    "Synthetic Synapses":            [2346,  3],
    "Transcranial Microcontrollers": [12836, 3],
    "Ukomi Superconductors":         [17136, 3],
    "Vaccines":                      [28974, 3],

    // P4 — высший уровень, в игре напрямую не производится
    "Broadcast Node":                [2867,  4],
    "Integrity Response Drones":     [2868,  4],
    "Nano-Factory":                  [2869,  4],
    "Organic Mortar Applicators":    [2870,  4],
    "Recursive Computing Module":    [2871,  4],
    "Self-Harmonizing Power Core":   [2872,  4],
    "Sterile Conduits":              [2875,  4],
    "Wetware Mainframe":             [2876,  4]
};

// Рецепты из planetSchematics.yaml. Количество — на один цикл схемы,
// в игре оно умножается на число фабрик в комплексе.
const PI_RECIPES = [
    // P0 -> P1
    { out: "Water", outQty: 20, in: [["Aqueous Liquids", 3000]], cycle: 1800 },
    { out: "Plasmoids", outQty: 20, in: [["Suspended Plasma", 3000]], cycle: 1800 },
    { out: "Electrolytes", outQty: 20, in: [["Ionic Solutions", 3000]], cycle: 1800 },
    { out: "Oxygen", outQty: 20, in: [["Noble Gas", 3000]], cycle: 1800 },
    { out: "Oxidizing Compound", outQty: 20, in: [["Reactive Gas", 3000]], cycle: 1800 },
    { out: "Reactive Metals", outQty: 20, in: [["Base Metals", 3000]], cycle: 1800 },
    { out: "Precious Metals", outQty: 20, in: [["Noble Metals", 3000]], cycle: 1800 },
    { out: "Toxic Metals", outQty: 20, in: [["Heavy Metals", 3000]], cycle: 1800 },
    { out: "Chiral Structures", outQty: 20, in: [["Non-CS Crystals", 3000]], cycle: 1800 },
    { out: "Silicon", outQty: 20, in: [["Felsic Magma", 3000]], cycle: 1800 },
    { out: "Bacteria", outQty: 20, in: [["Microorganisms", 3000]], cycle: 1800 },
    { out: "Biomass", outQty: 20, in: [["Planktic Colonies", 3000]], cycle: 1800 },
    { out: "Proteins", outQty: 20, in: [["Complex Organists", 3000]], cycle: 1800 },
    { out: "Biofuels", outQty: 20, in: [["Carbon Compounds", 3000]], cycle: 1800 },
    { out: "Industrial Fibers", outQty: 20, in: [["Autotrophs", 3000]], cycle: 1800 },

    // P1 -> P2
    { out: "Superconductors", outQty: 5, in: [["Plasmoids", 40], ["Water", 40]], cycle: 3600 },
    { out: "Coolant", outQty: 5, in: [["Electrolytes", 40], ["Water", 40]], cycle: 3600 },
    { out: "Rocket Fuel", outQty: 5, in: [["Plasmoids", 40], ["Electrolytes", 40]], cycle: 3600 },
    { out: "Synthetic Oil", outQty: 5, in: [["Electrolytes", 40], ["Oxygen", 40]], cycle: 3600 },
    { out: "Oxides", outQty: 5, in: [["Oxidizing Compound", 40], ["Oxygen", 40]], cycle: 3600 },
    { out: "Silicate Glass", outQty: 5, in: [["Oxidizing Compound", 40], ["Silicon", 40]], cycle: 3600 },
    { out: "Transmitter", outQty: 5, in: [["Plasmoids", 40], ["Chiral Structures", 40]], cycle: 3600 },
    { out: "Water-Cooled CPU", outQty: 5, in: [["Reactive Metals", 40], ["Water", 40]], cycle: 3600 },
    { out: "Mechanical Parts", outQty: 5, in: [["Reactive Metals", 40], ["Precious Metals", 40]], cycle: 3600 },
    { out: "Construction Blocks", outQty: 5, in: [["Reactive Metals", 40], ["Toxic Metals", 40]], cycle: 3600 },
    { out: "Enriched Uranium", outQty: 5, in: [["Precious Metals", 40], ["Toxic Metals", 40]], cycle: 3600 },
    { out: "Consumer Electronics", outQty: 5, in: [["Toxic Metals", 40], ["Chiral Structures", 40]], cycle: 3600 },
    { out: "Miniature Electronics", outQty: 5, in: [["Chiral Structures", 40], ["Silicon", 40]], cycle: 3600 },
    { out: "Nanites", outQty: 5, in: [["Bacteria", 40], ["Reactive Metals", 40]], cycle: 3600 },
    { out: "Biocells", outQty: 5, in: [["Biofuels", 40], ["Precious Metals", 40]], cycle: 3600 },
    { out: "Microfiber Shielding", outQty: 5, in: [["Industrial Fibers", 40], ["Silicon", 40]], cycle: 3600 },
    { out: "Viral Agent", outQty: 5, in: [["Bacteria", 40], ["Biomass", 40]], cycle: 3600 },
    { out: "Fertilizer", outQty: 5, in: [["Bacteria", 40], ["Proteins", 40]], cycle: 3600 },
    { out: "Genetically Enhanced Livestock", outQty: 5, in: [["Proteins", 40], ["Biomass", 40]], cycle: 3600 },
    { out: "Livestock", outQty: 5, in: [["Proteins", 40], ["Biofuels", 40]], cycle: 3600 },
    { out: "Polytextiles", outQty: 5, in: [["Biofuels", 40], ["Industrial Fibers", 40]], cycle: 3600 },
    { out: "Test Cultures", outQty: 5, in: [["Bacteria", 40], ["Water", 40]], cycle: 3600 },
    { out: "Supertensile Plastics", outQty: 5, in: [["Oxygen", 40], ["Biomass", 40]], cycle: 3600 },
    { out: "Polyaramids", outQty: 5, in: [["Oxidizing Compound", 40], ["Industrial Fibers", 40]], cycle: 3600 },

    // P2 -> P3
    { out: "Ukomi Superconductors", outQty: 3, in: [["Synthetic Oil", 10], ["Superconductors", 10]], cycle: 3600 },
    { out: "Condensates", outQty: 3, in: [["Oxides", 10], ["Coolant", 10]], cycle: 3600 },
    { out: "Camera Drones", outQty: 3, in: [["Silicate Glass", 10], ["Rocket Fuel", 10]], cycle: 3600 },
    { out: "Synthetic Synapses", outQty: 3, in: [["Supertensile Plastics", 10], ["Test Cultures", 10]], cycle: 3600 },
    { out: "High-Tech Transmitters", outQty: 3, in: [["Polyaramids", 10], ["Transmitter", 10]], cycle: 3600 },
    { out: "Gel-Matrix Biopaste", outQty: 3, in: [["Oxides", 10], ["Biocells", 10], ["Superconductors", 10]], cycle: 3600 },
    { out: "Supercomputers", outQty: 3, in: [["Water-Cooled CPU", 10], ["Coolant", 10], ["Consumer Electronics", 10]], cycle: 3600 },
    { out: "Robotics", outQty: 3, in: [["Mechanical Parts", 10], ["Consumer Electronics", 10]], cycle: 3600 },
    { out: "Smartfab Units", outQty: 3, in: [["Construction Blocks", 10], ["Miniature Electronics", 10]], cycle: 3600 },
    { out: "Nuclear Reactors", outQty: 3, in: [["Enriched Uranium", 10], ["Microfiber Shielding", 10]], cycle: 3600 },
    { out: "Guidance Systems", outQty: 3, in: [["Water-Cooled CPU", 10], ["Transmitter", 10]], cycle: 3600 },
    { out: "Neocoms", outQty: 3, in: [["Biocells", 10], ["Silicate Glass", 10]], cycle: 3600 },
    { out: "Planetary Vehicles", outQty: 3, in: [["Supertensile Plastics", 10], ["Mechanical Parts", 10], ["Miniature Electronics", 10]], cycle: 3600 },
    { out: "Biotech Research Reports", outQty: 3, in: [["Nanites", 10], ["Livestock", 10], ["Construction Blocks", 10]], cycle: 3600 },
    { out: "Vaccines", outQty: 3, in: [["Livestock", 10], ["Viral Agent", 10]], cycle: 3600 },
    { out: "Industrial Explosives", outQty: 3, in: [["Fertilizer", 10], ["Polytextiles", 10]], cycle: 3600 },
    { out: "Hermetic Membranes", outQty: 3, in: [["Polyaramids", 10], ["Genetically Enhanced Livestock", 10]], cycle: 3600 },
    { out: "Transcranial Microcontrollers", outQty: 3, in: [["Biocells", 10], ["Nanites", 10]], cycle: 3600 },
    { out: "Data Chips", outQty: 3, in: [["Supertensile Plastics", 10], ["Microfiber Shielding", 10]], cycle: 3600 },
    { out: "Hazmat Detection Systems", outQty: 3, in: [["Polytextiles", 10], ["Viral Agent", 10], ["Transmitter", 10]], cycle: 3600 },
    { out: "Cryoprotectant Solution", outQty: 3, in: [["Test Cultures", 10], ["Synthetic Oil", 10], ["Fertilizer", 10]], cycle: 3600 },

    // P3 -> P4
    { out: "Organic Mortar Applicators", outQty: 1, in: [["Condensates", 6], ["Bacteria", 40], ["Robotics", 6]], cycle: 3600 },
    { out: "Sterile Conduits", outQty: 1, in: [["Smartfab Units", 6], ["Water", 40], ["Vaccines", 6]], cycle: 3600 },
    { out: "Nano-Factory", outQty: 1, in: [["Industrial Explosives", 6], ["Reactive Metals", 40], ["Ukomi Superconductors", 6]], cycle: 3600 },
    { out: "Self-Harmonizing Power Core", outQty: 1, in: [["Camera Drones", 6], ["Nuclear Reactors", 6], ["Hermetic Membranes", 6]], cycle: 3600 },
    { out: "Recursive Computing Module", outQty: 1, in: [["Synthetic Synapses", 6], ["Guidance Systems", 6], ["Transcranial Microcontrollers", 6]], cycle: 3600 },
    { out: "Broadcast Node", outQty: 1, in: [["Neocoms", 6], ["Data Chips", 6], ["High-Tech Transmitters", 6]], cycle: 3600 },
    { out: "Integrity Response Drones", outQty: 1, in: [["Gel-Matrix Biopaste", 6], ["Hazmat Detection Systems", 6], ["Planetary Vehicles", 6]], cycle: 3600 },
    { out: "Wetware Mainframe", outQty: 1, in: [["Supercomputers", 6], ["Biotech Research Reports", 6], ["Cryoprotectant Solution", 6]], cycle: 3600 }
];

/* Главные торговые хабы: по какому рынку считается цена всех товаров
   P0..P4. Выпадающее меню вверху вкладки переключает хаб, и цены
   перечитываются — см. js/prices.js.

   Имена хабов и пары «регион + система» подтверждены ESI 07.10.2026:
   /v1/universe/ids/, затем /v2/universe/systems/<id>/ ->
   /v2/universe/constellations/<id>/ -> /v2/universe/regions/<id>/
   (у системы region_id в ответе нет, только constellation_id).
   Rens стоит в Heimatar, а не в Metropolis — память врёт, поэтому
   здесь цепочка запросов, а не суффикс.

   Строка под ценой заведена сразу у всех 83 товаров, поэтому колонки
   остаются ровными: появись она у части плиток, высота колонок
   разъехалась бы. */
const PI_PRICE_HUBS = [
    { name: 'Amarr', regionId: 10000043, regionName: 'Domain', systemId: 30002187, systemName: 'Amarr' },
    { name: 'Dodixie', regionId: 10000032, regionName: 'Sinq Laison', systemId: 30002659, systemName: 'Dodixie' },
    { name: 'Jita', regionId: 10000002, regionName: 'The Forge', systemId: 30000142, systemName: 'Jita' },
    { name: 'Rens', regionId: 10000030, regionName: 'Heimatar', systemId: 30002510, systemName: 'Rens' }
];

/* С чего начинаем: Jita — на нём и построена формула из шапки
   js/prices.js. Ранее выбранный хаб запоминается на этом же
   компьютере: там только название, а не что-нибудь секретное. */
const PI_PRICE_DEFAULT = 'Jita';
const PI_HUB_STORAGE = 'eve-pi-hub';

/* Подпись под названием колонки: коротко о роли уровня. */
const PI_LEVEL_TITLES = [
    "Тип",
    "Сырьё с планеты",
    "Основной",
    "Улучшенный",
    "Специализированный",
    "Передовой"
];

/* Объём единицы товара по уровням, м³ (индекс = уровень P0..P4).
   Проверено по ESI /v2/universe/types/<id>/ 07.10.2026 по всем 83
   товарам: внутри уровня объём у всех один — P0 15 из 15 = 0.005,
   P1 15 из 15 = 0.19, P2 24 из 24 = 0.75, P3 21 из 21 = 3,
   P4 8 из 8 = 50. У планеты товара нет, поэтому и объёма нет.

   Цифры в подписи идут точь-в-точь как приходят из SDE (0.005 с
   точкой), а посчитанный объём — русской запятой (6,08), как и
   остальные числа на схеме. */
const PI_VOLUME_BY_LEVEL = [0.005, 0.19, 0.75, 3, 50];

/* ---------- Индексы: строятся один раз ---------- */
// Колонка P0 идёт по кодам символов без учёта регистра (как и
// остальные списки на странице, а не по алфавиту кириллицы).
// Порядок P1 и колонок P2..P4 строится по цепочкам ниже.

const piCompare = (a, b) => {
    const x = a.toUpperCase();
    const y = b.toUpperCase();
    return x < y ? -1 : (x > y ? 1 : 0);
};

const PI_PLANET_NAMES = Object.keys(PLANET_RESOURCES).sort(piCompare);
const PI_BY_LEVEL = [[], [], [], [], []];

Object.keys(PI_COMMODITIES).sort(piCompare).forEach((name) => {
    PI_BY_LEVEL[PI_COMMODITIES[name][1]].push(name);
});

// Рецепт, в который товар входит как вход, и наоборот
const PI_USES_OF = new Map();
const PI_RECIPE_OF = new Map();
// Тип планеты -> список её P0, и обратный индекс P0 -> планеты
const PI_GIVES_OF = new Map();
const PI_PLANETS_OF = new Map();

PI_PLANET_NAMES.forEach((planet) => {
    const p0 = Array.from(new Set((PLANET_RESOURCES[planet] || []).map((r) => r.P0))).sort(piCompare);
    PI_GIVES_OF.set(planet, p0);
    p0.forEach((name) => {
        if (!PI_PLANETS_OF.has(name)) PI_PLANETS_OF.set(name, []);
        PI_PLANETS_OF.get(name).push(planet);
    });
});

PI_RECIPES.forEach((recipe) => {
    PI_RECIPE_OF.set(recipe.out, recipe);
    recipe.in.forEach(([ingredient]) => {
        if (!PI_USES_OF.has(ingredient)) PI_USES_OF.set(ingredient, []);
        PI_USES_OF.get(ingredient).push(recipe);
    });
});

// Рёбра графа: планета -> P0 и вход -> изделие по каждому рецепту
const PI_EDGES = [];
PI_PLANET_NAMES.forEach((planet) => {
    (PI_GIVES_OF.get(planet) || []).forEach((p0) => PI_EDGES.push({ from: planet, to: p0 }));
});
PI_RECIPES.forEach((recipe) => {
    recipe.in.forEach(([ingredient]) => PI_EDGES.push({ from: ingredient, to: recipe.out }));
});

// Порядок раскладки потребности: от P4 к P0. Нужен, чтобы посчитать,
// сколько сырья уходит на изделие, одним проходом по товарам.
const PI_AMOUNT_ORDER = Object.keys(PI_COMMODITIES)
    .sort((a, b) => PI_COMMODITIES[b][1] - PI_COMMODITIES[a][1]);

// Порядок товаров в колонках схемы: цепочки читаются по горизонтали.
// P1 ставим напротив своего P0 — у каждого P1 ровно один вход-P0, и
// схем P0->P1 столько же, сколько товаров в обеих колонках, так что
// пара встаёт на общую строку, а линия между ними короткая.
// Колонки P2..P4 сортируем по входам в колонке левее: изделие встаёт
// на строку своего самого «верхнего» входа, а при равных ключах — по
// остальным входам и дальше по алфавиту. Связанные товары оказываются
// на общей горизонтальной линии, и цепочку читаешь слева направо.
// Рецепты P4 берут ещё и P1 напрямую (40 шт.) — эти P1 в ключ не идут,
// цепочка на линии отвечает главному входу-изделию.
const PI_LEVEL_ORDER = PI_BY_LEVEL.map((list) => list.slice());

const p1OfP0 = new Map();
PI_RECIPES.forEach((recipe) => {
    if (recipe.in.length !== 1) return;
    if (PI_COMMODITIES[recipe.out] && PI_COMMODITIES[recipe.out][1] === 1) {
        p1OfP0.set(recipe.in[0][0], recipe.out);
    }
});
const p1Order = [];
PI_LEVEL_ORDER[0].forEach((p0) => {
    const p1 = p1OfP0.get(p0);
    if (p1 && p1Order.indexOf(p1) < 0) p1Order.push(p1);
});
PI_LEVEL_ORDER[1].forEach((name) => {
    if (p1Order.indexOf(name) < 0) p1Order.push(name);
});
// Если пара собралась не один-к-одному, строки P0 и P1 разъедутся —
// тогда оставляем обе колонки по алфавиту.
if (p1Order.length === PI_LEVEL_ORDER[1].length) PI_LEVEL_ORDER[1] = p1Order;

const positionsOf = (list) => {
    const pos = new Map();
    list.forEach((name, index) => pos.set(name, index));
    return pos;
};

// Ключ сортировки изделия: индексы его входов в колонке слева, по
// возрастанию. Сравниваем лексикографически: при равном самом верхнем
// входе смотрим следующий, и так до последнего.
const chainKey = (recipe, pos) => recipe.in
    .map(([ingredient]) => pos.get(ingredient))
    .filter((index) => index !== undefined)
    .sort((a, b) => a - b);

[2, 3, 4].forEach((level) => {
    const prevPos = positionsOf(PI_LEVEL_ORDER[level - 1]);
    PI_LEVEL_ORDER[level] = PI_LEVEL_ORDER[level].slice().sort((a, b) => {
        const ka = chainKey(PI_RECIPE_OF.get(a), prevPos);
        const kb = chainKey(PI_RECIPE_OF.get(b), prevPos);
        const count = Math.min(ka.length, kb.length);
        for (let i = 0; i < count; i += 1) {
            if (ka[i] !== kb[i]) return ka[i] - kb[i];
        }
        return ka.length - kb.length;
    });
});

/* ---------- Отрисовка схемы ---------- */

const chainBox = document.getElementById('chain-builder');

if (chainBox) {
    const piThousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    // Количество на схеме: 96 000 целиком, 3.33 с двумя знаками.
    const piAmount = (value) => piThousands(String(Math.round(value * 100) / 100));
    /* То же число, но с русской запятой: 6.08 -> «6,08», 1.5 -> «1,5»,
       3 -> «3». Разряды в piAmount — неразрывные пробелы, поэтому
       точка в числе одна и заменяется целиком. */
    const piRuNumber = (value) => piAmount(value).replace('.', ',');
    /* Подпись считаемого объёма в шапке колонки. Сюда приходит уже
       умноженный на объём единицы: 6,08 — это (16 + 16) × 0.19. */
    const piVolumeLine = (value) => 'Расчетный объем: ' + piRuNumber(value) + ' м³';
    /* Совсем длинное число в плитку не помещается: 1 199 998 800 ->
       «≈1,2 млрд». Знак «≈» честно говорит, что значение округлено. */
    const piCompact = (value) => {
        const units = [[1e12, 'трлн'], [1e9, 'млрд'], [1e6, 'млн'], [1e3, 'тыс.']];
        const found = units.find(([size]) => Math.abs(value) >= size);
        if (!found) return piThousands(String(Math.round(value * 100) / 100));
        const scaled = value / found[0];
        const text = scaled < 10 ? scaled.toFixed(1) : String(Math.round(scaled));
        return text.replace('.', ',') + ' ' + found[1];
    };
    /* P3 делается по три (рецепт P2 -> P3 выдаёт 3 штуки за цикл), поэтому
       в поле P3 попадает только кратное трём. Введённое округляем до
       ближайшего: 2 -> 3, 13 -> 12. Ноль не подходит — он означал бы
       «не нужно», поэтому наименьшая осмысленная порция здесь 3. */
    const piSnapStep3 = (raw) => {
        if (raw === '') return '';
        const value = Math.round(Number(raw));
        if (!isFinite(value) || value <= 0) return raw;
        const rest = value % 3;
        const snapped = value - rest + (rest > 1 ? 3 : 0);
        return String(Math.max(3, snapped));
    };

    // Что выделено: закреплённый выбор и подсветка под курсором.
    // Курсор важнее — он снимается первым, закреплённый остаётся.
    let piLocked = null;
    let piHovered = null;

    const svgNS = 'http://www.w3.org/2000/svg';

    const scroll = document.createElement('div');
    scroll.className = 'chain-scroll';

    const map = document.createElement('div');
    map.className = 'chain-map';

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'chain-lines');
    svg.setAttribute('aria-hidden', 'true');
    map.append(svg);

    // Что человек ввёл сам: имя товара -> сколько нужно от него.
    const piWanted = new Map();
    // Итог по каждому товару: свой ввод плюс всё, что нужно для ввода
    // ниже по цепочке.
    const piTotals = new Map();
    const piTotalNodes = new Map();
    // Узлы строки цены: имя товара -> элемент под плиткой.
    const piPriceNodes = new Map();
    // Считаемый объём колонки: уровень -> элемент в подписи колонки.
    const piVolumeNodes = new Map();

    // Подсказка на плитке: она же возвращается в title после копии.
    const PI_COPY_HINT = 'Клик — скопировать ячейку';

    const makeItem = (name, level, icon) => {
        const item = document.createElement('div');
        item.className = 'chain-item';
        item.dataset.name = name;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chain-chip' + (level < 0 ? ' is-planet' : '');
        chip.dataset.name = name;
        chip.dataset.level = String(level);
        // Клик по плитке копирует её в буфер (см. piCopyCell), и без
        // подсказки об этом никто не догадается: курсор copy у плитки
        // обещает действие, а title объясняет какое.
        chip.title = PI_COPY_HINT;
        if (icon) {
            const img = document.createElement('img');
            img.src = icon;
            img.alt = '';
            img.loading = 'lazy';
            // Иконки одинаковые (26px), чтобы плитки всех колонок были
            // одной высоты и строки выстраивались по горизонтали.
            img.width = 26;
            img.height = 26;
            img.addEventListener('error', () => img.remove());
            chip.append(img);
        }
        const label = document.createElement('span');
        label.textContent = name;
        chip.append(label);

        // Итог расчёта — в правой части плитки, у самого названия.
        // У типа планеты итога нет: планета — источник P0, а не изделие.
        if (level >= 0) {
            const total = document.createElement('span');
            total.className = 'chain-total';
            total.dataset.name = name;
            piTotalNodes.set(name, total);
            chip.append(total);

            // Цена — второй строкой плитки, под названием. Строка
            // заведена у всех товаров сразу и ждёт своего значения:
            // появись она у части плиток, колонки поехали бы разной
            // высоты. У типа планеты цены нет — планету не продают.
            // data-name нужен, чтобы получить товар обратно из узла:
            // цену пишет js/prices.js и приходит ею же — по узлу.
            const price = document.createElement('span');
            price.className = 'chain-price';
            price.dataset.name = name;
            piPriceNodes.set(name, price);
            chip.append(price);
        }
        item.append(chip);

        // Поле ручного ввода — у товаров от P1 и выше. У P0 нет: это
        // сырьё, его количество не вводят, а считают по цепочке вниз
        // от того, что введено в P1..P4.
        if (level >= 1) {
            const entry = document.createElement('input');
            entry.type = 'number';
            entry.className = 'chain-amount';
            entry.min = '0';
            // У P3 товар делается по три: рецепт P2 -> P3 выдаёт 3 штуки
            // за цикл, поэтому итог по P3 всегда кратен трём. В поле P3
            // шаг 3, и введённое округляется до ближайшего кратного.
            entry.step = level === 3 ? '3' : '1';
            entry.size = '6';
            entry.inputMode = 'numeric';
            entry.placeholder = '0';
            entry.setAttribute('aria-label', 'Сколько нужно: ' + name);
            if (level === 3) entry.title = 'Кратно 3: введённое округляется';

            const apply = () => {
                const value = Number(entry.value);
                if (entry.value === '' || !isFinite(value) || value <= 0) piWanted.delete(name);
                else piWanted.set(name, value);
                piRecalcAmounts();
                // Ширины колонок здесь не пересчитываем: место под итог
                // в плитке зарезервировано (см. .chain-total), поэтому
                // ни число, ни ввод не меняют вёрстку. Раньше стоял
                // вызов relayout() — из-за него при расчёте колонки
                // разъезжались вбок.
            };

            entry.addEventListener('input', apply);

            // Округляем не на каждый символ, а когда число дописано: по
            // Enter или когда курсор ушёл из поля. Пока человек набирает,
            // поле показывает ровно то, что он ввёл.
            //
            // Событие change для этого не годится: браузер присылает его
            // не на каждую правку (в частности, не после правки кодом), и
            // при уходе со вкладки с недописанным числом поле осталось бы
            // некратным. Слушаем blur — он приходит всегда, — а Enter
            // обрабатываем сразу, не дожидаясь ухода курсора.
            const snap = () => {
                if (level === 3) entry.value = piSnapStep3(entry.value);
                apply();
            };
            entry.addEventListener('blur', snap);
            entry.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') snap();
            });
            item.append(entry);
        }
        return item;
    };

    // Сколько чего нужно набрать. Раскладываем вверх по цепочке, от P4
    // к P0: рецепты в SDE берут сырьё уровнем ниже изделия, поэтому
    // одного прохода достаточно — к моменту, когда мы дойдём до
    // уровня, сумма по нему уже собрана. Все рецепты линейны
    // («20 P1 из 3000 P0»), так что количества просто умножаются.
    function piRecalcAmounts() {
        piTotals.clear();
        piWanted.forEach((amount, name) => piTotals.set(name, amount));
        PI_AMOUNT_ORDER.forEach((name) => {
            const amount = piTotals.get(name);
            const recipe = PI_RECIPE_OF.get(name);
            if (!amount || !recipe) return;
            const cycles = amount / recipe.outQty;
            recipe.in.forEach(([ingredient, qty]) => {
                piTotals.set(ingredient, (piTotals.get(ingredient) || 0) + cycles * qty);
            });
        });
        // Сначала подписи у всех итогов, потом замеры и ужимание шрифта.
        // Если в одном цикле читать scrollWidth и тут же менять font-size,
        // браузер пересчитывает вёрстку на каждом шагу.
        const shown = [];
        piTotalNodes.forEach((node, name) => {
            const value = piTotals.get(name) || 0;
            node.textContent = value > 0 ? piAmount(value) : '';
            node.classList.toggle('is-set', value > 0);
            node.style.fontSize = '';
            if (value > 0) shown.push({ node, value });
        });
        piFitTotals(shown);

        // Объём колонки: сумма «сколько нужно × объём единицы» по всем
        // товарам уровня. Считаем по каждому товару, а не умножая сумму
        // на общий объём уровня: так формула переживёт разный объём
        // внутри колонки. Сырьё P0 тоже входит — его количество
        // посчитано той же проходкой, что и остальное.
        const volumes = [0, 0, 0, 0, 0];
        piTotals.forEach((value, name) => {
            const info = PI_COMMODITIES[name];
            if (!info || !(value > 0)) return;
            volumes[info[1]] += value * PI_VOLUME_BY_LEVEL[info[1]];
        });
        piVolumeNodes.forEach((node, level) => {
            node.textContent = piVolumeLine(volumes[level]);
        });

        // Цена и сумма под названием: количество изменилось — сумма
        // (цена × количество) изменилась вместе с ним.
        piPriceNodes.forEach((node) => piRenderPrice(node));
    }

    /* Число длиннее отведённого места не обрезаем, а ужимаем: место под
       итог фиксировано, и менять его нельзя — иначе поедут колонки.
       Исходный кегль запоминаем один раз, чтобы не мерить его заново.

       Если даже мелкий шрифт не выручает (число из десятков цифр),
       показываем округлённое значение со знаком «≈»: иначе последние
       цифры просто не поместились бы и число читалось бы неверно. */
    let totalFontPx = 0;
    function piFitTotals(items) {
        if (!items.length) return;
        if (!totalFontPx) {
            totalFontPx = parseFloat(getComputedStyle(items[0].node).fontSize) || 11;
        }
        items.forEach(({ node, value }) => {
            const room = node.clientWidth;
            if (!room) return;
            // Шаг 0.5px и порог снизу 7px: мельче уже не прочесть.
            let size = totalFontPx;
            while (node.scrollWidth > room && size > 7) {
                size -= 0.5;
                node.style.fontSize = size + 'px';
            }
            if (node.scrollWidth > room) {
                node.textContent = '\u2248' + piCompact(value);
                node.style.fontSize = '';
            }
        });
    }

    /* Цена и сумма «цена × расчётное количество» стоят в одной строке
       с фиксированной шириной (см. .chain-price в css), и вместе они
       длиннее каждой по отдельности. Обрезать сумму многоточием нельзя:
       обрезанные деньги читаются как другие деньги. Поэтому сначала
       ужимаем кегль строки тем же способом, что и итоги, а если и это
       не выручает — показываем сумму округлённой, «≈1,2 млрд ISK»:
       примерное число со знаком лучше точного, но обрубленного.
       Исходный кегль запоминаем один раз — как у итогов. Возвращает,
       влезла ли строка. */
    let priceFontPx = 0;
    function piFitPrice(node) {
        node.style.fontSize = '';
        if (!priceFontPx) {
            priceFontPx = parseFloat(getComputedStyle(node).fontSize) || 10.5;
        }
        const room = node.clientWidth;
        if (!room) return true;
        // Шаг 0.5px, потолок снизу — 7px: вычитываем, только если после
        // вычитания останется не меньше семи, иначе последний шаг
        // увёл бы кегль ниже того, что ещё читается.
        let size = priceFontPx;
        while (node.scrollWidth > room && size - 0.5 >= 7) {
            size -= 0.5;
            node.style.fontSize = size + 'px';
        }
        return node.scrollWidth <= room;
    }

    /* Вторая половина строки цены: во сколько обойдётся расчётное
       количество этого товара — цена ESI × итог по плитке.

       Вызывается с двух сторон: приход цены (js/prices.js зовёт колбэк
       watch, узел в это время уже показывает свежую цену) и каждый
       ввод (из piRecalcAmounts, где меняется количество). Поэтому
       рисуем обе половины строки здесь, а не в двух местах.

       Суммы не бывает без цены или без количества: прочерк честнее
       нуля, который прочитали бы как «стоит ничего». */
    function piRenderPrice(node) {
        if (!node) return;
        const price = Number(node.dataset.isk);
        const qty = piTotals.get(node.dataset.name) || 0;
        const product = price > 0 && qty > 0 ? price * qty : 0;
        const sum = () => node.querySelector('.chain-price-sum');
        if (!product) {
            const old = sum();
            if (old) {
                old.remove();
                node.style.fontSize = '';
            }
            return;
        }
        const full = ' · ' + EVE_PRICES.formatIsk(product) + ' ISK';
        // Ничего не поменялось — строку и ужимание не трогаем:
        // лишний замер гоняет вёрстку, а перерисовка сбила бы кегль.
        if (sum() && sum().dataset.full === full) return;
        let sumNode = sum();
        if (!sumNode) {
            sumNode = document.createElement('span');
            sumNode.className = 'chain-price-sum';
            node.append(sumNode);
        }
        sumNode.dataset.full = full;
        // Подсказка прямо раскладывает строку на пример: цену видно
        // рядом, количество — в плитке, значит, проверить можно глазами.
        sumNode.title = `${EVE_PRICES.formatIsk(price)} ISK × ${piAmount(qty)} = `
            + `${EVE_PRICES.formatIsk(product)} ISK`;
        sumNode.textContent = full;
        if (!piFitPrice(node)) {
            sumNode.textContent = ' · ≈' + piCompact(product) + ' ISK';
            sumNode.dataset.full = sumNode.textContent;
            piFitPrice(node);
        }
    }

    const columns = [[PI_PLANET_NAMES, -1]].concat(PI_LEVEL_ORDER.map((list, level) => [list, level]));
    columns.forEach(([names, level], columnIndex) => {
        const col = document.createElement('div');
        // Колонки, где товаров меньше, чем в самой высокой (P2 — 24 шт.),
        // растягиваются на всю высоту схемы, а их блок центрируется по
        // вертикали (см. .chain-col-stretch-list). P2 уже занимает всю
        // высоту, ему растяжка не нужна.
        const stretch = level !== 2;
        col.className = 'chain-col' + (stretch ? ' chain-col-stretch' : '');
        col.dataset.column = String(columnIndex);
        const title = document.createElement('h3');
        title.textContent = level < 0 ? 'Планета' : 'P' + level;
        col.append(title);
        const note = document.createElement('p');
        note.className = 'chain-col-note';
        // Колонка с товаром: к подписи уровня прибавляется объём единицы —
        // он и берётся в расчёт объёма ниже. У планеты уровня и объёма нет.
        note.append(PI_LEVEL_TITLES[columnIndex] + (level >= 0
            ? ', V = ' + PI_VOLUME_BY_LEVEL[level] + ' м³'
            : ''));
        // Второй строкой — считаемый объём по колонке: сумма
        // «количество × объём единицы» по всем товарам уровня.
        if (level >= 0) {
            const volume = document.createElement('span');
            volume.className = 'chain-col-volume';
            volume.textContent = piVolumeLine(0);
            piVolumeNodes.set(level, volume);
            note.append(volume);
        }
        col.append(note);
        // Плитки кладём в отдельный контейнер: он заполняет оставшуюся
        // высоту колонки, и блок встаёт ровно по середине схемы, а шапка
        // остаётся на месте.
        const list = stretch ? document.createElement('div') : null;
        if (list) list.className = 'chain-col-stretch-list';
        names.forEach((name) => {
            const icon = level < 0 ? PI_PLANET_ICONS[name] : (RESOURCE_ICONS[name] || '');
            (list || col).append(makeItem(name, level, icon));
        });
        if (list) col.append(list);
        map.append(col);
    });

    scroll.append(map);

    /* Верхняя панель вкладки: выбор торгового хаба. Он меняет только
       цену в плитках — схема, рецепты и ввод остаются прежними. */
    let savedHub = '';
    try {
        savedHub = localStorage.getItem(PI_HUB_STORAGE) || '';
    } catch (error) {
        // Приватный режим localStorage закрывает: обойдёмся без
        // запоминания, на самих ценах это не сказывается.
    }
    const selectedHub = PI_PRICE_HUBS.find((hub) => hub.name === savedHub)
        || PI_PRICE_HUBS.find((hub) => hub.name === PI_PRICE_DEFAULT)
        || PI_PRICE_HUBS[0];

    const bar = document.createElement('div');
    bar.className = 'chain-bar';

    const hubLabel = document.createElement('label');
    hubLabel.className = 'chain-bar-label';
    hubLabel.htmlFor = 'chain-hub';
    hubLabel.textContent = 'Торговый хаб';

    const hubSelect = document.createElement('select');
    hubSelect.className = 'chain-bar-hub';
    hubSelect.id = 'chain-hub';
    PI_PRICE_HUBS.forEach((hub) => {
        const option = document.createElement('option');
        option.value = hub.name;
        option.textContent = hub.name;
        option.selected = hub === selectedHub;
        hubSelect.append(option);
    });

    const hubHint = document.createElement('span');
    hubHint.className = 'chain-bar-hint';
    hubHint.textContent = 'Цена в плитках — по заявкам выбранного хаба';

    bar.append(hubLabel, hubSelect, hubHint);
    chainBox.replaceChildren(bar, scroll);

    // Живая цена всех товаров P0..P4. Значения приходят один раз за заход
    // страницы и сами не обновляются: чтобы увидеть свежие, страницу
    // надо перезагрузить или переключить хаб (см. js/prices.js).
    // typeID берём из PI_COMMODITIES, чтобы он не дублировался здесь.
    // typeof, а не обращение к переменной: js/prices.js подключается
    // отдельным файлом и теоретически может не загрузиться.
    if (typeof EVE_PRICES !== 'undefined') {
        const watched = [];
        piPriceNodes.forEach((node, name) => {
            const typeId = (PI_COMMODITIES[name] || [])[0];
            if (!typeId) return;
            watched.push({ node, typeId });
        });
        // Колбэк — сумма под названием: цена ESI × расчётное количество.
        // Он же ужимает строку, если цена и сумма вместе не влезли.
        const prices = EVE_PRICES.watch(watched, selectedHub, piRenderPrice);

        hubSelect.addEventListener('change', () => {
            const hub = PI_PRICE_HUBS.find((item) => item.name === hubSelect.value);
            if (!hub) return;
            prices.setMarket(hub);
            try {
                localStorage.setItem(PI_HUB_STORAGE, hub.name);
            } catch (error) {
                // Запомнить не удалось — цены уже перечитаны, обойдёмся.
            }
        });
    } else {
        // Без js/prices.js меню ничего не поменяет: честно выключаем,
        // чтобы пустое обещание не висело над схемой.
        hubSelect.disabled = true;
        hubHint.textContent = 'Цены недоступны: js/prices.js не загрузился';
    }

    // Рёбра рисуем один раз, дальше только меняем координаты и класс
    const lines = PI_EDGES.map((edge) => {
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('class', 'chain-line');
        svg.append(path);
        return { from: edge.from, to: edge.to, el: path };
    });

    // Ширина колонки — по самой широкой строке «плитка + поле ввода»,
    // причём плитка на P0 остаётся одна (у P0 поля нет, итог внутри
    // плитки). Строку меряем в max-content целиком, а не по частям: так
    // замер совпадает с тем, что нужно браузеру, и подпись не
    // переносится на вторую строку (а перенос строки сдвигал бы строки
    // P0 и P1 по высоте, и пара перестала бы стоять напротив).
    // Растягивать колонки нельзя: плитки уйдут в соседние и линии связи
    // превратятся в короткие обрубки. Остаток ширины уходит в
    // промежутки между колонками (space-between в css).
    const ITEM_COL_MAX = 340;

    function fitColumns() {
        const items = [...map.querySelectorAll('.chain-item')];
        // Пока вкладка скрыта, размеры нулевые: трогать ширины нельзя,
        // иначе после открытия колонки останутся пустыми.
        if (!items.length || !map.getBoundingClientRect().width) return;

        // Сначала всем строкам временная ширина, потом замеры: так
        // браузер пересчитывает вёрстку один раз, а не на каждой строке.
        items.forEach((item) => { item.style.width = 'max-content'; });
        const widthOf = new Map();
        items.forEach((item) => {
            widthOf.set(item, Math.ceil(item.getBoundingClientRect().width));
        });
        items.forEach((item) => { item.style.width = ''; });

        map.querySelectorAll('.chain-col').forEach((col) => {
            let wide = 0;
            col.querySelectorAll('.chain-item').forEach((item) => {
                wide = Math.max(wide, widthOf.get(item) || 0);
            });
            // +2 px запаса на дробные пиксели.
            col.style.width = Math.min(wide + 2, ITEM_COL_MAX) + 'px';
        });

        // Промежуток между P0 и P1 делаем равным обычному gap колонок,
        // а не большому: эти колонки связаны напрямую (3000 P0 -> 20 P1),
        // и пара «P0 из P1» читается сразу. space-between делит свободное
        // место поровну, поэтому сдвигаем P1 отрицательным полем ровно
        // настолько, чтобы между P0 и P1 остался базовый gap, а всё
        // остальное ушло в другие промежутки.
        const cols = [...map.querySelectorAll('.chain-col')];
        cols.forEach((col) => { col.style.marginLeft = ''; });
        const mapGap = parseFloat(getComputedStyle(map).columnGap) || 0;
        const mapWidth = map.getBoundingClientRect().width;
        const sum = cols.reduce((acc, col) => acc + col.getBoundingClientRect().width, 0);
        const pull = (mapWidth - sum - mapGap * 5) / 4;
        if (cols[2] && pull > 0) cols[2].style.marginLeft = '-' + Math.round(pull) + 'px';
    }

    // Ширина колонок зависит от шрифта и размера окна, поэтому
    // пересчитываем их вместе с линиями.
    const relayout = () => {
        fitColumns();
        drawLines();
    };

    function drawLines() {
        // Пока вкладка скрыта, прямоугольники пустые и рисовать нечего
        const box = map.getBoundingClientRect();
        if (!box.width || !box.height) return;

        const at = new Map();
        map.querySelectorAll('.chain-chip').forEach((chip) => {
            const r = chip.getBoundingClientRect();
            at.set(chip.dataset.name, {
                left: r.left - box.left,
                right: r.right - box.left,
                mid: r.top - box.top + r.height / 2
            });
        });

        for (const line of lines) {
            const from = at.get(line.from);
            const to = at.get(line.to);
            if (!from || !to) {
                line.el.setAttribute('d', '');
                continue;
            }
            const bend = Math.max(16, (to.left - from.right) * 0.45);
            line.el.setAttribute('d',
                'M' + from.right.toFixed(1) + ' ' + from.mid.toFixed(1) +
                ' C' + (from.right + bend).toFixed(1) + ' ' + from.mid.toFixed(1) +
                ' ' + (to.left - bend).toFixed(1) + ' ' + to.mid.toFixed(1) +
                ' ' + to.left.toFixed(1) + ' ' + to.mid.toFixed(1));
        }
    }

    // Что получается из товара. У планеты это её P0, у товара — изделия
    // из рецептов, где он стоит входом. Количество есть не всегда:
    // планета отдаёт ресурсы без него.
    const piOutputsOf = (name) => {
        if (PI_GIVES_OF.has(name)) {
            return (PI_GIVES_OF.get(name) || []).map((p0) => ({ name: p0, qty: null }));
        }
        return (PI_USES_OF.get(name) || []).map((recipe) => ({ name: recipe.out, qty: recipe.outQty }));
    };

    // Товар и всё, что связано с ним: выше по цепочке, ниже и планеты,
    // на которых он добывается. Сверху и снизу обход идёт по одному
    // общему множеству, иначе один и тот же товар посчитался бы дважды.
    function relatedSet(name) {
        const lit = new Set([name]);

        const down = [name];
        while (down.length) {
            for (const target of piOutputsOf(down.pop())) {
                if (lit.has(target.name)) continue;
                lit.add(target.name);
                down.push(target.name);
            }
        }

        const up = [name];
        while (up.length) {
            const current = up.pop();
            const recipe = PI_RECIPE_OF.get(current);
            if (!recipe) {
                (PI_PLANETS_OF.get(current) || []).forEach((planet) => lit.add(planet));
                continue;
            }
            for (const [ingredient] of recipe.in) {
                if (lit.has(ingredient)) continue;
                lit.add(ingredient);
                up.push(ingredient);
            }
        }

        return lit;
    }

    function refresh() {
        const name = piHovered || piLocked;
        const chips = map.querySelectorAll('.chain-chip');
        map.classList.toggle('has-focus', Boolean(name));

        if (!name) {
            chips.forEach((chip) => chip.classList.remove('is-lit', 'is-focus'));
            lines.forEach((line) => line.el.classList.remove('is-lit'));
            return;
        }

        const lit = relatedSet(name);
        chips.forEach((chip) => {
            const chipName = chip.dataset.name;
            chip.classList.toggle('is-focus', chipName === name);
            chip.classList.toggle('is-lit', chipName !== name && lit.has(chipName));
        });
        lines.forEach((line) => {
            line.el.classList.toggle('is-lit', lit.has(line.from) && lit.has(line.to));
        });
    }

    // Подсветка от курсора и от клавиатуры. События на карте, а не на
    // каждой кнопке: слушателей иначе было бы почти две сотни.
    // Ищем строку товара, а не кнопку: наведение на поле ввода тоже
    // должно подсвечивать цепочку этого товара.
    const piNameAt = (target) => {
        const item = target.closest('.chain-item');
        return item ? item.dataset.name : null;
    };

    // ---------- Копирование ячейки ----------

    // Текст для буфера — только имя ячейки. Цены, количества, объёмы
    // и уровень в копии не нужны (так просили): лишние цифры мешали и
    // в сообщении, и в таблице, куда вставляли ячейку.
    const piCellText = (name) => name;

    // Буфер обмена. navigator.clipboard живёт только в безопасном
    // контексте (https или localhost), а страницу открывают и по
    // обычному http, и с файла, — там остаётся старый путь через
    // временный textarea и execCommand. Без него копия молча
    // не сработала бы, и человек решил бы, что кнопка не работает.
    const piCopyToClipboard = async (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                // Браузер отказал (нет разрешения) — идём старым путём.
            }
        }
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '0';
        area.style.left = '0';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (error) {
            copied = false;
        }
        area.remove();
        return copied;
    };

    // Таймер вспышки у каждой плитки свой: общего хватило бы только для
    // одного клика подряд, а кликают всегда по разным ячейкам.
    const piCopyTimers = new WeakMap();
    const piCopyCell = (name, chip) => {
        if (!chip) return;
        const text = piCellText(name);
        piCopyToClipboard(text).then((copied) => {
            chip.classList.remove('is-copied', 'is-copy-failed');
            // Без этого повторный клик по той же ячейке не перезапустил
            // бы анимацию — класс же уже на месте.
            void chip.offsetWidth;
            chip.classList.add(copied ? 'is-copied' : 'is-copy-failed');
            chip.title = copied ? `Скопировано: ${text}`
                : 'Скопировать не удалось: браузер не отдал буфер';
            clearTimeout(piCopyTimers.get(chip));
            piCopyTimers.set(chip, setTimeout(() => {
                chip.classList.remove('is-copied', 'is-copy-failed');
                chip.title = PI_COPY_HINT;
            }, 2400));
        });
    };

    map.addEventListener('mouseover', (event) => {
        piHovered = piNameAt(event.target);
        refresh();
    });
    map.addEventListener('mouseleave', () => {
        piHovered = null;
        refresh();
    });
    map.addEventListener('focusin', (event) => {
        // В поле ввода печатают: подсветку оттуда не трогаем.
        if (event.target.closest('.chain-amount')) return;
        const name = piNameAt(event.target);
        if (!name) return;
        piHovered = name;
        refresh();
    });
    map.addEventListener('focusout', () => {
        piHovered = null;
        refresh();
    });
    map.addEventListener('click', (event) => {
        // Щелчок в поле ввода не должен снимать закреплённую подсветку.
        if (event.target.closest('.chain-amount')) return;
        const name = piNameAt(event.target);
        if (!name) {
            if (piLocked) {
                piLocked = null;
                refresh();
            }
            return;
        }
        // Клик делает два дела: закрепляет подсветку цепочки (как и
        // раньше) и кладёт ячейку в буфер. Отделять их нечем — отдельной
        // кнопки на плитке места нет, а результат копии всё равно
        // показывает вспышка рамки.
        //
        // Выделенный текст копией не считаем: выделяют, чтобы скопировать
        // сами, и в буфер в этот момент трогать нельзя.
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            piCopyCell(name, event.target.closest('.chain-chip'));
        }
        piLocked = (piLocked === name) ? null : name;
        piHovered = null;
        refresh();
    });

    // Линии стоят по координатам карточек, поэтому их надо пересчитать,
    // когда вкладку открыли, изменили размер окна или догрузились шрифты
    window.addEventListener('resize', relayout);

    // Вкладку открывает app.js — он снимает .active со всех секций и
    // вешает на нужную. Слушаем сам класс, а не щелчок по кнопке:
    // js/chains.js подключается раньше app.js, и обработчик кнопки отработал бы
    // первым, когда секция ещё скрыта и размеры у карточек нулевые.
    const chainsSection = document.getElementById('chains');
    if (chainsSection && window.MutationObserver) {
        new MutationObserver(() => {
            if (!chainsSection.classList.contains('active')) return;
            relayout();
            refresh();
        }).observe(chainsSection, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    if (window.ResizeObserver) {
        new ResizeObserver(drawLines).observe(map);
    }
}
