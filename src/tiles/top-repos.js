import { THEME_CSS } from './theme.js';
import { renderRepoCard } from './repo-card.js';

// Dimensions of a single repo card (must match src/tiles/repo-card.js).
const CARD_W = 460;
const CARD_H = 200;
const GAP = 16;

/** Clamps the column count to a sensible 1–3 range (default 2). */
const clampColumns = (value) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 1) return 2;
    return Math.min(n, 3);
};

/**
 * Renders the empty state — a single card-sized, theme-aware tile shown when a
 * user has no repositories to showcase (e.g. all repos are forks).
 * @returns {string} SVG document
 */
const renderEmpty = () =>
    `<svg width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No repositories to show">
    ${THEME_CSS}
    <rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="12" fill="var(--bg2)" stroke="var(--fg15)"/>
    <text x="${CARD_W / 2}" y="${CARD_H / 2}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-family="Arial, sans-serif" fill="var(--fg60)">No repositories to show</text>
</svg>`;

/**
 * Renders a showcase grid of repository cards as a single self-contained,
 * theme-aware SVG. Each cell reuses {@link renderRepoCard}; cards are laid out
 * left-to-right, top-to-bottom in `columns` columns. Light/dark is handled by
 * the per-card THEME_CSS via prefers-color-scheme — no theme argument.
 *
 * @param {Array<object>} [cards]  card-data objects in the shape renderRepoCard expects
 * @param {object} [opts]
 * @param {number} [opts.columns]  columns in the grid (1–3, default 2)
 * @param {number} [opts.now]      reference time (epoch ms) forwarded to each card
 * @returns {string} SVG document
 */
export const renderTopRepos = (cards = [], opts = {}) => {
    if (!Array.isArray(cards) || cards.length === 0) return renderEmpty();

    const now = opts.now ?? Date.now();
    const cols = Math.min(clampColumns(opts.columns), cards.length);
    const rows = Math.ceil(cards.length / cols);
    const width = cols * CARD_W + (cols - 1) * GAP;
    const height = rows * CARD_H + (rows - 1) * GAP;

    const cells = cards
        .map((card, i) => {
            const x = (i % cols) * (CARD_W + GAP);
            const y = Math.floor(i / cols) * (CARD_H + GAP);
            return `    <g transform="translate(${x}, ${y})">${renderRepoCard(card, { now })}</g>`;
        })
        .join('\n');

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top repositories">
${cells}
</svg>`;
};

export { clampColumns, CARD_W, CARD_H, GAP };
export default renderTopRepos;
