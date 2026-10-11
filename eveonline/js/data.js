// Данные по планетарной промышленности (PI) из EVE Online.
//
// Источник — официальный SDE (файл planetSchematics.yaml) и ESI:
// esi.evetech.net/v2/universe/types/<typeID>/
// Уровень PI определяется по market_group_id, который отдаёт ESI:
// 1333 — P0 (сырьё с планеты), 1334 — P1, 1335 — P2,
// 1336 — P3, 1337 — P4.

// Что добывается на планете каждого типа: P0 -> P1.
// Все 15 P0 и все 15 P1 сверены с SDE, по 5 товаров на тип тоже.
// Каждая планета даёт пять фиксированных ресурсов, и если в колонии
// несколько планет одного типа, берутся всё те же пять.
const PLANET_RESOURCES = {
    Barren: [
        { P0: "Aqueous Liquids", P1: "Water" },
        { P0: "Base Metals", P1: "Reactive Metals" },
        { P0: "Carbon Compounds", P1: "Biofuels" },
        { P0: "Noble Metals", P1: "Precious Metals" },
        { P0: "Suspended Plasma", P1: "Plasmoids" }
    ],
    Gas: [
        { P0: "Aqueous Liquids", P1: "Water" },
        { P0: "Base Metals", P1: "Reactive Metals" },
        { P0: "Ionic Solutions", P1: "Electrolytes" },
        { P0: "Noble Gas", P1: "Oxygen" },
        { P0: "Reactive Gas", P1: "Oxidizing Compound" }
    ],
    Ice: [
        { P0: "Aqueous Liquids", P1: "Water" },
        { P0: "Heavy Metals", P1: "Toxic Metals" },
        { P0: "Microorganisms", P1: "Bacteria" },
        { P0: "Noble Gas", P1: "Oxygen" },
        { P0: "Planktic Colonies", P1: "Biomass" }
    ],
    Lava: [
        { P0: "Base Metals", P1: "Reactive Metals" },
        { P0: "Felsic Magma", P1: "Silicon" },
        { P0: "Heavy Metals", P1: "Toxic Metals" },
        { P0: "Non-CS Crystals", P1: "Chiral Structures" },
        { P0: "Suspended Plasma", P1: "Plasmoids" }
    ],
    Oceanic: [
        { P0: "Aqueous Liquids", P1: "Water" },
        { P0: "Carbon Compounds", P1: "Biofuels" },
        { P0: "Complex Organists", P1: "Proteins" },
        { P0: "Microorganisms", P1: "Bacteria" },
        { P0: "Planktic Colonies", P1: "Biomass" }
    ],
    Plasma: [
        { P0: "Base Metals", P1: "Reactive Metals" },
        { P0: "Heavy Metals", P1: "Toxic Metals" },
        { P0: "Noble Metals", P1: "Precious Metals" },
        { P0: "Non-CS Crystals", P1: "Chiral Structures" },
        { P0: "Suspended Plasma", P1: "Plasmoids" }
    ],
    Storm: [
        { P0: "Aqueous Liquids", P1: "Water" },
        { P0: "Base Metals", P1: "Reactive Metals" },
        { P0: "Ionic Solutions", P1: "Electrolytes" },
        { P0: "Noble Gas", P1: "Oxygen" },
        { P0: "Suspended Plasma", P1: "Plasmoids" }
    ],
    Temperate: [
        { P0: "Aqueous Liquids", P1: "Water" },
        { P0: "Autotrophs", P1: "Industrial Fibers" },
        { P0: "Carbon Compounds", P1: "Biofuels" },
        { P0: "Complex Organists", P1: "Proteins" },
        { P0: "Microorganisms", P1: "Bacteria" }
    ]
};

