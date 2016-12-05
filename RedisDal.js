const redis = require('redis');
const P = require('bluebird')

P.promisifyAll(redis.RedisClient.prototype);

class RedisDal {
    constructor(redisConfig) {
        this._client = redis.createClient(redisConfig);
    }

    * getAllChatsForRepo(repository) {
        yield this._client.smembersAsync(`repo_chats:${repository.user}/${repository.name}`);
    }

    * getGithubToken(repository) {
        const tokenName = yield this._client.hgetAsync('user_to_token_map', repository.user);
        if (!tokenName)
            throw { messageFromBot: 'Token for your repo is not found.' };

        return yield this._client.hgetAsync('tokens', tokenName);
    }

    * savePullRequest(pullRequest) {

    }
}

module.exports = RedisDal