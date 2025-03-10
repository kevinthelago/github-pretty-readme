const renderGeometric = (body, properties) => {
    const { height, width } = properties;

    return `
        <svg 
            height="${height}"
            width="${width}"
            viewBox="0 0 ${width} ${height}"
            class="geometric-background"
        >
            <style>
                .geometric-background {--c1: #1d1d1d; --c2: #4e4f51; --c3: #3c3c3c; background: repeating-conic-gradient(from 30deg, #0000 0 120deg, var(--c3) 0 50%) calc(var(--s) / 2) calc(var(--s)* tan(30deg) / 2), repeating-conic-gradient(from 30deg, var(--c1) 0 60deg, var(--c2) 0 120deg, var(--c3) 0 50%); background-size: var(--s) calc(var(--s)* tan(30deg));}
            </style>
            <g>
                ${body}
            </g>
        </svg>
    `
}

export { renderGeometric };
export default renderGeometric;