// Что можно выплавить из P1: на каждое изделие P2 нужны два P1.
// Рецепты взяты из planetSchematics.yaml официального SDE.
// Изделия, которые нужны лишь NPC-производству (Livestock, Viral Agent,
// Genetically Enhanced Livestock, Vaccines), в список не попали:
// на планете их не добыть.
// Уровни P3 и P4 тоже есть в SDE, но карточка их не показывает —
// понадобятся для вкладки «Цепочки производства».
const P1_RECIPES = {
    "Water":              ["Superconductors", "Coolant", "Water-Cooled CPU", "Test Cultures"],
    "Plasmoids":          ["Superconductors", "Rocket Fuel", "Transmitter"],
    "Electrolytes":       ["Coolant", "Rocket Fuel", "Synthetic Oil"],
    "Oxygen":             ["Synthetic Oil", "Oxides", "Supertensile Plastics"],
    "Biomass":            ["Supertensile Plastics"],
    "Oxidizing Compound": ["Oxides", "Silicate Glass", "Polyaramids"],
    "Silicon":            ["Silicate Glass", "Miniature Electronics", "Microfiber Shielding"],
    "Chiral Structures":  ["Consumer Electronics", "Miniature Electronics", "Transmitter"],
    "Reactive Metals":    ["Water-Cooled CPU", "Mechanical Parts", "Construction Blocks", "Nanites"],
    "Precious Metals":    ["Mechanical Parts", "Enriched Uranium", "Biocells"],
    "Toxic Metals":       ["Construction Blocks", "Enriched Uranium", "Consumer Electronics"],
    "Industrial Fibers":  ["Microfiber Shielding", "Polytextiles", "Polyaramids"],
    "Biofuels":           ["Biocells", "Polytextiles"],
    "Bacteria":           ["Nanites", "Fertilizer", "Test Cultures"],
    "Proteins":           ["Fertilizer"]
};

