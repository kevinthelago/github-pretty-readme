import { getAllRepos } from '../src/github/repos.js';
import LANGUAGE_ICON_MAP from '../src/icons/languages.js';
import * as simpleIcons from 'simple-icons';
import { resolveAuth, sendJsonError, listParam } from './_shared.js';

const normalizeForSlug = (lang) =>
    lang.toLowerCase().replace(/[^a-z0-9]/g, '');

const lookupIcon = (lang) => {
    if (LANGUAGE_ICON_MAP[lang]) return LANGUAGE_ICON_MAP[lang];
    const key = `si${normalizeForSlug(lang).replace(/^./, c => c.toUpperCase())}`;
    return simpleIcons[key] || null;
};

export default async (req, res) => {
    const { sort } = req.query;

    res.setHeader('Content-Type', 'application/json');

    const { token } = resolveAuth(req, { allowEnv: true });
    const repos = await getAllRepos(token);
    if (!repos) return sendJsonError(res, 401, 'unauthenticated', 'GitHub not connected');

    const langFreq = {};
    repos.forEach(repo => {
        if (repo.language) {
            langFreq[repo.language] = (langFreq[repo.language] || 0) + 1;
        }
    });

    const excluded = listParam(req.query.exclude);

    let langs = Object.entries(langFreq)
        .filter(([lang]) => !excluded.includes(lang));

    if (!sort || sort === 'frequency') {
        langs.sort((a, b) => b[1] - a[1]);
    } else if (sort === 'alpha') {
        langs.sort((a, b) => a[0].localeCompare(b[0]));
    }

    const result = langs.map(([lang, count]) => {
        const icon = lookupIcon(lang);
        return {
            language: lang,
            count,
            slug: icon ? icon.slug : null,
            hex: icon ? icon.hex : null,
        };
    });

    return res.json(result);
};
