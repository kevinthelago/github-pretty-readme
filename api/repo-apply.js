import { getRepoSnapshot }                        from '../src/github/repo-contents.js';
import { analyzeRepo }                            from '../src/ai/repo-analyzer.js';
import { scanCache }                              from '../src/scan-cache.js';
import { generateScoreReport, generateReadmeFromOutline } from '../src/markdown/score-report.js';

const ghHeaders = (token) => ({
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
});

const getFile = async (token, repo, path) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers: ghHeaders(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
};

const putFile = async (token, repo, path, content, sha, message) => {
    const body = { message, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) };
    const res  = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 403) {
            throw new Error(
                `PUT ${path} → 403: GitHub denied write access. ` +
                `Check that your GitHub App has Contents: Read & write permission and is installed on this repo.`
            );
        }
        throw new Error(`PUT ${path} → ${res.status}: ${text}`);
    }
};

/**
 * GET /repo-apply?repo={name}[&readme=true]
 *
 * Pushes SCORE.md to the target repository.
 * If &readme=true, also generates and pushes README.md from the scan outline.
 * Uses cached scan data if available; otherwise runs a fresh scan.
 */
export default async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    const repo          = req.query.repo?.trim();
    const generateReadme = req.query.readme === 'true';
    if (!repo) return res.status(400).json({ error: 'Missing ?repo= parameter' });

    const steps = [];
    const log   = (msg) => { steps.push(msg); console.log(`[repo-apply] ${username}/${repo}: ${msg}`); };

    try {
        // Use cached scan or run fresh
        let analysis = scanCache.get(username, repo);
        if (!analysis) {
            log('Running repo scan…');
            const snapshot = await getRepoSnapshot(token, username, repo);
            analysis       = await analyzeRepo(snapshot);
            scanCache.set(username, repo, analysis);
        } else {
            log('Using cached scan data…');
        }

        const fullRepo = `${username}/${repo}`;

        // Push SCORE.md
        log('Generating SCORE.md…');
        const scoreMd   = generateScoreReport(repo, analysis);
        const scoreFile = await getFile(token, fullRepo, 'SCORE.md');
        await putFile(token, fullRepo, 'SCORE.md', scoreMd, scoreFile?.sha, 'chore: update code quality report');
        log('Pushed SCORE.md.');

        // Optionally push README.md
        if (generateReadme) {
            const readmeMd = generateReadmeFromOutline(repo, analysis);
            if (readmeMd) {
                log('Generating README.md…');
                const readmeFile = await getFile(token, fullRepo, 'README.md');
                await putFile(token, fullRepo, 'README.md', readmeMd, readmeFile?.sha, 'docs: generate README via github-pretty-readme');
                log('Pushed README.md.');
            } else {
                log('Skipped README.md — no outline data available.');
            }
        }

        steps.push('Done.');
        res.json({ ok: true, steps });
    } catch (err) {
        console.error(`[repo-apply] ${username}/${repo}:`, err.message);
        res.status(500).json({ error: err.message });
    }
};
