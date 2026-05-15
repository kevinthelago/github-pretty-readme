import { renderTechCards } from '../src/tiles/tech-cards.js';
import { getAllRepos } from '../src/github/repos.js';
import { buildTechSeries } from '../src/github/tech-data.js';

/**
 * GET /tech-cards
 *
 * Query params:
 *   categories  Comma-separated category keys (default: all six)
 *   limit       Max techs shown per card (default: 12)
 *   exclude     Comma-separated tech names to drop
 */
export default async (req, res) => {
    const {
        categories: categoriesParam = 'languages,frameworks,cloud,ai,databases,devops',
        limit: limitParam = '12',
        exclude: excludeParam = '',
    } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const requestedCategories = categoriesParam.split(',').map(s => s.trim().toLowerCase());
        const limit = Math.min(parseInt(limitParam, 10) || 12, 12);
        const excluded = excludeParam ? excludeParam.split(',').map(s => s.trim().toLowerCase()) : [];

        const series = buildTechSeries(repos, requestedCategories, limit, excluded);
        if (series.length === 0) return res.status(400).send('No data for requested categories');

        return res.send(renderTechCards(series));
    } catch (err) {
        return res.send(err.message);
    }
};
