// Живая цена товара по заявкам на продажу. Данные — ESI, вход в игру для
// этого не нужен: заявки открыты, а в ответе ESI приходит
// Access-Control-Allow-Origin: *. Токен EVE в localStorage здесь не
// участвует — хранить его ради публичной цены незачем, а на общем
// компьютере это лишний риск.
//
// Какую формулу повторяем:
//
//   МИН(ФИЛЬТР(EVEONLINE.MARKET_ORDERS(10000002; 2867;;30000142);
//        EVEONLINE.MARKET_ORDERS(10000002; 2867;;30000142)
//          .transaction_type="Sell").price)
//
//   10000002 — регион The Forge: GET /v2/universe/regions/10000002/;
//   2867     — Broadcast Node, typeID из PI_COMMODITIES;
//   30000142 — система Jita: GET /v2/universe/systems/30000142/.
//   Того, что похоже на станцию, в SDE нет: станции Jita IV
//   нумеруются с 6000... (60003760 — Jita IV - Moon 4 - Caldari Navy
//   Assembly Plant), а 30000142 в staStations.yaml не значится вовсе.
//   Так что четвёртый аргумент формулы — это система, не станция.
//
// Формула применена ко всем 83 товарам P0..P4, а не к одному
// Broadcast Node: тот же рынок и тот же отбор, свой typeID у каждого.
//
// Функции EVEONLINE.MARKET_ORDERS из «Таблиц» Google больше нет, и
// фильтра по станции в ESI тоже нет: у
// GET /v1/markets/{region_id}/orders остались только order_type и
// type_id, остальное — заголовки. Поэтому систему отбираем сами по
// полю system_id, а заявки на продажу запрашиваем параметром
// order_type=sell: с редакции 2020-01-01 он обязателен, без него 400.
//
// Что это стоит: замер 29.09.2026, ветка tranquility — все 83 ответа
// весили 950 КБ, самый большой 30 КБ (Chiral Structures, typeID 2401),
// самый долгий 1.8 с, у всех X-Pages: 1 и ни одной ошибки. Один
// заход страницы — это 83 запроса примерно на мегабайт, поэтому цены
// и не обновляются сами: свежие появляются после перезагрузки.

