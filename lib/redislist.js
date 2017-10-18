'use strict';
var Redis = require('ioredis');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
const { flattenStack } = require('./utils');

var commandClient;
var port, host, options;

module.exports = RedisList;

function RedisList(_options) {
    options = _options || {};

    port = options.port;
    host = options.host;
    console.log("Cuteyp connecting to redis at", host, port);
    commandClient = new Redis(port, host, options);

    commandClient.on('error', (err) => {
        console.error('METRIC ns="cc.cuteyp.redislist.error" err="'+ flattenStack(err.stack) + '"');
    });

    return {
        subscriber: function (path) {
            return new Subscriber(path);
        },
        send: function (headers, body, callback) {
            var path = typeof headers === 'string' ? headers : headers.destination;
            if (!path)
                return console.error("No path provided for sending to Redis");
            commandClient.lpush(path, body, callback);
        }
    };
}

util.inherits(Subscriber, EventEmitter);

function Subscriber(subscriptionPath) {
    var self = this;
    self._paused = false;
    self.on('pause', function() {
        self._paused = true;
    });

    console.log("Subscribing to", subscriptionPath);

    self._subscriberClient = new Redis(port, host, options);

    self._subscriberClient.on('error', (err) => {
        console.error('METRIC ns="cc.cuteyp.subscriber.error" err="'+ flattenStack(err.stack) + '"');
    });

    queueNext();

    function queueNext() {
        process.nextTick(function () {
            self._subscriberClient.brpop(subscriptionPath, 1, queueFn);
        });
    }

    function queueFn(err, msg) {
        if (!err && msg && msg.length === 2) {
            var message = {
                body: msg[1],
                ack: function () {},
                nack: function () {}
            };
            self.emit('message', null, message);
        }

        if (self._paused) return;

        queueNext();
    }
}
