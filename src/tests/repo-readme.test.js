import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateReadmeFromOutline } from '../markdown/repo-readme.js';

// Mock the network + AI layers so the endpoint test exercises the handler's own
// logic (auth gating, param parsing, cache use, response shape) against the REAL
// generator — no live GitHub or Gemini access.
vi.mock('../github/repo-contents.js', () => ({ getRepoSnapshot: vi.fn() }));
vi.mock('../ai/repo-analyzer.js', () => ({ analyzeRepo: vi.fn() }));
vi.mock('../scan-cache.js', () => ({ scanCache: { get: vi.fn(), set: vi.fn() } }));

const { getRepoSnapshot } = await import('../github/repo-contents.js');
const { analyzeRepo } = await import('../ai/repo-analyzer.js');
const { scanCache } = await import('../scan-cache.js');
const repositoryReadme = (await import('../../api/repository-readme.js')).default;

/** Minimal Express-style response double recording status and body. */
const makeRes = () => {
    const res = { statusCode: 200, body: undefined };
    res.status = (c) => {
        res.statusCode = c;
        return res;
    };
    res.json = (b) => {
        res.body = b;
        return res;
    };
    return res;
};

const call = (query = {}, session = {}) => {
    const res = makeRes();
    return repositoryReadme({ query, session }, res).then(() => res);
};

const SESSION = { github_token: 'tok', github_username: 'u' };

// ── Fixtures ────────────────────────────────────────────────────────────────

const fullOutline = {
    title: 'My Project',
    tagline: 'Does the thing well.',
    features: ['Fast', 'Tested'],
    installationSteps: ['npm install', 'npm start'],
    usageExample: 'import { thing } from "my-project";',
    configuration: [
        { name: 'API_KEY', description: 'auth token' },
        { name: 'PORT', description: 'listen port' },
    ],
    contributing: 'Open an issue, then send a PR against develop.',
};

// Each override fully replaces its field (so a test can pass an empty techStack
// or a license-less meta); readmeOutline merges onto the full fixture unless an
// explicit null is given.
const analysis = (over = {}) => ({
    meta: over.meta ?? { owner: 'u', name: 'my-project', language: 'JavaScript', license: 'MIT' },
    techStack: over.techStack ?? ['Node.js', 'Express'],
    readmeOutline:
        over.readmeOutline === undefined
            ? { ...fullOutline }
            : over.readmeOutline === null
              ? null
              : { ...fullOutline, ...over.readmeOutline },
});

// ── generateReadmeFromOutline: section presence/absence ──────────────────────

describe('generateReadmeFromOutline — sections render when data present', () => {
    test('renders title, tagline and a badge row', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toMatch(/^# My Project/);
        expect(md).toContain('> Does the thing well.');
        // language + license badges share one line (a row), not stacked
        expect(md).toMatch(/!\[JavaScript\]\([^)]+\) !\[License\]\([^)]+\)/);
        expect(md).toContain('shields.io/badge/license-MIT-blue');
    });

    test('falls back to repoName when the outline has no title', () => {
        const md = generateReadmeFromOutline('fallback-repo', analysis({ readmeOutline: { title: '' } }));
        expect(md).toMatch(/^# fallback-repo/);
    });

    test('renders a table of contents linking each section', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Table of Contents');
        expect(md).toContain('- [Features](#features)');
        expect(md).toContain('- [Installation](#installation)');
        expect(md).toContain('- [Configuration](#configuration)');
        expect(md).toContain('- [Built With](#built-with)');
        expect(md).toContain('- [Contributing](#contributing)');
        expect(md).toContain('- [License](#license)');
    });

    test('renders the features list', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Features');
        expect(md).toContain('- Fast');
        expect(md).toContain('- Tested');
    });

    test('renders installation steps inside a bash fence', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Installation');
        expect(md).toContain('```bash\nnpm install\nnpm start\n```');
    });

    test('renders the usage example inside a code fence', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Usage');
        expect(md).toContain('```\nimport { thing } from "my-project";\n```');
    });

    test('renders configuration as a table', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Configuration');
        expect(md).toContain('| Name | Description |');
        expect(md).toContain('| `API_KEY` | auth token |');
        expect(md).toContain('| `PORT` | listen port |');
    });

    test('renders the tech stack under Built With', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Built With');
        expect(md).toContain('- Node.js');
        expect(md).toContain('- Express');
    });

    test('renders the contributing section', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## Contributing');
        expect(md).toContain('Open an issue, then send a PR against develop.');
    });

    test('renders the license section linking LICENSE', () => {
        const md = generateReadmeFromOutline('my-project', analysis());
        expect(md).toContain('## License');
        expect(md).toContain('[MIT](LICENSE)');
    });
});

