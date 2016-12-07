class TelegramUser {
    private _id: number;
    private _username: string;
    private _firstName: string;
    private _lastName: string;

    constructor(id: number, username: string, firstName: string, lastName: string) {
        this._id = id;
        this._username = username;
        this._firstName = firstName;
        this._lastName = lastName;
    }

    get id() : number { return this._id; }
    get userName() : string { return this._username; }
    get firstName() : string { return this._firstName; }
    get lastName() : string { return this._lastName; }

    getMention() : string {
        if (this._username)
            return `@${this._username}`;

        let result;
        if (this._lastName)
            result = this._lastName;

        if (this._firstName)
            result = result ? `${this._firstName} {result}` : this._firstName;

        return result ? result : this._id;
    }

    toHash(hash: Map<string, any>, prefix: string) : Map<string, any> {
        const actualPrefix = TelegramUser._getPrefix(prefix);
        let result = hash || new Map<string, any>();

        result[`${actualPrefix}.id`] = this._id;
        result[`${actualPrefix}.firstName`] = this._firstName;

        if (this._username)
            result[`${actualPrefix}.username`] = this._username;
        if (this._lastName)
            result[`${actualPrefix}.lastName`] = this._lastName;

        return result;
    }

    static _getPrefix(prefix: string) : string {
        return prefix || 'telegramUser';
    }

    static fromHash(hash: Map<string, any>, prefix: string) : TelegramUser|null {
        if (!hash) {
            return null;
        }

        const actualPrefix = TelegramUser._getPrefix(prefix);

        const id = hash[`${actualPrefix}.id`];
        if (!id) {
            return null;
        }

        const username = hash[`${actualPrefix}.username`];
        const firstName = hash[`${actualPrefix}.firstName`];
        const lastName = hash[`${actualPrefix}.lastName`]

        return new TelegramUser(id, username, firstName, lastName);
    }
}