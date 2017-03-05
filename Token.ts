export class Token {
    constructor(name: string, token: string) {
        this.name = name;
        this.token = token;
    }

    readonly name: string;
    readonly token: string;
}