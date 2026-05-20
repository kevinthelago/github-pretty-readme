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

const TIER_THRESHOLDS = [
    { label: 'S', min: 85, color: '#FFD700' },
    { label: 'A', min: 70, color: '#58d68d' },
    { label: 'B', min: 55, color: '#5dade2' },
    { label: 'C', min: 40, color: '#f39c12' },
    { label: 'D', min:  0, color: '#e74c3c' },
];

const tier = (score) => TIER_THRESHOLDS.find(t => score >= t.min);

const WEIGHTS = { breadth: 0.20, depth: 0.25, diversity: 0.20, activity: 0.20, impact: 0.15 };

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

/**
 * Returns per-dimension detail data for generating the insights report.
 * Each detail object contains repo-level breakdowns and actionable context.
 */
const computeInsights = (repos) => ({
    breadth:   breadthDetails(repos),
    depth:     depthDetails(repos),
    diversity: diversityDetails(repos),
    activity:  activityDetails(repos),
    impact:    impactDetails(repos),
});

export { computeRating, computeInsights };
