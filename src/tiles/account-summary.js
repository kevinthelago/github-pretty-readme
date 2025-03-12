import Tile from "../common/Tile.js";

const chunkText = (text, length) => {
    const words = text.split(/\s+/);
    let chunks = [];
    let currentChunk = "";

    words.forEach(word => {
        if ((currentChunk + word).length > length) {
            chunks.push(currentChunk);
            currentChunk = word;
        } else {
            currentChunk += " " + word;
        }
    })

    chunks.filter(chunk => chunk.length > 0);
    return chunks;
}

const renderAccountSummary = (text, background) => {
    const height = 540;
    const width = 960;
    const fontSize = 28;
    const maxLength = 100;
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
            ${text.split("\n").map((line, i) => {
                let chunks = chunkText(line, maxLength);
                return chunks.map((chunk, j) => {
                    return(`
                        <text x="${width / 2}" y="${(1 + (chunks.length * i) + j) * fontSize}" text-anchor='middle' class='account-summary-text' height="100%">
                            ${chunk}
                        </text>
                    `)
                })
            }).join("")}
        </svg>
    `);
}

export { renderAccountSummary };
export default renderAccountSummary;
