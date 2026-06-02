import { getAllRepos } from '../src/github/repos.js';
import { computeRating } from '../src/github/developer-rating.js';
import { fetchWorkflowMetrics } from '../src/github/workflow-metrics.js';
import { renderDeveloperRating } from '../src/tiles/developer-rating.js';
import { resolveAuth, sendErrorSvg } from './_shared.js';

export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const { token } = resolveAuth(req, { allowEnv: true });
        const repos = await getAllRepos(token);
        if (!repos) return sendErrorSvg(res, 'GitHub not connected');

        const [workflowMetrics] = await Promise.allSettled([fetchWorkflowMetrics(token, repos)]);
        const metrics = workflowMetrics.status === 'fulfilled' ? workflowMetrics.value : null;

        const rating = computeRating(repos, metrics);
        return res.send(renderDeveloperRating(rating));
    } catch (err) {
        return sendErrorSvg(res, err.message);
    }
};
