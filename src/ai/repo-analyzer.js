import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);

const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
});

// ── Scoring helpers (deterministic pre-pass) ───────────────────────────────────

const scoreTesting = (signals, fileContents) => {
    let score = 0;
    const evidence = [];
    const missing  = [];

    const keys = Object.keys(fileContents);
    const hasTestConfig = keys.some(k => /jest|vitest|pytest|karma|mocha|cypress|playwright/i.test(k));
    if (hasTestConfig)               { score += 25; evidence.push('Test framework configured'); }
    else                               missing.push('No test framework config found');

    if (signals.hasTestDir)          { score += 20; evidence.push('Test directory present'); }
    else                               missing.push('No dedicated test directory');

    if (signals.testFileCount > 0)   { score += 15; evidence.push(`${signals.testFileCount} test file(s) found`); }
    else                               missing.push('No test files detected');

    // Reward meaningful test ratio
    if (signals.testRatio >= 0.3)    { score += 20; evidence.push(`Good test ratio (${signals.testRatio})`); }
    else if (signals.testRatio > 0)  { score += 10; evidence.push(`Low test ratio (${signals.testRatio})`); missing.push('Increase test coverage'); }
    else                               missing.push('Test-to-source ratio is 0');

    if (signals.hasCoverage)         { score += 10; evidence.push('Coverage reporting configured'); }
    else                               missing.push('No coverage reporting');

    if (signals.workflowCount > 0)   { score += 10; evidence.push('CI runs workflows'); }

    return { score: Math.min(score, 100), evidence, missing };
};

const scoreDocumentation = (signals, fileContents) => {
    let score = 0;
    const evidence = [];
    const missing  = [];

    if (signals.hasReadme) {
        score += 15; evidence.push('README present');
        const readme = fileContents['README.md'] || fileContents['readme.md'] || '';
        if (readme.length > 500)           { score += 10; evidence.push('README has substantial content'); }
        if (/install/i.test(readme))       { score += 10; evidence.push('Installation section found'); }
        else                                 missing.push('No installation instructions in README');
        if (/usage|example|getting.start/i.test(readme)) { score += 10; evidence.push('Usage/examples section found'); }
        else                                 missing.push('No usage examples in README');
        if (/badge|shield/i.test(readme))  { score += 5;  evidence.push('Badges present'); }
        if (/api|endpoint|reference/i.test(readme)) { score += 5; evidence.push('API reference in README'); }
    } else {
        missing.push('No README');
    }

    if (signals.hasContributing) { score += 10; evidence.push('CONTRIBUTING.md present'); }
    else                           missing.push('No CONTRIBUTING.md');

    if (signals.hasChangelog)    { score += 10; evidence.push('CHANGELOG present'); }
    else                           missing.push('No CHANGELOG');

    if (signals.hasDocsDir)      { score += 10; evidence.push('Docs directory present'); }

    return { score: Math.min(score, 100), evidence, missing };
};

const scoreTooling = (signals) => {
    let score = 0;
    const evidence = [];
    const missing  = [];

    if (signals.hasLinter)     { score += 30; evidence.push('Linter configured'); }
    else                         missing.push('No linter configuration found');

    if (signals.hasFormatter)  { score += 25; evidence.push('Formatter configured'); }
    else                         missing.push('No code formatter found');

    if (signals.hasTypeScript) { score += 25; evidence.push('TypeScript in use'); }
    else if (signals.hasTsconfig) { score += 25; evidence.push('JS/TS config found (type checking enabled)'); }
    else                         missing.push('No static type checking');

    if (signals.hasMakefile)   { score += 10; evidence.push('Makefile present'); }
    if (signals.hasPreCommit)  { score += 10; evidence.push('Pre-commit hooks configured'); }
    else                         missing.push('No pre-commit hooks');

    return { score: Math.min(score, 100), evidence, missing };
};

const scoreCI = (signals, fileContents) => {
    let score = 0;
    const evidence = [];
    const missing  = [];

    if (signals.workflowCount === 0) {
        missing.push('No CI/CD workflows found');
        return { score: 0, evidence, missing };
    }

    score += 25; evidence.push(`${signals.workflowCount} workflow file(s) found`);

    const workflowContent = Object.entries(fileContents)
        .filter(([k]) => k.startsWith('.github/workflows/'))
        .map(([, v]) => v).join('\n');

    if (/\btest\b|\bspec\b|\bcheck\b/i.test(workflowContent)) { score += 25; evidence.push('Tests run in CI'); }
    else                                                          missing.push('No test step visible in workflows');

    if (/\blint\b|\bformat\b|\bcheck\b/i.test(workflowContent)) { score += 15; evidence.push('Lint/format check in CI'); }
    if (signals.hasDeployConfig || /deploy|release|publish/i.test(workflowContent)) {
        score += 20; evidence.push('Deployment pipeline present');
    } else {
        missing.push('No deployment automation detected');
    }

    if (/coverage|codecov|coveralls/i.test(workflowContent)) { score += 15; evidence.push('Coverage reporting in CI'); }
    else                                                         missing.push('No coverage upload in CI');

    return { score: Math.min(score, 100), evidence, missing };
};

