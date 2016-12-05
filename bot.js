const co = require('co');
const TelegramBot = require('node-telegram-bot-api');
const Repository = require('./Repository.js')

const githubPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';

const config = require('config');
const redisConfig = config.get('redis');
const redis = require('redis');
const P = require('bluebird');
P.promisifyAll(redis.RedisClient.prototype);
const client = redis.createClient(redisConfig);

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


    * _sendMessageToAllRepoChats(user, repo, message) {
        const repository = new Repository(user, repo);
        let chats = new Set(yield this._redisDal.getAllChatsForRepo(repository));
        for (var i = 3; i < arguments.length; i++) {
            if (arguments[i] != undefined && arguments[i] != null)
                chats.add(arguments[i].toString());
        }

        yield this._sendToMultipleChats(message, chats);
    }

    * _reportQueueToChat(repo, chatId) {
        const queue = yield client.zrangebyscoreAsync(`${repo}/queue`, '-inf', '+inf');
        if (!queue || queue.length == 0)
        {
            yield this._bot.sendMessage(chatId, `Queue for ${repo} is empty`, { parse_mode: 'Markdown' });
            return;
        }

        let prGetters = [];
        queue.forEach(prId => {
            prGetters.push(client.hgetallAsync(`${repo}/${prId}`));
        });
        const prs = yield prGetters;
        let message = `Queue for ${repo}\n`;
        prs.forEach(pr => message += `- [#${pr.id}](${pr.url}) by ${new TelegramUser(pr.userid, pr.username, pr.first_name, pr.last_name).getMention()}\n`);

        yield this._bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
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
            co(handler(msg, args));
        }
        catch(e) {
            co(this.generalErrorHandler(e, msg.chat.id));
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
        const user = args[1];
        const repo = args[2];
        const id = args[3];
        const repository = new Repository(user, repo);

        if (!msg.from)
            throw { messageFromBot: "msg.user is empty. Can't process your pull request, sorry." };

        const token = yield this._redisDal.getGithubToken(repository);
        const pr = yield this._gitHubClient.GetPullRequestState(user, repo, id, token);
        yield [
            client.hmsetAsync(`${user}/${repo}/${id}`, {
                userid: msg.from.id,
                username: msg.from.username,
                first_name: msg.from.first_name,
                last_name: msg.from.last_name,
                url: pr.html_url,
                id
            }),
            client.zaddAsync(`${user}/${repo}/queue`, new Date().getTime(), id)
        ];

        yield this._sendMessageToAllRepoChats(
            user,
            repo,
            `PR [#${id}](${pr.html_url}) is added to queue by ${new TelegramUser(msg.from.userid, msg.from.username, msg.from.first_name, msg.from.last_name).getMention()}`,
            msg.chat.id);
    }

    * onRemovePullRequest(msg, args) {
        const user = args[1];
        const repo = args[2];
        const id = args[3];

        const prData = yield client.hgetallAsync(`${user}/${repo}/${id}`);
        if (!prData)
            throw { messageFromBot: 'PR not found' };

        yield [
            client.delAsync(`${user}/${repo}/${id}`),
            client.zremAsync(`${user}/${repo}/queue`, id)
        ];

        yield this._sendMessageToAllRepoChats(
            user,
            repo,
            `PR [#${id}](${prData.url}) is removed from queue by ${new TelegramUser(msg.from.userid, msg.from.username, msg.from.first_name, msg.from.last_name).getMention()}`,
            msg.chat.id,
            prData.userid);

        const next = yield client.zrangebyscoreAsync([`${user}/${repo}/queue`, '-inf', '+inf', 'LIMIT', '0', '1']);
        const next_pr = yield client.hgetallAsync(`${user}/${repo}/${next}`);

        if (next_pr)
            yield this._sendMessageToAllRepoChats(
                user,
                repo,
                `PR [#${next_pr.id}](${next_pr.url}) by ${new TelegramUser(next_pr.userid, next_pr.username, next_pr.first_name, next_pr.last_name).getMention()} is next in queue!`,
                msg.chat.id,
                next_pr.userid);
        else
            yield this._sendMessageToAllRepoChats(
                user,
                repo,
                'Queue is empty!',
                msg.chat.id);
    }

    * onQueueRequestHandler(msg, args) {
        let repositoriesToReport = yield client.smembersAsync(`repo_chats:${msg.chat.id.toString()}`);
        let reports = [];
        repositoriesToReport.forEach(repo => {
            reports.push(this._reportQueueToChat(repo, msg.chat.id));
        })

        yield reports;
    }

    * onAddTokenHandler(msg, args) {
        const name = args[1];
        const token = args[2];
        yield client.hsetAsync('tokens', name, token);
        yield this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} saved successfully.`);
    }

    * onRemoveTokenHandler(msg, args) {
        const name = args[1];
        yield client.hdelAsync('tokens', name);
        yield this._bot.sendMessage(
            msg.chat.id,
            `Token ${name} deleted successfully.`);
    }

    * onMapTokenHandler(msg, args) {
        const user = args[1];
        const token = args[2];
        yield client.hsetAsync('user_to_token_map', user, token);
        yield this._bot.sendMessage(
            msg.chat.id,
            `Token ${token} will be used as an access to ${user}`);
    }

    * onBindRepoToChat(msg, args) {
        const user = args[1];
        const repo = args[2];

        yield [
            client.saddAsync(`repo_chats:${msg.chat.id.toString()}`, `${user}/${repo}`),
            client.saddAsync(`repo_chats:${user}/${repo}`, msg.chat.id)
        ];

        yield this._bot.sendMessage(
            msg.chat.id,
            `This chat has been mapped to merge queue of ${user}/${repo}`);
    }

    * onUnbindRepoToChat(msg, args) {
        const user = args[1];
        const repo = args[2];

        yield [
            client.sremAsync(`repo_chats:${msg.chat.id.toString()}`, `${user}/${repo}`),
            client.sremAsync(`repo_chats:${user}/${repo}`, msg.chat.id)
        ];

        yield this._bot.sendMessage(
            msg.chat.id,
            `This chat has been unmapped from merge queue of ${user}/${repo}`);
    }

    * generalErrorHandler(reason, currentChatId) {
        if (reason.messageFromBot) {
            console.log(reason.messageFromBot);
            yield this._bot.sendMessage(
                currentChatId,
                reason.messageFromBot);
        }

        console.error(reason);
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