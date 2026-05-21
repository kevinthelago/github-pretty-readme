export const monkeytypeConnect = (req, res) => {
    const { api_key, username } = req.body ?? {};
    if (!api_key) return res.status(400).json({ error: 'api_key is required' });
    req.session.monkeytype_key      = api_key;
    req.session.monkeytype_username = username ?? null;
    res.json({ ok: true });
};

export const monkeytypeDisconnect = (req, res) => {
    delete req.session.monkeytype_key;
    delete req.session.monkeytype_username;
    res.json({ ok: true });
};
