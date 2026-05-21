import { getAllRepos }                                            from '../src/github/repos.js';
import { getRepoSnapshot }                                       from '../src/github/repo-contents.js';
import { analyzeRepo }                                           from '../src/ai/repo-analyzer.js';
import { scanCache }                                             from '../src/scan-cache.js';
import { generateScoreReport, generateReadmeFromOutline }        from '../src/markdown/score-report.js';
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

const getFile = async (token, repo, path) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers: ghHeaders(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
};

const putFile = async (token, repo, path, content, sha, message) => {
    const body = { message, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) };
    const res  = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`);
};

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

/**
 * GET /apply-all
 *
 * Runs selected bulk operations across all non-fork, non-archived repos.
 *
 * Query params:
 *   score=true        Push SCORE.md to every repo
 *   readme=true       Push AI-generated README.md to every repo
 *   topics=true       Apply AI topics to repos with fewer than 3 tags
 *   descriptions=true Apply AI descriptions to repos missing one
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
        const repos   = await getAllRepos(token);
        if (!repos) return res.status(401).json({ error: 'Failed to fetch repos' });

        const targets = repos.filter(r => !r.archived && !r.fork && r.name !== username);
        log(`Processing ${targets.length} repos (skipping forks, archived, and profile repo).`);

        // ── AI Topics ──────────────────────────────────────────────────────────
        if (doTopics) {
            const needsTopics = targets.filter(r => (r.topics?.length ?? 0) < MIN_TOPICS);
            log(`AI Topics: ${needsTopics.length} repo(s) need tags.`);
            for (const repo of needsTopics) {
                try {
                    const suggested = await suggestTopics(repo);
                    const merged    = [...new Set([...(repo.topics ?? []), ...suggested])];
                    await applyTopics(username, repo.name, merged, token);
                    log(`  ✓ ${repo.name} — topics: ${suggested.join(', ')}`);
                } catch (err) {
                    log(`  ✗ ${repo.name} — topics failed: ${err.message}`);
                }
            }
        }

        // ── AI Descriptions ────────────────────────────────────────────────────
        if (doDescriptions) {
            const needsDesc = targets.filter(r => !r.description?.trim());
            log(`AI Descriptions: ${needsDesc.length} repo(s) need descriptions.`);
            for (const repo of needsDesc) {
                try {
                    const desc = await suggestDescription(repo);
                    await applyDescription(username, repo.name, desc, token);
                    log(`  ✓ ${repo.name} — description added.`);
                } catch (err) {
                    log(`  ✗ ${repo.name} — description failed: ${err.message}`);
                }
            }
        }

        // ── Scan + SCORE.md / README ───────────────────────────────────────────
        if (doScore || doReadme) {
            log(`Scanning ${targets.length} repo(s) for code quality…`);
            for (const repo of targets) {
                try {
                    log(`  Scanning ${repo.name}…`);
                    let analysis = scanCache.get(username, repo.name);
                    if (!analysis) {
                        const snapshot = await getRepoSnapshot(token, username, repo.name);
                        analysis       = await analyzeRepo(snapshot);
                        scanCache.set(username, repo.name, analysis);
                    }

                    if (doScore) {
                        const scoreMd   = generateScoreReport(repo.name, analysis);
                        const scoreFile = await getFile(token, `${username}/${repo.name}`, 'SCORE.md');
                        await putFile(token, `${username}/${repo.name}`, 'SCORE.md', scoreMd, scoreFile?.sha, 'chore: update code quality report');
                        log(`  ✓ ${repo.name} — SCORE.md pushed (${analysis.codeQuality?.grade ?? '?'} ${analysis.codeQuality?.overall ?? '—'}/100).`);
                    }

                    if (doReadme) {
                        const readmeMd = generateReadmeFromOutline(repo.name, analysis);
                        if (readmeMd) {
                            const readmeFile = await getFile(token, `${username}/${repo.name}`, 'README.md');
                            await putFile(token, `${username}/${repo.name}`, 'README.md', readmeMd, readmeFile?.sha, 'docs: generate README via github-pretty-readme');
                            log(`  ✓ ${repo.name} — README.md pushed.`);
                        } else {
                            log(`  — ${repo.name} — README skipped (no outline data).`);
                        }
                    }
                } catch (err) {
                    log(`  ✗ ${repo.name} — ${err.message}`);
                }
            }
        }

        log('Done.');
        res.json({ ok: true, steps });
    } catch (err) {
        console.error('[apply-all]', err.message);
        res.status(500).json({ error: err.message });
    }
};
