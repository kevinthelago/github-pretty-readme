import { getAllRepos } from '../src/github/repos.js';
import { computeRating, computeInsights } from '../src/github/developer-rating.js';
import { fetchWorkflowMetrics } from '../src/github/workflow-metrics.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveAuth } from './_shared.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

const COMMUNITY_MAP = {
    JavaScript: ['r/javascript', 'r/webdev', 'dev.to'],
    TypeScript: ['r/typescript', 'r/webdev', 'dev.to'],
    Python:     ['r/Python', 'r/learnpython', 'dev.to'],
    Rust:       ['r/rust', 'users.rust-lang.org'],
    Go:         ['r/golang', 'Gophers Slack'],
    Java:       ['r/java', 'dev.to'],
    Kotlin:     ['r/Kotlin', 'r/androiddev'],
    Swift:      ['r/swift', 'r/iOSProgramming'],
    'C#':       ['r/csharp', 'r/dotnet'],
    Ruby:       ['r/ruby', 'r/rails'],
    PHP:        ['r/PHP', 'r/laravel'],
    Dart:       ['r/FlutterDev'],
};

const renderImpact = (score, details) => {
    const top   = details.slice(0, 5);
    const total = { stars: details.reduce((s, r) => s + r.stars, 0), forks: details.reduce((s, r) => s + r.forks, 0) };

    const hiddenGems  = details.filter(r => r.stars === 0 && r.forks === 0).slice(0, 4);
    const forkedNotStarred = details.filter(r => r.forks > 0 && r.stars === 0).slice(0, 3);

    const lines = [
        `## Impact — ${bar(score)}`,
        '',
        `**What it measures:** Community reception via stars and forks (log-scaled).`,
        '',
        `**Total:** ${total.stars} ★ · ${total.forks} forks across ${details.length} repos`,
        '',
    ];

    if (top.length) {
        lines.push('**Top repositories by impact:**', '', '| Repository | Stars | Forks |', '|---|---|---|');
        top.forEach(r => lines.push(`| ${fmt(r.name, r.url)} | ${r.stars} ★ | ${r.forks} |`));
    }

    if (forkedNotStarred.length) {
        lines.push('', `**Forked but not starred — promote these:** ${forkedNotStarred.map(r => fmt(r.name, r.url)).join(', ')}`);
        lines.push('_People found these useful enough to fork. A proper README and a share post could convert forks into stars._');
    }

    if (hiddenGems.length) {
        lines.push('', `**Zero-traction repos worth showcasing:** ${hiddenGems.map(r => fmt(r.name, r.url)).join(', ')}`);
        lines.push('_These have no stars or forks yet. If any solve a real problem, they are candidates for promotion._');
    }

    lines.push('', '**How to improve:**', '');

    lines.push('_README quality (biggest single lever):_');
    lines.push('- Add a one-line description and a screenshot or GIF at the top of each key repo');
    lines.push('- Include a **Quick Start** section — repos with copy-paste setup instructions get more stars');
    lines.push('- Add relevant GitHub topics so the repo appears in GitHub Explore searches');
    lines.push('- Enable **GitHub Pages** for frontend or documentation projects to provide a live demo link');

    lines.push('');
    lines.push('_Discoverability:_');
    lines.push('- Pin your top 6 repos on your profile page (GitHub → Edit profile → Customize pins)');
    lines.push('- Create a GitHub Release for stable projects — versioned releases signal project maturity');
    lines.push('- Make sure each repo has a license — repos without one are less likely to be forked');

    lines.push('');
    lines.push('_Community sharing:_');
    if (top.length) lines.push(`- Write a short post about \`${top[0].name}\` explaining the problem it solves and link to it`);
    lines.push('- Share projects on relevant communities: Hacker News (Show HN), dev.to, and the subreddits for your stack');
    if (total.stars < 5) lines.push('- Ask peers or colleagues to star repos they find genuinely useful — early social proof compounds');

    lines.push('');
    lines.push('_Open source leverage:_');
    lines.push('- Contributing even small fixes (docs, bugs) to popular repos in your stack gets your name on high-traffic projects');
    lines.push('- If any private projects solve general problems, open-sourcing them is the fastest path to impact');

    return lines.join('\n');
};

const renderEngineering = (score, details) => {
    if (!details) return null;
    const { ciCount, deploymentCount, issueCount, prCount, total } = details;
    const pct = (n) => `${Math.round((n / total) * 100)}%`;
    const lines = [
        `## Engineering — ${bar(score)}`,
        '',
        `**What it measures:** CI adoption, deployment automation, issue management, and PR culture across your ${total} most recently active non-fork repos.`,
        '',
        '| Signal | Repos | Share | Weight |',
        '|---|---|---|---|',
        `| CI / check-runs     | ${ciCount}         | ${pct(ciCount)}         | 40% |`,
        `| Deployments         | ${deploymentCount} | ${pct(deploymentCount)} | 25% |`,
        `| Closed issues       | ${issueCount}      | ${pct(issueCount)}      | 20% |`,
        `| Pull requests       | ${prCount}         | ${pct(prCount)}         | 15% |`,
    ];

    const missing = [];
    if (ciCount < Math.ceil(total * 0.5))         missing.push('CI workflows (GitHub Actions, CircleCI, etc.) — the highest-weighted signal at 40%');
    if (deploymentCount < Math.ceil(total * 0.3)) missing.push('deployment automation via GitHub Deployments, Vercel, Heroku, or Fly.io');
    if (issueCount < Math.ceil(total * 0.3))      missing.push('issue tracking — open and close issues to demonstrate active project management');
    if (prCount < Math.ceil(total * 0.3))         missing.push('pull requests — even solo projects benefit from PR-based review workflows');

    if (missing.length) {
        lines.push('', '**How to improve:**');
        missing.forEach(m => lines.push(`- Add ${m}`));
    } else {
        lines.push('', '> Strong engineering practices across all sampled repos.');
    }

    return lines.join('\n');
};

