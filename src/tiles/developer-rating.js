const DIMENSIONS = [
    { key: 'breadth',   label: 'Breadth',   color: '#c792ea' },
    { key: 'depth',     label: 'Depth',     color: '#82aaff' },
    { key: 'diversity', label: 'Diversity', color: '#89ddff' },
    { key: 'activity',  label: 'Activity',  color: '#c3e88d' },
    { key: 'impact',    label: 'Impact',    color: '#f78c6c' },
];

const W = 800, H = 280;
const PAD = 28;
const SCORE_W = 190;
const BAR_X = SCORE_W + PAD * 2;
const BAR_MAX_W = W - BAR_X - PAD;
const BAR_H = 10;
const BAR_GAP = 36;
const BARS_TOP = 58;

/**
 * Renders an 800x280 SVG score card showing the 5 developer rating dimensions
 * plus an overall score and tier badge.
 *
 * @param {{ breadth, depth, diversity, activity, impact, overall, tier }} rating
 */
const renderDeveloperRating = (rating) => {
    const { overall, tier } = rating;

    // ── Left panel: overall score + tier ──────────────────────────────────────
    const tierBadge = `
    <circle cx="${SCORE_W / 2}" cy="${H / 2 + 28}" r="32" fill="${tier.color}" fill-opacity="0.15" stroke="${tier.color}" stroke-width="1.5"/>
    <text x="${SCORE_W / 2}" y="${H / 2 + 35}" text-anchor="middle" fill="${tier.color}" font-size="30" font-weight="bold" font-family="Arial, sans-serif">${tier.label}</text>`;

    const overallLabel = `
    <text x="${SCORE_W / 2}" y="44" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="13" letter-spacing="3" font-family="Arial, sans-serif">DEVELOPER RATING</text>
    <text x="${SCORE_W / 2}" y="${H / 2 - 4}" text-anchor="middle" fill="white" font-size="52" font-weight="bold" font-family="Arial, sans-serif">${overall}</text>
    <text x="${SCORE_W / 2}" y="${H / 2 + 14}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="11" font-family="Arial, sans-serif">out of 100</text>`;

    // Divider
    const divider = `<line x1="${SCORE_W + PAD}" y1="${PAD}" x2="${SCORE_W + PAD}" y2="${H - PAD}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;

    // ── Right panel: dimension bars ───────────────────────────────────────────
    const bars = DIMENSIONS.map(({ key, label, color }, i) => {
        const score = rating[key];
        const y = BARS_TOP + i * BAR_GAP;
        const barW = Math.round((score / 100) * BAR_MAX_W);

        return `
    <text x="${BAR_X}" y="${y - 4}" fill="rgba(255,255,255,0.6)" font-size="10" font-family="Arial, sans-serif" letter-spacing="1">${label.toUpperCase()}</text>
    <rect x="${BAR_X}" y="${y}" width="${BAR_MAX_W}" height="${BAR_H}" rx="5" fill="rgba(255,255,255,0.06)"/>
    <rect x="${BAR_X}" y="${y}" width="${barW}" height="${BAR_H}" rx="5" fill="${color}" fill-opacity="0.85"/>
    <text x="${BAR_X + BAR_MAX_W + 8}" y="${y + BAR_H - 1}" fill="${color}" font-size="11" font-weight="bold" font-family="Arial, sans-serif">${score}</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="dr-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
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
