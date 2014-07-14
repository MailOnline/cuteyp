var Response = require('./lib/response')
    , stompit = require('stompit')
    , _ = require('lodash')
    , express = require('express')
    , http = require('http')
    , FakeSocket = require("./lib/fakesocket");

module.exports = function (app, stompOpts, subscriptionPath, filterFn) {
    if (!stompOpts) {
        return console.log("No stomp opts provided, not connecting");
    }
    var connections = new stompit.ConnectFailover([stompOpts]);
    var channel = new stompit.ChannelFactory(connections);
    console.log("Subscribing to", subscriptionPath);

    channel.subscribe(subscriptionPath, function (error, message) {
        if (error) {
            console.error('subscribe error ' + error.message);
            return;
        }
        message.readString('utf8', function (error, body) {
            if (error) {
                console.error('read message error ' + error.message);
                return message.ack();
            }

            var parsed = JSON.parse(body);
            console.log("Received request ", parsed.url);

            var replyTo = parsed.replyTo;
            var correlationId = parsed.correlationId;
            if (filterFn) {
                if (!filterFn(parsed)) {
                    console.error("Ignoring message, failed filter");
                    return;
                }
            }
            var headers = parsed.headers;
            headers.correlationId = correlationId;

            var fakeSocket = new FakeSocket();

            var req = new http.IncomingMessage(fakeSocket);

            _.extend(req, {
                connection: {},   //to allow session to not break
                headers: parsed.headers,
                url: parsed.url,
                method: parsed.method
            });

            var baseResp = {
                __filename: __filename,
                __script: process.argv[1],
                correlationId: correlationId
            };

            var res = new Response(req, {
                endFn: function (body) {
                    res.emit('header');

                    _.extend(baseResp, {
                        headers: res._headers,
                        code: res.statusCode,
                    });

                    if (body) baseResp.body = body;

                    channel.send(replyTo, JSON.stringify(baseResp));

                    message.ack();
                }
            });

            res.on('close', function() {
                console.log("Response closed");
            });

            res.on('finish', function() {
                console.log("Response finished");
            });

            app.handle(req, res);

            req.emit('data', parsed.body);
            req.emit('end');


        });
    });
};