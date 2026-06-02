import { describe, test, expect, vi } from 'vitest';
import {
    bearerToken,
    resolveAuth,
    requireAuth,
    sendJsonError,
    errorSvg,
    sendErrorSvg,
    intParam,
    listParam,
    boolParam,
} from '../util/http.js';

// Minimal Express response double that records what each helper sent.
const mockRes = () => {
    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        jsonBody: undefined,
        redirected: undefined,
        status(code) { this.statusCode = code; return this; },
        setHeader(k, v) { this.headers[k] = v; return this; },
        send(b) { this.body = b; return this; },
        json(b) { this.jsonBody = b; return this; },
        redirect(loc) { this.redirected = loc; return this; },
    };
    return res;
};

describe('bearerToken', () => {
    test('extracts a Bearer token', () => {
        expect(bearerToken({ headers: { authorization: 'Bearer abc123' } })).toBe('abc123');
    });
    test('returns null without a Bearer header', () => {
        expect(bearerToken({ headers: {} })).toBeNull();
        expect(bearerToken({ headers: { authorization: 'Basic xyz' } })).toBeNull();
        expect(bearerToken({ headers: { authorization: 'Bearer ' } })).toBeNull();
    });
});

describe('resolveAuth', () => {
    test('prefers the session token', () => {
        const req = { session: { github_token: 'sess', github_username: 'alice' }, headers: {} };
        expect(resolveAuth(req)).toEqual({ token: 'sess', username: 'alice', source: 'session' });
    });

    test('falls back to a Bearer PAT', () => {
        const req = { session: {}, headers: { authorization: 'Bearer pat' } };
        expect(resolveAuth(req)).toMatchObject({ token: 'pat', source: 'bearer' });
    });

    test('uses GITHUB_TOKEN only when allowEnv is set', () => {
        const req = { session: {}, headers: {} };
        vi.stubEnv('GITHUB_TOKEN', 'envtok');
        expect(resolveAuth(req)).toEqual({ token: null, username: null, source: null });
        expect(resolveAuth(req, { allowEnv: true })).toMatchObject({ token: 'envtok', source: 'env' });
        vi.unstubAllEnvs();
    });
});

describe('requireAuth middleware', () => {
    test('calls next when authenticated', () => {
        const next = vi.fn();
        const res = mockRes();
        requireAuth()({ session: { github_token: 't' }, headers: {} }, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    test('redirects unauthenticated browsers by default', () => {
        const res = mockRes();
        requireAuth()({ session: {}, headers: {} }, res, vi.fn());
        expect(res.redirected).toBe('/');
    });

    test('sends a 401 JSON envelope when onFail=json', () => {
        const res = mockRes();
        requireAuth({ onFail: 'json' })({ session: {}, headers: {} }, res, vi.fn());
        expect(res.statusCode).toBe(401);
        expect(res.jsonBody).toEqual({ error: { code: 'unauthenticated', message: 'Not authenticated' } });
    });
});

describe('sendJsonError', () => {
    test('writes the standard envelope', () => {
        const res = mockRes();
        sendJsonError(res, 400, 'bad_request', 'nope');
        expect(res.statusCode).toBe(400);
        expect(res.jsonBody).toEqual({ error: { code: 'bad_request', message: 'nope' } });
    });
});

describe('errorSvg / sendErrorSvg', () => {
    test('produces an SVG document containing the message', () => {
        const svg = errorSvg('boom');
        expect(svg).toContain('<svg');
        expect(svg).toContain('boom');
    });

    test('escapes XML-significant characters', () => {
        const svg = errorSvg('a < b & "c"');
        expect(svg).toContain('a &lt; b &amp; &quot;c&quot;');
        expect(svg).not.toMatch(/[^&]< b/);
    });

    test('sends image/svg+xml with a 200 status by default', () => {
        const res = mockRes();
        sendErrorSvg(res, 'oops');
        expect(res.headers['Content-Type']).toBe('image/svg+xml');
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('oops');
    });

    test('honours an explicit status override', () => {
        const res = mockRes();
        sendErrorSvg(res, 'oops', { status: 503 });
        expect(res.statusCode).toBe(503);
    });
});

describe('intParam', () => {
    test('parses integers and falls back', () => {
        expect(intParam('5', 1)).toBe(5);
        expect(intParam(undefined, 1)).toBe(1);
        expect(intParam('abc', 7)).toBe(7);
    });
    test('clamps to bounds', () => {
        expect(intParam('100', 6, { max: 16 })).toBe(16);
        expect(intParam('0', 6, { min: 1 })).toBe(1);
    });
});

describe('listParam', () => {
    test('splits, trims, and drops empties', () => {
        expect(listParam('a, b ,,c')).toEqual(['a', 'b', 'c']);
        expect(listParam('')).toEqual([]);
        expect(listParam(undefined)).toEqual([]);
    });
    test('lowercases when asked', () => {
        expect(listParam('JS,TS', { lowercase: true })).toEqual(['js', 'ts']);
    });
});

describe('boolParam', () => {
    test('treats only true/"true"/"1" as truthy', () => {
        expect(boolParam('true')).toBe(true);
        expect(boolParam('1')).toBe(true);
        expect(boolParam(true)).toBe(true);
        expect(boolParam('false')).toBe(false);
        expect(boolParam(undefined)).toBe(false);
        expect(boolParam('yes')).toBe(false);
    });
});
