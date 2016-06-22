'use strict'

const config = require('config');
const redisConfig = config.get('redis');
const redis = require('redis');
const P = require('bluebird')
P.promisifyAll(redis.RedisClient.prototype);
const client = redis.createClient(redisConfig);

const TelegramBot = require('node-telegram-bot-api');
const telegramConfig = config.get('telegram');
const bot = new TelegramBot(telegramConfig.token, {polling: true});
const github = require('./github.js');
const co = require('co');

const acl = config.get('acl');

function hasAdminAccess(msg) {
    for (let i = 0; i < acl.su.length; i++) {
        if (acl.su[i] == msg.from.id)
            return true;
    }

    return false;
}

function getUserMention(user) {
    if (user.username)
        return "@" + user.username;

    return user.first_name;
}

function* sendToMultipleChats(bot, message, chatIds) {
    let outbox = [];
    chatIds.forEach(chatId => {
        outbox.push(bot.sendMessage(
            chatId,
            message,
            { parse_mode: 'Markdown' }));
    });
    yield outbox;
}

function* sendMessageToAllRepoChats(user, repo, message) {
    let chats = new Set(yield client.smembersAsync('repo_chats:' + user + '/' + repo));
    for (var i = 3; i < arguments.length; i++) {
        if (arguments[i] != undefined && arguments[i] != null)
            chats.add(arguments[i].toString());
    }

    yield sendToMultipleChats(bot, message, chats);
}

function* onAddPullRequest(msg, args) {
    const user = args[1];
    const repo = args[2];
    const id = args[3];

    if (!msg.user)
        throw { messageFromBot: "msg.user is empty. Can't process your pull request, sorry." };

    const tokenName = yield client.hgetAsync('user_to_token_map', user);
    if (!tokenName)
        throw { messageFromBot: 'Token for your repo is not found.' };

    const token = yield client.hgetAsync('tokens', tokenName);
    const pr = yield github.getPrState(user, repo, id, token);
    yield [
        client.hmsetAsync(user + '/' + repo + '/' + id, {
            userid: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            url: pr.html_url,
            id: id
        }),
        client.zaddAsync(user + '/' + repo + '/queue', new Date().getTime(), id)
    ];

    yield sendMessageToAllRepoChats(
        user,
        repo,
        'PR [#' + id + '](' + pr.html_url + ') is added to queue by ' + getUserMention(msg.from),
        msg.chat.id);
}

function* onRemovePullRequest(msg, args) {
    const user = args[1];
    const repo = args[2];
    const id = args[3];

    const prData = yield client.hgetallAsync(user + '/' + repo + '/' + id);
    if (!prData)
        throw { messageFromBot: 'PR not found' };

    yield [
        client.delAsync(user + '/' + repo + '/' + id),
        client.zremAsync(user + '/' + repo + '/queue', id)
    ];

    yield sendMessageToAllRepoChats(
        user,
        repo,
        'PR [#' + id + '](' + prData.url + ') is removed from queue by ' + getUserMention(msg.from),
        msg.chat.id,
        prData.userid);

    const next = yield client.zrangebyscoreAsync([user + '/' + repo + '/queue', '-inf', '+inf', 'LIMIT', '0', '1']);
    const next_pr = yield client.hgetallAsync(user + '/' + repo + '/' + next);

    if (next_pr)
        yield sendMessageToAllRepoChats(
            user,
            repo,
            'PR [#' + next_pr.id + '](' + next_pr.url + ') by ' + getUserMention(next_pr) + ' is next in queue!',
            msg.chat.id,
            next_pr.userid);
    else
        yield sendMessageToAllRepoChats(
            user,
            repo,
            'Queue is empty!',
            msg.chat.id);
}

