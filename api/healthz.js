import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the version once at module load so the handler stays cheap (no I/O per
// request, no GitHub/AI calls) — /healthz must be safe to poll frequently.
const { version } = JSON.parse(
    readFileSync(join(__dirname, '../package.json'), 'utf8'),
);

/**
 * GET /healthz
 *
 * Liveness/health probe. Returns 200 with the service status and version.
 * Unauthenticated and dependency-free (no GitHub or AI calls) so it stays cheap
 * for load balancers, uptime checks, and Cloud Run health polling.
 *
 * @returns {void} 200 `{ status: 'ok', version: string }` as JSON.
 */
export default (req, res) => {
    res.status(200).json({ status: 'ok', version });
};
