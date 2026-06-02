import { renderRepoCard } from '../src/tiles/repo-card.js';
import { lookupIcon } from '../src/github/tech-data.js';

const GH = 'https://api.github.com';

/** Parses the `repo` query param ("owner/name") into { owner, name }, or null. */
const parseRepo = (value) => {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) return null;
    return { owner: parts[0], name: parts[1] };
};

/**
 * Maps the REST repo object to the renderer's data shape, resolving a
 * language colour from simple-icons when available.
 */
export const toCardData = (data) => {
    const language = data.language ?? '';
    const icon     = language ? lookupIcon(language) : null;
    return {
        owner:       data.owner?.login ?? '',
        name:        data.name ?? '',
        description: data.description ?? '',
        stars:       data.stargazers_count ?? 0,
        forks:       data.forks_count ?? 0,
        openIssues:  data.open_issues_count ?? 0,
        language,
        languageHex: icon ? icon.hex : '8b949e',
        updatedAt:   data.pushed_at ?? data.updated_at ?? '',
    };
};

const fetchRepo = async (owner, name, token) => {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${GH}/repos/${owner}/${name}`, { headers });
    if (!res.ok) return null;
    return res.json();
};

/**
 * GET /repo-card?repo=owner/name
 *
 * Renders a theme-aware SVG card with the repo's stars, forks, open issues,
 * primary language and last-updated time, sourced from the REST repo object.
 */
export default async (req, res) => {
    const parsed = parseRepo(req.query.repo);
    if (!parsed) {
        return res.status(400).type('text/plain').send('Missing or malformed `repo` (expected owner/name)');
    }

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const data  = await fetchRepo(parsed.owner, parsed.name, token);
        if (!data) return res.status(404).type('text/plain').send(`Repo not found: ${parsed.owner}/${parsed.name}`);

        return res.send(renderRepoCard(toCardData(data)));
    } catch (err) {
        return res.status(502).type('text/plain').send(`Failed to fetch repo: ${err.message}`);
    }
};

// Route descriptor for the auto-mounting registry (#52). Mounts at
// GET /repo-card with no express.js edit once the registry lands.
export const route = { method: 'get', path: '/repo-card', auth: false };

export { parseRepo };
