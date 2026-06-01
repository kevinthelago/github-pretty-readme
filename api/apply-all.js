import { getAllRepos }                                            from '../src/github/repos.js';
import { getRepoSnapshot }                                       from '../src/github/repo-contents.js';
import { analyzeRepo }                                           from '../src/ai/repo-analyzer.js';
import { scanCache }                                             from '../src/scan-cache.js';
import { generateScoreReport }                                    from '../src/markdown/score-report.js';
import { generateReadmeFromOutline, scoreBadgeMd }                from '../src/markdown/repo-readme.js';
import { readConfig }                                            from '../src/github/config.js';
import { readState, writeState }                                 from '../src/github/run-state.js';
import { getRepoInfo, ensureBranch, getFile, getFileSha, putFile, openOrUpdatePR } from '../src/github/pr-writer.js';
import { GoogleGenerativeAI }                                    from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const MIN_TOPICS = 3;
const MAX_TOPICS = 20;

const ghHeaders = (token) => ({
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
});

const suggestTopics = async (repo) => {
    const prompt = `Suggest ${MIN_TOPICS}-6 concise lowercase hyphenated GitHub topic tags for this repo.
Repository: ${repo.name}
Description: ${repo.description || '(none)'}
Language: ${repo.language || '(none)'}
Existing topics: ${repo.topics?.join(', ') || '(none)'}
Return only a JSON array of strings, no explanation. Max 6 new topics.`;
    const result = await model.generateContent(prompt);
    const match  = result.response.text().trim().match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const suggested = JSON.parse(match[0]);
    return suggested.filter(t => typeof t === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(t));
};

const applyTopics = async (owner, repoName, topics, token) => {
    const names = [...new Set(topics)].slice(0, MAX_TOPICS);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/topics`, {
        method: 'PUT', headers: ghHeaders(token), body: JSON.stringify({ names }),
    });
    if (!res.ok) throw new Error(`Topics PUT → ${res.status}: ${await res.text()}`);
    return names;
};

const suggestDescription = async (repo) => {
    const prompt = `Write a single-sentence GitHub repo description (max 120 chars, no quotes, no period).
Repository: ${repo.name}
Language: ${repo.language || '(unknown)'}
Topics: ${repo.topics?.join(', ') || '(none)'}
Return only the description string.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/^["']|["']$/g, '').slice(0, 350);
};

const applyDescription = async (owner, repoName, description, token) => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        method: 'PATCH', headers: ghHeaders(token), body: JSON.stringify({ description }),
    });
    if (!res.ok) throw new Error(`Description PATCH → ${res.status}: ${await res.text()}`);
};

