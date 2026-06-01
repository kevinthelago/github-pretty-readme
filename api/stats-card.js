import { getUserStats } from '../src/github/graphql.js';
import { renderStatsCard } from '../src/tiles/stats-card.js';

/**
 * Route descriptor consumed by the auto-registration mechanism (#52). Until
 * that lands, express.js mounts this route by an append-only manual line.
 */
export const route = { method: 'get', path: '/stats-card', auth: false };

/**
 * GET /stats-card?username=
 *
 * Renders a GitHub stats card SVG (stars, commits, PRs, issues, followers,
 * repos contributed-to) from the aggregated GraphQL user stats. `username`
 * falls back to the session user.
 */
export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    const username = req.query.username ?? req.session?.github_username;
    if (!username) {
        return res.status(400).send('Missing required "username" query parameter');
    }

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const stats = await getUserStats(token, username);
        return res.send(renderStatsCard(stats));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
