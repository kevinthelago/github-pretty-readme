import { techBadges } from '../src/markdown/tech-badges.js';

const GH = 'https://api.github.com';

/**
 * Parses the `repo` query param into { owner, name }.
 * Accepts "owner/name"; returns null when malformed.
 */
const parseRepo = (value) => {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) return null;
    return { owner: parts[0], name: parts[1] };
};

/**
 * Fetches the REST repo object (language + topics) for owner/name.
 * Uses the caller's GitHub token when present (higher rate limit + private repos).
 *
 * @returns {Promise<{ language: string, topics: string[] } | null>} null when not found
 */
export const fetchRepoMeta = async (owner, name, token) => {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${GH}/repos/${owner}/${name}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return { language: data.language ?? '', topics: data.topics ?? [] };
};

/**
 * GET /repo-tech-badges?repo=owner/name
 *
 * Returns a markdown row of shields.io tech badges derived from the repo's
 * primary language and topics. Responds 200 with an empty body when no tech
 * is detected.
 */
export default async (req, res) => {
    const parsed = parseRepo(req.query.repo);
    if (!parsed) {
        return res.status(400).type('text/plain').send('Missing or malformed `repo` (expected owner/name)');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const meta  = await fetchRepoMeta(parsed.owner, parsed.name, token);
        if (!meta) return res.status(404).type('text/plain').send(`Repo not found: ${parsed.owner}/${parsed.name}`);

        return res.send(techBadges(meta));
    } catch (err) {
        return res.status(502).type('text/plain').send(`Failed to fetch repo: ${err.message}`);
    }
};

// Route descriptor for the auto-mounting registry (#52). When the registry
// lands, this handler mounts at GET /repo-tech-badges with no express.js edit.
export const route = { method: 'get', path: '/repo-tech-badges', auth: false };

export { parseRepo };
