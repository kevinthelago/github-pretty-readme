import { describe, test, expect, vi, afterEach } from 'vitest';
import { renderRepoCard, formatCount, relativeTime } from '../tiles/repo-card.js';
import handler, { toCardData, parseRepo } from '../../api/repo-card.js';

describe('formatCount', () => {
    test('passes through small numbers', () => {
        expect(formatCount(0)).toBe('0');
        expect(formatCount(999)).toBe('999');
    });
    test('abbreviates thousands and millions', () => {
        expect(formatCount(1200)).toBe('1.2k');
        expect(formatCount(12000)).toBe('12k');
        expect(formatCount(1_500_000)).toBe('1.5m');
    });
});

describe('relativeTime', () => {
    const NOW = new Date('2026-06-01T00:00:00Z').getTime();
    test('today / yesterday / days', () => {
        expect(relativeTime('2026-06-01T00:00:00Z', NOW)).toBe('updated today');
        expect(relativeTime('2026-05-31T00:00:00Z', NOW)).toBe('updated yesterday');
        expect(relativeTime('2026-05-20T00:00:00Z', NOW)).toBe('updated 12 days ago');
    });
    test('months and years', () => {
        expect(relativeTime('2026-03-01T00:00:00Z', NOW)).toContain('month');
        expect(relativeTime('2024-01-01T00:00:00Z', NOW)).toContain('year');
    });
    test('empty / invalid input yields empty string', () => {
        expect(relativeTime('', NOW)).toBe('');
        expect(relativeTime('not-a-date', NOW)).toBe('');
    });
});

describe('renderRepoCard', () => {
    const NOW = new Date('2026-06-01T00:00:00Z').getTime();
    const repo = {
        owner: 'octocat', name: 'hello-world',
        description: 'My first repository on GitHub!',
        stars: 1820, forks: 305, openIssues: 12,
        language: 'JavaScript', languageHex: 'f1e05a',
        updatedAt: '2026-05-28T00:00:00Z',
    };

    test('returns a well-formed SVG document', () => {
        const svg = renderRepoCard(repo, { now: NOW });
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    test('includes owner, name and stat values', () => {
        const svg = renderRepoCard(repo, { now: NOW });
        expect(svg).toContain('octocat');
        expect(svg).toContain('hello-world');
        expect(svg).toContain('1.8k');   // stars
        expect(svg).toContain('305');    // forks
        expect(svg).toContain('JavaScript');
        expect(svg).toContain('updated 4 days ago');
    });

    test('escapes XML-unsafe characters in description', () => {
        const svg = renderRepoCard({ ...repo, description: 'a & b <script>' }, { now: NOW });
        expect(svg).toContain('a &amp; b &lt;script&gt;');
        expect(svg).not.toContain('<script>');
    });

    test('omits the language row when no language is present', () => {
        const svg = renderRepoCard({ ...repo, language: '' }, { now: NOW });
        expect(svg).not.toContain('JavaScript');
    });

    test('shows a fallback when description is empty', () => {
        const svg = renderRepoCard({ ...repo, description: '' }, { now: NOW });
        expect(svg).toContain('No description provided.');
    });
});

describe('toCardData', () => {
    test('maps the REST repo object to the renderer shape', () => {
        const data = {
            owner: { login: 'octocat' }, name: 'hello-world',
            description: 'hi', stargazers_count: 5, forks_count: 2,
            open_issues_count: 1, language: 'Go',
            pushed_at: '2026-05-30T00:00:00Z',
        };
        const card = toCardData(data);
        expect(card.owner).toBe('octocat');
        expect(card.stars).toBe(5);
        expect(card.forks).toBe(2);
        expect(card.openIssues).toBe(1);
        expect(card.language).toBe('Go');
        expect(card.languageHex).toMatch(/^[0-9a-fA-F]{6}$/); // resolved from simple-icons
        expect(card.updatedAt).toBe('2026-05-30T00:00:00Z');
    });

    test('falls back to neutral hex for an unknown language', () => {
        const card = toCardData({ owner: { login: 'x' }, name: 'y', language: 'Brainfuck' });
        expect(card.languageHex).toBe('8b949e');
    });
});

describe('GET /repo-card handler', () => {
    afterEach(() => vi.unstubAllGlobals());

    const mockRes = () => ({
        statusCode: 200,
        headers: {},
        body: undefined,
        status(c) { this.statusCode = c; return this; },
        type() { return this; },
        setHeader(k, v) { this.headers[k] = v; },
        send(b) { this.body = b; return this; },
    });

    test('400 on missing/malformed repo param', async () => {
        const res = mockRes();
        await handler({ query: {} }, res);
        expect(res.statusCode).toBe(400);
    });

    test('404 when the repo is missing', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
        const res = mockRes();
        await handler({ query: { repo: 'octocat/missing' } }, res);
        expect(res.statusCode).toBe(404);
    });

    test('renders an SVG card for a valid repo', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({
                owner: { login: 'octocat' }, name: 'hello-world',
                description: 'hi', stargazers_count: 10, forks_count: 3,
                open_issues_count: 0, language: 'Python', pushed_at: '2026-05-31T00:00:00Z',
            }),
        })));
        const res = mockRes();
        await handler({ query: { repo: 'octocat/hello-world' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('hello-world');
    });

    test('502 when the fetch throws', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
        const res = mockRes();
        await handler({ query: { repo: 'octocat/hello-world' } }, res);
        expect(res.statusCode).toBe(502);
    });
});

describe('route descriptor', () => {
    test('exposes {method, path, auth}', async () => {
        const { route } = await import('../../api/repo-card.js');
        expect(route).toMatchObject({ method: 'get', path: '/repo-card', auth: false });
    });
    test('parseRepo handles owner/name', () => {
        expect(parseRepo('a/b')).toEqual({ owner: 'a', name: 'b' });
        expect(parseRepo('bad')).toBeNull();
    });
});
