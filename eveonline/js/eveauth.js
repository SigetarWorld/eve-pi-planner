/* Вход в EVE Online через Single Sign-On (OAuth 2.0).

   Зачем подключаться: по выданному токену ESI отдаёт данные персонажа,
   в том числе его колонии —
   GET /v1/characters/{character_id}/planets
   с областью доступа esi-planets.manage_planets.v1.

   Что нужно, чтобы вход заработал: своё приложение на
   developers.eveonline.com. Оттуда берутся client_id и разрешённый
   адрес возврата, и вписать их может только владелец приложения.
   Поэтому clientId ниже пустой, и пока он пустой, кнопка входа
   на странице не появляется.

   Адреса выдачи кода и токена взяты из спецификации ESI
   (https://esi.evetech.net/meta/openapi.json, securitySchemes.OAuth2):
     https://login.eveonline.com/v2/oauth/authorize
     https://login.eveonline.com/v2/oauth/token
   Адреса проверки и отзыва в спецификации не перечислены, взяты
   обычные для EVE и проверены запросами без токена: /oauth/verify
   отвечает 401, /oauth/revoke и /v2/oauth/revoke — 405, то есть адреса
   верные и ждут своего заголовка.
   Код подтверждения одноразовый, поэтому адресную строку чистим сразу:
   иначе перезагрузка страницы попыталась бы обменять его второй раз.

   Спрятать client_secret в статичной странице нельзя — секрет виден
   любому, кто открыл исходник. Поэтому вход идёт по PKCE (RFC 7636):
   код подтверждения сверяется не секретом, а кодом проверки, который
   живёт только в этой вкладке. Если приложение конфиденциальное,
   впишите clientSecret — сервер примет и секрет, и код проверки. */

const EVE_AUTH = {
    /* client_id приложения на developers.eveonline.com
       (адрес возврата там: https://sigetar.ru/eveonline/). Не секрет —
       он и так виден в адресе входа. Пусто — вход не настроен. */
    clientId: 'f1a8cb49044c49a19c669946494214a4',
    /* Нужен только конфиденциальному приложению. */
    clientSecret: '',
    /* Адрес возврата — ровно тот, что вписан в приложении на
       developers.eveonline.com. Один на всё: открыта ли страница с диска,
       с зеркала Netlify, по http или как /eveonline/index.html — EVE
       вернёт только сюда. */
    redirectUri: 'https://sigetar.ru/eveonline/',
    authorizeUrl: 'https://login.eveonline.com/v2/oauth/authorize',
    tokenUrl: 'https://login.eveonline.com/v2/oauth/token',
    revokeUrl: 'https://login.eveonline.com/oauth/revoke',
    verifyUrl: 'https://login.eveonline.com/oauth/verify',
    // планеты; имущество (склады), названия структур, офисы корпорации
    // и названия её отделов — для «Тест2»
    scope: 'esi-planets.manage_planets.v1 esi-assets.read_assets.v1 esi-universe.read_structures.v1 esi-assets.read_corporation_assets.v1 esi-corporations.read_divisions.v1',
    storageKey: 'evepi.eve',
    pendingKey: 'evepi.eve.pending'
};

const eveConfigured = () => Boolean(EVE_AUTH.clientId);

/* Адрес возврата должен совпасть с тем, что вписан в приложении,
   вплоть до слеша и регистра, поэтому он задан постоянным. */
const eveRedirectUri = () => EVE_AUTH.redirectUri;

/* Открыта ли страница по адресу возврата. Вход начинать можно только
   отсюда: код проверки PKCE живёт в sessionStorage этой вкладки и этого
   адреса, а EVE вернёт именно на адрес возврата. */
const eveOnRedirectPage = () =>
    location.origin + location.pathname.replace(/index\.html$/i, '') === EVE_AUTH.redirectUri;

/* ---- Хранилище ----
   Токен лежит в localStorage, чтобы переживать перезагрузку страницы.
   Он равнозначен паролю от EVE, поэтому на общем компьютере вход
   опасен: им сможет воспользоваться кто угодно, кто откроет браузер.
   try/catch: приватный режим не должен ломать страницу. */
function eveJsonGet(storage, key) {
    try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function eveJsonSet(storage, key, value) {
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // молча работаем без сохранения
    }
}

function eveJsonDrop(storage, key) {
    try {
        storage.removeItem(key);
    } catch (e) {
        // нечего удалять — тоже не беда
    }
}

/* ---- Несколько персонажей ----
   EVE выдаёт токен на одного персонажа за вход. Каждый вход добавляет
   персонажа в список (повторный — обновляет его токен), так что можно
   подключить всех своих персонажей по очереди. В хранилище:
   { chars: [ {characterId, characterName, accessToken, ...}, ... ] }.
   Старая запись с одним персонажем читается как список из одного. */
