import { THEME_CSS } from './theme.js';

// ── Octicon path data (16×16 viewBox) ──────────────────────────────────────
const ICON_REPO  = 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z';
const ICON_STAR  = 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z';
const ICON_FORK  = 'M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z';
const ICON_ISSUE = 'M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z';

const escapeXml = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const clamp = (str, max) => (str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str);

/** Formats a count compactly: 1234 → "1.2k", 12000 → "12k". */
const formatCount = (n) => {
    const num = Number(n) || 0;
    if (num < 1000) return String(num);
    if (num < 1_000_000) {
        const k = num / 1000;
        return (k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')) + 'k';
    }
    const m = num / 1_000_000;
    return (m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')) + 'm';
};

/**
 * Human-readable "last updated" relative to now.
 * @param {string|number|Date} updatedAt  ISO string / epoch ms / Date
 * @param {number} now  reference time in epoch ms (injected for testability)
 */
const relativeTime = (updatedAt, now) => {
    if (!updatedAt) return '';
    const then = new Date(updatedAt).getTime();
    if (Number.isNaN(then)) return '';
    const days = Math.floor((now - then) / 86_400_000);
    if (days <= 0) return 'updated today';
    if (days === 1) return 'updated yesterday';
    if (days < 30) return `updated ${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `updated ${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(days / 365);
    return `updated ${years} year${years === 1 ? '' : 's'} ago`;
};

const W = 460;
const H = 200;
const PAD = 22;

/** Renders a small octicon glyph + its value as one stat group at (x, y). */
const stat = (x, y, path, value) => `
    <g transform="translate(${x}, ${y})">
        <g transform="scale(0.875)" fill="var(--fg60)"><path fill-rule="evenodd" d="${path}"/></g>
        <text x="22" y="11" font-size="13" font-family="Arial, sans-serif" fill="var(--fg75)">${escapeXml(value)}</text>
    </g>`;

/**
 * Renders a repository summary card as a self-contained, theme-aware SVG.
 * Light/dark is handled by THEME_CSS via prefers-color-scheme — no theme arg.
 *
 * @param {object} repo
 * @param {string} repo.owner
 * @param {string} repo.name
 * @param {string} [repo.description]
 * @param {number} [repo.stars]
 * @param {number} [repo.forks]
 * @param {number} [repo.openIssues]
 * @param {string} [repo.language]
 * @param {string} [repo.languageHex]  hex (no '#') for the language dot
 * @param {string} [repo.updatedAt]    ISO timestamp
 * @param {object} [opts]
 * @param {number} [opts.now]  reference time (epoch ms); defaults to Date.now()
 * @returns {string} SVG document
 */
export const renderRepoCard = (repo = {}, opts = {}) => {
    const {
        owner = '', name = '', description = '',
        stars = 0, forks = 0, openIssues = 0,
        language = '', languageHex = '8b949e', updatedAt = '',
    } = repo;
    const now = opts.now ?? Date.now();

    const title = `${escapeXml(owner)} / <tspan font-weight="700">${escapeXml(clamp(name, 28))}</tspan>`;
    const desc  = clamp(description || 'No description provided.', 64);

    const statsY = 132;
    const stats = [
        stat(PAD, statsY, ICON_STAR, formatCount(stars)),
        stat(PAD + 92, statsY, ICON_FORK, formatCount(forks)),
        stat(PAD + 184, statsY, ICON_ISSUE, formatCount(openIssues)),
    ].join('');

    const langRow = language
        ? `<g transform="translate(${PAD}, 166)">
            <circle cx="6" cy="6" r="6" fill="#${escapeXml(languageHex)}"/>
            <text x="20" y="11" font-size="13" font-family="Arial, sans-serif" fill="var(--fg75)">${escapeXml(language)}</text>
        </g>`
        : '';

    const updated = relativeTime(updatedAt, now);
    const updatedRow = updated
        ? `<text x="${W - PAD}" y="177" text-anchor="end" font-size="12" font-family="Arial, sans-serif" fill="var(--fg40)">${escapeXml(updated)}</text>`
        : '';

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(owner)}/${escapeXml(name)} repository card">
    ${THEME_CSS}
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="var(--bg2)" stroke="var(--fg15)"/>
    <g transform="translate(${PAD}, 30)">
        <g transform="scale(1.1)" fill="var(--fg60)"><path fill-rule="evenodd" d="${ICON_REPO}"/></g>
        <text x="28" y="14" font-size="18" font-family="Arial, sans-serif" fill="var(--fg85)">${title}</text>
    </g>
    <text x="${PAD}" y="86" font-size="14" font-family="Arial, sans-serif" fill="var(--fg60)">${escapeXml(desc)}</text>
    <line x1="${PAD}" y1="108" x2="${W - PAD}" y2="108" stroke="var(--fg10)"/>
    ${stats}
    ${langRow}
    ${updatedRow}
</svg>`;
};

export { formatCount, relativeTime, clamp, escapeXml };
export default renderRepoCard;
