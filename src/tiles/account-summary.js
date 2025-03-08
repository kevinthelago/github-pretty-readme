import Tile from "../common/Tile.js";

const renderAccountSummary = (text, background) => {
    let tile = new Tile(540, 960);
    tile.setCss(`
        .account-summary-text {
            font-family: arial;
            text-align: center;
        }
    `);
    tile.setBackground(background);

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
