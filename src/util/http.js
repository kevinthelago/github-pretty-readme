/**
 * Shared HTTP helpers for api/* route handlers.
 *
 * Three conventions every handler used to re-implement ad hoc are centralized here:
 *   - auth   — resolve a GitHub token from the session cookie, an
 *              `Authorization: Bearer <PAT>` header, or (opt-in) GITHUB_TOKEN.
 *   - errors — one JSON envelope `{ error: { code, message } }`, plus an SVG error
 *              tile for image endpoints so a broken `<img>` shows the reason.
 *   - query  — parse integers (optionally bounded), comma lists, and booleans.
 *
 * Success responses are deliberately left untouched by these helpers.
 */

import { verifyToken } from '../auth/tokens.js';

const XML_ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (str) => String(str ?? '').replace(/[<>&"']/g, (c) => XML_ESCAPES[c]);

// ── Error responses ─────────────────────────────────────────────────────────

/**
 * Send the standard JSON error envelope: `{ error: { code, message } }`.
 *
 * @param {import('express').Response} res
 * @param {number} status HTTP status code
 * @param {string} code   stable machine-readable code (e.g. 'unauthenticated')
 * @param {string} message human-readable explanation
 * @returns {import('express').Response} so callers can `return sendJsonError(...)`.
 */
export const sendJsonError = (res, status, code, message) =>
    res.status(status).json({ error: { code, message } });

/**
 * Render an error message as a self-contained SVG tile.
 *
 * Image endpoints are embedded via `<img>`, so they must always answer with an
 * image — this surfaces the failure reason instead of a broken-image icon.
 *
 * @param {string} message
 * @param {{ width?: number, height?: number }} [opts]
 * @returns {string} an SVG document
 */
export const errorSvg = (message, { width = 495, height = 120 } = {}) => {
    const text = escapeXml(message || 'Something went wrong');
    const font = '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Error: ${text}">
  <rect width="${width}" height="${height}" rx="8" fill="#1c1917"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7.5" fill="none" stroke="#ef4444" stroke-opacity="0.5"/>
  <text x="20" y="36" fill="#ef4444" font-family="${font}" font-size="15" font-weight="600">&#9888; Error</text>
  <text x="20" y="64" fill="#e7e5e4" font-family="${font}" font-size="13">${text}</text>
</svg>`;
};

/**
 * Send an SVG error tile with the image content-type.
 *
 * Defaults to HTTP 200 so the SVG actually paints inside an `<img>` tag — most
 * browsers refuse to render an image returned with a 4xx/5xx status.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {{ status?: number, width?: number, height?: number }} [opts]
 */
export const sendErrorSvg = (res, message, { status = 200, ...dimensions } = {}) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(status).send(errorSvg(message, dimensions));
};

// ── Authentication ──────────────────────────────────────────────────────────

/** Extract the token from an `Authorization: Bearer <token>` header, or null. */
export const bearerToken = (req) => {
    const header = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
};

/**
 * Resolve GitHub credentials for a request.
 *
 * Resolution order: session cookie → `Authorization: Bearer` PAT →
 * `process.env.GITHUB_TOKEN` (only when `allowEnv` is set).
 *
 * @param {import('express').Request} req
 * @param {{ allowEnv?: boolean }} [opts] `allowEnv` lets read-only SVG/data
 *   endpoints fall back to the server token so they render for anonymous visitors.
 * @returns {{ token: string|null, username: string|null, source: 'session'|'bearer'|'env'|null }}
 */
export const resolveAuth = (req, { allowEnv = false } = {}) => {
    if (req.session?.github_token) {
        return { token: req.session.github_token, username: req.session.github_username ?? null, source: 'session' };
    }
    const bearer = bearerToken(req);
    if (bearer) {
        return { token: bearer, username: req.session?.github_username ?? null, source: 'bearer' };
    }
    if (allowEnv && process.env.GITHUB_TOKEN) {
        return { token: process.env.GITHUB_TOKEN, username: req.session?.github_username ?? null, source: 'env' };
    }
    return { token: null, username: null, source: null };
};

/**
 * Express middleware factory that gates a route behind authentication.
 *
 * Order of precedence:
 *   1. An existing signed-in session (`session.github_token`) passes through.
 *   2. A Bearer API token is verified against the token store (#58). A valid
 *      token populates the same request context downstream handlers read —
 *      `session.github_token` + `session.github_username` — so token-driven
 *      automation behaves exactly like a signed-in user.
 *   3. An invalid or revoked Bearer token is rejected with 401. A bare
 *      `Bearer ...` header is NOT trusted on its own (#59 closed that bypass).
 *   4. Requests with no credentials fail per `onFail`.
 *
 * @param {{ onFail?: 'redirect'|'json', redirectTo?: string }} [opts]
 *   `onFail='redirect'` (default) sends browsers to `redirectTo`; `onFail='json'`
 *   responds 401 with the standard JSON error envelope (use for XHR/API routes).
 * @returns {import('express').RequestHandler}
 */
export const requireAuth = ({ onFail = 'redirect', redirectTo = '/' } = {}) => (req, res, next) => {
    if (req.session?.github_token) return next();

    const token = bearerToken(req);
    if (token) {
        const record = verifyToken(token);
        if (!record) return res.status(401).json({ error: 'Invalid or revoked token' });
        req.session = req.session ?? {};
        req.session.github_token    = record.githubToken;
        req.session.github_username = record.login;
        return next();
    }

    if (onFail === 'json') return sendJsonError(res, 401, 'unauthenticated', 'Not authenticated');
    return res.redirect(redirectTo);
};

// ── Query parsing ───────────────────────────────────────────────────────────

/**
 * Parse a query value as an integer, falling back when absent or non-numeric.
 *
 * @param {*} value raw query value
 * @param {number} fallback used when `value` is missing or not a number
 * @param {{ min?: number, max?: number }} [bounds] clamp the result when provided
 * @returns {number}
 */
export const intParam = (value, fallback, { min, max } = {}) => {
    const n = parseInt(value, 10);
    let out = Number.isNaN(n) ? fallback : n;
    if (typeof min === 'number') out = Math.max(min, out);
    if (typeof max === 'number') out = Math.min(max, out);
    return out;
};

/**
 * Parse a comma-separated query value into a trimmed, non-empty string array.
 *
 * @param {*} value raw query value
 * @param {{ lowercase?: boolean }} [opts]
 * @returns {string[]}
 */
export const listParam = (value, { lowercase = false } = {}) => {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((s) => (lowercase ? s.trim().toLowerCase() : s.trim()))
        .filter(Boolean);
};

/** Parse a query value as a boolean. Truthy when it is `true`, `'true'`, or `'1'`. */
export const boolParam = (value) => value === true || value === 'true' || value === '1';
