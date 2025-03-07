import { GoogleGenerativeAI } from "@google/generative-ai";

const googleAIStudioKey = process.env.GOOGLE_AI_STUDIO_KEY;
const genAI = new GoogleGenerativeAI(googleAIStudioKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const prompt = process.env.PROMPT;

const generateTopicsSummary = (topics) => {
    return model.generateContent(prompt + JSON.stringify(topics))
        .then(data => {
            return data.response.text();
        })
        .catch(err => {
            return err;
        });
}

export { generateTopicsSummary };
export default generateTopicsSummary;
