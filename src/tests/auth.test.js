import { describe, test, expect, beforeEach, vi } from 'vitest';
import { requireAuth } from '../../api/auth.js';
import { issueToken, revokeToken, _resetTokens } from '../auth/tokens.js';

/** Minimal Express-style response double. */
const makeRes = () => {
    const res = { statusCode: 200, body: undefined, redirectedTo: undefined };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.redirect = (url) => ((res.redirectedTo = url), res);
    return res;
};

const reqWith = ({ authorization, session } = {}) => ({
    headers: authorization ? { authorization } : {},
    session,
});

beforeEach(() => _resetTokens());

describe('requireAuth', () => {
    test('passes through an existing signed-in session', () => {
        const next = vi.fn();
        const res = makeRes();
        requireAuth(reqWith({ session: { github_token: 'gh_alice' } }), res, next);
        expect(next).toHaveBeenCalled();
    });

    test('REGRESSION: an arbitrary Bearer header no longer passes', () => {
        const next = vi.fn();
        const res = makeRes();
        // Previously `Bearer anything` was accepted unconditionally — the hole.
        requireAuth(reqWith({ authorization: 'Bearer totally-made-up-token' }), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({ error: 'Invalid or revoked token' });
    });

    test('a valid API token authenticates and populates the request context', () => {
        const { token } = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        const next = vi.fn();
        const res = makeRes();
        const req = reqWith({ authorization: `Bearer ${token}` });
        requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.session.github_token).toBe('gh_alice');
        expect(req.session.github_username).toBe('alice');
    });

    test('a revoked token is rejected with 401', () => {
        const { token, id } = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        revokeToken('alice', id);

        const next = vi.fn();
        const res = makeRes();
        requireAuth(reqWith({ authorization: `Bearer ${token}` }), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('no credentials redirects to sign in', () => {
        const next = vi.fn();
        const res = makeRes();
        requireAuth(reqWith(), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/');
    });
});
