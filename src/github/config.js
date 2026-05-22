const ghHeaders = (token) => ({
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
});

const CONFIG_PATH = '.pretty-readme.json';

/** Reads .pretty-readme.json from the user's profile repo. Returns null if the file doesn't exist. */
export const readConfig = async (token, username) => {
    const res = await fetch(
        `https://api.github.com/repos/${username}/${username}/contents/${CONFIG_PATH}`,
        { headers: ghHeaders(token) },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET config → ${res.status}`);
    const file = await res.json();
    const config = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    return { config, sha: file.sha };
};

/** Writes .pretty-readme.json to the user's profile repo. Pass sha when updating an existing file. */
export const writeConfig = async (token, username, config, sha) => {
    const content = JSON.stringify(config, null, 2) + '\n';
    const body = {
        message: 'chore: update .pretty-readme.json',
        content: Buffer.from(content).toString('base64'),
        ...(sha ? { sha } : {}),
    };
    const res = await fetch(
        `https://api.github.com/repos/${username}/${username}/contents/${CONFIG_PATH}`,
        { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) },
    );
    if (!res.ok) throw new Error(`PUT config → ${res.status}: ${await res.text()}`);
};
