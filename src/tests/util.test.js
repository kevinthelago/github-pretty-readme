import { describe, test, expect, vi, afterEach } from 'vitest';
import { decode } from '../util/base64.js';
import { previewCache } from '../preview-cache.js';
import { Tile } from '../common/Tile.js';
import { TAXONOMY, CATEGORY_META } from '../data/tech-taxonomy.js';

describe('base64.decode', () => {
    test('decodes a valid base64 string', () => {
        expect(decode('aGVsbG8=')).toBe('hello');
    });

    test('round-trips with btoa', () => {
        expect(decode(btoa('github-pretty-readme'))).toBe('github-pretty-readme');
    });

    test('returns null for invalid input rather than throwing', () => {
        expect(decode('not valid base64!!!')).toBeNull();
    });
});

describe('previewCache', () => {
    afterEach(() => {
        previewCache.clear('alice');
        vi.useRealTimers();
    });

    test('stores and retrieves a value per username', () => {
        previewCache.set('alice', { svg: '<svg/>' });
        expect(previewCache.get('alice')).toEqual({ svg: '<svg/>' });
    });

    test('returns null for an unknown username', () => {
        expect(previewCache.get('nobody-here')).toBeNull();
    });

    test('clear removes a stored value', () => {
        previewCache.set('alice', 1);
        previewCache.clear('alice');
        expect(previewCache.get('alice')).toBeNull();
    });

    test('expires entries after the 30-minute TTL', () => {
        vi.useFakeTimers();
        previewCache.set('alice', 'fresh');
        expect(previewCache.get('alice')).toBe('fresh');
        vi.advanceTimersByTime(31 * 60 * 1000);
        expect(previewCache.get('alice')).toBeNull();
    });
});

describe('Tile', () => {
    // Callers always call setBackground before render (with a function, or a
    // falsy value for "no background"). Note: the constructor's default
    // background of {} is truthy-but-not-callable, so render() throws if
    // setBackground is never called — a latent bug in src/common/Tile.js.
    test('renders an SVG document with the given dimensions', () => {
        const tile = new Tile({ height: 300, width: 600 });
        tile.setBackground(null);
        const svg = tile.render('<rect/>');
        expect(svg).toContain('height="300"');
        expect(svg).toContain('width="600"');
        expect(svg).toContain('viewBox="0 0 600 300"');
        expect(svg).toContain('<rect/>');
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    test('applies CSS set via setCss', () => {
        const tile = new Tile({});
        tile.setBackground(null);
        tile.setCss('.x { fill: red; }');
        expect(tile.render('')).toContain('.x { fill: red; }');
    });

    test('invokes the background function with height and width', () => {
        const tile = new Tile({ height: 100, width: 200 });
        const bg = vi.fn(() => '<g id="bg"/>');
        tile.setBackground(bg);
        const svg = tile.render('');
        expect(bg).toHaveBeenCalledWith(100, 200);
        expect(svg).toContain('<g id="bg"/>');
    });

    test('defaults to 540x960 when no dimensions are given', () => {
        const tile = new Tile({});
        tile.setBackground(null);
        const svg = tile.render('');
        expect(svg).toContain('height="540"');
        expect(svg).toContain('width="960"');
    });
});

describe('tech taxonomy data', () => {
    test('every taxonomy entry has a category and display name', () => {
        for (const [slug, entry] of Object.entries(TAXONOMY)) {
            expect(entry.category, slug).toBeTypeOf('string');
            expect(entry.displayName, slug).toBeTypeOf('string');
        }
    });

    test('every taxonomy category (besides languages) has metadata', () => {
        const categories = new Set(Object.values(TAXONOMY).map((e) => e.category));
        for (const cat of categories) {
            expect(CATEGORY_META[cat], cat).toBeDefined();
            expect(CATEGORY_META[cat].label).toBeTypeOf('string');
            expect(CATEGORY_META[cat].color).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    test('CATEGORY_META includes a languages entry', () => {
        expect(CATEGORY_META.languages).toMatchObject({ label: 'Languages' });
    });
});
