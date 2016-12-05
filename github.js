var GitHubApi = require('github');

function get_authenticate_api_client(token) {
    let github = new GitHubApi({
        headers: {
            'user-agent': 'Merge queue telegram bot' // GitHub is happy with a unique user agent
        },
        followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    });

    github.authenticate({
        type: 'oauth',
        token: token
    });

    return github;
}

function promise_full_filler(err, result, resolve, reject) {
    if (err)
    {
        if (err.Code == "404")
        {
            reject({ messageFromBot: "Pull request not found" });
            return;
        }

        reject(err);
        return;
    }

    resolve(result);
}

function makeGithubRequest(token, request) {
    let client = get_authenticate_api_client(token);
    return new Promise(function(resolve, reject) {
        request(client, function(err, result) { promise_full_filler(err, result, resolve, reject); });
    });
}

function get_pull_request_state(user, repo, id, token) {
    return makeGithubRequest(token, function (github, callback) {
        github.pullRequests.get(
        {
            user: user,
            repo: repo,
            number: id
        },
        callback);
    });
}

function set_pull_request_status(user, repo, id, status, token) {
    return makeGithubRequest(token, function (github, callback) {

    })
}

module.exports = {
    get_pull_request_state: get_pull_request_state,
    set_pull_request_status: set_pull_request_status
}