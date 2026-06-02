import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllRepos } from '../src/github/repos.js';
import { resolveAuth } from './_shared.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const PROMPT = (repos) =>
    `Write a 2-3 sentence developer bio for a GitHub profile README based on the following repositories. ` +
    `Be specific about the technologies and domains you see. Use plain prose — no markdown, no bullet points, no headers. ` +
    `Write in third person.\n\nRepositories:\n${JSON.stringify(repos, null, 2)}`;

export default async (req, res) => {
    res.setHeader('Content-Type', 'text/plain');

    try {
        const { token } = resolveAuth(req, { allowEnv: true });
        const repos = await getAllRepos(token);
        if (!repos) return res.status(401).send('GitHub not connected');

        const repoData = repos.map(r => ({
            name: r.name,
            description: r.description,
            language: r.language,
            topics: r.topics,
        }));

        const result = await model.generateContent(PROMPT(repoData));
        return res.send(result.response.text().trim());
    } catch (err) {
        return res.status(500).send(err.message);
    }
};
