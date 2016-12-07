const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');

const co = require('co');

class HookHandler {
    constructor(config, bot) {
        const app = express();
        app.use(compression());
        app.use(bodyParser.json())

        app.get('/', (req, res) => res.send('Hello World!'));

        app.post('/pull-request', (req, res) => this._handle(this.onPullRequestChange.bind(this), req, res));
        app.post('/status', (req, res) => this._handle(this.onRepoStatusChange.bind(this), req, res));

        app.listen(config.port, () => console.log(`Example app listening on port ${config.port}!`));

        this._bot = bot;
    }

    _handle(handler, req, res) {
        try {
            return co(handler, req, res)
                .catch(e => this._bot.handleError(e));
        }
        catch(e) {
            return this.handleError(e);
        }
    }

    * onPullRequestChange(req, res) {
    }
}