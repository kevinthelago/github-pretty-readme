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
                .geometric-background {--s:200px; --c1: #1d1d1d; --c2: #4e4f51; --c3: #3c3c3c; height: 100%; background: repeating-conic-gradient(from 30deg, #0000 0 120deg, var(--c3) 0 50%) calc(var(--s) / 2) calc(var(--s)* tan(30deg) / 2), repeating-conic-gradient(from 30deg, var(--c1) 0 60deg, var(--c2) 0 120deg, var(--c3) 0 50%); background-size: var(--s) calc(var(--s)* tan(30deg));}
            </style>
            <foreignObject width="${width}" height="${height}">
                <div height="${height}" xmlns="http://www.w3.org/1999/xhtml" class="geometric-background">

                </div>
            </foreignObject>
            <g fill="white">
                ${body}
            </g>
        </svg>
    `
}

export { renderGeometric };
export default renderGeometric;
