import { describe, test, expect, vi } from 'vitest';
import { renderActivityClock, bucketActivity, formatHour } from '../tiles/activity-clock.js';
import { getContributionTimes } from '../github/contribution-times.js';
import activityClock from '../../api/activity-clock.js';

// Fixed, deterministic timestamps (UTC).
//   2024-01-01 is a Monday (UTC day 1)
//   2024-01-03 is a Wednesday (UTC day 3)
const FIXTURE = [
    '2024-01-01T09:05:00Z',
    '2024-01-01T09:30:00Z',
    '2024-01-01T09:45:00Z',
    '2024-01-01T14:00:00Z',
    '2024-01-03T14:10:00Z',
    '2024-01-03T14:50:00Z',
];

describe('formatHour', () => {
    test('midnight is 12am', () => expect(formatHour(0)).toBe('12am'));
    test('noon is 12pm', () => expect(formatHour(12)).toBe('12pm'));
    test('morning hour', () => expect(formatHour(9)).toBe('9am'));
    test('afternoon hour', () => expect(formatHour(14)).toBe('2pm'));
    test('late evening', () => expect(formatHour(23)).toBe('11pm'));
});

describe('bucketActivity', () => {
    test('produces a 7x24 matrix', () => {
        const { matrix } = bucketActivity(FIXTURE);
        expect(matrix).toHaveLength(7);
        matrix.forEach(row => expect(row).toHaveLength(24));
    });

    test('counts events into the correct day/hour cells', () => {
        const { matrix } = bucketActivity(FIXTURE);
        expect(matrix[1][9]).toBe(3);
        expect(matrix[1][14]).toBe(1);
        expect(matrix[3][14]).toBe(2);
    });

    test('reports the busiest cell, day, and hour', () => {
        const { busiestCell, busiestDay, busiestHour, max, total } = bucketActivity(FIXTURE);
        expect(total).toBe(6);
        expect(max).toBe(3);
        expect(busiestCell).toEqual({ day: 1, hour: 9, count: 3 });
        expect(busiestDay).toBe(1);
        expect(busiestHour).toBe(9); // hour 9 and 14 tie at 3; argmax keeps the first
    });

    test('handles empty input', () => {
        const { matrix, total, max } = bucketActivity([]);
        expect(total).toBe(0);
        expect(max).toBe(0);
        expect(matrix.flat().every(c => c === 0)).toBe(true);
    });

    test('handles undefined input', () => {
        expect(bucketActivity(undefined).total).toBe(0);
    });

    test('ignores invalid timestamps', () => {
        const { total } = bucketActivity(['not-a-date', '2024-01-01T09:00:00Z', '']);
        expect(total).toBe(1);
    });
});

describe('renderActivityClock', () => {
    test('returns an SVG string', () => {
        const svg = renderActivityClock(FIXTURE);
        expect(typeof svg).toBe('string');
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });

    test('labels the busiest day and hour', () => {
        const svg = renderActivityClock(FIXTURE);
        expect(svg).toContain('BUSIEST');
        expect(svg).toContain('Monday');
        expect(svg).toContain('9am'); // busiest hour resolves to 9 (tie broken to first)
    });

    test('marks the peak cell with a count label', () => {
        const svg = renderActivityClock(FIXTURE);
        expect(svg).toContain('peak 3');
    });

    test('renders day-of-week labels', () => {
        const svg = renderActivityClock(FIXTURE);
        for (const d of ['Sun', 'Mon', 'Wed', 'Sat']) {
            expect(svg).toContain('>' + d + '<');
        }
    });

    test('includes accessible title tooltips for active cells', () => {
        const svg = renderActivityClock(FIXTURE);
        expect(svg).toContain('<title>Monday 9am: 3</title>');
    });

    test('empty state renders gracefully with a message', () => {
        const svg = renderActivityClock([]);
        expect(svg).toContain('<svg');
        expect(svg).toContain('No recent contribution activity found');
        expect(svg).not.toContain('BUSIEST');
    });

    test('embeds an optional background layer when provided', () => {
        const bg = vi.fn((h, w) => '<rect class="bg" width="' + w + '" height="' + h + '"/>');
        const svg = renderActivityClock(FIXTURE, bg);
        expect(bg).toHaveBeenCalled();
        expect(svg).toContain('class="bg"');
    });

    test('renders without a background when none is given', () => {
        const svg = renderActivityClock(FIXTURE);
        expect(svg).toContain('<svg');
    });

    test('includes and escapes the username when supplied', () => {
        const svg = renderActivityClock(FIXTURE, undefined, { username: 'a<b>&c' });
        expect(svg).toContain('a&lt;b&gt;&amp;c');
    });
});

