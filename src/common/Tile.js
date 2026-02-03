class Tile {
    constructor({
        height = 540,
        width = 960
    }) {
        this.height = height;
        this.width = width;
        this.css = "";
        this.background = {};
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
                xmlns="http://www.w3.org/2000/svg"
                role="img"
            >
                <style>
                    ${this.css}
                </style>
                <g>
                    ${this.background ? this.background(this.height, this.width) : ""}
                </g>
                <g>
                    ${body}
                </g>
            </svg>
        `
    }
}

export { Tile };
export default Tile;