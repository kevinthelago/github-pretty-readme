class Readme {
    constructor({
        title = "",
        tiles = []
    }) {
        this.title = title
        this.tiles = tiles
    }

    renderSummary() {

    }

    renderLanguages() {

    }

    render(badges, hero) {
        return `
            ${badges}
            
            # ${title}

            ${hero}
        `
    }
}

export { Readme };
export default Readme;
