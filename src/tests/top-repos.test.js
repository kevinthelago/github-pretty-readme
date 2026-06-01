import { describe, test, expect, vi, afterEach } from 'vitest';
import { renderTopRepos, clampColumns, CARD_W, GAP } from '../tiles/top-repos.js';
import handler, { sortRepos, selectRepos, parseLimit, isTrue } from '../../api/top-repos.js';

const NOW = new Date('2026-06-01T00:00:00Z').getTime();

const card = (over = {}) => ({
    owner: 'octocat',
    name: 'hello-world',
    description: 'hi',
    stars: 10,
    forks: 2,
    openIssues: 1,
    language: 'JavaScript',
    languageHex: 'f1e05a',
    updatedAt: '2026-05-30T00:00:00Z',
    ...over,
});

describe('clampColumns', () => {
    test('defaults to 2 for missing/invalid input', () => {
        expect(clampColumns(undefined)).toBe(2);
        expect(clampColumns('abc')).toBe(2);
        expect(clampColumns(0)).toBe(2);
        expect(clampColumns(-5)).toBe(2);
    });
    test('caps at 3 and accepts numeric strings', () => {
        expect(clampColumns('1')).toBe(1);
        expect(clampColumns(3)).toBe(3);
        expect(clampColumns(9)).toBe(3);
    });
});

describe('renderTopRepos', () => {
    test('renders the empty state for no cards', () => {
        const svg = renderTopRepos([], { now: NOW });
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('No repositories to show');
    });

    test('handles non-array input gracefully', () => {
        expect(renderTopRepos(undefined, { now: NOW })).toContain('No repositories to show');
    });

    test('renders one nested card per repo', () => {
        const svg = renderTopRepos([card({ name: 'alpha' }), card({ name: 'beta' })], { now: NOW });
        expect(svg).toContain('alpha');
        expect(svg).toContain('beta');
        // two nested cards => two card-sized inner <svg> viewports
        expect(svg.match(new RegExp(`width="${CARD_W}"`, 'g'))).toHaveLength(2);
    });

    test('lays out a grid: width grows with columns, second row offsets down', () => {
        const cards = [card(), card(), card()];
        const svg = renderTopRepos(cards, { columns: 2, now: NOW });
        const twoCol = 2 * CARD_W + GAP;
        expect(svg).toContain(`width="${twoCol}"`);
        // third card wraps to row 2 at x=0
        expect(svg).toContain('translate(0, 216)');
    });

    test('single column places cards in one vertical stack', () => {
        const svg = renderTopRepos([card(), card()], { columns: 1, now: NOW });
        expect(svg).toContain(`width="${CARD_W}"`);
        expect(svg).toContain('translate(0, 216)');
    });

    test('produces a well-formed SVG document', () => {
        const svg = renderTopRepos([card()], { now: NOW });
        expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
});

describe('sortRepos', () => {
    const a = { name: 'a', stargazers_count: 5, pushed_at: '2026-01-01T00:00:00Z' };
    const b = { name: 'b', stargazers_count: 50, pushed_at: '2026-05-01T00:00:00Z' };
    const c = { name: 'c', stargazers_count: 1, pushed_at: '2026-06-01T00:00:00Z' };

    test('sorts by stars descending by default', () => {
        expect(sortRepos([a, b, c]).map((r) => r.name)).toEqual(['b', 'a', 'c']);
    });
    test('sorts by most recently pushed when sort=updated', () => {
        expect(sortRepos([a, b, c], 'updated').map((r) => r.name)).toEqual(['c', 'b', 'a']);
    });
    test('does not mutate the input array', () => {
        const input = [a, b];
        sortRepos(input);
        expect(input).toEqual([a, b]);
    });
});

describe('selectRepos', () => {
    const repos = [
        { name: 'fork-1', fork: true, stargazers_count: 100 },
        { name: 'owned-1', fork: false, stargazers_count: 50 },
        { name: 'owned-2', fork: false, stargazers_count: 80 },
    ];

    test('excludes forks by default', () => {
        const out = selectRepos(repos, {});
        expect(out.map((r) => r.name)).toEqual(['owned-2', 'owned-1']);
    });
    test('includes forks when opted in', () => {
        const out = selectRepos(repos, { includeForks: true });
        expect(out.map((r) => r.name)).toEqual(['fork-1', 'owned-2', 'owned-1']);
    });
    test('truncates to the limit', () => {
        expect(selectRepos(repos, { limit: 1, includeForks: true })).toHaveLength(1);
    });
});

describe('parseLimit / isTrue', () => {
    test('parseLimit defaults, clamps and floors', () => {
        expect(parseLimit(undefined)).toBe(6);
        expect(parseLimit('3')).toBe(3);
        expect(parseLimit('999')).toBe(12);
        expect(parseLimit('0')).toBe(6);
        expect(parseLimit('-4')).toBe(6);
    });
    test('isTrue recognizes true/1 only', () => {
        expect(isTrue('true')).toBe(true);
        expect(isTrue('1')).toBe(true);
        expect(isTrue('false')).toBe(false);
        expect(isTrue(undefined)).toBe(false);
    });
});

describe('GET /top-repos handler', () => {
    afterEach(() => vi.unstubAllGlobals());

    const mockRes = () => ({
        statusCode: 200,
        headers: {},
        body: undefined,
        status(c) {
            this.statusCode = c;
            return this;
        },
        type() {
            return this;
        },
        setHeader(k, v) {
            this.headers[k] = v;
        },
        send(b) {
            this.body = b;
            return this;
        },
    });

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

    test('400 when username is missing', async () => {
        const res = mockRes();
        await handler({ query: {} }, res);
        expect(res.statusCode).toBe(400);
    });

    test('502 when the repo fetch fails (non-OK)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: false, status: 404 })),
        );
        const res = mockRes();
        await handler({ query: { username: 'ghost' } }, res);
        expect(res.statusCode).toBe(502);
    });

    test('renders a grid SVG for a valid user', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                json: async () => [
                    ghRepo({ name: 'top', stargazers_count: 500 }),
                    ghRepo({ name: 'mid', stargazers_count: 100 }),
                ],
            })),
        );
        const res = mockRes();
        await handler({ query: { username: 'octocat' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('top');
        expect(res.body).toContain('mid');
    });

    test('renders the empty state when the user has only forks', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                json: async () => [ghRepo({ name: 'forked', fork: true })],
            })),
        );
        const res = mockRes();
        await handler({ query: { username: 'octocat' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('No repositories to show');
    });

    test('502 when the fetch throws', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network down');
            }),
        );
        const res = mockRes();
        await handler({ query: { username: 'octocat' } }, res);
        expect(res.statusCode).toBe(502);
    });
});

describe('route descriptor', () => {
    test('exposes {method, path, auth}', async () => {
        const { route } = await import('../../api/top-repos.js');
        expect(route).toMatchObject({ method: 'get', path: '/top-repos', auth: false });
    });
});
