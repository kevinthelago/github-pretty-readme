const STATE_PATH = '.pretty-readme-state.json';

const ghHeaders = (token) => ({
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
});

/**
 * Reads .pretty-readme-state.json from the user's profile repo.
 * Returns { state: { repos: {} }, sha: null } if the file doesn't exist yet.
 */
export const readState = async (token, username) => {
    const res = await fetch(
        `https://api.github.com/repos/${username}/${username}/contents/${STATE_PATH}`,
        { headers: ghHeaders(token) },
    );
    if (res.status === 404) return { state: { repos: {} }, sha: null };
    if (!res.ok) throw new Error(`GET run-state → ${res.status}`);
    const file  = await res.json();
    const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    return { state, sha: file.sha };
};

/**
 * Writes .pretty-readme-state.json back to the user's profile repo.
 * Pass the sha returned by readState so GitHub can detect conflicts.
 */
export const writeState = async (token, username, state, sha) => {
    const content = JSON.stringify(state, null, 2) + '\n';
    const body = {
        message: 'chore: update pretty-readme run state',
        content: Buffer.from(content).toString('base64'),
        ...(sha ? { sha } : {}),
    };
    const res = await fetch(
        `https://api.github.com/repos/${username}/${username}/contents/${STATE_PATH}`,
        { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) },
    );
    if (!res.ok) throw new Error(`PUT run-state → ${res.status}: ${await res.text()}`);
};
