const Repository = require('./Repository.js');
const TelegramUser = require('./TelegramUser.js');

class PullRequest {
    constructor(repository, id, reporter, reportedTime, url, sha1) {
        this._repository = repository;
        this._reporter = reporter;
        this._id = id;
        this._reportedTime = reportedTime;
        this._url = url;
        this._sha1 = sha1;
    }

    get repository() { return this._repository; }
    get reporter() { return this._reporter; }
    get id() { return this._id; }
    get url() { return this._url; }
    get sha1() { return this._sha1; }
    get reportedTime() { return this._reportedTime; }

    toHash(hash, prefix) {
        const actualPrefix = PullRequest._getPrefix(prefix);
        let result = hash || {};

        result[`${actualPrefix}.id`] = this._id;
        result[`${actualPrefix}.url`] = this._url;
        result[`${actualPrefix}.sha1`] = this._sha1;
        result[`${actualPrefix}.reportedTime`] = this._reportedTime;

        if (this._reporter) {
            this._reporter.toHash(result, `${actualPrefix}.reporter`);
        }
        if (this._repository) {
            this._repository.toHash(result, `${actualPrefix}.repository`);
        }

        return result;
    }

    static _getPrefix(prefix) {
        return prefix || 'pullRequest';
    }

    static fromHash(hash, prefix) {
        if (!hash) {
            return null;
        }

        const actualPrefix = PullRequest._getPrefix(prefix);

        const id = hash['pullRequest.id'];
        const url = hash['pullRequest.url'];
        const sha1 = hash['pullRequest.sha1'];
        const time = hash['pullRequest.reportedTime'];

        if (!id || !time) {
            return null;
        }

        const repository = Repository.fromHash(hash, `${actualPrefix}.repository`);
        const reporter = TelegramUser.fromHash(hash, `${actualPrefix}.reporter`);

        return new PullRequest(
            repository,
            Number(id),
            reporter,
            Number(time),
            url,
            sha1
        );
    }
}

module.exports = PullRequest