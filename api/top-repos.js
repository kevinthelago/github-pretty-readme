import { renderTopRepos } from '../src/tiles/top-repos.js';
import { toCardData } from './repo-card.js';
import { getRepos, createGithubClient } from '../src/github/repos.js';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

/** Parses a positive integer query value, clamped to [1, max], with a default. */
const parseLimit = (value, fallback = DEFAULT_LIMIT, max = MAX_LIMIT) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(n, max);
};

/** Truthy query flag — `?forks=true`/`1` opt in; anything else stays false. */
const isTrue = (value) => value === 'true' || value === '1';

/**
 * Orders repos by the requested sort key, returning a new array.
 * @param {Array} repos  REST repo objects
 * @param {string} sort  'stars' (default) or 'updated' (most recently pushed)
 */
export const sortRepos = (repos, sort) => {
    const byStars = (a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0);
    const byUpdated = (a, b) =>
        new Date(b.pushed_at ?? b.updated_at ?? 0).getTime() -
        new Date(a.pushed_at ?? a.updated_at ?? 0).getTime();
    return [...repos].sort(sort === 'updated' ? byUpdated : byStars);
};

/**
 * Selects the repos to showcase: forks excluded unless opted in, ordered by the
 * sort key, then truncated to `limit`.
 * @param {Array} repos
 * @param {object} opts
 * @param {string} [opts.sort]         'stars' | 'updated'
 * @param {number} [opts.limit]
 * @param {boolean} [opts.includeForks]
 */
export const selectRepos = (repos, { sort, limit = DEFAULT_LIMIT, includeForks = false } = {}) => {
    const filtered = includeForks ? repos : repos.filter((r) => !r.fork);
    return sortRepos(filtered, sort).slice(0, limit);
};

/**
 * GET /top-repos?username=&sort=stars|updated&limit=6&columns=2&forks=true
 *
 * Renders a grid of repo cards for a user's most notable repositories, reusing
 * the repo-card renderer. Forks are excluded by default; an empty selection
 * renders a graceful placeholder rather than an error.
 */
export default async (req, res) => {
    const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
    if (!username) {
        return res.status(400).type('text/plain').send('Missing `username`');
    }

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const client = createGithubClient({ token });
        const repos = await getRepos(username, client);
        if (!repos) {
            return res
                .status(502)
                .type('text/plain')
                .send(`Failed to fetch repositories for ${username}`);
        }

        const selected = selectRepos(repos, {
            sort: req.query.sort,
            limit: parseLimit(req.query.limit),
            includeForks: isTrue(req.query.forks),
        });

        const cards = selected.map(toCardData);
        return res.send(renderTopRepos(cards, { columns: req.query.columns }));
    } catch (err) {
        return res
            .status(502)
            .type('text/plain')
            .send(`Failed to fetch repositories: ${err.message}`);
    }
};

// Route descriptor for the auto-mounting registry (#52). Mounts at
// GET /top-repos with no express.js edit once the registry lands — consistent
// with /repo-card and /repo-tech-badges.
export const route = { method: 'get', path: '/top-repos', auth: false };

export { parseLimit, isTrue };
