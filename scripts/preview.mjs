import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../preview.config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'preview');
const BASE = `http://localhost:${config.port}`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const poll = async (url, retries = 30, interval = 500) => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch {}
        await wait(interval);
    }
    throw new Error(`Server at ${url} did not become ready`);
};

const fetchTile = async (tile) => {
    const res = await fetch(`${BASE}${tile.url}`);
    if (!res.ok) throw new Error(`${tile.name}: server responded ${res.status}`);
    const text = await res.text();
    if (!text.trim().startsWith('<svg') && !text.trim().startsWith('<')) {
        throw new Error(`${tile.name}: unexpected response — ${text.slice(0, 120)}`);
    }
    return text;
};

(async () => {
    mkdirSync(OUT_DIR, { recursive: true });

    console.log('Starting server…');
    const server = spawn('node', ['--env-file=.env', 'express.js'], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    server.stderr.on('data', d => process.stderr.write(d));

    try {
        await poll(`${BASE}/account-summary?username=kevinthelago`);
        console.log('Server ready.\n');

        for (const tile of config.tiles) {
            process.stdout.write(`  Fetching ${tile.name}…`);
            try {
                const svg = await fetchTile(tile);
                const outPath = resolve(OUT_DIR, `${tile.name}.svg`);
                writeFileSync(outPath, svg, 'utf8');
                console.log(` ✓  preview/${tile.name}.svg`);
            } catch (err) {
                console.log(` ✗  ${err.message}`);
            }
        }

        console.log(`\nDone. Open the files in preview/ to review.`);
        console.log(`  ${OUT_DIR}`);
    } finally {
        server.kill();
    }
})();
