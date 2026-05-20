import { TAXONOMY } from '../data/tech-taxonomy.js';

const ALL_CATEGORIES = ['languages', 'frameworks', 'cloud', 'ai', 'databases', 'devops'];

const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));

/**
 * Scores how many distinct languages and tech categories the developer uses.
 * More variety = higher score.
 */
const scoreBreadth = (repos) => {
    const languages = new Set(repos.map(r => r.language).filter(Boolean));

    const topicCategories = new Set();
    repos.forEach(repo => {
        (repo.topics || []).forEach(t => {
            const entry = TAXONOMY[t];
            if (entry) topicCategories.add(entry.category);
        });
    });

    const langScore  = clamp(languages.size * 12);          // 9 langs → ~100
    const catScore   = clamp((topicCategories.size / ALL_CATEGORIES.length) * 100);
    return Math.round((langScore * 0.6) + (catScore * 0.4));
};

/**
 * Scores repo quality signals: description, topics, and meaningful size.
 * Rewards repos that are documented and tagged.
 */
const scoreDepth = (repos) => {
    if (repos.length === 0) return 0;
    const repoScores = repos.map(repo => {
        let s = 0;
        if (repo.description && repo.description.trim().length > 10) s += 40;
        if (repo.topics && repo.topics.length > 0)                   s += 35;
        if (repo.size > 50)                                           s += 25;
        return s;
    });
    const avg = repoScores.reduce((a, b) => a + b, 0) / repoScores.length;
    return Math.round(avg);
};

/**
 * Scores how evenly projects are spread across domains. Penalises repos
 * that all cluster in one category.
 */
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

    // Shannon entropy, normalized to 0-100
    const total = counts.reduce((a, b) => a + b, 0);
    const entropy = -counts.reduce((sum, c) => {
        const p = c / total;
        return sum + p * Math.log2(p);
    }, 0);
    const maxEntropy = Math.log2(ALL_CATEGORIES.length);
    return Math.round((entropy / maxEntropy) * 100);
};

/**
 * Scores recency: how recently and consistently the developer has been active.
 */
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

    // Normalize: 10+ active repos = ~100
    return clamp(Math.round((recentCount / (repos.length * 3)) * 140));
};

/**
 * Scores community impact via stars and forks, log-scaled so one popular
 * repo doesn't completely dominate.
 */
const scoreImpact = (repos) => {
    const stars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const forks = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
    const raw = stars + forks * 2;
    // log10(1001) ≈ 3  → score 75; log10(10001) ≈ 4 → 100
    return clamp(Math.round(Math.log10(raw + 1) * 25));
};

const TIER_THRESHOLDS = [
    { label: 'S', min: 85, color: '#FFD700' },
    { label: 'A', min: 70, color: '#58d68d' },
    { label: 'B', min: 55, color: '#5dade2' },
    { label: 'C', min: 40, color: '#f39c12' },
    { label: 'D', min:  0, color: '#e74c3c' },
];

const tier = (score) => TIER_THRESHOLDS.find(t => score >= t.min);

const WEIGHTS = { breadth: 0.20, depth: 0.25, diversity: 0.20, activity: 0.20, impact: 0.15 };

/**
 * Computes the full developer rating from an array of GitHub repo objects.
 *
 * @param {object[]} repos
 * @returns {{ breadth, depth, diversity, activity, impact, overall, tier }}
 */
const computeRating = (repos) => {
    const dimensions = {
        breadth:   scoreBreadth(repos),
        depth:     scoreDepth(repos),
        diversity: scoreDiversity(repos),
        activity:  scoreActivity(repos),
        impact:    scoreImpact(repos),
    };

    const overall = Math.round(
        Object.entries(WEIGHTS).reduce((sum, [key, w]) => sum + dimensions[key] * w, 0)
    );

    return { ...dimensions, overall, tier: tier(overall) };
};

export { computeRating };
