import { getAllRepos }                      from '../src/github/repos.js';
import { computeRating, computeInsights }   from '../src/github/developer-rating.js';
import { fetchWorkflowMetrics }             from '../src/github/workflow-metrics.js';
import { renderDeveloperRating }            from '../src/tiles/developer-rating.js';
import { buildTechSeries, lookupIcon }      from '../src/github/tech-data.js';
import { renderTechGrid }                   from '../src/tiles/tech-grid.js';
import { renderMonkeytypeChart }            from '../src/tiles/monkeytype-chart.js';
import { GoogleGenerativeAI }              from '@google/generative-ai';
import { previewCache }                    from '../src/preview-cache.js';
import { scanCache }                      from '../src/scan-cache.js';
import { sendJsonError, boolParam }       from './_shared.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const ALL_CATEGORIES    = ['languages', 'frameworks', 'cloud', 'ai', 'databases', 'devops'];
const MIN_TECHS         = 3;
const TIME_MODES        = ['15', '30', '60', '120'];
const CELL_W            = 400;

// ── GitHub helpers ────────────────────────────────────────────────────────────

const ghHeaders = (token) => ({
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
});

const getFile = async (token, repo, path) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers: ghHeaders(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
};

const putFile = async (token, repo, path, content, sha, message) => {
    const body = { message, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) };
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 403) {
            throw new Error(
                `PUT ${path} → 403: GitHub denied write access. ` +
                `If you registered a GitHub App (not a classic OAuth App), it must be installed on your profile repo and have Contents: Read & write permission. ` +
                `Otherwise, try logging out and reconnecting.`
            );
        }
        throw new Error(`PUT ${path} → ${res.status}: ${text}`);
    }
};

const pushAsset = async (token, repo, filePath, content) => {
    const existing = await getFile(token, repo, filePath);
    await putFile(token, repo, filePath, content, existing?.sha, `chore: update ${filePath}`);
};

// ── Marker helpers ────────────────────────────────────────────────────────────

const inject = (content, start, end, section) => {
    const si = content.indexOf(start);
    const ei = content.indexOf(end);
    if (si === -1 || ei === -1) return content;
    return content.slice(0, si + start.length) + section + content.slice(ei);
};

const ensureMarkers = (content, sections) => {
    let out = content;
    for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        if (s.optional && !s.enabled?.()) continue;
        if (out.includes(s.start)) continue;
        const block = `${s.start}${s.end}\n`;
        const next  = sections.slice(i + 1).map(x => x.start).find(m => out.includes(m));
        if (next) {
            const idx = out.indexOf(next);
            out = out.slice(0, idx) + block + '\n' + out.slice(idx);
        } else {
            out += '\n' + block;
        }
    }
    return out;
};

// ── Badge builder ─────────────────────────────────────────────────────────────

