import * as TelegramBot from 'node-telegram-bot-api'
import { Dal } from './Redis/Dal'
import { Acl } from './Acl'
import { GitHubClient } from './GitHubClient'
import {Repository} from "./Repository";
import {TelegramUser} from "./TelegramUser";
import {Token} from "./Token";
import {TelegramConfig} from "./TelegramConfig";
import {PullRequest} from "./PullRequest";

class CommandOptions {
    readonly adminOnly : boolean;
    readonly privateOnly : boolean;

    constructor(adminOnly: boolean, privateOnly: boolean) {
        this.adminOnly = adminOnly;
        this.privateOnly = privateOnly;
    }
}

class BotCommand {
    readonly isNew: Boolean;
    readonly options: CommandOptions;
    readonly pattern : RegExp;
    readonly description : string;
    readonly handler : (msg: any, args: any) => Promise<void>;

    constructor(pattern : RegExp, description : string, handler : (msg: any, args: any) => Promise<void>, options: CommandOptions = new CommandOptions(false, false), isNew : Boolean = false) {
        this.pattern = pattern;
        this.description = description;
        this.handler = handler;
        this.options = options;
        this.isNew = isNew;
    }
}

export class Bot {
    public static readonly GitHubPRUrlPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';

    private static readonly PrivateAdminCommand : CommandOptions = {
        adminOnly : true,
        privateOnly : true
    };
    private static readonly PublicAdminCommand : CommandOptions = {
        adminOnly : true,
        privateOnly : false
    };
    private static readonly PrivateCommand : CommandOptions = {
        adminOnly : false,
        privateOnly : true
    };

    private readonly _commands : BotCommand[];
    private readonly _acl : Acl;
    private readonly _gitHubClient: GitHubClient;
    private readonly _telegramConfig : TelegramConfig;
    private readonly _redisDal : Dal;
    private readonly _bot : TelegramBot;

    constructor(gitHubClient : GitHubClient, acl :Acl, redisDal : Dal, telegramConfig : TelegramConfig) {
        this._acl = acl;
        this._gitHubClient = gitHubClient;
        this._telegramConfig = telegramConfig;
        this._redisDal = redisDal;
        this._bot = new TelegramBot(this._telegramConfig.token, {polling: true});

        // TypeScript and Javascript do not support named groups in RegExp, so unfortunately we need to repeat ourselves
        this._commands = [
            new BotCommand(
                new RegExp(`/add ${Bot.GitHubPRUrlPattern}`),
                `
/add https://github.com/{owner}/{repo}/pull/{id}
Adds PR to end of queue and reports it to queue chats.`,
                this.onAddPullRequest.bind(this),
                Bot.PrivateCommand),

            new BotCommand(
                new RegExp(`/hotfix ${Bot.GitHubPRUrlPattern}`),
                `
/hotfix https://github.com/{owner}/{repo}/pull/{id}
Adds PR to head of queue. Reports it to queue chats and to previous leader, if any.`,
                this.onAddHotfixPullRequest.bind(this),
                Bot.PrivateCommand,
                true),

            new BotCommand(
                new RegExp(`/remove ${Bot.GitHubPRUrlPattern}`),
                `
/remove https://github.com/{owner}/{repo}/pull/{id}
Removes PR from queue. Reports it to queue chats and to new leader, if any.`,
                this.onRemovePullRequest.bind(this),
                Bot.PrivateCommand),

            new BotCommand(
                /\/queue/,
                `
/queue
Prints queue for this chat.`,
                this.onQueueRequestHandler.bind(this)),

            new BotCommand(
                /\/add_token (\S+) (\S+)/,
                `
/add_token {token_name} {token}
Adds github token to database.`,
                this.onAddTokenHandler.bind(this),
                Bot.PrivateAdminCommand),

            new BotCommand(
                /\/remove_token (\S+)/,
                `
/remove_token {token_name}
Removes github token from database.`,
                this.onRemoveTokenHandler.bind(this),
                Bot.PrivateAdminCommand),

            new BotCommand(
                /\/map_token (\S+) (\S+)/,
                `
/map_token {owner} {token_name}
Maps token_name to owner.`,
                this.onMapTokenHandler.bind(this),
                Bot.PrivateAdminCommand),

            new BotCommand(
                /\/bind (\S+) (\S+)/,
                `
/bind {owner} {repo}
Bind this chat to owner/repo notification.`,
                this.onBindRepoToChat.bind(this),
                Bot.PublicAdminCommand),

            new BotCommand(
                /\/unbind (\S+) (\S+)/,
                `
/unbind {owner} {repo}
Bind this chat to owner/repo notification.`,
                this.onUnbindRepoToChat.bind(this),
                Bot.PublicAdminCommand),

            new BotCommand(
                /\/ping/,
                `
/ping
Returns pong.`,
                this.onPing.bind(this),
                Bot.PrivateCommand,
                true),

            new BotCommand(
                /\/help/,
                `
/help
Returns help.`,
                this.onHelp.bind(this),
                Bot.PrivateCommand,
                true),

            new BotCommand(
                /\/new/,
                `
/new
Returns only new commands in this release.`,
                this.onNewCommands.bind(this),
                Bot.PrivateCommand,
                true)
        ];

        for (let cmd of this._commands) {
            this._bot.onText(
                new RegExp(cmd.pattern),
                (msg, args) => this._handle(cmd.handler, msg, args, cmd.options)
            )
        }
    }

