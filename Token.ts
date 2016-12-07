class Token {
    private _name: string;
    private _token: string;

    constructor(name: string, token: string) {
        this._name = name;
        this._token = token;
    }

    get token() : string { return this._token; }
    get name() : string { return this._name; }
}