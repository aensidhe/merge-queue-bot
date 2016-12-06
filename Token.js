class Token {
    constructor(name, token) {
        this._name = name;
        this._token = token;
    }

    get token() { return this._token; }
    get name() { return this._name; }
}

module.exports = Token