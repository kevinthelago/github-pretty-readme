import { renderActiveLanguages } from '../src/tiles/active-languages.js';
import { getRecentLanguageWeights } from '../src/github/recent-languages.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';

const backgrounds = {
    'cherry-blossom': renderCherryBlossom,
    'geometric': renderGeometric,
    'vapor-wave': renderVaporWave,
};

// Simple in-memory TTL cache, mirroring src/scan-cache.js. Keyed by the inputs
// that change the output (username + window size) so repeated README renders are
// cheap and don't hammer the GitHub commits API.
const cache = new Map();
const TTL = 60 * 60 * 1000; // 1 hour
const cacheKey = (username, days) => `${username}::${days}`;

export const _activeLanguagesCache = {
    get(username, days) {
        const e = cache.get(cacheKey(username, days));
        if (!e) return null;
        if (Date.now() - e.ts > TTL) {
            cache.delete(cacheKey(username, days));
            return null;
        }
        return e.value;
    },
    set(username, days, value) {
        cache.set(cacheKey(username, days), { value, ts: Date.now() });
    },
    clear() {
        cache.clear();
    },
};

const parseDays = (raw) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return 90;
    return Math.min(n, 365); // cap the window to keep the commits scan bounded
};

/**
 * GET /active-languages
 *
 * Query params:
 *   username    GitHub login whose recent activity is charted (required)
 *   days=90     recent window in days (default 90, capped at 365)
 *   background  optional theme: cherry-blossom | geometric | vapor-wave
 *
 * Weights each language by RECENT COMMIT ACTIVITY inside the window, NOT by
 * lifetime repo bytes or repo creation date. Result is cached for 1h per
 * (username, days). Always responds with image/svg+xml — even errors render a
 * graceful empty tile so the README embed never shows a broken image.
 */
export default async (req, res) => {
    const { username, background } = req.query;
    const days = parseDays(req.query.days);

    res.setHeader('Content-Type', 'image/svg+xml');

    if (!username) {
        return res.send(renderActiveLanguages({ langs: [], totalCommits: 0, days }, backgrounds[background]));
    }

    try {
        let data = _activeLanguagesCache.get(username, days);
        if (!data) {
            const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
            data = await getRecentLanguageWeights(username, { days, token });
            if (!data) data = { langs: [], totalCommits: 0, days };
            _activeLanguagesCache.set(username, days, data);
        }
        return res.send(renderActiveLanguages(data, backgrounds[background]));
    } catch (err) {
        console.error(err.message);
        return res.send(renderActiveLanguages({ langs: [], totalCommits: 0, days }, backgrounds[background]));
    }
};
