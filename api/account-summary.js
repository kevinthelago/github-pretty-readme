import { renderAccountSummary } from '../src/tiles/account-summary.js';
import generateTopicsSummary from '../src/ai/model.js';
import { getRepos } from '../src/github/repos.js';

export default async (req, res) => {
    const {
        username
    } = req.query;

    res.setHeader("Content-Type", "image/svg+xml");
    // res.setHeader(
    //     "Cache-Control",
    //     `max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    // );
    let repos = await getRepos(username);
    let topics = repos.map(repo => repo.topics).filter(arr => arr.length > 0);
    let text = await generateTopicsSummary(topics);

    try {
        return res.send(
            renderAccountSummary(text)
        )
    } catch (err) {
        return res.send(
            err.message
        )
    }
}