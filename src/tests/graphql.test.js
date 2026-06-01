import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { gql, getContributionCalendar, getUserStats } from '../github/graphql.js';

/** Build a Response-like stub for the global fetch mock. */
const okJson = (body) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
});

describe('gql', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        delete process.env.GITHUB_TOKEN;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    test('POSTs to the GraphQL endpoint with bearer auth and returns data', async () => {
        fetch.mockResolvedValue(okJson({ data: { viewer: { login: 'kev' } } }));

        const data = await gql('tok-123', 'query { viewer { login } }', { a: 1 });

        expect(data).toEqual({ viewer: { login: 'kev' } });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe('https://api.github.com/graphql');
        expect(opts.method).toBe('POST');
        expect(opts.headers.Authorization).toBe('Bearer tok-123');
        expect(JSON.parse(opts.body)).toEqual({
            query: 'query { viewer { login } }',
            variables: { a: 1 },
        });
    });

    test('falls back to GITHUB_TOKEN when no session token is passed', async () => {
        process.env.GITHUB_TOKEN = 'env-token';
        fetch.mockResolvedValue(okJson({ data: {} }));

        await gql(undefined, 'query { viewer { login } }');

        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer env-token');
    });

    test('throws when no token is available', async () => {
        await expect(gql(undefined, 'query {}')).rejects.toThrow(/no github token/i);
        expect(fetch).not.toHaveBeenCalled();
    });

    test('throws on a non-ok HTTP response', async () => {
        fetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) });
        await expect(gql('tok', 'query {}')).rejects.toThrow(/401/);
    });

    test('throws when the response carries GraphQL errors', async () => {
        fetch.mockResolvedValue(okJson({ errors: [{ message: 'Field bad' }, { message: 'Nope' }] }));
        await expect(gql('tok', 'query {}')).rejects.toThrow(/Field bad; Nope/);
    });
});

describe('getContributionCalendar', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
    afterEach(() => vi.unstubAllGlobals());

    test('returns the contribution calendar object', async () => {
        const calendar = {
            totalContributions: 1234,
            weeks: [{ contributionDays: [{ date: '2025-01-01', weekday: 3, contributionCount: 2, color: '#abc' }] }],
        };
        fetch.mockResolvedValue(okJson({
            data: { user: { contributionsCollection: { contributionCalendar: calendar } } },
        }));

        const result = await getContributionCalendar('tok', 'kevinthelago');
        expect(result).toEqual(calendar);
    });

    test('throws when the user has no calendar', async () => {
        fetch.mockResolvedValue(okJson({ data: { user: null } }));
        await expect(getContributionCalendar('tok', 'ghost')).rejects.toThrow(/ghost/);
    });
});

describe('getUserStats', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
    afterEach(() => vi.unstubAllGlobals());

    test('aggregates stats including a summed star count', async () => {
        fetch.mockResolvedValue(okJson({
            data: {
                user: {
                    login: 'kev',
                    name: 'Kevin',
                    followers: { totalCount: 10 },
                    pullRequests: { totalCount: 42 },
                    issues: { totalCount: 7 },
                    repositories: { totalCount: 30, nodes: [{ stargazerCount: 5 }, { stargazerCount: 3 }] },
                    contributionsCollection: { totalCommitContributions: 900, restrictedContributionsCount: 0 },
                    repositoriesContributedTo: { totalCount: 12 },
                },
            },
        }));

        const stats = await getUserStats('tok', 'kev');
        expect(stats).toEqual({
            login: 'kev',
            name: 'Kevin',
            stars: 8,
            commits: 900,
            prs: 42,
            issues: 7,
            followers: 10,
            repos: 30,
            contributedTo: 12,
        });
    });

    test('throws when the user is not found', async () => {
        fetch.mockResolvedValue(okJson({ data: { user: null } }));
        await expect(getUserStats('tok', 'ghost')).rejects.toThrow(/ghost/);
    });
});
