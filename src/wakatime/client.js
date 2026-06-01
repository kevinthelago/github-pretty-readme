const WAKATIME_API = 'https://wakatime.com/api/v1';

/**
 * Creates a WakaTime API client.
 *
 * Mirrors the injectable GitHub/AI client layer (#49/#50): the single surface
 * every WakaTime call flows through, with an injectable `fetchImpl` transport so
 * handlers and helpers can be unit-tested against a fake client with no live
 * network access.
 *
 * WakaTime authenticates with HTTP Basic auth carrying the base64-encoded API
 * key. The key is resolved from `opts.apiKey` (typically the per-session key set
 * by `POST /wakatime/connect`), falling back to the `WAKATIME_API_KEY` env var.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.apiKey]    WakaTime API key; defaults to WAKATIME_API_KEY
 * @param {Function} [opts.fetchImpl] fetch implementation (inject a fake in tests)
 * @param {string}   [opts.baseUrl]   API base URL (default: https://wakatime.com/api/v1)
 * @returns {{ apiKey: string|undefined, headers: Function, request: Function, getJson: Function, getTimeByLanguage: Function }}
 */
export const createWakatimeClient = ({
    apiKey = process.env.WAKATIME_API_KEY,
    fetchImpl = fetch,
    baseUrl = WAKATIME_API,
} = {}) => {
    const headers = (extra = {}) => ({
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}` } : {}),
        ...extra,
    });

    const buildUrl = (path, params) => {
        const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path}`);
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
            }
        }
        return url;
    };

    /**
     * Low-level request returning the raw Response.
     * @param {string} path           path (joined to baseUrl) or absolute URL
     * @param {object} [opts]
     * @param {object} [opts.params]  query params appended to the URL
     */
    const request = (path, { params, headers: extraHeaders, ...init } = {}) =>
        fetchImpl(buildUrl(path, params), { ...init, headers: headers(extraHeaders) });

    /**
     * GET returning parsed JSON, or `null` when the response is not OK.
     * Network/transport errors reject — callers that want a soft failure catch.
     */
    const getJson = async (path, opts) => {
        const res = await request(path, opts);
        if (!res.ok) return null;
        return res.json();
    };

    /**
     * Fetches coding time broken down by language for a stats range.
     *
     * Wraps `GET /users/current/stats/{range}` and projects the `languages`
     * array down to the fields callers actually render.
     *
     * @param {string} [range] WakaTime stats range (e.g. `last_7_days`,
     *                         `last_30_days`, `last_6_months`, `last_year`,
     *                         `all_time`). Default: `last_7_days`.
     * @returns {Promise<Array<{name:string,total_seconds:number,percent:number}>|null>}
     *          the per-language breakdown, or `null` when unauthenticated or the
     *          request fails.
     */
    const getTimeByLanguage = async (range = 'last_7_days') => {
        if (!apiKey) return null;
        const payload = await getJson(`/users/current/stats/${range}`);
        const languages = payload?.data?.languages;
        if (!Array.isArray(languages)) return null;
        return languages.map(({ name, total_seconds, percent }) => ({
            name,
            total_seconds,
            percent,
        }));
    };

    return { apiKey, headers, request, getJson, getTimeByLanguage };
};

/** Lazily-created shared client built from the environment. */
let sharedClient;
const defaultClient = () => (sharedClient ??= createWakatimeClient());

/**
 * Fetches a user's coding time by language using the shared (env-keyed) client.
 * @param {string} [range]  stats range (default `last_7_days`)
 * @param {object} [client] injected WakaTime client (tests)
 * @returns {Promise<Array|null>} per-language breakdown, or null on any error
 */
const getTimeByLanguage = (range, client = defaultClient()) =>
    client.getTimeByLanguage(range).catch(() => null);

export { getTimeByLanguage };
export default createWakatimeClient;
