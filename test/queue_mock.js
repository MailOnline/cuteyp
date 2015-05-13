'use strict';

var EventEmitter = require('events').EventEmitter
    , util = require('util');

module.exports = queueMock;

var transport, queue;

function queueMock() {
    if (!queue) {
        transport = new EventEmitter;

        queue = {
            subscriber: function(path) {
                return new Subscriber(path);
            },
            send: function (headers, body) {
                var path = typeof headers === 'string' ? headers : headers.destination;
                if (!path)
                    return console.error('No path provided for sending');
                transport.emit(path, body);
            }
        };
    }

    return queue;
}

util.inherits(Subscriber, EventEmitter)

function Subscriber(subscriptionPath) {
    var self = this;

    transport.on(subscriptionPath, function(body) {
        var message = {
            body: body,
            ack: function() {},
            nack: function() {}
        };
        self.emit('message', null, message);
    });
}
