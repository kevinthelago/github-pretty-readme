/**
 * Fetches /tech-list from the local server, builds shields.io badge markdown,
 * and replaces the <!-- tech-start --> ... <!-- tech-end --> section in the
 * kevinthelago/kevinthelago profile README via the GitHub Contents API.
 *
 * Usage: node scripts/update-readme-tech.mjs <github-username>
 */

const username = process.argv[2];
if (!username) {
    console.error('Usage: node scripts/update-readme-tech.mjs <github-username>');
    process.exit(1);
}

const PROFILE_REPO_TOKEN = process.env.PROFILE_REPO_TOKEN;
if (!PROFILE_REPO_TOKEN) {
    console.error('PROFILE_REPO_TOKEN env var is required');
    process.exit(1);
}

const PORT = process.env.port || 8080;
const REPO_OWNER = username;
const REPO_NAME = username;
const README_PATH = 'README.md';

const luminance = (hex) => {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const buildBadge = ({ language, slug, hex }) => {
    const label = encodeURIComponent(language);
    const repoUrl = `https://github.com/${username}?tab=repositories&language=${encodeURIComponent(language.toLowerCase())}`;

    if (slug && hex) {
        const logoColor = luminance(hex) > 0.6 ? 'black' : 'white';
        const color = hex;
        const badgeUrl = `https://img.shields.io/badge/${label}-${color}?style=flat&logo=${slug}&logoColor=${logoColor}`;
        return `[![${language}](${badgeUrl})](${repoUrl})`;
    }

    // Fallback: plain text badge with a neutral color
    const badgeUrl = `https://img.shields.io/badge/${label}-555555?style=flat`;
    return `[![${language}](${badgeUrl})](${repoUrl})`;
};

const fetchTechList = async () => {
    const res = await fetch(`http://localhost:${PORT}/tech-list?sort=frequency`);
    if (!res.ok) throw new Error(`/tech-list responded ${res.status}`);
    return res.json();
};

const fetchReadme = async () => {
    const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${README_PATH}`,
        { headers: { Authorization: `Bearer ${PROFILE_REPO_TOKEN}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) throw new Error(`GitHub GET README responded ${res.status}: ${await res.text()}`);
    return res.json();
};

const pushReadme = async (content, sha) => {
    const body = {
        message: 'chore: update tech badges',
        content: Buffer.from(content).toString('base64'),
        sha,
    };
    const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${README_PATH}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${PROFILE_REPO_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );
    if (!res.ok) throw new Error(`GitHub PUT README responded ${res.status}: ${await res.text()}`);
    return res.json();
};

const START_MARKER = '<!-- tech-start -->';
const END_MARKER = '<!-- tech-end -->';

const injectBadges = (readmeContent, badges) => {
    const startIdx = readmeContent.indexOf(START_MARKER);
    const endIdx = readmeContent.indexOf(END_MARKER);
    if (startIdx === -1 || endIdx === -1) {
        throw new Error(`README is missing ${START_MARKER} / ${END_MARKER} markers`);
    }
    const before = readmeContent.slice(0, startIdx + START_MARKER.length);
    const after = readmeContent.slice(endIdx);
    const section = '\n' + badges.join(' ') + '\n';
    return before + section + after;
};

(async () => {
    try {
        console.log('Fetching tech list…');
        const techs = await fetchTechList();
        console.log(`Got ${techs.length} languages`);

        const badges = techs.map(buildBadge);

        console.log('Fetching profile README…');
        const { content: b64Content, sha } = await fetchReadme();
        const readmeContent = Buffer.from(b64Content, 'base64').toString('utf8');

        const updated = injectBadges(readmeContent, badges);

        console.log('Pushing updated README…');
        await pushReadme(updated, sha);
        console.log('Done.');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
})();
