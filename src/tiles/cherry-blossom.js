import Tile from '../common/Tile.js';


const createLeaf = (i) => {
    return `
        <ellipse
            id="cherry-blossom-leaf-${i}"
            cx="50"
            cy="50"
            rx="40"
            ry="50"
            fill="url(#cherry-blossom-leaf-gradient)"
        >
            <animateTransform
                attributeName="transform"
                begin="0s"
                dur="10s"
                type="rotate"
                from="0 90 100"
                to="360 90 100"
                repeatCount="indefinite" 
            />
        </ellipse>
    `
}


const renderCherryBlossom = () => {
    const tile = new Tile(
        1080, 1920
    )

    return tile.render(`
        <defs>
            <linearGradient id="cherry-blossom-leaf-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="pink" />
                <stop offset="100%" stop-color="white" />
            </lineargradient>
        </defs>
        <g>
            ${createLeaf()}
        </g>
    `);
}

export { renderCherryBlossom };
export default renderCherryBlossom;
