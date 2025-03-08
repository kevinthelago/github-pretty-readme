import { App } from "octokit";

const githubAppId = process.env.GITHUB_APP_ID;
const githubPrivateKey = process.env.GITHUB_SECRET_KEY;

const octokit = new App({
    appId: githubAppId,
    privateKey: githubPrivateKey
});

const getTopics = (username) => {
    console.log(`GET /users/${username}/repos`)
    octokit.octokit.request(`GET /users/${username}/repos`)
        .then(data => {
            console.log(data);
        })
    // return octokit.octokit.rest.repos.getAllTopics({
    //     username
    // })
    // return ["javascript", "node-js", "express-js", "generative-ai", "google-gemini"]
};

export { getTopics };
export default octokit;
