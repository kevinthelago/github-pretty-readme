import { renderTechSpider } from '../src/tiles/tech-spider.js';
import { renderTechTreemap } from '../src/tiles/tech-treemap.js';
import { renderTechCards } from '../src/tiles/tech-cards.js';
import { getAllRepos } from '../src/github/repos.js';
import { buildTechSeries } from '../src/github/tech-data.js';

const RENDERERS = {
    spider:  renderTechSpider,
    treemap: renderTechTreemap,
    cards:   renderTechCards,
};

/**
 * GET /tech-spider
 *
 * Query params:
 *   type        Visualization type: spider | treemap | cards  (default: spider)
 *   categories  Comma-separated: languages, frameworks, cloud, ai, databases, devops
 *               Default: languages,frameworks,cloud
 *   limit       Max techs per category (default: 6)
 *   exclude     Comma-separated tech names to drop
 */
export default async (req, res) => {
    const {
        type = 'spider',
        categories: categoriesParam = 'languages,frameworks,cloud',
        limit: limitParam = '6',
        exclude: excludeParam = '',
        title,
    } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    const render = RENDERERS[type] ?? renderTechSpider;

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const requestedCategories = categoriesParam.split(',').map(s => s.trim().toLowerCase());
        const limit = Math.min(parseInt(limitParam, 10) || 6, 16);
        const excluded = excludeParam ? excludeParam.split(',').map(s => s.trim().toLowerCase()) : [];

        const series = buildTechSeries(repos, requestedCategories, limit, excluded);
        if (series.length === 0) return res.status(400).send('No data for requested categories');

        return res.send(render(series, title));
    } catch (err) {
        return res.send(err.message);
    }
};
