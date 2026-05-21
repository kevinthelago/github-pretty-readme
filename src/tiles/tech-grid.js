import { THEME_CSS } from './theme.js';
import { renderSpiderCore } from './tech-spider.js';

const CELL_W = 400;

/**
 * Renders multiple spider charts in a grid layout as a single SVG.
 * Each series entry becomes one cell — its label is used as the cell title.
 * Adapts to light/dark mode via prefers-color-scheme CSS in the SVG.
 *
 * @param {Array<{ label, color, techs }>} series  One entry per category.
 * @param {string} _title  Unused (each cell uses its own label).
 * @param {{ columns?: number }} opts
 */
const renderTechGrid = (series, _title, { columns = 2 } = {}) => {
    const cols    = Math.min(columns, series.length) || 1;
    const rows    = Math.ceil(series.length / cols);
    const cellW   = CELL_W;
    const CANVAS_W = cols * cellW;
    const cellH   = Math.round(cellW * 1.05);
    const H       = rows * cellH;

    const R          = Math.round(cellW * 0.30);
    const iconOffset = R + Math.round(cellW * 0.055);
    const iconSize   = Math.max(12, Math.round(cellW * 0.038));
    const labelSize  = Math.max(8, Math.round(cellW * 0.022));
    const titleSize  = Math.max(10, Math.round(cellW * 0.030));

    const cells = series.map((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const ox  = col * cellW;
        const oy  = row * cellH;
        const cx  = ox + cellW / 2;
        const cy  = oy + cellH / 2 + Math.round(cellH * 0.04);

        const core = renderSpiderCore([s], s.label, {
            cx, cy,
            R, iconOffset, iconSize, labelSize,
            titleX:  cx,
            titleY:  oy + Math.round(cellH * 0.07),
            titleSize,
            legendY: oy + cellH - Math.round(cellH * 0.05),
            canvasW: cellW,
        });

        const hasRight  = col < cols - 1;
        const hasBottom = row < rows - 1;
        const border = (hasRight || hasBottom) ? `
<line x1="${ox + cellW}" y1="${oy}" x2="${ox + cellW}" y2="${oy + cellH}" style="stroke:var(--fg06)" stroke-width="1"/>
<line x1="${ox}" y1="${oy + cellH}" x2="${ox + cellW}" y2="${oy + cellH}" style="stroke:var(--fg06)" stroke-width="1"/>` : '';

        return `<g>${border}\n${core}\n</g>`;
    });

    return `<svg width="${CANVAS_W}" height="${H}" viewBox="0 0 ${CANVAS_W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <defs>
        <linearGradient id="tg-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" style="stop-color:var(--bg)"/>
            <stop offset="100%" style="stop-color:var(--bg2)"/>
        </linearGradient>
    </defs>
    <rect width="${CANVAS_W}" height="${H}" fill="url(#tg-bg)" rx="12"/>
    ${cells.join('\n    ')}
</svg>`;
};

export { renderTechGrid };
export default renderTechGrid;
