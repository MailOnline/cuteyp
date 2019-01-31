'use strict';
var IORedis = require('ioredis');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
const { flattenStack } = require('./utils');

var commandClient;
var host, port, options;

module.exports = Redis;

function Redis(_options) {
    options = _options || {};

    host = options.host;
    port = options.port;
    commandClient = new IORedis(port, host, options);
    commandClient.on('error', (err) => {
        console.error('METRIC ns="cc.cuteyp.redis.error" err="'+ flattenStack(err.stack) + '"');
    });

    return {
        subscriber: function(path) {
            return new Subscriber(path);
        },
        send: function (headers, body) {
            var path = typeof headers === 'string' ? headers : headers.destination;
            if (!path)
                return console.error("No path provided for sending to Redis");
            commandClient.publish(path, body);
        }
    };
}

util.inherits(Subscriber, EventEmitter);

function Subscriber(subscriptionPath) {
    var self = this;
    console.log("Subscribing to", subscriptionPath);

    self._subscriberClient = new IORedis(port, host, options);

    self._subscriberClient.on('error', (err) => {
        console.error('METRIC ns="cc.cuteyp.subscriber.error" err="'+ flattenStack(err.stack) + '"');
    });

    self._subscriberClient.on('pmessage', function (pattern, channel, raw) {
        var message = {
            body: raw,
            ack: function() {},
            nack: function() {}
        };
        self.emit('message', null, message);
    });

    self._subscriberClient.psubscribe(subscriptionPath);
}
