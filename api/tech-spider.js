import { renderTechSpider } from '../src/tiles/tech-spider.js';
import { getAllRepos } from '../src/github/repos.js';
import { TAXONOMY, CATEGORY_META } from '../src/data/tech-taxonomy.js';
import LANGUAGE_ICON_MAP from '../src/icons/languages.js';
import * as simpleIcons from 'simple-icons';

const normalizeSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const lookupIcon = (name) => {
    if (LANGUAGE_ICON_MAP[name]) return LANGUAGE_ICON_MAP[name];
    const key = `si${normalizeSlug(name).replace(/^./, c => c.toUpperCase())}`;
    return simpleIcons[key] || null;
};

/**
 * GET /tech-spider
 *
 * Query params:
 *   categories  Comma-separated category keys to include as polygons.
 *               Valid: languages, frameworks, cloud, ai, databases, devops
 *               Default: languages,frameworks,cloud
 *   limit       Max techs per category used as axes (default: 6)
 *   exclude     Comma-separated tech display names to drop
 */
export default async (req, res) => {
    const {
        categories: categoriesParam = 'languages,frameworks,cloud',
        limit: limitParam = '6',
        exclude: excludeParam = '',
    } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const requestedCategories = categoriesParam.split(',').map(s => s.trim().toLowerCase());
        const limit = Math.min(parseInt(limitParam, 10) || 6, 12);
        const excluded = excludeParam ? excludeParam.split(',').map(s => s.trim().toLowerCase()) : [];

        // Count languages
        const langFreq = {};
        repos.forEach(repo => {
            if (repo.language) langFreq[repo.language] = (langFreq[repo.language] || 0) + 1;
        });

        // Count topics through taxonomy
        const topicFreq = {}; // displayName → { count, category, displayName }
        repos.forEach(repo => {
            (repo.topics || []).forEach(topic => {
                const entry = TAXONOMY[topic];
                if (!entry) return;
                const key = entry.displayName;
                if (!topicFreq[key]) topicFreq[key] = { count: 0, category: entry.category, displayName: entry.displayName };
                topicFreq[key].count++;
            });
        });

        // Build per-category tech lists
        const categoryData = {};

        if (requestedCategories.includes('languages')) {
            categoryData['languages'] = Object.entries(langFreq)
                .map(([name, count]) => {
                    const icon = lookupIcon(name);
                    return { name, count, icon, hex: icon ? icon.hex : null };
                })
                .sort((a, b) => b.count - a.count)
                .filter(t => !excluded.includes(t.name.toLowerCase()))
                .slice(0, limit);
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

        // Build series in requested order, skipping empty categories
        const series = requestedCategories
            .filter(cat => categoryData[cat]?.length > 0)
            .map(cat => ({
                label: CATEGORY_META[cat]?.label ?? cat,
                color: CATEGORY_META[cat]?.color ?? '#ffffff',
                techs: categoryData[cat],
            }));

        if (series.length === 0) return res.status(400).send('No data for requested categories');

        return res.send(renderTechSpider(series));
    } catch (err) {
        return res.send(err.message);
    }
};
