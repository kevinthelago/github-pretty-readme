import { App } from "octokit";

const githubAppId = process.env.GITHUB_APP_ID;
const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY;

const octokit = new Octokit({
    appId: githubAppId,
    privateKey: githubPrivateKey
});

export { octokit };
export default octokit;
