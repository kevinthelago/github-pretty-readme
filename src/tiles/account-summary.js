import Tile from "../common/Tile.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const googleAIStudioKey = process.env.GOOGLE_AI_STUDIO_KEY;
const prompt = process.env.PROMPT;

const renderAccountSummary = async (topics) => {
    let tile = new Tile(540, 960);

    const genAI = new GoogleGenerativeAI(googleAIStudioKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt + JSON.stringify(topics));
    console.log(result.response.text());

    return tile.render(`
            <text>
                ${result}
            </text>
    `);
}


console.log(renderAccountSummary(["python", "python", "python", "react-hooks", "javascript", "java", "node.js", "javascript", "expressjs"]));

export { renderAccountSummary };
export default renderAccountSummary;