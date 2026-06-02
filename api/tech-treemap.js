import { renderTechTreemap } from '../src/tiles/tech-treemap.js';
import { getAllRepos } from '../src/github/repos.js';
import { buildTechSeries } from '../src/github/tech-data.js';
import { resolveAuth, sendErrorSvg, intParam, listParam } from './_shared.js';

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
    } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const { token } = resolveAuth(req, { allowEnv: true });
        const repos = await getAllRepos(token);
        if (!repos) return sendErrorSvg(res, 'GitHub not connected');

        const requestedCategories = listParam(categoriesParam, { lowercase: true });
        const limit = intParam(req.query.limit, 8, { min: 1, max: 16 });
        const excluded = listParam(req.query.exclude, { lowercase: true });

        const series = buildTechSeries(repos, requestedCategories, limit, excluded);
        if (series.length === 0) return sendErrorSvg(res, 'No data for requested categories');

        return res.send(renderTechTreemap(series));
    } catch (err) {
        return sendErrorSvg(res, err.message);
    }
};
