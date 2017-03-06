import * as express from "express";
import * as compression from "compression";
import * as bodyParser from "body-parser";
import { Bot } from "./Bot";
import { IGitHubPullRequest } from "./GitHubClient";
import { Repository } from "./Repository";
import { Dal } from "./Redis/Dal";

interface IPullRequestAction {
    action: string,
    pull_request: IGitHubPullRequest
}

export interface IHookHandlerConfig {
    port: Number
}

export class HookHandler {
    public static readonly GitHubPRUrlPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';
    private readonly _redisDal: Dal;
    private readonly _bot: Bot;
    private readonly _urlParser: RegExp = new RegExp(HookHandler.GitHubPRUrlPattern);

    constructor(config: IHookHandlerConfig, bot : Bot, dal: Dal) {
        const app = express();
        app.use(compression());
        app.use(bodyParser.json());
        app.use((err, req, res, next) => {
            console.error(err);
            res.status(500);
            res.render('error', { error: err });
        });

        app.get('/', (req, res) => res.send('Hello World!'));

        app.post('/pull-request', this.onPullRequestChange.bind(this));

        app.listen(config.port, () => console.log(`Example app listening on port ${config.port}!`));

        this._bot = bot;
        this._redisDal = dal;
    }

    private

    private _parseUrl(url: string) : [Repository, Number] {
        let parseResult = this._urlParser.exec(url);
        if (parseResult == null) {
            throw { message: "Can't parse pr html_url" };
        }

        return [new Repository(parseResult[1], parseResult[2]), Number(parseResult[3])];
    }

    async onPullRequestChange(req : express.Request, res : express.Response) {
        const change = <IPullRequestAction> req.body;
        const [repo, id] = this._parseUrl(change.pull_request.html_url);

        console.log(`Got ${change.action} event for ${repo}/${id}`);

        if (change.action != "closed") {
            return;
        }

        const chats = await this._redisDal.getBindedChats(repo);
        let chatIds: Array<Number> = [];
        for (let chat of chats) {
            chatIds.push(Number(chat));
        }
        await this._bot.removePullRequest(repo, id, ...chatIds);
    }
}