"use strict"

var config = require('config');
var redisConfig = config.get('redis');
var redis = require("redis");
var P = require("bluebird")
P.promisifyAll(redis.RedisClient.prototype);
var client = redis.createClient(redisConfig);

var TelegramBot = require('node-telegram-bot-api');
var bot = new TelegramBot(config.get('telegram').token, {polling: true});
var github = require("./github.js")

function checkIfChatPrivate(msg) {
    if (msg.chat.type != "private") {
        return Promise.reject({ messageFromBot: "All token operation supported only in private chats" });
    }

    return Promise.resolve();
}

function hasAdminAccess(msg) {
    var acl = config.get('acl');
    for (var i = 0; i < acl.su.length; i++) {
        if (acl.su[i] == msg.from.id)
            return true;
    }

    return false;
}

function sendToMultipleChats(bot, message, chatIds) {
    var outbox = [];
    chatIds.forEach(function (chatId) {
        outbox.push(bot.sendMessage(
            chatId,
            message,
            { parse_mode: "Markdown" }));
    });
    return Promise.all(outbox);
}

function generalErrorHandler(reason, currentChatId) {
    if (reason.messageFromBot) {
        console.log(reason.messageFromBot);
        return bot.sendMessage(
            currentChatId,
            reason.messageFromBot);
    }

    console.error(reason);
    return Promise.resolve();
}

var githubPattern = "https://github.com/(\\S+)/(\\S+)/pull/(\\d+)";
bot.onText(new RegExp("/add " + githubPattern), function (msg, args) {
    var user = args[1];
    var repo = args[2];
    var id = args[3];
    var prUrl = '';

    client
        .hgetAsync("user_to_token_map", user)
        .then(function(tokenName) {
            if (!tokenName) {
                throw { messageFromBot: "Token for your repo is not found." }
            }

            return client.hgetAsync("tokens", tokenName);
        })
        .then(function(token) { return github.getPrState(user, repo, id, token) })
        .then(function(pr) {
            prUrl = pr.html_url;
            return client.hmsetAsync(user + "/" + repo + "/" + id, {
                userid: msg.from.id,
                username: msg.from.username,
                url: pr.html_url,
                id: id
            });
        })
        .then(function() { return client.zaddAsync(user + "/" + repo + "/queue", new Date().getTime(), id) })
        .then(function() { return client.smembersAsync("repo_chats:" + user + "/" + repo); })
        .then(function(members) {
            var chats = new Set(members);
            chats.add(msg.chat.id.toString());
            return sendToMultipleChats(
                bot,
                "PR [#" + id + "](" + prUrl + ") is added to queue by @" + msg.from.username,
                chats
            );
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(new RegExp("/remove " + githubPattern), function (msg, args) {
    var user = args[1];
    var repo = args[2];
    var id = args[3];
    var prData = {};
    var prChatIds = [];

    client
        .hgetallAsync(user + "/" + repo + "/" + id)
        .then(function(result) {
            if (!result) {
                throw { messageFromBot: "PR not found" };
            }
            prData = result;

            return client.delAsync(user + "/" + repo + "/" + id);
        })
        .then(function() { return client.zremAsync(user + "/" + repo + "/queue", id); })
        .then(function() { return client.smembersAsync("repo_chats:" + user + "/" + repo); })
        .then(function(members) {
            prChatIds = members;
            var deletedChats = new Set(members);
            deletedChats.add(msg.chat.id.toString());
            deletedChats.add(prData.userid);
            return sendToMultipleChats(
                bot,
                "PR [#" + id + "](" + prData.url + ") is removed from queue by @" + msg.from.username,
                deletedChats
            );
        })
        .then(function() { return client.zrangebyscoreAsync([user + "/" + repo + "/queue", "-inf", "+inf", "LIMIT", "0", "1"]); })
        .then(function(next) { return client.hgetallAsync(user + "/" + repo + "/" + next); })
        .then(function(next_pr) {
            var nextChats = new Set(prChatIds);

            var nextMessage = "Queue is empty!";
            if (next_pr) {
                nextMessage = "PR [#" + next_pr.id + "](" + next_pr.url + ") by @" + next_pr.username + " is next in queue!"
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
    var repositoriesToReport = [];
    client
        .smembersAsync("repo_chats:" + msg.chat.id.toString())
        .then(function(repos) {
            repositoriesToReport = repos;
            var queues = [];
            for (var i = 0; i < repos.length; i++)
            {
                queues.push(client.zrangebyscoreAsync(repos[i] + "/queue", "-inf", "+inf"));
            }
            return Promise.all(queues);
        })
        .then(function(queues) {
            var outbox = [];
            for (var i = 0; i < repositoriesToReport.length; i++)
            {
                var repo = repositoriesToReport[i];

                var message = "Queue for " + repo + " is empty";
                if (queues[i].length > 0) {
                    message = "Queue for " + repo + "\n";
                    for (var j = 0; j < queues[i].length; j++) {
                        message += "- #" + queues[i][j] + "\n";
                    }
                }

                outbox.push(bot.sendMessage(
                    msg.chat.id,
                    message,
                    { parse_mode: "Markdown" }));
            }
            return Promise.all(outbox);
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/add_token (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    var name = args[1];
    var token = args[2];
    checkIfChatPrivate(msg)
        .then(function() { return client.hsetAsync("tokens", name, token); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            "Token <" + name + "> saved successfully.");
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/remove_token (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    var name = args[1];
    checkIfChatPrivate(msg)
        .then(function() { return client.hdelAsync("tokens", name); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            "Token <" + name + "> deleted successfully.");
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/map_token (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    var user = args[1];
    var token = args[2]
    checkIfChatPrivate(msg)
        .then(function() { return client.hsetAsync("user_to_token_map", user, token); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            "Token <" + token + "> will be used as an access to <" + user + ">");
        })
        .catch(function(reason) { return generalErrorHandler(reason, msg.chat.id); });
});

bot.onText(/\/bind (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    var user = args[1];
    var repo = args[2];
    client
        .saddAsync("repo_chats:" + msg.chat.id.toString(), user + "/" + repo)
        .then(function() { return client.saddAsync("repo_chats:" + user + "/" + repo, msg.chat.id); })
        .then(function() { return bot.sendMessage(
            msg.chat.id,
            "This chat has been mapped to merge queue of " + user + "/" + repo)
        })
        .catch(console.error);
});

bot.onText(/\/unbind (\S+) (\S+)/, function(msg, args) {
    if (!hasAdminAccess(msg))
        return;

    var user = args[1];
    var repo = args[2];
    client
        .sremAsync("repo_chats:" + msg.chat.id.toString(), user + "/" + repo)
        .then(function () { return client.sremAsync("repo_chats:" + user + "/" + repo, msg.chat.id); })
        .then(function () { return bot.sendMessage(
            msg.chat.id,
            "This chat has been unmapped from merge queue of " + user + "/" + repo)
        })
        .catch(console.error);
});

// var dispatcher = require('./httpdispatcher');

// dispatcher.onPost();

// var server = http.createServer(function (req, res) {
//     dispatcher.dispatch(req, res);
// });
// server.listen(process.env.PORT);