import { AsyncClient } from './AsyncClient'
class RedisDal {
    private readonly _client : AsyncClient;
    constructor(redisConfig) {
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

    async getRepositoryQueue(repository: Repository) {
        return await this._client.zrangebyscore(this._getQueueKey(repository));
    }

    async addPullRequestToQueue(pullRequest: PullRequest) {
        await this._client.zadd(
            this._getQueueKey(pullRequest.repository),
            pullRequest.id.toString(),
            pullRequest.reportedTime.getTime());
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
        await [
            this._client.sadd(`repo_chats:${chatId}`, `${repository}`),
            this._client.sadd(`repo_chats:${repository}`, chatId.toString())
        ];
    }

    async removeChatBinding(chatId: number, repository: Repository) {
        await [
            this._client.srem(`repo_chats:${chatId}`, `${repository}`),
            this._client.srem(`repo_chats:${repository}`, chatId.toString())
        ];
    }

    async getBindedRepositories(chatId: number) {
        const repos = await this._client.smembers(`repo_chats:${chatId}`);
        let result = new Array<Repository>();
        for (let x in repos) {
            let repo = Repository.parse(x);
            if (repo != null) {
                result.push(repo);
            }
        }
        return result;
    }

    async getBindedChats(repository: Repository) : Promise<number[]> {
        return await this._client.smembers<number>(`repo_chats:${repository}`);
    }
}