describe('getContributionTimes', () => {
    const okResponse = (data) => ({ ok: true, json: async () => data });

    test('returns empty array when no username is given', async () => {
        const result = await getContributionTimes('', undefined, vi.fn());
        expect(result).toEqual([]);
    });

    test('extracts created_at timestamps from events', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse([
            { created_at: '2024-01-01T09:00:00Z' },
            { created_at: '2024-01-01T10:00:00Z' },
        ]));
        const result = await getContributionTimes('octocat', undefined, fetchImpl);
        expect(result).toEqual(['2024-01-01T09:00:00Z', '2024-01-01T10:00:00Z']);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    test('sends an Authorization header when a token is supplied', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse([]));
        await getContributionTimes('octocat', 'tok123', fetchImpl);
        const opts = fetchImpl.mock.calls[0][1];
        expect(opts.headers.Authorization).toBe('Bearer tok123');
    });

    test('omits Authorization header when no token', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse([]));
        await getContributionTimes('octocat', undefined, fetchImpl);
        const opts = fetchImpl.mock.calls[0][1];
        expect(opts.headers.Authorization).toBeUndefined();
    });

    test('stops paging when a page is not full', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse([{ created_at: '2024-01-01T00:00:00Z' }]));
        await getContributionTimes('octocat', undefined, fetchImpl);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    test('pages through full pages then stops on a short one', async () => {
        const fullPage = Array.from({ length: 100 }, () => ({ created_at: '2024-01-01T00:00:00Z' }));
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(okResponse(fullPage))
            .mockResolvedValueOnce(okResponse([{ created_at: '2024-01-01T00:00:00Z' }]));
        const result = await getContributionTimes('octocat', undefined, fetchImpl);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(101);
    });

    test('degrades to empty array on a non-ok response', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
        const result = await getContributionTimes('octocat', undefined, fetchImpl);
        expect(result).toEqual([]);
    });

    test('degrades to empty array on a thrown network error', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
        const result = await getContributionTimes('octocat', undefined, fetchImpl);
        expect(result).toEqual([]);
    });

    test('skips events missing created_at', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse([
            { created_at: '2024-01-01T09:00:00Z' },
            { id: 'no-timestamp' },
            null,
        ]));
        const result = await getContributionTimes('octocat', undefined, fetchImpl);
        expect(result).toEqual(['2024-01-01T09:00:00Z']);
    });
});

const makeRes = () => ({
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.body = payload; return this; },
});

describe('GET /activity-clock handler', () => {
    test('renders empty-state SVG when username is missing', async () => {
        const req = { query: {}, session: {} };
        const res = makeRes();
        await activityClock(req, res);
        expect(res.headers['Content-Type']).toBe('image/svg+xml');
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('No recent contribution activity found');
    });

    test('fetches timestamps and renders a heatmap for a username', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => FIXTURE.map(ts => ({ created_at: ts })),
        });
        try {
            const req = { query: { username: 'octocat' }, session: {} };
            const res = makeRes();
            await activityClock(req, res);
            expect(res.headers['Content-Type']).toBe('image/svg+xml');
            expect(res.body).toContain('<svg');
            expect(res.body).toContain('BUSIEST');
            expect(res.body).toContain('Monday');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('applies a named background', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => FIXTURE.map(ts => ({ created_at: ts })),
        });
        try {
            const req = { query: { username: 'octocat', background: 'geometric' }, session: {} };
            const res = makeRes();
            await activityClock(req, res);
            expect(res.body).toContain('geometric-background');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('degrades to empty-state when the upstream fetch throws', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockImplementation(() => { throw new Error('boom'); });
        try {
            const req = { query: { username: 'octocat' }, session: {} };
            const res = makeRes();
            await activityClock(req, res);
            expect(res.statusCode).toBe(200);
            expect(res.body).toContain('No recent contribution activity found');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
