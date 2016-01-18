'use strict';
var stompit = require('stompit');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var connections;
var channel;

module.exports = Stomp;

function Stomp(options) {
    if (!options) {
        return console.log("No stomp opts provided, not connecting");
    }

    connections = new stompit.ConnectFailover([options]);
    channel = new stompit.ChannelFactory(connections);

    return {
        subscriber: function(path) {
            return new Subscriber(path);
        },
        send:function (replyTo, body) {
            channel.send(replyTo, body);
        }
    };
}

util.inherits(Subscriber, EventEmitter);

function Subscriber(subscriptionPath) {
    var self = this;
    console.log("Subscribing to", subscriptionPath);

    channel.subscribe(subscriptionPath, function (error, message) {
        if (error) {
            console.error('subscribe error ' + error.message);
            return;
        }
        message.readString('utf8', function (error, body) {
            message.body = body;
            self.emit('message', error, message);
        });
    });
}