const scoreSecurity = (signals) => {
    let score = 0;
    const evidence = [];
    const missing  = [];

    if (signals.hasDependabot)  { score += 35; evidence.push('Dependabot configured'); }
    else                          missing.push('No Dependabot config — automated dependency updates not enabled');

    if (signals.hasSecurityMd)  { score += 25; evidence.push('Security policy (SECURITY.md) present'); }
    else                          missing.push('No SECURITY.md — vulnerability reporting process undefined');

    if (signals.hasLicense)     { score += 20; evidence.push('License present'); }
    else                          missing.push('No license — legal status of code is unclear');

    if (signals.hasGitignore)   { score += 20; evidence.push('.gitignore present'); }
    else                          missing.push('No .gitignore — risk of committing secrets or build artifacts');

    return { score: Math.min(score, 100), evidence, missing };
};

const scoreStructure = (signals) => {
    let score = 0;
    const evidence = [];
    const missing  = [];

    if (signals.hasSrcDir)       { score += 30; evidence.push('Source organized under src/ or lib/'); }
    else if (signals.totalFiles > 10) missing.push('No src/ or lib/ — consider organizing source files');

    if (signals.hasGitignore)    { score += 20; evidence.push('.gitignore present'); }
    else                           missing.push('No .gitignore');

    if (signals.hasLicense)      { score += 20; evidence.push('License file present'); }
    else                           missing.push('No license file');

    if (signals.hasDocsDir)      { score += 15; evidence.push('Docs directory present'); }

    if (signals.hasDockerfile)   { score += 15; evidence.push('Docker configuration present'); }

    return { score: Math.min(score, 100), evidence, missing };
};

const gradeFromScore = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
};

// ── Build context string for Gemini ────────────────────────────────────────────

const buildContext = (snapshot) => {
    const { meta, signals, fileContents, tree } = snapshot;
    const parts = [];

    parts.push(`Repository: ${meta.owner}/${meta.name}`);
    parts.push(`Language: ${meta.language || 'unknown'} | Stars: ${meta.stars} | Forks: ${meta.forks}`);
    parts.push(`Description: ${meta.description || '(none)'}`);
    parts.push(`Topics: ${meta.topics.join(', ') || '(none)'}`);
    parts.push(`Total files: ${signals.totalFiles}${signals.treeWasTruncated ? ' (truncated)' : ''}`);
    parts.push(`License: ${meta.license || 'none'}`);
    parts.push('');

    // File tree sample
    parts.push('FILE TREE (sample):');
    parts.push(tree.paths.slice(0, 120).join('\n'));
    parts.push('');

    // Key file contents
    const orderedKeys = Object.keys(fileContents).sort((a, b) => {
        // Config files first, source files last
        const isConfig = k => !snapshot.sourceFiles.includes(k) && !snapshot.testFiles.includes(k);
        return (isConfig(b) ? 1 : 0) - (isConfig(a) ? 1 : 0);
    });

    for (const path of orderedKeys) {
        parts.push(`--- ${path} ---`);
        parts.push(fileContents[path]);
        parts.push('');
    }

    return parts.join('\n');
};

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Analyzes a repo snapshot and returns a structured quality report.
 * Runs deterministic scoring first, then sends context to Gemini for
 * qualitative assessment, suggested topics, and README outline.
 *
 * @param {object} snapshot  Result of getRepoSnapshot()
 * @returns {object}  Full analysis with codeQuality, suggestions, readmeOutline
 */
