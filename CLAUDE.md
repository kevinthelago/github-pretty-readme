# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A Node.js/Express service that generates styled SVG graphics for GitHub profile READMEs. The `/account-summary` endpoint fetches a user's GitHub repos, passes them through Google Gemini AI to produce a summary, then renders the result as a themed SVG tile. Long-term goal: extend to per-repository README generation as well.

Architecturally similar to [github-readme-stats](https://github.com/anuraghazra/github-readme-stats).

## Commands

```bash
# Start the server (requires .env file)
npm start

# The server runs on process.env.port || 8080
```

No build, lint, or test scripts are configured in `package.json`. Tests were removed; `src/tests/account-summary.test.js` is a leftover stub.

## Environment Variables

| Variable | Purpose |
|---|---|
| `GOOGLE_AI_STUDIO_KEY` | Google Gemini API key |
| `AI_PROMPT` | Prompt template with `{topics}` placeholder substituted at runtime |
| `GITHUB_TOKEN` | PAT with `repo` scope — enables `/tech-summary` to fetch private repos via `/user/repos` |
| `port` | Server port (default 8080) |

Create a `.env` file at the root (gitignored) with these values for local dev.

## Architecture

```
express.js                  ← server entry point, registers routes
api/account-summary.js      ← endpoint handler, orchestrates the pipeline
  ├── src/github/repos.js   ← GitHub API client (getRepos, getContents)
  ├── src/ai/model.js       ← Gemini 2.0 Flash integration
  └── src/tiles/account-summary.js  ← SVG text renderer
        └── src/common/Tile.js      ← base SVG canvas class
              └── src/backgrounds/  ← per-theme background renderers
```

**Request flow for `GET /account-summary?username=&theme=&projects=&effects=`:**
1. `getRepos(username)` → GitHub API → array of repo objects
2. Transform repos to `[name, description, topics]`
3. `generateAccountSummary(repos)` → Gemini → text summary
4. Select background renderer from theme name (`cherry-blossom`, `geometric`, `vapor-wave`)
5. `renderAccountSummary(summary, background)` → SVG string
6. Respond with `Content-Type: image/svg+xml`

**`Tile` class** (`src/common/Tile.js`): holds width/height, CSS, and a background function. `render(body)` wraps an SVG body string in the full SVG document with namespace, styles, and background layer.

## Known Bugs

- **`Tile` constructor mismatch:** `account-summary.js` calls `new Tile(height, width)` (positional) but `Tile` expects a destructured object `{ height, width }`.
- **Missing return:** `renderAccountSummary()` in `src/tiles/account-summary.js` does not return the SVG string.
- **Unused params:** `projects` and `effects` query parameters are parsed but never used.
- **Dead variable:** `let title = "test title"` in `account-summary.js` is never referenced.

## Incomplete / Stub Files

- `api/repository-readme.js` — handler is a stub (no logic)
- `src/common/Readme.js` — class skeleton; `renderSummary()` and `renderLanguages()` are empty
- `src/markdown/respository.js` — `renderReadme()` returns an empty string
- `src/util/jwt.js` — empty placeholder
- `src/foregrounds/vapor-wave.js` — empty placeholder

## Deployment

GitHub Actions (`.github/workflows/main_github-pretty-readme.yml`) deploys to an Azure Web App named **github-pretty-readme** on every push to `main`. Build: Node 22, `npm install`, zip artifacts. Deploy: OIDC auth to Azure, deploy to Production slot.
