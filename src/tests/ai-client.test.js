import { describe, test, expect, vi } from 'vitest';
import { createAiClient, getModel, DEFAULT_MODEL } from '../ai/client.js';
import generateTopicsSummary, { generateTopicsSummary as named } from '../ai/model.js';
import { analyzeRepo } from '../ai/repo-analyzer.js';

// A minimal fake generative model. Records the prompt it was called with and
// returns a canned response — never touches the network.
const fakeModel = (text) => ({
    calls: [],
    generateContent(prompt) {
        this.calls.push(prompt);
        return Promise.resolve({ response: { text: () => text } });
    },
});

describe('ai/client.js', () => {
    test('getModel resolves a model from an injected client', () => {
        const client = { getGenerativeModel: vi.fn(() => 'MODEL') };
        const model = getModel({ client });
        expect(model).toBe('MODEL');
        expect(client.getGenerativeModel).toHaveBeenCalledWith({ model: DEFAULT_MODEL });
    });

    test('getModel forwards generationConfig when provided', () => {
        const client = { getGenerativeModel: vi.fn(() => 'JSON_MODEL') };
        getModel({ client, generationConfig: { responseMimeType: 'application/json' } });
        expect(client.getGenerativeModel).toHaveBeenCalledWith({
            model: DEFAULT_MODEL,
            generationConfig: { responseMimeType: 'application/json' },
        });
    });

    test('createAiClient does not require a key to construct', () => {
        expect(() => createAiClient('test-key')).not.toThrow();
    });
});

describe('ai/model.js generateTopicsSummary', () => {
    test('substitutes {topics} into AI_PROMPT and returns the model text', async () => {
        const prev = process.env.AI_PROMPT;
        process.env.AI_PROMPT = 'Summarize: {topics}';
        const model = fakeModel('a summary');

        const result = await generateTopicsSummary([{ name: 'repo-a' }], model);

        expect(result).toBe('a summary');
        expect(model.calls[0]).toBe('Summarize: [{"name":"repo-a"}]');
        process.env.AI_PROMPT = prev;
    });

    test('default and named exports are the same function', () => {
        expect(generateTopicsSummary).toBe(named);
    });
});

describe('ai/repo-analyzer.js analyzeRepo', () => {
    const snapshot = {
        meta: { owner: 'octocat', name: 'demo', description: 'd', language: 'JavaScript', topics: [], stars: 1, forks: 0, license: 'MIT' },
        signals: {
            hasTestDir: true, testFileCount: 2, sourceFileCount: 8, testRatio: 0.25,
            workflowCount: 1, hasDockerfile: false, hasDeployConfig: false,
            hasTypeScript: false, hasLinter: true, hasFormatter: true, hasCoverage: false,
            hasDependabot: false, hasSecurityMd: false, hasReadme: true, hasContributing: false,
            hasChangelog: false, hasLicense: true, hasGitignore: true, hasSrcDir: true,
            hasDocsDir: false, hasMakefile: false, hasPreCommit: false, hasTsconfig: false,
            totalFiles: 20, treeWasTruncated: false,
        },
        fileContents: { 'README.md': '# Demo\nInstallation and usage examples here.', 'package.json': '{}' },
        tree: { paths: ['README.md', 'package.json', 'src/index.js'] },
        sourceFiles: ['src/index.js'],
        testFiles: [],
    };

    test('uses the injected model and returns parsed Gemini fields', async () => {
        const geminiJson = JSON.stringify({
            summary: 'A demo project.',
            suggestedDescription: 'Demo',
            suggestedTopics: ['demo'],
            techStack: ['JavaScript'],
            codeQualityNotes: { testing: 'ok' },
            suggestions: ['Add coverage'],
            readmeOutline: { title: 'Demo' },
        });
        const result = await analyzeRepo(snapshot, fakeModel(geminiJson));

        expect(result.summary).toBe('A demo project.');
        expect(result.suggestedTopics).toEqual(['demo']);
        expect(result.codeQuality.overall).toBeGreaterThan(0);
        expect(result.codeQuality.notes.testing).toBe('ok');
    });

    test('falls back to deterministic scoring when the model fails', async () => {
        const brokenModel = { generateContent: () => Promise.reject(new Error('boom')) };
        const result = await analyzeRepo(snapshot, brokenModel);

        expect(result.geminiError).toBe('boom');
        expect(result.codeQuality.overall).toBeGreaterThan(0);
        expect(result.readmeOutline).toBeNull();
    });
});
