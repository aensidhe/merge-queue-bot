import {Repository} from "./Repository";
import { TelegramUser } from "./TelegramUser";
import { IGitHubPullRequest } from "./GitHubClient";

export class PullRequest {
    constructor(repository: Repository, id: number, reporter: TelegramUser, reportedTime: Date, github: IGitHubPullRequest, etag: string) {
        this.repository = repository;
        this.reporter = reporter;
        this.id = id;
        this.reportedTime = reportedTime;
        this.github = github;
        this.etag = etag;
    }

    readonly repository : Repository;
    readonly reporter : TelegramUser;
    readonly id : number;
    readonly etag : string;
    readonly reportedTime : Date;
    github : IGitHubPullRequest;

    toHash(hash?: Map<string, any>, prefix?: string) : Map<string, any> {
        const actualPrefix = PullRequest._getPrefix(prefix);
        let result = hash || new Map<string, any>();

        result[`${actualPrefix}.id`] = this.id;
        result[`${actualPrefix}.etag`] = this.etag == null? "" : this.etag;
        result[`${actualPrefix}.github`] = JSON.stringify(this.github);
        result[`${actualPrefix}.reportedTime`] = this.reportedTime.valueOf();

        if (this.reporter) {
            this.reporter.toHash(result, `${actualPrefix}.reporter`);
        }
        if (this.repository) {
            this.repository.toHash(result, `${actualPrefix}.repository`);
        }

        return result;
    }

    private static _getPrefix(prefix?: string) : string {
        return prefix || 'pullRequest';
    }

    static fromHash(hash: Map<string, any>, prefix?: string) : PullRequest|null {
        if (!hash) {
            return null;
        }

        const actualPrefix = PullRequest._getPrefix(prefix);

        const id = hash[`${actualPrefix}.id`];
        const etag = hash[`${actualPrefix}.etag`];
        const github = JSON.parse(hash[`${actualPrefix}.github`]);
        const time = new Date(Number(hash[`${actualPrefix}.reportedTime`]));

        if (!id || !time) {
            return null;
        }

        const repository = Repository.fromHash(hash, `${actualPrefix}.repository`);
        if (repository == null) {
            return null;
        }

        const reporter = TelegramUser.fromHash(hash, `${actualPrefix}.reporter`);
        if (reporter == null) {
            return null;
        }

        return new PullRequest(
            repository,
            id,
            reporter,
            time,
            github,
            etag
        );
    }
}