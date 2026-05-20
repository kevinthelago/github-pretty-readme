import { getAllRepos } from '../src/github/repos.js';
import { computeRating, computeInsights } from '../src/github/developer-rating.js';

const ALL_CATEGORIES = ['languages', 'frameworks', 'cloud', 'ai', 'databases', 'devops'];

const fmt = (name, url) => `[\`${name}\`](${url})`;
const bar = (score) => {
    const filled = Math.round(score / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${score}/100`;
};

const renderBreadth = (score, details) => {
    const { languages, coveredCategories, missingCategories } = details;
    const lines = [
        `## Breadth — ${bar(score)}`,
        '',
        `**What it measures:** Range of programming languages and technology categories in use.`,
        '',
        `**Languages detected (${languages.length}):** ${languages.length ? languages.map(l => `\`${l}\``).join(', ') : '_none_'}`,
        '',
        `**Tech categories covered (${coveredCategories.length}/${ALL_CATEGORIES.length}):** ${coveredCategories.length ? coveredCategories.map(c => `\`${c}\``).join(', ') : '_none_'}`,
    ];

    if (missingCategories.length) {
        lines.push('', `**Missing categories:** ${missingCategories.map(c => `\`${c}\``).join(', ')}`);
        lines.push('', '**How to improve:**');
        lines.push(`- Add relevant GitHub topics to your repos (e.g. \`react\`, \`docker\`, \`postgresql\`) to surface missing categories`);
        if (missingCategories.includes('cloud')) lines.push(`- Tag repos that use cloud services with topics like \`aws\`, \`azure\`, or \`gcp\``);
        if (missingCategories.includes('ai'))    lines.push(`- Tag AI/LLM projects with topics like \`openai\`, \`langchain\`, or \`llm\``);
        if (languages.length < 4)                lines.push(`- Experimenting with additional languages will directly raise this score`);
    } else {
        lines.push('', '> Strong coverage across all categories.');
    }

    return lines.join('\n');
};

const renderDepth = (score, details) => {
    const weak = details.filter(r => r.score < 75).slice(0, 10);
    const lines = [
        `## Depth — ${bar(score)}`,
        '',
        `**What it measures:** How well-documented and tagged individual repositories are.`,
        '',
        `**Scoring per repo:** +40 for a description, +35 for at least one topic, +25 for meaningful file size.`,
    ];

    if (weak.length) {
        lines.push('', `**Repositories that need attention (${weak.length} shown):**`);
        lines.push('', '| Repository | Description | Topics | Size |');
        lines.push('|---|:---:|:---:|:---:|');
        weak.forEach(r => {
            lines.push(`| ${fmt(r.name, r.url)} | ${r.hasDescription ? '✓' : '✗'} | ${r.hasTopics ? '✓' : '✗'} | ${r.hasSize ? '✓' : '✗'} |`);
        });

        const noDesc   = weak.filter(r => !r.hasDescription).map(r => r.name);
        const noTopics = weak.filter(r => !r.hasTopics).map(r => r.name);

        lines.push('', '**How to improve:**');
        if (noDesc.length)   lines.push(`- Add descriptions to: ${noDesc.slice(0, 5).map(n => `\`${n}\``).join(', ')}${noDesc.length > 5 ? ` and ${noDesc.length - 5} more` : ''}`);
        if (noTopics.length) lines.push(`- Add GitHub topics to: ${noTopics.slice(0, 5).map(n => `\`${n}\``).join(', ')}${noTopics.length > 5 ? ` and ${noTopics.length - 5} more` : ''}`);
        lines.push(`- A good description is 1–2 sentences explaining what the repo does and the tech used`);
    } else {
        lines.push('', '> All repos are well-documented.');
    }

    return lines.join('\n');
};

const renderDiversity = (score, details) => {
    const lines = [
        `## Diversity — ${bar(score)}`,
        '',
        `**What it measures:** How evenly projects are spread across different domains (Shannon entropy across categories).`,
        '',
    ];

    if (details.length) {
        lines.push('| Category | Repo count |');
        lines.push('|---|---|');
        details.forEach(d => lines.push(`| \`${d.category}\` | ${d.count} |`));

        const dominant = details[0];
        const total    = details.reduce((s, d) => s + d.count, 0);
        const pct      = Math.round((dominant.count / total) * 100);

        lines.push('');
        if (pct > 60) {
            lines.push(`**How to improve:**`);
            lines.push(`- \`${dominant.category}\` accounts for ${pct}% of your activity — branching into other categories will raise this score`);
            lines.push(`- Try adding topics to repos in underrepresented categories, or start a project in a new domain`);
        } else {
            lines.push('> Good spread across categories.');
        }
    } else {
        lines.push('_No category data found. Add GitHub topics to your repos._');
    }

    return lines.join('\n');
};

