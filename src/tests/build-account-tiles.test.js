import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the config + GraphQL layers the builder depends on. Paths resolve to the
// same absolute modules apply-readme.js imports.
vi.mock('../github/config.js', () => ({
    readConfig: vi.fn(),
    resolveEnabledTiles: vi.fn(),
}));
vi.mock('../github/graphql.js', () => ({
    getContributionCalendar: vi.fn(),
    getUserStats: vi.fn(),
}));

import { readConfig, resolveEnabledTiles } from '../github/config.js';
import { getContributionCalendar, getUserStats } from '../github/graphql.js';
import { buildAccountTiles } from '../../api/apply-readme.js';

const calendar = { totalContributions: 1, weeks: [{ contributionDays: [{ weekday: 0, contributionCount: 1, color: '#39d353' }] }] };
const stats = { login: 'kev', name: 'Kevin', stars: 1, commits: 1, prs: 0, issues: 0, followers: 0, repos: 1, contributedTo: 0 };

beforeEach(() => {
    vi.clearAllMocks();
    readConfig.mockResolvedValue({ config: {}, sha: 'x' });
});

describe('buildAccountTiles', () => {
    test('renders only the enabled, implemented tiles', async () => {
        resolveEnabledTiles.mockReturnValue(['contributionGraph', 'statsCard']);
        getContributionCalendar.mockResolvedValue(calendar);
        getUserStats.mockResolvedValue(stats);

        const tiles = await buildAccountTiles('tok', 'kev');

        expect(Object.keys(tiles).sort()).toEqual(['contributionGraph', 'statsCard']);
        expect(tiles.contributionGraph).toContain('<svg');
        expect(tiles.statsCard).toContain('<svg');
    });

    test('returns empty when no tiles are enabled', async () => {
        resolveEnabledTiles.mockReturnValue([]);
        const tiles = await buildAccountTiles('tok', 'kev');
        expect(tiles).toEqual({});
        expect(getContributionCalendar).not.toHaveBeenCalled();
    });

    test('skips enabled-but-unimplemented tiles (languageTrend/socialLinks) without error', async () => {
        resolveEnabledTiles.mockReturnValue(['languageTrend', 'socialLinks', 'statsCard']);
        getUserStats.mockResolvedValue(stats);

        const tiles = await buildAccountTiles('tok', 'kev');
        expect(Object.keys(tiles)).toEqual(['statsCard']);
    });

    test('a failing tile is skipped, not fatal', async () => {
        resolveEnabledTiles.mockReturnValue(['contributionGraph', 'statsCard']);
        getContributionCalendar.mockRejectedValue(new Error('graphql down'));
        getUserStats.mockResolvedValue(stats);

        const tiles = await buildAccountTiles('tok', 'kev');
        expect(Object.keys(tiles)).toEqual(['statsCard']);
    });

    test('a failing config read yields no tiles, not an error', async () => {
        readConfig.mockRejectedValue(new Error('config 500'));
        const tiles = await buildAccountTiles('tok', 'kev');
        expect(tiles).toEqual({});
    });
});
