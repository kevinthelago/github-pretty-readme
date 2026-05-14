import Tile from "../common/Tile.js";

const ICON_SIZE = 64;
const ICON_GAP = 16;
const EDGE_PAD = 48;

const renderIcon = (icon, x, y) => {
    const innerSize = ICON_SIZE - 16;
    const innerOffset = 8;
    return `
        <g transform="translate(${x}, ${y})">
            <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="10" fill="#1e1e2e" opacity="0.85"/>
            <svg x="${innerOffset}" y="${innerOffset}" width="${innerSize}" height="${innerSize}" viewBox="0 0 24 24">
                <path fill="#${icon.hex}" d="${icon.path}"/>
            </svg>
        </g>
    `;
};

const renderTechSummary = (icons, background) => {
    const height = 540;
    const width = 960;
    const tile = new Tile({ height, width });
    tile.setBackground(background);

    const availableWidth = width - EDGE_PAD * 2;
    const iconsPerRow = Math.floor((availableWidth + ICON_GAP) / (ICON_SIZE + ICON_GAP));
    const rows = Math.ceil(icons.length / iconsPerRow);
    const gridHeight = rows * (ICON_SIZE + ICON_GAP) - ICON_GAP;
    const startY = (height - gridHeight) / 2;

    const body = icons.map((icon, i) => {
        const row = Math.floor(i / iconsPerRow);
        const col = i % iconsPerRow;
        const iconsInRow = row === rows - 1 ? icons.length - row * iconsPerRow : iconsPerRow;
        const rowWidth = iconsInRow * (ICON_SIZE + ICON_GAP) - ICON_GAP;
        const startX = (width - rowWidth) / 2;
        const x = startX + col * (ICON_SIZE + ICON_GAP);
        const y = startY + row * (ICON_SIZE + ICON_GAP);
        return renderIcon(icon, x, y);
    }).join('');

    return tile.render(body);
};

export { renderTechSummary };
export default renderTechSummary;
