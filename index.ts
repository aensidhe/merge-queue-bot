import * as config from 'config';
import { Bot } from './Bot';
import { Dal } from './Redis/Dal'
import { Config as RedisConfig } from './Redis/Config'
import { Acl } from './Acl'
import { GitHubClient } from './GitHubClient'
import { TelegramConfig } from "./TelegramConfig";
import { HookHandler, IHookHandlerConfig } from "./HookHandler";

const github = new GitHubClient();
const dal = new Dal(config.get<RedisConfig>('redis'));
const bot = new Bot(
    github,
    config.get<Acl>('acl'),
    dal,
    config.get<TelegramConfig>('telegram'));

const handler = new HookHandler(config.get<IHookHandlerConfig>('webhook'), bot, dal);

async function onSigTerm(reason: string, e?: any) : Promise<void> {
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