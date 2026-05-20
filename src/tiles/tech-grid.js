import { renderSpiderCore } from './tech-spider.js';

const CANVAS_W = 800;

/**
 * Renders multiple spider charts in a grid layout as a single SVG.
 * Each series entry becomes one cell — its label is used as the cell title.
 *
 * @param {Array<{ label, color, techs }>} series  One entry per category.
 * @param {string} _title  Unused (each cell uses its own label).
 * @param {{ columns?: number }} opts
 */
const renderTechGrid = (series, _title, { columns = 2 } = {}) => {
    const cols  = Math.min(columns, series.length) || 1;
    const rows  = Math.ceil(series.length / cols);
    const cellW = CANVAS_W / cols;
    const cellH = Math.round(cellW * 1.05);   // slightly taller than wide
    const H     = rows * cellH;

    // Scale layout params proportionally to cell size
    const R          = Math.round(cellW * 0.30);
    const iconOffset = R + Math.round(cellW * 0.055);
    const iconSize   = Math.max(12, Math.round(cellW * 0.038));
    const labelSize  = Math.max(8, Math.round(cellW * 0.022));
    const titleSize  = Math.max(10, Math.round(cellW * 0.030));

    const cells = series.map((s, i) => {
        const col   = i % cols;
        const row   = Math.floor(i / cols);
        const ox    = col * cellW;         // cell origin x
        const oy    = row * cellH;         // cell origin y
        const cx    = ox + cellW / 2;
        const cy    = oy + cellH / 2 + Math.round(cellH * 0.04);

        const core = renderSpiderCore([s], s.label, {
            cx, cy,
            R, iconOffset, iconSize, labelSize,
            titleX: cx,
            titleY: oy + Math.round(cellH * 0.07),
            titleSize,
            legendY: oy + cellH - Math.round(cellH * 0.05),
            canvasW: cellW,
        });

        const border = (col < cols - 1 || row < rows - 1)
            ? `<line x1="${ox + cellW}" y1="${oy}" x2="${ox + cellW}" y2="${oy + cellH}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
<line x1="${ox}" y1="${oy + cellH}" x2="${ox + cellW}" y2="${oy + cellH}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`
            : '';

        return `<g>${border}
${core}
</g>`;
    });

    return `<svg width="${CANVAS_W}" height="${H}" viewBox="0 0 ${CANVAS_W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="tg-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
    </defs>
    <rect width="${CANVAS_W}" height="${H}" fill="url(#tg-bg)" rx="12"/>
    ${cells.join('\n    ')}
</svg>`;
};

export { renderTechGrid };
export default renderTechGrid;
