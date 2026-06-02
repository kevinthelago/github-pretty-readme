import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8'),
);

const PORT = 9877;
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

describe('GET /healthz', () => {
    test('returns 200 with status ok + version, no auth', async () => {
        const res = await fetch(`http://localhost:${PORT}/healthz`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/json');

        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.version).toBe(version);
    });
});
