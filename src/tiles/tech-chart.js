const clamp = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;

// ── Shared SVG shell ────────────────────────────────────────────────────────

const shell = (W, H, extraDefs, body) => `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
        <linearGradient id="tc-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#161b22"/>
        </linearGradient>
        ${extraDefs}
    </defs>
    <rect width="${W}" height="${H}" fill="url(#tc-bg)" rx="12"/>
    <text x="${W / 2}" y="46" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="17" font-weight="bold" letter-spacing="4" font-family="Arial, sans-serif">TECH STACK</text>
    <line x1="${W / 2 - 90}" y1="60" x2="${W / 2 + 90}" y2="60" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    ${body}
</svg>`;

// ── Icon helper ─────────────────────────────────────────────────────────────

const iconEl = (lang, x, y, size) => {
    const scale = (size / 24).toFixed(4);
    const hex = lang.hex || '888888';
    return lang.icon
        ? `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scale})"><path d="${lang.icon.path}" fill="#${hex}"/></g>`
        : `<circle cx="${(x + size / 2).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${size / 2}" fill="#${hex}" opacity="0.7"/>`;
};

// ── Donut chart ─────────────────────────────────────────────────────────────

const donutSegmentPath = (cx, cy, R, r, a0, a1) => {
    const cos = Math.cos, sin = Math.sin;
    const x1 = cx + R * cos(a0), y1 = cy + R * sin(a0);
    const x2 = cx + R * cos(a1), y2 = cy + R * sin(a1);
    const x3 = cx + r * cos(a1), y3 = cy + r * sin(a1);
    const x4 = cx + r * cos(a0), y4 = cy + r * sin(a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return [x1, y1, x2, y2, x3, y3, x4, y4]
        .map(n => n.toFixed(2))
        .reduce((_, __, i, a) => i === 0
            ? `M ${a[0]} ${a[1]} A ${R} ${R} 0 ${large} 1 ${a[2]} ${a[3]} L ${a[4]} ${a[5]} A ${r} ${r} 0 ${large} 0 ${a[6]} ${a[7]} Z`
            : _);
};

const renderDonutChart = (langs) => {
    const W = 800, H = 800;
    const top = langs.slice(0, 12);
    const total = top.reduce((s, l) => s + l.count, 0);

    const cx = W / 2, cy = 315, R = 200, r = 112;

    let angle = -Math.PI / 2;
    const segments = top.map(lang => {
        const frac = lang.count / total;
        const sweep = frac * 2 * Math.PI;
        const seg = { ...lang, frac, a0: angle, a1: angle + sweep };
        angle += sweep;
        return seg;
    });

    const segPaths = segments.map(s =>
        `<path d="${donutSegmentPath(cx, cy, R, r, s.a0, s.a1)}" fill="#${s.hex || '888888'}" stroke="#0d1117" stroke-width="2"/>`
    ).join('\n    ');

    const pctLabels = segments.filter(s => s.frac >= 0.07).map(s => {
        const mid = (s.a0 + s.a1) / 2, lr = (R + r) / 2;
        return `<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid)).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial, sans-serif">${Math.round(s.frac * 100)}%</text>`;
    }).join('\n    ');

    const COLS = 6, ICON_SIZE = 36, CELL_W = 110, CELL_H = 80;
    const gridTopY = cy + R + 42;
    const gridLeft = (W - COLS * CELL_W) / 2;

    const grid = top.map((lang, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const cellCx = gridLeft + col * CELL_W + CELL_W / 2;
        const iconY = gridTopY + row * CELL_H;
        return `
    ${iconEl(lang, cellCx - ICON_SIZE / 2, iconY, ICON_SIZE)}
    <text x="${cellCx.toFixed(1)}" y="${(iconY + ICON_SIZE + 14).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="10" font-family="Arial, sans-serif">${clamp(lang.language, 12)}</text>
    <text x="${cellCx.toFixed(1)}" y="${(iconY + ICON_SIZE + 27).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="Arial, sans-serif">${lang.count} repo${lang.count !== 1 ? 's' : ''}</text>`;
    }).join('');

    const body = `
    ${segPaths}
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="12" font-family="Arial, sans-serif">total repos</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="Arial, sans-serif">${total}</text>
    ${pctLabels}
    <line x1="40" y1="${gridTopY - 18}" x2="${W - 40}" y2="${gridTopY - 18}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    ${grid}`;

    return shell(W, H, '', body);
};

// ── Spider / radar chart ─────────────────────────────────────────────────────

const renderSpiderChart = (langs) => {
    const W = 800, H = 800;
    const top = langs.slice(0, 8);
    const n = top.length;
    if (n < 3) return renderDonutChart(langs);

    const cx = W / 2, cy = 430;
    const R = 220;
    const ICON_SIZE = 28;
    const ICON_OFFSET = R + 36;

    const maxCount = Math.max(...top.map(l => l.count));
    const axisAngle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;

    // Grid rings
    const gridRings = [0.25, 0.5, 0.75, 1.0].map(frac => {
        const pts = top.map((_, i) => {
            const a = axisAngle(i), r = R * frac;
            return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,${frac === 1 ? 0.18 : 0.08})" stroke-width="1"/>`;
    }).join('\n    ');

    // Axis lines
    const axisLines = top.map((_, i) => {
        const a = axisAngle(i);
        return `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    }).join('\n    ');

    // Data polygon
    const dataPoints = top.map((lang, i) => {
        const a = axisAngle(i), r = R * (lang.count / maxCount);
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');

    // Vertex dots
    const dots = top.map((lang, i) => {
        const a = axisAngle(i), r = R * (lang.count / maxCount);
        return `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="4" fill="#58a6ff" stroke="#0d1117" stroke-width="1.5"/>`;
    }).join('\n    ');

    // Icons + labels at axis endpoints
    const axisLabels = top.map((lang, i) => {
        const a = axisAngle(i);
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const iCx = cx + ICON_OFFSET * cosA;
        const iCy = cy + ICON_OFFSET * sinA;

        const anchor = cosA > 0.2 ? 'start' : cosA < -0.2 ? 'end' : 'middle';
        const nameOffset = ICON_SIZE / 2 + 6;
        const countOffset = ICON_SIZE / 2 + 18;
        const nx = (iCx + nameOffset * cosA).toFixed(1);
        const ny = (iCy + nameOffset * sinA).toFixed(1);
        const kx = (iCx + countOffset * cosA).toFixed(1);
        const ky = (iCy + countOffset * sinA).toFixed(1);
        const baseline = sinA > 0.2 ? 'hanging' : sinA < -0.2 ? 'auto' : 'middle';

        return `
    ${iconEl(lang, iCx - ICON_SIZE / 2, iCy - ICON_SIZE / 2, ICON_SIZE)}
    <text x="${nx}" y="${ny}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="rgba(255,255,255,0.85)" font-size="10" font-family="Arial, sans-serif">${clamp(lang.language, 12)}</text>
    <text x="${kx}" y="${ky}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="rgba(255,255,255,0.4)" font-size="9" font-family="Arial, sans-serif">${lang.count} repo${lang.count !== 1 ? 's' : ''}</text>`;
    }).join('');

    const defs = `<linearGradient id="spider-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#bc8cff" stop-opacity="0.3"/>
        </linearGradient>`;

    const body = `
    ${gridRings}
    ${axisLines}
    <polygon points="${dataPoints}" fill="url(#spider-fill)" stroke="#58a6ff" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
    ${axisLabels}`;

    return shell(W, H, defs, body);
};

// ── Entry point ─────────────────────────────────────────────────────────────

const renderTechChart = (langs, type = 'donut') =>
    type === 'spider' ? renderSpiderChart(langs) : renderDonutChart(langs);

export { renderTechChart, renderDonutChart, renderSpiderChart };
export default renderTechChart;
