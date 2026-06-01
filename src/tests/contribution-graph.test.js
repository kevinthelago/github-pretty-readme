import { describe, test, expect } from 'vitest';
import { computeStreaks, renderContributionGraph } from '../tiles/contribution-graph.js';

/** Build a chronological list of days from an array of contribution counts. */
const daysFrom = (counts) =>
    counts.map((contributionCount, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        weekday: i % 7,
        contributionCount,
        color: contributionCount > 0 ? '#39d353' : '#161b22',
    }));

/** Wrap a flat day list into a single-week-per-7 calendar structure. */
const calendarFrom = (counts, totalContributions) => {
    const days = daysFrom(counts);
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push({ contributionDays: days.slice(i, i + 7) });
    }
    return { totalContributions: totalContributions ?? counts.reduce((a, b) => a + b, 0), weeks };
};

describe('computeStreaks', () => {
    test('empty input yields zero streaks', () => {
        expect(computeStreaks([])).toEqual({ current: 0, longest: 0 });
    });

    test('longest streak is the max consecutive run of active days', () => {
        const days = daysFrom([1, 1, 0, 1, 1, 1, 0, 2]);
        expect(computeStreaks(days).longest).toBe(3);
    });

    test('current streak counts back from the final active day', () => {
        const days = daysFrom([0, 1, 1, 1]);
        expect(computeStreaks(days).current).toBe(3);
    });

    test('a zero final day (today, not yet contributed) does not break the current streak', () => {
        const days = daysFrom([1, 1, 1, 0]);
        expect(computeStreaks(days).current).toBe(3);
    });

    test('two trailing zero days end the current streak at zero', () => {
        const days = daysFrom([1, 1, 0, 0]);
        expect(computeStreaks(days).current).toBe(0);
    });
});

describe('renderContributionGraph', () => {
    const calendar = calendarFrom([1, 0, 2, 3, 0, 1, 4, 1, 1], 13);

    test('returns an SVG document', () => {
        const svg = renderContributionGraph(calendar);
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });

    test('renders one rect per contribution day plus the panel', () => {
        const svg = renderContributionGraph(calendar);
        const dayCount = calendar.weeks.flatMap((w) => w.contributionDays).length;
        const rectCount = (svg.match(/<rect/g) || []).length;
        // one rect per day, plus the translucent background panel
        expect(rectCount).toBe(dayCount + 1);
    });

    test('shows the formatted total and the username heading', () => {
        const svg = renderContributionGraph(calendar, undefined, { username: 'kevinthelago' });
        expect(svg).toContain('13 contributions');
        expect(svg).toContain('@kevinthelago');
    });

    test('renders streak labels', () => {
        const svg = renderContributionGraph(calendar);
        expect(svg).toContain('CURRENT STREAK');
        expect(svg).toContain('LONGEST STREAK');
    });

    test('invokes the background renderer when supplied', () => {
        let called = false;
        const bg = () => {
            called = true;
            return '<rect class="bg"/>';
        };
        renderContributionGraph(calendar, bg);
        expect(called).toBe(true);
    });
});
