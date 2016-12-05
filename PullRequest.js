class PullRequest {
    constructor(repository, id, reporter, reportedTime) {
        this._repository = repository;
        this._id = id;
        this._reporter = reporter;
        this._reportedTime = reportedTime;
    }

    get Repository() { return this._repository; }
    get Id() { return this._id; }
    get Reporter() { return this._reporter; }
    get ReportedTime() { return this._reportedTime; }
}

module.exports = PullRequest