import { getContributionCalendar } from '../src/github/graphql.js';
import { renderContributionGraph } from '../src/tiles/contribution-graph.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';

const backgrounds = {
    'cherry-blossom': renderCherryBlossom,
    'geometric': renderGeometric,
    'vapor-wave': renderVaporWave,
};

/**
 * Route descriptor consumed by the auto-registration mechanism (#52). Until
 * that lands, express.js mounts this route by an append-only manual line.
 */
export const route = { method: 'get', path: '/contribution-graph', auth: false };

/**
 * GET /contribution-graph?username=&background=
 *
 * Renders a contribution heatmap + streak SVG from the GitHub GraphQL
 * contribution calendar. `username` falls back to the session user; `background`
 * (alias `theme`) selects one of the shared themed backgrounds, matching
 * account-summary.
 */
export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    const username = req.query.username ?? req.session?.github_username;
    if (!username) {
        return res.status(400).send('Missing required "username" query parameter');
    }
    const background = backgrounds[req.query.background ?? req.query.theme];

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const calendar = await getContributionCalendar(token, username);
        return res.send(renderContributionGraph(calendar, background, { username }));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
