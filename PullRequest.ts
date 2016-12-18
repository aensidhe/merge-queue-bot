class PullRequest {
    constructor(repository: Repository, id: number, reporter: TelegramUser|null, reportedTime: Date, url: string, sha1:string) {
        this.repository = repository;
        this.reporter = reporter;
        this.id = id;
        this.reportedTime = reportedTime;
        this.url = url;
        this.sha1 = sha1;
    }

    readonly repository : Repository;
    readonly reporter : TelegramUser|null;
    readonly id : number;
    readonly reportedTime : Date;
    readonly url : string;
    readonly sha1 : string;

    toHash(hash: Map<string, any>, prefix?: string) : Map<string, any> {
        const actualPrefix = PullRequest._getPrefix(prefix);
        let result = hash || new Map<string, any>();

        result[`${actualPrefix}.id`] = this.id;
        result[`${actualPrefix}.url`] = this.url;
        result[`${actualPrefix}.sha1`] = this.sha1;
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
        const sha1 = hash['pullRequest.sha1'];
        const time = new Date(hash['pullRequest.reportedTime']);

        if (!id || !time) {
            return null;
        }

        const repository = Repository.fromHash(hash, `${actualPrefix}.repository`);
        if (repository == null)
        {
            return null;
        }

        const reporter = TelegramUser.fromHash(hash, `${actualPrefix}.reporter`);

        return new PullRequest(
            repository,
            id,
            reporter,
            time,
            url,
            sha1
        );
    }
}