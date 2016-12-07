const co = require('co');
const TelegramBot = require('node-telegram-bot-api');

const Repository = require('./Repository.js');
const TelegramUser = require('./TelegramUser.js');
const PullRequest = require('./PullRequest.js');
const Token = require('./Token.js');

const RedisDal = require('./RedisDal.js');

const githubPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';

class Bot {
    constructor(gitHubClient, acl, redisDal, telegramConfig) {
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
        for (let i = 0; i < this._acl.su.length; i++) {
            if (this._acl.su[i] == msg.from.id)
                return true;
        }

        return false;
    }

    * _sendMessageToAllRepoChats(repository, message) {
        let chats = new Set(yield this._redisDal.getBindedChats(repository));
        for (var i = 2; i < arguments.length; i++) {
            if (arguments[i] != undefined && arguments[i] != null)
                chats.add(arguments[i].toString());
        }

        yield this._sendToMultipleChats(message, chats);
    }

    * _reportQueueToChat(repository, chatId) {
        const queue = yield this._redisDal.getRepositoryQueue(repository);
        if (!queue || queue.length == 0)
        {
            yield this._bot.sendMessage(
                chatId,
                `Queue for ${repository} is empty`,
                { parse_mode: 'Markdown' });
            return;
        }

        let prGetters = [];
        queue.forEach(prId => {
            prGetters.push(this._redisDal.getPullRequest(repository, prId));
        });
        const prs = yield prGetters;
        let message = `Queue for ${repository}\n`;
        prs.forEach(pr => message += `- [#${pr.id}](${pr.url}) by ${pr.reporter.getMention()}\n`);

        yield this._bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    * generalErrorHandler(reason, currentChatId) {
        if (reason.messageFromBot && currentChatId) {
            console.log(reason.messageFromBot);
            yield this._bot.sendMessage(
                currentChatId,
                reason.messageFromBot);
        }

        console.error(reason);
    }

    handleError(e, chatId) {
        return co(this.generalErrorHandler.bind(this), e, chatId);
    }

    _handle(handler, msg, args, options) {
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

    * _sendToMultipleChats(message, chatIds) {
        let outbox = [];
        chatIds.forEach(chatId => {
            outbox.push(this._bot.sendMessage(
                chatId,
                message,
                { parse_mode: 'Markdown' }));
        });
        yield outbox;
    }

    * onAddPullRequest(msg, args) {
        const repository = new Repository(args[1], args[2]);
        const id = Number(args[3]);

        if (!msg.from)
            throw { messageFromBot: "msg.user is empty. Can't process your pull request, sorry." };

        const token = yield this._redisDal.getGithubToken(repository);
        const githubPr = yield this._gitHubClient.GetPullRequest(repository, id, token);

        const pr = new PullRequest(
            repository,
            id,
            new TelegramUser(msg.from.id, msg.from.username, msg.from.first_name, msg.from.last_name),
            new Date().getTime(),
            githubPr.html_url,
            githubPr.head.sha);

        yield [
            this._redisDal.savePullRequest(pr),
            this._redisDal.addPullRequestToQueue(pr)
        ];

        yield this._sendMessageToAllRepoChats(
            repository,
            `PR [#${pr.id}](${pr.url}) is added to queue by ${pr.reporter.getMention()}`,
            msg.chat.id);
    }

    * onRemovePullRequest(msg, args) {
        const repository = new Repository(args[1], args[2]);
        const id = Number(args[3]);

        const pr = yield this._redisDal.getPullRequest(repository, id);
        if (!pr)
            throw { messageFromBot: 'PR not found' };

        yield this._redisDal.removePullRequestFromQueue(pr);

        yield this._sendMessageToAllRepoChats(
            repository,
            `PR [#${pr.id}](${pr.url}) is removed from queue by ${pr.reporter.getMention()}`,
            msg.chat.id,
            pr.reporter.id);

        const next_pr = yield this._redisDal.getNextPullRequestFromQueue(repository);

        if (next_pr)
            yield this._sendMessageToAllRepoChats(
                repository,
                `PR [#${next_pr.id}](${next_pr.url}) by ${next_pr.reporter.getMention()} is next in queue!`,
                msg.chat.id,
                next_pr.userid);
        else
            yield this._sendMessageToAllRepoChats(
                repository,
                'Queue is empty!',
                msg.chat.id);
    }

    * onQueueRequestHandler(msg, args) {
        let repositoriesToReport = yield this._redisDal.getBindedRepositories(msg.chat.id);
        let reports = [];
        repositoriesToReport.forEach(repo => {
            reports.push(this._reportQueueToChat(repo, msg.chat.id));
        })

        yield reports;
    }

    * onAddTokenHandler(msg, args) {
        yield this._redisDal.saveToken(new Token(args[1], args[2]));
        yield this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} saved successfully.`);
    }

    * onRemoveTokenHandler(msg, args) {
        const name = args[1];
        yield this._redisDal.deleteToken(name);
        yield this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} deleted successfully.`);
    }

    * onMapTokenHandler(msg, args) {
        const owner = args[1];
        const name = args[2];
        yield this._redisDal.mapTokenToOwner(name, owner);
        yield this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} will be used as an access to ${owner}`);
    }

    * onBindRepoToChat(msg, args) {
        const repository = new Repository(args[1], args[2]);

        yield this._redisDal.saveChatBinding(msg.chat.id, repository);

        yield this._bot.sendMessage(
            msg.chat.id,
            `This chat has been mapped to merge queue of ${repository}`);
    }

    * onUnbindRepoToChat(msg, args) {
        const repository = new Repository(args[1], args[2]);

        yield this._redisDal.removeChatBinding(msg.chat.id, repository);

        yield this._bot.sendMessage(
            msg.chat.id,
            `This chat has been unmapped from merge queue of ${repository}`);
    }

    * sendFarewell(reason) {
        if (this._telegramConfig.sendFarewells)
            yield this._sendToMultipleChats(`Bot exited. Reason: ${reason}`, this._acl.su);
    }

    * sendGreetings() {
        if (this._telegramConfig.sendGreetings)
            yield this._sendToMultipleChats("Bot started.", this._acl.su);
    }
}

module.exports = Bot