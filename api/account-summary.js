import { renderAccountSummary } from '../src/tiles/account-summary.js';
import generateAccountSummary from '../src/ai/model.js';
import { getRepos } from '../src/github/repos.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';

export default async (req, res) => {
    const {
        username,
        theme,
        projects,
        effects
    } = req.query;

    res.setHeader("Content-Type", "image/svg+xml");
    // res.setHeader(
    //     "Cache-Control",
    //     `max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    // );
    let repos = await getRepos(username);
    // let topics = repos.map(repo => repo.topics).filter(arr => arr.length > 0);
    // let languages = repos.map(repo => repo.language).filter(language => language.length > 0);
    // let namesAndDesriptions = repos.map(repo => {repo.name, repo.description});
    let test = repos.map(repo => Object.fromEntries([["name", repo.name], ["description", repo.description], ["topics", repo.topics]]));
    let summary = await generateAccountSummary(test);
    let themes = {
        'cherry-blossom': renderCherryBlossom,
        'geometric': renderGeometric,
        'vapor-wave': renderVaporWave
    }

    try {
        return res.send(
            renderAccountSummary(summary, themes[theme] || undefined)
        )
    } catch (err) {
        return res.send(
            err.message
        )
    }
}