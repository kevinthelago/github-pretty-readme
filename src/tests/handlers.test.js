import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the injectable GitHub client layer (#49/#50) so the handler tests exercise
// each handler's own logic — token resolution, auth gating, query parsing,
// rendering and error handling — without any live network or AI access.
vi.mock('../github/repos.js', () => ({
    getAllRepos: vi.fn(),
    getRepos: vi.fn(),
    getContents: vi.fn(),
    createGithubClient: vi.fn(),
    default: vi.fn(),
}));
// developer-rating fans out to workflow metrics; keep it offline and deterministic.
vi.mock('../github/workflow-metrics.js', () => ({ fetchWorkflowMetrics: vi.fn() }));

const { getAllRepos } = await import('../github/repos.js');
const { fetchWorkflowMetrics } = await import('../github/workflow-metrics.js');

const developerRating = (await import('../../api/developer-rating.js')).default;
const techList = (await import('../../api/tech-list.js')).default;
const techChart = (await import('../../api/tech-chart.js')).default;
const techSummary = (await import('../../api/tech-summary.js')).default;
const techCategories = (await import('../../api/tech-categories.js')).default;
const techSpider = (await import('../../api/tech-spider.js')).default;
const techCards = (await import('../../api/tech-cards.js')).default;
const techTreemap = (await import('../../api/tech-treemap.js')).default;

/** Minimal Express-style response double recording status, headers and body. */
const makeRes = () => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (k, v) => {
        res.headers[k.toLowerCase()] = v;
    };
    res.status = (c) => {
        res.statusCode = c;
        return res;
    };
    res.send = (b) => {
        res.body = b;
        return res;
    };
    res.json = (b) => {
        res.body = b;
        return res;
    };
    return res;
};

const call = (handler, query = {}, session = {}) => {
    const res = makeRes();
    return handler({ query, session }, res).then(() => res);
};

// A repo set spanning languages and known taxonomy topics so buildTechSeries
// produces a non-empty, multi-category series for the tech-* handlers.
const REPOS = [
    {
        name: 'a',
        language: 'JavaScript',
        topics: ['react'],
        description: 'a frontend app',
        size: 200,
        pushed_at: '2025-01-01T00:00:00Z',
        stargazers_count: 30,
        forks_count: 5,
    },
    {
        name: 'b',
        language: 'Python',
        topics: ['django', 'postgresql'],
        description: 'a backend api',
        size: 300,
        pushed_at: '2025-01-01T00:00:00Z',
        stargazers_count: 12,
        forks_count: 1,
    },
    {
        name: 'c',
        language: 'Go',
        topics: ['docker', 'kubernetes'],
        description: 'infra tooling',
        size: 150,
        pushed_at: '2025-01-01T00:00:00Z',
        stargazers_count: 4,
        forks_count: 0,
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    fetchWorkflowMetrics.mockResolvedValue([]);
});

afterEach(() => {
    delete process.env.GITHUB_TOKEN;
});

// ── shared auth gating ───────────────────────────────────────────────────────

describe('auth gating (401 when GitHub is not connected)', () => {
    const svgHandlers = [
        ['developer-rating', developerRating],
        ['tech-chart', techChart],
        ['tech-summary', techSummary],
        ['tech-spider', techSpider],
        ['tech-cards', techCards],
        ['tech-treemap', techTreemap],
    ];
    const jsonHandlers = [
        ['tech-list', techList],
        ['tech-categories', techCategories],
    ];

    test.each(svgHandlers)(
        '%s responds 401 when getAllRepos returns null',
        async (_name, handler) => {
            getAllRepos.mockResolvedValue(null);
            const res = await call(handler);
            expect(res.statusCode).toBe(401);
        },
    );

    test.each(jsonHandlers)(
        '%s responds 401 (json) when getAllRepos returns null',
        async (_name, handler) => {
            getAllRepos.mockResolvedValue(null);
            const res = await call(handler);
            expect(res.statusCode).toBe(401);
            expect(res.body).toMatchObject({ error: expect.any(String) });
        },
    );

    test('passes the session token to getAllRepos, falling back to GITHUB_TOKEN', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        await call(techChart, {}, { github_token: 'sess-tok' });
        expect(getAllRepos).toHaveBeenLastCalledWith('sess-tok');

        getAllRepos.mockResolvedValue(REPOS);
        process.env.GITHUB_TOKEN = 'env-tok';
        await call(techChart, {}, {});
        expect(getAllRepos).toHaveBeenLastCalledWith('env-tok');
    });
});

// ── developer-rating ─────────────────────────────────────────────────────────

describe('GET /developer-rating', () => {
    test('renders the rating tile as SVG on success', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(developerRating);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('DEVELOPER RATING');
    });

    test('returns 500 when the repo fetch throws', async () => {
        getAllRepos.mockRejectedValue(new Error('boom'));
        const res = await call(developerRating);
        expect(res.statusCode).toBe(500);
    });
});

// ── tech-list (JSON) ─────────────────────────────────────────────────────────

describe('GET /tech-list', () => {
    test('returns language counts sorted by frequency', async () => {
        getAllRepos.mockResolvedValue([...REPOS, { name: 'd', language: 'JavaScript' }]);
        const res = await call(techList);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('application/json');
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]).toMatchObject({ language: 'JavaScript', count: 2 });
        expect(res.body.map((l) => l.language)).toEqual(expect.arrayContaining(['Python', 'Go']));
    });

    test('drops excluded languages', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(techList, { exclude: 'JavaScript' });
        expect(res.body.map((l) => l.language)).not.toContain('JavaScript');
    });

    test('sorts alphabetically when requested', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(techList, { sort: 'alpha' });
        const names = res.body.map((l) => l.language);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
});

// ── tech-chart / tech-summary (SVG) ──────────────────────────────────────────

describe('GET /tech-chart', () => {
    test('renders a donut chart by default', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(techChart);
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<svg');
        expect(res.body).not.toContain('<polygon'); // donut, not spider
    });

    test('renders a spider chart when chart=spider', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(techChart, { chart: 'spider' });
        expect(res.body).toContain('<polygon');
    });
});

describe('GET /tech-summary', () => {
    test('renders an icon grid SVG for languages with known icons', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(techSummary, { background: 'geometric' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
    });
});

// ── tech-categories (JSON) ───────────────────────────────────────────────────

describe('GET /tech-categories', () => {
    test('returns the categories with at least one detected technology', async () => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(techCategories);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const categories = res.body.map((c) => c.category);
        expect(categories).toEqual(expect.arrayContaining(['languages', 'frameworks']));
        expect(res.body[0]).toMatchObject({ label: expect.any(String), count: expect.any(Number) });
    });
});

// ── category visualizations: spider / cards / treemap (SVG) ───────────────────

describe('category visualization handlers', () => {
    const handlers = [
        ['tech-spider', techSpider],
        ['tech-cards', techCards],
        ['tech-treemap', techTreemap],
    ];

    test.each(handlers)('%s renders an SVG when a series is built', async (_name, handler) => {
        getAllRepos.mockResolvedValue(REPOS);
        const res = await call(handler);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
    });

    test.each(handlers)('%s responds 400 when no series can be built', async (_name, handler) => {
        getAllRepos.mockResolvedValue([{ name: 'empty' }]); // no language, no topics
        const res = await call(handler);
        expect(res.statusCode).toBe(400);
    });
});
