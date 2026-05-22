# Contributing to github-pretty-readme

Thanks for your interest in contributing!

## Setup

```bash
git clone https://github.com/kevinthelago/github-pretty-readme.git
cd github-pretty-readme
npm install
cp .env.example .env   # fill in your keys
npm start
```

Required environment variables are documented in the [README](README.md#environment-variables).

## Branch Strategy

- Branch from `main` using the convention `{issue-number}-short-description`
- Keep branches focused — one issue per branch
- Open a PR targeting `main`; CI must pass before merge

## Development

```bash
npm test          # run tests
npm run lint      # check for lint errors
npm run lint:fix  # auto-fix lint errors
npm run format    # auto-format with Prettier
```

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] No new lint errors (`npm run lint`)
- [ ] New endpoints are documented in `README.md`
- [ ] `dev.to.md` is updated if the public-facing flow changed

## Code Style

- ES modules (`import`/`export`) throughout
- 4-space indentation, single quotes, semicolons
- Prefer `const` and avoid mutating variables where possible
- Keep handlers thin — business logic lives in `src/`

## Reporting Issues

Open a [GitHub Issue](https://github.com/kevinthelago/github-pretty-readme/issues) with a clear description and reproduction steps. For security issues, see [SECURITY.md](SECURITY.md).