export const analyzeRepo = async (snapshot) => {
    const { meta, signals, fileContents } = snapshot;

    // ── Deterministic scoring ──────────────────────────────────────────────────
    const testing       = scoreTesting(signals, fileContents);
    const documentation = scoreDocumentation(signals, fileContents);
    const tooling       = scoreTooling(signals);
    const ci            = scoreCI(signals, fileContents);
    const security      = scoreSecurity(signals);
    const structure     = scoreStructure(signals);

    const weights = { testing: 0.22, documentation: 0.18, tooling: 0.18, ci: 0.20, security: 0.12, structure: 0.10 };
    const overall = Math.round(
        testing.score       * weights.testing +
        documentation.score * weights.documentation +
        tooling.score       * weights.tooling +
        ci.score            * weights.ci +
        security.score      * weights.security +
        structure.score     * weights.structure
    );

    const codeQuality = {
        overall,
        grade: gradeFromScore(overall),
        testing:       { ...testing,       grade: gradeFromScore(testing.score) },
        documentation: { ...documentation, grade: gradeFromScore(documentation.score) },
        tooling:       { ...tooling,       grade: gradeFromScore(tooling.score) },
        ci:            { ...ci,            grade: gradeFromScore(ci.score) },
        security:      { ...security,      grade: gradeFromScore(security.score) },
        structure:     { ...structure,     grade: gradeFromScore(structure.score) },
    };

    // ── Gemini qualitative pass ────────────────────────────────────────────────
    const context = buildContext(snapshot);
    const allMissing = [
        ...testing.missing, ...documentation.missing, ...tooling.missing,
        ...ci.missing, ...security.missing, ...structure.missing,
    ];

    const prompt = `You are a senior software engineer reviewing a GitHub repository.

${context}

DETERMINISTIC QUALITY SCORES (computed from file analysis):
- Testing:       ${testing.score}/100  (${gradeFromScore(testing.score)})
- Documentation: ${documentation.score}/100  (${gradeFromScore(documentation.score)})
- Tooling:       ${tooling.score}/100  (${gradeFromScore(tooling.score)})
- CI/CD:         ${ci.score}/100  (${gradeFromScore(ci.score)})
- Security:      ${security.score}/100  (${gradeFromScore(security.score)})
- Structure:     ${structure.score}/100  (${gradeFromScore(structure.score)})
- Overall:       ${overall}/100  (${gradeFromScore(overall)})

Already flagged as missing: ${allMissing.join('; ')}

Return a JSON object with EXACTLY this structure:
{
  "summary": "2-3 sentence project description written in third person",
  "suggestedDescription": "one concise GitHub repo description (under 120 chars)",
  "suggestedTopics": ["topic-slug-1", "topic-slug-2"],
  "techStack": ["Technology 1", "Technology 2"],
  "codeQualityNotes": {
    "testing": "1-2 sentence qualitative assessment of testing practices",
    "documentation": "1-2 sentence qualitative assessment",
    "tooling": "1-2 sentence qualitative assessment",
    "ci": "1-2 sentence qualitative assessment",
    "security": "1-2 sentence qualitative assessment",
    "structure": "1-2 sentence qualitative assessment"
  },
  "suggestions": [
    "Specific actionable improvement 1",
    "Specific actionable improvement 2",
    "Specific actionable improvement 3",
    "Specific actionable improvement 4",
    "Specific actionable improvement 5"
  ],
  "readmeOutline": {
    "title": "Project title (cleaned up from repo name)",
    "tagline": "Single compelling sentence describing what the project does",
    "features": ["Key feature 1", "Key feature 2", "Key feature 3"],
    "installationSteps": ["Step 1", "Step 2"],
    "usageExample": "A short code or command example showing basic usage"
  }
}

Rules:
- suggestedTopics must be valid GitHub topic slugs (lowercase, hyphens only, max 35 chars)
- suggestions must be specific to THIS repo's actual gaps — do not repeat what is already in "already flagged as missing" verbatim, but DO address those gaps with actionable steps
- codeQualityNotes must reflect what you actually see in the source files and config, not generic advice
- readmeOutline should be based on the actual purpose and features visible in the code`;

    try {
        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(result.response.text());

        return {
            meta,
            codeQuality: {
                ...codeQuality,
                notes: parsed.codeQualityNotes ?? {},
            },
            summary:             parsed.summary ?? '',
            suggestedDescription: parsed.suggestedDescription ?? '',
            suggestedTopics:     parsed.suggestedTopics ?? [],
            techStack:           parsed.techStack ?? [],
            suggestions:         parsed.suggestions ?? [],
            readmeOutline:       parsed.readmeOutline ?? null,
            signals,
        };
    } catch (err) {
        // Gemini failed — return deterministic results only
        return {
            meta,
            codeQuality,
            summary:             meta.description ?? '',
            suggestedDescription: meta.description ?? '',
            suggestedTopics:     meta.topics,
            techStack:           [meta.language].filter(Boolean),
            suggestions:         allMissing.slice(0, 5),
            readmeOutline:       null,
            signals,
            geminiError:         err.message,
        };
    }
};
