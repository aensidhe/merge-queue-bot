import * as config from 'config';
import { Bot } from './Bot';
import { Dal } from './Redis/Dal'
import { Config as RedisConfig } from './Redis/Config'
import { Acl } from './Acl'

const github = new GitHubClient();
const bot = new Bot(
    github,
    config.get<Acl>('acl'),
    new Dal(config.get<RedisConfig>('redis')),
    config.get<TelegramConfig>('telegram'));

async function onSigTerm(reason: string, e?: any) {
    await bot.sendFarewell(e ? `${reason}: ${e}` : reason);
    process.exit(0);
}

async function onStartup() {
    await bot.sendGreetings();
}

process.on('SIGTERM', () => onSigTerm('SIGTERM'));
process.on('SIGINT', () => onSigTerm('SIGINT'));
process.on('exit', () => onSigTerm('exit'));
process.on('uncaughtException', e => onSigTerm('uncaughtException', e));

onStartup();