import Tile from '../common/Tile.js';

const CELL = 11;   // side length of a single day square
const GAP = 3;     // gap between day squares
const RADIUS = 2;  // corner radius of a day square
const COLS = 53;   // GitHub returns up to 53 weeks

const GRID_X = 36;
const GRID_Y = 120;

const WIDTH = GRID_X * 2 + COLS * (CELL + GAP);  // ~824
const HEIGHT = 300;

/**
 * Compute contribution streaks from a chronological list of days.
 *
 * The current streak counts back from the most recent day; a zero-contribution
 * final day (i.e. "today, not yet contributed") does not break the streak — it
 * is skipped, matching GitHub's own streak semantics.
 *
 * @param {Array<{contributionCount:number}>} days - Days in chronological order.
 * @returns {{current:number, longest:number}}
 */
export const computeStreaks = (days) => {
    let longest = 0;
    let run = 0;
    for (const day of days) {
        if (day.contributionCount > 0) {
            run += 1;
            if (run > longest) longest = run;
        } else {
            run = 0;
        }
    }

    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].contributionCount > 0) {
            current += 1;
        } else if (i === days.length - 1) {
            continue; // most recent day has no contributions yet — don't break the streak
        } else {
            break;
        }
    }

    return { current, longest };
};

const fmt = (n) => n.toLocaleString('en-US');

const statBlock = (x, value, label) => `
    <text x="${x}" y="${HEIGHT - 46}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#ffffff">${value}</text>
    <text x="${x}" y="${HEIGHT - 26}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" letter-spacing="1" fill="rgba(255,255,255,.8)">${label}</text>`;

/**
 * Render a contribution heatmap tile: a 53×7 calendar grid plus total,
 * current-streak and longest-streak figures.
 *
 * Day squares are coloured with the `color` GitHub supplies per day. A
 * translucent panel sits behind the content so text stays legible over any of
 * the themed backgrounds (consistent with the account-summary tile).
 *
 * @param {{totalContributions:number, weeks:Array<{contributionDays:Array<{weekday:number,contributionCount:number,color:string}>}>}} calendar
 * @param {(height:number,width:number)=>string} [background] - Optional background renderer.
 * @param {{username?:string}} [opts]
 * @returns {string} SVG document.
 */
export const renderContributionGraph = (calendar, background, { username = '' } = {}) => {
    const weeks = calendar?.weeks ?? [];
    const days = weeks.flatMap((w) => w.contributionDays);
    const { current, longest } = computeStreaks(days);
    const total = calendar?.totalContributions ?? 0;

    const cells = weeks
        .map((week, wi) =>
            week.contributionDays
                .map((day) => {
                    const x = GRID_X + wi * (CELL + GAP);
                    const y = GRID_Y + day.weekday * (CELL + GAP);
                    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="${RADIUS}" ry="${RADIUS}" fill="${day.color}"/>`;
                })
                .join(''),
        )
        .join('');

    const heading = username ? `@${username}` : 'Contributions';
    const panelW = WIDTH - 24;

    const tile = new Tile({ height: HEIGHT, width: WIDTH });
    tile.setBackground(background);

    const body = `
        <rect x="12" y="12" width="${panelW}" height="${HEIGHT - 24}" rx="14" fill="rgba(13,17,23,.78)"/>
        <text x="${GRID_X}" y="48" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">${heading}</text>
        <text x="${GRID_X}" y="72" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,.7)">${fmt(total)} contributions in the last year</text>
        ${cells}
        ${statBlock(WIDTH * 0.5, fmt(current), 'CURRENT STREAK')}
        ${statBlock(WIDTH * 0.78, fmt(longest), 'LONGEST STREAK')}
    `;

    return tile.render(body);
};

export default renderContributionGraph;
