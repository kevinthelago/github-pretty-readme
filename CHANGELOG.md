# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- SSE progress bar with live step descriptions on `/apply-readme` and `/apply-all`
- Run-state skip logic: repos with no new commits since last run are skipped automatically
- Per-repo PR flow: `pretty-readme/YYYY-MM-DD` branch with open/update PR logic
- Repo scope selection in UI: all repositories or user-selected subset
- Profile summary toggle (opt-in rather than always-on)
- `/config` and `/config` PUT endpoints for managing the `.pretty-readme.json` allowlist
- ESLint, Prettier, and jsconfig.json for tooling and type checking
- Dependabot for automated dependency updates
- Vitest test framework with coverage reporting
- LICENSE (MIT), SECURITY.md, and CONTRIBUTING.md

### Fixed
- `scoreTooling` in repo-analyzer: `hasTsconfig` signal now correctly detects `jsconfig.json` / `tsconfig.json`
- GitHub App permission error now surfaces a human-readable message pointing to the exact settings

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
