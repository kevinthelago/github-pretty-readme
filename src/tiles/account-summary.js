import Tile from "../common/Tile.js";

const renderAccountSummary = (text) => {
    let tile = new Tile(540, 960);
    tile.setCss(`

    `);

    return tile.render(`
        <svg>
            <text class='account-summary-text'>
                ${text}
            </text>
        </svg>
    `);
}

export { renderAccountSummary };
export default renderAccountSummary;