const EVE_PRICES = (() => {
    const API = 'https://esi.evetech.net';
    // Ветка Новой Эры. Другой сет у сайта нет.
    const DATASOURCE = 'tranquility';
    // Сколько заявок идёт одновременно. Список на 83 товара, а ESI
    // ждать не любит: восемь одновременных запросов он держит
    // спокойно, а сорок три сразу — уже нет. Предел у группы
    // market-order — 12000 запросов на 15 минут, так что восемь
    // одновременных для 83 товаров укладываются с большим запасом.
    const QUERY_LIMIT = 8;

    /* Минимум цены среди заявок на продажу — то же самое, что
       МИН(...price) по фильтру transaction_type="Sell". Заявки на
       покупку мы даже не запрашиваем, но проверяем флаг ещё раз: это
       ровно то условие из формулы.

       Если подходящих заявок нет, возвращаем price: null, а не
       придумываем цену. */
    async function sellMin({ typeId, regionId, systemId }) {
        const url = `${API}/v1/markets/${regionId}/orders`
            + `?order_type=sell&type_id=${typeId}&datasource=${DATASOURCE}`;
        const res = await fetch(url);
        if (!res.ok) {
            // При 429 ESI прикладывает Retry-After — сколько ждать.
            const wait = res.headers.get('Retry-After');
            const error = new Error(wait
                ? `ESI вернул ${res.status}, просит подождать ${wait} с`
                : `ESI вернул ${res.status}${res.statusText ? ' ' + res.statusText : ''}`);
            error.status = res.status;
            throw error;
        }
        const orders = await res.json();
        if (!Array.isArray(orders)) throw new Error('ESI вернул не список заявок');

        // Свои фильтры поверх ответа: system_id — это система, и нужные
        // станции живут внутри неё.
        const ours = orders.filter((order) => order.is_buy_order === false
            && (systemId === undefined || order.system_id === systemId));
        const price = ours.reduce((min, order) => {
            const value = Number(order.price);
            if (!Number.isFinite(value)) return min;
            return min === null || value < min ? value : min;
        }, null);

        return { price, orders: ours.length, regionId, systemId, typeId };
    }

    /* 2120000 -> «2 120 000», 2120000.5 -> «2 120 000,50».
       Разряды — неразрывным пробелом, как в остальном проекте. */
    const formatIsk = (value) => {
        const rounded = Math.round(value * 100) / 100;
        const whole = Math.floor(rounded);
        const frac = Math.round((rounded - whole) * 100);
        let text = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
        if (frac) text += ',' + String(frac).padStart(2, '0');
        return text;
    };

    const clock = (date) => [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0')).join(':');

    // 1 заявка, 2 заявки, 5 заявок — по-русски без склонений в коде.
    const plural = (count) => {
        const tail100 = count % 100;
        const tail10 = count % 10;
        if (tail100 > 10 && tail100 < 20) return 'заявок';
        if (tail10 === 1) return 'заявка';
        if (tail10 >= 2 && tail10 <= 4) return 'заявки';
        return 'заявок';
    };

    const where = (query) => `${query.systemName || 'система ' + query.systemId}`
        + ` (${query.systemId}), регион ${query.regionName || query.regionId}`;

    /* Один узел: подтягиваем заявки и вписываем цену. Наружу ошибку не
       бросаем — узел сам покажет, что ответа не было, и подскажет, что
       повтор будет только после перезагрузки. */
    function showOnce(node, query) {
        node.textContent = '…';
        node.classList.remove('is-set', 'is-error');
        return sellMin(query).then((data) => {
            const at = clock(new Date());
            if (data.price === null) {
                node.textContent = 'заявок нет';
                node.classList.add('is-error');
                node.title = `В ${where(query)} нет заявок на продажу. `
                    + `Проверено в ${at}.`;
                return;
            }
            node.textContent = formatIsk(data.price) + ' ISK';
            node.classList.add('is-set');
            node.title = `Минимум среди ${data.orders} ${plural(data.orders)} `
                + `на продажу в ${where(query)} — по всем заявкам, `
                + `включая единичные, поэтому у дешёвого сырья выходит `
                + `неправдоподобно мало. Проверено в ${at}. `
                + `Источник: ESI, /v1/markets/${data.regionId}/orders.`;
        }, (error) => {
            node.textContent = 'цены нет';
            node.classList.add('is-error');
            node.title = `Цена не пришла: ${error.message}. `
                + 'Появится после перезагрузки страницы.';
        });
    }

    /* Подключает узлы разом. Ждём, пока схема появится на экране: пока
       вкладка закрыта, заявки смотреть некому, и качать мегабайт впустую
       незачем. Дальше берём всё сразу, а не по мере прокрутки: список
       на 83 товара, очередь с ограничением проходит его целиком за
       несколько секунд, а «…» в плитках, до которых не доскроллили,
       выглядели бы как поломка. */
    function watch(items) {
        const queries = new Map();
        const waiting = [];
        let running = 0;
        let started = false;

        const pump = () => {
            while (running < QUERY_LIMIT && waiting.length) {
                const node = waiting.shift();
                running += 1;
                showOnce(node, queries.get(node)).then(() => {
                    running -= 1;
                    pump();
                });
            }
        };

        const start = () => {
            if (started) return;
            started = true;
            waiting.push(...items.map((item) => item.node));
            pump();
        };

        items.forEach((item) => {
            queries.set(item.node, item.query);
            item.node.textContent = '…';
        });

        // Первая же попавшая в кадр плитка запускает всю очередь: если
        // схема открыта, в кадре есть хоть одна плитка, а саму карту
        // наблюдать рискованно — при прокруте она может уйти за край.
        if (items.length && window.IntersectionObserver) {
            const seen = new IntersectionObserver((observed) => {
                if (!observed.some((entry) => entry.isIntersecting)) return;
                seen.disconnect();
                start();
            });
            items.forEach((item) => seen.observe(item.node));
            return;
        }

        start();
    }

    return { sellMin, formatIsk, watch };
})();
