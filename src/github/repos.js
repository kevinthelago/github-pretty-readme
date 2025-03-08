import axios from 'axios';

const getRepos = (username) => {
    return axios.get(`https://api.github.com/users/${username}/repos`)
        .then(data => {
            return data.data;
        })
        .catch(err => {
            return err;
        });
};

export { getRepos };
export default getRepos;
