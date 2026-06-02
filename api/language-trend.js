import { renderLanguageTrend } from '../src/tiles/language-trend.js';
import { getAllRepos } from '../src/github/repos.js';
import LANGUAGE_ICON_MAP from '../src/icons/languages.js';
import * as simpleIcons from 'simple-icons';

const REPO_CAP_DEFAULT = 40;   // max repos to fetch /languages for (bounds API calls)
const LANG_LIMIT_DEFAULT = 6;  // max languages shown as stacked series
const CACHE_TTL_MS = 15 * 60 * 1000;

/** username|repoCap|langLimit → { svg, ts } */
const cache = new Map();

const normalizeForSlug = (lang) => lang.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Brand colour for a language, mirroring the lookup used by /tech-chart. */
const hexFor = (lang) => {
    if (LANGUAGE_ICON_MAP[lang]) return LANGUAGE_ICON_MAP[lang].hex;
    const key = `si${normalizeForSlug(lang).replace(/^./, c => c.toUpperCase())}`;
    return simpleIcons[key]?.hex ?? null;
};

const ghHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    Accept:        'application/vnd.github+json',
});

/** Fetches the language→bytes breakdown for one repo; tolerates failures. */
const fetchLanguages = async (owner, repo, token) => {
    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
            headers: ghHeaders(token),
        });
        return res.ok ? await res.json() : {};
    } catch {
        return {};
    }
};

/**
 * Builds the cumulative stacked-area dataset from a set of repos:
 *  1. cap to the largest `repoCap` non-fork repos (bounds /languages calls),
 *  2. bucket each repo's language bytes by its creation year,
 *  3. fill the year range contiguously and prefix-sum into cumulative totals,
 *  4. keep the top `langLimit` languages by total bytes.
 */
export const buildDataset = async (repos, token, repoCap, langLimit) => {
    const selected = repos
        .filter(r => !r.fork)
        .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
        .slice(0, repoCap);

    if (selected.length === 0) return { buckets: [], series: [] };

    // year → { language → bytes }
    const perYear = new Map();
    const totals = {};

    const breakdowns = await Promise.all(
        selected.map(r => fetchLanguages(r.owner.login, r.name, token)),
    );

    selected.forEach((repo, i) => {
        const year = new Date(repo.created_at).getUTCFullYear();
        if (!perYear.has(year)) perYear.set(year, {});
        const bucket = perYear.get(year);
        for (const [lang, bytes] of Object.entries(breakdowns[i])) {
            bucket[lang] = (bucket[lang] ?? 0) + bytes;
            totals[lang] = (totals[lang] ?? 0) + bytes;
        }
    });

    const topLangs = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, langLimit)
        .map(([lang]) => lang);

    if (topLangs.length === 0) return { buckets: [], series: [] };

    // Contiguous year range so the stacked area has no gaps.
    const years = [...perYear.keys()].sort((a, b) => a - b);
    const buckets = [];
    for (let y = years[0]; y <= years[years.length - 1]; y++) buckets.push(y);

    const series = topLangs.map((lang) => {
        let running = 0;
        const values = buckets.map((y) => {
            running += perYear.get(y)?.[lang] ?? 0;
            return running;
        });
        return { language: lang, hex: hexFor(lang), values };
    });

    return { buckets: buckets.map(String), series };
};

/**
 * GET /language-trend
 *
 * Approximates how a user's language usage has grown over time by bucketing each
 * repository's language bytes by its creation year and rendering a cumulative
 * stacked-area chart. Results are cached for 15 minutes per user to limit the
 * fan-out of per-repo /languages calls.
 *
 * Query: ?repos=<N> (repo cap, default 40), ?limit=<N> (languages, default 6),
 *        ?username=<login> (cache key when unauthenticated).
 */
export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    const repoCap   = Math.max(1, parseInt(req.query.repos, 10) || REPO_CAP_DEFAULT);
    const langLimit = Math.max(1, parseInt(req.query.limit, 10) || LANG_LIMIT_DEFAULT);
    const token     = req.session?.github_token ?? process.env.GITHUB_TOKEN;
    const username  = req.session?.github_username ?? req.query.username ?? 'env';

    try {
        const repos = await getAllRepos(token);
        if (!repos) return res.status(401).send('GitHub not connected');

        const cacheKey = `${username}|${repoCap}|${langLimit}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return res.send(hit.svg);

        const dataset = await buildDataset(repos, token, repoCap, langLimit);
        const svg = renderLanguageTrend(dataset);

        cache.set(cacheKey, { svg, ts: Date.now() });
        return res.send(svg);
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

/**
 * Route descriptor consumed by the auto-registration layer (#52). Public route —
 * reads the session token when present, falling back to GITHUB_TOKEN.
 */
export const route = { method: 'get', path: '/language-trend', auth: false };
