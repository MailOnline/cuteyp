'use strict';
const { EventEmitter } = require('events');
const _ = require('lodash');
const Redis = require('ioredis');
const { flattenStack } = require('./utils');
const NS = 'cc.cuteyp.redislist';
const BPROP_CONCURRENCY = process.env.CUTEYP_BPROP_CONCURRENCY
    ? process.env.CUTEYP_BPROP_CONCURRENCY
    : 16;

const sampleSeq = (start, end) => {
    let current;
    return () => {
        if (current === undefined) current = start;
        else if (current < end) current++;
        else current = start;

        return current;
    };
};

const createRedisClient = (options, isCommand = false) => {
    const client = new Redis(options);
    client.on('connect', () => {
        console.log(`LOGME ns=${NS} connected=true`);
    });
    client.on('error', err => {
        console.error(`LOGME ns=${NS}.error err="${flattenStack(err.stack)}"`);
    });

    // Checks for connectivity.  If this fails, the retryStrategy retry logic will be executed
    isCommand && setInterval(() => client.ping(), 5000);
    return client;
};

const loopPromise = data =>
    data.fn().then(() => {
        if (data.break) return null;
        process.nextTick(() => loopPromise(data));
    });

const brpopCallSetup = (client, subscriptionPath, eventEmitter) => () =>
    new Promise(resolve =>
        client.brpop(subscriptionPath, 1, (err, msg) => {
            if (!err && msg && msg.length === 2) {
                eventEmitter.emit('message', null, {
                    body: msg[1],
                    ack: _.noop,
                    nack: _.noop
                });
            }

            resolve();
        })
    );

const createSubscriber = (options, path, usePool) => {
    const eventEmitter = new EventEmitter();
    const createSubscriberClient = index => {
        const subscriptionPath = `${path}.${index}`;
        const client = createRedisClient(options);
        const clientData = {
            fn: brpopCallSetup(
                client,
                usePool ? subscriptionPath : path,
                eventEmitter
            ),
            break: false
        };
        loopPromise(clientData);
        return clientData;
    };

    const pool = _.times(
        usePool ? BPROP_CONCURRENCY : 1,
        createSubscriberClient
    );

    eventEmitter.on('pause', () => pool.forEach(item => (item.break = true)));

    console.log(
        `LOGME ns=${NS} connected=true path=${path} usePool=${usePool} bpropConcurreny=${BPROP_CONCURRENCY}`
    );

    return eventEmitter;
};

function RedisList(options) {
    ['host', 'port', 'retryStrategy'].forEach(prop => {
        if (!options[prop]) throw new Error(`"${prop}" option not provided`);
    });

    const next = sampleSeq(0, BPROP_CONCURRENCY - 1);

    const commandClient = createRedisClient(options, true);

    return {
        subscriber(path) {
            return createSubscriber(options, path, options.usePool);
        },
        send(headers, body, callback) {
            const path =
                typeof headers === 'string' ? headers : headers.destination;
            if (!path)
                return console.error('No path provided for sending to Redis');

            if (options.usePool) {
                body.replyTo += `.${next()}`;
            }

            commandClient.lpush(path, JSON.stringify(body), callback);
        }
    };
}

module.exports = RedisList;
