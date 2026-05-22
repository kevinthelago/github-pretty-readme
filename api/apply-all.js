import { getAllRepos }                                            from '../src/github/repos.js';
import { getRepoSnapshot }                                       from '../src/github/repo-contents.js';
import { analyzeRepo }                                           from '../src/ai/repo-analyzer.js';
import { scanCache }                                             from '../src/scan-cache.js';
import { generateScoreReport, generateReadmeFromOutline }        from '../src/markdown/score-report.js';
import { readConfig }                                            from '../src/github/config.js';
import { ensureBranch, getFileSha, putFile, openOrUpdatePR }    from '../src/github/pr-writer.js';
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

const todayBranch = () => {
    const d = new Date();
    return `pretty-readme/${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const buildPRBody = ({ scorePushed, readmePushed, topicsApplied, descriptionApplied, grade, score }) => {
    const lines = ['Automated update from [github-pretty-readme](https://github.com/kevinthelago/github-pretty-readme).\n'];

    if (scorePushed || readmePushed) {
        lines.push('### Files changed');
        if (readmePushed) lines.push('- `README.md` — AI-generated project documentation');
        if (scorePushed)  lines.push(`- \`SCORE.md\` — Code quality report${grade ? ` · **${grade}** (${score}/100)` : ''}`);
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
    lines.push('*Topics and description were applied immediately. Merge this PR to apply the file changes.*');
    return lines.join('\n');
};

/**
 * GET /apply-all
 *
 * Reads the allowlist from .pretty-readme.json in the user's profile repo.
 * For each allowlisted repo:
 *   - Topics/descriptions are applied immediately (metadata, not file-based).
 *   - SCORE.md / README.md are pushed to a `pretty-readme/YYYY-MM-DD` branch
 *     and a PR is opened (or updated if the branch already existed).
 *
 * Query params:
 *   score=true        Include SCORE.md in the PR
 *   readme=true       Include README.md in the PR
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

    const steps = [];
    const log   = (msg) => { steps.push(msg); console.log(`[apply-all] ${msg}`); };

    try {
        // ── Fetch repos ────────────────────────────────────────────────────────
        const allRepos = await getAllRepos(token);
        if (!allRepos) return res.status(401).json({ error: 'Failed to fetch repos' });

        const eligible = allRepos.filter(r => !r.archived && !r.fork && r.name !== username);

        // ── Determine target set ───────────────────────────────────────────────
        // repos=*          → all eligible (UI "All Repositories" mode, no config needed)
        // repos=a,b,c      → specific repos by name (UI "Select Repositories" mode)
        // repos absent     → require .pretty-readme.json allowlist (cron job mode)
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

        const branchName = todayBranch();
        const results    = [];

        for (const repo of targets) {
            const fullRepo = `${username}/${repo.name}`;
            const repoLog  = [];
            const meta     = { topicsApplied: null, descriptionApplied: null, scorePushed: false, readmePushed: false };

            log(`\n── ${repo.name} ──`);

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
            if (doScore || doReadme) {
                try {
                    let analysis = scanCache.get(username, repo.name);
                    if (!analysis) {
                        log(`  Scanning ${repo.name}…`);
                        const snapshot = await getRepoSnapshot(token, username, repo.name);
                        analysis       = await analyzeRepo(snapshot);
                        scanCache.set(username, repo.name, analysis);
                    }

                    const { defaultBranch } = await ensureBranch(token, username, repo.name, branchName);
                    log(`  Branch ${branchName} ready (base: ${defaultBranch}).`);

                    if (doScore) {
                        const scoreMd  = generateScoreReport(repo.name, analysis);
                        const sha      = await getFileSha(token, username, repo.name, 'SCORE.md', branchName);
                        await putFile(token, username, repo.name, 'SCORE.md', scoreMd, sha, 'chore: update code quality report', branchName);
                        meta.scorePushed = true;
                        meta.grade  = analysis.codeQuality?.grade;
                        meta.score  = analysis.codeQuality?.overall;
                        repoLog.push(`✓ SCORE.md pushed (${meta.grade ?? '?'} ${meta.score ?? '—'}/100).`);
                        log(`  ✓ SCORE.md pushed.`);
                    }

                    if (doReadme) {
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

                    if (meta.scorePushed || meta.readmePushed) {
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

            results.push({ repo: repo.name, log: repoLog });
        }

        log('\nDone.');
        res.json({ ok: true, steps, results });
    } catch (err) {
        console.error('[apply-all]', err.message);
        res.status(500).json({ error: err.message });
    }
};
