import { getAllRepos } from '../src/github/repos.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const MIN_TOPICS = 3;
const MAX_TOPICS = 20; // GitHub API hard limit

const suggestTopics = async (repo) => {
    const prompt = `You are a GitHub taxonomy expert. Suggest ${MIN_TOPICS}-6 concise, lowercase, hyphenated topic tags for this GitHub repository.

Repository: ${repo.name}
Description: ${repo.description || '(none)'}
Language: ${repo.language || '(none)'}
Existing topics: ${repo.topics?.join(', ') || '(none)'}

Rules:
- Only return a JSON array of strings, no explanation
- Use lowercase-hyphenated format (e.g. "machine-learning", "rest-api")
- Include the primary language as a topic if not already present
- Prefer well-known ecosystem tags (e.g. "react", "nodejs", "postgres")
- Do not repeat existing topics
- Max 6 new topics

Example output: ["nodejs", "rest-api", "postgresql", "docker"]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error(`Unexpected Gemini response: ${text}`);
    const suggested = JSON.parse(match[0]);
    return suggested.filter(t => typeof t === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(t));
};

const applyTopics = async (owner, repoName, topics, token) => {
    const merged = [...new Set(topics)].slice(0, MAX_TOPICS);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/topics`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ names: merged }),
    });
    if (!res.ok) throw new Error(`GitHub topics PUT failed: ${res.status} ${await res.text()}`);
};

/**
 * GET /improve-topics
 *
 * For every owned repo with fewer than MIN_TOPICS topics, asks Gemini to
 * suggest tags and writes them back to GitHub.
 *
 * Query params:
 *   dry_run   Set to "true" to preview changes without applying them
 */
export default async (req, res) => {
    const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
    if (!token) return res.status(401).json({ error: 'GitHub not connected' });

    const dryRun = req.query.dry_run === 'true';
    const results = { updated: [], skipped: [], errors: [] };

    let repos;
    try {
        repos = await getAllRepos(token);
        if (!repos) return res.status(401).json({ error: 'GitHub not connected' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    const needsTopics = repos.filter(r => (r.topics?.length ?? 0) < MIN_TOPICS && !r.archived && !r.fork);
    console.log(`[improve-topics] ${needsTopics.length} repos need topics`);

    for (const repo of needsTopics) {
        try {
            const suggested = await suggestTopics(repo);
            const merged = [...new Set([...(repo.topics ?? []), ...suggested])];

            if (dryRun) {
                results.updated.push({ repo: repo.name, topics: merged, dry_run: true });
                continue;
            }

            await applyTopics(repo.owner.login, repo.name, merged, token);
            console.log(`  ✓  ${repo.name}: ${merged.join(', ')}`);
            results.updated.push({ repo: repo.name, topics: merged });
        } catch (err) {
            console.error(`  ✗  ${repo.name}: ${err.message}`);
            results.errors.push({ repo: repo.name, error: err.message });
        }
    }

    repos
        .filter(r => (r.topics?.length ?? 0) >= MIN_TOPICS || r.archived || r.fork)
        .forEach(r => results.skipped.push(r.name));

    res.json({
        dry_run: dryRun,
        repos_checked: repos.length,
        repos_updated: results.updated.length,
        repos_skipped: results.skipped.length,
        errors: results.errors.length,
        updated: results.updated,
        errors_detail: results.errors,
    });
};