const renderActivity = (score, details) => {
    const stale   = details.filter(r => r.bucket === 'over a year ago');
    const active  = details.filter(r => r.bucket === 'last 30 days');
    const lines = [
        `## Activity — ${bar(score)}`,
        '',
        `**What it measures:** Recency and consistency of pushes across all repos.`,
        '',
        `| Window | Repos |`,
        `|---|---|`,
        `| Last 30 days | ${details.filter(r => r.bucket === 'last 30 days').length} |`,
        `| Last 90 days | ${details.filter(r => r.bucket === 'last 90 days').length} |`,
        `| Last year    | ${details.filter(r => r.bucket === 'last year').length} |`,
        `| Over a year  | ${stale.length} |`,
    ];

    if (stale.length > 0) {
        lines.push('', `**Stale repositories (${stale.length}):** ${stale.slice(0, 8).map(r => fmt(r.name, r.url)).join(', ')}${stale.length > 8 ? ` and ${stale.length - 8} more` : ''}`);
    }

    lines.push('', '**How to improve:**');
    if (active.length === 0) lines.push(`- No repos pushed in the last 30 days — consistent activity is the fastest way to raise this score`);
    if (stale.length > 5)    lines.push(`- Consider archiving truly abandoned repos to improve the signal-to-noise ratio`);
    lines.push(`- Even small improvements (README updates, dependency bumps) count as activity`);

    return lines.join('\n');
};

const renderImpact = (score, details) => {
    const top   = details.slice(0, 5);
    const total = { stars: details.reduce((s, r) => s + r.stars, 0), forks: details.reduce((s, r) => s + r.forks, 0) };
    const lines = [
        `## Impact — ${bar(score)}`,
        '',
        `**What it measures:** Community reception via stars and forks (log-scaled).`,
        '',
        `**Total:** ${total.stars} stars · ${total.forks} forks`,
        '',
    ];

    if (top.length) {
        lines.push('**Top repositories by impact:**');
        lines.push('', '| Repository | Stars | Forks |');
        lines.push('|---|---|---|');
        top.forEach(r => lines.push(`| ${fmt(r.name, r.url)} | ${r.stars} | ${r.forks} |`));
    }

    lines.push('', '**How to improve:**');
    lines.push(`- Add a polished README with screenshots or demos to your most interesting repos`);
    lines.push(`- Pin your strongest repos on your profile so they're immediately visible`);
    lines.push(`- Share projects on relevant communities (dev.to, Hacker News, Reddit r/programming)`);
    if (total.stars < 10) lines.push(`- Consider open-sourcing private projects that others might find useful`);

    return lines.join('\n');
};

export default async (req, res) => {
    res.setHeader('Content-Type', 'text/markdown');

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const rating   = computeRating(repos);
        const insights = computeInsights(repos);
        const date     = new Date().toISOString().slice(0, 10);

        const md = [
            `# Developer Score Insights`,
            `_Generated ${date} · ${repos.length} repositories analysed_`,
            '',
            `## Overall Score: ${rating.overall}/100 — Tier ${rating.tier.label}`,
            '',
            `| Dimension | Score | Weight |`,
            `|---|---|---|`,
            `| Breadth   | ${rating.breadth}/100   | 20% |`,
            `| Depth     | ${rating.depth}/100     | 25% |`,
            `| Diversity | ${rating.diversity}/100 | 20% |`,
            `| Activity  | ${rating.activity}/100  | 20% |`,
            `| Impact    | ${rating.impact}/100    | 15% |`,
            '',
            '---',
            '',
            renderBreadth(rating.breadth, insights.breadth),
            '',
            '---',
            '',
            renderDepth(rating.depth, insights.depth),
            '',
            '---',
            '',
            renderDiversity(rating.diversity, insights.diversity),
            '',
            '---',
            '',
            renderActivity(rating.activity, insights.activity),
            '',
            '---',
            '',
            renderImpact(rating.impact, insights.impact),
        ].join('\n');

        return res.send(md);
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
