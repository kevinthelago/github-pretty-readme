import axios from 'axios';

const getRepos = (username) => {
    return axios.get(`https://api.github.com/users/${username}/repos`)
        .then(data => {
            return data.data;
        })
        .catch(err => {
            console.error(err);
            return null;
        });
};

const getContents = (username, repository, path) => {
    return axios.get(`https://api.github.com/repos/${username}/${repository}/contents/${path}`)
        .then(data => {
            return data.data
        })
        .catch(err => {
            console.error(err);
            return null;
        })
}

const getAllRepos = async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;

    const repos = [];
    let page = 1;

    while (true) {
        const response = await axios.get('https://api.github.com/user/repos', {
            headers: { Authorization: `Bearer ${token}` },
            params: { visibility: 'all', affiliation: 'owner', per_page: 100, page },
        });
        repos.push(...response.data);
        if (response.data.length < 100) break;
        page++;
    }

    return repos;
};

export { getRepos, getContents, getAllRepos };
export default getRepos;
