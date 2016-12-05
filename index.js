const config = require('config');
const GitHubClient = require('./GitHubClient.js');
const Bot = require('./Bot.js');
const co = require('co');
const RedisDal = require('./RedisDal.js');

const github = new GitHubClient();
const bot = new Bot(
    github,
    config.get('acl'),
    new RedisDal(config.get('redis')),
    config.get('telegram'));

function* onSigTerm(reason) {
    yield bot.sendFarewell(reason);
    process.exit(0);
}

function* onStartup() {
    yield bot.sendGreetings();
}

process.on('SIGTERM', () => co(onSigTerm('SIGTERM')));
process.on('SIGINT', () => co(onSigTerm('SIGINT')));
process.on('exit', () => co(onSigTerm('exit')));
process.on('uncaughtException', () => co(onSigTerm('uncaughtException')));

co(onStartup);

var express = require('express')
var app = express()

app.get('/', function (req, res) {
    res.send('Hello World!')
})

app.listen(config.webhook.port, function () {
    console.log(`Example app listening on port ${config.webhook.port}!`)
})