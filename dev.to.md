# Give Your GitHub Profile a Daily AI Makeover with github-pretty-readme

Your GitHub profile README is usually a snapshot frozen in time. You set it up once, maybe drop in a stats badge, and forget about it for months. Meanwhile your repos pile up, your tech stack shifts, and the bio you wrote in 2022 still says "learning React."

`github-pretty-readme` fixes that. It's a Node/Express service that reads your GitHub account via the API, runs everything through Google Gemini AI, and produces:

- A **developer rating card** — scored across Breadth, Depth, Diversity, Activity, and Impact
- A **tech stack visualization** — spider chart, treemap, or card grid from your actual repos
- An **AI-written bio** — regenerated from your real commit history, not a template
- **SCORE.md** per repo — a code quality report graded A–F across six dimensions
- **AI topics and descriptions** for repos that are missing them
- **Account tiles** -- opt-in extras: a contribution heatmap (with streaks), a GitHub stats card, a language-trend chart, social-link badges, a recent-languages tile, a top-repositories grid, and a day-by-hour activity clock
- **Repo tiles** -- a repo card, a weekly commit-activity chart, and a shields.io tech-badge row for any single repo
- **Typing & coding stats** -- optional Monkeytype WPM and WakaTime coding-time charts

Everything outputs as SVG or Markdown, embeds directly into any README, and can run on a daily cron so it's always current.

---

## How it works

The service exposes a set of HTTP endpoints. You sign in with GitHub OAuth so it can read your repos (including private ones if you grant `repo` scope), and the AI does the rest.

The core pipeline for a profile update looks like this:

```
GitHub API → repo list + metadata
     ↓
Google Gemini 2.5 Flash → bio, score, insights
     ↓
SVG renderer → developer-rating.svg, tech-spider.svg
     ↓
GitHub Contents API → push to {username}/{username}
```

---

## Self-hosting in 10 minutes

### Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com) API key (free tier works)
- A [GitHub OAuth App](https://github.com/settings/developers) (takes about 2 minutes to create)

### 1 — Clone and install

```bash
git clone https://github.com/kevinthelago/github-pretty-readme
cd github-pretty-readme
npm install
```

### 2 — Create a `.env` file

```env
SESSION_SECRET=any-long-random-string
GOOGLE_AI_STUDIO_KEY=your-gemini-key
GITHUB_APP_CLIENT_ID=your-oauth-app-client-id
GITHUB_APP_CLIENT_SECRET=your-oauth-app-client-secret
BASE_URL=http://localhost:8080
```

For your GitHub OAuth App, set the callback URL to `http://localhost:8088/auth/callback`.

### 3 — Start the server

```bash
npm start
```

Open `http://localhost:8088`. Sign in with GitHub and you'll land on the preview dashboard.

---

## Basic usage

### The dashboard

Once authenticated, the dashboard shows a live preview of your profile README as it would look on GitHub. It renders your developer rating card, tech stack chart, and AI bio side by side. The first load takes 30–60 seconds while it fetches your repos and calls Gemini — subsequent loads are served from a cache.

### Embedding SVGs directly

Every graphic is also available as a plain URL you can drop into any markdown file:

```markdown
<!-- Developer rating card -->
![Developer Rating](https://your-service.run.app/developer-rating)

<!-- Tech stack spider chart -->
![Tech Stack](https://your-service.run.app/tech-spider?type=spider&categories=languages,frameworks,cloud)

<!-- Tech cards grid -->
![Tech Stack](https://your-service.run.app/tech-spider?type=cards&categories=languages,frameworks,ai&limit=12)

<!-- Contribution heatmap + streaks -->
![Contribution Graph](https://your-service.run.app/contribution-graph?username=octocat)

<!-- GitHub stats card -->
![GitHub Stats](https://your-service.run.app/stats-card?username=octocat)

<!-- Languages worked in recently, weighted by commit activity -->
![Active Languages](https://your-service.run.app/active-languages?username=octocat&days=90)

<!-- Cumulative language-usage-over-time, stacked area -->
![Language Trend](https://your-service.run.app/language-trend?limit=8)

<!-- Day-by-hour activity clock -->
![Activity Clock](https://your-service.run.app/activity-clock?username=octocat)

<!-- A grid of your most notable repositories -->
![Top Repos](https://your-service.run.app/top-repos?username=octocat&sort=stars&limit=6)

<!-- A card for a single repo -->
![Repo Card](https://your-service.run.app/repo-card?repo=octocat/Hello-World)

<!-- Weekly commit activity for a single repo -->
![Repo Activity](https://your-service.run.app/repo-activity?repo=octocat/Hello-World)

<!-- Brand badges linking to your socials -->
![Social Links](https://your-service.run.app/social-links?links=github:octocat,linkedin:octocat)

<!-- WakaTime coding time (requires a connected WakaTime key) -->
![Coding Time](https://your-service.run.app/wakatime?range=last_30_days)
```

The SVGs are themed and adapt to GitHub's light and dark mode automatically.

> The public SVG/data endpoints are rate-limited for anonymous traffic (default 60 requests / 60 s per IP + token; tune via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`). Signed-in sessions and the `/healthz` probe are exempt. Over-limit requests get a `429` with `Retry-After` and `X-RateLimit-*` headers. The web UI is served at the site root `/`.

### Pushing your profile README

Hit the **Apply to profile** button in the dashboard (or call `GET /apply-readme`) to push everything to your `{username}/{username}` profile repo. This writes:

- A regenerated `README.md` with your bio, rating card, and tech chart embedded
- A `DEVELOPER_INSIGHTS.md` with the full score breakdown and AI recommendations

### Scanning a repo

Switch to a specific repo using the URL bar at the top of the dashboard. The service reads the file tree, config files, and a sample of source files, then scores the repo across six dimensions:

| Dimension | What it measures |
|:--|:--|
| Architecture | Directory structure, separation of concerns |
| Documentation | README quality, inline comments, docstrings |
| Testing | Test coverage signals, test file presence |
| Dependencies | Dependency hygiene, version pinning |
| Security | Known pattern checks, exposed secrets scan |
| Code Quality | Complexity, naming, consistency |

The result is a `SCORE.md` you can push to the repo directly from the dashboard. Each score is graded A–F and includes specific, actionable suggestions from Gemini.

### Improving topics and descriptions in bulk

If you have repos with no topics or empty descriptions, the service can fill them in automatically:

```
GET /improve-topics?dry_run=true        # preview what would be added
GET /improve-topics                     # apply to all eligible repos

GET /improve-descriptions?dry_run=true  # preview
GET /improve-descriptions               # apply
```

Always run with `dry_run=true` first — the output is a JSON diff showing exactly what would change.

---

## Setting up the daily cron job

This is where it gets interesting. Instead of opening the dashboard to trigger updates manually, you can schedule a GitHub Action in your profile repo that calls the service every morning.

The design here is intentionally safe:

- **Topics and descriptions** are applied immediately when the run triggers — they're one-field metadata changes, trivially reversible from the GitHub repo settings page.
- **File changes** (SCORE.md, README.md) are pushed to a `pretty-readme/YYYY-MM-DD` branch and opened as a pull request. You review and merge on your own schedule. Nothing lands on your default branch without your approval.
- **Only repos in an explicit allowlist** are touched. There's no "apply to everything" behavior by default.

### Step 1 — Create the allowlist

Add `.pretty-readme.json` to your profile repository (`{username}/{username}`). This is the single file that controls which repos the automation can touch.

```json
{
  "repos": [
    "my-main-project",
    "cool-cli-tool",
    "open-source-library"
  ]
}
```

You can manage this file from the app UI or directly in GitHub. If this file doesn't exist, the cron job will refuse to run — intentional, so a fresh deploy can't accidentally bulk-update everything.

The same file can opt into extra profile tiles (all off by default) via a `tiles` block. The available tile ids are `contributionGraph`, `statsCard`, `languageTrend`, `socialLinks`, `activeLanguages`, `topRepos`, `activityClock`, and `wakatime` — each also a standalone endpoint you can embed directly:

```json
{
  "repos": ["my-main-project"],
  "tiles": {
    "contributionGraph": true,
    "statsCard": true,
    "activeLanguages": true,
    "topRepos": true
  },
  "social": { "github": "octocat", "linkedin": "octocat" }
}
```

Enabled tiles are rendered as SVGs (reusing the same data builders as the standalone endpoints), pushed to `assets/`, and injected into your profile README between their markers on the next apply. The `socialLinks` tile reads the top-level `social` map.

### Step 2 — Add the workflow

In your profile repository (`{username}/{username}`), create `.github/workflows/pretty-readme.yml`:

```yaml
name: pretty-readme daily update

on:
  schedule:
    - cron: "0 5 * * *"   # 05:00 UTC every day
  workflow_dispatch:       # allow manual trigger from the Actions tab

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Update profile and open repo PRs
        run: |
          curl -fsSL \
            -H "Authorization: Bearer ${{ secrets.PRETTY_README_TOKEN }}" \
            "${{ secrets.PRETTY_README_URL }}/apply-all?score=true&readme=true&topics=true&descriptions=true"
```

The query parameters are all optional — mix and match based on what you want the run to do:

| Param | Effect |
|:--|:--|
| `score=true` | Generate and push `SCORE.md` to each repo |
| `readme=true` | Generate and push `README.md` to each repo |
| `topics=true` | Apply AI topics to repos with fewer than 3 tags |
| `descriptions=true` | Apply AI descriptions to repos with no description |

### Step 3 — Set the repository secrets

Go to your profile repo → **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|:--|:--|
| `PRETTY_README_URL` | Your deployed service URL, e.g. `https://github-pretty-readme-abc123-uc.a.run.app` |
| `PRETTY_README_TOKEN` | A long-lived API token (see below) |

**Minting an API token:**

1. Sign into the service in your browser
2. Mint a token with `POST /tokens` (the plaintext token is returned **once** -- copy it immediately)
3. Paste it as the `PRETTY_README_TOKEN` secret

> API tokens do not expire, so there is no more re-copying a session cookie every week. They are sent as `Authorization: Bearer <token>`, are stored only as SHA-256 hashes server-side, and are revocable any time with `DELETE /tokens/:id` -- rotate by minting a new one and deleting the old. The old copied-session-cookie path has been retired: a bare `Authorization: Bearer <anything>` is no longer trusted, since the service now verifies the token against its store.

### Step 4 — Watch the PRs roll in

The next morning at 05:00 UTC (or hit **Run workflow** manually for an immediate test), the action fires. For each repo in your allowlist, you'll get a pull request like:

```
pretty-readme: auto-update 2026-05-22

Automated update from github-pretty-readme.

### Files changed
- `README.md` — AI-generated project documentation
- `SCORE.md` — Code quality report · **B+** (84/100)

### Metadata applied
- **Topics** — `cli`, `devops`, `automation`, `ssh`
- **Description** — A scriptable CLI for orchestrating shell jobs across hosts

---
*Topics and description were applied immediately. Merge this PR to apply the file changes.*
```

Merge what looks good, close what doesn't. The branch is reset on the next daily run so stale PRs don't pile up.

---

## Deploying to Cloud Run

The service runs as a stateless container — no database, no persistent storage. All caches are in-memory with TTLs (30 min for preview data, 4 hours for repo scans).

```bash
# Build and deploy
gcloud run deploy github-pretty-readme \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars \
    SESSION_SECRET=your-secret,\
    GOOGLE_AI_STUDIO_KEY=your-key,\
    GITHUB_APP_CLIENT_ID=your-id,\
    GITHUB_APP_CLIENT_SECRET=your-secret,\
    BASE_URL=https://your-service-url.run.app
```

Set `NODE_ENV=production` so session cookies are marked `Secure` and only sent over HTTPS.

The GitHub OAuth App callback URL needs to be updated to your Cloud Run URL: `https://your-service-url.run.app/auth/callback`.

---

## Source

The project is open source: [github.com/kevinthelago/github-pretty-readme](https://github.com/kevinthelago/github-pretty-readme)

PRs welcome — especially around expanding the code quality scoring dimensions and the optional profile tiles (contribution graph, stats card, WakaTime, language trend, social links).

---

*Tags: `github` `productivity` `ai` `node` `devops`*
