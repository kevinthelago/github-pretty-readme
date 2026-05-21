import { renderMonkeytypeChart } from '../src/tiles/monkeytype-chart.js';

const TIME_MODES = ['15', '30', '60', '120'];

const isStandardEnglish = r =>
    r.language === 'english' &&
    r.difficulty === 'normal' &&
    !r.punctuation &&
    !r.numbers &&
    !r.lazyMode;

/**
 * GET /monkeytype
 *
 * Fetches personal bests from the Monkeytype API and renders a WPM chart SVG.
 * Resolves the API key from (in order): session → env var.
 * Returns 401 if no key is available so the caller can prompt the user to connect.
 */
export default async (req, res) => {
    const apiKey = req.session?.monkeytype_key ?? process.env.MONKEYTYPE_API_KEY;
    if (!apiKey) return res.status(401).send('Monkeytype not connected');

    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        const response = await fetch('https://api.monkeytype.com/users/personalBests?mode=time', {
            headers: { Authorization: `ApeKey ${apiKey}` },
        });

        if (!response.ok) throw new Error(`Monkeytype API → ${response.status}: ${await response.text()}`);

        const { data } = await response.json();

        const modes = TIME_MODES.map(duration => {
            const entries = (data[duration] ?? []).filter(isStandardEnglish);
            if (entries.length === 0) return null;
            const best = entries.reduce((a, b) => a.wpm > b.wpm ? a : b);
            return {
                duration,
                wpm:         Math.round(best.wpm),
                acc:         best.acc,
                consistency: best.consistency,
            };
        }).filter(Boolean);

        if (modes.length === 0) return res.status(400).send('No standard English time mode data found');

        return res.send(renderMonkeytypeChart(modes));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
