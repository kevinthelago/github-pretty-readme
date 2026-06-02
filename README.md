# github-pretty-readme

[![Code Quality](https://img.shields.io/badge/code_quality-D_%C2%B7_48%2F100-orange?style=flat-square)](SCORE.md)

`github-pretty-readme` is a Node.js/Express API that generates dynamic, styled SVG graphics and Markdown content for GitHub profile READMEs. It integrates with the GitHub API to fetch user and repository data, uses AI for personalized summaries and recommendations, and can optionally pull typing statistics from Monkeytype. The generated content, including developer ratings, tech stack visualizations, and AI-driven insights, can be embedded directly into markdown files or used to update your GitHub profile repository.

## Environment Variables

The application relies on several environment variables for configuration and API keys.

| Name                        | Purpose                                                                                                 | Required                       |
| :-------------------------- | :------------------------------------------------------------------------------------------------------ | :----------------------------- |
| `SESSION_SECRET`            | Secret key used by `express-session` for signing the session ID cookie.                                 | Yes (has dev default)          |
| `NODE_ENV`                  | Determines if session cookies should be secure (HTTPS only). Set to `production` for secure cookies.    | No (defaults to `development`) |
| `PORT` or `port`            | The port on which the Express server will listen.                                                       | No (defaults to `8080`)        |
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
    The server will start on the port specified in `PORT` or `8080` by default.

To generate a set of example SVG tiles to the `preview/` directory, configure `preview.config.js` and run:

```bash
npm run preview
```

## Endpoints

This section describes the API endpoints, their purpose, accepted query parameters, and examples. Most SVG/data endpoints can be used without user authentication if `GITHUB_TOKEN` is set in your environment, otherwise, they require an authenticated user session. Endpoints that modify GitHub data *always* require an authenticated user session.

### Authentication Endpoints

These endpoints manage user authentication via GitHub OAuth.

#### GET /auth/github

Initiates the GitHub OAuth flow. Redirects the user to GitHub for authorization.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/auth/github
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
http://localhost:8080/auth/callback?code=YOUR_CODE&state=YOUR_STATE
```

#### GET /auth/logout

Destroys the user's session, effectively logging them out.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/auth/logout
```

#### GET /auth/me

Returns JSON data about the currently authenticated GitHub user. Requires an active session.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/auth/me
```

### Dashboard Endpoint

#### GET /dashboard

Renders the dashboard HTML page for authenticated users. Requires an active session.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/dashboard
```

### Profile Update Endpoint

#### GET /apply-readme

Generates and pushes various SVG graphics and markdown content to the user's GitHub profile README repository (`{username}/{username}`). This includes a developer bio, rating, tech stack charts, language badges, and a detailed insights markdown file. Requires an active session with `repo` scope.

**Query Parameters:**

| Name      | Default | Description                                                                                 |
| :-------- | :------ | :------------------------------------------------------------------------------------------ |
| `dry_run` | `false` | If `true`, the process runs without applying any changes to GitHub and returns the generated content. |

**Example URL (Dry Run):**
```
http://localhost:8080/apply-readme?dry_run=true
```

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
curl -X POST -H "Content-Type: application/json" -d '{"api_key": "YOUR_API_KEY", "username": "YourMTUsername"}' http://localhost:8080/monkeytype/connect
```

#### POST /monkeytype/disconnect

Removes the Monkeytype API key and username from the user's session.

**Request Body Parameters:** None.

**Example (using `curl`):**
```bash
curl -X POST http://localhost:8080/monkeytype/disconnect
```

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
http://localhost:8080/account-summary?username=octocat&background=cherry-blossom
http://localhost:8080/account-summary?username=octocat&projects=top5
http://localhost:8080/account-summary?username=octocat&projects=my-repo-1,my-repo-2
```

#### GET /account-summary-md

Generates a plain text developer bio summary based on the authenticated user's repositories.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/account-summary-md
```

#### GET /developer-rating

Generates an SVG image displaying the developer rating for the authenticated user (or user associated with `GITHUB_TOKEN`).

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/developer-rating
```

#### GET /developer-rating-insights

Generates a detailed Markdown report with developer rating insights and actionable recommendations for the authenticated user (or user associated with `GITHUB_TOKEN`).

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/developer-rating-insights
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
http://localhost:8080/tech-summary?background=geometric&limit=10&sort=frequency
http://localhost:8080/tech-summary?background=vapor-wave&exclude=JavaScript,HTML
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
http://localhost:8080/tech-list?sort=alpha
http://localhost:8080/tech-list?exclude=CSS,Markdown
```

#### GET /tech-chart

Generates an SVG chart visualizing programming language usage.

**Query Parameters:**

| Name    | Default | Description                                       |
| :------ | :------ | :------------------------------------------------ |
| `chart` | `donut` | Type of chart: `donut` (pie chart) or `spider` (radar chart). |

**Example URLs:**
```
http://localhost:8080/tech-chart?chart=donut
http://localhost:8080/tech-chart?chart=spider
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
http://localhost:8080/tech-spider?type=spider&categories=languages,databases,devops&limit=5
http://localhost:8080/tech-spider?type=treemap&categories=languages,frameworks,cloud&limit=8
http://localhost:8080/tech-spider?type=cards&categories=languages,frameworks,ai,databases&limit=12
http://localhost:8080/tech-spider?type=grid&categories=languages,frameworks,cloud,ai&columns=2
```

#### GET /tech-categories

Returns a JSON list of technology categories that have at least one detected technology for the authenticated user (or user associated with `GITHUB_TOKEN`).

**Query Parameters:**

| Name    | Default | Description                                          |
| :------ | :------ | :--------------------------------------------------- |
| `limit` | `8`     | Maximum number of technologies per category to consider. |

**Example URL:**
```
http://localhost:8080/tech-categories?limit=5
```

#### GET /improve-topics

Uses AI to suggest and apply GitHub topics to repositories that have fewer than `MIN_TOPICS` (currently 3) topics, are not archived, and are not forks. Requires an active session with `repo` scope.

**Query Parameters:**

| Name      | Default | Description                                                                                 |
| :-------- | :------ | :------------------------------------------------------------------------------------------ |
| `dry_run` | `false` | If `true`, the process runs without applying any changes to GitHub and returns the suggested topics. |

**Example URL (Dry Run):**
```
http://localhost:8080/improve-topics?dry_run=true
```

#### GET /improve-descriptions

Uses AI to suggest and apply descriptions to owned GitHub repositories that currently lack them, are not archived, and are not forks. Requires an active session with `repo` scope.

**Query Parameters:**

| Name      | Default | Description                                                                                 |
| :-------- | :------ | :------------------------------------------------------------------------------------------ |
| `dry_run` | `false` | If `true`, the process runs without applying any changes to GitHub and returns the suggested descriptions. |

**Example URL (Dry Run):**
```
http://localhost:8080/improve-descriptions?dry_run=true
```

#### GET /monkeytype

Generates an SVG chart visualizing Monkeytype typing speed personal bests across different time modes. Requires an active session with a connected Monkeytype API key or `MONKEYTYPE_API_KEY` set in the environment.

**Query Parameters:** None.

**Example URL:**
```
http://localhost:8080/monkeytype
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
| `socialLinks`       | Brand badges linking to your social profiles (`/social-links`), built from the `social` map below. |

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