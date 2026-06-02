import axios from 'axios';

/**
 * GitHub data layer for the recent/active-languages chart.
 *
 * Unlike a lifetime "bytes per language" or "repos created" view, this module
 * weights each language by how much COMMIT ACTIVITY it has seen inside a recent
 * time window (default 90 days). A repo's primary language earns weight equal to
 * the number of commits the user pushed to it within the window, so languages a
 * developer is actively working in float to the top regardless of how large the
 * historical codebase is.
 *
 * GitHub access is funnelled through a small injectable client so the data layer
 * can be unit-tested without touching the network (see createGithubClient).
 */

const GITHUB_API = 'https://api.github.com';

/**
 * Build the default network-backed GitHub client.
 *
 * @param {string} [token] - optional bearer token (PAT or session token); falls
 *   back to process.env.GITHUB_TOKEN. Unauthenticated requests still work for
 *   public data but are rate-limited harder by GitHub.
 * @returns {{ getRepos: (username: string) => Promise<object[]|null>,
 *             getRecentCommitCount: (owner: string, repo: string, sinceIso: string, author?: string) => Promise<number> }}
 */
const createGithubClient = (token) => {
    const authToken = token ?? process.env.GITHUB_TOKEN;
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    return {
        async getRepos(username) {
            try {
                const { data } = await axios.get(`${GITHUB_API}/users/${username}/repos`, {
                    headers,
                    params: { per_page: 100, sort: 'pushed', type: 'owner' },
                });
                return data;
            } catch (err) {
                console.error(err.message);
                return null;
            }
        },

        async getRecentCommitCount(owner, repo, sinceIso, author) {
            try {
                const { data } = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/commits`, {
                    headers,
                    params: { since: sinceIso, per_page: 100, ...(author ? { author } : {}) },
                });
                return Array.isArray(data) ? data.length : 0;
            } catch {
                // Empty repos return 409; missing/blocked repos return 404 — treat
                // any failure as "no recent activity" rather than failing the tile.
                return 0;
            }
        },
    };
};

/**
 * Compute language weights from recent commit activity.
 *
 * @param {string} username - GitHub login whose repos are inspected.
 * @param {object} [options]
 * @param {number} [options.days=90] - size of the recent window in days.
 * @param {ReturnType<createGithubClient>} [options.client] - injectable client
 *   (defaults to a network-backed client). Tests pass a mock here.
 * @param {string} [options.token] - token used to build the default client.
 * @returns {Promise<{ langs: {language: string, count: number}[], totalCommits: number, days: number } | null>}
 *   Sorted descending by commit count, or null when the repo list cannot be
 *   fetched (e.g. GitHub not connected / bad username).
 */
const getRecentLanguageWeights = async (username, options = {}) => {
    const days = Number.isFinite(options.days) && options.days > 0 ? Math.floor(options.days) : 90;
    const client = options.client ?? createGithubClient(options.token);

    const repos = await client.getRepos(username);
    if (!repos) return null;

    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const windowStart = new Date(sinceIso).getTime();

    // Only probe repos pushed to inside the window — keeps the weighting honest
    // (no stale repos) and avoids a commits request per repo.
    const candidates = repos.filter((repo) => {
        if (!repo.language) return false;
        const pushed = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
        return pushed >= windowStart;
    });

    const langFreq = {};
    let totalCommits = 0;

    for (const repo of candidates) {
        const owner = repo.owner?.login ?? username;
        const count = await client.getRecentCommitCount(owner, repo.name, sinceIso, username);
        if (count <= 0) continue;
        langFreq[repo.language] = (langFreq[repo.language] || 0) + count;
        totalCommits += count;
    }

    const langs = Object.entries(langFreq)
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));

    return { langs, totalCommits, days };
};

export { createGithubClient, getRecentLanguageWeights };
export default getRecentLanguageWeights;
