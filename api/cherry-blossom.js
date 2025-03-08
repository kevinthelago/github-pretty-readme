import { renderCherryBlossom } from '../src/backgrounds/cherry-blossom.js';

export default async (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");

    try {
        return res.send(renderCherryBlossom())
    } catch (err) {
        return res.send(
            err.message
        )
    }
}