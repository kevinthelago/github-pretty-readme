import { describe, test, expect } from 'vitest';
import { computeRating, computeInsights } from '../github/developer-rating.js';

// pushed_at relative to "now" so activity scoring is deterministic per run.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const repo = (over = {}) => ({
    name: 'repo',
    html_url: 'https://github.com/u/repo',
    language: 'JavaScript',
    description: 'A meaningful description well over ten characters',
    topics: ['react'],
    size: 200,
    pushed_at: daysAgo(5),
    stargazers_count: 10,
    forks_count: 2,
    ...over,
});

const RICH_REPOS = [
    repo({
        name: 'a',
        language: 'JavaScript',
        topics: ['react', 'aws'],
        stargazers_count: 100,
        forks_count: 20,
    }),
    repo({
        name: 'b',
        language: 'Python',
        topics: ['django', 'postgresql'],
        pushed_at: daysAgo(40),
    }),
    repo({ name: 'c', language: 'Go', topics: ['docker', 'kubernetes'], pushed_at: daysAgo(200) }),
    repo({
        name: 'd',
        language: 'Rust',
        topics: ['openai'],
        description: 'short',
        size: 10,
        pushed_at: daysAgo(800),
    }),
];

const ALL_DIMENSIONS = ['breadth', 'depth', 'diversity', 'activity', 'impact'];

describe('computeRating', () => {
    test('returns every base dimension plus overall and tier', () => {
        const r = computeRating(RICH_REPOS);
        for (const dim of ALL_DIMENSIONS) {
            expect(r[dim], dim).toBeTypeOf('number');
            expect(r[dim]).toBeGreaterThanOrEqual(0);
            expect(r[dim]).toBeLessThanOrEqual(100);
        }
        expect(r.overall).toBeGreaterThanOrEqual(0);
        expect(r.overall).toBeLessThanOrEqual(100);
        expect(r.tier).toMatchObject({ label: expect.any(String), color: expect.any(String) });
    });

    test('tier matches the overall score threshold', () => {
        const r = computeRating(RICH_REPOS);
        expect(r.overall).toBeGreaterThanOrEqual(r.tier.min);
    });

    test('empty repo list scores zero across the board and lands in tier D', () => {
        const r = computeRating([]);
        for (const dim of ALL_DIMENSIONS) expect(r[dim]).toBe(0);
        expect(r.overall).toBe(0);
        expect(r.tier.label).toBe('D');
    });

    test('omits engineering and codeQuality when no optional data is supplied', () => {
        const r = computeRating(RICH_REPOS);
        expect(r).not.toHaveProperty('engineering');
        expect(r).not.toHaveProperty('codeQuality');
    });

    test('includes engineering when workflow metrics are supplied', () => {
        const metrics = [
            { hasCi: true, hasDeployments: true, hasClosedIssues: true, hasPrs: true },
            { hasCi: true, hasDeployments: false, hasClosedIssues: true, hasPrs: false },
        ];
        const r = computeRating(RICH_REPOS, metrics);
        expect(r.engineering).toBeTypeOf('number');
        expect(r.engineering).toBeGreaterThan(0);
    });

    test('includes codeQuality averaged from scan data', () => {
        const scanData = {
            a: { codeQuality: { overall: 80 } },
            b: { codeQuality: { overall: 60 } },
        };
        const r = computeRating(RICH_REPOS, null, scanData);
        expect(r.codeQuality).toBe(70); // mean of 80 and 60
    });

    test('drops codeQuality when scan data has no numeric scores', () => {
        const r = computeRating(RICH_REPOS, null, { a: { codeQuality: {} } });
        expect(r).not.toHaveProperty('codeQuality');
    });

    test('higher stars/forks yield a higher impact score', () => {
        const low = computeRating([repo({ stargazers_count: 0, forks_count: 0 })]);
        const high = computeRating([repo({ stargazers_count: 5000, forks_count: 1000 })]);
        expect(high.impact).toBeGreaterThan(low.impact);
    });

    test('more recent pushes yield a higher activity score', () => {
        const stale = computeRating([repo({ pushed_at: daysAgo(900) })]);
        const fresh = computeRating([repo({ pushed_at: daysAgo(1) })]);
        expect(fresh.activity).toBeGreaterThan(stale.activity);
    });
});

describe('computeInsights', () => {
    test('returns detail data for every dimension', () => {
        const insights = computeInsights(RICH_REPOS);
        expect(insights.breadth.missingCategories).toBeInstanceOf(Array);
        expect(insights.depth).toBeInstanceOf(Array);
        expect(insights.diversity).toBeInstanceOf(Array);
        expect(insights.activity).toBeInstanceOf(Array);
        expect(insights.impact).toBeInstanceOf(Array);
        expect(insights.engineering).toBeNull();
        expect(insights.codeQuality).toBeNull();
    });

    test('impact details are sorted by weighted popularity, descending', () => {
        const insights = computeInsights(RICH_REPOS);
        const weighted = insights.impact.map((e) => e.stars + e.forks * 2);
        const sorted = [...weighted].sort((a, b) => b - a);
        expect(weighted).toEqual(sorted);
    });

    test('breadth details list discovered languages and missing categories', () => {
        const insights = computeInsights(RICH_REPOS);
        expect(insights.breadth.languages).toEqual(
            expect.arrayContaining(['JavaScript', 'Python', 'Go', 'Rust']),
        );
        expect(insights.breadth.coveredCategories).toContain('languages');
    });

    test('engineering details populate when metrics are present', () => {
        const insights = computeInsights(RICH_REPOS, [
            { hasCi: true, hasDeployments: false, hasClosedIssues: true, hasPrs: false },
        ]);
        expect(insights.engineering.total).toBe(1);
        expect(insights.engineering.ciCount).toBe(1);
    });
});
