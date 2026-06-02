import { THEME_CSS } from './theme.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const W = 860;
const H = 360;
const PAD = 28;
const LABEL_W = 44;
const TITLE_H = 64;
const GRID_X = PAD + LABEL_W;
const GRID_Y = TITLE_H;
const HOUR_LABEL_H = 18;
const GRID_W = W - GRID_X - PAD;
const GRID_H = H - GRID_Y - PAD - HOUR_LABEL_H;
const CELL_W = GRID_W / 24;
const CELL_H = GRID_H / 7;
const CELL_GAP = 1.5;

const HEAT = '#39d353';

const formatHour = (hour) => {
    const period = hour < 12 ? 'am' : 'pm';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return h12 + period;
};

const bucketActivity = (timestamps) => {
    const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const dayTotals = new Array(7).fill(0);
    const hourTotals = new Array(24).fill(0);
    let max = 0;
    let total = 0;
    let busiestCell = { day: 0, hour: 0, count: 0 };

    for (const ts of timestamps || []) {
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) continue;
        const day = d.getUTCDay();
        const hour = d.getUTCHours();
        const count = ++matrix[day][hour];
        dayTotals[day]++;
        hourTotals[hour]++;
        total++;
        if (count > max) max = count;
        if (count > busiestCell.count) busiestCell = { day, hour, count };
    }

    const argmax = (arr) => arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);

    return {
        matrix,
        max,
        total,
        busiestDay: argmax(dayTotals),
        busiestHour: argmax(hourTotals),
        busiestCell,
    };
};

const escapeXml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const renderActivityClock = (timestamps, background, opts = {}) => {
    const { matrix, max, total, busiestDay, busiestHour, busiestCell } = bucketActivity(timestamps);
    const sep = ' · ';
    const who = opts.username ? sep + escapeXml(opts.username) : '';

    const backgroundLayer = typeof background === 'function'
        ? '<g>' + background(H, W) + '</g>'
        : '';

    const header = [
        '<text x="' + PAD + '" y="30" style="fill:var(--fg)" font-size="20" font-weight="bold" font-family="Arial, sans-serif">When I Code' + who + '</text>',
        '<text x="' + PAD + '" y="50" style="fill:var(--fg60)" font-size="12" font-family="Arial, sans-serif">Coding activity by day &amp; hour (UTC)</text>',
    ].join('\n    ');

    if (total === 0) {
        return [
            '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img">',
            '    ' + THEME_CSS,
            '    <rect width="' + W + '" height="' + H + '" style="fill:var(--bg)" rx="12"/>',
            '    ' + backgroundLayer,
            '    ' + header,
            '    <text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" style="fill:var(--fg40)" font-size="16" font-family="Arial, sans-serif">No recent contribution activity found</text>',
            '</svg>',
        ].join('\n');
    }

    const dayLabels = DAYS.map((d, i) => {
        const cy = GRID_Y + i * CELL_H + CELL_H / 2;
        return '<text x="' + (GRID_X - 10) + '" y="' + (cy + 3) + '" text-anchor="end" style="fill:var(--fg60)" font-size="11" font-family="Arial, sans-serif">' + d + '</text>';
    }).join('\n    ');

    const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
        const x = GRID_X + h * CELL_W + CELL_W / 2;
        return '<text x="' + x.toFixed(2) + '" y="' + (GRID_Y + GRID_H + 14) + '" text-anchor="middle" style="fill:var(--fg40)" font-size="10" font-family="Arial, sans-serif">' + formatHour(h) + '</text>';
    }).join('\n    ');

    let cells = '';
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const count = matrix[day][hour];
            const x = GRID_X + hour * CELL_W + CELL_GAP / 2;
            const y = GRID_Y + day * CELL_H + CELL_GAP / 2;
            const w = CELL_W - CELL_GAP;
            const h = CELL_H - CELL_GAP;
            const isPeak = day === busiestCell.day && hour === busiestCell.hour;

            if (count === 0) {
                cells += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="2" style="fill:var(--fg06)"/>';
            } else {
                const intensity = 0.25 + 0.75 * (count / max);
                const stroke = isPeak ? ' stroke="var(--fg)" stroke-width="1.5"' : '';
                cells += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="2" fill="' + HEAT + '" fill-opacity="' + intensity.toFixed(3) + '"' + stroke + '><title>' + DAYS_LONG[day] + ' ' + formatHour(hour) + ': ' + count + '</title></rect>';
            }
        }
    }

    const peakDayHour = DAYS_LONG[busiestDay] + sep + formatHour(busiestHour);
    const callout = [
        '<g font-family="Arial, sans-serif">',
        '    <text x="' + (W - PAD) + '" y="26" text-anchor="end" style="fill:var(--fg40)" font-size="10" letter-spacing="1">BUSIEST</text>',
        '    <text x="' + (W - PAD) + '" y="44" text-anchor="end" style="fill:var(--fg)" font-size="13" font-weight="bold">' + peakDayHour + '</text>',
        '</g>',
    ].join('\n    ');

    const peakX = GRID_X + busiestCell.hour * CELL_W + CELL_W / 2;
    const peakLabelY = GRID_Y + busiestCell.day * CELL_H - 4;
    const peakLabel = '<text x="' + peakX.toFixed(2) + '" y="' + peakLabelY.toFixed(2) + '" text-anchor="middle" style="fill:var(--fg85)" font-size="9" font-weight="bold" font-family="Arial, sans-serif">peak ' + busiestCell.count + '</text>';

    return [
        '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img">',
        '    ' + THEME_CSS,
        '    <rect width="' + W + '" height="' + H + '" style="fill:var(--bg)" rx="12"/>',
        '    ' + backgroundLayer,
        '    ' + header,
        '    ' + callout,
        '    ' + dayLabels,
        '    ' + cells,
        '    ' + peakLabel,
        '    ' + hourLabels,
        '</svg>',
    ].join('\n');
};

export { bucketActivity, formatHour };
export default renderActivityClock;
