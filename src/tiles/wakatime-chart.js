import { THEME_CSS } from './theme.js';

const W = 800, H = 280;
const PAD = 28;
const SCORE_W = 190;
const BAR_X = SCORE_W + PAD * 2;
const BAR_MAX_W = W - BAR_X - PAD - 62;
const BAR_H = 10;
const BAR_GAP = 38;
const BARS_TOP = 56;
const MAX_BARS = 5;

// Shared tile palette (mirrors language-trend / monkeytype-chart) so WakaTime
// language bars sit visually alongside the other tiles.
const PALETTE = ['82aaff', 'c3e88d', 'f78c6c', 'c792ea', 'ffcb6b', '89ddff', 'f07178', 'b2ccd6'];

/** Human-readable label for a WakaTime stats range (default: last_7_days). */
const RANGE_LABEL = {
    last_7_days:   'LAST 7 DAYS',
    last_30_days:  'LAST 30 DAYS',
    last_6_months: 'LAST 6 MONTHS',
    last_year:     'LAST YEAR',
    all_time:      'ALL TIME',
};

/** Formats a duration in seconds as `Xh Ym`, `Xm`, or `<1m`. */
const formatDuration = (seconds) => {
    const total = Math.max(0, Math.round(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hrs > 0) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    if (mins > 0) return `${mins}m`;
    return '<1m';
};

/**
 * Renders an 800×280 SVG card showing WakaTime coding time per language.
 *
 * Mirrors the Monkeytype tile: a left summary panel (total coding time over the
 * range) and a right column of horizontal bars for the top languages. Adapts to
 * light/dark mode via the shared prefers-color-scheme CSS in {@link THEME_CSS}.
 *
 * @param {Array<{name:string,total_seconds:number,percent:number}>} languages
 *        per-language breakdown from the WakaTime client; rendered top-down by
 *        the order received (the API returns them sorted by time descending).
 * @param {object} [opts]
 * @param {string} [opts.range] WakaTime stats range key (drives the panel label).
 * @returns {string} a complete SVG document.
 */
const renderWakatimeChart = (languages, { range = 'last_7_days' } = {}) => {
    const top = languages.slice(0, MAX_BARS);
    const totalSeconds = languages.reduce((sum, l) => sum + (l.total_seconds || 0), 0);
    const maxPercent = Math.max(...top.map(l => l.percent || 0), 1);

    const CX = SCORE_W / 2;
    const SEPARATOR_Y = 168;
    const rangeLabel = RANGE_LABEL[range] ?? RANGE_LABEL.last_7_days;

    const leftPanel = `
    <text x="${CX}" y="46" text-anchor="middle" style="fill:var(--fg60)" font-size="11" letter-spacing="3" font-family="Arial, sans-serif">CODING TIME</text>
    <text x="${CX}" y="112" text-anchor="middle" style="fill:var(--fg)" font-size="34" font-weight="bold" font-family="Arial, sans-serif">${formatDuration(totalSeconds)}</text>
    <text x="${CX}" y="136" text-anchor="middle" style="fill:var(--fg35)" font-size="11" letter-spacing="1" font-family="Arial, sans-serif">${rangeLabel}</text>
    <line x1="${CX - 28}" y1="${SEPARATOR_Y}" x2="${CX + 28}" y2="${SEPARATOR_Y}" style="stroke:var(--fg08)" stroke-width="1"/>
    <text x="${CX}" y="215" text-anchor="middle" style="fill:var(--fg25)" font-size="10" letter-spacing="2" font-family="Arial, sans-serif">WAKATIME</text>`;

    const divider = `<line x1="${SCORE_W + PAD}" y1="${PAD}" x2="${SCORE_W + PAD}" y2="${H - PAD}" style="stroke:var(--fg08)" stroke-width="1"/>`;

    const bars = top.map(({ name, total_seconds, percent }, i) => {
        const color = `#${PALETTE[i % PALETTE.length]}`;
        const y = BARS_TOP + i * BAR_GAP;
        const barW = Math.max(2, Math.round(((percent || 0) / maxPercent) * BAR_MAX_W));

        return `
    <text x="${BAR_X}" y="${y - 4}" style="fill:var(--fg60)" font-size="11" font-family="Arial, sans-serif">${name}</text>
    <text x="${BAR_X + BAR_MAX_W + 8}" y="${y - 4}" text-anchor="end" style="fill:var(--fg35)" font-size="10" font-family="Arial, sans-serif">${formatDuration(total_seconds)}</text>
    <rect x="${BAR_X}" y="${y}" width="${BAR_MAX_W}" height="${BAR_H}" rx="5" style="fill:var(--fg06)"/>
    <rect x="${BAR_X}" y="${y}" width="${barW}" height="${BAR_H}" rx="5" fill="${color}" fill-opacity="0.85"/>
    <text x="${BAR_X + BAR_MAX_W + 8}" y="${y + BAR_H + 11}" text-anchor="end" fill="${color}" font-size="10" font-weight="bold" font-family="Arial, sans-serif">${(percent || 0).toFixed(1)}%</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <defs>
        <linearGradient id="wt-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" style="stop-color:var(--bg)"/>
            <stop offset="100%" style="stop-color:var(--bg2)"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#wt-bg)" rx="12"/>
    ${leftPanel}
    ${divider}
    ${bars}
</svg>`;
};

export { renderWakatimeChart, formatDuration };
export default renderWakatimeChart;
