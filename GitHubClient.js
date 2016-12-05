const GitHubApi = require('github');

class GitHubClient {
    _getAuthenticatedClient(token) {
        let github = new GitHubApi({
            headers: {
                'user-agent': 'Merge queue telegram bot' // GitHub is happy with a unique user agent
            },
            followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
        });

        console.log('Trying to authenticate in github')
        github.authenticate({
            type: 'oauth',
            token: token
        });
        console.log('Authenticated successfully in github')

        return github;
    }

    _promiseFullFiller(err, result, resolve, reject) {
        if (!err) {
            resolve(result);
        }

        if (err.Code == "404")
        {
            reject({ messageFromBot: "Pull request not found" });
            return;
        }

        throw (err);
    }

    * _makeGithubRequest(token, request) {
        let client = this._getAuthenticatedClient(token);
        yield new Promise((resolve, reject) => {
            request(client, (err, result) => {
                this._promiseFullFiller(err, result, resolve, reject).bind(this);
            });
        });
    }

    * GetPullRequest(repository, id, token) {
        yield this._makeGithubRequest(token, function (github, callback) {
            github.pullRequests.get(
            {
                owner: repository.owner,
                repo: repository.name,
                number: id
            },
            callback);
        });
    }

    SetCommitStatus(user, repo, id, status, token) {
        return makeGithubRequest(token, function (github, callback) {

        })
    }
}

module.exports = GitHubClient