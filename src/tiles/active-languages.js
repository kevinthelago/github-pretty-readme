import Tile from '../common/Tile.js';
import LANGUAGE_ICON_MAP from '../icons/languages.js';
import * as simpleIcons from 'simple-icons';

/**
 * SVG renderer for the recent/active-languages tile.
 *
 * Draws a donut whose segments are sized by RECENT COMMIT ACTIVITY (the counts
 * produced by src/github/recent-languages.js), with an icon legend underneath.
 * Built on the shared Tile base class so it honours the same width/height and
 * optional themed background as the other tiles.
 */

const WIDTH = 480;
const HEIGHT = 300;
const MAX_SEGMENTS = 8;

const clamp = (str, max) => (str.length > max ? `${str.slice(0, max - 1)}…` : str);

const normalizeForSlug = (lang) => lang.toLowerCase().replace(/[^a-z0-9]/g, '');

const lookupIcon = (lang) => {
    if (LANGUAGE_ICON_MAP[lang]) return LANGUAGE_ICON_MAP[lang];
    const key = `si${normalizeForSlug(lang).replace(/^./, (c) => c.toUpperCase())}`;
    return simpleIcons[key] || null;
};

const TILE_CSS = `
    .al-title { fill: var(--fg, #fff); font: bold 18px 'Segoe UI', Arial, sans-serif; }
    .al-sub   { fill: var(--fg60, rgba(255,255,255,.6)); font: 11px 'Segoe UI', Arial, sans-serif; }
    .al-center-num { fill: var(--fg, #fff); font: bold 26px 'Segoe UI', Arial, sans-serif; }
    .al-center-lbl { fill: var(--fg40, rgba(255,255,255,.4)); font: 10px 'Segoe UI', Arial, sans-serif; }
    .al-leg-name { fill: var(--fg85, rgba(255,255,255,.85)); font: 12px 'Segoe UI', Arial, sans-serif; }
    .al-leg-pct  { fill: var(--fg60, rgba(255,255,255,.6)); font: 11px 'Segoe UI', Arial, sans-serif; }
    .al-empty    { fill: var(--fg60, rgba(255,255,255,.6)); font: 14px 'Segoe UI', Arial, sans-serif; }
`;

const donutSegmentPath = (cx, cy, R, r, a0, a1) => {
    const x1 = cx + R * Math.cos(a0);
    const y1 = cy + R * Math.sin(a0);
    const x2 = cx + R * Math.cos(a1);
    const y2 = cy + R * Math.sin(a1);
    const x3 = cx + r * Math.cos(a1);
    const y3 = cy + r * Math.sin(a1);
    const x4 = cx + r * Math.cos(a0);
    const y4 = cy + r * Math.sin(a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const f = (n) => n.toFixed(2);
    return `M ${f(x1)} ${f(y1)} A ${R} ${R} 0 ${large} 1 ${f(x2)} ${f(y2)} L ${f(x3)} ${f(y3)} A ${r} ${r} 0 ${large} 0 ${f(x4)} ${f(y4)} Z`;
};

const colorFor = (lang, icon) => {
    if (icon && icon.hex) return `#${icon.hex}`;
    // Deterministic fallback colour derived from the language name.
    let hash = 0;
    for (let i = 0; i < lang.length; i += 1) hash = (hash * 31 + lang.charCodeAt(i)) & 0xffffff;
    return `hsl(${hash % 360}, 55%, 55%)`;
};

const iconEl = (icon, color, x, y, size) => {
    if (!icon) {
        return `<circle cx="${(x + size / 2).toFixed(1)}" cy="${(y + size / 2).toFixed(1)}" r="${(size / 2).toFixed(1)}" fill="${color}" opacity="0.8"/>`;
    }
    const scale = (size / 24).toFixed(4);
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scale})"><path d="${icon.path}" fill="${color}"/></g>`;
};

const renderEmpty = (tile, days) => {
    const body = `
        <text x="${WIDTH / 2}" y="40" text-anchor="middle" class="al-title">Active Languages</text>
        <text x="${WIDTH / 2}" y="62" text-anchor="middle" class="al-sub">last ${days} days</text>
        <text x="${WIDTH / 2}" y="${HEIGHT / 2 + 8}" text-anchor="middle" class="al-empty">No recent commit activity</text>
    `;
    return tile.render(body);
};

/**
 * Render the active-languages tile.
 *
 * @param {{ langs: {language: string, count: number}[], totalCommits: number, days: number }} data
 *   weighting result from getRecentLanguageWeights.
 * @param {(height:number,width:number)=>string} [background] - optional themed
 *   background renderer (cherry-blossom / geometric / vapor-wave).
 * @returns {string} a complete SVG document.
 */
const renderActiveLanguages = (data, background) => {
    const tile = new Tile({ height: HEIGHT, width: WIDTH });
    tile.setCss(TILE_CSS);
    // Tile defaults background to {} (truthy but not callable); only set a real
    // renderer, otherwise null so the base class skips the background layer.
    tile.setBackground(typeof background === 'function' ? background : null);

    const days = data?.days ?? 90;
    const all = (data?.langs ?? []).filter((l) => l.count > 0);

    if (all.length === 0) return renderEmpty(tile, days);

    // Collapse the long tail into "Other" so the donut stays readable.
    let segments = all.slice(0, MAX_SEGMENTS);
    const tail = all.slice(MAX_SEGMENTS);
    if (tail.length) {
        segments = [...segments, { language: 'Other', count: tail.reduce((s, l) => s + l.count, 0) }];
    }

    const total = segments.reduce((s, l) => s + l.count, 0);
    const enriched = segments.map((l) => {
        const icon = l.language === 'Other' ? null : lookupIcon(l.language);
        return { ...l, icon, color: colorFor(l.language, icon), frac: l.count / total };
    });

    const cx = 130;
    const cy = 170;
    const R = 92;
    const r = 56;

    let angle = -Math.PI / 2;
    const segPaths = enriched
        .map((s) => {
            const sweep = s.frac * 2 * Math.PI;
            // Guard the full-circle case (a single language) — a 360° arc is degenerate.
            const a1 = enriched.length === 1 ? angle + 2 * Math.PI - 0.0001 : angle + sweep;
            const path = `<path d="${donutSegmentPath(cx, cy, R, r, angle, a1)}" fill="${s.color}" stroke="var(--bg,#0d1117)" stroke-width="2"/>`;
            angle += sweep;
            return path;
        })
        .join('\n        ');

    const legendX = 250;
    const legendTop = 100;
    const rowH = 22;
    const legend = enriched
        .map((s, i) => {
            const y = legendTop + i * rowH;
            const pct = Math.round(s.frac * 100);
            return `
        ${iconEl(s.icon, s.color, legendX, y - 12, 14)}
        <text x="${legendX + 22}" y="${y}" class="al-leg-name">${clamp(s.language, 16)}</text>
        <text x="${WIDTH - 24}" y="${y}" text-anchor="end" class="al-leg-pct">${s.count} · ${pct}%</text>`;
        })
        .join('');

    const body = `
        <text x="24" y="40" class="al-title">Active Languages</text>
        <text x="24" y="60" class="al-sub">by commits · last ${days} days</text>
        ${segPaths}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="al-center-num">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="al-center-lbl">commits</text>
        ${legend}
    `;

    return tile.render(body);
};

export { renderActiveLanguages };
export default renderActiveLanguages;
