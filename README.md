# github-pretty-readme

[![Code Quality](https://img.shields.io/badge/code_quality-A%2B_%C2%B7_93%2F100-brightgreen?style=flat-square)](SCORE.md)

`github-pretty-readme` is a Node.js/Express API that generates dynamic, styled SVG graphics and Markdown content for GitHub profile READMEs. It integrates with the GitHub API to fetch user and repository data, uses AI for personalized summaries and recommendations, and can optionally pull typing statistics from Monkeytype. The generated content, including developer ratings, tech stack visualizations, and AI-driven insights, can be embedded directly into markdown files or used to update your GitHub profile repository.

## Environment Variables

The application relies on several environment variables for configuration and API keys.

| Name                        | Purpose                                                                                                 | Required                       |
| :-------------------------- | :------------------------------------------------------------------------------------------------------ | :----------------------------- |
| `SESSION_SECRET`            | Secret key used by `express-session` for signing the session ID cookie.                                 | Yes (has dev default)          |
| `NODE_ENV`                  | Determines if session cookies should be secure (HTTPS only). Set to `production` for secure cookies.    | No (defaults to `development`) |
| `PORT` or `port`            | The port on which the Express server will listen.                                                       | No (defaults to `8088`)        |
| `GOOGLE_AI_STUDIO_KEY`      | API key for Google's Generative AI Studio (Gemini model) for AI-powered features.                       | Yes (for AI features)          |
| `GITHUB_TOKEN`              | GitHub Personal Access Token used for accessing GitHub API data without user authentication (fallback). | No (recommended for public API access) |
| `GITHUB_APP_CLIENT_ID`      | Client ID for your GitHub OAuth App, used for user authentication.                                      | Yes (for GitHub OAuth)         |
| `GITHUB_APP_CLIENT_SECRET`  | Client Secret for your GitHub OAuth App, used for user authentication.                                  | Yes (for GitHub OAuth)         |
| `BASE_URL`                  | The base URL for OAuth callbacks. Should match your deployed application URL.                           | No (defaults to `http://localhost:8080`) |
| `MONKEYTYPE_API_KEY`        | Monkeytype API key for fetching typing statistics (fallback).                                           | No (can be set per-session)    |
| `MONKEYTYPE_USERNAME`       | Monkeytype username (for linking, fallback).                                                            | No (can be set per-session)    |

## Running Locally

To run the server locally:

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set environment variables:** Create a `.env` file in the project root with the necessary variables.
3.  **Start the server:**
    ```bash
    npm start
    ```
    The server will start on the port specified in `PORT` or `8088` by default.

To generate a set of example SVG tiles to the `preview/` directory, configure `preview.config.js` and run:

```bash
npm run preview
```

## Endpoints

This section describes the API endpoints, their purpose, accepted query parameters, and examples. Most SVG/data endpoints can be used without user authentication if `GITHUB_TOKEN` is set in your environment, otherwise, they require an authenticated user session. Endpoints that modify GitHub data *always* require an authenticated user session.

The full route list lives in [`api/_routes.js`](api/_routes.js) (the source of truth). Auth-gated endpoints accept **either** a signed-in session cookie **or** an `Authorization: Bearer <token>` header carrying a [minted API token](#api-token-endpoints). The public SVG/data endpoints are **rate-limited** for anonymous traffic (default 60 requests / 60 s per IP+token; configurable via `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `RATE_LIMIT_DISABLED`); authenticated sessions are exempt. Over-limit requests get a **429** with `Retry-After` and `X-RateLimit-*` headers. The single-page UI is served at the site root `/` (there is no `/dashboard` route). See [`docs/api.md`](docs/api.md) for the complete reference.

### Authentication Endpoints

These endpoints manage user authentication via GitHub OAuth.

#### GET /auth/github

Initiates the GitHub OAuth flow. Redirects the user to GitHub for authorization.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/auth/github
```

#### GET /auth/callback

The callback URI for GitHub OAuth. Exchanges the authorization code for an access token and stores user information in the session.

**Query Parameters:**

| Name    | Default | Description                                 |
| :------ | :------ | :------------------------------------------ |
| `code`  |         | The authorization code provided by GitHub.  |
| `state` |         | The OAuth state parameter for CSRF protection. |

**Example URL:**
```
http://localhost:8088/auth/callback?code=YOUR_CODE&state=YOUR_STATE
```

#### GET /auth/logout

Destroys the user's session, effectively logging them out.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/auth/logout
```

#### GET /auth/me

Returns JSON data about the currently authenticated GitHub user. Requires an active session.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/auth/me
```

### API Token Endpoints

Long-lived tokens for headless automation (cron, CI). All require an authenticated **session** (you mint a token while signed in), then the token is sent as `Authorization: Bearer <token>` to any auth-gated endpoint. Tokens are stored only as SHA-256 hashes, are in-memory (do not survive a restart), and never expire -- revoke to rotate.

#### POST /tokens

Mints a new API token. Optional JSON body `{ "label": "ci" }`. Returns **201** `{ token, id, login, label, createdAt, lastUsedAt }` -- the `token` is shown **exactly once**.

#### GET /tokens

Lists the signed-in user's tokens as metadata (never the secret): `{ tokens: [...] }`.

#### DELETE /tokens/:id

Revokes one of the signed-in user's tokens. **204** on success, `404` for an unknown id.

### Config Endpoints

Manage the `.pretty-readme.json` allowlist in your profile repo. Both require an authenticated session.

#### GET /config

Returns `{ config, exists }` -- the parsed `.pretty-readme.json`, or `null` when absent.

#### PUT /config

Writes the allowlist. JSON body `{ "repos": ["repo-a", "repo-b"] }`. Returns `{ ok: true }`; `400` when `repos` is not an array.

### Profile Update Endpoint

#### GET /apply-readme

Generates and pushes various SVG graphics and markdown content to the user's GitHub profile README repository (`{username}/{username}`). This includes a developer bio, rating, tech stack charts, language badges, and a detailed insights markdown file. Requires an active session with `repo` scope.

**Query Parameters:**

| Name      | Default | Description                                                                                 |
| :-------- | :------ | :------------------------------------------------------------------------------------------ |
| `dry_run` | `false` | If `true`, the process runs without applying any changes to GitHub and returns the generated content. |

**Example URL (Dry Run):**
```
http://localhost:8088/apply-readme?dry_run=true
```

#### GET /preview-readme

Generates (or returns cached) the full profile preview -- bio, all SVGs, opt-in account tiles, and the insights markdown -- as JSON. Requires an active session. Pass `refresh=true` to bypass the cache.

**Example URL:**
```
http://localhost:8088/preview-readme?refresh=true
```

#### GET /apply-all

Applies enabled features across selected repos: pushes `SCORE.md` / `README.md` via a per-repo pull request on a `pretty-readme/YYYY-MM-DD` branch, and applies topics/descriptions immediately. Skips repos whose HEAD SHA is unchanged since the last run (tracked in `.pretty-readme-state.json`). Supports Server-Sent Events when the request `Accept`s `text/event-stream`. Requires an active session (or a Bearer API token for cron).

**Query Parameters:**

| Name           | Default | Description |
| :------------- | :------ | :---------- |
| `repos`        |         | Comma-separated repo names, or `*` for all eligible repos. When absent, the `.pretty-readme.json` allowlist is required (cron mode). |
| `score`        | `false` | Generate and push `SCORE.md` per repo (via PR). |
| `readme`       | `false` | Generate and push `README.md` per repo (via PR). |
| `topics`       | `false` | Suggest and apply GitHub topics (immediately). |
| `descriptions` | `false` | Suggest and apply descriptions (immediately). |
| `workflow`     | `false` | Push a daily `pretty-readme-score.yml` workflow per repo (via PR). |

#### GET /repos

Returns a lightweight JSON list of the authenticated user's repos (`name`, `description`, `language`, `isProfile`, `stars`, `pushedAt`), profile repo first. Requires an active session.

#### GET /repo-scan

Scans a repo (file tree, key files, source samples), grades code quality across six dimensions, and returns the analysis (suggested topics, README outline, prioritised suggestions). Cached per user/repo for 4 hours. Requires an active session.

**Query Parameters:**

| Name      | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** Repo name. |
| `refresh` | `false` | `true` forces a fresh scan, bypassing the cache. |

#### GET /repository-readme

Generates a README **preview** for a single repo -- the rendered markdown plus the underlying analysis -- so the UI can preview before applying. Reuses the shared scan cache. Requires an active session.

**Query Parameters:**

| Name      | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** `repo` or `owner/repo`. |
| `refresh` | `false` | `true` forces a fresh scan. |

#### GET /repo-apply

Pushes `SCORE.md` directly to a single target repo, optionally a generated `README.md`, and optionally a daily score workflow. Uses cached scan data when available. Requires an active session (or a Bearer token for cron).

**Query Parameters:**

| Name       | Default | Description |
| :--------- | :------ | :---------- |
| `repo`     |         | **Required.** `repo` or `owner/repo`. |
| `readme`   | `false` | Also generate and push `README.md` from the scan outline. |
| `workflow` | `false` | Push `.github/workflows/pretty-readme-score.yml` (daily, 05:00 UTC) if absent. |

### Monkeytype Connection Endpoints

These endpoints manage the connection to the Monkeytype API.

#### POST /monkeytype/connect

Connects a Monkeytype API key to the user's session. This key is then used for `GET /monkeytype` and `/apply-readme`.

**Request Body Parameters:**

| Name       | Default | Description                            |
| :--------- | :------ | :------------------------------------- |
| `api_key`  |         | Your Monkeytype API key.               |
| `username` | `null`  | Your Monkeytype username (optional, for linking). |

**Example (using `curl`):**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"api_key": "YOUR_API_KEY", "username": "YourMTUsername"}' http://localhost:8088/monkeytype/connect
```

#### POST /monkeytype/disconnect

Removes the Monkeytype API key and username from the user's session.

**Request Body Parameters:** None.

**Example (using `curl`):**
```bash
curl -X POST http://localhost:8088/monkeytype/disconnect
```

### WakaTime Connection Endpoints

These endpoints connect a WakaTime API key to your session for `GET /wakatime`. They mirror the Monkeytype connect/disconnect endpoints.

#### POST /wakatime/connect

Stores a WakaTime API key on the session.

**Request Body Parameters:**

| Name      | Default | Description |
| :-------- | :------ | :---------- |
| `api_key` |         | **Required.** Your WakaTime API key. `400` when missing. |

**Example (using `curl`):**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"api_key": "waka_..."}' http://localhost:8088/wakatime/connect
```

#### POST /wakatime/disconnect

Removes the WakaTime API key from the session. The `WAKATIME_API_KEY` env fallback (if set) remains in effect.

### SVG / Data Endpoints

These endpoints generate SVG images or JSON data based on GitHub and other API data.

#### GET /account-summary

Generates an SVG image displaying a developer account summary.

**Query Parameters:**

| Name         | Default | Description                                                                                 |
| :----------- | :------ | :------------------------------------------------------------------------------------------ |
| `username`   |         | (Required if not authenticated) The GitHub username to summarize.                           |
| `background` | `null`  | Applies a background theme: `cherry-blossom`, `geometric`, or `vapor-wave`.                 |
| `projects`   | `all`   | Filters repositories: a number (e.g., `5` for top 5 by stars) or a comma-separated list of repo names. |

**Example URLs:**
```
http://localhost:8088/account-summary?username=octocat&background=cherry-blossom
http://localhost:8088/account-summary?username=octocat&projects=top5
http://localhost:8088/account-summary?username=octocat&projects=my-repo-1,my-repo-2
```

#### GET /account-summary-md

Generates a plain text developer bio summary based on the authenticated user's repositories.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/account-summary-md
```

#### GET /developer-rating

Generates an SVG image displaying the developer rating for the authenticated user (or user associated with `GITHUB_TOKEN`).

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/developer-rating
```

#### GET /developer-rating-insights

Generates a detailed Markdown report with developer rating insights and actionable recommendations for the authenticated user (or user associated with `GITHUB_TOKEN`).

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/developer-rating-insights
```

#### GET /contribution-graph

Generates an SVG contribution heatmap with current-streak, longest-streak, and total-contribution figures, sourced from the GitHub GraphQL contribution calendar.

**Query Parameters:**

| Name         | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub username (falls back to the session user). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave` (alias: `theme`). |

**Example URL:**
```
http://localhost:8088/contribution-graph?username=octocat&background=geometric
```

#### GET /stats-card

Generates an SVG stats card -- total stars, commits, pull requests, issues, followers, and repositories contributed to -- aggregated from the GitHub GraphQL API.

**Query Parameters:**

| Name       | Default | Description |
| :--------- | :------ | :---------- |
| `username` |         | GitHub username (falls back to the session user). |

**Example URL:**
```
http://localhost:8088/stats-card?username=octocat
```

#### GET /tech-summary

Generates an SVG image displaying a summary of the top technologies used by a user, represented by icons.

**Query Parameters:**

| Name         | Default | Description                                                                                 |
| :----------- | :------ | :------------------------------------------------------------------------------------------ |
| `background` | `null`  | Applies a background theme: `cherry-blossom`, `geometric`, or `vapor-wave`.                 |
| `limit`      | `all`   | Maximum number of technology icons to display.                                              |
| `sort`       | `frequency` | Sort order for technologies: `frequency` (most used) or `alpha` (alphabetical).             |
| `exclude`    | `null`  | Comma-separated list of technology names to exclude from the summary (e.g., `HTML,CSS`). |

**Example URLs:**
```
http://localhost:8088/tech-summary?background=geometric&limit=10&sort=frequency
http://localhost:8088/tech-summary?background=vapor-wave&exclude=JavaScript,HTML
```

#### GET /tech-list

Returns a JSON list of technologies used by the authenticated user (or user associated with `GITHUB_TOKEN`), including counts and icon metadata.

**Query Parameters:**

| Name      | Default     | Description                                                         |
| :-------- | :---------- | :------------------------------------------------------------------ |
| `sort`    | `frequency` | Sort order for technologies: `frequency` (most used) or `alpha` (alphabetical). |
| `exclude` | `null`      | Comma-separated list of technology names to exclude.                |

**Example URLs:**
```
http://localhost:8088/tech-list?sort=alpha
http://localhost:8088/tech-list?exclude=CSS,Markdown
```

#### GET /tech-chart

Generates an SVG chart visualizing programming language usage.

**Query Parameters:**

| Name    | Default | Description                                       |
| :------ | :------ | :------------------------------------------------ |
| `chart` | `donut` | Type of chart: `donut` (pie chart) or `spider` (radar chart). |

**Example URLs:**
```
http://localhost:8088/tech-chart?chart=donut
http://localhost:8088/tech-chart?chart=spider
```

#### GET /tech-spider

Generates a technology visualization SVG. This versatile endpoint can render spider charts, treemaps, or a grid of technology cards.

**Query Parameters:**

| Name         | Default                          | Description                                                                                     |
| :----------- | :------------------------------- | :---------------------------------------------------------------------------------------------- |
| `type`       | `spider`                         | Visualization type: `spider`, `treemap`, `cards`, or `grid`.                                    |
| `categories` | `languages,frameworks,cloud`     | Comma-separated list of tech category keys (e.g., `languages,frameworks,ai`).                   |
| `limit`      | `6`                              | Maximum number of technologies to display per category.                                         |
| `exclude`    | `null`                           | Comma-separated list of technology names to exclude.                                            |
| `columns`    | `2`                              | (Only for `type=grid`) Number of columns in the grid layout (max 4).                            |
| `title`      | `TECH RADAR` (for `spider` type) | Custom title for the visualization (not all types use this parameter).                          |

**Example URLs:**
```
http://localhost:8088/tech-spider?type=spider&categories=languages,databases,devops&limit=5
http://localhost:8088/tech-spider?type=treemap&categories=languages,frameworks,cloud&limit=8
http://localhost:8088/tech-spider?type=cards&categories=languages,frameworks,ai,databases&limit=12
http://localhost:8088/tech-spider?type=grid&categories=languages,frameworks,cloud,ai&columns=2
```

#### GET /tech-categories

Returns a JSON list of technology categories that have at least one detected technology for the authenticated user (or user associated with `GITHUB_TOKEN`).

**Query Parameters:**

| Name    | Default | Description                                          |
| :------ | :------ | :--------------------------------------------------- |
| `limit` | `8`     | Maximum number of technologies per category to consider. |

**Example URL:**
```
http://localhost:8088/tech-categories?limit=5
```

#### GET /improve-topics

Uses AI to suggest and apply GitHub topics to repositories that have fewer than `MIN_TOPICS` (currently 3) topics, are not archived, and are not forks. Requires an active session with `repo` scope.

**Query Parameters:**

| Name      | Default | Description                                                                                 |
| :-------- | :------ | :------------------------------------------------------------------------------------------ |
| `dry_run` | `false` | If `true`, the process runs without applying any changes to GitHub and returns the suggested topics. |

**Example URL (Dry Run):**
```
http://localhost:8088/improve-topics?dry_run=true
```

#### GET /improve-descriptions

Uses AI to suggest and apply descriptions to owned GitHub repositories that currently lack them, are not archived, and are not forks. Requires an active session with `repo` scope.

**Query Parameters:**

| Name      | Default | Description                                                                                 |
| :-------- | :------ | :------------------------------------------------------------------------------------------ |
| `dry_run` | `false` | If `true`, the process runs without applying any changes to GitHub and returns the suggested descriptions. |

**Example URL (Dry Run):**
```
http://localhost:8088/improve-descriptions?dry_run=true
```

#### GET /active-languages

Generates an SVG tile of the languages a user has worked in **recently**, weighted by commit activity inside the window (not lifetime repo bytes). Cached for 1 hour per `(username, days)`. Always responds with an SVG — a missing user or any error renders a graceful empty tile rather than a 4xx/5xx body.

**Query Parameters:**

| Name         | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | The GitHub login whose recent activity is charted (required; absent renders an empty tile). |
| `days`       | `90`    | Recent window in days. Non-numeric or `<= 0` falls back to `90`; capped at `365`. |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |

**Example URL:**
```
http://localhost:8088/active-languages?username=octocat&days=180&background=geometric
```

#### GET /activity-clock

Renders a 7×24 (day-of-week × hour-of-day) heatmap SVG of a user's coding activity, derived from GitHub public-event timestamps, with the busiest day and hour labelled. Falls back to a graceful empty tile when no data is available.

**Query Parameters:**

| Name         | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub login (required; absent renders an empty tile). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |

**Example URL:**
```
http://localhost:8088/activity-clock?username=octocat&background=vapor-wave
```

#### GET /monkeytype

Generates an SVG chart visualizing Monkeytype typing speed personal bests across different time modes. Requires an active session with a connected Monkeytype API key or `MONKEYTYPE_API_KEY` set in the environment.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8088/monkeytype
```

#### GET /wakatime

Generates an SVG chart of coding time by language from the WakaTime API. Resolves the key from the session (`POST /wakatime/connect`) or the `WAKATIME_API_KEY` env var. `401` when no key is connected; `404` when the range has no data.

**Query Parameters:**

| Name    | Default       | Description |
| :------ | :------------ | :---------- |
| `range` | `last_7_days` | `last_7_days`, `last_30_days`, `last_6_months`, `last_year`, or `all_time`. |

**Example URL:**
```
http://localhost:8088/wakatime?range=last_30_days
```

#### GET /language-trend

Approximates how a user's language usage has grown over time by bucketing each repository's language bytes by the repo's creation year and rendering a cumulative **stacked-area** chart. Reads the session GitHub token when present, else `GITHUB_TOKEN`. Cached for 15 minutes per user. `401` when no GitHub token is available.

**Query Parameters:**

| Name       | Default | Description |
| :--------- | :------ | :---------- |
| `repos`    | `40`    | Cap on the number of (largest, non-fork) repos scanned for `/languages` (min 1). |
| `limit`    | `6`     | Max languages shown as stacked series (min 1). |
| `username` | `env`   | Cache key when unauthenticated (the session user takes precedence when signed in). |

**Example URL:**
```
http://localhost:8088/language-trend?repos=60&limit=8
```

#### GET /social-links

Renders a row of brand badges linking to a user's social profiles. Links come (in order) from the `?links=` query param, or — when authenticated — the `social` map in the user's `.pretty-readme.json`. Unknown platforms degrade to a generic link badge.

**Query Parameters:**

| Name       | Default | Description |
| :--------- | :------ | :---------- |
| `links`    |         | Comma-separated `platform:handle` pairs, e.g. `github:octocat,email:me@example.com`. Overrides config when present. Only the first colon splits each pair, so handles may be full URLs. |
| `username` |         | When unauthenticated and `links` is omitted, the login whose config `social` map is read (requires `GITHUB_TOKEN`). |

**Example URL:**
```
http://localhost:8088/social-links?links=github:octocat,linkedin:octocat,email:octocat@github.com
```

#### GET /repo-tech-badges

Returns a **Markdown** (plain-text) row of shields.io tech badges derived from a repo's primary language and topics. `200` with an empty body when no tech is detected; `400` for a missing/malformed `repo`; `404` when not found; `502` on an upstream error.

**Query Parameters:**

| Name   | Default | Description |
| :----- | :------ | :---------- |
| `repo` |         | **Required.** `owner/name`. |

**Example URL:**
```
http://localhost:8088/repo-tech-badges?repo=octocat/Hello-World
```

#### GET /repo-card

Renders a theme-aware SVG card for a single repo with its stars, forks, open issues, primary language, and last-updated time. `400` for a missing/malformed `repo`; `404` when not found; `502` on an upstream error.

**Query Parameters:**

| Name   | Default | Description |
| :----- | :------ | :---------- |
| `repo` |         | **Required.** `owner/name`. |

**Example URL:**
```
http://localhost:8088/repo-card?repo=octocat/Hello-World
```

#### GET /repo-activity

Renders a repository's weekly commit activity for the last year as a themed SVG bar chart. Always responds with an SVG — error and empty states render as SVG cards so the image never breaks in a README.

**Query Parameters:**

| Name   | Default | Description |
| :----- | :------ | :---------- |
| `repo` |         | **Required.** `owner/name`, or a bare `name` combined with `user=`. |
| `user` |         | Owner login, used when `repo` is a bare name. |

**Example URLs:**
```
http://localhost:8088/repo-activity?repo=octocat/Hello-World
http://localhost:8088/repo-activity?user=octocat&repo=Hello-World
```

#### GET /top-repos

Renders a grid of repo cards for a user's most notable repositories (reusing the repo-card renderer). Forks are excluded by default; an empty selection renders a graceful placeholder. `400` for a missing `username`; `502` on an upstream error.

**Query Parameters:**

| Name       | Default | Description |
| :--------- | :------ | :---------- |
| `username` |         | **Required.** GitHub login. |
| `sort`     | `stars` | `stars` or `updated` (most recently pushed). |
| `limit`    | `6`     | Number of cards (clamped to 1–12). |
| `columns`  | `2`     | Grid columns. |
| `forks`    | `false` | `true`/`1` includes forks. |

**Example URL:**
```
http://localhost:8088/top-repos?username=octocat&sort=updated&limit=8&columns=3
```

### Health

#### GET /healthz

Liveness/health probe. Unauthenticated, dependency-free, and never rate-limited (useful for Cloud Run health checks). Returns **200** `{ "status": "ok", "version": "<package version>" }`.

**Example URL:**
```
http://localhost:8088/healthz
```

## Automated Updates (Cron Job)

`github-pretty-readme` can run on a daily schedule to keep your profile and repositories up to date. The workflow below calls the hosted service, reads your `.pretty-readme.json` allowlist, and for each repo:

- Fetches the current HEAD commit SHA and compares it against `.pretty-readme-state.json` (stored in your profile repo).
- **Skips the repo entirely** if no commits have landed since the last run.
- **Runs and updates the open PR** if new commits are detected, or creates a new PR if this is the first run.

This means the daily cron is cheap — only repos that actually changed trigger AI calls and GitHub writes.

### 1 — Create your allowlist

Add `.pretty-readme.json` to your profile repository (`{username}/{username}`):

```json
{
  "repos": [
    "my-project",
    "another-repo",
    "cool-cli"
  ]
}
```

Only repos in this list will be touched. You can also manage this file through the app UI at `GET /config` / `PUT /config`.

#### Opt-in profile tiles

The same `.pretty-readme.json` can enable extra account tiles in your profile
README. All tiles are **off by default** — add a `tiles` block and set the ones
you want to `true`:

```json
{
  "repos": ["my-project"],
  "tiles": {
    "contributionGraph": true,
    "statsCard": true,
    "languageTrend": true,
    "socialLinks": true
  },
  "social": {
    "github": "octocat",
    "linkedin": "octocat",
    "email": "octocat@github.com"
  }
}
```

| Tile id             | Renders |
| :------------------ | :------ |
| `contributionGraph` | Contribution heatmap + current/longest streak (`/contribution-graph`). |
| `statsCard`         | Stars / commits / PRs / issues / followers / contributed-to card (`/stats-card`). |
| `languageTrend`     | Cumulative language-usage-over-time stacked area chart (`/language-trend`). |
| `socialLinks`       | Brand badges linking to your social profiles, built from the `social` map below (`/social-links`). |
| `activeLanguages`   | Languages worked in recently, weighted by commit activity (`/active-languages`). |
| `topRepos`          | A grid of repo cards for your most notable repositories (`/top-repos`). |
| `activityClock`     | A 7×24 day-by-hour heatmap of your coding activity (`/activity-clock`). |
| `wakatime`          | Coding time by language from WakaTime — requires a connected WakaTime key (`/wakatime`). |

Each tile is also a live, standalone, rate-limited GET endpoint (linked above) you
can embed directly; the opt-in `tiles` block just renders the same output into your
profile README at apply time.

The `socialLinks` tile reads the top-level `social` map — `platform: handle`
pairs (e.g. `github`, `twitter`/`x`, `linkedin`, `devto`, `mastodon`, `email`,
`website`). Unknown platforms degrade to a generic link badge.

Each enabled tile is pushed to `assets/` and injected into your README between
its markers (e.g. `<!-- contribution-start -->` / `<!-- contribution-end -->`)
during `GET /apply-readme`. The `GET /preview-readme` response includes the
rendered tiles under `accountTiles`, and `GET /apply-readme?dry_run=true` lists
the enabled tile ids under `tiles`.

### 2 — Add the workflow

Create `.github/workflows/pretty-readme.yml` in your profile repository:

```yaml
name: pretty-readme daily update

on:
  schedule:
    - cron: "0 5 * * *"   # 05:00 UTC every day
  workflow_dispatch:       # allow manual runs from the Actions tab

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger full update
        run: |
          curl -fsSL \
            -H "Authorization: Bearer ${{ secrets.PRETTY_README_TOKEN }}" \
            "${{ secrets.PRETTY_README_URL }}/apply-all?score=true&readme=true&topics=true&descriptions=true"
```

### 3 — Set repository secrets

| Secret | Value |
|:--|:--|
| `PRETTY_README_URL` | Your deployed service URL, e.g. `https://github-pretty-readme-xxx-uc.a.run.app` |
| `PRETTY_README_TOKEN` | A long-lived API token. Sign in to your instance, then `POST /tokens` to mint one (returned once) — see [self-hosting](docs/self-hosting.md#6--daily-profile-update-automation). Revoke any time with `DELETE /tokens/:id`. |

> **Tip:** API tokens do not expire — mint one and store it as the
> `PRETTY_README_TOKEN` secret. They are revocable, so rotate by minting a new
> token and deleting the old.
>
> **Deprecated:** the previous `PRETTY_README_SESSION` cookie path is no longer
> recommended. A copied session cookie still works until it expires (7 days),
> but the convenient `Authorization: Bearer <any-value>` shortcut that some
> setups relied on has been removed — the service now verifies the Bearer token
> against its token store. Switch to a minted `PRETTY_README_TOKEN`.

### What each run does

| Step | How it lands |
|:--|:--|
| Account summary, developer rating, tech charts | Pushed directly to your profile README |
| SCORE.md + README.md per repo | Opened as a pull request on a `pretty-readme/YYYY-MM-DD` branch |
| Topics + descriptions | Applied immediately via GitHub API (reversible from the repo settings page) |
| Run state | Written to `.pretty-readme-state.json` in your profile repo after each run |

Repos with no new commits since the last run are skipped automatically — no AI calls, no GitHub writes.

## Deployment

The service is deployed to **Google Cloud Run**. Pushes to `main` trigger the production deploy via GitHub Actions.