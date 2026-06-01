import { getModel } from './client.js';

/**
 * Summarizes a set of repos via Gemini using the AI_PROMPT template.
 *
 * @param {Array}  repos   repo data substituted into the `{topics}` placeholder
 * @param {object} [model] injected generative model; defaults to the shared
 *                         client's model (see ./client.js). Inject a fake in
 *                         unit tests to avoid any network access.
 * @returns {Promise<string>} the generated summary text
 */
const generateTopicsSummary = (repos, model = getModel()) => {
    const prompt = process.env.AI_PROMPT;
    return model
        .generateContent(prompt.replace(/\{topics\}/g, JSON.stringify(repos)))
        .then((data) => data.response.text());
};

export { generateTopicsSummary };
export default generateTopicsSummary;
