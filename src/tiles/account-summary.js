import Tile from "../common/Tile.js";

const renderAccountSummary = (text, background) => {
    const height = 540;
    const width = 960;
    const fontSize = 28;
    let tile = new Tile(height, width);
    tile.setCss(`
        .account-summary-text { font-family: arial; text-align: center;}
    `);
    tile.setBackground(background);

    return tile.render(`
        <svg
            height="${height}"
            width="${width}"
            viewBox="0 0 ${width} ${height}"
        >
            ${text.split("\n").map((line, index) => {
                return (`
                    <text y="${(index + 1) * fontSize}" class='account-summary-text' height="100%">
                        ${line}
                    </text>
                `)
            }).join("")}
        </svg>
    `);
}

export { renderAccountSummary };
export default renderAccountSummary;
