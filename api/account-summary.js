import { renderAccountSummary } from '../src/tiles/account-summary.js';
import generateAccountSummary from '../src/ai/model.js';
import { getRepos } from '../src/github/repos.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';

const backgrounds = {
    'cherry-blossom': renderCherryBlossom,
    'geometric': renderGeometric,
    'vapor-wave': renderVaporWave,
};

const filterRepos = (repos, projects) => {
    if (!projects) return repos;
    if (/^\d+$/.test(projects)) {
        const n = parseInt(projects, 10);
        return [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, n);
    }
    const names = projects.split(",").map(s => s.trim());
    return repos.filter(repo => names.includes(repo.name));
};

export default async (req, res) => {
    const { username, background, projects, effects } = req.query;

    res.setHeader("Content-Type", "image/svg+xml");

    let repos = await getRepos(username);
    repos = filterRepos(repos, projects);

    let repoData = repos.map(repo => Object.fromEntries([["name", repo.name], ["description", repo.description], ["topics", repo.topics]]));
    let summary = await generateAccountSummary(repoData);

    try {
        return res.send(
            renderAccountSummary(summary, backgrounds[background])
        )
    } catch (err) {
        return res.send(err.message)
    }
}