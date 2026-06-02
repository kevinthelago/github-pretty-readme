import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createWakatimeClient, getTimeByLanguage } from '../wakatime/client.js';
import { wakatimeConnect, wakatimeDisconnect } from '../../api/wakatime-connect.js';

// Builds a fake fetch from a handler(url) -> { ok?, status?, body? }.
// Records every requested URL so tests can assert on auth/paths.
const fakeFetch = (handler) => {
    const urls = [];
    const fn = async (url) => {
        const u = url.toString();
        urls.push(u);
        const { ok = true, status = 200, body = {} } = handler(u) ?? {};
        return { ok, status, json: async () => body };
    };
    fn.urls = urls;
    return fn;
};

const STATS = {
    data: {
        languages: [
            { name: 'JavaScript', total_seconds: 3600, percent: 60, digital: '1:00' },
            { name: 'Python', total_seconds: 2400, percent: 40, digital: '0:40' },
        ],
    },
};

describe('createWakatimeClient', () => {
    test('sends base64 Basic auth when an apiKey is provided', () => {
        const client = createWakatimeClient({
            apiKey: 'waka_key',
            fetchImpl: fakeFetch(() => ({})),
        });
        const expected = `Basic ${Buffer.from('waka_key').toString('base64')}`;
        expect(client.headers().Authorization).toBe(expected);
        expect(client.headers().Accept).toBe('application/json');
    });

    test('omits Authorization when no apiKey is available', () => {
        const client = createWakatimeClient({ apiKey: null, fetchImpl: fakeFetch(() => ({})) });
        expect(client.headers().Authorization).toBeUndefined();
    });

    test('getJson returns parsed body on OK and null on non-OK', async () => {
        const okClient = createWakatimeClient({
            apiKey: 'k',
            fetchImpl: fakeFetch(() => ({ body: { hi: 1 } })),
        });
        expect(await okClient.getJson('/x')).toEqual({ hi: 1 });

        const badClient = createWakatimeClient({
            apiKey: 'k',
            fetchImpl: fakeFetch(() => ({ ok: false, status: 401 })),
        });
        expect(await badClient.getJson('/x')).toBeNull();
    });
});

describe('getTimeByLanguage (method)', () => {
    test('projects the languages array and hits the default range', async () => {
        const ff = fakeFetch(() => ({ body: STATS }));
        const client = createWakatimeClient({ apiKey: 'k', fetchImpl: ff });

        const langs = await client.getTimeByLanguage();
        expect(langs).toEqual([
            { name: 'JavaScript', total_seconds: 3600, percent: 60 },
            { name: 'Python', total_seconds: 2400, percent: 40 },
        ]);
        expect(ff.urls[0]).toContain('/users/current/stats/last_7_days');
    });

    test('uses the supplied range', async () => {
        const ff = fakeFetch(() => ({ body: STATS }));
        const client = createWakatimeClient({ apiKey: 'k', fetchImpl: ff });
        await client.getTimeByLanguage('last_30_days');
        expect(ff.urls[0]).toContain('/stats/last_30_days');
    });

    test('returns null when unauthenticated (no key, no fetch attempted)', async () => {
        const ff = fakeFetch(() => ({ body: STATS }));
        const client = createWakatimeClient({ apiKey: null, fetchImpl: ff });
        expect(await client.getTimeByLanguage()).toBeNull();
        expect(ff.urls).toHaveLength(0);
    });

    test('returns null on a non-OK response', async () => {
        const client = createWakatimeClient({
            apiKey: 'k',
            fetchImpl: fakeFetch(() => ({ ok: false, status: 500 })),
        });
        expect(await client.getTimeByLanguage()).toBeNull();
    });

    test('returns null when the payload has no languages array', async () => {
        const client = createWakatimeClient({
            apiKey: 'k',
            fetchImpl: fakeFetch(() => ({ body: { data: {} } })),
        });
        expect(await client.getTimeByLanguage()).toBeNull();
    });
});

describe('getTimeByLanguage (env-keyed fallback helper)', () => {
    const prev = process.env.WAKATIME_API_KEY;
    afterEach(() => {
        if (prev === undefined) delete process.env.WAKATIME_API_KEY;
        else process.env.WAKATIME_API_KEY = prev;
    });

    test('falls back to WAKATIME_API_KEY via an injected client', async () => {
        const client = createWakatimeClient({
            apiKey: 'env-key',
            fetchImpl: fakeFetch(() => ({ body: STATS })),
        });
        const langs = await getTimeByLanguage('all_time', client);
        expect(langs).toHaveLength(2);
    });

    test('swallows transport errors and returns null', async () => {
        const client = createWakatimeClient({
            apiKey: 'k',
            fetchImpl: () => Promise.reject(new Error('offline')),
        });
        expect(await getTimeByLanguage('last_7_days', client)).toBeNull();
    });
});

/** Minimal Express-style response double recording status and body. */
const makeRes = () => {
    const res = { statusCode: 200, body: undefined };
    res.status = (c) => {
        res.statusCode = c;
        return res;
    };
    res.json = (b) => {
        res.body = b;
        return res;
    };
    return res;
};

describe('wakatimeConnect / wakatimeDisconnect', () => {
    let session;
    beforeEach(() => {
        session = {};
    });

    test('connect stores the api key on the session', () => {
        const res = makeRes();
        wakatimeConnect({ body: { api_key: 'waka_123' }, session }, res);
        expect(session.wakatime_key).toBe('waka_123');
        expect(res.body).toEqual({ ok: true });
    });

    test('connect returns 400 when api_key is missing', () => {
        const res = makeRes();
        wakatimeConnect({ body: {}, session }, res);
        expect(res.statusCode).toBe(400);
        expect(session.wakatime_key).toBeUndefined();
    });

    test('connect tolerates a missing body', () => {
        const res = makeRes();
        wakatimeConnect({ session }, res);
        expect(res.statusCode).toBe(400);
    });

    test('disconnect clears the session key', () => {
        session.wakatime_key = 'waka_123';
        const res = makeRes();
        wakatimeDisconnect({ session }, res);
        expect(session.wakatime_key).toBeUndefined();
        expect(res.body).toEqual({ ok: true });
    });
});
