import { renderAccountSummary } from '../src/tiles/account-summary.js';
import generateTopicsSummary from '../src/ai/model.js';

export default async (req, res) => {
    const {
        username
    } = req.query;

    res.setHeader("Content-Type", "image/svg+xml");
    // res.setHeader(
    //     "Cache-Control",
    //     `max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    // );
    let topics = await getTopics(username);
    let text = await generateTopicsSummary(topics);

    try {
        return res.send(
            renderAccountSummary(text)
        )
    } catch (err) {
        return res.send(
            err.message
        )
        // return res.send(
        //     renderError(
        //         err.message,
        //         err.secondaryMessage
        //     )
        // )
    }
}