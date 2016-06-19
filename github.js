var GitHubApi = require('github');

module.exports = {
    getPrState: function(user, repo, id, token) {
        var github = new GitHubApi({
            headers: {
                'user-agent': 'Merge queue telegram bot' // GitHub is happy with a unique user agent
            },
            followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
        });
        github.authenticate({
            type: 'oauth',
            token: token
        });
        return new Promise(function (resolve, reject) {
            github.pullRequests.get(
            {
                user: user,
                repo: repo,
                number: id
            },
            function(err, pr) {
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

                resolve(pr);
            });
        })
    }
}