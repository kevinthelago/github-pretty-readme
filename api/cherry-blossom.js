import { renderCherryBlossom } from '../src/tiles/cherry-blossom.js';

export default async (req, res) => {
    // res.setHeader("Content-Type", "image/svg+xml");
    // res.setHeader(
    //     "Cache-Control",
    //     `max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    // );

    try {
        return res.send(renderCherryBlossom())
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