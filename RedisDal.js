const Repository = require('./Repository.js');
const TelegramUser = require('./TelegramUser.js');
const PullRequest = require('./PullRequest.js');
const Token = require('./Token.js');

const redis = require('redis');
const P = require('bluebird');

P.promisifyAll(redis.RedisClient.prototype);

class RedisDal {
    constructor(redisConfig) {
        this._client = redis.createClient(redisConfig);
    }

    * getGithubToken(repository) {
        const tokenName = yield this._client.hgetAsync('user_to_token_map', repository.owner);
        if (!tokenName)
            throw { messageFromBot: 'Token for your repo is not found.' };

        return yield this._client.hgetAsync('tokens', tokenName);
    }

    _getQueueKey(repository) {
        return `${repository}/queue`;
    }

    * getRepositoryQueue(repository) {
        return yield this._client.zrangebyscoreAsync(this._getQueueKey(repository), '-inf', '+inf');
    }

    * addPullRequestToQueue(pullRequest) {
        yield this._client.zaddAsync(
            this._getQueueKey(pullRequest.repository),
            pullRequest.reportedTime,
            pullRequest.id);
    }

    * removePullRequestFromQueue(pullRequest) {
        yield this._client.zremAsync(
            this._getQueueKey(pullRequest.repository),
            pullRequest.id);
    }

    * getNextPullRequestFromQueue(repository) {
        const nextId = yield this._client.zrangebyscoreAsync([this._getQueueKey(repository), '-inf', '+inf', 'LIMIT', '0', '1']);
        if (!nextId) {
            return null;
        }
        return yield this.getPullRequest(repository, nextId);
    }

    _getPullRequestKey(repository, id) {
        return `${repository}/${id}`;
    }

    * savePullRequest(pullRequest) {
        yield this._client.hmsetAsync(
            this._getPullRequestKey(pullRequest.repository, pullRequest.id),
            pullRequest.toHash());
    }

    * getPullRequest(repository, id) {
        const hash = yield this._client.hgetallAsync(this._getPullRequestKey(repository, id));
        return PullRequest.fromHash(hash);
    }

    * deletePullRequest(pullRequest) {
        yield this._client.delAsync(this._getPullRequestKey(pullRequest.repository, pullRequest.id));
    }

    * saveToken(token) {
        yield this._client.hsetAsync('tokens', token.name, token.token);
    }

    * deleteToken(name) {
        yield this._client.hdelAsync('tokens', name);
    }

    * getToken(name) {
        return new Token(name, yield this._client.hgetAsync('tokens', name));
    }

    * saveTokenMapping(name, owner) {
        yield this._client.hsetAsync('user_to_token_map', owner, name);
    }

    * saveChatBinding(chatId, repository) {
        yield [
            this._client.saddAsync(`repo_chats:${chatId}`, `${repository}`),
            this._client.saddAsync(`repo_chats:${repository}`, chatId)
        ];
    }

    * removeChatBinding(chatId, repository) {
        yield [
            this._client.sremAsync(`repo_chats:${chatId}`, `${repository}`),
            this._client.sremAsync(`repo_chats:${repository}`, chatId)
        ];
    }

    * getBindedRepositories(chatId) {
        const repos = yield this._client.smembersAsync(`repo_chats:${chatId}`);
        let result = [];
        repos.forEach(x => result.push(Repository.parse(x)));
        return result;
    }

    * getBindedChats(repository) {
        yield this._client.smembersAsync(`repo_chats:${repository}`);
    }
}

module.exports = RedisDal