const renderVaporWave = (height, width) => {
    return(`
        <svg
            height="${height}"
            width="${width}"
            viewBox="0 0 ${width} ${height}"
            class="vapor-wave-background"
        >
            <style>
                .vapor-wave-background {     perspective: 200px;    --yellow-hex: #FFFF00;    --yellow-rgb: 255, 255, 0;    --blaze-orange-hex: #FF5C00;    --blaze-orange-rgb: 255, 92, 0;    --primary-color-hex: var(--cyan-hex);    --primary-color-rgb: var(--cyan-rgb);    --secondary-color-hex: var(--magenta-hex);    --secondary-color-rgb: var(--magenta-rgb);    --primary-background-color-hex: var(--black-rock-hex);    --primary-background-color-rgb: var(--black-rock-rgb);    --secondary-background-color-hex: var(--blue-hex);    --secondary-background-color-rgb: var(--blue-rgb);    --cyan-hex: #00FFFF;    --cyan-rgb: 0, 255, 255;    --black-rock-hex: #130230;    --black-rock-rgb: 19, 2, 48;    --magenta-hex: #FF00FF;    --magenta-rgb: 255, 0, 255    --blue-hex: #0000FF;    --blue-rgb: 0, 0, 255;}
                #sun {    box-shadow: 0 0 5px 5px linear-gradient(to bottom, var(--yellow-hex) 2px, var(--secondary-color-hex)); position: absolute;    aspect-ratio: 1/1;    width: auto;    top: 15%;    height: 50%;    background: linear-gradient(to bottom, var(--yellow-hex) 2px, var(--secondary-color-hex));    border-radius: 50%;}
                .sun-bar {    position: absolute;    background-color: var(--primary-background-color-hex);    top: calc(50% + (5% * var(--n)));    height: calc(3px * var(--n));    width: 100%;}
                #grid {    position: absolute;    top: 20%;    left: calc(-150% - 1px);    height: calc(100% - 2px);    width: calc(400% - 2px);    aspect-ratio: auto;    background-size: 2.5% 2.5%;    background-image: linear-gradient(to right, var(--secondary-color-hex) 2px, transparent 2px),        linear-gradient(to bottom, var(--secondary-color-hex) 2px, var(--primary-background-color-hex) 2px);    animation: scroll 30s linear infinite;    transform: rotateX(80deg);    border: 1px solid var(--secondary-color-hex);}
                @keyframes scroll {    0% {        background-position: 0% 0%;    }    100% {        background-position: 0% 100%;    }}
            </style>
            <foreignObject style="background: var(--primary-background-color-hex);" width="${width}" height="${height}">
                <div height="${height}" id="sun" xmlns="http://www.w3.org/1999/xhtml">
                    <div class="sun-bar" style="--n: 1"></div>
                    <div class="sun-bar" style="--n: 2"></div>
                    <div class="sun-bar" style="--n: 3"></div>
                    <div class="sun-bar" style="--n: 4"></div>
                    <div class="sun-bar" style="--n: 5"></div>
                    <div class="sun-bar" style="--n: 6"></div>
                    <div class="sun-bar" style="--n: 7"></div>
                    <div class="sun-bar" style="--n: 8"></div>
                    <div class="sun-bar" style="--n: 9"></div>
                </div>
                <div height="${height}" id="grid" xmlns="http://www.w3.org/1999/xhtml"></div>
            </foreignObject>
        </svg>
    `)
}

export { renderVaporWave }
export default renderVaporWave
