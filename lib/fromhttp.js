'use strict';

var _ = require('lodash');

module.exports = fromHttp;

function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function fromHttp(app, queueImpl, opts, ttl) {
    var replyTo = opts.replyTo;
    var mappingFn = opts.mappingFn;
    if (!mappingFn)
        throw new Error('No mapping fn provided');

    var continuations = {};

    console.log("Subscribing to ReplyTo: ", replyTo);
    var subscriber = queueImpl.subscriber(replyTo);
    subscriber.on('message', sendHttpResponse); // Received response message from queue 

    function sendHttpResponse(error, message) {
        if (error) return console.error('read message error ' + error.message);

        var parsed = JSON.parse(message.body);
        var correlationId = parsed.correlationId;
        var httpBody = parsed.body;

        var continuation = continuations[correlationId];
        if (!continuation) {
            return console.warn("Received reply with correlationId I do not have: " + correlationId + ", ignoring (it may have expired)",
                (parsed.body ? _.extend(parsed, {body: parsed.body.substring(0, 100)}) : ''));
        }

        var req = continuation.req;
        var res = continuation.res;

        if (parsed.code) res.statusCode = parsed.code;

        if (parsed.first) {
            if (parsed.headers) {
                Object.keys(parsed.headers).forEach(function (key) {
                    var value = parsed.headers[key];
                    res.setHeader(key, value);
                });
            }

            continuation.bodySample = httpBody.substring(0, 100);

            var byteLength = httpBody ? Buffer.byteLength(httpBody) : 0;
            continuation.bodyLength = continuation.bodyLength ? continuation.bodyLength + byteLength : byteLength;
        }

        if (httpBody) {
            if (parsed.isBinary) httpBody = new Buffer(httpBody, 'base64');
            res.write(httpBody);
        }

        if (parsed.end) {
            console.log(parsed.code, req.url, continuation.bodyLength, correlationId, continuation.bodySample);
            delete continuations[correlationId];
            res.end();
        }

        message.ack();
    }
    

    // receiving data from POST
    app.use(function (req, res, next) {
        var concatenatedChunks;
        req.on('data', function (chunk) {
            concatenatedChunks = concatenatedChunks ? Buffer.concat([concatenatedChunks, chunk]) : chunk;
        });

        req.on('end', function () {
            if (concatenatedChunks) {
                var contentType = req.get('Content-Type');
                if (contentType && contentType.match(/multipart/)) {
                    req.headers['x-base64'] = true;
                    concatenatedChunks = new Buffer(concatenatedChunks).toString('base64');
                } else {
                    concatenatedChunks = new Buffer(concatenatedChunks).toString('utf8');
                }
                req.body = concatenatedChunks;
            }
            next();
        });
    });

    app.use(function (req, res, next) {
        var correlationId = guid();
        var destination = mappingFn(req);

        if (req.body) req.headers['Content-Length'] = Buffer.byteLength(req.body, 'utf8'); //override content-length with string length

        var msg = {
            headers: req.headers,
            url: req.url,
            body: req.body,
            path: req.path,
            method: req.method,
            replyTo: replyTo,
            correlationId: correlationId
        };
        continuations[correlationId] = {
            req: req,
            res: res,
            next: next
        };

        // clear out continuation if not used after some period of time
        setTimeout(function () {
            if (continuations[correlationId]) {
                var c = continuations[correlationId];
                var req = c.req;
                console.error("******************* Continuation expired for " + req.method + ", " + req.url + " (" + correlationId + ")");
                delete continuations[correlationId];
                res.send(500, "Failed to get response from endpoint");
            }
        }, 60000);

        var outgoingBody = JSON.stringify(msg);

        var headers = {
            JMSExpiration: new Date().getTime() + (ttl || 60000),
            destination: destination
        };

        console.log(req.method, req.url, correlationId, destination);
        queueImpl.send(headers, outgoingBody, function (error) {
            if (error) {
                console.error('send error ' + error.message);
                return;
            }
        });

    });
}
