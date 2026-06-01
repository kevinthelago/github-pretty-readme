const BADGE_COLORS = { 'A+': 'brightgreen', A: 'green', B: 'blue', C: 'yellow', D: 'orange', F: 'red' };

/**
 * Returns the shields.io badge markdown for a repo's current code quality score.
 * Intended to be embedded in README.md and updated each time SCORE.md is regenerated.
 *
 * Shared between the README generator (here) and the SCORE.md report
 * (`score-report.js` re-exports it), so the badge markup stays identical wherever
 * it is rendered.
 *
 * @param {object} analysis  Result of analyzeRepo()
 */
export const scoreBadgeMd = (analysis) => {
    const { overall, grade: g } = analysis.codeQuality;
    const color = BADGE_COLORS[g] ?? 'lightgrey';
    // shields.io path encoding: _ = space, %2B = +, %2F = /, %C2%B7 = ·
    const msg = `${g}_%C2%B7_${overall}%2F100`.replace('+', '%2B');
    const url = `https://img.shields.io/badge/code_quality-${msg}-${color}?style=flat-square`;
    return `[![Code Quality](${url})](SCORE.md)`;
};

/**
 * Slugifies a heading into a GitHub-style anchor for table-of-contents links
 * (lowercase, punctuation stripped, spaces → hyphens). e.g. "Built With" → "built-with".
 *
 * @param {string} heading
 * @returns {string}
 */
const anchorFor = (heading) =>
    heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

/**
 * Generates a README.md from a scan's readmeOutline.
 *
 * Sections are assembled only when their backing data is present, so a minimal
 * repo never emits a bare header. A badge row (language, license) is rendered
 * under the tagline, and a table of contents is included whenever more than one
 * navigable section exists.
 *
 * @param {string} repoName
 * @param {object} analysis  Result of analyzeRepo()
 * @returns {string|null} README markdown, or null when the analysis has no outline
 */
export const generateReadmeFromOutline = (repoName, analysis) => {
    const { readmeOutline, techStack, meta } = analysis;
    if (!readmeOutline) return null;

    const { title, tagline, features, installationSteps, usageExample, configuration, contributing } = readmeOutline;

    // ── Badge row (rendered inline, side by side) ──────────────────────────────
    const badges = [];
    if (meta?.language) {
        badges.push(`![${meta.language}](https://img.shields.io/badge/-${encodeURIComponent(meta.language)}-555?style=flat)`);
    }
    if (meta?.license) {
        badges.push(`![License](https://img.shields.io/badge/license-${encodeURIComponent(meta.license)}-blue?style=flat)`);
    }

    // ── Body sections, in render order; each present one also seeds the ToC ─────
    const sections = [];

    if (features?.length) {
        sections.push({ heading: 'Features', lines: features.map(f => `- ${f}`) });
    }
    if (installationSteps?.length) {
        sections.push({ heading: 'Installation', lines: ['```bash', ...installationSteps, '```'] });
    }
    if (usageExample) {
        sections.push({ heading: 'Usage', lines: ['```', usageExample, '```'] });
    }
    if (configuration?.length) {
        sections.push({
            heading: 'Configuration',
            lines: [
                '| Name | Description |',
                '| --- | --- |',
                ...configuration.map(c => `| \`${c.name}\` | ${c.description ?? ''} |`),
            ],
        });
    }
    if (techStack?.length) {
        sections.push({ heading: 'Built With', lines: techStack.map(t => `- ${t}`) });
    }
    if (contributing) {
        sections.push({ heading: 'Contributing', lines: [contributing] });
    }
    if (meta?.license) {
        sections.push({ heading: 'License', lines: [`[${meta.license}](LICENSE)`] });
    }

    // ── Assemble ────────────────────────────────────────────────────────────────
    const parts = [];
    parts.push(`# ${title || repoName}`, '');
    if (tagline) parts.push(`> ${tagline}`, '');
    if (badges.length) parts.push(badges.join(' '), '');

    // A one-item ToC is noise; only render it when there's something to navigate.
    if (sections.length > 1) {
        parts.push('## Table of Contents', '');
        sections.forEach(s => parts.push(`- [${s.heading}](#${anchorFor(s.heading)})`));
        parts.push('');
    }

    sections.forEach(s => {
        parts.push(`## ${s.heading}`, '');
        s.lines.forEach(l => parts.push(l));
        parts.push('');
    });

    return parts.join('\n');
};
