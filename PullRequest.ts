import {Repository} from "./Repository";
import {TelegramUser} from "./TelegramUser";

export class PullRequest {
    constructor(repository: Repository, id: number, reporter: TelegramUser, reportedTime: Date, url: string, branch: string) {
        this.repository = repository;
        this.reporter = reporter;
        this.id = id;
        this.reportedTime = reportedTime;
        this.url = url;
        this.branch = branch;
    }

    readonly repository : Repository;
    readonly reporter : TelegramUser;
    readonly id : number;
    readonly reportedTime : Date;
    readonly url : string;
    readonly branch : string;

    toHash(hash?: Map<string, any>, prefix?: string) : Map<string, any> {
        const actualPrefix = PullRequest._getPrefix(prefix);
        let result = hash || new Map<string, any>();

        result[`${actualPrefix}.id`] = this.id;
        result[`${actualPrefix}.url`] = this.url;
        result[`${actualPrefix}.branch`] = this.branch;
        result[`${actualPrefix}.reportedTime`] = this.reportedTime.getTime();

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

        const id = hash['pullRequest.id'];
        const url = hash['pullRequest.url'];
        const branch = hash['pullRequest.branch'];
        const time = new Date(hash['pullRequest.reportedTime']);

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
            url,
            branch
        );
    }
}