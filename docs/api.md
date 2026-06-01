# API Reference

Full reference for all HTTP endpoints exposed by `github-pretty-readme`. Most SVG/data endpoints can be used without user authentication if `GITHUB_TOKEN` is set in the environment; otherwise they require an authenticated user session. Endpoints that modify GitHub data always require an authenticated session.

Base URL (local): `http://localhost:8080`

---

## Authentication

### GET /auth/github

Initiates the GitHub OAuth flow. Redirects the user to GitHub for authorization.

**Parameters:** None.

---

### GET /auth/callback

Exchanges the OAuth authorization code for an access token and stores user info in the session.

| Parameter | Description |
| :-------- | :---------- |
| `code`    | Authorization code provided by GitHub. |
| `state`   | OAuth state parameter for CSRF protection. |

---

### GET /auth/logout

Destroys the user session.

---

### GET /auth/me

Returns JSON about the currently authenticated GitHub user. Requires an active session.

---

## Dashboard

### GET /dashboard

Renders the dashboard HTML page. Requires an active session.

---

## Profile Update

### GET /apply-readme

Generates and pushes SVG graphics and markdown content to the user's GitHub profile README repository (`{username}/{username}`). Requires an active session with `repo` scope.

Opt-in account tiles enabled in `.pretty-readme.json` (`tiles.contributionGraph`, `tiles.statsCard`, …) are rendered, pushed to `assets/`, and injected between their README markers. See [README → Opt-in profile tiles](../README.md#opt-in-profile-tiles).

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `dry_run`  | `false` | If `true`, runs without writing to GitHub and returns generated content. The response's `tiles` array lists the enabled account-tile ids. |

---

### GET /apply-all

Applies all enabled features (score reports, README, topics, descriptions) across selected repositories. Supports Server-Sent Events for progress streaming when the `Accept: text/event-stream` header is present.

| Parameter       | Default | Description |
| :-------------- | :------ | :---------- |
| `repos`         |         | Comma-separated repo names, or `*` for all repos. |
| `score`         | `false` | Generate and push a SCORE.md for each repo. |
| `readme`        | `false` | Generate and push a README.md for each repo. |
| `topics`        | `false` | Suggest and apply GitHub topics for each repo. |
| `descriptions`  | `false` | Suggest and apply descriptions for each repo. |

---

## Monkeytype

### POST /monkeytype/connect

Stores a Monkeytype API key in the session.

| Body field  | Description |
| :---------- | :---------- |
| `api_key`   | Your Monkeytype API key. |
| `username`  | Your Monkeytype username (optional). |

---

### POST /monkeytype/disconnect

Removes the Monkeytype API key from the session.

---

## SVG / Data Endpoints

### GET /account-summary

Generates an SVG developer account summary.

| Parameter    | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub username (required if not authenticated). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |
| `projects`   | `all`   | Number (e.g. `5`) or comma-separated repo names. |

---

### GET /account-summary-md

Returns a plain-text developer bio summary for the authenticated user.

---

### GET /developer-rating

Generates an SVG developer rating card.

---

### GET /developer-rating-insights

Generates a Markdown report with developer rating insights and recommendations.

---

### GET /contribution-graph

Generates an SVG contribution heatmap (a 53×7 calendar) with current-streak,
longest-streak, and total-contribution figures, sourced from the GitHub GraphQL
contribution calendar.

| Parameter    | Default | Description |
| :----------- | :------ | :---------- |
| `username`   |         | GitHub username (required if not authenticated). |
| `background` | `null`  | Theme: `cherry-blossom`, `geometric`, or `vapor-wave` (alias: `theme`). |

---

### GET /stats-card

Generates an SVG stats card — total stars, commits, pull requests, issues,
followers, and repositories contributed to — aggregated from the GitHub GraphQL
API. Adapts to light/dark mode via `prefers-color-scheme`.

| Parameter  | Default | Description |
| :--------- | :------ | :---------- |
| `username` |         | GitHub username (required if not authenticated). |

---

### GET /tech-summary

Generates an SVG icon grid of top technologies.

| Parameter    | Default     | Description |
| :----------- | :---------- | :---------- |
| `background` | `null`      | Theme: `cherry-blossom`, `geometric`, or `vapor-wave`. |
| `limit`      | `all`       | Maximum number of technology icons. |
| `sort`       | `frequency` | `frequency` or `alpha`. |
| `exclude`    | `null`      | Comma-separated technology names to exclude. |

---

### GET /tech-list

Returns a JSON list of detected technologies with counts and icon metadata.

| Parameter | Default     | Description |
| :-------- | :---------- | :---------- |
| `sort`    | `frequency` | `frequency` or `alpha`. |
| `exclude` | `null`      | Comma-separated names to exclude. |

---

### GET /tech-chart

Generates an SVG language usage chart.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `chart`   | `donut` | `donut` or `spider`. |

---

### GET /tech-spider

Versatile technology visualization (spider chart, treemap, or cards).

| Parameter    | Default                      | Description |
| :----------- | :--------------------------- | :---------- |
| `type`       | `spider`                     | `spider`, `treemap`, `cards`, or `grid`. |
| `categories` | `languages,frameworks,cloud` | Comma-separated category keys. |
| `limit`      | `6`                          | Max technologies per category. |
| `exclude`    | `null`                       | Comma-separated names to exclude. |
| `columns`    | `2`                          | Grid columns (only for `type=grid`, max 4). |
| `title`      | `TECH RADAR`                 | Custom visualization title. |

---

### GET /tech-categories

Returns a JSON list of technology categories that have ≥1 detected technology.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `limit`   | `8`     | Max technologies per category to consider. |

---

### GET /monkeytype

Generates an SVG typing speed chart from Monkeytype personal bests. Requires a connected Monkeytype API key.

---

## Repository Improvement

### GET /improve-topics

Uses AI to suggest and apply GitHub topics to under-tagged repos.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `dry_run` | `false` | If `true`, returns suggestions without applying. |

---

### GET /improve-descriptions

Uses AI to suggest and apply descriptions to repos that lack them.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `dry_run` | `false` | If `true`, returns suggestions without applying. |

---

### GET /account-summary-md

Generates a Markdown code quality score report for a GitHub repository.

| Parameter | Default | Description |
| :-------- | :------ | :---------- |
| `owner`   |         | Repository owner (GitHub username or org). |
| `repo`    |         | Repository name. |
