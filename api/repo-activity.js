import { getCommitActivity } from '../src/github/commit-activity.js';
import { renderRepoActivity } from '../src/tiles/repo-activity.js';

/**
 * Route descriptor consumed by the auto-mounter (api/_routes.js, see #52).
 * Keeping this here means the route mounts itself — no edit to express.js.
 * Public endpoint: it returns an SVG meant to be embedded in a README and
 * fetched by GitHub's image proxy, so it must not require a session.
 */
export const route = { method: 'get', path: '/repo-activity', auth: false };

/**
 * Resolve the `?repo=` parameter into an `{ owner, repo }` pair.
 *
 * Accepts `owner/name` directly, or a bare `name` combined with `?user=`.
 * Returns `null` when an owner cannot be determined.
 */
const resolveTarget = (req) => {
    const raw = req.query.repo?.trim();
    if (!raw) return null;

    if (raw.includes('/')) {
        const [owner, ...rest] = raw.split('/');
        const repo = rest.join('/').trim();
        return owner && repo ? { owner: owner.trim(), repo } : null;
    }

    const owner = req.query.user?.trim();
    return owner ? { owner, repo: raw } : null;
};

/**
 * GET /repo-activity?repo=owner/name  (or ?user=owner&repo=name)
 *
 * Renders the repository's weekly commit activity for the last year as a
 * themed SVG bar chart. Always responds with `image/svg+xml` — error and
 * empty states are rendered as SVG cards so the image never breaks in a README.
 */
export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    const target = resolveTarget(req);
    if (!target) {
        return res.send(renderRepoActivity(null, { error: 'Use ?repo=owner/name' }));
    }

    const { owner, repo } = target;
    const repoLabel = `${owner}/${repo}`;

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const weeks = await getCommitActivity(owner, repo, { token });
        return res.send(renderRepoActivity(weeks, { repo: repoLabel }));
    } catch (err) {
        console.error(`[repo-activity] ${repoLabel}:`, err.message);
        return res.send(renderRepoActivity(null, { repo: repoLabel, error: err.message }));
    }
};
