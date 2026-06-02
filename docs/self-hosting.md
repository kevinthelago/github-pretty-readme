# Self-Hosting Guide

This guide walks you through running your own instance of
`github-pretty-readme` — from a local dev server to a production deployment on
Google Cloud Run — and wiring up the daily profile-update automation.

By the end you will have:

1. A GitHub OAuth App so users (you) can sign in and the apply flow can write to
   your repos.
2. A configured `.env` (locally) or secret set (in production).
3. The service running locally and/or on Cloud Run.
4. An optional scheduled workflow that refreshes your profile README every day.

---

## 1 — Prerequisites

- **Node.js 22.x** (the Docker image and CI both pin `node:22`).
- A **GitHub account** and a repo to publish to (your profile repo is
  `<username>/<username>`).
- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/)
  for the AI features (account summaries, rating insights, repo analysis).
- For production: a **Google Cloud project** with billing enabled and the
  `gcloud` CLI (only if you deploy manually rather than via GitHub Actions).

---

## 2 — Register a GitHub OAuth App

User authentication and the profile-apply flow use a GitHub **OAuth App**.

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (<https://github.com/settings/developers>).
2. Fill in:
   - **Application name** — anything, e.g. `my-pretty-readme`.
   - **Homepage URL** — your deployed URL (or `http://localhost:8088` for local
     dev).
   - **Authorization callback URL** — **must** be `<BASE_URL>/auth/callback`.
     - Local: `http://localhost:8088/auth/callback`
     - Production: `https://your-service.example.run.app/auth/callback`
3. Click **Register application**, then **Generate a new client secret**.
4. Copy the **Client ID** and **Client secret** — these become
   `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`.

The app requests the `repo` scope so it can read your repositories and push
generated assets to your profile repo.

> If `BASE_URL` and the registered callback URL disagree, OAuth will fail with
> a redirect-URI mismatch. Keep them in sync whenever you change domains.

---

## 3 — Configure environment variables

Copy [`.env.example`](../.env.example) to `.env` and fill in real values:

```bash
cp .env.example .env
```

`.env.example` documents every variable. The essentials:

| Variable                   | Needed for                                            |
| -------------------------- | ----------------------------------------------------- |
| `GOOGLE_AI_STUDIO_KEY`     | All AI features (required to get useful output)       |
| `GITHUB_APP_CLIENT_ID`     | OAuth sign-in + apply flow                            |
| `GITHUB_APP_CLIENT_SECRET` | OAuth sign-in + apply flow                            |
| `GITHUB_TOKEN`             | Unauthenticated fallback for the public SVG endpoints |
| `SESSION_SECRET`           | Signing session cookies (set a strong random value)   |
| `BASE_URL`                 | OAuth callback base; must match the OAuth App         |
| `NODE_ENV`                 | `production` makes session cookies HTTPS-only         |
| `PORT`                     | Listen port (default `8088`)                          |

`MONKEYTYPE_*`, `WAKATIME_API_KEY`, and `PROFILE_REPO_TOKEN` are optional — see
their notes in `.env.example`.

The service still boots without these (they have safe dev defaults or disable a
feature), but AI output and the OAuth/apply flow only work once their keys are
present.

---

## 4 — Run locally

```bash
npm install
npm start          # loads .env via --env-file and listens on PORT (default 8088)
```

Visit `http://localhost:8088`, click **Sign in with GitHub**, and you should be
redirected through the OAuth flow back to the app.

### Run in Docker

The repo ships a `Dockerfile` (production image, `--omit=dev`):

```bash
docker build -t github-pretty-readme .
docker run --rm -p 8088:8080 --env-file .env -e port=8088 github-pretty-readme
```

The image `EXPOSE`s `8080` and defaults `port=8080`; map or override the port to
taste.

---

## 5 — Deploy to Google Cloud Run

The project deploys to **Cloud Run**. The supported path is the GitHub Actions
workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): every push
to `main` builds the image, pushes it to Artifact Registry, and deploys the
service.

### 5a — One-time GCP setup

1. Create (or pick) a GCP project and note its **project ID** and a **region**
   (e.g. `us-central1`).
2. Create a **service account** with roles: Cloud Run Admin, Artifact Registry
   Admin, Service Account User, and Secret Manager Secret Accessor. Download its
   JSON key.
3. Store the app's runtime secrets in **Secret Manager** (the workflow mounts
   these into Cloud Run by name):

   | Secret Manager name        | Value                          |
   | -------------------------- | ------------------------------ |
   | `GH_PAT`                   | A GitHub PAT (`GITHUB_TOKEN`)  |
   | `GOOGLE_AI_STUDIO_KEY`     | Gemini API key                 |
   | `GITHUB_APP_CLIENT_ID`     | OAuth App client ID            |
   | `GITHUB_APP_CLIENT_SECRET` | OAuth App client secret        |
   | `SESSION_SECRET`           | Strong random string           |

