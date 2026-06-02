# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-02

First stable release: the full suite of profile-README tiles, repository tiles,
third-party integrations, an opt-in apply/preview flow, and a hardened platform.

### Added

#### Account tiles & endpoints
- AI account summary as a themed SVG tile (`/account-summary`) and as Markdown (`/account-summary-md`)
- Developer rating tile (`/developer-rating`) and AI insights (`/developer-rating-insights`)
- Tech-stack suite: `/tech-summary`, `/tech-list`, `/tech-chart`, `/tech-spider`, `/tech-categories`
- Contribution-graph tile
- Stats-card tile
- Language-trend tile (`/language-trend`)
- Social-links tile (`/social-links`)
- Recent/active languages chart (`/active-languages`)
- Coding-activity heatmap / activity-clock ("when I code") endpoint

#### Repository tiles & endpoints
- Repo card tile
- Repo tech-badges tile
- Repo activity chart tile
- Top-repos showcase tile (`/top-repos`)
- Repository-README preview endpoint (`/repository-readme`), backed by an extracted README generator (`src/markdown/repo-readme.js`) with badges, table of contents, config, and contributing sections

#### Integrations
- Monkeytype typing-stats integration (client + connect/disconnect)
- WakaTime integration: client, session connect/disconnect, and a coding-stats chart endpoint + tile

#### Profile apply / preview flow
- Profile preview and apply flow (`/preview-readme`, `/apply-readme`) that pushes selected tiles to a user's GitHub profile README
- Opt-in tiles configured via `.pretty-readme.json`, wired into both preview and apply
- SSE progress bar with live step descriptions on `/apply-readme` and `/apply-all`
- Run-state skip logic: repos with no new commits since last run are skipped automatically
- Per-repo PR flow: `pretty-readme/YYYY-MM-DD` branch with open/update PR logic
- Repo scope selection in UI: all repositories or a user-selected subset
- `/config` (GET/PUT) endpoints for managing the `.pretty-readme.json` allowlist

#### Platform & hardening
- GitHub OAuth authentication (login, callback, logout, session)
- API tokens: mint, list, and revoke, with Bearer-token validation in `requireAuth`
- Rate limiting on public SVG/AI endpoints
- `GET /healthz` health endpoint
- Route manifest (`api/_routes.js`) with shared handler conventions and auto-registered routes
- Injectable/mockable AI and GitHub client layers, including a GitHub GraphQL v4 client
- Vitest test suite with CI-enforced coverage thresholds (floor: lines 55%, branches 45%, functions 60%, statements 55%)
- CI/CD pipeline deploying to Google Cloud Run
- ESLint, Prettier, jsconfig.json, Dependabot, and `.env.example`
- LICENSE (MIT), SECURITY.md, and CONTRIBUTING.md

### Fixed
- Mounted six built-but-unregistered endpoints in the route manifest
- Cleaned up the account-summary handler and added regression tests
- `scoreTooling` in repo-analyzer: `hasTsconfig` signal now correctly detects `jsconfig.json` / `tsconfig.json`
- GitHub App permission error now surfaces a human-readable message pointing to the exact settings

### Documentation
- Synced README, `docs/api.md`, and the dev.to article to the current endpoint set
- Added a deploy-your-own self-hosting guide
- Documented opt-in tiles and the apply/preview flow

[1.0.0]: https://github.com/kevinthelago/github-pretty-readme/releases/tag/v1.0.0

## [0.1.0] - 2024-01-01

### Added
- Initial release
- `/account-summary` SVG endpoint with cherry-blossom, geometric, and vapor-wave themes
- `/tech-summary`, `/tech-chart`, `/tech-spider` visualisation endpoints
- `/developer-rating` and `/developer-rating-insights` endpoints
- GitHub OAuth authentication flow
- `/apply-readme` — pushes profile SVGs and AI insights to profile repo
- `/improve-topics` and `/improve-descriptions` — AI-powered repo metadata
- Monkeytype typing stats integration
- Google Cloud Run deployment via GitHub Actions
