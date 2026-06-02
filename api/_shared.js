/**
 * Convenience barrel for api/* handlers.
 *
 * Re-exports the shared HTTP helpers from {@link ../src/util/http.js} so handlers
 * import auth/error/query conventions from one place, and adds a couple of
 * handler-level conveniences built on top of them.
 */
import { resolveAuth, sendJsonError } from '../src/util/http.js';

export {
    bearerToken,
    resolveAuth,
    requireAuth,
    sendJsonError,
    errorSvg,
    sendErrorSvg,
    intParam,
    listParam,
    boolParam,
} from '../src/util/http.js';

/**
 * Resolve GitHub credentials for a JSON endpoint, or short-circuit with a 401.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{ allowEnv?: boolean, needUsername?: boolean }} [opts]
 *   `allowEnv` permits the GITHUB_TOKEN fallback; `needUsername` (default true)
 *   also requires a resolved username.
 * @returns {{ token: string, username: string|null } | null} the credentials, or
 *   `null` after a 401 has already been sent — callers should `return` on null.
 */
export const requireCredentials = (req, res, { allowEnv = false, needUsername = true } = {}) => {
    const { token, username } = resolveAuth(req, { allowEnv });
    if (!token || (needUsername && !username)) {
        sendJsonError(res, 401, 'unauthenticated', 'Not authenticated');
        return null;
    }
    return { token, username };
};
