import { getRepoSnapshot }                        from '../src/github/repo-contents.js';
import { analyzeRepo }                            from '../src/ai/repo-analyzer.js';
import { scanCache }                              from '../src/scan-cache.js';
import { generateScoreReport }                       from '../src/markdown/score-report.js';
import { generateReadmeFromOutline, scoreBadgeMd }   from '../src/markdown/repo-readme.js';
import { sendJsonError, boolParam }                  from './_shared.js';

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
            const isWorkflow = path.startsWith('.github/workflows/');
            throw new Error(
                `PUT ${path} → 403: GitHub denied write access. ` +
                (isWorkflow
                    ? `Workflow files require the Workflows permission on your GitHub App (separate from Contents).`
                    : `Check that your GitHub App has Contents: Read & write permission and is installed on this repo.`)
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
    let token    = req.session?.github_token;
    let username = req.session?.github_username;

    // Bearer token auth for scheduled GitHub Actions workflows
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.slice(7);
        const repoParam = req.query.repo?.trim() ?? '';
        if (repoParam.includes('/')) {
            // owner/repo format supplied — derive username from it (avoids /user call for GITHUB_TOKEN)
            username = repoParam.split('/')[0];
        } else {
            try {
                const userRes = await fetch('https://api.github.com/user', {
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
                });
                if (!userRes.ok) return sendJsonError(res, 401, 'invalid_token', 'Invalid token');
                username = (await userRes.json()).login;
            } catch {
                return sendJsonError(res, 401, 'invalid_token', 'Failed to verify token');
            }
        }
    }

    if (!token || !username) return sendJsonError(res, 401, 'unauthenticated', 'Not authenticated');

    const repoParam      = req.query.repo?.trim();
    const generateReadme = boolParam(req.query.readme);
    const pushWorkflow   = boolParam(req.query.workflow);
    if (!repoParam) return sendJsonError(res, 400, 'bad_request', 'Missing ?repo= parameter');

    const fullRepo = repoParam.includes('/') ? repoParam : `${username}/${repoParam}`;
    const repo     = fullRepo.split('/').pop();

    const steps = [];
    const log   = (msg) => { steps.push(msg); console.log(`[repo-apply] ${fullRepo}: ${msg}`); };

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

        // Push SCORE.md
        log('Generating SCORE.md…');
        const scoreMd   = generateScoreReport(repo, analysis);
        const scoreFile = await getFile(token, fullRepo, 'SCORE.md');
        await putFile(token, fullRepo, 'SCORE.md', scoreMd, scoreFile?.sha, 'chore: update code quality report');
        log('Pushed SCORE.md.');

        // Update README.md — generate fresh or patch the existing badge
        const badge      = scoreBadgeMd(analysis);
        const BADGE_RE   = /\[!\[Code Quality\]\(https:\/\/img\.shields\.io[^)]+\)\]\(SCORE\.md\)/;
        const readmeFile = await getFile(token, fullRepo, 'README.md');
        const existingMd = readmeFile ? Buffer.from(readmeFile.content, 'base64').toString('utf8') : null;
        const readmeSha  = readmeFile?.sha ?? null;

        if (generateReadme) {
            const generated = generateReadmeFromOutline(repo, analysis);
            if (generated) {
                log('Generating README.md…');
                await putFile(token, fullRepo, 'README.md', `${badge}\n\n${generated}`, readmeSha, 'docs: generate README via github-pretty-readme');
                log('Pushed README.md.');
            } else {
                log('Skipped README.md — no outline data available.');
            }
        } else if (existingMd && BADGE_RE.test(existingMd)) {
            const updated = existingMd.replace(BADGE_RE, badge);
            if (updated !== existingMd) {
                await putFile(token, fullRepo, 'README.md', updated, readmeSha, 'chore: update code quality badge');
                log('Updated code quality badge in README.md.');
            }
        }

        // Push workflow if requested and not already present in the repo
        const serviceUrl   = process.env.BASE_URL ?? 'http://localhost:8080';
        const workflowPath = '.github/workflows/pretty-readme-score.yml';
        const existingWf   = pushWorkflow ? await getFile(token, fullRepo, workflowPath) : { exists: true };
        if (pushWorkflow && !existingWf) {
            const workflowYml = [
                'name: Update Code Quality Score',
                'on:',
                '  schedule:',
                "    - cron: '0 5 * * *'",
                '  workflow_dispatch:',
                'permissions:',
                '  contents: write',
                'jobs:',
                '  score:',
                '    runs-on: ubuntu-latest',
                '    steps:',
                '      - name: Update SCORE.md',
                '        run: >-',
                '          curl -sf',
                '          -H "Authorization: Bearer ${{ secrets.GITHUB_TOKEN }}"',
                `          "${serviceUrl}/repo-apply?repo=\${{ github.repository }}"`,
            ].join('\n') + '\n';
            await putFile(token, fullRepo, workflowPath, workflowYml, null, 'ci: add daily code quality score workflow');
            log('Pushed .github/workflows/pretty-readme-score.yml — runs daily at 05:00 UTC using GITHUB_TOKEN (no PAT needed).');
        }

        steps.push('Done.');
        res.json({ ok: true, steps });
    } catch (err) {
        console.error(`[repo-apply] ${username}/${repo}:`, err.message);
        sendJsonError(res, 500, 'internal_error', err.message);
    }
};
