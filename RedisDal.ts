import * as redis from 'redis';
import * as P from 'bluebird';

const redisAsync: any = P.promisifyAll(redis);

class RedisDal {
    private readonly _client : redis.RedisClient;
    constructor(redisConfig) {
        this._client = redis.createClient(redisConfig);
    }

    getGithubToken(repository) {
        const tokenName = this._client.hget('user_to_token_map', repository.owner);
        if (!tokenName)
            throw { messageFromBot: 'Token for your repo is not found.' };

        return this._client.hget('tokens', tokenName);
    }

    _getQueueKey(repository) {
        return `${repository}/queue`;
    }

    getRepositoryQueue(repository) {
        return this._client.zrangebyscore(this._getQueueKey(repository), '-inf', '+inf');
    }

    addPullRequestToQueue(pullRequest) {
        this._client.zadd(
            this._getQueueKey(pullRequest.repository),
            pullRequest.reportedTime,
            pullRequest.id);
    }

    removePullRequestFromQueue(pullRequest) {
        this._client.zrem(
            this._getQueueKey(pullRequest.repository),
            pullRequest.id);
    }

    getNextPullRequestFromQueue(repository) {
        const nextId = this._client.zrangebyscore([this._getQueueKey(repository), '-inf', '+inf', 'LIMIT', '0', '1']);
        if (!nextId) {
            return null;
        }
        return this.getPullRequest(repository, nextId);
    }

    _getPullRequestKey(repository, id) {
        return `${repository}/${id}`;
    }

    savePullRequest(pullRequest) {
        this._client.hmset(
            this._getPullRequestKey(pullRequest.repository, pullRequest.id),
            pullRequest.toHash());
    }

    getPullRequest(repository, id) {
        const hash = this._client.hgetall(this._getPullRequestKey(repository, id));
        return PullRequest.fromHash(hash);
    }

    deletePullRequest(pullRequest) {
        this._client.del(this._getPullRequestKey(pullRequest.repository, pullRequest.id));
    }

    saveToken(token) {
        this._client.hset('tokens', token.name, token.token);
    }

    deleteToken(name) {
        this._client.hdel('tokens', name);
    }

    getToken(name) {
        return new Token(name, this._client.hget('tokens', name));
    }

    saveTokenMapping(name, owner) {
        this._client.hset('user_to_token_map', owner, name);
    }

    saveChatBinding(chatId, repository) {
        [
            this._client.sadd(`repo_chats:${chatId}`, `${repository}`),
            this._client.sadd(`repo_chats:${repository}`, chatId)
        ];
    }

    removeChatBinding(chatId, repository) {
        [
            this._client.srem(`repo_chats:${chatId}`, `${repository}`),
            this._client.srem(`repo_chats:${repository}`, chatId)
        ];
    }

    getBindedRepositories(chatId) {
        const repos = this._client.smembers(`repo_chats:${chatId}`);
        let result = new Array<Repository>();
        repos.forEach(x => result.push(Repository.parse(x)));
        return result;
    }

    getBindedChats(repository) {
        this._client.smembers(`repo_chats:${repository}`);
    }
}