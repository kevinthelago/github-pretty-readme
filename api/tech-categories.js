import { getAllRepos } from '../src/github/repos.js';
import { buildTechSeries } from '../src/github/tech-data.js';
import { CATEGORY_META } from '../src/data/tech-taxonomy.js';

const ALL_CATEGORIES = Object.keys(CATEGORY_META);

/**
 * GET /tech-categories
 * Returns the list of categories that have at least one detected technology.
 *
 * Query params:
 *   limit   Max techs per category to consider (default: 8)
 */
export default async (req, res) => {
    const { limit: limitParam = '8' } = req.query;
    const limit = parseInt(limitParam, 10) || 8;

    res.setHeader('Content-Type', 'application/json');

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const repos = await getAllRepos(token);
        if (!repos) return res.status(401).json({ error: 'GitHub not connected' });

        const series = buildTechSeries(repos, ALL_CATEGORIES, limit, []);

        return res.json(series.map(s => ({
            category: s.key,
            label: s.label,
            color: s.color,
            count: s.techs.length,
        })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
