import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderWakatimeChart, formatDuration } from '../tiles/wakatime-chart.js';

// Mock the injectable WakaTime client (#68) so the handler test exercises the
// endpoint's own logic — key resolution, range parsing, rendering, the empty
// and error paths — with no live network access.
vi.mock('../wakatime/client.js', () => ({
    createWakatimeClient: vi.fn(),
}));

const { createWakatimeClient } = await import('../wakatime/client.js');
const wakatime = (await import('../../api/wakatime.js')).default;

const LANGS = [
    { name: 'JavaScript', total_seconds: 7200, percent: 50 },
    { name: 'Python', total_seconds: 3600, percent: 25 },
    { name: 'Go', total_seconds: 1800, percent: 12.5 },
];

/** Minimal Express-style response double recording status, headers and body. */
const makeRes = () => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (k, v) => {
        res.headers[k.toLowerCase()] = v;
        return res;
    };
    res.status = (c) => {
        res.statusCode = c;
        return res;
    };
    res.send = (b) => {
        res.body = b;
        return res;
    };
    return res;
};

const call = (query = {}, session = {}) => {
    const res = makeRes();
    return wakatime({ query, session }, res).then(() => res);
};

/** Stubs createWakatimeClient to return a client whose getTimeByLanguage resolves/rejects. */
const stubClient = (impl) => {
    createWakatimeClient.mockReturnValue({ getTimeByLanguage: vi.fn(impl) });
};

const expectSvgDocument = (svg) => {
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
};

// ── tile renderer ────────────────────────────────────────────────────────────

describe('renderWakatimeChart', () => {
    test('renders a bar per language with name, formatted time and percent', () => {
        const svg = renderWakatimeChart(LANGS);
        expectSvgDocument(svg);
        expect(svg).toContain('CODING TIME');
        expect(svg).toContain('WAKATIME');
        for (const l of LANGS) expect(svg).toContain(l.name);
        expect(svg).toContain('50.0%');
        expect(svg).toContain('2h'); // JavaScript: 7200s
    });

    test('shows the total coding time across all languages', () => {
        const svg = renderWakatimeChart(LANGS);
        // 7200 + 3600 + 1800 = 12600s -> 3h 30m
        expect(svg).toContain('3h 30m');
    });

    test('caps the bars at the top five languages', () => {
        const many = Array.from({ length: 8 }, (_, i) => ({
            name: `Lang${i}`,
            total_seconds: 600,
            percent: 12.5,
        }));
        const svg = renderWakatimeChart(many);
        expect(svg).toContain('Lang4');
        expect(svg).not.toContain('Lang5');
    });

    test('labels the panel with the requested range', () => {
        expect(renderWakatimeChart(LANGS, { range: 'all_time' })).toContain('ALL TIME');
        expect(renderWakatimeChart(LANGS, { range: 'last_30_days' })).toContain('LAST 30 DAYS');
        // unknown range falls back to the default label
        expect(renderWakatimeChart(LANGS, { range: 'bogus' })).toContain('LAST 7 DAYS');
    });
});

describe('formatDuration', () => {
    test('formats hours and minutes, minutes only, and sub-minute durations', () => {
        expect(formatDuration(7800)).toBe('2h 10m');
        expect(formatDuration(3600)).toBe('1h');
        expect(formatDuration(900)).toBe('15m');
        expect(formatDuration(30)).toBe('<1m');
    });
});

// ── GET /wakatime handler ────────────────────────────────────────────────────

describe('GET /wakatime', () => {
    beforeEach(() => {
        createWakatimeClient.mockReset();
        delete process.env.WAKATIME_API_KEY;
    });

    test('401 when no key is connected or configured', async () => {
        const res = await call();
        expect(res.statusCode).toBe(401);
        expect(res.body).toContain('not connected');
        expect(createWakatimeClient).not.toHaveBeenCalled();
    });

    test('renders an SVG using the session key', async () => {
        stubClient(async () => LANGS);
        const res = await call({}, { wakatime_key: 'waka_abc' });
        expect(createWakatimeClient).toHaveBeenCalledWith({ apiKey: 'waka_abc' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expectSvgDocument(res.body);
    });

    test('falls back to the WAKATIME_API_KEY env var', async () => {
        process.env.WAKATIME_API_KEY = 'env_key';
        stubClient(async () => LANGS);
        const res = await call();
        expect(createWakatimeClient).toHaveBeenCalledWith({ apiKey: 'env_key' });
        expect(res.statusCode).toBe(200);
    });

    test('passes a valid range through and defaults an invalid one', async () => {
        const getTimeByLanguage = vi.fn(async () => LANGS);
        createWakatimeClient.mockReturnValue({ getTimeByLanguage });

        await call({ range: 'last_year' }, { wakatime_key: 'k' });
        expect(getTimeByLanguage).toHaveBeenLastCalledWith('last_year');

        await call({ range: 'nonsense' }, { wakatime_key: 'k' });
        expect(getTimeByLanguage).toHaveBeenLastCalledWith('last_7_days');
    });

    test('404 when the range has no language data', async () => {
        stubClient(async () => []);
        const res = await call({}, { wakatime_key: 'k' });
        expect(res.statusCode).toBe(404);

        stubClient(async () => null);
        const res2 = await call({}, { wakatime_key: 'k' });
        expect(res2.statusCode).toBe(404);
    });

    test('500 on an upstream/transport error', async () => {
        stubClient(async () => {
            throw new Error('boom');
        });
        const res = await call({}, { wakatime_key: 'k' });
        expect(res.statusCode).toBe(500);
        expect(res.body).toBe('boom');
    });
});

describe('route descriptor', () => {
    test('exposes {method, path, auth}', async () => {
        const { route } = await import('../../api/wakatime.js');
        expect(route).toMatchObject({ method: 'get', path: '/wakatime', auth: false });
    });
});
