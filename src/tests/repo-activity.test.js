import { describe, test, expect } from 'vitest';
import { getCommitActivity } from '../github/commit-activity.js';
import { renderRepoActivity } from '../tiles/repo-activity.js';
import { route } from '../../api/repo-activity.js';

const sampleWeeks = [
    { week: 1700000000, total: 3, days: [0, 1, 0, 2, 0, 0, 0] },
    { week: 1700604800, total: 8, days: [1, 1, 2, 1, 1, 1, 1] },
    { week: 1701209600, total: 0, days: [0, 0, 0, 0, 0, 0, 0] },
];

// A no-op sleep so retry/backoff logic runs instantly in tests.
const noSleep = () => Promise.resolve();

describe('getCommitActivity', () => {
    test('returns the weekly buckets on 200', async () => {
        const httpGet = async () => ({ status: 200, data: sampleWeeks });
        const weeks = await getCommitActivity('owner', 'repo', { httpGet, sleep: noSleep });
        expect(weeks).toEqual(sampleWeeks);
    });

    test('retries on 202 then resolves once stats are ready', async () => {
        let calls = 0;
        const httpGet = async () => {
            calls += 1;
            return calls < 3 ? { status: 202, data: {} } : { status: 200, data: sampleWeeks };
        };
        const weeks = await getCommitActivity('owner', 'repo', { httpGet, sleep: noSleep, maxRetries: 5 });
        expect(calls).toBe(3);
        expect(weeks).toEqual(sampleWeeks);
    });

    test('gives up after the retry budget and returns an empty array', async () => {
        let calls = 0;
        const httpGet = async () => { calls += 1; return { status: 202, data: {} }; };
        const weeks = await getCommitActivity('owner', 'repo', { httpGet, sleep: noSleep, maxRetries: 2 });
        expect(calls).toBe(3); // initial attempt + 2 retries
        expect(weeks).toEqual([]);
    });

    test('returns null on 404', async () => {
        const httpGet = async () => ({ status: 404, data: {} });
        expect(await getCommitActivity('owner', 'repo', { httpGet, sleep: noSleep })).toBeNull();
    });

    test('returns an empty array on 204 (empty repo)', async () => {
        const httpGet = async () => ({ status: 204, data: '' });
        expect(await getCommitActivity('owner', 'repo', { httpGet, sleep: noSleep })).toEqual([]);
    });

    test('returns null on a thrown network error', async () => {
        const httpGet = async () => { throw new Error('ECONNRESET'); };
        expect(await getCommitActivity('owner', 'repo', { httpGet, sleep: noSleep })).toBeNull();
    });

    test('returns null when owner or repo is missing', async () => {
        expect(await getCommitActivity('', 'repo')).toBeNull();
        expect(await getCommitActivity('owner', '')).toBeNull();
    });
});

describe('renderRepoActivity', () => {
    test('renders an SVG bar chart with the total and repo label', () => {
        const svg = renderRepoActivity(sampleWeeks, { repo: 'octocat/hello' });
        expect(svg).toContain('<svg');
        expect(svg).toContain('octocat/hello');
        expect(svg).toContain('COMMIT ACTIVITY');
        expect(svg).toContain('>11<'); // 3 + 8 + 0 total commits
    });

    test('renders the empty state when there is no activity', () => {
        const svg = renderRepoActivity([], { repo: 'octocat/hello' });
        expect(svg).toContain('No commit activity');
        expect(svg).not.toContain('COMMIT ACTIVITY');
    });

    test('renders the empty state when every week is zero', () => {
        const zero = [{ week: 1, total: 0, days: [0, 0, 0, 0, 0, 0, 0] }];
        expect(renderRepoActivity(zero, { repo: 'a/b' })).toContain('No commit activity');
    });

    test('renders the not-found state on null data', () => {
        expect(renderRepoActivity(null, { repo: 'a/b' })).toContain('Repository not found');
    });

    test('renders an error state when given an error message', () => {
        expect(renderRepoActivity(null, { error: 'boom' })).toContain('Could not load activity');
    });

    test('escapes XML-special characters in the repo label', () => {
        const svg = renderRepoActivity(sampleWeeks, { repo: 'a&b/<c>' });
        expect(svg).toContain('a&amp;b/&lt;c&gt;');
        expect(svg).not.toContain('<c>');
    });
});

describe('route descriptor', () => {
    test('exports a public GET descriptor for auto-mounting', () => {
        expect(route).toEqual({ method: 'get', path: '/repo-activity', auth: false });
    });
});
