import { describe, test, expect, vi } from 'vitest';
import { createRateLimiter } from '../util/rate-limit.js';

/** Build a mock Express req. */
const mkReq = ({ ip = '1.2.3.4', path = '/account-summary', accept = '', auth, session } = {}) => ({
    ip,
    path,
    headers: { accept, ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    session,
});

/** Build a mock Express res that records status/body/headers. */
const mkRes = () => {
    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        status(c) { this.statusCode = c; return this; },
        send(b) { this.body = b; return this; },
        json(b) { this.body = b; return this; },
    };
    return res;
};

describe('createRateLimiter', () => {
    test('allows requests up to the max, then 429s', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 3, now: () => 0 });
        const next = vi.fn();

        for (let i = 0; i < 3; i++) {
            const res = mkRes();
            limiter(mkReq(), res, next);
            expect(res.statusCode).toBe(200);
        }
        expect(next).toHaveBeenCalledTimes(3);

        const res = mkRes();
        limiter(mkReq(), res, next);
        expect(res.statusCode).toBe(429);
        expect(next).toHaveBeenCalledTimes(3); // not called again
    });

    test('returns JSON over-limit for non-image callers', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
        limiter(mkReq(), mkRes(), vi.fn());
        const res = mkRes();
        limiter(mkReq(), res, vi.fn());
        expect(res.statusCode).toBe(429);
        expect(res.body).toMatchObject({ error: 'Too many requests' });
        expect(res.headers['retry-after']).toBeDefined();
    });

    test('returns an error SVG over-limit for image callers', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
        const opts = { accept: 'image/svg+xml,image/*' };
        limiter(mkReq(opts), mkRes(), vi.fn());
        const res = mkRes();
        limiter(mkReq(opts), res, vi.fn());
        expect(res.statusCode).toBe(429);
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('Rate limit exceeded');
    });

    test('resets the window once it elapses', () => {
        let t = 0;
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
        limiter(mkReq(), mkRes(), vi.fn());
        const blocked = mkRes();
        limiter(mkReq(), blocked, vi.fn());
        expect(blocked.statusCode).toBe(429);

        t = 1000; // window elapsed
        const fresh = mkRes();
        const next = vi.fn();
        limiter(mkReq(), fresh, next);
        expect(fresh.statusCode).toBe(200);
        expect(next).toHaveBeenCalled();
    });

    test('keys independently by IP and token', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
        limiter(mkReq({ ip: '1.1.1.1' }), mkRes(), vi.fn());

        const other = mkRes();
        limiter(mkReq({ ip: '2.2.2.2' }), other, vi.fn());
        expect(other.statusCode).toBe(200); // different IP → own budget

        const sameIpNewToken = mkRes();
        limiter(mkReq({ ip: '1.1.1.1', auth: 'tok' }), sameIpNewToken, vi.fn());
        expect(sameIpNewToken.statusCode).toBe(200); // different token → own budget
    });

    test('exempts authenticated sessions', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
        const next = vi.fn();
        for (let i = 0; i < 5; i++) {
            const res = mkRes();
            limiter(mkReq({ session: { github_token: 'abc' } }), res, next);
            expect(res.statusCode).toBe(200);
        }
        expect(next).toHaveBeenCalledTimes(5);
    });

    test('exempts the /healthz probe', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
        const next = vi.fn();
        for (let i = 0; i < 5; i++) {
            const res = mkRes();
            limiter(mkReq({ path: '/healthz' }), res, next);
            expect(res.statusCode).toBe(200);
        }
        expect(next).toHaveBeenCalledTimes(5);
    });

    test('disabled limiter is a no-op', () => {
        const limiter = createRateLimiter({ windowMs: 1000, max: 1, disabled: true, now: () => 0 });
        const next = vi.fn();
        for (let i = 0; i < 5; i++) {
            const res = mkRes();
            limiter(mkReq(), res, next);
            expect(res.statusCode).toBe(200);
        }
        expect(next).toHaveBeenCalledTimes(5);
    });
});
