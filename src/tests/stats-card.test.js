import { describe, test, expect } from 'vitest';
import { renderStatsCard } from '../tiles/stats-card.js';

const stats = {
    login: 'kev',
    name: 'Kevin',
    stars: 1234,
    commits: 5678,
    prs: 42,
    issues: 7,
    followers: 99,
    repos: 30,
    contributedTo: 12,
};

describe('renderStatsCard', () => {
    test('returns an SVG document', () => {
        const svg = renderStatsCard(stats);
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });

    test('uses the display name in the title when present', () => {
        expect(renderStatsCard(stats)).toContain("Kevin's GitHub Stats");
    });

    test('falls back to the login handle when name is absent', () => {
        const svg = renderStatsCard({ ...stats, name: null });
        expect(svg).toContain('@kev');
    });

    test('renders each headline stat, thousands-formatted', () => {
        const svg = renderStatsCard(stats);
        expect(svg).toContain('1,234'); // stars
        expect(svg).toContain('5,678'); // commits
        expect(svg).toContain('42');    // PRs
        expect(svg).toContain('Pull Requests');
        expect(svg).toContain('Contributed To');
    });

    test('tolerates missing numeric fields by rendering zero', () => {
        const svg = renderStatsCard({ login: 'x' });
        expect(svg).toContain('@x');
        expect(svg).toContain('>0<');
    });
});
