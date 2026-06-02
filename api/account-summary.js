import { renderAccountSummary } from '../src/tiles/account-summary.js';
import generateAccountSummary from '../src/ai/model.js';
import { getRepos } from '../src/github/repos.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';

const backgrounds = {
    'cherry-blossom': renderCherryBlossom,
    geometric: renderGeometric,
    'vapor-wave': renderVaporWave,
};

const filterRepos = (repos, projects) => {
    if (!projects) return repos;
    if (/^\d+$/.test(projects)) {
        const n = parseInt(projects, 10);
        return [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, n);
    }
    const names = projects.split(',').map((s) => s.trim());
    return repos.filter((repo) => names.includes(repo.name));
};

/**
 * Render a minimal error tile as SVG. The endpoint always responds with
 * `Content-Type: image/svg+xml`, so failures must return valid SVG rather than
 * a plaintext message that an <img> consumer cannot display. The message is a
 * fixed string (no interpolation) so it is safe to embed without escaping;
 * the underlying error is logged server-side instead of leaked to the client.
 */
const renderErrorTile =
    () => `<svg xmlns="http://www.w3.org/2000/svg" height="120" width="960" viewBox="0 0 960 120" role="img" aria-label="error">
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text x="480" y="68" text-anchor="middle" fill="#ff6b6b" font-family="arial" font-size="22">Failed to generate account summary</text>
</svg>`;

export default async (req, res) => {
    const { username, background, projects } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        let repos = await getRepos(username);
        repos = filterRepos(repos, projects);

        let repoData = repos.map((repo) =>
            Object.fromEntries([
                ['name', repo.name],
                ['description', repo.description],
                ['topics', repo.topics],
            ]),
        );
        let summary = await generateAccountSummary(repoData);

        return res.send(renderAccountSummary(summary, backgrounds[background]));
    } catch (err) {
        console.error('account-summary failed:', err);
        res.status(500);
        return res.send(renderErrorTile());
    }
};
