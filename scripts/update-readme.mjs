import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const key = process.env.GOOGLE_AI_STUDIO_KEY;
if (!key) {
    console.error('GOOGLE_AI_STUDIO_KEY is not set');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(key);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

const apiFiles = readdirSync(resolve(ROOT, 'api'))
    .filter(f => f.endsWith('.js'))
    .map(f => `### api/${f}\n\`\`\`js\n${read(`api/${f}`)}\n\`\`\``)
    .join('\n\n');

const tileFiles = readdirSync(resolve(ROOT, 'src/tiles'))
    .filter(f => f.endsWith('.js'))
    .map(f => `### src/tiles/${f}\n\`\`\`js\n${read(`src/tiles/${f}`)}\n\`\`\``)
    .join('\n\n');

const prompt = `You are a technical writer documenting a Node.js/Express API called github-pretty-readme.

It generates styled SVG graphics for GitHub profile READMEs. The server is started with \`npm start\` and endpoints are called as image URLs embedded in markdown.

Here is the full source:

## express.js
\`\`\`js
${read('express.js')}
\`\`\`

## API Handlers
${apiFiles}

## Tile Renderers (for context only — not needed in the docs)
${tileFiles}

## preview.config.js
\`\`\`js
${read('preview.config.js')}
\`\`\`

Write a README.md with these sections:
1. A one-paragraph project description.
2. ## Environment Variables — table of variable name, purpose, required.
3. ## Running Locally — \`npm start\` and \`npm run preview\` explained.
4. ## Endpoints — one subsection per route. Each subsection has a brief description and a markdown table of query params (name | default | description). Include example URLs.
5. ## Deployment — one sentence noting the GitHub Actions workflow pushes SVGs to a profile repo on a cron.

Rules:
- Be concise. No fluff.
- Use code fences for example URLs (\`http://localhost:8080/...\`).
- Do not wrap the output in a code fence — return raw markdown only.
- Do not include the tile renderer internals in the docs.`;

console.log('Generating README…');
const result = await model.generateContent(prompt);
const readme = result.response.text();

writeFileSync(resolve(ROOT, 'README.md'), readme, 'utf8');
console.log('README.md updated.');
