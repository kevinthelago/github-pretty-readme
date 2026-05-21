import { getAllRepos } from '../src/github/repos.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const suggestDescription = async (repo) => {
    const prompt = `Write a single-sentence GitHub repository description for the following project.

Repository: ${repo.name}
Language: ${repo.language || '(unknown)'}
Topics: ${repo.topics?.join(', ') || '(none)'}

Rules:
- One sentence, max 120 characters
- No quotes, no markdown, no trailing period
- Start with a verb (e.g. "Generates...", "Manages...", "CLI tool for...")
- Be specific — mention the language/framework if relevant
- Return only the description string, nothing else`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/^["']|["']$/g, '').slice(0, 350);
};

const applyDescription = async (owner, repoName, description, token) => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
    });
    if (!res.ok) throw new Error(`GitHub PATCH failed: ${res.status} ${await res.text()}`);
};

/**
 * GET /improve-descriptions
 *
 * For every owned repo with no description, asks Gemini to write one and
 * applies it via the GitHub API.
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

    const needsDescription = repos.filter(r => !r.description?.trim() && !r.archived && !r.fork);
    console.log(`[improve-descriptions] ${needsDescription.length} repos need descriptions`);

    for (const repo of needsDescription) {
        try {
            const description = await suggestDescription(repo);

            if (dryRun) {
                results.updated.push({ repo: repo.name, description, dry_run: true });
                continue;
            }

            await applyDescription(repo.owner.login, repo.name, description, token);
            console.log(`  ✓  ${repo.name}: ${description}`);
            results.updated.push({ repo: repo.name, description });
        } catch (err) {
            console.error(`  ✗  ${repo.name}: ${err.message}`);
            results.errors.push({ repo: repo.name, error: err.message });
        }
    }

    repos
        .filter(r => r.description?.trim() || r.archived || r.fork)
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
