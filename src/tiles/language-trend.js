import { THEME_CSS } from './theme.js';

const W = 820, H = 340;
const PLOT_X0 = 18;
const PLOT_X1 = W - 168;     // leave room for the legend
const PLOT_Y0 = 52;          // below the title
const PLOT_Y1 = H - 56;      // above the x-axis labels + footnote
const PLOT_W = PLOT_X1 - PLOT_X0;
const PLOT_H = PLOT_Y1 - PLOT_Y0;

/** Fallback colours for series whose language has no known brand hex. */
const PALETTE = ['82aaff', 'c3e88d', 'f78c6c', 'c792ea', 'ffcb6b', '89ddff', 'f07178', 'b2ccd6'];

const escapeXml = (s) =>
    String(s).replace(/[<>&"']/g, (c) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

/** Human-readable byte size, e.g. 1536 → "1.5 KB". */
const fmtBytes = (n) => {
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB'];
    let v = n / 1024, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
};

const colorFor = (series, i) => `#${series.hex ?? PALETTE[i % PALETTE.length]}`;

/**
 * Renders a cumulative stacked-area chart of language usage over time as an SVG
 * string. Each series carries its already-cumulative byte total per time bucket;
 * the chart stacks them so the top edge is the running total across all
 * languages. The footnote labels the chart as an approximation derived from repo
 * creation dates, since GitHub exposes no per-commit language history.
 *
 * @param {{ buckets:string[], series:Array<{language:string,hex?:(string|null),values:number[]}>, note?:string }} data
 * @returns {string} a complete theme-aware `<svg>` document.
 */
export const renderLanguageTrend = ({ buckets = [], series = [], note } = {}) => {
    const footnote = note ?? 'Approximate — bucketed by repository creation date';

    if (buckets.length === 0 || series.length === 0) {
        return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <rect width="${W}" height="${H}" rx="12" style="fill:var(--bg2)"/>
    <text x="${W / 2}" y="${H / 2}" text-anchor="middle" style="fill:var(--fg40)" font-size="14" font-family="Arial, sans-serif">No language data available</text>
</svg>`;
    }

    // X positions for each bucket. A single bucket collapses to a flat band, so
    // duplicate it to both edges to keep the area visible.
    const n = buckets.length;
    const xAt = (i) => n === 1 ? PLOT_X0 + PLOT_W / 2 : PLOT_X0 + (i / (n - 1)) * PLOT_W;

    // Peak total across buckets (cumulative ⇒ usually the last bucket).
    const totals = buckets.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
    const maxTotal = Math.max(...totals, 1);
    const yAt = (v) => PLOT_Y1 - (v / maxTotal) * PLOT_H;

    // Stack the series, building one filled polygon per language.
    const baseline = new Array(n).fill(0);
    const areas = series.map((s, si) => {
        const color = colorFor(s, si);
        const topPts = [];
        const botPts = [];
        for (let i = 0; i < n; i++) {
            const x = xAt(i).toFixed(1);
            const top = baseline[i] + (s.values[i] ?? 0);
            topPts.push(`${x},${yAt(top).toFixed(1)}`);
            botPts.push(`${x},${yAt(baseline[i]).toFixed(1)}`);
            baseline[i] = top;
        }
        // For a single bucket, widen the band so the fill is visible.
        if (n === 1) {
            const x0 = PLOT_X0.toFixed(1), x1 = PLOT_X1.toFixed(1);
            const ytop = topPts[0].split(',')[1], ybot = botPts[0].split(',')[1];
            const poly = `${x0},${ytop} ${x1},${ytop} ${x1},${ybot} ${x0},${ybot}`;
            return `<polygon points="${poly}" fill="${color}" fill-opacity="0.75"/>`;
        }
        const points = [...topPts, ...botPts.reverse()].join(' ');
        const topLine = topPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
        return `<polygon points="${points}" fill="${color}" fill-opacity="0.72"/>
    <path d="${topLine}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.9"/>`;
    });

    // X-axis bucket labels (skip some when crowded).
    const labelStep = Math.ceil(n / 8);
    const xLabels = buckets.map((b, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return '';
        return `<text x="${xAt(i).toFixed(1)}" y="${PLOT_Y1 + 18}" text-anchor="middle" style="fill:var(--fg40)" font-size="10" font-family="Arial, sans-serif">${escapeXml(b)}</text>`;
    }).join('');

    // Legend: swatch + language + final cumulative total.
    const finals = series.map((s) => s.values[n - 1] ?? 0);
    const legend = series.map((s, si) => {
        const ly = PLOT_Y0 + 6 + si * 22;
        return `<rect x="${PLOT_X1 + 18}" y="${ly}" width="11" height="11" rx="2" fill="${colorFor(s, si)}"/>
    <text x="${PLOT_X1 + 34}" y="${ly + 10}" style="fill:var(--fg75)" font-size="12" font-family="Arial, sans-serif">${escapeXml(s.language)}</text>
    <text x="${W - 14}" y="${ly + 10}" text-anchor="end" style="fill:var(--fg40)" font-size="10" font-family="Arial, sans-serif">${fmtBytes(finals[si])}</text>`;
    }).join('');

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <defs>
        <linearGradient id="lt-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" style="stop-color:var(--bg)"/>
            <stop offset="100%" style="stop-color:var(--bg2)"/>
        </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#lt-bg)" rx="12"/>
    <text x="${PLOT_X0}" y="30" style="fill:var(--fg)" font-size="16" font-weight="bold" font-family="Arial, sans-serif">Language trend</text>
    <line x1="${PLOT_X0}" y1="${PLOT_Y1}" x2="${PLOT_X1}" y2="${PLOT_Y1}" style="stroke:var(--fg10)" stroke-width="1"/>
    ${areas.join('\n    ')}
    ${xLabels}
    ${legend}
    <text x="${PLOT_X0}" y="${H - 14}" style="fill:var(--fg30)" font-size="10" font-style="italic" font-family="Arial, sans-serif">${escapeXml(footnote)}</text>
</svg>`;
};

export default renderLanguageTrend;
