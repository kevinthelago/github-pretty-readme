import { getAllRepos } from '../src/github/repos.js';
import { computeRating } from '../src/github/developer-rating.js';
import { renderDeveloperRating } from '../src/tiles/developer-rating.js';

export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const repos = await getAllRepos();
        if (!repos) return res.status(500).send('GITHUB_TOKEN is not configured');

        const rating = computeRating(repos);
        return res.send(renderDeveloperRating(rating));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
