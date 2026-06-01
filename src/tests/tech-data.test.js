import { describe, test, expect } from 'vitest';
import { buildTechSeries, lookupIcon } from '../github/tech-data.js';

const REPOS = [
    { language: 'JavaScript', topics: ['react', 'aws'] },
    { language: 'JavaScript', topics: ['react', 'docker'] },
    { language: 'Python', topics: ['django', 'postgresql'] },
    { language: 'Python', topics: ['fastapi'] },
    { language: 'Go', topics: ['kubernetes'] },
];

describe('buildTechSeries', () => {
    test('counts languages and orders them by frequency, descending', () => {
        const [langs] = buildTechSeries(REPOS, ['languages'], 10, []);
        expect(langs.label).toBe('Languages');
        const names = langs.techs.map((t) => t.name);
        expect(names[0]).toBe('JavaScript'); // 2 repos
        expect(names).toContain('Python');
        expect(names).toContain('Go');
        const jsCount = langs.techs.find((t) => t.name === 'JavaScript').count;
        expect(jsCount).toBe(2);
    });

    test('resolves topics through the taxonomy into category series', () => {
        const series = buildTechSeries(REPOS, ['frameworks', 'cloud'], 10, []);
        const labels = series.map((s) => s.label);
        expect(labels).toContain('Frameworks');
        expect(labels).toContain('Cloud');
        const frameworks = series.find((s) => s.label === 'Frameworks').techs.map((t) => t.name);
        expect(frameworks).toContain('React');
        expect(frameworks).toContain('Django');
    });

    test('respects the per-category limit', () => {
        const [langs] = buildTechSeries(REPOS, ['languages'], 1, []);
        expect(langs.techs).toHaveLength(1);
        expect(langs.techs[0].name).toBe('JavaScript');
    });

    test('drops excluded display names (case-insensitive)', () => {
        const [langs] = buildTechSeries(REPOS, ['languages'], 10, ['javascript']);
        expect(langs.techs.map((t) => t.name)).not.toContain('JavaScript');
    });

    test('omits categories that end up empty', () => {
        const series = buildTechSeries(REPOS, ['ai'], 10, []);
        expect(series).toHaveLength(0);
    });

    test('each series carries a label and color from category metadata', () => {
        const [langs] = buildTechSeries(REPOS, ['languages'], 10, []);
        expect(langs.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(langs.key).toBe('languages');
    });

    test('handles repos with no topics or language', () => {
        const series = buildTechSeries([{}, { topics: [] }], ['languages', 'frameworks'], 10, []);
        expect(series).toHaveLength(0);
    });
});

describe('lookupIcon', () => {
    test('returns an icon object for a well-known technology', () => {
        const icon = lookupIcon('React');
        expect(icon).toBeTruthy();
        expect(icon).toHaveProperty('path');
        expect(icon).toHaveProperty('hex');
    });

    test('returns null for an unknown technology', () => {
        expect(lookupIcon('TotallyNotARealTechName123')).toBeNull();
    });
});
