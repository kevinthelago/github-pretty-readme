import { describe, test, expect, vi, afterEach } from 'vitest';
import { techBadges, encodeBadgeLabel } from '../markdown/tech-badges.js';
import handler, { parseRepo } from '../../api/repo-tech-badges.js';

describe('encodeBadgeLabel', () => {
    test('escapes shields.io special characters', () => {
        expect(encodeBadgeLabel('C++')).toBe('C%2B%2B');
        expect(encodeBadgeLabel('a-b')).toBe('a--b');
        expect(encodeBadgeLabel('a_b')).toBe('a__b');
        expect(encodeBadgeLabel('Spring Boot')).toBe('Spring_Boot');
    });
});

describe('techBadges', () => {
    test('returns empty string when no tech is detected', () => {
        expect(techBadges({})).toBe('');
        expect(techBadges({ language: '', topics: [] })).toBe('');
    });

    test('emits a badge for the primary language', () => {
        const md = techBadges({ language: 'TypeScript', topics: [] });
        expect(md).toContain('![TypeScript]');
        expect(md).toContain('img.shields.io/badge/TypeScript');
        expect(md).toContain('logo=typescript');
    });

    test('maps known topics through the taxonomy to display names', () => {
        const md = techBadges({ language: 'Python', topics: ['fastapi', 'postgres'] });
        expect(md).toContain('![Python]');
        expect(md).toContain('![FastAPI]');
        expect(md).toContain('![PostgreSQL]');
    });

    test('ignores unknown topics', () => {
        const md = techBadges({ language: 'Go', topics: ['some-random-topic'] });
        expect(md).toContain('![Go]');
        expect(md).not.toContain('some-random-topic');
    });

    test('deduplicates techs case-insensitively', () => {
        // `react` and `reactjs` both map to "React"
        const md = techBadges({ language: 'JavaScript', topics: ['react', 'reactjs'] });
        expect(md.match(/!\[React\]/g)).toHaveLength(1);
    });

    test('falls back to a neutral badge with no logo for unknown tech', () => {
        const md = techBadges({ language: 'Brainfuck', topics: [] });
        expect(md).toContain('![Brainfuck]');
        expect(md).toContain('-555555?');
        expect(md).not.toContain('logo=');
    });

    test('prefers the languages array when supplied', () => {
        const md = techBadges({ languages: ['Rust', 'Go'], language: 'Ignored', topics: [] });
        expect(md).toContain('![Rust]');
        expect(md).toContain('![Go]');
        expect(md).not.toContain('![Ignored]');
    });
});

describe('GET /repo-tech-badges handler', () => {
    afterEach(() => vi.unstubAllGlobals());

    const mockRes = () => {
        const res = {
            statusCode: 200,
            headers: {},
            body: undefined,
            status(c) { this.statusCode = c; return this; },
            type() { return this; },
            setHeader(k, v) { this.headers[k] = v; },
            send(b) { this.body = b; return this; },
        };
        return res;
    };

    test('400 on missing repo param', async () => {
        const res = mockRes();
        await handler({ query: {} }, res);
        expect(res.statusCode).toBe(400);
    });

    test('400 on malformed repo param', async () => {
        const res = mockRes();
        await handler({ query: { repo: 'not-a-slug' } }, res);
        expect(res.statusCode).toBe(400);
    });

    test('404 when GitHub reports the repo missing', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
        const res = mockRes();
        await handler({ query: { repo: 'octocat/missing' } }, res);
        expect(res.statusCode).toBe(404);
    });

    test('returns a badge row for a valid repo', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ language: 'TypeScript', topics: ['react'] }),
        })));
        const res = mockRes();
        await handler({ query: { repo: 'octocat/web' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('![TypeScript]');
        expect(res.body).toContain('![React]');
        expect(res.headers['Content-Type']).toContain('text/plain');
    });

    test('200 with empty body when repo has no detectable tech', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ language: null, topics: [] }),
        })));
        const res = mockRes();
        await handler({ query: { repo: 'octocat/empty' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('');
    });

    test('exports a valid route descriptor', () => {
        expect(parseRepo('a/b')).toEqual({ owner: 'a', name: 'b' });
    });
});

describe('route descriptor', () => {
    test('exposes {method, path, auth}', async () => {
        const { route } = await import('../../api/repo-tech-badges.js');
        expect(route).toMatchObject({ method: 'get', path: '/repo-tech-badges', auth: false });
    });
});
