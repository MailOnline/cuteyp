'use strict';
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;

var commandClient;
var host, post, options;

module.exports = Redis;

function Redis(_options) {
    options = _options || {};

    host = options.host;
    port = options.port;
    commandClient = redis.createClient(port, host, options);

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

function Subscriber(subscriptionPath) {
    var self = this;
    self._ee = new EventEmitter();
    console.log("Subscribing to", subscriptionPath);

    self._subscriberClient = redis.createClient(port, host, options);

    self._subscriberClient.on('pmessage', function (pattern, channel, raw) {
        var message = {
            body: raw,
            ack: function() {},
            nack: function() {}
        };
        self._ee.emit('message', null, message);
    });

    self._subscriberClient.psubscribe(subscriptionPath);
}

Subscriber.prototype.on = function() {
    this._ee.on.apply(this._ee, arguments);
};
