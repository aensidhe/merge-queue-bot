import * as WebRequest from 'web-request';
import { Repository } from './Repository'

export class GitHubClient {
    private _getOptions(token: string): WebRequest.RequestOptions {
        return {
            headers: {
                'user-agent': 'Merge queue telegram bot',
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        };
    }

    public async GetPrUrlAndHead(repository: Repository, id: number, token: string): Promise<[string, string]> {
        let response = await WebRequest.get(
            `https://api.github.com/repos/${repository.owner}/${repository.name}/pulls/${id}`,
            this._getOptions(token)
        );

        if (response.statusCode != 200)
            throw new Error("Not 200 code in response");

        let pr = JSON.parse(response.content);

        return [
            pr.html_url,
            pr.head.sha
        ]
    }

    public async SetCommitStatus(user, repo, id, status, token) {
    }
}