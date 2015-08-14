'use strict';
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;

var commandClient;
var port, host, options;

module.exports = RedisList;

function RedisList(_options) {
    options = _options || {};

    port = options.port;
    host = options.host;
    commandClient = redis.createClient(port, host, options);

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

function Subscriber(subscriptionPath) {
    var self = this;
    self._ee = new EventEmitter();
    console.log("Subscribing to", subscriptionPath);

    self._subscriberClient = redis.createClient(port, host, options);

    queueNext();

    function queueNext() {
        process.nextTick(function () {
            self._subscriberClient.brpop(subscriptionPath, 1, queueFn);
        })
    }

    function queueFn(err, msg) {
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
    }
}

Subscriber.prototype.on = function () {
    this._ee.on.apply(this._ee, arguments);
};
