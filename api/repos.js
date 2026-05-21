import { getAllRepos } from '../src/github/repos.js';

/**
 * GET /repos
 *
 * Returns a lightweight list of the authenticated user's repos,
 * sorted with the profile repo first then by most recently pushed.
 */
export default async (req, res) => {
    const token    = req.session?.github_token;
    const username = req.session?.github_username;
    if (!token || !username) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const repos = await getAllRepos(token);
        const list  = repos
            .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
            .map(r => ({
                name:        r.name,
                description: r.description ?? '',
                language:    r.language   ?? '',
                isProfile:   r.name === username,
                stars:       r.stargazers_count,
                pushedAt:    r.pushed_at,
            }));
        // Profile repo always first
        list.sort((a, b) => (b.isProfile ? 1 : 0) - (a.isProfile ? 1 : 0));
        res.json(list);
    } catch (err) {
        console.error('[repos]', err.message);
        res.status(500).json({ error: err.message });
    }
};
