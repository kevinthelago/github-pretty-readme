import { getAllRepos }                      from '../src/github/repos.js';
import { computeRating, computeInsights }   from '../src/github/developer-rating.js';
import { renderDeveloperRating }            from '../src/tiles/developer-rating.js';
import { buildTechSeries, lookupIcon }      from '../src/github/tech-data.js';
import { renderTechGrid }                   from '../src/tiles/tech-grid.js';
import { renderMonkeytypeChart }            from '../src/tiles/monkeytype-chart.js';
import { GoogleGenerativeAI }              from '@google/generative-ai';

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
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`);
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

const renderInsights = (rating, insights, repos) => {
    const date = new Date().toISOString().slice(0, 10);
    const { breadth, depth, diversity, activity, impact } = insights;

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
        const lines = [
            `## Impact — ${bar(rating.impact)}`, '',
            `**Total:** ${total.stars} stars · ${total.forks} forks`, '',
        ];
        if (top.length) {
            lines.push('**Top repositories by impact:**', '', '| Repository | Stars | Forks |', '|---|---|---|');
            top.forEach(r => lines.push(`| ${fmt(r.name, r.url)} | ${r.stars} | ${r.forks} |`));
        }
        lines.push('', '**How to improve:**', '- Add a polished README with screenshots or demos', '- Pin your strongest repos on your profile');
        return lines.join('\n');
    })();

    return [
        `# Developer Score Insights`,
        `_Generated ${date} · ${repos.length} repositories analysed_`, '',
        `## Overall Score: ${rating.overall}/100 — Tier ${rating.tier.label}`, '',
        '| Dimension | Score | Weight |', '|---|---|---|',
        `| Breadth   | ${rating.breadth}/100   | 20% |`,
        `| Depth     | ${rating.depth}/100     | 25% |`,
        `| Diversity | ${rating.diversity}/100 | 20% |`,
        `| Activity  | ${rating.activity}/100  | 20% |`,
        `| Impact    | ${rating.impact}/100    | 15% |`, '', '---', '',
        breadthMd, '', '---', '', depthMd, '', '---', '', diversityMd, '', '---', '', activityMd, '', '---', '', impactMd,
    ].join('\n');
};

// ── Core profile generator ────────────────────────────────────────────────────

export async function generateProfile(token, username, monkeyOptions = {}) {
    const steps = [];
    const log   = (msg) => { steps.push(msg); console.log(`[apply-readme] ${msg}`); };

    log('Fetching repositories…');
    const repos = await getAllRepos(token);
    if (!repos) throw new Error('Failed to fetch repositories — check token scope');

    log('Generating bio…');
    const bioPrompt =
        `Write a 2-3 sentence developer bio for a GitHub profile README based on the following repositories. ` +
        `Be specific about the technologies and domains you see. Use plain prose — no markdown, no bullet points, no headers. ` +
        `Write in third person.\n\nRepositories:\n${JSON.stringify(repos.map(r => ({ name: r.name, description: r.description, language: r.language, topics: r.topics })), null, 2)}`;
    const bioResult = await model.generateContent(bioPrompt);
    const bio       = bioResult.response.text().trim();

    log('Computing developer rating…');
    const rating    = computeRating(repos);
    const insights  = computeInsights(repos);
    const ratingSvg = renderDeveloperRating(rating);

    log('Building tech grid…');
    const series    = buildTechSeries(repos, ALL_CATEGORIES, 8, []);
    const chartable = series.filter(s => s.techs.length >= MIN_TECHS);
    let techGridSvg = null, gridCols = 0, gridRows = 0;
    if (chartable.length > 0) {
        gridCols    = chartable.length <= 3 ? chartable.length : Math.ceil(Math.sqrt(chartable.length));
        gridRows    = Math.ceil(chartable.length / gridCols);
        techGridSvg = renderTechGrid(chartable, null, { columns: gridCols });
    }

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

    log('Rendering developer insights…');
    const insightsMd = renderInsights(rating, insights, repos);

    return { bio, ratingSvg, techGridSvg, gridCols, gridRows, badges, monkeytypeSvg, insightsMd, steps };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export default async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    const dryRun = req.query.dry_run === 'true';

    try {
        const monkeyOptions = {
            apiKey:   req.session.monkeytype_key ?? process.env.MONKEYTYPE_API_KEY ?? null,
            username: req.session.monkeytype_username ?? process.env.MONKEYTYPE_USERNAME ?? null,
        };

        const profile = await generateProfile(token, username, monkeyOptions);

        if (dryRun) return res.json({ ok: true, dry_run: true, steps: profile.steps, bio: profile.bio });

        const repo       = `${username}/${username}`;
        const README_PATH = 'README.md';

        const readmeFile = await getFile(token, repo, README_PATH);
        if (!readmeFile) return res.status(404).json({ error: `Profile repo ${repo} not found or README.md missing` });

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

        await pushAsset(token, repo, 'assets/developer-rating.svg', profile.ratingSvg);
        const ratingLink = `\n<a href="https://github.com/${repo}/blob/main/DEVELOPER_INSIGHTS.md"><img src="./assets/developer-rating.svg" width="100%" alt="Developer Rating" /></a>\n`;
        readme = inject(readme, '<!-- rating-start -->', '<!-- rating-end -->', ratingLink);

        if (profile.monkeytypeSvg) {
            await pushAsset(token, repo, 'assets/monkeytype.svg', profile.monkeytypeSvg);
            const img = '<img src="./assets/monkeytype.svg" width="100%" alt="Typing Speed" />';
            const linked = monkeyOptions.username
                ? `<a href="https://monkeytype.com/profile/${monkeyOptions.username}">${img}</a>`
                : img;
            readme = inject(readme, '<!-- monkeytype-start -->', '<!-- monkeytype-end -->', '\n' + linked + '\n');
        }

        if (profile.techGridSvg) {
            await pushAsset(token, repo, 'assets/tech-grid.svg', profile.techGridSvg);
            const totalW = profile.gridCols * CELL_W;
            const totalH = profile.gridRows * Math.round(CELL_W * 1.05);
            const gridImg = `\n<img src="./assets/tech-grid.svg" width="${totalW}" height="${totalH}" alt="Tech Stack" />\n`;
            readme = inject(readme, '<!-- tech-charts-start -->', '<!-- tech-charts-end -->', gridImg);
        } else {
            readme = inject(readme, '<!-- tech-charts-start -->', '<!-- tech-charts-end -->', '\n_No tech data found._\n');
        }

        readme = inject(readme, '<!-- tech-start -->', '<!-- tech-end -->', '\n' + profile.badges + '\n');

        await putFile(token, repo, README_PATH, readme, readmeFile.sha, 'chore: update profile summary and charts');
        await pushAsset(token, repo, 'DEVELOPER_INSIGHTS.md', profile.insightsMd);

        profile.steps.push('Done.');
        res.json({ ok: true, steps: profile.steps });
    } catch (err) {
        console.error('[apply-readme]', err.message);
        res.status(500).json({ error: err.message });
    }
};
