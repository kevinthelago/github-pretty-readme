import { describe, test, expect } from 'vitest';
import { renderLanguageTrend } from '../tiles/language-trend.js';

const sample = {
    buckets: ['2021', '2022', '2023'],
    series: [
        { language: 'JavaScript', hex: 'f1e05a', values: [1000, 3000, 5000] },
        { language: 'Python',     hex: '3572A5', values: [0, 1024, 1024 * 1024] },
    ],
};

describe('renderLanguageTrend', () => {
    test('returns a single well-formed <svg> root', () => {
        const svg = renderLanguageTrend(sample);
        expect(svg.trim().startsWith('<svg')).toBe(true);
        expect(svg.trim().endsWith('</svg>')).toBe(true);
        expect(svg.match(/<svg\b/g)).toHaveLength(1);
    });

    test('draws one filled area polygon per series', () => {
        const svg = renderLanguageTrend(sample);
        expect(svg.match(/<polygon\b/g)).toHaveLength(2);
    });

    test('renders a legend entry per language with humanised totals', () => {
        const svg = renderLanguageTrend(sample);
        expect(svg).toContain('JavaScript');
        expect(svg).toContain('Python');
        expect(svg).toContain('1.0 MB'); // Python final cumulative = 1 MiB
    });

    test('uses series brand colours', () => {
        const svg = renderLanguageTrend(sample);
        expect(svg).toContain('#f1e05a');
        expect(svg).toContain('#3572A5');
    });

    test('always labels the chart as an approximation by repo creation date', () => {
        const svg = renderLanguageTrend(sample);
        expect(svg.toLowerCase()).toContain('approximate');
        expect(svg.toLowerCase()).toContain('creation date');
    });

    test('a custom note overrides the default footnote', () => {
        const svg = renderLanguageTrend({ ...sample, note: 'Custom footnote' });
        expect(svg).toContain('Custom footnote');
    });

    test('falls back to a palette colour when a series has no hex', () => {
        const svg = renderLanguageTrend({
            buckets: ['2023'],
            series: [{ language: 'Brainfuck', values: [42] }],
        });
        expect(svg).toMatch(/<polygon\b/);
        expect(svg).toContain('Brainfuck');
    });

    test('single bucket still renders a visible band', () => {
        const svg = renderLanguageTrend({
            buckets: ['2024'],
            series: [{ language: 'Go', hex: '00ADD8', values: [2048] }],
        });
        expect(svg.match(/<polygon\b/g)).toHaveLength(1);
        expect(svg).toContain('2.0 KB');
    });

    test('empty data renders a placeholder, not a broken svg', () => {
        const svg = renderLanguageTrend({ buckets: [], series: [] });
        expect(svg.trim().startsWith('<svg')).toBe(true);
        expect(svg).toContain('No language data');
    });
});
