import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';

const PORT = 9876;
let server;

beforeAll(async () => {
    server = spawn('node', ['express.js'], {
        env: { ...process.env, PORT: String(PORT), port: String(PORT) },
        stdio: 'pipe',
    });

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
}, 15_000);

afterAll(() => server?.kill());

describe('HTTP smoke tests', () => {
    test('GET / serves the landing page', async () => {
        const res = await fetch(`http://localhost:${PORT}/`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        const body = await res.text();
        expect(body).toContain('github-pretty-readme');
    });

    test('API routes are registered (not 404)', async () => {
        const routes = [
            '/developer-rating',
            '/tech-spider',
            '/tech-list',
            '/tech-categories',
            '/monkeytype',
            '/wakatime',
            '/account-summary-md',
        ];
        for (const route of routes) {
            const res = await fetch(`http://localhost:${PORT}${route}`);
            expect(res.status, `${route} returned 404 — route not registered`).not.toBe(404);
        }
    });

    test('Unknown routes return 404', async () => {
        const res = await fetch(`http://localhost:${PORT}/does-not-exist`);
        expect(res.status).toBe(404);
    });
});
