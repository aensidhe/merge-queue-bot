'use strict'

let config = require('config');
let redisConfig = config.get('redis');
let redis = require('redis');
let P = require('bluebird')
P.promisifyAll(redis.RedisClient.prototype);
let client = redis.createClient(redisConfig);

let TelegramBot = require('node-telegram-bot-api');
let bot = new TelegramBot(config.get('telegram').token, {polling: true});
let github = require('./github.js');
let co = require('co');

function checkIfChatPrivate(msg) {
    if (msg.chat.type != 'private') {
        throw { messageFromBot: 'All token operation supported only in private chats' };
    }
}

function hasAdminAccess(msg) {
    let acl = config.get('acl');
    for (let i = 0; i < acl.su.length; i++) {
        if (acl.su[i] == msg.from.id)
            return true;
    }

    return false;
}

function* sendToMultipleChats(bot, message, chatIds) {
    let outbox = [];
    chatIds.forEach(function (chatId) {
        outbox.push(bot.sendMessage(
            chatId,
            message,
            { parse_mode: 'Markdown' }));
    });
    yield outbox;
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

function* onAddPullRequest(msg, args) {
    const user = args[1];
    const repo = args[2];
    const id = args[3];

    const tokenName = yield client.hgetAsync('user_to_token_map', user);
    if (!tokenName)
        throw { messageFromBot: 'Token for your repo is not found.' };

    const token = yield client.hgetAsync('tokens', tokenName);
    const pr = yield github.getPrState(user, repo, id, token);
    yield [
        client.hmsetAsync(user + '/' + repo + '/' + id, {
            userid: msg.from.id,
            username: msg.from.username,
            url: pr.html_url,
            id: id
        }),
        client.zaddAsync(user + '/' + repo + '/queue', new Date().getTime(), id)
    ];

    let chats = new Set(members);
    chats.add(msg.chat.id.toString());
    yield sendToMultipleChats(
        bot,
        'PR [#' + id + '](' + pr.html_url + ') is added to queue by @' + msg.from.username,
        chats
    );
}

function* handle(handler, msg, args) {
    try {
        yield handler(msg, args);
    }
    catch(e) {
        yield generalErrorHandler(e, msg.chat.id)
    }
}

const githubPattern = 'https://github.com/(\\S+)/(\\S+)/pull/(\\d+)';
bot.onText(new RegExp('/add ' + githubPattern), function (msg, args) {
    return co(handle(onAddPullRequest, msg, args));
});

bot.onText(new RegExp('/remove ' + githubPattern), function (msg, args) {
    let user = args[1];
    let repo = args[2];
    let id = args[3];
    let prData = {};
    let prChatIds = [];

    client
        .hgetallAsync(user + '/' + repo + '/' + id)
        .then(function(result) {
            if (!result) {
                throw { messageFromBot: 'PR not found' };
            }
            prData = result;

            return client.delAsync(user + '/' + repo + '/' + id);
        })
        .then(function() { return client.zremAsync(user + '/' + repo + '/queue', id); })
        .then(function() { return client.smembersAsync('repo_chats:' + user + '/' + repo); })
        .then(function(members) {
            prChatIds = members;
            let deletedChats = new Set(members);
            deletedChats.add(msg.chat.id.toString());
            deletedChats.add(prData.userid);
            return sendToMultipleChats(
                bot,
                'PR [#' + id + '](' + prData.url + ') is removed from queue by @' + msg.from.username,
                deletedChats
            );
        })
        .then(function() { return client.zrangebyscoreAsync([user + '/' + repo + '/queue', '-inf', '+inf', 'LIMIT', '0', '1']); })
        .then(function(next) { return client.hgetallAsync(user + '/' + repo + '/' + next); })
        .then(function(next_pr) {
            let nextChats = new Set(prChatIds);

            let nextMessage = 'Queue is empty!';
            if (next_pr) {
                nextMessage = 'PR [#' + next_pr.id + '](' + next_pr.url + ') by @' + next_pr.username + ' is next in queue!'
                nextChats.add(next_pr.userid);
            }

            return sendToMultipleChats(
                bot,
                nextMessage,
                nextChats
            );
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/queue/, function (msg, args) {
    let repositoriesToReport = [];
    client
        .smembersAsync('repo_chats:' + msg.chat.id.toString())
        .then(function(repos) {
            repositoriesToReport = repos;
            let queues = [];
            for (let i = 0; i < repos.length; i++)
            {
                queues.push(client.zrangebyscoreAsync(repos[i] + '/queue', '-inf', '+inf'));
            }
            return Promise.all(queues);
        })
        .then(function(queues) {
            let outbox = [];
            for (let i = 0; i < repositoriesToReport.length; i++)
            {
                let repo = repositoriesToReport[i];

                let message = 'Queue for ' + repo + ' is empty';
                if (queues[i].length > 0) {
                    message = 'Queue for ' + repo + '\n';
                    for (let j = 0; j < queues[i].length; j++) {
                        message += '- #' + queues[i][j] + '\n';
                    }
                }

                outbox.push(bot.sendMessage(
                    msg.chat.id,
                    message,
                    { parse_mode: 'Markdown' }));
            }
            return Promise.all(outbox);
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/add_token (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    let name = args[1];
    let token = args[2];
    checkIfChatPrivate(msg)
        .then(function() { return client.hsetAsync('tokens', name, token); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            'Token <' + name + '> saved successfully.');
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/remove_token (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    let name = args[1];
    checkIfChatPrivate(msg)
        .then(function() { return client.hdelAsync('tokens', name); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            'Token <' + name + '> deleted successfully.');
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/map_token (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    let user = args[1];
    let token = args[2]
    checkIfChatPrivate(msg)
        .then(function() { return client.hsetAsync('user_to_token_map', user, token); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            'Token <' + token + '> will be used as an access to <' + user + '>');
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/bind (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    let user = args[1];
    let repo = args[2];
    client
        .saddAsync('repo_chats:' + msg.chat.id.toString(), user + '/' + repo)
        .then(function() { return client.saddAsync('repo_chats:' + user + '/' + repo, msg.chat.id); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            'This chat has been mapped to merge queue of ' + user + '/' + repo)
        })
        .catch(console.error);
});

bot.onText(/\/unbind (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    let user = args[1];
    let repo = args[2];
    client
        .sremAsync('repo_chats:' + msg.chat.id.toString(), user + '/' + repo)
        .then(function () { return client.sremAsync('repo_chats:' + user + '/' + repo, msg.chat.id); })
        .then(function () { return bot.sendMessage(
            msg.chat.id,
            'This chat has been unmapped from merge queue of ' + user + '/' + repo)
        })
        .catch(console.error);
});

// let dispatcher = require('./httpdispatcher');

// dispatcher.onPost();

// let server = http.createServer(function (req, res) {
//     dispatcher.dispatch(req, res);
// });
// server.listen(process.env.PORT);