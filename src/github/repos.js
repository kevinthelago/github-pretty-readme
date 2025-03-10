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

export { getRepos, getContents };
export default getRepos;
