const GH_API = 'https://api.github.com';

/**
 * Creates a token-aware GitHub API client.
 *
 * This is the single, consistent surface every GitHub call in the project flows
 * through. The `fetchImpl` transport is injectable, so handlers and the github
 * helpers can be unit-tested against a fake client with no live network access.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.token]     bearer token; defaults to GITHUB_TOKEN. When
 *                                    absent the client makes unauthenticated calls.
 * @param {Function} [opts.fetchImpl] fetch implementation (inject a fake in tests)
 * @param {string}   [opts.baseUrl]   API base URL (default: https://api.github.com)
 * @returns {{ token: string|undefined, headers: Function, request: Function, getJson: Function, get: Function }}
 */
export const createGithubClient = ({
    token = process.env.GITHUB_TOKEN,
    fetchImpl = fetch,
    baseUrl = GH_API,
} = {}) => {
    const headers = (extra = {}) => ({
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

    return { token, headers, request, getJson, get: getJson };
};

/** Lazily-created shared client built from the environment. */
let sharedClient;
const defaultClient = () => (sharedClient ??= createGithubClient());

/**
 * Fetches a user's public repositories.
 * @param {string} username
 * @param {object} [client] injected GitHub client (tests)
 * @returns {Promise<Array|null>} repo objects, or null on any error
 */
const getRepos = (username, client = defaultClient()) =>
    client.getJson(`/users/${username}/repos`).catch(() => null);

/**
 * Fetches the contents of a path within a repository.
 * @param {string} username
 * @param {string} repository
 * @param {string} path
 * @param {object} [client] injected GitHub client (tests)
 * @returns {Promise<object|Array|null>} contents payload, or null on any error
 */
const getContents = (username, repository, path, client = defaultClient()) =>
    client.getJson(`/repos/${username}/${repository}/contents/${path}`).catch(() => null);

/**
 * Fetches all repositories owned by the authenticated user (paginated).
 * @param {string} [token]  bearer token; defaults to GITHUB_TOKEN
 * @param {object} [client] injected GitHub client (tests)
 * @returns {Promise<Array|null>} repo objects, or null when no token is available
 * @throws on a non-OK GitHub response
 */
const getAllRepos = async (token, client) => {
    const authToken = token ?? process.env.GITHUB_TOKEN;
    if (!authToken) return null;

    const gh = client ?? createGithubClient({ token: authToken });
    const repos = [];
    let page = 1;

    while (true) {
        const res = await gh.request('/user/repos', {
            params: { visibility: 'all', affiliation: 'owner', per_page: 100, page },
        });
        if (!res.ok) throw new Error(`GET /user/repos → ${res.status}`);
        const batch = await res.json();
        repos.push(...batch);
        if (batch.length < 100) break;
        page++;
    }

    return repos;
};

export { getRepos, getContents, getAllRepos };
export default getRepos;
