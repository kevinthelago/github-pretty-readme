import { describe, test, expect } from 'vitest';
import { createGithubClient, getRepos, getContents, getAllRepos } from '../github/repos.js';
import { getRepoSnapshot } from '../github/repo-contents.js';

// Builds a fake fetch from a handler(url) -> { ok?, status?, body? }.
// Records every requested URL so tests can assert on auth/pagination/paths.
const fakeFetch = (handler) => {
    const urls = [];
    const fn = async (url) => {
        const u = url.toString();
        urls.push(u);
        const { ok = true, status = 200, body = {} } = handler(u) ?? {};
        return { ok, status, json: async () => body };
    };
    fn.urls = urls;
    return fn;
};

describe('createGithubClient', () => {
    test('sends a Bearer token when one is provided', () => {
        const client = createGithubClient({ token: 'tok', fetchImpl: fakeFetch(() => ({})) });
        expect(client.headers().Authorization).toBe('Bearer tok');
        expect(client.headers().Accept).toBe('application/vnd.github+json');
    });

    test('omits Authorization when no token is available', () => {
        const client = createGithubClient({ token: null, fetchImpl: fakeFetch(() => ({})) });
        expect(client.headers().Authorization).toBeUndefined();
    });

    test('getJson returns parsed body on OK and null on non-OK', async () => {
        const okClient = createGithubClient({ token: 't', fetchImpl: fakeFetch(() => ({ body: { hello: 'world' } })) });
        expect(await okClient.getJson('/x')).toEqual({ hello: 'world' });

        const badClient = createGithubClient({ token: 't', fetchImpl: fakeFetch(() => ({ ok: false, status: 404 })) });
        expect(await badClient.getJson('/x')).toBeNull();
    });

    test('request appends query params to the URL', async () => {
        const ff = fakeFetch(() => ({ body: [] }));
        const client = createGithubClient({ token: 't', fetchImpl: ff });
        await client.request('/user/repos', { params: { per_page: 100, page: 2 } });
        expect(ff.urls[0]).toContain('per_page=100');
        expect(ff.urls[0]).toContain('page=2');
    });
});

describe('getRepos', () => {
    test('returns the repo array from a fake client', async () => {
        const client = createGithubClient({ fetchImpl: fakeFetch(() => ({ body: [{ name: 'a' }] })) });
        expect(await getRepos('octocat', client)).toEqual([{ name: 'a' }]);
    });

    test('returns null on a non-OK response', async () => {
        const client = createGithubClient({ fetchImpl: fakeFetch(() => ({ ok: false, status: 500 })) });
        expect(await getRepos('octocat', client)).toBeNull();
    });

    test('returns null on a transport error', async () => {
        const client = createGithubClient({ fetchImpl: () => Promise.reject(new Error('offline')) });
        expect(await getRepos('octocat', client)).toBeNull();
    });
});

describe('getContents', () => {
    test('returns the contents payload from a fake client', async () => {
        const client = createGithubClient({ fetchImpl: fakeFetch(() => ({ body: { path: 'README.md' } })) });
        expect(await getContents('octocat', 'demo', 'README.md', client)).toEqual({ path: 'README.md' });
    });
});

describe('getAllRepos', () => {
    test('returns null when no token is available', async () => {
        const prev = process.env.GITHUB_TOKEN;
        delete process.env.GITHUB_TOKEN;
        expect(await getAllRepos(undefined)).toBeNull();
        if (prev !== undefined) process.env.GITHUB_TOKEN = prev;
    });

    test('paginates until a short page and aggregates results', async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => ({ name: `r${i}` }));
        const page2 = [{ name: 'last' }];
        const ff = fakeFetch((u) => ({ body: u.includes('page=2') ? page2 : page1 }));
        const client = createGithubClient({ token: 't', fetchImpl: ff });

        const all = await getAllRepos('t', client);
        expect(all).toHaveLength(101);
        expect(all[100].name).toBe('last');
        expect(ff.urls).toHaveLength(2);
    });

    test('throws on a non-OK GitHub response', async () => {
        const client = createGithubClient({ token: 't', fetchImpl: fakeFetch(() => ({ ok: false, status: 401 })) });
        await expect(getAllRepos('t', client)).rejects.toThrow('401');
    });
});

describe('getRepoSnapshot', () => {
    const b64 = (s) => Buffer.from(s).toString('base64');
    const snapshotFetch = () => fakeFetch((u) => {
        if (u.includes('/git/trees/')) {
            return {
                body: {
                    truncated: false,
                    tree: [
                        { type: 'blob', path: 'package.json' },
                        { type: 'blob', path: 'src/index.js' },
                        { type: 'blob', path: 'README.md' },
                        { type: 'tree', path: 'src' },
                    ],
                },
            };
        }
        if (u.includes('/contents/')) {
            return { body: { encoding: 'base64', content: b64('file contents') } };
        }
        // repo metadata
        return {
            body: {
                default_branch: 'main',
                description: 'demo repo',
                language: 'JavaScript',
                topics: ['demo'],
                stargazers_count: 5,
                forks_count: 1,
                size: 10,
                license: { spdx_id: 'MIT' },
                visibility: 'public',
            },
        };
    });

    test('builds a snapshot from an injected client (no network)', async () => {
        const client = createGithubClient({ token: 't', fetchImpl: snapshotFetch() });
        const snap = await getRepoSnapshot('t', 'octocat', 'demo', client);

        expect(snap.meta.owner).toBe('octocat');
        expect(snap.meta.name).toBe('demo');
        expect(snap.meta.license).toBe('MIT');
        expect(snap.signals.totalFiles).toBe(3); // 3 blobs, the tree node excluded
        expect(snap.fileContents['package.json']).toBe('file contents');
    });

    test('throws when the repo metadata request is not OK', async () => {
        const client = createGithubClient({ token: 't', fetchImpl: fakeFetch(() => ({ ok: false, status: 404 })) });
        await expect(getRepoSnapshot('t', 'octocat', 'missing', client)).rejects.toThrow('Repo not found');
    });
});
