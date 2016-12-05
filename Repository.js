class Repository {
    constructor(owner, repo) {
        this._owner = owner;
        this._name = repo;
    }

    get owner() { return this._owner; }
    get name() { return this._name; }

    toHash(hash, prefix) {
        const actualPrefix = Repository._getPrefix(prefix);
        let result = hash || {}

        result[`${actualPrefix}.owner`] = this._owner;
        result[`${actualPrefix}.name`] = this._name;

        return result;
    }

    static _getPrefix(prefix) {
        return prefix || 'repository';
    }

    static fromHash(hash, prefix) {
        if (!hash) {
            return null;
        }

        const actualPrefix = Repository._getPrefix(prefix);

        const owner = hash[`${actualPrefix}.owner`];
        const name = hash[`${actualPrefix}.name`];

        if (!owner || !name) {
            return null;
        }

        return new Repository(owner, name);
    }
}

module.exports = Repository