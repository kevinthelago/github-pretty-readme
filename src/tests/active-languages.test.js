import { describe, test, expect, beforeEach } from 'vitest';
import { getRecentLanguageWeights, createGithubClient } from '../github/recent-languages.js';
import { renderActiveLanguages } from '../tiles/active-languages.js';
import handler, { _activeLanguagesCache } from '../../api/active-languages.js';

const daysAgoIso = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const mockClient = (repos, commitCounts = {}) => ({
    calls: [],
    async getRepos() {
        return repos;
    },
    async getRecentCommitCount(owner, repo) {
        this.calls.push(repo);
        return commitCounts[repo] ?? 0;
    },
});

const fakeRes = () => {
    const res = { headers: {}, body: undefined, statusCode: 200 };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.send = (b) => { res.body = b; return res; };
    return res;
};

describe('getRecentLanguageWeights', () => {
    test('weights languages by recent commit count, not repo count', async () => {
        const repos = [
            { name: 'a', language: 'JavaScript', pushed_at: daysAgoIso(2), owner: { login: 'u' } },
            { name: 'b', language: 'JavaScript', pushed_at: daysAgoIso(5), owner: { login: 'u' } },
            { name: 'c', language: 'Python', pushed_at: daysAgoIso(1), owner: { login: 'u' } },
        ];
        const client = mockClient(repos, { a: 3, b: 2, c: 40 });
        const result = await getRecentLanguageWeights('u', { client, days: 90 });

        expect(result.langs[0]).toEqual({ language: 'Python', count: 40 });
        expect(result.langs[1]).toEqual({ language: 'JavaScript', count: 5 });
        expect(result.totalCommits).toBe(45);
        expect(result.days).toBe(90);
    });

    test('excludes repos pushed outside the window', async () => {
        const repos = [
            { name: 'recent', language: 'Go', pushed_at: daysAgoIso(10), owner: { login: 'u' } },
            { name: 'stale', language: 'Rust', pushed_at: daysAgoIso(400), owner: { login: 'u' } },
        ];
        const client = mockClient(repos, { recent: 5, stale: 99 });
        const result = await getRecentLanguageWeights('u', { client, days: 90 });

        expect(result.langs).toEqual([{ language: 'Go', count: 5 }]);
        expect(client.calls).toEqual(['recent']);
    });

    test('excludes repos with no detected language', async () => {
        const repos = [
            { name: 'a', language: null, pushed_at: daysAgoIso(1), owner: { login: 'u' } },
            { name: 'b', language: 'Go', pushed_at: daysAgoIso(1), owner: { login: 'u' } },
        ];
        const client = mockClient(repos, { a: 10, b: 4 });
        const result = await getRecentLanguageWeights('u', { client });
        expect(result.langs).toEqual([{ language: 'Go', count: 4 }]);
    });

    test('drops languages with zero recent commits', async () => {
        const repos = [
            { name: 'a', language: 'Go', pushed_at: daysAgoIso(1), owner: { login: 'u' } },
        ];
        const client = mockClient(repos, { a: 0 });
        const result = await getRecentLanguageWeights('u', { client });
        expect(result.langs).toEqual([]);
        expect(result.totalCommits).toBe(0);
    });

    test('defaults to a 90 day window and clamps bad values', async () => {
        const repos = [{ name: 'a', language: 'Go', pushed_at: daysAgoIso(1), owner: { login: 'u' } }];
        const client = mockClient(repos, { a: 1 });
        expect((await getRecentLanguageWeights('u', { client })).days).toBe(90);
        expect((await getRecentLanguageWeights('u', { client, days: -3 })).days).toBe(90);
        expect((await getRecentLanguageWeights('u', { client, days: 30 })).days).toBe(30);
    });

    test('returns null when the repo list cannot be fetched', async () => {
        const client = { async getRepos() { return null; }, async getRecentCommitCount() { return 0; } };
        const result = await getRecentLanguageWeights('u', { client });
        expect(result).toBeNull();
    });

    test('falls back to the username when a repo has no owner', async () => {
        const repos = [{ name: 'a', language: 'Go', pushed_at: daysAgoIso(1) }];
        const client = mockClient(repos, { a: 2 });
        const result = await getRecentLanguageWeights('u', { client });
        expect(result.langs).toEqual([{ language: 'Go', count: 2 }]);
    });
});

