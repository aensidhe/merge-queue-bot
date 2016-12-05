class Repository {
    constructor(user, repo) {
        this._user = user;
        this._name = repo;
    }

    get user() { return this._user; }
    get name() { return this._name; }
}

module.exports = Repository