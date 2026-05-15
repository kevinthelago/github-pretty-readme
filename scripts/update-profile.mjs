/**
 * Dynamically updates the kevinthelago profile README with:
 *  - account-summary SVG
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
const CHART_START = '<!-- tech-charts-start -->';
const CHART_END = '<!-- tech-charts-end -->';
const BADGE_START = '<!-- tech-start -->';
const BADGE_END = '<!-- tech-end -->';
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

/**
 * Returns updated content with section injected between start/end markers.
 * Returns null if either marker is missing (caller should warn and skip).
 */
const inject = (content, start, end, section) => {
    const si = content.indexOf(start);
    const ei = content.indexOf(end);
    if (si === -1 || ei === -1) return null;
    return content.slice(0, si + start.length) + section + content.slice(ei);
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

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
    // 1. Detect non-empty categories
    console.log('\nFetching tech categories…');
    const catRes = await fetch(`${BASE}/tech-categories?limit=8`);
    if (!catRes.ok) throw new Error(`/tech-categories → ${catRes.status}`);
    const categories = await catRes.json();
    const chartable = categories.filter(c => c.count >= MIN_TECHS_FOR_CHART);
    console.log(`  Found ${categories.length} categories, ${chartable.length} have enough data for a chart`);

    // 2. Fetch account summary SVG
    console.log('\nFetching account summary…');
    const summaryRes = await fetch(`${BASE}/account-summary?username=${username}&background=cherry-blossom`);
    if (!summaryRes.ok) throw new Error(`/account-summary → ${summaryRes.status}`);
    const summarysvg = await summaryRes.text();

    // 3. Fetch a spider chart per category
    console.log('\nFetching category charts…');
    const charts = [];
    for (const cat of chartable) {
        const url = `${BASE}/tech-spider?type=spider&categories=${cat.category}&limit=8&title=${encodeURIComponent(cat.label)}`;
        const res = await fetch(url);
        if (!res.ok) { console.log(`  ✗  ${cat.category} (${res.status})`); continue; }
        charts.push({ ...cat, svg: await res.text() });
        console.log(`  ✓  ${cat.category} (${cat.count} techs)`);
    }

    // 4. Fetch tech list for badges
    console.log('\nFetching tech list for badges…');
    const techRes = await fetch(`${BASE}/tech-list?sort=frequency`);
    if (!techRes.ok) throw new Error(`/tech-list → ${techRes.status}`);
    const techList = await techRes.json();
    const badges = techList.map(buildBadge).join(' ');

    // 5. Push assets
    console.log('\nPushing assets…');
    await pushAsset('assets/account-summary.svg', summarysvg);
    for (const chart of charts) {
        await pushAsset(`assets/tech-${chart.category}.svg`, chart.svg);
    }

    // 6. Update profile README
    console.log('\nUpdating README…');
    const { content: b64, sha } = await getFile(README_PATH);
    let readme = Buffer.from(b64, 'base64').toString('utf8');

    const chartImgs = charts
        .map(c => `<img src="./assets/tech-${c.category}.svg" width="600" height="600" alt="${c.label}" />`)
        .join('\n\n');

    const withCharts = inject(readme, CHART_START, CHART_END, '\n' + chartImgs + '\n');
    if (withCharts === null) {
        console.warn(`  ⚠  Chart markers not found — add ${CHART_START}${CHART_END} to ${REPO} README`);
    } else {
        readme = withCharts;
    }

    const withBadges = inject(readme, BADGE_START, BADGE_END, '\n' + badges + '\n');
    if (withBadges === null) {
        console.warn(`  ⚠  Badge markers not found — add ${BADGE_START}${BADGE_END} to ${REPO} README`);
    } else {
        readme = withBadges;
    }

    await putFile(README_PATH, readme, sha, 'chore: update tech charts and badges');
    console.log('  ✓  README.md');

    console.log('\nDone.');
})().catch(err => { console.error(err.message); process.exit(1); });
