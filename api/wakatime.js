import { createWakatimeClient } from '../src/wakatime/client.js';
import { renderWakatimeChart } from '../src/tiles/wakatime-chart.js';

/** WakaTime stats ranges accepted on `?range=`; anything else falls back. */
const RANGES = new Set(['last_7_days', 'last_30_days', 'last_6_months', 'last_year', 'all_time']);

/**
 * Route descriptor consumed by the auto-registration mechanism (#52). Until
 * that lands, express.js mounts this route by an append-only manual line.
 */
export const route = { method: 'get', path: '/wakatime', auth: false };

/**
 * GET /wakatime?range=
 *
 * Fetches coding time by language from the WakaTime API and renders an SVG
 * chart. Resolves the API key from (in order): session → `WAKATIME_API_KEY`
 * env fallback. Mirrors the Monkeytype endpoint.
 *
 * - 401 when no key is connected (so the caller can prompt the user to connect).
 * - 404 when the connected key has no language data for the range.
 * - 500 on an upstream/transport error.
 *
 * @param {string} [req.query.range] WakaTime range (default `last_7_days`).
 */
export default async (req, res) => {
    const apiKey = req.session?.wakatime_key ?? process.env.WAKATIME_API_KEY;
    if (!apiKey) return res.status(401).send('WakaTime not connected');

    const range = RANGES.has(req.query?.range) ? req.query.range : 'last_7_days';

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const client = createWakatimeClient({ apiKey });
        const languages = await client.getTimeByLanguage(range);

        if (!languages || languages.length === 0) {
            return res.status(404).send('No WakaTime language data for this range');
        }

        return res.send(renderWakatimeChart(languages, { range }));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
