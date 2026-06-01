/**
 * POST /wakatime/connect
 *
 * Stores a WakaTime API key on the session so subsequent WakaTime calls
 * authenticate as the connected user. Mirrors `monkeytype-connect`.
 *
 * Body: `{ api_key: string }`. Responds 400 when `api_key` is missing.
 */
export const wakatimeConnect = (req, res) => {
    const { api_key } = req.body ?? {};
    if (!api_key) return res.status(400).json({ error: 'api_key is required' });
    req.session.wakatime_key = api_key;
    res.json({ ok: true });
};

/**
 * POST /wakatime/disconnect
 *
 * Clears the session WakaTime API key. The `WAKATIME_API_KEY` env fallback (if
 * configured) remains in effect for shared/server-wide access.
 */
export const wakatimeDisconnect = (req, res) => {
    delete req.session.wakatime_key;
    res.json({ ok: true });
};
