const clamp = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;

const COLS = 2;
const CARD_W = 440;
const CARD_H = 190;
const GAP = 20;
const SIDE_PAD = 20;
const ICON_SIZE = 32;
const ICONS_PER_ROW = 6;
const CARD_HEADER_H = 38;

/**
 * Renders a grid of mini-cards, one per category.
 * Each card shows the category name and up to 12 icons with name labels.
 *
 * @param {Array<{ label, color, techs: [{ name, count, icon, hex }] }>} series
 */
const renderTechCards = (series) => {
    const rows = Math.ceil(series.length / COLS);
    const TITLE_H = 60;
    const W = SIDE_PAD * 2 + CARD_W * COLS + GAP * (COLS - 1);
    const H = TITLE_H + GAP + rows * CARD_H + (rows - 1) * GAP + GAP;

    const cards = series.map((s, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cardX = SIDE_PAD + col * (CARD_W + GAP);
        const cardY = TITLE_H + GAP + row * (CARD_H + GAP);

        const display = s.techs.slice(0, ICONS_PER_ROW * 2);
        const iconRows = Math.ceil(display.length / ICONS_PER_ROW);
        const iconAreaW = ICONS_PER_ROW * (ICON_SIZE + 12) - 12;
        const iconStartX = cardX + (CARD_W - iconAreaW) / 2;
        const iconStartY = cardY + CARD_HEADER_H + 10;
        const CELL_W = ICON_SIZE + 12;
        const CELL_H = ICON_SIZE + 16;

        const icons = display.map((tech, j) => {
            const icol = j % ICONS_PER_ROW;
            const irow = Math.floor(j / ICONS_PER_ROW);
            const ix = iconStartX + icol * CELL_W;
            const iy = iconStartY + irow * CELL_H;
            const scale = (ICON_SIZE / 24).toFixed(4);
            const hex = tech.hex || '888888';

            const iconSvg = tech.icon
                ? `<g transform="translate(${ix.toFixed(1)},${iy.toFixed(1)}) scale(${scale})"><path d="${tech.icon.path}" fill="#${hex}"/></g>`
                : `<circle cx="${(ix + ICON_SIZE / 2).toFixed(1)}" cy="${(iy + ICON_SIZE / 2).toFixed(1)}" r="${ICON_SIZE / 2}" fill="#${hex}" opacity="0.6"/>`;

            const nameSvg = `<text x="${(ix + ICON_SIZE / 2).toFixed(1)}" y="${(iy + ICON_SIZE + 11).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8" font-family="Arial, sans-serif">${clamp(tech.name, 8)}</text>`;

            return `${iconSvg}${nameSvg}`;
        }).join('');

        return `
    <rect x="${cardX}" y="${cardY}" width="${CARD_W}" height="${CARD_H}" fill="rgba(255,255,255,0.03)" rx="8" stroke="${s.color}" stroke-opacity="0.25" stroke-width="1"/>
    <rect x="${cardX}" y="${cardY}" width="${CARD_W}" height="${CARD_HEADER_H}" fill="${s.color}" fill-opacity="0.15" rx="8"/>
    <rect x="${cardX}" y="${cardY + CARD_HEADER_H - 4}" width="${CARD_W}" height="4" fill="${s.color}" fill-opacity="0.15"/>
    <text x="${cardX + 16}" y="${cardY + CARD_HEADER_H / 2}" dominant-baseline="middle" fill="${s.color}" font-size="12" font-weight="bold" letter-spacing="1" font-family="Arial, sans-serif">${s.label.toUpperCase()}</text>
    <text x="${cardX + CARD_W - 12}" y="${cardY + CARD_HEADER_H / 2}" text-anchor="end" dominant-baseline="middle" fill="rgba(255,255,255,0.25)" font-size="10" font-family="Arial, sans-serif">${s.techs.length} techs</text>
    ${icons}`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="tc-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#tc-bg)" rx="12"/>
    <text x="${W / 2}" y="36" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="17" font-weight="bold" letter-spacing="4" font-family="Arial, sans-serif">TECH STACK</text>
    <line x1="${W / 2 - 90}" y1="50" x2="${W / 2 + 90}" y2="50" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    ${cards}
</svg>`;
};

export { renderTechCards };
export default renderTechCards;
