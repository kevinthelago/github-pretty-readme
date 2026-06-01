import { verifyToken } from '../src/auth/tokens.js';

const CLIENT_ID     = process.env.GITHUB_APP_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
const BASE_URL      = process.env.BASE_URL ?? 'http://localhost:8080';

/** Extract a bearer token from the Authorization header, or null. */
const bearerToken = (req) => {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization ?? '');
    return match ? match[1].trim() : null;
};

export const authGithub = (req, res) => {
    if (!CLIENT_ID) return res.status(500).send('GitHub OAuth not configured — add GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET');
    const state = Math.random().toString(36).slice(2);
    req.session.oauth_state = state;
    const params = new URLSearchParams({
        client_id:    CLIENT_ID,
        redirect_uri: `${BASE_URL}/auth/callback`,
        scope:        'repo',
        state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

export const authCallback = async (req, res) => {
    const { code, state } = req.query;
    if (!code || state !== req.session.oauth_state) return res.redirect('/?error=invalid_state');
    delete req.session.oauth_state;

    try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
        });
        const { access_token, error } = await tokenRes.json();
        if (!access_token) return res.redirect('/?error=' + encodeURIComponent(error ?? 'oauth_failed'));

        const userRes = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/vnd.github+json' },
        });
        const user = await userRes.json();

        req.session.github_token    = access_token;
        req.session.github_username = user.login;
        req.session.github_avatar   = user.avatar_url;
        req.session.github_name     = user.name ?? user.login;

        res.redirect('/');
    } catch (err) {
        res.redirect('/?error=' + encodeURIComponent(err.message));
    }
};

export const authLogout = (req, res) => {
    req.session = null;
    res.redirect('/');
};

export const authMe = (req, res) => {
    if (!req.session?.github_token) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
        username:            req.session.github_username,
        avatar:              req.session.github_avatar,
        name:                req.session.github_name,
        monkeytype_connected: !!req.session.monkeytype_key,
        monkeytype_username:  req.session.monkeytype_username ?? null,
    });
};

/**
 * Gate a route behind authentication.
 *
 * Order of precedence:
 *   1. An existing signed-in session (`session.github_token`) passes through.
 *   2. A Bearer API token is verified against the token store (#58). A valid
 *      token populates the same request context downstream handlers read —
 *      `session.github_token` + `session.github_username` — so token-driven
 *      automation behaves exactly like a signed-in user.
 *   3. An invalid or revoked Bearer token is rejected with 401. Previously
 *      *any* `Bearer ...` header was accepted unconditionally — this closes
 *      that bypass.
 *   4. Browser requests with no credentials are redirected to sign in.
 */
export const requireAuth = (req, res, next) => {
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

    return res.redirect('/');
};
