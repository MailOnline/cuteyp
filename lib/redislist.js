'use strict';
var redis = require('redis');
var EventEmitter = require("events").EventEmitter;

var commandClient;
var host;
var port;

module.exports = RedisList;

function RedisList(options) {
    options = options || {};

    host = options.host;
    port = options.port;
    commandClient = redis.createClient(options.port, options.host);

    return {
        subscriber: function (path) {
            return new Subscriber(path);
        },
        send: function (headers, body) {
            var path = typeof headers === 'string' ? headers : headers.destination;
            if (!path)
                return console.error("No path provided for sending to Redis");

            commandClient.lpush(path, body);
        }
    };
}

function Subscriber(subscriptionPath) {
    var self = this;
    self._ee = new EventEmitter();
    console.log("Subscribing to", subscriptionPath);

    self._subscriberClient = redis.createClient(port, host);

    var queueNext = function () {
        process.nextTick(function () {
            // Messages are pushed with LPUSH, making this a LIFO queue
            self._subscriberClient.blpop(subscriptionPath, 1, queueFn);
        })
    };

    var queueFn = function (err, msg) {
        if (!err && msg && msg.length === 2) {
            var message = {
                body: msg[1],
                ack: function () {
                },
                nack: function () {
                }
            };
            self._ee.emit('message', null, message);
            queueNext();

        } else {
            queueNext();
        }
    };

    queueNext();
}

Subscriber.prototype.on = function () {
    this._ee.on.apply(this._ee, arguments);
};
