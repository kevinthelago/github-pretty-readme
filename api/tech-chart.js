import { renderTechChart } from '../src/tiles/tech-chart.js';
import { getAllRepos } from '../src/github/repos.js';
import LANGUAGE_ICON_MAP from '../src/icons/languages.js';
import * as simpleIcons from 'simple-icons';

const normalizeForSlug = (lang) => lang.toLowerCase().replace(/[^a-z0-9]/g, '');

const lookupIcon = (lang) => {
    if (LANGUAGE_ICON_MAP[lang]) return LANGUAGE_ICON_MAP[lang];
    const key = `si${normalizeForSlug(lang).replace(/^./, c => c.toUpperCase())}`;
    return simpleIcons[key] || null;
};

export default async (req, res) => {
    const { chart = 'donut' } = req.query;
    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const langFreq = {};
        repos.forEach(repo => {
            if (repo.language) langFreq[repo.language] = (langFreq[repo.language] || 0) + 1;
        });

        const langs = Object.entries(langFreq)
            .sort((a, b) => b[1] - a[1])
            .map(([language, count]) => {
                const icon = lookupIcon(language);
                return { language, count, icon, hex: icon ? icon.hex : null };
            });

        return res.send(renderTechChart(langs, chart));
    } catch (err) {
        return res.send(err.message);
    }
};
