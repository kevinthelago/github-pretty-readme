import { renderTechSummary } from '../src/tiles/tech-summary.js';
import { getAllRepos } from '../src/github/repos.js';
import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';
import { renderGeometric } from '../src/backgrounds/geometric.js';
import { renderVaporWave } from '../src/backgrounds/vapor-wave.js';
import LANGUAGE_ICON_MAP from '../src/icons/languages.js';

const backgrounds = {
    'cherry-blossom': renderCherryBlossom,
    'geometric': renderGeometric,
    'vapor-wave': renderVaporWave,
};

export default async (req, res) => {
    const { background, limit, sort, exclude } = req.query;

    res.setHeader('Content-Type', 'image/svg+xml');

    const repos = await getAllRepos();
    if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

    const langFreq = {};
    repos.forEach(repo => {
        if (repo.language) {
            langFreq[repo.language] = (langFreq[repo.language] || 0) + 1;
        }
    });

    const excluded = exclude ? exclude.split(',').map(s => s.trim()) : [];

    let langs = Object.entries(langFreq)
        .filter(([lang]) => LANGUAGE_ICON_MAP[lang] && !excluded.includes(lang));

    if (!sort || sort === 'frequency') {
        langs.sort((a, b) => b[1] - a[1]);
    } else if (sort === 'alpha') {
        langs.sort((a, b) => a[0].localeCompare(b[0]));
    }

    if (limit && /^\d+$/.test(limit)) {
        langs = langs.slice(0, parseInt(limit, 10));
    }

    const icons = langs.map(([lang]) => LANGUAGE_ICON_MAP[lang]);

    try {
        return res.send(renderTechSummary(icons, backgrounds[background]));
    } catch (err) {
        return res.send(err.message);
    }
};