function* reportQueueToChat(repo, chatId) {
    const queue = yield client.zrangebyscoreAsync(repo + '/queue', '-inf', '+inf');
    if (!queue || queue.length == 0)
    {
        yield bot.sendMessage(chatId, 'Queue for ' + repo + ' is empty', { parse_mode: 'Markdown' });
        return;
    }

    let prGetters = [];
    queue.forEach(prId => {
        prGetters.push(client.hgetallAsync(repo + '/' + prId));
    });
    const prs = yield prGetters;
    let message = 'Queue for ' + repo + '\n';
    prs.forEach(pr => message += '- [#' + pr.id + '](' + pr.url + ') by ' + getUserMention(pr) + '\n');

    yield bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function* onQueueRequestHandler(msg, args) {
    let repositoriesToReport = yield client.smembersAsync('repo_chats:' + msg.chat.id.toString());
    let reports = [];
    repositoriesToReport.forEach(repo => {
        reports.push(co(reportQueueToChat(repo, msg.chat.id)));
    })

    yield reports;
}

function* onAddTokenHandler(msg, args) {
    const name = args[1];
    const token = args[2];
    yield client.hsetAsync('tokens', name, token);
    yield bot.sendMessage(
        msg.chat.id,
        'Token <' + name + '> saved successfully.');
}

function* onRemoveTokenHandler(msg, args) {
    const name = args[1];
    yield client.hdelAsync('tokens', name);
    yield bot.sendMessage(
        msg.chat.id,
        'Token <' + name + '> deleted successfully.');
}

function* onMapTokenHandler(msg, args) {
    const user = args[1];
    const token = args[2];
    yield client.hsetAsync('user_to_token_map', user, token);
    yield bot.sendMessage(
        msg.chat.id,
        'Token <' + token + '> will be used as an access to <' + user + '>');
}

function* onBindRepoToChat(msg, args) {
    const user = args[1];
    const repo = args[2];

    yield [
        client.saddAsync('repo_chats:' + msg.chat.id.toString(), user + '/' + repo),
        client.saddAsync('repo_chats:' + user + '/' + repo, msg.chat.id)
    ];

    yield bot.sendMessage(
        msg.chat.id,
        'This chat has been mapped to merge queue of ' + user + '/' + repo);
}

function* onUnbindRepoToChat(msg, args) {
    const user = args[1];
    const repo = args[2];

    yield [
        client.sremAsync('repo_chats:' + msg.chat.id.toString(), user + '/' + repo),
        client.sremAsync('repo_chats:' + user + '/' + repo, msg.chat.id)
    ];

    yield bot.sendMessage(
        msg.chat.id,
        'This chat has been unmapped from merge queue of ' + user + '/' + repo);
}

function* generalErrorHandler(reason, currentChatId) {
    if (reason.messageFromBot) {
        console.log(reason.messageFromBot);
        yield bot.sendMessage(
            currentChatId,
            reason.messageFromBot);
    }

    console.error(reason);
}

function* handle(handler, msg, args, options) {
    options = options || {};
    if (options.adminOnly && !hasAdminAccess(msg))
        return;

    if (options.privateOnly && msg.chat.type != 'private')
    {
        yield bot.sendMessage(
            msg.chat.id,
            'This operation supported only in private chat',
            { reply_to_message_id: msg.id });
        return;
    }

    try {
        yield handler(msg, args);
    }
    catch(e) {
        yield generalErrorHandler(e, msg.chat.id);
    }
}

function* onSigTerm() {
    if (telegramConfig.sendFarewells)
        yield sendToMultipleChats(bot, "Bot exited.", acl.su);
    process.exit(0);
}

function* onStartup() {
    if (telegramConfig.sendGreetings)
        yield sendToMultipleChats(bot, "Bot started.", acl.su);
}

const githubPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';
bot.onText(new RegExp('/add ' + githubPattern), (msg, args) => co(handle(onAddPullRequest, msg, args)));

bot.onText(new RegExp('/remove ' + githubPattern), (msg, args) => co(handle(onRemovePullRequest, msg, args)));

bot.onText(/\/queue/, (msg, args) => co(handle(onQueueRequestHandler, msg, args)));

bot.onText(/\/add_token (\S+) (\S+)/, (msg, args) => co(handle(onAddTokenHandler, msg, args, {
        adminOnly: true,
        privateOnly: true
    })));

bot.onText(/\/remove_token (\S+)/, (msg, args) => co(handle(onRemoveTokenHandler, msg, args, {
        adminOnly: true,
        privateOnly: true
    })));

bot.onText(/\/map_token (\S+) (\S+)/, (msg, args) => co(handle(onMapTokenHandler, msg, args, {
        adminOnly: true,
        privateOnly: true
    })));

bot.onText(/\/bind (\S+) (\S+)/, (msg, args) => co(handle(onBindRepoToChat, msg, args, {
        adminOnly: true
    })));

bot.onText(/\/unbind (\S+) (\S+)/, (msg, args) => co(handle(onUnbindRepoToChat, msg, args, {
        adminOnly: true
    })));

bot.onText(/\/ping/, () => bot.sendMessage(msg.chat.id, 'pong'));

process.on('SIGTERM', () => co(onSigTerm));

co(onStartup);
// let dispatcher = require('./httpdispatcher');

// dispatcher.onPost();

// let server = http.createServer(function (req, res) {
//     dispatcher.dispatch(req, res);
// });
// server.listen(process.env.PORT);