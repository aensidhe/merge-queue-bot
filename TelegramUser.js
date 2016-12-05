class TelegramUser {
    constructor(id, username, firstName, lastName) {
        this._id = id;
        this._username = username;
        this._firstName = firstName;
        this._lastName = lastName;
    }

    get Id() { return this._id; }
    get UserName() { return this._username; }
    get FirstName() { return this._firstName; }
    get LastName() { return this._lastName; }

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
}

module.exports = TelegramUser