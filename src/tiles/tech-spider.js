const clamp = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;

const iconEl = (lang, x, y, size) => {
    const scale = (size / 24).toFixed(4);
    const hex = lang.hex || '888888';
    return lang.icon
        ? `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scale})"><path d="${lang.icon.path}" fill="#${hex}"/></g>`
        : `<circle cx="${(x + size / 2).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${size / 2}" fill="#${hex}" opacity="0.6"/>`;
};

/**
 * Renders a multi-polygon spider/radar chart.
 *
 * @param {Array<{ label: string, color: string, techs: Array<{ name, count, icon, hex }> }>} series
 *   Each entry becomes one colored polygon. Axes are the union of all techs across all series.
 *   Each series is normalized to its own max so visually comparable even with different scales.
 */
const renderTechSpider = (series) => {
    const W = 800, H = 800;
    const cx = W / 2, cy = H / 2 + 10;
    const R = 210;
    const ICON_SIZE = 24;
    const ICON_OFFSET = R + 32;

    // Collect all axes: each tech appears once, keyed by name.
    // Within each series we normalize to that series' max.
    const axisMap = new Map(); // name → { tech object, seriesIndex }
    series.forEach((s, si) => {
        s.techs.forEach(t => {
            if (!axisMap.has(t.name)) axisMap.set(t.name, { tech: t, si });
        });
    });
    const axes = [...axisMap.values()];
    const n = axes.length;
    if (n < 3) return '<svg xmlns="http://www.w3.org/2000/svg"><text y="20" fill="white">Not enough data</text></svg>';

    const axisAngle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;

    // Grid rings
    const gridRings = [0.25, 0.5, 0.75, 1.0].map(frac => {
        const pts = axes.map((_, i) => {
            const a = axisAngle(i), r = R * frac;
            return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,${frac === 1 ? 0.15 : 0.07})" stroke-width="1"/>`;
    }).join('\n    ');

    // Axis spokes
    const spokes = axes.map((_, i) => {
        const a = axisAngle(i);
        return `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
    }).join('\n    ');

    // One polygon + dots per series
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
            return `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="3.5" fill="${s.color}" stroke="#0d1117" stroke-width="1.5"/>`;
        }).join('');

        return `
    <polygon points="${pts}" fill="${s.color}" fill-opacity="0.15" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>
    ${dots}`;
    }).join('');

    // Icons + labels at axis endpoints
    const axisLabels = axes.map(({ tech }, i) => {
        const a = axisAngle(i);
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const iCx = cx + ICON_OFFSET * cosA;
        const iCy = cy + ICON_OFFSET * sinA;

        const anchor = cosA > 0.2 ? 'start' : cosA < -0.2 ? 'end' : 'middle';
        const nameOff = ICON_SIZE / 2 + 5;
        const nx = (iCx + nameOff * cosA).toFixed(1);
        const ny = (iCy + nameOff * sinA).toFixed(1);
        const baseline = sinA > 0.2 ? 'hanging' : sinA < -0.2 ? 'auto' : 'middle';

        return `
    ${iconEl(tech, iCx - ICON_SIZE / 2, iCy - ICON_SIZE / 2, ICON_SIZE)}
    <text x="${nx}" y="${ny}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="rgba(255,255,255,0.8)" font-size="10" font-family="Arial, sans-serif">${clamp(tech.name, 13)}</text>`;
    }).join('');

    // Legend
    const legendY = H - 36;
    const legendItemW = 120;
    const totalLegendW = series.length * legendItemW;
    const legendStartX = (W - totalLegendW) / 2;

    const legend = series.map((s, i) => {
        const lx = legendStartX + i * legendItemW;
        return `
    <circle cx="${(lx + 8).toFixed(1)}" cy="${legendY}" r="6" fill="${s.color}" fill-opacity="0.7"/>
    <text x="${(lx + 20).toFixed(1)}" y="${legendY}" dominant-baseline="middle" fill="rgba(255,255,255,0.7)" font-size="11" font-family="Arial, sans-serif">${s.label}</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="ts-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#ts-bg)" rx="12"/>
    <text x="${W / 2}" y="44" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="17" font-weight="bold" letter-spacing="4" font-family="Arial, sans-serif">TECH RADAR</text>
    <line x1="${W / 2 - 90}" y1="58" x2="${W / 2 + 90}" y2="58" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    ${gridRings}
    ${spokes}
    ${polygons}
    ${axisLabels}
    ${legend}
</svg>`;
};

export { renderTechSpider };
export default renderTechSpider;
