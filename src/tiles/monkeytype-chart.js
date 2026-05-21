const W = 800, H = 280;
const PAD = 28;
const SCORE_W = 190;
const BAR_X = SCORE_W + PAD * 2;
const BAR_MAX_W = W - BAR_X - PAD - 52; // leave room for wpm label
const BAR_H = 10;
const BAR_GAP = 52;
const BARS_TOP = 60;

const MODE_COLORS = {
    '15':  '#c792ea',
    '30':  '#82aaff',
    '60':  '#c3e88d',
    '120': '#f78c6c',
};

/**
 * Renders an 800×280 SVG card showing Monkeytype personal bests per time mode.
 *
 * @param {Array<{ duration, wpm, acc, consistency }>} modes
 */
const renderMonkeytypeChart = (modes) => {
    const bestWpm = Math.max(...modes.map(m => m.wpm));
    const maxBar  = Math.max(bestWpm, 80);

    const CX          = SCORE_W / 2;
    const SEPARATOR_Y = 168;

    const leftPanel = `
    <text x="${CX}" y="46" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="11" letter-spacing="3" font-family="Arial, sans-serif">TYPING SPEED</text>
    <text x="${CX}" y="118" text-anchor="middle" fill="white" font-size="52" font-weight="bold" font-family="Arial, sans-serif">${bestWpm}</text>
    <text x="${CX}" y="140" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="11" font-family="Arial, sans-serif">words per minute</text>
    <line x1="${CX - 28}" y1="${SEPARATOR_Y}" x2="${CX + 28}" y2="${SEPARATOR_Y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <text x="${CX}" y="215" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="10" letter-spacing="2" font-family="Arial, sans-serif">MONKEYTYPE</text>`;

    const divider = `<line x1="${SCORE_W + PAD}" y1="${PAD}" x2="${SCORE_W + PAD}" y2="${H - PAD}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;

    const bars = modes.map(({ duration, wpm, acc }, i) => {
        const color = MODE_COLORS[duration] || '#ffffff';
        const y     = BARS_TOP + i * BAR_GAP;
        const barW  = Math.round((wpm / maxBar) * BAR_MAX_W);

        return `
    <text x="${BAR_X}" y="${y - 4}" fill="rgba(255,255,255,0.6)" font-size="10" letter-spacing="1" font-family="Arial, sans-serif">${duration}S</text>
    <rect x="${BAR_X}" y="${y}" width="${BAR_MAX_W}" height="${BAR_H}" rx="5" fill="rgba(255,255,255,0.06)"/>
    <rect x="${BAR_X}" y="${y}" width="${barW}" height="${BAR_H}" rx="5" fill="${color}" fill-opacity="0.85"/>
    <text x="${BAR_X + BAR_MAX_W + 8}" y="${y + BAR_H - 1}" fill="${color}" font-size="11" font-weight="bold" font-family="Arial, sans-serif">${wpm}</text>
    <text x="${BAR_X}" y="${y + BAR_H + 13}" fill="rgba(255,255,255,0.3)" font-size="9" font-family="Arial, sans-serif">${acc.toFixed(1)}% acc</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="mt-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#mt-bg)" rx="12"/>
    ${leftPanel}
    ${divider}
    ${bars}
</svg>`;
};

export { renderMonkeytypeChart };
export default renderMonkeytypeChart;
