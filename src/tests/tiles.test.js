import { describe, test, expect } from 'vitest';

import { renderAccountSummary } from '../tiles/account-summary.js';
import { renderTechSummary } from '../tiles/tech-summary.js';
import { renderDeveloperRating } from '../tiles/developer-rating.js';
import { renderMonkeytypeChart } from '../tiles/monkeytype-chart.js';
import { renderTechChart, renderDonutChart, renderSpiderChart } from '../tiles/tech-chart.js';
import { renderTechCards } from '../tiles/tech-cards.js';
import { renderTechGrid } from '../tiles/tech-grid.js';
import { renderTechSpider } from '../tiles/tech-spider.js';
import { renderTechTreemap } from '../tiles/tech-treemap.js';
import { renderGeometric } from '../backgrounds/geometric.js';
import { renderVaporWave } from '../backgrounds/vapor-wave.js';
import { renderCherryBlossom } from '../backgrounds/cherry-blossom.js';
import { THEME_CSS } from '../tiles/theme.js';

// ── Shared assertions ────────────────────────────────────────────────────────

/** Every tile renderer must emit a single, reasonably-sized SVG document. */
const expectSvgDocument = (svg) => {
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    // Each <svg opening tag has a matching close.
    const opens = (svg.match(/<svg[\s>]/g) || []).length;
    const closes = (svg.match(/<\/svg>/g) || []).length;
    expect(opens).toBe(closes);
    expect(svg.length).toBeGreaterThan(50);
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ICONS = [
    { hex: 'f7df1e', path: 'M0 0h24v24H0z' },
    { hex: '3776ab', path: 'M1 1h22v22H1z' },
    { hex: 'e34c26', path: 'M2 2h20v20H2z' },
];

const LANGS = [
    { language: 'JavaScript', count: 12, hex: 'f7df1e', icon: { path: 'M0 0h24v24H0z' } },
    { language: 'Python', count: 8, hex: '3776ab', icon: { path: 'M1 1h22v22H1z' } },
    { language: 'TypeScript', count: 5, hex: '3178c6' },
    { language: 'Go', count: 3, hex: '00add8' },
];

const RATING = {
    breadth: 70,
    depth: 65,
    diversity: 80,
    activity: 55,
    impact: 60,
    overall: 66,
    tier: { label: 'B', color: '#82aaff' },
};

const MODES = [
    { duration: '15', wpm: 110, acc: 97.4, consistency: 80 },
    { duration: '30', wpm: 105, acc: 96.1, consistency: 78 },
    { duration: '60', wpm: 98, acc: 95.0, consistency: 75 },
];

const SERIES = [
    {
        label: 'Languages',
        color: '#82aaff',
        techs: [
            { name: 'JavaScript', count: 12, hex: 'f7df1e', icon: { path: 'M0 0h24v24H0z' } },
            { name: 'Python', count: 8, hex: '3776ab' },
            { name: 'Go', count: 4, hex: '00add8' },
        ],
    },
    {
        label: 'Frameworks',
        color: '#c792ea',
        techs: [
            { name: 'Express', count: 6, hex: '000000' },
            { name: 'React', count: 5, hex: '61dafb' },
            { name: 'Vue', count: 3, hex: '4fc08d' },
        ],
    },
];

// ── account-summary ────────────────────────────────────────────────────────────

// A summary long enough (>100 chars) that chunkText pushes at least one chunk —
// see the trailing-chunk note below for why very short summaries render no text.
const SUMMARY =
    'passionate developer building open source tools across many languages and frameworks with a focus on clean maintainable code';

describe('renderAccountSummary', () => {
    test('emits an SVG document containing the summary text and CSS class', () => {
        const svg = renderAccountSummary(SUMMARY, renderGeometric);
        expectSvgDocument(svg);
        expect(svg).toContain('passionate');
        expect(svg).toContain('account-summary-text');
    });

    test('renders without a background function', () => {
        const svg = renderAccountSummary(SUMMARY, undefined);
        expectSvgDocument(svg);
        expect(svg).toContain('account-summary-text');
    });

    test('wraps long summaries into multiple text rows', () => {
        const long = 'word '.repeat(60).trim();
        const svg = renderAccountSummary(long, renderGeometric);
        expectSvgDocument(svg);
        expect((svg.match(/<text/g) || []).length).toBeGreaterThan(1);
    });
});

// ── tech-summary ───────────────────────────────────────────────────────────────

describe('renderTechSummary', () => {
    test('emits an SVG document with one icon group per technology', () => {
        const svg = renderTechSummary(ICONS, renderGeometric);
        expectSvgDocument(svg);
        for (const icon of ICONS) expect(svg).toContain(icon.path);
    });

    test('handles an empty icon list', () => {
        const svg = renderTechSummary([], undefined);
        expectSvgDocument(svg);
    });
});

// ── developer-rating ─────────────────────────────────────────────────────────

describe('renderDeveloperRating', () => {
    test('renders the overall score and tier label', () => {
        const svg = renderDeveloperRating(RATING);
        expectSvgDocument(svg);
        expect(svg).toContain('66');
        expect(svg).toContain('>B<');
        expect(svg).toContain(THEME_CSS);
    });

    test('renders five base dimension bars by default', () => {
        const svg = renderDeveloperRating(RATING);
        for (const label of ['BREADTH', 'DEPTH', 'DIVERSITY', 'ACTIVITY', 'IMPACT']) {
            expect(svg).toContain(label);
        }
        expect(svg).not.toContain('ENGINEERING');
        expect(svg).not.toContain('CODE QUALITY');
    });

    test('adds engineering and codeQuality bars when present', () => {
        const svg = renderDeveloperRating({ ...RATING, engineering: 72, codeQuality: 81 });
        expect(svg).toContain('ENGINEERING');
        expect(svg).toContain('CODE QUALITY');
    });
});

// ── monkeytype-chart ───────────────────────────────────────────────────────────

describe('renderMonkeytypeChart', () => {
    test('renders the best wpm and a bar per mode', () => {
        const svg = renderMonkeytypeChart(MODES);
        expectSvgDocument(svg);
        expect(svg).toContain('110'); // best wpm
        expect(svg).toContain('TYPING SPEED');
        for (const m of MODES) expect(svg).toContain(`${m.duration}S`);
    });

    test('renders accuracy with one decimal place', () => {
        const svg = renderMonkeytypeChart(MODES);
        expect(svg).toContain('97.4% acc');
    });
});

// ── tech-chart (donut / spider) ─────────────────────────────────────────────────

describe('renderTechChart', () => {
    test('donut chart sums the repo total and renders the heading', () => {
        const svg = renderDonutChart(LANGS);
        expectSvgDocument(svg);
        expect(svg).toContain('TECH STACK');
        expect(svg).toContain('28'); // total = 12+8+5+3
        expect(svg).toContain('JavaScript');
    });

    test('spider chart renders a data polygon for >= 3 languages', () => {
        const svg = renderSpiderChart(LANGS);
        expectSvgDocument(svg);
        expect(svg).toContain('<polygon');
    });

    test('spider chart falls back to donut for fewer than 3 languages', () => {
        const svg = renderSpiderChart(LANGS.slice(0, 2));
        expectSvgDocument(svg);
        expect(svg).not.toContain('<polygon');
    });

    test('entry point dispatches on type', () => {
        expect(renderTechChart(LANGS, 'spider')).toContain('<polygon');
        expect(renderTechChart(LANGS, 'donut')).not.toContain('<polygon');
        expect(renderTechChart(LANGS)).toBe(renderDonutChart(LANGS)); // default = donut
    });

    test('falls back to a circle when a language has no icon', () => {
        const svg = renderDonutChart([{ language: 'Rust', count: 1, hex: 'dea584' }]);
        expectSvgDocument(svg);
        expect(svg).toContain('<circle');
    });
});

// ── category tiles (cards / grid / spider / treemap) ─────────────────────────────

describe('renderTechCards', () => {
    test('renders a card per category (labels upper-cased) with tech names', () => {
        const svg = renderTechCards(SERIES);
        expectSvgDocument(svg);
        expect(svg).toContain('LANGUAGES');
        expect(svg).toContain('FRAMEWORKS');
        expect(svg).toContain('Python'); // tech names <= 8 chars render in full
    });
});

describe('renderTechGrid', () => {
    test('renders an SVG containing every category label', () => {
        const svg = renderTechGrid(SERIES, undefined, { columns: 2 });
        expectSvgDocument(svg);
        expect(svg).toContain(THEME_CSS);
        expect(svg).toContain('Languages');
        expect(svg).toContain('Frameworks');
    });

    test('handles a single category', () => {
        const svg = renderTechGrid([SERIES[0]]);
        expectSvgDocument(svg);
    });
});

describe('renderTechSpider', () => {
    test('renders a radar SVG with the supplied title', () => {
        const svg = renderTechSpider(SERIES, 'MY RADAR');
        expectSvgDocument(svg);
        expect(svg).toContain('MY RADAR');
    });

    test('defaults the title when none is given', () => {
        const svg = renderTechSpider(SERIES);
        expect(svg).toContain('TECH RADAR');
    });
});

describe('renderTechTreemap', () => {
    test('renders proportional columns with category labels (upper-cased)', () => {
        const svg = renderTechTreemap(SERIES);
        expectSvgDocument(svg);
        expect(svg).toContain('LANGUAGES');
        expect(svg).toContain('<rect');
    });

    test('shows icon, clamped name and count for a large tile', () => {
        const svg = renderTechTreemap([
            {
                label: 'L',
                color: '#123456',
                techs: [
                    { name: 'AnExtremelyLongTechName', count: 100, icon: { path: 'M0 0h1v1H0z' } },
                ],
            },
        ]);
        expectSvgDocument(svg);
        expect(svg).toContain('M0 0h1v1H0z'); // icon shown on a tall/wide tile
        expect(svg).toContain('…'); // long name clamped at 14 chars
    });

    test('suppresses content for tiles that are too small', () => {
        const many = Array.from({ length: 20 }, (_, i) => ({ name: `tech-${i}`, count: 1 }));
        const svg = renderTechTreemap([{ label: 'Big', color: '#123456', techs: many }]);
        expectSvgDocument(svg);
        // 20 equal tiles in one column are < 32px tall, so no per-tile <text> is emitted
        expect(svg).not.toContain('>tech-0<');
    });
});

// ── renderer edge cases (branch coverage) ───────────────────────────────────────

describe('renderer fallbacks and edge cases', () => {
    test('spider chart shows a placeholder for fewer than 3 distinct techs', () => {
        const svg = renderTechSpider([
            {
                label: 'X',
                color: '#ffffff',
                techs: [
                    { name: 'A', count: 1 },
                    { name: 'B', count: 2 },
                ],
            },
        ]);
        expectSvgDocument(svg);
        expect(svg).toContain('Not enough data');
    });

    test('spider chart clamps long names and falls back on missing hex/icon', () => {
        const svg = renderTechSpider([
            {
                label: 'L',
                color: '#abcabc',
                techs: [
                    { name: 'AVeryLongTechnologyName', count: 3 }, // no hex, no icon
                    { name: 'Two', count: 2 },
                    { name: 'Three', count: 1 },
                ],
            },
        ]);
        expect(svg).toContain('…'); // clamped name
        expect(svg).toContain('#888888'); // hex fallback
        expect(svg).toContain('<circle'); // icon fallback
    });

    test('tech-cards falls back to grey when a tech has no hex', () => {
        const svg = renderTechCards([
            { label: 'L', color: '#abcdef', techs: [{ name: 'NoHex', count: 1 }] },
        ]);
        expectSvgDocument(svg);
        expect(svg).toContain('#888888');
    });

    test('tech-grid handles an empty series', () => {
        const svg = renderTechGrid([]);
        expectSvgDocument(svg);
    });

    test('donut chart clamps long language names', () => {
        const svg = renderDonutChart([
            { language: 'SuperLongLanguageName', count: 5, hex: 'abcabc' },
        ]);
        expectSvgDocument(svg);
        expect(svg).toContain('…');
    });
});

// ── backgrounds ─────────────────────────────────────────────────────────────────

describe('background renderers', () => {
    test('renderGeometric returns SVG markup sized to the canvas', () => {
        const bg = renderGeometric(540, 960);
        expect(typeof bg).toBe('string');
        expect(bg.length).toBeGreaterThan(0);
    });

    test('renderVaporWave returns SVG markup', () => {
        const bg = renderVaporWave(540, 960);
        expect(typeof bg).toBe('string');
        expect(bg.length).toBeGreaterThan(0);
    });

    test('renderCherryBlossom wraps the provided body', () => {
        const bg = renderCherryBlossom('<g id="probe"/>');
        expect(bg).toContain('<svg');
        expect(bg).toContain('id="probe"');
        expect(bg).toContain('cherry-blossom-leaf-gradient');
    });
});

// ── shared theme ─────────────────────────────────────────────────────────────────

describe('THEME_CSS', () => {
    test('defines dark defaults and a light-mode media override', () => {
        expect(THEME_CSS).toContain('<style>');
        expect(THEME_CSS).toContain('--bg:#0d1117');
        expect(THEME_CSS).toContain('prefers-color-scheme:light');
    });
});
