import * as express from "express";
import * as compression from "compression";
import * as bodyParser from "body-parser";
import { Bot } from "./Bot";

export class HookHandler {
    readonly _bot: Bot;
    constructor(config, bot : Bot) {
        const app = express();
        app.use(compression());
        app.use(bodyParser.json())

        app.get('/', (req, res) => res.send('Hello World!'));

        app.post('/pull-request', this.onPullRequestChange.bind(this));
        app.post('/status', this.onRepoStatusChange.bind(this));

        app.listen(config.port, () => console.log(`Example app listening on port ${config.port}!`));

        this._bot = bot;
    }

    async onPullRequestChange(req : Request, res : Response) {
    }

    async onRepoStatusChange(req : Request, res : Response) {
    }
}