describe('createGithubClient', () => {
    test('builds a client exposing the data-layer interface', () => {
        const client = createGithubClient('tok');
        expect(typeof client.getRepos).toBe('function');
        expect(typeof client.getRecentCommitCount).toBe('function');
    });
});

describe('renderActiveLanguages', () => {
    const sample = {
        langs: [
            { language: 'JavaScript', count: 30 },
            { language: 'Python', count: 20 },
            { language: 'Go', count: 10 },
        ],
        totalCommits: 60,
        days: 90,
    };

    test('returns a complete SVG document', () => {
        const svg = renderActiveLanguages(sample);
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
        expect(svg).toContain('Active Languages');
    });

    test('renders one donut segment per language', () => {
        const svg = renderActiveLanguages(sample);
        const segs = (svg.match(/<path d="M /g) || []).length;
        expect(segs).toBe(3);
        expect(svg).toContain('JavaScript');
        expect(svg).toContain('Python');
        expect(svg).toContain('Go');
    });

    test('shows the total commit count and the window in the title', () => {
        const svg = renderActiveLanguages(sample);
        expect(svg).toContain('60');
        expect(svg).toContain('last 90 days');
    });

    test('renders a graceful empty state with no segments', () => {
        const svg = renderActiveLanguages({ langs: [], totalCommits: 0, days: 30 });
        expect(svg).toContain('No recent commit activity');
        expect(svg).toContain('last 30 days');
        expect(svg).not.toContain('<path d="M ');
    });

    test('handles missing data object gracefully', () => {
        const svg = renderActiveLanguages(undefined);
        expect(svg).toContain('No recent commit activity');
        expect(svg).toContain('last 90 days');
    });

    test('collapses the long tail into an Other segment', () => {
        const langs = Array.from({ length: 12 }, (_, i) => ({ language: 'L' + i, count: 12 - i }));
        const svg = renderActiveLanguages({ langs, totalCommits: 78, days: 90 });
        expect(svg).toContain('Other');
    });

    test('handles a single language without a degenerate full circle', () => {
        const svg = renderActiveLanguages({ langs: [{ language: 'Go', count: 7 }], totalCommits: 7, days: 90 });
        expect(svg).toContain('Go');
        expect(svg).toContain('<path d="M ');
    });

    test('applies a themed background when provided', () => {
        const bg = (h, w) => '<rect class="marker" width="' + w + '" height="' + h + '"/>';
        const svg = renderActiveLanguages(sample, bg);
        expect(svg).toContain('class="marker"');
    });
});

describe('_activeLanguagesCache', () => {
    beforeEach(() => _activeLanguagesCache.clear());

    test('returns null for unknown keys', () => {
        expect(_activeLanguagesCache.get('nobody', 90)).toBeNull();
    });

    test('stores and retrieves a value keyed by username + days', () => {
        const value = { langs: [{ language: 'Go', count: 1 }], totalCommits: 1, days: 90 };
        _activeLanguagesCache.set('u', 90, value);
        expect(_activeLanguagesCache.get('u', 90)).toBe(value);
        expect(_activeLanguagesCache.get('u', 30)).toBeNull();
    });
});

describe('GET /active-languages handler', () => {
    beforeEach(() => _activeLanguagesCache.clear());

    test('sets the SVG content type', async () => {
        const res = fakeRes();
        await handler({ query: {} }, res);
        expect(res.headers['Content-Type']).toBe('image/svg+xml');
    });

    test('renders an empty tile when username is missing', async () => {
        const res = fakeRes();
        await handler({ query: { days: '45' } }, res);
        expect(res.body).toContain('No recent commit activity');
        expect(res.body).toContain('last 45 days');
    });

    test('clamps an out-of-range days value', async () => {
        const res = fakeRes();
        await handler({ query: { days: '99999' } }, res);
        expect(res.body).toContain('last 365 days');
    });

    test('falls back to 90 days for a non-numeric days value', async () => {
        const res = fakeRes();
        await handler({ query: { days: 'abc' } }, res);
        expect(res.body).toContain('last 90 days');
    });
});
