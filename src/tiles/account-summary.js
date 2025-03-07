import Tile from "../common/Tile.js";

const renderAccountSummary = (text) => {
    let tile = new Tile(540, 960);
    tile.setCss(`
        
    `);

    return tile.render(`
            <text>
                ${text}
            </text>
    `);
}

export { renderAccountSummary };
export default renderAccountSummary;
