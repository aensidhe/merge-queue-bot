class TelegramUser {
    constructor(id: number, username: string, firstName: string, lastName: string) {
        this.id = id;
        this.username = username;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    readonly id: number;
    readonly username: string;
    readonly firstName: string;
    readonly lastName: string;

    getMention() : string {
        if (this.username)
            return `@${this.username}`;

        let result;
        if (this.lastName)
            result = this.lastName;

        if (this.firstName)
            result = result ? `${this.firstName} {result}` : this.firstName;

        return result ? result : this.id;
    }

    toHash(hash?: Map<string, any>, prefix?: string) : Map<string, any> {
        const actualPrefix = TelegramUser._getPrefix(prefix);
        let result = hash || new Map<string, any>();

        result[`${actualPrefix}.id`] = this.id;
        result[`${actualPrefix}.firstName`] = this.firstName;

        if (this.username)
            result[`${actualPrefix}.username`] = this.username;
        if (this.lastName)
            result[`${actualPrefix}.lastName`] = this.lastName;

        return result;
    }

    static _getPrefix(prefix?: string) : string {
        return prefix || 'telegramUser';
    }

    static fromHash(hash: Map<string, any>, prefix?: string) : TelegramUser|null {
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