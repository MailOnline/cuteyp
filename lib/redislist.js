'use strict';

const Redis = require('ioredis');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const { flattenStack } = require('./utils');

module.exports = RedisList;

function RedisList(options = {}) {
    util.inherits(Subscriber, EventEmitter);

    ['host', 'port', 'retryStrategy'].forEach(prop => {
        if (!options[prop]) throw new Error(`"${prop}" option not provided`);
    });

    const commandClient = createRedisClient('cc.cuteyp.redislist');

    return {
        subscriber(path) {
            return new Subscriber(path);
        },
        send(headers, body, callback) {
            const path = typeof headers === 'string' ? headers : headers.destination;
            if (!path) return console.error('No path provided for sending to Redis');

            commandClient.lpush(path, body, callback);
        }
    };

    function createRedisClient(namespace) {
        const client = new Redis(options);

        client.on('connect', () => {
            console.log(`METRIC ns="${ namespace } connected=true`);
        });

        client.on('error', err => {
            console.error(`METRIC ns="${ namespace + '.error' }" err="${ flattenStack(err.stack) }"`);
        });

        // Checks for connectivity.  If this fails, the retryStrategy retry logic will be executed
        setInterval(() => client.ping(), 5000);

        return client;
    }

    function Subscriber(subscriptionPath) {
        this.client = createRedisClient('cc.cuteyp.subscriber.' + subscriptionPath);
        this.paused = false;
        this.on('pause', () => this.paused = true);

        queueNext.call(this);

        function queueNext() {
            process.nextTick(() => {
                this.client.brpop(subscriptionPath, 1, (err, msg) => {
                    if (!err && msg && msg.length === 2) {
                        this.emit('message', null, {
                            body: msg[1],
                            ack: function () {},
                            nack: function () {}
                        });
                    }

                    if (this.paused) return;

                    queueNext.call(this);
                });
            });
        };
    }
}
