import * as WebRequest from 'web-request';
import { Repository } from './Repository'
import { PullRequest } from "./PullRequest";

export interface IGitHubBranch {
    sha: string,
    ref: string
}

export interface IGitHubPullRequest {
    html_url: string,
    state: string,
    head: IGitHubBranch,
    base: IGitHubBranch,
    mergeable: boolean,
    mergeable_state: string
}

export interface IGithubCommitStatus {
    state: string,
    context: string
}

export interface IGithubCombinedStatus {
    state: string,
    statuses: IGithubCommitStatus[]
}

export class GitHubClient {
    private _getOptions(token: string, etag: string|null = null, usePreviewApi: boolean = false): WebRequest.RequestOptions {
        let options = {
            headers: {
                'user-agent': 'Merge queue telegram bot',
                'Authorization': `token ${token}`,
                'Accept': usePreviewApi
                    ? 'application/vnd.github.loki-preview+json'
                    : 'application/vnd.github.v3+json'
            }
        };

        if (etag != null) {
            options.headers["If-None-Match"] = etag;
        }

        return options;
    }

    public async GetGithubPr(repository: Repository, id: number, token: string, etag: string|null): Promise<[IGitHubPullRequest|null, string]> {
        const response = await WebRequest.get(
            `https://api.github.com/repos/${repository}/pulls/${id}`,
            this._getOptions(token, etag)
        );

        console.log(`Got PR#${id} from github. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode == 304) {
            if (etag == null) {
                throw new Error("Etag is null and got 304. This can't be.");
            }

            return [null, etag]
        }

        if (response.statusCode != 200)
            throw new Error("Not 200 code in response");

        return [JSON.parse(response.content), response.headers["etag"]];
    }

    public async GetCombinedStatus(pr: PullRequest, token: string, etag: string|null): Promise<[IGithubCombinedStatus|null, string]> {
        const response = await WebRequest.get(
            `https://api.github.com/repos/${pr.repository}/commits/${pr.github.head.ref}/status`,
            this._getOptions(token, etag)
        );

        console.log(`Got statuses for PR#${pr.id} from github. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode == 304) {
            if (etag == null) {
                throw new Error("Etag is null and got 304. This can't be.");
            }

            return [null, etag]
        }

        if (response.statusCode != 200)
            throw new Error("Not 200 code in response");

        return [JSON.parse(response.content), response.headers["etag"]];
    }

    public async SetCommitSuccess(pr: PullRequest, sha1: string, token: string) : Promise<void> {
        const response = await WebRequest.post(
            `https://api.github.com/repos/${pr.repository.owner}/${pr.repository.name}/statuses/${sha1}`,
            this._getOptions(token),
            JSON.stringify({
                "state": "success",
                "description": "Your pull request is first in queue",
                "context": "bot/merge-queue"
            })
        );

        console.log(`Set pending status for ${sha1}. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode >= 299)
            throw new Error("Not 200 code in response");
    }

    public async SetCommitPending(pr: PullRequest, sha1: string, token: string) : Promise<void> {
        const response = await WebRequest.post(
            `https://api.github.com/repos/${pr.repository.owner}/${pr.repository.name}/statuses/${sha1}`,
            this._getOptions(token),
            JSON.stringify({
                "state": "pending",
                "description": "Your pull request is pending in queue",
                "context": "bot/merge-queue"
            })
        );

        console.log(`Set pending status for ${sha1}. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode >= 299)
            throw new Error("Not 200 code in response");
    }

    public async GetRequiredStatuses(repo: Repository, branch: string, token: string, etag: string|null) : Promise<[string[], string]> {
        const response = await WebRequest.get(
            `https://api.github.com/repos/${repo}/branches/${branch}/protection/required_status_checks/contexts`,
            this._getOptions(token, etag, true)
        );

        console.log(`Got required statuses for repo ${repo} from github. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode == 200) {
            return [JSON.parse(response.content), response.headers["etag"]];
        }

        if (response.statusCode == 304) {
            return [[], response.headers["etag"]];
        }

        throw new Error(`Some error in github client: ${response.statusCode}`);
    }

    public async MergePullRequest(pr: PullRequest, token: string) {
        let response = await WebRequest.put(
            `https://api.github.com/repos/${pr.repository}/pulls/${pr.id}/merge`,
            this._getOptions(token, null, true),
            JSON.stringify({
                "commit_title": `Automatic merge by queue-bot of PR#${pr.id} (${pr.github.head.ref})`,
                "commit_message": `Merged by evote-queue-bot.
Added at: ${pr.reportedTime.toUTCString()}
Merged at: ${new Date().toUTCString()}`,
                "sha": pr.github.head.sha
            })
        );

        console.log(`Merge attempt for ${pr.repository}/${pr.id}. Status code is ${response.statusCode}: ${response.statusMessage}.`);

        if (response.statusCode != 200) {
            return;
        }

        response = await WebRequest.delete(
            `https://api.github.com/repos/${pr.repository}/git/refs/heads/${pr.github.head.ref}`,
            this._getOptions(token)
        )

        console.log(`Delete branch attempt for ${pr.repository}/${pr.github.head.ref}. Status code is ${response.statusCode}: ${response.statusMessage}.`);
    }
}