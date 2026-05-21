import { getRepoSnapshot } from '../src/github/repo-contents.js';
import { analyzeRepo }     from '../src/ai/repo-analyzer.js';
import { scanCache }       from '../src/scan-cache.js';

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
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    const repo = req.query.repo?.trim();
    if (!repo) return res.status(400).json({ error: 'Missing ?repo= parameter' });

    const refresh = req.query.refresh === 'true';

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
        return res.status(500).json({ error: err.message });
    }
};
