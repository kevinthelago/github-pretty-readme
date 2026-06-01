import { describe, test, expect } from 'vitest';
import { generateScoreReport } from '../markdown/score-report.js';
import { generateReadmeFromOutline } from '../markdown/repo-readme.js';
import { scanCache } from '../scan-cache.js';

const mockAnalysis = {
    meta: { owner: 'test', name: 'test-repo', language: 'JavaScript', license: 'MIT' },
    codeQuality: {
        overall: 72,
        grade: 'B',
        testing:       { score: 60, grade: 'C', evidence: ['Test directory present'], missing: ['No coverage'] },
        documentation: { score: 75, grade: 'B', evidence: ['README present'],         missing: [] },
        tooling:       { score: 80, grade: 'A', evidence: ['Linter configured'],       missing: [] },
        ci:            { score: 85, grade: 'A', evidence: ['1 workflow file'],         missing: [] },
        security:      { score: 60, grade: 'C', evidence: ['.gitignore present'],      missing: ['No Dependabot'] },
        structure:     { score: 70, grade: 'B', evidence: ['src/ directory present'],  missing: [] },
    },
    suggestions: ['Add coverage reporting', 'Add Dependabot'],
    techStack: ['JavaScript', 'Node.js', 'Express.js'],
    readmeOutline: {
        title: 'Test Repo',
        tagline: 'A test repository',
        features: ['Feature one', 'Feature two'],
        installationSteps: ['npm install', 'npm start'],
        usageExample: 'node index.js',
    },
};

describe('generateScoreReport', () => {
    test('returns a non-empty markdown string', () => {
        const md = generateScoreReport('test-repo', mockAnalysis);
        expect(typeof md).toBe('string');
        expect(md.length).toBeGreaterThan(100);
    });

    test('includes the repo name in the heading', () => {
        const md = generateScoreReport('test-repo', mockAnalysis);
        expect(md).toContain('test-repo');
    });

    test('includes overall grade and score', () => {
        const md = generateScoreReport('test-repo', mockAnalysis);
        expect(md).toContain('72');
        expect(md).toContain('B');
    });

    test('includes all six dimension headings', () => {
        const md = generateScoreReport('test-repo', mockAnalysis);
        for (const dim of ['Testing', 'Documentation', 'Tooling', 'CI/CD', 'Security', 'Structure']) {
            expect(md).toContain(dim);
        }
    });

    test('includes suggestions section', () => {
        const md = generateScoreReport('test-repo', mockAnalysis);
        expect(md).toContain('Suggestions');
        expect(md).toContain('Add coverage reporting');
    });

    test('includes tech stack section', () => {
        const md = generateScoreReport('test-repo', mockAnalysis);
        expect(md).toContain('Tech Stack');
        expect(md).toContain('Node.js');
    });
});

describe('generateReadmeFromOutline', () => {
    test('returns a non-empty markdown string when outline is present', () => {
        const md = generateReadmeFromOutline('test-repo', mockAnalysis);
        expect(typeof md).toBe('string');
        expect(md.length).toBeGreaterThan(50);
    });

    test('returns null when readmeOutline is missing', () => {
        const result = generateReadmeFromOutline('test-repo', { ...mockAnalysis, readmeOutline: null });
        expect(result).toBeNull();
    });

    test('uses the outline title as the H1 heading', () => {
        const md = generateReadmeFromOutline('test-repo', mockAnalysis);
        expect(md).toContain('# Test Repo');
    });

    test('includes features list', () => {
        const md = generateReadmeFromOutline('test-repo', mockAnalysis);
        expect(md).toContain('Feature one');
        expect(md).toContain('Feature two');
    });

    test('includes installation steps in a code block', () => {
        const md = generateReadmeFromOutline('test-repo', mockAnalysis);
        expect(md).toContain('npm install');
        expect(md).toContain('```');
    });
});

describe('scanCache', () => {
    test('returns null for unknown keys', () => {
        expect(scanCache.get('nobody', 'unknown-repo')).toBeNull();
    });

    test('stores and retrieves a value', () => {
        const value = { score: 99 };
        scanCache.set('test-user', 'cache-test-repo', value);
        expect(scanCache.get('test-user', 'cache-test-repo')).toEqual(value);
    });

    test('clears a stored value', () => {
        scanCache.set('test-user', 'clear-test-repo', { score: 42 });
        scanCache.clear('test-user', 'clear-test-repo');
        expect(scanCache.get('test-user', 'clear-test-repo')).toBeNull();
    });

    test('getAll returns entries for a specific user', () => {
        scanCache.set('multi-user', 'repo-a', { score: 1 });
        scanCache.set('multi-user', 'repo-b', { score: 2 });
        const all = scanCache.getAll('multi-user');
        expect(all['repo-a']).toEqual({ score: 1 });
        expect(all['repo-b']).toEqual({ score: 2 });
    });

    test('getAll does not return entries for other users', () => {
        scanCache.set('user-x', 'repo', { score: 99 });
        const all = scanCache.getAll('user-y');
        expect(all['repo']).toBeUndefined();
    });
});
