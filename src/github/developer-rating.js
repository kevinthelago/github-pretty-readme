import { TAXONOMY } from '../data/tech-taxonomy.js';

const ALL_CATEGORIES = ['languages', 'frameworks', 'cloud', 'ai', 'databases', 'devops'];

const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));

const scoreBreadth = (repos) => {
    const languages = new Set(repos.map(r => r.language).filter(Boolean));
    const topicCategories = new Set();
    repos.forEach(repo => {
        (repo.topics || []).forEach(t => {
            const entry = TAXONOMY[t];
            if (entry) topicCategories.add(entry.category);
        });
    });
    const langScore = clamp(languages.size * 12);
    const catScore  = clamp((topicCategories.size / ALL_CATEGORIES.length) * 100);
    return Math.round((langScore * 0.6) + (catScore * 0.4));
};

const breadthDetails = (repos) => {
    const languages = new Set(repos.map(r => r.language).filter(Boolean));
    const covered = new Set();
    repos.forEach(repo => {
        (repo.topics || []).forEach(t => {
            const entry = TAXONOMY[t];
            if (entry) covered.add(entry.category);
        });
    });
    if (languages.size) covered.add('languages');
    const missing = ALL_CATEGORIES.filter(c => !covered.has(c));
    return {
        languages: [...languages],
        coveredCategories: [...covered],
        missingCategories: missing,
    };
};

