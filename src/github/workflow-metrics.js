const ghHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
});

const safeFetch = async (url, headers) => {
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
};

/**
 * Fetches CI, deployment, issue, and PR signals for the most recently active
 * non-fork non-archived repos (capped at 15 to stay well within rate limits).
 *
 * Requires token scopes: commit-statuses, deployments, issues, pull-requests.
 *
 * @param {string} token
 * @param {Array}  repos — full repo list from getAllRepos()
 * @returns {Promise<Array<{name,url,hasCi,hasDeployments,hasClosedIssues,hasPrs}>>}
 */
export const fetchWorkflowMetrics = async (token, repos) => {
    if (!token) return [];

    const headers    = ghHeaders(token);
    const candidates = repos
        .filter(r => !r.archived && !r.fork)
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
        .slice(0, 15);

    if (candidates.length === 0) return [];

    const results = await Promise.allSettled(candidates.map(async (repo) => {
        const branch = repo.default_branch ?? 'main';
        const base   = `https://api.github.com/repos/${repo.full_name}`;

        const [checkRuns, deployments, closedIssues, pullRequests] = await Promise.all([
            safeFetch(`${base}/commits/${branch}/check-runs?per_page=1`, headers),
            safeFetch(`${base}/deployments?per_page=1`, headers),
            safeFetch(`${base}/issues?state=closed&per_page=1`, headers),
            safeFetch(`${base}/pulls?state=all&per_page=1`, headers),
        ]);

        return {
            name:            repo.name,
            url:             repo.html_url,
            hasCi:           (checkRuns?.total_count ?? 0) > 0,
            hasDeployments:  Array.isArray(deployments)   && deployments.length   > 0,
            hasClosedIssues: Array.isArray(closedIssues)  && closedIssues.length  > 0,
            hasPrs:          Array.isArray(pullRequests)  && pullRequests.length  > 0,
        };
    }));

    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
};
