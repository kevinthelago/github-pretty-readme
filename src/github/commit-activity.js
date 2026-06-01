import axios from 'axios';

const GH = 'https://api.github.com';

/**
 * Default HTTP getter — thin wrapper over axios that never throws on a
 * documented status (202 / 204 / 404 are expected control-flow, not errors).
 * Injectable via `opts.httpGet` so tests can run without a network.
 */
const defaultHttpGet = (url, headers) =>
    axios.get(url, { headers, validateStatus: (s) => s === 200 || s === 202 || s === 204 || s === 404 });

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch the last year of weekly commit activity for a repository.
 *
 * GitHub computes repository statistics asynchronously. The first request for
 * a repo whose cache is cold returns `202 Accepted` with an empty body and
 * expects the caller to retry once the data is ready. We retry with a bounded,
 * linearly-growing backoff and give up after `maxRetries` attempts rather than
 * blocking the request indefinitely.
 *
 * @param {string} owner                 repository owner login
 * @param {string} repo                  repository name
 * @param {object} [opts]
 * @param {string}   [opts.token]        GitHub token (defaults to GITHUB_TOKEN)
 * @param {number}   [opts.maxRetries]   max retries while GitHub returns 202 (default 3)
 * @param {number}   [opts.retryDelay]   base backoff in ms; grows linearly per attempt (default 700)
 * @param {function} [opts.httpGet]      injectable `(url, headers) => {status, data}` for tests
 * @param {function} [opts.sleep]        injectable delay `(ms) => Promise` for tests
 * @returns {Promise<Array<{week:number,total:number,days:number[]}>|null>}
 *   Weekly buckets (oldest → newest). `null` on a 404 / hard error. An empty
 *   array when the repo has no commit activity, or when GitHub is still
 *   computing the stats after the retry budget is exhausted (the caller renders
 *   the graceful empty state either way).
 */
export const getCommitActivity = async (owner, repo, opts = {}) => {
    const {
        token = process.env.GITHUB_TOKEN,
        maxRetries = 3,
        retryDelay = 700,
        httpGet = defaultHttpGet,
        sleep = defaultSleep,
    } = opts;

    if (!owner || !repo) return null;

    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${GH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/commit_activity`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let response;
        try {
            response = await httpGet(url, headers);
        } catch {
            // network / 5xx — treat as a hard failure
            return null;
        }

        const { status, data } = response;

        if (status === 404) return null;
        if (status === 204) return [];               // no content — empty repo
        if (status === 200) return Array.isArray(data) ? data : [];

        // 202 — stats are still being computed. Wait and retry unless exhausted.
        if (attempt < maxRetries) await sleep(retryDelay * (attempt + 1));
    }

    // Retry budget exhausted while GitHub was still computing → render empty state.
    return [];
};

export default getCommitActivity;
