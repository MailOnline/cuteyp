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
    if (typeof mappingFn != 'function' || mappingFn.length < 1 || mappingFn.length > 2)
        throw new Error('No mapping fn provided or wrong function signature');

    var continuations = {};

    console.log("Subscribing to ReplyTo: ", replyTo);
    var subscriber = queueImpl.subscriber(replyTo);
    subscriber.on('message', sendHttpResponse); // Received response message from queue

    function sendHttpResponse(error, message) {
        if (error) return console.error('read message error ' + error.message);
        if (message.body) {
            var parsed = JSON.parse(message.body);

            switch (parsed.version) {
                case 2:
                    version2(parsed, continuations);
                    break;
                default:
                    version1(parsed, continuations);
                    break;

            }
            message.ack();
        }
    }

    function setHeaders(res, headers, continuation) {
        if (!continuation.headersSent) {
            continuation.headersSent = true;
            Object.keys(headers).forEach(function (key) {
                var value = headers[key];
                res.setHeader(key, value);
            });
        }
    }

    function version2(parsed, continuations) {
        var httpBody = parsed.body;

        var correlationId = parsed.correlationId;
        var continuation = continuations[correlationId];
        if (!continuation) {
            return console.warn("Received reply with correlationId I do not have: " + correlationId + ", ignoring (it may have expired)",
                (parsed.body ? _.extend(parsed, {body: parsed.body.substring(0, 100)}) : ''));
        }

        var res = continuation.res;
        var reqTime = continuation.reqTime;
        var hrDuration = process.hrtime(reqTime);
        continuation.durationMs = (hrDuration[0] * 1000) + (hrDuration[1] /1000000);

        if (parsed.code) res.statusCode = parsed.code;

        if (parsed.first) {
            if (parsed.headers) {
                setHeaders(res, parsed.headers, continuation);
            }
            continuation.bodySample = httpBody ? httpBody.substring(0, 100) : '';

            var byteLength = httpBody ? Buffer.byteLength(httpBody) : 0;
            continuation.bodyLength = continuation.bodyLength ? continuation.bodyLength + byteLength : byteLength;
        }

        if (httpBody) {
            if (parsed.isBinary) httpBody = new Buffer(httpBody, 'base64');
            res.write(httpBody);
        }

        if (parsed.end) {
            if (parsed.headers) {
                setHeaders(res, parsed.headers, continuation);
            }

            opts.postReceiveFn && opts.postReceiveFn(parsed, continuation);
            //console.log(continuation.req.method, 2, parsed.code, continuation.req.url, continuation.bodyLength, correlationId,  durationMs, parsed.headers['x-node'], continuation.bodySample);

            delete continuations[correlationId];
            res.end();
        }
    }


    function version1(parsed, continuations) {
        var httpBody = parsed.body;

        var correlationId = parsed.correlationId;
        var continuation = continuations[correlationId];

        if (!continuation) {
            return console.warn("Received reply with correlationId I do not have: " + correlationId + ", ignoring (it may have expired)",
                (parsed.body ? _.extend(parsed, {body: parsed.body.substring(0, 100)}) : ''));
        }
        var req = continuation.req;
        var res = continuation.res;

        if (parsed.headers['transfer-encoding'] == 'chunked') {
            delete parsed.headers['transfer-encoding'];
            parsed.headers['Content-Length'] = Buffer.byteLength(httpBody, 'utf8');
        }

        Object.keys(parsed.headers).forEach(function (key) {
            var value = parsed.headers[key];
            res.setHeader(key, value);
        });

        res.statusCode = parsed.code;

        if (parsed.headers["x-base64"]) {
            httpBody = new Buffer(httpBody, 'base64');
        }
        if (httpBody) res.write(httpBody);

        console.log(req.method, 1, parsed.code, req.url, httpBody ? httpBody.length : '-', correlationId, httpBody ? httpBody.substring(0, 100) : '-');

        res.end();

        delete continuations[correlationId];

    }

    // receiving data from POST
    // This block seems to prevent connect-domain from working correctly when I attempted it (Tom)
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

        if (mappingFn.length == 2) {
            mappingFn(req, function (err, destination) {
                if (err) {
                    console.error('request mapping error', err);
                    res.send(500, "Proxy Mapping Error: " + err);
                }
                else forwardRequest(destination);
            });
        } else {
            var destination = mappingFn(req);
            forwardRequest(destination);
        }

        function forwardRequest(destination) {
            //override content-length with string length
            //this has to be lowercase because it is directly applied to headers in toHttp
            //it needs to be the original body length, not Buffer.byteLength
            if (req.body) req.headers['content-length'] = req.body.length;

            var msg = {
                headers: req.headers,
                url: req.url,
                body: req.body,
                path: req.path,
                method: req.method,
                replyTo: replyTo,
                correlationId: correlationId,
                destination: destination
            };
            continuations[correlationId] = {
                reqTime: process.hrtime(),
                req: req,
                res: res,
                next: next
            };

            // clear out continuation if not used after some period of time
            setTimeout(function () {
                if (continuations[correlationId]) {
                    var c = continuations[correlationId];
                    opts.timeoutFn && opts.timeoutFn(correlationId, c);
                    delete continuations[correlationId];
                    res.send(500, "Failed to get response from endpoint");
                }
            }, 60000);

            var headers = {
                JMSExpiration: new Date().getTime() + (ttl || 60000),
                destination: destination
            };

            opts.preSendFn && opts.preSendFn(msg);

            queueImpl.send(headers, msg, function (error) {
                if (error) {
                    console.error('send error ' + error.message);
                    return;
                }

            });
        }
    });

    app.use(function (err, req, res, next) {
        console.error("Error", err);
        res.send(500, "Proxy Error: " + err);
    });

}
