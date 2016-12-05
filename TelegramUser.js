class TelegramUser {
    constructor(id, username, firstName, lastName) {
        this._id = id;
        this._username = username;
        this._firstName = firstName;
        this._lastName = lastName;
    }

    get id() { return this._id; }
    get userName() { return this._username; }
    get firstName() { return this._firstName; }
    get lastName() { return this._lastName; }

    getMention() {
        if (this._username)
            return `@${this._username}`;

        let result = nil;
        if (this._lastName)
            result = this._lastName;

        if (this._firstName)
            result = result ? `${this._firstName} {result} ` : this._firstName;

        return result ? result : this._id.toString();
    }

    toHash(hash, prefix) {
        const actualPrefix = _getPrefix(prefix);
        let result = hash || {}

        result[`${actualPrefix}.id`] = this._id;
        result[`${actualPrefix}.username`] = this._username;
        result[`${actualPrefix}.firstName`] = this._firstName;
        result[`${actualPrefix}.lastName`] = this._lastName;

        return result;
    }

    static _getPrefix(prefix) {
        return prefix || 'telegramUser';
    }

    static fromHash(hash, prefix) {
        if (!hash) {
            return null;
        }

        const actualPrefix = _getPrefix(prefix);

        const id = hash[`${actualPrefix}.id`];
        if (!id) {
            return null;
        }

        username = hash[`${actualPrefix}.username`];
        firstName = hash[`${actualPrefix}.firstName`];
        lastName = hash[`${actualPrefix}.lastName`]

        return new TelegramUser(Number(id), username, firstName, lastName);
    }
}

module.exports = TelegramUser