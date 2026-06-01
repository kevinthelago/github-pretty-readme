import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the config + GraphQL layers and the two endpoint data-builders the
// account-tile builders depend on. Paths resolve to the same absolute modules
// apply-readme.js imports.
vi.mock('../github/config.js', () => ({
    readConfig: vi.fn(),
    resolveEnabledTiles: vi.fn(),
}));
vi.mock('../github/graphql.js', () => ({
    getContributionCalendar: vi.fn(),
    getUserStats: vi.fn(),
}));
vi.mock('../../api/language-trend.js', () => ({ buildDataset: vi.fn() }));
vi.mock('../../api/social-links.js', () => ({ badgesFromConfig: vi.fn() }));

import { readConfig, resolveEnabledTiles } from '../github/config.js';
import { getContributionCalendar, getUserStats } from '../github/graphql.js';
import { buildDataset } from '../../api/language-trend.js';
import { badgesFromConfig } from '../../api/social-links.js';
import { buildAccountTiles } from '../../api/apply-readme.js';

const calendar = { totalContributions: 1, weeks: [{ contributionDays: [{ weekday: 0, contributionCount: 1, color: '#39d353' }] }] };
const stats = { login: 'kev', name: 'Kevin', stars: 1, commits: 1, prs: 0, issues: 0, followers: 0, repos: 1, contributedTo: 0 };
const dataset = { buckets: ['2024'], series: [{ language: 'JavaScript', hex: '#f1e05a', values: [10] }] };
const ctx = (over = {}) => ({ token: 'tok', username: 'kev', repos: [{ name: 'r' }], ...over });

beforeEach(() => {
    vi.clearAllMocks();
    readConfig.mockResolvedValue({ config: {}, sha: 'x' });
});

describe('buildAccountTiles', () => {
    test('renders only the enabled, implemented tiles', async () => {
        resolveEnabledTiles.mockReturnValue(['contributionGraph', 'statsCard']);
        getContributionCalendar.mockResolvedValue(calendar);
        getUserStats.mockResolvedValue(stats);

        const tiles = await buildAccountTiles(ctx());

        expect(Object.keys(tiles).sort()).toEqual(['contributionGraph', 'statsCard']);
        expect(tiles.contributionGraph).toContain('<svg');
        expect(tiles.statsCard).toContain('<svg');
    });

    test('renders R3/R4 tiles via the reused endpoint data-builders', async () => {
        resolveEnabledTiles.mockReturnValue(['languageTrend', 'socialLinks']);
        readConfig.mockResolvedValue({ config: { social: { github: 'kev' } }, sha: 'x' });
        buildDataset.mockResolvedValue(dataset);
        badgesFromConfig.mockReturnValue([{ key: 'github', label: 'GitHub', url: 'https://github.com/kev', icon: null, hex: null }]);

        const tiles = await buildAccountTiles(ctx());

        expect(Object.keys(tiles).sort()).toEqual(['languageTrend', 'socialLinks']);
        expect(tiles.languageTrend).toContain('<svg');
        expect(tiles.socialLinks).toContain('<svg');
        // language-trend reuses the endpoint builder with the apply repos + default caps
        expect(buildDataset).toHaveBeenCalledWith([{ name: 'r' }], 'tok', 40, 6);
        // social-links reuses badgesFromConfig with the config's `social` map
        expect(badgesFromConfig).toHaveBeenCalledWith({ github: 'kev' });
    });

    test('returns empty when no tiles are enabled', async () => {
        resolveEnabledTiles.mockReturnValue([]);
        const tiles = await buildAccountTiles(ctx());
        expect(tiles).toEqual({});
        expect(getContributionCalendar).not.toHaveBeenCalled();
    });

    test('a failing tile is skipped, not fatal', async () => {
        resolveEnabledTiles.mockReturnValue(['contributionGraph', 'statsCard']);
        getContributionCalendar.mockRejectedValue(new Error('graphql down'));
        getUserStats.mockResolvedValue(stats);

        const tiles = await buildAccountTiles(ctx());
        expect(Object.keys(tiles)).toEqual(['statsCard']);
    });

    test('a failing config read yields no tiles, not an error', async () => {
        readConfig.mockRejectedValue(new Error('config 500'));
        const tiles = await buildAccountTiles(ctx());
        expect(tiles).toEqual({});
    });
});
