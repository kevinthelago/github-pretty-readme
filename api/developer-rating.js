import { getAllRepos } from '../src/github/repos.js';
import { computeRating } from '../src/github/developer-rating.js';
import { renderDeveloperRating } from '../src/tiles/developer-rating.js';

export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const token = req.session?.github_token ?? process.env.GITHUB_TOKEN;
        const repos = await getAllRepos(token);
        if (!repos) return res.status(401).send('GitHub not connected');

        const rating = computeRating(repos);
        return res.send(renderDeveloperRating(rating));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
