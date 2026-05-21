const cache = new Map();
const TTL   = 4 * 60 * 60 * 1000; // 4 hours

const key = (username, repo) => `${username}/${repo}`;

export const scanCache = {
    set(username, repo, value) {
        cache.set(key(username, repo), { value, ts: Date.now() });
    },
    get(username, repo) {
        const e = cache.get(key(username, repo));
        if (!e) return null;
        if (Date.now() - e.ts > TTL) { cache.delete(key(username, repo)); return null; }
        return e.value;
    },
    /** Returns all cached scans for a user as { repoName: analysis } */
    getAll(username) {
        const prefix = `${username}/`;
        const result = {};
        for (const [k, entry] of cache.entries()) {
            if (!k.startsWith(prefix)) continue;
            if (Date.now() - entry.ts > TTL) { cache.delete(k); continue; }
            result[k.slice(prefix.length)] = entry.value;
        }
        return result;
    },
    clear(username, repo) { cache.delete(key(username, repo)); },
};
