const Repository = require('./Repository.js');
const TelegramUser = require('./TelegramUser.js');
const PullRequest = require('./PullRequest.js');

const redis = require('redis');
const P = require('bluebird');

P.promisifyAll(redis.RedisClient.prototype);

class RedisDal {
    constructor(redisConfig) {
        this._client = redis.createClient(redisConfig);
    }

    * getAllChatsForRepo(repository) {
        yield this._client.smembersAsync(`repo_chats:${repository.owner}/${repository.name}`);
    }

    * getGithubToken(repository) {
        const tokenName = yield this._client.hgetAsync('user_to_token_map', repository.owner);
        if (!tokenName)
            throw { messageFromBot: 'Token for your repo is not found.' };

        return yield this._client.hgetAsync('tokens', tokenName);
    }

    _getQueueKey(repository) {
        return `${repository.owner}/${repository.name}/queue`;
    }

    * getRepositoryQueue(repository) {
        yield this._client.zrangebyscoreAsync(_getQueueKey(repository), '-inf', '+inf');
    }

    * addPullRequestToQueue(pullRequest) {
        yield this._client.zaddAsync(
            _getQueueKey(pullRequest.repository),
            pullRequest.id,
            pullRequest.reportedTime);
    }

    * removePullRequestFromQueue(pullRequest) {
        yield this._client.zremAsync(
            _getQueueKey(pullRequest.repository),
            pullRequest.id);
    }

    * getNextPullRequestFromQueue(repository) {
        const nextId = yield this._client.zrangebyscoreAsync([_getQueueKey(repository), '-inf', '+inf', 'LIMIT', '0', '1']);
        if (!nextId) {
            return null;
        }
        return this.getPullRequest(repository, nextId);
    }

    _getPullRequestKey(repository, id) {
        return `${repository.owner}/${repository.name}/${id}`;
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

    * deletePullRequest(repository, id) {
        yield this._client.delAsync(this._getPullRequestKey(repository, id));
    }
}

module.exports = RedisDal