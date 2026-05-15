import { renderTechTreemap } from '../src/tiles/tech-treemap.js';
import { getAllRepos } from '../src/github/repos.js';
import { buildTechSeries } from '../src/github/tech-data.js';

/**
 * GET /tech-treemap
 *
 * Query params:
 *   categories  Comma-separated category keys (default: languages,frameworks,cloud)
 *   limit       Max techs per category (default: 8)
 *   exclude     Comma-separated tech names to drop
 */
export default async (req, res) => {
    const {
        categories: categoriesParam = 'languages,frameworks,cloud',
        limit: limitParam = '8',
        exclude: excludeParam = '',
    } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const requestedCategories = categoriesParam.split(',').map(s => s.trim().toLowerCase());
        const limit = Math.min(parseInt(limitParam, 10) || 8, 16);
        const excluded = excludeParam ? excludeParam.split(',').map(s => s.trim().toLowerCase()) : [];

        const series = buildTechSeries(repos, requestedCategories, limit, excluded);
        if (series.length === 0) return res.status(400).send('No data for requested categories');

        return res.send(renderTechTreemap(series));
    } catch (err) {
        return res.send(err.message);
    }
};