function eveChars() {
    const raw = eveJsonGet(localStorage, EVE_AUTH.storageKey);
    if (!raw) return [];
    if (Array.isArray(raw.chars)) return raw.chars.filter((c) => c && c.accessToken);
    return raw.accessToken ? [raw] : [];
}

function eveSaveChars(list) {
    if (list.length) eveJsonSet(localStorage, EVE_AUTH.storageKey, { chars: list });
    else eveJsonDrop(localStorage, EVE_AUTH.storageKey);
}

// Добавляет персонажа или обновляет его запись (по characterId)
function eveSaveChar(state) {
    const list = eveChars();
    const i = list.findIndex((c) => c.characterId && c.characterId === state.characterId);
    if (i >= 0) list[i] = state;
    else list.push(state);
    eveSaveChars(list);
}

function eveDropChar(characterId) {
    eveSaveChars(eveChars().filter((c) => c.characterId !== characterId));
}

const eveCharById = (id) => eveChars().find((c) => c.characterId === id) || null;

// Есть ли хоть один подключённый персонаж (первый — для совместимости)
const eveState = () => eveChars()[0] || null;

/* ---- PKCE ----
   code_challenge — это base64url от SHA-256(code_verifier).
   Символы +, / и = в base64url заменяются на -, _ и отбрасываются. */
const b64url = (bytes) => btoa(String.fromCharCode.apply(null, bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const eveBytes = (size) => {
    const out = new Uint8Array(size);
    crypto.getRandomValues(out);
    return out;
};

async function eveChallengeOf(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return b64url(new Uint8Array(digest));
}

/* Адрес входа на страницу EVE. Вынесен отдельно от самого перехода,
   чтобы его можно было сверить с тем, что вписано в приложении на
   developers.eveonline.com: расхождение хоть в одном символе
   заставит EVE отклонить возврат. */
function eveAuthorizeUrl(state, challenge) {
    const url = new URL(EVE_AUTH.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', EVE_AUTH.clientId);
    url.searchParams.set('redirect_uri', eveRedirectUri());
    url.searchParams.set('scope', EVE_AUTH.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
}

/* Перенаправляет на страницу входа EVE. state защищает от подделки
   адреса возврата, code_verifier — сам код подтверждения. */
async function eveLogin() {
    // Не на sigetar.ru/eveonline/ (диск, зеркало, http…) — сперва туда;
    // метка #eve-login в адресе сама начнёт вход после перехода
    if (!eveOnRedirectPage()) {
        location.assign(EVE_AUTH.redirectUri + '#eve-login');
        return;
    }

    const state = b64url(eveBytes(16));
    const verifier = b64url(eveBytes(48));

    // Живёт только в этой вкладке: возврат из EVE случится в ней же
    eveJsonSet(sessionStorage, EVE_AUTH.pendingKey, { state, verifier });

    location.assign(eveAuthorizeUrl(state, await eveChallengeOf(verifier)));
}

/* Один запрос к tokenUrl: и обмен кода, и обновление токена идут
   через него. Секрет добавляется, только если он задан. Статус отказа
   вешаем на ошибку: по нему видно, отказал ли сервер или не дозвонились. */
async function eveTokenRequest(params) {
    const body = new URLSearchParams(params);
    // PKCE: без секрета EVE узнаёт приложение по client_id в теле запроса
    body.set('client_id', EVE_AUTH.clientId);
    if (EVE_AUTH.clientSecret) body.set('client_secret', EVE_AUTH.clientSecret);

    const res = await fetch(EVE_AUTH.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });

    if (!res.ok) {
        const error = new Error(await eveErrorText(res));
        error.status = res.status;
        throw error;
    }

    return res.json();
}

/* Кто вошёл. /oauth/verify отвечает по одному токену, без всяких
   область: называет персонажа и перечисляет выданные области. */
const eveField = (obj, ...names) => {
    for (const name of names) {
        if (obj[name] !== undefined && obj[name] !== null) return obj[name];
    }
    return null;
};

async function eveIdentify(state) {
    const res = await fetch(EVE_AUTH.verifyUrl, {
        headers: { Authorization: 'Bearer ' + state.accessToken }
    });
    if (!res.ok) throw new Error(await eveErrorText(res));

    const data = await res.json();
    const next = {
        ...state,
        characterId: eveField(data, 'CharacterID', 'character_id'),
        characterName: eveField(data, 'CharacterName', 'character_name'),
        ownerHash: eveField(data, 'CharacterOwnerHash', 'character_owner_hash'),
        scopes: data.Scopes || data.scopes || [],
        expiresOn: eveField(data, 'ExpiresOn', 'expires_on')
    };

    eveSaveChar(next);
    return next;
}

/* Возврат из EVE. В адресе лежит code (или error) и наш state.
   Код одноразовый, поэтому убираем его из адреса до обмена. */
async function eveHandleCallback() {
    const params = new URLSearchParams(location.search);
    if (!params.has('code') && !params.has('error')) return null;

    history.replaceState(null, '', location.pathname + location.hash);

    const failed = params.get('error');
    if (failed) throw new Error(params.get('error_description') || failed);

    const pending = eveJsonGet(sessionStorage, EVE_AUTH.pendingKey);
    eveJsonDrop(sessionStorage, EVE_AUTH.pendingKey);

    if (!pending || pending.state !== params.get('state')) {
        throw new Error('state не совпал — вход отменён');
    }

    const token = await eveTokenRequest({
        grant_type: 'authorization_code',
        code: params.get('code'),
        redirect_uri: eveRedirectUri(),
        code_verifier: pending.verifier
    });

    const state = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: Date.now() + (token.expires_in || 1199) * 1000
    };
    // В список персонаж попадёт после проверки: только тогда известен его id
    return eveIdentify(state);
}

/* Обмен refresh_token на новый access_token. force обновляет досрочно:
   так чиним ответ 401, когда срок по часам ещё не наступил. */
async function eveRefreshToken(state, force) {
    if (!state || !state.accessToken) return null;
    if (!force && state.expiresAt && Date.now() < state.expiresAt - 30000) return state;
    if (!state.refreshToken) return null;

    try {
        const token = await eveTokenRequest({
            grant_type: 'refresh_token',
            // scope не передаём: токен обновляется с теми правами, что
            // выданы при входе (иначе старый вход «только планеты» отвергнут)
            refresh_token: state.refreshToken
        });

        const next = {
            ...state,
            accessToken: token.access_token,
            expiresAt: Date.now() + (token.expires_in || 1199) * 1000
        };
        if (token.refresh_token) next.refreshToken = token.refresh_token;

        eveSaveChar(next);
        return next;
    } catch (e) {
        // Отказ сервера — токен больше не рабочий, его незачем хранить.
        // Обрыв сети или сбой EVE — токен в порядке, просто не дозвонились:
        // тогда оставляем его, и следующая попытка может удастся.
        if (e.status && e.status < 500) {
            eveDropChar(state.characterId);
        }

        return null;
    }
}

/* Действующий токен персонажа (по умолчанию — первого в списке),
   подновлённый при подходе срока. */
async function eveAccess(characterId) {
    const state = characterId ? eveCharById(characterId) : eveState();
    return eveRefreshToken(state, false);
}

const eveRequest = (url, options, state) => fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + state.accessToken }
});

