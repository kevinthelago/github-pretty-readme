import { describe, test, expect, beforeEach } from 'vitest';
import {
    issueToken,
    verifyToken,
    listTokens,
    revokeToken,
    _resetTokens,
} from '../auth/tokens.js';
import { createToken, getTokens, deleteToken } from '../../api/tokens.js';

/** Minimal Express-style response double. */
const makeRes = () => {
    const res = { statusCode: 200, body: undefined, ended: false };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.end = () => ((res.ended = true), res);
    return res;
};

beforeEach(() => _resetTokens());

describe('token store', () => {
    test('issued token is returned once and maps back to the github token', () => {
        const issued = issueToken({ login: 'alice', githubToken: 'gh_alice', label: 'ci' });
        expect(issued.token).toMatch(/^gpr_/);
        expect(issued.id).toBeTruthy();
        expect(issued.label).toBe('ci');

        const record = verifyToken(issued.token);
        expect(record).toMatchObject({ login: 'alice', githubToken: 'gh_alice' });
    });

    test('store never exposes plaintext or the github token in metadata', () => {
        const issued = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        const [meta] = listTokens('alice');
        expect(meta).not.toHaveProperty('hash');
        expect(meta).not.toHaveProperty('githubToken');
        expect(meta).not.toHaveProperty('token');
        expect(meta.id).toBe(issued.id);
    });

    test('unknown / malformed tokens do not verify', () => {
        expect(verifyToken('gpr_nope')).toBeNull();
        expect(verifyToken('not-a-token')).toBeNull();
        expect(verifyToken(undefined)).toBeNull();
    });

    test('revoked token no longer verifies', () => {
        const issued = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        expect(revokeToken('alice', issued.id)).toBe(true);
        expect(verifyToken(issued.token)).toBeNull();
        expect(listTokens('alice')).toHaveLength(0);
    });

    test('a user cannot revoke another user\'s token', () => {
        const issued = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        expect(revokeToken('bob', issued.id)).toBe(false);
        expect(verifyToken(issued.token)).not.toBeNull();
    });

    test('issueToken requires login and githubToken', () => {
        expect(() => issueToken({ login: 'alice' })).toThrow();
        expect(() => issueToken({ githubToken: 'x' })).toThrow();
    });

    test('lastUsedAt updates on verify', () => {
        const issued = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        expect(listTokens('alice')[0].lastUsedAt).toBeNull();
        verifyToken(issued.token);
        expect(listTokens('alice')[0].lastUsedAt).not.toBeNull();
    });
});

describe('token endpoints', () => {
    const session = { github_username: 'alice', github_token: 'gh_alice' };

    test('POST /tokens mints a token for the session user', () => {
        const res = makeRes();
        createToken({ session, body: { label: 'cron' } }, res);
        expect(res.statusCode).toBe(201);
        expect(res.body.token).toMatch(/^gpr_/);
        expect(res.body.label).toBe('cron');
        expect(listTokens('alice')).toHaveLength(1);
    });

    test('POST /tokens 401s without a session', () => {
        const res = makeRes();
        createToken({ session: {}, body: {} }, res);
        expect(res.statusCode).toBe(401);
    });

    test('GET /tokens lists only the session user\'s tokens, metadata only', () => {
        issueToken({ login: 'alice', githubToken: 'gh_alice' });
        issueToken({ login: 'bob', githubToken: 'gh_bob' });
        const res = makeRes();
        getTokens({ session }, res);
        expect(res.body.tokens).toHaveLength(1);
        expect(res.body.tokens[0]).not.toHaveProperty('githubToken');
    });

    test('DELETE /tokens/:id revokes, 404 on unknown', () => {
        const issued = issueToken({ login: 'alice', githubToken: 'gh_alice' });
        const ok = makeRes();
        deleteToken({ session, params: { id: issued.id } }, ok);
        expect(ok.statusCode).toBe(204);
        expect(listTokens('alice')).toHaveLength(0);

        const miss = makeRes();
        deleteToken({ session, params: { id: 'does-not-exist' } }, miss);
        expect(miss.statusCode).toBe(404);
    });
});