### 5b — Repository configuration

In the GitHub repo, under **Settings → Secrets and variables → Actions**, add:

| Kind     | Name             | Value                                    |
| -------- | ---------------- | ---------------------------------------- |
| Variable | `GCP_REGION`     | e.g. `us-central1`                       |
| Variable | `GCP_PROJECT_ID` | Your GCP project ID                      |
| Secret   | `GCP_SA_KEY`     | The service-account JSON key from above  |

The deploy job validates these are present and fails early with a clear message
if any are missing. It enables the required GCP APIs, ensures an Artifact
Registry repo named `github-pretty-readme` exists, builds and pushes the image,
and deploys with `--allow-unauthenticated`. `BASE_URL` and `NODE_ENV=production`
are passed as env vars in the deploy step — update `BASE_URL` to your service's
URL.

### 5c — Manual deploy (optional)

If you prefer not to use the workflow, the same steps work from the CLI:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/github-pretty-readme/app
gcloud run deploy github-pretty-readme \
  --image REGION-docker.pkg.dev/PROJECT/github-pretty-readme/app \
  --region REGION --allow-unauthenticated \
  --set-env-vars BASE_URL=https://your-service.run.app,NODE_ENV=production \
  --update-secrets GITHUB_TOKEN=GH_PAT:latest,GOOGLE_AI_STUDIO_KEY=GOOGLE_AI_STUDIO_KEY:latest,GITHUB_APP_CLIENT_ID=GITHUB_APP_CLIENT_ID:latest,GITHUB_APP_CLIENT_SECRET=GITHUB_APP_CLIENT_SECRET:latest,SESSION_SECRET=SESSION_SECRET:latest
```

After deploying, **update your OAuth App's callback URL** (and `BASE_URL`) to the
deployed service URL.

---

## 6 — Daily profile-update automation

You can have your profile README refresh itself on a schedule by calling your
deployed instance from a GitHub Actions workflow in your **profile repo**. The
full walkthrough (workflow YAML, what each run does, state file) lives in the
[README "Automate your profile" section](../README.md).

### Authenticating the automation

The automation must authenticate as you so it can write to your repos. Use a
**revocable API token** — the recommended path:

1. Sign in to your deployed instance via GitHub OAuth.
2. Mint a token: `POST /tokens` (optionally `{ "label": "cron" }` in the body).
   The token is returned **once** — store it immediately.

   ```bash
   curl -fsSL -X POST -H "Content-Type: application/json" \
     -b "session=<your-session-cookie>" \
     -d '{"label":"cron"}' \
     "$PRETTY_README_URL/tokens"
   ```

3. Store it as the `PRETTY_README_TOKEN` repo secret and have the workflow send
   it as a Bearer header:

   | Secret                | Value                                                       |
   | --------------------- | ----------------------------------------------------------- |
   | `PRETTY_README_URL`   | Your deployed service URL                                   |
   | `PRETTY_README_TOKEN` | The minted API token (`POST /tokens`, returned once)        |

   ```yaml
   - name: Trigger full update
     run: |
       curl -fsSL \
         -H "Authorization: Bearer ${{ secrets.PRETTY_README_TOKEN }}" \
         "${{ secrets.PRETTY_README_URL }}/apply-all?score=true&readme=true&topics=true&descriptions=true"
   ```

List your tokens with `GET /tokens` and revoke one with `DELETE /tokens/:id`.
Tokens are stored hashed and never expire, so rotate by minting a new one and
deleting the old.

> **Deprecated — session cookie.** The older `PRETTY_README_SESSION` cookie
> secret still works until the cookie expires (7 days), but the unauthenticated
> `Authorization: Bearer <any-value>` shortcut has been removed — the service
> now verifies Bearer tokens against its store. Migrate cron automation to
> `PRETTY_README_TOKEN`.

See `.env.example` for `PROFILE_REPO_TOKEN`, used by the local
`scripts/update-*.mjs` automation scripts when you run them outside the hosted
service.

---

## 7 — Verify end to end

1. `npm start` (or open your Cloud Run URL).
2. Sign in with GitHub — you should land back on the app authenticated.
3. Hit a public endpoint, e.g.
   `http://localhost:8088/account-summary?username=<you>` — you should get an
   SVG back.
4. Run `GET /preview-readme` to confirm the apply flow can read your repos.
5. (Optional) Add the daily workflow to your profile repo and trigger it from the
   Actions tab.

If sign-in fails with a redirect mismatch, re-check that the OAuth App callback
URL equals `<BASE_URL>/auth/callback`.
