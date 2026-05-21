const cache = new Map();
const TTL   = 30 * 60 * 1000; // 30 minutes

export const previewCache = {
    set(username, value) {
        cache.set(username, { value, ts: Date.now() });
    },
    get(username) {
        const e = cache.get(username);
        if (!e) return null;
        if (Date.now() - e.ts > TTL) { cache.delete(username); return null; }
        return e.value;
    },
    clear(username) { cache.delete(username); },
};
