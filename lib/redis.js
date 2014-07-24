'use strict';
var redis = require('redis');
var EventEmitter = require("events").EventEmitter;

var commandClient;
var host;
var port;

module.exports = Redis;

function Redis(options) {
    options = options || {};

    host = options.host;
    port = options.port;
    commandClient = redis.createClient(options.port, options.host);

    return {
        subscriber: function(path) {
            return new Subscriber(path);
        },
        send:function (headers, body) {
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

    self._subscriberClient = redis.createClient(port, host);

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
