import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { routes } from '../../api/_routes.js';

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

    test('every route in the manifest is mounted (not 404)', async () => {
        // Derive the expectation from api/_routes.js so the manifest is the single
        // source of truth: if a descriptor is dropped, this test stops covering it.
        expect(routes.length).toBeGreaterThan(0);
        for (const { method, path } of routes) {
            // redirect:'manual' keeps auth-gated routes from following their 302
            // to '/', so we observe the route itself rather than the landing page.
            const res = await fetch(`http://localhost:${PORT}${path}`, { method: method.toUpperCase(), redirect: 'manual' });
            expect(res.status, `${method.toUpperCase()} ${path} returned 404 — route not registered`).not.toBe(404);
        }
    }, 30_000);

    test('auth-gated routes redirect unauthenticated requests', async () => {
        const gated = routes.filter(r => r.auth);
        expect(gated.length).toBeGreaterThan(0);
        for (const { method, path } of gated) {
            const res = await fetch(`http://localhost:${PORT}${path}`, { method: method.toUpperCase(), redirect: 'manual' });
            // `redirect: 'manual'` surfaces a 3xx directly, or an opaque-redirect
            // (type 'opaqueredirect', status 0) depending on the fetch runtime.
            const redirected = res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400);
            expect(redirected, `${method.toUpperCase()} ${path} should redirect when unauthenticated (got ${res.status})`).toBe(true);
        }
    });

    test('Unknown routes return 404', async () => {
        const res = await fetch(`http://localhost:${PORT}/does-not-exist`);
        expect(res.status).toBe(404);
    });
});