describe('generateReadmeFromOutline — empty sections are omitted', () => {
    test('returns null when there is no outline', () => {
        expect(generateReadmeFromOutline('r', { meta: {}, techStack: [], readmeOutline: null })).toBeNull();
    });

    test('omits every optional section for a minimal outline (no bare headers, no ToC)', () => {
        const md = generateReadmeFromOutline(
            'minimal',
            { meta: {}, techStack: [], readmeOutline: { title: 'Minimal', tagline: '' } },
        );
        expect(md).toBe('# Minimal\n');
        expect(md).not.toContain('## ');
        expect(md).not.toContain('Table of Contents');
    });

    test.each([
        ['Features', { features: [] }],
        ['Installation', { installationSteps: [] }],
        ['Usage', { usageExample: '' }],
        ['Configuration', { configuration: [] }],
        ['Contributing', { contributing: '' }],
    ])('omits the %s header when its data is empty', (heading, outlineOver) => {
        const md = generateReadmeFromOutline(
            'my-project',
            analysis({ readmeOutline: outlineOver, techStack: [], meta: { name: 'my-project' } }),
        );
        expect(md).not.toContain(`## ${heading}`);
        expect(md).not.toContain(`#${heading.toLowerCase().replace(/\s+/g, '-')})`);
    });

    test('omits Built With when techStack is empty and License when no license', () => {
        const md = generateReadmeFromOutline(
            'my-project',
            analysis({ techStack: [], meta: { name: 'my-project', language: 'JavaScript' } }),
        );
        expect(md).not.toContain('## Built With');
        expect(md).not.toContain('## License');
        // a license badge should not appear without a license
        expect(md).not.toContain('shields.io/badge/license');
    });

    test('skips the ToC when only a single section is present', () => {
        const md = generateReadmeFromOutline(
            'my-project',
            { meta: {}, techStack: [], readmeOutline: { title: 'Solo', features: ['only one'] } },
        );
        expect(md).toContain('## Features');
        expect(md).not.toContain('## Table of Contents');
    });
});

// ── GET /repository-readme endpoint ──────────────────────────────────────────

describe('GET /repository-readme', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        scanCache.get.mockReturnValue(undefined);
    });

    test('401 when the session is not authenticated', async () => {
        const res = await call({ repo: 'my-project' }, {});
        expect(res.statusCode).toBe(401);
        expect(getRepoSnapshot).not.toHaveBeenCalled();
    });

    test('400 when ?repo= is missing', async () => {
        const res = await call({}, SESSION);
        expect(res.statusCode).toBe(400);
    });

    test('scans + analyzes and returns the rendered markdown and analysis', async () => {
        getRepoSnapshot.mockResolvedValue({ meta: { name: 'my-project' } });
        analyzeRepo.mockResolvedValue(analysis());

        const res = await call({ repo: 'my-project' }, SESSION);

        expect(res.statusCode).toBe(200);
        expect(getRepoSnapshot).toHaveBeenCalledWith('tok', 'u', 'my-project');
        expect(res.body.analysis).toMatchObject({ meta: { name: 'my-project' } });
        expect(res.body.markdown).toMatch(/^# My Project/);
        expect(res.body.markdown).toContain('## Table of Contents');
        expect(res.body.markdown).toContain('## Configuration');
        // freshly computed analysis is cached for reuse
        expect(scanCache.set).toHaveBeenCalledWith('u', 'my-project', expect.any(Object));
    });

    test('splits owner/repo and serves a cached analysis without re-scanning', async () => {
        scanCache.get.mockReturnValue(analysis());

        const res = await call({ repo: 'someone/my-project' }, SESSION);

        expect(res.statusCode).toBe(200);
        expect(scanCache.get).toHaveBeenCalledWith('u', 'my-project');
        expect(getRepoSnapshot).not.toHaveBeenCalled();
        expect(res.body.markdown).toMatch(/^# My Project/);
    });

    test('refresh=true bypasses the cache and forces a fresh scan', async () => {
        scanCache.get.mockReturnValue(analysis());
        getRepoSnapshot.mockResolvedValue({ meta: { name: 'my-project' } });
        analyzeRepo.mockResolvedValue(analysis());

        const res = await call({ repo: 'my-project', refresh: 'true' }, SESSION);

        expect(res.statusCode).toBe(200);
        expect(scanCache.get).not.toHaveBeenCalled();
        expect(getRepoSnapshot).toHaveBeenCalled();
    });

    test('returns markdown:null when the analysis has no outline', async () => {
        getRepoSnapshot.mockResolvedValue({ meta: { name: 'my-project' } });
        analyzeRepo.mockResolvedValue(analysis({ readmeOutline: null }));

        const res = await call({ repo: 'my-project' }, SESSION);
        expect(res.statusCode).toBe(200);
        expect(res.body.markdown).toBeNull();
        expect(res.body.analysis).toBeDefined();
    });

    test('404 when the scan reports the repo is not found', async () => {
        getRepoSnapshot.mockRejectedValue(new Error('Repo not found'));
        const res = await call({ repo: 'ghost' }, SESSION);
        expect(res.statusCode).toBe(404);
    });

    test('500 on an unexpected scan error', async () => {
        getRepoSnapshot.mockRejectedValue(new Error('boom'));
        const res = await call({ repo: 'my-project' }, SESSION);
        expect(res.statusCode).toBe(500);
    });
});
