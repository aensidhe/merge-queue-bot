class Repository {
    constructor(owner, repo) {
        this._owner = owner;
        this._name = repo;
    }

    get owner() { return this._owner; }
    get name() { return this._name; }

    toString() {
        return `${this._owner}/${this._name}`;
    }

    /**
     * @param {string} s
     */
    static parse(s) {
        if (!s) {
            return null;
        }

        var parts = s.split('/');

        if (parts.length != 2) {
            throw new `Can't parse ${s} to repo`;
        }

        return new Repository(parts[0], parts[1]);
    }

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