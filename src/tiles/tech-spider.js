const clamp = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;

const iconEl = (lang, x, y, size) => {
    const scale = (size / 24).toFixed(4);
    const hex = lang.hex || '888888';
    return lang.icon
        ? `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scale})"><path d="${lang.icon.path}" fill="#${hex}"/></g>`
        : `<circle cx="${(x + size / 2).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${size / 2}" fill="#${hex}" opacity="0.6"/>`;
};

/**
 * Renders the inner elements of a spider chart into a given layout space.
 * Returns an SVG fragment (no <svg> wrapper) so it can be embedded anywhere.
 *
 * @param {Array<{ label, color, techs }>} series
 * @param {string} title
 * @param {{ cx, cy, R, iconOffset, iconSize, labelSize, titleX, titleY, titleSize, legendY, canvasW }} layout
 */
const renderSpiderCore = (series, title, layout) => {
    const {
        cx, cy, R,
        iconOffset, iconSize, labelSize = 10,
        titleX, titleY, titleSize = 17,
        legendY, canvasW,
    } = layout;

    const axisMap = new Map();
    series.forEach((s, si) => {
        s.techs.forEach(t => {
            if (!axisMap.has(t.name)) axisMap.set(t.name, { tech: t, si });
        });
    });
    const axes = [...axisMap.values()];
    const n = axes.length;
    if (n < 3) return `<text x="${cx}" y="${cy}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="11" font-family="Arial, sans-serif">Not enough data</text>`;

    const axisAngle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;

    const gridRings = [0.25, 0.5, 0.75, 1.0].map(frac => {
        const pts = axes.map((_, i) => {
            const a = axisAngle(i), r = R * frac;
            return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,${frac === 1 ? 0.15 : 0.07})" stroke-width="1"/>`;
    }).join('\n');

    const spokes = axes.map((_, i) => {
        const a = axisAngle(i);
        return `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
    }).join('\n');

    const polygons = series.map(s => {
        const maxCount = Math.max(...s.techs.map(t => t.count), 1);
        const techByName = new Map(s.techs.map(t => [t.name, t]));

        const pts = axes.map((_, i) => {
            const tech = techByName.get(axes[i].tech.name);
            const r = tech ? R * (tech.count / maxCount) : 0;
            const a = axisAngle(i);
            return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(' ');

        const dots = axes.map((_, i) => {
            const tech = techByName.get(axes[i].tech.name);
            if (!tech) return '';
            const r = R * (tech.count / maxCount);
            const a = axisAngle(i);
            return `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="3" fill="${s.color}" stroke="#0d1117" stroke-width="1.5"/>`;
        }).join('');

        return `<polygon points="${pts}" fill="${s.color}" fill-opacity="0.15" stroke="${s.color}" stroke-width="1.5" stroke-linejoin="round"/>
${dots}`;
    }).join('\n');

    const axisLabels = axes.map(({ tech }, i) => {
        const a = axisAngle(i);
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const iCx = cx + iconOffset * cosA;
        const iCy = cy + iconOffset * sinA;
        const anchor = cosA > 0.2 ? 'start' : cosA < -0.2 ? 'end' : 'middle';
        const nameOff = iconSize / 2 + 4;
        const nx = (iCx + nameOff * cosA).toFixed(1);
        const ny = (iCy + nameOff * sinA).toFixed(1);
        const baseline = sinA > 0.2 ? 'hanging' : sinA < -0.2 ? 'auto' : 'middle';
        return `${iconEl(tech, iCx - iconSize / 2, iCy - iconSize / 2, iconSize)}
<text x="${nx}" y="${ny}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="rgba(255,255,255,0.75)" font-size="${labelSize}" font-family="Arial, sans-serif">${clamp(tech.name, 12)}</text>`;
    }).join('\n');

    const legendItemW = Math.min(110, canvasW / Math.max(series.length, 1));
    const totalLegendW = series.length * legendItemW;
    const legendStartX = cx - totalLegendW / 2;

    const legend = series.map((s, i) => {
        const lx = legendStartX + i * legendItemW;
        return `<circle cx="${(lx + 6).toFixed(1)}" cy="${legendY}" r="5" fill="${s.color}" fill-opacity="0.7"/>
<text x="${(lx + 16).toFixed(1)}" y="${legendY}" dominant-baseline="middle" fill="rgba(255,255,255,0.6)" font-size="${labelSize}" font-family="Arial, sans-serif">${s.label}</text>`;
    }).join('\n');

    const titleUnderline = `<line x1="${titleX - 60}" y1="${titleY + 10}" x2="${titleX + 60}" y2="${titleY + 10}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;

    return `<text x="${titleX}" y="${titleY}" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="${titleSize}" font-weight="bold" letter-spacing="3" font-family="Arial, sans-serif">${title.toUpperCase()}</text>
${titleUnderline}
${gridRings}
${spokes}
${polygons}
${axisLabels}
${legend}`;
};

/**
 * Renders a full 800×800 standalone spider chart SVG.
 */
const renderTechSpider = (series, title = 'TECH RADAR') => {
    const W = 800, H = 800;
    const core = renderSpiderCore(series, title, {
        cx: W / 2, cy: H / 2 + 10,
        R: 210, iconOffset: 242, iconSize: 24, labelSize: 10,
        titleX: W / 2, titleY: 44, titleSize: 17,
        legendY: H - 36, canvasW: W,
    });

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="ts-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#ts-bg)" rx="12"/>
    ${core}
</svg>`;
};

export { renderTechSpider, renderSpiderCore };
export default renderTechSpider;
