/**
 * Cross-cutting endpoint contract suite for the Phase 5 visualization tiles --
 * active-languages, top-repos, activity-clock and wakatime (#71).
 *
 * The per-tile suites already cover each renderer internals and the data layer.
 * This file deliberately does NOT duplicate them: it locks in the SHARED
 * contract every Phase 5 endpoint must honour, asserted uniformly for all four
 * in one place:
 *   1. a populated-data render produces a valid image/svg+xml SVG document;
 *   2. a missing-username / no-data request degrades to a graceful empty-state
 *      SVG (a message, not a crash or a broken image);
 *   3. the ?background= theme param is honoured by the tiles that accept one.
 *
 * Every test mocks the GitHub / WakaTime data layer; NO test performs network
 * I/O, and all fixtures are deterministic (no dependence on the current time).
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const makeRes = () => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (k, v) => {
        res.headers[k] = v;
        res.headers[k.toLowerCase()] = v;
        return res;
    };
    res.status = (c) => {
        res.statusCode = c;
        return res;
    };
    res.type = () => res;
    res.send = (b) => {
        res.body = b;
        return res;
    };
    return res;
};

const expectSvgDocument = (svg) => {
    expect(typeof svg).toBe('string');
    // tiles built on the Tile base class emit leading whitespace before <svg>.
    expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
};

const SVG_CONTENT_TYPE = 'image/svg+xml';

vi.mock('../github/recent-languages.js', () => ({
    getRecentLanguageWeights: vi.fn(),
    createGithubClient: vi.fn(() => ({})),
}));

const { getRecentLanguageWeights } = await import('../github/recent-languages.js');
const activeLanguages = (await import('../../api/active-languages.js')).default;
const { _activeLanguagesCache } = await import('../../api/active-languages.js');

describe('GET /active-languages -- endpoint contract', () => {
    beforeEach(() => {
        _activeLanguagesCache.clear();
        getRecentLanguageWeights.mockReset();
    });

    test('populated data renders a valid SVG with key content and the SVG content type', async () => {
        getRecentLanguageWeights.mockResolvedValue({
            langs: [
                { language: 'JavaScript', count: 30 },
                { language: 'Python', count: 20 },
            ],
            totalCommits: 50,
            days: 90,
        });
        const res = makeRes();
        await activeLanguages({ query: { username: 'octocat' }, session: {} }, res);

        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('Active Languages');
        expect(res.body).toContain('JavaScript');
    });

    test('missing username degrades to a graceful empty-state SVG (no crash, no fetch)', async () => {
        const res = makeRes();
        await activeLanguages({ query: {}, session: {} }, res);

        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('No recent commit activity');
        expect(getRecentLanguageWeights).not.toHaveBeenCalled();
    });

    test('no recent data still renders the empty-state tile, not an error', async () => {
        getRecentLanguageWeights.mockResolvedValue({ langs: [], totalCommits: 0, days: 90 });
        const res = makeRes();
        await activeLanguages({ query: { username: 'ghost' }, session: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expect(res.body).toContain('No recent commit activity');
    });

    test('a thrown data-layer error degrades to the empty-state SVG, not a 5xx', async () => {
        getRecentLanguageWeights.mockRejectedValue(new Error('upstream down'));
        const res = makeRes();
        await activeLanguages({ query: { username: 'octocat' }, session: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('No recent commit activity');
    });

    test('the ?background= theme param is applied to the tile', async () => {
        getRecentLanguageWeights.mockResolvedValue({
            langs: [{ language: 'Go', count: 9 }],
            totalCommits: 9,
            days: 90,
        });
        const res = makeRes();
        await activeLanguages(
            { query: { username: 'octocat', background: 'geometric' }, session: {} },
            res,
        );
        expect(res.body).toContain('geometric-background');
    });
});

vi.mock('../github/repos.js', () => ({
    getRepos: vi.fn(),
    createGithubClient: vi.fn(() => ({})),
}));

const { getRepos } = await import('../github/repos.js');
const topRepos = (await import('../../api/top-repos.js')).default;

const ghRepo = (over = {}) => ({
    owner: { login: 'octocat' },
    name: 'repo',
    description: 'hi',
    stargazers_count: 10,
    forks_count: 2,
    open_issues_count: 1,
    language: 'JavaScript',
    pushed_at: '2026-05-30T00:00:00Z',
    fork: false,
    ...over,
});

describe('GET /top-repos -- endpoint contract', () => {
    beforeEach(() => getRepos.mockReset());

    test('populated data renders a valid SVG grid with the SVG content type', async () => {
        getRepos.mockResolvedValue([
            ghRepo({ name: 'top', stargazers_count: 500 }),
            ghRepo({ name: 'mid', stargazers_count: 100 }),
        ]);
        const res = makeRes();
        await topRepos({ query: { username: 'octocat' }, session: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('top');
        expect(res.body).toContain('mid');
    });

    test('missing username is a 400, before any data fetch', async () => {
        const res = makeRes();
        await topRepos({ query: {}, session: {} }, res);
        expect(res.statusCode).toBe(400);
        expect(getRepos).not.toHaveBeenCalled();
    });

    test('a user with only forks renders the graceful empty-state SVG', async () => {
        getRepos.mockResolvedValue([ghRepo({ name: 'forked', fork: true })]);
        const res = makeRes();
        await topRepos({ query: { username: 'octocat' }, session: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('No repositories to show');
    });

    test('a null repo list (fetch failure) is a 502, not a crash', async () => {
        getRepos.mockResolvedValue(null);
        const res = makeRes();
        await topRepos({ query: { username: 'octocat' }, session: {} }, res);
        expect(res.statusCode).toBe(502);
    });
});

vi.mock('../github/contribution-times.js', () => ({
    getContributionTimes: vi.fn(),
}));

const { getContributionTimes } = await import('../github/contribution-times.js');
const activityClock = (await import('../../api/activity-clock.js')).default;

// 2024-01-01 is a Monday (UTC day 1); 2024-01-03 is a Wednesday (UTC day 3).
const CLOCK_FIXTURE = [
    '2024-01-01T09:05:00Z',
    '2024-01-01T09:30:00Z',
    '2024-01-01T09:45:00Z',
    '2024-01-01T14:00:00Z',
    '2024-01-03T14:10:00Z',
];

describe('GET /activity-clock -- endpoint contract', () => {
    beforeEach(() => getContributionTimes.mockReset());

    test('populated data renders a valid heatmap SVG with the SVG content type', async () => {
        getContributionTimes.mockResolvedValue(CLOCK_FIXTURE);
        const res = makeRes();
        await activityClock({ query: { username: 'octocat' }, session: {} }, res);

        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('BUSIEST');
        expect(res.body).toContain('Monday');
    });

    test('missing username degrades to the graceful empty-state SVG (no fetch)', async () => {
        const res = makeRes();
        await activityClock({ query: {}, session: {} }, res);

        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('No recent contribution activity found');
        expect(getContributionTimes).not.toHaveBeenCalled();
    });

    test('no contribution data renders the empty-state SVG, not a crash', async () => {
        getContributionTimes.mockResolvedValue([]);
        const res = makeRes();
        await activityClock({ query: { username: 'ghost' }, session: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe(SVG_CONTENT_TYPE);
        expect(res.body).toContain('No recent contribution activity found');
    });

    test('the ?background= theme param is applied to the tile', async () => {
        getContributionTimes.mockResolvedValue(CLOCK_FIXTURE);
        const res = makeRes();
        await activityClock(
            { query: { username: 'octocat', background: 'geometric' }, session: {} },
            res,
        );
        expect(res.body).toContain('geometric-background');
    });
});

vi.mock('../wakatime/client.js', () => ({
    createWakatimeClient: vi.fn(),
}));

const { createWakatimeClient } = await import('../wakatime/client.js');
const wakatime = (await import('../../api/wakatime.js')).default;

const WAKA_LANGS = [
    { name: 'JavaScript', total_seconds: 7200, percent: 50 },
    { name: 'Python', total_seconds: 3600, percent: 25 },
];

const stubWakaClient = (impl) =>
    createWakatimeClient.mockReturnValue({ getTimeByLanguage: vi.fn(impl) });

describe('GET /wakatime -- endpoint contract', () => {
    beforeEach(() => {
        createWakatimeClient.mockReset();
        delete process.env.WAKATIME_API_KEY;
    });
    afterEach(() => {
        delete process.env.WAKATIME_API_KEY;
    });

    test('populated data renders a valid SVG with the SVG content type', async () => {
        stubWakaClient(async () => WAKA_LANGS);
        const res = makeRes();
        await wakatime({ query: {}, session: { wakatime_key: 'waka_abc' } }, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe(SVG_CONTENT_TYPE);
        expectSvgDocument(res.body);
        expect(res.body).toContain('CODING TIME');
        expect(res.body).toContain('JavaScript');
    });

    test('no connected key is a 401 before any client is built (graceful, not a crash)', async () => {
        const res = makeRes();
        await wakatime({ query: {}, session: {} }, res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toContain('not connected');
        expect(createWakatimeClient).not.toHaveBeenCalled();
    });

    test('an empty/no-data range is a 404 empty-state, not a crash', async () => {
        stubWakaClient(async () => []);
        const res = makeRes();
        await wakatime({ query: {}, session: { wakatime_key: 'k' } }, res);
        expect(res.statusCode).toBe(404);

        stubWakaClient(async () => null);
        const res2 = makeRes();
        await wakatime({ query: {}, session: { wakatime_key: 'k' } }, res2);
        expect(res2.statusCode).toBe(404);
    });
});
