import { getRepoSnapshot } from '../src/github/repo-contents.js';
import { analyzeRepo }     from '../src/ai/repo-analyzer.js';
import { scanCache }       from '../src/scan-cache.js';
import { requireCredentials, sendJsonError, boolParam } from './_shared.js';

/**
 * GET /repo-scan?repo={repoName}[&refresh=true]
 *
 * Fetches a thorough snapshot of the given repo (file tree, key files,
 * source samples), grades code quality across six dimensions, and returns
 * a structured analysis including suggested topics, README outline, and
 * prioritised improvement suggestions.
 *
 * Results are cached for 4 hours per user/repo pair.
 */
export default async (req, res) => {
    const creds = requireCredentials(req, res);
    if (!creds) return;
    const { token, username } = creds;

    const repo = req.query.repo?.trim();
    if (!repo) return sendJsonError(res, 400, 'bad_request', 'Missing ?repo= parameter');

    const refresh = boolParam(req.query.refresh);

    if (!refresh) {
        const cached = scanCache.get(username, repo);
        if (cached) return res.json({ ok: true, cached: true, ...cached });
    }

    try {
        const snapshot = await getRepoSnapshot(token, username, repo);
        const analysis = await analyzeRepo(snapshot);
        scanCache.set(username, repo, analysis);
        return res.json({ ok: true, cached: false, ...analysis });
    } catch (err) {
        console.error(`[repo-scan] ${username}/${repo}:`, err.message);
        return sendJsonError(res, 500, 'internal_error', err.message);
    }
};
