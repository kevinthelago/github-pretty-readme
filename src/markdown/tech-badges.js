import { TAXONOMY } from '../data/tech-taxonomy.js';
import { lookupIcon } from '../github/tech-data.js';

/**
 * Encodes a label for a shields.io static badge path segment.
 * Per shields.io rules: `_` → `__`, `-` → `--`, space → `_`, then URL-encode.
 *
 * @param {string} label
 * @returns {string}
 */
const encodeBadgeLabel = (label) =>
    encodeURIComponent(label.replace(/_/g, '__').replace(/-/g, '--').replace(/ /g, '_'));

/**
 * Builds the shields.io markdown for a single tech, attaching the simple-icons
 * logo + brand colour when one is known. Falls back to a neutral grey badge
 * with no logo for techs that have no matching icon.
 *
 * @param {string} displayName  Human-facing tech name (e.g. "PostgreSQL")
 * @returns {string} shields.io badge markdown
 */
const badgeFor = (displayName) => {
    const icon  = lookupIcon(displayName);
    const color = icon ? icon.hex : '555555';
    const label = encodeBadgeLabel(displayName);
    const logo  = icon ? `&logo=${icon.slug}&logoColor=white` : '';
    const url   = `https://img.shields.io/badge/${label}-${color}?style=for-the-badge${logo}`;
    return `![${displayName}](${url})`;
};

/**
 * Maps a repository's detected languages and topics to a row of shields.io
 * tech badges (markdown). Languages come first (in the order supplied), then
 * topic-derived techs resolved through the shared tech-taxonomy. Duplicates
 * (case-insensitive on display name) are collapsed, preserving first occurrence.
 *
 * @param {object}   repo
 * @param {string}   [repo.language]   Primary language from the REST repo object
 * @param {string[]} [repo.languages]  Optional full language list (overrides `language`)
 * @param {string[]} [repo.topics]     GitHub topic slugs
 * @returns {string} Markdown badge row, or '' when no tech is detected
 */
export const techBadges = ({ language, languages, topics = [] } = {}) => {
    const names = [];
    const seen  = new Set();
    const push  = (name) => {
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(name);
    };

    // Languages first, in the order supplied.
    const langList = Array.isArray(languages) && languages.length ? languages : (language ? [language] : []);
    langList.forEach(push);

    // Topics resolved through the taxonomy → display names.
    (topics || []).forEach((topic) => {
        const entry = TAXONOMY[String(topic).toLowerCase()];
        if (entry) push(entry.displayName);
    });

    if (names.length === 0) return '';

    return names.map(badgeFor).join(' ');
};

export { encodeBadgeLabel, badgeFor };
export default techBadges;
