const clamp = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;

/**
 * Renders a two-level treemap SVG.
 * Level 1: categories as vertical columns, width ∝ category total count.
 * Level 2: techs as stacked tiles within each column, height ∝ tech count.
 *
 * @param {Array<{ label, color, techs: [{ name, count, icon, hex }] }>} series
 */
const renderTechTreemap = (series) => {
    const W = 960, H = 600;
    const TITLE_H = 60, COL_HEADER_H = 30;
    const TILE_TOP = TITLE_H + COL_HEADER_H;
    const TILE_H = H - TILE_TOP;

    const totals = series.map(s => s.techs.reduce((a, t) => a + t.count, 0));
    const grand = totals.reduce((a, t) => a + t, 0) || 1;

    // Build columns with pixel positions
    let curX = 0;
    const columns = series.map((s, i) => {
        const colW = Math.round((totals[i] / grand) * W);
        let curY = TILE_TOP;
        const catTotal = totals[i] || 1;

        const tiles = s.techs.map(tech => {
            const tileH = Math.round((tech.count / catTotal) * TILE_H);
            const tile = { x: curX, y: curY, w: colW, h: tileH, tech, color: s.color };
            curY += tileH;
            return tile;
        });

        const col = { x: curX, w: colW, label: s.label, color: s.color, tiles };
        curX += colW;
        return col;
    });

    // Column dividers
    const dividers = columns.slice(0, -1).map(col =>
        `<line x1="${col.x + col.w}" y1="${TITLE_H}" x2="${col.x + col.w}" y2="${H}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`
    ).join('\n    ');

    // Category header bars
    const headers = columns.map(col => `
    <rect x="${col.x}" y="${TITLE_H}" width="${col.w}" height="${COL_HEADER_H}" fill="${col.color}" opacity="0.18"/>
    <text x="${col.x + col.w / 2}" y="${TITLE_H + COL_HEADER_H / 2}" text-anchor="middle" dominant-baseline="middle" fill="${col.color}" font-size="11" font-weight="bold" letter-spacing="1" font-family="Arial, sans-serif">${col.label.toUpperCase()}</text>`
    ).join('');

    // Tech tiles
    const tiles = columns.flatMap(col => col.tiles.map(tile => {
        const showContent = tile.h >= 32 && tile.w >= 60;
        const ICON_SIZE = Math.min(22, tile.h - 10);
        const PAD = 10;
        const iconX = tile.x + PAD;
        const iconY = tile.y + (tile.h - ICON_SIZE) / 2;
        const scale = (ICON_SIZE / 24).toFixed(3);

        const iconSvg = showContent && tile.tech.icon
            ? `<g transform="translate(${iconX.toFixed(1)},${iconY.toFixed(1)}) scale(${scale})"><path d="${tile.tech.icon.path}" fill="white" opacity="0.75"/></g>`
            : '';

        const nameX = tile.x + PAD + (tile.tech.icon && showContent ? ICON_SIZE + 8 : 0);
        const nameSvg = showContent
            ? `<text x="${nameX.toFixed(1)}" y="${(tile.y + tile.h / 2).toFixed(1)}" dominant-baseline="middle" fill="rgba(255,255,255,0.85)" font-size="11" font-family="Arial, sans-serif">${clamp(tile.tech.name, 14)}</text>`
            : '';

        const countSvg = showContent && tile.h >= 44 && tile.w >= 110
            ? `<text x="${(tile.x + tile.w - 8).toFixed(1)}" y="${(tile.y + tile.h / 2).toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="rgba(255,255,255,0.35)" font-size="10" font-family="Arial, sans-serif">${tile.tech.count}</text>`
            : '';

        return `
    <rect x="${(tile.x + 1).toFixed(1)}" y="${(tile.y + 1).toFixed(1)}" width="${(tile.w - 2).toFixed(1)}" height="${(tile.h - 2).toFixed(1)}" fill="${tile.color}" opacity="0.15" rx="2"/>
    ${iconSvg}${nameSvg}${countSvg}`;
    })).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="tt-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#tt-bg)" rx="12"/>
    <text x="${W / 2}" y="36" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="17" font-weight="bold" letter-spacing="4" font-family="Arial, sans-serif">TECH STACK</text>
    <line x1="${W / 2 - 90}" y1="50" x2="${W / 2 + 90}" y2="50" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    ${dividers}
    ${tiles}
    ${headers}
</svg>`;
};

export { renderTechTreemap };
export default renderTechTreemap;