const generateRecommendations = async (repos, rating, insights) => {
    const { languages, coveredCategories, missingCategories } = insights.breadth;
    const topImpact = insights.impact.slice(0, 5).map(r => `${r.name} (${r.stars}★)`).join(', ') || 'none';
    const langFreq  = {};
    repos.forEach(r => { if (r.language) langFreq[r.language] = (langFreq[r.language] || 0) + 1; });
    const topLangs  = Object.entries(langFreq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l, n]) => `${l} (${n} repos)`).join(', ');
    const allTopics = [...new Set(repos.flatMap(r => r.topics ?? []))].slice(0, 30).join(', ') || 'none';
    const engLine   = rating.engineering != null
        ? `- Engineering ${rating.engineering}/100 (CI: ${insights.engineering?.ciCount ?? 0}/${insights.engineering?.total ?? 0} repos, deployments: ${insights.engineering?.deploymentCount ?? 0}/${insights.engineering?.total ?? 0})`
        : '';

    const prompt = `You are a senior software engineer reviewing a developer's GitHub profile and giving specific, actionable growth advice.

Developer profile:
- Overall score: ${rating.overall}/100 (${rating.tier.label} tier)
- Breadth ${rating.breadth}/100 · Depth ${rating.depth}/100 · Diversity ${rating.diversity}/100 · Activity ${rating.activity}/100 · Impact ${rating.impact}/100${engLine ? '\n' + engLine : ''}
- Languages by repo count: ${topLangs || 'none detected'}
- Topics used across repos: ${allTopics}
- Tech categories covered: ${coveredCategories.join(', ') || 'none'}
- Missing categories: ${missingCategories.join(', ') || 'none'}
- Top repos by impact: ${topImpact}
- Total repos: ${repos.length}

Provide the following three sections as GitHub-flavored markdown. Be specific to their actual detected stack — use real library and framework names, not generic category names. Do not repeat the score breakdown already shown above.

## Technologies to Explore

List 4–6 specific technologies this developer should learn next. For each one, write 1–2 sentences explaining why it complements their existing stack and what problem it solves for them specifically. Ground every recommendation in what you can see in their topics and languages.

## Project Ideas

Suggest 3 concrete project ideas that would stretch their skills. For each idea:
- Give it a short name
- List the specific tech stack (use their existing languages where possible, add one new technology)
- Write 2–3 sentences on what it demonstrates and why it would strengthen their portfolio

## Growth Direction

Write one focused paragraph on the single most impactful area this developer should invest in over the next 3–6 months. Base it on the weakest dimension score and the most visible gap in their stack. Be direct and specific.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch {
        return '';
    }
};

export default async (req, res) => {
    res.setHeader('Content-Type', 'text/markdown');

    try {
        const { token } = resolveAuth(req, { allowEnv: true });
        const repos = await getAllRepos(token);
        if (!repos) return res.status(401).send('GitHub not connected');

        const [wfResult] = await Promise.allSettled([fetchWorkflowMetrics(token, repos)]);
        const metrics  = wfResult.status === 'fulfilled' ? wfResult.value : null;

        const rating   = computeRating(repos, metrics);
        const insights = computeInsights(repos, metrics);
        const date     = new Date().toISOString().slice(0, 10);

        const recommendations = await generateRecommendations(repos, rating, insights);

        const hasEng = rating.engineering != null;
        const weightTable = [
            `| Dimension   | Score | Weight |`,
            `|---|---|---|`,
            `| Breadth     | ${rating.breadth}/100   | ${hasEng ? '17%' : '20%'} |`,
            `| Depth       | ${rating.depth}/100     | ${hasEng ? '22%' : '25%'} |`,
            `| Diversity   | ${rating.diversity}/100 | ${hasEng ? '17%' : '20%'} |`,
            `| Activity    | ${rating.activity}/100  | ${hasEng ? '18%' : '21%'} |`,
            `| Impact      | ${rating.impact}/100    | ${hasEng ? '13%' : '14%'} |`,
            ...(hasEng ? [`| Engineering | ${rating.engineering}/100 | 13% |`] : []),
        ].join('\n');

        const parts = [
            `# Developer Score Insights`,
            `_Generated ${date} · ${repos.length} repositories analysed_`,
            '',
            `## Overall Score: ${rating.overall}/100 — Tier ${rating.tier.label}`,
            '',
            weightTable,
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
        ];

        if (hasEng) {
            const engMd = renderEngineering(rating.engineering, insights.engineering);
            if (engMd) parts.push('', '---', '', engMd);
        }

        if (recommendations) parts.push('', '---', '', recommendations);

        return res.send(parts.join('\n'));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
