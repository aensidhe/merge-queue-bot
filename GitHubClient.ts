import * as WebRequest from 'web-request';
import { Repository } from './Repository'
import { PullRequest } from "./PullRequest";

export interface IGitHubPullRequestHead {
    sha: string,
    ref: string
}

export interface IGitHubPullRequest {
    html_url: string,
    state: string,
    head: IGitHubPullRequestHead
}

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

    private async _post(url: string, options: WebRequest.RequestOptions, content: any) {
        return await WebRequest.post(
            url,
            options,
            JSON.stringify(content)
        );
    }

    public async GetGithubPr(repository: Repository, id: number, token: string): Promise<IGitHubPullRequest> {
        const response = await WebRequest.get(
            `https://api.github.com/repos/${repository.owner}/${repository.name}/pulls/${id}`,
            this._getOptions(token)
        );

        console.log(`Got PR#${id} from github. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode != 200)
            throw new Error("Not 200 code in response");

        return JSON.parse(response.content);
    }

    public async SetCommitSuccess(pr: PullRequest, sha1: string, token: string) : Promise<void> {
        const response = await this._post(
            `https://api.github.com/repos/${pr.repository.owner}/${pr.repository.name}/statuses/${sha1}`,
            this._getOptions(token),
            {
                "state": "success",
                "description": "Your pull request is first in queue",
                "context": "bot/merge-queue"
            }
        );

        console.log(`Set pending status for ${sha1}. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode >= 299)
            throw new Error("Not 200 code in response");
    }

    public async SetCommitPending(pr: PullRequest, sha1: string, token: string) : Promise<void> {
        const response = await this._post(
            `https://api.github.com/repos/${pr.repository.owner}/${pr.repository.name}/statuses/${sha1}`,
            this._getOptions(token),
            {
                "state": "pending",
                "description": "Your pull request is pending in queue",
                "context": "bot/merge-queue"
            }
        );

        console.log(`Set pending status for ${sha1}. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode >= 299)
            throw new Error("Not 200 code in response");
    }
}