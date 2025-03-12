import { renderAccountSummary } from '../src/tiles/account-summary.js';
import generateTopicsSummary from '../src/ai/model.js';
import { getRepos } from '../src/github/repos.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';

export default async (req, res) => {
    const {
        username,
        background
    } = req.query;

    // res.setHeader("Content-Type", "image/svg+xml");
    // res.setHeader(
    //     "Cache-Control",
    //     `max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    // );
    let repos = await getRepos(username);
    let topics = repos.map(repo => repo.topics).filter(arr => arr.length > 0);
    let text = await generateTopicsSummary(topics);
    let backgrounds = {
        'cherry-blossom': renderCherryBlossom,
        'geometric': renderGeometric
    }

    try {
        return res.send(
            renderAccountSummary(text, backgrounds[background] || undefined)
        )
    } catch (err) {
        return res.send(
            err.message
        )
    }
}