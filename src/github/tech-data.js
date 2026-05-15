import { TAXONOMY, CATEGORY_META } from '../data/tech-taxonomy.js';
import LANGUAGE_ICON_MAP from '../icons/languages.js';
import * as simpleIcons from 'simple-icons';

const normalizeSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const lookupIcon = (name) => {
    if (LANGUAGE_ICON_MAP[name]) return LANGUAGE_ICON_MAP[name];
    const key = `si${normalizeSlug(name).replace(/^./, c => c.toUpperCase())}`;
    return simpleIcons[key] || null;
};

/**
 * Builds per-category tech lists from a repo array.
 *
 * @param {object[]} repos
 * @param {string[]} requestedCategories  e.g. ['languages','frameworks','cloud']
 * @param {number}   limit                max techs per category
 * @param {string[]} excluded             display names to drop (lowercased)
 * @returns {Array<{ label, color, techs }>}  ready for spider/treemap/cards renderers
 */
const buildTechSeries = (repos, requestedCategories, limit, excluded) => {
    // Language counts
    const langFreq = {};
    repos.forEach(repo => {
        if (repo.language) langFreq[repo.language] = (langFreq[repo.language] || 0) + 1;
    });

    // Topic counts through taxonomy
    const topicFreq = {};
    repos.forEach(repo => {
        (repo.topics || []).forEach(topic => {
            const entry = TAXONOMY[topic];
            if (!entry) return;
            const key = entry.displayName;
            if (!topicFreq[key]) topicFreq[key] = { count: 0, category: entry.category, displayName: entry.displayName };
            topicFreq[key].count++;
        });
    });

    const categoryData = {};

    if (requestedCategories.includes('languages')) {
        categoryData['languages'] = Object.entries(langFreq)
            .filter(([name]) => !excluded.includes(name.toLowerCase()))
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, count]) => {
                const icon = lookupIcon(name);
                return { name, count, icon, hex: icon ? icon.hex : null };
            });
    }

    ['frameworks', 'cloud', 'ai', 'databases', 'devops'].forEach(cat => {
        if (!requestedCategories.includes(cat)) return;
        categoryData[cat] = Object.values(topicFreq)
            .filter(t => t.category === cat && !excluded.includes(t.displayName.toLowerCase()))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)
            .map(t => {
                const icon = lookupIcon(t.displayName);
                return { name: t.displayName, count: t.count, icon, hex: icon ? icon.hex : null };
            });
    });

    return requestedCategories
        .filter(cat => categoryData[cat]?.length > 0)
        .map(cat => ({
            label: CATEGORY_META[cat]?.label ?? cat,
            color: CATEGORY_META[cat]?.color ?? '#ffffff',
            techs: categoryData[cat],
        }));
};

export { buildTechSeries, lookupIcon };