// Иконки ресурсов. Ключ — точное имя типа из EVE SDE,
// значение — файл в папке img/.
// Картинки брались с images.evetech.net/types/<typeID>/icon,
// typeID сверены с ESI и с planetSchematics.yaml.
const RESOURCE_ICONS = {
    // P0 — сырьё, которое добывается на планете
    "Aqueous Liquids":      "img/aqueous-liquids.png",     // 2268
    "Base Metals":          "img/base-metals.png",         // 2267
    "Noble Metals":         "img/noble-metals.png",        // 2270
    "Suspended Plasma":     "img/suspended-plasma.png",    // 2308
    "Ionic Solutions":      "img/ionic-solutions.png",     // 2309
    "Noble Gas":            "img/noble-gas.png",           // 2310
    "Reactive Gas":         "img/reactive-gas.png",        // 2311
    "Heavy Metals":         "img/heavy-metals.png",        // 2272
    "Microorganisms":       "img/microorganisms.png",      // 2073
    "Planktic Colonies":    "img/planktic-colonies.png",   // 2286
    "Complex Organists":    "img/complex-organists.png",   // 2287
    "Carbon Compounds":     "img/carbon-compounds.png",    // 2288
    "Autotrophs":           "img/autotrophs.png",          // 2305
    "Non-CS Crystals":      "img/non-cs-crystals.png",     // 2306
    "Felsic Magma":         "img/felsic-magma.png",        // 2307

    // P1 — переработка P0
    "Water":                "img/water.png",               // 3645
    "Reactive Metals":      "img/reactive-metals.png",     // 2398
    "Precious Metals":      "img/precious-metals.png",     // 2399
    "Toxic Metals":         "img/toxic-metals.png",        // 2400
    "Chiral Structures":    "img/chiral-structures.png",   // 2401
    "Oxidizing Compound":   "img/oxidizing-compound.png",  // 2392
    "Electrolytes":         "img/electrolytes.png",        // 2390
    "Bacteria":             "img/bacteria.png",            // 2393
    "Proteins":             "img/proteins.png",            // 2395
    "Biofuels":             "img/biofuels.png",            // 2396
    "Industrial Fibers":    "img/industrial-fibers.png",   // 2397
    "Plasmoids":            "img/plasmoids.png",           // 2389
    "Oxygen":               "img/oxygen.png",              // 3683
    "Silicon":              "img/silicon.png",             // 9828
    "Biomass":              "img/biomass.png",             // 3779

    // P2 — из двух P1
    "Supertensile Plastics": "img/supertensile-plastics.png", // 2312
    "Oxides":                 "img/oxides.png",               // 2317
    "Test Cultures":          "img/test-cultures.png",        // 2319
    "Polyaramids":            "img/polyaramids.png",          // 2321
    "Mechanical Parts":       "img/mechanical-parts.png",     // 3689
    "Synthetic Oil":          "img/synthetic-oil.png",        // 3691
    "Fertilizer":             "img/fertilizer.png",           // 3693
    "Polytextiles":           "img/polytextiles.png",         // 3695
    "Silicate Glass":         "img/silicate-glass.png",       // 3697
    "Rocket Fuel":            "img/rocket-fuel.png",          // 9830
    "Coolant":                "img/coolant.png",              // 9832
    "Consumer Electronics":   "img/consumer-electronics.png", // 9836
    "Superconductors":        "img/superconductors.png",      // 9838
    "Transmitter":            "img/transmitter.png",          // 9840
    "Miniature Electronics":  "img/miniature-electronics.png",// 9842
    "Biocells":               "img/biocells.png",             // 2329
    "Construction Blocks":    "img/construction-blocks.png",  // 3828
    "Enriched Uranium":       "img/enriched-uranium.png",     // 44
    "Genetically Enhanced Livestock": "img/genetically-enhanced-livestock.png", // 15317
    "Livestock":              "img/livestock.png",            // 3725
    "Microfiber Shielding":   "img/microfiber-shielding.png", // 2327
    "Nanites":                "img/nanites.png",              // 2463
    "Viral Agent":            "img/viral-agent.png",          // 3775
    "Water-Cooled CPU":       "img/water-cooled-cpu.png",     // 2328

    // P3 и P4 — уровни, сверенные с ESI по market_group_id 1336 и 1337.
    // На планете их не добывают, но схема производства на вкладке
    // «Цепочки» их показывает: рецепты P3 и P4 есть в SDE.
    "Biotech Research Reports":      "img/biotech-research-reports.png",      // 2358
    "Camera Drones":                 "img/camera-drones.png",                  // 2345
    "Condensates":                   "img/condensates.png",                    // 2344
    "Cryoprotectant Solution":       "img/cryoprotectant-solution.png",        // 2367
    "Data Chips":                    "img/data-chips.png",                     // 17392
    "Gel-Matrix Biopaste":           "img/gel-matrix-biopaste.png",            // 2348
    "Guidance Systems":              "img/guidance-systems.png",               // 9834
    "Hazmat Detection Systems":      "img/hazmat-detection-systems.png",       // 2366
    "Hermetic Membranes":            "img/hermetic-membranes.png",             // 2361
    "High-Tech Transmitters":        "img/high-tech-transmitters.png",         // 17898
    "Industrial Explosives":         "img/industrial-explosives.png",          // 2360
    "Neocoms":                       "img/neocoms.png",                        // 2354
    "Nuclear Reactors":              "img/nuclear-reactors.png",               // 2352
    "Planetary Vehicles":            "img/planetary-vehicles.png",             // 9846
    "Robotics":                      "img/robotics.png",                       // 9848
    "Smartfab Units":                "img/smartfab-units.png",                 // 2351
    "Supercomputers":                 "img/supercomputers.png",                  // 2349
    "Synthetic Synapses":            "img/synthetic-synapses.png",             // 2346
    "Transcranial Microcontrollers": "img/transcranial-microcontrollers.png",  // 12836
    "Ukomi Superconductors":         "img/ukomi-superconductors.png",          // 17136
    "Vaccines":                      "img/vaccines.png",                       // 28974

    "Broadcast Node":              "img/broadcast-node.png",              // 2867
    "Integrity Response Drones":   "img/integrity-response-drones.png",   // 2868
    "Nano-Factory":                "img/nano-factory.png",                // 2869
    "Organic Mortar Applicators":  "img/organic-mortar-applicators.png",  // 2870
    "Recursive Computing Module":  "img/recursive-computing-module.png",  // 2871
    "Self-Harmonizing Power Core": "img/self-harmonizing-power-core.png", // 2872
    "Sterile Conduits":            "img/sterile-conduits.png",            // 2875
    "Wetware Mainframe":           "img/wetware-mainframe.png",           // 2876

    // Лунные минералы, сплавы и изделия гражданской промышленности.
    // Не планетные товары: ESI относит их к другим группам рынка,
    // в карточке они не встречаются — иконки лежат про запас.
    "Carbon":                   "img/carbon.png",
    "Hydrocarbons":             "img/hydrocarbons.png",
    "Atmospheric Gases":        "img/atmospheric-gases.png",
    "Tungsten":                 "img/tungsten.png",
    "Titanium":                 "img/titanium.png",
    "Scandium":                 "img/scandium.png",
    "Cobalt":                   "img/cobalt.png",
    "Chromium":                 "img/chromium.png",
    "Vanadium":                 "img/vanadium.png",
    "Cadmium":                  "img/cadmium.png",
    "Platinum":                 "img/platinum.png",
    "Mercury":                  "img/mercury.png",
    "Caesium":                  "img/caesium.png",
    "Hafnium":                  "img/hafnium.png",
    "Technetium":               "img/technetium.png",
    "Dysprosium":               "img/dysprosium.png",
    "Neodymium":                "img/neodymium.png",
    "Promethium":               "img/promethium.png",
    "Thulium":                  "img/thulium.png",
    "Titanium Chromide":        "img/titanium-chromide.png",
    "Crystalline Alloy":        "img/crystalline-alloy.png",
    "Fernite Alloy":            "img/fernite-alloy.png",
    "Rolled Tungsten Alloy":    "img/rolled-tungsten-alloy.png",
    "Silicon Diborite":         "img/silicon-diborite.png",
    "Carbon Polymers":          "img/carbon-polymers.png",
    "Ceramic Powder":           "img/ceramic-powder.png",
    "Sulfuric Acid":            "img/sulfuric-acid.png",
    "Platinum Technite":        "img/platinum-technite.png",
    "Caesarium Cadmide":        "img/caesarium-cadmide.png",
    "Solerium":                 "img/solerium.png",
    "Hexite":                   "img/hexite.png",
    "Hyperflurite":             "img/hyperflurite.png",
    "Neo Mercurite":            "img/neo-mercurite.png",
    "Dysporite":                "img/dysporite.png",
    "Ferrofluid":               "img/ferrofluid.png",
    "Crystalline Carbonide":    "img/crystalline-carbonide.png",
    "Titanium Carbide":         "img/titanium-carbide.png",
    "Tungsten Carbide":         "img/tungsten-carbide.png",
    "Fernite Carbide":          "img/fernite-carbide.png",
    "Hydrogen Batteries":       "img/hydrogen-batteries.png",
    "Electronic Parts":         "img/electronic-parts.png",
    "Sylramic Fibers":          "img/sylramic-fibers.png",
    "Fullerides":               "img/fullerides.png",
    "Phenolic Composites":      "img/phenolic-composites.png",
    "Nanotransistors":          "img/nanotransistors.png",
    "Hypersynaptic Fibers":     "img/hypersynaptic-fibers.png",
    "Ferrogel":                 "img/ferrogel.png"
};

// Фон ячейки «Корабль»: хаулеры Uwell для вывоза ресурсов с планет.
// Картинки с images.evetech.net/types/<typeID>/icon, typeID сверены с ESI:
// Deluge 81046, Epithal 655. Файлы лежат в img/ships/.
const SHIP_IMAGES = {
    "Deluge":  "img/ships/deluge.png",
    "Epithal": "img/ships/epithal.png"
};
