import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the GraphQL data layer used by both handlers. Path resolves to the same
// absolute module the handlers import (../src/github/graphql.js).
vi.mock('../github/graphql.js', () => ({
    getContributionCalendar: vi.fn(),
    getUserStats: vi.fn(),
}));

import { getContributionCalendar, getUserStats } from '../github/graphql.js';
import contributionGraph, { route as contribRoute } from '../../api/contribution-graph.js';
import statsCard, { route as statsRoute } from '../../api/stats-card.js';

/** Minimal Express-like response double recording status/headers/body. */
const mockRes = () => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.send = (b) => { res.body = b; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};

const calendar = {
    totalContributions: 5,
    weeks: [{ contributionDays: [{ date: '2025-01-01', weekday: 3, contributionCount: 5, color: '#39d353' }] }],
};
const stats = { login: 'kev', name: 'Kevin', stars: 10, commits: 20, prs: 3, issues: 1, followers: 4, repos: 6, contributedTo: 2 };

beforeEach(() => vi.clearAllMocks());
afterEach(() => { delete process.env.GITHUB_TOKEN; });

describe('GET /contribution-graph', () => {
    test('exports a route descriptor matching the mounted path', () => {
        expect(contribRoute).toEqual({ method: 'get', path: '/contribution-graph', auth: false });
    });

    test('400 when username is missing', async () => {
        const res = mockRes();
        await contributionGraph({ query: {}, session: {} }, res);
        expect(res.statusCode).toBe(400);
        expect(getContributionCalendar).not.toHaveBeenCalled();
    });

    test('200 SVG when the calendar resolves', async () => {
        getContributionCalendar.mockResolvedValue(calendar);
        const res = mockRes();
        await contributionGraph({ query: { username: 'kev' }, session: {} }, res);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('@kev');
    });

    test('uses the session username and token when query omits them', async () => {
        getContributionCalendar.mockResolvedValue(calendar);
        const res = mockRes();
        await contributionGraph({ query: {}, session: { github_username: 'sessuser', github_token: 'sess-tok' } }, res);
        expect(getContributionCalendar).toHaveBeenCalledWith('sess-tok', 'sessuser');
        expect(res.statusCode).toBe(200);
    });

    test('500 when the data layer throws', async () => {
        getContributionCalendar.mockRejectedValue(new Error('boom'));
        const res = mockRes();
        await contributionGraph({ query: { username: 'kev' }, session: {} }, res);
        expect(res.statusCode).toBe(500);
        expect(res.body).toContain('boom');
    });
});

describe('GET /stats-card', () => {
    test('exports a route descriptor matching the mounted path', () => {
        expect(statsRoute).toEqual({ method: 'get', path: '/stats-card', auth: false });
    });

    test('400 when username is missing', async () => {
        const res = mockRes();
        await statsCard({ query: {}, session: {} }, res);
        expect(res.statusCode).toBe(400);
        expect(getUserStats).not.toHaveBeenCalled();
    });

    test('200 SVG card when stats resolve', async () => {
        getUserStats.mockResolvedValue(stats);
        const res = mockRes();
        await statsCard({ query: { username: 'kev' }, session: {} }, res);
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.body).toContain("Kevin's GitHub Stats");
    });

    test('falls back to GITHUB_TOKEN when no session token', async () => {
        process.env.GITHUB_TOKEN = 'env-tok';
        getUserStats.mockResolvedValue(stats);
        const res = mockRes();
        await statsCard({ query: { username: 'kev' }, session: {} }, res);
        expect(getUserStats).toHaveBeenCalledWith('env-tok', 'kev');
    });

    test('500 when the data layer throws', async () => {
        getUserStats.mockRejectedValue(new Error('nope'));
        const res = mockRes();
        await statsCard({ query: { username: 'kev' }, session: {} }, res);
        expect(res.statusCode).toBe(500);
        expect(res.body).toContain('nope');
    });
});
