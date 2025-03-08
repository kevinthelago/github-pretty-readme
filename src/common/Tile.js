class Tile {
    constructor({
        height = 540,
        width = 960
    }) {
        this.height = height;
        this.width = width;
        this.css = "";
    }

    setCss(value) {
        this.css = value;
    }

    setBackground(background) {
        this.background = background
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
                    ${this.background ? background(body) : body}
                </g>
            </svg>
        `
    }
}

export { Tile };
export default Tile;