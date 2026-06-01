import { createGithubClient } from './repos.js';

// Config/manifest files that reveal the project's toolchain
const KEY_FILES = [
    // Dependency manifests
    'package.json', 'package-lock.json',
    'requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.cfg', 'setup.py',
    'Cargo.toml', 'go.mod', 'go.sum',
    'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
    'Gemfile', 'composer.json', 'pubspec.yaml', 'mix.exs',
    // TypeScript / type-checking
    'tsconfig.json', 'jsconfig.json', 'mypy.ini', '.mypy.ini',
    // Linting
    '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml',
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
    '.pylintrc', '.flake8', '.rubocop.yml', '.rubocop.json',
    'tslint.json', '.stylelintrc', '.stylelintrc.json',
    // Formatting
    '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml',
    'prettier.config.js', '.editorconfig',
    // Testing frameworks
    'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs',
    'vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs',
    'pytest.ini', 'conftest.py', '.coveragerc', 'codecov.yml', '.codecov.yml',
    'karma.conf.js', '.mocharc.js', '.mocharc.yml', '.mocharc.json',
    'cypress.config.js', 'cypress.config.ts', 'playwright.config.ts',
    // Security
    '.github/dependabot.yml', '.github/dependabot.yaml',
    'SECURITY.md', '.github/SECURITY.md',
    // Repo hygiene
    'README.md', 'readme.md', 'README.rst', 'README.txt', 'README',
    'CONTRIBUTING.md', 'CONTRIBUTING.rst',
    'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'CHANGELOG.rst',
    'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE.rst', 'COPYING',
    '.gitignore', '.gitattributes',
    // Docker / infra
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.dockerignore', 'fly.toml', 'render.yaml', 'railway.toml',
    'vercel.json', 'netlify.toml', 'azure-pipelines.yml',
    // Other CI
    '.travis.yml', 'circle.yml', '.circleci/config.yml',
    'Jenkinsfile', '.gitlab-ci.yml',
    // Misc tooling
    'Makefile', 'makefile', '.pre-commit-config.yaml',
    'sonar-project.properties', '.codeclimate.yml',
];

const SOURCE_EXTS = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
    '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.php',
    '.scala', '.ex', '.exs', '.vue', '.svelte', '.elm',
]);

const TEST_SEGMENTS = new Set([
    'test', 'tests', '__tests__', 'spec', 'specs',
    '__spec__', 'e2e', 'integration', '__mocks__',
]);

const isTestPath = (path) => {
    const lower = path.toLowerCase();
    const parts = lower.split('/');
    if (parts.some(p => TEST_SEGMENTS.has(p))) return true;
    const file  = parts[parts.length - 1];
    return /\.(test|spec)\.[jt]sx?$/.test(file) ||
           /_test\.(go|py|rb)$/.test(file) ||
           /^test_/.test(file);
};

const extOf = (path) => {
    const i = path.lastIndexOf('.');
    return i !== -1 ? path.slice(i) : '';
};

const isSourceFile = (path) => SOURCE_EXTS.has(extOf(path)) && !isTestPath(path);

