# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A Node.js/Express service that generates dynamic, styled SVG graphics and Markdown
content for GitHub profile READMEs. It fetches user and repository data from the GitHub
API, uses Google Gemini for summaries and recommendations, and can optionally pull
typing statistics from Monkeytype. Output (developer ratings, tech-stack
visualizations, AI insights, account summaries) can be embedded directly in markdown or
pushed to a user's GitHub profile repository via the apply flow.

Architecturally similar to [github-readme-stats](https://github.com/anuraghazra/github-readme-stats).

## Commands

```bash
npm start          # Start the server (loads .env via --env-file)
npm test           # Run the vitest suite once
npm run test:coverage  # Run tests with v8 coverage
npm run lint       # ESLint over the repo
npm run lint:fix   # ESLint with --fix
npm run format     # Prettier --write
npm run format:check   # Prettier --check
npm run preview    # Render example SVG tiles to preview/ (see preview.config.js)
npm run docs       # Regenerate README sections (scripts/update-readme.mjs)
```

The server listens on `process.env.PORT || process.env.port || 8088`.

## Environment Variables

| Variable                   | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `GOOGLE_AI_STUDIO_KEY`     | Google Gemini API key (required for AI features)                   |
| `AI_PROMPT`                | Prompt template with `{topics}` placeholder substituted at runtime |
| `GITHUB_TOKEN`             | PAT used as a fallback for unauthenticated GitHub API access       |
| `GITHUB_APP_CLIENT_ID`     | GitHub OAuth app client ID (user authentication)                   |
| `GITHUB_APP_CLIENT_SECRET` | GitHub OAuth app client secret (user authentication)               |
| `SESSION_SECRET`           | Signing key for the `cookie-session` cookie (has a dev default)    |
| `BASE_URL`                 | Base URL for OAuth callbacks (defaults to `http://localhost:8080`) |
| `NODE_ENV`                 | `production` makes session cookies secure (HTTPS-only)             |
| `PORT` / `port`            | Server port (default `8088`)                                       |
| `MONKEYTYPE_API_KEY`       | Monkeytype API key fallback (can also be set per-session)          |
| `MONKEYTYPE_USERNAME`      | Monkeytype username fallback (can also be set per-session)         |

Create a `.env` file at the root (gitignored) with these values for local dev. The
`start`/`docs` scripts load it via Node's `--env-file=.env`.

## Architecture

`express.js` is the entry point: it configures `cookie-session`, serves `public/`, and
registers every route. Handlers live in `api/`; rendering, GitHub, AI, and caching
logic live under `src/`.

```
express.js                    ← server entry; session + route registration
api/                          ← one handler module per endpoint
  ├── account-summary.js      ← AI account summary → themed SVG tile
  ├── account-summary-md.js   ← AI account summary → markdown
  ├── developer-rating.js     ← developer rating tile
  ├── developer-rating-insights.js
  ├── tech-summary.js / tech-list.js / tech-chart.js / tech-spider.js / tech-categories.js
  ├── improve-topics.js / improve-descriptions.js   ← AI suggestions for repo metadata
  ├── repo-scan.js / repos.js / repo-apply.js / apply-all.js   ← profile apply flow (auth)
  ├── preview-readme.js / apply-readme.js           ← profile preview + apply (auth)
  ├── monkeytype.js / monkeytype-connect.js         ← Monkeytype integration
  ├── auth.js                 ← GitHub OAuth (github, callback, logout, me, requireAuth)
  └── config.js               ← allowlist config get/put (auth)
src/
  ├── ai/model.js             ← Gemini 2.5 Flash account-summary generation
  ├── ai/repo-analyzer.js     ← Gemini 2.5 Flash repo analysis
  ├── github/                 ← GitHub API clients (repos, contents, ratings, PR writer, …)
  ├── tiles/                  ← per-tile SVG renderers
  ├── backgrounds/            ← per-theme background renderers (cherry-blossom, geometric, vapor-wave)
  ├── markdown/               ← markdown generators (score-report, repository)
  ├── common/Tile.js          ← base SVG canvas class
  ├── data/tech-taxonomy.js   ← tech categorization data
  ├── icons/languages.js      ← language icon map
  └── *-cache.js              ← in-memory preview/scan caches
```

### Routes

Most SVG/data endpoints work without a user session if `GITHUB_TOKEN` is set;
otherwise they require an authenticated session. Endpoints that mutate GitHub data
always require auth.

- **Auth:** `GET /auth/github`, `GET /auth/callback`, `GET /auth/logout`, `GET /auth/me`
- **Config (auth):** `GET /config`, `PUT /config`
- **Profile apply (auth):** `GET /preview-readme`, `GET /apply-readme`, `GET /repo-scan`, `GET /repos`, `GET /repo-apply`, `GET /apply-all`
- **Monkeytype:** `POST /monkeytype/connect`, `POST /monkeytype/disconnect`, `GET /monkeytype`
- **SVG / data:** `GET /account-summary`, `GET /account-summary-md`, `GET /developer-rating`, `GET /developer-rating-insights`, `GET /tech-summary`, `GET /tech-list`, `GET /tech-chart`, `GET /tech-spider`, `GET /tech-categories`, `GET /improve-topics`, `GET /improve-descriptions`

See `docs/api.md` and `README.md` for per-endpoint query parameters and examples.

**Request flow for `GET /account-summary?username=&background=&projects=&effects=`:**

1. `getRepos(username)` → GitHub API → array of repo objects
2. Optional `projects` filter (top-N by stars, or a comma-separated name list)
3. Transform repos to `{ name, description, topics }`
4. `generateAccountSummary(repoData)` → Gemini → text summary
5. Select a background renderer from `background` (`cherry-blossom`, `geometric`, `vapor-wave`)
6. `renderAccountSummary(summary, background)` → SVG string
7. Respond with `Content-Type: image/svg+xml`

**`Tile` class** (`src/common/Tile.js`): holds width/height, CSS, and a background
function. `render(body)` wraps an SVG body string in the full SVG document with
namespace, styles, and background layer.

## Testing

Tests use **vitest** and live in `src/tests/` (`smoke.test.js`,
`account-summary.test.js`). Run `npm test` (or `npm run test:coverage`). Lint with
`npm run lint` and check formatting with `npm run format:check`. CI
(`.github/workflows/ci.yml`) runs these on pull requests.

**Coverage thresholds** are enforced by `vitest.config.js` and gate CI: lines 55%,
branches 75%, functions 60%, statements 55%. `npm run test:coverage` exits non-zero
below any of these. They are a conservative *floor* set just under current coverage
to protect in-flight work — raise them as streams land rather than letting coverage
regress. Any change to these or to `ci.yml` is coordinated through the director.

## Incomplete / Stub Files

- `api/repository-readme.js` — handler is a stub (per-repository README generation, not yet wired up)
- `src/common/Readme.js` — class skeleton; `renderSummary()` / `renderLanguages()` are empty
- `src/markdown/respository.js` — `renderReadme()` returns an empty string

The `tech-cards.js` and `tech-treemap.js` handlers and their renderers exist but are
not currently registered in `express.js`.

## Deployment

Deployed to **Google Cloud Run**. Pushes to `main` trigger the production deploy via
GitHub Actions. The service runs as a container; `SESSION_SECRET` and other env vars
are set as Cloud Run secrets/environment variables.

## dev.to Article

`dev.to.md` in the repo root is the published dev.to article. Keep it in sync when any of the following change:

- New endpoints or query parameters are added
- The cron/automation flow changes (branch naming, PR behaviour, allowlist format)
- Deployment instructions change (Cloud Run steps, env vars)
- The session cookie workaround is replaced with a proper API token
- Any self-hosting steps change (prerequisites, `.env` keys, OAuth callback URL)
  </content>
  </invoke>
