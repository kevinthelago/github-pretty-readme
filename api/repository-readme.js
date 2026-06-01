import { getRepoSnapshot }           from '../src/github/repo-contents.js';
import { analyzeRepo }               from '../src/ai/repo-analyzer.js';
import { scanCache }                 from '../src/scan-cache.js';
import { generateReadmeFromOutline } from '../src/markdown/repo-readme.js';

/**
 * GET /repository-readme?repo={name}[&refresh=true]
 *
 * Generates a README preview for a single repository: returns the rendered
 * markdown plus the underlying analysis so the UI can show a preview before the
 * apply flow pushes it. Requires an authenticated session.
 *
 * Reuses the shared scan cache (keyed by user + bare repo name, matching
 * `/repo-apply`); `?refresh=true` forces a fresh scan. When the analysis has no
 * README outline, `markdown` is `null` and the analysis is still returned.
 *
 * Responses:
 *   200 { markdown: string|null, analysis }
 *   400 missing ?repo=
 *   401 not authenticated
 *   404 repo not found
 *   500 unexpected error
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const repositoryReadme = async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    const repoParam = req.query.repo?.trim();
    if (!repoParam) return res.status(400).json({ error: 'Missing ?repo= parameter' });

    // Accept either "repo" or "owner/repo"; the scan cache is keyed by bare name.
    const repo    = repoParam.includes('/') ? repoParam.split('/').pop() : repoParam;
    const owner   = repoParam.includes('/') ? repoParam.split('/')[0]    : username;
    const refresh = req.query.refresh === 'true';

    try {
        let analysis = refresh ? null : scanCache.get(username, repo);
        if (!analysis) {
            const snapshot = await getRepoSnapshot(token, owner, repo);
            analysis       = await analyzeRepo(snapshot);
            scanCache.set(username, repo, analysis);
        }

        const markdown = generateReadmeFromOutline(repo, analysis);
        return res.json({ markdown, analysis });
    } catch (err) {
        console.error(`[repository-readme] ${username}/${repo}:`, err.message);
        if (/not found/i.test(err.message)) {
            return res.status(404).json({ error: `Repo not found: ${repo}` });
        }
        return res.status(500).json({ error: err.message });
    }
};

export default repositoryReadme;

/**
 * Route descriptor for the auto-registration mechanism (#52). Until that lands,
 * express.js mounts this handler explicitly; the descriptor lets core-http
 * migrate the mount with no change here.
 */
export const route = { method: 'get', path: '/repository-readme', auth: true };