const hasScoreMd = async (token, owner, repo) => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/SCORE.md`, {
        headers: ghHeaders(token),
    });
    return res.status === 200;
};

const todayBranch = () => {
    const d = new Date();
    return `pretty-readme/${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const buildPRBody = ({ scorePushed, readmePushed, workflowPushed, topicsApplied, descriptionApplied, grade, score, isFirstRun, headSha }) => {
    const lines = ['Automated update from [github-pretty-readme](https://github.com/kevinthelago/github-pretty-readme).\n'];

    if (headSha) lines.push(`> Based on commit \`${headSha.slice(0, 7)}\`\n`);

    if (scorePushed || readmePushed || workflowPushed) {
        lines.push('### Files changed');
        if (readmePushed)    lines.push('- `README.md` — AI-generated project documentation');
        if (scorePushed)     lines.push(`- \`SCORE.md\` — Code quality report${grade ? ` · **${grade}** (${score}/100)` : ''}`);
        if (workflowPushed)  lines.push('- `.github/workflows/pretty-readme-score.yml` — Daily score refresh at 05:00 UTC (uses `GITHUB_TOKEN`, no PAT needed)');
        lines.push('');
    }

    if (topicsApplied?.length) {
        lines.push('### Metadata applied');
        lines.push(`- **Topics** — \`${topicsApplied.join('`, `')}\``);
        if (descriptionApplied) lines.push(`- **Description** — ${descriptionApplied}`);
        lines.push('');
    } else if (descriptionApplied) {
        lines.push('### Metadata applied');
        lines.push(`- **Description** — ${descriptionApplied}`);
        lines.push('');
    }

    lines.push('---');
    lines.push(isFirstRun
        ? '*First run — no prior state recorded for this repo.*'
        : '*Topics and description were applied immediately. Merge this PR to apply the file changes.*');
    return lines.join('\n');
};

/**
 * GET /apply-all
 *
 * Skip logic (per repo):
 *   - Fetches the HEAD SHA of the default branch (one fast API call).
 *   - If .pretty-readme-state.json records the same SHA as last run → skip.
 *   - If no state entry + no SCORE.md present → first run → proceed.
 *   - If no state entry + SCORE.md exists → state was lost → re-run to resync.
 *   - If SHA differs → new commits since last run → proceed, update the PR.
 *   State is written back to the profile repo at the end of the run.
 *
 * Scope (repos query param):
 *   repos=*          → all eligible repos (UI mode, no config needed)
 *   repos=a,b,c      → specific repos (UI mode)
 *   repos absent     → require .pretty-readme.json allowlist (cron mode)
 *
 * Feature flags:
 *   score=true        Push SCORE.md via PR
 *   readme=true       Push README.md via PR
 *   topics=true       Apply AI topics immediately
 *   descriptions=true Apply AI descriptions immediately
 */
export default async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    const doScore        = req.query.score        === 'true';
    const doReadme       = req.query.readme       === 'true';
    const doTopics       = req.query.topics       === 'true';
    const doDescriptions = req.query.descriptions === 'true';
    const doWorkflow     = req.query.workflow     === 'true';

    const isSSE = req.headers.accept?.includes('text/event-stream');
    if (isSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
    }
    const send = isSSE ? (data) => res.write(`data: ${JSON.stringify(data)}\n\n`) : null;

    const steps = [];
    const log   = (msg, kind = 'info') => {
        steps.push(msg);
        console.log(`[apply-all] ${msg}`);
        send?.({ type: 'step', msg, kind });
    };

    try {
        // ── Load run state (best-effort — don't abort if unavailable) ──────────
        let runState = { repos: {} };
        let stateSha = null;
        try {
            ({ state: runState, sha: stateSha } = await readState(token, username));
        } catch (err) {
            log(`Warning: could not load run state (${err.message}) — all repos will be processed.`);
        }

        // ── Fetch repos ────────────────────────────────────────────────────────
        const allRepos = await getAllRepos(token);
        if (!allRepos) return res.status(401).json({ error: 'Failed to fetch repos' });

        const eligible = allRepos.filter(r => !r.archived && !r.fork && r.name !== username);

        // ── Determine target set ───────────────────────────────────────────────
        let targets;
        if (req.query.repos === '*') {
            targets = eligible;
            log(`Scope: all eligible repos (${targets.length}).`);
        } else if (req.query.repos) {
            const names = new Set(req.query.repos.split(',').map(r => r.trim()).filter(Boolean));
            targets = eligible.filter(r => names.has(r.name));
            log(`Scope: selected repos — ${[...names].join(', ')} (${targets.length} matched).`);
        } else {
            const configResult = await readConfig(token, username);
            if (!configResult) {
                return res.status(400).json({
                    error: 'No .pretty-readme.json found in your profile repo. Add a config with a "repos" allowlist first.',
                });
            }
            const allowlist = new Set(configResult.config.repos ?? []);
            if (allowlist.size === 0) {
                return res.status(400).json({ error: '.pretty-readme.json "repos" list is empty.' });
            }
            targets = eligible.filter(r => allowlist.has(r.name));
            log(`Scope: allowlist — ${[...allowlist].join(', ')} (${targets.length} matched).`);
        }

        log(`Processing ${targets.length} repo(s).`);
        send?.({ type: 'progress', pct: 2, msg: `Found ${targets.length} repo${targets.length !== 1 ? 's' : ''} to check…` });

        const branchName  = todayBranch();
        const results     = [];
        let   stateChanged = false;
        const total = targets.length;

        for (let idx = 0; idx < targets.length; idx++) {
            const repo = targets[idx];
            const repoPct = (pct) => Math.round(2 + (idx / total + pct / 100 / total) * 95);
            send?.({ type: 'progress', pct: repoPct(0), msg: `Checking ${repo.name}…` });
            log(`\n── ${repo.name} ──`);
            const repoLog = [];

            // ── Fetch HEAD SHA (also used later by ensureBranch) ───────────────
            let repoInfo;
            try {
                repoInfo = await getRepoInfo(token, username, repo.name);
            } catch (err) {
                log(`  ✗ Could not fetch repo info: ${err.message}`);
                repoLog.push(`✗ Skipped — ${err.message}`);
                results.push({ repo: repo.name, log: repoLog });
                continue;
            }
            const { sha: headSha } = repoInfo;

            // ── Skip check ────────────────────────────────────────────────────
            const lastEntry = runState.repos?.[repo.name];
            if (lastEntry?.lastCommitSha && lastEntry.lastCommitSha === headSha) {
                log(`  — Skipped (no commits since ${lastEntry.lastRunAt ?? 'last run'}).`, 'skip');
                repoLog.push(`— Skipped — no new commits since last run (${headSha.slice(0, 7)}).`);
                send?.({ type: 'progress', pct: repoPct(100), msg: `${repo.name} — skipped (no changes)` });
                results.push({ repo: repo.name, log: repoLog, skipped: true });
                continue;
            }

            // ── Determine run reason ──────────────────────────────────────────
            const isFirstRun = !lastEntry;
            if (isFirstRun) {
                const signed = await hasScoreMd(token, username, repo.name).catch(() => false);
                log(`  ${signed ? '↻ Re-run (state lost, SCORE.md found).' : '★ First run.'}`);
            } else {
                log(`  ↻ New commits detected (${lastEntry.lastCommitSha?.slice(0, 7)} → ${headSha.slice(0, 7)}).`);
            }

            const meta = { topicsApplied: null, descriptionApplied: null, scorePushed: false, readmePushed: false, workflowPushed: false, isFirstRun, headSha };

            // ── Apply topics immediately ───────────────────────────────────────
            if (doTopics && (repo.topics?.length ?? 0) < MIN_TOPICS) {
                try {
                    const suggested = await suggestTopics(repo);
                    const merged    = [...new Set([...(repo.topics ?? []), ...suggested])];
                    meta.topicsApplied = await applyTopics(username, repo.name, merged, token);
                    repoLog.push(`✓ Topics applied: ${suggested.join(', ')}`);
                    log(`  ✓ Topics: ${suggested.join(', ')}`);
                } catch (err) {
                    repoLog.push(`✗ Topics failed: ${err.message}`);
                    log(`  ✗ Topics: ${err.message}`);
                }
            }

            // ── Apply description immediately ──────────────────────────────────
            if (doDescriptions && !repo.description?.trim()) {
                try {
                    const desc = await suggestDescription(repo);
                    await applyDescription(username, repo.name, desc, token);
                    meta.descriptionApplied = desc;
                    repoLog.push(`✓ Description applied.`);
                    log(`  ✓ Description applied.`);
                } catch (err) {
                    repoLog.push(`✗ Description failed: ${err.message}`);
                    log(`  ✗ Description: ${err.message}`);
                }
            }

            // ── File changes via PR ────────────────────────────────────────────
            if (doScore || doReadme || doWorkflow) {
                try {
                    // Analysis is only needed for score/readme, not workflow-only runs
                    let analysis = null;
                    if (doScore || doReadme) {
                        analysis = scanCache.get(username, repo.name);
                        if (!analysis) {
                            send?.({ type: 'progress', pct: repoPct(30), msg: `Scanning ${repo.name}…` });
                            log(`  Scanning ${repo.name}…`);
                            const snapshot = await getRepoSnapshot(token, username, repo.name);
                            analysis       = await analyzeRepo(snapshot);
                            scanCache.set(username, repo.name, analysis);
                        }
                    }

                    // Pass prefetched repoInfo so ensureBranch skips a redundant API call
                    const { defaultBranch } = await ensureBranch(token, username, repo.name, branchName, repoInfo);
                    log(`  Branch ${branchName} ready (base: ${defaultBranch}).`);

                    if (doScore && analysis) {
                        send?.({ type: 'progress', pct: repoPct(60), msg: `Pushing SCORE.md to ${repo.name}…` });
                        const scoreMd = generateScoreReport(repo.name, analysis);
                        const sha     = await getFileSha(token, username, repo.name, 'SCORE.md', branchName);
                        await putFile(token, username, repo.name, 'SCORE.md', scoreMd, sha, 'chore: update code quality report', branchName);
                        meta.scorePushed = true;
                        meta.grade  = analysis.codeQuality?.grade;
                        meta.score  = analysis.codeQuality?.overall;
                        repoLog.push(`✓ SCORE.md pushed (${meta.grade ?? '?'} ${meta.score ?? '—'}/100).`);
                        log(`  ✓ SCORE.md pushed.`);
                    }

                    if (doWorkflow) {
                        const workflowPath = '.github/workflows/pretty-readme-score.yml';
                        const wfExists     = await getFileSha(token, username, repo.name, workflowPath, defaultBranch);
                        if (!wfExists) {
                            const serviceUrl  = process.env.BASE_URL ?? 'http://localhost:8080';
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
                            await putFile(token, username, repo.name, workflowPath, workflowYml, null, 'ci: add daily code quality score workflow', branchName);
                            meta.workflowPushed = true;
                            repoLog.push(`✓ Daily score workflow added.`);
                            log(`  ✓ Workflow pushed to PR branch.`);
                        } else {
                            repoLog.push(`— Workflow already present, skipped.`);
                            log(`  — Workflow already present.`);
                        }
                    }

                    // Patch code quality badge in existing README.md (when scoring but not regenerating)
                    if (doScore && !doReadme && analysis) {
                        const BADGE_RE = /\[!\[Code Quality\]\(https:\/\/img\.shields\.io[^)]+\)\]\(SCORE\.md\)/;
                        const badge    = scoreBadgeMd(analysis);
                        const readme   = await getFile(token, username, repo.name, 'README.md', branchName);
                        if (readme && BADGE_RE.test(readme.content)) {
                            const updated = readme.content.replace(BADGE_RE, badge);
                            if (updated !== readme.content) {
                                await putFile(token, username, repo.name, 'README.md', updated, readme.sha, 'chore: update code quality badge', branchName);
                                meta.readmePushed = true;
                                repoLog.push('✓ README.md badge updated.');
                                log('  ✓ Badge updated in README.md.');
                            }
                        }
                    }

                    if (doReadme && analysis) {
                        const readmeMd = generateReadmeFromOutline(repo.name, analysis);
                        if (readmeMd) {
                            const sha = await getFileSha(token, username, repo.name, 'README.md', branchName);
                            await putFile(token, username, repo.name, 'README.md', readmeMd, sha, 'docs: generate README via github-pretty-readme', branchName);
                            meta.readmePushed = true;
                            repoLog.push(`✓ README.md pushed.`);
                            log(`  ✓ README.md pushed.`);
                        } else {
                            repoLog.push(`— README skipped (no outline data).`);
                            log(`  — README skipped.`);
                        }
                    }

                    if (meta.scorePushed || meta.readmePushed || meta.workflowPushed) {
                        send?.({ type: 'progress', pct: repoPct(85), msg: `Opening PR for ${repo.name}…` });
                        const prTitle = `pretty-readme: auto-update ${branchName.split('/')[1]}`;
                        const prBody  = buildPRBody(meta);
                        const pr      = await openOrUpdatePR(token, username, repo.name, branchName, defaultBranch, prTitle, prBody);
                        repoLog.push(`✓ PR ${pr.updated ? 'updated' : 'opened'}: ${pr.url}`);
                        log(`  ✓ PR ${pr.updated ? 'updated' : 'opened'}: ${pr.url}`);
                    }
                } catch (err) {
                    repoLog.push(`✗ File changes failed: ${err.message}`);
                    log(`  ✗ ${err.message}`);
                }
            }

            // ── Record new state for this repo ────────────────────────────────
            runState.repos[repo.name] = {
                lastCommitSha: headSha,
                lastRunAt:     new Date().toISOString(),
            };
            stateChanged = true;
            send?.({ type: 'progress', pct: repoPct(100), msg: `${repo.name} — done` });

            results.push({ repo: repo.name, log: repoLog });
        }

        // ── Persist state ──────────────────────────────────────────────────────
        if (stateChanged) {
            send?.({ type: 'progress', pct: 98, msg: 'Saving run state…' });
            try {
                await writeState(token, username, runState, stateSha);
                log('\nRun state saved.');
            } catch (err) {
                log(`\nWarning: could not save run state — ${err.message}`);
            }
        }

        send?.({ type: 'progress', pct: 100, msg: 'Done.' });
        log('Done.');
        const result = { ok: true, steps, results };
        if (send) { send({ type: 'done', ...result }); res.end(); } else { res.json(result); }
    } catch (err) {
        console.error('[apply-all]', err.message);
        if (send) { send({ type: 'error', msg: err.message }); res.end(); }
        else res.status(500).json({ error: err.message });
    }
};
