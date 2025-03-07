import { App } from "octokit";

const githubAppId = process.env.GITHUB_APP_ID;
const githubPrivateKey = process.env.GITHUB_SECRET_KEY;

const octokit = new App({
    appId: githubAppId,
    privateKey: githubPrivateKey
});

const getTopics = (username) => {
    return ["javascript", "node-js", "express-js", "generative-ai", "google-gemini"]
};

export { getTopics };
export default octokit;
