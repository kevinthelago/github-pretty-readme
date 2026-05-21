import { THEME_CSS } from './theme.js';

const BASE_DIMENSIONS = [
    { key: 'breadth',     label: 'Breadth',     color: '#c792ea' },
    { key: 'depth',       label: 'Depth',       color: '#82aaff' },
    { key: 'diversity',   label: 'Diversity',   color: '#89ddff' },
    { key: 'activity',    label: 'Activity',    color: '#c3e88d' },
    { key: 'impact',      label: 'Impact',      color: '#f78c6c' },
];
const ENG_DIMENSION = { key: 'engineering', label: 'Engineering', color: '#ffcb6b' };

const W = 800, H = 280;
const PAD = 28;
const SCORE_W = 190;
const BAR_X = SCORE_W + PAD * 2;
const BAR_MAX_W = W - BAR_X - PAD;
const BAR_H = 10;
const BAR_GAP = 30;
const BARS_TOP = 48;

/**
 * Renders an 800x280 SVG score card showing the developer rating dimensions.
 * Adapts to light/dark mode via prefers-color-scheme CSS in the SVG.
 *
 * @param {{ breadth, depth, diversity, activity, impact, overall, tier, engineering? }} rating
 */
const renderDeveloperRating = (rating) => {
    const { overall, tier } = rating;

    const CX = SCORE_W / 2;
    const SEPARATOR_Y = 168;
    const TIER_CY = 218;

    const overallLabel = `
    <text x="${CX}" y="46" text-anchor="middle" style="fill:var(--fg60)" font-size="11" letter-spacing="3" font-family="Arial, sans-serif">DEVELOPER RATING</text>
    <text x="${CX}" y="118" text-anchor="middle" style="fill:var(--fg)" font-size="52" font-weight="bold" font-family="Arial, sans-serif">${overall}</text>
    <text x="${CX}" y="140" text-anchor="middle" style="fill:var(--fg35)" font-size="11" font-family="Arial, sans-serif">out of 100</text>
    <line x1="${CX - 28}" y1="${SEPARATOR_Y}" x2="${CX + 28}" y2="${SEPARATOR_Y}" style="stroke:var(--fg08)" stroke-width="1"/>`;

    const tierBadge = `
    <circle cx="${CX}" cy="${TIER_CY}" r="26" fill="${tier.color}" fill-opacity="0.15" stroke="${tier.color}" stroke-width="1.5"/>
    <text x="${CX}" y="${TIER_CY}" text-anchor="middle" dominant-baseline="central" fill="${tier.color}" font-size="26" font-weight="bold" font-family="Arial, sans-serif">${tier.label}</text>`;

    const divider = `<line x1="${SCORE_W + PAD}" y1="${PAD}" x2="${SCORE_W + PAD}" y2="${H - PAD}" style="stroke:var(--fg08)" stroke-width="1"/>`;

    const DIMENSIONS = rating.engineering != null
        ? [...BASE_DIMENSIONS, ENG_DIMENSION]
        : BASE_DIMENSIONS;

    const bars = DIMENSIONS.map(({ key, label, color }, i) => {
        const score = rating[key];
        const y     = BARS_TOP + i * BAR_GAP;
        const barW  = Math.round((score / 100) * BAR_MAX_W);

        return `
    <text x="${BAR_X}" y="${y - 4}" style="fill:var(--fg60)" font-size="10" font-family="Arial, sans-serif" letter-spacing="1">${label.toUpperCase()}</text>
    <rect x="${BAR_X}" y="${y}" width="${BAR_MAX_W}" height="${BAR_H}" rx="5" style="fill:var(--fg06)"/>
    <rect x="${BAR_X}" y="${y}" width="${barW}" height="${BAR_H}" rx="5" fill="${color}" fill-opacity="0.85"/>
    <text x="${BAR_X + BAR_MAX_W + 8}" y="${y + BAR_H - 1}" fill="${color}" font-size="11" font-weight="bold" font-family="Arial, sans-serif">${score}</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <defs>
        <linearGradient id="dr-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" style="stop-color:var(--bg)"/>
            <stop offset="100%" style="stop-color:var(--bg2)"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#dr-bg)" rx="12"/>
    ${overallLabel}
    ${tierBadge}
    ${divider}
    ${bars}
</svg>`;
};

export { renderDeveloperRating };
export default renderDeveloperRating;
