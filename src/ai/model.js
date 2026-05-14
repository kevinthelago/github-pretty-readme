import { GoogleGenerativeAI } from "@google/generative-ai";

const googleAIStudioKey = process.env.GOOGLE_AI_STUDIO_KEY;
const prompt = process.env.AI_PROMPT;
const genAI = new GoogleGenerativeAI(googleAIStudioKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const generateTopicsSummary = (repos) => {
    return model.generateContent(prompt.replace(/\{topics\}/g, JSON.stringify(repos)))
        .then(data => data.response.text())
        .catch(err => { throw err; });
}

export { generateTopicsSummary };
export default generateTopicsSummary;
