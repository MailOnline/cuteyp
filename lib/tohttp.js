'use strict';
var Response = require('./response')
    , _ = require('lodash')
    , express = require('express')
    , http = require('http');

module.exports = toHttp;

function toHttp (app, queueImpl, subscriptionPath, filterFn) {
    var subscriber = queueImpl.subscriber(subscriptionPath);

    subscriber.on('message', function (error, message) {
        if (error) {
            console.error('read message error ' + error.message);
            return message.ack();
        }

        var body = message.body;
        var parsed = JSON.parse(body);
        var replyTo = parsed.replyTo;
        var correlationId = parsed.correlationId;

        console.log(parsed.method, parsed.url, subscriptionPath, correlationId);
        if (filterFn) {
            if (!filterFn(parsed)) {
                console.error("Ignoring message, failed filter");
                return;
            }
        }

        var headers = parsed.headers;
        headers.correlationId = correlationId;

        //minimum required to get express to work with the IncomingMessage
        var fakeSocket = { readable: true };
        var req = new http.IncomingMessage(fakeSocket);

        _.extend(req, {
            headers: parsed.headers,
            url: parsed.url,
            method: parsed.method
        });

        var outgoingResponse = {
            __filename: __filename,
            __script: process.argv[1],
            correlationId: correlationId
        };

        var res = new Response(req, {
            endFn: function (body, encoding) {
                //ensure cookies get set, express patch.js subscribes to 'header' in order to set cookies
                res.emit('header');

                _.extend(outgoingResponse, {
                    headers: res._headers,
                    code: res.statusCode
                });

                if (body) {
                    outgoingResponse.body = body;
                }

                console.log( res.statusCode, parsed.url, replyTo, outgoingResponse.headers.location, body && body.substring(0,50));
                queueImpl.send(replyTo, JSON.stringify(outgoingResponse));

                message.ack();
            }
        });

        app.handle(req, res);

        // pass in body to request so that subscribers can pick it up (jsonparser, POST requests etc)
        req.emit('data', parsed.body);
        req.emit('end');


    });
};
