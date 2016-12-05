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
}

module.exports = TelegramUser