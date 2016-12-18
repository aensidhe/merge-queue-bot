class Limits {
    constructor(offset: number, count: number) {
        this.offset = offset;
        this.count = count;
    }

    readonly offset: number;
    readonly count: number;

    static get TopOne() { return new Limits(0, 1); };
}