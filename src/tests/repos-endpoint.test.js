import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the injectable GitHub client so the handler test exercises the endpoint's
// own logic — credential gating, list shaping/sorting and error handling —
// without any live network access.
vi.mock('../github/repos.js', () => ({ getAllRepos: vi.fn() }));

const { getAllRepos } = await import('../github/repos.js');
const repos = (await import('../../api/repos.js')).default;

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

const SESSION = { github_token: 'tok', github_username: 'octocat' };
const call = (session = SESSION) => {
    const res = makeRes();
    return repos({ session }, res).then(() => res);
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /repos', () => {
    test('responds 401 when unauthenticated', async () => {
        const res = await call({});
        expect(res.statusCode).toBe(401);
        expect(getAllRepos).not.toHaveBeenCalled();
    });

    test('lists repos with the profile repo first, then by most recent push', async () => {
        getAllRepos.mockResolvedValue([
            { name: 'old', description: 'd', language: 'Go', stargazers_count: 1, pushed_at: '2024-01-01T00:00:00Z' },
            { name: 'octocat', description: null, language: null, stargazers_count: 9, pushed_at: '2024-06-01T00:00:00Z' },
            { name: 'recent', description: 'r', language: 'JS', stargazers_count: 3, pushed_at: '2025-01-01T00:00:00Z' },
        ]);
        const res = await call();
        expect(res.statusCode).toBe(200);
        expect(res.body.map((r) => r.name)).toEqual(['octocat', 'recent', 'old']);
        const profile = res.body[0];
        expect(profile).toMatchObject({ name: 'octocat', isProfile: true, description: '', language: '' });
        expect(res.body[1].isProfile).toBe(false);
    });

    test('responds 500 when the repo fetch throws', async () => {
        getAllRepos.mockRejectedValue(new Error('boom'));
        const res = await call();
        expect(res.statusCode).toBe(500);
        expect(res.body).toMatchObject({ error: { code: 'internal_error' } });
    });
});
