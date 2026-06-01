/**
 * GitHub GraphQL v4 client.
 *
 * Centralizes authenticated access to the GitHub GraphQL API for account-level
 * components (contribution calendar, aggregate user stats) that the REST v3
 * client in `repos.js` cannot express in a single round-trip.
 *
 * Auth precedence mirrors the REST client: an explicit session token wins,
 * otherwise we fall back to the server's `GITHUB_TOKEN` PAT.
 */

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/**
 * POST a GraphQL query to GitHub's v4 endpoint with bearer auth.
 *
 * @param {string|null|undefined} token - Session OAuth token; falls back to
 *   `process.env.GITHUB_TOKEN` when absent.
 * @param {string} query - The GraphQL query or mutation document.
 * @param {object} [vars={}] - Query variables.
 * @returns {Promise<object>} The `data` object from the GraphQL response.
 * @throws {Error} When no token is available, the HTTP request fails, or the
 *   response carries GraphQL `errors`.
 */
export async function gql(token, query, vars = {}) {
    const authToken = token ?? process.env.GITHUB_TOKEN;
    if (!authToken) {
        throw new Error('No GitHub token available for GraphQL request');
    }

    const res = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'github-pretty-readme',
        },
        body: JSON.stringify({ query, variables: vars }),
    });

    if (!res.ok) {
        throw new Error(`GitHub GraphQL request failed: ${res.status} ${res.statusText ?? ''}`.trim());
    }

    const json = await res.json();
    if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join('; '));
    }

    return json.data;
}

const CONTRIBUTION_CALENDAR_QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            weekday
            contributionCount
            color
          }
        }
      }
    }
  }
}`;

/**
 * Fetch a user's contribution calendar (the GitHub "heatmap" data).
 *
 * @param {string|null|undefined} token - Session token; falls back to GITHUB_TOKEN.
 * @param {string} login - GitHub username.
 * @returns {Promise<{totalContributions:number, weeks:Array}>} The raw
 *   contribution calendar: total plus an array of weeks, each with seven
 *   `contributionDays` ({ date, weekday, contributionCount, color }).
 * @throws {Error} When the user is not found or the request fails.
 */
export async function getContributionCalendar(token, login) {
    const data = await gql(token, CONTRIBUTION_CALENDAR_QUERY, { login });
    const calendar = data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
        throw new Error(`No contribution calendar found for user "${login}"`);
    }
    return calendar;
}

const USER_STATS_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    repositories(ownerAffiliations: OWNER, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
      totalCount
      nodes { stargazerCount }
    }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
      totalCount
    }
  }
}`;

/**
 * Fetch and aggregate headline stats for a user's profile stats card.
 *
 * Stars are summed across the user's 100 most-starred owned repos — an
 * approximation (the GraphQL API has no aggregate star count), consistent with
 * the approach used by github-readme-stats.
 *
 * @param {string|null|undefined} token - Session token; falls back to GITHUB_TOKEN.
 * @param {string} login - GitHub username.
 * @returns {Promise<{login:string, name:string|null, stars:number, commits:number,
 *   prs:number, issues:number, followers:number, repos:number, contributedTo:number}>}
 * @throws {Error} When the user is not found or the request fails.
 */
export async function getUserStats(token, login) {
    const data = await gql(token, USER_STATS_QUERY, { login });
    const user = data?.user;
    if (!user) {
        throw new Error(`No GitHub user found for "${login}"`);
    }

    const stars = (user.repositories?.nodes ?? []).reduce(
        (sum, repo) => sum + (repo.stargazerCount ?? 0),
        0,
    );

    return {
        login: user.login,
        name: user.name ?? null,
        stars,
        commits: user.contributionsCollection?.totalCommitContributions ?? 0,
        prs: user.pullRequests?.totalCount ?? 0,
        issues: user.issues?.totalCount ?? 0,
        followers: user.followers?.totalCount ?? 0,
        repos: user.repositories?.totalCount ?? 0,
        contributedTo: user.repositoriesContributedTo?.totalCount ?? 0,
    };
}

export default gql;
