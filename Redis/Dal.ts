import { AsyncClient } from './AsyncClient'
import { Config } from './Config'
import {Repository} from "../Repository";
import {PullRequest} from "../PullRequest";
import {Token} from "../Token";
import {Limits} from "./Limits";

export class Dal {
    private readonly _client : AsyncClient;

    constructor(redisConfig: Config) {
        this._client = new AsyncClient(redisConfig);
    }

    async getGithubToken(repository: Repository) {
        const tokenName = await this._client.hget('user_to_token_map', repository.owner);
        if (!tokenName)
            throw { messageFromBot: 'Token for your repo is not found.' };

        return await this._client.hget('tokens', tokenName);
    }

    private _getQueueKey(repository: Repository) {
        return `${repository}/queue`;
    }

    async getRepositoryQueue(repository: Repository) : Promise<PullRequest[]> {
        let ids = await this._client.zrangebyscore<number>(this._getQueueKey(repository));
        let promises = new Array<Promise<PullRequest|null>>();
        for (let id of ids) {
            promises.push(this.getPullRequest(repository, id));
        }

        let prs = await Promise.all(promises);
        let result = new Array<PullRequest>();
        for (let pr of prs) {
            if (pr != null) {
                result.push(pr);
            }
        }

        return result;
    }

    async addPullRequestToQueue(pullRequest: PullRequest) {
        await this._client.zadd(
            this._getQueueKey(pullRequest.repository),
            pullRequest.id.toString(),
            pullRequest.reportedTime.getTime());
    }

    async addHotfixToQueue(pullRequest: PullRequest) : Promise<PullRequest|null> {
        await this._client.zadd(
            this._getQueueKey(pullRequest.repository),
            pullRequest.id.toString(),
            -pullRequest.reportedTime.getTime());
        let ids = await this._client.zrangebyscore<number>(this._getQueueKey(pullRequest.repository));
        let next = false;
        for (let id of ids) {
            if (id == pullRequest.id) {
                next = true;
                continue;
            }

            if (next) {
                return await this.getPullRequest(pullRequest.repository, id);
            }
        }

        return null;
    }

    async removePullRequestFromQueue(pullRequest: PullRequest) {
        await this._client.zrem(
            this._getQueueKey(pullRequest.repository),
            pullRequest.id.toString());
    }

    async getNextPullRequestFromQueue(repository: Repository) {
        const nextId = await this._client.zrangebyscore<number>(this._getQueueKey(repository), undefined, undefined, Limits.TopOne);
        if (!nextId || nextId.length == 0) {
            return null;
        }
        return await this.getPullRequest(repository, nextId[0]);
    }

    _getPullRequestKey(repository: Repository, id: number) {
        return `${repository}/${id}`;
    }

    async savePullRequest(pullRequest: PullRequest) {
        await this._client.hmset(
            this._getPullRequestKey(pullRequest.repository, pullRequest.id),
            pullRequest.toHash());
    }

    async getPullRequest(repository: Repository, id: number) {
        const hash = await this._client.hgetall(this._getPullRequestKey(repository, id));
        return PullRequest.fromHash(hash);
    }

    async deletePullRequest(pullRequest: PullRequest) {
        await this._client.del(this._getPullRequestKey(pullRequest.repository, pullRequest.id));
    }

    async saveToken(token: Token) {
        await this._client.hset('tokens', token.name, token.token);
    }

    async deleteToken(name: string) {
        await this._client.hdel('tokens', name);
    }

    async getToken(name: string) {
        return new Token(name, await this._client.hget('tokens', name));
    }

    async saveTokenMapping(name: string, owner: string) {
        await this._client.hset('user_to_token_map', owner, name);
    }

    async saveChatBinding(chatId: number, repository: Repository) {
        await Promise.all([
            this._client.sadd(`repo_chats:${chatId}`, `${repository}`),
            this._client.sadd(`repo_chats:${repository}`, chatId.toString()),
            this._client.sadd(`chats:binded`, chatId.toString())
        ]);
    }

    async removeChatBinding(chatId: number, repository: Repository) {
        await Promise.all([
            this._client.srem(`repo_chats:${chatId}`, `${repository}`),
            this._client.srem(`repo_chats:${repository}`, chatId.toString()),
            this._client.srem("chats:binded", chatId.toString())
        ]);
    }

    async getBindedRepositories(chatId: number) {
        const repos = await this._client.smembers<string>(`repo_chats:${chatId}`);
        let result = new Array<Repository>();
        for (let x of repos) {
            let repo = Repository.parse(x);
            if (repo != null) {
                result.push(repo);
            }
        }
        return result;
    }

    async getBindedChats(repository: Repository) {
        return await this._client.smembers<string>(`repo_chats:${repository}`);
    }

    async getAllBindedChats() {
        return await this._client.smembers<string>("chats:binded");
    }
}