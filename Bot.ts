import * as TelegramBot from 'node-telegram-bot-api'
import { Dal } from './Redis/Dal'
import { Acl } from './Acl'
const githubPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';

export class Bot {
    private readonly _acl : Acl;
    private readonly _gitHubClient: GitHubClient;
    private readonly _telegramConfig : TelegramConfig;
    private readonly _redisDal : Dal;
    private readonly _bot : TelegramBot

    constructor(gitHubClient : GitHubClient, acl :Acl, redisDal : Dal, telegramConfig : TelegramConfig) {
        this._acl = acl;
        this._gitHubClient = gitHubClient;
        this._telegramConfig = telegramConfig;
        this._redisDal = redisDal;
        this._bot = new TelegramBot(this._telegramConfig.token, {polling: true});

        this._bot.onText(
            new RegExp(`/add ${githubPattern}`),
            (msg, args) => this._handle(this.onAddPullRequest.bind(this), msg, args));

        this._bot.onText(
            new RegExp(`/remove ${githubPattern}`),
            (msg, args) => this._handle(this.onRemovePullRequest.bind(this), msg, args));

        this._bot.onText(
            /\/queue/,
            (msg, args) => this._handle(this.onQueueRequestHandler.bind(this), msg, args));

        this._bot.onText(
            /\/add_token (\S+) (\S+)/,
            (msg, args) => this._handle(this.onAddTokenHandler.bind(this), msg, args, {
                adminOnly: true,
                privateOnly: true
            }));

        this._bot.onText(
            /\/remove_token (\S+)/,
            (msg, args) => this._handle(this.onRemoveTokenHandler.bind(this), msg, args, {
                adminOnly: true,
                privateOnly: true
            }));

        this._bot.onText(
            /\/map_token (\S+) (\S+)/,
            (msg, args) => this._handle(this.onMapTokenHandler.bind(this), msg, args, {
                adminOnly: true,
                privateOnly: true
            }));

        this._bot.onText(
            /\/bind (\S+) (\S+)/,
            (msg, args) => this._handle(this.onBindRepoToChat.bind(this), msg, args, {
                adminOnly: true
            }));

        this._bot.onText(
            /\/unbind (\S+) (\S+)/,
            (msg, args) => this._handle(this.onUnbindRepoToChat.bind(this), msg, args, {
                adminOnly: true
            }));

        this._bot.onText(
            /\/ping/,
            (msg) => this._bot.sendMessage(msg.chat.id, 'pong'));
    }

    _hasAdminAccess(msg) {
        for (let i = 0; i < this._acl['su'].length; i++) {
            if (this._acl['su'][i] == msg.from.id)
                return true;
        }

        return false;
    }

    async _sendMessageToAllRepoChats(repository : Repository, message : string, ...chatIds: number[]) {
        let chats = new Set<string>(await this._redisDal.getBindedChats(repository));

        chatIds.forEach(x => chats.add(x.toString()));

        await this._sendToMultipleChats(message, chats);
    }

    async _reportQueueToChat(repository : Repository, chatId : number) {
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

    async generalErrorHandler(reason, currentChatId) {
        if (reason.messageFromBot && currentChatId) {
            console.log(reason.messageFromBot);
            await this._bot.sendMessage(
                currentChatId,
                reason.messageFromBot);
        }

        console.error(reason);
    }

    handleError(e, chatId) {
        return co(this.generalErrorHandler.bind(this), e, chatId);
    }

    _handle(handler : (msg: any, args: any) => Promise<void>, msg : any, args : any, options: any = {}) {
        options = options || {};
        console.log(`Received message: ${JSON.stringify(msg)}`)
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
            return co(handler, msg, args)
                .catch(e => this.handleError(e, msg.chat.id));
        }
        catch(e) {
            return this.handleError(e, msg.chat.Id);
        }
    }

    async _sendToMultipleChats(message : string, chatIds : Iterable<string>) {
        var outbox = new Array<Promise<void>>()
        for (let chatId of chatIds)
        {
            outbox.push(this._bot.sendMessage(
                chatId,
                message,
                { parse_mode: 'Markdown' }));
        }

        await Promise.all(outbox);
    }

