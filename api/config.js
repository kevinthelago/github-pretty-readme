import { readConfig, writeConfig } from '../src/github/config.js';
import { requireCredentials, sendJsonError } from './_shared.js';

export const getConfig = async (req, res) => {
    const creds = requireCredentials(req, res);
    if (!creds) return;
    const { token, username } = creds;

    try {
        const result = await readConfig(token, username);
        res.json({ config: result?.config ?? null, exists: result !== null });
    } catch (err) {
        sendJsonError(res, 500, 'internal_error', err.message);
    }
};

export const putConfig = async (req, res) => {
    const creds = requireCredentials(req, res);
    if (!creds) return;
    const { token, username } = creds;

    const { repos } = req.body;
    if (!Array.isArray(repos)) return sendJsonError(res, 400, 'bad_request', 'repos must be an array of strings');

    try {
        const existing = await readConfig(token, username);
        await writeConfig(token, username, { repos }, existing?.sha);
        res.json({ ok: true });
    } catch (err) {
        sendJsonError(res, 500, 'internal_error', err.message);
    }
};
