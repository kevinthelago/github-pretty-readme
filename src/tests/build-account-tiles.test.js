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
vi.mock('../github/recent-languages.js', () => ({ getRecentLanguageWeights: vi.fn() }));
vi.mock('../github/contribution-times.js', () => ({ getContributionTimes: vi.fn() }));
vi.mock('../wakatime/client.js', () => ({ getTimeByLanguage: vi.fn(), createWakatimeClient: vi.fn(() => ({})) }));

import { readConfig, resolveEnabledTiles } from '../github/config.js';
import { getContributionCalendar, getUserStats } from '../github/graphql.js';
import { buildDataset } from '../../api/language-trend.js';
import { badgesFromConfig } from '../../api/social-links.js';
import { getRecentLanguageWeights } from '../github/recent-languages.js';
import { getContributionTimes } from '../github/contribution-times.js';
import { getTimeByLanguage } from '../wakatime/client.js';
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

describe('buildAccountTiles — Phase 5 opt-in tiles (#70)', () => {
    test('renders the four Phase 5 tiles when enabled', async () => {
        resolveEnabledTiles.mockReturnValue(['activeLanguages', 'topRepos', 'activityClock', 'wakatime']);
        getRecentLanguageWeights.mockResolvedValue({ langs: [{ language: 'JavaScript', count: 5 }], totalCommits: 5, days: 90 });
        getContributionTimes.mockResolvedValue([new Date('2024-01-01T10:00:00Z').toISOString()]);
        getTimeByLanguage.mockResolvedValue([{ name: 'JavaScript', total_seconds: 3600, percent: 100 }]);

        const repos = [{ name: 'r', owner: { login: 'kev' }, stargazers_count: 9, fork: false, language: 'JavaScript' }];
        const tiles = await buildAccountTiles(ctx({ repos, wakatimeKey: 'waka-key' }));

        expect(Object.keys(tiles).sort()).toEqual(['activeLanguages', 'activityClock', 'topRepos', 'wakatime']);
        expect(tiles.activeLanguages).toContain('<svg');
        expect(tiles.topRepos).toContain('<svg');
        expect(tiles.activityClock).toContain('<svg');
        expect(tiles.wakatime).toContain('<svg');
        // active-languages reuses the recent-language weighting with the apply default window
        expect(getRecentLanguageWeights).toHaveBeenCalledWith('kev', { days: 90, token: 'tok' });
    });

    test('Phase 5 tiles are absent when their flag is off (opt-in)', async () => {
        resolveEnabledTiles.mockReturnValue([]);
        const tiles = await buildAccountTiles(ctx({ wakatimeKey: 'waka-key' }));
        expect(tiles).toEqual({});
        expect(getRecentLanguageWeights).not.toHaveBeenCalled();
        expect(getContributionTimes).not.toHaveBeenCalled();
        expect(getTimeByLanguage).not.toHaveBeenCalled();
    });

    test('wakatime tile is skipped (not fatal) when no key is connected', async () => {
        resolveEnabledTiles.mockReturnValue(['wakatime']);
        const tiles = await buildAccountTiles(ctx({ wakatimeKey: null }));
        expect(tiles).toEqual({});
        expect(getTimeByLanguage).not.toHaveBeenCalled();
    });

    test('active-languages falls back to an empty tile when weighting returns null', async () => {
        resolveEnabledTiles.mockReturnValue(['activeLanguages']);
        getRecentLanguageWeights.mockResolvedValue(null);
        const tiles = await buildAccountTiles(ctx());
        expect(tiles.activeLanguages).toContain('<svg');
    });
});
