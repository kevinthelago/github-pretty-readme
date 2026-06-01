import { renderTechSpider } from '../src/tiles/tech-spider.js';
import { renderTechTreemap } from '../src/tiles/tech-treemap.js';
import { renderTechCards } from '../src/tiles/tech-cards.js';
import { renderTechGrid } from '../src/tiles/tech-grid.js';
import { getAllRepos } from '../src/github/repos.js';
import { buildTechSeries } from '../src/github/tech-data.js';
import { resolveAuth, sendErrorSvg, intParam, listParam } from './_shared.js';

const RENDERERS = {
    spider:  renderTechSpider,
    treemap: renderTechTreemap,
    cards:   renderTechCards,
    grid:    renderTechGrid,
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
        title,
    } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    const render = RENDERERS[type] ?? renderTechSpider;

    try {
        const { token } = resolveAuth(req, { allowEnv: true });
        const repos = await getAllRepos(token);
        if (!repos) return sendErrorSvg(res, 'GitHub not connected');

        const requestedCategories = listParam(categoriesParam, { lowercase: true });
        const limit = intParam(req.query.limit, 6, { min: 1, max: 16 });
        const excluded = listParam(req.query.exclude, { lowercase: true });

        const series = buildTechSeries(repos, requestedCategories, limit, excluded);
        if (series.length === 0) return sendErrorSvg(res, 'No data for requested categories');

        const opts = { columns: intParam(req.query.columns, 2, { min: 1, max: 4 }) };
        return res.send(render(series, title, opts));
    } catch (err) {
        return sendErrorSvg(res, err.message);
    }
};
