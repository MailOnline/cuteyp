'use strict';
var stompit = require('stompit');
var EventEmitter = require('events').EventEmitter;

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


function Subscriber(subscriptionPath) {
    var self = this;
    self._ee = new EventEmitter();

    console.log("Subscribing to", subscriptionPath);

    channel.subscribe(subscriptionPath, function (error, message) {
        if (error) {
            console.error('subscribe error ' + error.message);
            return;
        }
        message.readString('utf8', function (error, body) {
            message.body = body;
            self._ee.emit('message', error, message);
        });
    });
}

Subscriber.prototype.on = function() {
    this._ee.on.apply(this._ee, arguments);
};
