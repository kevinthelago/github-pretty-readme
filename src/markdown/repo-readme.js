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
 * Generates a README.md from a scan's readmeOutline.
 *
 * @param {string} repoName
 * @param {object} analysis  Result of analyzeRepo()
 * @returns {string|null} README markdown, or null when the analysis has no outline
 */
export const generateReadmeFromOutline = (repoName, analysis) => {
    const { readmeOutline, techStack, meta } = analysis;
    if (!readmeOutline) return null;

    const { title, tagline, features, installationSteps, usageExample } = readmeOutline;
    const parts = [];

    parts.push(`# ${title || repoName}`, '');
    if (tagline) parts.push(`> ${tagline}`, '');

    if (meta?.language) {
        parts.push(`![${meta.language}](https://img.shields.io/badge/-${encodeURIComponent(meta.language)}-555?style=flat)`);
    }
    if (meta?.license) {
        parts.push(`![License](https://img.shields.io/badge/license-${encodeURIComponent(meta.license)}-blue?style=flat)`);
    }
    if (meta?.language || meta?.license) parts.push('');

    if (features?.length) {
        parts.push('## Features', '');
        features.forEach(f => parts.push(`- ${f}`));
        parts.push('');
    }

    if (installationSteps?.length) {
        parts.push('## Installation', '');
        parts.push('```bash');
        installationSteps.forEach(s => parts.push(s));
        parts.push('```', '');
    }

    if (usageExample) {
        parts.push('## Usage', '');
        parts.push('```');
        parts.push(usageExample);
        parts.push('```', '');
    }

    if (techStack?.length) {
        parts.push('## Built With', '');
        parts.push(techStack.map(t => `- ${t}`).join('\n'), '');
    }

    if (meta?.license) {
        parts.push('## License', '');
        parts.push(`[${meta.license}](LICENSE)`, '');
    }

    return parts.join('\n');
};
