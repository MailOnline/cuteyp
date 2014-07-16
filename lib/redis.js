'use strict';
var redis = require('redis');
var EventEmitter = require("events").EventEmitter;
var commandClient = redis.createClient();

module.exports = Redis;

function Redis(options) {

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

    self._subscriberClient = redis.createClient();

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