const luminance = (hex) => {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const buildBadge = (username, { language, slug, hex }) => {
    const label     = encodeURIComponent(language);
    const searchUrl = `https://github.com/search?q=user%3A${username}+language%3A${encodeURIComponent(language)}&type=repositories`;
    if (slug && hex) {
        const logoColor = luminance(hex) > 0.6 ? 'black' : 'white';
        return `[![${language}](https://img.shields.io/badge/${label}-${hex}?style=flat&logo=${slug}&logoColor=${logoColor})](${searchUrl})`;
    }
    return `[![${language}](https://img.shields.io/badge/${label}-555555?style=flat)](${searchUrl})`;
};

// ── Insights markdown ─────────────────────────────────────────────────────────

const bar = (score) => '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10)) + ` ${score}/100`;
const fmt = (name, url) => `[\`${name}\`](${url})`;
const ALL_CAT_KEYS = ALL_CATEGORIES;

const generateRecommendations = async (repos, rating, insights) => {
    const { languages, coveredCategories, missingCategories } = insights.breadth;
    const topImpact = insights.impact.slice(0, 5).map(r => `${r.name} (${r.stars}★)`).join(', ') || 'none';
    const langFreq  = {};
    repos.forEach(r => { if (r.language) langFreq[r.language] = (langFreq[r.language] || 0) + 1; });
    const topLangs  = Object.entries(langFreq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l, n]) => `${l} (${n} repos)`).join(', ');
    const allTopics = [...new Set(repos.flatMap(r => r.topics ?? []))].slice(0, 30).join(', ') || 'none';
    const engLine   = rating.engineering != null
        ? `\n- Engineering ${rating.engineering}/100 (CI: ${insights.engineering?.ciCount ?? 0}/${insights.engineering?.total ?? 0} repos, deployments: ${insights.engineering?.deploymentCount ?? 0}/${insights.engineering?.total ?? 0})`
        : '';
    const cqLine    = rating.codeQuality != null
        ? `\n- Code Quality ${rating.codeQuality}/100 (average across ${insights.codeQuality?.scannedCount ?? 0} scanned repo(s))`
        : '';

    const prompt = `You are a senior software engineer reviewing a developer's GitHub profile and giving specific, actionable growth advice.

Developer profile:
- Overall score: ${rating.overall}/100 (${rating.tier.label} tier)
- Breadth ${rating.breadth}/100 · Depth ${rating.depth}/100 · Diversity ${rating.diversity}/100 · Activity ${rating.activity}/100 · Impact ${rating.impact}/100${engLine}${cqLine}
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

const renderCodeQuality = (score, details) => {
    if (!details) return null;
    const { repos: scanRepos, scannedCount } = details;
    const lines = [
        `## Code Quality — ${bar(score)}`,
        '',
        `**What it measures:** Average code quality across ${scannedCount} scanned repo(s), graded on testing, documentation, tooling, CI/CD, security, and structure.`,
        '',
        '| Repository | Score | Grade | Testing | Docs | Tooling | CI | Security | Structure |',
        '|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|',
        ...scanRepos.map(r =>
            `| \`${r.repo}\` | ${r.overall}/100 | **${r.grade}** | ${r.testing ?? '—'} | ${r.documentation ?? '—'} | ${r.tooling ?? '—'} | ${r.ci ?? '—'} | ${r.security ?? '—'} | ${r.structure ?? '—'} |`
        ),
    ];
    const weak = scanRepos.filter(r => r.overall < 60);
    if (weak.length) {
        lines.push('', '**How to improve:**');
        weak.forEach(r => {
            const dims = [
                ['testing', r.testing], ['documentation', r.documentation], ['tooling', r.tooling],
                ['CI/CD', r.ci], ['security', r.security], ['structure', r.structure],
            ].filter(([, s]) => s !== null && s < 60).sort(([, a], [, b]) => a - b).slice(0, 2);
            if (dims.length) lines.push(`- \`${r.repo}\`: weakest in ${dims.map(([k]) => k).join(' and ')} — see \`SCORE.md\` in that repo for details`);
        });
    } else {
        lines.push('', '> Strong code quality across all scanned repositories.');
    }
    return lines.join('\n');
};

