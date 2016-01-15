'use strict';
var os = require('os');
var redis = require('redis');
var EventEmitter = require('events').EventEmitter;

var commandClient;
var port, host, options;

module.exports = RedisList;

function RedisList(_options) {
    options = _options || {};

    port = options.port;
    host = options.host;
    console.log("Cuteyp connecting to redis at", host, port);
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
    self._paused = false;
    self._ee = new EventEmitter();
    console.log("Subscribing to", subscriptionPath);

    self._subscriberClient = redis.createClient(port, host, options);

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
                ack: function (replyTo) {
		    var correlationId = JSON.parse(msg[1]).correlationId;
		    self._subscriberClient.lpush(replyTo, JSON.stringify({ correlationId: correlationId, ack: { hostname: os.hostname() }}));
                },
                nack: function () {

                }
            };

	    self._ee.emit('message', null, message);
        }

	if (self._paused) return;

	queueNext();
    }
}

Subscriber.prototype.pause = function() { this._paused = true; };

Subscriber.prototype.on = function () {
    this._ee.on.apply(this._ee, arguments);
};