const readFile = async (gh, owner, repo, path) => {
    try {
        const res = await gh.request(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (Array.isArray(data) || data.encoding !== 'base64') return null;
        const text = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
        return text.slice(0, 10_000); // cap per file at 10 KB
    } catch {
        return null;
    }
};

/**
 * Fetches a thorough snapshot of a repository for code quality analysis.
 * Makes ~25–30 GitHub API calls per repo.
 *
 * @param {string} token       bearer token used to build a default client
 * @param {string} owner
 * @param {string} repoName
 * @param {object} [client]    injected GitHub client (tests); defaults to a
 *                             token-aware client (see createGithubClient)
 * @returns {{ meta, tree, signals, fileContents, sourceFiles, testFiles }}
 */
export const getRepoSnapshot = async (token, owner, repoName, client) => {
    const gh = client ?? createGithubClient({ token });

    // ── 1. Repo metadata ───────────────────────────────────────────────────────
    const metaRes = await gh.request(`/repos/${owner}/${repoName}`);
    if (!metaRes.ok) throw new Error(`Repo not found: ${owner}/${repoName}`);
    const meta = await metaRes.json();
    const branch = meta.default_branch || 'main';

    // ── 2. Full file tree ──────────────────────────────────────────────────────
    const treeRes = await gh.request(
        `/repos/${owner}/${repoName}/git/trees/${branch}`,
        { params: { recursive: 1 } }
    );
    if (!treeRes.ok) throw new Error(`Tree fetch failed for ${repoName}`);
    const { tree: rawTree = [], truncated } = await treeRes.json();
    const files = rawTree.filter(n => n.type === 'blob').map(n => n.path);

    // ── 3. Classify files ──────────────────────────────────────────────────────
    const workflowFiles = files
        .filter(f => f.startsWith('.github/workflows/') && (f.endsWith('.yml') || f.endsWith('.yaml')))
        .slice(0, 4);

    const presentKeyFiles = KEY_FILES.filter(kf => files.includes(kf));

    const sourceFilePaths = files.filter(isSourceFile);
    const testFilePaths   = files.filter(f => SOURCE_EXTS.has(extOf(f)) && isTestPath(f));

    // Prefer entry-point-style files for sampling
    const prioritizeSource = (paths) => {
        const priority = ['index', 'main', 'app', 'server', 'mod', 'lib'];
        const scored   = paths.map(p => {
            const base = p.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
            const rank = priority.indexOf(base);
            return { p, rank: rank === -1 ? 999 : rank };
        });
        return scored.sort((a, b) => a.rank - b.rank).map(x => x.p);
    };

    const sourceToRead = prioritizeSource(sourceFilePaths).slice(0, 4);
    const testToRead   = testFilePaths.slice(0, 3);

    // ── 4. Read all useful files in parallel ───────────────────────────────────
    const toRead = [
        ...presentKeyFiles,
        ...workflowFiles,
        ...sourceToRead,
        ...testToRead,
    ].slice(0, 30); // hard cap to protect rate limits

    const readResults = await Promise.all(
        toRead.map(async path => ({ path, content: await readFile(gh, owner, repoName, path) }))
    );

    const fileContents = {};
    readResults.forEach(({ path, content }) => {
        if (content !== null) fileContents[path] = content;
    });

    // ── 5. Derive structural signals deterministically ─────────────────────────
    const hasDir = (...names) => files.some(f => names.some(n => {
        const parts = f.split('/');
        return parts.slice(0, -1).some(p => p.toLowerCase() === n);
    }));

    const signals = {
        // Testing
        hasTestDir:      files.some(f => f.split('/').some(p => TEST_SEGMENTS.has(p.toLowerCase()))),
        testFileCount:   testFilePaths.length,
        sourceFileCount: sourceFilePaths.length,
        testRatio:       sourceFilePaths.length > 0
                            ? +(testFilePaths.length / sourceFilePaths.length).toFixed(2)
                            : 0,
        // CI/CD
        workflowCount:   workflowFiles.length,
        hasDockerfile:   files.some(f => /^Dockerfile$/i.test(f.split('/').pop())),
        hasDeployConfig: files.some(f =>
            ['fly.toml','render.yaml','vercel.json','netlify.toml','railway.toml','azure-pipelines.yml']
            .includes(f.split('/').pop())),
        // Tooling
        hasTypeScript:   files.some(f => f.endsWith('.ts') || f.endsWith('.tsx')),
        hasLinter:       presentKeyFiles.some(f => /eslint|pylint|rubocop|flake8|stylelint/i.test(f)),
        hasFormatter:    presentKeyFiles.some(f => /prettier|editorconfig/i.test(f)),
        hasCoverage:     presentKeyFiles.some(f => /coverag|codecov/i.test(f)),
        // Security
        hasDependabot:   files.some(f => /dependabot/i.test(f)),
        hasSecurityMd:   files.some(f => /SECURITY\.md$/i.test(f)),
        // Docs / hygiene
        hasReadme:       files.some(f => /^readme/i.test(f.split('/').pop())),
        hasContributing: files.some(f => /CONTRIBUTING/i.test(f.split('/').pop())),
        hasChangelog:    files.some(f => /CHANGELOG/i.test(f.split('/').pop())),
        hasLicense:      files.some(f => /^(LICENSE|COPYING)/i.test(f.split('/').pop())),
        hasGitignore:    files.includes('.gitignore'),
        // Structure
        hasSrcDir:       hasDir('src', 'lib', 'source'),
        hasDocsDir:      hasDir('docs', 'doc', 'documentation'),
        hasMakefile:     files.some(f => /^Makefile$/i.test(f.split('/').pop())),
        hasPreCommit:    files.includes('.pre-commit-config.yaml'),
        hasTsconfig:     presentKeyFiles.some(f => /^(ts|js)config\.json$/i.test(f)),
        totalFiles:      files.length,
        treeWasTruncated: !!truncated,
    };

    return {
        meta: {
            owner,
            name:        repoName,
            description: meta.description ?? '',
            language:    meta.language ?? '',
            topics:      meta.topics ?? [],
            stars:       meta.stargazers_count ?? 0,
            forks:       meta.forks_count ?? 0,
            size:        meta.size ?? 0,
            license:     meta.license?.spdx_id ?? null,
            defaultBranch: branch,
            visibility:  meta.visibility,
        },
        tree: {
            total:     files.length,
            truncated: !!truncated,
            paths:     files.slice(0, 300),
        },
        signals,
        fileContents,
        sourceFiles: sourceToRead,
        testFiles:   testToRead,
        workflowFiles,
    };
};
