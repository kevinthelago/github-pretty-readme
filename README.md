# github-pretty-readme

A Node.js/Express service that generates styled SVG graphics and markdown content for GitHub profile READMEs. Fetches your repos, scores your developer profile across five dimensions, renders spider charts per tech category, and pushes everything to your profile repo automatically.

Architecturally similar to [github-readme-stats](https://github.com/anuraghazra/github-readme-stats).

---

## Setup

### 1. Environment variables

Create a `.env` file at the project root:

```env
GITHUB_TOKEN=ghp_...            # Fine-grained PAT — read all repos, write topics/descriptions
PROFILE_REPO_TOKEN=ghp_...      # Fine-grained PAT — write to your profile repo (can be the same token)
GOOGLE_AI_STUDIO_KEY=...        # Google Gemini API key
```

**Required token permissions (fine-grained):**
- Resource owner: your account
- Repository access: All repositories
- Permissions: `Contents` → Read & Write, `Administration` → Read & Write

### 2. Install dependencies

```bash
npm install
```

---

## Commands

### Start the server

```bash
npm start
```

Starts the Express server on `http://localhost:8080` (or `$port`).

---

### Update your profile README

Fetches fresh data from GitHub + Gemini, pushes SVGs and markdown to your profile repo (`<username>/<username>`).

```bash
PROFILE_REPO_TOKEN=<token> port=8080 node scripts/update-profile.mjs <username>
```

**What it updates:**
| Section | Description |
|---|---|
| Bio | 2–3 sentence Gemini-generated summary injected as markdown |
| Developer rating | 800×280 SVG score card (Breadth, Depth, Diversity, Activity, Impact) |
| Tech charts | Spider charts per category composited into a single grid SVG |
| Badges | Clickable shields.io badges for every detected language/framework |
| `DEVELOPER_INSIGHTS.md` | Actionable per-repo improvement steps pushed to the profile repo |

---

### Improve repo metadata

Fill in missing topics and descriptions across all your repos using Gemini.

```bash
# Preview changes without applying
curl "http://localhost:8080/improve-topics?dry_run=true"
curl "http://localhost:8080/improve-descriptions?dry_run=true"

# Apply changes
curl "http://localhost:8080/improve-topics"
curl "http://localhost:8080/improve-descriptions"
```

---

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /account-summary-md?username=` | Gemini-generated bio as plain markdown |
| `GET /developer-rating` | SVG score card (overall + 5 dimensions) |
| `GET /developer-rating-insights` | Full markdown insights report with per-repo action items |
| `GET /tech-spider?type=&categories=&columns=&limit=` | Spider / treemap / cards / grid SVG |
| `GET /tech-categories?limit=` | JSON list of detected tech categories with counts |
| `GET /tech-list?sort=frequency` | JSON list of all techs with shields.io metadata |
| `GET /improve-topics?dry_run=` | Suggest and apply topics to repos with fewer than 3 |
| `GET /improve-descriptions?dry_run=` | Generate and apply descriptions to repos missing one |

### `/tech-spider` options

| Param | Values | Default |
|---|---|---|
| `type` | `spider`, `treemap`, `cards`, `grid` | `spider` |
| `categories` | `languages,frameworks,cloud,ai,databases,devops` | `languages,frameworks,cloud` |
| `columns` | `1`–`4` | `2` |
| `limit` | max techs per category | `6` |
| `exclude` | comma-separated tech names to drop | — |

---

## Automation

A GitHub Actions workflow runs daily at 5am UTC, improves repo metadata, and refreshes the profile README:

```
.github/workflows/daily-improve.yml
```

You can also trigger it manually from the Actions tab with optional `dry_run` and `passes` inputs.

**Required repository secrets:**
- `GH_PAT` — token with repo read/write access
- `PROFILE_REPO_TOKEN` — token with write access to your profile repo
- `GOOGLE_AI_STUDIO_KEY` — Gemini API key
- `AI_PROMPT` — prompt template (optional, used by legacy SVG summary endpoint)
