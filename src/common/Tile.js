class Tile {
    constructor({
        height = 1080,
        width = 1920
    }) {
        this.height = height;
        this.width = width
    }

    render(body) {
        return `
            <svg
                height="${this.height}"
                width="${this.width}"
                viewBox="0 0 ${this.width} ${this.height}"
            >
                ${body}
            </svg>
        `
    }
}

export { Tile };
export default Tile;