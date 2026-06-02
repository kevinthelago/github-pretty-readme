import { THEME_CSS } from './theme.js';

const W = 480;
const H = 220;
const PAD = 28;

const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');

/**
 * The stat rows shown on the card, in display order. Each maps a label to the
 * corresponding field on the aggregated `getUserStats` result.
 */
const STATS = [
    { key: 'stars', label: 'Total Stars' },
    { key: 'commits', label: 'Total Commits' },
    { key: 'prs', label: 'Pull Requests' },
    { key: 'issues', label: 'Issues' },
    { key: 'followers', label: 'Followers' },
    { key: 'contributedTo', label: 'Contributed To' },
];

/**
 * Render a GitHub stats card SVG (stars, commits, PRs, issues, followers,
 * repos contributed-to). Adapts to light/dark mode via prefers-color-scheme.
 *
 * @param {{login:string, name?:string|null, stars:number, commits:number,
 *   prs:number, issues:number, followers:number, repos:number,
 *   contributedTo:number}} stats - Aggregated stats from getUserStats.
 * @returns {string} SVG document.
 */
export const renderStatsCard = (stats) => {
    const title = stats.name ? `${stats.name}'s GitHub Stats` : `@${stats.login} · GitHub Stats`;

    const ROW_H = 26;
    const ROWS_TOP = 84;

    const rows = STATS.map(({ key, label }, i) => {
        const y = ROWS_TOP + i * ROW_H;
        return `
    <text x="${PAD}" y="${y}" style="fill:var(--fg75)" font-size="14" font-family="Arial, sans-serif">${label}</text>
    <text x="${W - PAD}" y="${y}" text-anchor="end" style="fill:var(--fg)" font-size="14" font-weight="bold" font-family="Arial, sans-serif">${fmt(stats[key])}</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <defs>
        <linearGradient id="sc-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" style="stop-color:var(--bg)"/>
            <stop offset="100%" style="stop-color:var(--bg2)"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sc-bg)" rx="12"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" style="stroke:var(--fg10)"/>
    <text x="${PAD}" y="44" style="fill:var(--fg)" font-size="20" font-weight="bold" font-family="Arial, sans-serif">${title}</text>
    <line x1="${PAD}" y1="58" x2="${W - PAD}" y2="58" style="stroke:var(--fg08)" stroke-width="1"/>
    ${rows}
</svg>`;
};

export default renderStatsCard;