const renderInsights = (rating, insights, repos, recommendations = '') => {
    const date = new Date().toISOString().slice(0, 10);
    const { breadth, depth, diversity, activity, impact, engineering, codeQuality } = insights;

    const breadthMd = (() => {
        const { languages, coveredCategories, missingCategories } = breadth;
        const lines = [
            `## Breadth — ${bar(rating.breadth)}`, '',
            `**Languages detected (${languages.length}):** ${languages.length ? languages.map(l => `\`${l}\``).join(', ') : '_none_'}`, '',
            `**Tech categories covered (${coveredCategories.length}/${ALL_CAT_KEYS.length}):** ${coveredCategories.length ? coveredCategories.map(c => `\`${c}\``).join(', ') : '_none_'}`,
        ];
        if (missingCategories.length) {
            lines.push('', `**Missing categories:** ${missingCategories.map(c => `\`${c}\``).join(', ')}`);
            lines.push('', '**How to improve:**');
            lines.push(`- Add relevant GitHub topics to your repos to surface missing categories`);
            if (missingCategories.includes('cloud')) lines.push(`- Tag repos that use cloud services with topics like \`aws\`, \`azure\`, or \`gcp\``);
            if (missingCategories.includes('ai'))    lines.push(`- Tag AI/LLM projects with topics like \`openai\`, \`langchain\`, or \`llm\``);
        } else {
            lines.push('', '> Strong coverage across all categories.');
        }
        return lines.join('\n');
    })();

    const depthMd = (() => {
        const weak = depth.filter(r => r.score < 75).slice(0, 10);
        const lines = [`## Depth — ${bar(rating.depth)}`, '', `**Scoring per repo:** +40 for a description, +35 for at least one topic, +25 for meaningful file size.`];
        if (weak.length) {
            lines.push('', `**Repositories that need attention (${weak.length} shown):**`);
            lines.push('', '| Repository | Description | Topics | Size |', '|---|:---:|:---:|:---:|');
            weak.forEach(r => lines.push(`| ${fmt(r.name, r.url)} | ${r.hasDescription ? '✓' : '✗'} | ${r.hasTopics ? '✓' : '✗'} | ${r.hasSize ? '✓' : '✗'} |`));
            const noDesc   = weak.filter(r => !r.hasDescription).map(r => r.name);
            const noTopics = weak.filter(r => !r.hasTopics).map(r => r.name);
            lines.push('', '**How to improve:**');
            if (noDesc.length)   lines.push(`- Add descriptions to: ${noDesc.slice(0, 5).map(n => `\`${n}\``).join(', ')}`);
            if (noTopics.length) lines.push(`- Add GitHub topics to: ${noTopics.slice(0, 5).map(n => `\`${n}\``).join(', ')}`);
        } else {
            lines.push('', '> All repos are well-documented.');
        }
        return lines.join('\n');
    })();

    const diversityMd = (() => {
        const lines = [`## Diversity — ${bar(rating.diversity)}`, ''];
        if (diversity.length) {
            lines.push('| Category | Repo count |', '|---|---|');
            diversity.forEach(d => lines.push(`| \`${d.category}\` | ${d.count} |`));
            const dom = diversity[0];
            const total = diversity.reduce((s, d) => s + d.count, 0);
            const pct = Math.round((dom.count / total) * 100);
            lines.push('');
            if (pct > 60) {
                lines.push('**How to improve:**');
                lines.push(`- \`${dom.category}\` accounts for ${pct}% of activity — branching into other categories will raise this score`);
            } else {
                lines.push('> Good spread across categories.');
            }
        } else {
            lines.push('_No category data found. Add GitHub topics to your repos._');
        }
        return lines.join('\n');
    })();

    const activityMd = (() => {
        const stale  = activity.filter(r => r.bucket === 'over a year ago');
        const active = activity.filter(r => r.bucket === 'last 30 days');
        const lines  = [
            `## Activity — ${bar(rating.activity)}`, '',
            '| Window | Repos |', '|---|---|',
            `| Last 30 days | ${active.length} |`,
            `| Last 90 days | ${activity.filter(r => r.bucket === 'last 90 days').length} |`,
            `| Last year    | ${activity.filter(r => r.bucket === 'last year').length} |`,
            `| Over a year  | ${stale.length} |`,
        ];
        if (stale.length) lines.push('', `**Stale repositories (${stale.length}):** ${stale.slice(0, 8).map(r => fmt(r.name, r.url)).join(', ')}`);
        lines.push('', '**How to improve:**');
        if (!active.length) lines.push('- No repos pushed in the last 30 days — consistent activity raises this score fastest');
        if (stale.length > 5) lines.push('- Consider archiving truly abandoned repos');
        return lines.join('\n');
    })();

    const impactMd = (() => {
        const top   = impact.slice(0, 5);
        const total = { stars: impact.reduce((s, r) => s + r.stars, 0), forks: impact.reduce((s, r) => s + r.forks, 0) };
        const hiddenGems       = impact.filter(r => r.stars === 0 && r.forks === 0).slice(0, 4);
        const forkedNotStarred = impact.filter(r => r.forks > 0 && r.stars === 0).slice(0, 3);

        const lines = [
            `## Impact — ${bar(rating.impact)}`, '',
            `**What it measures:** Community reception via stars and forks (log-scaled).`, '',
            `**Total:** ${total.stars} ★ · ${total.forks} forks across ${impact.length} repos`, '',
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
        lines.push('- Share projects on Hacker News (Show HN), dev.to, and the subreddits for your stack');
        if (total.stars < 5) lines.push('- Ask peers or colleagues to star repos they find genuinely useful — early social proof compounds');

        lines.push('');
        lines.push('_Open source leverage:_');
        lines.push('- Contributing even small fixes (docs, bugs) to popular repos in your stack gets your name on high-traffic projects');
        lines.push('- If any private projects solve general problems, open-sourcing them is the fastest path to impact');

        return lines.join('\n');
    })();

    const hasEng     = rating.engineering  != null;
    const hasQuality = rating.codeQuality  != null;

    // Compute actual effective weights (mirrors computeRating logic)
    const BASE_W    = { breadth: 0.17, depth: 0.22, diversity: 0.17, activity: 0.18, impact: 0.13 };
    const ENG_W     = 0.13, CQ_W = 0.13;
    const optW      = (hasEng ? ENG_W : 0) + (hasQuality ? CQ_W : 0);
    const baseScale = 1 - optW;
    const baseTotal = Object.values(BASE_W).reduce((a, b) => a + b, 0);
    const wpct      = (w) => `${Math.round((w / baseTotal) * baseScale * 100)}%`;

    const weightTable = [
        '| Dimension    | Score | Weight |', '|---|---|---|',
        `| Breadth      | ${rating.breadth}/100      | ${wpct(BASE_W.breadth)} |`,
        `| Depth        | ${rating.depth}/100        | ${wpct(BASE_W.depth)} |`,
        `| Diversity    | ${rating.diversity}/100    | ${wpct(BASE_W.diversity)} |`,
        `| Activity     | ${rating.activity}/100     | ${wpct(BASE_W.activity)} |`,
        `| Impact       | ${rating.impact}/100       | ${wpct(BASE_W.impact)} |`,
        ...(hasEng     ? [`| Engineering  | ${rating.engineering}/100  | ${Math.round(ENG_W * 100)}% |`]  : []),
        ...(hasQuality ? [`| Code Quality | ${rating.codeQuality}/100  | ${Math.round(CQ_W  * 100)}% |`] : []),
    ].join('\n');

    const parts = [
        `# Developer Score Insights`,
        `_Generated ${date} · ${repos.length} repositories analysed_`, '',
        `## Overall Score: ${rating.overall}/100 — Tier ${rating.tier.label}`, '',
        weightTable, '', '---', '',
        breadthMd, '', '---', '', depthMd, '', '---', '', diversityMd, '', '---', '', activityMd, '', '---', '', impactMd,
    ];

    if (hasEng) {
        const engMd = renderEngineering(rating.engineering, engineering);
        if (engMd) parts.push('', '---', '', engMd);
    }

    if (hasQuality) {
        const cqMd = renderCodeQuality(rating.codeQuality, codeQuality);
        if (cqMd) parts.push('', '---', '', cqMd);
    }

    if (recommendations) parts.push('', '---', '', recommendations);
    return parts.join('\n');
};

