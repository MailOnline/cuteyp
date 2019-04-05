'use strict';
const { EventEmitter } = require('events');
const util = require('util');
const _ = require('lodash');
const Redis = require('ioredis');
const { flattenStack } = require('./utils');
const BPROP_CONCURRENCY = process.env.CUTEYP_BPROP_CONCURRENCY
    ? process.env.CUTEYP_BPROP_CONCURRENCY
    : 1;

const sampleSeq = (start, end) => {
    let current;
    return () => {
        if (current === undefined) current = start;
        else if (current < end) current++;
        else current = start;

        return current;
    };
};

const createRedisClient = (options, namespace, isCommand = false) => {
    const client = new Redis(options);
    client.on('connect', () => {
        console.log(`METRIC ns="${namespace} connected=true`);
    });
    client.on('error', err => {
        console.error(
            `METRIC ns="${namespace + '.error'}" err="${flattenStack(
                err.stack
            )}"`
        );
    });

    // Checks for connectivity.  If this fails, the retryStrategy retry logic will be executed
    // isCommand && setInterval(() => client.ping(), 5000);
    return client;
};

const loopPromise = data =>
    data.fn().then(() => (data.break ? null : loopPromise(data)));

const brpopCallSetup = (client, subscriptionPath, eventEmitter) => () =>
    new Promise(resolve =>
        process.nextTick(() => {
            console.log('subscribing ', subscriptionPath);
            client.brpop(subscriptionPath, 1000, (err, msg) => {
                console.log('brprop result', msg);
                if (!err && msg && msg.length === 2) {
                    eventEmitter.emit('message', null, {
                        body: msg[1],
                        ack: _.noop,
                        nack: _.noop
                    });
                }

                resolve();
            });
        })
    );

const createSubscriber = (options, path, usePool) => {
    const eventEmitter = new EventEmitter();
    const createSubscriberClient = index => {
        const subscriptionPath = `${path}.${index}`;
        const client = createRedisClient(
            options,
            usePool ? subscriptionPath : path
        );
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
    eventEmitter.on('pause', () => pool.forEach(item => (item.pause = true)));
    return eventEmitter;
};

function RedisList({ usePool = false, ...options }) {
    ['host', 'port', 'retryStrategy'].forEach(prop => {
        if (!options[prop]) throw new Error(`"${prop}" option not provided`);
    });

    const next = sampleSeq(0, BPROP_CONCURRENCY - 1);

    const commandClient = createRedisClient(
        options,
        'cc.cuteyp.redislist.command',
        true
    );

    return {
        subscriber(path) {
            return createSubscriber(options, path, usePool);
        },
        send(headers, body, callback) {
            const path =
                typeof headers === 'string' ? headers : headers.destination;
            if (!path)
                return console.error('No path provided for sending to Redis');

            if (usePool) {
                body.replyTo += `.${next()}`;
            }

            commandClient.lpush(path, JSON.stringify(body), callback);
        }
    };
}

module.exports = RedisList;
