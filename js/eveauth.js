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
    /* client_id из developers.eveonline.com. Пусто — вход не настроен. */
    clientId: '',
    /* Нужен только конфиденциальному приложению. */
    clientSecret: '',
    authorizeUrl: 'https://login.eveonline.com/v2/oauth/authorize',
    tokenUrl: 'https://login.eveonline.com/v2/oauth/token',
    revokeUrl: 'https://login.eveonline.com/oauth/revoke',
    verifyUrl: 'https://login.eveonline.com/oauth/verify',
    scope: 'esi-planets.manage_planets.v1',
    storageKey: 'evepi.eve',
    pendingKey: 'evepi.eve.pending'
};

const eveConfigured = () => Boolean(EVE_AUTH.clientId);

/* Адрес возврата должен совпасть с тем, что вписан в приложении,
   вплоть до слеша и регистра. В статичной папке это путь к Index.html:
   его и надо отдать при регистрации приложения. */
const eveRedirectUri = () => location.origin + location.pathname;

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

const eveState = () => eveJsonGet(localStorage, EVE_AUTH.storageKey);

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

    eveJsonSet(localStorage, EVE_AUTH.storageKey, next);
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
    eveJsonSet(localStorage, EVE_AUTH.storageKey, state);

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
            refresh_token: state.refreshToken,
            scope: EVE_AUTH.scope
        });

        const next = {
            ...state,
            accessToken: token.access_token,
            expiresAt: Date.now() + (token.expires_in || 1199) * 1000
        };
        if (token.refresh_token) next.refreshToken = token.refresh_token;

        eveJsonSet(localStorage, EVE_AUTH.storageKey, next);
        return next;
    } catch (e) {
        // Отказ сервера — токен больше не рабочий, его незачем хранить.
        // Обрыв сети или сбой EVE — токен в порядке, просто не дозвонились:
        // тогда оставляем его, и следующая попытка может удастся.
        if (e.status && e.status < 500) {
            eveJsonDrop(localStorage, EVE_AUTH.storageKey);
        }

        return null;
    }
}

/* Действующий токен, подновлённый при подходе срока. */
async function eveAccess() {
    return eveRefreshToken(eveState(), false);
}

const eveRequest = (url, options, state) => fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + state.accessToken }
});

/* Запрос к ESI от имени персонажа. На 401 токен обновляется один раз:
   если и после этого отказ, вход надо повторить руками. */
async function eveFetchJson(url, options = {}) {
    // Различаем два случая: входа не было вовсе и вход был, но сессия
    // протухла. Во втором случае токен мог остаться в хранилище, но
    // обновить его не вышло — сказать «нет входа» тут неверно.
    if (!eveState()) throw new Error('Нет входа в EVE');

    let state = await eveAccess();
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
   ли EVE отзыв: по нему выбирают, что написать пользователю. */
async function eveLogout() {
    let revoked = false;
    const state = eveState();

    if (state && state.refreshToken) {
        try {
            const res = await fetch(EVE_AUTH.revokeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ token: state.refreshToken })
            });
            revoked = res.ok;
        } catch (e) {
            // сеть недоступна: чистим локально, этого достаточно
            revoked = false;
        }
    }

    eveJsonDrop(localStorage, EVE_AUTH.storageKey);
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
