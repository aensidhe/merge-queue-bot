import { Dal } from "./Redis/Dal";
import { PullRequest } from "./PullRequest";
import { GitHubClient } from "./GitHubClient";
import { Repository } from "./Repository";

export interface IStatusUpdaterConfig {
    timeoutMsec : number,
    allowedBranches: string[],
    protectedBranchesUpdateInterval : number
}

export class StatusUpdater {
    private readonly _github: GitHubClient;
    private readonly _dal: Dal;
    private readonly _config: IStatusUpdaterConfig;
    private readonly _bindedTimerCallback : (...args: any[]) => void;
    private _timer: NodeJS.Timer;

    constructor(config: IStatusUpdaterConfig, dal: Dal, github: GitHubClient) {
        this._config = config;
        this._dal = dal;
        this._github = github;
        this._bindedTimerCallback = this._timerCallback.bind(this);
    }

    start() {
        this.stop();
        this._timer = global.setTimeout(this._bindedTimerCallback, this._config.timeoutMsec);
    }

    stop() {
        global.clearTimeout(this._timer);
    }

    private _timerCallback() {
        this._checkAllPullRequests()
            .catch(e => console.error(e))
            .then(() => this.start());
    }

    private async _checkAllPullRequests() {
        const repos = await this._dal.getAllBindedRepos();
        if (repos.length == 0) {
            console.log("StatusUpdater: exiting, no binded repos.");
            return;
        }

        const queueGetters = Array<Promise<PullRequest[]>>(repos.length);
        for (let i = 0; i < repos.length; i++) {
             queueGetters[i] = this._dal.getRepositoryQueue(repos[i]);
        }

        const queues = await Promise.all(queueGetters);
        for (let i = 0; i < repos.length; i++) {
            const queue = await this._dal.getRepositoryQueue(repos[i])
            if (queue.length == 0) {
                console.log(`StatusUpdater: queue for ${repos[i]} is empty.`);
                continue;
            }

            const token = await this._dal.getGithubToken(repos[i]);
            await this._workOnFirstPullRequest(queues[i][0], token);
        }
    }

    private async _workOnFirstPullRequest(pr: PullRequest, token: string) : Promise<void> {
        if (this._config.allowedBranches.findIndex(x => x == pr.github.base.ref) == -1) {
            console.log(`StatusUpdater: merge to ${pr.github.base.ref} by bot is not allowed.`);
            return;
        }

        const combinedStatus = await this._github.GetCombinedStatus(pr, token);
        if (combinedStatus.state != "success") {
            console.log(`StatusUpdater: merge for PR#${pr.id} is not allowed. Combined status is ${combinedStatus.state}.`);
            return;
        }

        const actualPr = await this._github.GetGithubPr(pr.repository, pr.id, token);
        if (actualPr.state != "open") {
            console.log(`StatusUpdater: merge for PR#${pr.id} is not allowed. PR state is ${actualPr.state}.`);
            return;
        }

        if (!actualPr.mergeable) {
            console.log(`StatusUpdater: merge for PR#${pr.id} is not allowed. PR is not mergeable.`);
            return;
        }

        if (actualPr.mergeable_state != "clean") {
            console.log(`StatusUpdater: merge for PR#${pr.id} is not allowed. Mergeable state is ${actualPr.mergeable_state}.`);
            return;
        }

        if (pr.github.head.sha != actualPr.head.sha || pr.github.base.ref != actualPr.base.ref) {
            pr.github = actualPr;
            await this._dal.savePullRequest(pr);
        }

        const requiredStatuses = await this._getRequiredStatuses(pr.repository, actualPr.base.ref, token);
        const actualStatuses = combinedStatus.statuses
            .filter(x => x.state == "success")
            .map(x => x.context)
            .sort();

        if (!this._statusesEqual(actualStatuses, requiredStatuses)) {
            console.log(`StatusUpdater: merge for PR#${pr.id} is not allowed. Not all checks are good.`);
            return;
        }

        console.log(`StatusUpdater: merge for PR#${pr.id} is allowed. All checks good.`);
        await this._github.MergePullRequest(pr, token);
    }

    private async _getRequiredStatuses(repository: Repository, branch: string, token: string) {
        const [statuses, lastUpdated] = await this._dal.getRequiredStatuses(repository, branch);

        if (statuses != null && new Date().valueOf() - lastUpdated < this._config.protectedBranchesUpdateInterval) {
            return statuses;
        }

        if (statuses == null) {
            console.log(`StatusUpdater: downloading required statuses from github for ${repository}.`);
        }
        else {
            console.log(`StatusUpdater: updating required statuses from github for ${repository}.`);
        }

        const newStatuses = await this._github.GetRequiredStatuses(repository, branch, token);
        if (this._statusesEqual(statuses, newStatuses)) {
            await this._dal.touchRequiredStatuses(repository, branch);
        } else {
            await this._dal.setRequiredStatuses(repository, branch, newStatuses);
        }

        return newStatuses;
    }

    private _statusesEqual(oldStatuses: string[], newStatuses: string[]) : boolean {
        if (oldStatuses == null) {
            return newStatuses == null;
        }

        if (newStatuses == null) {
            return false;
        }

        if (oldStatuses.length != newStatuses.length) {
            return false;
        }

        oldStatuses.sort();
        newStatuses.sort();

        for (let i = 0; i < oldStatuses.length; i++) {
            if (oldStatuses[i] != newStatuses[i]) {
                return false;
            }
        }

        return true;
    }
}