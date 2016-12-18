class GitHubClient {
    _getAuthenticatedClient(token) {
        // let github = new GitHubApi({
        //     headers: {
        //         'user-agent': 'Merge queue telegram bot' // GitHub is happy with a unique user agent
        //     },
        //     followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
        // });

        // console.log('Trying to authenticate in github')
        // github.authenticate({
        //     type: 'oauth',
        //     token: token
        // });
        // console.log('Authenticated successfully in github')

        // return github;
    }

    async GetPullRequest(repository : Repository, id : number, token : string) : Promise<PullRequest> {
        // const github = this._getAuthenticatedClient(token);
        // let pr = yield github.pullRequests.get({
        //     owner: repository.owner,
        //     repo: repository.name,
        //     number: id
        // });
        // console.log(`Got PR ${id} url: ${pr.html_url} and ${pr.head.sha}`);
        // return pr;
    }

    async SetCommitStatus(user, repo, id, status, token) {
    }
}