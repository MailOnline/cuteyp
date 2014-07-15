'use strict';

module.exports = fromHttp;

function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8); return v.toString(16);
    });
}

function fromHttp(app, queueImpl, opts, ttl) {
    var replyTo = opts.replyTo;
    var mappingFn = opts.mappingFn;
    if (!mappingFn)
        throw new Error('No mapping fn provided');

    var continuations = {};

    var subscriber = queueImpl.subscriber(replyTo);

    subscriber.on('message', function (error, message) {
        if (error) {
            console.error('read message error ' + error.message);
            return;
        }
        var parsed = JSON.parse(message.body);
        var correlationId = parsed.correlationId;
        var httpBody = parsed.body;

        var continuation = continuations[correlationId];
        if (!continuation) {
            return console.warn("Received reply for old message, ignoring");
        }
        delete continuations[correlationId];

        var res = continuation.res;

        if (httpBody)
            console.log("sending body to client", httpBody.length, httpBody.substring(0,100));

        Object.keys(parsed.headers).forEach(function(key) {
            var value = parsed.headers[key];
            res.setHeader(key, value);
        });
        res.send(parsed.code, httpBody);

        message.ack();

    });

    app.use (function(req, res, next) {
        var data='';
        req.setEncoding('utf8');
        req.on('data', function(chunk) {
            data += chunk;
        });

        req.on('end', function() {
            req.body = data;
            next();
        });
    });

    app.use(function (req, res, next) {
        var destination = mappingFn(req);
        var correlationId = guid();

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
        setTimeout(function() {
            delete continuations[correlationId];
        }, 300000);

        var outgoingBody = JSON.stringify(msg);

        var headers = {
            JMSExpiration: new Date().getTime() + (ttl || 60000),
            destination: destination
        };

        queueImpl.send(headers, outgoingBody, function (error) {
            if (error) {
                console.error('send error ' + error.message);
                return;
            }
        });

    });
};