    async onAddPullRequest(msg, args) {
        const repository = new Repository(args[1], args[2]);
        const id = Number(args[3]);

        if (!msg.from)
            throw { messageFromBot: "msg.user is empty. Can't process your pull request, sorry." };

        const token = await this._redisDal.getGithubToken(repository);
        const githubPr = await this._gitHubClient.GetPullRequest(repository, id, token);

        const pr = githubPr;

        await Promise.all([
            this._redisDal.savePullRequest(pr),
            this._redisDal.addPullRequestToQueue(pr)
        ]);

        if (pr.reporter == null)
        {
            throw { messageFromBot: "Repo should be added by someone." }
        }
        await this._sendMessageToAllRepoChats(
            repository,
            `PR [#${pr.id}](${pr.url}) is added to queue by ${pr.reporter.getMention()}`,
            msg.chat.id);
    }

    async onRemovePullRequest(msg, args) {
        const repository = new Repository(args[1], args[2]);
        const id = Number(args[3]);

        const pr = await this._redisDal.getPullRequest(repository, id);
        if (!pr)
            throw { messageFromBot: 'PR not found' };

        await this._redisDal.removePullRequestFromQueue(pr);

        if (pr.reporter == null) {
            await this._sendMessageToAllRepoChats(
                repository,
                `PR [#${pr.id}](${pr.url}) is removed from queue`,
                msg.chat.id);
        }
        else {
            await this._sendMessageToAllRepoChats(
                repository,
                `PR [#${pr.id}](${pr.url}) is removed from queue`,
                msg.chat.id,
                pr.reporter.id);
        }

        const next_pr = await this._redisDal.getNextPullRequestFromQueue(repository);

        if (next_pr)
            await this._sendMessageToAllRepoChats(
                repository,
                `PR [#${next_pr.id}](${next_pr.url}) by ${next_pr.reporter.getMention()} is next in queue!`,
                msg.chat.id,
                next_pr.reporter.id);
        else
            await this._sendMessageToAllRepoChats(
                repository,
                'Queue is empty!',
                msg.chat.id);
    }

    async onQueueRequestHandler(msg, args) {
        let repositoriesToReport = await this._redisDal.getBindedRepositories(msg.chat.id);
        let reports = new Array<Promise<void>>();
        repositoriesToReport.forEach(repo => {
            reports.push(this._reportQueueToChat(repo, msg.chat.id));
        })

        await reports;
    }

    async onAddTokenHandler(msg, args) {
        await this._redisDal.saveToken(new Token(args[1], args[2]));
        await this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} saved successfully.`);
    }

    async onRemoveTokenHandler(msg, args) {
        const name = args[1];
        await this._redisDal.deleteToken(name);
        await this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} deleted successfully.`);
    }

    async onMapTokenHandler(msg, args) {
        const owner = args[1];
        const name = args[2];
        await this._redisDal.saveTokenMapping(name, owner);
        await this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} will be used as an access to ${owner}`);
    }

    async onBindRepoToChat(msg, args) {
        const repository = new Repository(args[1], args[2]);

        await this._redisDal.saveChatBinding(msg.chat.id, repository);

        await this._bot.sendMessage(
            msg.chat.id,
            `This chat has been mapped to merge queue of ${repository}`);
    }

    async onUnbindRepoToChat(msg, args) {
        const repository = new Repository(args[1], args[2]);

        await this._redisDal.removeChatBinding(msg.chat.id, repository);

        await this._bot.sendMessage(
            msg.chat.id,
            `This chat has been unmapped from merge queue of ${repository}`);
    }

    async sendFarewell(reason) {
        if (this._telegramConfig.sendFarewells)
            await this._sendToMultipleChats(`Bot exited. Reason: ${reason}`, this._acl.su);
    }

    async sendGreetings() {
        if (this._telegramConfig.sendGreetings)
            await this._sendToMultipleChats("Bot started.", this._acl.su);
    }
}