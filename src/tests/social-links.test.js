import { describe, test, expect } from 'vitest';
import { siGithub } from 'simple-icons';
import { renderSocialLinks } from '../tiles/social-links.js';

const githubBadge = {
    key: 'github',
    label: 'GitHub',
    url: 'https://github.com/octocat',
    icon: siGithub,
    hex: siGithub.hex,
};

const unknownBadge = {
    key: 'carrierpigeon',
    label: 'Carrierpigeon',
    url: 'https://example.com/pigeon',
    icon: null,
    hex: null,
};

describe('renderSocialLinks', () => {
    test('returns a single well-formed <svg> root', () => {
        const svg = renderSocialLinks([githubBadge]);
        expect(svg.trim().startsWith('<svg')).toBe(true);
        expect(svg.trim().endsWith('</svg>')).toBe(true);
        // exactly one root svg element
        expect(svg.match(/<svg\b/g)).toHaveLength(1);
    });

    test('renders a known platform with its brand colour, label and link', () => {
        const svg = renderSocialLinks([githubBadge]);
        expect(svg).toContain('GitHub');
        expect(svg).toContain(`#${siGithub.hex}`);
        expect(svg).toContain('href="https://github.com/octocat"');
        expect(svg).toContain(siGithub.path); // brand glyph embedded
    });

    test('unknown platforms degrade gracefully to a generic link badge', () => {
        const svg = renderSocialLinks([unknownBadge]);
        expect(svg).toContain('Carrierpigeon');
        // neutral styling rather than a brand colour, and no crash
        expect(svg).toContain('var(--fg60)');
        expect(svg).toContain('href="https://example.com/pigeon"');
    });

    test('renders one pill per badge', () => {
        const svg = renderSocialLinks([githubBadge, unknownBadge]);
        expect(svg.match(/<rect\b/g)).toHaveLength(2);
    });

    test('empty input renders a placeholder, not a broken svg', () => {
        const svg = renderSocialLinks([]);
        expect(svg.trim().startsWith('<svg')).toBe(true);
        expect(svg).toContain('No social links');
    });

    test('escapes XML-significant characters in labels and urls', () => {
        const svg = renderSocialLinks([{
            key: 'web', label: 'A & B', url: 'https://x.com/?a=1&b=2', icon: null, hex: null,
        }]);
        expect(svg).toContain('A &amp; B');
        expect(svg).toContain('a=1&amp;b=2');
        expect(svg).not.toContain('A & B');
    });
});