    private _hasAdminAccess(msg) {
        for (let i = 0; i < this._acl['su'].length; i++) {
            if (this._acl['su'][i] == msg.from.id)
                return true;
        }

        return false;
    }

    private async _sendMessageToAllRepoChats(repository : Repository, message : string, ...chatIds: Number[]) {
        let chats = new Set<string>(await this._redisDal.getBindedChats(repository));

        chatIds.forEach(x => chats.add(x.toString()));

        await this._sendToMultipleChats(message, Array.from(chats.values()));
    }

    private async _reportToAllChats(message : string) {
        let chats = new Set<string>(await this._redisDal.getAllBindedChats());

        this._acl.su.forEach(x => chats.add(x.toString()));

        await this._sendToMultipleChats(message, Array.from(chats.values()));
    }

    private async _reportQueueToChat(repository : Repository, chatId : Number) {
        const queue = await this._redisDal.getRepositoryQueue(repository);
        if (!queue || queue.length == 0)
        {
            await this._bot.sendMessage(
                chatId,
                `Queue for ${repository} is empty`,
                { parse_mode: 'Markdown' });
            return;
        }

        let message = `Queue for ${repository}\n`;
        queue.forEach(pr => message += `- [#${pr.id}](${pr.url}) by ${pr.reporter == null ? "pr.reporter is null": pr.reporter.getMention()}\n`);

        await this._bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    private async generalErrorHandler(reason, currentChatId) {
        if (reason.messageFromBot && currentChatId) {
            console.log(reason.messageFromBot);
            await this._bot.sendMessage(
                currentChatId,
                reason.messageFromBot);
        }

        console.error(reason);
    }

    private async _handle(handler : (msg: any, args: any) => Promise<void>, msg : any, args : any, options: CommandOptions) {
        console.log(`Received message: ${JSON.stringify(msg)}`);
        if (options.adminOnly && !this._hasAdminAccess(msg))
            return;

        if (options.privateOnly && msg.chat.type != 'private')
        {
            this._bot.sendMessage(
                msg.chat.id,
                'This operation supported only in private chat',
                { reply_to_message_id: msg.id });
            return;
        }

        try {
            await handler(msg, args);
        }
        catch(e) {
            await this.generalErrorHandler(e, msg.chat.Id);
        }
    }

    private async _sendToMultipleChats(message : string, chatIds : Array<string>) {
        let outbox = new Array<Promise<void>>();
        for (let chatId of chatIds)
        {
            outbox.push(this._bot.sendMessage(
                chatId,
                message,
                { parse_mode: 'Markdown' }));
        }

        await Promise.all(outbox);
    }

    private async _getPullRequestFromArgs(msg, args) : Promise<PullRequest> {
        const repository = new Repository(args[1], args[2]);
        const id = Number(args[3]);

        if (!msg.from)
            throw { messageFromBot: "msg.user is empty. Can't process your pull request, sorry." };

        const token = await this._redisDal.getGithubToken(repository);
        const githubPr = await this._gitHubClient.GetGithubPr(repository, id, token);
        const reporter = new TelegramUser(msg.from.id, msg.from.username, msg.from.first_name, msg.from.last_name);
        return new PullRequest(repository, id, reporter, new Date(), githubPr.html_url, githubPr.head.ref);
    }

    async _reportGithubStatus(pr: PullRequest) {
        const [index, token] = await Promise.all([
            this._redisDal.getPullRequestIndex(pr),
            this._redisDal.getGithubToken(pr.repository)
        ]);
        const githubPr = await this._gitHubClient.GetGithubPr(pr.repository, pr.id, token);
        if (githubPr.state != "open") {
            return;
        }

        if (index == 0) {
            await this._gitHubClient.SetCommitSuccess(pr, githubPr.head.sha, token);
        } else {
            await this._gitHubClient.SetCommitPending(pr, githubPr.head.sha, token);
        }
    }

    private async onAddPullRequest(msg, args) {
        const pr = await this._getPullRequestFromArgs(msg, args);
        await Promise.all([
            this._redisDal.savePullRequest(pr),
            this._redisDal.addPullRequestToQueue(pr)
        ]);

        await this._sendMessageToAllRepoChats(
            pr.repository,
            `PR [#${pr.id}](${pr.url}) is added to queue by ${pr.reporter.getMention()}`,
            msg.chat.id);
        await this._reportGithubStatus(pr);
    }

    private async onAddHotfixPullRequest(msg, args) {
        const pr = await this._getPullRequestFromArgs(msg, args);

        const results = await Promise.all([
            this._redisDal.savePullRequest(pr),
            this._redisDal.addHotfixToQueue(pr)
        ]);
        const formerFirst = results[1];

        if (formerFirst == null)
        {
            await this._sendMessageToAllRepoChats(
                pr.repository,
                `PR [#${pr.id}](${pr.url}) is a HOTFIX by ${pr.reporter.getMention()}`,
                msg.chat.id);
        }
        else
        {
            await this._sendMessageToAllRepoChats(
                pr.repository,
                `PR [#${pr.id}](${pr.url}) is a HOTFIX by ${pr.reporter.getMention()}`,
                msg.chat.id,
                formerFirst.reporter.id);
        }

        await this._reportGithubStatus(pr);
    }

    async removePullRequest(repository: Repository, id: Number, ...chatIds: Number[]) {
        const pr = await this._redisDal.getPullRequest(repository, id);
        if (!pr)
            throw { messageFromBot: 'PR not found' };

        await this._redisDal.removePullRequestFromQueue(pr);

        if (pr.reporter == null) {
            await this._sendMessageToAllRepoChats(
                repository,
                `PR [#${pr.id}](${pr.url}) is removed from queue`,
                ...chatIds);
        }
        else {
            await this._sendMessageToAllRepoChats(
                repository,
                `PR [#${pr.id}](${pr.url}) is removed from queue`,
                ...chatIds,
                pr.reporter.id);
        }

        const next_pr = await this._redisDal.getNextPullRequestFromQueue(repository);
        await this._reportGithubStatus(pr);

        if (next_pr == null) {
            await this._sendMessageToAllRepoChats(
                repository,
                'Queue is empty!',
                ...chatIds);
            return;
        }

        await this._sendMessageToAllRepoChats(
            repository,
            `PR [#${next_pr.id}](${next_pr.url}) by ${next_pr.reporter.getMention()} is next in queue!`,
            ...chatIds,
            next_pr.reporter.id);

        await this._reportGithubStatus(next_pr);
    }

    private async onRemovePullRequest(msg, args) {
        const repository = new Repository(args[1], args[2]);
        const id = Number(args[3]);

        await this.removePullRequest(repository, id, msg.chat.id);
    }

    private async onQueueRequestHandler(msg, args) {
        let repositoriesToReport = await this._redisDal.getBindedRepositories(msg.chat.id);
        let reports = new Array<Promise<void>>();
        repositoriesToReport.forEach(repo => {
            reports.push(this._reportQueueToChat(repo, msg.chat.id));
        });

        await reports;
    }

    private async onAddTokenHandler(msg, args) {
        await this._redisDal.saveToken(new Token(args[1], args[2]));
        await this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} saved successfully.`);
    }

    private async onRemoveTokenHandler(msg, args) {
        const name = args[1];
        await this._redisDal.deleteToken(name);
        await this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} deleted successfully.`);
    }

    private async onMapTokenHandler(msg, args) {
        const owner = args[1];
        const name = args[2];
        await this._redisDal.saveTokenMapping(name, owner);
        await this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} will be used as an access to ${owner}`);
    }

    private async onBindRepoToChat(msg, args) {
        const repository = new Repository(args[1], args[2]);

        await this._redisDal.saveChatBinding(msg.chat.id, repository);

        await this._bot.sendMessage(
            msg.chat.id,
            `This chat has been mapped to merge queue of ${repository}`);
    }

    private async onUnbindRepoToChat(msg, args) {
        const repository = new Repository(args[1], args[2]);

        await this._redisDal.removeChatBinding(msg.chat.id, repository);

        await this._bot.sendMessage(
            msg.chat.id,
            `This chat has been unmapped from merge queue of ${repository}`);
    }

    private async onPing(msg, args) {
        await this._bot.sendMessage(msg.chat.id, "Pong");
    }

    private async _printHelp(msg, shouldPrint : (command: BotCommand) => Boolean) {
        const isAdmin = this._hasAdminAccess(msg);
        let help = "";
        for (let cmd of this._commands) {
            if (cmd.options.adminOnly && !isAdmin) {
                continue;
            }

            if (!shouldPrint(cmd)) {
                continue;
            }

            help += cmd.description + "\n";
            if (cmd.options.adminOnly) {
                help += "Admin only command.\n"
            }

            if (cmd.options.privateOnly) {
                help += "Works only in private chat.\n"
            }
        }

        await this._bot.sendMessage(msg.chat.id, help);
    }

    private async onHelp(msg, args) {
        await this._printHelp(msg, _ => true);
    }

    private async onNewCommands(msg, args) {
        await this._printHelp(msg, x => x.isNew);
    }

    async sendFarewell(reason) {
        if (this._telegramConfig.sendFarewells)
            await this._reportToAllChats(`Bot exited. Reason: ${reason}`);
    }

    async sendGreetings() {
        if (this._telegramConfig.sendGreetings)
            await this._reportToAllChats("Bot started.");
    }
}