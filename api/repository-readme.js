import { renderReadme } from '../src/markdown/respository';

export default async (req, res) => {
    const {
        username,
        repository
    } = req.query;

    try {
        return res.send(
            renderReadme()
        )
    } catch (err) {
        return res.send(
            err.message
        )
    }
}