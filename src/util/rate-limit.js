/**
 * In-memory fixed-window rate limiter for the public SVG/AI endpoints.
 *
 * Anonymous traffic is the thing we need to protect against (each AI/GitHub call
 * costs quota and money), so the limiter throttles by client key and **exempts
 * authenticated sessions** — the apply flow runs behind `requireAuth` and should
 * never be throttled alongside drive-by anonymous requests.
 *
 * The key is `ip + bearer-token` so two callers behind one IP, or one IP using
 * distinct API tokens, get independent budgets. State lives in a process-local
 * `Map`; this is intentionally per-instance (no shared store) — good enough for a
 * single Cloud Run container and dependency-free. Buckets are evicted lazily on
 * access once their window has elapsed.
 *
 * Over-limit responses honor the endpoint's content type: an error SVG when the
 * caller wants an image (SVG tiles are embedded via `<img>`), JSON otherwise.
 *
 * Configurable via env (read by {@link rateLimiter}, the default instance):
 *   RATE_LIMIT_WINDOW_MS  window length in ms              (default 60000)
 *   RATE_LIMIT_MAX        max requests per key per window  (default 60)
 *   RATE_LIMIT_DISABLED   `'true'` disables limiting entirely
 */

/** Paths that must never be throttled (health probes, etc.). */
const ALWAYS_ALLOW = new Set(['/healthz']);

/**
 * Extract a bearer token from the Authorization header, if present.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const bearerToken = (req) => {
    const header = req.headers?.authorization ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match ? match[1].trim() : null;
};

/**
 * True when the caller is an authenticated user (has a session GitHub token).
 * Such requests are exempt from anonymous rate limiting.
 * @param {import('express').Request} req
 */
const isAuthenticated = (req) => Boolean(req.session?.github_token);

/**
 * True when the client expects an image (so an over-limit reply should be SVG).
 * @param {import('express').Request} req
 */
const wantsSvg = (req) => {
    const accept = req.headers?.accept ?? '';
    return accept.includes('image/');
};

/** Minimal standalone error tile (kept local so the limiter has no tile deps). */
const errorSvg = (message) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="120" role="img" aria-label="${message}">` +
    `<rect width="495" height="120" rx="6" fill="#1f2328"/>` +
    `<text x="247" y="64" fill="#f85149" font-family="Segoe UI, Ubuntu, sans-serif" ` +
    `font-size="16" font-weight="600" text-anchor="middle">${message}</text></svg>`;

/**
 * Create a rate-limiting Express middleware.
 *
 * Pure of process env so it is unit-testable: pass `windowMs`, `max`, and an
 * injectable `now()` clock. The default exported {@link rateLimiter} wires this
 * to the `RATE_LIMIT_*` env vars.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000] Window length in milliseconds.
 * @param {number} [options.max=60] Max requests per key per window.
 * @param {boolean} [options.disabled=false] When true, the middleware is a no-op.
 * @param {() => number} [options.now] Clock, defaults to `Date.now`.
 * @returns {(req: import('express').Request, res: import('express').Response, next: Function) => void}
 */
export const createRateLimiter = ({
    windowMs = 60_000,
    max = 60,
    disabled = false,
    now = Date.now,
} = {}) => {
    /** @type {Map<string, { count: number, resetAt: number }>} */
    const buckets = new Map();

    return (req, res, next) => {
        if (disabled || ALWAYS_ALLOW.has(req.path) || isAuthenticated(req)) {
            return next();
        }

        const key = `${req.ip ?? 'unknown'}:${bearerToken(req) ?? 'anon'}`;
        const t = now();

        let bucket = buckets.get(key);
        if (!bucket || t >= bucket.resetAt) {
            bucket = { count: 0, resetAt: t + windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;

        const remaining = Math.max(0, max - bucket.count);
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > max) {
            const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - t) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            if (wantsSvg(req)) {
                res.setHeader('Content-Type', 'image/svg+xml');
                return res.status(429).send(errorSvg('Rate limit exceeded — try again later'));
            }
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter,
            });
        }

        return next();
    };
};

/**
 * Default limiter instance configured from the environment. Mounted in
 * `express.js` ahead of the public SVG/data routes.
 */
export const rateLimiter = createRateLimiter({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 60,
    disabled: process.env.RATE_LIMIT_DISABLED === 'true',
});

export default rateLimiter;
