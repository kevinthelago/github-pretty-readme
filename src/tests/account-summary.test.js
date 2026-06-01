import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateScoreReport, generateReadmeFromOutline } from '../markdown/score-report.js';
import { scanCache } from '../scan-cache.js';

// Mock the network/AI dependencies of the account-summary handler so the
// regression tests exercise the handler's own logic (filtering, rendering,
// error handling) without hitting GitHub or Gemini.
vi.mock('../github/repos.js', () => ({ getRepos: vi.fn() }));
vi.mock('../ai/model.js', () => ({ default: vi.fn() }));

const { getRepos } = await import('../github/repos.js');
const { default: generateAccountSummary } = await import('../ai/model.js');
const { default: accountSummaryHandler } = await import('../../api/account-summary.js');
const { renderAccountSummary } = await import('../tiles/account-summary.js');

/** Minimal Express-style res double capturing status, headers, and body. */
const makeRes = () => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (key, value) => {
        res.headers[key.toLowerCase()] = value;
    };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.send = (body) => {
        res.body = body;
        return res;
    };
    return res;
};

const mockAnalysis = {
    meta: { owner: 'test', name: 'test-repo', language: 'JavaScript', license: 'MIT' },
    codeQuality: {
        overall: 72,
        grade: 'B',
        testing: {
            score: 60,
            grade: 'C',
            evidence: ['Test directory present'],
            missing: ['No coverage'],
        },
        documentation: { score: 75, grade: 'B', evidence: ['README present'], missing: [] },
        tooling: { score: 80, grade: 'A', evidence: ['Linter configured'], missing: [] },
        ci: { score: 85, grade: 'A', evidence: ['1 workflow file'], missing: [] },
        security: {
            score: 60,
            grade: 'C',
            evidence: ['.gitignore present'],
            missing: ['No Dependabot'],
        },
        structure: { score: 70, grade: 'B', evidence: ['src/ directory present'], missing: [] },
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
        for (const dim of [
            'Testing',
            'Documentation',
            'Tooling',
            'CI/CD',
            'Security',
            'Structure',
        ]) {
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
        const result = generateReadmeFromOutline('test-repo', {
            ...mockAnalysis,
            readmeOutline: null,
        });
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

// A summary long enough that its words survive the tile's line-chunking
// (chunks are only emitted once a line overflows the wrap width), so the text
// assertions below stay valid regardless of the chunking implementation.
const longSummary = Array.from({ length: 40 }, () => 'lorem').join(' ');

describe('renderAccountSummary', () => {
    test('returns the account-summary SVG tile structure', () => {
        const svg = renderAccountSummary(longSummary, undefined);
        expect(typeof svg).toBe('string');
        expect(svg).toContain('<svg');
        expect(svg).toContain('account-summary-text');
        expect(svg).toContain('viewBox="0 0 960 540"');
    });

    test('renders the summary text into the tile', () => {
        const svg = renderAccountSummary(longSummary, undefined);
        expect(svg).toContain('lorem');
    });
});

describe('account-summary handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('responds with an image/svg+xml tile on success', async () => {
        getRepos.mockResolvedValue([
            { name: 'repo-a', description: 'desc a', topics: ['js'], stargazers_count: 10 },
        ]);
        generateAccountSummary.mockResolvedValue(longSummary);

        const res = makeRes();
        await accountSummaryHandler({ query: { username: 'u', background: 'geometric' } }, res);

        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<svg');
        expect(res.body).toContain('account-summary-text');
        expect(res.body).toContain('lorem');
    });

    test('passes the projects filter through to the repo list', async () => {
        getRepos.mockResolvedValue([
            { name: 'keep', description: 'k', topics: [], stargazers_count: 1 },
            { name: 'drop', description: 'd', topics: [], stargazers_count: 2 },
        ]);
        generateAccountSummary.mockResolvedValue('summary');

        const res = makeRes();
        await accountSummaryHandler({ query: { username: 'u', projects: 'keep' } }, res);

        // Only the requested project should reach the AI model.
        const repoData = generateAccountSummary.mock.calls[0][0];
        expect(repoData).toHaveLength(1);
        expect(repoData[0].name).toBe('keep');
    });

    test('returns an error SVG with a 500 status when a dependency throws', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        getRepos.mockRejectedValue(new Error('upstream boom — internal detail'));

        const res = makeRes();
        await accountSummaryHandler({ query: { username: 'u' } }, res);

        // Error path stays valid SVG under the image content type, never plaintext.
        expect(res.headers['content-type']).toBe('image/svg+xml');
        expect(res.statusCode).toBe(500);
        expect(res.body).toContain('<svg');
        // The raw error message must not leak to the client.
        expect(res.body).not.toContain('internal detail');

        consoleError.mockRestore();
    });
});
