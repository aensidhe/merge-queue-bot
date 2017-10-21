export class Repository {
    constructor(owner: string, repo: string) {
        this.owner = owner;
        this.name = repo;
    }

    readonly owner : string;
    readonly name : string;

    toString() : string {
        return `${this.owner}/${this.name}`;
    }

    static parse(s: string) : Repository|null {
        if (!s) {
            return null;
        }

        const parts = s.split('/');

        if (parts.length != 2) {
            throw new Error(`Can't parse ${s} to repo`);
        }

        return new Repository(parts[0], parts[1]);
    }

    toHash(hash?: Map<string, any>, prefix?: string) : Map<string, any> {
        const actualPrefix = Repository._getPrefix(prefix);
        let result = hash || new Map<string, any>();

        result[`${actualPrefix}.owner`] = this.owner;
        result[`${actualPrefix}.name`] = this.name;

        return result;
    }

    private static _getPrefix(prefix?: string) : string {
        return prefix || 'repository';
    }

    static fromHash(hash: Map<string, any>, prefix?: string) : Repository|null {
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