const config = require('config');
const co = require('co');

const github = new GitHubClient();
const bot = new Bot(
    github,
    config.get('acl'),
    new RedisDal(config.get('redis')),
    config.get('telegram'));

function* onSigTerm(reason, e) {
    yield bot.sendFarewell(e ? `${reason}: ${e}` : reason);
    process.exit(0);
}

function* onStartup() {
    yield bot.sendGreetings();
}

process.on('SIGTERM', () => co(onSigTerm, 'SIGTERM'));
process.on('SIGINT', () => co(onSigTerm, 'SIGINT'));
process.on('exit', () => co(onSigTerm, 'exit'));
process.on('uncaughtException', e => co(onSigTerm, 'uncaughtException', e));

co(onStartup);