// ── Core profile generator ────────────────────────────────────────────────────

export async function generateProfile(token, username, monkeyOptions = {}, onProgress = null) {
    const steps = [];
    const emit  = (pct, msg) => { onProgress?.({ pct, msg }); };
    const log   = (msg) => { steps.push(msg); console.log(`[apply-readme] ${msg}`); };

    emit(5,  'Fetching repositories…');
    log('Fetching repositories…');
    const repos = await getAllRepos(token);
    if (!repos) throw new Error('Failed to fetch repositories — check token scope');

    emit(12, 'Fetching workflow metrics…');
    log('Fetching workflow metrics…');
    const [wfResult] = await Promise.allSettled([fetchWorkflowMetrics(token, repos)]);
    const metrics    = wfResult.status === 'fulfilled' ? wfResult.value : null;

    emit(22, 'Generating bio…');
    log('Generating bio…');
    const bioPrompt =
        `Write a 2-3 sentence developer bio for a GitHub profile README based on the following repositories. ` +
        `Be specific about the technologies and domains you see. Use plain prose — no markdown, no bullet points, no headers. ` +
        `Write in third person.\n\nRepositories:\n${JSON.stringify(repos.map(r => ({ name: r.name, description: r.description, language: r.language, topics: r.topics })), null, 2)}`;
    const bioResult = await model.generateContent(bioPrompt);
    const bio       = bioResult.response.text().trim();

    emit(38, 'Computing developer rating…');
    log('Computing developer rating…');
    const scanData  = scanCache.getAll(username);
    const hasScanData = Object.keys(scanData).length > 0;
    if (hasScanData) log(`Using code quality data from ${Object.keys(scanData).length} scanned repo(s)…`);
    const rating    = computeRating(repos, metrics, hasScanData ? scanData : null);
    const insights  = computeInsights(repos, metrics, hasScanData ? scanData : null);
    const ratingSvg = renderDeveloperRating(rating);

    emit(48, 'Building tech grid…');
    log('Building tech grid…');
    const series    = buildTechSeries(repos, ALL_CATEGORIES, 8, []);
    const chartable = series.filter(s => s.techs.length >= MIN_TECHS);
    let techGridSvg = null, gridCols = 0, gridRows = 0;
    if (chartable.length > 0) {
        gridCols    = chartable.length <= 3 ? chartable.length : Math.ceil(Math.sqrt(chartable.length));
        gridRows    = Math.ceil(chartable.length / gridCols);
        techGridSvg = renderTechGrid(chartable, null, { columns: gridCols });
    }

    emit(54, 'Building badges…');
    log('Building badges…');
    const langFreq = {};
    repos.forEach(r => { if (r.language) langFreq[r.language] = (langFreq[r.language] || 0) + 1; });
    const techList = Object.entries(langFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([language, count]) => {
            const icon = lookupIcon(language);
            return { language, count, slug: icon?.slug ?? null, hex: icon?.hex ?? null };
        });
    const badges = techList.map(t => buildBadge(username, t)).join(' ');

    let monkeytypeSvg = null;
    if (monkeyOptions.apiKey) {
        emit(60, 'Fetching Monkeytype stats…');
        log('Fetching Monkeytype stats…');
        try {
            const mtRes = await fetch('https://api.monkeytype.com/users/personalBests?mode=time', {
                headers: { Authorization: `ApeKey ${monkeyOptions.apiKey}` },
            });
            if (mtRes.ok) {
                const { data } = await mtRes.json();
                const isStd = r => r.language === 'english' && r.difficulty === 'normal' && !r.punctuation && !r.numbers && !r.lazyMode;
                const modes = TIME_MODES.map(d => {
                    const entries = (data[d] ?? []).filter(isStd);
                    if (!entries.length) return null;
                    const best = entries.reduce((a, b) => a.wpm > b.wpm ? a : b);
                    return { duration: d, wpm: Math.round(best.wpm), acc: best.acc, consistency: best.consistency };
                }).filter(Boolean);
                if (modes.length) monkeytypeSvg = renderMonkeytypeChart(modes);
            }
        } catch (err) {
            log(`Monkeytype fetch failed: ${err.message} (skipping)`);
        }
    }

    emit(68, 'Generating recommendations…');
    log('Generating personalised recommendations…');
    const recommendations = await generateRecommendations(repos, rating, insights);

    emit(78, 'Rendering insights…');
    log('Rendering developer insights…');
    const insightsMd = renderInsights(rating, insights, repos, recommendations);

    return { bio, ratingSvg, techGridSvg, gridCols, gridRows, badges, monkeytypeSvg, insightsMd, steps };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export default async (req, res) => {
    // Session-based auth (web UI)
    let token    = req.session?.github_token;
    let username = req.session?.github_username;

    // PAT-based auth (scheduled GitHub Actions workflow)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.slice(7);
        try {
            const userRes = await fetch('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
            });
            if (!userRes.ok) return sendJsonError(res, 401, 'invalid_token', 'Invalid token');
            username = (await userRes.json()).login;
        } catch {
            return sendJsonError(res, 401, 'invalid_token', 'Failed to verify token');
        }
    }

    if (!token || !username) return sendJsonError(res, 401, 'unauthenticated', 'Not authenticated');

    const dryRun = boolParam(req.query.dry_run);
    const isSSE  = req.headers.accept?.includes('text/event-stream');

    if (isSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
    }
    const send = isSSE ? (data) => res.write(`data: ${JSON.stringify(data)}\n\n`) : null;

    try {
        const monkeyOptions = {
            apiKey:   req.session?.monkeytype_key ?? process.env.MONKEYTYPE_API_KEY ?? null,
            username: req.session?.monkeytype_username ?? process.env.MONKEYTYPE_USERNAME ?? null,
        };

        const onProgress = send ? ({ pct, msg }) => send({ type: 'progress', pct, msg }) : null;

        // Reuse cached preview if available so we don't regenerate on every apply
        const cachedProfile = previewCache.get(username);
        if (cachedProfile) send?.({ type: 'progress', pct: 80, msg: 'Using cached profile data…' });
        const profile = cachedProfile ?? await generateProfile(token, username, monkeyOptions, onProgress);
        if (!cachedProfile) previewCache.set(username, profile);

        if (dryRun) {
            const result = { ok: true, dry_run: true, steps: profile.steps, bio: profile.bio };
            if (send) { send({ type: 'done', ...result }); res.end(); } else { res.json(result); }
            return;
        }

        const repo       = `${username}/${username}`;
        const README_PATH = 'README.md';

        const readmeFile = await getFile(token, repo, README_PATH);
        if (!readmeFile) return sendJsonError(res, 404, 'not_found', `Profile repo ${repo} not found or README.md missing`);

        let readme = Buffer.from(readmeFile.content, 'base64').toString('utf8');

        const SECTIONS = [
            { key: 'summary',   start: '<!-- summary-start -->',     end: '<!-- summary-end -->' },
            { key: 'rating',    start: '<!-- rating-start -->',       end: '<!-- rating-end -->' },
            { key: 'monkeytype',start: '<!-- monkeytype-start -->',   end: '<!-- monkeytype-end -->', optional: true, enabled: () => !!profile.monkeytypeSvg },
            { key: 'charts',    start: '<!-- tech-charts-start -->',   end: '<!-- tech-charts-end -->' },
            { key: 'badges',    start: '<!-- tech-start -->',          end: '<!-- tech-end -->' },
        ];

        readme = ensureMarkers(readme, SECTIONS);
        readme = inject(readme, '<!-- summary-start -->',   '<!-- summary-end -->',   '\n' + profile.bio + '\n');

        send?.({ type: 'progress', pct: 84, msg: 'Pushing developer rating…' });
        await pushAsset(token, repo, 'assets/developer-rating.svg', profile.ratingSvg);
        const ratingLink = `\n<a href="https://github.com/${repo}/blob/main/DEVELOPER_INSIGHTS.md"><img src="./assets/developer-rating.svg" width="100%" alt="Developer Rating" /></a>\n`;
        readme = inject(readme, '<!-- rating-start -->', '<!-- rating-end -->', ratingLink);

        if (profile.monkeytypeSvg) {
            send?.({ type: 'progress', pct: 87, msg: 'Pushing Monkeytype chart…' });
            await pushAsset(token, repo, 'assets/monkeytype.svg', profile.monkeytypeSvg);
            const img = '<img src="./assets/monkeytype.svg" width="100%" alt="Typing Speed" />';
            const linked = monkeyOptions.username
                ? `<a href="https://monkeytype.com/profile/${monkeyOptions.username}">${img}</a>`
                : img;
            readme = inject(readme, '<!-- monkeytype-start -->', '<!-- monkeytype-end -->', '\n' + linked + '\n');
        }

        if (profile.techGridSvg) {
            send?.({ type: 'progress', pct: 90, msg: 'Pushing tech grid…' });
            await pushAsset(token, repo, 'assets/tech-grid.svg', profile.techGridSvg);
            const totalW = profile.gridCols * CELL_W;
            const totalH = profile.gridRows * Math.round(CELL_W * 1.05);
            const gridImg = `\n<img src="./assets/tech-grid.svg" width="${totalW}" height="${totalH}" alt="Tech Stack" />\n`;
            readme = inject(readme, '<!-- tech-charts-start -->', '<!-- tech-charts-end -->', gridImg);
        } else {
            readme = inject(readme, '<!-- tech-charts-start -->', '<!-- tech-charts-end -->', '\n_No tech data found._\n');
        }

        readme = inject(readme, '<!-- tech-start -->', '<!-- tech-end -->', '\n' + profile.badges + '\n');

        send?.({ type: 'progress', pct: 94, msg: 'Updating README…' });
        await putFile(token, repo, README_PATH, readme, readmeFile.sha, 'chore: update profile summary and charts');
        send?.({ type: 'progress', pct: 97, msg: 'Pushing insights…' });
        await pushAsset(token, repo, 'DEVELOPER_INSIGHTS.md', profile.insightsMd);

        const serviceUrl  = process.env.BASE_URL ?? 'http://localhost:8080';
        const workflowYml = `name: Refresh GitHub Profile
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Update profile README
        run: >-
          curl -f "${serviceUrl}/apply-readme"
          -H "Authorization: Bearer \${{ secrets.GH_PAT }}"
`;
        await pushAsset(token, repo, '.github/workflows/update-profile.yml', workflowYml);
        profile.steps.push('Pushed .github/workflows/update-profile.yml.');
        profile.steps.push('Done. Add a GH_PAT secret to your profile repo to activate the daily schedule.');
        send?.({ type: 'progress', pct: 100, msg: 'Done.' });
        const result = { ok: true, steps: profile.steps };
        if (send) { send({ type: 'done', ...result }); res.end(); } else { res.json(result); }
    } catch (err) {
        console.error('[apply-readme]', err.message);
        if (send) { send({ type: 'error', msg: err.message }); res.end(); }
        else sendJsonError(res, 500, 'internal_error', err.message);
    }
};
