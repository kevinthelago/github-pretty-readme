/**
 * One-time setup: inserts tech-charts and tech-badge marker comments into
 * the kevinthelago profile README if they are not already present.
 *
 * Usage: node scripts/setup-profile.mjs <github-username>
 *
 * Requires PROFILE_REPO_TOKEN env var with repo write access.
 */

const username = process.argv[2];
if (!username) {
    console.error('Usage: node scripts/setup-profile.mjs <github-username>');
    process.exit(1);
}

const PROFILE_REPO_TOKEN = process.env.PROFILE_REPO_TOKEN;
if (!PROFILE_REPO_TOKEN) {
    console.error('PROFILE_REPO_TOKEN is required');
    process.exit(1);
}

const REPO = `${username}/${username}`;
const README_PATH = 'README.md';
const CHART_START = '<!-- tech-charts-start -->';
const CHART_END = '<!-- tech-charts-end -->';
const BADGE_START = '<!-- tech-start -->';
const BADGE_END = '<!-- tech-end -->';

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

(async () => {
    console.log(`\nFetching ${REPO}/${README_PATH}…`);
    const { content: b64, sha } = await getFile(README_PATH);
    let readme = Buffer.from(b64, 'base64').toString('utf8');

    let changed = false;

    // Insert chart markers before the badge section (or append at end)
    if (!readme.includes(CHART_START)) {
        const badgeIdx = readme.indexOf(BADGE_START);
        const chartBlock = `${CHART_START}${CHART_END}\n`;
        if (badgeIdx !== -1) {
            // Insert before the badge section with a blank line separator
            readme = readme.slice(0, badgeIdx) + chartBlock + '\n' + readme.slice(badgeIdx);
        } else {
            readme += '\n' + chartBlock;
        }
        console.log('  ✓  Inserted chart markers');
        changed = true;
    } else {
        console.log('  –  Chart markers already present');
    }

    // Insert badge markers if missing
    if (!readme.includes(BADGE_START)) {
        readme += '\n' + `${BADGE_START}${BADGE_END}\n`;
        console.log('  ✓  Inserted badge markers');
        changed = true;
    } else {
        console.log('  –  Badge markers already present');
    }

    if (!changed) {
        console.log('\nNothing to do — all markers already present.');
        return;
    }

    await putFile(README_PATH, readme, sha, 'chore: add tech chart and badge markers');
    console.log('\nDone — README.md updated.');
})().catch(err => { console.error(err.message); process.exit(1); });
