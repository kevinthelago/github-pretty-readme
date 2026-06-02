/**
 * Fetches coding-activity timestamps for a user from the GitHub REST API.
 *
 * GitHub's GraphQL v4 contributionsCollection only exposes day-level
 * granularity, which cannot drive an hour-of-day heatmap. The public Events
 * API (`/users/{user}/events`) returns individual events (pushes, PRs, issues,
 * reviews, comments) each carrying a precise `created_at` ISO timestamp, which
 * is exactly the signal an hour x day-of-week heatmap needs. We page through it
 * (capped to stay within rate limits) and return the raw timestamps; bucketing
 * into the 7x24 matrix happens in the tile renderer so the data layer stays
 * dumb and easy to mock.
 *
 * @module github/contribution-times
 */

const PER_PAGE = 100;
const MAX_PAGES = 3; // GitHub serves at most ~300 public events per user

const ghHeaders = (token) => {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

/**
 * Fetches up to ~300 recent public event timestamps for a user.
 *
 * Each returned entry is the ISO-8601 `created_at` of one contribution event.
 * Network/HTTP errors degrade gracefully to an empty array so the caller can
 * render an empty-state tile rather than failing the request.
 *
 * @param {string} username            GitHub login to look up. Required.
 * @param {string} [token]             Optional PAT/session token to raise the
 *                                     rate limit (works unauthenticated too).
 * @param {Function} [fetchImpl=fetch] Injectable fetch, for tests.
 * @returns {Promise<string[]>}        ISO timestamp strings; empty on no data.
 */
export const getContributionTimes = async (username, token, fetchImpl = fetch) => {
    if (!username) return [];

    const headers = ghHeaders(token);
    const timestamps = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=${PER_PAGE}&page=${page}`;

        let payload;
        try {
            const res = await fetchImpl(url, { headers });
            if (!res.ok) break;
            payload = await res.json();
        } catch {
            break;
        }

        if (!Array.isArray(payload) || payload.length === 0) break;

        for (const event of payload) {
            if (event && typeof event.created_at === 'string') {
                timestamps.push(event.created_at);
            }
        }

        if (payload.length < PER_PAGE) break;
    }

    return timestamps;
};

export default getContributionTimes;
