import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the GitHub-backed config store so the endpoint tests exercise the
// handlers' own logic — credential gating, request validation, response shape
// and error handling — without any live network access.
vi.mock('../github/config.js', () => ({
    readConfig: vi.fn(),
    writeConfig: vi.fn(),
}));

const { readConfig, writeConfig } = await import('../github/config.js');
const { getConfig, putConfig } = await import('../../api/config.js');

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
const call = (handler, { body = {}, session = SESSION } = {}) => {
    const res = makeRes();
    return handler({ body, session }, res).then(() => res);
};

beforeEach(() => {
    vi.clearAllMocks();
});

// ── credential gating (shared requireCredentials helper) ──────────────────────

describe('config endpoints require credentials', () => {
    test('getConfig responds 401 with the error envelope when unauthenticated', async () => {
        const res = await call(getConfig, { session: {} });
        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({ error: { code: 'unauthenticated' } });
        expect(readConfig).not.toHaveBeenCalled();
    });

    test('putConfig responds 401 when unauthenticated', async () => {
        const res = await call(putConfig, { session: {}, body: { repos: [] } });
        expect(res.statusCode).toBe(401);
        expect(writeConfig).not.toHaveBeenCalled();
    });
});

// ── GET /config ───────────────────────────────────────────────────────────────

describe('GET /config', () => {
    test('returns the stored config and exists:true when one is present', async () => {
        readConfig.mockResolvedValue({ config: { repos: ['a/b'] }, sha: 'abc' });
        const res = await call(getConfig);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ config: { repos: ['a/b'] }, exists: true });
        expect(readConfig).toHaveBeenCalledWith('tok', 'octocat');
    });

    test('returns config:null and exists:false when none is stored', async () => {
        readConfig.mockResolvedValue(null);
        const res = await call(getConfig);
        expect(res.body).toEqual({ config: null, exists: false });
    });

    test('responds 500 when the config read throws', async () => {
        readConfig.mockRejectedValue(new Error('boom'));
        const res = await call(getConfig);
        expect(res.statusCode).toBe(500);
        expect(res.body).toMatchObject({ error: { code: 'internal_error' } });
    });
});

// ── PUT /config ───────────────────────────────────────────────────────────────

describe('PUT /config', () => {
    test('responds 400 when repos is not an array', async () => {
        const res = await call(putConfig, { body: { repos: 'nope' } });
        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({ error: { code: 'bad_request' } });
        expect(writeConfig).not.toHaveBeenCalled();
    });

    test('writes the config and returns ok, passing the existing sha through', async () => {
        readConfig.mockResolvedValue({ config: { repos: [] }, sha: 'prev-sha' });
        writeConfig.mockResolvedValue(undefined);
        const res = await call(putConfig, { body: { repos: ['a/b', 'c/d'] } });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(writeConfig).toHaveBeenCalledWith('tok', 'octocat', { repos: ['a/b', 'c/d'] }, 'prev-sha');
    });

    test('responds 500 when the write throws', async () => {
        readConfig.mockResolvedValue(null);
        writeConfig.mockRejectedValue(new Error('write failed'));
        const res = await call(putConfig, { body: { repos: [] } });
        expect(res.statusCode).toBe(500);
        expect(res.body).toMatchObject({ error: { code: 'internal_error' } });
    });
});
