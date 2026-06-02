import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';

/**
 * API-token store.
 *
 * Lets an authenticated user mint long-lived API tokens for headless automation
 * (cron jobs, CI) so they no longer have to copy a short-lived session cookie.
 * A token maps back to the GitHub access token the apply pipeline acts with, so
 * presenting it is equivalent to that user being signed in.
 *
 * Security model:
 *   - The token is shown to the caller exactly once at creation; only its
 *     SHA-256 hash is retained, so a store dump never reveals usable tokens.
 *   - Lookups compare hashes with a constant-time comparison.
 *   - The mapped GitHub access token must be usable by the apply pipeline, so it
 *     is held as-is (it cannot be hashed). State is process-local and in-memory
 *     — consistent with the app's other in-memory caches and adequate for a
 *     single Cloud Run instance; tokens do not survive a restart.
 */

const PREFIX = 'gpr_';

/** @type {Map<string, { id: string, hash: string, login: string, githubToken: string, label: string, createdAt: string, lastUsedAt: string|null }>} */
const tokensByHash = new Map();

/** SHA-256 hex digest of a token string. */
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/** Constant-time hex-string compare; false on length mismatch. */
const safeHexEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
};

/** Strip the secret fields from a record for safe external exposure. */
const toPublic = ({ id, login, label, createdAt, lastUsedAt }) => ({
    id,
    login,
    label,
    createdAt,
    lastUsedAt,
});

/**
 * Mint a new API token for a user.
 *
 * @param {object} params
 * @param {string} params.login GitHub login the token acts as.
 * @param {string} params.githubToken GitHub access token the apply pipeline uses.
 * @param {string} [params.label] Optional human label for the token.
 * @returns {{ token: string, id: string, login: string, label: string, createdAt: string, lastUsedAt: null }}
 *   The plaintext `token` is returned ONCE and never retrievable again.
 * @throws {Error} when `login` or `githubToken` is missing.
 */
export const issueToken = ({ login, githubToken, label = '' } = {}) => {
    if (!login || !githubToken) {
        throw new Error('issueToken requires login and githubToken');
    }
    const token = PREFIX + randomBytes(32).toString('base64url');
    const record = {
        id: randomUUID(),
        hash: hashToken(token),
        login,
        githubToken,
        label,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
    };
    tokensByHash.set(record.hash, record);
    return { token, ...toPublic(record) };
};

/**
 * Verify a presented token against the store.
 *
 * @param {string} token The plaintext token from an Authorization header.
 * @returns {{ id: string, login: string, githubToken: string, label: string }|null}
 *   The matching record (including the mapped GitHub token) or null when the
 *   token is unknown/revoked. Updates `lastUsedAt` on a hit.
 */
export const verifyToken = (token) => {
    if (typeof token !== 'string' || !token.startsWith(PREFIX)) return null;
    const candidate = hashToken(token);
    const record = tokensByHash.get(candidate);
    // Guard against the (degenerate) chance of a hash hit on a different string.
    if (!record || !safeHexEqual(record.hash, candidate)) return null;
    record.lastUsedAt = new Date().toISOString();
    return { id: record.id, login: record.login, githubToken: record.githubToken, label: record.label };
};

/**
 * List a user's tokens as safe metadata (never the hash, GitHub token, or
 * plaintext).
 *
 * @param {string} login
 * @returns {Array<{ id, login, label, createdAt, lastUsedAt }>}
 */
export const listTokens = (login) =>
    [...tokensByHash.values()]
        .filter((r) => r.login === login)
        .map(toPublic);

/**
 * Revoke one of a user's tokens by id.
 *
 * @param {string} login Owner login (a user may only revoke their own tokens).
 * @param {string} id Token id from {@link listTokens}.
 * @returns {boolean} true if a token was removed.
 */
export const revokeToken = (login, id) => {
    for (const [hash, record] of tokensByHash) {
        if (record.id === id && record.login === login) {
            tokensByHash.delete(hash);
            return true;
        }
    }
    return false;
};

/** Test helper — clear all stored tokens. */
export const _resetTokens = () => tokensByHash.clear();
