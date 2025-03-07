class Tile {
    constructor({
        height = 540,
        width = 960,
        css = ""
    }) {
        this.height = height;
        this.width = width;
        this.css = "";
    }

    setCss(value) {
        this.css = value;
    }

    render(body) {
        return `
            <svg
                height="${this.height}"
                width="${this.width}"
                viewBox="0 0 ${this.width} ${this.height}"
            >
                <style>
                    ${this.css}
                </style>
                <g>
                    ${body}
                </g>
            </svg>
        `
    }
}

export { Tile };
export default Tile;