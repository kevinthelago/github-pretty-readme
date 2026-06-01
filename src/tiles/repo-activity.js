import { THEME_CSS } from './theme.js';

const W = 800, H = 280;
const PAD = 28;
const BASELINE = H - 52;          // y of the bar baseline
const CHART_TOP = 96;             // tallest a bar may reach
const MAX_BAR_H = BASELINE - CHART_TOP;
const BAR_COLOR = '#39d353';      // GitHub contribution green

const clamp = (str, max) => (str.length > max ? str.slice(0, max - 1) + '…' : str);

/** Wrap a body string in the themed 800×280 SVG shell. */
const shell = (body) => `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <defs>
        <linearGradient id="ra-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" style="stop-color:var(--bg)"/>
            <stop offset="100%" style="stop-color:var(--bg2)"/>
        </linearGradient>
        <linearGradient id="ra-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${BAR_COLOR}" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="${BAR_COLOR}" stop-opacity="0.55"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#ra-bg)" rx="12"/>
    ${body}
</svg>`;

/** Centered single-message state used for both errors and empty data. */
const messageState = (heading, sub) => shell(`
    <text x="${W / 2}" y="${H / 2 - 8}" text-anchor="middle" style="fill:var(--fg75)" font-size="18" font-weight="bold" font-family="Arial, sans-serif">${heading}</text>
    <text x="${W / 2}" y="${H / 2 + 18}" text-anchor="middle" style="fill:var(--fg40)" font-size="12" font-family="Arial, sans-serif">${sub}</text>`);

const escapeXml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Render an 800×280 SVG card showing a repository's weekly commit activity over
 * the last year as a bar chart. Adapts to light/dark mode via
 * prefers-color-scheme CSS in the SVG.
 *
 * @param {Array<{week:number,total:number,days:number[]}>|null} weeks
 *   Weekly commit buckets from {@link getCommitActivity}. `null` signals a
 *   fetch error (renders an error card); an empty array or all-zero totals
 *   render the graceful "no activity" empty state.
 * @param {object} [opts]
 * @param {string} [opts.repo]   repo label shown in the header (e.g. "owner/name")
 * @param {string} [opts.error]  explicit error message; overrides the data path
 * @returns {string} a complete SVG document
 */
export const renderRepoActivity = (weeks, opts = {}) => {
    const { repo = '', error } = opts;
    const label = repo ? escapeXml(clamp(repo, 40)) : 'repository';

    if (error) return messageState('Could not load activity', escapeXml(clamp(error, 64)));
    if (weeks === null || weeks === undefined) return messageState('Repository not found', label);

    const totalCommits = weeks.reduce((sum, w) => sum + (w?.total ?? 0), 0);
    if (weeks.length === 0 || totalCommits === 0) {
        return messageState('No commit activity', `${label} · past year`);
    }

    const peak = Math.max(...weeks.map((w) => w?.total ?? 0));
    const n = weeks.length;

    // Lay out one bar per week across the chart width.
    const chartLeft = PAD;
    const chartRight = W - PAD;
    const chartW = chartRight - chartLeft;
    const slot = chartW / n;
    const barW = Math.max(2, slot * 0.7);

    const bars = weeks.map((w, i) => {
        const total = w?.total ?? 0;
        const h = peak > 0 ? Math.round((total / peak) * MAX_BAR_H) : 0;
        const x = chartLeft + i * slot + (slot - barW) / 2;
        const y = BASELINE - h;
        if (h <= 0) {
            // zero-commit week — a faint baseline tick so the timeline reads continuously
            return `<rect x="${x.toFixed(1)}" y="${(BASELINE - 2).toFixed(1)}" width="${barW.toFixed(1)}" height="2" rx="1" style="fill:var(--fg10)"/>`;
        }
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h}" rx="2" fill="url(#ra-bar)"/>`;
    }).join('\n    ');

    const header = `
    <text x="${PAD}" y="42" style="fill:var(--fg60)" font-size="12" letter-spacing="3" font-family="Arial, sans-serif">COMMIT ACTIVITY</text>
    <text x="${PAD}" y="68" style="fill:var(--fg85)" font-size="18" font-weight="bold" font-family="Arial, sans-serif">${label}</text>
    <text x="${W - PAD}" y="42" text-anchor="end" style="fill:var(--fg40)" font-size="11" font-family="Arial, sans-serif">past 52 weeks</text>
    <text x="${W - PAD}" y="70" text-anchor="end" style="fill:var(--fg)" font-size="24" font-weight="bold" font-family="Arial, sans-serif">${totalCommits}</text>
    <text x="${W - PAD}" y="86" text-anchor="end" style="fill:var(--fg35)" font-size="10" font-family="Arial, sans-serif">commits</text>`;

    const baseline = `<line x1="${chartLeft}" y1="${BASELINE}" x2="${chartRight}" y2="${BASELINE}" style="stroke:var(--fg08)" stroke-width="1"/>`;
    const peakLabel = `<text x="${chartLeft}" y="${(BASELINE + 18).toFixed(1)}" style="fill:var(--fg30)" font-size="9" font-family="Arial, sans-serif">peak ${peak} commits/wk</text>`;

    return shell(`${header}\n    ${baseline}\n    ${bars}\n    ${peakLabel}`);
};

export default renderRepoActivity;
