# API Reference

Full reference for every HTTP endpoint exposed by `github-pretty-readme`. The
routes are defined declaratively in [`api/_routes.js`](../api/_routes.js) -- that
manifest is the source of truth; this document mirrors it.

Base URL (local): `http://localhost:8088`

## Authentication model

Three kinds of endpoints, distinguished by the `auth` / `rateLimit` flags in the
route manifest:

- **Auth-gated** (`auth: true`) -- gated by `requireAuth`. The caller must present
  **either** a signed-in session cookie **or** an `Authorization: Bearer <token>`
  header carrying a minted API token (see [API tokens](#api-tokens)). A bare or
  invalid Bearer value is rejected with `401`; a browser with no credentials is
  redirected to `/`. These endpoints mutate GitHub data or expose account-scoped data.
- **Public, rate-limited** (`rateLimit: true`) -- usable anonymously. They resolve a
  GitHub token from the session, an `Authorization: Bearer` PAT, or the
  `GITHUB_TOKEN` env fallback (in that order). Anonymous traffic is throttled by the
  [rate limiter](#rate-limiting); authenticated sessions are exempt.
- **Unguarded** -- `/auth/*`, the `connect`/`disconnect` session endpoints, and
  `/healthz` carry neither flag.

Image endpoints always respond with `Content-Type: image/svg+xml`, returning a
themed **error tile** (HTTP 200, so the SVG paints inside an `<img>`) instead of a
4xx/5xx body when something fails. JSON endpoints use the envelope
`{ "error": { "code", "message" } }`.

> The single-page app is served at the site root `/` (static files from
> `public/`). There is **no `/dashboard` route**.

## Rate limiting

Public endpoints flagged `rateLimit` run behind a fixed-window in-memory limiter:

- Key: client IP + Bearer token, so distinct callers/tokens get independent budgets.
- Defaults: **60 requests / 60 s** per key. Configure with `RATE_LIMIT_WINDOW_MS`,
  `RATE_LIMIT_MAX`, and `RATE_LIMIT_DISABLED=true` to turn it off.
- Authenticated sessions (a session GitHub token) are **exempt**. `/healthz` is
  always exempt.
- Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
  `X-RateLimit-Reset` headers. Over-limit returns **429** with a `Retry-After`
  header -- an error SVG when the client `Accept`s an image, otherwise
  `{ "error": "Too many requests", "retryAfter": <seconds> }`.

---

## Authentication

### GET /auth/github

Initiates the GitHub OAuth flow (requests `repo` scope) and redirects to GitHub.
Returns `500` if `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` are unset.

**Parameters:** None.

### GET /auth/callback

Exchanges the OAuth authorization code for an access token and stores the user in
the session, then redirects to `/`. On error redirects to `/?error=...`.

| Parameter | Description |
| :-------- | :---------- |
| `code`    | Authorization code provided by GitHub. |
| `state`   | OAuth state for CSRF protection (must match the value set on `/auth/github`). |

### GET /auth/logout

Clears the session and redirects to `/`.

### GET /auth/me

Returns JSON about the signed-in user:
`{ username, avatar, name, monkeytype_connected, monkeytype_username }`.
`401` when not authenticated.

---

## API tokens

Long-lived tokens for headless automation (cron, CI) so callers no longer copy a
session cookie. All three endpoints require an **authenticated session** -- you mint
a token while signed in, then send it as `Authorization: Bearer <token>` to any
auth-gated endpoint. A token maps to the GitHub access token the apply pipeline
acts with, so presenting it is equivalent to that user being signed in. Tokens are
stored as SHA-256 hashes (the plaintext is shown once), are in-memory (do not
survive a restart), and never expire -- revoke to rotate.

### POST /tokens

Mint a new token for the signed-in user.

| Body field | Default | Description |
| :--------- | :------ | :---------- |
| `label`    | `""`    | Optional human label (truncated to 100 chars). |

Returns **201** `{ token, id, login, label, createdAt, lastUsedAt }`. The `token`
is returned **exactly once**. `401` when not session-authenticated.

### GET /tokens

Lists the signed-in user's tokens as metadata (never the secret):
`{ tokens: [{ id, login, label, createdAt, lastUsedAt }] }`. `401` when not authenticated.

### DELETE /tokens/:id

Revokes one of the signed-in user's tokens. **204** on success, `404` for an unknown
id, `401` when not authenticated.

---

## Allowlist config (auth)

Reads/writes `.pretty-readme.json` in the user's profile repo (`{username}/{username}`).

### GET /config

Returns `{ config, exists }` where `config` is the parsed `.pretty-readme.json`
(or `null` when absent).

### PUT /config

Writes the allowlist. Body: `{ "repos": ["repo-a", "repo-b"] }`. `400` when `repos`
is not an array. Returns `{ ok: true }`.


---

## Profile preview & apply (auth)

### GET /preview-readme

Generates (or returns cached) the full profile preview: bio, all SVGs, opt-in
account tiles, and the insights markdown. Returns
`{ ok, cached, bio, ratingSvg, techGridSvg, monkeytypeSvg, accountTiles, insightsMd }`.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `refresh` | `false` | `true` bypasses the preview cache and regenerates. |

### GET /apply-readme

Generates and pushes the profile assets (bio, developer-rating SVG, tech grid,
language badges, opt-in account tiles, `DEVELOPER_INSIGHTS.md`) plus an
`update-profile.yml` workflow to the user's profile repo (`{username}/{username}`),
injecting each between its README markers. Supports **Server-Sent Events** when the
request `Accept`s `text/event-stream`. Opt-in account tiles enabled in
`.pretty-readme.json` (`tiles.contributionGraph`, `tiles.statsCard`,
`tiles.languageTrend`, `tiles.socialLinks`, `tiles.activeLanguages`,
`tiles.topRepos`, `tiles.activityClock`, `tiles.wakatime`) are rendered, pushed to
`assets/`, and injected between their markers. Each tile reuses the same data
builder as its standalone endpoint, so the apply output stays in lock-step.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `dry_run` | `false` | `true` runs without writing to GitHub; the response `tiles` array lists the enabled account-tile ids. |

> Besides a session cookie or minted API token, this endpoint also accepts a raw
> `Authorization: Bearer <PAT>` directly (verified via a `GET /user` call) for
> scheduled-workflow callers.

### GET /apply-all

Applies enabled features (score reports, READMEs, topics, descriptions, workflow)
across selected repos, opening a PR per repo on a `pretty-readme/YYYY-MM-DD` branch
for file changes and applying topics/descriptions immediately. Skips repos whose
HEAD SHA is unchanged since the last run (tracked in `.pretty-readme-state.json`).
Supports **Server-Sent Events** when the request `Accept`s `text/event-stream`.

| Parameter      | Default | Description |
| :------------- | :------ | :---------- |
| `repos`        |         | Comma-separated repo names, or `*` for all eligible repos. **Absent** requires the `.pretty-readme.json` allowlist (cron mode). |
| `score`        | `false` | Generate and push `SCORE.md` per repo (via PR). |
| `readme`       | `false` | Generate and push `README.md` per repo (via PR). |
| `topics`       | `false` | Suggest and apply GitHub topics (immediately). |
| `descriptions` | `false` | Suggest and apply descriptions (immediately). |
| `workflow`     | `false` | Push a daily `pretty-readme-score.yml` workflow per repo (via PR). |

---

## Repository scan & README (auth)

### GET /repos

Returns a lightweight list of the user's repos
(`{ name, description, language, isProfile, stars, pushedAt }`), profile repo first
then by most recent push.

### GET /repo-scan

Scans a repo (file tree, key files, source samples), grades code quality across six
dimensions, and returns the analysis (suggested topics, README outline, prioritised
suggestions). Cached per user/repo for 4 hours.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** Repo name. |
| `refresh` | `false` | `true` forces a fresh scan, bypassing the cache. |

### GET /repository-readme

Generates a README **preview** for a single repo: returns the rendered markdown plus
the underlying analysis (so the UI can preview before applying). Reuses the shared
scan cache. When the analysis has no README outline, `markdown` is `null`.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** `repo` or `owner/repo` (cache keyed by bare name). |
| `refresh` | `false` | `true` forces a fresh scan. |

Responses: `200 { markdown, analysis }`; `400` missing `repo`; `401` unauthenticated;
`404` repo not found; `500` otherwise.

### GET /repo-apply

Pushes `SCORE.md` to the target repo (committed directly, not via PR), optionally a
generated `README.md`, and optionally a daily score workflow. Uses cached scan data
when available. Also accepts a raw `Authorization: Bearer <token>` for scheduled
GitHub Actions callers (derives the user from `owner/repo`, else a `GET /user` call).

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `repo`     |         | **Required.** `repo` or `owner/repo`. |
| `readme`   | `false` | Also generate and push `README.md` from the scan outline. |
| `workflow` | `false` | Push `.github/workflows/pretty-readme-score.yml` (daily, 05:00 UTC) if absent. |


---

## SVG / data endpoints (public, rate-limited)

### GET /account-summary

Generates an SVG developer account summary (AI-written).

| Parameter    | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub username (required if not authenticated). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |
| `projects`   | `all`   | A number (top-N by stars, e.g. `5`) or a comma-separated list of repo names. |

**Example:**
```
http://localhost:8088/account-summary?username=octocat&background=cherry-blossom
http://localhost:8088/account-summary?username=octocat&projects=5
```

### GET /account-summary-md

Returns a plain-text (third-person) developer bio for the resolved user. No params.

### GET /developer-rating

Generates an SVG developer-rating card (Breadth, Depth, Diversity, Activity, Impact,
plus Engineering when workflow metrics are available). No params.

### GET /developer-rating-insights

Returns a Markdown report: overall score, weighted dimension table, per-dimension
breakdowns, and AI recommendations. No params.

### GET /contribution-graph

Generates an SVG contribution heatmap with current/longest streak and total
contributions, sourced from the GitHub GraphQL contribution calendar.

| Parameter    | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub username (falls back to the session user). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave` (alias: `theme`). |

### GET /stats-card

Generates an SVG stats card -- total stars, commits, PRs, issues, followers, and
repos contributed to -- from aggregated GraphQL user stats.

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `username` |         | GitHub username (falls back to the session user). |

### GET /tech-summary

Generates an SVG icon grid of top technologies (languages with a known icon).

| Parameter    | Default     | Description |
| :----------- | :---------- | :---------- |
| `background` | `null`      | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |
| `limit`      | `all`       | Maximum number of technology icons. |
| `sort`       | `frequency` | `frequency` or `alpha`. |
| `exclude`    | `null`      | Comma-separated technology names to exclude. |

### GET /tech-list

Returns a JSON list of detected technologies with counts and icon metadata
(`[{ language, count, slug, hex }]`).

| Parameter | Default     | Description |
| :-------- | :---------- | :---------- |
| `sort`    | `frequency` | `frequency` or `alpha`. |
| `exclude` | `null`      | Comma-separated names to exclude. |

### GET /tech-chart

Generates an SVG language-usage chart.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `chart`   | `donut` | `donut` or `spider`. |

### GET /tech-spider

Versatile technology visualization (spider chart, treemap, cards, or grid).

| Parameter    | Default                      | Description |
| :----------- | :--------------------------- | :---------- |
| `type`       | `spider`                     | `spider`, `treemap`, `cards`, or `grid`. |
| `categories` | `languages,frameworks,cloud` | Comma-separated category keys (`languages`, `frameworks`, `cloud`, `ai`, `databases`, `devops`). |
| `limit`      | `6`                          | Max technologies per category (1-16). |
| `exclude`    | `null`                       | Comma-separated names to exclude. |
| `columns`    | `2`                          | Grid columns (1-4; used by `type=grid`). |
| `title`      | `null`                       | Custom visualization title. |

### GET /tech-categories

Returns a JSON list of tech categories that have at least one detected technology
(`[{ category, label, color, count }]`).

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `limit`   | `8`     | Max technologies per category to consider. |

### GET /improve-topics

Uses AI to suggest and apply GitHub topics to under-tagged repos (fewer than 3
topics, non-archived, non-fork). Returns a JSON summary of updated/skipped/errored
repos.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `dry_run` | `false` | `true` returns suggestions without applying. |

### GET /improve-descriptions

Uses AI to suggest and apply descriptions to repos that lack one (non-archived,
non-fork). Returns a JSON summary.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `dry_run` | `false` | `true` returns suggestions without applying. |

### GET /active-languages

Generates an SVG bar tile of the languages a user has worked in **recently**,
weighted by commit activity inside the window (not lifetime repo bytes). Results
are cached for 1h per `(username, days)`. Always responds `image/svg+xml` — a
missing user or any error renders a graceful empty tile, never a 4xx/5xx body.

| Parameter    | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub login whose recent activity is charted (required; absent renders an empty tile). |
| `days`       | `90`    | Recent window in days. Values `<= 0` or non-numeric fall back to `90`; capped at `365`. |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |

**Example:**
```
http://localhost:8088/active-languages?username=octocat&days=180&background=geometric
```

### GET /activity-clock

Renders a 7×24 (day-of-week × hour-of-day) heatmap SVG of a user's coding
activity, derived from GitHub public-event timestamps, with the busiest day and
busiest hour labelled. Falls back to a graceful empty-state tile when no
contribution data is available; returns **500** with a plain-text body on an
unexpected error.

| Parameter    | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub login (required; absent renders an empty tile). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |

**Example:**
```
http://localhost:8088/activity-clock?username=octocat&background=vapor-wave
```

### GET /monkeytype

Generates an SVG typing-speed chart from Monkeytype personal bests (standard English
time modes). Resolves the API key from the session or `MONKEYTYPE_API_KEY`. Returns
an error tile when no key is connected or no data is available. No params.

### GET /wakatime

Generates an SVG chart of coding time by language from the WakaTime API. Resolves
the key from the session or `WAKATIME_API_KEY`. `401` when no key is connected;
`404` when the range has no data.

| Parameter | Default        | Description |
| :-------- | :------------- | :---------- |
| `range`   | `last_7_days`  | `last_7_days`, `last_30_days`, `last_6_months`, `last_year`, or `all_time`. |

### GET /language-trend

Approximates how a user's language usage has grown over time: it buckets each
repository's language bytes by the repo's creation year and renders a cumulative
**stacked-area** chart. Reads the session GitHub token when present, else
`GITHUB_TOKEN`. Cached for 15 minutes per `(user, repos, limit)`. `401` when no
GitHub token is available.

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `repos`    | `40`    | Cap on the number of (largest, non-fork) repos scanned for `/languages` (min 1). |
| `limit`    | `6`     | Max languages shown as stacked series (min 1). |
| `username` | `env`   | Cache key when unauthenticated (the session user takes precedence when signed in). |

**Example:**
```
http://localhost:8088/language-trend?repos=60&limit=8
```

### GET /social-links

Renders a row of brand badges linking to a user's social profiles. Links come
(in order) from the `?links=` query param, or — when authenticated — the `social`
map in the user's `.pretty-readme.json`. Unknown platforms degrade to a generic
link badge. Known platform keys include `github`, `twitter`/`x`, `linkedin`,
`devto`/`dev`, `mastodon`, `youtube`, `instagram`, `twitch`, `discord`,
`stackoverflow`, `medium`, `reddit`, `gitlab`, `bluesky`, `telegram`, `facebook`,
`dribbble`, `behance`, `email`/`mail`, `website`/`web`, and `blog`.

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `links`    |         | Comma-separated `platform:handle` pairs, e.g. `github:octocat,email:me@example.com`. Overrides config when present. The handle may itself contain colons (full URLs); only the first colon splits the pair. |
| `username` |         | When unauthenticated and `links` is omitted, the login whose `.pretty-readme.json` `social` map is read (requires a `GITHUB_TOKEN`). |

**Example:**
```
http://localhost:8088/social-links?links=github:octocat,linkedin:octocat,email:octocat@github.com
```

### GET /repo-tech-badges

Returns a **Markdown** (plain-text) row of shields.io tech badges derived from a
repo's primary language and topics. `200` with an empty body when no tech is
detected; `400` for a missing/malformed `repo`; `404` when the repo is not found;
`502` on an upstream fetch error.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** `owner/name`. |

**Example:**
```
http://localhost:8088/repo-tech-badges?repo=octocat/Hello-World
```

### GET /repo-card

Renders a theme-aware SVG card for a single repo with its stars, forks, open
issues, primary language, and last-updated time, sourced from the REST repo
object. `400` for a missing/malformed `repo`; `404` when not found; `502` on an
upstream fetch error.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** `owner/name`. |

**Example:**
```
http://localhost:8088/repo-card?repo=octocat/Hello-World
```

### GET /repo-activity

Renders the repository's weekly commit activity for the last year as a themed SVG
bar chart. Always responds `image/svg+xml` — error and empty states render as SVG
cards so the image never breaks in a README.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `repo`    |         | **Required.** `owner/name`, or a bare `name` combined with `user=`. A missing/unresolvable value renders a `Use ?repo=owner/name` SVG card. |
| `user`    |         | Owner login, used when `repo` is a bare name. |

**Example:**
```
http://localhost:8088/repo-activity?repo=octocat/Hello-World
http://localhost:8088/repo-activity?user=octocat&repo=Hello-World
```

### GET /top-repos

Renders a grid of repo cards for a user's most notable repositories (reusing the
repo-card renderer). Forks are excluded by default; an empty selection renders a
graceful placeholder. `400` for a missing `username`; `502` on an upstream fetch
error.

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `username` |         | **Required.** GitHub login. |
| `sort`     | `stars` | `stars` or `updated` (most recently pushed). |
| `limit`    | `6`     | Number of cards (clamped to 1–12). |
| `columns`  | `2`     | Grid columns. |
| `forks`    | `false` | `true`/`1` includes forks. |

**Example:**
```
http://localhost:8088/top-repos?username=octocat&sort=updated&limit=8&columns=3
```

---

## Monkeytype connection

### POST /monkeytype/connect

Stores a Monkeytype API key on the session.

| Body field | Description |
| :--------- | :---------- |
| `api_key`  | **Required.** Monkeytype API key. `400` when missing. |
| `username` | Optional Monkeytype username (for linking). |

### POST /monkeytype/disconnect

Clears the session Monkeytype key/username.

---

## WakaTime connection

### POST /wakatime/connect

Stores a WakaTime API key on the session.

| Body field | Description |
| :--------- | :---------- |
| `api_key`  | **Required.** WakaTime API key. `400` when missing. |

### POST /wakatime/disconnect

Clears the session WakaTime key. The `WAKATIME_API_KEY` env fallback remains in
effect for shared/server-wide access.

---

## Health

### GET /healthz

Liveness/health probe. Unauthenticated, dependency-free, and never rate-limited.
Returns **200** `{ "status": "ok", "version": "<package version>" }`.