const scoreDepth = (repos) => {
    if (repos.length === 0) return 0;
    const scores = repos.map(repo => {
        let s = 0;
        if (repo.description && repo.description.trim().length > 10) s += 40;
        if (repo.topics && repo.topics.length > 0)                   s += 35;
        if (repo.size > 50)                                           s += 25;
        return s;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
};

const depthDetails = (repos) => {
    return repos
        .map(repo => ({
            name: repo.name,
            url: repo.html_url,
            hasDescription: !!(repo.description && repo.description.trim().length > 10),
            hasTopics: !!(repo.topics && repo.topics.length > 0),
            hasSize: repo.size > 50,
            score: (repo.description && repo.description.trim().length > 10 ? 40 : 0) +
                   (repo.topics && repo.topics.length > 0 ? 35 : 0) +
                   (repo.size > 50 ? 25 : 0),
        }))
        .sort((a, b) => a.score - b.score);
};

const scoreDiversity = (repos) => {
    const catCounts = {};
    repos.forEach(repo => {
        (repo.topics || []).forEach(t => {
            const entry = TAXONOMY[t];
            if (entry) catCounts[entry.category] = (catCounts[entry.category] || 0) + 1;
        });
        if (repo.language) catCounts['languages'] = (catCounts['languages'] || 0) + 1;
    });
    const counts = Object.values(catCounts);
    if (counts.length === 0) return 0;
    const total = counts.reduce((a, b) => a + b, 0);
    const entropy = -counts.reduce((sum, c) => {
        const p = c / total;
        return sum + p * Math.log2(p);
    }, 0);
    return Math.round((entropy / Math.log2(ALL_CATEGORIES.length)) * 100);
};

const diversityDetails = (repos) => {
    const catRepos = {};
    repos.forEach(repo => {
        const cats = new Set();
        (repo.topics || []).forEach(t => {
            const entry = TAXONOMY[t];
            if (entry) cats.add(entry.category);
        });
        if (repo.language) cats.add('languages');
        cats.forEach(cat => {
            if (!catRepos[cat]) catRepos[cat] = [];
            catRepos[cat].push(repo.name);
        });
    });
    return Object.entries(catRepos)
        .map(([category, repoNames]) => ({ category, count: repoNames.length, repos: repoNames }))
        .sort((a, b) => b.count - a.count);
};

const scoreActivity = (repos) => {
    if (repos.length === 0) return 0;
    const now = Date.now();
    const MS = { d30: 30 * 86400000, d90: 90 * 86400000, d365: 365 * 86400000 };
    let recentCount = 0;
    repos.forEach(repo => {
        const age = now - new Date(repo.pushed_at).getTime();
        if      (age < MS.d30)  recentCount += 3;
        else if (age < MS.d90)  recentCount += 2;
        else if (age < MS.d365) recentCount += 1;
    });
    return clamp(Math.round((recentCount / (repos.length * 3)) * 140));
};

const activityDetails = (repos) => {
    const now = Date.now();
    const MS = { d30: 30 * 86400000, d90: 90 * 86400000, d365: 365 * 86400000 };
    return repos
        .map(repo => {
            const age = now - new Date(repo.pushed_at).getTime();
            const bucket = age < MS.d30 ? 'last 30 days'
                         : age < MS.d90 ? 'last 90 days'
                         : age < MS.d365 ? 'last year'
                         : 'over a year ago';
            return { name: repo.name, url: repo.html_url, pushedAt: repo.pushed_at, bucket, age };
        })
        .sort((a, b) => b.age - a.age);
};

const scoreImpact = (repos) => {
    const stars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const forks  = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
    return clamp(Math.round(Math.log10(stars + forks * 2 + 1) * 25));
};

const impactDetails = (repos) => {
    return repos
        .map(repo => ({
            name: repo.name,
            url: repo.html_url,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
        }))
        .sort((a, b) => (b.stars + b.forks * 2) - (a.stars + a.forks * 2));
};

// ── Engineering dimension ─────────────────────────────────────────────────────

const scoreEngineering = (metrics) => {
    if (!metrics || metrics.length === 0) return null; // omit if data unavailable
    const n    = metrics.length;
    const ci   = metrics.filter(m => m.hasCi).length / n;
    const dep  = metrics.filter(m => m.hasDeployments).length / n;
    const iss  = metrics.filter(m => m.hasClosedIssues).length / n;
    const prs  = metrics.filter(m => m.hasPrs).length / n;
    return clamp(Math.round(ci * 40 + dep * 25 + iss * 20 + prs * 15));
};

const engineeringDetails = (metrics) => {
    if (!metrics || metrics.length === 0) return null;
    return {
        repos:           metrics,
        ciCount:         metrics.filter(m => m.hasCi).length,
        deploymentCount: metrics.filter(m => m.hasDeployments).length,
        issueCount:      metrics.filter(m => m.hasClosedIssues).length,
        prCount:         metrics.filter(m => m.hasPrs).length,
        total:           metrics.length,
    };
};

// ── Code Quality dimension (from repo scan cache) ─────────────────────────────

/**
 * Averages per-repo codeQuality.overall scores from scan cache data.
 * Returns null when no scan data is available so the weight is dropped.
 *
 * @param {object} scanData  { repoName: analysisResult } from scanCache.getAll()
 */
const scoreCodeQuality = (scanData) => {
    if (!scanData || Object.keys(scanData).length === 0) return null;
    const scores = Object.values(scanData)
        .map(a => a?.codeQuality?.overall)
        .filter(s => typeof s === 'number');
    if (!scores.length) return null;
    return clamp(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
};

const codeQualityDetails = (scanData) => {
    if (!scanData || Object.keys(scanData).length === 0) return null;
    const entries = Object.entries(scanData)
        .map(([repo, a]) => ({
            repo,
            overall:       a?.codeQuality?.overall ?? null,
            grade:         a?.codeQuality?.grade   ?? null,
            testing:       a?.codeQuality?.testing?.score       ?? null,
            documentation: a?.codeQuality?.documentation?.score ?? null,
            tooling:       a?.codeQuality?.tooling?.score       ?? null,
            ci:            a?.codeQuality?.ci?.score            ?? null,
            security:      a?.codeQuality?.security?.score      ?? null,
            structure:     a?.codeQuality?.structure?.score     ?? null,
        }))
        .filter(e => e.overall !== null)
        .sort((a, b) => a.overall - b.overall);
    return entries.length ? { repos: entries, scannedCount: entries.length } : null;
};

// ── Tiers & weights ───────────────────────────────────────────────────────────

const TIER_THRESHOLDS = [
    { label: 'S', min: 85, color: '#FFD700' },
    { label: 'A', min: 70, color: '#58d68d' },
    { label: 'B', min: 55, color: '#5dade2' },
    { label: 'C', min: 40, color: '#f39c12' },
    { label: 'D', min:  0, color: '#e74c3c' },
];

const tier = (score) => TIER_THRESHOLDS.find(t => score >= t.min);

// Base weights (5 dimensions, no engineering, no codeQuality).
// When optional dimensions are present they each contribute their own weight
// and the base weights are scaled down proportionally so the total stays 1.0.
const BASE_WEIGHTS       = { breadth: 0.17, depth: 0.22, diversity: 0.17, activity: 0.18, impact: 0.13 };
const ENGINEERING_WEIGHT = 0.13;
const CODE_QUALITY_WEIGHT = 0.13;

const computeRating = (repos, workflowMetrics = null, scanData = null) => {
    const engineering  = scoreEngineering(workflowMetrics);
    const codeQuality  = scoreCodeQuality(scanData);
    const hasEng       = engineering  !== null;
    const hasQuality   = codeQuality  !== null;

    const dimensions = {
        breadth:   scoreBreadth(repos),
        depth:     scoreDepth(repos),
        diversity: scoreDiversity(repos),
        activity:  scoreActivity(repos),
        impact:    scoreImpact(repos),
        ...(hasEng     ? { engineering }  : {}),
        ...(hasQuality ? { codeQuality }  : {}),
    };

    // Scale the five base weights down to make room for optional dimensions
    const optionalWeight = (hasEng ? ENGINEERING_WEIGHT : 0) + (hasQuality ? CODE_QUALITY_WEIGHT : 0);
    const baseScale      = 1 - optionalWeight;
    const baseTotal      = Object.values(BASE_WEIGHTS).reduce((a, b) => a + b, 0);

    const overall = Math.round(
        Object.entries(BASE_WEIGHTS).reduce(
            (sum, [k, w]) => sum + dimensions[k] * (w / baseTotal) * baseScale, 0
        ) +
        (hasEng     ? engineering * ENGINEERING_WEIGHT  : 0) +
        (hasQuality ? codeQuality * CODE_QUALITY_WEIGHT : 0)
    );

    return { ...dimensions, overall, tier: tier(overall) };
};

/**
 * Returns per-dimension detail data for generating the insights report.
 *
 * @param {object[]} repos
 * @param {object[]|null} workflowMetrics
 * @param {object|null}   scanData  { repoName: analysisResult }
 */
const computeInsights = (repos, workflowMetrics = null, scanData = null) => ({
    breadth:      breadthDetails(repos),
    depth:        depthDetails(repos),
    diversity:    diversityDetails(repos),
    activity:     activityDetails(repos),
    impact:       impactDetails(repos),
    engineering:  engineeringDetails(workflowMetrics),
    codeQuality:  codeQualityDetails(scanData),
});

export { computeRating, computeInsights };
