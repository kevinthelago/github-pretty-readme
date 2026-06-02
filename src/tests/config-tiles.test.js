import { describe, test, expect } from 'vitest';
import { ACCOUNT_TILES, resolveEnabledTiles } from '../github/config.js';

describe('resolveEnabledTiles', () => {
    test('returns nothing for a missing or empty config (opt-in, default off)', () => {
        expect(resolveEnabledTiles(null)).toEqual([]);
        expect(resolveEnabledTiles(undefined)).toEqual([]);
        expect(resolveEnabledTiles({})).toEqual([]);
        expect(resolveEnabledTiles({ tiles: {} })).toEqual([]);
    });

    test('enables only tiles explicitly set to true', () => {
        const config = { tiles: { contributionGraph: true, statsCard: false, languageTrend: true } };
        expect(resolveEnabledTiles(config)).toEqual(['contributionGraph', 'languageTrend']);
    });

    test('ignores unknown keys and truthy-but-not-true values', () => {
        const config = { tiles: { contributionGraph: 'yes', bogus: true, statsCard: 1 } };
        expect(resolveEnabledTiles(config)).toEqual([]);
    });

    test('preserves canonical ACCOUNT_TILES ordering regardless of config key order', () => {
        const config = { tiles: { statsCard: true, contributionGraph: true } };
        expect(resolveEnabledTiles(config)).toEqual(['contributionGraph', 'statsCard']);
    });

    test('every advertised tile id is resolvable', () => {
        const allOn = { tiles: Object.fromEntries(ACCOUNT_TILES.map((k) => [k, true])) };
        expect(resolveEnabledTiles(allOn)).toEqual(ACCOUNT_TILES);
    });

    test('the four Phase 5 tiles (#70) are advertised and opt-in', () => {
        const phase5 = ['activeLanguages', 'topRepos', 'activityClock', 'wakatime'];
        // each is a recognised tile id
        phase5.forEach((id) => expect(ACCOUNT_TILES).toContain(id));
        // off by default — absent from a config with no tiles block
        phase5.forEach((id) => expect(resolveEnabledTiles({})).not.toContain(id));
        // enabled only when set to true
        const config = { tiles: { activeLanguages: true, topRepos: true, activityClock: true, wakatime: true } };
        expect(resolveEnabledTiles(config)).toEqual(phase5);
    });
});
