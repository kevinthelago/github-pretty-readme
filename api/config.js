import { readConfig, writeConfig } from '../src/github/config.js';

export const getConfig = async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const result = await readConfig(token, username);
        res.json({ config: result?.config ?? null, exists: result !== null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const putConfig = async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    const { repos } = req.body;
    if (!Array.isArray(repos)) return res.status(400).json({ error: 'repos must be an array of strings' });

    try {
        const existing = await readConfig(token, username);
        await writeConfig(token, username, { repos }, existing?.sha);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
