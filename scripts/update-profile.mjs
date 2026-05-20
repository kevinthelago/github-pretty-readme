/**
 * Dynamically updates the kevinthelago profile README with:
 *  - plain-text Gemini-generated bio (injected as markdown)
 *  - one spider chart SVG per detected tech category
 *  - clickable shields.io tech badges
 *
 * Usage: node scripts/update-profile.mjs <github-username>
 */

const username = process.argv[2];
if (!username) {
    console.error('Usage: node scripts/update-profile.mjs <github-username>');
    process.exit(1);
}

const PROFILE_REPO_TOKEN = process.env.PROFILE_REPO_TOKEN;
if (!PROFILE_REPO_TOKEN) {
    console.error('PROFILE_REPO_TOKEN is required');
    process.exit(1);
}

const PORT = process.env.port || 8080;
const BASE = `http://localhost:${PORT}`;
const REPO = `${username}/${username}`;
const README_PATH = 'README.md';
const MIN_TECHS_FOR_CHART = 3;

// ── GitHub API helpers ───────────────────────────────────────────────────────

const ghHeaders = {
    Authorization: `Bearer ${PROFILE_REPO_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
};

const getFile = async (path) => {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { headers: ghHeaders });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
};

const putFile = async (path, content, sha, message) => {
    const body = { message, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) };
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
        method: 'PUT', headers: ghHeaders, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`);
};

const pushAsset = async (filePath, content) => {
    let sha;
    try { sha = (await getFile(filePath)).sha; } catch {}
    await putFile(filePath, content, sha, `chore: update ${filePath}`);
    console.log(`  ✓  ${filePath}`);
};

// ── Marker injection ─────────────────────────────────────────────────────────

const inject = (content, start, end, section) => {
    const si = content.indexOf(start);
    const ei = content.indexOf(end);
    if (si === -1 || ei === -1) return content; // ensureMarkers already ran; should never happen
    return content.slice(0, si + start.length) + section + content.slice(ei);
};

/**
 * Ensures all section markers exist in the README, inserting them in order
 * if absent. Each missing section is inserted before the next one (or appended).
 */
const ensureMarkers = (content, sections) => {
    let out = content;
    for (let i = 0; i < sections.length; i++) {
        const { start, end } = sections[i];
        if (out.includes(start)) continue;

        const block = `${start}${end}\n`;
        const nextMarker = sections.slice(i + 1).map(s => s.start).find(m => out.includes(m));
        if (nextMarker) {
            const idx = out.indexOf(nextMarker);
            out = out.slice(0, idx) + block + '\n' + out.slice(idx);
        } else {
            out += '\n' + block;
        }
        console.log(`  ✓  Inserted ${start} markers`);
    }
    return out;
};

// ── Badge builder ────────────────────────────────────────────────────────────

const luminance = (hex) => {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const buildBadge = ({ language, slug, hex }) => {
    const label = encodeURIComponent(language);
    const repoUrl = `https://github.com/${username}?tab=repositories&language=${encodeURIComponent(language.toLowerCase())}`;
    if (slug && hex) {
        const logoColor = luminance(hex) > 0.6 ? 'black' : 'white';
        return `[![${language}](https://img.shields.io/badge/${label}-${hex}?style=flat&logo=${slug}&logoColor=${logoColor})](${repoUrl})`;
    }
    return `[![${language}](https://img.shields.io/badge/${label}-555555?style=flat)](${repoUrl})`;
};

// ── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
    {
        key: 'summary',
        start: '<!-- summary-start -->',
        end: '<!-- summary-end -->',
        async fetch() {
            console.log('\nFetching account summary…');
            const res = await fetch(`${BASE}/account-summary-md?username=${username}`);
            if (!res.ok) throw new Error(`/account-summary-md → ${res.status}`);
            const text = await res.text();
            console.log('  ✓  summary');
            return '\n' + text + '\n';
        },
    },
    {
        key: 'rating',
        start: '<!-- rating-start -->',
        end: '<!-- rating-end -->',
        async fetch() {
            console.log('\nFetching developer rating…');
            const res = await fetch(`${BASE}/developer-rating`);
            if (!res.ok) throw new Error(`/developer-rating → ${res.status}`);
            const svg = await res.text();
            await pushAsset('assets/developer-rating.svg', svg);
            return '\n<img src="./assets/developer-rating.svg" width="800" height="280" alt="Developer Rating" />\n';
        },
    },
    {
        key: 'charts',
        start: '<!-- tech-charts-start -->',
        end: '<!-- tech-charts-end -->',
        async fetch() {
            console.log('\nFetching tech categories…');
            const catRes = await fetch(`${BASE}/tech-categories?limit=8`);
            if (!catRes.ok) throw new Error(`/tech-categories → ${catRes.status}`);
            const categories = await catRes.json();
            const chartable = categories.filter(c => c.count >= MIN_TECHS_FOR_CHART);
            console.log(`  Found ${categories.length} categories, ${chartable.length} chartable`);

            if (chartable.length === 0) return '\n_No tech data found._\n';

            const categoryList = chartable.map(c => c.category).join(',');
            const columns = Math.min(chartable.length, 2);
            const url = `${BASE}/tech-spider?type=grid&categories=${categoryList}&limit=8&columns=${columns}`;
            console.log('\nFetching tech grid…');
            const res = await fetch(url);
            if (!res.ok) throw new Error(`/tech-spider?type=grid → ${res.status}`);
            const svg = await res.text();
            await pushAsset('assets/tech-grid.svg', svg);
            console.log(`  ✓  tech-grid (${chartable.length} categories, ${columns} columns)`);

            const cellH = Math.round((800 / columns) * 1.05);
            const rows = Math.ceil(chartable.length / columns);
            const totalH = rows * cellH;
            return `\n<img src="./assets/tech-grid.svg" width="800" height="${totalH}" alt="Tech Stack" />\n`;
        },
    },
    {
        key: 'badges',
        start: '<!-- tech-start -->',
        end: '<!-- tech-end -->',
        async fetch() {
            console.log('\nFetching tech list for badges…');
            const res = await fetch(`${BASE}/tech-list?sort=frequency`);
            if (!res.ok) throw new Error(`/tech-list → ${res.status}`);
            const techList = await res.json();
            const badges = techList.map(buildBadge).join(' ');
            console.log(`  ✓  ${techList.length} badges`);
            return '\n' + badges + '\n';
        },
    },
];

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
    const { content: b64, sha } = await getFile(README_PATH);
    let readme = Buffer.from(b64, 'base64').toString('utf8');

    readme = ensureMarkers(readme, SECTIONS);

    for (const section of SECTIONS) {
        const content = await section.fetch();
        readme = inject(readme, section.start, section.end, content);
    }

    console.log('\nUpdating README…');
    await putFile(README_PATH, readme, sha, 'chore: update profile summary and charts');
    console.log('  ✓  README.md');

    console.log('\nGenerating developer insights…');
    const insightsRes = await fetch(`${BASE}/developer-rating-insights`);
    if (!insightsRes.ok) throw new Error(`/developer-rating-insights → ${insightsRes.status}`);
    const insightsMd = await insightsRes.text();
    await pushAsset('DEVELOPER_INSIGHTS.md', insightsMd);

    console.log('\nDone.');
})().catch(err => { console.error(err.message); process.exit(1); });
