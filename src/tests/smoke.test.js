import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 9876;
let server;

before(async () => {
    server = spawn('node', ['express.js'], {
        env: { ...process.env, PORT: String(PORT), port: String(PORT) },
        stdio: 'pipe',
    });

    // Wait until the server responds
    await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Server failed to start within 10s')), 10_000);
        const probe = async () => {
            try {
                await fetch(`http://localhost:${PORT}/`);
                clearTimeout(deadline);
                resolve();
            } catch {
                setTimeout(probe, 250);
            }
        };
        probe();
    });
});

after(() => server?.kill());

test('GET / serves the landing page', async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/html'));
    const body = await res.text();
    assert.ok(body.includes('github-pretty-readme'), 'landing page title missing');
});

test('API routes are registered (not 404)', async () => {
    const routes = [
        '/developer-rating',
        '/tech-spider',
        '/tech-list',
        '/tech-categories',
        '/monkeytype',
        '/account-summary-md',
    ];
    for (const route of routes) {
        const res = await fetch(`http://localhost:${PORT}${route}`);
        assert.notEqual(res.status, 404, `${route} returned 404 — route not registered`);
    }
});

test('Unknown routes return 404', async () => {
    const res = await fetch(`http://localhost:${PORT}/does-not-exist`);
    assert.equal(res.status, 404);
});