/* Запрос к ESI от имени персонажа. На 401 токен обновляется один раз:
   если и после этого отказ, вход надо повторить руками. */
async function eveFetchJson(url, options = {}, characterId) {
    // Различаем два случая: входа не было вовсе и вход был, но сессия
    // протухла. Во втором случае токен мог остаться в хранилище, но
    // обновить его не вышло — сказать «нет входа» тут неверно.
    if (!(characterId ? eveCharById(characterId) : eveState())) throw new Error('Нет входа в EVE');

    const state = await eveAccess(characterId);
    if (!state) throw new Error('Сессия EVE истекла — войдите заново');

    let res = await eveRequest(url, options, state);
    if (res.status === 401) {
        const fresh = await eveRefreshToken(state, true);
        if (!fresh) throw new Error('Сессия EVE истекла — войдите заново');
        res = await eveRequest(url, options, fresh);
    }

    if (!res.ok) throw new Error(await eveErrorText(res));
    return res.json();
}

/* Отключение: токен отзываем на стороне EVE, иначе он останется
   действующим до конца срока. Отзыв не удался — всё равно чистим
   у себя, чтобы вход не считался активным. Возвращает, подтвердил
   ли EVE отзыв: по нему выбирают, что написать пользователю.
   Отключается один персонаж (по умолчанию — первый), остальные
   остаются подключёнными. */
async function eveLogout(characterId) {
    let revoked = false;
    const state = characterId ? eveCharById(characterId) : eveState();

    if (state && state.refreshToken) {
        try {
            const res = await fetch(EVE_AUTH.revokeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    token: state.refreshToken,
                    token_type_hint: 'refresh_token',
                    client_id: EVE_AUTH.clientId
                })
            });
            revoked = res.ok;
        } catch (e) {
            // сеть недоступна: чистим локально, этого достаточно
            revoked = false;
        }
    }

    if (state) eveDropChar(state.characterId);
    return revoked;
}

/* Текст ошибки из ответа. У ESI причина лежит в одном поле error
   (проверено: {"error":"Unauthorized - No token provided"}), а у
   сервера выдачи токенов код и описание приходят отдельными полями,
   поэтому берём оба вида. */
async function eveErrorText(res) {
    try {
        const data = await res.json();
        return [res.status, eveField(data, 'error', 'Error'), eveField(data, 'error_description', 'ErrorDescription')]
            .filter(Boolean)
            .join(' ');
    } catch (e) {
        return `${res.status} ${res.statusText}`;
    }
}
