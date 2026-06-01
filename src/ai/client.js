import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Single source of truth for the Google Gemini client.
 *
 * The whole AI layer (model.js, repo-analyzer.js, …) obtains its generative
 * model from here instead of each module constructing its own
 * `GoogleGenerativeAI`. Construction is lazy — importing this module performs no
 * network access and does not require `GOOGLE_AI_STUDIO_KEY` to be set — so unit
 * tests can import AI consumers and inject a fake model without touching the
 * network.
 */

export const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Creates a fresh GoogleGenerativeAI client.
 *
 * @param {string} [apiKey] Gemini API key; defaults to GOOGLE_AI_STUDIO_KEY.
 * @returns {import('@google/generative-ai').GoogleGenerativeAI}
 */
export const createAiClient = (apiKey = process.env.GOOGLE_AI_STUDIO_KEY) =>
    new GoogleGenerativeAI(apiKey);

let sharedClient;

/**
 * Returns the process-wide shared client, creating it on first use.
 * @returns {import('@google/generative-ai').GoogleGenerativeAI}
 */
export const getAiClient = () => (sharedClient ??= createAiClient());

/**
 * Resolves a generative model from the shared client.
 *
 * @param {object} [opts]
 * @param {string} [opts.model]            model id (default: gemini-2.5-flash)
 * @param {object} [opts.generationConfig] passed through to getGenerativeModel
 * @param {object} [opts.client]           inject a client (tests); defaults to shared
 * @returns {object} a model exposing `generateContent`
 */
export const getModel = ({ model = DEFAULT_MODEL, generationConfig, client = getAiClient() } = {}) =>
    client.getGenerativeModel(generationConfig ? { model, generationConfig } : { model });
