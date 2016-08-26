'use strict';

var Response = require('./response')
    , _ = require('lodash')
    , http = require('http');

module.exports = toHttp;

function toHttp(app, queueImpl, subscriptionPath, filterFn) {
    var subscriber = queueImpl.subscriber(subscriptionPath);

    subscriber.on('message', function (error, message) {
        if (error) {
            console.error('read message error ' + error.message);
            subscriber.emit('ack');
            return message.ack();
        }

        var body = message.body;
        var parsed = JSON.parse(body);
        var replyTo = parsed.replyTo;
        var correlationId = parsed.correlationId;
        var startTime = process.hrtime();

        if (filterFn) {
            if (!filterFn(parsed)) {
                console.error("Ignoring message, failed filter");
                return;
            }
        }

        var headers = parsed.headers;
        headers.correlationId = correlationId;

        // minimal fake socket to get express
        // to work with the IncomingMessage
        var req = new http.IncomingMessage({
            readable: true,
            resume: function() {}
        });

        _.extend(req, {
            headers: parsed.headers,
            url: parsed.url,
            method: parsed.method
        });

        var res = new Response(req, {
            writeFn: function (bodyInfo, encoding) {
                var outgoingResponse = {
                    version: 2,
                    correlationId: correlationId
                };

                if (!this._headersSent) {
                    res.emit('header'); // forces headers to be set
                    this._headersSent = true;
                    outgoingResponse.first = true;
                    outgoingResponse.headers = res._headers;
                    outgoingResponse.code = res.statusCode;
                }

                if (bodyInfo.body) {
                    _.extend(outgoingResponse, bodyInfo);
                    this._bodyLength = this._bodyLength > 0 ? this._bodyLength + bodyInfo.body.length : bodyInfo.body.length;
                }
                queueImpl.send(replyTo, JSON.stringify(outgoingResponse));

            },
            endFn: function () {
                var hrDuration = process.hrtime(startTime);
                var durationMs = (hrDuration[0] * 1000) + (hrDuration[1] /1000000);
                var outgoingResponse = {
                    version: 2,
                    headers: res._headers,
                    code: res.statusCode,
                    correlationId: correlationId,
                    duration: durationMs,
                    end: true
                };

                console.log( req.method, correlationId, res.statusCode, parsed.url, replyTo, outgoingResponse.headers.location, this._bodyLength, durationMs);

                queueImpl.send(replyTo, JSON.stringify(outgoingResponse));
                message.ack();
                subscriber.emit('ack');
            }
        });

        app.handle(req, res);

        // defer to satisfy formidable multipart parser
        _.defer(function () {
            // pass in body to request so that subscribers can pick it up (jsonparser, POST requests etc)
            if (parsed.body) {
                var data = parsed.headers["x-base64"] ? new Buffer(parsed.body, 'base64') : parsed.body;
                req.emit('data', data);
            }
            req.emit('end');
        });
    });

    return subscriber;
}
