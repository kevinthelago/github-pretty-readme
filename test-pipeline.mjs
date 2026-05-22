/**
 * Local pipeline smoke test — runs without a GitHub session.
 * Tests: analyzeRepo (Gemini) → generateScoreReport → generateReadmeFromOutline
 *
 * Usage: node --env-file=.env test-pipeline.mjs [repoName]
 */
import { analyzeRepo }                                        from './src/ai/repo-analyzer.js';
import { generateScoreReport, generateReadmeFromOutline }    from './src/markdown/score-report.js';

const repoName = process.argv[2] ?? 'test-repo';

const mockSnapshot = {
    meta: {
        owner:         'kevinthelago',
        name:          repoName,
        description:   'A test repository for pipeline verification',
        language:      'JavaScript',
        topics:        ['nodejs', 'express'],
        stars:         5,
        forks:         1,
        size:          200,
        license:       'MIT',
        defaultBranch: 'main',
        visibility:    'public',
    },
    tree: {
        total:     20,
        truncated: false,
        paths: [
            'package.json', 'README.md', '.gitignore', 'LICENSE',
            'src/index.js', 'src/utils.js', 'tests/index.test.js',
            '.github/workflows/ci.yml',
        ],
    },
    signals: {
        hasTestDir:       true,
        testFileCount:    1,
        sourceFileCount:  2,
        testRatio:        0.5,
        workflowCount:    1,
        hasDockerfile:    false,
        hasDeployConfig:  false,
        hasTypeScript:    false,
        hasLinter:        false,
        hasFormatter:     false,
        hasCoverage:      false,
        hasDependabot:    false,
        hasSecurityMd:    false,
        hasReadme:        true,
        hasContributing:  false,
        hasChangelog:     false,
        hasLicense:       true,
        hasGitignore:     true,
        hasSrcDir:        true,
        hasDocsDir:       false,
        hasMakefile:      false,
        hasPreCommit:     false,
        totalFiles:       20,
        treeWasTruncated: false,
    },
    fileContents: {
        'package.json': JSON.stringify({ name: repoName, version: '1.0.0', description: 'A test repo', scripts: { test: 'jest', start: 'node src/index.js' }, dependencies: { express: '^4.18.0' }, devDependencies: { jest: '^29.0.0' } }, null, 2),
        'src/index.js': `const express = require('express');\nconst app = express();\napp.get('/', (req, res) => res.send('Hello World'));\napp.listen(3000);`,
        '.github/workflows/ci.yml': `name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v3\n      - run: npm ci\n      - run: npm test`,
    },
    sourceFiles: ['src/index.js', 'src/utils.js'],
    testFiles:   ['tests/index.test.js'],
    workflowFiles: ['.github/workflows/ci.yml'],
};

console.log(`\n── Testing repo pipeline for "${repoName}" ──\n`);

try {
    console.log('1. Running analyzeRepo (Gemini)…');
    const analysis = await analyzeRepo(mockSnapshot);

    console.log(`   ✓ Overall grade: ${analysis.codeQuality.grade} (${analysis.codeQuality.overall}/100)`);
    console.log(`   ✓ readmeOutline: ${analysis.readmeOutline ? 'present' : 'NULL — README will be skipped!'}`);
    if (analysis.readmeOutline) {
        console.log(`     title: "${analysis.readmeOutline.title}"`);
        console.log(`     features: ${analysis.readmeOutline.features?.length ?? 0} items`);
    }
    if (analysis.geminiError) {
        console.warn(`   ⚠ Gemini fallback triggered: ${analysis.geminiError}`);
    }
    console.log(`   ✓ techStack: [${analysis.techStack?.join(', ')}]`);
    console.log(`   ✓ suggestions: ${analysis.suggestions?.length ?? 0} items`);

    console.log('\n2. Generating SCORE.md…');
    const scoreMd = generateScoreReport(repoName, analysis);
    console.log(`   ✓ ${scoreMd.split('\n').length} lines generated`);
    console.log('   First line:', scoreMd.split('\n')[0]);

    console.log('\n3. Generating README.md…');
    const readmeMd = generateReadmeFromOutline(repoName, analysis);
    if (readmeMd) {
        console.log(`   ✓ ${readmeMd.split('\n').length} lines generated`);
        console.log('   First line:', readmeMd.split('\n')[0]);
    } else {
        console.warn('   ✗ generateReadmeFromOutline returned null — README would be skipped in apply-all');
    }

    console.log('\n── Pipeline test complete ──\n');
} catch (err) {
    console.error('\n✗ Pipeline test FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
}
