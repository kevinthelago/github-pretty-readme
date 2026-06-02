import { renderActivityClock } from '../src/tiles/activity-clock.js';
import { getContributionTimes } from '../src/github/contribution-times.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';

const backgrounds = {
    'cherry-blossom': renderCherryBlossom,
    'geometric': renderGeometric,
    'vapor-wave': renderVaporWave,
};

/**
 * GET /activity-clock?username=&background=
 *
 * Renders a 7x24 (day-of-week x hour-of-day) heatmap SVG of a user's coding
 * activity, derived from GitHub public-event timestamps, with the busiest day
 * and busiest hour labelled. Falls back to a graceful empty-state tile when no
 * contribution data is available.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const activityClock = async (req, res) => {
    const { username, background } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        if (!username) {
            return res.send(renderActivityClock([], backgrounds[background], {}));
        }

        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const timestamps = await getContributionTimes(username, token);

        return res.send(renderActivityClock(timestamps, backgrounds[background], { username }));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

export default activityClock;
export { activityClock };
