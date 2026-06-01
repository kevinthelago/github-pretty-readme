import { issueToken, listTokens, revokeToken } from '../src/auth/tokens.js';

/**
 * Token management endpoints. All require an authenticated session (mounted
 * behind `requireAuth` in express.js) — you mint a token while signed in, then
 * use it for headless automation. A token is only ever returned in full from
 * {@link createToken}; thereafter only metadata is exposed.
 */

/**
 * POST /tokens
 * Mint a new API token for the signed-in user. Body: `{ label?: string }`.
 *
 * @returns {void} 201 `{ token, id, login, label, createdAt, lastUsedAt }` —
 *   `token` is shown exactly once. 401 when not session-authenticated.
 */
export const createToken = (req, res) => {
    const login = req.session?.github_username;
    const githubToken = req.session?.github_token;
    if (!login || !githubToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const label = typeof req.body?.label === 'string' ? req.body.label.slice(0, 100) : '';
    const issued = issueToken({ login, githubToken, label });
    return res.status(201).json(issued);
};

/**
 * GET /tokens
 * List the signed-in user's tokens as metadata (never the secret).
 *
 * @returns {void} 200 `{ tokens: [...] }`. 401 when not authenticated.
 */
export const getTokens = (req, res) => {
    const login = req.session?.github_username;
    if (!login) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ tokens: listTokens(login) });
};

/**
 * DELETE /tokens/:id
 * Revoke one of the signed-in user's tokens.
 *
 * @returns {void} 204 on success, 404 when the id is unknown for this user,
 *   401 when not authenticated.
 */
export const deleteToken = (req, res) => {
    const login = req.session?.github_username;
    if (!login) return res.status(401).json({ error: 'Not authenticated' });
    const removed = revokeToken(login, req.params.id);
    if (!removed) return res.status(404).json({ error: 'Token not found' });
    return res.status(204).end();
};
